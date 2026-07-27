import { FieldValue, type Firestore } from "firebase-admin/firestore";

/**
 * Cotización EUR→ARS con caché en Firestore, para que el precio en ARS del plan
 * Premium (MercadoPago) siempre siga al precio objetivo en EUR (5/12/25, ver
 * stripePlanPrices.ts) en vez de quedar fijo con un tipo de cambio viejo.
 *
 * Fuente: dolarapi.com, cotización "oficial" (Banco Nación) — sin API key,
 * gratuita. Se usa el valor de "venta" (lo que cuesta comprar EUR), que es el
 * lado conservador/justo para convertir un precio en EUR a lo que le cuesta
 * conseguir esos EUR a un usuario en Argentina.
 *
 * Estrategia de resiliencia (nunca debe romper el flujo de pago):
 * 1. Un cron diario (`/api/cron/updateExchangeRate`) refresca el caché en
 *    Firestore `config/exchangeRateEurArs`.
 * 2. Si createPayment.ts encuentra el caché ausente o con más de 48hs, intenta
 *    una consulta en vivo y la cachea para la próxima vez.
 * 3. Si todo lo anterior falla, usa `FALLBACK_EUR_ARS_RATE` (constante de
 *    emergencia) para no romper el checkout — y loguea un warning bien visible
 *    para que el fundador se entere de que el caché dejó de actualizarse.
 */

const CACHE_COLLECTION = "config";
const CACHE_DOC_ID = "exchangeRateEurArs";
const MAX_CACHE_AGE_MS = 48 * 60 * 60 * 1000; // 48hs

/**
 * Última cotización oficial conocida al momento de escribir este código
 * (julio 2026, ~1704 ARS/EUR venta). Solo se usa si el caché de Firestore Y
 * la consulta en vivo fallan a la vez — actualizar ocasionalmente si el cron
 * lleva mucho tiempo caído (revisar logs con el warning de "usando fallback").
 */
const FALLBACK_EUR_ARS_RATE = 1704;

export type ExchangeRateResult = {
  rate: number;
  source: "cache" | "live" | "fallback";
  updatedAt: Date | null;
};

/** Consulta en vivo a dolarapi.com. Lanza si la respuesta no es válida. */
export async function fetchLiveEurArsRate(): Promise<number> {
  const response = await fetch("https://dolarapi.com/v1/cotizaciones/eur", {
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) {
    throw new Error(`dolarapi.com respondió ${response.status}`);
  }
  const data = (await response.json()) as { venta?: number };
  if (typeof data.venta !== "number" || !Number.isFinite(data.venta) || data.venta <= 0) {
    throw new Error("dolarapi.com no devolvió un valor de venta válido");
  }
  return data.venta;
}

/** Escribe la cotización en el caché de Firestore. Usado por el cron y por el fallback on-demand. */
export async function cacheEurArsRate(db: Firestore, rate: number): Promise<void> {
  await db.collection(CACHE_COLLECTION).doc(CACHE_DOC_ID).set(
    {
      rate,
      source: "dolarapi-oficial",
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

/**
 * Obtiene la cotización a usar para pricing: caché fresco → consulta en vivo
 * (y la cachea) → caché viejo como mejor esfuerzo → constante de emergencia.
 */
export async function getEurArsRateForPricing(db: Firestore): Promise<ExchangeRateResult> {
  let cachedRate: number | null = null;
  let cachedUpdatedAt: Date | null = null;

  try {
    const snap = await db.collection(CACHE_COLLECTION).doc(CACHE_DOC_ID).get();
    if (snap.exists) {
      const data = snap.data() || {};
      if (typeof data.rate === "number" && Number.isFinite(data.rate) && data.rate > 0) {
        cachedRate = data.rate;
        const ts = data.updatedAt;
        cachedUpdatedAt =
          ts && typeof ts.toDate === "function" ? ts.toDate() : null;
      }
    }
  } catch (err) {
    console.warn("⚠️ No se pudo leer el caché de cotización EUR/ARS:", err);
  }

  const cacheIsFresh =
    cachedRate !== null && cachedUpdatedAt !== null && Date.now() - cachedUpdatedAt.getTime() < MAX_CACHE_AGE_MS;

  if (cacheIsFresh && cachedRate !== null) {
    return { rate: cachedRate, source: "cache", updatedAt: cachedUpdatedAt };
  }

  try {
    const liveRate = await fetchLiveEurArsRate();
    cacheEurArsRate(db, liveRate).catch((err) =>
      console.warn("⚠️ No se pudo guardar la cotización en caché tras consultarla en vivo:", err)
    );
    return { rate: liveRate, source: "live", updatedAt: new Date() };
  } catch (err) {
    console.warn("⚠️ No se pudo obtener la cotización EUR/ARS en vivo:", err);
  }

  if (cachedRate !== null) {
    console.warn(
      `⚠️ Usando caché de cotización EUR/ARS vencido (>${MAX_CACHE_AGE_MS / 3600000}hs) porque la consulta en vivo falló.`
    );
    return { rate: cachedRate, source: "cache", updatedAt: cachedUpdatedAt };
  }

  console.error(
    `❌ Sin caché ni consulta en vivo de cotización EUR/ARS disponibles. Usando fallback fijo (${FALLBACK_EUR_ARS_RATE}) — revisar cron updateExchangeRate.`
  );
  return { rate: FALLBACK_EUR_ARS_RATE, source: "fallback", updatedAt: null };
}

/** Redondea un monto en ARS a un número "prolijo" para mostrar precios (múltiplos de 100). */
export function roundArsPrice(amount: number): number {
  return Math.round(amount / 100) * 100;
}
