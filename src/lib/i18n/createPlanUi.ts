import type { AppLocale } from "@/contexts/AppLocaleContext";
import type { Goal, TipoDieta, Intensidad } from "@/types/plan";

type B = { es: string; en: string };

/** Textos del formulario /create-plan */
export const createPlanForm = {
  pageTitle: { es: "Crear Plan Personalizado | FitPlan", en: "Create Custom Plan | FitPlan" },
  pageDesc: {
    es: "Crea tu plan de alimentación y entrenamiento personalizado con inteligencia artificial. Completa el formulario y recibe tu plan en minutos.",
    en: "Create your personalized nutrition and training plan with AI. Complete the form and get your plan in minutes.",
  },
  ogTitle: { es: "Crear Plan Personalizado | FitPlan", en: "Create Custom Plan | FitPlan" },
  ogDesc: {
    es: "Diseña tu plan de alimentación y entrenamiento personalizado en minutos con IA.",
    en: "Design your personalized nutrition and training plan in minutes with AI.",
  },
  heroTitle: { es: "Crear mi plan", en: "Create my plan" },
  heroSubtitle: {
    es: "Completa los pasos y genera tu plan de alimentación y entrenamiento personalizado.",
    en: "Complete the steps to generate your personalized nutrition and training plan.",
  },
  stepProfile: { es: "Perfil", en: "Profile" },
  stepGoal: { es: "Objetivo", en: "Goal" },
  stepHealth: { es: "Salud", en: "Health" },
  formStepsAria: { es: "Pasos del formulario", en: "Form steps" },

  name: { es: "Nombre", en: "Name" },
  sex: { es: "Sexo", en: "Sex" },
  sexMale: { es: "Masculino", en: "Male" },
  sexFemale: { es: "Femenino", en: "Female" },
  age: { es: "Edad", en: "Age" },
  height: { es: "Altura (cm)", en: "Height (cm)" },
  weight: { es: "Peso (kg)", en: "Weight (kg)" },
  phName: { es: "Tu nombre", en: "Your name" },
  phAge: { es: "Tu edad", en: "Your age" },
  phHeight: { es: "Tu altura en centímetros", en: "Your height in centimeters" },
  phWeight: { es: "Tu peso en kilogramos", en: "Your weight in kilograms" },
  weightHint: {
    es: "Vale un valor estimado. Hace falta para guardar tu perfil, y se puede editar después.",
    en: "It can be an estimate. It helps save your profile. You can edit it later.",
  },
  premiumExtrasTitle: { es: "Datos opcionales para mayor precisión", en: "Optional data for more accuracy" },
  waist: { es: "Cintura (cm)", en: "Waist (cm)" },
  neck: { es: "Cuello (cm)", en: "Neck (cm)" },
  hip: { es: "Cadera (cm)", en: "Hip (cm)" },
  athleticProfile: { es: "Perfil atlético / mayor masa muscular", en: "Athletic profile / higher muscle mass" },
  athleticHint: {
    es: "Para quien ya es deportista o tiene un nivel de actividad física avanzado.",
    en: "Check if you already train seriously or have advanced activity levels.",
  },

  goalLabel: { es: "Objetivo", en: "Goal" },
  dietTypeLabel: { es: "Tipo de dieta (opcional)", en: "Diet type (optional)" },
  gymDaysLabel: { es: "Días de entrenamiento por semana", en: "Training days per week" },
  expLevelLabel: { es: "Nivel de experiencia", en: "Experience level" },
  equipmentLabel: { es: "Equipamiento disponible", en: "Available equipment" },
  intensityLabel: { es: "Intensidad", en: "Intensity" },
  intensityFixedBasic: {
    es: "(Fija en Leve para objetivos básicos)",
    en: "(Fixed to Light for basic goals)",
  },

  expBeginner: { es: "Principiante", en: "Beginner" },
  expIntermediate: { es: "Intermedio", en: "Intermediate" },
  expAdvanced: { es: "Avanzado", en: "Advanced" },
  eqGym: { es: "Gimnasio completo", en: "Full gym" },
  eqHome: { es: "Casa con mancuernas", en: "Home with dumbbells" },
  eqNone: { es: "Sin equipo", en: "No equipment" },

  optGroupGoalBasic: { es: "Objetivos básicos · Para empezar", en: "Basic goals · To get started" },
  optGroupGoalAdv: { es: "Objetivos avanzados", en: "Advanced goals" },
  optGroupGoalAthlete: { es: "Para atletas y deportistas", en: "For athletes" },
  optGroupGoalPhases: { es: "Transformación con fases", en: "Phased transformation" },

  optGroupDietBasic: { es: "Dietas básicas", en: "Basic diets" },
  optGroupDietAdv: { es: "Dietas avanzadas", en: "Advanced diets" },

  optGroupIntAdv: { es: "Intensidades avanzadas", en: "Advanced intensities" },
  optGroupIntUltra: { es: "Ultra · Para atletas", en: "Ultra · For athletes" },

  weightGoalTitle: { es: "Peso objetivo final (kg)", en: "Target weight (kg)" },
  recommended: { es: "(Recomendado)", en: "(Recommended)" },
  optional: { es: "(Opcional)", en: "(Optional)" },
  weightGoalHintBulk: {
    es: "¿Peso objetivo ya DEFINIDO, con abdominales marcados? El plan calcula el peso de bulk necesario y las fases.",
    en: "What weight do you want to reach SHREDDED (visible abs)? The plan will estimate bulk weight and phases.",
  },
  weightGoalHintLean: {
    es: "¿Peso objetivo manteniendo la definición? El plan ajusta el superávit para minimizar la grasa.",
    en: "What weight do you want while staying lean? The plan will tune surplus to limit fat gain.",
  },
  weightGoalHintDefault: {
    es: "¿Peso objetivo? Ayuda a calcular mejor tu plan.",
    en: "What weight do you want to reach? This helps calibrate your plan.",
  },
  phWeightGoal: { es: "Ej:", en: "E.g." },

  projTitle: { es: "Proyección personalizada", en: "Personalized projection" },
  projBasedOn: { es: "basada en tus datos", en: "based on your data" },
  projPhaseBulk: { es: "Fase BULK", en: "BULK phase" },
  projPhaseCut: { es: "Fase CUT", en: "CUT phase" },
  projPhaseLean: { es: "Fase LEAN BULK continua", en: "Continuous LEAN BULK" },
  projMonths: { es: "meses", en: "months" },
  projTimeTotal: { es: "Tiempo total estimado", en: "Estimated total time" },
  projMuscleNet: { es: "Músculo neto a ganar", en: "Net muscle to gain" },
  projGainPerMonth: { es: "Ganancia/mes", en: "Gain/month" },
  projWeightToGain: { es: "Peso a ganar", en: "Weight to gain" },
  projMuscleEst: { es: "Músculo estimado", en: "Estimated muscle" },
  projTimeEst: { es: "Tiempo estimado", en: "Estimated time" },
  projKcalDay: { es: "kcal/día", en: "kcal/day" },
  projTdeeLine: { es: "Tu TDEE (mantenimiento): ~{n} kcal/día", en: "Your TDEE (maintenance): ~{n} kcal/day" },
  projTdeeBulk: { es: "(+{n} en bulk)", en: "(+{n} in bulk)" },
  projTdeeSurplus: { es: "(+{n} superávit controlado)", en: "(+{n} controlled surplus)" },
  projLeanNote: {
    es: "Lean bulk minimiza grasa (~10% vs ~20% en bulk tradicional).",
    en: "Lean bulk limits fat gain (~10% vs ~20% in classic bulk).",
  },
  projWithIntensity: { es: "Con intensidad {i}.", en: "With {i} intensity." },
  projFemale: { es: "Ajustado para metabolismo femenino.", en: "Adjusted for female metabolism." },
  projAge: { es: "Ajustado para tu edad.", en: "Adjusted for your age." },
  projAthlete: { es: "Progresión de avanzado.", en: "Advanced progression." },
  projIntensityPrefix: { es: "Intensidad:", en: "Intensity:" },

  prefsLabel: { es: "Preferencias (coma separadas)", en: "Preferences (comma-separated)" },
  restrLabel: { es: "Restricciones (coma separadas)", en: "Restrictions (comma-separated)" },
  pathLabel: { es: "Patologías (coma separadas)", en: "Conditions (comma-separated)" },
  painLabel: { es: "Dolores, lesiones o molestias (coma separadas)", en: "Pain, injuries or issues (comma-separated)" },
  phPrefs: { es: "ej: pollo, avena, salmón", en: "e.g. chicken, oats, salmon" },
  phRestr: { es: "ej: gluten, lácteos, cerdo", en: "e.g. gluten, dairy, pork" },
  phPath: {
    es: "ej: hígado graso, intolerancia a la lactosa, diabetes tipo 2",
    en: "e.g. fatty liver, lactose intolerance, type 2 diabetes",
  },
  phPain: { es: "ej: rodilla derecha, zona lumbar, hombro izquierdo", en: "e.g. right knee, lower back, left shoulder" },
  pathHint: {
    es: "Indica condiciones médicas relevantes para ajustar el plan nutricional",
    en: "List relevant medical conditions to adjust nutrition.",
  },
  painHint: {
    es: "Usamos esta información para adaptar el plan de entrenamiento y las recomendaciones de recuperación.",
    en: "We use this to adapt training and recovery guidance.",
  },
  routineCheck: { es: "Mantener comidas rutinarias (poca variación entre días)", en: "Keep routine meals (little day-to-day variation)" },
  routineCheckHint: {
    es: "Para quien prefiere repetir comidas (patata en déficit, pasta en volumen) y no pensar qué toca cada día. Se edita después.",
    en: "Ideal if you like repeating meals so you don't decide every day. You can change this later.",
  },

  back: { es: "Atrás", en: "Back" },
  next: { es: "Siguiente", en: "Next" },
  generating: { es: "Generando...", en: "Generating…" },
  generateFree: { es: "Generar mi plan gratis", en: "Generate my free plan" },

  errName: { es: "El nombre es requerido", en: "Name is required" },
  errAge: { es: "La edad es requerida", en: "Age is required" },
  errHeight: { es: "La altura es requerida", en: "Height is required" },
  errWeight: { es: "El peso es requerido", en: "Weight is required" },
  errGeneric: { es: "Ocurrió un error", en: "Something went wrong" },
  alertNeedAccount: {
    es: "Hace falta una cuenta para generar un plan",
    en: "You must be signed in to generate a plan",
  },
  retryGenerating: {
    es: "Reintentando generación del plan...",
    en: "Retrying plan generation…",
  },

  loadingTitle: { es: "Generando tu plan personalizado", en: "Generating your personalized plan" },
  loadingBody: {
    es: "Este proceso puede tardar hasta {t}. No cierres esta ventana ni recargues la página mientras preparamos tu plan.",
    en: "This may take up to {t}. Don't close or reload the page while we prepare your plan.",
  },
  loadingMinute: { es: "1 minuto", en: "1 minute" },
  timeLeft: { es: "Tiempo restante:", en: "Time left:" },

  checkPreparar: { es: "Chequeando datos", en: "Checking your data" },
  checkEnviar: { es: "Revisando por nuestros profesionales", en: "Review by our team" },
  checkRecibir: { es: "Generando planes personalizados", en: "Generating personalized plans" },
  checkValidar: { es: "Validando calidad del plan", en: "Validating plan quality" },
  checkPerfil: { es: "Guardando tu perfil", en: "Saving your profile" },
  checkPlan: { es: "Finalizando tu plan", en: "Finalizing your plan" },
  checkCompleto: { es: "¡Plan generado exitosamente!", en: "Plan generated successfully!" },
} as const;

