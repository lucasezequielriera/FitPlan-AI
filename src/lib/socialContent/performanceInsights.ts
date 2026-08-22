import type { Firestore } from "firebase-admin/firestore";
import { retentionRatio, amplificationRate, type MediaMetrics } from "@/lib/socialContent/instagramInsights";
import { TOPIC_REGISTRY, topicLabel, type SocialTopic, type HookFamily, type TopicPerformanceMap } from "@/lib/socialContent/topics";

/**
 * Loop de aprendizaje del contenido social: no es fine-tuning (no hay datos
 * ni control del modelo para eso), es un sistema retrieval-augmented simple —
 * lee lo que de verdad pasó en Instagram y lo usa en dos puntos:
 * 1. Pondera qué tema elegir (`pickTopicForFunction`, ver topics.ts).
 * 2. Le da contexto real al copywriter sobre qué gancho/tema viene
 *    funcionando antes de escribir la pieza de hoy (ver generateCopy.ts).
 */

const MIN_SAMPLES_TO_TRUST = 2;

type ScoredPiece = { topic: SocialTopic; hook: HookFamily; score: number; weight: number };

/**
 * Puntaje compuesto de una pieza: retención (la señal que más pesa en
 * distribución) + amplificación reescalada. La amplificación se multiplica
 * por 10 porque su rango típico (0-0.1) es mucho menor al de retención
 * (0.3-1.5+) — sin reescalar, quedaría invisible en la suma y el puntaje
 * terminaría siendo solo retención con otro nombre.
 *
 * Cuando falta una de las dos señales se usa un valor neutro (ni premia ni
 * castiga) en vez de tratar la pieza como si no tuviera datos — así una
 * pieza sin permiso de insights (solo likes/comentarios) igual puede opinar
 * sobre retención si esa parte sí está disponible, y viceversa.
 */
function scorePiece(retention: number | null, amplification: number | null): number | null {
  if (retention === null && amplification === null) return null;
  return (retention ?? 0.5) + (amplification ?? 0.02) * 10;
}

/**
 * Peso de confianza de una pieza para promediar, basado en su alcance real.
 *
 * Encontrado con el primer análisis sobre el historial real: las piezas con
 * 0-2 cuentas alcanzadas tenían "retención" de hasta 1.1+ (el tiempo medio
 * visto de 1-2 personas es puro ruido, no señal), mientras que piezas con
 * 100+ de alcance real mostraban retención baja y consistente — un promedio
 * simple dejaba que el ruido de 1-2 viewers pesara IGUAL que una pieza
 * probada en cien cuentas, y el sistema habría aprendido del ruido en vez
 * de la señal. Ponderar por alcance resuelve esto sin descartar piezas de
 * bajo alcance (siguen contando, solo que menos) — piso de 1 para que un
 * alcance de 0 no anule la pieza por completo.
 */
function confidenceWeight(reach: number | null): number {
  return Math.max(reach ?? 1, 1);
}

/**
 * Única lectura de Firestore que alimenta tanto `getTopicPerformance` como
 * `buildPerformanceContext` — evita pedir la colección dos veces por tick.
 */
async function loadScoredPieces(db: Firestore, limit: number): Promise<ScoredPiece[]> {
  const snap = await db.collection("socialContent").orderBy("createdAt", "desc").limit(limit).get();
  const out: ScoredPiece[] = [];

  for (const doc of snap.docs) {
    const d = doc.data();
    if (d.status !== "published") continue;
    const topic = d.topic as SocialTopic | undefined;
    if (!topic || !TOPIC_REGISTRY[topic]) continue;

    const metrics = (d.metrics || {}) as Partial<MediaMetrics>;
    const retention = retentionRatio(metrics.avgWatchTimeMs ?? null, (d.videoDurationSec as number | undefined) ?? null);
    const amplification = amplificationRate({
      reach: metrics.reach ?? null,
      shares: metrics.shares ?? null,
      saved: metrics.saved ?? null,
    });
    const score = scorePiece(retention, amplification);
    if (score === null) continue;

    out.push({ topic, hook: TOPIC_REGISTRY[topic].hook, score, weight: confidenceWeight(metrics.reach ?? null) });
  }

  return out;
}

function weightedAvg(pieces: ScoredPiece[]): number {
  const totalWeight = pieces.reduce((a, p) => a + p.weight, 0);
  return pieces.reduce((a, p) => a + p.score * p.weight, 0) / totalWeight;
}

