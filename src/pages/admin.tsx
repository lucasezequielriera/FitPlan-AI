import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import { jsPDF } from "jspdf";
import { useAuthStore } from "@/store/authStore";
import { getDbSafe, getAuthSafe } from "@/lib/firebase";
import Navbar from "@/components/Navbar";
import WeeklyStatsModal from "@/components/WeeklyStatsModal";
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

export default function Admin() {
  const router = useRouter();
  const { user: authUser, loading: authLoading } = useAuthStore();
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
  const [intakeUpdateMainNeed, setIntakeUpdateMainNeed] = useState("");
  const [intakeUpdateNutritionFeedback, setIntakeUpdateNutritionFeedback] = useState("");
  const [intakeUpdateTrainingFeedback, setIntakeUpdateTrainingFeedback] = useState("");
  const [intakeUpdateCurrentWeight, setIntakeUpdateCurrentWeight] = useState("");
  const [intakeUpdateEnergyLevel, setIntakeUpdateEnergyLevel] = useState<"baja" | "media" | "alta">("media");
  const [processingIntakeAction, setProcessingIntakeAction] = useState(false);
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
  const [paymentNotificationOpen, setPaymentNotificationOpen] = useState(false);
  const [paymentNotificationUnread, setPaymentNotificationUnread] = useState(0);
  const [paymentNotificationItems, setPaymentNotificationItems] = useState<
    Array<{ id: string; userName?: string; userEmail?: string; amount?: number; currency?: string; provider?: string; createdAt?: unknown }>
  >([]);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [selectedUserForHistory, setSelectedUserForHistory] = useState<User | null>(null);
  const [userHistory, setUserHistory] = useState<{
    user: unknown;
    plans: unknown[];
    history: unknown[];
    weightRecords?: Array<{ fecha: string; peso: number; planId: string; planCreatedAt?: string }>;
  } | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [adminMeta, setAdminMeta] = useState<{ lastUsersCheck?: string | null }>({});
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
        icon: <FaCheck className="text-gray-400" />,
        color: "text-gray-400"
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
        icon: <FaArrowDown className="text-blue-400" />,
        color: "text-blue-400",
        weightDifference: diferencia
      };
    } else if (imc >= 18.5 && imc < 25) {
      return {
        status: "saludable",
        icon: <FaCheck className="text-green-400" />,
        color: "text-green-400"
      };
    } else {
      // Si está excedido, comparar con el límite superior
      const diferencia = peso - pesoMaximo;
      return {
        status: "excedido",
        icon: <FaArrowUp className="text-red-400" />,
        color: "text-red-400",
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
      
      const response = await fetch(`/api/admin/monthlyEarnings?monthId=${monthId}&adminUserId=${authUser.uid}`);
      if (!response.ok) {
        console.warn("No se pudieron obtener las ganancias mensuales");
        return 0;
      }
      const data = await response.json();
      return data.totalEarnings || 0;
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

  const fetchPaymentNotifications = async () => {
    try {
      const auth = getAuthSafe();
      if (!auth?.currentUser) return;
      const response = await fetch(`/api/admin/paymentNotifications?adminUserId=${auth.currentUser.uid}`);
      if (!response.ok) return;
      const data = await response.json();
      setPaymentNotificationUnread(typeof data.unreadCount === "number" ? data.unreadCount : 0);
      setPaymentNotificationItems(Array.isArray(data.items) ? data.items : []);
    } catch {
      // noop
    }
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

  // Actualización automática de usuarios - usando polling cada 5 minutos (reducido para evitar cuota)
  useEffect(() => {
    if (!isAdmin || !authUser) return;

    // Actualización automática silenciosa cada 5 minutos (sin mostrar loading)
    // Intervalo aumentado para reducir el consumo de cuota de Firestore
    const pollInterval = setInterval(async () => {
      try {
        await loadUserStats(adminMeta.lastUsersCheck ?? null, true); // silent = true para no mostrar loading
      } catch (error) {
        // Silenciar errores en polling, pero loguear si es de cuota
        if (error instanceof Error && error.message.includes('RESOURCE_EXHAUSTED')) {
          console.warn('⚠️ Cuota de Firestore excedida, pausando polling temporalmente');
          // No hacer nada, el intervalo seguirá corriendo pero fallará silenciosamente
        }
      }
    }, 300000); // Actualizar cada 5 minutos (300000ms) para reducir consumo de cuota

    return () => {
      clearInterval(pollInterval);
    };
    // loadUserStats se maneja manualmente para evitar bucles
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, authUser, adminMeta.lastUsersCheck]);

  useEffect(() => {
    if (!isAdmin || !authUser) return;
    fetchPaymentNotifications();
    const interval = setInterval(() => {
      fetchPaymentNotifications();
    }, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, authUser]);


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
      const response = await fetch(`/api/admin/stats?userId=${auth.currentUser.uid}`);
      
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
              const expireResponse = await fetch("/api/admin/expirePremium", {
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
    }
  };

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
      const response = await fetch(`/api/admin/intakeClients?userId=${auth.currentUser.uid}`);
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

      const response = await fetch(
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
      const response = await fetch("/api/admin/createIntakeClientPaymentLink", {
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
      const response = await fetch("/api/admin/createUserPaymentLink", {
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
      alert("Link de pago generado. Lo copié al portapapeles y abrí el envío.");
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
      const response = await fetch("/api/admin/deleteIntakeClient", {
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
    setIntakeUpdateMainNeed("");
    setIntakeUpdateNutritionFeedback("");
    setIntakeUpdateTrainingFeedback("");
    setIntakeUpdateCurrentWeight("");
    setIntakeUpdateEnergyLevel("media");
    setIntakePlanModalOpen(true);
  };

  const handleSubmitIntakePlanAction = async () => {
    if (!intakePlanClient) return;
    if (!intakePlanIncludeNutrition && !intakePlanIncludeTraining) {
      alert("Selecciona al menos un tipo de plan.");
      return;
    }
    if (intakePlanActionType === "update" && !intakeUpdateMainNeed.trim()) {
      alert("Para actualizar, indica brevemente qué quieres mejorar en este mes.");
      return;
    }
    try {
      const auth = getAuthSafe();
      if (!auth?.currentUser) return;
      setProcessingIntakeAction(true);
      const response = await fetch("/api/admin/intakeClientPlanAction", {
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
          },
          updateContext:
            intakePlanActionType === "update"
              ? {
                  mainNeed: intakeUpdateMainNeed.trim(),
                  nutritionFeedback: intakeUpdateNutritionFeedback.trim(),
                  trainingFeedback: intakeUpdateTrainingFeedback.trim(),
                  currentWeightKg: intakeUpdateCurrentWeight.trim(),
                  energyLevel: intakeUpdateEnergyLevel,
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
      setIntakeUpdateMainNeed("");
      setIntakeUpdateNutritionFeedback("");
      setIntakeUpdateTrainingFeedback("");
      setIntakeUpdateCurrentWeight("");
      setIntakeUpdateEnergyLevel("media");
    } catch (error) {
      alert(error instanceof Error ? error.message : "No se pudo guardar la acción.");
    } finally {
      setProcessingIntakeAction(false);
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
      const response = await fetch(
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
      const response = await fetch("/api/admin/deleteIntakeClientPlan", {
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
      const response = await fetch("/api/admin/deleteUser", {
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
      const response = await fetch("/api/admin/updateUser", {
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
      const response = await fetch("/api/admin/markUsersSeen", {
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
      <div className="win2k-desktop" style={{display:"flex", alignItems:"center", justifyContent:"center", minHeight:"100vh"}}>
        <div className="win2k-window" style={{padding:"0", minWidth:"240px"}}>
          <div className="win2k-titlebar">
            <span>⏳</span>
            <span>FitPlan Admin</span>
          </div>
          <div style={{padding:"16px", textAlign:"center", background:"#d4d0c8"}}>
            <div style={{width:"32px", height:"32px", border:"3px solid #0000a8", borderBottomColor:"transparent", borderRadius:"50%", margin:"0 auto 8px", animation:"spin 1s linear infinite"}} />
            <p style={{fontSize:"11px"}}>Cargando...</p>
          </div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!isAdmin || error) {
    return (
      <div className="win2k-desktop" style={{display:"flex", alignItems:"center", justifyContent:"center", minHeight:"100vh"}}>
        <div className="win2k-window" style={{padding:"0", minWidth:"300px"}}>
          <div className="win2k-titlebar" style={{background:"#cc0000"}}>
            <span>⛔</span>
            <span>Acceso Denegado</span>
          </div>
          <div style={{padding:"16px", background:"#d4d0c8"}}>
            <p style={{color:"#cc0000", fontWeight:"bold", fontSize:"11px"}}>{error || "Acceso denegado"}</p>
            <div className="win2k-divider" />
            <div style={{textAlign:"right"}}>
              <button className="win2k-btn win2k-btn-primary">Aceptar</button>
            </div>
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

  return (
    <div className="win2k-desktop">
      {/* Win2K Taskbar-style top bar */}
      <div className="win2k-header-bar flex items-center justify-between px-2 py-1" style={{borderBottom: "2px solid #808080", boxShadow: "0 2px 0 #fff"}}>
        <div className="flex items-center gap-2">
          {/* Start button style logo */}
          <div className="win2k-btn win2k-btn-sm flex items-center gap-1" style={{fontWeight:"bold", fontSize:"12px", padding:"2px 8px", minWidth:"auto", border:"2px solid", borderColor:"#fff #808080 #808080 #fff"}}>
            <span style={{fontSize:"14px"}}>🖥️</span> FitPlan Admin
          </div>
          <div style={{width:"1px", height:"20px", background:"#808080", margin:"0 4px"}} />
          <span style={{fontSize:"11px", color:"#000", fontWeight:"bold"}}>Panel de Administración</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              const nextOpen = !paymentNotificationOpen;
              setPaymentNotificationOpen(nextOpen);
              if (nextOpen && paymentNotificationUnread > 0) {
                try {
                  const auth = getAuthSafe();
                  if (auth?.currentUser) {
                    await fetch("/api/admin/paymentNotifications", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ adminUserId: auth.currentUser.uid }),
                    });
                    setPaymentNotificationUnread(0);
                  }
                } catch {
                  // noop
                }
              }
            }}
            className="win2k-btn win2k-btn-sm flex items-center gap-1"
          >
            <FaBell style={{fontSize:"10px"}} />
            Cobros
            {paymentNotificationUnread > 0 && (
              <span style={{background:"#cc0000", color:"#fff", borderRadius:"50%", padding:"0 4px", fontSize:"10px", fontWeight:"bold", marginLeft:"2px"}}>
                {paymentNotificationUnread}
              </span>
            )}
          </button>
          <button
            onClick={() => router.push("/formulario-de-inicio")}
            className="win2k-btn win2k-btn-sm"
          >
            Abrir formulario
          </button>
          <button
            onClick={handleCopyFormLink}
            className="win2k-btn win2k-btn-sm"
          >
            {copiedFormLink ? "✔ Copiado" : "Copiar enlace"}
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto" style={{padding:"8px"}}>
        {/* Payment notification panel */}
        {paymentNotificationOpen && (
          <div className="win2k-notification mb-2 flex flex-col gap-1">
            <p style={{fontWeight:"bold", fontSize:"11px"}}>📋 Pagos confirmados recientes</p>
            <div style={{maxHeight:"100px", overflowY:"auto"}}>
              {paymentNotificationItems.length === 0 ? (
                <p style={{color:"#555"}}>Sin cobros recientes.</p>
              ) : (
                paymentNotificationItems.map((item) => (
                  <div key={item.id} style={{display:"flex", justifyContent:"space-between", padding:"1px 4px", borderBottom:"1px solid #ccc"}}>
                    <span>{item.userName || item.userEmail || "Usuario"} · {item.amount || 0} {item.currency || ""}</span>
                    <span style={{color:"#555"}}>{String(item.provider || "").toUpperCase()}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {newUsersList.length > 0 && (
          <div className="win2k-window mb-2">
            <div className="win2k-titlebar">
              <span>🎉</span>
              <span>{newUsersList.length === 1 ? "Nuevo usuario desde tu última revisión" : `${newUsersList.length} usuarios nuevos desde tu última revisión`}</span>
            </div>
            <div style={{padding:"6px 8px", background:"#d4d0c8"}}>
              <p style={{fontSize:"11px", marginBottom:"4px", color:"#444"}}>
                Última revisión: {formatDateTimeWithHour(adminMeta.lastUsersCheck)}
              </p>
              <button
                onClick={handleMarkNewUsersSeen}
                disabled={markingNewUsersSeen}
                className="win2k-btn win2k-btn-sm"
                style={{marginBottom:"6px"}}
              >
                {markingNewUsersSeen ? "Guardando..." : "✔ Marcar como revisado"}
              </button>
              <div className="win2k-inset" style={{padding:"4px"}}>
                {newUsersList.slice(0, 5).map((user) => (
                  <div key={user.id} style={{display:"flex", justifyContent:"space-between", padding:"2px 4px", borderBottom:"1px solid #d4d0c8"}}>
                    <div>
                      <span style={{fontWeight:"bold"}}>{user.nombre || user.email || user.id}</span>
                      <span style={{color:"#555", marginLeft:"6px"}}>{user.email || "Sin email"}</span>
                    </div>
                    <span style={{color:"#555"}}>{user.createdAt ? formatDateTimeWithHour(user.createdAt) : "Sin fecha"}</span>
                  </div>
                ))}
                {newUsersList.length > 5 && (
                  <div style={{textAlign:"center", color:"#555", fontSize:"10px", padding:"2px"}}>
                    ... y {newUsersList.length - 5} usuarios más
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="win2k-window mb-2">
          <div className="win2k-titlebar">
            <span>👥</span>
            <span>Usuarios con entrenador asignado</span>
            <div style={{marginLeft:"auto", display:"flex", alignItems:"center", gap:"4px"}}>
              <button
                type="button"
                onClick={() => setTrainerPreferenceFilter("all")}
                className="win2k-btn win2k-btn-sm"
                style={trainerPreferenceFilter === "all" ? {boxShadow:"inset 1px 1px 2px rgba(0,0,0,0.4)", borderColor:"#808080 #fff #fff #808080"} : {}}
              >Todos</button>
              <button
                type="button"
                onClick={() => setTrainerPreferenceFilter("hombre")}
                className="win2k-btn win2k-btn-sm"
                style={trainerPreferenceFilter === "hombre" ? {boxShadow:"inset 1px 1px 2px rgba(0,0,0,0.4)", borderColor:"#808080 #fff #fff #808080"} : {}}
              >Hombre</button>
              <button
                type="button"
                onClick={() => setTrainerPreferenceFilter("mujer")}
                className="win2k-btn win2k-btn-sm"
                style={trainerPreferenceFilter === "mujer" ? {boxShadow:"inset 1px 1px 2px rgba(0,0,0,0.4)", borderColor:"#808080 #fff #fff #808080"} : {}}
              >Mujer</button>
              <span className="win2k-badge" style={{marginLeft:"4px"}}>{filteredAssignedTrainerUsers.length} usuarios</span>
            </div>
          </div>
          <div style={{padding:"6px", background:"#d4d0c8"}}>
            {filteredAssignedTrainerUsers.length === 0 ? (
              <p style={{fontSize:"11px", color:"#555", padding:"4px"}}>Aun no hay solicitudes de entrenador personal humano.</p>
            ) : (
              <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(240px, 1fr))", gap:"4px"}}>
                {visibleAssignedTrainerUsers.map((user) => (
                  <div key={user.id} className="win2k-panel" style={{padding:"4px 6px"}}>
                    <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"2px"}}>
                      <span style={{fontWeight:"bold", fontSize:"11px"}}>{user.nombre || user.email || user.id}</span>
                      <span className={`win2k-badge ${user.personalTrainerPreference === "mujer" ? "win2k-badge-purple" : user.personalTrainerPreference === "hombre" ? "win2k-badge-blue" : ""}`}>
                        {user.personalTrainerPreference === "mujer" ? "Entrenadora" : user.personalTrainerPreference === "hombre" ? "Entrenador" : "Sin pref."}
                      </span>
                    </div>
                    <p style={{fontSize:"10px", color:"#555"}}>{user.email || "Sin email"}</p>
                    {user.personalTrainerRequestNote && (
                      <p style={{fontSize:"10px", marginTop:"2px"}}>Motivo: {user.personalTrainerRequestNote}</p>
                    )}
                    <button
                      type="button"
                      onClick={() => window.open("https://wa.me/34627043397", "_blank", "noopener,noreferrer")}
                      className="win2k-btn"
                      style={{width:"100%", marginTop:"4px", fontSize:"11px"}}
                    >
                      📱 WhatsApp
                    </button>
                  </div>
                ))}
              </div>
            )}
            {filteredAssignedTrainerUsers.length > 12 && (
              <div style={{textAlign:"center", marginTop:"4px"}}>
                {hasMoreAssignedTrainerUsers ? (
                  <button type="button" onClick={() => setAssignedTrainerVisibleCount((prev) => prev + 12)} className="win2k-btn win2k-btn-sm">Ver más ▼</button>
                ) : (
                  <button type="button" onClick={() => setAssignedTrainerVisibleCount(12)} className="win2k-btn win2k-btn-sm">Ver menos ▲</button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Panel de Estadísticas de Ganancias */}
        <div style={{display:"grid", gridTemplateColumns:"1fr auto", gap:"4px", marginBottom:"4px"}}>
          <div className="win2k-window">
            <div className="win2k-titlebar">
              <span>💰</span>
              <span>Estadísticas de Ganancias</span>
            </div>
            <div style={{padding:"6px", background:"#d4d0c8"}}>
              <div style={{display:"grid", gridTemplateColumns:"repeat(5, 1fr)", gap:"4px", marginBottom:"6px"}}>
                <div className="win2k-stat-box">
                  <div className="stat-label">Ganancia Mensual Real</div>
                  <div className="stat-value" style={{fontSize:"14px"}}>${revenueStats.actualMonthly.toLocaleString('es-AR')}</div>
                  <div style={{fontSize:"10px", color:"#555"}}>{(revenueStats.actualMonthly / 2000).toFixed(2)} EUR</div>
                </div>
                <div className="win2k-stat-box">
                  <div className="stat-label">Ganancia Est. Mensual</div>
                  <div className="stat-value" style={{fontSize:"14px", color:"#808000"}}>${revenueStats.estimatedMonthly.toLocaleString('es-AR')}</div>
                  <div style={{fontSize:"10px", color:"#555"}}>{(revenueStats.estimatedMonthly / 2000).toFixed(2)} EUR</div>
                </div>
                <div className="win2k-stat-box">
                  <div className="stat-label">Premium Activos</div>
                  <div className="stat-value" style={{color:"#005500"}}>{revenueStats.premiumActiveThisMonth}</div>
                  <div style={{fontSize:"10px", color:"#555"}}>usuarios</div>
                </div>
                <div className="win2k-stat-box">
                  <div className="stat-label">Pendientes de Pago</div>
                  <div className="stat-value" style={{color:"#aa5500"}}>{revenueStats.pendingPayments}</div>
                  <div style={{fontSize:"10px", color:"#555"}}>usuarios</div>
                </div>
                <div className="win2k-stat-box">
                  <div className="stat-label">Renovando Pronto</div>
                  <div className="stat-value" style={{color:"#0000a8"}}>{revenueStats.renewingSoon}</div>
                  <div style={{fontSize:"10px", color:"#555"}}>7 días</div>
                </div>
              </div>
              <div className="win2k-divider" />
              <div style={{display:"flex", justifyContent:"space-between", padding:"2px 4px"}}>
                <div>
                  <span style={{fontSize:"11px", color:"#444"}}>Proyección Anual: </span>
                  <span style={{fontWeight:"bold", color:"#0000a8"}}>${revenueStats.estimatedAnnual.toLocaleString('es-AR')} ARS</span>
                  <span style={{fontSize:"10px", color:"#555", marginLeft:"4px"}}>({(revenueStats.estimatedAnnual / 2000).toFixed(2)} EUR)</span>
                </div>
                <div>
                  <span style={{fontSize:"11px", color:"#444"}}>Total Premium: </span>
                  <span style={{fontWeight:"bold", color:"#800080"}}>{revenueStats.totalPremiumUsers}</span>
                  <span style={{fontSize:"10px", color:"#555", marginLeft:"4px"}}>registrados</span>
                </div>
              </div>
            </div>
          </div>

          <div className="win2k-window" style={{minWidth:"160px"}}>
            <div className="win2k-titlebar">
              <span>⚡</span>
              <span>Acciones Rápidas</span>
            </div>
            <div style={{padding:"6px", background:"#d4d0c8", display:"flex", flexDirection:"column", gap:"4px"}}>
              <button
                onClick={() => {
                  const pendingUsers = users.filter(u => {
                    if (u.email?.toLowerCase() === "admin@fitplan-ai.com") return false;
                    const status = getPaymentStatus(u);
                    return status.status === "unpaid" && u.premium;
                  });
                  const totalARS = pendingUsers.length * 10000;
                  const totalEUR = pendingUsers.length * 5;
                  alert(`${pendingUsers.length} usuarios premium están sin pagar este mes. Total a recuperar: $${totalARS.toLocaleString('es-AR')} ARS / ${totalEUR.toFixed(2)} EUR`);
                }}
                className="win2k-btn"
                style={{width:"100%"}}
              >
                Ver Pendientes
              </button>
              <button
                onClick={() => {
                  const totalRenewARS = revenueStats.renewingSoon * 10000;
                  const totalRenewEUR = revenueStats.renewingSoon * 5;
                  alert(`${revenueStats.renewingSoon} usuarios renovarán en los próximos 7 días. Total esperado: $${totalRenewARS.toLocaleString('es-AR')} ARS / ${totalRenewEUR.toFixed(2)} EUR`);
                }}
                className="win2k-btn"
                style={{width:"100%"}}
              >
                Renovaciones Próximas
              </button>
              <div className="win2k-divider" style={{marginTop:"4px"}} />
              <div style={{fontSize:"10px", color:"#444"}}>
                <strong>Precios mensuales:</strong> $10.000 ARS / 5.00 EUR
              </div>
            </div>
          </div>
        </div>

        {/* Estadísticas rápidas */}
        <div style={{display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:"4px", marginBottom:"4px"}}>
          <div className="win2k-stat-box">
            <div className="stat-label">Total Usuarios</div>
            <div className="stat-value">{totalUsers}</div>
          </div>
          <div className="win2k-stat-box">
            <div className="stat-label">Usuarios Premium</div>
            <div className="stat-value" style={{color:"#808000"}}>{premiumUsers}</div>
          </div>
          <div className="win2k-stat-box">
            <div className="stat-label">Usuarios Regulares</div>
            <div className="stat-value" style={{color:"#005588"}}>{regularUsers}</div>
          </div>
          <div className="win2k-stat-box">
            <div className="stat-label">Atléticos</div>
            <div className="stat-value" style={{color:"#005500"}}>{athleticUsers}</div>
          </div>
        </div>

        {/* Clientes provenientes del formulario de inicio */}
        <div className="win2k-window mb-2">
          <div className="win2k-titlebar" style={{justifyContent:"space-between"}}>
            <div style={{display:"flex", alignItems:"center", gap:"6px"}}>
              <span>📋</span>
              <span>Clientes del formulario de inicio</span>
              <span style={{fontSize:"10px", fontWeight:"normal", opacity:"0.8"}}>— Leads para entrenamiento 1:1</span>
            </div>
            <span className="win2k-badge" style={{background:"#0000a8", color:"#fff", border:"none"}}>{intakeClients.length}</span>
          </div>

          {loadingIntakeClients ? (
            <div style={{padding:"8px", background:"#d4d0c8", fontSize:"11px", color:"#555"}}>Cargando clientes...</div>
          ) : intakeClients.length === 0 ? (
            <div style={{padding:"8px", background:"#d4d0c8", fontSize:"11px", color:"#555"}}>Aún no hay envíos del formulario.</div>
          ) : (
            <div style={{overflowX:"auto", background:"#d4d0c8", padding:"4px"}}>
              <div className="win2k-inset" style={{overflowX:"auto"}}>
              <table className="win2k-table" style={{minWidth:"1100px"}}>
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Email</th>
                    <th>WhatsApp</th>
                    <th>Instagram</th>
                    <th>Servicio</th>
                    <th>Objetivo</th>
                    <th>Trabajo</th>
                    <th>Fecha</th>
                    <th>Pago mes</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {intakeClients.map((client) => (
                    <tr key={client.id}>
                      <td>{client.nombreCompleto || "N/A"}</td>
                      <td>{client.email || "N/A"}</td>
                      <td>{client.whatsapp || "N/A"}</td>
                      <td>{client.instagram || "N/A"}</td>
                      <td>{client.servicioInteres || "N/A"}</td>
                      <td>{client.objetivoPrincipal || "N/A"}</td>
                      <td>
                        {client.trabajoTurnos || client.diasTrabajo.length > 0
                          ? `${client.trabajoTurnos || "Sin horas"}${client.diasTrabajo.length > 0 ? ` · ${client.diasTrabajo.join(", ")}` : ""}`
                          : "N/A"}
                      </td>
                      <td>
                        {client.createdAt
                          ? new Date(client.createdAt).toLocaleString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
                          : "N/A"}
                      </td>
                      <td>
                        <span className={`win2k-badge ${isIntakeCurrentMonthPaid(client) ? "win2k-badge-green" : client.paymentStatus === "pending" ? "win2k-badge-yellow" : "win2k-badge-red"}`}>
                          {isIntakeCurrentMonthPaid(client) ? "✔ Pagado" : client.paymentStatus === "pending" ? "⏳ Pendiente" : "✗ No pagó"}
                        </span>
                      </td>
                      <td>
                        <div className="win2k-actions">
                          <button onClick={() => handleOpenIntakeClientDetail(client)} className="win2k-btn win2k-btn-sm">
                            <FaUser style={{display:"inline", marginRight:"2px", fontSize:"9px"}} />Datos
                          </button>
                          <button onClick={() => openIntakePlanModal(client, "generate")} className="win2k-btn win2k-btn-sm">
                            <FaPlusCircle style={{display:"inline", marginRight:"2px", fontSize:"9px"}} />Generar
                          </button>
                          {client.latestPlanId && (
                            <>
                              <button onClick={() => openIntakePlanModal(client, "update")} className="win2k-btn win2k-btn-sm">
                                <FaSyncAlt style={{display:"inline", marginRight:"2px", fontSize:"9px"}} />Actualizar
                              </button>
                              <button onClick={() => handleOpenGeneratedPlan(client)} className="win2k-btn win2k-btn-sm">
                                <FaEye style={{display:"inline", marginRight:"2px", fontSize:"9px"}} />Ver Plan
                              </button>
                              <button onClick={() => openDeletePlanModal(client)} disabled={processingIntakeAction} className="win2k-btn win2k-btn-sm">
                                <FaTrashAlt style={{display:"inline", marginRight:"2px", fontSize:"9px"}} />Del. Plan
                              </button>
                            </>
                          )}
                          <button onClick={() => openIntakePaymentModal(client)} className="win2k-btn win2k-btn-sm">
                            <FaLink style={{display:"inline", marginRight:"2px", fontSize:"9px"}} />Pago
                          </button>
                          <button onClick={() => openDeleteUserModal(client)} disabled={processingIntakeAction} className="win2k-btn win2k-btn-sm" style={{color:"#cc0000"}}>
                            <FaTrashAlt style={{display:"inline", marginRight:"2px", fontSize:"9px"}} />Borrar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          )}
        </div>

        {/* Lista de usuarios */}
        <div className="win2k-window">
          <div className="win2k-titlebar">
            <span>👤</span>
            <span>Usuarios del Sistema</span>
          </div>
          {/* Vista de tabla para desktop */}
          <div style={{overflowX:"auto", background:"#d4d0c8", padding:"4px"}}>
            <div className="win2k-inset" style={{overflowX:"auto"}}>
            <table className="win2k-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Contacto</th>
                  <th>Plan</th>
                  <th>Estado de Pago</th>
                  <th>Edad</th>
                  <th>Altura</th>
                  <th>Peso</th>
                  <th>Estado</th>
                  <th>Creado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{textAlign:"center", padding:"16px", color:"#555"}}>
                      La carga de usuarios está deshabilitada temporalmente.
                    </td>
                  </tr>
                ) : (
                  users.filter(user => user.email?.toLowerCase() !== "admin@fitplan-ai.com").map((user, index) => {
                    const paymentStatus = getPaymentStatus(user);
                    const isNewUser = newUserIds.includes(user.id);
                    return (
                    <tr
                      key={user.id}
                      style={isNewUser ? {backgroundColor:"#e0ffe0"} : {}}
                    >
                      <td style={{whiteSpace:"nowrap"}}>
                        <span style={{fontWeight: isNewUser ? "bold" : "normal"}}>{user.nombre || user.email || "N/A"}</span>
                        {isNewUser && <span className="win2k-badge win2k-badge-green" style={{marginLeft:"4px", fontSize:"9px"}}>NUEVO</span>}
                        {(user.pais || user.ciudad) && (
                          <div className="relative group" style={{display:"inline-block", marginLeft:"4px"}}>
                            <span
                              onClick={() => {
                                if (locationTooltipOpenUserId === user.id) {
                                  setLocationTooltipOpenUserId(null);
                                } else {
                                  setLocationTooltipOpenUserId(user.id);
                                }
                              }}
                              style={{cursor:"pointer", fontSize:"14px"}}
                            >
                              {user.pais ? getCountryFlag(user.pais) : "🌍"}
                            </span>
                            {locationTooltipOpenUserId === user.id && (
                              <div
                                className="win2k-tooltip"
                                style={{position:"absolute", left:"0", bottom:"calc(100% + 2px)", zIndex:9999, whiteSpace:"nowrap"}}
                                onClick={(e) => e.stopPropagation()}
                              >
                                {user.ciudad && <p><strong>Ciudad:</strong> {user.ciudad}</p>}
                                {user.pais && <p><strong>País:</strong> {user.pais}</p>}
                                {!user.ciudad && !user.pais && <p>No disponible</p>}
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      <td style={{whiteSpace:"nowrap"}}>
                        <div style={{display:"flex", gap:"2px", alignItems:"center"}}>
                          {user.email ? (
                            <a href={`mailto:${user.email}`} className="win2k-btn win2k-btn-sm" title={user.email}>
                              <FaEnvelope style={{fontSize:"9px"}} />
                            </a>
                          ) : (
                            <span style={{color:"#888"}}>N/A</span>
                          )}
                          {user.email && user.email.toLowerCase() !== "admin@fitplan-ai.com" && (
                            <button
                              onClick={() => { setSelectedUserForMessage(user); setSendMessageModalOpen(true); }}
                              className="win2k-btn win2k-btn-sm"
                              title={`Enviar mensaje a ${user.nombre || user.email}`}
                            >
                              <FaComment style={{fontSize:"9px"}} />
                            </button>
                          )}
                          {user.email && user.email.toLowerCase() !== "admin@fitplan-ai.com" && (
                            <button
                              onClick={() => openPaymentLinkModal(user)}
                              className="win2k-btn win2k-btn-sm"
                              title={`Link de pago para ${user.nombre || user.email}`}
                            >
                              <FaLink style={{fontSize:"9px"}} />
                            </button>
                          )}
                        </div>
                      </td>
                      <td style={{whiteSpace:"nowrap"}}>
                        {user.email?.toLowerCase() === "admin@fitplan-ai.com" ? (
                          <span className="win2k-badge win2k-badge-purple">Admin</span>
                        ) : user.premium ? (
                          <div style={{display:"flex", flexDirection:"column", gap:"2px"}}>
                            <span className="win2k-badge win2k-badge-yellow" style={{background:"#aaaa00", color:"#fff", borderColor:"#555500"}}>⭐ Premium</span>
                            {user.premiumPlanType && (
                              <span className="win2k-badge win2k-badge-blue" style={{fontSize:"9px"}}>
                                {user.premiumPlanType === "monthly" ? "Mensual" : user.premiumPlanType === "quarterly" ? "Trimestral" : user.premiumPlanType === "annual" ? "Anual" : ""}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="win2k-badge">Regular</span>
                        )}
                      </td>
                      <td style={{whiteSpace:"nowrap"}}>
                        {user.email?.toLowerCase() === "admin@fitplan-ai.com" ? (
                          <span className="win2k-badge">N/A</span>
                        ) : user.premium ? (
                          <div className="relative flex items-center gap-2">
                            <FaCircle
                              className={`h-2.5 w-2.5 ${
                                isCurrentMonthPaid(user) ? "text-green-400 drop-shadow-[0_0_6px_rgba(74,222,128,0.9)]" : "text-red-400/80"
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
                                  const response = await fetch(`/api/admin/payments?userId=${user.id}&adminUserId=${auth.currentUser.uid}`);
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
                              className={`win2k-badge cursor-pointer ${
                                paymentStatus.status === "paid" 
                                  ? "win2k-badge-green"
                                  : paymentStatus.status === "expiring"
                                  ? "win2k-badge-yellow"
                                  : "win2k-badge-red"
                              }`}
                            >
                              {paymentStatus.label}
                            </span>
                            {paymentStatus.expiresAt && tooltipOpenUserId === user.id && (
                              <div 
                                className="win2k-tooltip"
                                style={{position:"absolute", left:"0", bottom:"calc(100% + 2px)", zIndex:9999, whiteSpace:"nowrap"}}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <p style={{fontWeight:"bold"}}>
                                  {paymentStatus.status === "expired" ? "⚠ Plan Vencido" : paymentStatus.status === "expiring" ? "⏰ Por Vencer" : "✔ Plan Activo"}
                                </p>
                                <p>Vence: {paymentStatus.expiresAt.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
                                {paymentStatus.daysUntilExpiry !== null && (
                                  <p>{paymentStatus.daysUntilExpiry < 0 ? "Vencido hace" : "Días restantes"}: {Math.abs(paymentStatus.daysUntilExpiry)}d</p>
                                )}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="win2k-badge">Regular</span>
                        )}
                      </td>
                      <td style={{whiteSpace:"nowrap"}}>{user.edad || "N/A"}</td>
                      <td style={{whiteSpace:"nowrap"}}>{user.alturaCm ? `${user.alturaCm} cm` : "N/A"}</td>
                      <td style={{whiteSpace:"nowrap"}}>{user.peso ? `${user.peso} kg` : "N/A"}</td>
                      <td style={{textAlign:"center"}}>
                        <div style={{position:"relative", display:"inline-block"}}>
                          <div
                            onClick={() => {
                              if (statusTooltipOpenUserId === user.id) {
                                setStatusTooltipOpenUserId(null);
                              } else {
                                setStatusTooltipOpenUserId(user.id);
                              }
                            }}
                            style={{cursor:"pointer"}}
                          >
                            {getIMCStatus(user.peso, user.alturaCm).icon}
                          </div>
                          {statusTooltipOpenUserId === user.id && (() => {
                            const status = getIMCStatus(user.peso, user.alturaCm);
                            if (status.status === "saludable") return null;
                            return (
                              <div className="win2k-tooltip" style={{position:"absolute", left:"50%", transform:"translateX(-50%)", bottom:"calc(100% + 2px)", zIndex:9999, whiteSpace:"nowrap"}}>
                                {status.status === "bajo" && status.weightDifference && (
                                  <span style={{color:"#0000aa"}}>{status.weightDifference.toFixed(1)} kg bajo peso ideal</span>
                                )}
                                {status.status === "excedido" && status.weightDifference && (
                                  <span style={{color:"#cc0000"}}>{status.weightDifference.toFixed(1)} kg sobre peso ideal</span>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      </td>
                      <td style={{whiteSpace:"nowrap"}}>{formatDate(user.createdAt)}</td>
                      <td style={{whiteSpace:"nowrap"}}>
                        <div className="win2k-actions">
                          <button onClick={() => handleEdit(user)} className="win2k-btn win2k-btn-sm">Editar</button>
                          {user.email?.toLowerCase() !== "admin@fitplan-ai.com" && (
                            <button
                              onClick={async () => {
                                setSelectedUserForHistory(user);
                                setHistoryModalOpen(true);
                                setLoadingHistory(true);
                                try {
                                  const response = await fetch(`/api/admin/userHistory?userId=${user.id}&adminUserId=${authUser?.uid}`);
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
                              className="win2k-btn win2k-btn-sm"
                            >
                              Historial
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    );
                  })
                )}
              </tbody>
            </table>
            </div>
          </div>

          {/* Vista de cards para mobile */}
          <div style={{padding:"4px", background:"#d4d0c8"}}>
            {users.length === 0 ? (
              <div className="text-center py-12">
                <div className="flex flex-col items-center gap-3">
                  <p className="text-white/60 text-sm">
                    La carga de usuarios está deshabilitada temporalmente
                  </p>
                  <p className="text-white/40 text-xs">
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
                        ? "bg-green-500/10 border-green-400/30 border-l-4 border-l-green-400" 
                        : "bg-white/5 border-white/10"
                    }`}
                  >
                    {/* Header con nombre y badges */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-semibold text-white">{user.nombre || user.email || "N/A"}</h3>
                        {isNewUser && (
                          <span className="px-2 py-0.5 text-[10px] uppercase tracking-wide rounded-full bg-green-500/30 text-green-100 border border-green-500/40">
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
                              className={`absolute left-1/2 bottom-full z-[9999] mb-2 w-48 -translate-x-1/2 rounded-lg border border-white/20 bg-black/95 px-3 py-2 text-xs text-white shadow-xl transition-opacity duration-200 ${
                                locationTooltipOpenUserId === user.id
                                  ? "opacity-100 pointer-events-auto"
                                  : "opacity-0 pointer-events-none md:group-hover:opacity-100"
                              }`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="space-y-1">
                                {user.ciudad && (
                                  <p className="text-white/90">
                                    <span className="font-medium">Ciudad:</span> {user.ciudad}
                                  </p>
                                )}
                                {user.pais && (
                                  <p className="text-white/90">
                                    <span className="font-medium">País:</span> {user.pais}
                                  </p>
                                )}
                                {!user.ciudad && !user.pais && (
                                  <p className="text-white/60">Ubicación no disponible</p>
                                )}
                              </div>
                              <div className="absolute left-1/2 top-full -translate-x-1/2 -mt-1">
                                <div className="h-2 w-2 rotate-45 border-r border-b border-white/20 bg-black/95"></div>
                              </div>
                            </div>
                          </div>
                        )}
                        {user.email?.toLowerCase() === "admin@fitplan-ai.com" ? (
                          <span className="px-2 py-1 text-xs rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30">
                            Admin
                          </span>
                        ) : user.premium ? (
                          <>
                            <span className="px-2 py-1 text-xs rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                              Premium
                            </span>
                            {user.premiumPlanType && (
                              <span className="px-2 py-0.5 text-[10px] rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
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
                          <span className="win2k-badge">Regular</span>
                        )}
                      </div>
                      <div className="win2k-panel" style={{padding:"4px 6px", marginTop:"4px"}}>
                        <span style={{fontSize:"10px", color:"#555"}}>Edad: </span><strong>{user.edad || "N/A"}</strong>
                        <span style={{fontSize:"10px", color:"#555", marginLeft:"8px"}}>Altura: </span><strong>{user.alturaCm ? `${user.alturaCm} cm` : "N/A"}</strong>
                        <span style={{fontSize:"10px", color:"#555", marginLeft:"8px"}}>Peso: </span><strong>{user.peso ? `${user.peso} kg` : "N/A"}</strong>
                      </div>
                      <div className="win2k-actions" style={{marginTop:"4px"}}>
                        {user.email && (
                          <a href={`mailto:${user.email}`} className="win2k-btn win2k-btn-sm" title={user.email}>✉ Email</a>
                        )}
                        <button onClick={() => handleEdit(user)} className="win2k-btn win2k-btn-sm">Editar</button>
                        {user.email?.toLowerCase() !== "admin@fitplan-ai.com" && (
                          <button
                            onClick={async () => {
                              setSelectedUserForHistory(user);
                              setHistoryModalOpen(true);
                              setLoadingHistory(true);
                              try {
                                const response = await fetch(`/api/admin/userHistory?userId=${user.id}&adminUserId=${authUser?.uid}`);
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
                            className="win2k-btn win2k-btn-sm"
                          >
                            Historial
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </div>

        {/* Modal de edición */}
        {editingUser && (
          <div className="win2k-modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="win2k-modal" style={{maxWidth:"600px", width:"100%", maxHeight:"90vh", overflowY:"auto", padding:"0"}}>
              <div className="win2k-titlebar" style={{justifyContent:"space-between"}}>
                <span>✏ Editar Usuario: {editingUser.nombre || editingUser.id}</span>
                <button
                  onClick={() => { setEditingUser(null); setEditForm({}); }}
                  style={{background:"#d4d0c8", border:"2px solid", borderColor:"#fff #808080 #808080 #fff", width:"16px", height:"14px", fontSize:"10px", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:"bold"}}
                >✕</button>
              </div>
              <div style={{padding:"8px", background:"#d4d0c8"}}>

              <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:"6px"}}>
                <div>
                  <label style={{display:"block", fontSize:"11px", marginBottom:"2px"}}>Nombre</label>
                  <input
                    type="text"
                    value={editForm.nombre || ""}
                    onChange={(e) => setEditForm({ ...editForm, nombre: e.target.value })}
                    className="win2k-input"
                    style={{width:"100%"}}
                  />
                </div>

                <div>
                  <label style={{display:"block", fontSize:"11px", marginBottom:"2px"}}>Email</label>
                  <input
                    type="email"
                    value={editForm.email || ""}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    className="win2k-input"
                    style={{width:"100%"}}
                  />
                </div>

                <div>
                  <label style={{display:"block", fontSize:"11px", marginBottom:"2px"}}>Sexo</label>
                  <select
                    value={editForm.sexo || ""}
                    onChange={(e) => setEditForm({ ...editForm, sexo: e.target.value })}
                    className="win2k-input"
                    style={{width:"100%"}}
                  >
                    <option value="">Seleccionar...</option>
                    <option value="masculino">Masculino</option>
                    <option value="femenino">Femenino</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>

                <div>
                  <label style={{display:"block", fontSize:"11px", marginBottom:"2px"}}>Edad</label>
                  <input
                    type="number"
                    value={editForm.edad ?? ""}
                    onChange={(e) => setEditForm({ ...editForm, edad: e.target.value ? Number(e.target.value) : null })}
                    className="win2k-input"
                    style={{width:"100%"}}
                  />
                </div>

                <div>
                  <label style={{display:"block", fontSize:"11px", marginBottom:"2px"}}>Altura (cm)</label>
                  <input
                    type="number"
                    value={editForm.alturaCm ?? ""}
                    onChange={(e) => setEditForm({ ...editForm, alturaCm: e.target.value ? Number(e.target.value) : null })}
                    className="win2k-input"
                    style={{width:"100%"}}
                  />
                </div>

                <div>
                  <label style={{display:"block", fontSize:"11px", marginBottom:"2px"}}>Peso (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={editForm.peso ?? ""}
                    onChange={(e) => setEditForm({ ...editForm, peso: e.target.value ? Number(e.target.value) : null })}
                    className="win2k-input"
                    style={{width:"100%"}}
                  />
                </div>

                <div>
                  <label style={{display:"block", fontSize:"11px", marginBottom:"2px"}}>Peso Objetivo (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={editForm.pesoObjetivo ?? ""}
                    onChange={(e) => setEditForm({ ...editForm, pesoObjetivo: e.target.value ? Number(e.target.value) : null })}
                    className="win2k-input"
                    style={{width:"100%"}}
                  />
                </div>

                <div>
                  <label style={{display:"block", fontSize:"11px", marginBottom:"2px"}}>Premium</label>
                  <label style={{display:"flex", alignItems:"center", gap:"4px", cursor:"pointer"}}>
                    <input
                      type="checkbox"
                      checked={editForm.premium || false}
                      onChange={(e) => setEditForm({ ...editForm, premium: e.target.checked })}
                    />
                    <span>Activar Premium</span>
                  </label>
                </div>

                {editForm.premium && (
                  <div>
                    <label style={{display:"block", fontSize:"11px", marginBottom:"2px"}}>Tipo de Plan</label>
                    <select
                      value={editForm.premiumPlanType || ""}
                      onChange={(e) => setEditForm({ ...editForm, premiumPlanType: e.target.value || null })}
                      className="win2k-input"
                      style={{width:"100%"}}
                    >
                      <option value="">Seleccionar tipo de plan...</option>
                      <option value="monthly">Mensual ($10.000 ARS / 5 EUR)</option>
                      <option value="quarterly">Trimestral ($24.000 ARS / 12 EUR)</option>
                      <option value="annual">Anual ($50.000 ARS / 25 EUR)</option>
                    </select>
                  </div>
                )}

                <div>
                  <label style={{display:"block", fontSize:"11px", marginBottom:"2px"}}>Perfil Atlético</label>
                  <label style={{display:"flex", alignItems:"center", gap:"4px", cursor:"pointer"}}>
                    <input
                      type="checkbox"
                      checked={editForm.atletico || false}
                      onChange={(e) => setEditForm({ ...editForm, atletico: e.target.checked })}
                    />
                    <span>Activar</span>
                  </label>
                </div>

                <div>
                  <label style={{display:"block", fontSize:"11px", marginBottom:"2px"}}>Cintura (cm)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={editForm.cinturaCm ?? ""}
                    onChange={(e) => setEditForm({ ...editForm, cinturaCm: e.target.value ? Number(e.target.value) : null })}
                    className="win2k-input"
                    style={{width:"100%"}}
                  />
                </div>

                <div>
                  <label style={{display:"block", fontSize:"11px", marginBottom:"2px"}}>Cuello (cm)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={editForm.cuelloCm ?? ""}
                    onChange={(e) => setEditForm({ ...editForm, cuelloCm: e.target.value ? Number(e.target.value) : null })}
                    className="win2k-input"
                    style={{width:"100%"}}
                  />
                </div>

                <div>
                  <label style={{display:"block", fontSize:"11px", marginBottom:"2px"}}>Cadera (cm)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={editForm.caderaCm ?? ""}
                    onChange={(e) => setEditForm({ ...editForm, caderaCm: e.target.value ? Number(e.target.value) : null })}
                    className="win2k-input"
                    style={{width:"100%"}}
                  />
                </div>

                <div>
                  <label style={{display:"block", fontSize:"11px", marginBottom:"2px"}}>Ciudad</label>
                  <input
                    type="text"
                    value={editForm.ciudad || ""}
                    onChange={(e) => setEditForm({ ...editForm, ciudad: e.target.value })}
                    className="win2k-input"
                    style={{width:"100%"}}
                    placeholder="Ej: Buenos Aires"
                  />
                </div>

                <div>
                  <label style={{display:"block", fontSize:"11px", marginBottom:"2px"}}>País</label>
                  <input
                    type="text"
                    value={editForm.pais || ""}
                    onChange={(e) => setEditForm({ ...editForm, pais: e.target.value })}
                    className="win2k-input"
                    style={{width:"100%"}}
                    placeholder="Ej: Argentina"
                  />
                </div>
              </div>

              <div className="win2k-divider" />
              <div style={{display:"flex", gap:"4px", justifyContent:"flex-end"}}>
                <button
                  onClick={handleSave}
                  disabled={saving || deleting}
                  className="win2k-btn win2k-btn-primary"
                >
                  {saving ? "Guardando..." : "✔ Guardar Cambios"}
                </button>
                <button
                  onClick={handleDelete}
                  disabled={saving || deleting || editingUser?.email?.toLowerCase() === "admin@fitplan-ai.com"}
                  className="win2k-btn"
                  style={{color:"#cc0000"}}
                  title={editingUser?.email?.toLowerCase() === "admin@fitplan-ai.com" ? "No se puede eliminar al administrador" : "Eliminar usuario"}
                >
                  {deleting ? "Eliminando..." : "✕ Eliminar"}
                </button>
                <button
                  onClick={() => { setEditingUser(null); setEditForm({}); }}
                  disabled={saving || deleting}
                  className="win2k-btn"
                >
                  Cancelar
                </button>
              </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Historial Mensual */}
        {historyModalOpen && selectedUserForHistory && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-gray-900 rounded-xl border border-white/10 p-6 max-w-5xl w-full max-h-[90vh] overflow-y-auto"
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
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
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
                            <p className={`font-medium ${user.premium ? "text-yellow-400" : "text-gray-400"}`}>
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
                                    className="w-full bg-gradient-to-t from-cyan-500 to-blue-500 rounded-t transition-all hover:from-cyan-400 hover:to-blue-400"
                                    style={{ height: `${Math.max(height, 10)}%` }}
                                  >
                                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900 px-2 py-1 rounded text-xs whitespace-nowrap border border-white/10">
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
                                          <span className={Number(cambio) > 0 ? "text-red-400" : "text-green-400"}>
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
                                <p className={`font-medium ${diferencia > 0 ? "text-red-400" : diferencia < 0 ? "text-green-400" : "text-white"}`}>
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
                                const historyResponse = await fetch(`/api/admin/userHistory?userId=${selectedUserForHistory.id}&adminUserId=${authUser?.uid}`);
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
                        className="px-3 py-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/30 transition-colors text-sm"
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
                                  className="w-full mt-2 px-3 py-1.5 rounded-lg bg-blue-500/20 border border-blue-500/30 text-blue-300 hover:bg-blue-500/30 transition-colors text-xs font-medium flex items-center justify-center gap-2"
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
                <div className="p-6 rounded-lg bg-red-500/10 border border-red-500/30 text-center">
                  <p className="text-red-400">Error al cargar el historial</p>
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
              className="bg-gray-900 rounded-xl border border-white/10 p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto"
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
                    className="px-4 py-2 rounded-lg bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/30 transition-colors text-sm"
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
                        className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="10000"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-white/60 mb-2">Tipo de Plan</label>
                      <select
                        value={newPayment.planType}
                        onChange={(e) => setNewPayment({ ...newPayment, planType: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                        className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-white/60 mb-2">Método de Pago</label>
                      <select
                        value={newPayment.paymentMethod}
                        onChange={(e) => setNewPayment({ ...newPayment, paymentMethod: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                        className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                          
                          const response = await fetch("/api/admin/payments", {
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
                          const historyResponse = await fetch(`/api/admin/payments?userId=${selectedUserForPaymentHistory.id}&adminUserId=${auth.currentUser.uid}`);
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
                      className="px-4 py-2 rounded-lg bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/30 transition-colors disabled:opacity-50"
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
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
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
                                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                                className="px-4 py-2 rounded-lg bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/30 transition-colors"
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
                                        <span className="ml-2 text-xs text-blue-400">(Manual)</span>
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
                                          if (diffDays < 0) return "text-red-400";
                                          if (diffDays <= 7) return "text-yellow-400";
                                          return "text-green-400";
                                        })()
                                      : "text-gray-400"
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
                                className="px-3 py-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/30 transition-colors text-sm"
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
          />
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
            onChangeUpdateMainNeed={setIntakeUpdateMainNeed}
            onChangeUpdateNutritionFeedback={setIntakeUpdateNutritionFeedback}
            onChangeUpdateTrainingFeedback={setIntakeUpdateTrainingFeedback}
            onChangeUpdateCurrentWeight={setIntakeUpdateCurrentWeight}
            onChangeUpdateEnergyLevel={setIntakeUpdateEnergyLevel}
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
    </div>
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
  onChangeUpdateMainNeed,
  onChangeUpdateNutritionFeedback,
  onChangeUpdateTrainingFeedback,
  onChangeUpdateCurrentWeight,
  onChangeUpdateEnergyLevel,
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
  onChangeUpdateMainNeed: (value: string) => void;
  onChangeUpdateNutritionFeedback: (value: string) => void;
  onChangeUpdateTrainingFeedback: (value: string) => void;
  onChangeUpdateCurrentWeight: (value: string) => void;
  onChangeUpdateEnergyLevel: (value: "baja" | "media" | "alta") => void;
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
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 14 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-gray-900 rounded-xl border border-white/10 p-6 max-w-lg w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h3 className="text-xl font-bold text-white">{title}</h3>
            <p className="text-sm text-white/70 mt-1">{client.nombreCompleto || client.email || client.id}</p>
            <p className="text-xs text-white/50 mt-1">{subtitle}</p>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white">✕</button>
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
          <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-200">
            Frecuencia: mensual
          </div>
          <div className="space-y-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-3">
            <p className="text-xs text-white/70">Antes de generar, puedes ajustar el enfoque real del cliente.</p>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-white/70">Objetivo real a priorizar</span>
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
          {actionType === "update" && (
            <div className="space-y-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-3">
              <p className="text-xs text-white/70">
                Para actualizar de forma eficiente, indica el objetivo del ajuste y los cambios necesarios.
              </p>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-white/70">¿Qué quieres mejorar este mes? *</span>
                <textarea
                  rows={2}
                  value={updateMainNeed}
                  onChange={(e) => onChangeUpdateMainNeed(e.target.value)}
                  className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white outline-none"
                  placeholder="Ej.: bajar grasa abdominal sin perder fuerza, mejorar adherencia..."
                />
              </label>
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
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-white"
          >
            Cancelar
          </button>
          <button
            onClick={onSubmit}
            disabled={loading}
            className="flex-1 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-medium disabled:opacity-60"
          >
            {loading ? "Guardando..." : actionType === "generate" ? "Generar" : "Actualizar"}
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
        className="bg-gray-900 rounded-xl border border-white/10 p-6 max-w-lg w-full"
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
            className="flex-1 px-4 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-white"
          >
            Cancelar
          </button>
          <button
            onClick={onSubmit}
            disabled={loading || (!deleteNutrition && !deleteTraining)}
            className="flex-1 px-4 py-2 rounded-lg bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-medium disabled:opacity-60"
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
        className="bg-gray-900 rounded-xl border border-white/10 p-6 max-w-lg w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h3 className="text-xl font-bold text-white">Eliminar Usuario</h3>
            <p className="text-sm text-white/70 mt-1">{client.nombreCompleto || client.email || client.id}</p>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white">✕</button>
        </div>

        <div className="rounded-lg border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100">
          Esta acción eliminará al cliente del formulario de inicio y todos sus planes relacionados. No se puede deshacer.
        </div>
        <div className="mt-3 rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-white/85">
          {deletionSummary}
        </div>

        <div className="mt-5 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-white"
          >
            Cancelar
          </button>
          <button
            onClick={onSubmit}
            disabled={loading}
            className="flex-1 px-4 py-2 rounded-lg bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white font-medium disabled:opacity-60"
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
        className="bg-gray-900 rounded-xl border border-white/10 p-6 max-w-lg w-full"
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
          <button onClick={onClose} className="flex-1 px-4 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-white">
            Cancelar
          </button>
          <button
            onClick={onSubmit}
            disabled={loading}
            className="flex-1 px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-medium disabled:opacity-60 inline-flex items-center justify-center gap-2"
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
        className="bg-gray-900 rounded-xl border border-white/10 p-6 max-w-lg w-full"
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
          <button onClick={onClose} className="flex-1 px-4 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-white">
            Cancelar
          </button>
          <button
            onClick={onSubmit}
            disabled={loading}
            className="flex-1 px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-medium disabled:opacity-60"
          >
            {loading ? "Generando..." : "Generar link"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function IntakeClientDetailsModal({
  isOpen,
  onClose,
  client,
  detail,
  loading,
  error,
}: {
  isOpen: boolean;
  onClose: () => void;
  client: IntakeClient;
  detail: IntakeClientDetail | null;
  loading: boolean;
  error: string | null;
}) {
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
        className="bg-gray-900 rounded-xl border border-white/10 p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-xl font-bold text-white">Detalle del cliente</h2>
            <p className="text-sm text-white/70 mt-1">
              {client.nombreCompleto || client.email || client.id}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white transition-colors"
            aria-label="Cerrar modal de detalle"
          >
            ✕
          </button>
        </div>

        {loading ? (
          <div className="py-10 flex justify-center">
            <div className="h-8 w-8 rounded-full border-b-2 border-cyan-400 animate-spin" />
          </div>
        ) : error ? (
          <div className="p-3 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300 text-sm">
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
            </div>

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

  const exportPlanAsExcel = () => {
    const rows: string[] = [];
    rows.push("Seccion;Dia;Hora;Elemento;Detalle;Proteinas_g;Grasas_g;Carbohidratos_g");
    weeklyPlan.forEach((day) => {
      const dayName = String(day.dia || "Día");
      const meals = Array.isArray(day.comidas) ? (day.comidas as Array<Record<string, unknown>>) : [];
      meals.forEach((meal) => {
        const mealName = String(meal.nombre || "Comida");
        const mealTime = String(meal.hora || "--:--");
        const mealOption = Array.isArray(meal.opciones) ? String((meal.opciones as unknown[])[0] || "") : "Opción personalizada";
        const mealMacros =
          meal.macros_aprox && typeof meal.macros_aprox === "object"
            ? (meal.macros_aprox as Record<string, unknown>)
            : null;
        rows.push(
          `Nutricion;${dayName};${mealTime};${mealName};"${mealOption.replace(/"/g, '""')}";${String(
            mealMacros?.proteinas_g ?? ""
          )};${String(mealMacros?.grasas_g ?? "")};${String(mealMacros?.carbohidratos_g ?? "")}`
        );
      });
    });
    firstWeekDays.forEach((day) => {
      const dayName = String(day.day || "Día");
      const exercises = Array.isArray(day.ejercicios) ? (day.ejercicios as Array<Record<string, unknown>>) : [];
      exercises.forEach((exercise) => {
        rows.push(
          `Entrenamiento;${dayName};;${String(exercise.name || "Ejercicio")};"${`Series: ${String(exercise.sets || "-")} | Reps: ${String(
            exercise.reps || "-"
          )} | Músculo: ${String(exercise.muscle_group || "N/A")}`.replace(/"/g, '""')}";;;`
        );
      });
    });
    suplementacionPlan.forEach((supp) => {
      rows.push(
        `Suplementacion;;;${String(supp.nombre || "Suplemento")};"${`Dosis: ${String(supp.dosis || "")} | Momento: ${String(
          supp.momento || ""
        )} | Motivo: ${String(supp.motivo || "")}`.replace(/"/g, '""')}";;;`
      );
    });
    const csvContent = `\uFEFF${rows.join("\n")}`;
    const baseName = sanitizeFileName(client.nombreCompleto || client.email || "cliente");
    downloadBlob(csvContent, "text/csv;charset=utf-8", `plan-lucas-riera-${baseName}.csv`);
  };

  const handleExportPlan = async (format: "pdf" | "word" | "excel") => {
    try {
      setExportingFormat(format);
      if (format === "pdf") exportPlanAsPdf();
      if (format === "word") exportPlanAsWord();
      if (format === "excel") exportPlanAsExcel();
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
        className="bg-gray-900 rounded-xl border border-white/10 p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto"
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
                className="px-3 py-1.5 rounded-lg bg-blue-500/20 border border-blue-400/40 text-blue-200 hover:bg-blue-500/30 transition-colors disabled:opacity-50 inline-flex items-center gap-2"
              >
                <FaDownload />
                Descargar plan
              </button>
              {showDownloadMenu && (
                <div className="absolute right-0 mt-2 w-56 rounded-xl border border-white/15 bg-gray-950/95 p-2 shadow-2xl z-20">
                  <button
                    onClick={() => handleExportPlan("pdf")}
                    disabled={exportingFormat !== null}
                    className="w-full text-left px-3 py-2 rounded-lg text-white/90 hover:bg-white/10 transition-colors inline-flex items-center gap-2"
                  >
                    <FaFilePdf className="text-rose-300" />
                    Descargar en PDF
                  </button>
                  <button
                    onClick={() => handleExportPlan("word")}
                    disabled={exportingFormat !== null}
                    className="w-full text-left px-3 py-2 rounded-lg text-white/90 hover:bg-white/10 transition-colors inline-flex items-center gap-2"
                  >
                    <FaFileWord className="text-blue-300" />
                    Descargar en Word
                  </button>
                  <button
                    onClick={() => handleExportPlan("excel")}
                    disabled={exportingFormat !== null}
                    className="w-full text-left px-3 py-2 rounded-lg text-white/90 hover:bg-white/10 transition-colors inline-flex items-center gap-2"
                  >
                    <FaFileExcel className="text-emerald-300" />
                    Descargar en Excel
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={handleCopyWhatsapp}
              disabled={!plan}
              className="px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 hover:bg-emerald-500/30 transition-colors disabled:opacity-50"
            >
              {copiedWhatsapp ? "Copiado" : "Copiar WhatsApp"}
            </button>
            <button onClick={onClose} className="text-white/60 hover:text-white">✕</button>
          </div>
        </div>

        {loading ? (
          <div className="py-10 flex justify-center">
            <div className="h-8 w-8 rounded-full border-b-2 border-cyan-400 animate-spin" />
          </div>
        ) : error ? (
          <div className="p-3 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300 text-sm">{error}</div>
        ) : !plan ? (
          <div className="p-3 rounded-lg bg-white/5 border border-white/10 text-white/70 text-sm">
            No hay datos de plan disponibles.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-lg border border-sky-400/20 bg-sky-500/10 px-3 py-2">
                <p className="text-xs text-sky-100/80">Datos de la persona</p>
                <p className="text-sm text-sky-100">
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
              <div className="rounded-lg border border-emerald-400/20 bg-emerald-500/10 px-3 py-2">
                <p className="text-xs text-emerald-100/80">Calorías objetivo</p>
                <p className="text-base font-semibold text-emerald-100">
                  {typeof plan?.plan?.calorias_diarias === "number"
                    ? `${plan.plan.calorias_diarias} kcal${
                        typeof (plan?.plan as Record<string, unknown>)?.calorias_mantenimiento === "number"
                          ? ` / ${(plan?.plan as Record<string, unknown>).calorias_mantenimiento} kcal mant.`
                          : ""
                      }`
                    : "N/A"}
                </p>
              </div>
              <div className="rounded-lg border border-cyan-400/20 bg-cyan-500/10 px-3 py-2">
                <p className="text-xs text-cyan-100/80">Macros</p>
                <p className="text-sm text-cyan-100">
                  {macros
                    ? `Proteínas ${String(macros.proteinas || "-")} · Grasas ${String(macros.grasas || "-")} · Carbohidratos ${String(macros.carbohidratos || "-")}`
                    : "N/A"}
                </p>
              </div>
              <div className="rounded-lg border border-violet-400/20 bg-violet-500/10 px-3 py-2">
                <p className="text-xs text-violet-100/80">Split entrenamiento</p>
                <p className="text-sm text-violet-100">{String(trainingPlan?.split || "N/A")}</p>
              </div>
            </div>
            {Boolean(plan?.plan?.evaluacion_inicial) && typeof plan?.plan?.evaluacion_inicial === "object" && (
              <div className="rounded-lg border border-fuchsia-400/20 bg-fuchsia-500/10 px-3 py-2">
                <p className="text-xs text-fuchsia-100/80">Evaluación inicial</p>
                <p className="text-sm text-fuchsia-100">
                  IMC: {String((plan.plan.evaluacion_inicial as Record<string, unknown>).imc || "N/A")} · Estado:{" "}
                  {String((plan.plan.evaluacion_inicial as Record<string, unknown>).estado || "N/A")}
                </p>
                {Boolean((plan.plan.evaluacion_inicial as Record<string, unknown>).decisionClinica) && (
                  <p className="text-xs text-fuchsia-100/85 mt-1">
                    {String((plan.plan.evaluacion_inicial as Record<string, unknown>).decisionClinica)}
                  </p>
                )}
              </div>
            )}
            {Boolean(plan?.plan?.mensaje_ajuste_objetivo) && (
              <div className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2">
                <p className="text-xs text-amber-100/80">Mensaje para el cliente</p>
                <p className="text-sm text-amber-100 mt-1">{String(plan?.plan?.mensaje_ajuste_objetivo)}</p>
              </div>
            )}
            {cardioPlan && (
              <div className="rounded-lg border border-sky-400/20 bg-sky-500/10 px-3 py-2">
                <p className="text-xs text-sky-100/80">Cardio recomendado (caminar/correr)</p>
                <p className="text-sm text-sky-100">
                  Pasos diarios: {String(cardioPlan.objetivo_pasos_diarios || "N/A")} · Sesiones:{" "}
                  {String(cardioPlan.sesiones_por_semana || "N/A")}
                </p>
                <p className="text-xs text-sky-100/80 mt-1">{String(cardioPlan.detalle || "")}</p>
              </div>
            )}
            {suplementacionPlan.length > 0 && (
              <div className="rounded-lg border border-amber-400/20 bg-amber-500/10 px-3 py-2">
                <p className="text-xs text-amber-100/80 mb-2">Suplementación sugerida</p>
                <div className="space-y-2">
                  {suplementacionPlan.map((supp, idx) => (
                    <div key={`supp-${idx}`} className="rounded-md border border-white/10 bg-black/20 px-3 py-2">
                      <p className="text-sm font-medium text-amber-100">{String(supp.nombre || "Suplemento")}</p>
                      <p className="text-xs text-white/80 mt-1">
                        Dosis: {String(supp.dosis || "N/A")} · Momento: {String(supp.momento || "N/A")}
                      </p>
                      <p className="text-xs text-white/70 mt-1">Motivo: {String(supp.motivo || "N/A")}</p>
                      {Boolean(supp.nota) && <p className="text-xs text-amber-200/90 mt-1">Nota: {String(supp.nota)}</p>}
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
                        <p className="text-sm font-semibold text-cyan-200">{dayName}</p>
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
                            return (
                              <div key={`${dayName}-${mealName}-${mealIndex}`} className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-2">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-sm text-white font-medium">{mealName}</p>
                                  <p className="text-xs text-white/60">{mealTime}</p>
                                </div>
                                <p className="text-xs text-white/80 mt-1">{mealOption || "Opción personalizada"}</p>
                                <p className="text-xs text-emerald-200 mt-1">
                                  Proteínas {String(mealMacros?.proteinas_g ?? "-")}g · Grasas {String(mealMacros?.grasas_g ?? "-")}g · Carbohidratos{" "}
                                  {String(mealMacros?.carbohidratos_g ?? "-")}g
                                </p>
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
                        <p className="text-sm font-semibold text-violet-200">{dayName}</p>
                        <p className="text-xs text-white/70 mt-1">{split} · {exercises.length} ejercicios</p>
                        <div className="mt-2 space-y-1">
                          {exercises.slice(0, 6).map((exercise, exIndex) => (
                            <p key={`${dayName}-ex-${exIndex}`} className="text-xs text-white/85">
                              {exIndex + 1}. {String(exercise.name || "Ejercicio")} · {String(exercise.sets || "-")} series ·{" "}
                              {String(exercise.reps || "-")} reps
                            </p>
                          ))}
                        </div>
                      </div>
                    );
                  })}
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
      const response = await fetch("/api/admin/sendMessage", {
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
        className="bg-gray-900 rounded-xl border border-white/10 p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <FaComment className="text-green-400" />
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
              className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-green-500/50"
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
              className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-green-500/50 resize-none"
            />
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="p-3 rounded-lg bg-green-500/20 border border-green-500/30 text-green-400 text-sm">
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
              className="flex-1 px-4 py-2 rounded-lg bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 text-green-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Enviando..." : "Enviar mensaje"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}


