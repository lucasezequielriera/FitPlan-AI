/**
 * Rotación de temas para el contenido social diario. La idempotencia real
 * (evitar publicar dos veces el mismo día) vive en el cron orquestador;
 * acá solo se decide qué categoría tocar hoy para no repetir la de ayer.
 */
export type SocialTopic =
  | "tip_nutricion"
  | "tip_entrenamiento"
  | "mito_realidad"
  | "motivacional"
  | "feature_app";

export const SOCIAL_TOPICS: SocialTopic[] = [
  "tip_nutricion",
  "tip_entrenamiento",
  "mito_realidad",
  "motivacional",
  "feature_app",
];

const TOPIC_LABELS: Record<SocialTopic, string> = {
  tip_nutricion: "Tip de nutrición",
  tip_entrenamiento: "Tip de entrenamiento",
  mito_realidad: "Mito vs. realidad del fitness",
  motivacional: "Mensaje motivacional",
  feature_app: "Feature o beneficio de FitPlan AI",
};

export function topicLabel(topic: SocialTopic): string {
  return TOPIC_LABELS[topic];
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
