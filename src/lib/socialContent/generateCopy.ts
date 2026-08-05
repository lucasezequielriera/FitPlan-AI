import {
  topicFunction,
  topicHookFamily,
  type ContentFunction,
  type HookFamily,
  type SocialTopic,
} from "@/lib/socialContent/topics";

export type SocialCopyScene = {
  /** Texto grande de la escena (máx ~55 caracteres). */
  headline: string;
  /** Línea de apoyo opcional (máx ~110 caracteres). */
  subtext?: string;
};

export type SocialCopy = {
  /** Exactamente 4 escenas para el video: hook, insight, takeaway, cierre. */
  scenes: SocialCopyScene[];
  /** Caption completo para Instagram (hook + valor + aplicación + cierre). */
  instagramCaption: string;
  /** Caption para TikTok (más corto, directo, pensado para acompañar video). */
  tiktokCaption: string;
  hashtags: string[];
  /** Guion de narración en voz que cubre TODO el video (~22-26s hablado). */
  narration: string;
  /** Descripción de accesibilidad del video (alt text de Instagram). */
  altText: string;
  /** Función de embudo de la pieza (derivada del tema, no la elige el modelo). */
  contentFunction?: ContentFunction;
  /** Familia de gancho usada (derivada del tema). */
  hookFamily?: HookFamily;
};

export type TopicInput = { type: "rotation"; topic: SocialTopic } | { type: "custom"; description: string };

const SYSTEM_PROMPT = `Eres el estratega de contenido y copywriter senior de FitPlan AI (app de entrenamiento y nutrición personalizados con IA — freemium, con opción de coaching 1:1 con un humano). Escribes para Instagram Reels y TikTok en ESPAÑOL DE ESPAÑA (castellano peninsular): tuteo con "tú" (o "vosotros" en plural), NUNCA "vos" ni vocabulario rioplatense o latinoamericano.

Escribes para un sistema de distribución, no para un feed de seguidores. Entiende cómo funciona antes de escribir:

CÓMO SE DISTRIBUYE ESTO (esto define todo lo demás)
El video sale primero a un lote pequeño de gente. Si retiene, se libera a un lote mayor, y así sucesivamente. Las señales que abren esas puertas, por orden de peso real:
1. Retención (que vean el video entero, o casi).
2. Replays — que el final invite a volver a verlo.
3. Compartidos por mensaje privado — se consigue con un dato tan concreto que alguien se lo quiera enviar a una persona específica.
4. Guardados — se consigue con utilidad práctica y accionable.
5. Comentarios — se consiguen con una afirmación con filo, no pidiendo "comenta abajo".
La señal que MÁS te hunde es el scroll en el primer segundo. Todo lo que escribas se juzga contra eso.

LAS 3 REGLAS DURAS DE ESCRITURA
1. DENSIDAD. Cada frase añade información nueva. Cero relleno, cero recalentado, cero introducción antes de entrar en materia. Si una frase se puede borrar sin perder nada, bórrala. Más idea por segundo que la media del nicho.
2. ESPECIFICIDAD. Nada que pudiera estar en cualquier cuenta de fitness del mundo. Prohibido: "la constancia es la clave", "cree en ti", "el único mal entreno es el que no se hace", "la proteína es importante". Obligatorio: un mecanismo, un número, un umbral concreto. Mal: "la proteína ayuda al músculo". Bien: "por debajo de 1,6 gramos por kilo entrenando fuerza, estás dejando crecimiento sobre la mesa".
3. EL GANCHO SE PAGA. Lo que prometes en los primeros 3 segundos tiene que entregarse en el video. Un gancho que no se paga da retención alta al principio y caída brutal después — y el sistema aprende que tu cuenta hace clickbait y te castiga de forma permanente. Esto es lo más caro de arreglar y lo más fácil de evitar.

ESTRUCTURA DEL VIDEO (4 escenas, ~24 segundos totales)
1. HOOK (0-3s): el gancho. Máximo 8 palabras. Instala una pregunta abierta que el cerebro necesite cerrar.
2. INSIGHT (3-11s): el mecanismo concreto. headline = la afirmación central; subtext = el porqué en una línea.
3. TAKEAWAY (11-19s): qué hace la persona con esto mañana. Accionable, no teórico.
4. CIERRE (19-24s): depende de la función de la pieza (te la indico abajo).

CIERRE EN LOOP: el cierre debe conectar conceptualmente con el hook, de forma que volver a ver el video se sienta natural. Es lo que dispara los replays, la segunda señal más fuerte del sistema.

LÍNEA ROJA (sin excepción, por más filo que tenga el ángulo)
Nunca prometas resultados irreales ("pierde 5 kilos en una semana"). Nunca des indicaciones médicas específicas (dosis, fármacos, patologías individuales). Nunca inventes estudios, cifras o estadísticas: si no estás seguro de un número, usa un mecanismo cualitativo en su lugar. Nunca ataques ni nombres a una persona o marca concreta — el filo va contra ideas y creencias populares, jamás contra individuos. Nunca inventes testimonios, resultados de clientes ni métricas de uso de la app.

La NARRACIÓN es una locución que se escucha durante todo el video. Tiene que sonar a persona hablando, no a alguien leyendo carteles: es un guion propio, no la concatenación de los headlines.

Respondes SOLO con JSON válido, sin texto antes ni después.`;

