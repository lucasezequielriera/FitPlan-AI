/**
 * Rotación de temas para el contenido social diario. La idempotencia real
 * (evitar publicar dos veces el mismo día) vive en el cron orquestador;
 * acá solo se decide qué categoría tocar hoy para no repetir la de ayer.
 *
 * Mezcla categorías "seguras" (tips, feature de la app) con categorías más
 * picantes/polémicas pensadas para generar reacción y comentarios — a
 * pedido explícito del founder, priorizando atención/engagement por sobre
 * un tono siempre prolijo, mientras se respeten las reglas no negociables
 * de generateCopy.ts (nada de promesas falsas ni indicaciones médicas).
 */
export type SocialTopic =
  | "tip_nutricion"
  | "tip_entrenamiento"
  | "mito_realidad"
  | "motivacional"
  | "feature_app"
  | "confesion_incomoda"
  | "mito_polemico"
  | "comparacion_shock"
  | "error_viral"
  | "pregunta_incomoda";

export const SOCIAL_TOPICS: SocialTopic[] = [
  "tip_nutricion",
  "tip_entrenamiento",
  "mito_realidad",
  "motivacional",
  "feature_app",
  "confesion_incomoda",
  "mito_polemico",
  "comparacion_shock",
  "error_viral",
  "pregunta_incomoda",
];

const TOPIC_LABELS: Record<SocialTopic, string> = {
  tip_nutricion: "Tip de nutrición",
  tip_entrenamiento: "Tip de entrenamiento",
  mito_realidad: "Mito vs. realidad del fitness",
  motivacional: "Mensaje motivacional",
  feature_app: "Feature o beneficio de FitPlan AI",
  confesion_incomoda: "Confesión incómoda de la industria",
  mito_polemico: "Mito polémico (versión picante)",
  comparacion_shock: "Comparación shock",
  error_viral: "Error viral / todos lo hacen mal",
  pregunta_incomoda: "Pregunta incómoda directa",
};

export function topicLabel(topic: SocialTopic): string {
  return TOPIC_LABELS[topic] ?? topic;
}

/** Elige el próximo tema evitando repetir los últimos `recientes` usados. */
export function pickNextTopic(recientes: SocialTopic[]): SocialTopic {
  const disponibles = SOCIAL_TOPICS.filter((t) => !recientes.includes(t));
  const pool = disponibles.length > 0 ? disponibles : SOCIAL_TOPICS;
  // Determinístico por día del mes en vez de Math.random() (evita no-determinismo
  // innecesario y hace el resultado reproducible/testeable).
  const dayOfMonth = new Date().getDate();
  return pool[dayOfMonth % pool.length];
}
