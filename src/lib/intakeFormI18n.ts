import {
  INTAKE_DIAS_SEMANA,
  INTAKE_FOOD_GROUPS,
  type IntakeFormLocale,
} from "@/lib/intakeFormSchema";

export type { IntakeFormLocale };

/** Índice alineado con INTAKE_DIAS_SEMANA (valores internos siempre en español). */
export const INTAKE_WEEKDAY_LABELS_EN = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

export function weekdayDisplay(diaEs: string, locale: IntakeFormLocale): string {
  const i = INTAKE_DIAS_SEMANA.indexOf(diaEs as (typeof INTAKE_DIAS_SEMANA)[number]);
  if (i < 0) return diaEs;
  return locale === "en" ? INTAKE_WEEKDAY_LABELS_EN[i] : diaEs;
}

const SERVICIO_EN: Record<string, string> = {
  "Entrenamiento personal presencial": "In-person personal training",
  "Coaching online": "Online coaching",
  "Solo nutrición": "Nutrition only",
  "Pack completo": "Full package",
};

const EQUIP_EN: Record<string, string> = {
  Mancuernas: "Dumbbells",
  "Bandas elásticas": "Resistance bands",
  "Barra y discos": "Barbell & plates",
  "Máquinas de gimnasio": "Gym machines",
  Banco: "Bench",
  "Cinta/bicicleta": "Treadmill / bike",
  "Sin equipamiento": "No equipment",
};

const PLAN_LUGAR_EN: Record<string, string> = {
  Gimnasio: "Gym",
  Casa: "Home",
  Ambos: "Both",
};

export function labelServicio(value: string, locale: IntakeFormLocale): string {
  if (!value) return "";
  return locale === "en" ? SERVICIO_EN[value] ?? value : value;
}

export function labelEquipamiento(value: string, locale: IntakeFormLocale): string {
  return locale === "en" ? EQUIP_EN[value] ?? value : value;
}

export function labelPlanLugar(value: string, locale: IntakeFormLocale): string {
  return locale === "en" ? PLAN_LUGAR_EN[value] ?? value : value;
}

/** Nombres de grupo y alimentos solo para mostrar; las claves siguen siendo las del schema (ES). */
const GROUP_TITLE_EN: Record<string, string> = {
  Carnes: "Meats",
  "Pescados y mariscos": "Fish & seafood",
  "Verduras y hortalizas": "Vegetables",
  Frutas: "Fruit",
  "Otros alimentos": "Other foods",
};

const FOOD_EN: Record<string, string> = {
  Pollo: "Chicken",
  Pavo: "Turkey",
  Ternera: "Beef",
  Cerdo: "Pork",
  Cordero: "Lamb",
  Conejo: "Rabbit",
  Jamón: "Ham",
  Lomo: "Loin",
  Solomillo: "Sirloin",
  Hígado: "Liver",
  Salmón: "Salmon",
  Atún: "Tuna",
  Merluza: "Hake",
  Bacalao: "Cod",
  Lubina: "Sea bass",
  Dorada: "Sea bream",
  Sardinas: "Sardines",
  Gambas: "Shrimp",
  Langostinos: "Prawns",
  Mejillones: "Mussels",
  Pulpo: "Octopus",
  Calamares: "Squid",
  Brócoli: "Broccoli",
  Espinacas: "Spinach",
  Calabacín: "Zucchini",
  Pimiento: "Bell pepper",
  Tomate: "Tomato",
  Lechuga: "Lettuce",
  Cebolla: "Onion",
  Zanahoria: "Carrot",
  "Judías verdes": "Green beans",
  Berenjena: "Eggplant",
  Coliflor: "Cauliflower",
  Espárragos: "Asparagus",
  Champiñones: "Mushrooms",
  Alcachofa: "Artichoke",
  Pepino: "Cucumber",
  Plátano: "Banana",
  Manzana: "Apple",
  Fresas: "Strawberries",
  Naranja: "Orange",
  Mandarina: "Tangerine",
  Uvas: "Grapes",
  Sandía: "Watermelon",
  Melón: "Melon",
  Piña: "Pineapple",
  Kiwi: "Kiwi",
  Pera: "Pear",
  Melocotón: "Peach",
  Mango: "Mango",
  Arándanos: "Blueberries",
  Arroz: "Rice",
  Pasta: "Pasta",
  Pan: "Bread",
  Huevos: "Eggs",
  Avena: "Oats",
  Patata: "Potato",
  Boniato: "Sweet potato",
  Legumbres: "Legumes",
  Quinoa: "Quinoa",
  "Frutos secos": "Nuts",
  Yogur: "Yogurt",
  Queso: "Cheese",
  Leche: "Milk",
  "Aceite de oliva": "Olive oil",
  Aguacate: "Avocado",
  Tofu: "Tofu",
};

