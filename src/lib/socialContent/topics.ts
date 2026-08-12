/**
 * Taxonomía de contenido social de FitPlan.
 *
 * El eje principal NO es "de qué habla" sino PARA QUÉ SIRVE cada pieza
 * (`ContentFunction`), porque son objetivos distintos que se optimizan
 * distinto y no se pueden mezclar en la misma pieza sin perder las dos:
 *
 * - alcance:    que te descubra gente nueva. Hook agresivo, cero CTA duro
 *               (un CTA temprano mata retención, y la retención es la única
 *               señal que abre la puerta al siguiente lote de distribución).
 * - nutricion:  que quien ya te vio confíe. Profundidad, mecanismo, cara
 *               visible del proyecto. CTA suave.
 * - conversion: que compre. Objeciones reales, mecanismo único, prueba.
 *               Poco alcance por diseño, alta intención.
 *
 * Mezcla objetivo ~60/30/10 (alcance/nutrición/conversión), que con 2 piezas
 * diarias se resuelve en `functionForSlot`: el slot de la mañana es siempre
 * alcance y el del mediodía rota — ver ahí el detalle del reparto semanal.
 *
 * El segundo eje es `hook`: la familia de gancho con la que abre la pieza.
 * Se rota explícitamente porque el mayor riesgo de una cuenta automatizada es
 * que todos los videos abran igual — el sistema aprende el patrón, la
 * audiencia también, y la retención de los primeros 3 segundos se desploma.
 */

/** Para qué sirve la pieza dentro del embudo. */
export type ContentFunction = "alcance" | "nutricion" | "conversion";

/**
 * Familia de gancho de los primeros 3 segundos. Cada una instala una pregunta
 * abierta distinta en la cabeza de quien mira; rotarlas evita que la cuenta
 * suene siempre igual.
 */
export type HookFamily =
  /** Contradice el consenso: "esto que todos repiten está mal". */
  | "contradiccion"
  /** Coste evitable: "esto te está costando X sin que lo sepas". */
  | "coste"
  /** Curiosidad específica: un dato concreto que no se ve venir. */
  | "curiosidad"
  /** Callout de identidad: "si haces X, esto va por ti". */
  | "identidad"
  /** Confesión / vulnerabilidad: algo que normalmente no se cuenta. */
  | "confesion";

export type SocialTopic =
  // --- alcance ---
  | "mito_polemico"
  | "comparacion_shock"
  | "error_viral"
  | "verdad_industria"
  | "pregunta_incomoda"
  | "coste_oculto"
  | "dato_contraintuitivo"
  | "confesion_fundador"
  // --- nutrición ---
  | "mecanismo_explicado"
  | "tip_entrenamiento"
  | "tip_nutricion"
  | "caso_practico"
  | "detras_de_escena"
  // --- conversión ---
  | "objecion_tiempo"
  | "objecion_ya_probe"
  | "mecanismo_unico"
  | "prueba_resultado";

type TopicDef = { fn: ContentFunction; hook: HookFamily; label: string };

export const TOPIC_REGISTRY: Record<SocialTopic, TopicDef> = {
  // --- alcance (60%): optimizadas para retención + compartidos ---
  mito_polemico: { fn: "alcance", hook: "contradiccion", label: "Mito polémico" },
  comparacion_shock: { fn: "alcance", hook: "curiosidad", label: "Comparación shock" },
  error_viral: { fn: "alcance", hook: "coste", label: "Error que todos cometen" },
  verdad_industria: { fn: "alcance", hook: "confesion", label: "Verdad incómoda de la industria" },
  pregunta_incomoda: { fn: "alcance", hook: "identidad", label: "Pregunta incómoda" },
  coste_oculto: { fn: "alcance", hook: "coste", label: "Coste oculto" },
  dato_contraintuitivo: { fn: "alcance", hook: "curiosidad", label: "Dato contraintuitivo" },
  confesion_fundador: { fn: "alcance", hook: "confesion", label: "Confesión del fundador" },

  // --- nutrición (30%): construyen confianza y relación ---
  mecanismo_explicado: { fn: "nutricion", hook: "curiosidad", label: "Mecanismo explicado" },
  tip_entrenamiento: { fn: "nutricion", hook: "coste", label: "Tip de entrenamiento" },
  tip_nutricion: { fn: "nutricion", hook: "coste", label: "Tip de nutrición" },
  caso_practico: { fn: "nutricion", hook: "identidad", label: "Caso práctico" },
  detras_de_escena: { fn: "nutricion", hook: "confesion", label: "Detrás de escena" },

  // --- conversión (10%): poco alcance por diseño, alta intención ---
  objecion_tiempo: { fn: "conversion", hook: "identidad", label: "Objeción: no tengo tiempo" },
  objecion_ya_probe: { fn: "conversion", hook: "identidad", label: "Objeción: ya probé y lo dejé" },
  mecanismo_unico: { fn: "conversion", hook: "contradiccion", label: "Mecanismo único de FitPlan" },
  prueba_resultado: { fn: "conversion", hook: "curiosidad", label: "Prueba > promesa" },
};