export function cp(locale: AppLocale, key: keyof typeof createPlanForm): string {
  return createPlanForm[key][locale];
}

export function cpFmt(locale: AppLocale, key: keyof typeof createPlanForm, vars: Record<string, string | number>): string {
  let s: string = createPlanForm[key][locale] as string;
  for (const [k, v] of Object.entries(vars)) {
    s = s.split(`{${k}}`).join(String(v));
  }
  return s;
}

/** Descripciones largas por objetivo (info bajo el select) */
export const createPlanGoalLong: Record<Goal, B> = {
  perder_grasa: {
    es: "Reduce tu porcentaje de grasa corporal mediante un déficit calórico controlado. Para quien busca perder peso de forma saludable, mejorando tu composición corporal y salud general. El plan incluirá un déficit moderado de calorías mientras mantiene tus músculos.",
    en: "Lower body fat with a controlled calorie deficit. Ideal for healthy weight loss while improving body composition. The plan keeps a moderate deficit while preserving muscle.",
  },
  mantener: {
    es: "Mantiene el peso y la composición corporal actuales. Para quien ya está en un peso saludable y busca asentar hábitos. El plan sostiene la condición física sin mover apenas la báscula.",
    en: "Maintain your current weight and composition. Great if you're already at a healthy weight and want stable habits without big swings on the scale.",
  },
  ganar_masa: {
    es: "Aumenta tu masa muscular mediante un superávit calórico estratégico junto con entrenamiento de fuerza. Para quien busca ganar peso principalmente en forma de músculo. El plan te proporcionará las calorías y proteínas necesarias para construir músculo de forma eficiente.",
    en: "Build muscle with a strategic surplus and strength training. Best when you want weight gain to come mostly from muscle, with enough calories and protein to grow efficiently.",
  },
  recomposicion: {
    es: "Transforma tu cuerpo perdiendo grasa mientras ganas músculo al mismo tiempo. Este es el objetivo más desafiante pero también el más efectivo a largo plazo. Ideal para personas con experiencia en entrenamiento que buscan cambiar su composición corporal sin cambios drásticos en el peso.",
    en: "Lose fat and build muscle at the same time, the hardest but often most rewarding path long term. Best for experienced trainees who want recomposition without extreme scale changes.",
  },
  definicion: {
    es: "Reduce al máximo la grasa corporal manteniendo la mayor cantidad de músculo posible. Típicamente usado después de una fase de volumen para mostrar toda la masa muscular ganada. Requiere precisión en las calorías y macronutrientes para preservar el músculo.",
    en: "Strip fat while keeping as much muscle as possible, often after a bulk. Requires tight calorie and macro control to stay full while leaning out.",
  },
  volumen: {
    es: "Fase de ganancia de masa muscular con un enfoque en maximizar el crecimiento. Incluye un superávit calórico más generoso para apoyar el entrenamiento intenso y la recuperación. Ideal para etapas de construcción muscular donde el objetivo principal es ganar tamaño y fuerza.",
    en: "Muscle-building phase focused on maximum growth, with a larger surplus to fuel hard training and recovery. For blocks where size and strength are the priority.",
  },
  corte: {
    es: "Reducción agresiva de grasa corporal para alcanzar un porcentaje muy bajo. Usado típicamente antes de competencias o eventos. Requiere disciplina estricta y monitoreo cuidadoso. No es recomendable mantener por períodos prolongados sin supervisión profesional.",
    en: "Aggressive fat loss to reach very low body fat, often pre-competition. Needs strict discipline; not meant for long stretches without professional guidance.",
  },
  mantenimiento_avanzado: {
    es: "Optimiza tu nutrición para mantener tu composición corporal ideal mientras maximizas el rendimiento. Para personas experimentadas que buscan mantener un estado físico avanzado con precisión nutricional. Incluye estrategias avanzadas de timing de nutrientes y distribución.",
    en: "Fine-tune nutrition to hold your best look while maximizing performance. For advanced athletes who want precise nutrient timing and distribution.",
  },
  rendimiento_deportivo: {
    es: "Optimiza tu rendimiento atlético con nutrición periodizada según tu deporte. Incluye timing estratégico de nutrientes pre/post entrenamiento, carga de carbohidratos para competencias, y recuperación acelerada. Ideal para atletas amateurs y semi-profesionales que buscan mejorar su performance.",
    en: "Sport-specific periodized nutrition: fueling around sessions, carb loads for events, and faster recovery, great for serious amateur and semi-pro athletes.",
  },
  powerlifting: {
    es: "Maximiza tu fuerza en los tres grandes levantamientos (sentadilla, press de banca, peso muerto). Nutrición enfocada en fuerza máxima con alto consumo proteico, timing de carbohidratos para sesiones pesadas, y periodización según fases de entrenamiento. Ideal para powerlifters y entusiastas de la fuerza.",
    en: "Maximize the squat, bench, and deadlift with high protein, smart carbs on heavy days, and nutrition matched to training phases, built for powerlifters and strength athletes.",
  },
  resistencia: {
    es: "Optimiza tu capacidad aeróbica y resistencia para deportes de larga duración (running, ciclismo, triatlón, natación). Incluye estrategias de carga de glucógeno, hidratación avanzada, y nutrición durante el ejercicio prolongado. Alto énfasis en carbohidratos de calidad y recuperación.",
    en: "Support endurance sports (running, cycling, triathlon, swimming) with glycogen strategies, hydration, and fueling for long sessions, quality carbs and recovery first.",
  },
  atleta_elite: {
    es: "El nivel más exigente para atletas de alto rendimiento y competidores. Nutrición de precisión con macros exactos, suplementación estratégica, periodización nutricional avanzada y protocolos de recuperación élite. Requiere compromiso total y es ideal para quienes entrenan 2+ horas diarias.",
    en: "Elite-level precision: exact macros, smart supplements, advanced periodization, and recovery protocols, for athletes training 2+ hours daily and competing at the top.",
  },
  bulk_cut: {
    es: "🔄 BULK + CUT: El método clásico para ganar músculo y quedar definido. FASE 1 (Bulk): Superávit calórico para maximizar ganancia muscular, aceptando algo de grasa. FASE 2 (Cut): Déficit controlado para eliminar la grasa y revelar los músculos. Incluye señales claras de cuándo cambiar de fase y ajustes automáticos. Para quien busca ganar mucho músculo y después quedar con abdominales marcados.",
    en: "🔄 BULK + CUT: Build muscle then lean out. Phase 1 (bulk): surplus to grow, accepting some fat. Phase 2 (cut): controlled deficit to reveal muscle, with clear phase cues. Best when you want size first, then visible abs.",
  },
  lean_bulk: {
    es: "💎 LEAN BULK / Volumen Limpio: Gana músculo minimizando la grasa al máximo. Superávit calórico controlado (+300-400 kcal), cardio estratégico 2-3x/semana, y mini-cuts de 2-3 semanas cuando se acumula grasa. Va más lento que bulk+cut, pero se evita la fase de corte agresivo. Para quien busca progresar sin perder definición.",
    en: "💎 LEAN BULK: Gain muscle with minimal fat, small surplus (~300–400 kcal), strategic cardio 2–3×/week, and short mini-cuts if needed. Slower than bulk+cut but softer on aggressive dieting.",
  },
};