export function foodLabel(foodEs: string, locale: IntakeFormLocale): string {
  if (locale === "es") return foodEs;
  return FOOD_EN[foodEs] ?? foodEs;
}

export function foodGroupTitle(groupEs: string, locale: IntakeFormLocale): string {
  if (locale === "es") return groupEs;
  return GROUP_TITLE_EN[groupEs] ?? groupEs;
}

export function getIntakeFoodGroupsForUi(locale: IntakeFormLocale) {
  return INTAKE_FOOD_GROUPS.map((g) => ({
    ...g,
    group: foodGroupTitle(g.group, locale),
    foods: g.foods.map((f) => ({ key: f, label: foodLabel(f, locale) })),
  }));
}

export interface IntakeFormCopy {
  metaTitle: string;
  metaDescription: string;
  heroEyebrow: string;
  heroTitle: string;
  heroBody: string;
  /** Texto antes del rango en negrita (ej. "Estimated time: ") */
  heroTimePrefix: string;
  /** Rango en negrita (ej. "8-12 min") */
  heroTimeBold: string;
  /** Texto después del rango */
  heroTimeSuffix: string;
  selectPlaceholder: string;
  submitSending: string;
  submitCta: string;
  successMsg: string;
  submitErrorGeneric: string;
  consentText: string;
  modalClose: string;
  modalLine1: string;
  modalLine2: string;
  modalLine3: string;
  modalTitle: string;
  sections: {
    s1: string;
    s2: string;
    s3: string;
    s4: string;
    s4intro: string;
    s5: string;
    s6: string;
    s6intro: string;
    s7: string;
    s8: string;
  };
  detailsMoreTraining: string;
  detailsHealth: string;
  foodHelpTitle: string;
  foodHelpBody: string;
  workDaysQuestion: string;
  trainingDaysQuestion: string;
  equipmentQuestion: string;
}

