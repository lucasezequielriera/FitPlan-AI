import { normalizeExerciseMediaKey } from "@/lib/exerciseMedia";

/**
 * Resolución de ilustraciones de ejercicios vía API pública wger.de
 * (contenido comunitario, típicamente CC BY-SA — ver respuesta `license*`).
 * No usa YouTube ni embeds de terceros de video.
 */

export type WgerExerciseMediaResult = {
  source: "wger" | "custom";
  /** Solo wger; null si la ilustración viene de URL propia (catálogo). */
  wgerExerciseId: number | null;
  imageUrl: string;
  matchedName: string;
  licenseShortName: string;
  licenseUrl: string | null;
  licenseAuthor: string | null;
};

const WGER_API = "https://wger.de/api/v2";
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7;
/** Prefijo para invalidar caché al cambiar la lógica de resolución. */
const CACHE_KEY_PREFIX = "v7";
const cache = new Map<string, { at: number; value: WgerExerciseMediaResult | null }>();

export function clearWgerExerciseMediaResolutionCache(): void {
  cache.clear();
}

/**
 * IDs estables en wger con imagen buena; la búsqueda global suele devolver ejercicios irrelevantes primero.
 * Orden: del más específico al más genérico.
 */
/** IDs comprobados contra exerciseinfo (200 + al menos una imagen). */
const WGER_EXERCISE_ID_HINTS: { test: RegExp; ids: number[] }[] = [
  {
    test: /extensi[oó]n(\s+de)?\s+cu[aá]driceps|cu[aá]driceps(\s+en)?\s+m[aá]quina|extensi[oó]n\s+de\s+rodilla|leg\s*extension|knee\s*extension/i,
    ids: [851, 369],
  },
  { test: /prensa(\s+de)?\s+piernas|leg\s*press(?!\s+narrow)/i, ids: [371, 373] },
  { test: /press\s+de\s+banca(?!\s+incl)|bench\s*press(?!\s+incl)/i, ids: [73, 75] },
  {
    test: /curl(\s+de)?\s*femoral|curl\s+femoral|leg\s*curl|isquiotibial|isquios?\b/i,
    ids: [365, 364, 366],
  },
  {
    test: /\bhip\s*thrust\b|puente\s+(de\s+)?gl[uú]te|empuje\s+de\s+cadera/i,
    ids: [1131],
  },
  { test: /jal[oó]n|lat\s*pulldown|polea\s+al\s+pecho/i, ids: [158] },
  { test: /dominad|pull[\s-]?up(?!\s+machine)/i, ids: [154, 475] },
  { test: /remo\s+con\s+barra|barbell\s*row/i, ids: [83, 513] },
  { test: /sentadill|barbell\s*squat(?!\s*jump)/i, ids: [203, 257] },
  { test: /peso\s+muerto\s+rumano|romanian\s*deadlift/i, ids: [268, 484] },
  { test: /elevaci[oó]n.*lateral|lateral\s*raise/i, ids: [348] },
  { test: /press\s+militar|shoulder\s*press|military\s*press/i, ids: [567, 566, 543] },
];

