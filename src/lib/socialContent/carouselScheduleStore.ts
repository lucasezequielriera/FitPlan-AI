import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { getStripeSubscriptionPlans } from "@/lib/stripePlanPrices";

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
  /**
   * Si se muestra precio en la diapositiva final. Por defecto FALSE.
   *
   * Es un booleano aparte del texto a propósito. Antes bastaba con que
   * `priceLabel` tuviera algo guardado para que se publicara, y un valor que
   * había escrito automáticamente una versión vieja del código ("Premium desde
   * 2,08 €/mes", un precio que no existe en la web) siguió publicándose durante
   * semanas y pisó la decisión de producto de no mostrar precio. Con el
   * interruptor, un texto viejo en la base es inofensivo: hay que activarlo a
   * mano para que salga.
   */
  showPrice: boolean;
  /** Texto de precio de la última diapositiva. Solo se usa si `showPrice`. */
  priceLabel: string;
};

/**
 * Precio del CTA del carrusel. **Vacío a propósito: por defecto no se publica
 * ningún precio.** Decisión de Lucas (2026-09).
 *
 * Motivo: con el precio en 14,99 €/mes y sin prueba social todavía, poner el
 * número en una pieza que ve gente fría compite con el mensaje en vez de
 * reforzarlo — la pieza tiene que vender el resultado, y el precio se ve en la
 * web cuando la persona ya llegó con intención.
 *
 * Sigue siendo editable desde el panel (`/admin/configuraciones/carrusel-ig`):
 * si se escribe un texto ahí, se publica tal cual. `PRICE_LABEL_SUGGESTION`
 * existe solo para ofrecer el formato correcto y derivado del precio real, por
 * si se quiere volver a mostrarlo.
 */
export const DEFAULT_PRICE_LABEL = "";

/** Formato sugerido si se decide volver a mostrar precio. Deriva de stripePlanPrices.ts. */
export const PRICE_LABEL_SUGGESTION = `Premium desde ${getStripeSubscriptionPlans("eur").monthly.price} €/mes`;

export const DEFAULT_CAROUSEL_SCHEDULE: CarouselSchedule = {
  enabled: true,
  // Una franja diaria (mediodía, hora Madrid): pausa donde se le dedica
  // atención a algo que se lee, a diferencia de los reels que van a la
  // franja de mayor consumo de video corto.
  timesLocal: ["13:00"],
  // Cinco es el formato ya validado: espacio para gancho, problema, mecanismo,
  // contenido y cierre sin que la gente abandone antes del final.
  slideCount: 5,
  showPrice: false,
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
    // Ausente en el documento => false. Así un `priceLabel` heredado no se
    // publica hasta que alguien lo active explícitamente desde el panel.
    showPrice: data.showPrice === true,
    priceLabel: typeof data.priceLabel === "string" ? data.priceLabel.trim() : DEFAULT_PRICE_LABEL,
  };
}

export async function setCarouselSchedule(db: Firestore, schedule: CarouselSchedule): Promise<void> {
  await db.collection(DOC_COLLECTION).doc(DOC_ID).set(
    {
      enabled: schedule.enabled,
      timesLocal: schedule.timesLocal,
      slideCount: schedule.slideCount,
      showPrice: schedule.showPrice,
      priceLabel: schedule.priceLabel,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}
