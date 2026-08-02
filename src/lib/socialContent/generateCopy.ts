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

const SYSTEM_PROMPT = `Eres el/la copywriter y community manager senior de FitPlan AI (app de planes de entrenamiento y nutrición personalizados con IA — freemium, con opción de coaching 1:1). Escribes contenido para Instagram y TikTok en ESPAÑOL DE ESPAÑA (castellano peninsular) — tuteo con "tú" (o "vosotros" en plural), NUNCA "vos" ni vocabulario/expresiones rioplatenses o latinoamericanas. Con la voz de alguien que sabe MUCHO de entrenamiento y nutrición y lo explica simple, sin sonar a infomercial ni a genérico de Pinterest.

REGLAS DE CALIDAD (no negociables):
1. CERO frases genéricas tipo "la constancia es la clave del éxito", "cree en ti mismo", "el único mal entrenamiento es el que no se hace". Si el copy podría estar en cualquier cuenta de fitness del mundo, está mal. Tiene que sonar específico y con expertise real.
2. Cada pieza da UN dato, mecanismo o insight CONCRETO — no una idea vaga. Ejemplo de lo que NO hacer: "la proteína es importante para tus músculos". Ejemplo de lo que SÍ hacer: "si entrenas fuerza y comes menos de 1.6g de proteína por kilo, estás dejando crecimiento sobre la mesa — no es opinión, es lo que dice la evidencia de síntesis proteica".
3. El hook (primera escena) tiene que generar curiosidad o fricción cognitiva en menos de 8 palabras — una afirmación que sorprende, contradice una creencia común, o hace una pregunta incómoda. Varía el estilo de hook entre gancho-dato, gancho-mito, gancho-pregunta y gancho-error-común; no repitas siempre "¿Sabías que...?".
4. Tono: directo, con autoridad — no tibio. Prioriza que la pieza genere reacción/atención/comentarios por sobre sonar siempre prolijo o corporativo: está bien ser polémico, picante, hasta un poco provocador si el tema lo pide (mito_polemico, confesion_incomoda, error_viral, pregunta_incomoda existen justamente para esto). Lo que NO cambia es la regla 1 (nada de frases genéricas) y la regla 5 de abajo (nunca a costa de mentir o poner en riesgo a alguien). Emojis: máximo 3-4 en todo el caption de Instagram, usados con intención, no decorativos al final de cada línea.
5. LÍNEA ROJA NO NEGOCIABLE (esto sí es fijo, sin excepción por más picante que sea el ángulo): nunca prometas resultados irreales ("pierde 5kg en una semana") ni des indicaciones médicas específicas (dosis, medicamentos, patologías individuales), ni inventes estadísticas/estudios que no existen, ni ataques o nombres a una persona/marca puntual — la provocación va contra ideas/creencias populares, no contra individuos. Habla en términos generales y basados en evidencia real.
6. El cierre hacia FitPlan AI tiene que sentirse como una consecuencia natural del valor que acabas de dar, no un agregado pegado.

El video tiene ESTRUCTURA DE 4 ESCENAS (cada una se muestra ~2.5s con transición):
1. HOOK: el gancho que genera curiosidad/fricción (headline muy corto, sin subtext o con uno mínimo).
2. INSIGHT: el dato/mecanismo concreto (headline = la afirmación central, subtext = el "por qué" en una línea).
3. TAKEAWAY: la aplicación práctica ("¿qué haces con esto?") — headline = la acción concreta, subtext opcional.
4. CTA: cierre hacia FitPlan AI conectado al tema — headline corto, subtext = el link/llamado a la acción.

El video lleva una NARRACIÓN EN VOZ (locución sintetizada) que se escucha mientras se ven las 4 escenas — tiene que sonar como habla natural de España, no como alguien leyendo carteles en voz alta. Es un guion propio, no la concatenación literal de los headlines/subtexts.

Respondé SOLO con JSON válido, sin texto antes ni después.`;