/**
 * Instrucción de gancho por familia. Se inyecta explícitamente para forzar
 * variedad estructural en la apertura: sin esto, el modelo tiende a abrir
 * siempre igual ("¿Sabías que...?"), que es lo que más rápido quema la
 * retención de una cuenta que publica a diario.
 */
const HOOK_INSTRUCTIONS: Record<HookFamily, string> = {
  contradiccion: `GANCHO POR CONTRADICCIÓN. Abre negando frontalmente algo que la mayoría da por cierto. Estructura tipo: "[creencia popular] es mentira" / "Llevo X años en esto y [creencia] no sirve". Tiene que generar el impulso de discutir. Después demuéstralo con el mecanismo real — si no lo demuestras, es clickbait.`,
  coste: `GANCHO POR COSTE EVITABLE. Abre nombrando lo que la persona está perdiendo ahora mismo sin saberlo. Estructura tipo: "Esto te está costando [tiempo/progreso concreto]" / "Estás tirando el [X]% de tu entrenamiento". El coste tiene que ser específico y creíble, no catastrofista.`,
  curiosidad: `GANCHO POR CURIOSIDAD ESPECÍFICA. Abre con un dato concreto e inesperado — nunca una categoría vaga. Mal: "trucos para adelgazar". Bien: "el error de la plancha que hace el 90% de la gente". La especificidad es lo que genera la curiosidad; lo genérico se ignora.`,
  identidad: `GANCHO POR CALLOUT DE IDENTIDAD. Abre describiendo con precisión a una persona concreta, para que quien se reconozca se detenga en seco. Estructura tipo: "Si entrenas 4 días y no ves cambios, esto va por ti" / "¿Cuántos lunes llevas diciendo que empiezas?". Filtra audiencia y engancha a la vez. Después del golpe, da valor real — no lo dejes en el impacto emocional.`,
  confesion: `GANCHO POR CONFESIÓN. Abre contando algo que normalmente no se cuenta: un error propio, un incentivo del negocio, algo que la industria prefiere callar. Estructura tipo: "Le mentí a mi entrenador durante 6 meses" / "Nadie te cuenta por qué te venden esto". La vulnerabilidad tiene que ser concreta, no humildad de escaparate.`,
};

/**
 * Política de cierre y de CTA por función de embudo. Es la regla que más se
 * incumple en la práctica: meter CTA de venta en una pieza de alcance hunde
 * la retención y con ella el alcance mismo, que era justamente el objetivo.
 */
