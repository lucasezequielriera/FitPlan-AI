export type IntakeFormLocale = "es" | "en";

export type ObjetivoPrincipal =
  | "perder_grasa"
  | "ganar_musculo"
  | "recomposicion"
  | "rendimiento"
  | "salud_general"
  | "post_parto"
  | "otro";

export interface IntakeFormState {
  nombreCompleto: string;
  email: string;
  whatsapp: string;
  servicioInteres: string;
  instagram: string;
  ciudadPais: string;
  edad: string;
  sexo: string;
  alturaCm: string;
  pesoKg: string;
  pesoObjetivoKg: string;
  objetivoPrincipal: ObjetivoPrincipal;
  objetivoSecundario: string;
  fechaObjetivo: string;
  enfermedadInfancia: string;
  experienciaEntrenamiento: string;
  horasSentado: string;
  pasosDiarios: string;
  diasEntrenaActualmente: string;
  diasEntrenaActualmenteDetalle: string;
  diasCompromisoEntrenamiento: string;
  diasCompromisoDetalle: string;
  diasDisponibles: string[];
  minutosPorSesion: string;
  horaEntrenamiento: string;
  duracionSesion: string;
  planLugar: string;
  materialCasa: string;
  dondeEntrena: string[];
  equipamientoDisponible: string[];
  lesionesDolores: string;
  cirugiasPrevias: string;
  medicacionSuplementos: string;
  diabetesTipo: string;
  hipertensionArterial: string;
  enfermedadCorazon: string;
  hipotiroidismo: string;
  colesterolTrigliceridos: string;
  molestiasDigestivasTipo: string;
  patologias: string;
  nivelEstres: string;
  calidadSueno: string;
  descansaBien: string;
  horasSueno: string;
  trabajoTurnos: string;
  diasTrabajo: string[];
  comidasPorDiaHorarios: string;
  apetito: string;
  momentoMasHambre: string;
  preferenciasAlimentos: Record<string, FoodPreference>;
  diaTipoComidas: string;
  desayunoHabitual: string;
  almuerzoHabitual: string;
  cenaHabitual: string;
  snacksBebidas: string;
  restriccionesAlergias: string;
  alimentosNoLeGustan: string;
  alimentosSiLeGustan: string;
  aguaPorDia: string;
  alcoholFrecuencia: string;
  fuma: string;
  digestion: string;
  suplementosActualesDetalle: string;
  quiereSuplementos: string;
  haHechoDietaAntes: string;
  dietaEnQueConsistia: string;
  dietaHaceCuanto: string;
  dietaCuantoTiempo: string;
  dietaQueTal: string;
  presupuestoComida: string;
  tiempoParaCocinar: string;
  objetivoRendimiento: string;
  objetivoEstetico: string;
  textoLibreFinal: string;
  motivacionPrincipal: string;
  dificultadActual: string;
  comentariosExtra: string;
  consentimiento: boolean;
}

export type FoodPreference = "gusta" | "no_gusta";

export const INTAKE_DIAS_SEMANA = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"] as const;
export const INTAKE_LUGARES_ENTRENO = ["Gimnasio", "Casa", "Aire libre"] as const;
export const INTAKE_EQUIPAMIENTO = [
  "Mancuernas",
  "Bandas elásticas",
  "Barra y discos",
  "Máquinas de gimnasio",
  "Banco",
  "Cinta/bicicleta",
  "Sin equipamiento",
] as const;

export const INTAKE_SERVICIOS = [
  "Entrenamiento personal presencial",
  "Coaching online",
  "Solo nutrición",
  "Pack completo",
] as const;

export const INTAKE_APETITO = ["bueno", "regular", "malo"] as const;
export const INTAKE_PLAN_LUGAR = ["Gimnasio", "Casa", "Ambos"] as const;

