import type { PhaseKey, Session, SessionType } from "@/lib/hyrox/plan";
import type { Equipment, HyroxProfile, RunningBase } from "@/lib/hyrox/profile";

/**
 * Generador de sesiones.
 *
 * El plan original tenía las 15 semanas escritas a mano, una por una. Eso no
 * escala a "cualquier persona con cualquier plazo": aquí cada sesión se deriva
 * de en qué punto de su fase estás (`progress`, de 0 a 1), de forma que un
 * bloque de 3 semanas y uno de 6 recorren la misma progresión con distinta
 * granularidad, en vez de que el segundo repita contenido.
 */

export type DayName = Session["day"];

/**
 * Qué se entrena cada día según los días disponibles.
 *
 * Se prioriza en este orden: primero lo específico de HYROX (correr en fatiga,
 * que es lo que decide la prueba), luego una sesión de carrera, luego fuerza.
 * Con 3 días no se puede tener todo, y lo que se cae es la segunda sesión de
 * fuerza — no la específica.
 *
 * Los días dejan siempre 48 h entre las dos sesiones más duras y sitúan la
 * larga en sábado, que es cuando la mayoría tiene tiempo.
 */
const WEEK_TEMPLATES: Record<number, Array<{ day: DayName; type: SessionType; slot: SessionSlot }>> = {
  3: [
    { day: "Lunes", type: "fuerza", slot: "fuerza_general" },
    { day: "Miércoles", type: "hyrox", slot: "especifica" },
    { day: "Sábado", type: "carrera", slot: "larga" },
  ],
  4: [
    { day: "Lunes", type: "fuerza", slot: "fuerza_general" },
    { day: "Martes", type: "carrera", slot: "calidad" },
    { day: "Jueves", type: "hyrox", slot: "especifica" },
    { day: "Sábado", type: "carrera", slot: "larga" },
  ],
  5: [
    { day: "Lunes", type: "fuerza", slot: "fuerza_inferior" },
    { day: "Martes", type: "carrera", slot: "calidad" },
    { day: "Miércoles", type: "hyrox", slot: "especifica" },
    { day: "Viernes", type: "fuerza", slot: "fuerza_superior" },
    { day: "Sábado", type: "carrera", slot: "larga" },
  ],
  6: [
    { day: "Lunes", type: "fuerza", slot: "fuerza_inferior" },
    { day: "Martes", type: "carrera", slot: "calidad" },
    { day: "Miércoles", type: "hyrox", slot: "especifica" },
    { day: "Jueves", type: "carrera", slot: "suave" },
    { day: "Viernes", type: "fuerza", slot: "fuerza_superior" },
    { day: "Sábado", type: "carrera", slot: "larga" },
  ],
};

type SessionSlot =
  | "fuerza_general"
  | "fuerza_inferior"
  | "fuerza_superior"
  | "calidad"
  | "larga"
  | "suave"
  | "especifica";

export type SessionContext = {
  profile: HyroxProfile;
  phase: PhaseKey;
  /** Posición dentro de la fase, de 0 (primera semana) a 1 (última). */
  progress: number;
  isDeload: boolean;
  /** Semana global, 1-indexada. */
  week: number;
  totalWeeks: number;
};

/** Sesiones de una semana, ya adaptadas al perfil. */
export function buildSessions(ctx: SessionContext): Session[] {
  const template = WEEK_TEMPLATES[clampDays(ctx.profile.daysPerWeek)];
  const trained = template.map((t) => buildSession(t.day, t.type, t.slot, ctx));
  return [...trained, ...restDays(template.map((t) => t.day))];
}

function clampDays(days: number): number {
  if (days <= 3) return 3;
  if (days >= 6) return 6;
  return Math.round(days);
}

const ALL_DAYS: DayName[] = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

function restDays(used: DayName[]): Session[] {
  return ALL_DAYS.filter((d) => !used.includes(d)).map((day) => ({
    day,
    type: "descanso" as const,
    title: "Descanso",
    focus: "El descanso es parte del plan: la adaptación ocurre aquí, no durante la sesión.",
    blocks: ["Camina, duerme y come bien.", "Si te apetece moverte: movilidad suave, nunca intensidad."],
  }));
}