const COPY_ES: IntakeFormCopy = {
  metaTitle: "Formulario de Inicio | FitPlan AI",
  metaDescription:
    "Formulario inicial para clientes de entrenamiento y nutrición personalizada con FitPlan.",
  heroEyebrow: "FitPlan · Seguimiento 1:1",
  heroTitle: "Formulario de inicio personalizado",
  heroBody:
    "Este formulario es para crear tu plan 1:1 de entrenamiento y nutrición. No hace falta saber nada técnico: respondé con calma y con sinceridad.",
  heroTimePrefix: "Tiempo estimado: ",
  heroTimeBold: "8-12 min",
  heroTimeSuffix: " · cuanto más detalle des, mejor se adaptará tu plan",
  selectPlaceholder: "Seleccionar...",
  submitSending: "Enviando...",
  submitCta: "Enviar formulario",
  successMsg: "¡Perfecto, ya enviaste el formulario! Te hablaré por WhatsApp para iniciar el proceso.",
  submitErrorGeneric: "No se pudo enviar el formulario.",
  consentText:
    "Confirmo que los datos son reales y autorizo su uso para que Lucas cree mi plan personalizado de entrenamiento y nutrición.",
  modalClose: "Cerrar",
  modalTitle: "¡Buenísimo, este es tu punto de inicio!",
  modalLine1:
    "Voy a leer tu formulario personalmente y, a partir de ahí, empezamos con tu cambio. Lo más importante es que ya diste el primer paso.",
  modalLine2:
    "Si aplicas lo que te vaya proponiendo con constancia, vas a notar cambios rápido y, sobre todo, te vas a sentir mucho mejor física y mentalmente.",
  modalLine3: "Vamos a por ello. Estoy contigo en este proceso.",
  sections: {
    s1: "Cuéntame sobre ti",
    s2: "Objetivo y tiempos",
    s3: "Entrenamiento actual y disponibilidad",
    s4: "Salud y antecedentes",
    s4intro: "Esta parte es clave para adaptar el plan de forma segura.",
    s5: "Hábitos de vida",
    s6: "Alimentación actual",
    s6intro: "No busques responder “perfecto”: contanos cómo comés hoy normalmente.",
    s7: "Motivación y seguimiento",
    s8: "Confirmación y envío",
  },
  detailsMoreTraining: "Ver más preguntas opcionales de entrenamiento",
  detailsHealth: "Completar preguntas de salud",
  foodHelpTitle: "Tus preferencias de alimentos",
  foodHelpBody:
    "Pulsa una vez = me gusta, pulsa otra vez = no me gusta, y una tercera = sin marcar. Los no marcados se tomarán como neutros.",
  workDaysQuestion: "¿Qué días de la semana trabaja?",
  trainingDaysQuestion: "Días concretos en los que te comprometes a entrenar (si puedes)",
  equipmentQuestion: "Equipamiento disponible (si aplica)",
};

const COPY_EN: IntakeFormCopy = {
  metaTitle: "Intake Form | FitPlan AI",
  metaDescription: "Personal training & nutrition intake form for your 1:1 FitPlan.",
  heroEyebrow: "FitPlan · 1:1 coaching",
  heroTitle: "Personalized intake form",
  heroBody:
    "This form helps us build your 1:1 training and nutrition plan. You don’t need any technical knowledge—answer honestly and take your time.",
  heroTimePrefix: "Estimated time: ",
  heroTimeBold: "8-12 min",
  heroTimeSuffix: " · the more detail you give, the better we can tailor your plan",
  selectPlaceholder: "Select…",
  submitSending: "Sending…",
  submitCta: "Submit form",
  successMsg: "All set—we received your form! I’ll reach out on WhatsApp to get started.",
  submitErrorGeneric: "We couldn’t submit the form.",
  consentText:
    "I confirm the information is accurate and I authorise its use so Lucas can build my personalised training and nutrition plan.",
  modalClose: "Close",
  modalTitle: "Great—this is your starting point!",
  modalLine1:
    "I’ll read your form personally and we’ll take it from there. The important thing is you’ve already taken the first step.",
  modalLine2:
    "If you stay consistent with what we set out, you’ll notice changes quickly—and you’ll feel better physically and mentally.",
  modalLine3: "Let’s do this. I’m with you in this process.",
  sections: {
    s1: "About you",
    s2: "Goals & timeline",
    s3: "Current training & availability",
    s4: "Health & history",
    s4intro: "This section helps us adapt your plan safely.",
    s5: "Lifestyle habits",
    s6: "Current nutrition",
    s6intro: "No need for “perfect” answers—tell us how you usually eat today.",
    s7: "Motivation & follow-up",
    s8: "Confirmation & submit",
  },
  detailsMoreTraining: "More optional training questions",
  detailsHealth: "Health questions",
  foodHelpTitle: "Food preferences",
  foodHelpBody: "Tap once = like, twice = dislike, a third time = neutral. Unmarked items count as neutral.",
  workDaysQuestion: "Which days do you usually work?",
  trainingDaysQuestion: "Specific days you can commit to training (if you know them)",
  equipmentQuestion: "Equipment available (if any)",
};

