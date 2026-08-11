import { FieldValue, type Firestore } from "firebase-admin/firestore";

const DOC_COLLECTION = "config";
const DOC_ID = "carouselSchedule";

export type CarouselSchedule = {
  enabled: boolean;
  /**
   * Horarios en hora local de Madrid ("HH:MM"). Igual que el de los reels, se
   * guardan en local y no en UTC porque Madrid cambia de huso dos veces al año
   * y un horario fijo en UTC se desfasaría una hora en cada cambio.
   */
  timesLocal: string[];
  /** Diapositivas por carrusel (entre 3 y 10, tope de Instagram). */
  slideCount: number;
  /** Texto de precio de la última diapositiva. Editable desde el panel. */
  priceLabel: string;
};

/** Precio real vigente (`src/lib/stripePlanPrices.ts`: 25 €/año = 2,08 €/mes). */
export const DEFAULT_PRICE_LABEL = "Premium desde 2,08 €/mes";

export const DEFAULT_CAROUSEL_SCHEDULE: CarouselSchedule = {
  enabled: true,
  timesLocal: ["09:30", "13:30"],
  // Cinco es el formato ya validado: espacio para gancho, problema, mecanismo,
  // contenido y cierre sin que la gente abandone antes del final.
  slideCount: 5,
  priceLabel: DEFAULT_PRICE_LABEL,
};

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export async function getCarouselSchedule(db: Firestore): Promise<CarouselSchedule> {
  const snap = await db.collection(DOC_COLLECTION).doc(DOC_ID).get();
  if (!snap.exists) return DEFAULT_CAROUSEL_SCHEDULE;
  const data = snap.data() || {};

  const times = Array.isArray(data.timesLocal)
    ? data.timesLocal.filter((t): t is string => typeof t === "string" && TIME_RE.test(t))
    : [];

  const rawCount = Number(data.slideCount);
  const slideCount = Number.isFinite(rawCount) ? Math.min(10, Math.max(3, Math.round(rawCount))) : DEFAULT_CAROUSEL_SCHEDULE.slideCount;

  return {
    enabled: typeof data.enabled === "boolean" ? data.enabled : DEFAULT_CAROUSEL_SCHEDULE.enabled,
    timesLocal: times.length > 0 ? times : DEFAULT_CAROUSEL_SCHEDULE.timesLocal,
    slideCount,
    priceLabel: typeof data.priceLabel === "string" && data.priceLabel.trim() ? data.priceLabel.trim() : DEFAULT_PRICE_LABEL,
  };
}

export async function setCarouselSchedule(db: Firestore, schedule: CarouselSchedule): Promise<void> {
  await db.collection(DOC_COLLECTION).doc(DOC_ID).set(
    {
      enabled: schedule.enabled,
      timesLocal: schedule.timesLocal,
      slideCount: schedule.slideCount,
      priceLabel: schedule.priceLabel,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}