function buildSession(day: DayName, type: SessionType, slot: SessionSlot, ctx: SessionContext): Session {
  switch (slot) {
    case "fuerza_general":
      return strengthSession(day, ctx, "general");
    case "fuerza_inferior":
      return strengthSession(day, ctx, "inferior");
    case "fuerza_superior":
      return strengthSession(day, ctx, "superior");
    case "calidad":
      return qualityRun(day, ctx);
    case "larga":
      return longRun(day, ctx);
    case "suave":
      return easyRun(day, ctx);
    case "especifica":
      return hyroxSession(day, ctx);
  }
  // `type` se conserva en la firma porque define el color/icono en la UI.
  return { day, type, title: "", focus: "", blocks: [] };
}

/* ------------------------------------------------------------------ */
/* Carrera                                                             */
/* ------------------------------------------------------------------ */

/**
 * Minutos de la carrera larga. Escala con la base de partida y con el avance
 * dentro del plan, con un techo por perfil.
 *
 * El techo importa más que el progreso: la lesión por sobrecarga en corredores
 * nuevos viene de subir volumen demasiado rápido, no de correr poco.
 */
function longRunMinutes(ctx: SessionContext): number {
  const start: Record<RunningBase, number> = { ninguna: 20, poca: 30, solida: 45 };
  const peak: Record<RunningBase, number> = { ninguna: 45, poca: 60, solida: 80 };
  const base = start[ctx.profile.runningBase];
  const top = peak[ctx.profile.runningBase];

  // En taper el volumen baja a la mitad: se llega descansado, no cansado.
  if (ctx.phase === "taper") return Math.round(base * 0.7);
  // La descarga corta un tercio respecto de lo que tocaría.
  const ramp = base + (top - base) * rampFor(ctx);
  return Math.round(ctx.isDeload ? ramp * 0.65 : ramp);
}

/**
 * Cuánto se ha avanzado en la progresión GLOBAL, no solo dentro de la fase.
 * Así el volumen crece a lo largo de todo el plan en vez de reiniciarse en cada
 * bloque, que es lo que pasaría usando solo `progress`.
 */
function rampFor(ctx: SessionContext): number {
  const phaseWeight: Record<PhaseKey, [number, number]> = {
    base: [0, 0.4],
    construccion: [0.4, 0.8],
    especifico: [0.8, 1],
    taper: [1, 1],
  };
  const [from, to] = phaseWeight[ctx.phase];
  return from + (to - from) * ctx.progress;
}

function longRun(day: DayName, ctx: SessionContext): Session {
  const min = longRunMinutes(ctx);
  const walkBreaks = ctx.profile.runningBase === "ninguna" && ctx.phase === "base";

  return {
    day,
    type: "carrera",
    title: walkBreaks ? `Carrera-caminata ${min}'` : `Carrera continua ${min}'`,
    focus: walkBreaks
      ? "Acumular minutos de pie sin castigar tendones ni articulaciones. Alternar es una progresión, no una rebaja."
      : "Base aeróbica. Todo el rendimiento posterior se apoya en esto.",
    blocks: walkBreaks
      ? [`${min}' alternando 4' de trote suave con 2' andando`, "Terminar con sensación de poder seguir"]
      : [
          `${min}' a ritmo conversado (deberías poder hablar frases enteras)`,
          ctx.phase === "especifico" || ctx.phase === "taper"
            ? "Últimos 10' a ritmo objetivo de carrera"
            : "Ritmo constante de principio a fin",
        ],
    notes: ctx.isDeload ? "Semana de descarga: hoy se acorta a propósito. No lo compenses." : undefined,
  };
}

