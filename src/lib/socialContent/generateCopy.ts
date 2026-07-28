import type { SocialTopic } from "@/lib/socialContent/topics";

export type SocialCopyScene = {
  /** Texto grande de la escena (máx ~55 caracteres). */
  headline: string;
  /** Línea de apoyo opcional (máx ~110 caracteres). */
  subtext?: string;
};

export type SocialCopy = {
  /** Exactamente 4 escenas para el video: hook, insight, takeaway, cta. */
  scenes: SocialCopyScene[];
  /** Caption completo para Instagram (hook + valor + aplicación + cierre). */
  instagramCaption: string;
  /** Caption para TikTok (más corto, directo, pensado para acompañar video). */
  tiktokCaption: string;
  hashtags: string[];
  /** Guion de narración en voz (locución), ~9-11s hablado — se sintetiza con TTS. */
  narration: string;
  /** Descripción de accesibilidad del video (alt text de Instagram). */
  altText: string;
};

export type TopicInput = { type: "rotation"; topic: SocialTopic } | { type: "custom"; description: string };

const SYSTEM_PROMPT = `Sos el/la copywriter y community manager senior de FitPlan AI (app de planes de entrenamiento y nutrición personalizados con IA — freemium, con opción de coaching 1:1). Escribís contenido para Instagram y TikTok en español rioplatense, con la voz de alguien que sabe MUCHO de entrenamiento y nutrición y lo explica simple, sin sonar a infomercial ni a genérico de Pinterest.

REGLAS DE CALIDAD (no negociables):
1. CERO frases genéricas tipo "la constancia es la clave del éxito", "cree en vos mismo", "el único mal entrenamiento es el que no se hace". Si el copy podría estar en cualquier cuenta de fitness del mundo, está mal. Tiene que sonar específico y con expertise real.
2. Cada pieza da UN dato, mecanismo o insight CONCRETO — no una idea vaga. Ejemplo de lo que NO hacer: "la proteína es importante para tus músculos". Ejemplo de lo que SÍ hacer: "si entrenás fuerza y comés menos de 1.6g de proteína por kilo, estás dejando crecimiento sobre la mesa — no es opinión, es lo que dice la evidencia de síntesis proteica".
3. El hook (primera escena) tiene que generar curiosidad o fricción cognitiva en menos de 8 palabras — una afirmación que sorprende, contradice una creencia común, o hace una pregunta incómoda. Variá el estilo de hook entre gancho-dato, gancho-mito, gancho-pregunta y gancho-error-común; no repitas siempre "¿Sabías que...?".
4. Tono: directo, con autoridad tranquila, cero exclamaciones excesivas ni emojis en cascada (máximo 3-4 emojis en todo el caption de Instagram, usados con intención, no decorativos al final de cada línea).
5. Nunca prometas resultados irreales ("perdé 5kg en una semana") ni dés indicaciones médicas específicas (dosis, medicamentos, patologías individuales) — hablá en términos generales y basados en evidencia.
6. El cierre hacia FitPlan AI tiene que sentirse como una consecuencia natural del valor que acabás de dar, no un agregado pegado.

El video tiene ESTRUCTURA DE 4 ESCENAS (cada una se muestra ~2.5s con transición):
1. HOOK: el gancho que genera curiosidad/fricción (headline muy corto, sin subtext o con uno mínimo).
2. INSIGHT: el dato/mecanismo concreto (headline = la afirmación central, subtext = el "por qué" en una línea).
3. TAKEAWAY: la aplicación práctica ("¿qué hacés con esto?") — headline = la acción concreta, subtext opcional.
4. CTA: cierre hacia FitPlan AI conectado al tema — headline corto, subtext = el link/llamado a la acción.

El video lleva una NARRACIÓN EN VOZ (locución sintetizada) que se escucha mientras se ven las 4 escenas — tiene que sonar como habla natural, no como alguien leyendo carteles en voz alta. Es un guion propio, no la concatenación literal de los headlines/subtexts.

Respondé SOLO con JSON válido, sin texto antes ni después.`;

