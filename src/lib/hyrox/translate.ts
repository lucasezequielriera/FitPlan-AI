import { createHash } from "crypto";
import type { Firestore } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import type { GeneratedPlan } from "@/lib/hyrox/generator";
import type { Session } from "@/lib/hyrox/plan";

/**
 * Traducción del contenido del plan HYROX.
 *
 * El plan lo genera código determinista, no un LLM: eso es deliberado (es
 * gratis, instantáneo, reproducible y testeable, y garantiza que la progresión
 * de volumen sea segura). Pero traducir SÍ es trabajo de un LLM, así que aquí
 * se usa OpenAI solo para eso.
 *
 * La clave del diseño es la caché. El generador produce texto a partir de un
 * conjunto ACOTADO de plantillas, así que el número de frases distintas que
 * pueden existir es pequeño y finito. Se traduce cada frase una vez, se guarda
 * en Firestore por su hash, y a partir de ahí todos los usuarios en inglés la
 * reciben sin coste ni latencia. Traducir el plan entero en cada visita sería
 * lento y caro para el mismo resultado.
 *
 * Si la traducción falla o no está configurada la API, se devuelve el texto en
 * español. Nunca se bloquea el plan por un problema de traducción: es
 * preferible leerlo en español que no poder verlo.
 */

const CACHE_COLLECTION = "hyroxTranslations";
const MODEL = "gpt-4o-mini";
/** Frases por llamada. Suficiente para una semana entera en una sola petición. */
const BATCH_SIZE = 60;

export type TranslationResult = {
  plan: GeneratedPlan;
  /** Cuántas frases se tradujeron llamando a OpenAI en esta petición. */
  translated: number;
  /** Cuántas salieron de la caché. */
  cached: number;
  /** Se devolvió algo sin traducir (fallo o falta de API key). */
  degraded: boolean;
};

function keyFor(text: string, locale: string): string {
  return createHash("sha1").update(`${locale}:${text}`).digest("hex").slice(0, 32);
}

/**
 * Traduce las cadenas visibles de un plan. Solo toca texto que lee el usuario:
 * ni las fechas, ni los números de semana, ni las claves internas de fase.
 */
export async function translatePlan(
  db: Firestore,
  plan: GeneratedPlan,
  locale: string
): Promise<TranslationResult> {
  if (locale === "es") return { plan, translated: 0, cached: 0, degraded: false };

  const originals = collectStrings(plan);
  if (originals.length === 0) return { plan, translated: 0, cached: 0, degraded: false };

  const { map, translated, degraded } = await resolveTranslations(db, originals, locale);
  const cached = originals.length - translated;

  return { plan: applyTranslations(plan, map), translated, cached, degraded };
}

/** Todas las cadenas distintas que ve el usuario dentro del plan. */
function collectStrings(plan: GeneratedPlan): string[] {
  const set = new Set<string>();
  for (const week of plan.weeks) {
    set.add(week.headline);
    set.add(week.keyGoal);
    for (const s of week.sessions) {
      set.add(s.title);
      set.add(s.focus);
      for (const b of s.blocks) set.add(b);
      if (s.notes) set.add(s.notes);
      set.add(s.day);
    }
  }
  if (plan.periodization.warning) set.add(plan.periodization.warning);
  return [...set].filter((s) => s.trim().length > 0);
}

async function resolveTranslations(
  db: Firestore,
  originals: string[],
  locale: string
): Promise<{ map: Map<string, string>; translated: number; degraded: boolean }> {
  const map = new Map<string, string>();

  // 1) Lo que ya esté cacheado. `getAll` en lotes de 300 (tope de Firestore).
  const missing: string[] = [];
  for (let i = 0; i < originals.length; i += 300) {
    const slice = originals.slice(i, i + 300);
    const refs = slice.map((s) => db.collection(CACHE_COLLECTION).doc(keyFor(s, locale)));
    const snaps = await db.getAll(...refs);
    snaps.forEach((snap, idx) => {
      const value = snap.exists ? snap.data()?.text : null;
      if (typeof value === "string" && value) map.set(slice[idx], value);
      else missing.push(slice[idx]);
    });
  }

  if (missing.length === 0) return { map, translated: 0, degraded: false };

  // 2) Lo que falte, a OpenAI, por lotes.
  let degraded = false;
  let translated = 0;
  for (let i = 0; i < missing.length; i += BATCH_SIZE) {
    const batch = missing.slice(i, i + BATCH_SIZE);
    const result = await translateBatch(batch, locale);
    if (!result) {
      degraded = true;
      // Sin traducción: se deja el original. El usuario ve español, no un hueco.
      for (const s of batch) map.set(s, s);
      continue;
    }
    const writes = db.batch();
    batch.forEach((original, idx) => {
      const value = result[idx];
      if (typeof value !== "string" || !value.trim()) {
        map.set(original, original);
        return;
      }
      // Guardarraíl numérico: si la traducción alteró un número, se descarta
      // ESA frase y se deja el español. Un "4×6" convertido en "4×5" o un
      // "400 m" en "440 m" le daría a alguien una carga o una distancia que no
      // es la suya, y eso es peor que leerlo en otro idioma. El prompt ya lo
      // pide, pero pedirlo no es garantizarlo.
      if (!sameNumbers(original, value)) {
        console.warn(`[hyrox] traducción descartada por alterar números: "${original}" -> "${value}"`);
        map.set(original, original);
        return;
      }
      map.set(original, value);
      translated++;
      writes.set(db.collection(CACHE_COLLECTION).doc(keyFor(original, locale)), {
        text: value,
        source: original,
        locale,
        createdAt: FieldValue.serverTimestamp(),
      });
    });
    try {
      await writes.commit();
    } catch (error) {
      // Si la caché no se puede escribir, la traducción de esta petición sigue
      // siendo válida: solo significa que la próxima vez se volverá a pedir.
      console.warn("[hyrox] no se pudo cachear la traducción:", error);
    }
  }

  return { map, translated, degraded };
}

