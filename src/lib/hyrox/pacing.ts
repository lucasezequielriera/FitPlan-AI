import type { Division, HyroxProfile, StrengthBase } from "@/lib/hyrox/profile";

/**
 * Estimación de tiempo de carrera y ritmos objetivo.
 *
 * El plan original traía tres objetivos fijos (95 / 85 / 75 min) calculados
 * para un perfil concreto. Aquí se derivan de la marca real de 5 km de cada
 * persona, que es el único dato que predice de verdad un tiempo de HYROX: la
 * carrera se lleva, como mínimo, la mitad del total (~50-58% según este mismo
 * modelo), y el reparto es prácticamente idéntico en individual y en dobles —
 * en dobles se reparte el TRABAJO de estaciones, no el RELOJ. Ver
 * `hyroxLanding.test.ts`, que ata esta afirmación al cálculo real.
 *
 * Se devuelven RANGOS, no un número. Una estimación al minuto sería falsa
 * precisión: hay demasiada varianza en transiciones, agobio de la primera
 * carrera y cómo se reparte el trabajo en dobles.
 */

export type PaceEstimate = {
  /** Minutos totales estimados, rango realista. */
  totalMinutes: { min: number; max: number };
  /** Ritmo objetivo de carrera dentro de la prueba, en segundos por km. */
  runPaceSecPerKm: number;
  runMinutes: number;
  stationsMinutes: number;
  roxzoneMinutes: number;
  /** Explicación honesta de en qué se apoya la estimación. */
  basis: string;
  /** Dónde está su mayor margen de mejora. */
  biggestLever: "carrera" | "estaciones" | "transiciones";
};

/** Los 8 km de carrera de un HYROX, repartidos en 8 tramos de 1 km. */
const RACE_KM = 8;

/**
 * Cuánto más lento se corre dentro de un HYROX respecto al ritmo de 5 km en
 * fresco, en segundos por km.
 *
 * No es una constante universal: quien tiene más base de fuerza pierde menos
 * en las estaciones y llega menos fundido a los tramos de carrera. En dobles
 * la degradación es MENOR porque se hace la mitad del trabajo de estaciones,
 * aunque se corren los 8 km igual.
 */
const RUN_DEGRADATION: Record<Division, number> = {
  individual: 62,
  doubles: 45,
  relay: 25,
};

/**
 * Minutos de trabajo en estaciones según experiencia de fuerza y división.
 * En dobles y relevos cada persona hace una fracción del trabajo, pero el
 * tiempo de estación transcurre igual para el equipo: lo que baja es la fatiga
 * acumulada, no el reloj.
 */
const STATION_MINUTES: Record<StrengthBase, number> = {
  principiante: 38,
  intermedio: 32,
  avanzado: 27,
};

/**
 * La "roxzone" es el tiempo entre que sales de la carrera y empiezas la
 * estación (y viceversa). Suele ignorarse y son varios minutos: en una prueba
 * de 90 minutos, 8 transiciones lentas cuestan más que cualquier estación.
 */
const ROXZONE_BASE = 7;
const ROXZONE_FIRST_TIMER_PENALTY = 2;

export function estimatePace(profile: HyroxProfile): PaceEstimate | null {
  if (profile.current5kMinutes == null) return null;

  const pace5kSecPerKm = (profile.current5kMinutes * 60) / 5;
  const runPaceSecPerKm = Math.round(pace5kSecPerKm + RUN_DEGRADATION[profile.division]);
  const runMinutes = Math.round((runPaceSecPerKm * RACE_KM) / 60);

  const stationsMinutes = STATION_MINUTES[profile.strengthBase];
  const roxzoneMinutes = ROXZONE_BASE + (profile.hasRacedBefore ? 0 : ROXZONE_FIRST_TIMER_PENALTY);

  const central = runMinutes + stationsMinutes + roxzoneMinutes;

  return {
    // ±8% de margen: es la varianza real observada entre lo que la gente
    // estima y lo que marca el crono el día de la carrera.
    totalMinutes: { min: Math.round(central * 0.92), max: Math.round(central * 1.08) },
    runPaceSecPerKm,
    runMinutes,
    stationsMinutes,
    roxzoneMinutes,
    basis: buildBasis(profile, runPaceSecPerKm),
    biggestLever: biggestLever(runMinutes, stationsMinutes, roxzoneMinutes, pace5kSecPerKm),
  };
}