const FUNCTION_INSTRUCTIONS: Record<ContentFunction, string> = {
  alcance: `FUNCIÓN: ALCANCE. El objetivo único es que la vea gente que no te conoce. Optimiza retención y compartidos por encima de todo.
- PROHIBIDO CTA de venta. Nada de "descárgate la app", "link en bio", "pruébalo gratis", "empieza hoy". Un CTA aquí destruye la retención y con ella el alcance.
- La cuarta escena NO vende: cierra la idea y conecta con el hook para invitar al replay. FitPlan AI puede aparecer como firma de marca al final, pero no como llamada a la acción.
- El caption termina con una pregunta con filo o una afirmación que invite a discutir, no con una oferta.
- Prioriza que el dato sea tan concreto que alguien quiera enviárselo a una persona específica.`,
  nutricion: `FUNCIÓN: NUTRICIÓN DE AUDIENCIA. El objetivo es que quien ya te ha visto confíe en ti. Profundidad y criterio por encima de alcance.
- Muestra cómo se piensa el problema, no solo la conclusión. Aquí se permite ir más técnico.
- CTA SUAVE en la cuarta escena: mencionar FitPlan AI como consecuencia natural del valor dado, sin urgencia ni imperativos agresivos. Tipo "esto es exactamente lo que ajusta el plan de FitPlan AI cada mes", no "¡descárgala ya!".
- El caption puede incluir el porqué de una decisión de producto o de método.`,
  conversion: `FUNCIÓN: CONVERSIÓN. El objetivo es que alguien que ya confía dé el paso. Asume poco alcance: esta pieza se juzga por intención, no por views.
- Ataca UNA objeción real y concreta de frente (falta de tiempo, "ya probé apps y las dejé", "necesito que alguien me controle", precio).
- CTA EXPLÍCITO y claro en la cuarta escena. Aquí sí: qué es, para quién es, qué hacer ahora.
- Habla de MECANISMO, no de características: no vendas "planes personalizados", vende el método concreto por el que el plan se ajusta a la persona (IA que recalcula según progreso real + coach humano que corrige). Un mecanismo con nombre propio hace que no te comparen por precio.
- Prueba por encima de promesa: describe cómo funciona de forma verificable. NUNCA inventes testimonios, cifras de usuarios ni resultados de clientes.`,
};