export const SOCIAL_TOPICS = Object.keys(TOPIC_REGISTRY) as SocialTopic[];

/**
 * Etiquetas de temas viejos que ya no se generan pero siguen existiendo en el
 * historial de Firestore — para que el panel admin no muestre slugs crudos.
 */
const LEGACY_LABELS: Record<string, string> = {
  mito_realidad: "Mito vs. realidad",
  motivacional: "Mensaje motivacional",
  feature_app: "Feature de la app",
  confesion_incomoda: "Confesión incómoda",
};

export function topicLabel(topic: SocialTopic | string): string {
  return TOPIC_REGISTRY[topic as SocialTopic]?.label ?? LEGACY_LABELS[topic] ?? topic;
}

export function topicFunction(topic: SocialTopic): ContentFunction {
  return TOPIC_REGISTRY[topic]?.fn ?? "alcance";
}

export function topicHookFamily(topic: SocialTopic): HookFamily {
  return TOPIC_REGISTRY[topic]?.hook ?? "curiosidad";
}

/** Día del año (1-366) en UTC — base determinística para rotar sin Math.random(). */
function dayOfYear(date: Date): number {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  return Math.floor((date.getTime() - start) / 86400000);
}

/**
 * Qué función cumple la pieza de un slot dado.
 *
 * Con 2 piezas diarias (14 semanales) el reparto queda:
 * - 09:00 → alcance los 7 días                          = 7 piezas
 * - 13:00 → nutrición lun/mar/jue/vie, conversión mié/sáb, alcance dom
 *                                                        = 4 + 2 + 1
 * Total semanal: 8 alcance / 4 nutrición / 2 conversión ≈ 57/29/14, que es la
 * mezcla objetivo con un pequeño sesgo extra hacia alcance (lo correcto en
 * fase de construcción de audiencia, donde el cuello de botella es que te
 * descubran, no que te compren).
 */
export function functionForSlot(slotLocal: string, date: Date): ContentFunction {
  const hour = parseInt(slotLocal.split(":")[0] ?? "", 10);

  // Slot de mediodía: la franja donde la gente consume con más calma y está
  // más receptiva a profundidad y a oferta.
  if (hour >= 12 && hour < 18) {
    const weekday = date.getUTCDay(); // 0 = domingo
    if (weekday === 3 || weekday === 6) return "conversion";
    if (weekday === 0) return "alcance";
    return "nutricion";
  }

  // Mañana (y cualquier otro slot que se agregue): siempre alcance.
  return "alcance";
}

/**
 * Elige el próximo tema de una función dada, evitando los usados
 * recientemente y rotando además la familia de gancho: si el gancho de la
 * última pieza publicada se repite en el candidato, se busca otro. Así no
 * salen dos videos seguidos que abren igual, que es el patrón que más rápido
 * quema una cuenta automatizada.
 */
export function pickTopicForFunction(
  fn: ContentFunction,
  recentTopics: SocialTopic[],
  date: Date = new Date()
): SocialTopic {
  const ofFunction = SOCIAL_TOPICS.filter((t) => TOPIC_REGISTRY[t].fn === fn);
  const notRecent = ofFunction.filter((t) => !recentTopics.includes(t));
  const pool = notRecent.length > 0 ? notRecent : ofFunction;

  const lastHook = recentTopics[0] ? TOPIC_REGISTRY[recentTopics[0]]?.hook : undefined;
  const differentHook = pool.filter((t) => TOPIC_REGISTRY[t].hook !== lastHook);
  const finalPool = differentHook.length > 0 ? differentHook : pool;

  return finalPool[dayOfYear(date) % finalPool.length];
}