/** Si el nombre encaja, se busca primero este término (inglés suele tener más imágenes). */
const NAME_ALIASES: { test: RegExp; query: string }[] = [
  { test: /press\s+de\s+banca|press\s+banca(?!\s+incl)/i, query: "bench press" },
  { test: /banca\s+inclin|press.*inclin|incline.*bench/i, query: "incline dumbbell bench" },
  { test: /apertur|fly|cable\s*cross|cruces/i, query: "chest fly dumbbell" },
  { test: /fondos?\s+en\s+paralela|parallel\s*bar|dips?\s*pecho/i, query: "chest dip" },
  { test: /extensi[oó]n.*tr[ií]ceps|triceps?\s+extension|polea.*tr[ií]ceps/i, query: "triceps pushdown" },
  { test: /curl.*barra(?!.*ez)|barbell\s+curl/i, query: "barbell biceps curl" },
  { test: /curl\s*martillo|hammer\s+curl/i, query: "hammer curl" },
  { test: /curl.*inclin/i, query: "incline dumbbell curl" },
  { test: /dominad|pull[\s-]?up/i, query: "pull up" },
  { test: /jal[oó]n|lat\s*pulldown|polea\s+al\s+pecho/i, query: "lat pulldown" },
  { test: /remo\s+con\s+barra|bent[\s-]?over\s*row|barbell\s+row/i, query: "barbell row" },
  { test: /remo|seated\s+cable\s+row/i, query: "seated cable row" },
  { test: /sentadill|squat(?!\s*smith)/i, query: "barbell squat" },
  { test: /smith/i, query: "smith machine squat" },
  { test: /prensa\s+de\s+piernas|leg\s*press/i, query: "leg press" },
  { test: /peso\s+muerto\s+rumano|romanian\s+deadlift|rdb/i, query: "romanian deadlift" },
  { test: /peso\s+muerto|deadlift(?!\s+rumano)/i, query: "deadlift" },
  { test: /extensi[oó]n.*cu[aá]driceps|leg\s*extension/i, query: "leg extension" },
  { test: /curl\s*femoral|leg\s*curl|isquiotibial/i, query: "lying leg curl" },
  { test: /elevaci[oó]n.*tal[oó]n|calf\s*raise|gemelos/i, query: "standing calf raise" },
  { test: /hip\s*thrust|empuje\s+de\s+cadera|puente\s+de\s+gl[uú]teo/i, query: "hip thrust" },
  { test: /zancad|lunge|estocad/i, query: "lunge" },
  { test: /press\s+militar|military\s+press|hombro.*mancuern/i, query: "shoulder press dumbbell" },
  { test: /elevaciones?\s+laterales|lateral\s*raise/i, query: "lateral raise" },
  { test: /plancha\b|plank\b/i, query: "plank" },
  { test: /abdominal|crunch|curl\s+abdominal/i, query: "crunch" },
  { test: /face\s*pull|jal[oó]n.*cara/i, query: "face pull" },
  { test: /remo\s+invertido|inverted\s*row/i, query: "inverted row" },
  { test: /cardio|treadmill|bici|el[ií]ptica|hiit/i, query: "treadmill walking" },
];

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function primaryLabel(name: string): string {
  return name.split(/[·•|]/)[0].split(/\(/)[0].trim().slice(0, 80);
}

function tokenScore(userNorm: string, candidateNorm: string): number {
  const stop = new Set(["de", "la", "el", "en", "con", "por", "y", "o", "a", "del", "las", "los", "the", "a", "an", "for", "with"]);
  const ut = userNorm
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 2 && !stop.has(t));
  const ct = new Set(
    candidateNorm
      .split(/\s+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 2 && !stop.has(t))
  );
  if (ut.length === 0) return 0;
  let hit = 0;
  for (const t of ut) {
    if (ct.has(t)) hit++;
    else {
      for (const c of ct) {
        if (c.includes(t) || t.includes(c)) {
          hit += 0.5;
          break;
        }
      }
    }
  }
  return hit / Math.sqrt(ut.length * Math.max(1, ct.size));
}

