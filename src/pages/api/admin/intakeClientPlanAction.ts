import type { NextApiRequest, NextApiResponse } from "next";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { generateTemplateBasedPlan } from "@/lib/templatePlans";
import type { Goal, UserInput } from "@/types/plan";

type ActionType = "generate" | "update";
type ActionContext = {
  objectiveOverride?: "auto" | "perder_grasa" | "ganar_musculo" | "recomposicion" | "rendimiento" | "mantener";
  additionalNotes?: string;
  trainingStructure?: "auto" | "ppl" | "upper_lower" | "full_body";
} | null;
type UpdateContext = {
  mainNeed?: string;
  nutritionFeedback?: string;
  trainingFeedback?: string;
  currentWeightKg?: string;
  energyLevel?: "baja" | "media" | "alta";
} | null;

function removeUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .map((item) => removeUndefinedDeep(item))
      .filter((item) => item !== undefined) as unknown as T;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entryValue]) => entryValue !== undefined)
      .map(([key, entryValue]) => [key, removeUndefinedDeep(entryValue)] as const);
    return Object.fromEntries(entries) as T;
  }
  return value;
}

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(",", ".").trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function toString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function splitToArray(value: unknown): string[] {
  const raw = toString(value);
  if (!raw) return [];
  return raw
    .split(/[,\n;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeObjetivo(value: unknown): Goal {
  const objetivo = toString(value);
  if (objetivo === "perder_grasa") return "perder_grasa";
  if (objetivo === "ganar_musculo") return "ganar_masa";
  if (objetivo === "recomposicion") return "recomposicion";
  if (objetivo === "rendimiento") return "rendimiento_deportivo";
  if (objetivo === "post_parto") return "mantenimiento_avanzado";
  return "mantener";
}

function normalizeObjetivoOverride(value: unknown): Goal | null {
  const raw = toString(value);
  if (!raw || raw === "auto") return null;
  if (raw === "perder_grasa") return "perder_grasa";
  if (raw === "ganar_musculo") return "ganar_masa";
  if (raw === "recomposicion") return "recomposicion";
  if (raw === "rendimiento") return "rendimiento_deportivo";
  if (raw === "mantener") return "mantener";
  return null;
}

function resolveNivelExperiencia(value: unknown): UserInput["nivelExperiencia"] {
  const normalized = toString(value).toLowerCase();
  if (normalized === "avanzado") return "avanzado";
  if (normalized === "intermedio") return "intermedio";
  return "principiante";
}

function resolveEquipamiento(formData: Record<string, unknown>): UserInput["equipamiento"] {
  const planLugar = toString(formData.planLugar).toLowerCase();
  const equipamientoDisponible = Array.isArray(formData.equipamientoDisponible)
    ? formData.equipamientoDisponible.map((item) => toString(item).toLowerCase())
    : [];

  const hasGymMachines = equipamientoDisponible.some((item) => item.includes("máquinas") || item.includes("maquinas"));
  const hasNoEquipment = equipamientoDisponible.some((item) => item.includes("sin equipamiento"));

  if (planLugar.includes("gimnasio") || hasGymMachines) return "gimnasio";
  if (hasNoEquipment && equipamientoDisponible.length <= 1) return "sin_equipo";
  return "casa";
}

function buildInputFromIntake(formData: Record<string, unknown>): UserInput {
  const preferenciasAlimentos =
    formData.preferenciasAlimentos && typeof formData.preferenciasAlimentos === "object"
      ? (formData.preferenciasAlimentos as Record<string, unknown>)
      : {};

  const foodLikes = Object.entries(preferenciasAlimentos)
    .filter(([, value]) => value === "gusta")
    .map(([food]) => food);
  const foodDislikes = Object.entries(preferenciasAlimentos)
    .filter(([, value]) => value === "no_gusta")
    .map(([food]) => food);

  const restricciones = [
    ...splitToArray(formData.restriccionesAlergias),
    ...foodDislikes,
    ...splitToArray(formData.alimentosNoLeGustan),
    ...splitToArray(formData.digestion).map((v) => `Digestión: ${v}`),
  ];
  const preferenciasContexto = [
    ...foodLikes,
    ...splitToArray(formData.alimentosSiLeGustan),
    ...splitToArray(formData.desayunoHabitual).map((v) => `Desayuno habitual: ${v}`),
    ...splitToArray(formData.almuerzoHabitual).map((v) => `Almuerzo habitual: ${v}`),
    ...splitToArray(formData.cenaHabitual).map((v) => `Cena habitual: ${v}`),
    ...splitToArray(formData.snacksBebidas).map((v) => `Snack/bebida: ${v}`),
    ...splitToArray(formData.diaTipoComidas).map((v) => `Día tipo comidas: ${v}`),
    ...splitToArray(formData.comidasPorDiaHorarios).map((v) => `Horarios de comida: ${v}`),
    ...splitToArray(formData.apetito).map((v) => `Apetito: ${v}`),
    ...splitToArray(formData.momentoMasHambre).map((v) => `Momento de más hambre: ${v}`),
    ...splitToArray(formData.objetivoRendimiento).map((v) => `Objetivo rendimiento: ${v}`),
    ...splitToArray(formData.objetivoEstetico).map((v) => `Objetivo estético: ${v}`),
    ...splitToArray(formData.objetivoSecundario).map((v) => `Objetivo secundario: ${v}`),
    ...splitToArray(formData.motivacionPrincipal).map((v) => `Motivación: ${v}`),
    ...splitToArray(formData.dificultadActual).map((v) => `Dificultad actual: ${v}`),
    ...splitToArray(formData.tiempoParaCocinar).map((v) => `Tiempo para cocinar: ${v}`),
    ...splitToArray(formData.presupuestoComida).map((v) => `Presupuesto comida: ${v}`),
    ...splitToArray(formData.suplementosActualesDetalle).map((v) => `Suplementos actuales: ${v}`),
    ...splitToArray(formData.quiereSuplementos).map((v) => `Interés en suplementos: ${v}`),
    ...splitToArray(formData.trabajoTurnos).map((v) => `Horas de trabajo/día: ${v}`),
    ...splitToArray(formData.horasSueno).map((v) => `Horas de sueño: ${v}`),
    ...splitToArray(formData.calidadSueno).map((v) => `Calidad de sueño: ${v}`),
    ...splitToArray(formData.nivelEstres).map((v) => `Estrés: ${v}`),
    ...splitToArray(formData.horasSentado).map((v) => `Horas sentado: ${v}`),
    ...splitToArray(formData.pasosDiarios).map((v) => `Pasos diarios actuales: ${v}`),
    ...splitToArray(formData.comentariosExtra).map((v) => `Comentario: ${v}`),
    ...splitToArray(formData.dificultadActual).map((v) => `Dificultad actual: ${v}`),
    ...splitToArray(formData.ciudadPais).map((v) => `Ubicación: ${v}`),
    ...splitToArray(formData.planLugar).map((v) => `Lugar entrenamiento: ${v}`),
    ...splitToArray(formData.materialCasa).map((v) => `Material en casa: ${v}`),
    ...(Array.isArray(formData.equipamientoDisponible)
      ? (formData.equipamientoDisponible as unknown[])
          .filter((v): v is string => typeof v === "string")
          .map((v) => `Equipamiento disponible: ${v}`)
      : []),
  ];
  const patologias = [
    ...splitToArray(formData.enfermedadInfancia).map((v) => `Antecedente infancia: ${v}`),
    ...splitToArray(formData.patologias),
    toString(formData.diabetesTipo) !== "no" ? `Diabetes ${toString(formData.diabetesTipo)}` : "",
    toString(formData.hipertensionArterial) === "si" ? "Hipertensión arterial" : "",
    toString(formData.hipotiroidismo) === "si" ? "Hipotiroidismo" : "",
    toString(formData.enfermedadCorazon),
    ...splitToArray(formData.colesterolTrigliceridos).map((v) => `Colesterol/triglicéridos: ${v}`),
    ...splitToArray(formData.medicacionSuplementos).map((v) => `Medicación/suplementos clínicos: ${v}`),
    ...splitToArray(formData.fuma).map((v) => `Tabaquismo: ${v}`),
    ...splitToArray(formData.alcoholFrecuencia).map((v) => `Alcohol: ${v}`),
  ].filter(Boolean);

  const doloresLesiones = [
    ...splitToArray(formData.lesionesDolores),
    ...splitToArray(formData.cirugiasPrevias),
    ...(toString(formData.molestiasDigestivasTipo) && toString(formData.molestiasDigestivasTipo) !== "no"
      ? [`Molestias digestivas: ${toString(formData.molestiasDigestivasTipo)}`]
      : []),
    ...splitToArray(formData.textoLibreFinal).map((v) => `Nota adicional cliente: ${v}`),
  ].filter(Boolean);

  const diasGym = Math.max(1, Math.min(7, toNumber(formData.diasCompromisoEntrenamiento, 3)));
  const diasCardio = Math.max(0, Math.min(7, toNumber(formData.diasEntrenaActualmente, Math.max(0, diasGym - 2))));
  const pesoKg = Math.max(35, toNumber(formData.pesoKg, 70));
  const alturaCm = Math.max(120, toNumber(formData.alturaCm, 170));
  const edad = Math.max(14, toNumber(formData.edad, 30));

  return {
    nombre: toString(formData.nombreCompleto) || "Cliente",
    edad,
    pesoKg,
    pesoObjetivoKg: toNumber(formData.pesoObjetivoKg, 0) || undefined,
    alturaCm,
    sexo: toString(formData.sexo).toLowerCase() === "femenino" ? "femenino" : "masculino",
    actividad: diasGym,
    diasGym,
    diasCardio,
    nivelExperiencia: resolveNivelExperiencia(formData.experienciaEntrenamiento),
    equipamiento: resolveEquipamiento(formData),
    objetivo: normalizeObjetivo(formData.objetivoPrincipal),
    intensidad: "moderada",
    restricciones: Array.from(new Set(restricciones)),
    preferencias: Array.from(new Set(preferenciasContexto)),
    patologias: Array.from(new Set(patologias)),
    doloresLesiones: Array.from(new Set(doloresLesiones)),
    preferirRutina: true,
    duracionDias: 30,
    atletico: false,
    pais: toString(formData.ciudadPais) || undefined,
  };
}

function applyUpdateContext(
  input: UserInput,
  updateContext: UpdateContext,
  includeNutrition: boolean,
  includeTraining: boolean
): UserInput {
  if (!updateContext) return input;
  const next: UserInput = { ...input };
  const mainNeed = toString(updateContext.mainNeed);
  const nutritionFeedback = toString(updateContext.nutritionFeedback);
  const trainingFeedback = toString(updateContext.trainingFeedback);
  const energyLevel = toString(updateContext.energyLevel);
  const currentWeight = toNumber(updateContext.currentWeightKg, 0);

  if (currentWeight > 0) {
    next.pesoKg = Math.max(35, Math.min(300, currentWeight));
  }

  const contextualPreferences = [
    ...(Array.isArray(next.preferencias) ? next.preferencias : []),
    mainNeed ? `Actualización solicitada: ${mainNeed}` : "",
    includeNutrition && nutritionFeedback ? `Ajuste nutrición: ${nutritionFeedback}` : "",
    includeTraining && trainingFeedback ? `Ajuste entrenamiento: ${trainingFeedback}` : "",
  ].filter(Boolean);
  next.preferencias = Array.from(new Set(contextualPreferences));

  if (includeTraining && trainingFeedback) {
    next.doloresLesiones = Array.from(
      new Set([...(Array.isArray(next.doloresLesiones) ? next.doloresLesiones : []), `Feedback entrenamiento: ${trainingFeedback}`])
    );
  }

  if (includeNutrition && nutritionFeedback) {
    next.restricciones = Array.from(
      new Set([...(Array.isArray(next.restricciones) ? next.restricciones : []), `Considerar ajuste: ${nutritionFeedback}`])
    );
  }

  if (energyLevel === "baja") next.intensidad = "leve";
  if (energyLevel === "alta") next.intensidad = "intensa";

  return next;
}

function applyActionContext(input: UserInput, actionContext: ActionContext): UserInput {
  if (!actionContext) return input;
  const next: UserInput = { ...input };
  const objectiveOverride = normalizeObjetivoOverride(actionContext.objectiveOverride);
  const additionalNotes = toString(actionContext.additionalNotes);
  const trainingStructure = toString(actionContext.trainingStructure);
  if (objectiveOverride) {
    next.objetivo = objectiveOverride;
  }
  if (additionalNotes) {
    next.preferencias = Array.from(new Set([...(next.preferencias || []), `Nota extra del coach: ${additionalNotes}`]));
  }
  if (trainingStructure && trainingStructure !== "auto") {
    next.preferencias = Array.from(
      new Set([...(next.preferencias || []), `Estructura entrenamiento preferida: ${trainingStructure}`])
    );
  }
  return next;
}

function calculateCaloriesAndMacros(input: UserInput) {
  const peso = Math.max(35, input.pesoKg);
  const altura = Math.max(120, input.alturaCm);
  const edad = Math.max(14, input.edad);
  const baseBmr =
    input.sexo === "masculino"
      ? 10 * peso + 6.25 * altura - 5 * edad + 5
      : 10 * peso + 6.25 * altura - 5 * edad - 161;

  const activityFactor = 1.2 + Math.min(0.7, (input.diasGym || 0) * 0.08 + (input.diasCardio || 0) * 0.03);
  const tdee = Math.round(baseBmr * activityFactor);

  let targetCalories = tdee;
  if (input.objetivo === "perder_grasa" || input.objetivo === "definicion" || input.objetivo === "corte") {
    targetCalories = Math.round(tdee * 0.82);
  } else if (
    input.objetivo === "ganar_masa" ||
    input.objetivo === "volumen" ||
    input.objetivo === "bulk_cut" ||
    input.objetivo === "lean_bulk"
  ) {
    targetCalories = Math.round(tdee * 1.12);
  }

  const proteinPerKg =
    input.objetivo === "perder_grasa" || input.objetivo === "definicion" || input.objetivo === "corte" ? 2.2 : 1.9;
  const proteinG = Math.round(peso * proteinPerKg);
  const fatG = Math.round((targetCalories * 0.28) / 9);
  const carbsG = Math.max(50, Math.round((targetCalories - proteinG * 4 - fatG * 9) / 4));

  return {
    tdee,
    targetCalories,
    macros: {
      proteinas: `${proteinG}g`,
      grasas: `${fatG}g`,
      carbohidratos: `${carbsG}g`,
    },
  };
}

function calculateImcAssessment(input: UserInput): { imc: number; estado: string } {
  const alturaM = Math.max(1.2, input.alturaCm / 100);
  const imc = input.pesoKg / (alturaM * alturaM);
  let estado = "Normopeso";
  if (imc < 18.5) estado = "Bajo peso";
  else if (imc < 25) estado = "Normopeso";
  else if (imc < 30) estado = "Sobrepeso";
  else if (imc < 35) estado = "Obesidad grado I";
  else if (imc < 40) estado = "Obesidad grado II";
  else estado = "Obesidad grado III";
  return { imc: Math.round(imc * 10) / 10, estado };
}

function applyImcGoalSafetyRule(
  input: UserInput,
  imcAssessment: { imc: number; estado: string }
): {
  adjustedInput: UserInput;
  decisionClinica: string | null;
  mensajeCliente: string | null;
} {
  if (input.objetivo === "mantener" && imcAssessment.imc < 18.5) {
    return {
      adjustedInput: {
        ...input,
        objetivo: "ganar_masa",
        intensidad: input.intensidad === "ultra" ? "intensa" : input.intensidad,
        preferencias: Array.from(
          new Set([
            ...(input.preferencias || []),
            "Ajuste automático: IMC bajo con objetivo mantener, se prioriza recuperación de masa magra.",
          ])
        ),
      },
      decisionClinica:
        "IMC bajo detectado con objetivo 'mantener': se ajusta temporalmente a enfoque de recuperación de masa magra.",
      mensajeCliente:
        "Detectamos un IMC bajo para un enfoque de mantenimiento. Para cuidarte mejor, este plan prioriza primero recuperar masa magra y energía. Cuando estabilices composición y rendimiento, volvemos a mantenimiento.",
    };
  }

  return {
    adjustedInput: input,
    decisionClinica: null,
    mensajeCliente: null,
  };
}

function prunePlanBySelection(
  generatedPlan: Record<string, unknown>,
  includeNutrition: boolean,
  includeTraining: boolean
): Record<string, unknown> {
  const next = { ...generatedPlan };
  if (!includeNutrition) {
    delete next.plan_semanal;
    delete next.calorias_diarias;
    delete next.calorias_mantenimiento;
    delete next.macros;
    delete next.distribucion_diaria_pct;
    delete next.lista_compras;
  }
  if (!includeTraining) {
    delete next.training_plan;
    delete next.minutos_sesion_gym;
  }
  return next;
}

function applyTrainingPeriodizationForUpdate(
  selectedPlan: Record<string, unknown>,
  updateContext: UpdateContext,
  cycleNumber: number
) {
  const trainingPlan =
    selectedPlan.training_plan && typeof selectedPlan.training_plan === "object"
      ? ({ ...(selectedPlan.training_plan as Record<string, unknown>) } as Record<string, unknown>)
      : null;
  if (!trainingPlan) return selectedPlan;

  const rawEnergy = toString(updateContext?.energyLevel || "").toLowerCase();
  const lowEnergy = rawEnergy === "baja";
  const highEnergy = rawEnergy === "alta";
  const trainingFeedback = toString(updateContext?.trainingFeedback || "").toLowerCase();
  const needsDeload =
    lowEnergy ||
    trainingFeedback.includes("fatiga") ||
    trainingFeedback.includes("dolor") ||
    trainingFeedback.includes("sobrecarga");

  const progressionRules = Array.isArray(trainingPlan.progression_rules)
    ? (trainingPlan.progression_rules as unknown[]).map((v) => String(v))
    : [];
  const periodizationBlock = needsDeload
    ? [
        `Mes ${cycleNumber}: Fase de descarga inteligente (deload) durante 7 días.`,
        "Reduce volumen 25-30% y mantén técnica estricta.",
        "Vuelve a progresión normal cuando energía y recuperación mejoren.",
      ]
    : highEnergy
    ? [
        `Mes ${cycleNumber}: Fase de sobrecarga progresiva.`,
        "Aumenta 2,5-5% la carga en básicos si completas repeticiones objetivo.",
        "Mantén 1-2 repeticiones en reserva para sostener progreso sin estancarte.",
      ]
    : [
        `Mes ${cycleNumber}: Fase de consolidación técnica y progreso estable.`,
        "Prioriza ejecutar perfecto antes de subir peso.",
        "Aumenta 1 repetición por serie o 2,5% carga según tolerancia.",
      ];

  const nextRules = Array.from(new Set([...progressionRules, ...periodizationBlock]));
  trainingPlan.progression_rules = nextRules;
  trainingPlan.periodizacion_actual = {
    ciclo: cycleNumber,
    fase: needsDeload ? "deload" : highEnergy ? "sobrecarga" : "consolidacion",
    energia_reportada: rawEnergy || "media",
    feedback_entreno: trainingFeedback || null,
  };
  trainingPlan.sync_with_nutrition = Array.from(
    new Set([
      ...((Array.isArray(trainingPlan.sync_with_nutrition)
        ? trainingPlan.sync_with_nutrition
        : []) as unknown[]).map((v) => String(v)),
      needsDeload
        ? "Durante descarga: prioriza sueño, hidratación y mantener calorías/proteína."
        : "Durante sobrecarga: prioriza comida pre y post entreno rica en carbohidratos y proteína.",
    ])
  );

  selectedPlan.training_plan = trainingPlan;
  return selectedPlan;
}

function buildFallbackPlan(
  input: UserInput,
  maintenanceCalories: number,
  targetCalories: number,
  macros: { proteinas: string; grasas: string; carbohidratos: string }
) {
  const dias = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
  const planSemanal = dias.map((dia) => ({
    dia,
    comidas: [
      {
        hora: "08:00",
        nombre: "Desayuno",
        opciones: ["Yogur griego + avena + fruta", "Huevos + tostada integral + fruta"],
      },
      {
        hora: "13:00",
        nombre: "Almuerzo",
        opciones: ["Pollo/pavo + arroz integral + ensalada", "Legumbres + quinoa + verduras"],
      },
      {
        hora: "17:00",
        nombre: "Merienda",
        opciones: ["Fruta + frutos secos", "Batido de proteína + fruta"],
      },
      {
        hora: "21:00",
        nombre: "Cena",
        opciones: ["Pescado/huevos + verduras + patata", "Tofu + verduras + arroz"],
      },
    ],
  }));

  const trainingPlan = {
    split: "Full Body 3x/week",
    weeks: [
      {
        week: 1,
        days: [
          {
            day: "Lunes",
            split: "Full Body",
            ejercicios: [
              { name: "Sentadilla", sets: 3, reps: "8-12", muscle_group: "Piernas" },
              { name: "Press de pecho", sets: 3, reps: "8-12", muscle_group: "Pecho" },
              { name: "Remo", sets: 3, reps: "8-12", muscle_group: "Espalda" },
            ],
          },
          {
            day: "Miércoles",
            split: "Full Body",
            ejercicios: [
              { name: "Zancadas", sets: 3, reps: "10-12", muscle_group: "Piernas" },
              { name: "Press militar", sets: 3, reps: "8-12", muscle_group: "Hombros" },
              { name: "Jalón al pecho", sets: 3, reps: "8-12", muscle_group: "Espalda" },
            ],
          },
          {
            day: "Viernes",
            split: "Full Body",
            ejercicios: [
              { name: "Peso muerto rumano", sets: 3, reps: "8-12", muscle_group: "Isquiotibiales" },
              { name: "Fondos asistidos", sets: 3, reps: "8-12", muscle_group: "Tríceps" },
              { name: "Curl de bíceps", sets: 3, reps: "10-12", muscle_group: "Bíceps" },
            ],
          },
        ],
      },
    ],
  };

  return {
    calorias_diarias: targetCalories,
    calorias_mantenimiento: maintenanceCalories,
    macros,
    plan_semanal: planSemanal,
    duracion_plan_dias: 30,
    mensaje_motivacional: `Vamos con todo ${input.nombre}. Enfócate en constancia y progresión semanal.`,
    minutos_sesion_gym: 50,
    dificultad: "media",
    dificultad_detalle: "Plan base de intensidad moderada",
    training_plan: trainingPlan,
    _planType: "intake_fallback",
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const {
    userId,
    clientId,
    actionType,
    includeNutrition,
    includeTraining,
    actionContext,
    updateContext,
  } = req.body as {
    userId?: string;
    clientId?: string;
    actionType?: ActionType;
    includeNutrition?: boolean;
    includeTraining?: boolean;
    actionContext?: ActionContext;
    updateContext?: UpdateContext;
  };

  if (!userId || !clientId || !actionType) {
    return res.status(400).json({ error: "Faltan datos requeridos: userId, clientId y actionType" });
  }
  if (actionType !== "generate" && actionType !== "update") {
    return res.status(400).json({ error: "actionType inválido" });
  }
  if (!includeNutrition && !includeTraining) {
    return res.status(400).json({ error: "Debes elegir al menos un tipo de plan" });
  }

  try {
    const db = getAdminDb();
    if (!db) {
      return res.status(500).json({ error: "Firebase Admin SDK no configurado" });
    }

    const adminDoc = await db.collection("usuarios").doc(userId).get();
    const email = adminDoc.data()?.email?.toLowerCase() || "";
    if (!adminDoc.exists || email !== "admin@fitplan-ai.com") {
      return res.status(403).json({ error: "Solo administradores pueden ejecutar esta acción" });
    }

    const targetRef = db.collection("intakeClients").doc(clientId);
    const targetDoc = await targetRef.get();
    if (!targetDoc.exists) {
      return res.status(404).json({ error: "Cliente no encontrado" });
    }

    const targetData = targetDoc.data() as Record<string, unknown> | undefined;
    const formData =
      targetData?.formData && typeof targetData.formData === "object"
        ? (targetData.formData as Record<string, unknown>)
        : null;
    if (!formData) {
      return res.status(400).json({ error: "Este cliente no tiene datos de formulario para generar el plan." });
    }

    const baseInput = buildInputFromIntake(formData);
    const generationInputWithAction = applyActionContext(baseInput, actionContext || null);
    const generationInput = applyUpdateContext(
      generationInputWithAction,
      actionType === "update" ? updateContext || null : null,
      includeNutrition === true,
      includeTraining === true
    );
    const imcAssessment = calculateImcAssessment(generationInput);
    const { adjustedInput, decisionClinica, mensajeCliente } = applyImcGoalSafetyRule(generationInput, imcAssessment);
    const { tdee, targetCalories, macros } = calculateCaloriesAndMacros(adjustedInput);
    let generatedPlan: Record<string, unknown>;
    let generationErrorDetail: string | null = null;
    try {
      generatedPlan = (await generateTemplateBasedPlan(
        adjustedInput,
        tdee,
        targetCalories,
        macros
      )) as unknown as Record<string, unknown>;
    } catch (generationError) {
      generationErrorDetail = generationError instanceof Error ? generationError.message : String(generationError);
      console.error("Error generando plan con templates (fallback activado):", generationError);
      generatedPlan = buildFallbackPlan(adjustedInput, tdee, targetCalories, macros) as unknown as Record<string, unknown>;
    }
    const selectedPlan = prunePlanBySelection(
      generatedPlan,
      includeNutrition === true,
      includeTraining === true
    );
    if (actionType === "update" && includeTraining === true) {
      const history = Array.isArray(targetData?.planActionHistory) ? targetData.planActionHistory : [];
      const cycleNumber = Math.max(2, history.length + 1);
      applyTrainingPeriodizationForUpdate(selectedPlan, updateContext || null, cycleNumber);
    }
    selectedPlan.evaluacion_inicial = {
      ...imcAssessment,
      ...(decisionClinica ? { decisionClinica } : {}),
      ...(mensajeCliente ? { mensajeCliente } : {}),
    };
    if (mensajeCliente) {
      selectedPlan.mensaje_ajuste_objetivo = mensajeCliente;
    }

    const planDocData = removeUndefinedDeep({
      intakeClientId: clientId,
      generatedBy: userId,
      actionType,
      period: "monthly",
      includeNutrition: includeNutrition === true,
      includeTraining: includeTraining === true,
      actionContext: actionContext || null,
      updateContext: actionType === "update" ? updateContext || null : null,
      input: adjustedInput,
      nutritionTargets: {
        tdee,
        targetCalories,
        macros,
        imc: imcAssessment,
      },
      plan: selectedPlan,
      generationErrorDetail,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    const planDoc = await db.collection("intakeClientPlans").add(planDocData);

    const status = actionType === "generate" ? "plan_generated" : "plan_updated";
    const entry = {
      type: actionType,
      includeNutrition: includeNutrition === true,
      includeTraining: includeTraining === true,
      period: "monthly",
      createdAt: new Date().toISOString(),
      createdBy: userId,
      planId: planDoc.id,
      status: "completed",
      updateContext: actionType === "update" ? updateContext || null : null,
    };

    const intakeClientUpdate = removeUndefinedDeep({
        status,
        planAction: {
          ...entry,
          planId: planDoc.id,
          generatedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        planActionHistory: FieldValue.arrayUnion(entry),
        latestPlanId: planDoc.id,
        latestPlanActionType: actionType,
        latestPlanIncludeNutrition: includeNutrition === true,
        latestPlanIncludeTraining: includeTraining === true,
        updatedAt: FieldValue.serverTimestamp(),
      });

    await targetRef.set(
      intakeClientUpdate,
      { merge: true }
    );

    return res.status(200).json({
      ok: true,
      planId: planDoc.id,
      status,
      usedFallback: Boolean(generationErrorDetail),
      generationErrorDetail,
    });
  } catch (error) {
    console.error("Error guardando acción de plan de intake:", error);
    return res.status(500).json({
      error: "No se pudo guardar la acción",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}