export const createPlanDietLong: Record<TipoDieta, B> = {
  estandar: {
    es: "Una alimentación equilibrada sin restricciones específicas. Incluye todos los grupos de alimentos: carnes, pescados, vegetales, frutas, cereales, legumbres y lácteos. Flexible y adaptable a diferentes objetivos nutricionales.",
    en: "Balanced eating without strict rules, all food groups included. Flexible for many goals.",
  },
  mediterranea: {
    es: "Basada en la alimentación tradicional de países mediterráneos. Rica en aceite de oliva, pescados, frutas, verduras, legumbres y granos integrales. Baja en carnes rojas y alimentos procesados. Asociada con beneficios para la salud cardiovascular y longevidad.",
    en: "Traditional Mediterranean pattern: olive oil, fish, produce, legumes, whole grains; less red meat and processed food, linked to heart health and longevity.",
  },
  vegana: {
    es: "Elimina todos los productos de origen animal. Basada en plantas: frutas, verduras, legumbres, granos, frutos secos y semillas. Requiere atención especial a nutrientes como B12, hierro y proteínas para asegurar una nutrición completa.",
    en: "Fully plant-based. Pay extra attention to B12, iron, and protein to stay complete.",
  },
  vegetariana: {
    es: "Elimina carnes y pescados pero incluye huevos y lácteos. Rica en vegetales, frutas, legumbres y granos. Más flexible que la vegana y puede ser más fácil alcanzar todos los nutrientes necesarios.",
    en: "No meat or fish; includes eggs and dairy, often easier to meet needs than strict vegan.",
  },
  keto: {
    es: "Alta en grasas y muy baja en carbohidratos (típicamente menos de 20-50g por día). Induce cetosis, donde el cuerpo quema grasa como combustible principal. Efectiva para pérdida de peso rápida, pero requiere disciplina estricta.",
    en: "Very low carb, high fat, often under 20–50 g carbs/day to promote ketosis. Can work fast for weight loss but needs consistency.",
  },
  paleo: {
    es: "Imita la alimentación de nuestros ancestros pre-agrícolas. Incluye carnes, pescados, huevos, frutas, verduras, frutos secos y semillas. Elimina granos, legumbres, lácteos y alimentos procesados. Enfocada en alimentos naturales y sin procesar.",
    en: "Whole foods emphasis: meat, fish, eggs, produce, nuts/seeds; avoids grains, legumes, dairy, and most processed items.",
  },
  low_carb: {
    es: "Reducción moderada de carbohidratos (típicamente 50-150g por día). Permite más flexibilidad que la keto mientras aún limita carbohidratos. Puede ayudar con pérdida de peso y control de azúcar en sangre.",
    en: "Moderate carb reduction (~50–150 g/day), more flexible than keto; can help weight and blood sugar control.",
  },
  flexitariana: {
    es: "Principalmente vegetariana pero permite consumo ocasional de carne o pescado. Combina los beneficios de una dieta basada en plantas con la flexibilidad de incluir proteínas animales cuando se desee. Ideal para transición hacia alimentación más vegetal.",
    en: "Mostly plant-based with occasional meat or fish, flexible step toward more plants.",
  },
  dash: {
    es: "Diseñada para reducir la presión arterial. Rica en frutas, verduras, granos integrales, lácteos bajos en grasa, proteínas magras y frutos secos. Limita sodio, azúcares añadidos y grasas saturadas. Recomendada por profesionales de salud para salud cardiovascular.",
    en: "Built to support healthy blood pressure, produce, whole grains, lean protein, low sodium and added sugar, often recommended for heart health.",
  },
  pescatariana: {
    es: "Vegetariana que incluye pescados y mariscos. Elimina carnes rojas, aves y otras carnes, pero permite pescados por su contenido de omega-3. Incluye huevos y lácteos. Combinación de beneficios vegetales con ácidos grasos esenciales del pescado.",
    en: "Vegetarian plus fish/seafood for omega-3s; typically includes eggs and dairy.",
  },
  atkins: {
    es: "Dieta baja en carbohidratos con fases progresivas. Comienza muy restrictiva (menos de 20g de carbohidratos) y gradualmente aumenta. Enfoque en proteínas, grasas saludables y vegetales sin almidón. Popular para pérdida de peso rápida inicial.",
    en: "Phased low-carb plan, starts very strict, then loosens. Focus on protein, fats, and non-starchy veg.",
  },
  sin_gluten: {
    es: "Elimina completamente el gluten (proteína en trigo, cebada, centeno). Esencial para personas con celiaquía o sensibilidad al gluten. Incluye arroz, maíz, quinoa, carnes, pescados, huevos, frutas y verduras. Requiere atención a etiquetas de alimentos procesados.",
    en: "Strictly gluten-free for celiac or sensitivity, watch labels on packaged foods.",
  },
  antiinflamatoria: {
    es: "Enfocada en reducir la inflamación crónica. Rica en omega-3, antioxidantes y alimentos integrales. Incluye pescados grasos, frutas, verduras, granos integrales, frutos secos, semillas y especias antiinflamatorias. Limita alimentos procesados, azúcares refinados y grasas trans.",
    en: "Emphasizes omega-3s, antioxidants, whole foods; limits processed items, refined sugar, and trans fats.",
  },
  mind: {
    es: "Combinación de dietas Mediterránea y DASH enfocada en salud cerebral. Prioriza verduras de hoja verde, frutos secos, bayas, legumbres, granos integrales, pescados, aves y aceite de oliva. Limita carnes rojas, manteca, margarina, queso, dulces y alimentos fritos. Asociada con reducción de riesgo de demencia y Alzheimer.",
    en: "MIND diet blend, greens, berries, nuts, fish, olive oil; limits fried foods, sweets, and butter, studied for brain health.",
  },
  clinica_mayo: {
    es: "Programa de 12 semanas enfocado en hábitos saludables y control de porciones. No cuenta calorías sino que enseña a elegir alimentos densos en nutrientes. Incluye todos los grupos alimentarios con énfasis en frutas, verduras, granos integrales y proteínas magras. Promueve pérdida de peso sostenible mediante cambios de estilo de vida.",
    en: "12-week Mayo-style habit program, portion control and nutrient-dense choices rather than strict calorie counting.",
  },
  tlc: {
    es: "Cambios Terapéuticos en el Estilo de Vida para reducir colesterol. Baja en grasas saturadas y colesterol. Rica en frutas, verduras, granos integrales y proteínas magras. Limita carnes rojas, lácteos enteros y alimentos procesados. Combinada con ejercicio regular. Recomendada por el Programa Nacional de Educación sobre el Colesterol.",
    en: "Therapeutic Lifestyle Changes, lower saturated fat and cholesterol; emphasize produce, whole grains, lean protein, and regular exercise.",
  },
  menopausia: {
    es: "Adaptada específicamente para mujeres en menopausia. Enfocada en manejar síntomas y prevenir aumento de peso. Rica en calcio (lácteos, vegetales de hoja verde), fitoestrógenos (soja, legumbres), proteínas magras y granos integrales. Limita azúcares refinados, cafeína y alcohol. Ayuda a mantener densidad ósea y equilibrio hormonal.",
    en: "Tailored for menopause, calcium-rich foods, soy/legumes, lean protein; limits excess sugar, caffeine, and alcohol to support bone and balance.",
  },
};