function buildBasis(profile: HyroxProfile, runPaceSecPerKm: number): string {
  const pace = formatPace(runPaceSecPerKm);
  const div =
    profile.division === "individual"
      ? "En individual harás las 8 estaciones completas."
      : profile.division === "doubles"
        ? "En dobles corréis los 8 km enteros los dos, pero repartís el trabajo de estaciones: por eso se corre más rápido que en individual."
        : "En relevos el desgaste individual es mucho menor, así que el ritmo de carrera se acerca al de una carrera en fresco.";
  return `Calculado sobre tu marca de 5 km (${profile.current5kMinutes} min). Dentro de un HYROX se corre más lento que en fresco: tu ritmo objetivo es ${pace}/km. ${div}`;
}

/**
 * Dónde tiene más margen de mejora, en MINUTOS QUE PUEDE RECUPERAR — no en
 * dónde pasa más tiempo.
 *
 * Es una distinción que importa: la carrera siempre es la parte más larga, pero
 * si alguien ya corre a buen ritmo su margen ahí es pequeño, mientras que un
 * principiante en fuerza puede recortar 11 minutos en estaciones. Comparar
 * tiempos absolutos señalaría siempre lo mismo y no serviría de nada.
 */
function biggestLever(
  runMinutes: number,
  stationsMinutes: number,
  roxzoneMinutes: number,
  pace5kSecPerKm: number
): PaceEstimate["biggestLever"] {
  // Quien corre lento tiene mucho más recorrido: un bloque de entrenamiento
  // mueve bastante más a alguien de 6:00/km que a alguien de 4:30/km.
  const runImprovable = runMinutes * (pace5kSecPerKm > 345 ? 0.16 : 0.07);
  // Lo que le separa del tiempo de estaciones de alguien con fuerza avanzada.
  const stationsImprovable = stationsMinutes - STATION_MINUTES.avanzado;
  // Una roxzone bien ejecutada baja a ~5 min. Más allá de eso no hay margen.
  const roxzoneImprovable = Math.max(0, roxzoneMinutes - 5);

  const best = Math.max(runImprovable, stationsImprovable, roxzoneImprovable);
  if (best === runImprovable) return "carrera";
  if (best === stationsImprovable) return "estaciones";
  return "transiciones";
}

/** Segundos por km a "m:ss". */
export function formatPace(secPerKm: number): string {
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Minutos a "1h 25min" o "45min". */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}min` : `${m}min`;
}

/**
 * Si el objetivo que se ha puesto el usuario es realista, y qué le falta si no.
 * Se dice claro: un objetivo inalcanzable arruina la carrera cuando se ve a
 * mitad de prueba que no sale, y hace que la gente salga demasiado rápido.
 */
export function assessGoal(profile: HyroxProfile, estimate: PaceEstimate | null): string | null {
  if (profile.goalMinutes == null || estimate == null) return null;

  const { min, max } = estimate.totalMinutes;
  if (profile.goalMinutes >= max) {
    return `Tu objetivo de ${profile.goalMinutes} min está por encima de lo que apunta tu marca actual (${min}-${max} min). Es un objetivo conservador: deberías cumplirlo con margen.`;
  }
  if (profile.goalMinutes >= min) {
    return `Tu objetivo de ${profile.goalMinutes} min está dentro de lo alcanzable (${min}-${max} min). Vas a tener que ejecutar bien el día de la carrera, pero es realista.`;
  }
  const gap = min - profile.goalMinutes;
  return `Tu objetivo de ${profile.goalMinutes} min está ${gap} min por debajo de lo que apunta tu marca de 5 km actual (${min}-${max} min). No es imposible, pero exige mejorar la carrera: es ahí donde está el margen, no en las estaciones.`;
}
