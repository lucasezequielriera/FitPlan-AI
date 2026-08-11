const GRAPH_BASE = "https://graph.facebook.com/v21.0";

/**
 * Métricas de una publicación. `reach`/`shares`/`saved`/`avgWatchTimeMs`
 * quedan en null si el token todavía no tiene `instagram_manage_insights`
 * (ver `insightsAvailable`); likes y comentarios se leen como campos del
 * media, que sí funcionan solo con `instagram_basic`.
 */
export type MediaMetrics = {
  likes: number | null;
  comments: number | null;
  reach: number | null;
  views: number | null;
  shares: number | null;
  saved: number | null;
  totalInteractions: number | null;
  avgWatchTimeMs: number | null;
  totalWatchTimeMs: number | null;
  permalink: string | null;
  /** false cuando faltó el permiso de insights — sirve para avisar en el admin. */
  insightsAvailable: boolean;
  insightsError: string | null;
};

const EMPTY: MediaMetrics = {
  likes: null,
  comments: null,
  reach: null,
  views: null,
  shares: null,
  saved: null,
  totalInteractions: null,
  avgWatchTimeMs: null,
  totalWatchTimeMs: null,
  permalink: null,
  insightsAvailable: false,
  insightsError: null,
};

/**
 * Métricas comunes a cualquier tipo de publicación.
 *
 * Las de tiempo de visualización son EXCLUSIVAS de reels: pedirlas sobre un
 * carrusel hace fallar la petición entera y se pierden también las métricas
 * que sí eran válidas, así que el conjunto se elige según el tipo de media.
 */
const COMMON_METRICS = ["reach", "shares", "saved", "total_interactions", "views"];
const REEL_ONLY_METRICS = ["ig_reels_avg_watch_time", "ig_reels_video_view_total_time"];

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Lee las métricas de una publicación de Instagram combinando dos llamadas:
 * los campos básicos del media (likes/comentarios/permalink, disponibles con
 * `instagram_basic`) y los insights (alcance, compartidos, guardados y tiempo
 * de visualización, que requieren `instagram_manage_insights`).
 *
 * Los insights se piden aparte y su fallo NO tumba la lectura: si el token no
 * tiene el permiso, se devuelven las métricas básicas con
 * `insightsAvailable: false` en vez de lanzar. Así el sistema de medición
 * funciona en modo degradado desde el primer día y se completa solo cuando se
 * amplía el permiso, sin tener que tocar código.
 */
export async function fetchMediaMetrics(mediaId: string, accessToken: string): Promise<MediaMetrics> {
  const result: MediaMetrics = { ...EMPTY };

  const fieldsResp = await fetch(
    `${GRAPH_BASE}/${mediaId}?fields=like_count,comments_count,permalink,media_product_type&access_token=${accessToken}`
  );
  const fieldsData = await fieldsResp.json();
  if (!fieldsResp.ok) {
    throw new Error(`Instagram (campos del media ${mediaId}) falló: ${fieldsData?.error?.message || fieldsResp.status}`);
  }
  result.likes = num(fieldsData.like_count);
  result.comments = num(fieldsData.comments_count);
  result.permalink = typeof fieldsData.permalink === "string" ? fieldsData.permalink : null;

  const isReel = fieldsData.media_product_type === "REELS";
  const metrics = (isReel ? [...COMMON_METRICS, ...REEL_ONLY_METRICS] : COMMON_METRICS).join(",");

  const insightsResp = await fetch(
    `${GRAPH_BASE}/${mediaId}/insights?metric=${metrics}&access_token=${accessToken}`
  );
  const insightsData = await insightsResp.json();
  if (!insightsResp.ok) {
    result.insightsError = insightsData?.error?.message || `HTTP ${insightsResp.status}`;
    return result;
  }

  const byName = new Map<string, number | null>();
  for (const entry of insightsData.data || []) {
    byName.set(entry.name, num(entry.values?.[0]?.value));
  }

  result.reach = byName.get("reach") ?? null;
  result.views = byName.get("views") ?? null;
  result.shares = byName.get("shares") ?? null;
  result.saved = byName.get("saved") ?? null;
  result.totalInteractions = byName.get("total_interactions") ?? null;
  result.avgWatchTimeMs = byName.get("ig_reels_avg_watch_time") ?? null;
  result.totalWatchTimeMs = byName.get("ig_reels_video_view_total_time") ?? null;
  result.insightsAvailable = true;
  return result;
}

/**
 * Retención: qué fracción del video se ve de media. Es la señal que más pesa
 * en la distribución, así que es la métrica sobre la que hay que comparar
 * piezas — no los likes, que son la señal de menor peso del sistema.
 *
 * Puede dar >1 si hay muchos replays (el tiempo medio visto supera la
 * duración), lo cual es justamente la mejor señal posible.
 */
export function retentionRatio(avgWatchTimeMs: number | null, durationSec: number | null): number | null {
  if (!avgWatchTimeMs || !durationSec || durationSec <= 0) return null;
  return avgWatchTimeMs / 1000 / durationSec;
}

/**
 * Tasa de amplificación: compartidos + guardados sobre alcance. Son las dos
 * señales que más empujan un video a lotes de distribución más grandes, y las
 * más caras de conseguir — un valor alto acá explica mejor un pico de alcance
 * que cualquier otra métrica.
 */
export function amplificationRate(metrics: MediaMetrics): number | null {
  if (!metrics.reach || metrics.reach <= 0) return null;
  const shares = metrics.shares ?? 0;
  const saved = metrics.saved ?? 0;
  if (metrics.shares === null && metrics.saved === null) return null;
  return (shares + saved) / metrics.reach;
}
