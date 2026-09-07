import { daysBetween, isDateId } from "@/lib/dates/madrid";
import { MAX_WEEKS, MIN_WEEKS, type HyroxProfile, type RunningBase } from "@/lib/hyrox/profile";
import type { PhaseKey } from "@/lib/hyrox/plan";

/**
 * Reparto de fases según el tiempo real que queda hasta la carrera.
 *
 * Este es el módulo con criterio de entrenador del sistema, y la razón por la
 * que el plan no es una plantilla. Casi todos los planes de HYROX que circulan
 * asumen 12 o 16 semanas; la gente se apunta a una carrera cuando faltan siete.
 * Un plan de 16 semanas recortado por la mitad no es un plan de 8 semanas: es
 * un plan de 16 semanas mal hecho.
 *
 * Todo aquí es determinista y puro: mismas entradas, mismo plan. Sin IA, porque
 * esto es una regla, no un juicio (ver reglas de eficiencia del repo).
 */

export type PhaseAllocation = {
  key: PhaseKey;
  /** Semanas asignadas a esta fase. Puede ser 0 si no hay tiempo. */
  weeks: number;
};

export type Periodization = {
  totalWeeks: number;
  /** Semanas reales hasta la carrera, antes de aplicar el tope de `MAX_WEEKS`. */
  weeksUntilRace: number;
  allocations: PhaseAllocation[];
  /** Números de semana que son de descarga (1-indexado sobre `totalWeeks`). */
  deloadWeeks: number[];
  /**
   * Aviso honesto cuando el tiempo disponible condiciona el resultado. `null`
   * si el plazo es holgado. Se muestra al usuario tal cual.
   */
  warning: string | null;
};

/** Semanas completas entre hoy y la carrera. 0 si falta menos de una semana o si ya pasó. */
export function weeksUntilRace(raceDate: string, todayDateId: string): number {
  if (!isDateId(raceDate) || !isDateId(todayDateId)) return 0;
  const days = daysBetween(todayDateId, raceDate);
  if (days <= 0) return 0;
  return Math.floor(days / 7);
}

/**
 * Si la carrera ya pasó. Se comprueba en DÍAS, no en semanas.
 *
 * `weeksUntilRace` devuelve 0 tanto para "la carrera fue el mes pasado" como
 * para "la carrera es pasado mañana", porque redondea hacia abajo. Tratar esos
 * dos casos igual hacía que a alguien con la carrera dentro de 3 días la
 * pantalla le dijera "faltan 3 días" en el titular y "esa fecha ya pasó" justo
 * debajo.
 */
export function raceHasPassed(raceDate: string, todayDateId: string): boolean {
  if (!isDateId(raceDate) || !isDateId(todayDateId)) return false;
  return daysBetween(todayDateId, raceDate) < 0;
}

/**
 * Peso relativo de cada fase en un plan ideal, y cuántas semanas necesita como
 * mínimo para aportar algo. La base es lo primero que se recorta porque es lo
 * que más tiempo necesita para dar fruto: si no hay tiempo para construirla,
 * intentarlo solo genera fatiga sin adaptación.
 */
const PHASE_SHAPE: Array<{ key: PhaseKey; share: number; minWeeks: number; priority: number }> = [
  // `priority`: menor = se recorta antes.
  { key: "base", share: 0.27, minWeeks: 2, priority: 1 },
  { key: "construccion", share: 0.33, minWeeks: 2, priority: 2 },
  { key: "especifico", share: 0.27, minWeeks: 2, priority: 3 },
  { key: "taper", share: 0.13, minWeeks: 1, priority: 4 },
];

/**
 * Cuánta base extra necesita alguien según de dónde parte corriendo.
 *
 * Quien no corre necesita más semanas de base y menos de intensidad: la
 * limitación no es su capacidad de sufrir, es que los tendones y los huesos
 * tardan más en adaptarse que el sistema cardiovascular. Saltarse esto es la
 * causa número uno de llegar lesionado a la carrera.
 */
const BASE_BIAS: Record<RunningBase, number> = {
  ninguna: 0.12,
  poca: 0,
  solida: -0.08,
};

export function buildPeriodization(profile: HyroxProfile, todayDateId: string): Periodization {
  const real = weeksUntilRace(profile.raceDate, todayDateId);
  const totalWeeks = Math.min(real, MAX_WEEKS);

  if (totalWeeks < MIN_WEEKS) {
    const days = daysBetween(todayDateId, profile.raceDate);
    return {
      totalWeeks: Math.max(0, totalWeeks),
      weeksUntilRace: real,
      allocations: shortNoticeAllocation(Math.max(0, totalWeeks)),
      deloadWeeks: [],
      warning: shortNoticeWarning(days, real),
    };
  }

  const bias = BASE_BIAS[profile.runningBase];
  const shares = PHASE_SHAPE.map((p) => ({
    ...p,
    // El sesgo se aplica a la base y se compensa quitándoselo a construcción,
    // que es la fase más elástica. Taper y específico no se tocan: son las que
    // realmente deciden el resultado del día de la carrera.
    share: p.key === "base" ? p.share + bias : p.key === "construccion" ? p.share - bias : p.share,
  }));

  const allocations = distribute(totalWeeks, shares);

  return {
    totalWeeks,
    weeksUntilRace: real,
    allocations,
    deloadWeeks: computeDeloadWeeks(totalWeeks),
    warning: buildWarning(totalWeeks, real, profile),
  };
}

