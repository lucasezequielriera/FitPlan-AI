import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import { jsPDF } from "jspdf";
import { parseClientTrackingExcel } from "@/lib/intakePlanExcel";
import { useAuthStore } from "@/store/authStore";
import { getDbSafe, getAuthSafe } from "@/lib/firebase";
import { adminFetch } from "@/lib/adminAuthClient";
import Navbar from "@/components/Navbar";
import { AdminShell, NAV_ITEMS, type AdminSectionId } from "@/components/admin/AdminShell";
import { AdminSubTabs } from "@/components/admin/AdminSubTabs";
import { AdminActionIcon } from "@/components/admin/AdminActionIcon";
import { useAdminFadeUp } from "@/components/admin/adminMotion";
import WeeklyStatsModal from "@/components/WeeklyStatsModal";
import ExerciseDemoMedia from "@/components/ExerciseDemoMedia";
import { normalizeExerciseMediaKey } from "@/lib/exerciseMedia";
import {
  FaArrowUp,
  FaArrowDown,
  FaCheck,
  FaChartLine,
  FaEnvelope,
  FaComment,
  FaDownload,
  FaFilePdf,
  FaFileWord,
  FaFileExcel,
  FaUser,
  FaPlusCircle,
  FaSyncAlt,
  FaEye,
  FaTrashAlt,
  FaLink,
  FaBell,
  FaWhatsapp,
  FaCircle,
  FaUserFriends,
  FaExternalLinkAlt,
  FaPen,
  FaHistory,
  FaSearch,
} from "react-icons/fa";

interface User {
  id: string;
  email: string | null;
  nombre: string | null;
  premium: boolean;
  premiumStatus: string | null;
  premiumSince: unknown;
  premiumLastPay: unknown;
  premiumExpiresAt?: Date | string | { toDate?: () => Date; seconds?: number } | null;
  premiumPlanType?: string | null;
  createdAt: unknown;
  updatedAt: unknown;
  lastLogin?: unknown;
  sexo: string | null;
  alturaCm: number | null;
  edad: number | null;
  peso: number | null;
  pesoObjetivo: number | null;
  cinturaCm: number | null;
  cuelloCm: number | null;
  caderaCm: number | null;
  atletico: boolean;
  premiumPayment: unknown;
  whatsapp?: string | null;
  ciudad?: string | null;
  pais?: string | null;
  personalTrainerAssigned?: boolean;
  personalTrainerName?: string | null;
  personalTrainerWhatsapp?: string | null;
  personalTrainerAssignedAt?: unknown;
  personalTrainerRequestNote?: string | null;
  personalTrainerPreference?: "hombre" | "mujer" | null;
  personalTrainerFocus?: string | null;
}

interface IntakeClient {
  id: string;
  nombreCompleto: string | null;
  email: string | null;
  whatsapp: string | null;
  instagram: string | null;
  servicioInteres: string | null;
  objetivoPrincipal: string | null;
  trabajoTurnos: string | null;
  diasTrabajo: string[];
  status: string | null;
  latestPlanId?: string | null;
  latestPlanActionType?: "generate" | "update" | null;
  latestPlanIncludeNutrition?: boolean;
  latestPlanIncludeTraining?: boolean;
  pais?: string | null;
  paymentStatus?: "pending" | "paid" | "failed" | null;
  paymentProvider?: "stripe" | "mercadopago" | null;
  paymentLastPaidAt?: string | null;
  createdAt: string | null;
  /** Resumen de lesiones/cirugías desde el formulario (API intakeClients). */
  clinicalTrainingHint?: string | null;
  /** Peso declarado al enviar el formulario (kg). */
  pesoInicialKg?: number | null;
  digestEmailEnabled?: boolean;
  digestFrequency?: "weekly" | "biweekly" | "monthly";
  weeklyDigestSentAt?: string | null;
  digestStartDate?: string | null;
  wellnessAutoEnabled?: boolean;
  wellnessAutoStartDate?: string | null;
  wellnessCheckinRequested?: boolean;
  wellnessCheckinRequestedAt?: string | null;
  lastWellnessCheckinAt?: string | null;
  weightRequestAutoEnabled?: boolean;
  weightRequestFrequency?: "weekly" | "biweekly" | "monthly";
  weightRequestStartDate?: string | null;
  weightCheckRequested?: boolean;
  latestWeightKg?: number | null;
  latestWeightAt?: string | null;
}

/** Heurística para pre-marcar “sin sentadilla” al abrir el modal. */
function clinicalHintSuggestsKneeCare(hint: string | null | undefined): boolean {
  if (!hint) return false;
  return /rodilla|menisc|lca|lc[aá]|cirug|operad|gonalgia|rótula|rotula|ligamento/i.test(hint);
}

type IntakePlanActionType = "generate" | "update";

interface IntakeGeneratedPlanDetail {
  id: string;
  intakeClientId: string | null;
  actionType: string | null;
  includeNutrition: boolean;
  includeTraining: boolean;
  nutritionTargets: Record<string, unknown> | null;
  input: Record<string, unknown> | null;
  plan: Record<string, unknown> | null;
  createdAt: string | null;
  updatedAt: string | null;
}

interface IntakeClientDetail extends IntakeClient {
  updatedAt: string | null;
  emailVerified?: boolean;
  whatsappVerified?: boolean;
  privacyConsentAccepted?: boolean;
  privacyConsentAt?: string | null;
  adherence?: {
    sessionsLast28d: number;
    sessionsLast56d: number;
    activeWeeksLast4: number;
    weeklyAvgLast4: number;
  } | null;
  profileEdits?: Array<{
    id: string;
    actorType: string | null;
    createdAt: string | null;
    after: Record<string, unknown> | null;
  }>;
  engagementEvents?: Array<{
    id: string;
    kind: string | null;
    status: string | null;
    source: string | null;
    createdAt: string | null;
    ymd?: string | null;
    weightKg?: number | null;
  }>;
  wellnessRecent?: Array<{
    ymd: string;
    energia: number | null;
    sueno: number | null;
    dolor: number | null;
    estres: number | null;
  }>;
  weightSeries?: Array<{
    ymd: string;
    weightKg: number;
  }>;
  timelines?: {
    day: Record<string, number>;
    week: Record<string, number>;
    month: Record<string, number>;
  } | null;
  formData: Record<string, unknown> | null;
}

type PaymentLinkProvider = "stripe" | "mercadopago";
type PaymentLinkPlan = "monthly" | "quarterly" | "annual";

const INTAKE_DETAIL_FIELD_ORDER = [
  "nombreCompleto",
  "email",
  "whatsapp",
  "servicioInteres",
  "instagram",
  "ciudadPais",
  "edad",
  "sexo",
  "alturaCm",
  "pesoKg",
  "pesoObjetivoKg",
  "objetivoPrincipal",
  "objetivoSecundario",
  "fechaObjetivo",
  "enfermedadInfancia",
  "experienciaEntrenamiento",
  "diasEntrenaActualmente",
  "diasEntrenaActualmenteDetalle",
  "diasCompromisoEntrenamiento",
  "diasCompromisoDetalle",
  "minutosPorSesion",
  "horaEntrenamiento",
  "duracionSesion",
  "planLugar",
  "materialCasa",
  "horasSentado",
  "pasosDiarios",
  "diasDisponibles",
  "dondeEntrena",
  "equipamientoDisponible",
  "lesionesDolores",
  "cirugiasPrevias",
  "medicacionSuplementos",
  "patologias",
  "nivelEstres",
  "calidadSueno",
  "horasSueno",
  "trabajoTurnos",
  "diasTrabajo",
  "comidasPorDiaHorarios",
  "apetito",
  "momentoMasHambre",
  "preferenciasAlimentos",
  "diaTipoComidas",
  "desayunoHabitual",
  "almuerzoHabitual",
  "cenaHabitual",
  "snacksBebidas",
  "restriccionesAlergias",
  "alimentosNoLeGustan",
  "alimentosSiLeGustan",
  "aguaPorDia",
  "alcoholFrecuencia",
  "fuma",
  "digestion",
  "suplementosActualesDetalle",
  "quiereSuplementos",
  "haHechoDietaAntes",
  "dietaEnQueConsistia",
  "dietaHaceCuanto",
  "dietaCuantoTiempo",
  "dietaQueTal",
  "presupuestoComida",
  "tiempoParaCocinar",
  "objetivoRendimiento",
  "objetivoEstetico",
  "textoLibreFinal",
  "motivacionPrincipal",
  "dificultadActual",
  "comentariosExtra",
  "consentimiento",
] as const;

const INTAKE_DETAIL_LABELS: Record<string, string> = {
  nombreCompleto: "Nombre completo",
  email: "Email",
  whatsapp: "WhatsApp",
  servicioInteres: "Servicio interesado",
  instagram: "Instagram",
  ciudadPais: "Ciudad y país",
  edad: "Edad",
  sexo: "Sexo",
  alturaCm: "Altura (cm)",
  pesoKg: "Peso actual (kg)",
  pesoObjetivoKg: "Peso objetivo (kg)",
  objetivoPrincipal: "Objetivo principal",
  objetivoSecundario: "Objetivo secundario",
  fechaObjetivo: "Fecha objetivo",
  experienciaEntrenamiento: "Experiencia entrenando",
  minutosPorSesion: "Minutos por sesión",
  diasEntrenaActualmente: "Días que entrena actualmente",
  diasEntrenaActualmenteDetalle: "Detalle de días actuales",
  diasCompromisoEntrenamiento: "Días de compromiso",
  diasCompromisoDetalle: "Detalle de días de compromiso",
  horaEntrenamiento: "Hora de entrenamiento",
  duracionSesion: "Duración de sesión",
  planLugar: "Plan para",
  materialCasa: "Material en casa",
  horasSentado: "Horas sentado al día",
  pasosDiarios: "Pasos diarios",
  diasDisponibles: "Días disponibles",
  dondeEntrena: "Dónde entrena",
  equipamientoDisponible: "Equipamiento disponible",
  lesionesDolores: "Lesiones o dolores",
  enfermedadInfancia: "Enfermedades desde pequeño/a",
  cirugiasPrevias: "Cirugías previas",
  medicacionSuplementos: "Medicación y suplementos",
  diabetesTipo: "Diabetes",
  hipertensionArterial: "Hipertensión arterial",
  enfermedadCorazon: "Enfermedad del corazón",
  hipotiroidismo: "Hipotiroidismo",
  colesterolTrigliceridos: "Colesterol/triglicéridos",
  molestiasDigestivasTipo: "Molestias digestivas",
  patologias: "Patologías",
  descansaBien: "Descansa bien",
  nivelEstres: "Nivel de estrés",
  calidadSueno: "Calidad del sueño",
  horasSueno: "Horas de sueño",
  trabajoTurnos: "Horas de trabajo por día",
  diasTrabajo: "Días de trabajo",
  comidasPorDiaHorarios: "Comidas por día y horarios",
  apetito: "Apetito",
  momentoMasHambre: "Momento de más hambre",
  preferenciasAlimentos: "Preferencias de alimentos",
  diaTipoComidas: "Día tipo de comidas",
  desayunoHabitual: "Desayuno habitual",
  almuerzoHabitual: "Comida habitual",
  cenaHabitual: "Cena habitual",
  snacksBebidas: "Snacks y bebidas",
  restriccionesAlergias: "Alergias/restricciones",
  alimentosNoLeGustan: "Alimentos que no le gustan",
  alimentosSiLeGustan: "Alimentos que sí le gustan",
  aguaPorDia: "Agua por día",
  alcoholFrecuencia: "Frecuencia de alcohol",
  fuma: "Fuma",
  digestion: "Digestión/molestias",
  suplementosActualesDetalle: "Suplementos actuales",
  quiereSuplementos: "Interés en suplementos",
  haHechoDietaAntes: "Ha hecho dieta antes",
  dietaEnQueConsistia: "Dieta: en qué consistía",
  dietaHaceCuanto: "Dieta: hace cuánto",
  dietaCuantoTiempo: "Dieta: cuánto tiempo",
  dietaQueTal: "Dieta: resultado",
  presupuestoComida: "Presupuesto comida",
  tiempoParaCocinar: "Tiempo para cocinar",
  objetivoRendimiento: "Objetivo de rendimiento",
  objetivoEstetico: "Objetivo estético",
  textoLibreFinal: "Texto libre final",
  motivacionPrincipal: "Motivación principal",
  dificultadActual: "Dificultad actual",
  comentariosExtra: "Comentarios extra",
  consentimiento: "Consentimiento",
};

function formatIntakeFieldValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.length > 0 ? value.map((item) => String(item)).join(", ") : "N/A";
  }
  if (typeof value === "boolean") {
    return value ? "Sí" : "No";
  }
  if (value === null || value === undefined) {
    return "N/A";
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : "N/A";
}

export type AdminView = "dashboard" | "intake" | "fitplan";

const ADMIN_SECTION_BY_VIEW: Record<AdminView, AdminSectionId> = {
  dashboard: "resumen",
  intake: "clientes",
  fitplan: "clientes",
};

/** Tarjeta de stat compacta — mismo patrón que StatCard en admin-design-preview.tsx (DESIGN_SYSTEM.md §8). */
function AdminStatCard({
  label,
  value,
  unit,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  unit?: string;
  tone?: "accent" | "success" | "warning" | "info" | "danger" | "neutral";
}) {
  const toneClass =
    tone === "accent"
      ? "text-accent"
      : tone === "success"
        ? "text-success"
        : tone === "warning"
          ? "text-warning"
          : tone === "info"
            ? "text-info"
            : tone === "danger"
              ? "text-danger"
              : "text-foreground";
  return (
    <div className="rounded-xl bg-[color-mix(in_oklab,var(--surface)_70%,transparent)] p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-text-muted">{label}</p>
      <p className={`font-display mt-1 text-2xl font-bold sm:text-3xl ${toneClass}`}>{value}</p>
      {unit ? <p className="mt-0.5 text-xs text-text-muted">{unit}</p> : null}
    </div>
  );
}

