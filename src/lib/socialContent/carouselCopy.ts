import type { SlideContent } from "@/lib/socialContent/renderCarouselSlide";

/**
 * Genera el contenido de un carrusel de Instagram con el formato aprobado
 * (ver `marketing/plantillas/README.md`).
 *
 * La regla que ordena todo: el producto no aparece hasta la penúltima
 * diapositiva. Las primeras aportan valor por sí solas, que es lo que permite
 * que una cuenta colaboradora lo comparta sin sentir que hace de comercial
 * ante su propia audiencia — y también lo que sostiene la retención, porque
 * un anuncio declarado desde la primera se salta.
 */

export type CarouselCopy = {
  /** Sin `index` ni `total`: los rellena el generador de imágenes. */
  slides: SlideContent[];
  instagramCaption: string;
  hashtags: string[];
  /** Descripción de accesibilidad, una por diapositiva. */
  altTexts: string[];
};

const SYSTEM_PROMPT = `Eres el director de contenido de FitPlan AI, una app de entrenamiento y nutrición personalizados con IA (freemium, con opción de coach humano 1:1). Diseñas carruseles para Instagram en ESPAÑOL DE ESPAÑA (castellano peninsular, tuteo con "tú"), NUNCA con "vos" ni vocabulario latinoamericano.

CÓMO SE JUZGA UN CARRUSEL
El sistema mide sobre todo cuánta gente llega a la última diapositiva y cuántos lo guardan. Eso define la estructura:
- La primera diapositiva decide si alguien desliza o no. Es una afirmación con filo, no un título.
- Cada diapositiva tiene que crear la necesidad de ver la siguiente.
- Las primeras dan valor que se sostiene solo, SIN mencionar el producto.
- FitPlan aparece como pronto en la penúltima. Un carrusel que se declara anuncio en la primera no lo comparte nadie.

TIPOS DE DIAPOSITIVA
- "hook": la primera, siempre. headline corto y contundente (máx. 7 palabras, se muestra en mayúsculas). "emphasis" es una palabra o número suelto que se pinta en verde para rematar. "sub" es una línea de apoyo.
- "log": una tabla de registro de gimnasio. Es el recurso más potente del formato: los números cuentan la historia. columns son 3 encabezados cortos. Cada fila lleva week, sets, load y, o bien "note" (máx. 16 caracteres) o bien "delta" (un incremento, se pinta en verde). "dead: true" pinta la fila en gris apagado, para mostrar estancamiento. Opcionalmente "caption" (frase corta de remate) o "body" (párrafo breve).
- "list": título y de 3 a 5 puntos concretos, cada uno de una línea.
- "cta": la última, siempre. title corto, price y url.

REGLAS DURAS
1. ESPECIFICIDAD. Nada que pudiera estar en cualquier cuenta de fitness. Un mecanismo, un número, un umbral. Prohibido "la constancia es la clave" y similares.
2. LOS NÚMEROS SON EL DISEÑO. Si el tema admite una tabla comparativa, úsala: es lo que hace que este formato funcione. Usa una "log" muerta (dead) para el problema y otra viva (delta) para la solución siempre que encaje.
3. NO INVENTES. Ni estudios, ni estadísticas, ni testimonios, ni cifras de usuarios. Si no estás seguro de un dato, usa un mecanismo cualitativo.
4. NADA DE FUNCIONES QUE NO EXISTEN. FitPlan hace: planes de entrenamiento y nutrición generados con IA según objetivo, nivel, lesiones y material; menús semanales con ingredientes y cantidades exactas; macros y seguimiento diario; recálculo mensual con el progreso real; exportación a PDF; opción de coach humano 1:1. NO tiene panel para que entrenadores externos gestionen clientes.
5. LÍNEA ROJA. Nunca prometas resultados irreales ni des indicaciones médicas concretas.

Respondes SOLO con JSON válido, sin texto antes ni después.`;

