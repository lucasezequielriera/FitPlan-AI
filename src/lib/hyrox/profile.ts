/**
 * Perfil HYROX de un usuario: lo mínimo que hay que saber para generarle un
 * plan que no sea genérico.
 *
 * El plan original de este repo (`plan.ts`) estaba construido para UNA carrera
 * y UN perfil concreto, con las 15 semanas ya escritas a mano. Este módulo es
 * el paso de "el plan de Lucas" a "un plan para cualquiera": todo lo que allí
 * era una constante, aquí es una entrada.
 *
 * Las opciones son deliberadamente pocas. Cada pregunta que se añade a un
 * formulario cuesta usuarios, así que solo están las que cambian de verdad el
 * plan resultante. Todo lo demás se deduce.
 */

export type Division = "individual" | "doubles" | "relay";

/** Determina los pesos de las estaciones. HYROX compite en categorías por sexo. */
export type Category = "hombre" | "mujer";

/**
 * Base de carrera. Es la entrada MÁS determinante de todas: en HYROX la
 * carrera se lleva ~50% del tiempo en individual y hasta ~65% en dobles, así
 * que quien viene del gimnasio sin correr tiene ahí todo su margen — y también
 * todo su riesgo de lesión si se le carga volumen demasiado rápido.
 */
export type RunningBase =
  /** No corre, o menos de 10 minutos seguidos sin parar. */
  | "ninguna"
  /** Aguanta 20-30 minutos continuos, sin entrenar carrera de forma regular. */
  | "poca"
  /** Corre habitualmente, 40+ minutos continuos o 5 km por debajo de 27 min. */
  | "solida";

/** Experiencia con trabajo de fuerza. Define si se progresa carga o se mantiene. */
export type StrengthBase = "principiante" | "intermedio" | "avanzado";

/**
 * Material disponible. Cambia qué sesiones son posibles, no la estructura del
 * plan: sin SkiErg ni trineo hay que sustituir, y las sustituciones tienen que
 * mantener el estímulo, no rellenar.
 */
export type Equipment =
  /** Box o gimnasio con material de competición (SkiErg, trineo, remo, sandbag). */
  | "completo"
  /** Gimnasio normal: barras, mancuernas, remo o cinta, pero sin material HYROX. */
  | "gimnasio"
  /** En casa: peso corporal, alguna mancuerna o kettlebell, y la calle para correr. */
  | "casa";

export type HyroxProfile = {
  /** Fecha de la carrera, "YYYY-MM-DD". */
  raceDate: string;
  division: Division;
  category: Category;
  /** Días que puede entrenar por semana. Entre 3 y 6. */
  daysPerWeek: number;
  runningBase: RunningBase;
  strengthBase: StrengthBase;
  equipment: Equipment;
  /** Ya ha competido un HYROX antes. Cambia el énfasis en técnica y logística. */
  hasRacedBefore: boolean;
  /** Objetivo en minutos, si lo tiene. `null` = "terminar bien", que es lo sano la primera vez. */
  goalMinutes: number | null;
  /** Mejor marca reciente en 5 km, en minutos. Permite calcular ritmos reales en vez de genéricos. */
  current5kMinutes: number | null;
  /** Lesiones o limitaciones, en texto libre. Se muestra como aviso, no se interpreta. */
  limitations: string | null;
};

export const DAYS_MIN = 3;
export const DAYS_MAX = 6;

/**
 * Semanas mínimas para que un plan tenga sentido. Por debajo de 4 no da tiempo
 * a generar adaptación y lo honesto es decirlo: se puede preparar la logística
 * y la técnica, pero no la condición física.
 */
export const MIN_WEEKS = 4;

/**
 * Tope de semanas planificadas. Más allá de 20 la planificación detallada es
 * ficción: cualquier cosa que pase (una gripe, un viaje) la invalida. Si falta
 * más tiempo, se planifican las últimas 20 y antes se hace base general.
 */
export const MAX_WEEKS = 20;

export type ProfileIssue = { field: keyof HyroxProfile | "general"; message: string };

/**
 * Valida un perfil. Devuelve los problemas encontrados en vez de lanzar, para
 * que el formulario pueda mostrarlos todos juntos y no de uno en uno.
 */
export function validateProfile(profile: Partial<HyroxProfile>): ProfileIssue[] {
  const issues: ProfileIssue[] = [];

  if (!profile.raceDate || !/^\d{4}-\d{2}-\d{2}$/.test(profile.raceDate)) {
    issues.push({ field: "raceDate", message: "Indica la fecha de tu carrera." });
  }

  if (profile.daysPerWeek === undefined || profile.daysPerWeek === null) {
    issues.push({ field: "daysPerWeek", message: "Indica cuántos días puedes entrenar." });
  } else if (profile.daysPerWeek < DAYS_MIN || profile.daysPerWeek > DAYS_MAX) {
    issues.push({
      field: "daysPerWeek",
      message: `Los días de entrenamiento tienen que estar entre ${DAYS_MIN} y ${DAYS_MAX}.`,
    });
  }

  if (profile.current5kMinutes != null && (profile.current5kMinutes < 12 || profile.current5kMinutes > 60)) {
    // 12 min sería récord del mundo; 60 min es caminando. Fuera de ahí es un error de tecleo.
    issues.push({ field: "current5kMinutes", message: "Esa marca de 5 km no parece correcta." });
  }

  if (profile.goalMinutes != null && (profile.goalMinutes < 45 || profile.goalMinutes > 180)) {
    issues.push({ field: "goalMinutes", message: "El objetivo tiene que estar entre 45 y 180 minutos." });
  }

  return issues;
}

/** Valores por defecto sensatos para alguien que empieza a rellenar el formulario. */
export function emptyProfile(): Partial<HyroxProfile> {
  return {
    division: "individual",
    category: "hombre",
    daysPerWeek: 4,
    runningBase: "poca",
    strengthBase: "intermedio",
    equipment: "gimnasio",
    hasRacedBefore: false,
    goalMinutes: null,
    current5kMinutes: null,
    limitations: null,
  };
}

export const DIVISION_LABELS: Record<Division, string> = {
  individual: "Individual",
  doubles: "Dobles",
  relay: "Relevos (4 personas)",
};

export const RUNNING_BASE_LABELS: Record<RunningBase, string> = {
  ninguna: "No corro, o menos de 10 min seguidos",
  poca: "Aguanto 20-30 min continuos",
  solida: "Corro habitualmente, 40+ min o 5 km en menos de 27 min",
};

export const STRENGTH_BASE_LABELS: Record<StrengthBase, string> = {
  principiante: "Menos de un año entrenando fuerza",
  intermedio: "1-3 años, técnica correcta en los básicos",
  avanzado: "3+ años, cargas altas con buena técnica",
};

export const EQUIPMENT_LABELS: Record<Equipment, string> = {
  completo: "Box con material HYROX (SkiErg, trineo, remo, sandbag)",
  gimnasio: "Gimnasio normal, sin material específico",
  casa: "En casa y la calle",
};
