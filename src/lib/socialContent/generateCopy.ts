import type { SocialTopic } from "@/lib/socialContent/topics";
import { topicLabel } from "@/lib/socialContent/topics";

export type SocialCopy = {
  /** Título corto para la imagen/video (máx. ~60 caracteres). */
  imageHeadline: string;
  /** Subtítulo/detalle para la imagen (máx. ~120 caracteres). */
  imageSubtext: string;
  /** Caption completo para Instagram (puede ser más largo, con hashtags). */
  instagramCaption: string;
  /** Caption para TikTok (más corto, directo). */
  tiktokCaption: string;
  hashtags: string[];
};

const SYSTEM_PROMPT = `Sos el/la community manager de FitPlan AI, una app de planes de entrenamiento y nutrición personalizados con IA (freemium, con opción de coaching 1:1). Escribís contenido diario para Instagram y TikTok en español (tono cercano, motivador, basado en evidencia, sin sonar a infomercial). Nunca prometas resultados irreales ni des consejos médicos específicos. Al final de cada caption, sumá un cierre suave que invite a probar FitPlan AI sin sonar forzado (ej. "¿Querés un plan armado para vos? Lo generamos gratis en fitplan-ai.com"). Respondé SOLO con JSON válido.`;

function buildUserPrompt(topic: SocialTopic): string {
  const label = topicLabel(topic);
  return `Generá una pieza de contenido sobre: "${label}".

Requisitos:
- imageHeadline: gancho corto y potente para la imagen/video (máx 60 caracteres, sin punto final).
- imageSubtext: una frase de apoyo (máx 120 caracteres).
- instagramCaption: 3-5 líneas, con 1-2 emojis, termina con el cierre suave hacia FitPlan AI.
- tiktokCaption: versión más corta y directa (1-2 líneas), pensada para acompañar un video, no un post estático.
- hashtags: 6 a 10 hashtags relevantes en español (fitness, nutrición, entrenamiento, motivación), sin el símbolo # (se agrega después).

Formato de respuesta (JSON):
{
  "imageHeadline": "...",
  "imageSubtext": "...",
  "instagramCaption": "...",
  "tiktokCaption": "...",
  "hashtags": ["...", "..."]
}`;
}

/**
 * Genera el copy del día para un tema dado. Lanza si OPENAI_API_KEY no está
 * configurada o si la respuesta no tiene el shape esperado — el cron
 * orquestador decide qué hacer ante un fallo (reintentar, avisar por
 * Telegram, no publicar ese día).
 */
export async function generateSocialCopy(topic: SocialTopic): Promise<SocialCopy> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY no configurada — no se puede generar contenido social.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  let resp: Response;
  try {
    resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.8,
        max_tokens: 700,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildUserPrompt(topic) },
        ],
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!resp.ok) {
    const detail = await resp.text().catch(() => "");
    throw new Error(`OpenAI respondió ${resp.status} generando copy social: ${detail}`);
  }

  const data = await resp.json();
  const raw = data?.choices?.[0]?.message?.content;
  if (typeof raw !== "string") {
    throw new Error("Respuesta de OpenAI sin contenido al generar copy social.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("No se pudo parsear el JSON de copy social devuelto por OpenAI.");
  }

  const obj = parsed as Record<string, unknown>;
  const imageHeadline = typeof obj.imageHeadline === "string" ? obj.imageHeadline.trim() : "";
  const imageSubtext = typeof obj.imageSubtext === "string" ? obj.imageSubtext.trim() : "";
  const instagramCaption = typeof obj.instagramCaption === "string" ? obj.instagramCaption.trim() : "";
  const tiktokCaption = typeof obj.tiktokCaption === "string" ? obj.tiktokCaption.trim() : "";
  const hashtags = Array.isArray(obj.hashtags)
    ? obj.hashtags.filter((h): h is string => typeof h === "string").map((h) => h.replace(/^#/, "").trim())
    : [];

  if (!imageHeadline || !instagramCaption) {
    throw new Error("Copy social generado incompleto (falta headline o caption).");
  }

  return { imageHeadline, imageSubtext, instagramCaption, tiktokCaption, hashtags };
}