export const INTAKE_FOOD_GROUPS: ReadonlyArray<{
  group: string;
  emoji: string;
  foods: readonly string[];
}> = [
  {
    group: "Carnes",
    emoji: "🥩",
    foods: ["Pollo", "Pavo", "Ternera", "Cerdo", "Cordero", "Conejo", "Jamón", "Lomo", "Solomillo", "Hígado"],
  },
  {
    group: "Pescados y mariscos",
    emoji: "🐟",
    foods: ["Salmón", "Atún", "Merluza", "Bacalao", "Lubina", "Dorada", "Sardinas", "Gambas", "Langostinos", "Mejillones", "Pulpo", "Calamares"],
  },
  {
    group: "Verduras y hortalizas",
    emoji: "🥦",
    foods: ["Brócoli", "Espinacas", "Calabacín", "Pimiento", "Tomate", "Lechuga", "Cebolla", "Zanahoria", "Judías verdes", "Berenjena", "Coliflor", "Espárragos", "Champiñones", "Alcachofa", "Pepino"],
  },
  {
    group: "Frutas",
    emoji: "🍎",
    foods: ["Plátano", "Manzana", "Fresas", "Naranja", "Mandarina", "Uvas", "Sandía", "Melón", "Piña", "Kiwi", "Pera", "Melocotón", "Mango", "Arándanos"],
  },
  {
    group: "Otros alimentos",
    emoji: "🍳",
    foods: ["Arroz", "Pasta", "Pan", "Huevos", "Avena", "Patata", "Boniato", "Legumbres", "Quinoa", "Frutos secos", "Yogur", "Queso", "Leche", "Aceite de oliva", "Aguacate", "Tofu"],
  },
] as const;

const ALL_FOOD_NAMES = new Set(INTAKE_FOOD_GROUPS.flatMap((group) => group.foods));

