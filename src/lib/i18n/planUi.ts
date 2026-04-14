import type { AppLocale } from "@/contexts/AppLocaleContext";
import type { Intensidad, TipoDieta } from "@/types/plan";

const DIETA_LABELS: Record<TipoDieta, { es: string; en: string }> = {
  estandar: { es: "Estándar", en: "Standard" },
  antiinflamatoria: { es: "Antiinflamatoria", en: "Anti-inflammatory" },
  atkins: { es: "Atkins", en: "Atkins" },
  clinica_mayo: { es: "Clínica Mayo", en: "Mayo Clinic" },
  dash: { es: "DASH", en: "DASH" },
  flexitariana: { es: "Flexitariana", en: "Flexitarian" },
  keto: { es: "Keto", en: "Keto" },
  low_carb: { es: "Low Carb", en: "Low carb" },
  mind: { es: "MIND", en: "MIND" },
  mediterranea: { es: "Mediterránea", en: "Mediterranean" },
  menopausia: { es: "Menopausia", en: "Menopause" },
  paleo: { es: "Paleo", en: "Paleo" },
  pescatariana: { es: "Pescatariana", en: "Pescatarian" },
  sin_gluten: { es: "Sin Gluten", en: "Gluten-free" },
  tlc: { es: "TLC", en: "TLC" },
  vegana: { es: "Vegana", en: "Vegan" },
  vegetariana: { es: "Vegetariana", en: "Vegetarian" },
};

const INTENSITY_LABELS: Record<Intensidad, { es: string; en: string }> = {
  leve: { es: "Leve", en: "Low" },
  moderada: { es: "Moderada", en: "Moderate" },
  intensa: { es: "Intensa", en: "High" },
  ultra: { es: "Ultra", en: "Ultra" },
};