/** Evita aceptar un «curl de muñeca» como curl femoral, o aducción de cadera como hip thrust. */
function isIncompatibleExerciseMatch(userNorm: string, candidateNorm: string): boolean {
  const u = userNorm;
  const c = candidateNorm;
  const legHamUser =
    /\b(femoral|isquiotibial|isquios?|hamstring|legcurl|leg\s*curl)\b/.test(u) ||
    /curl(\s+de)?\s*femoral/.test(u) ||
    /\bcurl\s+femoral\b/.test(u);
  if (legHamUser) {
    if (/\b(wrist|muñeca|forearm|antebrazo)\b/i.test(c)) return true;
    if (/\b(biceps|bíceps|triceps|tríceps)\b/i.test(c) && !/\b(leg|ham|femoral|lying|laying|seated\s*leg)\b/i.test(c))
      return true;
  }
  const hipThrustUser =
    /\bhip\s*thrust\b/.test(u) || /\bthrust\b/.test(u) || /\bpuente\b.*\bglut/.test(u) || /\bempuje\b.*\bcadera\b/.test(u);
  if (hipThrustUser) {
    if (/\b(adduction|abduction|aducci[oó]n|abducci[oó]n|aductor|abductor)\b/i.test(c)) return true;
    if (/\bseated\s+hip\b/i.test(c) && !/\b(thrust|bridge|puente)\b/i.test(c)) return true;
  }
  return false;
}

function buildSearchQueries(exerciseName: string): string[] {
  const primary = primaryLabel(exerciseName);
  const out: string[] = [];
  const add = (q: string) => {
    const t = q.trim();
    if (t.length >= 2 && !out.includes(t)) out.push(t);
  };
  for (const { test, query } of NAME_ALIASES) {
    if (test.test(primary)) add(query);
  }
  add(primary);
  const n = normalize(primary);
  if (n.length >= 3) add(n);
  return out;
}

type WgerExerciseRow = { id: number };
type WgerExerciseSearch = { results: WgerExerciseRow[] };
type WgerTranslation = { language: number; name: string };
type WgerImage = { image: string; is_main?: boolean };
type WgerExerciseInfo = {
  id: number;
  license?: { short_name?: string; url?: string | null };
  license_author?: string | null;
  images?: WgerImage[];
  translations?: WgerTranslation[];
};