const TOPIC_INSTRUCTIONS: Record<SocialTopic, string> = {
  // --- alcance ---
  mito_polemico: `Coge una creencia MUY repetida por cuentas grandes de fitness y desármala con el mecanismo real. Ideas (elige una, no las enumeres): entrenar en ayunas para quemar más grasa, la báscula como medida de progreso, "no pain no gain", detox y limpiezas, la ventana anabólica de 30 minutos, el sudor como medida de esfuerzo. Tono de discusión, con filo, siempre anclado en el porqué fisiológico.`,
  comparacion_shock: `Una comparación concreta que provoque un "¿qué?" y ganas de reenviarla. Ideas: cuánto hay que caminar para compensar un alimento cotidiano, azúcar o sodio oculto en algo que se considera sano, tiempo real hasta ver cambios frente a lo que promete la industria, gasto calórico real de dos actividades que la gente cree equivalentes. El impacto tiene que venir de un dato real y defendible, jamás exagerado ni inventado.`,
  error_viral: `Un error muy común que ves constantemente y que casi nadie corrige, con urgencia genuina ("no me puedo creer que nadie te haya dicho esto todavía"). Específico y accionable. Ideas: fallo técnico en un ejercicio popular, el plato "saludable" que sabotea el objetivo, el error de progresión que estanca a la gente durante meses, descansos entre series mal gestionados.`,
  verdad_industria: `Explica un incentivo económico que hace que te vendan cierto consejo aunque no sea lo mejor para ti — sin nombrar marcas ni personas. Ideas: por qué los gimnasios venden rutinas genéricas, por qué la respuesta fácil siempre es "más suplementos", por qué las apps populares simplifican el conteo de calorías a costa de la precisión, por qué el contenido de fitness premia lo espectacular sobre lo que funciona. Tono de "te cuento cómo funciona esto por dentro", con el mecanismo de negocio real, no conspiranoia.`,
  pregunta_incomoda: `Abre con una pregunta directa que haga que la persona se sienta señalada en 3 segundos y pare el scroll. Ideas: cuestionar una excusa recurrente, cuestionar una prioridad ("¿por qué dedicas más tiempo a elegir serie que a decidir qué vas a comer?"), cuestionar una comparación tóxica. Después de la pregunta, entrega valor real.`,
  coste_oculto: `Nombra algo que le está costando progreso a la persona ahora mismo sin que lo note, y cuantifícalo de forma honesta (en semanas perdidas, en porcentaje de esfuerzo desperdiciado, en sesiones que no cuentan). Ideas: dormir mal y su efecto sobre la fuerza, entrenar siempre con el mismo peso, no registrar lo que comes los fines de semana, cardio que sustituye a la fuerza cuando el objetivo es composición corporal.`,
  dato_contraintuitivo: `Un dato que rompe la intuición y hace replantearse algo. Ideas: por qué comer más puede acelerar la pérdida de grasa en ciertos contextos, por qué entrenar menos días puede dar más resultado, por qué el músculo pesa en la báscula y eso es buena señal, por qué las agujetas no correlacionan con el estímulo. Explica el mecanismo, que es lo que lo hace creíble y compartible.`,
  confesion_fundador: `Habla en primera persona como el fundador de FitPlan AI y cuenta un error propio, concreto y algo vergonzoso, relacionado con entrenar, comer o construir el producto — y qué aprendiste. Nada de falsa humildad ni de "mi mayor defecto es ser perfeccionista": tiene que ser un error real con consecuencia real. Esto construye la relación con la audiencia, que es lo que después convierte.`,

  // --- nutrición ---
  mecanismo_explicado: `Explica el PORQUÉ fisiológico de algo que la gente hace sin entender, de forma que después no pueda dejar de verlo. Ideas: qué pasa realmente en el músculo con la sobrecarga progresiva, por qué la proteína sacia más, qué hace el déficit calórico al metabolismo y qué no, cómo funciona la adaptación al entrenamiento. Simple pero no simplón: la persona tiene que salir entendiendo el mecanismo, no memorizando una regla.`,
  tip_entrenamiento: `UN tip de entrenamiento con el mecanismo detrás. Ideas: sobrecarga progresiva aplicada de forma concreta, cómo calibrar intensidad con RPE, por qué el descanso entre series cambia el estímulo, el mito de que más volumen siempre es mejor, cómo saber si un ejercicio te está aportando algo.`,
  tip_nutricion: `UN tip de nutrición específico y accionable, con el porqué. Ideas: timing de proteína, densidad calórica y saciedad, macros frente a calorías totales, cómo leer una etiqueta de verdad, errores al "comer sano" que no acercan al objetivo.`,
  caso_practico: `Coge un PERFIL concreto y resuélvelo delante de la cámara. Ideas: alguien con trabajo de oficina y 45 minutos al día, alguien que vuelve tras 6 meses parado, alguien que entrena en casa sin material, alguien que ha estancado el press de banca. Describe el perfil, el error típico de ese perfil y qué haría distinto. Que quien se reconozca sienta que le hablas a él.`,
  detras_de_escena: `Cuenta cómo se construye FitPlan AI por dentro: una decisión de producto y su porqué, algo que probasteis y no funcionó, cómo se diseña el ajuste mensual del plan, por qué se incluye un coach humano y no solo IA. Transparencia real y concreta. Esto genera confianza que ningún contenido educativo consigue.`,

  // --- conversión ---
  objecion_tiempo: `Ataca de frente la objeción "no tengo tiempo". No la niegues ni la minimices: reconócela como legítima y desmóntala con concreción (qué se puede hacer realmente en el tiempo que sí hay, y por qué un plan adaptado a ese tiempo bate a uno genérico ignorado). Cierra explicando cómo FitPlan AI construye el plan alrededor del tiempo disponible real de la persona.`,
  objecion_ya_probe: `Ataca la objeción "ya probé apps de fitness y las dejé". Reconoce que es lo normal y explica el motivo estructural: los planes genéricos no se ajustan cuando tu progreso o tu vida cambian, así que dejan de encajar y se abandonan. Cierra con el mecanismo de FitPlan AI: el plan se recalcula con tu progreso real y hay un coach humano detrás cuando hace falta corregir.`,
  mecanismo_unico: `Explica el MÉTODO de FitPlan AI como mecanismo con nombre propio, no como lista de características: IA que genera el plan según objetivo, lesiones y material disponible + seguimiento diario + recálculo mensual con datos reales + opción de coach humano 1:1. La clave es que quede claro POR QUÉ ese mecanismo produce un resultado distinto al de un plan estático. Un mecanismo con nombre no se compara por precio.`,
  prueba_resultado: `Prueba por encima de promesa: enseña cómo funciona algo de FitPlan AI de forma verificable y concreta — qué ve la persona en pantalla, cómo cambia su plan cuando registra progreso, qué pasa cuando falla una semana. Describe el funcionamiento real del producto. NO inventes testimonios, cifras de usuarios ni resultados de clientes.`,
};

function resolveTopicInstruction(input: TopicInput): string {
  if (input.type === "rotation") return TOPIC_INSTRUCTIONS[input.topic];
  return `El fundador de FitPlan AI pidió específicamente este tema/ángulo: "${input.description}". Desarróllalo con la misma vara de densidad, especificidad y mecanismo concreto que el resto de las reglas — si el pedido es genérico, aporta tú el ángulo específico y el dato concreto.`;
}

