/**
 * Plan de preparación para HYROX Doubles (división Open) — 20 de noviembre de 2026.
 *
 * Perfil sobre el que está construido: dos atletas con 2+ años de fuerza y
 * técnica sólida, SIN base de carrera (10-20 min continuos), sin lesiones,
 * con acceso a todo el material de competición y 5 días de entreno semanales.
 *
 * La decisión central del plan sale de una particularidad del formato Doubles
 * que suele pasarse por alto: los dos corren los 8 km completos pero se
 * reparten el trabajo de estaciones. Es decir, se corre el 100% de la
 * distancia haciendo ~50% del trabajo de fuerza, así que la carrera pesa MÁS
 * en dobles que en individual (~65-70% del tiempo total, frente a ~50%).
 *
 * Para este perfil concreto eso significa que la fuerza ya no es el factor
 * limitante: lo es la carrera, y en particular correr en fatiga. Por eso el
 * plan mantiene la fuerza (2 sesiones, sin buscar progresos grandes) y dedica
 * las otras 3 sesiones a construir base aeróbica primero y "compromised
 * running" después.
 */

export type PhaseKey = "base" | "construccion" | "especifico" | "taper";

export type Phase = {
  key: PhaseKey;
  name: string;
  weeks: [number, number];
  goal: string;
  /** Qué se acepta sacrificar en esta fase, para no intentar mejorarlo todo a la vez. */
  tradeoff: string;
};

export const PHASES: Phase[] = [
  {
    key: "base",
    name: "Base aeróbica",
    weeks: [1, 4],
    goal: "Construir tolerancia a correr sin lesionarse y automatizar la técnica de cada estación sin fatiga.",
    tradeoff: "Nada de intensidad alta en carrera. Se progresa por volumen y frecuencia, no por ritmo.",
  },
  {
    key: "construccion",
    name: "Construcción",
    weeks: [5, 9],
    goal: "Subir el umbral y empezar a correr con las piernas cargadas después de una estación.",
    tradeoff: "La fuerza pasa a mantenimiento: se conserva, no se busca subir cargas.",
  },
  {
    key: "especifico",
    name: "Específico de carrera",
    weeks: [10, 13],
    goal: "Ritmo de competición en fatiga, simulaciones completas y coreografía de reparto en dobles.",
    tradeoff: "Baja el volumen total y sube la especificidad. Menos kilómetros, más parecidos a la prueba.",
  },
  {
    key: "taper",
    name: "Afinado y competición",
    weeks: [14, 15],
    goal: "Llegar descansados manteniendo la sensación de ritmo. Ensayar transiciones y logística.",
    tradeoff: "Se reduce el volumen ~50%. La intensidad se mantiene pero en dosis muy cortas.",
  },
];

export type SessionType = "fuerza" | "carrera" | "hyrox" | "descanso";

export type Session = {
  day: "Lunes" | "Martes" | "Miércoles" | "Jueves" | "Viernes" | "Sábado" | "Domingo";
  type: SessionType;
  title: string;
  /** Para qué sirve exactamente esta sesión — evita hacerla "por hacer". */
  focus: string;
  blocks: string[];
  notes?: string;
};

export type WeekPlan = {
  week: number;
  phase: PhaseKey;
  /** Lunes de esa semana, ISO. */
  startDate: string;
  headline: string;
  keyGoal: string;
  /** Semana de descarga: se baja carga a propósito para asimilar. */
  deload: boolean;
  sessions: Session[];
};

export const RACE_DATE = "2026-11-20";
export const FIRST_MONDAY = "2026-08-10";

