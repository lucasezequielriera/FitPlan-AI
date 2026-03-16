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
  instagram: string;
  ciudadPais: string;
  edad: string;
  sexo: string;
  alturaCm: string;
  pesoKg: string;
  objetivoPrincipal: ObjetivoPrincipal;
  objetivoSecundario: string;
  fechaObjetivo: string;
  experienciaEntrenamiento: string;
  horasSentado: string;
  pasosDiarios: string;
  diasDisponibles: string[];
  minutosPorSesion: string;
  dondeEntrena: string[];
  equipamientoDisponible: string[];
  lesionesDolores: string;
  cirugiasPrevias: string;
  medicacionSuplementos: string;
  patologias: string;
  nivelEstres: string;
  calidadSueno: string;
  horasSueno: string;
  trabajoTurnos: string;
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
  presupuestoComida: string;
  tiempoParaCocinar: string;
  motivacionPrincipal: string;
  dificultadActual: string;
  comentariosExtra: string;
  consentimiento: boolean;
}

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

export const INTAKE_INITIAL_STATE: IntakeFormState = {
  nombreCompleto: "",
  email: "",
  whatsapp: "",
  instagram: "",
  ciudadPais: "",
  edad: "",
  sexo: "prefiero_no_decir",
  alturaCm: "",
  pesoKg: "",
  objetivoPrincipal: "salud_general",
  objetivoSecundario: "",
  fechaObjetivo: "",
  experienciaEntrenamiento: "ninguna",
  horasSentado: "",
  pasosDiarios: "",
  diasDisponibles: [],
  minutosPorSesion: "",
  dondeEntrena: [],
  equipamientoDisponible: [],
  lesionesDolores: "",
  cirugiasPrevias: "",
  medicacionSuplementos: "",
  patologias: "",
  nivelEstres: "medio",
  calidadSueno: "regular",
  horasSueno: "",
  trabajoTurnos: "",
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
  presupuestoComida: "",
  tiempoParaCocinar: "",
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
  const edad = numberOf(payload.edad);
  const alturaCm = numberOf(payload.alturaCm);
  const pesoKg = numberOf(payload.pesoKg);
  const diasDisponibles = arrayOfStrings(payload.diasDisponibles);
  const dondeEntrena = arrayOfStrings(payload.dondeEntrena);
  const equipamiento = arrayOfStrings(payload.equipamientoDisponible);
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

  if (diasDisponibles.length === 0) {
    errors.push("Selecciona al menos un día disponible para entrenar.");
  } else if (!isSubset(diasDisponibles, INTAKE_DIAS_SEMANA)) {
    errors.push("Los días seleccionados no son válidos.");
  }

  if (dondeEntrena.length === 0) {
    errors.push("Selecciona dónde puede entrenar la persona.");
  } else if (!isSubset(dondeEntrena, INTAKE_LUGARES_ENTRENO)) {
    errors.push("Los lugares de entrenamiento seleccionados no son válidos.");
  }

  if (equipamiento.length > 0 && !isSubset(equipamiento, INTAKE_EQUIPAMIENTO)) {
    errors.push("El equipamiento seleccionado no es válido.");
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