export const createPlanIntensityLong: Record<Intensidad, B> = {
  leve: {
    es: "Cambios graduales y sostenibles. Déficit o superávit calórico pequeño (200-300 kcal/día). Ideal para principiantes o quienes buscan cambios a largo plazo sin sacrificios extremos.",
    en: "Gradual, sustainable changes, small deficit or surplus (~200–300 kcal/day). Great for beginners and long-term consistency.",
  },
  moderada: {
    es: "Progresión equilibrada. Déficit o superávit calórico medio (400-500 kcal/día). Balance entre resultados y sostenibilidad. Recomendada para la mayoría de personas.",
    en: "Balanced pace, medium deficit or surplus (~400–500 kcal/day). Good balance of results and sustainability for most people.",
  },
  intensa: {
    es: "Cambios más agresivos para resultados más rápidos. Déficit o superávit calórico alto (600-800 kcal/día). Requiere mayor disciplina y puede ser más difícil de mantener a largo plazo.",
    en: "More aggressive for faster results, larger deficit or surplus (~600–800 kcal/day). Needs discipline and is harder to sustain long term.",
  },
  ultra: {
    es: "🔥 MÁXIMO RENDIMIENTO: Para atletas y personas comprometidas al 100%. Déficit o superávit extremo (800-1200 kcal/día). Entrenamiento de alta frecuencia (5-7 días/semana), dobles sesiones permitidas. Requiere experiencia previa, excelente recuperación y compromiso total. NO recomendado para principiantes.",
    en: "🔥 MAX EFFORT: For committed athletes, very large deficit or surplus (800–1200 kcal/day), high training frequency, possible doubles. Needs experience and recovery, not for beginners.",
  },
};