function qualityRun(day: DayName, ctx: SessionContext): Session {
  const byPhase: Record<PhaseKey, { title: string; focus: string; blocks: string[] }> = {
    base: {
      title: "Cambios de ritmo suaves",
      focus: "Introducir intensidad sin castigar. Todavía no se busca ritmo, se busca soltura.",
      blocks: [
        "10' de calentamiento trotando",
        `${6 + Math.round(ctx.progress * 4)} × (1' algo más rápido / 2' muy suave)`,
        "10' de vuelta a la calma",
      ],
    },
    construccion: {
      title: "Series a umbral",
      focus: "Subir el ritmo sostenible. Es la sesión que más mueve el tiempo final.",
      blocks: [
        "15' de calentamiento progresivo",
        `${4 + Math.round(ctx.progress * 2)} × ${400 + Math.round(ctx.progress * 400)} m a ritmo de 5 km`,
        "Recuperación: 90\" trotando entre series",
        "10' de vuelta a la calma",
      ],
    },
    especifico: {
      title: "Series a ritmo de competición",
      focus: "Automatizar el ritmo objetivo para no salir demasiado rápido el día de la carrera.",
      blocks: [
        "15' de calentamiento",
        `${4 + Math.round(ctx.progress * 2)} × 1000 m a ritmo objetivo`,
        "Recuperación: 2' trotando",
        "El objetivo es un ritmo que se sienta automático",
      ],
    },
    taper: {
      title: "Recordatorio de ritmo",
      focus: "Mantener la sensación de velocidad sin generar fatiga.",
      blocks: ["10' calentando", "3 × 500 m a ritmo objetivo / 2' andando", "10' suave"],
    },
  };

  const spec = byPhase[ctx.phase];
  return {
    day,
    type: "carrera",
    title: spec.title,
    focus: spec.focus,
    blocks: spec.blocks,
    notes: ctx.isDeload ? "Descarga: la mitad de las series indicadas." : undefined,
  };
}

function easyRun(day: DayName, ctx: SessionContext): Session {
  return {
    day,
    type: "carrera",
    title: "Carrera de recuperación",
    focus: "Volumen fácil que acelera la recuperación. Si duele o pesa, se cambia por caminar.",
    blocks: [
      `${ctx.phase === "taper" ? 20 : 30}' muy suaves, más lento de lo que te pide el cuerpo`,
      "Ritmo de conversación cómoda todo el rato",
    ],
  };
}

/* ------------------------------------------------------------------ */
/* Específica de HYROX                                                 */
/* ------------------------------------------------------------------ */

/**
 * La sesión que define la preparación: correr con las piernas ya cargadas.
 *
 * Es lo que separa a quien va fuerte en el gimnasio y se hunde en la carrera de
 * quien termina bien. Ninguna otra sesión la sustituye.
 */
function hyroxSession(day: DayName, ctx: SessionContext): Session {
  const stations = stationNames(ctx.profile.equipment);
  const isDoubles = ctx.profile.division !== "individual";

  const byPhase: Record<PhaseKey, { title: string; focus: string; blocks: string[] }> = {
    base: {
      title: "Técnica de estaciones sin fatiga",
      focus: "Automatizar el gesto de cada estación mientras estás fresco. La técnica aprendida en fatiga se aprende mal.",
      blocks: [
        "Calentamiento 10'",
        `4 rondas: 400 m suaves + 1 estación al 60-70% (${stations})`,
        "Descanso completo entre rondas. Hoy no se busca cansarse.",
      ],
    },
    construccion: {
      title: "Correr con las piernas cargadas",
      focus: "Aprender a correr después de una estación. Aquí es donde se gana o se pierde la carrera.",
      blocks: [
        "Calentamiento 12'",
        `${4 + Math.round(ctx.progress * 2)} rondas: ${600 + Math.round(ctx.progress * 400)} m + 1 estación al 80%`,
        "Sin descanso entre carrera y estación: la transición es parte del ejercicio",
        `Rotar estaciones cada ronda (${stations})`,
      ],
    },
    especifico: {
      title: ctx.progress > 0.6 ? "Simulación completa" : "Media simulación",
      focus: "Ensayar la prueba real: ritmo, transiciones y decisiones bajo fatiga.",
      blocks:
        ctx.progress > 0.6
          ? [
              "Las 8 estaciones con 1 km de carrera entre cada una",
              "A ritmo controlado la primera vez; a ritmo de competición la segunda",
              "Cronometrar cada tramo y cada transición",
              isDoubles ? "En formato de tu división, con el reparto real que vais a usar" : "Solo, tal cual la carrera",
            ]
          : [
              "4 rondas: 1 km + 1 estación, a ritmo objetivo",
              "Cronometrar las transiciones: ahí se van minutos sin que nadie lo note",
              isDoubles ? "Practicar los relevos y los cambios" : "Practicar la entrada y salida de cada estación",
            ],
    },
    taper: {
      title: "Ensayo de transiciones",
      focus: "Repasar la coreografía sin generar fatiga. Cero series duras.",
      blocks: [
        "2 rondas muy suaves: 1 km + 1 estación al 60%",
        "Ensayar la logística: dónde queda el agua, cómo se entra y se sale de cada estación",
        isDoubles ? "Cerrar el reparto definitivo y los puntos de cambio" : "Cerrar tu estrategia de ritmo",
      ],
    },
  };

  const spec = byPhase[ctx.phase];
  return {
    day,
    type: "hyrox",
    title: spec.title,
    focus: spec.focus,
    blocks: spec.blocks,
    notes: equipmentNote(ctx.profile.equipment),
  };
}