function buildUserPrompt(input: TopicInput, fn: ContentFunction, hook: HookFamily): string {
  return `${FUNCTION_INSTRUCTIONS[fn]}

${HOOK_INSTRUCTIONS[hook]}

TEMA DE HOY: ${resolveTopicInstruction(input)}

Genera la pieza completa con estos campos:

- scenes: array de EXACTAMENTE 4 objetos { "headline": "...", "subtext": "..." } siguiendo hook/insight/takeaway/cierre. El headline del hook: máximo 8 palabras. Los demás headlines: máximo 6 palabras (se renderizan como texto grande en pantalla y con más se cortan mal). "subtext" puede ser cadena vacía si la escena no lo necesita (típicamente el hook). El cierre debe respetar la política de CTA de la función indicada arriba y conectar con el hook.

- instagramCaption: 5-8 líneas con saltos de línea, no un bloque. Estructura: retoma el hook con otras palabras → el mecanismo concreto explicado simple → una línea de aplicación práctica → cierre según la función (alcance: pregunta con filo; nutrición: mención suave a FitPlan AI; conversión: CTA claro). Máximo 3 emojis en todo el caption, usados con intención.

- tiktokCaption: 1-2 líneas. No repite el de Instagram: mismo tema, otro ángulo, más directo y coloquial.

- hashtags: 8 a 12, en español, sin el símbolo #. Mezcla: 2-3 amplios, 4-5 específicos del tema de hoy (no genéricos), 1-2 de intención, y "fitplanai".

- narration: guion de locución en español de España que cubre TODO el video: 65 a 80 palabras (~22-26 segundos a ritmo rápido). Es lo que se escucha de principio a fin, así que no puede quedarse corto ni dejar silencios. Habla natural, ritmo alto, frases cortas, conectores de España ("oye", "fíjate", "vale", "o sea", "la verdad es que"). Nunca "che", "la posta", "vos" ni rioplatenismos. Empieza directamente por el gancho, sin saludo ni presentación. Sin emojis ni hashtags.

- altText: 1 frase objetiva y descriptiva del video en español, máx 140 caracteres, para lectores de pantalla. Es accesibilidad, no marketing.

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
 * Genera el copy (4 escenas + captions + hashtags + narración) para un tema —
 * de la rotación fija (`{type: "rotation"}`) o uno libre escrito por el
 * fundador (`{type: "custom"}`, usado por el generador manual del admin).
 *
 * La función de embudo y la familia de gancho se derivan del tema, no las
 * elige el modelo: son decisiones de estrategia, no de redacción. Para temas
 * manuales se asume "alcance" con gancho de curiosidad, que es el default
 * seguro (nunca mete CTA de venta donde perjudicaría la retención).
 */
export async function generateSocialCopy(input: TopicInput): Promise<SocialCopy> {
  const fn: ContentFunction = input.type === "rotation" ? topicFunction(input.topic) : "alcance";
  const hook: HookFamily = input.type === "rotation" ? topicHookFamily(input.topic) : "curiosidad";

  const obj = await callOpenAIJson({
    system: SYSTEM_PROMPT,
    user: buildUserPrompt(input, fn, hook),
    maxTokens: 1400,
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

  return { scenes, instagramCaption, tiktokCaption, hashtags, narration, altText, contentFunction: fn, hookFamily: hook };
}

/**
 * Sugiere UN tema/ángulo específico y no genérico para cuando el fundador no
 * tiene una idea puntual — devuelve una descripción corta (no el copy final)
 * para que la revise/edite antes de generar la pieza completa.
 */
export async function suggestSocialTopic(): Promise<string> {
  const obj = await callOpenAIJson({
    system:
      "Eres estratega de contenido de FitPlan AI (app de fitness con IA). Sugieres UN ángulo de contenido específico y con gancho, que funcione en Instagram Reels y TikTok. Respondes SOLO con JSON.",
    user: `Sugiéreme un tema puntual para el vídeo de hoy. Tiene que ser específico y tener un gancho claro: no "hablar de nutrición" sino, por ejemplo, "por qué contar calorías sin mirar la proteína no sirve de nada". Devuelve JSON: {"topic": "..."}`,
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