export const INTAKE_INITIAL_STATE: IntakeFormState = {
  nombreCompleto: "",
  email: "",
  whatsapp: "",
  servicioInteres: "",
  instagram: "",
  ciudadPais: "",
  edad: "",
  sexo: "prefiero_no_decir",
  alturaCm: "",
  pesoKg: "",
  pesoObjetivoKg: "",
  objetivoPrincipal: "salud_general",
  objetivoSecundario: "",
  fechaObjetivo: "",
  enfermedadInfancia: "",
  experienciaEntrenamiento: "ninguna",
  horasSentado: "",
  pasosDiarios: "",
  diasEntrenaActualmente: "",
  diasEntrenaActualmenteDetalle: "",
  diasCompromisoEntrenamiento: "",
  diasCompromisoDetalle: "",
  diasDisponibles: [],
  minutosPorSesion: "",
  horaEntrenamiento: "",
  duracionSesion: "",
  planLugar: "Gimnasio",
  materialCasa: "",
  dondeEntrena: [],
  equipamientoDisponible: [],
  lesionesDolores: "",
  cirugiasPrevias: "",
  medicacionSuplementos: "",
  diabetesTipo: "no",
  hipertensionArterial: "no",
  enfermedadCorazon: "",
  hipotiroidismo: "no",
  colesterolTrigliceridos: "no",
  molestiasDigestivasTipo: "no",
  patologias: "",
  nivelEstres: "medio",
  calidadSueno: "regular",
  descansaBien: "si",
  horasSueno: "",
  trabajoTurnos: "",
  diasTrabajo: [],
  comidasPorDiaHorarios: "",
  apetito: "regular",
  momentoMasHambre: "",
  preferenciasAlimentos: {},
  diaTipoComidas: "",
  desayunoHabitual: "",
  almuerzoHabitual: "",
  cenaHabitual: "",
  snacksBebidas: "",
  restriccionesAlergias: "",
  alimentosNoLeGustan: "",
  alimentosSiLeGustan: "",
  aguaPorDia: "",
  alcoholFrecuencia: "nunca",
  fuma: "no",
  digestion: "",
  suplementosActualesDetalle: "",
  quiereSuplementos: "",
  haHechoDietaAntes: "no",
  dietaEnQueConsistia: "",
  dietaHaceCuanto: "",
  dietaCuantoTiempo: "",
  dietaQueTal: "",
  presupuestoComida: "",
  tiempoParaCocinar: "",
  objetivoRendimiento: "",
  objetivoEstetico: "",
  textoLibreFinal: "",
  motivacionPrincipal: "",
  dificultadActual: "",
  comentariosExtra: "",
  consentimiento: false,
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\+?[0-9\s()-]{7,20}$/;
const INSTAGRAM_REGEX = /^@?[a-zA-Z0-9._]{1,30}$/;
const TEXT_FIELDS_MAX = 2000;

type LoosePayload = Partial<IntakeFormState>;

function stringOf(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return "";
}

function numberOf(value: unknown): number | null {
  const raw = stringOf(value).replace(",", ".");
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function arrayOfStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string").map((v) => v.trim()).filter(Boolean);
}

function isSubset(values: string[], allowed: readonly string[]): boolean {
  return values.every((value) => allowed.includes(value));
}

function msg(locale: IntakeFormLocale, es: string, en: string): string {
  return locale === "en" ? en : es;
}

export function validateIntakeForm(payload: LoosePayload, locale: IntakeFormLocale = "es"): string[] {
  const errors: string[] = [];

  const nombreCompleto = stringOf(payload.nombreCompleto);
  const email = stringOf(payload.email).toLowerCase();
  const whatsapp = stringOf(payload.whatsapp);
  const instagram = stringOf(payload.instagram);
  const ciudadPais = stringOf(payload.ciudadPais);
  const edad = numberOf(payload.edad);
  const alturaCm = numberOf(payload.alturaCm);
  const pesoKg = numberOf(payload.pesoKg);
  const diasEntrenaActualmente = numberOf(payload.diasEntrenaActualmente);
  const diasCompromisoEntrenamiento = numberOf(payload.diasCompromisoEntrenamiento);
  const diasDisponibles = arrayOfStrings(payload.diasDisponibles);
  const dondeEntrena = arrayOfStrings(payload.dondeEntrena);
  const equipamiento = arrayOfStrings(payload.equipamientoDisponible);
  const diasTrabajo = arrayOfStrings(payload.diasTrabajo);
  const comidasPorDiaHorarios = stringOf(payload.comidasPorDiaHorarios);
  const objetivoRendimiento = stringOf(payload.objetivoRendimiento);
  const objetivoEstetico = stringOf(payload.objetivoEstetico);
  const preferenciasAlimentos =
    typeof payload.preferenciasAlimentos === "object" && payload.preferenciasAlimentos !== null
      ? (payload.preferenciasAlimentos as Record<string, unknown>)
      : {};
  const consentimiento = payload.consentimiento === true;

  if (!nombreCompleto) errors.push(msg(locale, "Por favor, introduce tu nombre completo.", "Please enter your full name."));
  if (!email) {
    errors.push(msg(locale, "Por favor, introduce tu email.", "Please enter your email."));
  } else if (!EMAIL_REGEX.test(email)) {
    errors.push(msg(locale, "Introduce un email válido.", "Enter a valid email address."));
  }

  if (!whatsapp) {
    errors.push(msg(locale, "Por favor, introduce tu WhatsApp.", "Please enter your WhatsApp number."));
  } else if (!PHONE_REGEX.test(whatsapp)) {
    errors.push(
      msg(
        locale,
        "Introduce un WhatsApp válido (con prefijo internacional si es posible).",
        "Enter a valid WhatsApp number (international prefix if possible).",
      ),
    );
  }

  if (instagram && !INSTAGRAM_REGEX.test(instagram)) {
    errors.push(msg(locale, "El usuario de Instagram no es válido.", "That Instagram handle doesn’t look valid."));
  }

  if (!ciudadPais) {
    errors.push(
      msg(
        locale,
        "Indica tu ciudad y país (por ejemplo: Madrid, España o Córdoba, Argentina).",
        "Enter your city and country (e.g. London, UK).",
      ),
    );
  }

  if (edad === null) {
    errors.push(msg(locale, "Por favor, introduce una edad válida.", "Please enter a valid age."));
  } else if (edad < 14 || edad > 100) {
    errors.push(msg(locale, "La edad debe estar entre 14 y 100 años.", "Age must be between 14 and 100."));
  }

  if (alturaCm === null) {
    errors.push(msg(locale, "Por favor, introduce una altura válida.", "Please enter a valid height."));
  } else if (alturaCm < 120 || alturaCm > 230) {
    errors.push(msg(locale, "La altura debe estar entre 120 y 230 cm.", "Height must be between 120 and 230 cm."));
  }

  if (pesoKg === null) {
    errors.push(msg(locale, "Por favor, introduce un peso válido.", "Please enter a valid weight."));
  } else if (pesoKg < 35 || pesoKg > 300) {
    errors.push(msg(locale, "El peso debe estar entre 35 y 300 kg.", "Weight must be between 35 and 300 kg."));
  }

  if (!comidasPorDiaHorarios) {
    errors.push(
      msg(locale, "Indica cuántas comidas haces al día y en qué horarios.", "Please state how many meals you eat and at what times."),
    );
  }

  if (diasEntrenaActualmente === null) {
    errors.push(
      msg(locale, "Indica cuántos días entrenas actualmente por semana.", "Please enter how many days per week you currently train."),
    );
  } else if (diasEntrenaActualmente < 0 || diasEntrenaActualmente > 7) {
    errors.push(
      msg(
        locale,
        "Los días que entrenas actualmente deben estar entre 0 y 7.",
        "Days you currently train must be between 0 and 7.",
      ),
    );
  }

  if (diasCompromisoEntrenamiento === null) {
    errors.push(
      msg(locale, "Indica cuántos días te comprometes a entrenar.", "Please enter how many days per week you commit to training."),
    );
  } else if (diasCompromisoEntrenamiento < 1 || diasCompromisoEntrenamiento > 7) {
    errors.push(
      msg(
        locale,
        "Los días de compromiso de entrenamiento deben estar entre 1 y 7.",
        "Committed training days must be between 1 and 7.",
      ),
    );
  }

  if (!objetivoRendimiento) {
    errors.push(
      msg(
        locale,
        "Indica qué te gustaría mejorar a nivel de rendimiento físico.",
        "Please describe what you want to improve physically.",
      ),
    );
  }

  if (!objetivoEstetico) {
    errors.push(
      msg(locale, "Indica qué te gustaría cambiar a nivel estético.", "Please describe what you want to change aesthetically."),
    );
  }

  if (diasDisponibles.length > 0 && !isSubset(diasDisponibles, INTAKE_DIAS_SEMANA)) {
    errors.push(msg(locale, "Los días seleccionados no son válidos.", "The selected days are not valid."));
  }

  if (dondeEntrena.length > 0 && !isSubset(dondeEntrena, INTAKE_LUGARES_ENTRENO)) {
    errors.push(msg(locale, "Los lugares de entrenamiento seleccionados no son válidos.", "The selected training locations are not valid."));
  }

  if (equipamiento.length > 0 && !isSubset(equipamiento, INTAKE_EQUIPAMIENTO)) {
    errors.push(msg(locale, "El equipamiento seleccionado no es válido.", "The selected equipment is not valid."));
  }

  if (diasTrabajo.length > 0 && !isSubset(diasTrabajo, INTAKE_DIAS_SEMANA)) {
    errors.push(msg(locale, "Los días de trabajo seleccionados no son válidos.", "The selected work days are not valid."));
  }

  const invalidFoodPreference = Object.entries(preferenciasAlimentos).find(([food, pref]) => {
    const validPreference = pref === "gusta" || pref === "no_gusta";
    return !ALL_FOOD_NAMES.has(food) || !validPreference;
  });
  if (invalidFoodPreference) {
    errors.push(
      msg(locale, "Las preferencias de alimentos contienen valores no válidos.", "Food preferences contain invalid values."),
    );
  }

  if (!consentimiento) {
    errors.push(
      msg(locale, "Debes aceptar el consentimiento para enviar el formulario.", "You must accept the consent to submit the form."),
    );
  }

  const textFields: Array<keyof IntakeFormState> = [
    "objetivoSecundario",
    "lesionesDolores",
    "cirugiasPrevias",
    "medicacionSuplementos",
    "patologias",
    "desayunoHabitual",
    "almuerzoHabitual",
    "cenaHabitual",
    "snacksBebidas",
    "restriccionesAlergias",
    "alimentosNoLeGustan",
    "alimentosSiLeGustan",
    "digestion",
    "motivacionPrincipal",
    "dificultadActual",
    "comentariosExtra",
  ];

  for (const field of textFields) {
    const value = stringOf(payload[field]);
    if (value.length > TEXT_FIELDS_MAX) {
      errors.push(
        msg(
          locale,
          `El campo "${field}" supera el máximo de ${TEXT_FIELDS_MAX} caracteres.`,
          `The field "${field}" exceeds the maximum of ${TEXT_FIELDS_MAX} characters.`,
        ),
      );
    }
  }

  return errors;
}