const TOPIC_INSTRUCTIONS: Record<SocialTopic, string> = {
  tip_nutricion: `Dale UN tip de nutrición específico y accionable, con el mecanismo de por qué funciona (no solo el qué). Ideas de ángulo (elegí uno, no los enumeres todos): timing de proteína, densidad calórica vs. saciedad, macros vs. calorías totales, hidratación y rendimiento, cómo leer una etiqueta nutricional, errores comunes al "comer sano" que en realidad no ayudan al objetivo.`,
  tip_entrenamiento: `Dale UN tip de entrenamiento específico con el mecanismo detrás (progresión, técnica, recuperación, volumen). Ideas de ángulo: sobrecarga progresiva explicada simple, por qué el descanso entre series importa más de lo que parece, error técnico común en un ejercicio popular, cómo saber si estás entrenando con suficiente intensidad (RPE), mito de "más es mejor" en volumen de entrenamiento.`,
  mito_realidad: `Elegí UN mito específico y muy extendido del mundo fitness (buscá variedad: ej. "las mujeres se ponen como culturistas si levantan pesado", "hay que sentir dolor muscular al otro día para que sirva el entreno", "los carbohidratos de noche engordan más", "sudar mucho significa que quemás más grasa"). Explicá por qué es falso con el mecanismo real detrás, en tono claro, no condescendiente.`,
  motivacional: `Encontrá un ángulo motivacional que NO sea un cliché — conectá con una fricción real y específica que alguien armando un hábito de entrenamiento/nutrición efectivamente siente (la semana en que no se ven cambios en la balanza, la comparación con el feed de Instagram, empezar de nuevo después de una pausa, el día que no tenés ganas pero vas igual). Dale una reformulación útil de esa fricción, no una frase inspiracional vacía.`,
  feature_app: `Contá UNA funcionalidad concreta de FitPlan AI (plan de entrenamiento y nutrición generado con IA según objetivo/lesiones/equipamiento disponible, seguimiento diario de comidas y entrenamientos, ajuste automático mes a mes según tu progreso real, opción de coaching 1:1 con seguimiento humano) como si le estuvieras resolviendo un problema puntual a alguien, no como un listado de características.`,
};

function resolveTopicInstruction(input: TopicInput): string {
  if (input.type === "rotation") return TOPIC_INSTRUCTIONS[input.topic];
  return `El fundador de FitPlan AI pidió específicamente este tema/ángulo: "${input.description}". Desarrollalo con la misma vara de especificidad y mecanismo concreto que el resto de las reglas de calidad — si el pedido es genérico, aportale vos el ángulo específico y el dato concreto.`;
}

function buildUserPrompt(input: TopicInput): string {
  const instructions = resolveTopicInstruction(input);
  return `Tema de hoy: ${instructions}

Generá la pieza completa con estos campos:
- scenes: array de EXACTAMENTE 4 objetos { "headline": "...", "subtext": "..." } siguiendo la estructura hook/insight/takeaway/cta descrita arriba. "subtext" puede ser string vacío si esa escena no lo necesita (típicamente el hook).
- instagramCaption: 5-8 líneas. Estructura: hook (retoma o expande la escena 1) → el dato/insight concreto con su mecanismo explicado simple → una línea de aplicación práctica → el cierre hacia FitPlan AI conectado al tema. Usá saltos de línea para que sea legible, no un bloque de texto.
- tiktokCaption: 1-2 líneas, directo, pensado para acompañar el video (no repite el caption de Instagram palabra por palabra, es un resumen con otro ángulo).
- hashtags: 8 a 12 hashtags en español, mezclando: 2-3 amplios (fitness, nutrición), 3-4 de nicho específico al tema de hoy (no genéricos), 1-2 de intención (ej. "entrenamientoconsciente", "nutriciondeportiva"), y "fitplanai" como hashtag de marca. Sin el símbolo # (se agrega después).
- narration: guion de locución en español, HABLADO NATURAL (no leído de cartel), 30 a 42 palabras (~9-11 segundos a ritmo normal de habla). Cubre el mismo insight que las escenas pero como si se lo estuvieras contando a alguien, con ritmo y conectores naturales ("che", "fijate que", "la posta es"). Sin emojis ni hashtags (es para voz, no texto).
- altText: descripción de accesibilidad del video en español, 1 frase objetiva (qué se ve y de qué trata), máx 140 caracteres, para lectores de pantalla — no es marketing, es descriptivo.

Formato de respuesta (JSON):
{
  "scenes": [
    { "headline": "...", "subtext": "..." },
    { "headline": "...", "subtext": "..." },
    { "headline": "...", "subtext": "..." },
    { "headline": "...", "subtext": "..." }
  ],
  "instagramCaption": "...",
  "tiktokCaption": "...",
  "hashtags": ["...", "..."],
  "narration": "...",
  "altText": "..."
}`;
}