export function AdminApp({ view = "dashboard" }: { view?: AdminView }) {
  const router = useRouter();
  const { user: authUser, loading: authLoading } = useAuthStore();
  const heroFadeUp = useAdminFadeUp();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState<Partial<User>>({});
  const [saving, setSaving] = useState(false);
  const [tooltipOpenUserId, setTooltipOpenUserId] = useState<string | null>(null);
  const [locationTooltipOpenUserId, setLocationTooltipOpenUserId] = useState<string | null>(null);
  const [statusTooltipOpenUserId, setStatusTooltipOpenUserId] = useState<string | null>(null);
  const [paymentHistoryModalOpen, setPaymentHistoryModalOpen] = useState(false);
  const [selectedUserForPaymentHistory, setSelectedUserForPaymentHistory] = useState<User | null>(null);
  const [paymentHistory, setPaymentHistory] = useState<Array<{
    id?: string;
    paymentId?: string | number;
    amount: number;
    currency: string;
    date: Date | string;
    method?: string;
    status?: string;
    planType: string;
    expiresAt?: Date | string;
    paymentMethod?: string;
    isManual?: boolean;
    notes?: string;
  }>>([]);
  const [loadingPaymentHistory, setLoadingPaymentHistory] = useState(false);
  const [editingPaymentIndex, setEditingPaymentIndex] = useState<number | null>(null);
  const [editingPayment, setEditingPayment] = useState<{
    amount: number;
    date: string;
    planType: string;
    expiresAt: string;
  } | null>(null);
  const [showAddPaymentForm, setShowAddPaymentForm] = useState(false);
  const [newPayment, setNewPayment] = useState<{
    amount: string;
    planType: string;
    date: string;
    paymentMethod: string;
    notes: string;
  }>({
    amount: "",
    planType: "monthly",
    date: new Date().toISOString().split('T')[0],
    paymentMethod: "transferencia",
    notes: "",
  });
  const [savingPayment, setSavingPayment] = useState(false);
  const [weeklyStatsModalOpen, setWeeklyStatsModalOpen] = useState(false);
  const [selectedPlanIdForStats, setSelectedPlanIdForStats] = useState<string | null>(null);
  const [sendMessageModalOpen, setSendMessageModalOpen] = useState(false);
  const [selectedUserForMessage, setSelectedUserForMessage] = useState<User | null>(null);
  const [assignedTrainerModalOpen, setAssignedTrainerModalOpen] = useState(false);
  // Cerrar tooltips al hacer click fuera (solo en mobile)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (tooltipOpenUserId) {
        const target = event.target as HTMLElement;
        if (!target.closest('.relative')) {
          setTooltipOpenUserId(null);
        }
      }
      if (locationTooltipOpenUserId) {
        const target = event.target as HTMLElement;
        if (!target.closest('.relative')) {
          setLocationTooltipOpenUserId(null);
        }
      }
      if (statusTooltipOpenUserId) {
        const target = event.target as HTMLElement;
        if (!target.closest('.relative')) {
          setStatusTooltipOpenUserId(null);
        }
      }
    };
    
    if (tooltipOpenUserId || locationTooltipOpenUserId || statusTooltipOpenUserId) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [tooltipOpenUserId, locationTooltipOpenUserId, statusTooltipOpenUserId]);
  const [deleting, setDeleting] = useState(false);
  const [totalUsers, setTotalUsers] = useState<number>(0);
  const [premiumUsers, setPremiumUsers] = useState<number>(0);
  const [regularUsers, setRegularUsers] = useState<number>(0);
  const [athleticUsers, setAthleticUsers] = useState<number>(0);
  const [intakeClients, setIntakeClients] = useState<IntakeClient[]>([]);
  const [loadingIntakeClients, setLoadingIntakeClients] = useState(false);
  const [intakeSearchQuery, setIntakeSearchQuery] = useState("");
  const [intakePaymentFilter, setIntakePaymentFilter] = useState<"all" | "paid" | "pending" | "unpaid">("all");
  const [intakeServiceFilter, setIntakeServiceFilter] = useState("all");
  const [copiedFormLink, setCopiedFormLink] = useState(false);
  const [intakeClientModalOpen, setIntakeClientModalOpen] = useState(false);
  const [selectedIntakeClient, setSelectedIntakeClient] = useState<IntakeClient | null>(null);
  const [intakeClientDetail, setIntakeClientDetail] = useState<IntakeClientDetail | null>(null);
  const [intakeClientDetailLoading, setIntakeClientDetailLoading] = useState(false);
  const [intakeClientDetailError, setIntakeClientDetailError] = useState<string | null>(null);
  const [intakePlanModalOpen, setIntakePlanModalOpen] = useState(false);
  const [intakePlanClient, setIntakePlanClient] = useState<IntakeClient | null>(null);
  const [intakePlanActionType, setIntakePlanActionType] = useState<IntakePlanActionType>("generate");
  const [intakePlanIncludeNutrition, setIntakePlanIncludeNutrition] = useState(true);
  const [intakePlanIncludeTraining, setIntakePlanIncludeTraining] = useState(true);
  const [intakePlanObjectiveOverride, setIntakePlanObjectiveOverride] = useState<
    "auto" | "perder_grasa" | "ganar_musculo" | "recomposicion" | "rendimiento" | "mantener"
  >("auto");
  const [intakeTrainingStructure, setIntakeTrainingStructure] = useState<"auto" | "ppl" | "upper_lower" | "full_body">(
    "auto"
  );
  const [intakePlanAdditionalNotes, setIntakePlanAdditionalNotes] = useState("");
  const [intakePlanTrainingCoachBrief, setIntakePlanTrainingCoachBrief] = useState("");
  const [intakePlanAvoidSquatsLunges, setIntakePlanAvoidSquatsLunges] = useState(false);
  const [intakeUpdateMainNeed, setIntakeUpdateMainNeed] = useState("");
  const [intakeUpdateNutritionFeedback, setIntakeUpdateNutritionFeedback] = useState("");
  const [intakeUpdateTrainingFeedback, setIntakeUpdateTrainingFeedback] = useState("");
  const [intakeUpdateCurrentWeight, setIntakeUpdateCurrentWeight] = useState("");
  const [intakeUpdateEnergyLevel, setIntakeUpdateEnergyLevel] = useState<"baja" | "media" | "alta">("media");
  const [intakeUpdateExcelFile, setIntakeUpdateExcelFile] = useState<File | null>(null);
  const [processingIntakeAction, setProcessingIntakeAction] = useState(false);
  /** Fila del formulario de inicio mientras se genera/actualiza el plan (feedback en tabla). */
  const [intakePlanGeneratingClientId, setIntakePlanGeneratingClientId] = useState<string | null>(null);
  const [intakeGeneratedPlanModalOpen, setIntakeGeneratedPlanModalOpen] = useState(false);
  const [intakeGeneratedPlanLoading, setIntakeGeneratedPlanLoading] = useState(false);
  const [intakeGeneratedPlanError, setIntakeGeneratedPlanError] = useState<string | null>(null);
  const [intakeGeneratedPlanClient, setIntakeGeneratedPlanClient] = useState<IntakeClient | null>(null);
  const [intakeGeneratedPlan, setIntakeGeneratedPlan] = useState<IntakeGeneratedPlanDetail | null>(null);
  const [deletePlanModalOpen, setDeletePlanModalOpen] = useState(false);
  const [deletePlanClient, setDeletePlanClient] = useState<IntakeClient | null>(null);
  const [deletePlanNutrition, setDeletePlanNutrition] = useState(true);
  const [deletePlanTraining, setDeletePlanTraining] = useState(true);
  const [deleteUserModalOpen, setDeleteUserModalOpen] = useState(false);
  const [deleteUserTarget, setDeleteUserTarget] = useState<IntakeClient | null>(null);
  const [intakePaymentModalOpen, setIntakePaymentModalOpen] = useState(false);
  const [intakePaymentClient, setIntakePaymentClient] = useState<IntakeClient | null>(null);
  const [intakePaymentPlan, setIntakePaymentPlan] = useState<PaymentLinkPlan>("monthly");
  const [intakePaymentLoading, setIntakePaymentLoading] = useState(false);
  const [paymentLinkModalOpen, setPaymentLinkModalOpen] = useState(false);
  const [paymentLinkUser, setPaymentLinkUser] = useState<User | null>(null);
  const [paymentLinkProvider, setPaymentLinkProvider] = useState<PaymentLinkProvider>("stripe");
  const [paymentLinkPlan, setPaymentLinkPlan] = useState<PaymentLinkPlan>("monthly");
  const [paymentLinkLoading, setPaymentLinkLoading] = useState(false);
  const [requestingCheckinClientId, setRequestingCheckinClientId] = useState<string | null>(null);
  const [requestingWeightClientId, setRequestingWeightClientId] = useState<string | null>(null);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [selectedUserForHistory, setSelectedUserForHistory] = useState<User | null>(null);
  const [userHistory, setUserHistory] = useState<{
    user: unknown;
    plans: unknown[];
    history: unknown[];
    weightRecords?: Array<{ fecha: string; peso: number; planId: string; planCreatedAt?: string }>;
  } | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [intakeEmailHistoryOpen, setIntakeEmailHistoryOpen] = useState(false);
  const [intakeEmailHistoryClient, setIntakeEmailHistoryClient] = useState<IntakeClient | null>(null);
  const [intakeEmailHistoryLoading, setIntakeEmailHistoryLoading] = useState(false);
  const [sendingIntakeWelcomeEmail, setSendingIntakeWelcomeEmail] = useState(false);
  const [intakeEmailHistoryMessage, setIntakeEmailHistoryMessage] = useState<string | null>(null);
  const [intakeEmailHistoryItems, setIntakeEmailHistoryItems] = useState<
    Array<{
      id: string;
      subject?: string | null;
      to?: string | null;
      weekKey?: string | null;
      createdAt?: string | null;
      html?: string | null;
      status?: string | null;
      error?: string | null;
      frequency?: string | null;
    }>
  >([]);
  const [adminMeta, setAdminMeta] = useState<{ lastUsersCheck?: string | null }>({});
  /** Evita seguir golpeando /api/admin/stats tras error de cuota */
  const [statsPollingPaused, setStatsPollingPaused] = useState(false);
  const lastUsersCheckPollRef = useRef<string | null>(null);
  const loadUserStatsRef = useRef<((lastUsersCheck?: string | null, silent?: boolean) => Promise<void>) | null>(null);
  const [newUsersList, setNewUsersList] = useState<Array<{ id: string; nombre: string | null; email: string | null; createdAt?: string | null }>>([]);
  const [newUserIds, setNewUserIds] = useState<string[]>([]);
  const [markingNewUsersSeen, setMarkingNewUsersSeen] = useState(false);
  const [trainerPreferenceFilter, setTrainerPreferenceFilter] = useState<"all" | "hombre" | "mujer">("all");
  const [assignedTrainerVisibleCount, setAssignedTrainerVisibleCount] = useState(12);
  useEffect(() => {
    setAssignedTrainerVisibleCount(12);
  }, [trainerPreferenceFilter]);
  
  // Estadísticas de ganancias
  const [revenueStats, setRevenueStats] = useState({
    estimatedMonthly: 0,
    actualMonthly: 0, // Ganancias reales del mes actual
    premiumActiveThisMonth: 0,
    pendingPayments: 0,
    estimatedAnnual: 0,
    renewingSoon: 0,
    totalPremiumUsers: 0,
    totalRevenueFromPayments: 0, // Suma real de todos los pagos de usuarios premium
  });

  const [yearlyEarningsModalOpen, setYearlyEarningsModalOpen] = useState(false);
  const [yearlyEarningsYear, setYearlyEarningsYear] = useState(() => new Date().getFullYear());
  const [yearlyEarningsLoading, setYearlyEarningsLoading] = useState(false);
  const [yearlyEarningsPayload, setYearlyEarningsPayload] = useState<{
    year: number;
    months: Array<{
      monthIndex: number;
      monthId: string;
      monthLabel: string;
      totalEarningsArs: number;
      totalEarningsEur: number;
      legacyTotal: number;
      paymentCount: number;
    }>;
    yearlyTotalArs: number;
    yearlyTotalEur: number;
    yearlyLegacyTotal: number;
  } | null>(null);

  // Función para convertir timestamp a Date
  const convertTimestampToDate = (ts: unknown): Date | null => {
    if (!ts) return null;
    if (ts instanceof Date) return ts;
    if (typeof ts === 'string') return new Date(ts);
    if (typeof ts === 'object' && 'toDate' in ts && typeof (ts as { toDate: () => Date }).toDate === 'function') {
      return (ts as { toDate: () => Date }).toDate();
    }
    if (typeof ts === 'object' && 'seconds' in ts) {
      const seconds = (ts as { seconds: number; nanoseconds?: number }).seconds;
      return new Date(seconds * 1000);
    }
    return null;
  };

  // Función para determinar estado de pago basado en premiumExpiresAt
  const getPaymentStatus = (user: User): { 
    status: "paid" | "expiring" | "expired" | "unpaid"; 
    label: string; 
    color: string;
    expiresAt: Date | null;
    daysUntilExpiry: number | null;
  } => {
    // Solo verificar estado de pago para usuarios premium
    if (!user.premium) {
      return { 
        status: "unpaid", 
        label: "Regular", 
        color: "gray",
        expiresAt: null,
        daysUntilExpiry: null
      };
    }

    const now = new Date();
    let expiresAt: Date | null = null;

    // Intentar obtener la fecha de vencimiento
    if (user.premiumExpiresAt) {
      expiresAt = convertTimestampToDate(user.premiumExpiresAt);
    }

    // Si falta premiumExpiresAt, fallback a premiumLastPay + planType.
    // Importante: no recalcular nunca desde "ahora", porque distorsiona los días restantes.
    if (!expiresAt && user.premiumLastPay) {
      const lastPayDate = convertTimestampToDate(user.premiumLastPay);
      if (lastPayDate) {
        expiresAt = new Date(lastPayDate);
        const planType = user.premiumPlanType || "monthly";
        switch (planType) {
          case "monthly":
            expiresAt.setMonth(expiresAt.getMonth() + 1);
            break;
          case "quarterly":
            expiresAt.setMonth(expiresAt.getMonth() + 3);
            break;
          case "annual":
            expiresAt.setFullYear(expiresAt.getFullYear() + 1);
            break;
        }
      }
    }

    if (!expiresAt) {
      // Si no hay fecha de vencimiento y el status no es active, considerar como sin pagar
      if (user.premiumStatus !== "active") {
        return { 
          status: "unpaid", 
          label: "Sin Fecha", 
          color: "red",
          expiresAt: null,
          daysUntilExpiry: null
        };
      }
      // Si no hay fechas confiables, evitar inventar una para no mostrar días incorrectos.
      return {
        status: "unpaid",
        label: "Sin Fecha",
        color: "red",
        expiresAt: null,
        daysUntilExpiry: null
      };
    }

    const diffTime = expiresAt.getTime() - now.getTime();
    const daysUntilExpiry = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // Si ya venció, mostrar vencido sin excepciones para mantener precisión del tooltip.
    if (daysUntilExpiry < 0) {
      return { 
        status: "expired", 
        label: "Vencido", 
        color: "red",
        expiresAt,
        daysUntilExpiry
      };
    }

    // Si vence en los próximos 7 días
    if (daysUntilExpiry <= 7) {
      return { 
        status: "expiring", 
        label: "Por Vencer", 
        color: "yellow",
        expiresAt,
        daysUntilExpiry
      };
    }

    // Si está vigente
    return { 
      status: "paid", 
      label: "Activo", 
      color: "green",
      expiresAt,
      daysUntilExpiry
    };
  };

  // Función para obtener el emoji de la bandera del país
  const getIMCStatus = (peso: number | null, alturaCm: number | null): { status: "bajo" | "saludable" | "excedido"; icon: React.ReactElement; color: string; weightDifference?: number } => {
    if (!peso || !alturaCm || alturaCm === 0) {
      return {
        status: "saludable",
        icon: <FaCheck className="text-muted" />,
        color: "text-muted"
      };
    }

    // Calcular IMC: peso (kg) / (altura (m))^2
    const alturaM = alturaCm / 100;
    const imc = peso / (alturaM * alturaM);

    // Calcular límites del rango saludable (IMC 18.5-25)
    const pesoMinimo = 18.5 * (alturaM * alturaM); // Límite inferior saludable
    const pesoMaximo = 25 * (alturaM * alturaM); // Límite superior saludable

    // Clasificación IMC según OMS
    if (imc < 18.5) {
      // Si está bajo peso, comparar con el límite inferior
      const diferencia = pesoMinimo - peso;
      return {
        status: "bajo",
        icon: <FaArrowDown className="text-info" />,
        color: "text-info",
        weightDifference: diferencia
      };
    } else if (imc >= 18.5 && imc < 25) {
      return {
        status: "saludable",
        icon: <FaCheck className="text-success" />,
        color: "text-success"
      };
    } else {
      // Si está excedido, comparar con el límite superior
      const diferencia = peso - pesoMaximo;
      return {
        status: "excedido",
        icon: <FaArrowUp className="text-danger" />,
        color: "text-danger",
        weightDifference: diferencia
      };
    }
  };

  const getCountryFlag = (countryName: string | null | undefined): string => {
    if (!countryName) return "🌍";
    
    // Mapeo de países comunes a emojis de banderas
    const countryFlags: Record<string, string> = {
      "Argentina": "🇦🇷",
      "United States": "🇺🇸",
      "USA": "🇺🇸",
      "España": "🇪🇸",
      "Spain": "🇪🇸",
      "México": "🇲🇽",
      "Mexico": "🇲🇽",
      "Chile": "🇨🇱",
      "Colombia": "🇨🇴",
      "Perú": "🇵🇪",
      "Peru": "🇵🇪",
      "Uruguay": "🇺🇾",
      "Paraguay": "🇵🇾",
      "Brasil": "🇧🇷",
      "Brazil": "🇧🇷",
      "Venezuela": "🇻🇪",
      "Ecuador": "🇪🇨",
      "Bolivia": "🇧🇴",
      "Costa Rica": "🇨🇷",
      "Panamá": "🇵🇦",
      "Panama": "🇵🇦",
      "Guatemala": "🇬🇹",
      "Honduras": "🇭🇳",
      "El Salvador": "🇸🇻",
      "Nicaragua": "🇳🇮",
      "República Dominicana": "🇩🇴",
      "Dominican Republic": "🇩🇴",
      "Cuba": "🇨🇺",
      "Puerto Rico": "🇵🇷",
      "Francia": "🇫🇷",
      "France": "🇫🇷",
      "Italia": "🇮🇹",
      "Italy": "🇮🇹",
      "Alemania": "🇩🇪",
      "Germany": "🇩🇪",
      "Reino Unido": "🇬🇧",
      "United Kingdom": "🇬🇧",
      "UK": "🇬🇧",
      "Canadá": "🇨🇦",
      "Canada": "🇨🇦",
      "Australia": "🇦🇺",
      "Nueva Zelanda": "🇳🇿",
      "New Zealand": "🇳🇿",
      "Japón": "🇯🇵",
      "Japan": "🇯🇵",
      "China": "🇨🇳",
      "Corea del Sur": "🇰🇷",
      "South Korea": "🇰🇷",
      "India": "🇮🇳",
      "Rusia": "🇷🇺",
      "Russia": "🇷🇺",
      "Turquía": "🇹🇷",
      "Turkey": "🇹🇷",
      "Egipto": "🇪🇬",
      "Egypt": "🇪🇬",
      "Sudáfrica": "🇿🇦",
      "South Africa": "🇿🇦",
    };
    
    // Buscar coincidencia exacta o parcial (case insensitive)
    const countryLower = countryName.toLowerCase();
    for (const [key, flag] of Object.entries(countryFlags)) {
      if (key.toLowerCase() === countryLower || countryLower.includes(key.toLowerCase())) {
        return flag;
      }
    }
    
    // Si no se encuentra, retornar emoji genérico
    return "🌍";
  };

  // Función para obtener ganancias mensuales reales desde Firestore
  const fetchMonthlyEarnings = async () => {
    if (!authUser?.uid) return 0;
    
    try {
      const now = new Date();
      const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
      const currentYear = now.getFullYear();
      const monthId = `${currentYear}-${currentMonth}`;
      
      const response = await adminFetch(`/api/admin/monthlyEarnings?monthId=${monthId}&adminUserId=${authUser.uid}`);
      if (!response.ok) {
        console.warn("No se pudieron obtener las ganancias mensuales");
        return 0;
      }
      const data = await response.json();
      if (typeof data.totalEarnings === "number") return data.totalEarnings;
      const ars = typeof data.totalEarningsArs === "number" ? data.totalEarningsArs : 0;
      const eur = typeof data.totalEarningsEur === "number" ? data.totalEarningsEur : 0;
      return ars + eur * 2000;
    } catch (error) {
      console.error("Error al obtener ganancias mensuales:", error);
      return 0;
    }
  };

  // Función para calcular estadísticas de ganancias basadas en datos reales
  const calculateRevenueStats = async () => {
    const PLAN_PRICES = {
      ARS: {
        monthly: 10000,
        quarterly: 24000,
        annual: 50000,
      },
      EUR: {
        monthly: 5,
        quarterly: 12,
        annual: 25,
      },
    };
    
    const premiumUsersList = users.filter(u => u.premium && u.email?.toLowerCase() !== "admin@fitplan-ai.com");
    
    // Calcular ganancias reales basadas en pagos de usuarios
    let totalRevenueFromPayments = 0;
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    premiumUsersList.forEach(user => {
      // Intentar obtener el monto del pago real
      let paymentAmount = 0;
      
      if (user.premiumPayment && typeof user.premiumPayment === 'object') {
        const payment = user.premiumPayment as Record<string, unknown>;
        if (typeof payment.amount === 'number') {
          paymentAmount = payment.amount;
        } else if (typeof payment.amount === 'string') {
          paymentAmount = parseFloat(payment.amount);
        } else if (typeof payment.transaction_amount === 'number') {
          paymentAmount = payment.transaction_amount;
        }
      }
      
      // Si no hay monto de pago, estimar basado en el tipo de plan
      if (paymentAmount === 0 && user.premiumPlanType) {
        paymentAmount = PLAN_PRICES.ARS[user.premiumPlanType as keyof typeof PLAN_PRICES.ARS] || 10000;
      }
      
      // Verificar si el pago fue este mes
      const lastPayISO = convertTimestampToISO(user.premiumLastPay);
      if (lastPayISO) {
        const lastPayDate = new Date(lastPayISO);
        if (!isNaN(lastPayDate.getTime())) {
          const paymentMonth = lastPayDate.getMonth();
          const paymentYear = lastPayDate.getFullYear();
          
          // Si el pago fue este mes, sumarlo a las ganancias reales
          if (paymentMonth === currentMonth && paymentYear === currentYear) {
            totalRevenueFromPayments += paymentAmount;
          }
        }
      }
    });
    
    // Obtener ganancias mensuales reales desde Firestore
    const actualMonthly = await fetchMonthlyEarnings();
    
    // Usuarios que pagaron este mes (con plan activo)
    const paidThisMonth = premiumUsersList.filter(user => {
      const status = getPaymentStatus(user);
      return status.status === "paid" || status.status === "expiring";
    });
    const premiumActiveThisMonth = paidThisMonth.length;
    
    // Usuarios premium que no han pagado este mes
    const pendingPayments = premiumUsersList.length - premiumActiveThisMonth;
    
    // Calcular proyección mensual basada en tipos de plan reales
    let estimatedMonthly = 0;
    premiumUsersList.forEach(user => {
      const status = getPaymentStatus(user);
      if (status.status === "paid" || status.status === "expiring") {
        // Calcular el valor mensual equivalente según el tipo de plan
        if (user.premiumPlanType === "monthly") {
          estimatedMonthly += PLAN_PRICES.ARS.monthly;
        } else if (user.premiumPlanType === "quarterly") {
          estimatedMonthly += PLAN_PRICES.ARS.quarterly / 3; // Dividir por 3 meses
        } else if (user.premiumPlanType === "annual") {
          estimatedMonthly += PLAN_PRICES.ARS.annual / 12; // Dividir por 12 meses
        } else {
          // Fallback a precio mensual estándar
          estimatedMonthly += PLAN_PRICES.ARS.monthly;
        }
      }
    });
    
    const estimatedAnnual = estimatedMonthly * 12;
    
    // Usuarios premium cuya renovación ocurrirá en los próximos 7 días
    const renewingSoon = premiumUsersList.filter(user => {
      const status = getPaymentStatus(user);
      if (status.status !== "paid") return false;
      
      if (status.expiresAt) {
        const daysUntilExpiry = status.daysUntilExpiry || 0;
        return daysUntilExpiry > 0 && daysUntilExpiry <= 7;
      }
      
      // Fallback al método anterior si no hay expiresAt
      const lastPayISO = convertTimestampToISO(user.premiumLastPay);
      if (!lastPayISO) return false;
      const lastPayDate = new Date(lastPayISO);
      if (isNaN(lastPayDate.getTime())) return false;
      const diffDays = (now.getTime() - lastPayDate.getTime()) / (1000 * 60 * 60 * 24);
      
      // Calcular días hasta renovación según tipo de plan
      let daysUntilRenewal = 0;
      if (user.premiumPlanType === "monthly") {
        daysUntilRenewal = 30 - diffDays;
      } else if (user.premiumPlanType === "quarterly") {
        daysUntilRenewal = 90 - diffDays;
      } else if (user.premiumPlanType === "annual") {
        daysUntilRenewal = 365 - diffDays;
      } else {
        daysUntilRenewal = 30 - diffDays; // Fallback
      }
      
      return daysUntilRenewal > 0 && daysUntilRenewal <= 7;
    }).length;
    
    setRevenueStats({
      estimatedMonthly: Math.round(estimatedMonthly),
      actualMonthly: actualMonthly || totalRevenueFromPayments, // Usar ganancias reales de Firestore o calculadas
      premiumActiveThisMonth,
      pendingPayments,
      estimatedAnnual: Math.round(estimatedAnnual),
      renewingSoon,
      totalPremiumUsers: premiumUsersList.length,
      totalRevenueFromPayments: Math.round(totalRevenueFromPayments),
    });
  };

  const convertTimestampToISO = (value: unknown): string | null => {
    if (!value) return null;
    try {
      if (value instanceof Date) {
        return value.toISOString();
      }
      if (typeof value === "string") {
        const parsed = new Date(value);
        return isNaN(parsed.getTime()) ? null : parsed.toISOString();
      }
      if (typeof value === "number") {
        return new Date(value).toISOString();
      }
      if (typeof value === "object") {
        if (value && "toDate" in value && typeof (value as { toDate: () => Date }).toDate === "function") {
          const date = (value as { toDate: () => Date }).toDate();
          return date.toISOString();
        }
        if (value && "seconds" in value && typeof (value as { seconds: number }).seconds === "number") {
          const { seconds, nanoseconds = 0 } = value as { seconds: number; nanoseconds?: number };
          return new Date(seconds * 1000 + nanoseconds / 1_000_000).toISOString();
        }
      }
    } catch (error) {
      console.error("Error al convertir timestamp a ISO:", error, value);
    }
    return null;
  };

  const formatDateTimeWithHour = (iso?: string | null) => {
    if (!iso) return "N/A";
    const date = new Date(iso);
    if (isNaN(date.getTime())) return "N/A";
    return date.toLocaleString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const isCurrentMonthPaid = (user: User): boolean => {
    if (!user.premium) return false;
    const lastPayISO = convertTimestampToISO(user.premiumLastPay);
    if (!lastPayISO) return false;
    const date = new Date(lastPayISO);
    const now = new Date();
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  };

  const inferProviderByCountry = (pais?: string | null): PaymentLinkProvider => {
    const c = (pais || "").toLowerCase();
    return c.includes("argentina") ? "mercadopago" : "stripe";
  };

  const isIntakeCurrentMonthPaid = (client: IntakeClient): boolean => {
    if (client.paymentStatus !== "paid" || !client.paymentLastPaidAt) return false;
    const date = new Date(client.paymentLastPaidAt);
    if (isNaN(date.getTime())) return false;
    const now = new Date();
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  };

  const formatShortDate = (iso?: string | null): string => {
    if (!iso) return "N/A";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "N/A";
    return d.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
  };

  const getNextDigestDate = (client: IntakeClient): Date | null => {
    if (client.digestEmailEnabled === false) return null;
    const now = new Date();
    const startBase =
      client.digestStartDate && !isNaN(new Date(`${client.digestStartDate}T00:00:00`).getTime())
        ? new Date(`${client.digestStartDate}T00:00:00`)
        : null;
    const base =
      client.weeklyDigestSentAt && !isNaN(new Date(client.weeklyDigestSentAt).getTime())
        ? new Date(client.weeklyDigestSentAt)
        : startBase || now;
    const next = new Date(base);
    if (client.digestFrequency === "monthly") next.setDate(next.getDate() + 30);
    else if (client.digestFrequency === "biweekly") next.setDate(next.getDate() + 14);
    else next.setDate(next.getDate() + 7);
    return next;
  };

  const digestScheduleLabel = (client: IntakeClient): string => {
    if (client.digestEmailEnabled === false) return "Automático desactivado";
    const next = getNextDigestDate(client);
    if (!next) return "Sin fecha";
    return `Próximo envío aprox: ${next.toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })}`;
  };

  const getWellnessStatus = (client: IntakeClient): { label: string; className: string } => {
    if (client.wellnessCheckinRequested) {
      return { label: "Pendiente", className: "badge-warning" };
    }
    if (!client.lastWellnessCheckinAt) {
      return { label: "Sin check-in", className: "badge-danger" };
    }
    const last = new Date(client.lastWellnessCheckinAt);
    if (isNaN(last.getTime())) {
      return { label: "Sin check-in", className: "badge-danger" };
    }
    const days = Math.floor((Date.now() - last.getTime()) / 86400000);
    if (days <= 2) {
      return { label: "Al día", className: "badge-success" };
    }
    if (days <= 7) {
      return { label: `Hace ${days}d`, className: "badge-warning" };
    }
    return { label: `Atrasado ${days}d`, className: "badge-danger" };
  };


  useEffect(() => {
    if (users.length > 0 && authUser?.uid) {
      calculateRevenueStats();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users, authUser]);

  // Verificar si el usuario es administrador
  useEffect(() => {
    const checkAdmin = async () => {
      if (authLoading) return;

      if (!authUser) {
        router.push("/");
        return;
      }

      try {
        const auth = getAuthSafe();
        if (!auth?.currentUser) {
          setError("No se pudo acceder a la autenticación");
          setLoading(false);
          return;
        }

        let lastUsersCheckISO: string | null = null;

        // Primero verificar el email de Firebase Auth (disponible inmediatamente)
        const authEmail = auth.currentUser.email?.toLowerCase() || "";
        const isAuthAdmin = authEmail === "admin@fitplan-ai.com";

        // Obtener la base de datos y el documento del usuario
        const db = getDbSafe();
        if (!db) {
          setError("No se pudo acceder a la base de datos");
          setLoading(false);
          return;
        }

        const { doc, getDoc, setDoc, updateDoc, serverTimestamp } = await import("firebase/firestore");
        const userRef = doc(db, "usuarios", auth.currentUser.uid);
        const userDoc = await getDoc(userRef);
        
        // Verificar y crear/actualizar documento del admin si es necesario
        if (isAuthAdmin) {
          if (!userDoc.exists()) {
            const nowISO = new Date().toISOString();
            try {
              await setDoc(userRef, {
                email: auth.currentUser.email || "admin@fitplan-ai.com",
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                lastUsersCheck: serverTimestamp(),
              });
              console.log("✅ Documento de administrador creado");
              await new Promise(resolve => setTimeout(resolve, 1500));
            } catch (createError) {
              console.error("Error al crear documento de administrador:", createError);
            }
            lastUsersCheckISO = nowISO;
          } else {
            const userData = userDoc.data();
            const needsUpdate = !userData.email || userData.email.toLowerCase() !== "admin@fitplan-ai.com";
            
            if (needsUpdate) {
              try {
                await updateDoc(userRef, {
                  email: auth.currentUser.email || "admin@fitplan-ai.com",
                  updatedAt: serverTimestamp(),
                });
                console.log("✅ Documento de administrador actualizado");
                await new Promise(resolve => setTimeout(resolve, 1500));
              } catch (updateError) {
                console.error("Error al actualizar documento de administrador:", updateError);
              }
            }

            lastUsersCheckISO = convertTimestampToISO(userData.lastUsersCheck);
            // NO actualizar automáticamente aquí - solo se actualiza al marcar como visto o al desconectarse
            // Esto permite que el admin vea la notificación de usuarios nuevos al entrar
            if (!lastUsersCheckISO) {
              // Solo inicializar si no existe
              const nowISO = new Date().toISOString();
              try {
                await updateDoc(userRef, {
                  lastUsersCheck: serverTimestamp(),
                  updatedAt: serverTimestamp(),
                });
                lastUsersCheckISO = nowISO;
              } catch (updateError) {
                console.error("Error al inicializar lastUsersCheck:", updateError);
                lastUsersCheckISO = nowISO;
              }
            }
          }

          setAdminMeta({ lastUsersCheck: lastUsersCheckISO });
          setIsAdmin(true);
          await loadUserStats(lastUsersCheckISO);
          return;
        }

        // Si no es admin por email de Auth, verificar en el documento
        if (userDoc.exists()) {
          const userData = userDoc.data();
          const email = userData.email?.toLowerCase() || "";
          const isAdminUser = email === "admin@fitplan-ai.com";
          
          if (isAdminUser) {
            lastUsersCheckISO = convertTimestampToISO(userData.lastUsersCheck);
            // NO actualizar automáticamente aquí - solo se actualiza al marcar como visto o al desconectarse
            // Esto permite que el admin vea la notificación de usuarios nuevos al entrar
            if (!lastUsersCheckISO) {
              // Solo inicializar si no existe
              const nowISO = new Date().toISOString();
              try {
                await updateDoc(userRef, {
                  lastUsersCheck: serverTimestamp(),
                  updatedAt: serverTimestamp(),
                });
                lastUsersCheckISO = nowISO;
              } catch (updateError) {
                console.error("Error al inicializar lastUsersCheck:", updateError);
                lastUsersCheckISO = nowISO;
              }
            }

            setAdminMeta({ lastUsersCheck: lastUsersCheckISO });
            setIsAdmin(true);
            await loadUserStats(lastUsersCheckISO);
          } else {
            setError("Acceso denegado. Solo administradores pueden acceder.");
            setLoading(false);
          }
        } else {
          setError("Usuario no encontrado en la base de datos.");
          setLoading(false);
        }
      } catch (err) {
        console.error("Error al verificar admin:", err);
        setError("Error al verificar permisos de administrador");
        setLoading(false);
      }
    };

    checkAdmin();
    // loadUserStats se maneja manualmente para evitar bucles de recarga
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser, authLoading, router]);

  useEffect(() => {
    lastUsersCheckPollRef.current = adminMeta.lastUsersCheck ?? null;
  }, [adminMeta.lastUsersCheck]);

  // Polling cada 5 min — deps sin adminMeta.lastUsersCheck para no reiniciar el intervalo al marcar "visto"
  useEffect(() => {
    if (!isAdmin || !authUser || statsPollingPaused) return;

    const pollInterval = setInterval(async () => {
      try {
        await loadUserStatsRef.current?.(lastUsersCheckPollRef.current, true);
      } catch (error) {
        const msg = error instanceof Error ? error.message : "";
        const name = error instanceof Error ? error.name : "";
        if (
          msg.includes("RESOURCE_EXHAUSTED") ||
          msg.includes("Cuota de Firestore") ||
          name === "QuotaExceededError"
        ) {
          console.warn("⚠️ Cuota de Firestore: polling de estadísticas detenido");
          setStatsPollingPaused(true);
        }
      }
    }, 300000);

    return () => clearInterval(pollInterval);
  }, [isAdmin, authUser, statsPollingPaused]);

  useEffect(() => {
    if (!yearlyEarningsModalOpen || !authUser?.uid) return;
    let cancelled = false;
    (async () => {
      setYearlyEarningsLoading(true);
      try {
        const res = await adminFetch(
          `/api/admin/yearlyEarnings?year=${yearlyEarningsYear}&adminUserId=${encodeURIComponent(authUser.uid)}`
        );
        if (!res.ok) throw new Error("yearlyEarnings");
        const data = await res.json();
        if (!cancelled) setYearlyEarningsPayload(data);
      } catch {
        if (!cancelled) setYearlyEarningsPayload(null);
      } finally {
        if (!cancelled) setYearlyEarningsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [yearlyEarningsModalOpen, yearlyEarningsYear, authUser?.uid]);

  const loadUserStats = async (lastUsersCheck?: string | null, silent = false) => {
    try {
      if (!silent) {
        setLoading(true);
      }
      const auth = getAuthSafe();
      
      if (!auth?.currentUser) {
        setLoading(false);
        return;
      }

      // Llamar al endpoint API para obtener estadísticas
      const response = await adminFetch(`/api/admin/stats?userId=${auth.currentUser.uid}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Error desconocido" }));
        console.error("❌ Error del API:", errorData);
        
        // Manejar error de cuota excedida de manera especial
        if (errorData.detail?.includes('RESOURCE_EXHAUSTED') || errorData.error?.includes('Quota exceeded')) {
          const quotaError = new Error('Cuota de Firestore excedida. Por favor, espera unos minutos antes de intentar nuevamente.');
          quotaError.name = 'QuotaExceededError';
          throw quotaError;
        }
        
        throw new Error(errorData.detail || errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      setStatsPollingPaused(false);

      // Mostrar toda la información en console.log
      console.log("📊 ESTADÍSTICAS DE USUARIOS:", data.stats);
      console.log("👥 LISTA COMPLETA DE USUARIOS:", data.users);
      console.log("📈 Total de usuarios:", data.stats?.total);
      console.log("⭐ Usuarios premium:", data.stats?.premium);
      console.log("👤 Usuarios regulares:", data.stats?.regular);
      console.log("💪 Usuarios atléticos:", data.stats?.athletic);
      
      // Actualizar los contadores
      if (data.stats) {
        setTotalUsers(data.stats.total || 0);
        setPremiumUsers(data.stats.premium || 0);
        setRegularUsers(data.stats.regular || 0);
        setAthleticUsers(data.stats.athletic || 0);
      }

      // Guardar los usuarios para mostrarlos en la tabla
      if (data.users && Array.isArray(data.users)) {
        // Función auxiliar para obtener timestamp numérico para ordenar
        const getTimestamp = (timestamp: unknown): number => {
          if (!timestamp) return 0;
          
          try {
            if (timestamp instanceof Date) {
              return timestamp.getTime();
            } else if (typeof timestamp === 'string') {
              return new Date(timestamp).getTime();
            } else if (timestamp && typeof timestamp === 'object' && 'toDate' in timestamp && typeof timestamp.toDate === 'function') {
              return (timestamp as { toDate: () => Date }).toDate().getTime();
            } else if (timestamp && typeof timestamp === 'object' && 'seconds' in timestamp) {
              const ts = timestamp as { seconds: number; nanoseconds?: number };
              return ts.seconds * 1000 + (ts.nanoseconds || 0) / 1000000;
            }
          } catch (error) {
            console.error("Error al obtener timestamp:", error);
          }
          
          return 0;
        };
        
        // Ordenar usuarios por fecha de creación (más reciente primero)
        const sortedUsers = [...data.users].sort((a, b) => {
          const aTime = getTimestamp(a.createdAt);
          const bTime = getTimestamp(b.createdAt);
          return bTime - aTime; // Orden descendente (más reciente primero)
        });

        // Calcular usuarios nuevos desde la última revisión
        const effectiveLastUsersCheckISO = lastUsersCheck ?? adminMeta.lastUsersCheck ?? null;
        let extractedNewUsers: Array<{ id: string; nombre: string | null; email: string | null; createdAt?: string | null }> = [];
        if (effectiveLastUsersCheckISO) {
          const lastCheckDate = new Date(effectiveLastUsersCheckISO);
          if (!isNaN(lastCheckDate.getTime())) {
            const lastCheckTime = lastCheckDate.getTime();
            extractedNewUsers = sortedUsers
              .filter((user: Record<string, unknown>) => {
                const email = typeof user.email === "string" ? user.email.toLowerCase() : "";
                if (email === "admin@fitplan-ai.com") return false;
                const createdAtTime = getTimestamp(user.createdAt);
                return createdAtTime > lastCheckTime;
              })
              .map((user: Record<string, unknown>) => ({
                id: String(user.id || ""),
                nombre: (user.nombre as string | null) || null,
                email: (user.email as string | null) || null,
                createdAt: convertTimestampToISO(user.createdAt),
              }))
              .filter(user => !!user.id);
          }
        }
        
        setNewUsersList(extractedNewUsers);
        setNewUserIds(extractedNewUsers.map(user => user.id));
        
        setUsers(sortedUsers);
        console.log(`✅ ${sortedUsers.length} usuarios cargados y ordenados por fecha de creación`);
        
        // Verificar y desactivar premium vencido para todos los usuarios premium
        const premiumUsers = sortedUsers.filter(u => u.premium);
        for (const user of premiumUsers) {
          const status = getPaymentStatus(user);
          if (status.status === "expired") {
            // Desactivar premium vencido automáticamente
            try {
              const expireResponse = await adminFetch("/api/admin/expirePremium", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId: user.id }),
              });
              if (expireResponse.ok) {
                const expireData = await expireResponse.json();
                if (expireData.expired) {
                  console.log(`✅ Premium desactivado automáticamente para ${user.email}`);
                  // Actualizar el usuario en el estado local
                  setUsers(prevUsers => 
                    prevUsers.map(u => 
                      u.id === user.id 
                        ? { ...u, premium: false, premiumStatus: "expired" }
                        : u
                    )
                  );
                }
              }
            } catch (error) {
              console.error(`Error al desactivar premium para ${user.email}:`, error);
            }
          }
        }
      } else {
        setUsers([]);
        setNewUsersList([]);
        setNewUserIds([]);
      }

      if (!silent) {
        setLoading(false);
      }
      await loadIntakeClients();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      setError(message);
      setLoading(false);
      console.error("❌ Error al cargar estadísticas:", err);
      
      // Si el error es sobre Firebase Admin SDK no configurado, mostrar mensaje más útil
      if (message.includes("Firebase Admin SDK no configurado") || message.includes("500")) {
        setError("Firebase Admin SDK no está configurado en el servidor. Configura las variables de entorno en Vercel: FIREBASE_ADMIN_PRIVATE_KEY, FIREBASE_ADMIN_CLIENT_EMAIL, y NEXT_PUBLIC_FIREBASE_PROJECT_ID.");
      }
      if (
        message.includes("Cuota de Firestore") ||
        message.includes("RESOURCE_EXHAUSTED") ||
        (err instanceof Error && err.name === "QuotaExceededError")
      ) {
        setStatsPollingPaused(true);
      }
    }
  };

  loadUserStatsRef.current = loadUserStats;

  const handleCopyFormLink = async () => {
    try {
      const origin = typeof window !== "undefined" ? window.location.origin : "https://www.fitplan-ai.com";
      const formUrl = `${origin}/formulario-de-inicio`;
      await navigator.clipboard.writeText(formUrl);
      setCopiedFormLink(true);
      setTimeout(() => setCopiedFormLink(false), 1800);
    } catch (error) {
      console.error("No se pudo copiar el enlace del formulario:", error);
      alert("No se pudo copiar el enlace automáticamente. URL: https://www.fitplan-ai.com/formulario-de-inicio");
    }
  };

  const loadIntakeClients = async () => {
    try {
      const auth = getAuthSafe();
      if (!auth?.currentUser) return;
      setLoadingIntakeClients(true);
      const response = await adminFetch(`/api/admin/intakeClients?userId=${auth.currentUser.uid}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
      const data = await response.json();
      setIntakeClients(Array.isArray(data.clients) ? data.clients : []);
    } catch (error) {
      console.error("Error cargando clientes de formulario:", error);
    } finally {
      setLoadingIntakeClients(false);
    }
  };

  const closeIntakeClientModal = () => {
    setIntakeClientModalOpen(false);
    setSelectedIntakeClient(null);
    setIntakeClientDetail(null);
    setIntakeClientDetailError(null);
    setIntakeClientDetailLoading(false);
  };

  const handleOpenIntakeClientDetail = async (client: IntakeClient) => {
    try {
      const auth = getAuthSafe();
      if (!auth?.currentUser) return;
      setSelectedIntakeClient(client);
      setIntakeClientModalOpen(true);
      setIntakeClientDetail(null);
      setIntakeClientDetailError(null);
      setIntakeClientDetailLoading(true);

      const response = await adminFetch(
        `/api/admin/intakeClientDetail?userId=${auth.currentUser.uid}&clientId=${client.id}`
      );
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
      const data = await response.json();
      setIntakeClientDetail((data?.client as IntakeClientDetail) || null);
    } catch (error) {
      setIntakeClientDetailError(
        error instanceof Error ? error.message : "No se pudo cargar el detalle del cliente."
      );
    } finally {
      setIntakeClientDetailLoading(false);
    }
  };

  const handleOpenIntakeEmailHistory = async (client: IntakeClient) => {
    try {
      const auth = getAuthSafe();
      if (!auth?.currentUser) return;
      setIntakeEmailHistoryClient(client);
      setIntakeEmailHistoryOpen(true);
      setIntakeEmailHistoryItems([]);
      setIntakeEmailHistoryMessage(null);
      setIntakeEmailHistoryLoading(true);
      const response = await adminFetch(
        `/api/admin/intakeClientEmailHistory?adminUserId=${auth.currentUser.uid}&clientId=${client.id}`
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
      setIntakeEmailHistoryItems(Array.isArray(data.items) ? data.items : []);
    } catch (e) {
      console.error("Error cargando historial de emails intake:", e);
      setIntakeEmailHistoryItems([]);
    } finally {
      setIntakeEmailHistoryLoading(false);
    }
  };

  const handleSendIntakeWelcomeEmail = async () => {
    try {
      const auth = getAuthSafe();
      if (!auth?.currentUser || !intakeEmailHistoryClient) return;
      setSendingIntakeWelcomeEmail(true);
      setIntakeEmailHistoryMessage(null);
      const response = await adminFetch("/api/admin/sendIntakeWelcomeEmail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminUserId: auth.currentUser.uid,
          clientId: intakeEmailHistoryClient.id,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
      setIntakeEmailHistoryMessage("Email de bienvenida enviado.");
      await handleOpenIntakeEmailHistory(intakeEmailHistoryClient);
    } catch (e) {
      setIntakeEmailHistoryMessage(e instanceof Error ? e.message : "No se pudo enviar el email.");
    } finally {
      setSendingIntakeWelcomeEmail(false);
    }
  };

  const handleUpdateIntakeDigestPrefs = async (
    clientId: string,
    patch: Partial<
      Pick<
        IntakeClient,
        | "digestEmailEnabled"
        | "digestFrequency"
        | "digestStartDate"
        | "wellnessAutoEnabled"
        | "wellnessAutoStartDate"
        | "weightRequestAutoEnabled"
        | "weightRequestFrequency"
        | "weightRequestStartDate"
      >
    >
  ) => {
    try {
      const auth = getAuthSafe();
      if (!auth?.currentUser) return;
      const current = intakeClients.find((c) => c.id === clientId);
      const digestEmailEnabled =
        typeof patch.digestEmailEnabled === "boolean"
          ? patch.digestEmailEnabled
          : current?.digestEmailEnabled !== false;
      const digestFrequency =
        patch.digestFrequency === "biweekly" || patch.digestFrequency === "monthly" || patch.digestFrequency === "weekly"
          ? patch.digestFrequency
          : current?.digestFrequency || "weekly";
      const digestStartDate =
        typeof patch.digestStartDate === "string"
          ? patch.digestStartDate
          : current?.digestStartDate || new Date().toISOString().slice(0, 10);
      const wellnessAutoEnabled =
        typeof patch.wellnessAutoEnabled === "boolean" ? patch.wellnessAutoEnabled : current?.wellnessAutoEnabled === true;
      const wellnessAutoStartDate =
        typeof patch.wellnessAutoStartDate === "string"
          ? patch.wellnessAutoStartDate
          : current?.wellnessAutoStartDate || new Date().toISOString().slice(0, 10);
      const weightRequestAutoEnabled =
        typeof patch.weightRequestAutoEnabled === "boolean"
          ? patch.weightRequestAutoEnabled
          : current?.weightRequestAutoEnabled === true;
      const weightRequestFrequency =
        patch.weightRequestFrequency === "weekly" || patch.weightRequestFrequency === "biweekly" || patch.weightRequestFrequency === "monthly"
          ? patch.weightRequestFrequency
          : current?.weightRequestFrequency || "monthly";
      const weightRequestStartDate =
        typeof patch.weightRequestStartDate === "string"
          ? patch.weightRequestStartDate
          : current?.weightRequestStartDate || new Date().toISOString().slice(0, 10);
      setIntakeClients((prev) =>
        prev.map((c) =>
          c.id === clientId
            ? {
                ...c,
                digestEmailEnabled,
                digestFrequency,
                digestStartDate,
                wellnessAutoEnabled,
                wellnessAutoStartDate,
                weightRequestAutoEnabled,
                weightRequestFrequency,
                weightRequestStartDate,
              }
            : c
        )
      );
      await adminFetch("/api/admin/updateIntakeClientDigestPrefs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminUserId: auth.currentUser.uid,
          intakeClientId: clientId,
          digestEmailEnabled,
          digestFrequency,
          digestStartDate,
          wellnessAutoEnabled,
          wellnessAutoStartDate,
          weightRequestAutoEnabled,
          weightRequestFrequency,
          weightRequestStartDate,
        }),
      });
    } catch (e) {
      console.error("Error actualizando preferencias de digest:", e);
    }
  };

  const handleRequestWeightCheck = async (client: IntakeClient) => {
    try {
      const auth = getAuthSafe();
      if (!auth?.currentUser) return;
      setRequestingWeightClientId(client.id);
      const response = await adminFetch("/api/admin/requestIntakeClientWeight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminUserId: auth.currentUser.uid,
          intakeClientId: client.id,
        }),
      });
      const json = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(json.error || `Error ${response.status}`);
      setIntakeClients((prev) =>
        prev.map((it) =>
          it.id === client.id
            ? {
                ...it,
                weightCheckRequested: true,
              }
            : it
        )
      );
      alert("Solicitud de peso enviada.");
    } catch (error) {
      alert(error instanceof Error ? error.message : "No se pudo solicitar el peso");
    } finally {
      setRequestingWeightClientId(null);
    }
  };

  const openDeleteUserModal = (client: IntakeClient) => {
    setDeleteUserTarget(client);
    setDeleteUserModalOpen(true);
  };

  const openIntakePaymentModal = (client: IntakeClient) => {
    setIntakePaymentClient(client);
    setIntakePaymentPlan("monthly");
    setIntakePaymentModalOpen(true);
  };

  const handleCreateIntakePaymentLink = async () => {
    if (!intakePaymentClient) return;
    try {
      const auth = getAuthSafe();
      if (!auth?.currentUser) return;
      setIntakePaymentLoading(true);
      const provider = inferProviderByCountry(intakePaymentClient.pais || null);
      const response = await adminFetch("/api/admin/createIntakeClientPaymentLink", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminUserId: auth.currentUser.uid,
          intakeClientId: intakePaymentClient.id,
          provider,
          planType: intakePaymentPlan,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.link) {
        throw new Error(data.error || "No se pudo generar el link de pago");
      }
      const link = String(data.link);
      await navigator.clipboard.writeText(link).catch(() => {});
      const phone = (intakePaymentClient.whatsapp || "").replace(/[^\d+]/g, "").replace(/^\+/, "");
      const planLabel = intakePaymentPlan === "annual" ? "anual" : intakePaymentPlan === "quarterly" ? "trimestral" : "mensual";
      if (phone && phone.length >= 8) {
        const msg = `Hola ${intakePaymentClient.nombreCompleto || ""}, te comparto el link para abonar tu plan ${planLabel}: ${link}`;
        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank");
      } else {
        window.open(link, "_blank");
      }
      await loadIntakeClients();
      alert("Link de pago generado y copiado. Se abrió el envío.");
      setIntakePaymentModalOpen(false);
      setIntakePaymentClient(null);
    } catch (error) {
      alert(error instanceof Error ? error.message : "No se pudo generar el link de pago.");
    } finally {
      setIntakePaymentLoading(false);
    }
  };

  const openPaymentLinkModal = (user: User) => {
    setPaymentLinkUser(user);
    setPaymentLinkProvider(inferProviderByCountry(user.pais));
    setPaymentLinkPlan((user.premiumPlanType as PaymentLinkPlan) || "monthly");
    setPaymentLinkModalOpen(true);
  };

  const normalizeWhatsapp = (value?: string | null): string | null => {
    if (!value) return null;
    const cleaned = value.replace(/[^\d+]/g, "").replace(/^\+/, "");
    return cleaned.length >= 8 ? cleaned : null;
  };

  const handleGeneratePaymentLink = async () => {
    if (!paymentLinkUser) return;
    try {
      const auth = getAuthSafe();
      if (!auth?.currentUser) return;
      setPaymentLinkLoading(true);
      const response = await adminFetch("/api/admin/createUserPaymentLink", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminUserId: auth.currentUser.uid,
          targetUserId: paymentLinkUser.id,
          provider: paymentLinkProvider,
          planType: paymentLinkPlan,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.link) {
        throw new Error(data.error || "No se pudo generar el link de pago");
      }

      const link = String(data.link);
      await navigator.clipboard.writeText(link).catch(() => {});
      const whatsapp = normalizeWhatsapp(paymentLinkUser.whatsapp);
      if (whatsapp) {
        const msg = `Hola ${paymentLinkUser.nombre || ""}, te comparto tu link para activar Premium en FitPlan: ${link}`;
        window.open(`https://wa.me/${whatsapp}?text=${encodeURIComponent(msg)}`, "_blank");
      } else {
        window.open(link, "_blank");
      }
      alert("Link de pago generado. Lo copié al portapapeles y abre el envío.");
      setPaymentLinkModalOpen(false);
      setPaymentLinkUser(null);
    } catch (error) {
      alert(error instanceof Error ? error.message : "No se pudo generar el link");
    } finally {
      setPaymentLinkLoading(false);
    }
  };

  const handleDeleteIntakeClient = async () => {
    if (!deleteUserTarget) return;
    try {
      const auth = getAuthSafe();
      if (!auth?.currentUser) return;
      setProcessingIntakeAction(true);
      const response = await adminFetch("/api/admin/deleteIntakeClient", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: auth.currentUser.uid,
          clientId: deleteUserTarget.id,
        }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
      setIntakeClients((prev) => prev.filter((c) => c.id !== deleteUserTarget.id));
      if (intakeGeneratedPlanClient?.id === deleteUserTarget.id) {
        setIntakeGeneratedPlanModalOpen(false);
        setIntakeGeneratedPlanClient(null);
        setIntakeGeneratedPlan(null);
      }
      setDeleteUserModalOpen(false);
      setDeleteUserTarget(null);
    } catch (error) {
      alert(error instanceof Error ? error.message : "No se pudo eliminar el formulario.");
    } finally {
      setProcessingIntakeAction(false);
    }
  };

  const openIntakePlanModal = (client: IntakeClient, actionType: IntakePlanActionType) => {
    setIntakePlanClient(client);
    setIntakePlanActionType(actionType);
    setIntakePlanIncludeNutrition(true);
    setIntakePlanIncludeTraining(actionType === "generate");
    setIntakePlanObjectiveOverride("auto");
    setIntakeTrainingStructure("auto");
    setIntakePlanAdditionalNotes("");
    setIntakePlanTrainingCoachBrief("");
    setIntakePlanAvoidSquatsLunges(clinicalHintSuggestsKneeCare(client.clinicalTrainingHint));
    setIntakeUpdateMainNeed("");
    setIntakeUpdateNutritionFeedback("");
    setIntakeUpdateTrainingFeedback("");
    setIntakeUpdateCurrentWeight("");
    setIntakeUpdateEnergyLevel("media");
    setIntakeUpdateExcelFile(null);
    setIntakePlanModalOpen(true);
  };

  const handleSubmitIntakePlanAction = async () => {
    if (!intakePlanClient) return;
    if (!intakePlanIncludeNutrition && !intakePlanIncludeTraining) {
      alert("Selecciona al menos un tipo de plan.");
      return;
    }
    if (intakePlanActionType === "update" && !intakeUpdateMainNeed.trim() && !intakeUpdateExcelFile) {
      alert("Para actualizar, escribe qué quieres mejorar o adjunta el Excel de seguimiento rellenado por el cliente.");
      return;
    }
    if (
      intakePlanActionType === "generate" &&
      intakePlanIncludeTraining &&
      clinicalHintSuggestsKneeCare(intakePlanClient.clinicalTrainingHint) &&
      !intakePlanAvoidSquatsLunges &&
      !intakePlanTrainingCoachBrief.trim()
    ) {
      const ok = window.confirm(
        "El formulario del cliente menciona posible afectación de rodilla/cirugía, pero no marcaste «Sin sentadilla / zancadas» ni escribiste notas de entreno. ¿Seguir igual? (Recomendado: cancelar y marcar la casilla o detallar en notas.)"
      );
      if (!ok) return;
    }
    let clientTrackingLog = "";
    if (intakePlanActionType === "update" && intakeUpdateExcelFile) {
      try {
        const buf = await intakeUpdateExcelFile.arrayBuffer();
        const parsed = parseClientTrackingExcel(buf);
        if (!parsed.ok) {
          throw new Error(parsed.error || "No se pudo leer el archivo");
        }
        if (parsed.emptyClientFields) {
          const proceed = window.confirm(
            "El Excel se leyó, pero no hay celdas rellenas en las columnas _CLIENTE (peso, descanso, RIR, notas, etc.). La IA no tendrá datos de seguimiento del archivo. ¿Continuar igual?"
          );
          if (!proceed) return;
        }
        clientTrackingLog = parsed.summary;
      } catch (e) {
        alert(e instanceof Error ? e.message : "No se pudo leer el Excel.");
        return;
      }
    }
    const mainNeedFinal =
      intakeUpdateMainNeed.trim() ||
      (clientTrackingLog ? "Actualización según Excel de seguimiento devuelto por el cliente." : "");
    try {
      const auth = getAuthSafe();
      if (!auth?.currentUser) return;
      setProcessingIntakeAction(true);
      setIntakePlanGeneratingClientId(intakePlanClient.id);
      const response = await adminFetch("/api/admin/intakeClientPlanAction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: auth.currentUser.uid,
          clientId: intakePlanClient.id,
          actionType: intakePlanActionType,
          includeNutrition: intakePlanIncludeNutrition,
          includeTraining: intakePlanIncludeTraining,
          actionContext: {
            objectiveOverride: intakePlanObjectiveOverride,
            additionalNotes: intakePlanAdditionalNotes.trim(),
            trainingStructure: intakeTrainingStructure,
            trainingCoachBrief: intakePlanTrainingCoachBrief.trim(),
            avoidSquatsAndLunges: intakePlanIncludeTraining ? intakePlanAvoidSquatsLunges : false,
          },
          updateContext:
            intakePlanActionType === "update"
              ? {
                  mainNeed: mainNeedFinal,
                  nutritionFeedback: intakeUpdateNutritionFeedback.trim(),
                  trainingFeedback: intakeUpdateTrainingFeedback.trim(),
                  currentWeightKg: intakeUpdateCurrentWeight.trim(),
                  energyLevel: intakeUpdateEnergyLevel,
                  ...(clientTrackingLog ? { clientTrackingLog } : {}),
                }
              : null,
        }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const detailed = [errorData.error, errorData.detail].filter(Boolean).join(": ");
        throw new Error(detailed || `HTTP ${response.status}`);
      }
      const responseData = await response.json().catch(() => ({}));
      if (responseData?.usedFallback) {
        alert(
          `Plan generado con fallback por una incidencia puntual del motor principal.\nDetalle: ${
            responseData?.generationErrorDetail || "sin detalle"
          }`
        );
      }
      await loadIntakeClients();
      setIntakePlanModalOpen(false);
      setIntakePlanClient(null);
      setIntakePlanObjectiveOverride("auto");
      setIntakePlanAdditionalNotes("");
      setIntakePlanTrainingCoachBrief("");
      setIntakePlanAvoidSquatsLunges(false);
      setIntakeUpdateMainNeed("");
      setIntakeUpdateNutritionFeedback("");
      setIntakeUpdateTrainingFeedback("");
      setIntakeUpdateCurrentWeight("");
      setIntakeUpdateEnergyLevel("media");
      setIntakeUpdateExcelFile(null);
    } catch (error) {
      alert(error instanceof Error ? error.message : "No se pudo guardar la acción.");
    } finally {
      setProcessingIntakeAction(false);
      setIntakePlanGeneratingClientId(null);
    }
  };

  const handleCopyIntakeClientPublicPlanLink = async (client: IntakeClient) => {
    if (!client.latestPlanId) {
      alert("Primero genera un plan para este cliente.");
      return;
    }
    try {
      const auth = getAuthSafe();
      if (!auth?.currentUser) return;
      const response = await adminFetch("/api/admin/issueIntakeClientViewToken", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminUserId: auth.currentUser.uid,
          intakeClientId: client.id,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof data.error === "string" ? data.error : `HTTP ${response.status}`);
      }
      const url = typeof data.url === "string" ? data.url : "";
      if (!url) throw new Error("No se recibió la URL");
      await navigator.clipboard.writeText(url);
      alert("Enlace copiado. Pégalo al cliente: podrá ver su nutrición y entrenamiento sin iniciar sesión.");
    } catch (error) {
      alert(error instanceof Error ? error.message : "No se pudo generar el enlace.");
    }
  };

  const handleOpenGeneratedPlan = async (client: IntakeClient) => {
    if (!client.latestPlanId) {
      alert("Este cliente todavía no tiene un plan generado.");
      return;
    }
    try {
      const auth = getAuthSafe();
      if (!auth?.currentUser) return;
      setIntakeGeneratedPlanClient(client);
      setIntakeGeneratedPlanModalOpen(true);
      setIntakeGeneratedPlanLoading(true);
      setIntakeGeneratedPlanError(null);
      setIntakeGeneratedPlan(null);
      const response = await adminFetch(
        `/api/admin/intakeClientPlanDetail?userId=${auth.currentUser.uid}&planId=${client.latestPlanId}`
      );
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
      const data = await response.json();
      setIntakeGeneratedPlan((data?.plan as IntakeGeneratedPlanDetail) || null);
    } catch (error) {
      setIntakeGeneratedPlanError(error instanceof Error ? error.message : "No se pudo cargar el plan.");
    } finally {
      setIntakeGeneratedPlanLoading(false);
    }
  };

  const handleRequestWellnessCheckin = async (client: IntakeClient) => {
    try {
      const auth = getAuthSafe();
      if (!auth?.currentUser) return;
      const ok = window.confirm(
        `Se va a pedir un check-in de bienestar a ${client.nombreCompleto || "este cliente"}.\n` +
          "Le aparecerá cuando abra su plan. ¿Continuar?"
      );
      if (!ok) return;
      setRequestingCheckinClientId(client.id);
      const response = await adminFetch("/api/admin/requestIntakeClientCheckin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminUserId: auth.currentUser.uid,
          intakeClientId: client.id,
        }),
      });
      const json = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(json.error || `Error ${response.status}`);
      setIntakeClients((prev) =>
        prev.map((it) =>
          it.id === client.id
            ? {
                ...it,
                wellnessCheckinRequested: true,
                wellnessCheckinRequestedAt: new Date().toISOString(),
              }
            : it
        )
      );
      alert("Check-in solicitado. El cliente lo verá la próxima vez que abra su plan.");
    } catch (error) {
      alert(error instanceof Error ? error.message : "No se pudo solicitar el check-in");
    } finally {
      setRequestingCheckinClientId(null);
    }
  };

  const openDeletePlanModal = (client: IntakeClient) => {
    if (!client.latestPlanId) return;
    setDeletePlanClient(client);
    setDeletePlanNutrition(client.latestPlanIncludeNutrition !== false);
    setDeletePlanTraining(client.latestPlanIncludeTraining !== false);
    setDeletePlanModalOpen(true);
  };

  const handleDeleteGeneratedPlan = async () => {
    if (!deletePlanClient?.latestPlanId) return;
    if (!deletePlanNutrition && !deletePlanTraining) {
      alert("Selecciona al menos una parte del plan para eliminar.");
      return;
    }
    try {
      const auth = getAuthSafe();
      if (!auth?.currentUser) return;
      setProcessingIntakeAction(true);
      const response = await adminFetch("/api/admin/deleteIntakeClientPlan", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: auth.currentUser.uid,
          clientId: deletePlanClient.id,
          planId: deletePlanClient.latestPlanId,
          deleteNutrition: deletePlanNutrition,
          deleteTraining: deletePlanTraining,
        }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
      await loadIntakeClients();
      if (intakeGeneratedPlanClient?.id === deletePlanClient.id) {
        setIntakeGeneratedPlanModalOpen(false);
        setIntakeGeneratedPlanClient(null);
        setIntakeGeneratedPlan(null);
      }
      setDeletePlanModalOpen(false);
      setDeletePlanClient(null);
    } catch (error) {
      alert(error instanceof Error ? error.message : "No se pudo eliminar el plan.");
    } finally {
      setProcessingIntakeAction(false);
    }
  };

  const handleEdit = (user: User) => {
    // Console log detallado del usuario para debug
    console.log("=".repeat(80));
    console.log("👤 USUARIO SELECCIONADO PARA EDITAR:");
    console.log("=".repeat(80));
    console.log("ID:", user.id);
    console.log("Email:", user.email);
    console.log("Nombre:", user.nombre);
    console.log("Premium:", user.premium);
    console.log("Premium Status:", user.premiumStatus);
    console.log("Premium Plan Type:", user.premiumPlanType);
    console.log("Premium Since:", user.premiumSince);
    console.log("Premium Expires At:", user.premiumExpiresAt);
    console.log("Premium Last Pay:", user.premiumLastPay);
    console.log("Premium Payment:", user.premiumPayment);
    console.log("Usuario completo:", JSON.stringify(user, null, 2));
    console.log("=".repeat(80));
    
    setEditingUser(user);
    setEditForm({
      nombre: user.nombre || "",
      email: user.email || "",
      premium: user.premium,
      premiumPlanType: user.premiumPlanType || null,
      sexo: user.sexo || "",
      alturaCm: user.alturaCm ?? null,
      edad: user.edad ?? null,
      peso: user.peso ?? null,
      pesoObjetivo: user.pesoObjetivo ?? null,
      cinturaCm: user.cinturaCm ?? null,
      cuelloCm: user.cuelloCm ?? null,
      caderaCm: user.caderaCm ?? null,
      atletico: user.atletico,
      ciudad: user.ciudad || "",
      pais: user.pais || "",
    });
  };

  const handleDelete = async () => {
    if (!editingUser) return;

    // Confirmación antes de eliminar
    const confirmMessage = `¿Estás seguro de que deseas eliminar el usuario "${editingUser.nombre || editingUser.email || editingUser.id}"?\n\nEsta acción eliminará:\n- El usuario de la autenticación\n- El perfil del usuario\n- Todos los planes asociados\n\nEsta acción NO se puede deshacer.`;
    
    if (!confirm(confirmMessage)) {
      return;
    }

    setDeleting(true);
    try {
      const auth = getAuthSafe();
      if (!auth?.currentUser) {
        throw new Error("No hay usuario autenticado");
      }

      console.log("🗑️ Eliminando usuario...");
      
      // Llamar al endpoint API para eliminar usuario
      const response = await adminFetch("/api/admin/deleteUser", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          adminUserId: auth.currentUser.uid,
          userId: editingUser.id,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Error desconocido" }));
        throw new Error(errorData.error || `Error HTTP ${response.status}`);
      }

      const result = await response.json();
      console.log("✅ Usuario eliminado exitosamente:", result);

      // Remover el usuario de la lista local
      setUsers(prevUsers => prevUsers.filter(user => user.id !== editingUser.id));

      // Recargar estadísticas para actualizar los contadores
      await loadUserStats(adminMeta.lastUsersCheck ?? null);
      
      // Cerrar el modal
      setEditingUser(null);
      setEditForm({});
      
      alert("Usuario eliminado correctamente");
    } catch (err: unknown) {
      console.error("❌ Error al eliminar usuario:", err);
      const error = err as { message?: string };
      alert(`Error al eliminar usuario: ${error.message || "Error desconocido"}`);
    } finally {
      setDeleting(false);
    }
  };

  const handleSave = async () => {
    if (!editingUser) return;

    setSaving(true);
    try {
      const auth = getAuthSafe();
      if (!auth?.currentUser) {
        throw new Error("No hay usuario autenticado");
      }

      // Construir objeto de actualización
      const updateData: Record<string, unknown> = {};

      // Solo actualizar campos que se proporcionan
      if (editForm.nombre !== undefined) updateData.nombre = editForm.nombre;
      if (editForm.email !== undefined) updateData.email = editForm.email;
      if (editForm.premium !== undefined) {
        updateData.premium = Boolean(editForm.premium);
        updateData.premiumStatus = editForm.premium ? "active" : "inactive";
        if (editForm.premium) {
          // Si se activa premium, establecer premiumSince si no existe
          if (!editingUser.premiumSince) {
            updateData.premiumSince = new Date().toISOString();
          }
          
          // CRÍTICO: SIEMPRE establecer fecha de vencimiento cuando se activa premium
          // Usar el planType del formulario, o el existente, o "monthly" por defecto
          const planType = editForm.premiumPlanType || editingUser.premiumPlanType || "monthly";
          const now = new Date();
          let expiresAt = new Date();
          
          if (planType === "monthly") {
            expiresAt.setMonth(now.getMonth() + 1);
          } else if (planType === "quarterly") {
            expiresAt.setMonth(now.getMonth() + 3);
          } else if (planType === "annual") {
            expiresAt.setFullYear(now.getFullYear() + 1);
          } else {
            // Fallback a mensual
            expiresAt.setMonth(now.getMonth() + 1);
          }
          
          updateData.premiumExpiresAt = expiresAt.toISOString();
          console.log("📅 Estableciendo fecha de vencimiento:", {
            planType,
            expiresAt: expiresAt.toISOString(),
            now: now.toISOString()
          });
        }
      }
      if (editForm.premiumPlanType !== undefined) {
        updateData.premiumPlanType = editForm.premiumPlanType || null;
        // Si se cambia el planType y el usuario es premium, actualizar fecha de vencimiento
        if (editForm.premium && editForm.premiumPlanType) {
          const now = new Date();
          let expiresAt = new Date();
          if (editForm.premiumPlanType === "monthly") {
            expiresAt.setMonth(now.getMonth() + 1);
          } else if (editForm.premiumPlanType === "quarterly") {
            expiresAt.setMonth(now.getMonth() + 3);
          } else if (editForm.premiumPlanType === "annual") {
            expiresAt.setFullYear(now.getFullYear() + 1);
          }
          updateData.premiumExpiresAt = expiresAt.toISOString();
        }
      }
      if (editForm.sexo !== undefined) updateData.sexo = editForm.sexo;
      if (editForm.alturaCm !== undefined) updateData.alturaCm = editForm.alturaCm ? Number(editForm.alturaCm) : null;
      if (editForm.edad !== undefined) updateData.edad = editForm.edad ? Number(editForm.edad) : null;
      if (editForm.peso !== undefined) updateData.peso = editForm.peso ? Number(editForm.peso) : null;
      if (editForm.pesoObjetivo !== undefined) updateData.pesoObjetivo = editForm.pesoObjetivo ? Number(editForm.pesoObjetivo) : null;
      if (editForm.cinturaCm !== undefined) updateData.cinturaCm = editForm.cinturaCm ? Number(editForm.cinturaCm) : null;
      if (editForm.cuelloCm !== undefined) updateData.cuelloCm = editForm.cuelloCm ? Number(editForm.cuelloCm) : null;
      if (editForm.caderaCm !== undefined) updateData.caderaCm = editForm.caderaCm ? Number(editForm.caderaCm) : null;
      if (editForm.atletico !== undefined) updateData.atletico = Boolean(editForm.atletico);
      if (editForm.ciudad !== undefined) updateData.ciudad = editForm.ciudad || null;
      if (editForm.pais !== undefined) updateData.pais = editForm.pais || null;

      console.log("💾 Enviando cambios al API...", { updateData, editingUserId: editingUser.id });
      
      // Usar el endpoint API que tiene permisos de Admin SDK
      const response = await adminFetch("/api/admin/updateUser", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          adminUserId: auth.currentUser.uid, // ID del admin que hace la solicitud
          userId: editingUser.id, // ID del usuario a actualizar
          updateData,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Error desconocido" }));
        console.error("❌ Error en la respuesta del API:", errorData);
        throw new Error(errorData.error || `Error HTTP ${response.status}`);
      }

      const result = await response.json();
      console.log("✅ Cambios guardados exitosamente:", result);

      // Recargar la lista de usuarios para obtener los datos actualizados desde Firestore
      // Esto asegura que todos los campos se actualicen correctamente
      await loadUserStats(adminMeta.lastUsersCheck ?? null);
      
      setEditingUser(null);
      setEditForm({});
    } catch (err: unknown) {
      console.error("❌ Error al guardar:", err);
      const error = err as { message?: string };
      alert(`Error al guardar cambios: ${error.message || "Error desconocido"}`);
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (timestamp: unknown) => {
    if (!timestamp) {
      console.log("⚠️ formatDate recibió timestamp vacío/null/undefined");
      return "N/A";
    }
    
    // Intentar convertir el timestamp a fecha
    let date: Date | null = null;
    
    try {
      if (timestamp instanceof Date) {
        date = timestamp;
      } else if (typeof timestamp === 'string') {
        // Manejar string ISO (viene del servidor después de convertTimestamp)
        date = new Date(timestamp);
        if (isNaN(date.getTime())) {
          console.log("⚠️ No se pudo parsear string de fecha:", timestamp);
          return "N/A";
        }
      } else if (timestamp && typeof timestamp === 'object' && 'toDate' in timestamp && typeof timestamp.toDate === 'function') {
        date = (timestamp as { toDate: () => Date }).toDate();
      } else if (timestamp && typeof timestamp === 'object' && 'seconds' in timestamp) {
        // Firestore timestamp con formato { seconds: number, nanoseconds: number }
        const firestoreTimestamp = timestamp as { seconds: number; nanoseconds?: number };
        date = new Date(firestoreTimestamp.seconds * 1000 + (firestoreTimestamp.nanoseconds || 0) / 1000000);
      } else {
        console.log("⚠️ formatDate no pudo convertir timestamp desconocido:", timestamp);
        return "N/A";
      }
      
      if (date && !isNaN(date.getTime())) {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
      }
    } catch (error) {
      console.error("❌ Error al formatear fecha:", error, "timestamp:", timestamp);
    }
    
    return "N/A";
  };

  const formatDateTime = (timestamp: unknown) => {
    if (!timestamp) {
      return "Nunca";
    }
    
    // Intentar convertir el timestamp a fecha
    let date: Date | null = null;
    
    try {
      if (timestamp instanceof Date) {
        date = timestamp;
      } else if (typeof timestamp === 'string') {
        // Manejar string ISO (viene del servidor después de convertTimestamp)
        date = new Date(timestamp);
        if (isNaN(date.getTime())) {
          return "Nunca";
        }
      } else if (timestamp && typeof timestamp === 'object' && 'toDate' in timestamp && typeof timestamp.toDate === 'function') {
        date = (timestamp as { toDate: () => Date }).toDate();
      } else if (timestamp && typeof timestamp === 'object' && 'seconds' in timestamp) {
        // Firestore timestamp con formato { seconds: number, nanoseconds: number }
        const firestoreTimestamp = timestamp as { seconds: number; nanoseconds?: number };
        date = new Date(firestoreTimestamp.seconds * 1000 + (firestoreTimestamp.nanoseconds || 0) / 1000000);
      } else {
        return "Nunca";
      }
      
      if (date && !isNaN(date.getTime())) {
        return date.toLocaleString('es-AR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      }
    } catch (error) {
      console.error("❌ Error al formatear fecha con hora:", error, "timestamp:", timestamp);
    }
    
    return "Nunca";
  };

  const handleMarkNewUsersSeen = async () => {
    try {
      const auth = getAuthSafe();
      if (!auth?.currentUser) {
        return;
      }
      setMarkingNewUsersSeen(true);
      const response = await adminFetch("/api/admin/markUsersSeen", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          adminUserId: auth.currentUser.uid,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Error desconocido" }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const result = await response.json();
      const updatedLastCheck = result.lastUsersCheck || new Date().toISOString();
      setAdminMeta(prev => ({ ...prev, lastUsersCheck: updatedLastCheck }));
      setNewUsersList([]);
      setNewUserIds([]);
      await loadUserStats(updatedLastCheck);
    } catch (error) {
      console.error("❌ Error al marcar usuarios como revisados:", error);
      alert("No se pudieron marcar los usuarios como revisados. Intenta nuevamente.");
    } finally {
      setMarkingNewUsersSeen(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
        <Navbar />
        <div className="relative flex items-center justify-center min-h-[calc(100vh-4rem)]">
          <div className="text-center">
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-border border-t-accent" />
            <p className="text-sm text-text-muted">Cargando...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isAdmin || error) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
        <Navbar />
        <Navbar />
        <div className="relative flex items-center justify-center min-h-[calc(100vh-4rem)]">
          <div className="text-center p-8 rounded-xl bg-danger/10 border border-danger/30">
            <p className="text-danger text-lg">{error || "Acceso denegado"}</p>
          </div>
        </div>
      </div>
    );
  }

  const assignedTrainerUsers = users.filter(
    (user) => user.email?.toLowerCase() !== "admin@fitplan-ai.com" && user.personalTrainerAssigned === true
  );
  const filteredAssignedTrainerUsers = assignedTrainerUsers.filter((user) => {
    if (trainerPreferenceFilter === "all") return true;
    return user.personalTrainerPreference === trainerPreferenceFilter;
  });
  const visibleAssignedTrainerUsers = filteredAssignedTrainerUsers.slice(0, assignedTrainerVisibleCount);
  const hasMoreAssignedTrainerUsers = filteredAssignedTrainerUsers.length > assignedTrainerVisibleCount;
  const intakeServiceOptions = Array.from(
    new Set(
      intakeClients
        .map((client) => (client.servicioInteres || "").trim())
        .filter((service) => service.length > 0)
    )
  ).sort((a, b) => a.localeCompare(b, "es"));
  const normalizedIntakeSearch = intakeSearchQuery.trim().toLowerCase();
  const filteredIntakeClients = intakeClients.filter((client) => {
    const paymentMatches =
      intakePaymentFilter === "all"
        ? true
        : intakePaymentFilter === "paid"
        ? isIntakeCurrentMonthPaid(client)
        : intakePaymentFilter === "pending"
        ? !isIntakeCurrentMonthPaid(client) && client.paymentStatus === "pending"
        : !isIntakeCurrentMonthPaid(client) && client.paymentStatus !== "pending";

    const serviceMatches =
      intakeServiceFilter === "all" ? true : (client.servicioInteres || "").trim() === intakeServiceFilter;

    if (!normalizedIntakeSearch) return paymentMatches && serviceMatches;

    const searchHaystack = [
      client.nombreCompleto,
      client.email,
      client.whatsapp,
      client.instagram,
      client.servicioInteres,
      client.objetivoPrincipal,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return paymentMatches && serviceMatches && searchHaystack.includes(normalizedIntakeSearch);
  });

  const nonAdminUsers = users.filter((user) => user.email?.toLowerCase() !== "admin@fitplan-ai.com");
  const nowDate = new Date();
  const currentMonthKey = `${nowDate.getFullYear()}-${String(nowDate.getMonth() + 1).padStart(2, "0")}`;
  const previousMonthDate = new Date(nowDate.getFullYear(), nowDate.getMonth() - 1, 1);
  const previousMonthKey = `${previousMonthDate.getFullYear()}-${String(previousMonthDate.getMonth() + 1).padStart(2, "0")}`;
  const monthKeyFromDate = (date: Date | null): string | null =>
    date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}` : null;

  const totalRegisteredCurrentMonth = nonAdminUsers.filter(
    (user) => monthKeyFromDate(convertTimestampToDate(user.createdAt)) === currentMonthKey
  ).length;
  const totalRegisteredPreviousMonth = nonAdminUsers.filter(
    (user) => monthKeyFromDate(convertTimestampToDate(user.createdAt)) === previousMonthKey
  ).length;
  const totalUsersMonthDelta = totalRegisteredCurrentMonth - totalRegisteredPreviousMonth;
  const premiumActivatedCurrentMonth = nonAdminUsers.filter((user) => {
    const premiumDate = convertTimestampToDate(user.premiumSince);
    return monthKeyFromDate(premiumDate) === currentMonthKey;
  }).length;
  const currentMonthLabel = nowDate.toLocaleDateString("es-AR", { month: "short", year: "numeric" });
  const previousMonthLabel = previousMonthDate.toLocaleDateString("es-AR", { month: "short", year: "numeric" });

  const renderIntakeActions = (client: IntakeClient) => (
    <>
      <AdminActionIcon icon={FaUser} label="Ver datos" onClick={() => handleOpenIntakeClientDetail(client)} />
      <AdminActionIcon
        icon={FaPlusCircle}
        label="Generar plan"
        tone="success"
        onClick={() => openIntakePlanModal(client, "generate")}
        disabled={intakePlanGeneratingClientId !== null}
        loading={intakePlanGeneratingClientId === client.id && intakePlanActionType === "generate"}
      />
      {client.latestPlanId && (
        <>
          <AdminActionIcon
            icon={FaSyncAlt}
            label="Actualizar plan"
            tone="info"
            onClick={() => openIntakePlanModal(client, "update")}
            disabled={intakePlanGeneratingClientId !== null}
            loading={intakePlanGeneratingClientId === client.id && intakePlanActionType === "update"}
          />
          <AdminActionIcon icon={FaEye} label="Ver plan generado" onClick={() => handleOpenGeneratedPlan(client)} />
          <AdminActionIcon
            icon={FaExternalLinkAlt}
            label="Copiar enlace web del plan (el cliente lo ve sin iniciar sesión)"
            onClick={() => void handleCopyIntakeClientPublicPlanLink(client)}
          />
          <AdminActionIcon
            icon={FaTrashAlt}
            label="Eliminar plan"
            tone="danger"
            onClick={() => openDeletePlanModal(client)}
            disabled={processingIntakeAction}
          />
        </>
      )}
      <AdminActionIcon
        icon={FaBell}
        label={
          requestingCheckinClientId === client.id
            ? "Enviando solicitud de check-in..."
            : client.wellnessCheckinRequested
              ? "Check-in pendiente"
              : "Pedir check-in de bienestar"
        }
        tone={client.wellnessCheckinRequested ? "warning" : "info"}
        onClick={() => void handleRequestWellnessCheckin(client)}
        disabled={requestingCheckinClientId === client.id}
        loading={requestingCheckinClientId === client.id}
      />
      <AdminActionIcon
        icon={FaChartLine}
        label={requestingWeightClientId === client.id ? "Enviando solicitud de peso..." : "Pedir peso"}
        onClick={() => void handleRequestWeightCheck(client)}
        disabled={requestingWeightClientId === client.id}
        loading={requestingWeightClientId === client.id}
      />
      <AdminActionIcon icon={FaLink} label="Generar link de pago" tone="success" onClick={() => openIntakePaymentModal(client)} />
      <AdminActionIcon icon={FaEnvelope} label="Ver historial de emails" onClick={() => void handleOpenIntakeEmailHistory(client)} />
      <AdminActionIcon
        icon={FaTrashAlt}
        label="Eliminar cliente"
        tone="danger"
        onClick={() => openDeleteUserModal(client)}
        disabled={processingIntakeAction}
      />
    </>
  );

  return (
    <AdminShell active={ADMIN_SECTION_BY_VIEW[view]}>
      <div className="relative text-foreground">
        <motion.div {...heroFadeUp} className="mb-6">
          {view === "dashboard" ? (
            <>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">FitPlan · Admin</p>
              <h1 className="font-display mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Resumen
              </h1>
              <p className="mt-2 max-w-xl text-sm text-text-muted">
                Ingresos y actividad; el detalle de clientes vive en su propia sección del menú.
              </p>
              {/* Hero de marca: reservado SOLO para Resumen, no se repite en el resto de vistas (DESIGN_SYSTEM.md §7.3-B) */}
              <div
                className="mt-4 overflow-hidden rounded-2xl border border-border p-4 md:p-5"
                style={{
                  background:
                    "linear-gradient(135deg, color-mix(in oklab, var(--brand-start) 14%, var(--surface)), color-mix(in oklab, var(--brand-mid) 10%, var(--surface)) 55%, color-mix(in oklab, var(--brand-end) 12%, var(--surface)))",
                }}
              >
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <AdminStatCard
                    label="Ingresado este mes"
                    value={`$${revenueStats.actualMonthly.toLocaleString("es-AR")}`}
                    unit={`${(revenueStats.actualMonthly / 2000).toFixed(2)} EUR aprox.`}
                    tone="accent"
                  />
                  <AdminStatCard label="Clientes activos" value={totalUsers} unit="FitPlan + 1:1" />
                  <AdminStatCard
                    label="Altas este mes"
                    value={totalRegisteredCurrentMonth}
                    unit={`${premiumActivatedCurrentMonth} premium nuevos`}
                  />
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-2.5">
                <button type="button" onClick={handleCopyFormLink} className="btn btn-secondary text-sm">
                  {copiedFormLink ? "Enlace copiado" : "Copiar enlace del formulario"}
                </button>
                <button type="button" onClick={() => router.push("/admin/clientes-1-1")} className="btn btn-secondary text-sm">
                  Ver clientes 1:1
                </button>
                <button type="button" onClick={() => router.push("/admin/clientes-fitplan")} className="btn btn-secondary text-sm">
                  Ver clientes FitPlan
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setYearlyEarningsYear(new Date().getFullYear());
                    setYearlyEarningsModalOpen(true);
                  }}
                  className="btn btn-secondary text-sm"
                >
                  Ver detalle {new Date().getFullYear()}
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
                {view === "intake" ? "Formulario 1:1" : "App FitPlan"}
              </p>
              <h1 className="font-display mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Clientes
              </h1>
              <p className="mt-2 max-w-xl text-sm text-text-muted">
                {view === "intake"
                  ? "Leads y seguimiento del formulario de inicio."
                  : "Usuarios registrados en la plataforma."}
              </p>
              <AdminSubTabs
                tabs={[
                  { label: "FitPlan", href: "/admin/clientes-fitplan", active: view === "fitplan" },
                  { label: "1:1", href: "/admin/clientes-1-1", active: view === "intake" },
                  { label: "Actividad", href: "/admin/actividad", active: false },
                ]}
              />
            </>
          )}
        </motion.div>

        {view === "dashboard" && (
        <>
        {/* Detalle de ingresos — misma grilla de tarjetas de stat que el hero, sin panel propio (DESIGN_SYSTEM.md §8) */}
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">Detalle de ingresos</p>
        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <AdminStatCard
            label="Mensual estimada"
            value={`$${revenueStats.estimatedMonthly.toLocaleString("es-AR")}`}
            unit={`${(revenueStats.estimatedMonthly / 2000).toFixed(2)} EUR`}
            tone="success"
          />
          <AdminStatCard label="Premium activos" value={revenueStats.premiumActiveThisMonth} unit="Mes actual" tone="info" />
          <AdminStatCard label="Pendientes" value={revenueStats.pendingPayments} unit="Seguimiento" tone="warning" />
          <AdminStatCard label="Renov. 7d" value={revenueStats.renewingSoon} unit="Crítico" tone="info" />
          <AdminStatCard
            label="Proyección anual"
            value={`$${revenueStats.estimatedAnnual.toLocaleString("es-AR")}`}
            unit={`${(revenueStats.estimatedAnnual / 2000).toFixed(2)} EUR`}
          />
          <AdminStatCard label="Total premium histórico" value={revenueStats.totalPremiumUsers} unit="Registrados" />
        </div>

        {/* Detalle de usuarios */}
        <p className="mt-8 text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">Detalle de usuarios</p>
        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <AdminStatCard
            label="Total"
            value={totalUsers}
            unit={`${currentMonthLabel}: ${totalUsersMonthDelta > 0 ? "+" : ""}${totalUsersMonthDelta} vs ${previousMonthLabel}`}
            tone={totalUsersMonthDelta > 0 ? "success" : totalUsersMonthDelta < 0 ? "danger" : "neutral"}
          />
          <AdminStatCard label="Premium" value={premiumUsers} unit={`${premiumActivatedCurrentMonth} nuevos este mes`} tone="success" />
          <AdminStatCard label="Regulares" value={regularUsers} unit="Sin premium" tone="info" />
          <AdminStatCard label="Atléticos" value={athleticUsers} unit="Perfil deportivo" tone="success" />
        </div>

        {/* Accesos directos — mismo patrón que admin-design-preview.tsx */}
        <p className="mt-8 text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">Accesos directos</p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {NAV_ITEMS.filter((item) => item.id !== "resumen").map((item, i) => {
            const Icon = item.icon;
            return (
              <motion.button
                key={item.id}
                type="button"
                onClick={() => router.push(item.href)}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.04 }}
                className="card-surface flex items-center gap-3 p-4 text-left transition-colors hover:bg-surface-2"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-accent">
                  <Icon />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{item.label}</p>
                  <p className="truncate text-xs text-text-muted">Ver sección</p>
                </div>
              </motion.button>
            );
          })}
        </div>
        </>
        )}

        {/* Clientes provenientes del formulario de inicio — solo vista 1:1 */}
        {view === "intake" && (
        <>
          {!loadingIntakeClients && intakeClients.length > 0 && (
            <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative w-full lg:max-w-xs">
                <FaSearch className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-subtle" aria-hidden />
                <input
                  type="text"
                  value={intakeSearchQuery}
                  onChange={(e) => setIntakeSearchQuery(e.target.value)}
                  placeholder="Buscar por nombre, email, WhatsApp, Instagram..."
                  className="w-full rounded-lg border border-border bg-surface-2 py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-accent/50"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={intakePaymentFilter}
                  onChange={(e) =>
                    setIntakePaymentFilter(e.target.value as "all" | "paid" | "pending" | "unpaid")
                  }
                  className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50"
                >
                  <option value="all">Todos los pagos</option>
                  <option value="paid">Pagado mes actual</option>
                  <option value="pending">Pendiente</option>
                  <option value="unpaid">No pagó</option>
                </select>
                <select
                  value={intakeServiceFilter}
                  onChange={(e) => setIntakeServiceFilter(e.target.value)}
                  className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50"
                >
                  <option value="all">Todos los servicios</option>
                  {intakeServiceOptions.map((service) => (
                    <option key={service} value={service}>
                      {service}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    setIntakeSearchQuery("");
                    setIntakePaymentFilter("all");
                    setIntakeServiceFilter("all");
                  }}
                  className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs font-medium text-text-muted transition-colors hover:text-foreground"
                >
                  Limpiar
                </button>
                <span className="badge badge-info shrink-0">
                  {filteredIntakeClients.length} / {intakeClients.length}
                </span>
              </div>
            </div>
          )}

          {loadingIntakeClients ? (
            <p className="mt-5 text-sm text-text-muted">Cargando clientes...</p>
          ) : intakeClients.length === 0 ? (
            <p className="mt-5 text-sm text-text-muted">Aún no hay envíos del formulario.</p>
          ) : filteredIntakeClients.length === 0 ? (
            <p className="mt-5 text-sm text-text-muted">No hay resultados con esos filtros.</p>
          ) : (
            <>
              {/* Desktop */}
              <div className="mt-5 hidden overflow-hidden rounded-2xl border border-border lg:block">
                <div className="overflow-x-auto">
                <table className="w-full min-w-[1280px]">
                  <thead className="bg-surface-2 border-b border-border">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Cliente</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Perfil</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Contacto</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Pago</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Bienestar</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Peso inicial</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Creado</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredIntakeClients.map((client, clientIndex) => (
                      <tr
                        key={client.id}
                        className={`hover:bg-surface-2 transition-colors align-top ${
                          intakePlanGeneratingClientId === client.id
                            ? "bg-info/[0.12] ring-1 ring-inset ring-info/40"
                            : clientIndex % 2 === 0
                              ? "bg-surface"
                              : "bg-[color-mix(in_oklab,var(--surface)_60%,var(--surface-2))]"
                        }`}
                      >
                        <td className="px-4 py-3 text-sm text-foreground min-w-[220px]">
                          <p className="font-medium text-foreground">{client.nombreCompleto || "N/A"}</p>
                          <p className="text-text-muted text-xs mt-1">ID: {client.id}</p>
                        </td>
                        <td className="px-4 py-3 text-sm text-foreground min-w-[290px]">
                          <div className="flex flex-wrap gap-1.5">
                            <span className="px-2 py-0.5 rounded-full border border-border bg-surface-2 text-[11px] text-foreground">
                              Servicio: {client.servicioInteres || "N/A"}
                            </span>
                            <span className="px-2 py-0.5 rounded-full border border-border bg-surface-2 text-[11px] text-foreground">
                              Objetivo: {client.objetivoPrincipal || "N/A"}
                            </span>
                          </div>
                          <p className="text-text-muted text-xs mt-2">
                            Trabajo:{" "}
                            {client.trabajoTurnos || client.diasTrabajo.length > 0
                              ? `${client.trabajoTurnos || "Sin horas"}${client.diasTrabajo.length > 0 ? ` · ${client.diasTrabajo.join(", ")}` : ""}`
                              : "N/A"}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-sm text-foreground min-w-[240px]">
                          <div className="space-y-1.5">
                            <p className="text-xs text-foreground">
                              <span className="text-text-muted">Email:</span> {client.email || "N/A"}
                            </p>
                            <p className="text-xs text-foreground">
                              <span className="text-text-muted">WhatsApp:</span> {client.whatsapp || "N/A"}
                            </p>
                            <p className="text-xs text-foreground">
                              <span className="text-text-muted">Instagram:</span> {client.instagram || "N/A"}
                            </p>
                            <div className="mt-2 rounded-md border border-border bg-surface-2 p-2">
                              <label className="inline-flex items-center gap-2 text-[11px] text-foreground">
                                <input
                                  type="checkbox"
                                  checked={client.digestEmailEnabled !== false}
                                  onChange={(e) =>
                                    void handleUpdateIntakeDigestPrefs(client.id, {
                                      digestEmailEnabled: e.target.checked,
                                    })
                                  }
                                />
                                Enviar email automático
                              </label>
                              <div className="mt-1">
                                <select
                                  value={client.digestFrequency || "weekly"}
                                  onChange={(e) =>
                                    void handleUpdateIntakeDigestPrefs(client.id, {
                                      digestFrequency: e.target.value as "weekly" | "biweekly" | "monthly",
                                    })
                                  }
                                  className="w-full rounded bg-surface-2 border border-border px-2 py-1 text-[11px] text-foreground"
                                >
                                  <option value="weekly">Cada semana</option>
                                  <option value="biweekly">Cada 2 semanas</option>
                                  <option value="monthly">Cada mes</option>
                                </select>
                                <p className="mt-1 text-[10px] text-text-muted">{digestScheduleLabel(client)}</p>
                                <label className="mt-2 block text-[10px] text-text-muted">
                                  Iniciar desde
                                  <input
                                    type="date"
                                    value={client.digestStartDate || ""}
                                    onChange={(e) =>
                                      void handleUpdateIntakeDigestPrefs(client.id, {
                                        digestStartDate: e.target.value,
                                      })
                                    }
                                    className="mt-1 w-full rounded bg-surface-2 border border-border px-2 py-1 text-[11px] text-foreground"
                                  />
                                </label>
                              </div>
                            </div>
                            <div className="mt-2 rounded-md border border-info/20 bg-info/5 p-2">
                              <label className="inline-flex items-center gap-2 text-[11px] text-info/90">
                                <input
                                  type="checkbox"
                                  checked={client.wellnessAutoEnabled === true}
                                  onChange={(e) =>
                                    void handleUpdateIntakeDigestPrefs(client.id, {
                                      wellnessAutoEnabled: e.target.checked,
                                    })
                                  }
                                />
                                Check-in automático diario
                              </label>
                              <label className="mt-1 block text-[10px] text-text-muted">
                                Desde
                                <input
                                  type="date"
                                  value={client.wellnessAutoStartDate || ""}
                                  onChange={(e) =>
                                    void handleUpdateIntakeDigestPrefs(client.id, {
                                      wellnessAutoStartDate: e.target.value,
                                    })
                                  }
                                  className="mt-1 w-full rounded bg-surface-2 border border-border px-2 py-1 text-[11px] text-foreground"
                                />
                              </label>
                            </div>
                            <div className="mt-2 rounded-md border border-border bg-surface-2 p-2">
                              <label className="inline-flex items-center gap-2 text-[11px] text-foreground">
                                <input
                                  type="checkbox"
                                  checked={client.weightRequestAutoEnabled === true}
                                  onChange={(e) =>
                                    void handleUpdateIntakeDigestPrefs(client.id, {
                                      weightRequestAutoEnabled: e.target.checked,
                                    })
                                  }
                                />
                                Pedido automático de peso
                              </label>
                              <div className="mt-1 grid grid-cols-2 gap-2">
                                <select
                                  value={client.weightRequestFrequency || "monthly"}
                                  onChange={(e) =>
                                    void handleUpdateIntakeDigestPrefs(client.id, {
                                      weightRequestFrequency: e.target.value as "weekly" | "biweekly" | "monthly",
                                    })
                                  }
                                  className="rounded bg-surface-2 border border-border px-2 py-1 text-[11px] text-foreground"
                                >
                                  <option value="monthly">Mensual</option>
                                  <option value="biweekly">Cada 2 semanas</option>
                                  <option value="weekly">Semanal</option>
                                </select>
                                <input
                                  type="date"
                                  value={client.weightRequestStartDate || ""}
                                  onChange={(e) =>
                                    void handleUpdateIntakeDigestPrefs(client.id, {
                                      weightRequestStartDate: e.target.value,
                                    })
                                  }
                                  className="rounded bg-surface-2 border border-border px-2 py-1 text-[11px] text-foreground"
                                />
                              </div>
                              <p className="mt-1 text-[10px] text-text-muted">
                                Último peso:{" "}
                                {typeof client.latestWeightKg === "number"
                                  ? `${client.latestWeightKg} kg (${formatShortDate(client.latestWeightAt || null)})`
                                  : "sin registro"}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm min-w-[140px]">
                          <span
                            className={`badge ${
                              isIntakeCurrentMonthPaid(client)
                                ? "badge-success"
                                : client.paymentStatus === "pending"
                                ? "badge-warning"
                                : "badge-danger"
                            }`}
                          >
                            <FaCircle className="h-2.5 w-2.5" />
                            {isIntakeCurrentMonthPaid(client) ? "Pagado" : client.paymentStatus === "pending" ? "Pendiente" : "No pagó"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm min-w-[170px]">
                          {(() => {
                            const s = getWellnessStatus(client);
                            return (
                              <div className="space-y-1">
                                <span className={`badge ${s.className}`}>
                                  {s.label}
                                </span>
                                <p className="text-[11px] text-text-muted">
                                  Último: {formatShortDate(client.lastWellnessCheckinAt || null)}
                                </p>
                              </div>
                            );
                          })()}
                        </td>
                        <td className="px-4 py-3 text-sm text-text-muted min-w-[100px] tabular-nums">
                          {typeof client.pesoInicialKg === "number" && Number.isFinite(client.pesoInicialKg) ? (
                            <span className="text-foreground font-medium">
                              {Number.isInteger(client.pesoInicialKg)
                                ? client.pesoInicialKg
                                : client.pesoInicialKg.toFixed(1)}{" "}
                              kg
                            </span>
                          ) : (
                            <span className="text-text-subtle">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-text-muted min-w-[150px]">
                          {client.createdAt
                            ? new Date(client.createdAt).toLocaleString("es-ES", {
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "N/A"}
                        </td>
                        <td className="px-4 py-3 text-sm min-w-[260px]">
                          {intakePlanGeneratingClientId === client.id && (
                            <div className="mb-2 rounded-lg border border-info/35 bg-info/15 px-2.5 py-2 text-xs text-info flex flex-wrap items-center gap-2">
                              <span className="inline-block h-3.5 w-3.5 border-2 border-info/40 border-t-info rounded-full animate-spin shrink-0" />
                              <span>
                                {intakePlanActionType === "generate"
                                  ? "Generando plan… (la IA puede tardar 1–2 min)."
                                  : "Actualizando plan… (la IA puede tardar 1–2 min)."}
                              </span>
                            </div>
                          )}
                          <div className="flex flex-wrap items-center gap-1">{renderIntakeActions(client)}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>

              {/* Mobile / Tablet */}
              <div className="mt-5 flex flex-col gap-3 lg:hidden">
                {filteredIntakeClients.map((client) => (
                  <div
                    key={client.id}
                    className={`rounded-xl border p-3 ${
                      intakePlanGeneratingClientId === client.id
                        ? "border-info/40 bg-info/10"
                        : "border-border bg-surface-2"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{client.nombreCompleto || "N/A"}</p>
                        <p className="text-[11px] text-text-muted mt-0.5">
                          {client.createdAt
                            ? `Creado: ${new Date(client.createdAt).toLocaleString("es-ES", {
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}`
                            : "Creado: N/A"}
                        </p>
                      </div>
                      <span
                        className={`badge text-[11px] ${
                          isIntakeCurrentMonthPaid(client)
                            ? "badge-success"
                            : client.paymentStatus === "pending"
                            ? "badge-warning"
                            : "badge-danger"
                        }`}
                      >
                        <FaCircle className="h-2.5 w-2.5" />
                        {isIntakeCurrentMonthPaid(client) ? "Pagado" : client.paymentStatus === "pending" ? "Pendiente" : "No pagó"}
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <p className="text-foreground"><span className="text-text-muted">Email:</span> {client.email || "N/A"}</p>
                      <p className="text-foreground"><span className="text-text-muted">WhatsApp:</span> {client.whatsapp || "N/A"}</p>
                      <p className="text-foreground"><span className="text-text-muted">Instagram:</span> {client.instagram || "N/A"}</p>
                      <p className="text-foreground"><span className="text-text-muted">Servicio:</span> {client.servicioInteres || "N/A"}</p>
                      <p className="text-foreground sm:col-span-2"><span className="text-text-muted">Objetivo:</span> {client.objetivoPrincipal || "N/A"}</p>
                      <p className="text-foreground">
                        <span className="text-text-muted">Bienestar:</span>{" "}
                        <span className={`badge text-[10px] ${getWellnessStatus(client).className}`}>
                          {getWellnessStatus(client).label}
                        </span>
                      </p>
                      <p className="text-text-muted">
                        <span className="text-text-muted">Último check-in:</span> {formatShortDate(client.lastWellnessCheckinAt || null)}
                      </p>
                      <div className="sm:col-span-2 rounded-md border border-border bg-surface-2 p-2">
                        <label className="inline-flex items-center gap-2 text-[11px] text-foreground">
                          <input
                            type="checkbox"
                            checked={client.digestEmailEnabled !== false}
                            onChange={(e) =>
                              void handleUpdateIntakeDigestPrefs(client.id, {
                                digestEmailEnabled: e.target.checked,
                              })
                            }
                          />
                          Enviar email automático
                        </label>
                        <select
                          value={client.digestFrequency || "weekly"}
                          onChange={(e) =>
                            void handleUpdateIntakeDigestPrefs(client.id, {
                              digestFrequency: e.target.value as "weekly" | "biweekly" | "monthly",
                            })
                          }
                          className="mt-1 w-full rounded bg-surface-2 border border-border px-2 py-1 text-[11px] text-foreground"
                        >
                          <option value="weekly">Cada semana</option>
                          <option value="biweekly">Cada 2 semanas</option>
                          <option value="monthly">Cada mes</option>
                        </select>
                        <p className="mt-1 text-[10px] text-text-muted">{digestScheduleLabel(client)}</p>
                        <label className="mt-2 block text-[10px] text-text-muted">
                          Iniciar desde
                          <input
                            type="date"
                            value={client.digestStartDate || ""}
                            onChange={(e) =>
                              void handleUpdateIntakeDigestPrefs(client.id, {
                                digestStartDate: e.target.value,
                              })
                            }
                            className="mt-1 w-full rounded bg-surface-2 border border-border px-2 py-1 text-[11px] text-foreground"
                          />
                        </label>
                        <label className="mt-2 inline-flex items-center gap-2 text-[11px] text-info/90">
                          <input
                            type="checkbox"
                            checked={client.wellnessAutoEnabled === true}
                            onChange={(e) =>
                              void handleUpdateIntakeDigestPrefs(client.id, {
                                wellnessAutoEnabled: e.target.checked,
                              })
                            }
                          />
                          Check-in automático diario
                        </label>
                        <input
                          type="date"
                          value={client.wellnessAutoStartDate || ""}
                          onChange={(e) =>
                            void handleUpdateIntakeDigestPrefs(client.id, {
                              wellnessAutoStartDate: e.target.value,
                            })
                          }
                          className="mt-1 w-full rounded bg-surface-2 border border-border px-2 py-1 text-[11px] text-foreground"
                        />
                        <label className="mt-2 inline-flex items-center gap-2 text-[11px] text-foreground">
                          <input
                            type="checkbox"
                            checked={client.weightRequestAutoEnabled === true}
                            onChange={(e) =>
                              void handleUpdateIntakeDigestPrefs(client.id, {
                                weightRequestAutoEnabled: e.target.checked,
                              })
                            }
                          />
                          Pedido automático de peso
                        </label>
                        <div className="mt-1 grid grid-cols-2 gap-2">
                          <select
                            value={client.weightRequestFrequency || "monthly"}
                            onChange={(e) =>
                              void handleUpdateIntakeDigestPrefs(client.id, {
                                weightRequestFrequency: e.target.value as "weekly" | "biweekly" | "monthly",
                              })
                            }
                            className="rounded bg-surface-2 border border-border px-2 py-1 text-[11px] text-foreground"
                          >
                            <option value="monthly">Mensual</option>
                            <option value="biweekly">Cada 2 semanas</option>
                            <option value="weekly">Semanal</option>
                          </select>
                          <input
                            type="date"
                            value={client.weightRequestStartDate || ""}
                            onChange={(e) =>
                              void handleUpdateIntakeDigestPrefs(client.id, {
                                weightRequestStartDate: e.target.value,
                              })
                            }
                            className="rounded bg-surface-2 border border-border px-2 py-1 text-[11px] text-foreground"
                          />
                        </div>
                        <p className="mt-1 text-[10px] text-text-muted">
                          Último peso:{" "}
                          {typeof client.latestWeightKg === "number"
                            ? `${client.latestWeightKg} kg (${formatShortDate(client.latestWeightAt || null)})`
                            : "sin registro"}
                        </p>
                      </div>
                      <p className="text-foreground">
                        <span className="text-text-muted">Peso inicial:</span>{" "}
                        {typeof client.pesoInicialKg === "number" && Number.isFinite(client.pesoInicialKg) ? (
                          <span className="text-foreground font-medium tabular-nums">
                            {Number.isInteger(client.pesoInicialKg)
                              ? client.pesoInicialKg
                              : client.pesoInicialKg.toFixed(1)}{" "}
                            kg
                          </span>
                        ) : (
                          "—"
                        )}
                      </p>
                      <p className="text-text-muted sm:col-span-2">
                        <span className="text-text-muted">Trabajo:</span>{" "}
                        {client.trabajoTurnos || client.diasTrabajo.length > 0
                          ? `${client.trabajoTurnos || "Sin horas"}${client.diasTrabajo.length > 0 ? ` · ${client.diasTrabajo.join(", ")}` : ""}`
                          : "N/A"}
                      </p>
                    </div>

                    {intakePlanGeneratingClientId === client.id && (
                      <div className="mt-3 rounded-lg border border-info/35 bg-info/15 px-2.5 py-2 text-xs text-info flex flex-wrap items-center gap-2">
                        <span className="inline-block h-3.5 w-3.5 border-2 border-info/40 border-t-info rounded-full animate-spin shrink-0" />
                        <span>
                          {intakePlanActionType === "generate"
                            ? "Generando plan… (la IA puede tardar 1–2 min)."
                            : "Actualizando plan… (la IA puede tardar 1–2 min)."}
                        </span>
                      </div>
                    )}

                    <div className="mt-3 flex flex-wrap items-center gap-1 border-t border-border pt-3">
                      {renderIntakeActions(client)}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
        )}

        {/* Lista de usuarios FitPlan */}
        {view === "fitplan" && (
        <>
          <p className="mt-5 text-xs text-text-muted">Cuentas registradas (sin admin)</p>
          {/* Vista de tabla para desktop */}
          <div className="mt-3 hidden overflow-hidden rounded-2xl border border-border lg:block">
            <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-surface-2 border-b border-border">
                <tr>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold text-text-muted uppercase tracking-wider">Nombre</th>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold text-text-muted uppercase tracking-wider">Contacto</th>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold text-text-muted uppercase tracking-wider">Plan</th>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold text-text-muted uppercase tracking-wider">Pago</th>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold text-text-muted uppercase tracking-wider">Edad</th>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold text-text-muted uppercase tracking-wider">Alt.</th>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold text-text-muted uppercase tracking-wider">Peso</th>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold text-text-muted uppercase tracking-wider">Estado</th>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold text-text-muted uppercase tracking-wider">Creado</th>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold text-text-muted uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <p className="text-text-muted text-sm">
                          La carga de usuarios está deshabilitada temporalmente
                        </p>
                        <p className="text-text-subtle text-xs">
                          Esta funcionalidad se habilitará próximamente
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  users.filter(user => user.email?.toLowerCase() !== "admin@fitplan-ai.com").map((user, index) => {
                    const paymentStatus = getPaymentStatus(user);
                    const isNewUser = newUserIds.includes(user.id);
                    return (
                    <motion.tr
                      key={user.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className={`hover:bg-surface-2 transition-colors border-l-4 group ${isNewUser ? "bg-success/10 border-success/70" : "border-transparent"}`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                        <div className="flex items-center gap-2">
                          <span>{user.nombre || user.email || "N/A"}</span>
                          {isNewUser && (
                            <span className="badge badge-success uppercase tracking-wide text-[10px]">
                              Nuevo
                            </span>
                          )}
                          {(user.pais || user.ciudad) && (
                            <div className="relative group">
                              <span
                                onClick={() => {
                                  if (locationTooltipOpenUserId === user.id) {
                                    setLocationTooltipOpenUserId(null);
                                  } else {
                                    setLocationTooltipOpenUserId(user.id);
                                  }
                                }}
                                className="text-xl cursor-pointer touch-manipulation"
                              >
                                {user.pais ? getCountryFlag(user.pais) : "🌍"}
                              </span>
                              {/* Tooltip (click en mobile, hover en desktop) */}
                              <div
                                className={`absolute left-1/2 bottom-full z-[9999] mb-2 w-48 -translate-x-1/2 rounded-lg border border-border bg-black/95 px-3 py-2 text-xs text-foreground shadow-xl transition-opacity duration-200 ${
                                  locationTooltipOpenUserId === user.id
                                    ? "opacity-100 pointer-events-auto"
                                    : "opacity-0 pointer-events-none md:group-hover:opacity-100"
                                }`}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="space-y-1">
                                  {user.ciudad && (
                                    <p className="text-foreground">
                                      <span className="font-medium">Ciudad:</span> {user.ciudad}
                                    </p>
                                  )}
                                  {user.pais && (
                                    <p className="text-foreground">
                                      <span className="font-medium">País:</span> {user.pais}
                                    </p>
                                  )}
                                  {!user.ciudad && !user.pais && (
                                    <p className="text-text-muted">Ubicación no disponible</p>
                                  )}
                                </div>
                                <div className="absolute left-1/2 top-full -translate-x-1/2 -mt-1">
                                  <div className="h-2 w-2 rotate-45 border-r border-b border-border bg-black/95"></div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex items-center gap-2">
                          {user.email ? (
                            <a
                              href={`mailto:${user.email}`}
                              className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-info/20 hover:bg-info/30 border border-info/30 text-info transition-colors"
                              title={user.email}
                            >
                              <FaEnvelope className="text-sm" />
                            </a>
                          ) : (
                            <span className="text-text-subtle">N/A</span>
                          )}
                          {user.email && user.email.toLowerCase() !== "admin@fitplan-ai.com" && (
                            <button
                              onClick={() => {
                                setSelectedUserForMessage(user);
                                setSendMessageModalOpen(true);
                              }}
                              className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-success/20 hover:bg-success/30 border border-success/30 text-success transition-colors"
                              title={`Enviar mensaje a ${user.nombre || user.email}`}
                            >
                              <FaComment className="text-sm" />
                            </button>
                          )}
                          {user.email && user.email.toLowerCase() !== "admin@fitplan-ai.com" && (
                            <button
                              onClick={() => openPaymentLinkModal(user)}
                              className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-success/20 hover:bg-success/30 border border-success/30 text-success transition-colors"
                              title={`Generar link de pago para ${user.nombre || user.email}`}
                            >
                              <FaLink className="text-sm" />
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {user.email?.toLowerCase() === "admin@fitplan-ai.com" ? (
                          <span className="badge badge-info">
                            Admin
                          </span>
                        ) : user.premium ? (
                          <div className="flex flex-col gap-1">
                            <span className="badge badge-warning">
                              Premium
                            </span>
                            {user.premiumPlanType && (
                              <span className="badge badge-info text-[10px]">
                                {user.premiumPlanType === "monthly" 
                                  ? "Mensual" 
                                  : user.premiumPlanType === "quarterly"
                                  ? "Trimestral"
                                  : user.premiumPlanType === "annual"
                                  ? "Anual"
                                  : ""}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="badge badge-neutral">
                            Regular
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {user.email?.toLowerCase() === "admin@fitplan-ai.com" ? (
                          <span className="badge badge-neutral">
                            N/A
                          </span>
                        ) : user.premium ? (
                          <div className="relative flex items-center gap-2">
                            <FaCircle
                              className={`h-2.5 w-2.5 ${
                                isCurrentMonthPaid(user) ? "text-success drop-shadow-[0_0_6px_rgba(74,222,128,0.9)]" : "text-danger/80"
                              }`}
                              title={isCurrentMonthPaid(user) ? "Mes corriente pago" : "Mes corriente pendiente"}
                            />
                            <span 
                              onClick={async () => {
                                setSelectedUserForPaymentHistory(user);
                                setPaymentHistoryModalOpen(true);
                                setLoadingPaymentHistory(true);
                                try {
                                  const auth = getAuthSafe();
                                  if (!auth?.currentUser) return;
                                  const response = await adminFetch(`/api/admin/payments?userId=${user.id}&adminUserId=${auth.currentUser.uid}`);
                                  if (!response.ok) throw new Error("Error al cargar historial");
                                  const data = await response.json();
                                  setPaymentHistory(data.payments || []);
                                } catch (error) {
                                  console.error("Error al cargar historial de pagos:", error);
                                  setPaymentHistory([]);
                                } finally {
                                  setLoadingPaymentHistory(false);
                                }
                              }}
                              className={`px-2 py-1 text-xs rounded-full border cursor-pointer touch-manipulation hover:opacity-80 transition-opacity ${
                                paymentStatus.status === "paid" 
                                  ? "bg-success/20 text-success border-success/30"
                                  : paymentStatus.status === "expiring"
                                  ? "bg-warning/20 text-warning border-warning/30"
                                  : "bg-danger/20 text-danger border-danger/30"
                              }`}
                            >
                              {paymentStatus.label}
                            </span>
                            {/* Tooltip con información de vencimiento */}
                            {paymentStatus.expiresAt && (
                              <div 
                                className={`absolute left-1/2 bottom-full z-50 mb-2 w-64 -translate-x-1/2 rounded-lg border border-border bg-black/95 px-3 py-2 text-xs text-foreground shadow-xl transition-opacity duration-200 ${
                                  // Mostrar en desktop con hover, en mobile con click
                                  tooltipOpenUserId === user.id 
                                    ? "opacity-100 pointer-events-auto md:pointer-events-none" 
                                    : "opacity-0 pointer-events-none md:group-hover:opacity-100 md:group-focus:opacity-100"
                                }`}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="space-y-1">
                                  <p className="font-semibold text-foreground">
                                    {paymentStatus.status === "expired" 
                                      ? "⚠️ Plan Vencido"
                                      : paymentStatus.status === "expiring"
                                      ? "⏰ Por Vencer"
                                      : "✅ Plan Activo"}
                                  </p>
                                  <p className="text-foreground">
                                    <span className="font-medium">Vencimiento:</span>{" "}
                                    {paymentStatus.expiresAt.toLocaleDateString('es-AR', { 
                                      day: '2-digit', 
                                      month: '2-digit', 
                                      year: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </p>
                                  {paymentStatus.daysUntilExpiry !== null && (
                                    <p className="text-foreground">
                                      <span className="font-medium">
                                        {paymentStatus.daysUntilExpiry < 0 
                                          ? "Vencido hace:" 
                                          : "Días restantes:"}
                                      </span>{" "}
                                      {Math.abs(paymentStatus.daysUntilExpiry)} día{Math.abs(paymentStatus.daysUntilExpiry) !== 1 ? 's' : ''}
                                    </p>
                                  )}
                                  {(() => {
                                    // Extraer monto del último pago
                                    const payment = user.premiumPayment;
                                    let amount: number | null = null;
                                    
                                    if (payment && typeof payment === 'object') {
                                      const paymentObj = payment as Record<string, unknown>;
                                      
                                      // Intentar diferentes formas de acceder al amount
                                      if (typeof paymentObj.amount === 'number') {
                                        amount = paymentObj.amount;
                                      } else if (typeof paymentObj.amount === 'string') {
                                        amount = parseFloat(paymentObj.amount);
                                      } else if (paymentObj.transaction_amount && typeof paymentObj.transaction_amount === 'number') {
                                        amount = paymentObj.transaction_amount;
                                      }
                                    }
                                    
                                    // Fallback: calcular monto basado en el tipo de plan si premiumPayment es null
                                    if (amount === null && user.premiumPlanType) {
                                      const planPrices: Record<string, number> = {
                                        monthly: 10000,
                                        quarterly: 24000,
                                        annual: 50000,
                                      };
                                      amount = planPrices[user.premiumPlanType] || null;
                                    }
                                    
                                    return amount !== null && !isNaN(amount) && amount > 0 ? (
                                      <p className="text-foreground">
                                        <span className="font-medium">Último pago:</span>{" "}
                                        ${amount.toLocaleString('es-AR')} ARS
                                        {!payment && user.premiumPlanType && (
                                          <span className="text-text-subtle text-[10px] ml-1">(estimado)</span>
                                        )}
                                      </p>
                                    ) : null;
                                  })()}
                                  {user.premiumPlanType && (
                                    <p className="text-text-muted text-[10px] mt-1 pt-1 border-t border-border">
                                      Plan: {user.premiumPlanType === "monthly" ? "Mensual" : user.premiumPlanType === "quarterly" ? "Trimestral" : "Anual"}
                                    </p>
                                  )}
                                </div>
                                {/* Flecha del tooltip */}
                                <div className="absolute left-1/2 top-full -translate-x-1/2 -mt-1">
                                  <div className="h-2 w-2 rotate-45 border-r border-b border-border bg-black/95"></div>
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="badge badge-neutral">
                            Regular
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">{user.edad || "N/A"}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                        {user.alturaCm ? `${user.alturaCm} cm` : "N/A"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                        {user.peso ? `${user.peso} kg` : "N/A"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex items-center justify-center">
                          <div className="relative group">
                            <div
                              onClick={() => {
                                if (statusTooltipOpenUserId === user.id) {
                                  setStatusTooltipOpenUserId(null);
                                } else {
                                  setStatusTooltipOpenUserId(user.id);
                                }
                              }}
                              className="cursor-pointer"
                            >
                              {getIMCStatus(user.peso, user.alturaCm).icon}
                            </div>
                            {statusTooltipOpenUserId === user.id && (() => {
                              const status = getIMCStatus(user.peso, user.alturaCm);
                              if (status.status === "saludable") return null;
                              return (
                                <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-[9999] px-3 py-2 rounded-lg bg-black/95 border border-border shadow-xl text-sm whitespace-nowrap pointer-events-auto">
                                  {status.status === "bajo" && status.weightDifference && (
                                    <p className="text-info">
                                      {status.weightDifference.toFixed(1)} kg por debajo del peso ideal
                                    </p>
                                  )}
                                  {status.status === "excedido" && status.weightDifference && (
                                    <p className="text-danger">
                                      {status.weightDifference.toFixed(1)} kg por encima del peso ideal
                                    </p>
                                  )}
                                  <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-white/20"></div>
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-text-muted">{formatDate(user.createdAt)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex items-center gap-1">
                          <AdminActionIcon icon={FaPen} label="Editar usuario" onClick={() => handleEdit(user)} />
                          {user.email?.toLowerCase() !== "admin@fitplan-ai.com" && (
                            <AdminActionIcon
                              icon={FaHistory}
                              label="Ver historial"
                              onClick={async () => {
                                setSelectedUserForHistory(user);
                                setHistoryModalOpen(true);
                                setLoadingHistory(true);
                                try {
                                  const response = await adminFetch(`/api/admin/userHistory?userId=${user.id}&adminUserId=${authUser?.uid}`);
                                  if (!response.ok) throw new Error("Error al cargar historial");
                                  const data = await response.json();
                                  setUserHistory(data);
                                } catch (error) {
                                  console.error("Error al cargar historial:", error);
                                  setUserHistory(null);
                                } finally {
                                  setLoadingHistory(false);
                                }
                              }}
                            />
                          )}
                        </div>
                      </td>
                    </motion.tr>
                    );
                  })
                )}
              </tbody>
            </table>
            </div>
          </div>

          {/* Vista de cards para mobile y tablet */}
          <div className="mt-3 flex flex-col gap-3 lg:hidden">
            {users.length === 0 ? (
              <div className="text-center py-12">
                <div className="flex flex-col items-center gap-3">
                  <p className="text-text-muted text-sm">
                    La carga de usuarios está deshabilitada temporalmente
                  </p>
                  <p className="text-text-subtle text-xs">
                    Esta funcionalidad se habilitará próximamente
                  </p>
                </div>
              </div>
            ) : (
              users.filter(user => user.email?.toLowerCase() !== "admin@fitplan-ai.com").map((user, index) => {
                const paymentStatus = getPaymentStatus(user);
                const isNewUser = newUserIds.includes(user.id);
                return (
                  <motion.div
                    key={user.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={`rounded-lg border p-4 space-y-3 group ${
                      isNewUser 
                        ? "bg-success/10 border-success/30 border-l-4 border-l-success" 
                        : "bg-surface-2 border-border"
                    }`}
                  >
                    {/* Header con nombre y badges */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-semibold text-foreground">{user.nombre || user.email || "N/A"}</h3>
                        {isNewUser && (
                          <span className="badge badge-success uppercase tracking-wide text-[10px]">
                            Nuevo
                          </span>
                        )}
                        {(user.pais || user.ciudad) && (
                          <div className="relative group">
                            <span
                              onClick={() => {
                                if (locationTooltipOpenUserId === user.id) {
                                  setLocationTooltipOpenUserId(null);
                                } else {
                                  setLocationTooltipOpenUserId(user.id);
                                }
                              }}
                              className="text-xl cursor-pointer touch-manipulation"
                            >
                              {user.pais ? getCountryFlag(user.pais) : "🌍"}
                            </span>
                            {/* Tooltip (click en mobile, hover en desktop) */}
                            <div
                              className={`absolute left-1/2 bottom-full z-[9999] mb-2 w-48 -translate-x-1/2 rounded-lg border border-border bg-black/95 px-3 py-2 text-xs text-foreground shadow-xl transition-opacity duration-200 ${
                                locationTooltipOpenUserId === user.id
                                  ? "opacity-100 pointer-events-auto"
                                  : "opacity-0 pointer-events-none md:group-hover:opacity-100"
                              }`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="space-y-1">
                                {user.ciudad && (
                                  <p className="text-foreground">
                                    <span className="font-medium">Ciudad:</span> {user.ciudad}
                                  </p>
                                )}
                                {user.pais && (
                                  <p className="text-foreground">
                                    <span className="font-medium">País:</span> {user.pais}
                                  </p>
                                )}
                                {!user.ciudad && !user.pais && (
                                  <p className="text-text-muted">Ubicación no disponible</p>
                                )}
                              </div>
                              <div className="absolute left-1/2 top-full -translate-x-1/2 -mt-1">
                                <div className="h-2 w-2 rotate-45 border-r border-b border-border bg-black/95"></div>
                              </div>
                            </div>
                          </div>
                        )}
                        {user.email?.toLowerCase() === "admin@fitplan-ai.com" ? (
                          <span className="badge badge-info">
                            Admin
                          </span>
                        ) : user.premium ? (
                          <>
                            <span className="badge badge-warning">
                              Premium
                            </span>
                            {user.premiumPlanType && (
                              <span className="badge badge-info text-[10px]">
                                {user.premiumPlanType === "monthly" 
                                  ? "Mensual" 
                                  : user.premiumPlanType === "quarterly"
                                  ? "Trimestral"
                                  : user.premiumPlanType === "annual"
                                  ? "Anual"
                                  : ""}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="badge badge-neutral">
                            Regular
                          </span>
                        )}
                      </div>
                      <p className="text-text-subtle text-xs">
                        Última conexión: {formatDateTime(user.lastLogin)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {user.email ? (
                        <>
                          <a
                            href={`mailto:${user.email}`}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-info/20 hover:bg-info/30 border border-info/30 text-info transition-colors"
                            title={user.email}
                          >
                            <FaEnvelope className="text-sm" />
                          </a>
                          {user.email.toLowerCase() !== "admin@fitplan-ai.com" && (
                            <button
                              onClick={() => {
                                setSelectedUserForMessage(user);
                                setSendMessageModalOpen(true);
                              }}
                              className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-success/20 hover:bg-success/30 border border-success/30 text-success transition-colors"
                              title={`Enviar mensaje a ${user.nombre || user.email}`}
                            >
                              <FaComment className="text-sm" />
                            </button>
                          )}
                          {user.email.toLowerCase() !== "admin@fitplan-ai.com" && (
                            <button
                              onClick={() => openPaymentLinkModal(user)}
                              className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-success/20 hover:bg-success/30 border border-success/30 text-success transition-colors"
                              title={`Generar link de pago para ${user.nombre || user.email}`}
                            >
                              <FaLink className="text-sm" />
                            </button>
                          )}
                        </>
                      ) : (
                        <span className="text-text-subtle text-sm">N/A</span>
                      )}
                    </div>

                    {/* Información del usuario */}
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-text-muted text-xs mb-0.5">Edad</p>
                        <p className="text-foreground font-medium">{user.edad || "N/A"} años</p>
                      </div>
                      <div>
                        <p className="text-text-muted text-xs mb-0.5">Altura</p>
                        <p className="text-foreground font-medium">{user.alturaCm ? `${user.alturaCm} cm` : "N/A"}</p>
                      </div>
                      <div>
                        <p className="text-text-muted text-xs mb-0.5">Peso</p>
                        <p className="text-foreground font-medium">{user.peso ? `${user.peso} kg` : "N/A"}</p>
                      </div>
                      <div>
                        <p className="text-text-muted text-xs mb-0.5">Estado</p>
                        <div className="flex items-center">
                          <div className="relative group">
                            <div
                              onClick={() => {
                                if (statusTooltipOpenUserId === user.id) {
                                  setStatusTooltipOpenUserId(null);
                                } else {
                                  setStatusTooltipOpenUserId(user.id);
                                }
                              }}
                              className="cursor-pointer"
                            >
                              {getIMCStatus(user.peso, user.alturaCm).icon}
                            </div>
                            {statusTooltipOpenUserId === user.id && (() => {
                              const status = getIMCStatus(user.peso, user.alturaCm);
                              if (status.status === "saludable") return null;
                              return (
                                <div className="absolute left-0 top-full mt-2 z-[9999] px-3 py-2 rounded-lg bg-black/95 border border-border shadow-xl text-sm whitespace-nowrap pointer-events-auto">
                                  {status.status === "bajo" && status.weightDifference && (
                                    <p className="text-info">
                                      {status.weightDifference.toFixed(1)} kg por debajo del peso ideal
                                    </p>
                                  )}
                                  {status.status === "excedido" && status.weightDifference && (
                                    <p className="text-danger">
                                      {status.weightDifference.toFixed(1)} kg por encima del peso ideal
                                    </p>
                                  )}
                                  <div className="absolute left-4 top-0 -translate-y-full w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-white/20"></div>
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      </div>
                      <div>
                        <p className="text-text-muted text-xs mb-0.5">Estado de Pago</p>
                        {user.email?.toLowerCase() === "admin@fitplan-ai.com" ? (
                          <span className="badge badge-neutral">
                            N/A
                          </span>
                        ) : user.premium ? (
                          <div className="relative inline-block">
                            <FaCircle
                              className={`h-2.5 w-2.5 inline-block mr-1 ${
                                isCurrentMonthPaid(user) ? "text-success drop-shadow-[0_0_6px_rgba(74,222,128,0.9)]" : "text-danger/80"
                              }`}
                              title={isCurrentMonthPaid(user) ? "Mes corriente pago" : "Mes corriente pendiente"}
                            />
                            <span 
                              onClick={async () => {
                                setSelectedUserForPaymentHistory(user);
                                setPaymentHistoryModalOpen(true);
                                setLoadingPaymentHistory(true);
                                try {
                                  const auth = getAuthSafe();
                                  if (!auth?.currentUser) return;
                                  const response = await adminFetch(`/api/admin/payments?userId=${user.id}&adminUserId=${auth.currentUser.uid}`);
                                  if (!response.ok) throw new Error("Error al cargar historial");
                                  const data = await response.json();
                                  setPaymentHistory(data.payments || []);
                                } catch (error) {
                                  console.error("Error al cargar historial de pagos:", error);
                                  setPaymentHistory([]);
                                } finally {
                                  setLoadingPaymentHistory(false);
                                }
                              }}
                              className={`px-2 py-1 text-xs rounded-full border cursor-pointer touch-manipulation hover:opacity-80 transition-opacity ${
                                paymentStatus.status === "paid" 
                                  ? "bg-success/20 text-success border-success/30"
                                  : paymentStatus.status === "expiring"
                                  ? "bg-warning/20 text-warning border-warning/30"
                                  : "bg-danger/20 text-danger border-danger/30"
                              }`}
                            >
                              {paymentStatus.label}
                            </span>
                            {/* Tooltip con información de vencimiento */}
                            {paymentStatus.expiresAt && (
                              <div 
                                className={`absolute left-1/2 bottom-full z-50 mb-2 w-64 -translate-x-1/2 rounded-lg border border-border bg-black/95 px-3 py-2 text-xs text-foreground shadow-xl transition-opacity duration-200 ${
                                  tooltipOpenUserId === user.id 
                                    ? "opacity-100 pointer-events-auto" 
                                    : "opacity-0 pointer-events-none"
                                }`}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="space-y-1">
                                  <p className="font-semibold text-foreground">
                                    {paymentStatus.status === "expired" 
                                      ? "⚠️ Plan Vencido"
                                      : paymentStatus.status === "expiring"
                                      ? "⏰ Por Vencer"
                                      : "✅ Plan Activo"}
                                  </p>
                                  <p className="text-foreground">
                                    <span className="font-medium">Vencimiento:</span>{" "}
                                    {paymentStatus.expiresAt.toLocaleDateString('es-AR', { 
                                      day: '2-digit', 
                                      month: '2-digit', 
                                      year: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </p>
                                  {paymentStatus.daysUntilExpiry !== null && (
                                    <p className="text-foreground">
                                      <span className="font-medium">
                                        {paymentStatus.daysUntilExpiry < 0 
                                          ? "Vencido hace:" 
                                          : "Días restantes:"}
                                      </span>{" "}
                                      {Math.abs(paymentStatus.daysUntilExpiry)} día{Math.abs(paymentStatus.daysUntilExpiry) !== 1 ? 's' : ''}
                                    </p>
                                  )}
                                  {(() => {
                                    const payment = user.premiumPayment;
                                    let amount: number | null = null;
                                    
                                    if (payment && typeof payment === 'object') {
                                      const paymentObj = payment as Record<string, unknown>;
                                      if (typeof paymentObj.amount === 'number') {
                                        amount = paymentObj.amount;
                                      } else if (typeof paymentObj.amount === 'string') {
                                        amount = parseFloat(paymentObj.amount);
                                      } else if (paymentObj.transaction_amount && typeof paymentObj.transaction_amount === 'number') {
                                        amount = paymentObj.transaction_amount;
                                      }
                                    }
                                    
                                    if (amount === null && user.premiumPlanType) {
                                      const planPrices: Record<string, number> = {
                                        monthly: 10000,
                                        quarterly: 24000,
                                        annual: 50000,
                                      };
                                      amount = planPrices[user.premiumPlanType] || null;
                                    }
                                    
                                    return amount !== null && !isNaN(amount) && amount > 0 ? (
                                      <p className="text-foreground">
                                        <span className="font-medium">Último pago:</span>{" "}
                                        ${amount.toLocaleString('es-AR')} ARS
                                        {!payment && user.premiumPlanType && (
                                          <span className="text-text-subtle text-[10px] ml-1">(estimado)</span>
                                        )}
                                      </p>
                                    ) : null;
                                  })()}
                                  {user.premiumPlanType && (
                                    <p className="text-text-muted text-[10px] mt-1 pt-1 border-t border-border">
                                      Plan: {user.premiumPlanType === "monthly" ? "Mensual" : user.premiumPlanType === "quarterly" ? "Trimestral" : "Anual"}
                                    </p>
                                  )}
                                </div>
                                <div className="absolute left-1/2 top-full -translate-x-1/2 -mt-1">
                                  <div className="h-2 w-2 rotate-45 border-r border-b border-border bg-black/95"></div>
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="badge badge-neutral">
                            Regular
                          </span>
                        )}
                      </div>
                      <div>
                        <p className="text-text-muted text-xs mb-0.5">Creado</p>
                        <p className="text-foreground font-medium text-xs">{formatDate(user.createdAt)}</p>
                      </div>
                    </div>

                    {/* Botones de acción */}
                    <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-border">
                      <button
                        type="button"
                        onClick={() => handleEdit(user)}
                        className="btn btn-secondary flex-1 text-sm"
                      >
                        <FaPen className="h-3.5 w-3.5" aria-hidden />
                        Editar
                      </button>
                      {user.email?.toLowerCase() !== "admin@fitplan-ai.com" && (
                        <button
                          type="button"
                          onClick={async () => {
                            setSelectedUserForHistory(user);
                            setHistoryModalOpen(true);
                            setLoadingHistory(true);
                            try {
                              const response = await adminFetch(`/api/admin/userHistory?userId=${user.id}&adminUserId=${authUser?.uid}`);
                              if (!response.ok) throw new Error("Error al cargar historial");
                              const data = await response.json();
                              setUserHistory(data);
                            } catch (error) {
                              console.error("Error al cargar historial:", error);
                              setUserHistory(null);
                            } finally {
                              setLoadingHistory(false);
                            }
                          }}
                          className="btn btn-secondary flex-1 text-sm"
                        >
                          <FaHistory className="h-3.5 w-3.5" aria-hidden />
                          Historial
                        </button>
                      )}
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </>
        )}

        {/* Modal de edición */}
        {editingUser && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-surface rounded-xl border border-white/10 p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              <h2 className="text-2xl font-bold text-white mb-4">
                Editar Usuario: {editingUser.nombre || editingUser.id}
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white/60 mb-2">Nombre</label>
                  <input
                    type="text"
                    value={editForm.nombre || ""}
                    onChange={(e) => setEditForm({ ...editForm, nombre: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/60 mb-2">Email</label>
                  <input
                    type="email"
                    value={editForm.email || ""}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/60 mb-2">Sexo</label>
                  <select
                    value={editForm.sexo || ""}
                    onChange={(e) => setEditForm({ ...editForm, sexo: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  >
                    <option value="">Seleccionar...</option>
                    <option value="masculino">Masculino</option>
                    <option value="femenino">Femenino</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/60 mb-2">Edad</label>
                  <input
                    type="number"
                    value={editForm.edad ?? ""}
                    onChange={(e) => setEditForm({ ...editForm, edad: e.target.value ? Number(e.target.value) : null })}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/60 mb-2">Altura (cm)</label>
                  <input
                    type="number"
                    value={editForm.alturaCm ?? ""}
                    onChange={(e) => setEditForm({ ...editForm, alturaCm: e.target.value ? Number(e.target.value) : null })}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/60 mb-2">Peso (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={editForm.peso ?? ""}
                    onChange={(e) => setEditForm({ ...editForm, peso: e.target.value ? Number(e.target.value) : null })}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/60 mb-2">Peso Objetivo (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={editForm.pesoObjetivo ?? ""}
                    onChange={(e) => setEditForm({ ...editForm, pesoObjetivo: e.target.value ? Number(e.target.value) : null })}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/60 mb-2">Premium</label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editForm.premium || false}
                      onChange={(e) => setEditForm({ ...editForm, premium: e.target.checked })}
                      className="w-4 h-4 rounded bg-[var(--surface-2)] border border-[var(--border)] text-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]"
                    />
                    <span className="text-white">Activar Premium</span>
                  </label>
                </div>

                {editForm.premium && (
                  <div>
                    <label className="block text-sm font-medium text-white/60 mb-2">Tipo de Plan</label>
                    <select
                      value={editForm.premiumPlanType || ""}
                      onChange={(e) => setEditForm({ ...editForm, premiumPlanType: e.target.value || null })}
                      className="w-full px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                    >
                      <option value="">Seleccionar tipo de plan...</option>
                      <option value="monthly">Mensual ($10.000 ARS / 5 EUR)</option>
                      <option value="quarterly">Trimestral ($24.000 ARS / 12 EUR)</option>
                      <option value="annual">Anual ($50.000 ARS / 25 EUR)</option>
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-white/60 mb-2">Perfil Atlético</label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editForm.atletico || false}
                      onChange={(e) => setEditForm({ ...editForm, atletico: e.target.checked })}
                      className="w-4 h-4 rounded bg-[var(--surface-2)] border border-[var(--border)] text-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]"
                    />
                    <span className="text-white">Activar</span>
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/60 mb-2">Cintura (cm)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={editForm.cinturaCm ?? ""}
                    onChange={(e) => setEditForm({ ...editForm, cinturaCm: e.target.value ? Number(e.target.value) : null })}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/60 mb-2">Cuello (cm)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={editForm.cuelloCm ?? ""}
                    onChange={(e) => setEditForm({ ...editForm, cuelloCm: e.target.value ? Number(e.target.value) : null })}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/60 mb-2">Cadera (cm)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={editForm.caderaCm ?? ""}
                    onChange={(e) => setEditForm({ ...editForm, caderaCm: e.target.value ? Number(e.target.value) : null })}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/60 mb-2">Ciudad</label>
                  <input
                    type="text"
                    value={editForm.ciudad || ""}
                    onChange={(e) => setEditForm({ ...editForm, ciudad: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                    placeholder="Ej: Buenos Aires"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/60 mb-2">País</label>
                  <input
                    type="text"
                    value={editForm.pais || ""}
                    onChange={(e) => setEditForm({ ...editForm, pais: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                    placeholder="Ej: Argentina"
                  />
                </div>
              </div>

              <div className="flex gap-4 mt-6">
                <button
                  onClick={handleSave}
                  disabled={saving || deleting}
                  className="btn btn-primary flex-1"
                >
                  {saving ? "Guardando..." : "Guardar Cambios"}
                </button>
                <button
                  onClick={handleDelete}
                  disabled={saving || deleting || editingUser?.email?.toLowerCase() === "admin@fitplan-ai.com"}
                  className="px-4 py-2 rounded-lg bg-danger/20 border border-danger/30 text-danger hover:bg-danger/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title={editingUser?.email?.toLowerCase() === "admin@fitplan-ai.com" ? "No se puede eliminar al administrador" : "Eliminar usuario"}
                >
                  {deleting ? "Eliminando..." : "Eliminar Usuario"}
                </button>
                <button
                  onClick={() => {
                    setEditingUser(null);
                    setEditForm({});
                  }}
                  disabled={saving || deleting}
                  className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Modal de Historial Mensual */}
        {historyModalOpen && selectedUserForHistory && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-surface rounded-xl border border-white/10 p-6 max-w-5xl w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-white">
                    Historial Mensual: {selectedUserForHistory.nombre || selectedUserForHistory.email}
                  </h2>
                  <p className="text-white/60 text-sm mt-1">{selectedUserForHistory.email}</p>
                </div>
                <button
                  onClick={() => {
                    setHistoryModalOpen(false);
                    setSelectedUserForHistory(null);
                    setUserHistory(null);
                  }}
                  className="text-white/70 hover:text-white transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6">
                    <path d="M18 6L6 18M6 6l12 12"/>
                  </svg>
                </button>
              </div>

              {loadingHistory ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-info"></div>
                </div>
              ) : userHistory ? (
                <div className="space-y-6">
                  {/* Resumen del usuario */}
                  {(() => {
                    const user = userHistory.user as { 
                      peso?: number; 
                      alturaCm?: number; 
                      edad?: number; 
                      premium?: boolean; 
                      premiumPlanType?: string | null;
                      lastLogin?: string | Date | null;
                    } | null;
                    if (!user) return null;
                    
                    const formatLastLogin = (lastLogin: string | Date | null | undefined): string => {
                      if (!lastLogin) return "Nunca";
                      try {
                        const date = lastLogin instanceof Date ? lastLogin : new Date(lastLogin);
                        if (isNaN(date.getTime())) return "Nunca";
                        return date.toLocaleString('es-AR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        });
                      } catch {
                        return "Nunca";
                      }
                    };
                    
                    return (
                      <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                        <h3 className="text-lg font-semibold text-white mb-3">Datos del Usuario</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-white/60">Peso Actual</p>
                            <p className="text-white font-medium">{user.peso || "N/A"} kg</p>
                          </div>
                          <div>
                            <p className="text-white/60">Altura</p>
                            <p className="text-white font-medium">{user.alturaCm || "N/A"} cm</p>
                          </div>
                          <div>
                            <p className="text-white/60">Edad</p>
                            <p className="text-white font-medium">{user.edad || "N/A"} años</p>
                          </div>
                          <div>
                            <p className="text-white/60">Premium</p>
                            <p className={`font-medium ${user.premium ? "text-warning" : "text-muted"}`}>
                              {user.premium ? "Sí" : "No"}
                            </p>
                          </div>
                          {user.premium && (
                            <div>
                              <p className="text-white/60">Tipo de Plan</p>
                              <p className="text-white font-medium">
                                {user.premiumPlanType === "monthly" 
                                  ? "Mensual" 
                                  : user.premiumPlanType === "quarterly"
                                  ? "Trimestral"
                                  : user.premiumPlanType === "annual"
                                  ? "Anual"
                                  : "N/A"}
                              </p>
                            </div>
                          )}
                          <div className="col-span-2 md:col-span-1">
                            <p className="text-white/60">Última conexión</p>
                            <p className="text-white font-medium text-xs">
                              {formatLastLogin(user.lastLogin)}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Historial mensual */}
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-3">Historial Mensual</h3>
                    {userHistory.history && Array.isArray(userHistory.history) && userHistory.history.length > 0 ? (
                      <div className="space-y-4">
                        {userHistory.history.map((snapshot: unknown, idx: number) => {
                          const snap = snapshot as {
                            snapshotMonth?: string;
                            objetivo?: string;
                            intensidad?: string;
                            tipoDieta?: string;
                            calorias_diarias?: number;
                            macros?: { proteinas?: string; grasas?: string; carbohidratos?: string };
                            pesoInicial?: number;
                            pesoObjetivo?: number;
                            diasGym?: number;
                            minutosSesion?: number;
                            createdAt?: string;
                          };
                          const monthYear = snap.snapshotMonth || "N/A";
                          const [year, month] = monthYear.split("-");
                          const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
                          const monthName = month ? monthNames[parseInt(month) - 1] : "N/A";
                          
                          return (
                            <div key={idx} className="p-4 rounded-lg bg-white/5 border border-white/10">
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="text-lg font-semibold text-white">
                                  {monthName} {year}
                                </h4>
                                {snap.createdAt && (
                                  <span className="text-xs text-white/60">
                                    {new Date(snap.createdAt).toLocaleDateString('es-AR')}
                                  </span>
                                )}
                              </div>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                <div>
                                  <p className="text-white/60">Objetivo</p>
                                  <p className="text-white font-medium capitalize">{snap.objetivo || "N/A"}</p>
                                </div>
                                <div>
                                  <p className="text-white/60">Intensidad</p>
                                  <p className="text-white font-medium capitalize">{snap.intensidad || "N/A"}</p>
                                </div>
                                <div>
                                  <p className="text-white/60">Calorías Diarias</p>
                                  <p className="text-white font-medium">{snap.calorias_diarias || "N/A"} kcal</p>
                                </div>
                                <div>
                                  <p className="text-white/60">Días Gym/Sem</p>
                                  <p className="text-white font-medium">{snap.diasGym || "N/A"}</p>
                                </div>
                                <div>
                                  <p className="text-white/60">Peso Inicial</p>
                                  <p className="text-white font-medium">{snap.pesoInicial || "N/A"} kg</p>
                                </div>
                                <div>
                                  <p className="text-white/60">Peso Objetivo</p>
                                  <p className="text-white font-medium">{snap.pesoObjetivo || "N/A"} kg</p>
                                </div>
                                <div>
                                  <p className="text-white/60">Duración Sesión</p>
                                  <p className="text-white font-medium">{snap.minutosSesion || "N/A"} min</p>
                                </div>
                                <div>
                                  <p className="text-white/60">Dieta</p>
                                  <p className="text-white font-medium capitalize">{snap.tipoDieta || "N/A"}</p>
                                </div>
                              </div>
                              {snap.macros && (
                                <div className="mt-3 pt-3 border-t border-white/10">
                                  <p className="text-white/60 text-xs mb-2">Macronutrientes</p>
                                  <div className="flex gap-4 text-xs">
                                    <span className="text-white/80">Proteínas: {snap.macros.proteinas || "N/A"}</span>
                                    <span className="text-white/80">Grasas: {snap.macros.grasas || "N/A"}</span>
                                    <span className="text-white/80">Carbos: {snap.macros.carbohidratos || "N/A"}</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="p-6 rounded-lg bg-white/5 border border-white/10 text-center">
                        <p className="text-white/60">No hay historial mensual registrado aún</p>
                        <p className="text-white/40 text-sm mt-2">El historial se genera automáticamente cuando los planes cumplen 30 días</p>
                      </div>
                    )}
                  </div>

                  {/* Seguimiento de Peso */}
                  {userHistory.weightRecords && userHistory.weightRecords.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-3">Seguimiento de Peso</h3>
                      <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                        {/* Gráfico simple de evolución */}
                        <div className="mb-4">
                          <div className="flex items-end justify-between gap-1 h-32 mb-2">
                            {userHistory.weightRecords.slice(-10).map((record, idx) => {
                              const maxPeso = Math.max(...userHistory.weightRecords!.map(r => r.peso));
                              const minPeso = Math.min(...userHistory.weightRecords!.map(r => r.peso));
                              const range = maxPeso - minPeso || 1;
                              const height = ((record.peso - minPeso) / range) * 100;
                              const fecha = new Date(record.fecha);
                              return (
                                <div key={idx} className="flex-1 flex flex-col items-center group relative">
                                  <div
                                    className="w-full bg-gradient-to-t from-accent to-accent-strong rounded-t transition-all hover:brightness-110"
                                    style={{ height: `${Math.max(height, 10)}%` }}
                                  >
                                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-surface px-2 py-1 rounded text-xs whitespace-nowrap border border-white/10">
                                      {fecha.toLocaleDateString('es-AR')}: {record.peso} kg
                                    </div>
                                  </div>
                                  <span className="text-[8px] text-white/50 mt-1 transform -rotate-45 origin-top-left whitespace-nowrap">
                                    {fecha.getDate()}/{fecha.getMonth() + 1}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        
                        {/* Tabla de registros */}
                        <div className="mt-4 max-h-48 overflow-y-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-white/10">
                                <th className="text-left py-2 text-white/60">Fecha</th>
                                <th className="text-right py-2 text-white/60">Peso (kg)</th>
                                <th className="text-right py-2 text-white/60">Cambio</th>
                              </tr>
                            </thead>
                            <tbody>
                              {userHistory.weightRecords
                                .sort((a, b) => b.fecha.localeCompare(a.fecha))
                                .slice(0, 15)
                                .map((record, idx, arr) => {
                                  const fecha = new Date(record.fecha);
                                  const cambio = idx < arr.length - 1 
                                    ? (record.peso - arr[idx + 1].peso).toFixed(1)
                                    : null;
                                  return (
                                    <tr key={idx} className="border-b border-white/5">
                                      <td className="py-2 text-white/80">
                                        {fecha.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                      </td>
                                      <td className="text-right py-2 text-white font-medium">{record.peso} kg</td>
                                      <td className="text-right py-2">
                                        {cambio && (
                                          <span className={Number(cambio) > 0 ? "text-danger" : "text-success"}>
                                            {Number(cambio) > 0 ? `+${cambio}` : cambio} kg
                                          </span>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                            </tbody>
                          </table>
                          {userHistory.weightRecords.length > 15 && (
                            <p className="text-white/60 text-xs text-center mt-2">
                              ... y {userHistory.weightRecords.length - 15} registros más
                            </p>
                          )}
                        </div>

                        {/* Estadísticas */}
                        {userHistory.weightRecords.length > 1 && (() => {
                          const sorted = [...userHistory.weightRecords].sort((a, b) => a.fecha.localeCompare(b.fecha));
                          const primerPeso = sorted[0].peso;
                          const ultimoPeso = sorted[sorted.length - 1].peso;
                          const diferencia = ultimoPeso - primerPeso;
                          const diasTranscurridos = Math.ceil(
                            (new Date(sorted[sorted.length - 1].fecha).getTime() - new Date(sorted[0].fecha).getTime()) / (1000 * 60 * 60 * 24)
                          );
                          const promedio = sorted.reduce((sum, r) => sum + r.peso, 0) / sorted.length;
                          
                          return (
                            <div className="mt-4 pt-4 border-t border-white/10 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                              <div>
                                <p className="text-white/60">Peso Inicial</p>
                                <p className="text-white font-medium">{primerPeso} kg</p>
                              </div>
                              <div>
                                <p className="text-white/60">Peso Actual</p>
                                <p className="text-white font-medium">{ultimoPeso} kg</p>
                              </div>
                              <div>
                                <p className="text-white/60">Cambio Total</p>
                                <p className={`font-medium ${diferencia > 0 ? "text-danger" : diferencia < 0 ? "text-success" : "text-white"}`}>
                                  {diferencia > 0 ? `+${diferencia.toFixed(1)}` : diferencia.toFixed(1)} kg
                                </p>
                              </div>
                              <div>
                                <p className="text-white/60">Promedio</p>
                                <p className="text-white font-medium">{promedio.toFixed(1)} kg</p>
                              </div>
                              {diasTranscurridos > 0 && (
                                <div className="col-span-2 md:col-span-4">
                                  <p className="text-white/60">Período</p>
                                  <p className="text-white font-medium">{diasTranscurridos} días ({Math.round(diasTranscurridos / 30 * 10) / 10} meses)</p>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  )}

                  {/* Planes del usuario */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-semibold text-white">Planes Creados ({userHistory.plans?.length || 0})</h3>
                      <button
                        onClick={async () => {
                          if (!selectedUserForHistory) return;
                          try {
                            // Obtener el plan más reciente del usuario
                            const plans = userHistory.plans as Array<{ id?: string; plan?: { plan?: unknown; user?: unknown } }>;
                            if (plans && plans.length > 0) {
                              const latestPlan = plans[0];
                              const response = await fetch("/api/saveMonthlySnapshot", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  userId: selectedUserForHistory.id,
                                  planId: latestPlan.id,
                                  planData: latestPlan.plan?.plan || {},
                                  userData: latestPlan.plan?.user || {},
                                }),
                              });
                              if (response.ok) {
                                alert("Snapshot mensual creado exitosamente");
                                // Recargar historial
                                const historyResponse = await adminFetch(`/api/admin/userHistory?userId=${selectedUserForHistory.id}&adminUserId=${authUser?.uid}`);
                                if (historyResponse.ok) {
                                  const data = await historyResponse.json();
                                  setUserHistory(data);
                                }
                              } else {
                                const error = await response.json();
                                alert(`Error: ${error.error || "No se pudo crear el snapshot"}`);
                              }
                            } else {
                              alert("No hay planes para crear snapshot");
                            }
                          } catch (error) {
                            console.error("Error al crear snapshot:", error);
                            alert("Error al crear snapshot mensual");
                          }
                        }}
                        className="px-3 py-1.5 rounded-lg bg-info/20 hover:bg-info/30 text-info border border-info/30 transition-colors text-sm"
                      >
                        Crear Snapshot Manual
                      </button>
                    </div>
                    {userHistory.plans && Array.isArray(userHistory.plans) && userHistory.plans.length > 0 ? (
                      <div className="space-y-2">
                        {userHistory.plans.slice(0, 5).map((plan: unknown, idx: number) => {
                          const p = plan as {
                            id?: string;
                            createdAt?: string;
                            plan?: {
                              plan?: {
                                calorias_diarias?: number;
                                macros?: { proteinas?: string; grasas?: string; carbohidratos?: string };
                              };
                              user?: {
                                objetivo?: string;
                                intensidad?: string;
                              };
                            };
                          };
                          return (
                            <div key={idx} className="p-3 rounded-lg bg-white/5 border border-white/10 text-sm">
                              <div className="flex items-center justify-between mb-2">
                                <div>
                                  <p className="text-white font-medium">Plan #{idx + 1}</p>
                                  <p className="text-white/60 text-xs">
                                    {p.createdAt ? new Date(p.createdAt).toLocaleDateString('es-AR') : "N/A"}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="text-white/80">
                                    {p.plan?.plan?.calorias_diarias || "N/A"} kcal
                                  </p>
                                  <p className="text-white/60 text-xs capitalize">
                                    {p.plan?.user?.objetivo || "N/A"} - {p.plan?.user?.intensidad || "N/A"}
                                  </p>
                                </div>
                              </div>
                              {p.id && (
                                <button
                                  onClick={() => {
                                    setSelectedPlanIdForStats(p.id || null);
                                    setWeeklyStatsModalOpen(true);
                                  }}
                                  className="w-full mt-2 px-3 py-1.5 rounded-lg bg-info/20 border border-info/30 text-info hover:bg-info/30 transition-colors text-xs font-medium flex items-center justify-center gap-2"
                                >
                                  <FaChartLine className="h-3 w-3" />
                                  Ver estadísticas semanales
                                </button>
                              )}
                            </div>
                          );
                        })}
                        {userHistory.plans.length > 5 && (
                          <p className="text-white/60 text-sm text-center mt-2">
                            ... y {userHistory.plans.length - 5} planes más
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="p-4 rounded-lg bg-white/5 border border-white/10 text-center">
                        <p className="text-white/60">No hay planes registrados</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-6 rounded-lg bg-danger/10 border border-danger/30 text-center">
                  <p className="text-danger">Error al cargar el historial</p>
                </div>
              )}
            </motion.div>
          </div>
        )}

        {/* Modal de Historial de Pagos */}
        {paymentHistoryModalOpen && selectedUserForPaymentHistory && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-surface rounded-xl border border-white/10 p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-white">
                    Historial de Pagos: {selectedUserForPaymentHistory.nombre || selectedUserForPaymentHistory.email}
                  </h2>
                  <p className="text-white/60 text-sm mt-1">{selectedUserForPaymentHistory.email}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setShowAddPaymentForm(true);
                      setNewPayment({
                        amount: "",
                        planType: "monthly",
                        date: new Date().toISOString().split('T')[0],
                        paymentMethod: "transferencia",
                        notes: "",
                      });
                    }}
                    className="px-4 py-2 rounded-lg bg-success/20 hover:bg-success/30 text-success border border-success/30 transition-colors text-sm"
                  >
                    + Agregar Pago
                  </button>
                  <button
                    onClick={() => {
                      setPaymentHistoryModalOpen(false);
                      setSelectedUserForPaymentHistory(null);
                      setPaymentHistory([]);
                      setEditingPaymentIndex(null);
                      setEditingPayment(null);
                      setShowAddPaymentForm(false);
                    }}
                    className="text-white/70 hover:text-white transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6">
                      <path d="M18 6L6 18M6 6l12 12"/>
                    </svg>
                  </button>
                </div>
              </div>

              {/* Formulario para agregar pago manual */}
              {showAddPaymentForm && (
                <div className="mb-6 p-4 rounded-lg bg-white/5 border border-white/10">
                  <h3 className="text-lg font-semibold text-white mb-4">Agregar Pago Manual</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-white/60 mb-2">Monto (ARS)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={newPayment.amount}
                        onChange={(e) => setNewPayment({ ...newPayment, amount: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                        placeholder="10000"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-white/60 mb-2">Tipo de Plan</label>
                      <select
                        value={newPayment.planType}
                        onChange={(e) => setNewPayment({ ...newPayment, planType: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                      >
                        <option value="monthly">Mensual</option>
                        <option value="quarterly">Trimestral</option>
                        <option value="annual">Anual</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-white/60 mb-2">Fecha de Pago</label>
                      <input
                        type="date"
                        value={newPayment.date}
                        onChange={(e) => setNewPayment({ ...newPayment, date: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-white/60 mb-2">Método de Pago</label>
                      <select
                        value={newPayment.paymentMethod}
                        onChange={(e) => setNewPayment({ ...newPayment, paymentMethod: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                      >
                        <option value="transferencia">Transferencia</option>
                        <option value="efectivo">Efectivo</option>
                        <option value="otro">Otro</option>
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-white/60 mb-2">Notas (opcional)</label>
                      <input
                        type="text"
                        value={newPayment.notes}
                        onChange={(e) => setNewPayment({ ...newPayment, notes: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                        placeholder="Ej: Transferencia N° 12345, Comprobante adjunto"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={async () => {
                        if (!newPayment.amount || !newPayment.planType || !newPayment.date || !newPayment.paymentMethod) {
                          alert("Por favor completa todos los campos requeridos");
                          return;
                        }
                        setSavingPayment(true);
                        try {
                          const auth = getAuthSafe();
                          if (!auth?.currentUser) return;
                          
                          const response = await adminFetch("/api/admin/payments", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              adminUserId: auth.currentUser.uid,
                              userId: selectedUserForPaymentHistory.id,
                              amount: Number(newPayment.amount),
                              planType: newPayment.planType,
                              date: newPayment.date,
                              paymentMethod: newPayment.paymentMethod,
                              notes: newPayment.notes || null,
                            }),
                          });
                          
                          if (!response.ok) throw new Error("Error al crear pago");
                          
                          // Recargar historial
                          const historyResponse = await adminFetch(`/api/admin/payments?userId=${selectedUserForPaymentHistory.id}&adminUserId=${auth.currentUser.uid}`);
                          if (historyResponse.ok) {
                            const data = await historyResponse.json();
                            setPaymentHistory(data.payments || []);
                          }
                          
                          setShowAddPaymentForm(false);
                          setNewPayment({
                            amount: "",
                            planType: "monthly",
                            date: new Date().toISOString().split('T')[0],
                            paymentMethod: "transferencia",
                            notes: "",
                          });
                        } catch (error) {
                          console.error("Error al crear pago:", error);
                          alert("Error al crear el pago");
                        } finally {
                          setSavingPayment(false);
                        }
                      }}
                      disabled={savingPayment}
                      className="px-4 py-2 rounded-lg bg-success/20 hover:bg-success/30 text-success border border-success/30 transition-colors disabled:opacity-50"
                    >
                      {savingPayment ? "Guardando..." : "Guardar Pago"}
                    </button>
                    <button
                      onClick={() => {
                        setShowAddPaymentForm(false);
                        setNewPayment({
                          amount: "",
                          planType: "monthly",
                          date: new Date().toISOString().split('T')[0],
                          paymentMethod: "transferencia",
                          notes: "",
                        });
                      }}
                      className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white border border-white/10 transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {loadingPaymentHistory ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-info"></div>
                </div>
              ) : paymentHistory.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-white/60">No hay historial de pagos disponible</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {paymentHistory.map((payment, index) => {
                    const isEditing = editingPaymentIndex === index;
                    const paymentDate = payment.date instanceof Date ? payment.date : new Date(payment.date);
                    const expiresDate = payment.expiresAt ? (payment.expiresAt instanceof Date ? payment.expiresAt : new Date(payment.expiresAt)) : null;
                    
                    return (
                      <div key={index} className="p-4 rounded-lg bg-white/5 border border-white/10">
                        {isEditing ? (
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-white/60 mb-2">Monto</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={editingPayment?.amount || payment.amount}
                                  onChange={(e) => setEditingPayment({
                                    ...editingPayment!,
                                    amount: Number(e.target.value)
                                  })}
                                  className="w-full px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-white/60 mb-2">Tipo de Plan</label>
                                <select
                                  value={editingPayment?.planType || payment.planType}
                                  onChange={(e) => setEditingPayment({
                                    ...editingPayment!,
                                    planType: e.target.value
                                  })}
                                  className="w-full px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                                >
                                  <option value="monthly">Mensual</option>
                                  <option value="quarterly">Trimestral</option>
                                  <option value="annual">Anual</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-white/60 mb-2">Fecha de Pago</label>
                                <input
                                  type="date"
                                  value={editingPayment?.date || paymentDate.toISOString().split('T')[0]}
                                  onChange={(e) => setEditingPayment({
                                    ...editingPayment!,
                                    date: e.target.value
                                  })}
                                  className="w-full px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-white/60 mb-2">Fecha de Vencimiento</label>
                                <input
                                  type="date"
                                  value={editingPayment?.expiresAt || (expiresDate ? expiresDate.toISOString().split('T')[0] : '')}
                                  onChange={(e) => setEditingPayment({
                                    ...editingPayment!,
                                    expiresAt: e.target.value
                                  })}
                                  className="w-full px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                                />
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={async () => {
                                  if (!editingPayment) return;
                                  try {
                                    const auth = getAuthSafe();
                                    if (!auth?.currentUser) return;
                                    
                                    // Nota: La edición de pagos existentes se puede implementar más adelante
                                    // Por ahora, solo permitimos crear nuevos pagos manuales
                                    alert("La edición de pagos existentes estará disponible próximamente. Puedes crear un nuevo pago manual para corregir información.");
                                    setEditingPaymentIndex(null);
                                    setEditingPayment(null);
                                  } catch (error) {
                                    console.error("Error al actualizar pago:", error);
                                    alert("Error al actualizar el pago");
                                  }
                                }}
                                className="px-4 py-2 rounded-lg bg-success/20 hover:bg-success/30 text-success border border-success/30 transition-colors"
                              >
                                Guardar
                              </button>
                              <button
                                onClick={() => {
                                  setEditingPaymentIndex(null);
                                  setEditingPayment(null);
                                }}
                                className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white border border-white/10 transition-colors"
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex-1 grid grid-cols-2 md:grid-cols-6 gap-4 text-sm">
                                <div>
                                  <p className="text-white/60">Monto</p>
                                  <p className="text-white font-medium">${payment.amount.toLocaleString('es-AR')} {payment.currency || 'ARS'}</p>
                                </div>
                                <div>
                                  <p className="text-white/60">Plan</p>
                                  <p className="text-white font-medium">
                                    {payment.planType === "monthly" ? "Mensual" : payment.planType === "quarterly" ? "Trimestral" : "Anual"}
                                  </p>
                                </div>
                                {payment.paymentMethod && (
                                  <div>
                                    <p className="text-white/60">Método</p>
                                    <p className="text-white font-medium capitalize">
                                      {payment.paymentMethod === "mercadopago" ? "MercadoPago" : payment.paymentMethod === "stripe" ? "Stripe" : payment.paymentMethod}
                                      {payment.isManual && (
                                        <span className="ml-2 text-xs text-info">(Manual)</span>
                                      )}
                                    </p>
                                  </div>
                                )}
                                <div>
                                  <p className="text-white/60">Fecha de Pago</p>
                                  <p className="text-white font-medium">
                                    {paymentDate.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-white/60">Vencimiento</p>
                                  <p className="text-white font-medium">
                                    {expiresDate ? expiresDate.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'N/A'}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-white/60">Días restantes</p>
                                  <p className={`font-medium ${
                                    expiresDate 
                                      ? (() => {
                                          const now = new Date();
                                          const diffTime = expiresDate.getTime() - now.getTime();
                                          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                          if (diffDays < 0) return "text-danger";
                                          if (diffDays <= 7) return "text-warning";
                                          return "text-success";
                                        })()
                                      : "text-muted"
                                  }`}>
                                    {expiresDate 
                                      ? (() => {
                                          const now = new Date();
                                          const diffTime = expiresDate.getTime() - now.getTime();
                                          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                          if (diffDays < 0) return `${Math.abs(diffDays)} días vencido`;
                                          return `${diffDays} día${diffDays !== 1 ? 's' : ''}`;
                                        })()
                                      : 'N/A'}
                                  </p>
                                </div>
                              </div>
                              <button
                                onClick={() => {
                                  setEditingPaymentIndex(index);
                                  setEditingPayment({
                                    amount: payment.amount,
                                    date: paymentDate.toISOString().split('T')[0],
                                    planType: payment.planType,
                                    expiresAt: expiresDate ? expiresDate.toISOString().split('T')[0] : '',
                                  });
                                }}
                                className="px-3 py-1.5 rounded-lg bg-info/20 hover:bg-info/30 text-info border border-info/30 transition-colors text-sm"
                              >
                                Editar
                              </button>
                            </div>
                            <div className="flex items-center gap-4 text-xs text-white/40">
                              {payment.paymentId && (
                                <p>ID de Pago: {payment.paymentId}</p>
                              )}
                              {payment.notes && (
                                <p>Notas: {payment.notes}</p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          </div>
        )}

        {intakeClientModalOpen && selectedIntakeClient && (
          <IntakeClientDetailsModal
            isOpen={intakeClientModalOpen}
            onClose={closeIntakeClientModal}
            client={selectedIntakeClient}
            detail={intakeClientDetail}
            loading={intakeClientDetailLoading}
            error={intakeClientDetailError}
            onClientPatched={(patch) => {
              setSelectedIntakeClient((prev) => (prev ? { ...prev, ...patch } : prev));
              setIntakeClientDetail((prev) => (prev ? { ...prev, ...patch } : prev));
              setIntakeClients((prev) => prev.map((c) => (c.id === selectedIntakeClient.id ? { ...c, ...patch } : c)));
            }}
          />
        )}
        {intakeEmailHistoryOpen && intakeEmailHistoryClient && (
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) setIntakeEmailHistoryOpen(false);
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="bg-surface rounded-xl border border-white/10 p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-xl font-bold text-white">Historial de emails</h2>
                  <p className="text-xs text-white/60 mt-1">{intakeEmailHistoryClient.nombreCompleto || intakeEmailHistoryClient.email || intakeEmailHistoryClient.id}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => void handleSendIntakeWelcomeEmail()}
                    disabled={sendingIntakeWelcomeEmail}
                    className="px-3 py-1.5 rounded-lg bg-info/20 border border-info/40 text-info hover:bg-info/30 disabled:opacity-60 text-xs"
                  >
                    {sendingIntakeWelcomeEmail ? "Enviando..." : "Enviar bienvenida"}
                  </button>
                  <button onClick={() => setIntakeEmailHistoryOpen(false)} className="text-white/70 hover:text-white">✕</button>
                </div>
              </div>
              {intakeEmailHistoryMessage ? (
                <p className="text-xs mb-3 text-info">{intakeEmailHistoryMessage}</p>
              ) : null}
              {intakeEmailHistoryLoading ? (
                <p className="text-sm text-white/70">Cargando…</p>
              ) : intakeEmailHistoryItems.length === 0 ? (
                <p className="text-sm text-white/60">No hay emails enviados para este cliente.</p>
              ) : (
                <div className="space-y-3">
                  {intakeEmailHistoryItems.map((item) => (
                    <details key={item.id} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                      <summary className="cursor-pointer text-sm text-white">
                        {item.subject || "Email"} · {item.weekKey || "—"} ·{" "}
                        <span className={item.status === "failed" ? "text-danger" : "text-success"}>
                          {item.status === "failed" ? "Fallido" : "Enviado"}
                        </span>{" "}
                        ·{" "}
                        <span className="text-white/60">{item.createdAt ? new Date(item.createdAt).toLocaleString("es-ES") : "s/f"}</span>
                      </summary>
                      <div className="mt-2 text-xs text-white/80 space-y-2">
                        <p><span className="text-white/60">Para:</span> {item.to || "N/A"}</p>
                        <p><span className="text-white/60">Frecuencia:</span> {item.frequency || "weekly"}</p>
                        {item.status === "failed" ? (
                          <p className="text-danger"><span className="text-danger/80">Error:</span> {item.error || "Sin detalle"}</p>
                        ) : (
                          <div className="rounded bg-white border border-white/10 p-2 max-h-72 overflow-auto">
                            {item.html ? (
                              <div dangerouslySetInnerHTML={{ __html: item.html }} />
                            ) : (
                              <p className="text-xs text-gray-600">Sin cuerpo HTML</p>
                            )}
                          </div>
                        )}
                      </div>
                    </details>
                  ))}
                </div>
              )}
            </motion.div>
          </div>
        )}
        {intakePlanModalOpen && intakePlanClient && (
          <IntakePlanActionModal
            isOpen={intakePlanModalOpen}
            client={intakePlanClient}
            actionType={intakePlanActionType}
            includeNutrition={intakePlanIncludeNutrition}
            includeTraining={intakePlanIncludeTraining}
            objectiveOverride={intakePlanObjectiveOverride}
            trainingStructure={intakeTrainingStructure}
            additionalNotes={intakePlanAdditionalNotes}
            clinicalTrainingHint={intakePlanClient.clinicalTrainingHint ?? null}
            trainingCoachBrief={intakePlanTrainingCoachBrief}
            avoidSquatsAndLunges={intakePlanAvoidSquatsLunges}
            updateMainNeed={intakeUpdateMainNeed}
            updateNutritionFeedback={intakeUpdateNutritionFeedback}
            updateTrainingFeedback={intakeUpdateTrainingFeedback}
            updateCurrentWeight={intakeUpdateCurrentWeight}
            updateEnergyLevel={intakeUpdateEnergyLevel}
            loading={processingIntakeAction}
            onClose={() => {
              setIntakePlanModalOpen(false);
              setIntakePlanClient(null);
            }}
            onToggleNutrition={() => setIntakePlanIncludeNutrition((prev) => !prev)}
            onToggleTraining={() => setIntakePlanIncludeTraining((prev) => !prev)}
            onChangeObjectiveOverride={setIntakePlanObjectiveOverride}
            onChangeTrainingStructure={setIntakeTrainingStructure}
            onChangeAdditionalNotes={setIntakePlanAdditionalNotes}
            onChangeTrainingCoachBrief={setIntakePlanTrainingCoachBrief}
            onChangeAvoidSquatsLunges={setIntakePlanAvoidSquatsLunges}
            onChangeUpdateMainNeed={setIntakeUpdateMainNeed}
            onChangeUpdateNutritionFeedback={setIntakeUpdateNutritionFeedback}
            onChangeUpdateTrainingFeedback={setIntakeUpdateTrainingFeedback}
            onChangeUpdateCurrentWeight={setIntakeUpdateCurrentWeight}
            onChangeUpdateEnergyLevel={setIntakeUpdateEnergyLevel}
            trackingExcelFile={intakeUpdateExcelFile}
            onTrackingExcelChange={setIntakeUpdateExcelFile}
            onSubmit={handleSubmitIntakePlanAction}
          />
        )}
        {intakeGeneratedPlanModalOpen && intakeGeneratedPlanClient && (
          <IntakeGeneratedPlanModal
            isOpen={intakeGeneratedPlanModalOpen}
            client={intakeGeneratedPlanClient}
            loading={intakeGeneratedPlanLoading}
            error={intakeGeneratedPlanError}
            plan={intakeGeneratedPlan}
            onClose={() => {
              setIntakeGeneratedPlanModalOpen(false);
              setIntakeGeneratedPlanClient(null);
              setIntakeGeneratedPlan(null);
              setIntakeGeneratedPlanError(null);
              setIntakeGeneratedPlanLoading(false);
            }}
          />
        )}
        {deletePlanModalOpen && deletePlanClient && (
          <DeleteIntakePlanModal
            isOpen={deletePlanModalOpen}
            client={deletePlanClient}
            deleteNutrition={deletePlanNutrition}
            deleteTraining={deletePlanTraining}
            loading={processingIntakeAction}
            onClose={() => {
              setDeletePlanModalOpen(false);
              setDeletePlanClient(null);
            }}
            onToggleNutrition={() => setDeletePlanNutrition((prev) => !prev)}
            onToggleTraining={() => setDeletePlanTraining((prev) => !prev)}
            onSubmit={handleDeleteGeneratedPlan}
          />
        )}
        {deleteUserModalOpen && deleteUserTarget && (
          <DeleteIntakeUserModal
            isOpen={deleteUserModalOpen}
            client={deleteUserTarget}
            loading={processingIntakeAction}
            onClose={() => {
              setDeleteUserModalOpen(false);
              setDeleteUserTarget(null);
            }}
            onSubmit={handleDeleteIntakeClient}
          />
        )}
        {intakePaymentModalOpen && intakePaymentClient && (
          <IntakePaymentLinkModal
            isOpen={intakePaymentModalOpen}
            client={intakePaymentClient}
            provider={inferProviderByCountry(intakePaymentClient.pais || null)}
            planType={intakePaymentPlan}
            loading={intakePaymentLoading}
            onClose={() => {
              setIntakePaymentModalOpen(false);
              setIntakePaymentClient(null);
            }}
            onChangePlanType={(value) => setIntakePaymentPlan(value)}
            onSubmit={handleCreateIntakePaymentLink}
          />
        )}
        {paymentLinkModalOpen && paymentLinkUser && (
          <PaymentLinkModal
            isOpen={paymentLinkModalOpen}
            user={paymentLinkUser}
            provider={paymentLinkProvider}
            planType={paymentLinkPlan}
            loading={paymentLinkLoading}
            onClose={() => {
              setPaymentLinkModalOpen(false);
              setPaymentLinkUser(null);
            }}
            onChangeProvider={(value) => setPaymentLinkProvider(value)}
            onChangePlanType={(value) => setPaymentLinkPlan(value)}
            onSubmit={handleGeneratePaymentLink}
          />
        )}

        {/* Modal de estadísticas semanales */}
        {weeklyStatsModalOpen && selectedPlanIdForStats && (
          <WeeklyStatsModal
            isOpen={weeklyStatsModalOpen}
            onClose={() => {
              setWeeklyStatsModalOpen(false);
              setSelectedPlanIdForStats(null);
            }}
            planId={selectedPlanIdForStats}
            userId={undefined} // Admin puede ver sin userId
          />
        )}

        {/* Modal para enviar mensaje a usuario */}
        {assignedTrainerModalOpen && (
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) setAssignedTrainerModalOpen(false);
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-surface rounded-xl border border-success/30 max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-white/10 shrink-0">
                <h2 className="text-lg font-semibold text-white">Usuarios con entrenador asignado</h2>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="inline-flex rounded-lg border border-white/20 bg-black/20 p-1 text-xs">
                    <button
                      type="button"
                      onClick={() => setTrainerPreferenceFilter("all")}
                      className={`px-2 py-1 rounded-md transition-colors ${
                        trainerPreferenceFilter === "all" ? "bg-accent text-accent-ink" : "text-muted hover:text-white"
                      }`}
                    >
                      Todos
                    </button>
                    <button
                      type="button"
                      onClick={() => setTrainerPreferenceFilter("hombre")}
                      className={`px-2 py-1 rounded-md transition-colors ${
                        trainerPreferenceFilter === "hombre" ? "bg-accent text-accent-ink" : "text-muted hover:text-white"
                      }`}
                    >
                      Hombre
                    </button>
                    <button
                      type="button"
                      onClick={() => setTrainerPreferenceFilter("mujer")}
                      className={`px-2 py-1 rounded-md transition-colors ${
                        trainerPreferenceFilter === "mujer" ? "bg-accent text-accent-ink" : "text-muted hover:text-white"
                      }`}
                    >
                      Mujer
                    </button>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-white/10 border border-white/20 text-white/85">
                    {filteredAssignedTrainerUsers.length} usuarios
                  </span>
                  <button
                    type="button"
                    onClick={() => setAssignedTrainerModalOpen(false)}
                    className="px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 text-white/90 hover:bg-white/20 text-sm"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
              <div className="overflow-y-auto flex-1 px-5 py-4">
                {filteredAssignedTrainerUsers.length === 0 ? (
                  <p className="text-sm text-white/70">
                    Aún no hay solicitudes de entrenador personal humano.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {visibleAssignedTrainerUsers.map((user) => (
                      <div
                        key={user.id}
                        className="rounded-lg border border-white/15 bg-black/20 p-3 text-sm text-white/85"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium text-white">{user.nombre || user.email || user.id}</p>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] border ${
                              user.personalTrainerPreference === "mujer" || user.personalTrainerPreference === "hombre"
                                ? "bg-surface-2 border-border text-muted"
                                : "bg-white/10 border-white/25 text-white/80"
                            }`}
                          >
                            {user.personalTrainerPreference === "mujer"
                              ? "Entrenadora"
                              : user.personalTrainerPreference === "hombre"
                                ? "Entrenador"
                                : "Sin preferencia"}
                          </span>
                        </div>
                        <p className="text-xs text-white/60">{user.email || "Sin email"}</p>
                        {user.personalTrainerRequestNote && (
                          <p className="mt-2 text-xs text-white/75 line-clamp-3">
                            Motivo: {user.personalTrainerRequestNote}
                          </p>
                        )}
                        {(user.personalTrainerPreference || user.personalTrainerFocus) && (
                          <p className="mt-1 text-xs text-white/70 line-clamp-2">
                            Preferencia: {user.personalTrainerPreference || "N/A"} | Enfoque: {user.personalTrainerFocus || "N/A"}
                          </p>
                        )}
                        <button
                          type="button"
                          onClick={() => window.open("https://wa.me/34627043397", "_blank", "noopener,noreferrer")}
                          className="mt-3 w-full px-3 py-1.5 rounded-lg bg-success/25 border border-success/40 text-success hover:bg-success/35 transition-colors"
                        >
                          Contactar por WhatsApp
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {filteredAssignedTrainerUsers.length > 12 && (
                  <div className="mt-4 flex items-center justify-center gap-2">
                    {hasMoreAssignedTrainerUsers ? (
                      <button
                        type="button"
                        onClick={() => setAssignedTrainerVisibleCount((prev) => prev + 12)}
                        className="px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white/90 hover:bg-white/20 transition-colors text-sm"
                      >
                        Ver más
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setAssignedTrainerVisibleCount(12)}
                        className="px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white/90 hover:bg-white/20 transition-colors text-sm"
                      >
                        Ver menos
                      </button>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}

        {yearlyEarningsModalOpen && (
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-3 sm:p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) setYearlyEarningsModalOpen(false);
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-surface rounded-xl border border-info/30 max-w-xl w-full max-h-[min(90vh,720px)] overflow-hidden flex flex-col shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5 sm:py-4 border-b border-white/10 shrink-0">
                <h2 className="text-base sm:text-lg font-semibold text-white">Ganancias por mes</h2>
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                  <label className="flex items-center gap-2 text-sm text-white/80">
                    <span className="sr-only">Año</span>
                    <select
                      value={yearlyEarningsYear}
                      onChange={(e) => setYearlyEarningsYear(Number(e.target.value))}
                      className="rounded-lg border border-white/20 bg-black/40 px-3 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-info/50"
                    >
                      {Array.from(
                        { length: new Date().getFullYear() - 2019 },
                        (_, i) => 2020 + i
                      ).map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={() => setYearlyEarningsModalOpen(false)}
                    className="px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 text-white/90 hover:bg-white/20 text-sm"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
              <div className="overflow-y-auto flex-1 px-4 py-3 sm:px-5 sm:py-4 min-h-0">
                {yearlyEarningsLoading && (
                  <p className="text-sm text-white/60">Cargando…</p>
                )}
                {!yearlyEarningsLoading && yearlyEarningsPayload && (
                  <>
                    <p className="text-white/60 text-xs mb-3">
                      Mercado Pago en pesos (ARS); Stripe en euros (EUR). Meses antiguos sin desglose aparecen aparte.
                    </p>
                    <div className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] gap-x-2 gap-y-1 text-[11px] sm:text-xs text-white/60 mb-2 px-1 border-b border-white/10 pb-2">
                      <span>Mes</span>
                      <span className="text-right">Pagos</span>
                      <span className="text-right">ARS</span>
                      <span className="text-right">EUR</span>
                    </div>
                    <ul className="space-y-2">
                      {yearlyEarningsPayload.months.map((row) => (
                        <li
                          key={row.monthId}
                          className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] gap-x-2 gap-y-1 text-sm items-center rounded-lg border border-white/10 bg-black/25 px-2 py-2 sm:px-3"
                        >
                          <span className="text-white/90 font-medium truncate">{row.monthLabel}</span>
                          <span className="text-white/50 text-[11px] sm:text-xs tabular-nums text-right">
                            {row.paymentCount > 0 ? row.paymentCount : "—"}
                          </span>
                          <span className="text-success font-semibold tabular-nums text-right text-xs sm:text-sm">
                            {row.totalEarningsArs > 0
                              ? `$${row.totalEarningsArs.toLocaleString("es-AR")}`
                              : "—"}
                          </span>
                          <span className="text-info font-semibold tabular-nums text-right text-xs sm:text-sm">
                            {row.totalEarningsEur > 0
                              ? `€${row.totalEarningsEur.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                              : "—"}
                          </span>
                          {row.legacyTotal > 0 &&
                            row.totalEarningsArs === 0 &&
                            row.totalEarningsEur === 0 && (
                            <span className="col-span-4 text-[10px] text-warning/80 pl-0.5 -mt-0.5">
                              Solo total histórico (sin ARS/EUR separados): ${row.legacyTotal.toLocaleString("es-AR")}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-4 pt-4 border-t border-white/15 space-y-2">
                      <span className="text-white font-semibold">Total año {yearlyEarningsPayload.year}</span>
                      <div className="flex flex-wrap justify-between gap-2 text-sm">
                        <span className="text-white/70">ARS</span>
                        <span className="text-success font-bold tabular-nums">
                          ${yearlyEarningsPayload.yearlyTotalArs.toLocaleString("es-AR")}
                        </span>
                      </div>
                      <div className="flex flex-wrap justify-between gap-2 text-sm">
                        <span className="text-white/70">EUR</span>
                        <span className="text-info font-bold tabular-nums">
                          €{yearlyEarningsPayload.yearlyTotalEur.toLocaleString("es-AR", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                      {yearlyEarningsPayload.yearlyLegacyTotal > 0 && (
                        <div className="flex flex-wrap justify-between gap-2 text-sm">
                          <span className="text-warning/90">Histórico sin desglose</span>
                          <span className="text-warning font-semibold tabular-nums">
                            ${yearlyEarningsPayload.yearlyLegacyTotal.toLocaleString("es-AR")}
                          </span>
                        </div>
                      )}
                    </div>
                  </>
                )}
                {!yearlyEarningsLoading && !yearlyEarningsPayload && (
                  <p className="text-sm text-danger/90">No se pudieron cargar las ganancias de ese año.</p>
                )}
              </div>
            </motion.div>
          </div>
        )}

        {sendMessageModalOpen && selectedUserForMessage && authUser && (
          <AdminSendMessageModal
            isOpen={sendMessageModalOpen}
            onClose={() => {
              setSendMessageModalOpen(false);
              setSelectedUserForMessage(null);
            }}
            targetUser={selectedUserForMessage}
            adminUserId={authUser.uid}
          />
        )}

      </div>
    </AdminShell>
  );
}

function IntakePlanActionModal({
  isOpen,
  client,
  actionType,
  includeNutrition,
  includeTraining,
  objectiveOverride,
  trainingStructure,
  additionalNotes,
  clinicalTrainingHint,
  trainingCoachBrief,
  avoidSquatsAndLunges,
  updateMainNeed,
  updateNutritionFeedback,
  updateTrainingFeedback,
  updateCurrentWeight,
  updateEnergyLevel,
  loading,
  onClose,
  onToggleNutrition,
  onToggleTraining,
  onChangeObjectiveOverride,
  onChangeTrainingStructure,
  onChangeAdditionalNotes,
  onChangeTrainingCoachBrief,
  onChangeAvoidSquatsLunges,
  onChangeUpdateMainNeed,
  onChangeUpdateNutritionFeedback,
  onChangeUpdateTrainingFeedback,
  onChangeUpdateCurrentWeight,
  onChangeUpdateEnergyLevel,
  trackingExcelFile,
  onTrackingExcelChange,
  onSubmit,
}: {
  isOpen: boolean;
  client: IntakeClient;
  actionType: IntakePlanActionType;
  includeNutrition: boolean;
  includeTraining: boolean;
  objectiveOverride: "auto" | "perder_grasa" | "ganar_musculo" | "recomposicion" | "rendimiento" | "mantener";
  trainingStructure: "auto" | "ppl" | "upper_lower" | "full_body";
  additionalNotes: string;
  clinicalTrainingHint: string | null;
  trainingCoachBrief: string;
  avoidSquatsAndLunges: boolean;
  updateMainNeed: string;
  updateNutritionFeedback: string;
  updateTrainingFeedback: string;
  updateCurrentWeight: string;
  updateEnergyLevel: "baja" | "media" | "alta";
  loading: boolean;
  onClose: () => void;
  onToggleNutrition: () => void;
  onToggleTraining: () => void;
  onChangeObjectiveOverride: (
    value: "auto" | "perder_grasa" | "ganar_musculo" | "recomposicion" | "rendimiento" | "mantener"
  ) => void;
  onChangeTrainingStructure: (value: "auto" | "ppl" | "upper_lower" | "full_body") => void;
  onChangeAdditionalNotes: (value: string) => void;
  onChangeTrainingCoachBrief: (value: string) => void;
  onChangeAvoidSquatsLunges: (value: boolean) => void;
  onChangeUpdateMainNeed: (value: string) => void;
  onChangeUpdateNutritionFeedback: (value: string) => void;
  onChangeUpdateTrainingFeedback: (value: string) => void;
  onChangeUpdateCurrentWeight: (value: string) => void;
  onChangeUpdateEnergyLevel: (value: "baja" | "media" | "alta") => void;
  trackingExcelFile: File | null;
  onTrackingExcelChange: (file: File | null) => void;
  onSubmit: () => void;
}) {
  if (!isOpen) return null;
  const title = actionType === "generate" ? "Generar plan mensual" : "Actualizar plan";
  const subtitle =
    actionType === "generate"
      ? "Selecciona qué plan quieres generar para este cliente."
      : "Selecciona qué área quieres actualizar para este cliente.";

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 14 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-surface rounded-xl border border-white/10 p-6 max-w-xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h3 className="text-xl font-bold text-white">{title}</h3>
            <p className="text-sm text-white/70 mt-1">{client.nombreCompleto || client.email || client.id}</p>
            <p className="text-xs text-white/50 mt-1">{subtitle}</p>
            {includeTraining && (
              <p className="text-[11px] text-info/80 mt-2 leading-snug">
                Si marcas limitaciones de entreno abajo, la IA las prioriza y el sistema corrige sentadilla/zancada si aun así aparecieran.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => !loading && onClose()}
            disabled={loading}
            className="text-white/60 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        <div className="space-y-3">
          <label className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 cursor-pointer">
            <span className="text-sm text-white">Plan de alimentación / nutrición</span>
            <input type="checkbox" checked={includeNutrition} onChange={onToggleNutrition} className="h-4 w-4" />
          </label>
          <label className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 cursor-pointer">
            <span className="text-sm text-white">Plan de entrenamiento</span>
            <input type="checkbox" checked={includeTraining} onChange={onToggleTraining} className="h-4 w-4" />
          </label>
          <div className="rounded-lg border border-info/30 bg-info/10 px-3 py-2 text-xs text-info">
            Frecuencia: mensual
          </div>
          <div className="space-y-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-3">
            <p className="text-xs text-white/70">Antes de generar, puedes ajustar el enfoque real del cliente.</p>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-white/70">
                Objetivo real a priorizar
                {client.objetivoPrincipal && (
                  <span className="text-[10px] text-white/50 ml-1">
                    (del formulario: {client.objetivoPrincipal})
                  </span>
                )}
              </span>
              <select
                value={objectiveOverride}
                onChange={(e) =>
                  onChangeObjectiveOverride(
                    e.target.value as "auto" | "perder_grasa" | "ganar_musculo" | "recomposicion" | "rendimiento" | "mantener"
                  )
                }
                className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white outline-none"
              >
                <option value="auto">Usar objetivo del formulario</option>
                <option value="perder_grasa">Bajar grasa corporal</option>
                <option value="ganar_musculo">Ganar masa muscular</option>
                <option value="recomposicion">Recomposición corporal</option>
                <option value="rendimiento">Mejorar rendimiento</option>
                <option value="mantener">Mantener peso/composición</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-white/70">¿Algo más a tener en cuenta? (opcional)</span>
              <textarea
                rows={2}
                value={additionalNotes}
                onChange={(e) => onChangeAdditionalNotes(e.target.value)}
                className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white outline-none"
                placeholder="Ej.: priorizar adherencia, poco tiempo, dolor lumbar al correr..."
              />
            </label>
            {includeTraining && (
              <label className="flex flex-col gap-1">
                <span className="text-xs text-white/70">Estructura de entrenamiento</span>
                <select
                  value={trainingStructure}
                  onChange={(e) => onChangeTrainingStructure(e.target.value as "auto" | "ppl" | "upper_lower" | "full_body")}
                  className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white outline-none"
                >
                  <option value="auto">Auto (según objetivo y días)</option>
                  <option value="ppl">PPL (empuje/tirón/piernas)</option>
                  <option value="upper_lower">Upper/Lower</option>
                  <option value="full_body">Full Body</option>
                </select>
              </label>
            )}
          </div>
          {includeTraining && (
            <div className="space-y-3 rounded-lg border border-warning/30 bg-warning/[0.08] px-3 py-3">
              <p className="text-xs font-semibold text-warning">Entreno — lo que tú confirmas ahora</p>
              {clinicalTrainingHint ? (
                <p className="text-[11px] text-warning/85 leading-relaxed">
                  <span className="text-white/45">Resumen del formulario:</span> {clinicalTrainingHint}
                </p>
              ) : (
                <p className="text-[11px] text-white/45">
                  No hay texto de lesiones/cirugías en el formulario. Si aplica, usa la casilla y las notas.
                </p>
              )}
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={avoidSquatsAndLunges}
                  onChange={(e) => onChangeAvoidSquatsLunges(e.target.checked)}
                  className="h-4 w-4 mt-0.5 shrink-0 rounded border-white/20"
                />
                <span className="text-xs text-white/90 leading-snug">
                  Prohibir sentadilla, zancadas y saltos de pierna en este plan (además, el sistema lo aplica si el formulario habla de rodilla/menisco/LCA, etc.).
                </span>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-white/70">Notas para la rutina (opcional pero muy recomendado)</span>
                <textarea
                  rows={3}
                  value={trainingCoachBrief}
                  onChange={(e) => onChangeTrainingCoachBrief(e.target.value)}
                  className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white outline-none"
                  placeholder="Ej.: rodilla operada — sin flexión profunda cargada; máximo 50 min por sesión; sustituir dominadas por jalón…"
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() =>
                    onChangeTrainingCoachBrief(
                      `${trainingCoachBrief ? `${trainingCoachBrief.trim()}\n` : ""}Rodilla/cirugía: sin sentadilla ni zancadas; máquinas y extensión de cuádriceps con ROM corto.`.trim()
                    )
                  }
                  className="text-[11px] px-2.5 py-1 rounded-md bg-white/10 border border-white/15 text-white/90 hover:bg-white/15 disabled:opacity-40"
                >
                  + Texto rodilla / sin sentadilla
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() =>
                    onChangeTrainingCoachBrief(
                      `${trainingCoachBrief ? `${trainingCoachBrief.trim()}\n` : ""}Sesiones cortas (~45 min); priorizar técnica y adherencia.`.trim()
                    )
                  }
                  className="text-[11px] px-2.5 py-1 rounded-md bg-white/10 border border-white/15 text-white/90 hover:bg-white/15 disabled:opacity-40"
                >
                  + ~45 min sesión
                </button>
              </div>
            </div>
          )}
          {actionType === "update" && (
            <div className="space-y-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-3">
              <p className="text-xs text-white/70">
                Para actualizar de forma eficiente, indica el objetivo del ajuste y los cambios necesarios.
              </p>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-white/70">
                  ¿Qué quieres mejorar este mes? (obligatorio si no adjuntas Excel de seguimiento)
                </span>
                <textarea
                  rows={2}
                  value={updateMainNeed}
                  onChange={(e) => onChangeUpdateMainNeed(e.target.value)}
                  className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white outline-none"
                  placeholder="Ej.: bajar grasa abdominal sin perder fuerza, mejorar adherencia..."
                />
              </label>
              {includeTraining && (
                <div className="rounded-lg border border-success/25 bg-success/10 px-3 py-2 space-y-2">
                  <p className="text-xs text-success/90">
                    Excel de seguimiento (opcional): si el cliente devolvió el archivo con pesos, descansos y RIR
                    rellenados, súbelo aquí para que la IA lo use al actualizar.
                  </p>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    className="hidden"
                    id="intake-tracking-excel-input"
                    onChange={(e) => onTrackingExcelChange(e.target.files?.[0] ?? null)}
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <label
                      htmlFor="intake-tracking-excel-input"
                      className="cursor-pointer px-3 py-1.5 rounded-lg bg-success/30 border border-success/40 text-success text-sm hover:bg-success/40"
                    >
                      Elegir archivo
                    </label>
                    <span className="text-xs text-white/60 truncate max-w-[200px]">
                      {trackingExcelFile ? trackingExcelFile.name : "Ningún archivo seleccionado"}
                    </span>
                    {trackingExcelFile && (
                      <button
                        type="button"
                        onClick={() => onTrackingExcelChange(null)}
                        className="text-xs text-danger hover:underline"
                      >
                        Quitar
                      </button>
                    )}
                  </div>
                </div>
              )}
              {includeNutrition && (
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-white/70">Feedback nutrición (opcional)</span>
                  <textarea
                    rows={2}
                    value={updateNutritionFeedback}
                    onChange={(e) => onChangeUpdateNutritionFeedback(e.target.value)}
                    className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white outline-none"
                    placeholder="Ej.: hambre por la noche, poca saciedad en desayuno, horarios difíciles..."
                  />
                </label>
              )}
              {includeTraining && (
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-white/70">Feedback entrenamiento (opcional)</span>
                  <textarea
                    rows={2}
                    value={updateTrainingFeedback}
                    onChange={(e) => onChangeUpdateTrainingFeedback(e.target.value)}
                    className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white outline-none"
                    placeholder="Ej.: dolor en hombro, poco tiempo, ejercicios muy avanzados..."
                  />
                </label>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-white/70">Peso actual (kg, opcional)</span>
                  <input
                    value={updateCurrentWeight}
                    onChange={(e) => onChangeUpdateCurrentWeight(e.target.value)}
                    className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white outline-none"
                    placeholder="Ej.: 74.2"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-white/70">Nivel de energía actual</span>
                  <select
                    value={updateEnergyLevel}
                    onChange={(e) => onChangeUpdateEnergyLevel(e.target.value as "baja" | "media" | "alta")}
                    className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white outline-none"
                  >
                    <option value="baja">Baja</option>
                    <option value="media">Media</option>
                    <option value="alta">Alta</option>
                  </select>
                </label>
              </div>
            </div>
          )}
        </div>

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="btn btn-secondary flex-1"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={loading}
            className="btn btn-primary flex-1"
          >
            {loading ? (
              <>
                <span className="inline-block h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin shrink-0" />
                {actionType === "generate" ? "Generando plan…" : "Actualizando plan…"}
              </>
            ) : actionType === "generate" ? (
              "Generar"
            ) : (
              "Actualizar"
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function DeleteIntakePlanModal({
  isOpen,
  client,
  deleteNutrition,
  deleteTraining,
  loading,
  onClose,
  onToggleNutrition,
  onToggleTraining,
  onSubmit,
}: {
  isOpen: boolean;
  client: IntakeClient;
  deleteNutrition: boolean;
  deleteTraining: boolean;
  loading: boolean;
  onClose: () => void;
  onToggleNutrition: () => void;
  onToggleTraining: () => void;
  onSubmit: () => void;
}) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 14 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-surface rounded-xl border border-white/10 p-6 max-w-lg w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h3 className="text-xl font-bold text-white">Eliminar Plan/es</h3>
            <p className="text-sm text-white/70 mt-1">{client.nombreCompleto || client.email || client.id}</p>
            <p className="text-xs text-white/50 mt-1">Elige qué parte del plan quieres eliminar para regenerar.</p>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white">✕</button>
        </div>

        <div className="space-y-3">
          <label className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 cursor-pointer">
            <span className="text-sm text-white">Eliminar plan de alimentación / nutrición</span>
            <input type="checkbox" checked={deleteNutrition} onChange={onToggleNutrition} className="h-4 w-4" />
          </label>
          <label className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 cursor-pointer">
            <span className="text-sm text-white">Eliminar plan de entrenamiento</span>
            <input type="checkbox" checked={deleteTraining} onChange={onToggleTraining} className="h-4 w-4" />
          </label>
        </div>

        <div className="mt-5 flex gap-3">
          <button
            onClick={onClose}
            className="btn btn-secondary flex-1"
          >
            Cancelar
          </button>
          <button
            onClick={onSubmit}
            disabled={loading || (!deleteNutrition && !deleteTraining)}
            className="btn btn-danger flex-1"
          >
            {loading ? "Eliminando..." : "Eliminar selección"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function DeleteIntakeUserModal({
  isOpen,
  client,
  loading,
  onClose,
  onSubmit,
}: {
  isOpen: boolean;
  client: IntakeClient;
  loading: boolean;
  onClose: () => void;
  onSubmit: () => void;
}) {
  if (!isOpen) return null;
  const hasPlan = !!client.latestPlanId;
  const hasNutrition = hasPlan && client.latestPlanIncludeNutrition !== false;
  const hasTraining = hasPlan && client.latestPlanIncludeTraining !== false;
  const deletionSummary = hasPlan
    ? hasNutrition && hasTraining
      ? "Se eliminará 1 plan completo: nutrición + entrenamiento."
      : hasNutrition
      ? "Se eliminará 1 plan de nutrición."
      : hasTraining
      ? "Se eliminará 1 plan de entrenamiento."
      : "Se eliminará el usuario del formulario de inicio."
    : "No hay plan generado: se eliminará solo el usuario del formulario de inicio.";

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 14 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-surface rounded-xl border border-white/10 p-6 max-w-lg w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h3 className="text-xl font-bold text-white">Eliminar Usuario</h3>
            <p className="text-sm text-white/70 mt-1">{client.nombreCompleto || client.email || client.id}</p>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white">✕</button>
        </div>

        <div className="rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
          Esta acción eliminará al cliente del formulario de inicio y todos sus planes relacionados. No se puede deshacer.
        </div>
        <div className="mt-3 rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-white/85">
          {deletionSummary}
        </div>

        <div className="mt-5 flex gap-3">
          <button
            onClick={onClose}
            className="btn btn-secondary flex-1"
          >
            Cancelar
          </button>
          <button
            onClick={onSubmit}
            disabled={loading}
            className="btn btn-danger flex-1"
          >
            {loading ? "Eliminando..." : "Sí, eliminar todo"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function PaymentLinkModal({
  isOpen,
  user,
  provider,
  planType,
  loading,
  onClose,
  onChangeProvider,
  onChangePlanType,
  onSubmit,
}: {
  isOpen: boolean;
  user: User;
  provider: PaymentLinkProvider;
  planType: PaymentLinkPlan;
  loading: boolean;
  onClose: () => void;
  onChangeProvider: (value: PaymentLinkProvider) => void;
  onChangePlanType: (value: PaymentLinkPlan) => void;
  onSubmit: () => void;
}) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 14 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-surface rounded-xl border border-white/10 p-6 max-w-lg w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-xl font-bold text-white">Enviar link de pago</h3>
        <p className="text-sm text-white/70 mt-1">{user.nombre || user.email || user.id}</p>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="text-sm text-white/85">
            Proveedor
            <select
              value={provider}
              onChange={(e) => onChangeProvider(e.target.value as PaymentLinkProvider)}
              className="mt-1 w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-white"
            >
              <option value="stripe">Stripe</option>
              <option value="mercadopago">MercadoPago</option>
            </select>
          </label>
          <label className="text-sm text-white/85">
            Plan
            <select
              value={planType}
              onChange={(e) => onChangePlanType(e.target.value as PaymentLinkPlan)}
              className="mt-1 w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-white"
            >
              <option value="monthly">Mensual</option>
              <option value="quarterly">Trimestral</option>
              <option value="annual">Anual</option>
            </select>
          </label>
        </div>
        <p className="mt-3 text-xs text-white/60">Se genera el link, se copia al portapapeles y, si hay WhatsApp, se abre el envío directo.</p>
        <div className="mt-5 flex gap-3">
          <button onClick={onClose} className="btn btn-secondary flex-1">
            Cancelar
          </button>
          <button
            onClick={onSubmit}
            disabled={loading}
            className="btn btn-primary flex-1"
          >
            <FaWhatsapp className="h-4 w-4" />
            {loading ? "Generando..." : "Generar y enviar"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function IntakePaymentLinkModal({
  isOpen,
  client,
  provider,
  planType,
  loading,
  onClose,
  onChangePlanType,
  onSubmit,
}: {
  isOpen: boolean;
  client: IntakeClient;
  provider: PaymentLinkProvider;
  planType: PaymentLinkPlan;
  loading: boolean;
  onClose: () => void;
  onChangePlanType: (value: PaymentLinkPlan) => void;
  onSubmit: () => void;
}) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 14 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-surface rounded-xl border border-white/10 p-6 max-w-lg w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-xl font-bold text-white">Enviar Link de Pago</h3>
        <p className="text-sm text-white/70 mt-1">{client.nombreCompleto || client.email || client.id}</p>
        <p className="text-xs text-white/50 mt-1">Proveedor detectado: {provider === "mercadopago" ? "MercadoPago" : "Stripe"}</p>

        <label className="text-sm text-white/85 block mt-4">
          Elegir plan
          <select
            value={planType}
            onChange={(e) => onChangePlanType(e.target.value as PaymentLinkPlan)}
            className="mt-1 w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-white"
          >
            <option value="monthly">Mensual</option>
            <option value="quarterly">Trimestral</option>
            <option value="annual">Anual</option>
          </select>
        </label>

        <div className="mt-5 flex gap-3">
          <button onClick={onClose} className="btn btn-secondary flex-1">
            Cancelar
          </button>
          <button
            onClick={onSubmit}
            disabled={loading}
            className="btn btn-primary flex-1"
          >
            {loading ? "Generando..." : "Generar link"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

type IntakeBasicsDraft = {
  nombre: string;
  apellido: string;
  email: string;
  edad: string;
  ciudad: string;
  instagram: string;
  whatsapp: string;
  emailVerified: boolean;
  whatsappVerified: boolean;
  privacyConsentAccepted: boolean;
};

type IntakeBasicsStringKey = keyof Pick<
  IntakeBasicsDraft,
  "nombre" | "apellido" | "email" | "edad" | "ciudad" | "instagram" | "whatsapp"
>;

function IntakeClientDetailsModal({
  isOpen,
  onClose,
  client,
  detail,
  loading,
  error,
  onClientPatched,
}: {
  isOpen: boolean;
  onClose: () => void;
  client: IntakeClient;
  detail: IntakeClientDetail | null;
  loading: boolean;
  error: string | null;
  onClientPatched: (patch: Partial<IntakeClientDetail>) => void;
}) {
  const [analyticsRange, setAnalyticsRange] = useState<"7d" | "30d" | "90d" | "12m" | "all">("30d");
  const [editOpen, setEditOpen] = useState(false);
  const [savingBasics, setSavingBasics] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [draft, setDraft] = useState<IntakeBasicsDraft>({
    nombre: "",
    apellido: "",
    email: "",
    edad: "",
    ciudad: "",
    instagram: "",
    whatsapp: "",
    emailVerified: false,
    whatsappVerified: false,
    privacyConsentAccepted: false,
  });
  const getRangeStartMs = (range: "7d" | "30d" | "90d" | "12m" | "all"): number | null => {
    if (range === "all") return null;
    const now = Date.now();
    if (range === "7d") return now - 7 * 86400000;
    if (range === "30d") return now - 30 * 86400000;
    if (range === "90d") return now - 90 * 86400000;
    return now - 365 * 86400000;
  };
  const toMs = (iso?: string | null): number | null => {
    if (!iso) return null;
    const n = Date.parse(iso);
    return Number.isFinite(n) ? n : null;
  };
  const rangeStartMs = getRangeStartMs(analyticsRange);
  const inRangeByIso = (iso?: string | null): boolean => {
    if (rangeStartMs == null) return true;
    const ms = toMs(iso);
    return ms != null && ms >= rangeStartMs;
  };
  const inRangeByYmd = (ymd?: string | null): boolean => {
    if (rangeStartMs == null) return true;
    if (!ymd) return false;
    const ms = Date.parse(`${ymd}T00:00:00`);
    return Number.isFinite(ms) && ms >= rangeStartMs;
  };
  const engagementEventsFiltered = (detail?.engagementEvents || []).filter(
    (ev) => inRangeByYmd(ev.ymd || null) || inRangeByIso(ev.createdAt || null)
  );
  const wellnessFiltered = (detail?.wellnessRecent || []).filter((w) => inRangeByYmd(w.ymd));
  const weightPts = (detail?.weightSeries || []).filter((w) => inRangeByYmd(w.ymd));
  const minW = weightPts.length ? Math.min(...weightPts.map((p) => p.weightKg)) : 0;
  const maxW = weightPts.length ? Math.max(...weightPts.map((p) => p.weightKg)) : 0;
  const rangeW = Math.max(1, maxW - minW);
  const chartWidth = 520;
  const chartHeight = 160;
  const polyline = weightPts
    .map((p, idx) => {
      const x = weightPts.length <= 1 ? 0 : (idx / (weightPts.length - 1)) * chartWidth;
      const y = chartHeight - ((p.weightKg - minW) / rangeW) * chartHeight;
      return `${x},${y}`;
    })
    .join(" ");
  if (!isOpen) return null;

  const formData = detail?.formData || null;
  const knownKeys = Array.from(
    new Set<string>([...INTAKE_DETAIL_FIELD_ORDER, ...Object.keys(INTAKE_DETAIL_LABELS)])
  );
  const extraKeys = formData
    ? Object.keys(formData)
        .filter((key) => !knownKeys.includes(key))
        .sort((a, b) => a.localeCompare(b))
    : [];
  const keysToRender = [...knownKeys, ...extraKeys];
  const getFieldValue = (key: string): unknown => {
    if (formData && Object.prototype.hasOwnProperty.call(formData, key)) {
      return formData[key];
    }
    if (detail && Object.prototype.hasOwnProperty.call(detail, key)) {
      return (detail as unknown as Record<string, unknown>)[key];
    }
    return undefined;
  };
  const openBasicsEdit = () => {
    const fullName = (detail?.nombreCompleto || client.nombreCompleto || "").trim();
    const nameParts = fullName.split(/\s+/).filter(Boolean);
    const baseFormData = detail?.formData && typeof detail.formData === "object" ? detail.formData : null;
    const edadFromForm =
      baseFormData && typeof baseFormData.edad === "number"
        ? baseFormData.edad
        : baseFormData && typeof baseFormData.edad === "string" && baseFormData.edad.trim()
          ? Number(baseFormData.edad)
          : null;
    const edadFromDetail =
      detail && Object.prototype.hasOwnProperty.call(detail, "edad")
        ? Number((detail as unknown as Record<string, unknown>).edad)
        : null;
    const edadRaw = Number.isFinite(edadFromForm as number)
      ? (edadFromForm as number)
      : Number.isFinite(edadFromDetail as number)
        ? (edadFromDetail as number)
        : null;
    const ciudadRaw = baseFormData && typeof baseFormData.ciudadPais === "string" ? baseFormData.ciudadPais : null;
    setSaveError(null);
    setDraft({
      nombre: nameParts.length ? nameParts[0] : "",
      apellido: nameParts.length > 1 ? nameParts.slice(1).join(" ") : "",
      email: detail?.email || client.email || "",
      edad: typeof edadRaw === "number" ? String(edadRaw) : "",
      ciudad: ciudadRaw || "",
      instagram: detail?.instagram || client.instagram || "",
      whatsapp: detail?.whatsapp || client.whatsapp || "",
      emailVerified: detail?.emailVerified === true,
      whatsappVerified: detail?.whatsappVerified === true,
      privacyConsentAccepted: detail?.privacyConsentAccepted === true,
    });
    setEditOpen(true);
  };
  const saveBasics = async () => {
    const auth = getAuthSafe();
    if (!auth?.currentUser?.uid) {
      setSaveError("No hay sesión activa para guardar.");
      return;
    }
    setSavingBasics(true);
    setSaveError(null);
    try {
      const response = await adminFetch("/api/admin/updateIntakeClientBasics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminUserId: auth.currentUser.uid,
          intakeClientId: client.id,
          ...draft,
          edad: draft.edad.trim() ? Number(draft.edad) : null,
        }),
      });
      const json = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(typeof json.error === "string" ? json.error : `Error ${response.status}`);
      const nombreCompleto = [draft.nombre.trim(), draft.apellido.trim()].filter(Boolean).join(" ").trim() || null;
      onClientPatched({
        nombreCompleto,
        email: draft.email.trim() || null,
        whatsapp: draft.whatsapp.trim() || null,
        instagram: draft.instagram.trim() || null,
        emailVerified: draft.emailVerified,
        whatsappVerified: draft.whatsappVerified,
        privacyConsentAccepted: draft.privacyConsentAccepted,
        formData: {
          ...(detail?.formData || {}),
          nombreCompleto,
          email: draft.email.trim() || null,
          edad: draft.edad.trim() ? Number(draft.edad) : null,
          ciudadPais: draft.ciudad.trim() || null,
          instagram: draft.instagram.trim() || null,
          whatsapp: draft.whatsapp.trim() || null,
          emailVerified: draft.emailVerified,
          whatsappVerified: draft.whatsappVerified,
          privacyConsentAccepted: draft.privacyConsentAccepted,
        },
      });
      setEditOpen(false);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "No se pudieron guardar los datos");
    } finally {
      setSavingBasics(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-surface rounded-xl border border-white/10 p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-xl font-bold text-white">Detalle del cliente</h2>
            <p className="text-sm text-white/70 mt-1">
              {client.nombreCompleto || client.email || client.id}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={openBasicsEdit}
              className="px-3 py-1.5 rounded-lg border border-info/30 bg-info/10 text-info text-sm hover:bg-info/20"
            >
              Editar esenciales
            </button>
            <button
              onClick={onClose}
              className="text-white/70 hover:text-white transition-colors"
              aria-label="Cerrar modal de detalle"
            >
              ✕
            </button>
          </div>
        </div>

        {editOpen && (
          <div className="mb-5 rounded-xl border border-info/20 bg-info/5 p-4">
            <p className="text-sm font-medium text-info">Editar datos esenciales</p>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                ["nombre", "Nombre"],
                ["apellido", "Apellido"],
                ["email", "Email"],
                ["edad", "Edad"],
                ["ciudad", "Ciudad"],
                ["instagram", "Instagram"],
                ["whatsapp", "WhatsApp"],
              ].map(([key, label]) => {
                const k = key as IntakeBasicsStringKey;
                return (
                <label key={key} className="text-xs text-white/70">
                  {label}
                  <input
                    type={key === "edad" ? "number" : "text"}
                    value={draft[k]}
                    onChange={(e) => setDraft((prev) => ({ ...prev, [k]: e.target.value }))}
                    className="mt-1 w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white"
                  />
                </label>
                );
              })}
            </div>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
              <label className="text-xs text-white/80 inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={draft.emailVerified}
                  onChange={(e) => setDraft((prev) => ({ ...prev, emailVerified: e.target.checked }))}
                />
                Email verificado
              </label>
              <label className="text-xs text-white/80 inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={draft.whatsappVerified}
                  onChange={(e) => setDraft((prev) => ({ ...prev, whatsappVerified: e.target.checked }))}
                />
                WhatsApp verificado
              </label>
              <label className="text-xs text-white/80 inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={draft.privacyConsentAccepted}
                  onChange={(e) => setDraft((prev) => ({ ...prev, privacyConsentAccepted: e.target.checked }))}
                />
                Consentimiento privacidad
              </label>
            </div>
            {saveError ? <p className="text-xs text-danger mt-3">{saveError}</p> : null}
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setEditOpen(false)}
                disabled={savingBasics}
                className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white hover:bg-white/10 disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                onClick={() => void saveBasics()}
                disabled={savingBasics}
                className="px-3 py-1.5 rounded-lg bg-info/20 border border-info/30 text-info hover:bg-info/30 disabled:opacity-60"
              >
                {savingBasics ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="py-10 flex justify-center">
            <div className="h-8 w-8 rounded-full border-b-2 border-info animate-spin" />
          </div>
        ) : error ? (
          <div className="p-3 rounded-lg bg-danger/20 border border-danger/30 text-danger text-sm">
            {error}
          </div>
        ) : !detail ? (
          <div className="p-3 rounded-lg bg-white/5 border border-white/10 text-white/70 text-sm">
            No se encontró información de este cliente.
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                <p className="text-xs text-white/60">Estado</p>
                <p className="text-sm text-white">{detail.status || "N/A"}</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                <p className="text-xs text-white/60">Fecha de alta</p>
                <p className="text-sm text-white">
                  {detail.createdAt
                    ? new Date(detail.createdAt).toLocaleString("es-ES")
                    : "N/A"}
                </p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                <p className="text-xs text-white/60">Verificación de contacto</p>
                <p className="text-sm text-white">
                  Email: {detail.emailVerified ? "Verificado" : "Pendiente"} · WhatsApp: {detail.whatsappVerified ? "Verificado" : "Pendiente"}
                </p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                <p className="text-xs text-white/60">Consentimiento privacidad</p>
                <p className="text-sm text-white">
                  {detail.privacyConsentAccepted ? "Aceptado" : "Pendiente"}
                  {detail.privacyConsentAt ? ` · ${new Date(detail.privacyConsentAt).toLocaleString("es-ES")}` : ""}
                </p>
              </div>
            </div>
            {detail.adherence ? (
              <div className="rounded-lg border border-info/30 bg-info/10 px-3 py-2">
                <p className="text-xs text-info mb-1">Adherencia (dashboard rápido)</p>
                <p className="text-sm text-white">
                  28d: {detail.adherence.sessionsLast28d} sesiones · 56d: {detail.adherence.sessionsLast56d} sesiones ·
                  Semanas activas (4): {detail.adherence.activeWeeksLast4}/4 · Promedio semanal: {detail.adherence.weeklyAvgLast4}
                </p>
              </div>
            ) : null}
            {detail.timelines ? (
              <div className="rounded-lg border border-success/30 bg-success/10 px-3 py-2">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-success">Seguimiento (día / semana / mes)</p>
                  <div className="inline-flex items-center gap-1">
                    {[
                      ["7d", "7d"],
                      ["30d", "30d"],
                      ["90d", "90d"],
                      ["12m", "12m"],
                      ["all", "Todo"],
                    ].map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setAnalyticsRange(id as "7d" | "30d" | "90d" | "12m" | "all")}
                        className={`px-2 py-0.5 rounded text-[10px] border ${
                          analyticsRange === id
                            ? "bg-success/30 border-success/50 text-success"
                            : "bg-white/5 border-white/15 text-white/70 hover:bg-white/10"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  <div className="rounded border border-white/10 bg-black/20 px-2 py-1.5">
                    <p className="text-white/60">Día</p>
                    <p className="text-white/90">
                      Entrenos: {detail.timelines.day.workouts || 0} · Check-ins:{" "}
                      {wellnessFiltered.filter((w) => {
                        const ms = Date.parse(`${w.ymd}T00:00:00`);
                        return Number.isFinite(ms) && ms >= Date.now() - 86400000;
                      }).length}{" "}
                      · Peso:{" "}
                      {weightPts.filter((w) => {
                        const ms = Date.parse(`${w.ymd}T00:00:00`);
                        return Number.isFinite(ms) && ms >= Date.now() - 86400000;
                      }).length}
                    </p>
                  </div>
                  <div className="rounded border border-white/10 bg-black/20 px-2 py-1.5">
                    <p className="text-white/60">Semana</p>
                    <p className="text-white/90">
                      Entrenos: {detail.timelines.week.workouts || 0} · Check-ins: {wellnessFiltered.length}
                    </p>
                    <p className="text-white/70">
                      Solicitudes: {engagementEventsFiltered.filter((e) => e.status === "requested").length} · Completados:{" "}
                      {engagementEventsFiltered.filter((e) => e.status === "completed").length}
                    </p>
                  </div>
                  <div className="rounded border border-white/10 bg-black/20 px-2 py-1.5">
                    <p className="text-white/60">Mes</p>
                    <p className="text-white/90">
                      Entrenos: {detail.timelines.month.workouts || 0} · Check-ins: {wellnessFiltered.length}
                    </p>
                    <p className="text-white/70">
                      Peso: {weightPts.length} · Emails enviados:{" "}
                      {engagementEventsFiltered.filter((e) => e.kind === "digest_email" && e.status === "sent").length}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}
            {weightPts.length > 1 ? (
              <div className="rounded-lg border border-border bg-surface-2 px-3 py-2">
                <p className="text-xs text-foreground mb-2">Evolución de peso</p>
                <div className="overflow-x-auto">
                  <svg width={chartWidth} height={chartHeight + 24} className="min-w-[520px]">
                    <line x1="0" y1={chartHeight} x2={chartWidth} y2={chartHeight} stroke="rgba(255,255,255,0.2)" />
                    <polyline fill="none" stroke="rgb(99,102,241)" strokeWidth="2.5" points={polyline} />
                  </svg>
                </div>
                <p className="text-[11px] text-white/60">
                  Inicio: {weightPts[0]?.weightKg} kg ({weightPts[0]?.ymd}) · Actual: {weightPts[weightPts.length - 1]?.weightKg} kg (
                  {weightPts[weightPts.length - 1]?.ymd})
                </p>
              </div>
            ) : null}
            {engagementEventsFiltered.length > 0 ? (
              <div className="rounded-lg border border-border bg-surface-2 px-3 py-2">
                <p className="text-xs text-foreground mb-2">Historial de solicitudes/completados</p>
                <div className="space-y-1.5 max-h-44 overflow-y-auto">
                  {engagementEventsFiltered.slice(0, 40).map((ev) => (
                    <div key={ev.id} className="rounded border border-white/10 bg-black/20 px-2 py-1 text-xs text-white/85">
                      <p>
                        {(ev.kind || "evento").replaceAll("_", " ")} · {ev.status || "N/A"} · {ev.source || "N/A"}
                      </p>
                      <p className="text-white/60">
                        {(ev.ymd || ev.createdAt || "s/f").toString()}
                        {typeof ev.weightKg === "number" ? ` · ${ev.weightKg} kg` : ""}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {Array.isArray(detail.profileEdits) && detail.profileEdits.length > 0 ? (
              <div className="rounded-lg border border-border bg-surface-2 px-3 py-2">
                <p className="text-xs text-foreground mb-2">Historial de cambios de datos (últimos)</p>
                <div className="space-y-2">
                  {detail.profileEdits.slice(0, 5).map((ev) => (
                    <div key={ev.id} className="rounded border border-white/10 bg-black/20 px-2 py-1.5 text-xs text-white/85">
                      <p>
                        {ev.actorType === "admin" ? "Admin" : "Cliente"} · {ev.createdAt ? new Date(ev.createdAt).toLocaleString("es-ES") : "s/f"}
                      </p>
                      <p className="text-white/60">
                        {[
                          ev.after?.nombreCompleto ? `Nombre: ${String(ev.after.nombreCompleto)}` : null,
                          ev.after?.email ? `Email: ${String(ev.after.email)}` : null,
                          ev.after?.whatsapp ? `WP: ${String(ev.after.whatsapp)}` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "Cambio registrado"}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="space-y-3">
              {keysToRender.length === 0 ? (
                <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70">
                  Este cliente no tiene datos de formulario disponibles.
                </div>
              ) : (
                keysToRender.map((key) => (
                  <div key={key} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                    <p className="text-xs text-white/60">
                      {INTAKE_DETAIL_LABELS[key] || key}
                    </p>
                    <p className="text-sm text-white whitespace-pre-wrap break-words mt-0.5">
                      {formatIntakeFieldValue(getFieldValue(key))}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}

function collectExerciseNamesFromIntakeTrainingPlan(tp: Record<string, unknown>): string[] {
  const weeks = tp.weeks;
  if (!Array.isArray(weeks)) return [];
  const set = new Set<string>();
  weeks.forEach((w: unknown) => {
    if (!w || typeof w !== "object") return;
    const days = Array.isArray((w as { days?: unknown }).days) ? (w as { days: unknown[] }).days : [];
    days.forEach((d: unknown) => {
      if (!d || typeof d !== "object") return;
      const ejercicios = Array.isArray((d as { ejercicios?: unknown }).ejercicios)
        ? (d as { ejercicios: unknown[] }).ejercicios
        : [];
      ejercicios.forEach((e: unknown) => {
        if (!e || typeof e !== "object") return;
        const row = e as Record<string, unknown>;
        const n =
          typeof row.name === "string"
            ? row.name.trim()
            : typeof row.nombre === "string"
              ? row.nombre.trim()
              : "";
        if (n.length >= 2) set.add(n);
      });
    });
  });
  return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
}

function IntakeGeneratedPlanModal({
  isOpen,
  onClose,
  client,
  loading,
  error,
  plan,
}: {
  isOpen: boolean;
  onClose: () => void;
  client: IntakeClient;
  loading: boolean;
  error: string | null;
  plan: IntakeGeneratedPlanDetail | null;
}) {
  const [copiedWhatsapp, setCopiedWhatsapp] = useState(false);
  const [showTechnicalJson, setShowTechnicalJson] = useState(false);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<"pdf" | "word" | "excel" | null>(null);
  const [exerciseMediaRows, setExerciseMediaRows] = useState<Array<{ name: string; video: string; poster: string }>>([]);
  const [savingExerciseMedia, setSavingExerciseMedia] = useState(false);
  const [exerciseMediaMessage, setExerciseMediaMessage] = useState<string | null>(null);
  /** Tras guardar, sustituye la vista previa de overrides; null = usar solo el plan cargado. */
  const [savedMediaOverrides, setSavedMediaOverrides] = useState<Record<
    string,
    { demo_video_url?: string; demo_poster_url?: string }
  > | null>(null);

  useEffect(() => {
    if (!isOpen || !plan?.plan) {
      setExerciseMediaRows([]);
      setSavedMediaOverrides(null);
      return;
    }
    const root = plan.plan as Record<string, unknown>;
    const tp = root.training_plan;
    if (!tp || typeof tp !== "object") {
      setExerciseMediaRows([]);
      setSavedMediaOverrides(null);
      return;
    }
    setSavedMediaOverrides(null);
    const tpObj = tp as Record<string, unknown>;
    const names = collectExerciseNamesFromIntakeTrainingPlan(tpObj);
    const ov =
      tpObj.exercise_media_overrides && typeof tpObj.exercise_media_overrides === "object" && !Array.isArray(tpObj.exercise_media_overrides)
        ? (tpObj.exercise_media_overrides as Record<string, { demo_video_url?: string; demo_poster_url?: string }>)
        : {};
    setExerciseMediaRows(
      names.map((name) => {
        const k = normalizeExerciseMediaKey(name);
        return {
          name,
          video: ov[k]?.demo_video_url?.trim() || "",
          poster: ov[k]?.demo_poster_url?.trim() || "",
        };
      })
    );
    setExerciseMediaMessage(null);
  }, [isOpen, plan?.id, plan?.plan]);

  if (!isOpen) return null;
  const nutritionDays = Array.isArray(plan?.plan?.plan_semanal) ? plan?.plan?.plan_semanal.length : 0;
  const trainingWeeks = Array.isArray(plan?.plan?.training_plan && (plan.plan.training_plan as { weeks?: unknown[] }).weeks)
    ? ((plan?.plan?.training_plan as { weeks?: unknown[] }).weeks || []).length
    : 0;
  const macros =
    plan?.plan?.macros && typeof plan.plan.macros === "object"
      ? (plan.plan.macros as Record<string, unknown>)
      : null;
  const weeklyPlan = Array.isArray(plan?.plan?.plan_semanal) ? (plan?.plan?.plan_semanal as Array<Record<string, unknown>>) : [];
  const trainingPlan =
    plan?.plan?.training_plan && typeof plan.plan.training_plan === "object"
      ? (plan.plan.training_plan as Record<string, unknown>)
      : null;
  const cardioPlan =
    plan?.plan?.cardio_recomendado && typeof plan.plan.cardio_recomendado === "object"
      ? (plan.plan.cardio_recomendado as Record<string, unknown>)
      : null;
  const suplementacionPlan = Array.isArray(plan?.plan?.suplementacion_recomendada)
    ? (plan?.plan?.suplementacion_recomendada as Array<Record<string, unknown>>)
    : [];
  const firstWeekDays =
    trainingPlan &&
    Array.isArray((trainingPlan.weeks as Array<Record<string, unknown>> | undefined)) &&
    (trainingPlan.weeks as Array<Record<string, unknown>>)[0] &&
    Array.isArray((trainingPlan.weeks as Array<Record<string, unknown>>)[0].days)
      ? (((trainingPlan.weeks as Array<Record<string, unknown>>)[0].days as Array<Record<string, unknown>>) || [])
      : [];

  type ExerciseMediaOv = Record<string, { demo_video_url?: string; demo_poster_url?: string }>;
  const baseExerciseMediaOv: ExerciseMediaOv =
    trainingPlan &&
    typeof trainingPlan.exercise_media_overrides === "object" &&
    !Array.isArray(trainingPlan.exercise_media_overrides)
      ? (trainingPlan.exercise_media_overrides as ExerciseMediaOv)
      : {};
  const planMediaOverridesMerged: ExerciseMediaOv =
    savedMediaOverrides !== null ? savedMediaOverrides : baseExerciseMediaOv;

  const handleSaveExerciseMedia = async () => {
    const auth = getAuthSafe();
    if (!auth?.currentUser || !plan?.id) {
      setExerciseMediaMessage("No hay sesión o plan.");
      return;
    }
    setSavingExerciseMedia(true);
    setExerciseMediaMessage(null);
    try {
      const exercise_media_overrides: ExerciseMediaOv = { ...baseExerciseMediaOv };
      for (const row of exerciseMediaRows) {
        const v = row.video.trim();
        const p = row.poster.trim();
        const k = normalizeExerciseMediaKey(row.name);
        if (!v && !p) {
          delete exercise_media_overrides[k];
          continue;
        }
        exercise_media_overrides[k] = {
          ...(v ? { demo_video_url: v } : {}),
          ...(p ? { demo_poster_url: p } : {}),
        };
      }
      const response = await adminFetch("/api/admin/patchIntakePlanExerciseMedia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: auth.currentUser.uid,
          planId: plan.id,
          exercise_media_overrides,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || data.detail || `HTTP ${response.status}`);
      const nextPreview: ExerciseMediaOv = {};
      for (const row of exerciseMediaRows) {
        const v = row.video.trim();
        const p = row.poster.trim();
        if (!v && !p) continue;
        nextPreview[normalizeExerciseMediaKey(row.name)] = {
          ...(v ? { demo_video_url: v } : {}),
          ...(p ? { demo_poster_url: p } : {}),
        };
      }
      setSavedMediaOverrides(nextPreview);
      setExerciseMediaMessage("Guardado. Los vídeos se muestran en la vista previa y en el plan del cliente.");
    } catch (e) {
      setExerciseMediaMessage(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSavingExerciseMedia(false);
    }
  };

  const buildWhatsappSummary = () => {
    if (!plan?.plan) return "";
    const lines: string[] = [];
    lines.push("Hola! Te comparto tu plan actualizado de Lucas Riera.");
    lines.push("");
    const kcalTarget = typeof plan.plan.calorias_diarias === "number" ? `${plan.plan.calorias_diarias} kcal` : "N/A";
    const kcalMaint =
      typeof (plan.plan as Record<string, unknown>).calorias_mantenimiento === "number"
        ? `${String((plan.plan as Record<string, unknown>).calorias_mantenimiento)} kcal`
        : null;
    const kcal = kcalMaint ? `${kcalTarget} / ${kcalMaint} (mant.)` : kcalTarget;
    lines.push(`Objetivo calórico diario: ${kcal}`);
    if (macros) {
      lines.push(
          `Macros: Proteínas ${String(macros.proteinas || "-")} | Grasas ${String(macros.grasas || "-")} | Carbohidratos ${String(
          macros.carbohidratos || "-"
        )}`
      );
    }
    if (weeklyPlan.length > 0) {
      lines.push("");
      lines.push("Ejemplo Día 1:");
      const firstDay = weeklyPlan[0];
      const dayName = String(firstDay?.dia || "Día");
      lines.push(dayName);
      const meals = Array.isArray(firstDay?.comidas) ? (firstDay.comidas as Array<Record<string, unknown>>) : [];
      meals.slice(0, 5).forEach((meal) => {
        const mealName = String(meal.nombre || "Comida");
        const mealMacros =
          meal.macros_aprox && typeof meal.macros_aprox === "object"
            ? (meal.macros_aprox as Record<string, unknown>)
            : null;
        const mealOption = Array.isArray(meal.opciones) ? String((meal.opciones as unknown[])[0] || "") : "";
        lines.push(
          `- ${mealName}: ${mealOption || "opción personalizada"}${
            mealMacros
              ? ` (Proteínas ${String(mealMacros.proteinas_g || "-")}g / Grasas ${String(mealMacros.grasas_g || "-")}g / Carbohidratos ${String(
                  mealMacros.carbohidratos_g || "-"
                )}g)`
              : ""
          }`
        );
      });
    }
    lines.push("");
    lines.push("Cualquier ajuste, lo vamos corrigiendo semana a semana.");
    return lines.join("\n");
  };

  const downloadBlob = (content: BlobPart, mimeType: string, fileName: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const sanitizeFileName = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9-_]+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "")
      .toLowerCase();

  const buildPlanTextLines = () => {
    const lines: string[] = [];
    lines.push(`Plan de ${client.nombreCompleto || client.email || client.id}`);
    lines.push("");
    lines.push(
      `Calorías diarias: ${
        typeof plan?.plan?.calorias_diarias === "number"
          ? `${plan.plan.calorias_diarias} kcal${
              typeof (plan?.plan as Record<string, unknown>)?.calorias_mantenimiento === "number"
                ? ` / ${(plan?.plan as Record<string, unknown>).calorias_mantenimiento} kcal (mant.)`
                : ""
            }`
          : "N/A"
      }`
    );
    lines.push(
      `Macros: Proteínas ${String(macros?.proteinas || "-")} | Grasas ${String(macros?.grasas || "-")} | Carbohidratos ${String(
        macros?.carbohidratos || "-"
      )}`
    );
    if (cardioPlan) {
      lines.push("");
      lines.push("Cardio recomendado:");
      lines.push(`- Pasos diarios: ${String(cardioPlan.objetivo_pasos_diarios || "N/A")}`);
      lines.push(`- Sesiones: ${String(cardioPlan.sesiones_por_semana || "N/A")}`);
      lines.push(`- Detalle: ${String(cardioPlan.detalle || "N/A")}`);
    }
    const ajusteObjetivoMsg = String(plan?.plan?.mensaje_ajuste_objetivo || "");
    if (ajusteObjetivoMsg) {
      lines.push("");
      lines.push("Mensaje importante para el cliente:");
      lines.push(ajusteObjetivoMsg);
    }
    if (weeklyPlan.length > 0) {
      lines.push("");
      lines.push("Plan de alimentación:");
      weeklyPlan.forEach((day) => {
        const dayName = String(day.dia || "Día");
        lines.push(`- ${dayName}`);
        const meals = Array.isArray(day.comidas) ? (day.comidas as Array<Record<string, unknown>>) : [];
        meals.forEach((meal) => {
          const mealName = String(meal.nombre || "Comida");
          const mealTime = String(meal.hora || "--:--");
          const mealMacros =
            meal.macros_aprox && typeof meal.macros_aprox === "object"
              ? (meal.macros_aprox as Record<string, unknown>)
              : null;
          const mealOption = Array.isArray(meal.opciones) ? String((meal.opciones as unknown[])[0] || "") : "Opción personalizada";
          lines.push(
            `  • ${mealTime} ${mealName}: ${mealOption} (Proteínas ${String(mealMacros?.proteinas_g ?? "-")}g / Grasas ${String(
              mealMacros?.grasas_g ?? "-"
            )}g / Carbohidratos ${String(mealMacros?.carbohidratos_g ?? "-")}g)`
          );
        });
      });
    }
    if (firstWeekDays.length > 0) {
      lines.push("");
      lines.push("Entrenamiento (semana 1):");
      const wr = trainingPlan?.week_order_rationale;
      if (wr) {
        lines.push(`Orden y criterio: ${String(wr)}`);
        lines.push("");
      }
      firstWeekDays.forEach((day) => {
        const dayName = String(day.day || "Día");
        const split = String(day.split || "Entrenamiento");
        lines.push(`- ${dayName} (${split})`);
        const exercises = Array.isArray(day.ejercicios) ? (day.ejercicios as Array<Record<string, unknown>>) : [];
        exercises.forEach((exercise) => {
          lines.push(
            `  • ${String(exercise.name || "Ejercicio")} | ${String(exercise.sets || "-")} series | ${String(
              exercise.reps || "-"
            )} reps | Músculo: ${String(exercise.muscle_group || "N/A")}`
          );
        });
      });
    }
    if (suplementacionPlan.length > 0) {
      lines.push("");
      lines.push("Suplementación sugerida:");
      suplementacionPlan.forEach((supp) => {
        lines.push(
          `- ${String(supp.nombre || "Suplemento")}: ${String(supp.dosis || "N/A")} | ${String(supp.momento || "N/A")} | ${String(
            supp.motivo || "N/A"
          )}`
        );
      });
    }
    return lines;
  };

  const exportPlanAsPdf = () => {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const lines = buildPlanTextLines();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 40;
    const lineHeight = 16;
    let y = margin;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    lines.forEach((line) => {
      const wrapped = doc.splitTextToSize(line, pageWidth - margin * 2);
      wrapped.forEach((segment: string) => {
        if (y > pageHeight - margin) {
          doc.addPage();
          y = margin;
        }
        doc.text(segment, margin, y);
        y += lineHeight;
      });
    });
    const baseName = sanitizeFileName(client.nombreCompleto || client.email || "cliente");
    doc.save(`plan-lucas-riera-${baseName}.pdf`);
  };

  const exportPlanAsWord = () => {
    const title = client.nombreCompleto || client.email || "Cliente";
    const lines = buildPlanTextLines().map((line) => line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"));
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8" /><title>Plan Lucas Riera</title></head><body style="font-family:Arial,sans-serif;padding:24px;"><h1 style="color:#0f172a;">Plan Lucas Riera - ${title}</h1>${lines
      .map((line) => `<p style="margin:0 0 8px 0;">${line || "&nbsp;"}</p>`)
      .join("")}</body></html>`;
    const baseName = sanitizeFileName(client.nombreCompleto || client.email || "cliente");
    downloadBlob(html, "application/msword;charset=utf-8", `plan-lucas-riera-${baseName}.doc`);
  };

  const exportPlanAsExcel = async () => {
    if (!plan?.plan || typeof plan.plan !== "object") return;
    const auth = getAuthSafe();
    if (!auth?.currentUser) {
      alert("Inicia sesión como administrador para exportar el Excel.");
      return;
    }
    const root = { ...(plan.plan as Record<string, unknown>) };
    const tpRaw = root.training_plan;
    if (tpRaw && typeof tpRaw === "object" && !Array.isArray(tpRaw)) {
      const liveMedia: Record<string, { demo_video_url?: string; demo_poster_url?: string }> = {
        ...planMediaOverridesMerged,
      };
      for (const row of exerciseMediaRows) {
        const v = row.video.trim();
        const p = row.poster.trim();
        const k = normalizeExerciseMediaKey(row.name);
        if (!v && !p) {
          delete liveMedia[k];
          continue;
        }
        liveMedia[k] = {
          ...liveMedia[k],
          ...(v ? { demo_video_url: v } : {}),
          ...(p ? { demo_poster_url: p } : {}),
        };
      }
      root.training_plan = {
        ...(tpRaw as Record<string, unknown>),
        exercise_media_overrides: liveMedia,
      };
    }
    const baseName = sanitizeFileName(client.nombreCompleto || client.email || "cliente");
    const response = await adminFetch("/api/admin/exportIntakePlanExcel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: auth.currentUser.uid,
        clientLabel: client.nombreCompleto || client.email || client.id,
        plan: root,
      }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(typeof data.error === "string" ? data.error : `HTTP ${response.status}`);
    }
    const blob = await response.blob();
    downloadBlob(
      blob,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      `plan-lucas-riera-${baseName}.xlsx`
    );
  };

  const handleExportPlan = async (format: "pdf" | "word" | "excel") => {
    try {
      setExportingFormat(format);
      if (format === "pdf") exportPlanAsPdf();
      if (format === "word") exportPlanAsWord();
      if (format === "excel") await exportPlanAsExcel();
      setShowDownloadMenu(false);
    } catch {
      alert("No se pudo descargar el plan en el formato seleccionado.");
    } finally {
      setExportingFormat(null);
    }
  };

  const handleCopyWhatsapp = async () => {
    try {
      const text = buildWhatsappSummary();
      if (!text) return;
      await navigator.clipboard.writeText(text);
      setCopiedWhatsapp(true);
      setTimeout(() => setCopiedWhatsapp(false), 2000);
    } catch {
      alert("No se pudo copiar el texto para WhatsApp.");
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 14 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-surface rounded-xl border border-white/10 p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <h3 className="text-xl font-bold text-white">Plan generado</h3>
            <p className="text-sm text-white/70 mt-1">{client.nombreCompleto || client.email || client.id}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <div className="relative">
              <button
                onClick={() => setShowDownloadMenu((prev) => !prev)}
                disabled={!plan}
                className="px-3 py-1.5 rounded-lg bg-info/20 border border-info/40 text-info hover:bg-info/30 transition-colors disabled:opacity-50 inline-flex items-center gap-2"
              >
                <FaDownload />
                Descargar plan
              </button>
              {showDownloadMenu && (
                <div className="absolute right-0 mt-2 w-56 rounded-xl border border-white/15 bg-surface p-2 shadow-2xl z-20">
                  <button
                    onClick={() => handleExportPlan("pdf")}
                    disabled={exportingFormat !== null}
                    className="w-full text-left px-3 py-2 rounded-lg text-white/90 hover:bg-white/10 transition-colors inline-flex items-center gap-2"
                  >
                    <FaFilePdf className="text-danger" />
                    Descargar en PDF
                  </button>
                  <button
                    onClick={() => handleExportPlan("word")}
                    disabled={exportingFormat !== null}
                    className="w-full text-left px-3 py-2 rounded-lg text-white/90 hover:bg-white/10 transition-colors inline-flex items-center gap-2"
                  >
                    <FaFileWord className="text-info" />
                    Descargar en Word
                  </button>
                  <button
                    onClick={() => handleExportPlan("excel")}
                    disabled={exportingFormat !== null}
                    className="w-full text-left px-3 py-2 rounded-lg text-white/90 hover:bg-white/10 transition-colors inline-flex items-center gap-2"
                  >
                    <FaFileExcel className="text-success" />
                    Excel con ilustraciones (.xlsx)
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={handleCopyWhatsapp}
              disabled={!plan}
              className="px-3 py-1.5 rounded-lg bg-success/20 border border-success/40 text-success hover:bg-success/30 transition-colors disabled:opacity-50"
            >
              {copiedWhatsapp ? "Copiado" : "Copiar WhatsApp"}
            </button>
            <button onClick={onClose} className="text-white/60 hover:text-white">✕</button>
          </div>
        </div>

        {loading ? (
          <div className="py-10 flex justify-center">
            <div className="h-8 w-8 rounded-full border-b-2 border-info animate-spin" />
          </div>
        ) : error ? (
          <div className="p-3 rounded-lg bg-danger/20 border border-danger/30 text-danger text-sm">{error}</div>
        ) : !plan ? (
          <div className="p-3 rounded-lg bg-white/5 border border-white/10 text-white/70 text-sm">
            No hay datos de plan disponibles.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-lg border border-border bg-surface-2 px-3 py-2">
                <p className="text-xs text-muted">Datos de la persona</p>
                <p className="text-sm text-foreground">
                  Edad: {String((plan?.input as Record<string, unknown> | null)?.edad || "N/A")} · Altura:{" "}
                  {String((plan?.input as Record<string, unknown> | null)?.alturaCm || "N/A")} cm · Peso actual:{" "}
                  {String((plan?.input as Record<string, unknown> | null)?.pesoKg || "N/A")} kg
                </p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                <p className="text-xs text-white/60">Tipo de acción</p>
                <p className="text-sm text-white">{plan.actionType || "N/A"}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-lg border border-success/20 bg-success/10 px-3 py-2">
                <p className="text-xs text-success/80">Calorías objetivo</p>
                <p className="text-base font-semibold text-success">
                  {typeof plan?.plan?.calorias_diarias === "number"
                    ? `${plan.plan.calorias_diarias} kcal${
                        typeof (plan?.plan as Record<string, unknown>)?.calorias_mantenimiento === "number"
                          ? ` / ${(plan?.plan as Record<string, unknown>).calorias_mantenimiento} kcal mant.`
                          : ""
                      }`
                    : "N/A"}
                </p>
              </div>
              <div className="rounded-lg border border-info/20 bg-info/10 px-3 py-2">
                <p className="text-xs text-info/80">Macros</p>
                <p className="text-sm text-info">
                  {macros
                    ? `Proteínas ${String(macros.proteinas || "-")} · Grasas ${String(macros.grasas || "-")} · Carbohidratos ${String(macros.carbohidratos || "-")}`
                    : "N/A"}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-surface-2 px-3 py-2">
                <p className="text-xs text-muted">Split entrenamiento</p>
                <p className="text-sm text-foreground">{String(trainingPlan?.split || "N/A")}</p>
              </div>
            </div>
            {trainingPlan?.week_order_rationale ? (
              <div className="rounded-lg border border-border bg-surface-2 px-3 py-2">
                <p className="text-xs text-muted">Por qué este orden de días y ejercicios</p>
                <p className="text-sm text-foreground whitespace-pre-wrap">{String(trainingPlan.week_order_rationale)}</p>
              </div>
            ) : null}
            {Boolean(plan?.plan?.evaluacion_inicial) && typeof plan?.plan?.evaluacion_inicial === "object" && (
              <div className="rounded-lg border border-border bg-surface-2 px-3 py-2">
                <p className="text-xs text-muted">Evaluación inicial</p>
                <p className="text-sm text-foreground">
                  IMC: {String((plan.plan.evaluacion_inicial as Record<string, unknown>).imc || "N/A")} · Estado:{" "}
                  {String((plan.plan.evaluacion_inicial as Record<string, unknown>).estado || "N/A")}
                </p>
                {Boolean((plan.plan.evaluacion_inicial as Record<string, unknown>).decisionClinica) && (
                  <p className="text-xs text-muted mt-1">
                    {String((plan.plan.evaluacion_inicial as Record<string, unknown>).decisionClinica)}
                  </p>
                )}
              </div>
            )}
            {Boolean(plan?.plan?.mensaje_ajuste_objetivo) && (
              <div className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2">
                <p className="text-xs text-warning/80">Mensaje para el cliente</p>
                <p className="text-sm text-warning mt-1">{String(plan?.plan?.mensaje_ajuste_objetivo)}</p>
              </div>
            )}
            {cardioPlan && (
              <div className="rounded-lg border border-border bg-surface-2 px-3 py-2">
                <p className="text-xs text-muted">Cardio recomendado (caminar/correr)</p>
                <p className="text-sm text-foreground">
                  Pasos diarios: {String(cardioPlan.objetivo_pasos_diarios || "N/A")} · Sesiones:{" "}
                  {String(cardioPlan.sesiones_por_semana || "N/A")}
                </p>
                <p className="text-xs text-muted mt-1">{String(cardioPlan.detalle || "")}</p>
              </div>
            )}
            {suplementacionPlan.length > 0 && (
              <div className="rounded-lg border border-warning/20 bg-warning/10 px-3 py-2">
                <p className="text-xs text-warning/80 mb-2">Suplementación sugerida</p>
                <div className="space-y-2">
                  {suplementacionPlan.map((supp, idx) => (
                    <div key={`supp-${idx}`} className="rounded-md border border-white/10 bg-black/20 px-3 py-2">
                      <p className="text-sm font-medium text-warning">{String(supp.nombre || "Suplemento")}</p>
                      <p className="text-xs text-white/80 mt-1">
                        Dosis: {String(supp.dosis || "N/A")} · Momento: {String(supp.momento || "N/A")}
                      </p>
                      <p className="text-xs text-white/70 mt-1">Motivo: {String(supp.motivo || "N/A")}</p>
                      {Boolean(supp.nota) && <p className="text-xs text-warning/90 mt-1">Nota: {String(supp.nota)}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {plan.includeNutrition && weeklyPlan.length > 0 && (
              <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                <p className="text-xs text-white/60 mb-2">Plan de alimentación semanal (formato cliente)</p>
                <div className="space-y-3">
                  {weeklyPlan.map((day, dayIndex) => {
                    const dayName = String(day.dia || `Día ${dayIndex + 1}`);
                    const meals = Array.isArray(day.comidas) ? (day.comidas as Array<Record<string, unknown>>) : [];
                    return (
                      <div key={`${dayName}-${dayIndex}`} className="rounded-md border border-white/10 bg-black/20 px-3 py-3">
                        <p className="text-sm font-semibold text-info">{dayName}</p>
                        <div className="mt-2 space-y-2">
                          {meals.map((meal, mealIndex) => {
                            const mealName = String(meal.nombre || `Comida ${mealIndex + 1}`);
                            const mealTime = String(meal.hora || "--:--");
                            const mealMacros =
                              meal.macros_aprox && typeof meal.macros_aprox === "object"
                                ? (meal.macros_aprox as Record<string, unknown>)
                                : null;
                            const mealOption = Array.isArray(meal.opciones)
                              ? String((meal.opciones as unknown[])[0] || "")
                              : "";
                            const mealPortions =
                              meal.porciones_aprox && typeof meal.porciones_aprox === "object"
                                ? (meal.porciones_aprox as Record<string, unknown>)
                                : null;
                            const mealOptionSpecific = Array.isArray(meal.porciones_opcion_aprox)
                              ? (meal.porciones_opcion_aprox as unknown[]).filter((x): x is string => typeof x === "string")
                              : [];
                            const mealPortionGuide = Array.isArray(mealPortions?.guia)
                              ? (mealPortions?.guia as unknown[]).filter((x): x is string => typeof x === "string")
                              : [];
                            return (
                              <div key={`${dayName}-${mealName}-${mealIndex}`} className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-2">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-sm text-white font-medium">{mealName}</p>
                                  <p className="text-xs text-white/60">{mealTime}</p>
                                </div>
                                <p className="text-xs text-white/80 mt-1">{mealOption || "Opción personalizada"}</p>
                                <p className="text-xs text-success mt-1">
                                  Proteínas {String(mealMacros?.proteinas_g ?? "-")}g · Grasas {String(mealMacros?.grasas_g ?? "-")}g · Carbohidratos{" "}
                                  {String(mealMacros?.carbohidratos_g ?? "-")}g
                                </p>
                                {mealPortionGuide.length > 0 ? (
                                  <p className="text-[11px] text-info/90 mt-1">
                                    Porciones aprox: {mealPortionGuide.slice(0, 3).join(" · ")}
                                  </p>
                                ) : null}
                                {mealOptionSpecific.length > 0 ? (
                                  <p className="text-[11px] text-foreground mt-1">
                                    Según esta opción: {mealOptionSpecific.join(" · ")}
                                  </p>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {plan.includeTraining && firstWeekDays.length > 0 && (
              <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                <p className="text-xs text-white/60 mb-2">Plan de entrenamiento (semana 1)</p>
                <div className="space-y-3">
                  {firstWeekDays.map((day, dayIndex) => {
                    const dayName = String(day.day || "Día");
                    const split = String(day.split || "Entrenamiento");
                    const exercises = Array.isArray(day.ejercicios) ? (day.ejercicios as Array<Record<string, unknown>>) : [];
                    return (
                      <div key={`${dayName}-${split}-${dayIndex}`} className="rounded-md border border-white/10 bg-black/20 px-3 py-3">
                        <p className="text-sm font-semibold text-foreground">{dayName}</p>
                        <p className="text-xs text-white/70 mt-1">{split} · {exercises.length} ejercicios</p>
                        <div className="mt-2 space-y-3">
                          {exercises.slice(0, 6).map((exercise, exIndex) => {
                            const exName = String(exercise.name || "Ejercicio");
                            return (
                              <div
                                key={`${dayName}-ex-${exIndex}`}
                                className="text-xs text-white/85 border-b border-white/5 pb-2 last:border-0 last:pb-0"
                              >
                                <p>
                                  {exIndex + 1}. {exName} · {String(exercise.sets || "-")} series ·{" "}
                                  {String(exercise.reps || "-")} reps
                                </p>
                                {exName.length >= 2 ? (
                                  <ExerciseDemoMedia
                                    exerciseName={exName}
                                    demoVideoUrl={typeof exercise.demo_video_url === "string" ? exercise.demo_video_url : null}
                                    demoPosterUrl={typeof exercise.demo_poster_url === "string" ? exercise.demo_poster_url : null}
                                    planMediaOverrides={planMediaOverridesMerged}
                                  />
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {plan.includeTraining && exerciseMediaRows.length > 0 && (
              <div className="rounded-lg border border-success/25 bg-success/[0.07] px-3 py-3 space-y-3">
                <div>
                  <p className="text-sm font-semibold text-success">Vídeos propios del coach</p>
                  <p className="text-[11px] text-white/55 mt-1 leading-relaxed">
                    URL HTTPS a .mp4/.webm/.mov, URL de Cloudinary (<code className="text-success/90">res.cloudinary.com/.../video/upload/...</code>) o{" "}
                    <strong className="text-white/75">public ID</strong> de Cloudinary (ej. <code className="text-success/90">carpeta/ejercicio</code>) con{" "}
                    <code className="text-success/90">NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME</code> en el proyecto. Sin YouTube. Póster: imagen HTTPS o Cloudinary.
                  </p>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {exerciseMediaRows.map((row) => (
                    <div key={row.name} className="rounded-md border border-white/10 bg-black/20 p-2 space-y-1.5">
                      <p className="text-xs font-medium text-white/90">{row.name}</p>
                      <input
                        type="text"
                        value={row.video}
                        onChange={(e) => {
                          const v = e.target.value;
                          setExerciseMediaRows((prev) =>
                            prev.map((r) => (r.name === row.name ? { ...r, video: v } : r))
                          );
                        }}
                        placeholder="https://…/ejercicio.mp4 o public ID Cloudinary"
                        className="w-full rounded bg-white/5 border border-white/10 px-2 py-1.5 text-[11px] text-white placeholder:text-white/30"
                      />
                      <input
                        type="text"
                        value={row.poster}
                        onChange={(e) => {
                          const v = e.target.value;
                          setExerciseMediaRows((prev) =>
                            prev.map((r) => (r.name === row.name ? { ...r, poster: v } : r))
                          );
                        }}
                        placeholder="Póster opcional: https://…/poster.jpg"
                        className="w-full rounded bg-white/5 border border-white/10 px-2 py-1.5 text-[11px] text-white placeholder:text-white/30"
                      />
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={savingExerciseMedia}
                    onClick={() => void handleSaveExerciseMedia()}
                    className="px-3 py-1.5 rounded-lg bg-success hover:bg-success text-white text-sm font-medium disabled:opacity-50"
                  >
                    {savingExerciseMedia ? "Guardando…" : "Guardar vídeos en el plan"}
                  </button>
                  {exerciseMediaMessage ? (
                    <span className="text-xs text-white/70">{exerciseMediaMessage}</span>
                  ) : null}
                </div>
              </div>
            )}

            <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
              <p className="text-xs text-white/60 mb-1">Contexto usado para generar</p>
              <p className="text-sm text-white/85">
                {plan.input
                  ? `Objetivo: ${String(plan.input.objetivo || "N/A")} · Peso: ${String(plan.input.pesoKg || "N/A")} kg · Días gym: ${String(plan.input.diasGym || "N/A")} · Días cardio: ${String(plan.input.diasCardio || "N/A")}`
                  : "N/A"}
              </p>
            </div>
            <details className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
              <summary
                className="text-xs text-white/60 cursor-pointer"
                onClick={() => setShowTechnicalJson((prev) => !prev)}
              >
                {showTechnicalJson ? "Ocultar detalle técnico (JSON)" : "Ver detalle técnico (JSON)"}
              </summary>
              {showTechnicalJson && (
                <p className="text-sm text-white whitespace-pre-wrap break-words mt-2">
                  {plan.plan ? JSON.stringify(plan.plan, null, 2) : "N/A"}
                </p>
              )}
            </details>
          </div>
        )}
      </motion.div>
    </div>
  );
}

// Componente Modal para que el admin envíe mensajes a usuarios
function AdminSendMessageModal({
  isOpen,
  onClose,
  targetUser,
  adminUserId
}: {
  isOpen: boolean;
  onClose: () => void;
  targetUser: User;
  adminUserId: string;
}) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) {
      setError("El mensaje no puede estar vacío");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await adminFetch("/api/admin/sendMessage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminUserId,
          targetUserId: targetUser.id,
          subject: subject.trim() || "Mensaje del equipo",
          message: message.trim(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Error al enviar mensaje");
      }

      setSuccess(true);
      setSubject("");
      setMessage("");
      
      // Cerrar modal después de 1.5 segundos
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al enviar mensaje");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="bg-surface rounded-xl border border-white/10 p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <FaComment className="text-success" />
            Enviar mensaje a {targetUser.nombre || targetUser.email}
          </h2>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">
              Asunto (opcional)
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Mensaje del equipo"
              className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-success/50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">
              Mensaje *
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Escribe tu mensaje aquí..."
              rows={6}
              required
              className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-success/50 resize-none"
            />
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-danger/20 border border-danger/30 text-danger text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="p-3 rounded-lg bg-success/20 border border-success/30 text-success text-sm">
              ✓ Mensaje enviado exitosamente
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !message.trim()}
              className="flex-1 px-4 py-2 rounded-lg bg-success/20 hover:bg-success/30 border border-success/30 text-success transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Enviando..." : "Enviar mensaje"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}