/**
 * Compara los números de dos cadenas, en el mismo orden.
 *
 * Se comparan como texto y no como valores para que "4×6" y "4x6" cuenten como
 * los mismos números (4 y 6), pero "4×6" y "4×5" no. Los separadores decimales
 * se normalizan porque el inglés usa punto donde el español usa coma: "2,5 km"
 * y "2.5 km" son la misma distancia y no deben dar falso positivo.
 */
export function sameNumbers(original: string, translated: string): boolean {
  return numbersIn(original).join("|") === numbersIn(translated).join("|");
}

function numbersIn(text: string): string[] {
  const matches = text.match(/\d+(?:[.,]\d+)?/g) ?? [];
  return matches.map((n) => n.replace(",", "."));
}

/**
 * Traduce un lote. Devuelve `null` si falla, para que el llamante decida —
 * aquí nunca se lanza, porque un fallo de traducción no debe tumbar el plan.
 */
async function translateBatch(texts: string[], locale: string): Promise<string[] | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const targetLanguage = locale === "en" ? "English" : locale;
  const system = [
    `You translate fitness training content from Spanish to ${targetLanguage}.`,
    "Rules:",
    "- Return ONLY a JSON object of the form {\"items\": [\"...\", \"...\"]}, with exactly one translated string per input string, in the same order.",
    "- Keep numbers, distances, times, percentages and rep schemes EXACTLY as they are (400 m stays 400 m, 4×6 stays 4×6, 30' stays 30').",
    "- Keep HYROX terminology in its standard English form: SkiErg, Sled Push, Sled Pull, Burpee Broad Jump, Rowing, Farmers Carry, Sandbag Lunges, Wall Balls, roxzone.",
    "- Use natural, direct coaching language. Do not add, remove or soften anything.",
    "- Never translate a warning into something milder: safety guidance must keep its force.",
  ].join("\n");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: MODEL,
        // Temperatura 0: una traducción no necesita creatividad, y así la misma
        // frase se traduce igual siempre aunque se recalcule la caché.
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: JSON.stringify({ items: texts }) },
        ],
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!resp.ok) {
      console.warn(`[hyrox] OpenAI devolvió ${resp.status} al traducir`);
      return null;
    }
    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string") return null;
    const parsed = JSON.parse(content) as { items?: unknown };
    if (!Array.isArray(parsed.items)) return null;
    // Si el modelo devuelve otra cantidad de frases, la correspondencia por
    // índice deja de ser fiable y se descarta el lote entero.
    if (parsed.items.length !== texts.length) {
      console.warn("[hyrox] OpenAI devolvió un número distinto de frases; se descarta el lote");
      return null;
    }
    return parsed.items.map((v) => (typeof v === "string" ? v : ""));
  } catch (error) {
    clearTimeout(timeout);
    console.warn("[hyrox] fallo al traducir:", error);
    return null;
  }
}

/** Reescribe el plan con las traducciones. No muta el original. */
function applyTranslations(plan: GeneratedPlan, map: Map<string, string>): GeneratedPlan {
  const tr = (s: string) => map.get(s) ?? s;
  return {
    ...plan,
    periodization: {
      ...plan.periodization,
      warning: plan.periodization.warning ? tr(plan.periodization.warning) : null,
    },
    weeks: plan.weeks.map((w) => ({
      ...w,
      headline: tr(w.headline),
      keyGoal: tr(w.keyGoal),
      sessions: w.sessions.map(
        (s): Session => ({
          ...s,
          day: tr(s.day) as Session["day"],
          title: tr(s.title),
          focus: tr(s.focus),
          blocks: s.blocks.map(tr),
          notes: s.notes ? tr(s.notes) : undefined,
        })
      ),
    })),
  };
}