export function getIntakeFormCopy(locale: IntakeFormLocale): IntakeFormCopy {
  return locale === "en" ? COPY_EN : COPY_ES;
}

/** Etiquetas de campos (largas): se exportan como función para mantener el archivo manejable. */
export function getFieldLabels(locale: IntakeFormLocale) {
  const es = {
    nombreCompleto: "Nombre completo *",
    email: "Email *",
    whatsapp: "WhatsApp *",
    phWhatsapp: "E.g. +34 6XX XXX XXX",
    instagram: "Instagram (opcional)",
    phInstagram: "E.g. @yourhandle",
    ciudadPais: "¿De qué ciudad y país eres? *",
    phCiudad: "E.g. London, UK / Austin, USA",
    servicio: "¿Qué servicio te interesa?",
    edad: "Edad *",
    sexo: "Sexo",
    altura: "Altura (cm) *",
    peso: "Peso actual (kg) *",
    pesoObj: "Peso objetivo (kg)",
    objPrincipal: "Objetivo principal *",
    fechaObj: "Fecha objetivo (si la tienes)",
    objSec: "Objetivo secundario o detalle",
    phObjSec: "E.g. lose waist size without losing strength, better posture…",
    diasEntrenaAhora: "¿Cuántos días entrenas ahora por semana? *",
    diasCompromiso: "¿Cuántos días te comprometes a entrenar? *",
    horaEntreno: "¿Sobre qué hora entrenarías?",
    phHora: "E.g. 7:00, 2:30 PM, 8:00 PM",
    duracion: "¿Cuánto dura una sesión?",
    phDuracion: "E.g. 60 minutes",
    planLugar: "¿El plan lo quieres para casa, gimnasio o ambos?",
    materialCasa: "Si entrenas en casa, ¿qué material tienes?",
    phMaterial: "E.g. dumbbells, bands, bench…",
    phDiasN: "E.g. 3",
    expEntreno: "Experiencia entrenando",
    minSesion: "Minutos por sesión que puedes dedicar",
    horasSentado: "Horas sentado al día (aprox.)",
    pasos: "Pasos diarios (si lo sabes)",
    enfInfancia: "¿Has tenido alguna enfermedad desde pequeño/a? ¿Cuál?",
    lesiones: "Dolores o lesiones actuales",
    phLesiones: "E.g. knee, shoulder or lower back pain…",
    cirugias: "Cirugías previas relevantes",
    medicacion: "Medicación y suplementos actuales",
    patologias: "Patologías o diagnósticos médicos",
    phPat: "E.g. hypertension, diabetes…",
    diabetes: "¿Tienes diabetes?",
    hipertension: "¿Tienes hipertensión arterial?",
    corazon: "¿Tienes alguna enfermedad del corazón? ¿Cuál?",
    hipotiroidismo: "¿Tienes hipotiroidismo?",
    colesterol: "¿Colesterol alto y/o triglicéridos?",
    digestivo: "¿Tienes estreñimiento, colon irritable o dolores digestivos?",
    descansa: "¿Descansas bien?",
    estres: "Nivel de estrés",
    suenoCalidad: "Calidad del sueño",
    horasSueno: "Horas de sueño por noche",
    phHs: "E.g. 6.5",
    trabajoHoras: "¿Cuántas horas por día trabajas? *",
    phTrabajo: "E.g. 8 h, 10 h, part-time…",
    comidasHorarios: "¿Cuántas comidas haces al día y en qué horarios? *",
    phComidas: "E.g. 4 meals — 8:00, 12:30, 5:00, 9:00 PM",
    apetito: "¿Cómo describirías tu apetito?",
    masHambre: "¿En qué momento del día tienes más hambre?",
    snacks: "Snacks y bebidas frecuentes",
    alergias: "Alergias/restricciones alimentarias",
    agua: "Agua al día (aprox.)",
    phAgua: "E.g. 2 litres",
    alcohol: "Alcohol",
    fuma: "Fuma",
    digestion: "Digestión/molestias (hinchazón, acidez, etc.)",
    presupuesto: "Presupuesto para comida (aprox.)",
    phPres: "E.g. low / medium / high",
    tiempoCocinar: "Tiempo real para cocinar al día",
    phCocinar: "E.g. 20 min, 1 h, meal prep Sundays…",
    diaTipo: "Cuéntame un día tipo: ¿qué comes desde que te levantas hasta que te acuestas? *",
    suplementos: "¿Tomas suplementos? ¿Cuáles y de qué marca?",
    quiereSup: "Si no tomas suplementos, ¿te gustaría empezar con alguno?",
    dietaAntes: "¿Has hecho alguna dieta antes?",
    dietaBase: "¿En qué se basaba?",
    dietaCuando: "¿Hace cuánto la hiciste?",
    dietaCuanto: "¿Durante cuánto tiempo?",
    dietaTal: "¿Qué tal te fue?",
    objRend: "A nivel de rendimiento físico, ¿qué te gustaría mejorar? *",
    objEst: "A nivel estético, ¿qué te gustaría cambiar? *",
    motivacion: "¿Por qué quieres empezar ahora?",
    dificultad: "¿Qué te está costando hoy para lograrlo?",
    comentarios: "Comentarios extra",
    textoLibre: "¿Algo más que quieras contarme? (opcional)",
  };
  const en: typeof es = {
    nombreCompleto: "Full name *",
    email: "Email *",
    whatsapp: "WhatsApp *",
    phWhatsapp: "E.g. +1 555 123 4567",
    instagram: "Instagram (optional)",
    phInstagram: "E.g. @yourhandle",
    ciudadPais: "City & country *",
    phCiudad: "E.g. London, UK / Austin, USA",
    servicio: "Which service are you interested in?",
    edad: "Age *",
    sexo: "Sex",
    altura: "Height (cm) *",
    peso: "Current weight (kg) *",
    pesoObj: "Target weight (kg)",
    objPrincipal: "Main goal *",
    fechaObj: "Target date (if any)",
    objSec: "Secondary goal or detail",
    phObjSec: "E.g. trim waist without losing strength, better posture…",
    diasEntrenaAhora: "How many days per week do you train now? *",
    diasCompromiso: "How many days per week will you commit to? *",
    horaEntreno: "What time of day would you usually train?",
    phHora: "E.g. 7:00, 2:30 PM, 8:00 PM",
    duracion: "How long is a session?",
    phDuracion: "E.g. 60 minutes",
    planLugar: "Do you want the plan for home, gym, or both?",
    materialCasa: "If training at home, what equipment do you have?",
    phMaterial: "E.g. dumbbells, bands, bench…",
    phDiasN: "E.g. 3",
    expEntreno: "Training experience",
    minSesion: "Minutes per session you can dedicate",
    horasSentado: "Approx. hours sitting per day",
    pasos: "Daily steps (if known)",
    enfInfancia: "Any childhood illness? Which one?",
    lesiones: "Current pain or injuries",
    phLesiones: "E.g. knee, shoulder or lower back…",
    cirugias: "Relevant past surgeries",
    medicacion: "Current medication & supplements",
    patologias: "Medical conditions or diagnoses",
    phPat: "E.g. hypertension, diabetes…",
    diabetes: "Do you have diabetes?",
    hipertension: "Do you have high blood pressure?",
    corazon: "Any heart condition? Which one?",
    hipotiroidismo: "Do you have hypothyroidism?",
    colesterol: "High cholesterol and/or triglycerides?",
    digestivo: "Constipation, IBS or digestive pain?",
    descansa: "Do you rest well?",
    estres: "Stress level",
    suenoCalidad: "Sleep quality",
    horasSueno: "Hours of sleep per night",
    phHs: "E.g. 6.5",
    trabajoHoras: "How many hours per day do you work? *",
    phTrabajo: "E.g. 8 h, 10 h, part-time…",
    comidasHorarios: "How many meals per day and at what times? *",
    phComidas: "E.g. 4 meals — 8:00 AM, 12:30 PM, 5:00 PM, 9:00 PM",
    apetito: "How would you describe your appetite?",
    masHambre: "When are you hungriest during the day?",
    snacks: "Frequent snacks & drinks",
    alergias: "Allergies / dietary restrictions",
    agua: "Water per day (approx.)",
    phAgua: "E.g. 2 litres",
    alcohol: "Alcohol",
    fuma: "Smoking",
    digestion: "Digestion issues (bloating, reflux, etc.)",
    presupuesto: "Food budget (approx.)",
    phPres: "E.g. low / medium / high",
    tiempoCocinar: "Realistic time to cook per day",
    phCocinar: "E.g. 20 min, 1 h, Sunday meal prep…",
    diaTipo: "A typical day of eating: from wake-up to bedtime *",
    suplementos: "Supplements? Which ones and brand?",
    quiereSup: "If none, would you like to start any?",
    dietaAntes: "Have you dieted before?",
    dietaBase: "What was it based on?",
    dietaCuando: "How long ago?",
    dietaCuanto: "For how long?",
    dietaTal: "How did it go?",
    objRend: "Physically, what would you like to improve? *",
    objEst: "Aesthetically, what would you like to change? *",
    motivacion: "Why do you want to start now?",
    dificultad: "What’s hardest for you right now?",
    comentarios: "Extra comments",
    textoLibre: "Anything else? (optional)",
  };
  return locale === "en" ? en : es;
}