/** Progresión de la sesión de intervalos (martes). */
const INTERVALS: string[] = [
  "6 × (1' fuerte / 2' andando)",
  "8 × (1' fuerte / 2' andando)",
  "6 × (2' fuerte / 2' trote muy suave)",
  "4 × (2' fuerte / 2' suave) — descarga",
  "5 × 400 m a ritmo 5k / 90\" andando",
  "6 × 400 m a ritmo 5k / 90\" andando",
  "5 × 600 m a ritmo 5k / 2' trote",
  "4 × 400 m a ritmo 5k / 2' — descarga",
  "6 × 600 m a ritmo 5k / 2' trote",
  "5 × 800 m a ritmo objetivo de carrera / 2' trote",
  "4 × 1000 m a ritmo objetivo / 2'30\" trote",
  "4 × 600 m a ritmo objetivo / 2' — descarga",
  "6 × 1000 m a ritmo objetivo / 2' trote — sesión clave del bloque",
  "4 × 1000 m a ritmo objetivo / 2'30\"",
  "2 × 1000 m a ritmo objetivo / 3' — solo para sentir el ritmo",
];

/** Progresión de la carrera continua (sábado). */
const LONG_RUN: string[] = [
  "25' alternando 5' trote / 2' andando",
  "30' alternando 6' trote / 2' andando",
  "35' alternando 8' trote / 2' andando",
  "30' continuo muy suave — descarga",
  "40' continuo suave (poder hablar todo el rato)",
  "45' continuo suave",
  "50' continuo suave",
  "35' continuo — descarga",
  "55' continuo suave",
  "60' continuo suave",
  "65' continuo / ~10 km",
  "45' continuo — descarga",
  "70' continuo / ~12 km",
  "45' continuo suave",
  "20' muy suave, solo activación",
];

/** Progresión de la sesión específica (miércoles): correr en fatiga. */
const HYROX_SESSION: string[] = [
  "Técnica sin fatiga: 4 estaciones × trabajo ligero, 400 m trote suave entre cada una",
  "4 × (400 m + 1 estación al 70%)",
  "5 × (500 m + 1 estación al 75%)",
  "3 × (400 m + 1 estación) — descarga, foco en transiciones",
  "4 × (800 m + 1 estación al 80%)",
  "5 × (800 m + 1 estación al 80%)",
  "6 × (800 m + 1 estación al 85%)",
  "4 × (600 m + 1 estación) — descarga",
  "MEDIA SIMULACIÓN: 4 × (1 km + estación) en formato dobles real",
  "6 × (1 km + estación) a ritmo objetivo",
  "SIMULACIÓN COMPLETA #1: las 8 estaciones en formato dobles, a ritmo controlado",
  "4 × (1 km + estación) a ritmo objetivo — descarga",
  "SIMULACIÓN COMPLETA #2: a ritmo de competición real. Cronometrar todo",
  "4 × (1 km + estación) a ritmo de carrera, afinando transiciones y relevos",
  "2 × (1 km + estación) muy suave — ensayo de transiciones, cero fatiga",
];

/** Progresión de fuerza del lunes (tren inferior y patrón de empuje de cadera). */
const STRENGTH_LOWER: string[][] = [
  ["Sentadilla trasera 4×6 @ 75%", "Peso muerto rumano 3×8", "Zancadas con saco 3×20 m", "Plancha con peso 3×45\""],
  ["Sentadilla trasera 4×6 @ 77%", "Peso muerto rumano 3×8", "Zancadas con saco 3×25 m", "Plancha con peso 3×50\""],
  ["Sentadilla trasera 5×5 @ 80%", "Peso muerto rumano 4×6", "Zancadas con saco 4×25 m", "Rueda abdominal 3×10"],
  ["Sentadilla trasera 3×5 @ 70%", "Peso muerto rumano 3×6", "Zancadas 3×20 m", "Core 3×45\" — descarga"],
  ["Sentadilla trasera 5×4 @ 82%", "Peso muerto 4×5", "Zancadas con saco 4×25 m", "Elevación de talones 3×15"],
  ["Sentadilla trasera 5×4 @ 84%", "Peso muerto 4×4", "Zancadas con saco 4×30 m", "Elevación de talones 3×15"],
  ["Sentadilla trasera 5×3 @ 86%", "Peso muerto 4×4", "Subidas al cajón lastradas 4×8/pierna", "Core 3×60\""],
  ["Sentadilla trasera 3×4 @ 75%", "Peso muerto 3×4", "Subidas al cajón 3×8", "Core — descarga"],
  ["Sentadilla trasera 4×3 @ 87%", "Peso muerto 3×3", "Zancadas con saco 4×30 m", "Saltos al cajón 4×5"],
  ["Sentadilla 4×3 @ 87%", "Saltos al cajón 5×4", "Zancadas con saco 4×30 m", "Core 3×60\""],
  ["Sentadilla 3×3 @ 85%", "Saltos al cajón 5×4", "Zancadas con saco específicas 4×25 m", "Core"],
  ["Sentadilla 3×4 @ 75%", "Saltos 3×4", "Zancadas 3×20 m — descarga"],
  ["Sentadilla 3×3 @ 82% (rápido)", "Saltos al cajón 4×4", "Zancadas con saco 3×25 m"],
  ["Sentadilla 3×3 @ 75% (solo velocidad de barra)", "Saltos 3×3", "Movilidad de cadera y tobillo"],
  ["Sentadilla 2×3 @ 65% (activación)", "Movilidad completa", "Nada que genere agujetas"],
];

