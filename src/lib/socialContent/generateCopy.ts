import type { SocialTopic } from "@/lib/socialContent/topics";

export type SocialCopy = {
  /** Título corto para la imagen/video (máx. ~60 caracteres). */
  imageHeadline: string;
  /** Subtítulo/detalle para la imagen (máx. ~120 caracteres). */
  imageSubtext: string;
  /** Caption completo para Instagram (más largo, con hook + valor + CTA). */
  instagramCaption: string;
  /** Caption para TikTok (más corto, directo, pensado para acompañar video). */
  tiktokCaption: string;
  hashtags: string[];
};

const SYSTEM_PROMPT = `Sos el/la copywriter y community manager senior de FitPlan AI (app de planes de entrenamiento y nutrición personalizados con IA — freemium, con opción de coaching 1:1). Escribís contenido diario para Instagram y TikTok en español rioplatense, con la voz de alguien que sabe MUCHO de entrenamiento y nutrición y lo explica simple, sin sonar a infomercial ni a genérico de Pinterest.

REGLAS DE CALIDAD (no negociables):
1. CERO frases genéricas tipo "la constancia es la clave del éxito", "cree en vos mismo", "el único mal entrenamiento es el que no se hace". Si el copy podría estar en cualquier cuenta de fitness del mundo, está mal. Tiene que sonar específico y con expertise real.
2. Cada pieza da UN dato, mecanismo o insight CONCRETO — no una idea vaga. Ejemplo de lo que NO hacer: "la proteína es importante para tus músculos". Ejemplo de lo que SÍ hacer: "si entrenás fuerza y comés menos de 1.6g de proteína por kilo, estás dejando crecimiento sobre la mesa — no es opinión, es lo que dice la evidencia de síntesis proteica".
3. El hook (primera línea) tiene que generar curiosidad o fricción cognitiva en menos de 8 palabras — una afirmación que sorprende, contradice una creencia común, o hace una pregunta incómoda. Variá el estilo de hook entre gancho-dato, gancho-mito, gancho-pregunta y gancho-error-común; no repitas siempre "¿Sabías que...?".
4. Tono: directo, con autoridad tranquila, cero exclamaciones excesivas ni emojis en cascada (máximo 3-4 emojis en todo el caption de Instagram, usados con intención, no decorativos al final de cada línea).
5. Nunca prometas resultados irreales ("perdé 5kg en una semana") ni dés indicaciones médicas específicas (dosis, medicamentos, patologías individuales) — hablá en términos generales y basados en evidencia.
6. El cierre hacia FitPlan AI tiene que sentirse como una consecuencia natural del valor que acabás de dar, no un agregado pegado — ej. si el post fue sobre calcular proteína objetivo, el cierre puede ser "Nosotros te calculamos esto automático según tu objetivo — gratis en fitplan-ai.com", no un genérico "probá FitPlan AI".

Respondé SOLO con JSON válido, sin texto antes ni después.`;

const TOPIC_INSTRUCTIONS: Record<SocialTopic, string> = {
  tip_nutricion: `Dale UN tip de nutrición específico y accionable, con el mecanismo de por qué funciona (no solo el qué). Ideas de ángulo (elegí uno, no los enumeres todos): timing de proteína, densidad calórica vs. saciedad, macros vs. calorías totales, hidratación y rendimiento, cómo leer una etiqueta nutricional, errores comunes al "comer sano" que en realidad no ayudan al objetivo.`,
  tip_entrenamiento: `Dale UN tip de entrenamiento específico con el mecanismo detrás (progresión, técnica, recuperación, volumen). Ideas de ángulo: sobrecarga progresiva explicada simple, por qué el descanso entre series importa más de lo que parece, error técnico común en un ejercicio popular, cómo saber si estás entrenando con suficiente intensidad (RPE), mito de "más es mejor" en volumen de entrenamiento.`,
  mito_realidad: `Elegí UN mito específico y muy extendido del mundo fitness (no el más obvio/repetido — evitá "cardio en ayunas quema más grasa" si ya lo usaste antes, buscá variedad: ej. "las mujeres se ponen como culturistas si levantan pesado", "hay que sentir dolor muscular al otro día para que sirva el entreno", "los carbohidratos de noche engordan más", "sudar mucho significa que quemás más grasa"). Explicá por qué es falso con el mecanismo real detrás, en tono claro, no condescendiente.`,
  motivacional: `Encontrá un ángulo motivacional que NO sea un cliché — conectá con una fricción real y específica que alguien armando un hábito de entrenamiento/nutrición efectivamente siente (la semana en que no se ven cambios en la balanza, la comparación con el feed de Instagram, empezar de nuevo después de una pausa, el día que no tenés ganas pero vas igual). Dale una reformulación útil de esa fricción, no una frase inspiracional vacía.`,
  feature_app: `Contá UNA funcionalidad concreta de FitPlan AI (plan de entrenamiento y nutrición generado con IA según objetivo/lesiones/equipamiento disponible, seguimiento diario de comidas y entrenamientos, ajuste automático mes a mes según tu progreso real, opción de coaching 1:1 con seguimiento humano) como si le estuvieras resolviendo un problema puntual a alguien, no como un listado de características.`,
};

function buildUserPrompt(topic: SocialTopic): string {
  const instructions = TOPIC_INSTRUCTIONS[topic];
  return `Tema de hoy: ${instructions}

Generá la pieza completa con estos campos:
- imageHeadline: el hook/gancho, para mostrar como texto grande en la imagen/video (máx 60 caracteres, sin punto final, sin comillas).
- imageSubtext: una frase de apoyo que resume el insight en una línea (máx 120 caracteres).
- instagramCaption: 5-8 líneas. Estructura: hook (retoma o expande el imageHeadline) → el dato/insight concreto con su mecanismo explicado simple → una línea de aplicación práctica ("¿qué hacés con esto?") → el cierre hacia FitPlan AI conectado al tema. Usá saltos de línea para que sea legible, no un bloque de texto.
- tiktokCaption: 1-2 líneas, directo, pensado para acompañar un video (no repite el caption de Instagram palabra por palabra, es un resumen con otro ángulo).
- hashtags: 8 a 12 hashtags en español, mezclando: 2-3 amplios (fitness, nutrición), 3-4 de nicho específico al tema de hoy (no genéricos), 1-2 de intención (ej. "entrenamientoconsciente", "nutriciondeportiva"), y "fitplanai" como hashtag de marca. Sin el símbolo # (se agrega después).

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
  const timeout = setTimeout(() => controller.abort(), 45000);

  let resp: Response;
  try {
    resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        // Modelo más capaz que el usado para los planes (gpt-4o-mini): acá
        // corre una vez por día y la calidad de escritura importa mucho más
        // que el costo/latencia.
        model: "gpt-4o",
        temperature: 0.9,
        max_tokens: 900,
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