/** Plan page (client) — high-visibility strings */
export const planUi = {
  headTitle: {
    es: "Mi Plan de Alimentación y Entrenamiento | FitPlan AI",
    en: "My nutrition & training plan | FitPlan AI",
  },
  pageTitle: { es: "Tu plan | FitPlan AI", en: "Your plan | FitPlan AI" },
  loadingPlan: { es: "Cargando tu plan...", en: "Loading your plan…" },
  smartPlanHeading: { es: "Tu plan inteligente", en: "Your smart plan" },
  greeting: { es: "Hola", en: "Hi" },
  planIntro: { es: "este es tu plan personalizado.", en: "this is your personalized plan." },
  goal: { es: "Objetivo:", en: "Goal:" },
  intensity: { es: "Intensidad:", en: "Intensity:" },
  diet: { es: "Dieta:", en: "Diet:" },
  difficulty: { es: "Dificultad:", en: "Difficulty:" },
  todaySummary: { es: "Resumen de hoy", en: "Today's summary" },
  currentWeight: { es: "Peso actual", en: "Current weight" },
  dailyCalories: { es: "Calorías diarias", en: "Daily calories" },
  maintenance: { es: "Mantenimiento:", en: "Maintenance:" },
  kcalBalance: { es: "Equilibrio calórico", en: "Caloric balance" },
  bmiHint: { es: "Según tu altura y peso actual.", en: "Based on your current height and weight." },
  underweight: { es: "Bajo peso", en: "Underweight" },
  bmiHealthy: { es: "Saludable", en: "Healthy" },
  bmiOverweight: { es: "Sobrepeso", en: "Overweight" },
  obesity: { es: "Obesidad", en: "Obesity" },
  estimatedBmi: { es: "IMC estimado", en: "Estimated BMI" },
  bmiWhatIsAria: { es: "¿Qué es el IMC?", en: "What is BMI?" },
  bmiGaugeAria: { es: "Indicador de estado IMC", en: "BMI status indicator" },
  planContext: { es: "Contexto del plan", en: "Plan context" },
  planProgress: { es: "Progreso del plan", en: "Plan progress" },
  progressLabel: { es: "Progreso:", en: "Progress:" },
  personalProfile: { es: "Perfil personal", en: "Personal profile" },
  sex: { es: "Sexo", en: "Sex" },
  age: { es: "Edad", en: "Age" },
  height: { es: "Altura", en: "Height" },
  baseWeight: { es: "Peso base", en: "Base weight" },
  routineMealsOn: { es: "Comidas rutinarias:", en: "Routine meals:" },
  activated: { es: "Activado", en: "On" },
  preferences: { es: "Preferencias", en: "Preferences" },
  restrictions: { es: "Restricciones", en: "Restrictions" },
  conditions: { es: "Patologías", en: "Conditions" },
  painInjuries: { es: "Dolores / Lesiones", en: "Pain / Injuries" },
  protein: { es: "Proteínas", en: "Protein" },
  fats: { es: "Grasas", en: "Fats" },
  carbs: { es: "Carbohidratos", en: "Carbs" },
  macrosSectionTitle: { es: "Distribución de macronutrientes", en: "Macronutrient distribution" },
  macrosWhatAria: { es: "¿Qué son los macronutrientes?", en: "What are macronutrients?" },
  optionalComposition: { es: "Composición estimada (opcional)", en: "Estimated composition (optional)" },
  addMeasuresHint: { es: "Completá medidas para estimar % de grasa.", en: "Add measurements to estimate body fat %." },
  noRoutineYet: { es: "Todavía no hay una rutina para mostrar.", en: "No routine to show yet." },
  trainingPlanHeading: { es: "Tu plan de entrenamiento", en: "Your training plan" },
  restOff: { es: "Descanso / OFF", en: "Rest / OFF" },
  noTrainingAvailable: { es: "No hay entrenamiento disponible", en: "No workout available" },
  noMealPlan: { es: "No se encontró un plan de alimentación.", en: "No meal plan found." },
  mealPlanHeading: { es: "Tu plan de alimentación", en: "Your meal plan" },
  mealsCount: { es: "comidas", en: "meals" },
  shoppingList: { es: "Lista de compras", en: "Shopping list" },
  weeklyProgression: { es: "Progresión semanal", en: "Weekly progression" },
  week: { es: "Semana", en: "Week" },
  adjustment: { es: "Ajuste:", en: "Adjustment:" },
  monthsCompleted: { es: "Meses completados", en: "Months completed" },
  netChange: { es: "Cambio neto", en: "Net change" },
  avgAdherenceFood: { es: "Adherencia promedio", en: "Avg. adherence" },
  totalProgress: { es: "Progreso total", en: "Total progress" },
  start: { es: "Inicio", en: "Start" },
  energy: { es: "Energía:", en: "Energy:" },
  recovery: { es: "Recuperación:", en: "Recovery:" },
  foodAdherence: { es: "Adherencia alimentación:", en: "Meal adherence:" },
  trainAdherence: { es: "Adherencia entreno:", en: "Training adherence:" },
  adjustmentsApplied: { es: "Ajustes aplicados:", en: "Adjustments:" },
  projectionsHeading: { es: "Proyecciones y resultados esperados", en: "Projections & expected results" },
  changeHorizon: { es: "Horizonte de cambios", en: "Change horizon" },
  monthlyGainEst: { es: "Ganancia mensual estimada", en: "Estimated monthly gain" },
  monthlyLossEst: { es: "Pérdida mensual estimada", en: "Estimated monthly loss" },
  distribLabel: { es: "Distribución diaria:", en: "Daily distribution:" },
  dayPerWeek: { es: "días por semana", en: "days per week" },
  sessionDuration: { es: "Duración por sesión:", en: "Session duration:" },
  strengthTraining: { es: "Entrenamiento de fuerza con pesas", en: "Strength training with weights" },
  dailyWalk: { es: "Caminata diaria:", en: "Daily walk:" },
  minutes: { es: "minutos", en: "minutes" },
  moderateWalkDaily: { es: "Caminata moderada todos los días", en: "Moderate walk every day" },
  hours: { es: "horas", en: "hours" },
  sleepRecovery: { es: "Para óptima recuperación diaria", en: "For optimal daily recovery" },
  requiresPremium: { es: "Requiere Premium", en: "Premium required" },
  requiresPremiumEdit: { es: "Requiere Premium para editar el plan", en: "Premium required to edit the plan" },
  musculatura: { es: "Musculatura:", en: "Muscle:" },
  previous: { es: "Anterior:", en: "Prev:" },
  repsLabel: { es: "Reps:", en: "Reps:" },
  suggested: { es: "Sug:", en: "Sug:" },
  goalReps: { es: "Obj:", en: "Goal:" },
  avgToday: { es: "Promedio de hoy:", en: "Today's avg:" },
  avgPrevious: { es: "Promedio anterior:", en: "Previous avg:" },
  noExercisesDay: { es: "No hay ejercicios programados para este día", en: "No exercises scheduled for this day" },
  cancel: { es: "Cancelar", en: "Cancel" },
  edit: { es: "Editar", en: "Edit" },
  todaySummarySub: {
    es: "Métricas clave para entender tu estado actual de un vistazo.",
    en: "Key metrics to understand your current status at a glance.",
  },
  weightProjectedLine: {
    es: "Peso proyectado en {months} meses:",
    en: "Projected weight in {months} months:",
  },
  weightDeltaBlurb: {
    es: "Cambio estimado vs. hoy: {delta}. Vas por muy buen camino: con constancia, ese avance se vuelve real.",
    en: "Estimated change vs. today: {delta}. You’re on a great path—with consistency, that progress becomes real.",
  },
  deficitKcalDay: { es: "Déficit: {n} kcal/día", en: "Deficit: {n} kcal/day" },
  surplusKcalDay: { es: "Superávit: +{n} kcal/día", en: "Surplus: +{n} kcal/day" },
  planContextSub: {
    es: "Seguimiento, datos personales relevantes y distribución nutricional.",
    en: "Tracking, relevant personal data, and nutrition distribution.",
  },
  planStartCurrentPhase: { es: "Inicio de la etapa actual:", en: "Start of current phase:" },
  planStartDate: { es: "Fecha de inicio del plan:", en: "Plan start date:" },
  loadingShort: { es: "Cargando...", en: "Loading…" },
  planDifficultyLabel: { es: "Dificultad del plan", en: "Plan difficulty" },
  planDifficultyHelpAria: { es: "¿Qué implica esta dificultad?", en: "What does this difficulty mean?" },
  daysProgress: { es: "{current} / {total} días", en: "{current} / {total} days" },
  yearsOld: { es: "años", en: "yrs" },
  targetWeightLine: { es: "Peso objetivo:", en: "Target weight:" },
  athleticProfileYes: { es: "Perfil atlético:", en: "Athletic profile:" },
  yes: { es: "Sí", en: "Yes" },
  routineMealsActivated: { es: "Comidas rutinarias:", en: "Routine meals:" },
  preferencesRestrictionsTitle: { es: "Preferencias y restricciones", en: "Preferences & restrictions" },
  injuriesTooltipModerate: {
    es: "Entrenamiento y recuperación moderados para:",
    en: "Moderate training and recovery for:",
  },
  bodyFatEstimated: { es: "Grasa corporal estimada:", en: "Estimated body fat:" },
  waistHeightLabel: { es: "Relación cintura/altura:", en: "Waist-to-height ratio:" },
  bodyCompDisclaimerShort: {
    es: "Estas estimaciones son orientativas y no reemplazan evaluación clínica.",
    en: "These estimates are indicative and do not replace clinical assessment.",
  },
  trainingRecoveryHeading: {
    es: "Recomendaciones de entrenamiento y recuperación",
    en: "Training & recovery recommendations",
  },
  gymDaysLabel: { es: "Días de gym:", en: "Gym days:" },
  perDayDuration: { es: "{h} h{m} por día", en: "{h} h{m} per day" },
  perDayDurationNoH: { es: "{m} por día", en: "{m} per day" },
  suggestedShort: { es: "(sugerido: {n})", en: "(suggested: {n})" },
  sleepHoursHeading: { es: "Horas de sueño:", en: "Sleep hours:" },
  sleepHelpAria: { es: "Info sueño y siesta", en: "Sleep and nap info" },
  walkDailyHeading: { es: "Caminata diaria:", en: "Daily walk:" },
  impactChangesHeading: { es: "Impacto de tus cambios:", en: "Impact of your changes:" },
  prosHeading: { es: "Pros:", en: "Pros:" },
  consHeading: { es: "Contras:", en: "Cons:" },
  injuriesRecSectionNote: {
    es: "Entrenamiento y recuperación moderados para:",
    en: "Moderate training and recovery for:",
  },
  recInjuriesTitle: { es: "Entrenamiento adaptado para proteger:", en: "Training adapted to protect:" },
  recInjuriesFoot: {
    es: "Incluye calentamientos dirigidos, variaciones seguras y recordatorios de técnica para evitar agravar estas zonas.",
    en: "Includes targeted warm-ups, safe variations, and technique cues to avoid aggravating these areas.",
  },
  minAbbr: { es: "min", en: "min" },
  viewTraining: { es: "Ver entrenamiento", en: "View training" },
  viewTrainingSub: { es: "Calendario y detalle de ejercicios", en: "Calendar & exercise detail" },
  viewTrainingSubEmpty: { es: "No hay rutina cargada", en: "No routine loaded" },
  viewFood: { es: "Ver alimentación", en: "View nutrition" },
  viewFoodSub: { es: "Resumen semanal con variantes", en: "Weekly summary with options" },
  viewFoodSubEmpty: { es: "No hay plan semanal disponible", en: "No weekly meal plan available" },
  noRoutineHint: { es: "Mientras tanto podés revisar tu plan de alimentación.", en: "Meanwhile you can review your meal plan." },
  goToFood: { es: "Ir a alimentación", en: "Go to nutrition" },
  genMealPlanHint: { es: "Generá o actualizá el plan para ver este bloque.", en: "Generate or update your plan to see this section." },
  weeklyOverageStats: { es: "Ver estadística semanal de excesos", en: "View weekly overage stats" },
  ateTooMuch: { es: "¿Comiste algo de más?", en: "Ate a bit too much?" },
  shoppingListSub: {
    es: "Marcá mentalmente cada item para simplificar tu compra semanal.",
    en: "Mentally check off each item to simplify your weekly shopping.",
  },
  shoppingListCount: { es: "{n} items", en: "{n} items" },
  projectionsSub: {
    es: "Escenario estimado al mantener adherencia durante el plan.",
    en: "Estimated scenario if you stay consistent with the plan.",
  },
  projectionsFootnote: {
    es: "Estas proyecciones son orientativas y dependen de la adherencia, el descanso y la recuperación.",
    en: "These projections are indicative and depend on adherence, rest, and recovery.",
  },
  resultsVisibleFrom: {
    es: "Resultados visibles esperados desde ~{n} mes(es).",
    en: "Visible results expected from ~{n} month(s).",
  },
  seriesRepsLine: { es: "{sets} series × {reps} reps", en: "{sets} sets × {reps} reps" },
  restSeconds: { es: "Descanso:", en: "Rest:" },
  rpeLine: { es: "RPE:", en: "RPE:" },
  modalClose: { es: "Cerrar", en: "Close" },
  editPlanTitle: { es: "Editar datos del plan", en: "Edit plan data" },
  editPlanSubtitle: {
    es: "Actualizá tu perfil para recalcular nutrición y entrenamiento.",
    en: "Update your profile to recalculate nutrition and training.",
  },
  fieldName: { es: "Nombre", en: "Name" },
  fieldWeightKg: { es: "Peso (kg)", en: "Weight (kg)" },
  fieldHeightCm: { es: "Altura (cm)", en: "Height (cm)" },
  fieldSex: { es: "Sexo", en: "Sex" },
  sexMale: { es: "Masculino", en: "Male" },
  sexFemale: { es: "Femenino", en: "Female" },
  fieldGymDaysWeek: { es: "Días gym/semana", en: "Gym days/week" },
  fieldCardioDaysWeek: { es: "Días cardio/semana", en: "Cardio days/week" },
  fieldExperience: { es: "Nivel experiencia", en: "Experience level" },
  expBeginner: { es: "Principiante", en: "Beginner" },
  expIntermediate: { es: "Intermedio", en: "Intermediate" },
  expAdvanced: { es: "Avanzado", en: "Advanced" },
  fieldEquipment: { es: "Equipamiento", en: "Equipment" },
  equipFullGym: { es: "Gimnasio completo", en: "Full gym" },
  equipHomeDb: { es: "Casa con mancuernas", en: "Home with dumbbells" },
  equipNoEquip: { es: "Sin equipo", en: "No equipment" },
  fieldWaistOptional: { es: "Cintura (cm) (opcional)", en: "Waist (cm) (optional)" },
  fieldNeckOptional: { es: "Cuello (cm) (opcional)", en: "Neck (cm) (optional)" },
  fieldHipOptional: { es: "Cadera (cm) (opcional)", en: "Hip (cm) (optional)" },
  fieldAthleticProfile: { es: "Perfil atlético", en: "Athletic profile" },
  prefsComma: { es: "Preferencias (separadas por comas)", en: "Preferences (comma-separated)" },
  restrComma: { es: "Restricciones (separadas por comas)", en: "Restrictions (comma-separated)" },
  pathologiasComma: { es: "Patologías (separadas por comas)", en: "Conditions (comma-separated)" },
  pathologiasHint: {
    es: "Indica condiciones médicas relevantes para ajustar el plan nutricional",
    en: "List relevant medical conditions to adjust the nutrition plan",
  },
  injuriesComma: {
    es: "Dolores, lesiones o molestias (separadas por comas)",
    en: "Pain, injuries, or issues (comma-separated)",
  },
  injuriesHint: {
    es: "Ajustamos el entrenamiento para cuidar estas zonas y recomendar movilidad o precalentamientos específicos.",
    en: "We adjust training to protect these areas and suggest mobility or specific warm-ups.",
  },
  routineMealsCheckbox: {
    es: "Mantener comidas rutinarias (poca variación entre días)",
    en: "Keep routine meals (little day-to-day variation)",
  },
  routineMealsCheckboxSub: {
    es: "Repetir comidas facilita el seguimiento (p. ej., papa en déficit o pasta en volumen). Podés cambiarlo cuando quieras.",
    en: "Repeating meals makes tracking easier (e.g., potatoes in a deficit or pasta in a surplus). You can change this anytime.",
  },
  saveChanges: { es: "Guardar cambios", en: "Save changes" },
  helpBadge: { es: "Ayuda", en: "Help" },
  helpImcTitle: { es: "¿Qué es el IMC?", en: "What is BMI?" },
  helpMacrosTitle: { es: "¿Qué son los macronutrientes?", en: "What are macronutrients?" },
  helpSleepTitle: { es: "¿Cómo contar las horas de sueño?", en: "How to count sleep hours?" },
  helpDifficultyTitle: { es: "¿Qué implica la dificultad del plan?", en: "What does plan difficulty mean?" },
  helpSplitTitle: { es: "¿Qué es la división de entrenamiento?", en: "What is the training split?" },
  helpImcBody: {
    es: "El Índice de Masa Corporal (IMC) relaciona peso y altura. Es una guía general y no sustituye evaluación clínica.",
    en: "Body mass index (BMI) relates weight and height. It is a general guide and does not replace clinical assessment.",
  },
  helpMacrosBody: {
    es: "Los macronutrientes son proteínas, grasas y carbohidratos. Tu plan reparte las calorías diarias entre ellos para apoyar tu objetivo.",
    en: "Macronutrients are protein, fat, and carbs. Your plan splits daily calories across them to support your goal.",
  },
  helpSleepCurrent: { es: "Tu objetivo actual:", en: "Your current target:" },
  helpSleepNap: {
    es: "Las siestas suman al total diario, pero ideal que sean cortas (20–30 min) y no muy tarde para no afectar el sueño nocturno.",
    en: "Naps count toward the daily total, but keep them short (20–30 min) and not too late so they don’t hurt night sleep.",
  },
  helpSleepHoursNight: { es: "h por noche.", en: "h per night." },
  premiumCta: { es: "Ser premium", en: "Go Premium" },
  registerForPremium: {
    es: "Debes estar registrado para acceder al plan Premium",
    en: "You must be signed in to access Premium",
  },
  regenerating: { es: "Regenerando...", en: "Regenerating…" },
  regeneratePlan: { es: "Regenerar plan", en: "Regenerate plan" },
  noPrefsRegistered: {
    es: "No hay preferencias, restricciones, patologías ni lesiones registradas.",
    en: "No preferences, restrictions, conditions, or injuries on file.",
  },
  dailyDistribMeals: {
    es: "Distribución diaria: Desayuno {b}% · Almuerzo {l}% · Snacks {s}% · Cena {c}%",
    en: "Daily distribution: Breakfast {b}% · Lunch {l}% · Snacks {s}% · Dinner {c}%",
  },

  /** FoodTrackingModal */
  foodModalTitle: { es: "Registrar comida fuera del plan", en: "Log an off-plan meal" },
  foodModalSubtitle: {
    es: "Carga rápida para medir impacto y retomar el plan.",
    en: "Quick log to see impact and get back on track.",
  },
  foodAlertEmpty: { es: "Por favor, describe qué comiste", en: "Please describe what you ate" },
  foodErrUnknown: { es: "Error desconocido", en: "Unknown error" },
  foodErrAnalyze: { es: "Error al analizar la comida", en: "Could not analyze the meal" },
  foodErrInvalidResponse: { es: "Respuesta inválida del servidor", en: "Invalid server response" },
  foodErrAnalyzeRetry: {
    es: "Error al analizar la comida. Intenta nuevamente.",
    en: "Could not analyze the meal. Please try again.",
  },
  foodLoadingHistory: { es: "Cargando historial del día...", en: "Loading today’s log…" },
  foodHistoryTodayTitle: { es: "Comidas registradas hoy", en: "Meals logged today" },
  foodTotalToday: {
    es: "Total hoy: {total} kcal · Plan: {plan} kcal",
    en: "Today’s total: {total} kcal · Plan: {plan} kcal",
  },
  foodWhatLabel: { es: "¿Qué comiste?", en: "What did you eat?" },
  foodPlaceholder: {
    es: "Ej: Una porción de pizza + helado.",
    en: "E.g. One slice of pizza + ice cream.",
  },
  foodCalEstimated: { es: "Calorías estimadas", en: "Estimated calories" },
  foodPlanDaily: { es: "Plan diario: {n} kcal", en: "Daily plan: {n} kcal" },
  foodAccumulatedToday: { es: "Acumulado hoy:", en: "Today so far:" },
  foodImpact: { es: "Impacto", en: "Impact" },
  foodHowResume: { es: "Cómo retomar tu plan", en: "How to get back on plan" },
  foodExerciseComp: { es: "Compensación con ejercicio", en: "Exercise offset" },
  foodAnalyzing: { es: "Analizando...", en: "Analyzing…" },
  foodAnalyzeBtn: { es: "Analizar comida", en: "Analyze meal" },
  foodAddAnother: { es: "Agregar otra comida", en: "Log another meal" },
  foodGotIt: { es: "Entendido", en: "Got it" },

  /** WeeklyStatsModal */
  weeklyStatsTitle: { es: "Estadísticas semanales", en: "Weekly stats" },
  weeklyStatsSubtitle: {
    es: "Comidas fuera del plan en los últimos 7 días",
    en: "Off-plan meals in the last 7 days",
  },
  weeklyErrLoad: { es: "Error al cargar estadísticas", en: "Could not load stats" },
  weeklyErrLoadRetry: {
    es: "Error al cargar estadísticas. Intenta nuevamente.",
    en: "Could not load stats. Please try again.",
  },
  weeklyErrDelete: { es: "Error al eliminar la comida", en: "Could not delete the meal" },
  weeklyErrDeleteRetry: {
    es: "Error al eliminar la comida. Intenta nuevamente.",
    en: "Could not delete the meal. Please try again.",
  },
  weeklyStatTotalExtras: { es: "Total extras", en: "Total extra" },
  weeklyStatAvgDaily: { es: "Promedio diario", en: "Daily average" },
  weeklyStatMeals: { es: "Comidas", en: "Meals" },
  weeklyStatDaysLogged: { es: "Días con registro", en: "Days logged" },
  weeklyChartExtrasTitle: { es: "Calorías extras por día", en: "Extra calories per day" },
  weeklyPeakWeek: {
    es: "Pico semanal: {day} con {kcal} kcal.",
    en: "Weekly peak: {day} at {kcal} kcal.",
  },
  weeklyNoEntries: { es: "Sin registros", en: "No entries" },
  weeklyDeleteMealTitle: { es: "Eliminar comida", en: "Delete meal" },
  weeklyConfirmDeleteTitle: { es: "Confirmar eliminación", en: "Confirm deletion" },
  weeklyConfirmDeleteBody: {
    es: "¿Estás seguro de que quieres eliminar esta comida?",
    en: "Are you sure you want to delete this meal?",
  },
  weeklyFoodToDelete: { es: "Comida a eliminar:", en: "Meal to delete:" },
  weeklyCannotUndo: { es: "Esta acción no se puede deshacer.", en: "This action cannot be undone." },
  weeklyDelete: { es: "Eliminar", en: "Delete" },
} as const;