/** Progresión de fuerza del viernes (empuje, tracción y ergómetros). */
const STRENGTH_UPPER: string[][] = [
  ["Press banca 4×6", "Remo con barra 4×8", "Dominadas 4×máx", "SkiErg 4×500 m suave", "Farmers carry 4×50 m"],
  ["Press banca 4×6", "Remo con barra 4×8", "Dominadas 4×máx", "SkiErg 4×500 m", "Farmers carry 4×50 m"],
  ["Press banca 5×5", "Remo con barra 4×6", "Dominadas lastradas 4×6", "SkiErg 5×500 m", "Farmers carry 4×60 m"],
  ["Press banca 3×5", "Remo 3×6", "Dominadas 3×6", "SkiErg 3×500 m — descarga"],
  ["Press banca 5×4", "Remo con barra 4×6", "Dominadas lastradas 4×5", "Remo C2 5×500 m", "Farmers carry 4×80 m"],
  ["Press banca 5×4", "Remo con barra 4×6", "Dominadas lastradas 4×5", "Remo C2 4×750 m", "Farmers carry 4×80 m"],
  ["Press militar 5×4", "Remo con barra 4×6", "Dominadas lastradas 4×5", "Remo C2 3×1000 m", "Farmers carry 4×100 m"],
  ["Press militar 3×5", "Remo 3×6", "Dominadas 3×5", "Remo C2 2×1000 m — descarga"],
  ["Press militar 4×4", "Remo con barra 4×5", "Dominadas lastradas 4×5", "SkiErg 3×1000 m a ritmo objetivo", "Farmers 4×100 m"],
  ["Press militar 4×3", "Remo con barra 4×5", "Dominadas 4×5", "Remo C2 2×1000 m a ritmo objetivo", "Farmers 4×100 m"],
  ["Press militar 3×3", "Remo con barra 3×5", "Dominadas 3×5", "SkiErg 2×1000 m a ritmo objetivo", "Farmers 3×100 m"],
  ["Press 3×4 ligero", "Remo 3×6", "Dominadas 3×5", "Ergos suaves — descarga"],
  ["Press militar 3×3", "Remo con barra 3×5", "SkiErg 1×1000 m a ritmo", "Remo C2 1×1000 m a ritmo", "Farmers 2×100 m"],
  ["Press 3×3 ligero", "Remo 3×5", "SkiErg 500 m + Remo 500 m a ritmo", "Farmers 2×50 m"],
  ["Solo activación: SkiErg 300 m + Remo 300 m muy suaves", "Movilidad"],
];

const WEEK_HEADLINES: string[] = [
  "Arranque y tests de referencia",
  "Acumular minutos de carrera",
  "Primer pico de volumen",
  "Descarga y asimilación",
  "Entra la intensidad",
  "Umbral y estaciones al 80%",
  "Semana más dura del bloque",
  "Descarga y re-test",
  "Media simulación",
  "Ritmo objetivo en fatiga",
  "Simulación completa #1",
  "Descarga antes del pico",
  "Simulación completa a ritmo real",
  "Afinado",
  "Semana de competición",
];