export function cpGoalLong(locale: AppLocale, g: Goal): string {
  return createPlanGoalLong[g][locale];
}
export function cpDietLong(locale: AppLocale, d: TipoDieta): string {
  return createPlanDietLong[d][locale];
}
export function cpIntensityLong(locale: AppLocale, i: Intensidad): string {
  return createPlanIntensityLong[i][locale];
}

/** Etiquetas cortas de cada <option> del select de objetivo */
export const createPlanGoalOption: Record<Goal, B> = {
  perder_grasa: { es: "Perder peso · Reducción simple de peso corporal", en: "Lose weight · Simple bodyweight reduction" },
  mantener: { es: "Mantener peso · Conservar tu peso actual", en: "Maintain weight · Keep your current weight" },
  ganar_masa: { es: "Aumentar peso · Ganancia simple de peso", en: "Gain weight · Simple weight gain" },
  recomposicion: {
    es: "Transformación total · Quema grasa y construye músculo a la vez",
    en: "Full transformation · Burn fat and build muscle together",
  },
  definicion: {
    es: "Definición extrema · Músculos marcados con bajo % de grasa",
    en: "Extreme definition · Shredded look with low body fat",
  },
  volumen: {
    es: "Hipertrofia máxima · Crecimiento muscular con periodización",
    en: "Maximum hypertrophy · Muscle growth with periodization",
  },
  corte: {
    es: "Corte avanzado · Bajar grasa preservando masa (más preciso que \"perder peso\")",
    en: "Advanced cut · Fat loss while keeping muscle (more precise than \"lose weight\")",
  },
  mantenimiento_avanzado: {
    es: "Mantenimiento élite · Optimización para atletas experimentados",
    en: "Elite maintenance · Optimization for advanced athletes",
  },
  rendimiento_deportivo: {
    es: "Rendimiento deportivo · Nutrición periodizada para tu deporte",
    en: "Sports performance · Periodized nutrition for your sport",
  },
  powerlifting: {
    es: "Powerlifting / fuerza · Máxima fuerza en squat, banco y peso muerto",
    en: "Powerlifting / strength · Max strength on squat, bench, deadlift",
  },
  resistencia: {
    es: "Resistencia / endurance · Running, ciclismo, triatlón, deportes largos",
    en: "Endurance · Running, cycling, triathlon, long-duration sports",
  },
  atleta_elite: {
    es: "Atleta élite · Máxima exigencia para alto rendimiento",
    en: "Elite athlete · Highest demand for top-level performance",
  },
  bulk_cut: {
    es: "Bulk + Cut · Gana músculo y luego define (abs visibles)",
    en: "Bulk + cut · Build muscle then get lean (visible abs)",
  },
  lean_bulk: {
    es: "Lean bulk · Músculo limpio, mínima grasa (sin corte agresivo)",
    en: "Lean bulk · Clean gains, minimal fat (no harsh cut)",
  },
};