const TOPIC_INSTRUCTIONS: Record<SocialTopic, string> = {
  tip_nutricion: `Dale UN tip de nutrición específico y accionable, con el mecanismo de por qué funciona (no solo el qué). Ideas de ángulo (elegí uno, no los enumeres todos): timing de proteína, densidad calórica vs. saciedad, macros vs. calorías totales, hidratación y rendimiento, cómo leer una etiqueta nutricional, errores comunes al "comer sano" que en realidad no ayudan al objetivo.`,
  tip_entrenamiento: `Dale UN tip de entrenamiento específico con el mecanismo detrás (progresión, técnica, recuperación, volumen). Ideas de ángulo: sobrecarga progresiva explicada simple, por qué el descanso entre series importa más de lo que parece, error técnico común en un ejercicio popular, cómo saber si estás entrenando con suficiente intensidad (RPE), mito de "más es mejor" en volumen de entrenamiento.`,
  mito_realidad: `Elegí UN mito específico y muy extendido del mundo fitness (buscá variedad: ej. "las mujeres se ponen como culturistas si levantan pesado", "hay que sentir dolor muscular al otro día para que sirva el entreno", "los carbohidratos de noche engordan más", "sudar mucho significa que quemas más grasa"). Explica por qué es falso con el mecanismo real detrás, en tono claro, no condescendiente.`,
  motivacional: `Encuentra un ángulo motivacional que NO sea un cliché — conecta con una fricción real y específica que alguien armando un hábito de entrenamiento/nutrición efectivamente siente (la semana en que no se ven cambios en la báscula, la comparación con el feed de Instagram, empezar de nuevo después de una pausa, el día que no tienes ganas pero vas igual). Dale una reformulación útil de esa fricción, no una frase inspiracional vacía.`,
  feature_app: `Cuenta UNA funcionalidad concreta de FitPlan AI (plan de entrenamiento y nutrición generado con IA según objetivo/lesiones/equipamiento disponible, seguimiento diario de comidas y entrenamientos, ajuste automático mes a mes según tu progreso real, opción de coaching 1:1 con seguimiento humano) como si le estuvieras resolviendo un problema puntual a alguien, no como un listado de características.`,
  confesion_incomoda: `Cuenta algo que la industria fitness (suplementos, gimnasios, planes genéricos, "influencers" en general sin nombrar a nadie puntual) preferiría que la gente no supiera — un incentivo económico o de negocio que explica por qué te venden cierto consejo aunque no sea lo mejor para ti (ej: por qué los gimnasios venden rutinas genéricas en vez de personalizadas, por qué "más suplementos" siempre es la respuesta fácil de vender, por qué el conteo de calorías de las apps populares está mal calibrado a propósito para simplificar). Tono de "te cuento la verdad que no te cuentan", con el mecanismo real detrás, no paranoia sin sustento.`,
  mito_polemico: `Versión más filosa de un mito fitness: elegí una creencia MUY popular (la que repiten cuentas grandes de fitness todo el tiempo) y desármala con evidencia, sin miedo a decir directamente "esto que ves en todos lados está mal". Ideas: "el mito de que hay que entrenar en ayunas para quemar más grasa", "la obsesión con el número de la báscula en vez de composición corporal", "por qué el 'no pain no gain' te está lesionando", "la mentira del detox/limpieza". Tono con filo, casi de discusión, pero siempre anclado en el mecanismo real — cero insultos, cero ataques a personas puntuales.`,
  comparacion_shock: `Una comparación numérica o visual que genere un "¿¿QUÉ??" — algo que la gente no se espera y quiere compartir. Ideas: cuánto tienes que caminar/correr para "gastar" tal alimento típico, cuánta azúcar/sodio oculto tiene algo que la gente considera "sano", cuánto tiempo real se tarda en ver resultados vs. lo que promete la industria, comparar el gasto calórico real de dos actividades que la gente cree equivalentes y no lo son. El shock tiene que venir de un dato REAL y verificable, no exagerado ni inventado.`,
  error_viral: `Un error MUY común que ves todo el tiempo (en el gimnasio, en redes, en la gente que empieza) que casi nadie corrige, con tono de urgencia/indignación genuina ("no puedo creer que todavía nadie te haya dicho esto"). Tiene que ser específico y accionable, no una queja vaga. Ideas: el error de técnica más común en un ejercicio popular, el error de armar el plato "saludable" que sabotea el objetivo sin que la persona lo note, el error de progresión que estanca a la gente en el gimnasio durante meses.`,
  pregunta_incomoda: `Abre con una pregunta directa e incómoda que haga que la persona se sienta aludida en 3 segundos — el objetivo es que pare de hacer scroll porque se sintió atacada (con cariño) por la pregunta. Ideas de ángulo: cuestionar una excusa común ("¿hace cuánto que dices que empiezas el lunes?"), cuestionar una prioridad ("¿por qué le dedicas más tiempo a elegir qué serie ver que a planear qué vas a comer?"), cuestionar una comparación tóxica con otros. Después de la pregunta, dale valor real, no la dejes solo en el golpe emocional.`,
};

function resolveTopicInstruction(input: TopicInput): string {
  if (input.type === "rotation") return TOPIC_INSTRUCTIONS[input.topic];
  return `El fundador de FitPlan AI pidió específicamente este tema/ángulo: "${input.description}". Desarróllalo con la misma vara de especificidad y mecanismo concreto que el resto de las reglas de calidad — si el pedido es genérico, aporta tú el ángulo específico y el dato concreto.`;
}

function buildUserPrompt(input: TopicInput): string {
  const instructions = resolveTopicInstruction(input);
  return `Tema de hoy: ${instructions}

Genera la pieza completa con estos campos:
- scenes: array de EXACTAMENTE 4 objetos { "headline": "...", "subtext": "..." } siguiendo la estructura hook/insight/takeaway/cta descrita arriba. "subtext" puede ser string vacío si esa escena no lo necesita (típicamente el hook).
- instagramCaption: 5-8 líneas. Estructura: hook (retoma o expande la escena 1) → el dato/insight concreto con su mecanismo explicado simple → una línea de aplicación práctica → el cierre hacia FitPlan AI conectado al tema. Usa saltos de línea para que sea legible, no un bloque de texto.
- tiktokCaption: 1-2 líneas, directo, pensado para acompañar el video (no repite el caption de Instagram palabra por palabra, es un resumen con otro ángulo).
- hashtags: 8 a 12 hashtags en español, mezclando: 2-3 amplios (fitness, nutrición), 3-4 de nicho específico al tema de hoy (no genéricos), 1-2 de intención (ej. "entrenamientoconsciente", "nutriciondeportiva"), y "fitplanai" como hashtag de marca. Sin el símbolo # (se agrega después).
- narration: guion de locución en español de España, HABLADO NATURAL (no leído de cartel), 30 a 42 palabras (~9-11 segundos a ritmo normal de habla). Cubre el mismo insight que las escenas pero como si se lo estuvieras contando a alguien, con ritmo y conectores naturales de España ("oye", "fíjate que", "la verdad es que", "vale", "o sea"). Nunca uses "che", "la posta", "vos" ni otros rioplatenismos. Sin emojis ni hashtags (es para voz, no texto).
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
