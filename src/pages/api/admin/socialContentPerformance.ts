import type { NextApiRequest, NextApiResponse } from "next";
import type { Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/adminAuthServer";
import { topicHookFamily, topicLabel, MIN_SAMPLES_TO_TRUST, SOCIAL_TOPICS, type SocialTopic } from "@/lib/socialContent/topics";
import { amplificationRate, retentionRatio, type MediaMetrics } from "@/lib/socialContent/instagramInsights";
import { getTopicPerformance } from "@/lib/socialContent/performanceInsights";

type Piece = {
  id: string;
  /** reel o carrusel: solo los reels tienen retención. */
  format: "reel" | "carrusel";
  topic: string | null;
  topicName: string;
  contentFunction: string | null;
  hookFamily: string | null;
  slotLocal: string | null;
  headline: string;
  permalink: string | null;
  publishedAt: string | null;
  reach: number | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saved: number | null;
  /** Fracción del video vista de media. >1 significa que hubo replays. */
  retention: number | null;
  /** (compartidos + guardados) / alcance. */
  amplification: number | null;
  /** Cómo se eligió el tema de esta pieza — ver `pickNextTopic`. `null` en piezas de antes de que existiera esta auditoría. */
  topicSelectionMode: "weighted" | "rotation" | null;
};

type GroupStat = {
  key: string;
  label: string;
  pieces: number;
  avgRetention: number | null;
  avgReach: number | null;
  avgAmplification: number | null;
  avgInteractions: number | null;
};

/**
 * Por debajo de este alcance, la retención de una pieza individual es ruido
 * (una o dos personas viendo el video no dice nada de si el contenido
 * engancha) — se excluye de "mejores"/"peores piezas" en vez de mostrar un
 * número que parece un dato pero no lo es. Los grupos (`groupBy`) no usan
 * este corte: ahí el promedio ponderado por alcance ya resuelve el ruido sin
 * tener que descartar piezas enteras.
 */
const MIN_REACH_TO_RANK = 10;

function toIso(ts: unknown): string | null {
  if (ts && typeof ts === "object" && typeof (ts as Timestamp).toDate === "function") {
    return (ts as Timestamp).toDate().toISOString();
  }
  return null;
}

function average(values: (number | null)[]): number | null {
  const present = values.filter((v): v is number => v !== null);
  if (present.length === 0) return null;
  return present.reduce((a, b) => a + b, 0) / present.length;
}

/**
 * Promedio ponderado por alcance, para métricas que son una FRACCIÓN
 * (retención, amplificación) — encontrado con el primer análisis real sobre
 * el historial: un post con 1-2 cuentas alcanzadas puede mostrar "113% de
 * retención" (una persona que vio el video completo dos veces), y un
 * promedio simple deja que ese ruido pese exactamente igual que un post
 * probado en 150 cuentas reales. Mismo criterio que `performanceInsights.ts`
 * (el que de verdad decide qué tema elegir) — si el panel usara otra
 * cuenta, mostraría una historia distinta a la que el sistema realmente usa.
 */
function weightedAverage(pieces: Piece[], valueOf: (p: Piece) => number | null): number | null {
  const withValue = pieces.filter((p) => valueOf(p) !== null);
  if (withValue.length === 0) return null;
  const weightOf = (p: Piece) => Math.max(p.reach ?? 1, 1);
  const totalWeight = withValue.reduce((a, p) => a + weightOf(p), 0);
  return withValue.reduce((a, p) => a + (valueOf(p) as number) * weightOf(p), 0) / totalWeight;
}

/**
 * Agrupa las piezas por una dimensión (tema, función de embudo, familia de
 * gancho, franja horaria) y promedia sus métricas.
 *
 * Se ordena por retención media y no por alcance a propósito: el alcance es
 * el RESULTADO de haber retenido, así que ordenar por alcance mezcla la causa
 * con el efecto y premia por azar a lo que pilló un buen lote inicial. La
 * retención es la variable que el contenido controla de verdad.
 */
function groupBy(pieces: Piece[], key: (p: Piece) => string | null, label: (k: string) => string): GroupStat[] {
  const buckets = new Map<string, Piece[]>();
  for (const piece of pieces) {
    const k = key(piece);
    if (!k) continue;
    const list = buckets.get(k) || [];
    list.push(piece);
    buckets.set(k, list);
  }

  return Array.from(buckets.entries())
    .map(([k, list]) => ({
      key: k,
      label: label(k),
      pieces: list.length,
      avgRetention: weightedAverage(list, (p) => p.retention),
      avgReach: average(list.map((p) => p.reach)),
      avgAmplification: weightedAverage(list, (p) => p.amplification),
      avgInteractions: average(
        list.map((p) => {
          const parts = [p.likes, p.comments, p.shares, p.saved].filter((v): v is number => v !== null);
          return parts.length ? parts.reduce((a, b) => a + b, 0) : null;
        })
      ),
    }))
    .sort((a, b) => {
      if (a.avgRetention !== null && b.avgRetention !== null) return b.avgRetention - a.avgRetention;
      if (a.avgRetention !== null) return -1;
      if (b.avgRetention !== null) return 1;
      return (b.avgReach ?? 0) - (a.avgReach ?? 0);
    });
}

const FUNCTION_LABELS: Record<string, string> = {
  alcance: "Alcance",
  nutricion: "Nutrición de audiencia",
  conversion: "Conversión",
};

const HOOK_LABELS: Record<string, string> = {
  contradiccion: "Contradicción del consenso",
  coste: "Coste evitable",
  curiosidad: "Curiosidad específica",
  identidad: "Callout de identidad",
  confesion: "Confesión",
};

/**
 * Rendimiento del contenido social, cruzando las métricas recolectadas de
 * Instagram con las dimensiones estratégicas de cada pieza (tema, función de
 * embudo, familia de gancho y franja horaria).
 *
 * El objetivo no es un panel de vanity metrics sino responder a preguntas
 * accionables: qué familia de gancho retiene más, si la franja de la mañana
 * rinde mejor que la del mediodía, y qué temas conviene repetir.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const auth = await requireAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const db = getAdminDb();
  if (!db) return res.status(500).json({ error: "Firebase Admin SDK no configurado" });

  try {
    // Reels automáticos y carruseles. Los reels llevan retención (tiempo medio
    // visto / duración); los carruseles son imágenes y no tienen equivalente,
    // así que ahí la señal que manda es la amplificación (guardados y
    // compartidos sobre alcance).
    const [reelSnap, carouselSnap] = await Promise.all([
      db.collection("socialContent").orderBy("createdAt", "desc").limit(100).get(),
      db.collection("socialContentCarousel").orderBy("createdAt", "desc").limit(100).get(),
    ]);
    const snap = { docs: [...reelSnap.docs, ...carouselSnap.docs] };
    const carouselIds = new Set(carouselSnap.docs.map((d) => d.id));

    const pieces: Piece[] = [];
    let withMetrics = 0;
    let insightsAvailable = false;
    let insightsError: string | null = null;

    for (const doc of snap.docs) {
      const d = doc.data();
      if (d.status !== "published") continue;
      const isCarousel = carouselIds.has(doc.id);

      const metrics = (d.metrics || {}) as Partial<MediaMetrics>;
      if (d.metrics) withMetrics++;
      if (metrics.insightsAvailable) insightsAvailable = true;
      else if (metrics.insightsError && !insightsError) insightsError = metrics.insightsError;

      const topic = (d.topic as SocialTopic | undefined) ?? null;
      const full: MediaMetrics = {
        likes: metrics.likes ?? null,
        comments: metrics.comments ?? null,
        reach: metrics.reach ?? null,
        views: metrics.views ?? null,
        shares: metrics.shares ?? null,
        saved: metrics.saved ?? null,
        totalInteractions: metrics.totalInteractions ?? null,
        avgWatchTimeMs: metrics.avgWatchTimeMs ?? null,
        totalWatchTimeMs: metrics.totalWatchTimeMs ?? null,
        permalink: metrics.permalink ?? null,
        insightsAvailable: metrics.insightsAvailable ?? false,
        insightsError: metrics.insightsError ?? null,
      };

      pieces.push({
        id: doc.id,
        format: isCarousel ? "carrusel" : "reel",
        topic,
        topicName: isCarousel ? "Carrusel" : topic ? topicLabel(topic) : "(sin tema)",
        contentFunction: (d.contentFunction as string | undefined) ?? null,
        hookFamily: topic ? topicHookFamily(topic) : null,
        slotLocal: (d.slotLocal as string | undefined) ?? null,
        headline: isCarousel ? String(d.topic || "(sin tema)") : d.copy?.scenes?.[0]?.headline || "(sin titular)",
        permalink: full.permalink,
        publishedAt: toIso(d.publishedAt) ?? toIso(d.createdAt),
        reach: full.reach,
        views: full.views,
        likes: full.likes,
        comments: full.comments,
        shares: full.shares,
        saved: full.saved,
        retention: retentionRatio(full.avgWatchTimeMs, (d.videoDurationSec as number | undefined) ?? null),
        amplification: amplificationRate(full),
        topicSelectionMode: (d.topicSelection?.mode as "weighted" | "rotation" | undefined) ?? null,
      });
    }

    // Piezas con alcance por debajo del umbral no entran al ranking
    // individual: su retención/amplificación es puro ruido de muestra chica,
    // no señal (ver `MIN_REACH_TO_RANK`).
    const rankable = pieces.filter((p) => p.reach !== null && p.reach >= MIN_REACH_TO_RANK);
    const unrankedCount = pieces.length - rankable.length;
    const ranked = [...rankable].sort((a, b) => {
      if (a.retention !== null && b.retention !== null) return b.retention - a.retention;
      if (a.retention !== null) return -1;
      if (b.retention !== null) return 1;
      return (b.reach ?? 0) - (a.reach ?? 0);
    });

    // Estado del loop de aprendizaje por métricas (ver performanceInsights.ts
    // y pickNextTopic en topics.ts): cuenta cuántas piezas ya se
    // eligieron pesando por rendimiento real vs. la rotación de siempre, y
    // cuántos temas ya juntaron datos suficientes para poder pesar. Es la
    // respuesta concreta a "¿cómo sé que está funcionando?" — sin esto no
    // hay forma de verificarlo desde afuera del código.
    const withSelection = pieces.filter((p) => p.topicSelectionMode !== null);
    const topicPerformance = await getTopicPerformance(db);
    const topicsReady = Object.values(topicPerformance).filter((s) => s.sampleSize >= MIN_SAMPLES_TO_TRUST).length;
    const learningLoop = {
      piecesTracked: withSelection.length,
      weightedPicks: withSelection.filter((p) => p.topicSelectionMode === "weighted").length,
      rotationPicks: withSelection.filter((p) => p.topicSelectionMode === "rotation").length,
      topicsReady,
      topicsTotal: SOCIAL_TOPICS.length,
    };

    return res.status(200).json({
      ok: true,
      // Sin este permiso sólo hay likes y comentarios, que son las señales de
      // menor peso del algoritmo — el panel lo avisa para no sacar
      // conclusiones sobre datos que no miden lo que importa.
      insightsAvailable,
      insightsError,
      totals: { published: pieces.length, withMetrics },
      minReachToRank: MIN_REACH_TO_RANK,
      unrankedCount,
      learningLoop,
      byHookFamily: groupBy(pieces, (p) => p.hookFamily, (k) => HOOK_LABELS[k] ?? k),
      byFunction: groupBy(pieces, (p) => p.contentFunction, (k) => FUNCTION_LABELS[k] ?? k),
      bySlot: groupBy(pieces, (p) => p.slotLocal, (k) => `${k} (hora Madrid)`),
      byTopic: groupBy(pieces, (p) => p.topic, (k) => topicLabel(k)),
      byFormat: groupBy(pieces, (p) => p.format, (k) => (k === "carrusel" ? "Carrusel" : "Reel")),
      best: ranked.slice(0, 5),
      worst: ranked.filter((p) => p.retention !== null).slice(-5).reverse(),
    });
  } catch (error) {
    console.error("Error calculando rendimiento de contenido social:", error);
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: "No se pudo calcular el rendimiento", detail: message });
  }
}