export const createPlanDietOption: Record<TipoDieta, B> = {
  estandar: { es: "Estándar (sin restricciones)", en: "Standard (no restrictions)" },
  mediterranea: { es: "Mediterránea (aceite de oliva y pescados)", en: "Mediterranean (olive oil & fish)" },
  vegetariana: { es: "Vegetariana (sin carnes ni pescados)", en: "Vegetarian (no meat or fish)" },
  vegana: { es: "Vegana (solo origen vegetal)", en: "Vegan (plant-based only)" },
  low_carb: { es: "Low carb (carbos moderados bajos)", en: "Low carb (moderately low carbs)" },
  antiinflamatoria: {
    es: "Antiinflamatoria · Menos inflamación y mejor recuperación",
    en: "Anti-inflammatory · Less inflammation, better recovery",
  },
  atkins: { es: "Atkins · Baja en carbos por fases", en: "Atkins · Low carb in phases" },
  clinica_mayo: {
    es: "Clínica Mayo · Hábitos y porciones (12 semanas)",
    en: "Mayo Clinic · Habits & portions (12 weeks)",
  },
  dash: { es: "DASH · Presión arterial y corazón", en: "DASH · Blood pressure & heart health" },
  flexitariana: {
    es: "Flexitariana · Mayormente vegetal, flexible",
    en: "Flexitarian · Mostly plants, flexible",
  },
  keto: { es: "Keto · Muy baja en carbos, alta en grasas", en: "Keto · Very low carb, high fat" },
  mind: {
    es: "MIND · Cerebro (Mediterránea + DASH)",
    en: "MIND · Brain health (Mediterranean + DASH)",
  },
  menopausia: {
    es: "Menopausia · Mujeres en transición hormonal",
    en: "Menopause · Women in hormonal transition",
  },
  paleo: { es: "Paleo · Natural, sin procesados", en: "Paleo · Natural, minimally processed" },
  pescatariana: {
    es: "Pescatariana · Vegetal + pescado (omega-3)",
    en: "Pescatarian · Plants + fish (omega-3)",
  },
  sin_gluten: { es: "Sin gluten · Celiaquía / sensibilidad", en: "Gluten-free · Celiac / sensitivity" },
  tlc: { es: "TLC · Bajar colesterol (estilo de vida)", en: "TLC · Lower cholesterol (lifestyle)" },
};