const WEEK_GOALS: string[] = [
  "Medir de dónde partís (test de 5 km y de cada estación) sin buscar rendimiento.",
  "Que correr 3 veces por semana deje de ser un evento y pase a ser rutina.",
  "Máximo volumen del bloque base. Si aparece molestia, se recorta sin dudarlo.",
  "Bajar carga para que el cuerpo asimile lo acumulado. No es una semana perdida.",
  "Primeras series a ritmo de 5 km. La carrera empieza a doler y está bien.",
  "Correr con las piernas ya cargadas: el gesto real de HYROX.",
  "Pico de carga del bloque de construcción. Dormir y comer pasan a ser parte del entreno.",
  "Descarga + repetir el test de 5 km para ver la mejora real y recalcular ritmos.",
  "Primera vez en formato dobles real: probar repartos y relevos.",
  "Interiorizar el ritmo objetivo cuando ya estáis cansados.",
  "Completar la distancia entera en formato dobles. El objetivo es terminar, no el crono.",
  "Bajar carga antes de la sesión más importante de todo el plan.",
  "Simulación a ritmo real: el mejor predictor del tiempo del día de la carrera.",
  "Quitar fatiga sin perder sensación de ritmo. Cerrar la estrategia de reparto.",
  "Llegar frescos. Nada nuevo esta semana: ni comida, ni material, ni ejercicios.",
];

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

function phaseForWeek(week: number): PhaseKey {
  const phase = PHASES.find((p) => week >= p.weeks[0] && week <= p.weeks[1]);
  return phase?.key ?? "base";
}

const DELOAD_WEEKS = new Set([4, 8, 12]);

function buildWeek(week: number): WeekPlan {
  const i = week - 1;
  const deload = DELOAD_WEEKS.has(week);
  const isRaceWeek = week === 15;

  const sessions: Session[] = [
    {
      day: "Lunes",
      type: "fuerza",
      title: "Fuerza — tren inferior",
      focus: "Mantener la fuerza que ya tenéis. No es el factor limitante, así que no se busca subir cargas a costa de la recuperación.",
      blocks: STRENGTH_LOWER[i],
      notes: deload ? "Semana de descarga: quedaos lejos del fallo en todas las series." : undefined,
    },
    {
      day: "Martes",
      type: "carrera",
      title: "Carrera — intervalos",
      focus: "Subir el techo aeróbico. Es la sesión que más mueve el tiempo final para alguien que viene de no correr.",
      blocks: [INTERVALS[i], "Calentamiento: 10' trote suave + movilidad", "Vuelta a la calma: 5-10' andando"],
    },
    {
      day: "Miércoles",
      type: "hyrox",
      title: "Específico HYROX",
      focus: "Correr con las piernas cargadas después de una estación. Es el gesto exacto de la prueba y donde se decide la carrera.",
      blocks: [HYROX_SESSION[i], "Rotad las estaciones cada semana para no descuidar ninguna"],
      notes:
        week >= 9
          ? "En formato dobles: cambiad ANTES de fundiros, no cuando ya no podéis. Relevos cortos y frecuentes."
          : undefined,
    },
    {
      day: "Jueves",
      type: "descanso",
      title: "Descanso activo",
      focus: "Recuperar de verdad. El progreso ocurre aquí, no en la sesión.",
      blocks: ["Caminar 30-40'", "Movilidad de cadera, tobillo y dorsal 15'", "Opcional: 10' de respiración o estiramientos"],
    },
    {
      day: "Viernes",
      type: "fuerza",
      title: "Fuerza — empuje/tracción + ergómetros",
      focus: "Tren superior para SkiErg, remo y farmers, más técnica de ergómetros con poca fatiga.",
      blocks: STRENGTH_UPPER[i],
    },
    {
      day: "Sábado",
      type: "carrera",
      title: "Carrera continua",
      focus: "Base aeróbica pura. Ritmo cómodo de conversación: si no podéis hablar, vais demasiado rápido.",
      blocks: [LONG_RUN[i], "Terreno llano y calzado con el que vayáis a competir a partir de la semana 10"],
    },
    {
      day: "Domingo",
      type: "descanso",
      title: "Descanso total",
      focus: "Sin entreno. Dormir 8 h es literalmente parte del plan.",
      blocks: ["Descanso completo"],
    },
  ];

  if (isRaceWeek) {
    sessions[5] = {
      day: "Sábado",
      type: "descanso",
      title: "Post-competición",
      focus: "Ya está hecho. Caminar suave y celebrar.",
      blocks: ["Caminar 20-30' muy suave", "Comer e hidratar bien", "Nada de entrenar"],
    };
  }

  return {
    week,
    phase: phaseForWeek(week),
    startDate: addDays(FIRST_MONDAY, (week - 1) * 7),
    headline: WEEK_HEADLINES[i],
    keyGoal: WEEK_GOALS[i],
    deload,
    sessions,
  };
}

