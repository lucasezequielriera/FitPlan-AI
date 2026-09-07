/**
 * Embudo de conversión de FitPlan.
 *
 * Existe porque hasta 2026-09 no se medía nada de esto: había GA4, Meta y
 * TikTok, pero los tres miden ADQUISICIÓN (de dónde viene la visita), no qué
 * pasa dentro del producto. Sin estos números no se puede saber si "nadie
 * paga" significa que el producto no convence o que nadie llegó nunca al muro
 * de pago — dos problemas opuestos con soluciones opuestas.
 *
 * Los hitos se guardan como campos en el propio documento de `usuarios`, no en
 * una colección de eventos aparte: con el volumen actual, una colección de
 * eventos multiplicaría las lecturas de Firestore sin dar nada que estos
 * campos no den, y el informe se arma con UNA sola query.
 */

/** Nombre de cada hito. El orden define el orden del embudo. */
export const FUNNEL_STAGES = [
  "signup",
  "firstPlan",
  "returned",
  "paywall",
  "checkout",
  "paid",
] as const;

export type FunnelStageKey = (typeof FUNNEL_STAGES)[number];

/** Hitos que un cliente puede reportar. `signup`/`returned` se derivan, no se reportan. */
export const TRACKABLE_MILESTONES = ["firstPlan", "paywall", "checkout"] as const;
export type TrackableMilestone = (typeof TRACKABLE_MILESTONES)[number];

/**
 * Tope de días activos que se guardan por usuario. 60 cubre el cálculo de
 * retención a 30 días con margen, y evita que el array crezca sin límite en un
 * usuario que entre a diario durante años.
 */
export const ACTIVE_DAYS_CAP = 60;

/** Sub-objeto `funnel` dentro del documento de `usuarios`. */
export type FunnelMilestones = {
  /** Primera vez que el usuario generó un plan. */
  firstPlanAt?: string | null;
  /** Primera vez que vio el modal de pago. */
  paywallFirstAt?: string | null;
  /** Cuántas veces lo vio en total (señal de intención repetida). */
  paywallCount?: number;
  /** Primera vez que pulsó para pagar y salió hacia la pasarela. */
  checkoutStartedAt?: string | null;
  /** IDs de día (Madrid) en los que el usuario abrió la app. Tope `ACTIVE_DAYS_CAP`. */
  activeDays?: string[];
};

/** Forma mínima de un usuario para armar el informe. Sin tipos de Firestore. */
export type FunnelUser = {
  id: string;
  /** ID de día (Madrid) del alta. `null` si el documento no lo tiene. */
  signupDateId: string | null;
  premium: boolean;
  /** ID de día del pago, si pagó. */
  paidDateId?: string | null;
  funnel?: FunnelMilestones;
};

export type StageCount = {
  key: FunnelStageKey;
  label: string;
  /** Usuarios que alcanzaron esta etapa. */
  users: number;
  /** % respecto de la etapa anterior. `null` en la primera. */
  pctOfPrevious: number | null;
  /** % respecto del total de altas. */
  pctOfSignups: number;
};

export type RetentionSlice = {
  /** Usuarios con antigüedad suficiente para poder haber vuelto. */
  eligible: number;
  returned: number;
  pct: number;
};

export type FunnelReport = {
  /** Ventana analizada, en días. `null` = desde siempre. */
  windowDays: number | null;
  generatedAt: string;
  signups: number;
  stages: StageCount[];
  retention: { d1: RetentionSlice; d7: RetentionSlice; d30: RetentionSlice };
  /**
   * Dónde se cae más gente. Es la salida accionable del informe: dice en qué
   * hay que trabajar, en vez de dejar seis números sueltos que hay que
   * interpretar.
   */
  biggestDrop: { from: FunnelStageKey; to: FunnelStageKey; lostUsers: number; lostPct: number } | null;
};

export const STAGE_LABELS: Record<FunnelStageKey, string> = {
  signup: "Se registró",
  firstPlan: "Generó su plan",
  returned: "Volvió otro día",
  paywall: "Vio el muro de pago",
  checkout: "Inició el pago",
  paid: "Pagó",
};