/**
 * Puntaje medio (ponderado por alcance) y tamaño de muestra por tema, para
 * ponderar `pickTopicForFunction` hacia lo que mejor viene funcionando.
 * `sampleSize` sigue siendo la CANTIDAD de piezas (no el peso) — sirve para
 * el umbral de "¿lo probamos ya al menos dos veces?", que es una pregunta
 * distinta de "¿con cuánta confianza promediamos su resultado?".
 */
export async function getTopicPerformance(db: Firestore, limit = 200): Promise<TopicPerformanceMap> {
  const pieces = await loadScoredPieces(db, limit);
  const byTopic = new Map<SocialTopic, ScoredPiece[]>();
  for (const p of pieces) {
    const list = byTopic.get(p.topic) || [];
    list.push(p);
    byTopic.set(p.topic, list);
  }

  const result: TopicPerformanceMap = {};
  for (const [topic, list] of byTopic) {
    result[topic] = { avgScore: weightedAvg(list), sampleSize: list.length };
  }
  return result;
}

/**
 * Contexto en lenguaje natural sobre cómo vienen rindiendo el gancho y el
 * tema de HOY frente a la media general, para inyectar en el prompt de
 * `generateCopy.ts`. Deliberadamente acotado a lo que aplica a la pieza que
 * se está por escribir (no un dump genérico de "mejores y peores"): el
 * gancho de una pieza ya lo fija el tema elegido, así que la única palanca
 * real que le queda al copywriter es la EJECUCIÓN dentro de ese estilo, y
 * eso es lo que este contexto le pide ajustar.
 *
 * Devuelve cadena vacía si no hay señal suficiente todavía (menos de 4
 * piezas medidas en total, o menos de `MIN_SAMPLES_TO_TRUST` piezas del
 * gancho/tema en cuestión) — mejor no decir nada que opinar con una muestra
 * de una sola pieza.
 */
export async function buildPerformanceContext(
  db: Firestore,
  hook: HookFamily,
  topic: SocialTopic,
  limit = 200
): Promise<string> {
  const pieces = await loadScoredPieces(db, limit);
  if (pieces.length < 4) return "";

  const overallAvg = weightedAvg(pieces);
  const lines: string[] = [];

  const hookPieces = pieces.filter((p) => p.hook === hook);
  if (hookPieces.length >= MIN_SAMPLES_TO_TRUST) {
    const hookAvg = weightedAvg(hookPieces);
    const delta = ((hookAvg - overallAvg) / overallAvg) * 100;
    if (delta > 8) {
      lines.push(
        `El gancho de tipo "${hook}" viene reteniendo ${Math.round(delta)}% mejor que la media en piezas anteriores (${hookPieces.length} medidas) — es un estilo que está funcionando, mantén ese mismo nivel de filo y energía.`
      );
    } else if (delta < -8) {
      lines.push(
        `El gancho de tipo "${hook}" viene rindiendo ${Math.round(Math.abs(delta))}% por debajo de la media en piezas anteriores (${hookPieces.length} medidas) — sube deliberadamente la especificidad y el filo del gancho de hoy, algo en la ejecución de este estilo no está reteniendo.`
      );
    }
  }

  const topicPieces = pieces.filter((p) => p.topic === topic);
  if (topicPieces.length >= MIN_SAMPLES_TO_TRUST) {
    const topicAvg = weightedAvg(topicPieces);
    const delta = ((topicAvg - overallAvg) / overallAvg) * 100;
    if (delta < -8) {
      lines.push(
        `Este tema concreto ("${topicLabel(topic)}") viene rindiendo por debajo de la media en intentos anteriores — busca un ángulo más específico o inesperado que las veces pasadas, no repitas el mismo enfoque.`
      );
    } else if (delta > 8) {
      lines.push(
        `Este tema concreto ("${topicLabel(topic)}") viene reteniendo ${Math.round(delta)}% mejor que la media — es terreno que funciona, no hace falta reinventarlo, solo mantener la misma densidad y especificidad.`
      );
    }
  }

  if (lines.length === 0) return "";
  return `CONTEXTO DE RENDIMIENTO REAL (${pieces.length} piezas medidas — úsalo para escribir mejor, NO lo menciones en el copy ni en pantalla):\n${lines.map((l) => `- ${l}`).join("\n")}`;
}