/**
 * Reparte semanas enteras respetando los mínimos de cada fase.
 *
 * Reparte por cuota y asigna los restos a las fases con mayor prioridad, en vez
 * de redondear cada una por su cuenta: redondear suelto hace que la suma no dé
 * el total, y entonces el plan tiene una semana de más o de menos que el
 * calendario real.
 */
function distribute(
  totalWeeks: number,
  shapes: Array<{ key: PhaseKey; share: number; minWeeks: number; priority: number }>
): PhaseAllocation[] {
  const byPriority = [...shapes].sort((a, b) => b.priority - a.priority);

  // 1) Los mínimos primero, empezando por lo más importante. Si no alcanza para
  //    todos, las fases de menor prioridad se quedan en cero.
  const assigned = new Map<PhaseKey, number>(shapes.map((s) => [s.key, 0]));
  let left = totalWeeks;
  for (const s of byPriority) {
    if (left >= s.minWeeks) {
      assigned.set(s.key, s.minWeeks);
      left -= s.minWeeks;
    }
  }

  // 2) El resto por cuota, en el orden natural del plan.
  const active = shapes.filter((s) => (assigned.get(s.key) ?? 0) > 0);
  const totalShare = active.reduce((sum, s) => sum + s.share, 0);
  if (totalShare > 0 && left > 0) {
    const extras = active.map((s) => ({ key: s.key, exact: (s.share / totalShare) * left, priority: s.priority }));
    for (const e of extras) {
      const whole = Math.floor(e.exact);
      assigned.set(e.key, (assigned.get(e.key) ?? 0) + whole);
      left -= whole;
    }
    // 3) Los restos, a las fases con mayor cuota fraccionaria.
    const remainders = extras
      .map((e) => ({ key: e.key, frac: e.exact - Math.floor(e.exact), priority: e.priority }))
      .sort((a, b) => b.frac - a.frac || b.priority - a.priority);
    let i = 0;
    while (left > 0 && remainders.length > 0) {
      const target = remainders[i % remainders.length];
      assigned.set(target.key, (assigned.get(target.key) ?? 0) + 1);
      left--;
      i++;
    }
  }

  return shapes.map((s) => ({ key: s.key, weeks: assigned.get(s.key) ?? 0 }));
}

/** Con menos de `MIN_WEEKS` solo tiene sentido lo específico y el afinado. */
function shortNoticeAllocation(totalWeeks: number): PhaseAllocation[] {
  if (totalWeeks <= 0) {
    return PHASE_SHAPE.map((p) => ({ key: p.key, weeks: 0 }));
  }
  const taper = totalWeeks >= 2 ? 1 : totalWeeks;
  return [
    { key: "base", weeks: 0 },
    { key: "construccion", weeks: 0 },
    { key: "especifico", weeks: totalWeeks - taper },
    { key: "taper", weeks: taper },
  ];
}

/**
 * Semanas de descarga: una de cada cuatro, y nunca dentro del taper (que ya es
 * una descarga en sí, así que meter otra dentro sería descargar de la descarga).
 */
export function computeDeloadWeeks(totalWeeks: number): number[] {
  if (totalWeeks < 6) return [];
  const taperStart = totalWeeks - 1;
  const out: number[] = [];
  for (let w = 4; w < taperStart; w += 4) out.push(w);
  return out;
}

/**
 * Aviso cuando queda poco tiempo. Distingue tres situaciones que antes se
 * colapsaban en una: la carrera ya pasó, es esta misma semana, o quedan pocas
 * semanas.
 */
function shortNoticeWarning(days: number, weeks: number): string {
  if (days < 0) return "Esa fecha ya pasó. Cambia la fecha de carrera para generar un plan.";
  if (days === 0) return "Tu carrera es hoy. Hoy no se entrena: calienta bien, come lo de siempre y disfrútalo.";
  if (days < 7) {
    return `Tu carrera es en ${days} ${days === 1 ? "día" : "días"}. Ya no hay nada que ganar entrenando: lo que queda es llegar descansado. Repasa la estrategia de cada estación y la logística del día.`;
  }
  return `Quedan ${weeks} semanas. No da tiempo a generar adaptación física real, así que el plan se centra en llegar sin lesiones, dominar la técnica de las estaciones y preparar la estrategia de carrera. Es lo honesto: en este plazo la preparación se gestiona, no se construye.`;
}

function buildWarning(totalWeeks: number, real: number, profile: HyroxProfile): string | null {
  if (real > MAX_WEEKS) {
    return `Faltan ${real} semanas. El plan detallado cubre las últimas ${totalWeeks}, porque planificar sesión a sesión más allá de eso es ficción: cualquier imprevisto lo invalida. Hasta que arranque, entrena de forma general y sin prisa.`;
  }
  if (totalWeeks < 8 && profile.runningBase === "ninguna") {
    return `Quedan ${totalWeeks} semanas y partes sin base de carrera. Se puede llegar y terminar, pero el plan prioriza no lesionarte por encima de ir rápido: la carrera es la mitad de la prueba y los tendones no se adaptan a base de ganas.`;
  }
  if (totalWeeks < 10) {
    return `Quedan ${totalWeeks} semanas: alcanza para una preparación seria, pero recortada. Se ha reducido la base aeróbica para llegar con lo específico bien trabajado.`;
  }
  return null;
}

/**
 * Convierte el reparto en el número de fase de cada semana, para poder
 * preguntar "¿qué fase es la semana 7?" sin recalcular nada.
 */
export function phaseForWeek(periodization: Periodization, week: number): PhaseKey | null {
  let acc = 0;
  for (const a of periodization.allocations) {
    if (a.weeks === 0) continue;
    acc += a.weeks;
    if (week <= acc) return a.key;
  }
  return null;
}