async function fetchJson<T>(url: string, signal: AbortSignal): Promise<T | null> {
  try {
    const r = await fetch(url, {
      signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "FitPlan-AI/1.0 (exercise illustration lookup; +https://www.fitplan-ai.com)",
      },
    });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

async function searchExerciseIds(term: string, language: number, signal: AbortSignal): Promise<number[]> {
  const url = `${WGER_API}/exercise/?search=${encodeURIComponent(term)}&language=${language}&limit=25`;
  const data = await fetchJson<WgerExerciseSearch>(url, signal);
  if (!data?.results?.length) return [];
  return data.results.map((r) => r.id);
}

/** Búsqueda acotada por músculo (wger muscle id: 10=quads, 11=hamstrings, 4=chest, 12=lats…). */
async function searchExerciseIdsByMuscle(term: string, muscleId: number, signal: AbortSignal): Promise<number[]> {
  const url = `${WGER_API}/exercise/?muscles=${muscleId}&search=${encodeURIComponent(term)}&language=2&limit=25`;
  const data = await fetchJson<WgerExerciseSearch>(url, signal);
  if (!data?.results?.length) return [];
  return data.results.map((r) => r.id);
}

async function fetchExerciseInfo(id: number, signal: AbortSignal): Promise<WgerExerciseInfo | null> {
  const url = `${WGER_API}/exerciseinfo/${id}/`;
  return fetchJson<WgerExerciseInfo>(url, signal);
}

function pickMainImage(images: WgerImage[] | undefined): string | null {
  if (!images?.length) return null;
  const main = images.find((i) => i.is_main);
  return (main || images[0]).image;
}

function buildWgerResult(info: WgerExerciseInfo, matchedName: string): WgerExerciseMediaResult | null {
  const imageUrl = pickMainImage(info.images);
  if (!imageUrl) return null;
  const lic = info.license;
  return {
    source: "wger",
    wgerExerciseId: info.id,
    imageUrl,
    matchedName,
    licenseShortName: lic?.short_name || "CC BY-SA (wger)",
    licenseUrl: lic?.url ?? null,
    licenseAuthor: info.license_author || null,
  };
}

export function buildCustomCatalogMediaResult(imageUrl: string, displayLabel: string): WgerExerciseMediaResult {
  const name = displayLabel.trim() || "Imagen del catálogo";
  return {
    source: "custom",
    wgerExerciseId: null,
    imageUrl: imageUrl.trim(),
    matchedName: name,
    licenseShortName: "Recurso del equipo (URL propia)",
    licenseUrl: null,
    licenseAuthor: null,
  };
}

function pickPreferredTranslationName(info: WgerExerciseInfo): string | null {
  const tr = info.translations || [];
  const es = tr.find((t) => t.language === 4)?.name;
  const en = tr.find((t) => t.language === 2)?.name;
  return (es || en || tr[0]?.name || null)?.trim() || null;
}

export async function resolveWgerExerciseMediaById(
  exerciseInfoId: number,
  signal?: AbortSignal
): Promise<WgerExerciseMediaResult | null> {
  const ac = signal ?? AbortSignal.timeout(12000);
  const info = await fetchExerciseInfo(exerciseInfoId, ac);
  if (!info?.images?.length) return null;
  const matched = pickPreferredTranslationName(info) || "Ejercicio (wger)";
  return buildWgerResult(info, matched);
}

/** Resultados de búsqueda wger con imagen (panel admin). */
export async function searchWgerExerciseCandidates(
  term: string,
  opts?: { limit?: number; signal?: AbortSignal }
): Promise<Array<{ id: number; name: string; imageUrl: string }>> {
  const t = term.trim();
  if (t.length < 2) return [];
  const lim = Math.min(20, Math.max(1, opts?.limit ?? 12));
  const ac = opts?.signal ?? AbortSignal.timeout(15000);
  const ids = new Set<number>();
  for (const lang of [2, 4] as const) {
    const found = await searchExerciseIds(t, lang, ac);
    found.forEach((id) => ids.add(id));
  }
  const idList = [...ids].slice(0, lim + 10);
  const infos = await Promise.all(idList.map((id) => fetchExerciseInfo(id, ac)));
  const out: Array<{ id: number; name: string; imageUrl: string }> = [];
  for (const info of infos) {
    if (!info?.images?.length) continue;
    const imageUrl = pickMainImage(info.images);
    if (!imageUrl) continue;
    const name = pickPreferredTranslationName(info) || `Ejercicio ${info.id}`;
    out.push({ id: info.id, name, imageUrl });
    if (out.length >= lim) break;
  }
  return out;
}

async function tryResolveByKnownExerciseIds(
  primary: string,
  signal: AbortSignal
): Promise<WgerExerciseMediaResult | null> {
  for (const hint of WGER_EXERCISE_ID_HINTS) {
    if (!hint.test.test(primary)) continue;
    for (const id of hint.ids) {
      const info = await fetchExerciseInfo(id, signal);
      if (!info?.images?.length) continue;
      const matched = pickPreferredTranslationName(info) || "Ejercicio (wger)";
      const r = buildWgerResult(info, matched);
      if (r) return r;
    }
  }
  return null;
}

export async function resolveWgerExerciseMedia(
  exerciseName: string,
  signal?: AbortSignal
): Promise<WgerExerciseMediaResult | null> {
  const primary = primaryLabel(exerciseName);
  const catalogKey = normalizeExerciseMediaKey(primary);
  const key = `${CACHE_KEY_PREFIX}:${catalogKey}`;
  if (catalogKey.length < 2) return null;

  const ac = signal ?? AbortSignal.timeout(12000);

  const { loadExerciseMediaCatalogMap } = await import("@/lib/exerciseWgerCatalogServer");
  const catalog = await loadExerciseMediaCatalogMap();
  const pin = catalog.get(catalogKey);
  if (pin) {
    if (pin.kind === "custom") {
      const customRes = buildCustomCatalogMediaResult(pin.url, pin.label);
      cache.set(key, { at: Date.now(), value: customRes });
      return customRes;
    }
    const pinned = await resolveWgerExerciseMediaById(pin.id, ac);
    if (pinned) {
      cache.set(key, { at: Date.now(), value: pinned });
      return pinned;
    }
  }

  const now = Date.now();
  const hit = cache.get(key);
  if (hit && now - hit.at < CACHE_TTL_MS) return hit.value;

  const hinted = await tryResolveByKnownExerciseIds(primary, ac);
  if (hinted) {
    cache.set(key, { at: now, value: hinted });
    return hinted;
  }

  const queries = buildSearchQueries(exerciseName);
  const orderedIds: number[] = [];
  const seen = new Set<number>();

  const muscleBoost: { test: RegExp; muscleId: number; term: string }[] = [
    {
      test: /cu[aá]driceps|prensa|leg\s*press|extensi[oó]n.*rodilla|gemelos|calf|sentadill|squat|zancad|lunge|pierna/i,
      muscleId: 10,
      term: "extension",
    },
    {
      test: /cu[aá]driceps|prensa|leg\s*press|extensi[oó]n.*rodilla|gemelos|calf|sentadill|squat|zancad|lunge|pierna/i,
      muscleId: 10,
      term: "leg",
    },
    { test: /curl(\s+de)?\s*femoral|curl\s+femoral|isquio|femoral\b|hamstring/i, muscleId: 11, term: "curl" },
    { test: /pecho|bench|press.*banca|apertur|fly|dips?\b/i, muscleId: 4, term: "press" },
    { test: /espalda|remo|jal[oó]n|dominad|pull|lat/i, muscleId: 12, term: "row" },
  ];
  for (const mb of muscleBoost) {
    if (!mb.test.test(primary)) continue;
    const ids = await searchExerciseIdsByMuscle(mb.term, mb.muscleId, ac);
    for (const id of ids) {
      if (!seen.has(id)) {
        seen.add(id);
        orderedIds.push(id);
      }
    }
  }

  for (const q of queries) {
    for (const lang of [4, 2] as const) {
      const ids = await searchExerciseIds(q, lang, ac);
      for (const id of ids) {
        if (!seen.has(id)) {
          seen.add(id);
          orderedIds.push(id);
        }
      }
    }
    if (orderedIds.length >= 22) break;
  }

  const slice = orderedIds.slice(0, 22);
  const infos = await Promise.all(slice.map((id) => fetchExerciseInfo(id, ac)));
  const userNorm = normalize(primaryLabel(exerciseName));

  let best: { score: number; info: WgerExerciseInfo; matchedName: string } | null = null;
  for (const info of infos) {
    if (!info?.images?.length) continue;
    const img = pickMainImage(info.images);
    if (!img) continue;
    const translations = info.translations || [];
    const names = translations.filter((t) => t.language === 2 || t.language === 4).map((t) => t.name);
    if (!names.length) continue;
    for (const nm of names) {
      const candNorm = normalize(nm);
      if (isIncompatibleExerciseMatch(userNorm, candNorm)) continue;
      const sc = tokenScore(userNorm, candNorm);
      if (sc > (best?.score ?? -1)) best = { score: sc, info, matchedName: nm };
    }
  }

  const MIN_SCORE = 0.17;
  if (!best || best.score < MIN_SCORE) {
    cache.set(key, { at: now, value: null });
    return null;
  }

  const result = buildWgerResult(best.info, best.matchedName);
  if (!result) {
    cache.set(key, { at: now, value: null });
    return null;
  }
  cache.set(key, { at: now, value: result });
  return result;
}

export async function resolveWgerExerciseMediaBatch(
  names: string[],
  signal?: AbortSignal
): Promise<Record<string, WgerExerciseMediaResult | null>> {
  const uniq = [...new Set(names.map((n) => n.trim()).filter((n) => n.length >= 2))].slice(0, 45);
  const entries = await Promise.all(uniq.map(async (n) => [n, await resolveWgerExerciseMedia(n, signal)] as const));
  return Object.fromEntries(entries);
}