async function callOpenAIJson(params: { system: string; user: string; maxTokens: number; temperature: number; timeoutMs?: number }): Promise<Record<string, unknown>> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY no configurada — no se puede generar contenido social.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), params.timeoutMs ?? 45000);

  let resp: Response;
  try {
    resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        // Modelo más capaz que el usado para los planes (gpt-4o-mini): esto
        // corre con poca frecuencia y la calidad de escritura importa mucho
        // más que el costo/latencia.
        model: "gpt-4o",
        temperature: params.temperature,
        max_tokens: params.maxTokens,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: params.system },
          { role: "user", content: params.user },
        ],
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!resp.ok) {
    const detail = await resp.text().catch(() => "");
    throw new Error(`OpenAI respondió ${resp.status}: ${detail}`);
  }

  const data = await resp.json();
  const raw = data?.choices?.[0]?.message?.content;
  if (typeof raw !== "string") {
    throw new Error("Respuesta de OpenAI sin contenido.");
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("No se pudo parsear el JSON devuelto por OpenAI.");
  }
}

/**
 * Genera el copy (4 escenas + captions + hashtags) para un tema dado — ya
 * sea uno de la rotación fija (`{type: "rotation"}`) o uno libre escrito por
 * el fundador (`{type: "custom"}`, usado por el generador manual del panel
 * admin). Lanza si OPENAI_API_KEY no está configurada o si la respuesta no
 * tiene el shape esperado.
 */
export async function generateSocialCopy(input: TopicInput): Promise<SocialCopy> {
  const obj = await callOpenAIJson({
    system: SYSTEM_PROMPT,
    user: buildUserPrompt(input),
    maxTokens: 1100,
    temperature: 0.9,
  });

  const scenesRaw = Array.isArray(obj.scenes) ? obj.scenes : [];
  const scenes: SocialCopyScene[] = scenesRaw
    .filter((s): s is Record<string, unknown> => typeof s === "object" && s !== null)
    .map((s) => ({
      headline: typeof s.headline === "string" ? s.headline.trim() : "",
      subtext: typeof s.subtext === "string" ? s.subtext.trim() : undefined,
    }))
    .filter((s) => s.headline.length > 0);

  const instagramCaption = typeof obj.instagramCaption === "string" ? obj.instagramCaption.trim() : "";
  const tiktokCaption = typeof obj.tiktokCaption === "string" ? obj.tiktokCaption.trim() : "";
  const hashtags = Array.isArray(obj.hashtags)
    ? obj.hashtags.filter((h): h is string => typeof h === "string").map((h) => h.replace(/^#/, "").trim())
    : [];
  const narration = typeof obj.narration === "string" ? obj.narration.trim() : "";
  const altText = typeof obj.altText === "string" ? obj.altText.trim() : "";

  if (scenes.length < 3 || !instagramCaption || !narration) {
    throw new Error("Copy social generado incompleto (faltan escenas, caption o narración).");
  }

  return { scenes, instagramCaption, tiktokCaption, hashtags, narration, altText };
}

/**
 * Sugiere UN tema/ángulo específico y no genérico para cuando el fundador no
 * tiene una idea puntual — devuelve una descripción corta (no el copy final)
 * para que la revise/edite antes de generar la pieza completa.
 */
export async function suggestSocialTopic(): Promise<string> {
  const obj = await callOpenAIJson({
    system:
      "Sos un estratega de contenido para una app de fitness con IA (FitPlan AI). Sugerís UN ángulo de contenido específico, no genérico, que funcione bien en Instagram/TikTok (nutrición, entrenamiento, mitos, motivación, o una funcionalidad de la app). Respondé SOLO con JSON.",
    user: `Sugerime un tema puntual para el post de hoy. Tiene que ser específico (no "hablar de nutrición" sino, por ejemplo, "por qué contar calorías sin mirar proteína no sirve para nada"). Devolvé JSON: {"topic": "..."}`,
    maxTokens: 150,
    temperature: 1.0,
    timeoutMs: 20000,
  });

  const topic = typeof obj.topic === "string" ? obj.topic.trim() : "";
  if (!topic) {
    throw new Error("No se pudo generar una sugerencia de tema.");
  }
  return topic;
}