export const WEEKS: WeekPlan[] = Array.from({ length: 15 }, (_, i) => buildWeek(i + 1));

/** Semana del plan en la que cae una fecha (1-15). null si aún no empezó o ya pasó. */
export function currentWeekNumber(today: Date): number | null {
  const todayIso = today.toISOString().slice(0, 10);
  if (todayIso < FIRST_MONDAY) return null;
  const start = Date.UTC(2026, 7, 10);
  const now = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const week = Math.floor((now - start) / (7 * 86400000)) + 1;
  return week >= 1 && week <= 15 ? week : null;
}

export function daysUntilRace(today: Date): number {
  const [y, m, d] = RACE_DATE.split("-").map(Number);
  const race = Date.UTC(y, m - 1, d);
  const now = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return Math.round((race - now) / 86400000);
}

/**
 * Ajustes para el miembro del equipo que corre peor.
 *
 * Con dos atletas igualados en fuerza pero no en carrera, el plan deja de ser
 * simétrico: el tiempo del equipo lo marca el que menos corre, así que meterle
 * más gimnasio no aporta nada y meterle más carrera lo aporta todo.
 */
export const PARTNER_ADJUSTMENTS = [
  {
    title: "Una salida suave extra a la semana",
    detail:
      "30-40 minutos muy tranquilos (poder hablar todo el rato), idealmente en domingo o jueves. No es una sesión de calidad: es volumen aeróbico barato, que es justo lo que le falta.",
  },
  {
    title: "Menos volumen de fuerza si acumula fatiga",
    detail:
      "Si la carrera extra pasa factura, quitar la última serie de cada ejercicio del lunes y el viernes. De fuerza vais sobrados para división Open; sacrificar algo ahí sale rentable.",
  },
  {
    title: "En las simulaciones, él hace menos trabajo de estación",
    detail:
      "Reparto 60/40 a favor del que corre mejor. Hay que ensayarlo desde la semana 9, no improvisarlo el día de la carrera.",
  },
  {
    title: "Los ritmos objetivo se calculan sobre SU test de 5 km",
    detail:
      "No sobre la media de los dos ni sobre el mejor. Si su 5 km es 28 min, el ritmo de carrera del equipo sale de ahí, aunque el otro pueda ir más rápido.",
  },
];

/** Tests de referencia: sin medir no se sabe si el plan funciona. */
export const BENCHMARKS = [
  { key: "run5k", label: "5 km a tope", unit: "mm:ss", weeks: [1, 8, 14], why: "El mayor predictor del tiempo final. Marca los ritmos de todo el plan." },
  { key: "ski1000", label: "SkiErg 1000 m", unit: "mm:ss", weeks: [1, 8, 14], why: "Referencia para repartir la estación en dobles." },
  { key: "row1000", label: "Remo 1000 m", unit: "mm:ss", weeks: [1, 8, 14], why: "Igual que el SkiErg: define quién hace qué tramo." },
  { key: "sledPush", label: "Sled push 50 m (peso Open)", unit: "mm:ss", weeks: [1, 8, 14], why: "Donde más tiempo se pierde en Open si la técnica es mala." },
  { key: "wallballs", label: "100 wall balls sin parar", unit: "mm:ss", weeks: [1, 8, 14], why: "La estación que rompe carreras: llega al final y con todo acumulado." },
  { key: "burpees", label: "80 m burpee broad jump", unit: "mm:ss", weeks: [1, 8, 14], why: "La que más dispara las pulsaciones. Hay que aprender a dosificarla." },
];