function buildUserPrompt(topic: string, slideCount: number): string {
  return `Tema del carrusel: ${topic}

Genera EXACTAMENTE ${slideCount} diapositivas. La primera debe ser de tipo "hook" y la última de tipo "cta". Las ${slideCount - 2} intermedias las eliges tú entre "log" y "list" según lo que mejor cuente este tema — prioriza al menos una "log" si el tema admite números.

Devuelve este JSON:
{
  "slides": [
    { "kind": "hook", "headline": "...", "emphasis": "...", "sub": "..." },
    { "kind": "log", "title": "...", "columns": ["...", "...", "..."], "rows": [ { "week": "01", "sets": "3 × 10", "load": "40 kg", "note": "...", "dead": false } ], "caption": "...", "body": "..." },
    { "kind": "list", "title": "...", "items": ["...", "..."] },
    { "kind": "cta", "title": "...", "price": "Premium desde 2,08 €/mes", "url": "fitplan-ai.com" }
  ],
  "instagramCaption": "...",
  "hashtags": ["...", "..."],
  "altTexts": ["...", "..."]
}

Notas de formato:
- En "log", cada fila lleva "note" O "delta", no ambos. "delta" para incrementos ("+7,5"), "note" para etiquetas cortas ("estancado", "calentamiento").
- "emphasis", "sub", "caption" y "body" son opcionales; omítelos si la diapositiva no los necesita.
- El precio del "cta" es exactamente "Premium desde 2,08 €/mes" y la url "fitplan-ai.com".
- instagramCaption: 5-9 líneas con saltos de línea, que amplíe la idea del carrusel y cierre con una pregunta contestable en pocas palabras. Máximo 3 emojis.
- hashtags: 8-10 en español, sin "#", incluyendo "fitplanai".
- altTexts: una descripción objetiva por diapositiva, máx. 140 caracteres, en el mismo orden.`;
}

type RawSlide = Record<string, unknown>;

/** Normaliza lo que devuelve el modelo al tipo que entiende el renderizador. */
function normalizeSlide(raw: RawSlide): SlideContent | null {
  const kind = typeof raw.kind === "string" ? raw.kind : "";
  const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
  const opt = (v: unknown): string | undefined => {
    const s = str(v);
    return s.length > 0 ? s : undefined;
  };

  if (kind === "hook") {
    const headline = str(raw.headline);
    if (!headline) return null;
    return { kind: "hook", headline, emphasis: opt(raw.emphasis), sub: opt(raw.sub) };
  }

  if (kind === "log") {
    const title = str(raw.title);
    const cols = Array.isArray(raw.columns) ? raw.columns.map(str) : [];
    const rowsRaw = Array.isArray(raw.rows) ? raw.rows : [];
    const rows = rowsRaw
      .filter((r): r is RawSlide => typeof r === "object" && r !== null)
      .map((r) => ({
        week: str(r.week),
        sets: str(r.sets),
        load: str(r.load),
        note: opt(r.note),
        delta: opt(r.delta),
        dead: r.dead === true,
      }))
      .filter((r) => r.week || r.sets || r.load);
    if (!title || cols.length !== 3 || rows.length === 0) return null;
    return {
      kind: "log",
      title,
      columns: [cols[0], cols[1], cols[2]],
      rows,
      caption: opt(raw.caption),
      body: opt(raw.body),
    };
  }

  if (kind === "list") {
    const title = str(raw.title);
    const items = Array.isArray(raw.items) ? raw.items.map(str).filter(Boolean) : [];
    if (!title || items.length === 0) return null;
    return { kind: "list", title, items: items.slice(0, 5) };
  }

  if (kind === "cta") {
    const title = str(raw.title) || "Empieza gratis";
    return { kind: "cta", title, price: opt(raw.price), url: str(raw.url) || "fitplan-ai.com" };
  }

  return null;
}

export async function generateCarouselCopy(topic: string, slideCount: number): Promise<CarouselCopy> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY no configurada — no se puede generar el carrusel.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);

  let resp: Response;
  try {
    resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4o",
        temperature: 0.9,
        max_tokens: 2200,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildUserPrompt(topic, slideCount) },
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
  if (typeof raw !== "string") throw new Error("Respuesta de OpenAI sin contenido.");

  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(raw);
  } catch {
    throw new Error("No se pudo parsear el JSON del carrusel.");
  }

  const slides = (Array.isArray(obj.slides) ? obj.slides : [])
    .filter((s): s is RawSlide => typeof s === "object" && s !== null)
    .map(normalizeSlide)
    .filter((s): s is SlideContent => s !== null);

  if (slides.length < 3) {
    throw new Error(`El carrusel generado solo tiene ${slides.length} diapositivas válidas (mínimo 3).`);
  }

  const instagramCaption = typeof obj.instagramCaption === "string" ? obj.instagramCaption.trim() : "";
  if (!instagramCaption) throw new Error("El carrusel generado no trae pie de foto.");

  const hashtags = Array.isArray(obj.hashtags)
    ? obj.hashtags.filter((h): h is string => typeof h === "string").map((h) => h.replace(/^#/, "").trim())
    : [];
  const altTexts = Array.isArray(obj.altTexts)
    ? obj.altTexts.filter((a): a is string => typeof a === "string").map((a) => a.trim())
    : [];

  return { slides, instagramCaption, hashtags, altTexts };
}