export const createPlanIntensityOption: Record<Intensidad, B> = {
  leve: {
    es: "Leve · Cambios graduales y sostenibles",
    en: "Light · Gradual, sustainable changes",
  },
  moderada: {
    es: "Moderada · Balance resultados / sostenibilidad",
    en: "Moderate · Balance of results and sustainability",
  },
  intensa: {
    es: "Intensa · Resultados más rápidos, más disciplina",
    en: "Intense · Faster results, more discipline",
  },
  ultra: {
    es: "Ultra · Máximo rendimiento (solo muy comprometidos)",
    en: "Ultra · Maximum output (highly committed only)",
  },
};

export function cpGoalOpt(locale: AppLocale, g: Goal): string {
  return createPlanGoalOption[g][locale];
}
export function cpDietOpt(locale: AppLocale, d: TipoDieta): string {
  return createPlanDietOption[d][locale];
}
export function cpIntensityOpt(locale: AppLocale, i: Intensidad): string {
  return createPlanIntensityOption[i][locale];
}

/** Etiqueta corta de intensidad (proyección / resúmenes) */
const intensityTag: Record<Intensidad, B> = {
  leve: { es: "leve", en: "light" },
  moderada: { es: "moderada", en: "moderate" },
  intensa: { es: "intensa", en: "intense" },
  ultra: { es: "ultra", en: "ultra" },
};

export function cpIntensityTag(locale: AppLocale, i: Intensidad): string {
  return intensityTag[i][locale].toUpperCase();
}
