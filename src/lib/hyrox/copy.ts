import type { PhaseKey } from "@/lib/hyrox/plan";
import type { SessionType } from "@/lib/hyrox/plan";

/**
 * Textos de la vista HYROX, en los dos idiomas de la app.
 *
 * Se agrupan aquí, como en `homeLandingCopy.ts`, en vez de repartirlos por el
 * componente: así se ve de un vistazo que las dos versiones están completas, y
 * añadir un idioma no obliga a recorrer el JSX buscando cadenas sueltas.
 */

export type HyroxLocale = "es" | "en";

export const HYROX_COPY = {
  es: {
    kicker: "Entrenamiento HYROX",
    titleNoProfile: "Prepara tu HYROX con un plan hecho a tu medida",
    introNoProfile:
      "Responde seis preguntas y genero tu plan completo hasta el día de la carrera: fases, sesiones semanales, ritmos objetivo y estrategia de cada estación.",
    startCta: "Crear mi plan HYROX",
    formTitle: "Tu carrera y tu punto de partida",
    raceDate: "Fecha de tu carrera",
    division: "División",
    category: "Categoría de pesos",
    daysPerWeek: "Días disponibles para entrenar por semana",
    runningBase: "¿Cómo estás de carrera ahora mismo?",
    strengthBase: "¿Y de fuerza?",
    equipment: "¿Con qué material cuentas?",
    hasRaced: "Ya he competido en un HYROX antes",
    goalMinutes: "Objetivo en minutos (opcional)",
    goalHint: "Déjalo vacío si tu objetivo es terminar bien. Es lo más sano la primera vez.",
    current5k: "Tu mejor 5 km reciente, en minutos (opcional)",
    current5kHint: "Es el dato que más afina la estimación: en HYROX la carrera es la mitad de la prueba.",
    limitations: "Lesiones o limitaciones (opcional)",
    submit: "Generar mi plan",
    saving: "Generando…",
    edit: "Cambiar mis datos",
    daysToRace: "para tu carrera",
    daysWord: "días",
    weekOf: "Semana",
    ofWeeks: "de",
    estimateTitle: "Tu tiempo estimado",
    estimateRun: "Carrera",
    estimateStations: "Estaciones",
    estimateRoxzone: "Transiciones",
    leverTitle: "Dónde está tu margen",
    leverLabels: {
      carrera: "La carrera. Es donde hay más minutos que recortar, y donde el plan pone el foco.",
      estaciones: "Las estaciones. Ganar eficiencia técnica te va a dar más que correr más rápido.",
      transiciones: "Las transiciones. Suenan a poco y son minutos enteros: practícalas.",
    },
    thisWeek: "Tu semana",
    phasesTitle: "Cómo se reparte tu preparación",
    stationsTitle: "Las 8 estaciones",
    stationsIntro: "El orden es siempre el mismo, y siempre hay 1 km de carrera antes de cada una.",
    commonMistake: "Error más común",
    doublesSplit: "Cómo repartirlo",
    noPlanTitle: "Sin plan todavía",
    restDay: "Descanso",
    deloadBadge: "Descarga",
    weekGoal: "Objetivo de la semana",
    translationFailedNote: null,
    premiumTitle: "HYROX es una función Premium",
    premiumIntro:
      "Tu plan completo hasta el día de la carrera: fases repartidas según las semanas que te queden de verdad, sesiones semanales adaptadas a tus días y tu material, ritmo objetivo calculado sobre tu marca de 5 km, y la estrategia de cada una de las 8 estaciones.",
    premiumBullets: [
      "Se adapta si te quedan 5 semanas o 20, sin recortar un plan genérico",
      "Más base de carrera sin fondo previo, para no llegar lesionado",
      "Dice dónde está tu margen real, medido en minutos",
    ],
    premiumCta: "Ver planes Premium",
    sessionTypes: {
      fuerza: "Fuerza",
      carrera: "Carrera",
      hyrox: "Específica HYROX",
      descanso: "Descanso",
    } as Record<SessionType, string>,
    phaseNames: {
      base: "Base aeróbica",
      construccion: "Construcción",
      especifico: "Específico",
      taper: "Afinado",
    } as Record<PhaseKey, string>,
  },
  en: {
    kicker: "HYROX training",
    titleNoProfile: "Prepare your HYROX with a plan built for you",
    introNoProfile:
      "Answer six questions and I'll generate your full plan up to race day: phases, weekly sessions, target paces and a strategy for every station.",
    startCta: "Create my HYROX plan",
    formTitle: "Your race and your starting point",
    raceDate: "Your race date",
    division: "Division",
    category: "Weight category",
    daysPerWeek: "Days you can train per week",
    runningBase: "How is your running right now?",
    strengthBase: "And your strength?",
    equipment: "What equipment do you have?",
    hasRaced: "I've raced a HYROX before",
    goalMinutes: "Target time in minutes (optional)",
    goalHint: "Leave it empty if your goal is to finish well. That's the healthiest first-time goal.",
    current5k: "Your recent best 5k, in minutes (optional)",
    current5kHint: "This is what sharpens the estimate most: running is half of a HYROX.",
    limitations: "Injuries or limitations (optional)",
    submit: "Generate my plan",
    saving: "Generating…",
    edit: "Change my details",
    daysToRace: "to your race",
    daysWord: "days",
    weekOf: "Week",
    ofWeeks: "of",
    estimateTitle: "Your estimated time",
    estimateRun: "Running",
    estimateStations: "Stations",
    estimateRoxzone: "Transitions",
    leverTitle: "Where your margin is",
    leverLabels: {
      carrera: "Running. That's where you can cut the most minutes, and where the plan focuses.",
      estaciones: "The stations. Technical efficiency will give you more than running faster.",
      transiciones: "Transitions. They sound minor and they're whole minutes: practise them.",
    },
    thisWeek: "Your week",
    phasesTitle: "How your preparation is split",
    stationsTitle: "The 8 stations",
    stationsIntro: "The order is always the same, and there's always a 1 km run before each one.",
    commonMistake: "Most common mistake",
    doublesSplit: "How to split it",
    noPlanTitle: "No plan yet",
    restDay: "Rest",
    deloadBadge: "Deload",
    weekGoal: "Goal of the week",
    premiumTitle: "HYROX is a Premium feature",
    premiumIntro:
      "Your full plan up to race day: phases split by the weeks you actually have left, weekly sessions matched to your days and equipment, target pace calculated from your 5k time, and a strategy for each of the 8 stations.",
    premiumBullets: [
      "Adapts whether you have 5 weeks left or 20 · not a generic plan cut short",
      "More aerobic base if you don't run, so you don't arrive injured",
      "Tells you where your real margin is, measured in minutes",
    ],
    premiumCta: "See Premium plans",
    // Solo se muestra si la traducción falló de verdad. El plan se genera en
    // español y se traduce con OpenAI; si eso falla, se dice, en vez de
    // enseñar dos idiomas mezclados sin explicación (el usuario asumiría que la
    // app está rota). Las guías de estación siguen siendo texto fijo español.
    translationFailedNote:
      "Some of this plan couldn't be translated and is showing in Spanish. Reload in a moment and it should come through in English.",
    sessionTypes: {
      fuerza: "Strength",
      carrera: "Running",
      hyrox: "HYROX specific",
      descanso: "Rest",
    } as Record<SessionType, string>,
    phaseNames: {
      base: "Aerobic base",
      construccion: "Build",
      especifico: "Race specific",
      taper: "Taper",
    } as Record<PhaseKey, string>,
  },
} as const;

export function hyroxCopy(locale: HyroxLocale) {
  return HYROX_COPY[locale] ?? HYROX_COPY.es;
}
