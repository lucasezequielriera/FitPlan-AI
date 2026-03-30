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

export function validateIntakeForm(payload: LoosePayload): string[] {
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

  if (!nombreCompleto) errors.push("Por favor, introduce tu nombre completo.");
  if (!email) {
    errors.push("Por favor, introduce tu email.");
  } else if (!EMAIL_REGEX.test(email)) {
    errors.push("Introduce un email válido.");
  }

  if (!whatsapp) {
    errors.push("Por favor, introduce tu WhatsApp.");
  } else if (!PHONE_REGEX.test(whatsapp)) {
    errors.push("Introduce un WhatsApp válido (con prefijo internacional si es posible).");
  }

  if (instagram && !INSTAGRAM_REGEX.test(instagram)) {
    errors.push("El usuario de Instagram no es válido.");
  }

  if (!ciudadPais) {
    errors.push("Indica tu ciudad y país (por ejemplo: Madrid, España o Córdoba, Argentina).");
  }

  if (edad === null) {
    errors.push("Por favor, introduce una edad válida.");
  } else if (edad < 14 || edad > 100) {
    errors.push("La edad debe estar entre 14 y 100 años.");
  }

  if (alturaCm === null) {
    errors.push("Por favor, introduce una altura válida.");
  } else if (alturaCm < 120 || alturaCm > 230) {
    errors.push("La altura debe estar entre 120 y 230 cm.");
  }

  if (pesoKg === null) {
    errors.push("Por favor, introduce un peso válido.");
  } else if (pesoKg < 35 || pesoKg > 300) {
    errors.push("El peso debe estar entre 35 y 300 kg.");
  }

  if (!comidasPorDiaHorarios) {
    errors.push("Indica cuántas comidas haces al día y en qué horarios.");
  }

  if (diasEntrenaActualmente === null) {
    errors.push("Indica cuántos días entrenas actualmente por semana.");
  } else if (diasEntrenaActualmente < 0 || diasEntrenaActualmente > 7) {
    errors.push("Los días que entrenas actualmente deben estar entre 0 y 7.");
  }

  if (diasCompromisoEntrenamiento === null) {
    errors.push("Indica cuántos días te comprometes a entrenar.");
  } else if (diasCompromisoEntrenamiento < 1 || diasCompromisoEntrenamiento > 7) {
    errors.push("Los días de compromiso de entrenamiento deben estar entre 1 y 7.");
  }

  if (!objetivoRendimiento) {
    errors.push("Indica qué te gustaría mejorar a nivel de rendimiento físico.");
  }

  if (!objetivoEstetico) {
    errors.push("Indica qué te gustaría cambiar a nivel estético.");
  }

  if (diasDisponibles.length > 0 && !isSubset(diasDisponibles, INTAKE_DIAS_SEMANA)) {
    errors.push("Los días seleccionados no son válidos.");
  }

  if (dondeEntrena.length > 0 && !isSubset(dondeEntrena, INTAKE_LUGARES_ENTRENO)) {
    errors.push("Los lugares de entrenamiento seleccionados no son válidos.");
  }

  if (equipamiento.length > 0 && !isSubset(equipamiento, INTAKE_EQUIPAMIENTO)) {
    errors.push("El equipamiento seleccionado no es válido.");
  }

  if (diasTrabajo.length > 0 && !isSubset(diasTrabajo, INTAKE_DIAS_SEMANA)) {
    errors.push("Los días de trabajo seleccionados no son válidos.");
  }

  const invalidFoodPreference = Object.entries(preferenciasAlimentos).find(([food, pref]) => {
    const validPreference = pref === "gusta" || pref === "no_gusta";
    return !ALL_FOOD_NAMES.has(food) || !validPreference;
  });
  if (invalidFoodPreference) {
    errors.push("Las preferencias de alimentos contienen valores no válidos.");
  }

  if (!consentimiento) {
    errors.push("Debes aceptar el consentimiento para enviar el formulario.");
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
      errors.push(`El campo "${field}" supera el máximo de ${TEXT_FIELDS_MAX} caracteres.`);
    }
  }

  return errors;
}