export function p(locale: AppLocale, key: keyof typeof planUi): string {
  return planUi[key][locale];
}

/** Interpolación `{clave}` en textos de `planUi`. */
export function pFmt(locale: AppLocale, key: keyof typeof planUi, vars: Record<string, string | number>): string {
  let s: string = planUi[key][locale] as string;
  for (const [k, v] of Object.entries(vars)) {
    s = s.split(`{${k}}`).join(String(v));
  }
  return s;
}

/** "3 ejercicios" / "3 exercises" */
export function exerciseCountLabel(locale: AppLocale, n: number): string {
  if (locale === "en") return `${n} exercise${n !== 1 ? "s" : ""}`;
  return `${n} ejercicio${n !== 1 ? "s" : ""}`;
}

/** "2 comidas" / "2 meals" (off-plan log) */
export function mealOffPlanCountLabel(locale: AppLocale, n: number): string {
  if (locale === "en") return `${n} meal${n !== 1 ? "s" : ""}`;
  return `${n} comida${n !== 1 ? "s" : ""}`;
}

/** "2 registros" / "2 entries" */
export function foodLogEntryCountLabel(locale: AppLocale, n: number): string {
  if (locale === "en") return `${n} ${n !== 1 ? "entries" : "entry"}`;
  return `${n} registro${n !== 1 ? "s" : ""}`;
}

export function dietTypeLabel(locale: AppLocale, dieta?: TipoDieta): string {
  if (!dieta || dieta === "estandar") return DIETA_LABELS.estandar[locale];
  return DIETA_LABELS[dieta]?.[locale] ?? dieta;
}

export function intensityLabel(locale: AppLocale, intensidad: Intensidad): string {
  return INTENSITY_LABELS[intensidad][locale];
}