export function selectOptions(locale: IntakeFormLocale) {
  const es = {
    sexo: [
      { v: "masculino", l: "Masculino" },
      { v: "femenino", l: "Femenino" },
      { v: "prefiero_no_decir", l: "Prefiero no decir" },
    ],
    objetivo: [
      { v: "perder_grasa", l: "Perder grasa" },
      { v: "ganar_musculo", l: "Ganar músculo" },
      { v: "recomposicion", l: "Perder grasa y ganar músculo" },
      { v: "rendimiento", l: "Rendir mejor en deporte" },
      { v: "salud_general", l: "Sentirme mejor y estar saludable" },
      { v: "post_parto", l: "Recuperación posparto" },
      { v: "otro", l: "Otro" },
    ],
    experiencia: [
      { v: "ninguna", l: "Nunca he entrenado" },
      { v: "principiante", l: "Principiante (menos de 6 meses)" },
      { v: "intermedio", l: "Intermedio (6 meses a 2 años)" },
      { v: "avanzado", l: "Avanzado (más de 2 años)" },
    ],
    siNo: [
      { v: "no", l: "No" },
      { v: "si", l: "Sí" },
    ],
    diabetes: [
      { v: "no", l: "No" },
      { v: "tipo_i", l: "Diabetes tipo I" },
      { v: "tipo_ii", l: "Diabetes tipo II" },
    ],
    colesterol: [
      { v: "no", l: "No" },
      { v: "colesterol_alto", l: "Colesterol alto" },
      { v: "trigliceridos_altos", l: "Triglicéridos altos" },
      { v: "ambos", l: "Ambos" },
    ],
    digestivo: [
      { v: "no", l: "No" },
      { v: "estrenimiento", l: "Estreñimiento" },
      { v: "colon_irritable", l: "Colon irritable" },
      { v: "dolores_digestivos", l: "Dolores digestivos" },
      { v: "varios", l: "Varios de estos" },
    ],
    descansa: [
      { v: "si", l: "Sí" },
      { v: "regular", l: "Regular" },
      { v: "no", l: "No" },
    ],
    estres: [
      { v: "bajo", l: "Bajo" },
      { v: "medio", l: "Medio" },
      { v: "alto", l: "Alto" },
    ],
    calidadSueno: [
      { v: "mala", l: "Mala" },
      { v: "regular", l: "Regular" },
      { v: "buena", l: "Buena" },
    ],
    apetito: [
      { v: "bueno", l: "Bueno" },
      { v: "regular", l: "Regular" },
      { v: "malo", l: "Malo" },
    ],
    alcohol: [
      { v: "nunca", l: "Nunca" },
      { v: "ocasional", l: "Ocasional" },
      { v: "semanal", l: "Semanal" },
      { v: "frecuente", l: "Frecuente" },
    ],
    fuma: [
      { v: "no", l: "No" },
      { v: "si", l: "Sí" },
      { v: "ocasional", l: "Ocasional" },
    ],
    dietaAntes: [
      { v: "no", l: "No" },
      { v: "si", l: "Sí" },
    ],
  };
  const en = {
    sexo: [
      { v: "masculino", l: "Male" },
      { v: "femenino", l: "Female" },
      { v: "prefiero_no_decir", l: "Prefer not to say" },
    ],
    objetivo: [
      { v: "perder_grasa", l: "Lose fat" },
      { v: "ganar_musculo", l: "Build muscle" },
      { v: "recomposicion", l: "Lose fat & build muscle" },
      { v: "rendimiento", l: "Perform better in sport" },
      { v: "salud_general", l: "Feel better & stay healthy" },
      { v: "post_parto", l: "Postpartum recovery" },
      { v: "otro", l: "Other" },
    ],
    experiencia: [
      { v: "ninguna", l: "Never trained" },
      { v: "principiante", l: "Beginner (< 6 months)" },
      { v: "intermedio", l: "Intermediate (6 months – 2 years)" },
      { v: "avanzado", l: "Advanced (> 2 years)" },
    ],
    siNo: [
      { v: "no", l: "No" },
      { v: "si", l: "Yes" },
    ],
    diabetes: [
      { v: "no", l: "No" },
      { v: "tipo_i", l: "Type I diabetes" },
      { v: "tipo_ii", l: "Type II diabetes" },
    ],
    colesterol: [
      { v: "no", l: "No" },
      { v: "colesterol_alto", l: "High cholesterol" },
      { v: "trigliceridos_altos", l: "High triglycerides" },
      { v: "ambos", l: "Both" },
    ],
    digestivo: [
      { v: "no", l: "No" },
      { v: "estrenimiento", l: "Constipation" },
      { v: "colon_irritable", l: "IBS" },
      { v: "dolores_digestivos", l: "Digestive pain" },
      { v: "varios", l: "Several of these" },
    ],
    descansa: [
      { v: "si", l: "Yes" },
      { v: "regular", l: "Okay" },
      { v: "no", l: "No" },
    ],
    estres: [
      { v: "bajo", l: "Low" },
      { v: "medio", l: "Medium" },
      { v: "alto", l: "High" },
    ],
    calidadSueno: [
      { v: "mala", l: "Poor" },
      { v: "regular", l: "Okay" },
      { v: "buena", l: "Good" },
    ],
    apetito: [
      { v: "bueno", l: "Good" },
      { v: "regular", l: "Okay" },
      { v: "malo", l: "Poor" },
    ],
    alcohol: [
      { v: "nunca", l: "Never" },
      { v: "ocasional", l: "Occasionally" },
      { v: "semanal", l: "Weekly" },
      { v: "frecuente", l: "Often" },
    ],
    fuma: [
      { v: "no", l: "No" },
      { v: "si", l: "Yes" },
      { v: "ocasional", l: "Occasionally" },
    ],
    dietaAntes: [
      { v: "no", l: "No" },
      { v: "si", l: "Yes" },
    ],
  };
  return locale === "en" ? en : es;
}