/** Qué estaciones puede hacer de verdad según su material. */
function stationNames(equipment: Equipment): string {
  if (equipment === "completo") return "SkiErg, trineo, burpees, remo, farmers, zancadas con saco, wall balls";
  if (equipment === "gimnasio") return "remo, burpees, farmers con mancuernas, zancadas lastradas, wall balls o thrusters";
  return "burpees, zancadas lastradas con mochila, sentadillas con lanzamiento, plancha y desplazamientos";
}

function equipmentNote(equipment: Equipment): string | undefined {
  if (equipment === "completo") return undefined;
  if (equipment === "gimnasio") {
    return "Sin material de competición: sustituye trineo por prensa a alta repetición o cuestas, y SkiErg por remo. El estímulo se mantiene aunque el gesto cambie.";
  }
  return "Entrenando en casa: prioriza burpees, zancadas y desplazamientos, que son la mitad del trabajo real de HYROX. Busca probar el trineo y el SkiErg al menos dos veces antes de competir.";
}

/* ------------------------------------------------------------------ */
/* Fuerza                                                              */
/* ------------------------------------------------------------------ */

/**
 * Fuerza. Progresa carga solo en base y construcción; a partir de específico
 * pasa a mantenimiento.
 *
 * Es contraintuitivo pero es la decisión correcta: seguir subiendo cargas cerca
 * de la carrera resta capacidad de recuperación para las sesiones que sí van a
 * cambiar el resultado del día.
 */
function strengthSession(day: DayName, ctx: SessionContext, kind: "general" | "inferior" | "superior"): Session {
  const maintain = ctx.phase === "especifico" || ctx.phase === "taper";
  const intensity = maintain
    ? "Cargas moderadas, lejos del fallo. Mantener, no progresar."
    : ctx.profile.strengthBase === "principiante"
      ? "Céntrate en la técnica antes que en el peso. Sube solo si las repeticiones salen limpias."
      : `Sube algo respecto a la semana pasada si las últimas repeticiones salieron sólidas.`;

  const lower = ["Sentadilla 4×6", "Peso muerto rumano 3×8", "Zancadas cargadas 3×20 m", "Core 3×45\""];
  const upper = ["Press 4×6", "Remo 4×8", "Dominadas o jalón 4×máx", "Farmers carry 4×50 m"];
  const general = ["Sentadilla 4×6", "Press 3×8", "Remo 3×10", "Zancadas cargadas 3×20 m", "Core 3×45\""];

  const blocks = kind === "inferior" ? lower : kind === "superior" ? upper : general;

  return {
    day,
    type: "fuerza",
    title: maintain ? "Fuerza · mantenimiento" : `Fuerza · ${kind === "superior" ? "empuje y tracción" : "tren inferior"}`,
    focus: maintain
      ? "Conservar la fuerza ya ganada gastando lo mínimo. Cerca de la carrera, recuperar vale más que sumar."
      : "Construir la base de fuerza que sostiene el trineo, los farmers y las zancadas.",
    blocks: ctx.isDeload ? blocks.slice(0, 3).map((b) => `${b} (carga reducida)`) : blocks,
    notes: intensity,
  };
}
