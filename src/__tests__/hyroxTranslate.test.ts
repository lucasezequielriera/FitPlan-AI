import { sameNumbers, translatePlan } from "@/lib/hyrox/translate";
import { generatePlan } from "@/lib/hyrox/generator";
import { emptyProfile, type HyroxProfile } from "@/lib/hyrox/profile";

/**
 * La traducción es el punto donde el plan puede degradarse en silencio: una
 * frase perdida, un número alterado o un desajuste de índices no lanzan ningún
 * error, simplemente le llegan al usuario mal.
 *
 * Aquí se prueba con un Firestore y un `fetch` falsos: no se llama a OpenAI
 * (costaría dinero por cada ejecución de la suite) ni a Firestore real.
 */

const HOY = "2026-09-07";

function profile(over: Partial<HyroxProfile> = {}): HyroxProfile {
  return { ...(emptyProfile() as HyroxProfile), raceDate: "2026-12-21", ...over };
}

/** Firestore mínimo en memoria: solo lo que usa `translate.ts`. */
function fakeDb(seed: Record<string, string> = {}) {
  const store = new Map<string, { text: string }>(Object.entries(seed).map(([k, v]) => [k, { text: v }]));
  const writes: Array<{ id: string; text: string }> = [];
  const db = {
    collection: (_name: string) => ({
      doc: (id: string) => ({ id, _kind: "ref" as const }),
    }),
    getAll: async (...refs: Array<{ id: string }>) =>
      refs.map((r) => ({
        exists: store.has(r.id),
        data: () => store.get(r.id),
      })),
    batch: () => ({
      set: (ref: { id: string }, value: { text: string }) => {
        writes.push({ id: ref.id, text: value.text });
        store.set(ref.id, { text: value.text });
      },
      commit: async () => undefined,
    }),
  };
  return { db, writes, store };
}

/** Sustituye `fetch` por uno que simula OpenAI. */
function mockOpenAi(handler: (items: string[]) => string[] | { httpError: number } | null) {
  return jest.fn(async (_url: string, init: { body: string }) => {
    const body = JSON.parse(init.body);
    const items = JSON.parse(body.messages[1].content).items as string[];
    const out = handler(items);
    if (out === null) throw new Error("red caída");
    if (!Array.isArray(out)) return { ok: false, status: out.httpError, text: async () => "" };
    return {
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: JSON.stringify({ items: out }) } }] }),
    };
  });
}

const originalFetch = global.fetch;
const originalKey = process.env.OPENAI_API_KEY;

afterEach(() => {
  global.fetch = originalFetch;
  process.env.OPENAI_API_KEY = originalKey;
});

describe("translatePlan", () => {
  it("con locale español no toca nada ni llama a OpenAI", () => {
    const spy = jest.fn();
    global.fetch = spy as unknown as typeof fetch;
    const plan = generatePlan(profile(), HOY);
    return translatePlan(fakeDb().db as never, plan, "es").then((r) => {
      expect(r.plan).toBe(plan);
      expect(r.translated).toBe(0);
      expect(spy).not.toHaveBeenCalled();
    });
  });

  it("sin API key devuelve el plan en español en vez de romperse", async () => {
    delete process.env.OPENAI_API_KEY;
    const plan = generatePlan(profile(), HOY);
    const r = await translatePlan(fakeDb().db as never, plan, "en");
    expect(r.degraded).toBe(true);
    expect(r.plan.weeks).toHaveLength(plan.weeks.length);
    // El contenido sigue ahí, solo que sin traducir.
    expect(r.plan.weeks[0].sessions[0].title).toBe(plan.weeks[0].sessions[0].title);
  });

  it("traduce y devuelve el plan con la misma estructura", async () => {
    process.env.OPENAI_API_KEY = "test";
    global.fetch = mockOpenAi((items) => items.map((s) => `EN:${s}`)) as unknown as typeof fetch;
    const plan = generatePlan(profile(), HOY);
    const r = await translatePlan(fakeDb().db as never, plan, "en");

    expect(r.degraded).toBe(false);
    expect(r.translated).toBeGreaterThan(0);
    expect(r.plan.weeks).toHaveLength(plan.weeks.length);
    for (const w of r.plan.weeks) {
      expect(w.sessions).toHaveLength(7);
      for (const s of w.sessions) {
        expect(s.title.startsWith("EN:")).toBe(true);
        expect(s.blocks.every((b) => b.startsWith("EN:"))).toBe(true);
      }
    }
  });

  it("no muta el plan original", async () => {
    process.env.OPENAI_API_KEY = "test";
    global.fetch = mockOpenAi((items) => items.map((s) => `EN:${s}`)) as unknown as typeof fetch;
    const plan = generatePlan(profile(), HOY);
    const antes = JSON.stringify(plan);
    await translatePlan(fakeDb().db as never, plan, "en");
    expect(JSON.stringify(plan)).toBe(antes);
  });

  it("usa la caché y no vuelve a llamar a OpenAI para lo ya traducido", async () => {
    process.env.OPENAI_API_KEY = "test";
    const spy = mockOpenAi((items) => items.map((s) => `EN:${s}`));
    global.fetch = spy as unknown as typeof fetch;
    const plan = generatePlan(profile(), HOY);

    const { db } = fakeDb();
    const primera = await translatePlan(db as never, plan, "en");
    const llamadasPrimera = spy.mock.calls.length;
    expect(primera.translated).toBeGreaterThan(0);

    const segunda = await translatePlan(db as never, plan, "en");
    expect(spy.mock.calls.length).toBe(llamadasPrimera); // ni una llamada más
    expect(segunda.translated).toBe(0);
    expect(segunda.cached).toBeGreaterThan(0);
    expect(segunda.plan.weeks[0].sessions[0].title).toBe(primera.plan.weeks[0].sessions[0].title);
  });

  it("si OpenAI devuelve MENOS frases de las pedidas, descarta el lote", async () => {
    // La correspondencia es por índice: aceptar una lista más corta emparejaría
    // cada traducción con la frase equivocada, y el plan saldría coherente en
    // apariencia pero con el contenido cruzado.
    process.env.OPENAI_API_KEY = "test";
    global.fetch = mockOpenAi((items) => items.slice(0, items.length - 1).map((s) => `EN:${s}`)) as unknown as typeof fetch;
    const plan = generatePlan(profile(), HOY);
    const r = await translatePlan(fakeDb().db as never, plan, "en");
    expect(r.degraded).toBe(true);
    expect(r.plan.weeks[0].sessions[0].title).toBe(plan.weeks[0].sessions[0].title);
  });

  it("un error HTTP de OpenAI degrada al español, no rompe el plan", async () => {
    process.env.OPENAI_API_KEY = "test";
    global.fetch = mockOpenAi(() => ({ httpError: 429 })) as unknown as typeof fetch;
    const plan = generatePlan(profile(), HOY);
    const r = await translatePlan(fakeDb().db as never, plan, "en");
    expect(r.degraded).toBe(true);
    expect(r.plan.weeks).toHaveLength(plan.weeks.length);
  });

  it("una caída de red degrada al español, no lanza", async () => {
    process.env.OPENAI_API_KEY = "test";
    global.fetch = mockOpenAi(() => null) as unknown as typeof fetch;
    const plan = generatePlan(profile(), HOY);
    await expect(translatePlan(fakeDb().db as never, plan, "en")).resolves.toBeDefined();
  });

  it("una frase vacía devuelta por OpenAI conserva el original", async () => {
    process.env.OPENAI_API_KEY = "test";
    global.fetch = mockOpenAi((items) => items.map((_, i) => (i === 0 ? "" : `EN:${items[i]}`))) as unknown as typeof fetch;
    const plan = generatePlan(profile(), HOY);
    const r = await translatePlan(fakeDb().db as never, plan, "en");
    const textos = r.plan.weeks.flatMap((w) => w.sessions.map((s) => s.title));
    expect(textos.every((t) => t.trim().length > 0)).toBe(true);
  });

  it("no se cachea una traducción vacía", async () => {
    process.env.OPENAI_API_KEY = "test";
    global.fetch = mockOpenAi((items) => items.map(() => "")) as unknown as typeof fetch;
    const plan = generatePlan(profile(), HOY);
    const { db, writes } = fakeDb();
    await translatePlan(db as never, plan, "en");
    expect(writes).toHaveLength(0);
  });
});

describe("sameNumbers — guardarraíl contra traducciones que alteran datos", () => {
  it("acepta una traducción que conserva los números", () => {
    expect(sameNumbers("Sentadilla 4×6 @ 75%", "Back squat 4×6 @ 75%")).toBe(true);
    expect(sameNumbers("6 × 400 m a ritmo de 5 km", "6 × 400 m at 5 km pace")).toBe(true);
    expect(sameNumbers("Descanso", "Rest")).toBe(true);
  });

  it("rechaza una traducción que cambia una serie o una carga", () => {
    // Es el caso que importa: darle a alguien 4×5 cuando su plan dice 4×6.
    expect(sameNumbers("Sentadilla 4×6", "Back squat 4×5")).toBe(false);
    expect(sameNumbers("400 m", "440 m")).toBe(false);
    expect(sameNumbers("30' continuo", "40' continuous")).toBe(false);
  });

  it("rechaza si se pierde o se añade un número", () => {
    expect(sameNumbers("4 × 400 m", "400 m")).toBe(false);
    expect(sameNumbers("Trote suave", "Easy jog 20 min")).toBe(false);
  });

  it("no da falso positivo por el separador decimal de cada idioma", () => {
    // El inglés escribe 2.5 donde el español escribe 2,5. Es la misma distancia.
    expect(sameNumbers("2,5 km suaves", "2.5 km easy")).toBe(true);
  });

  it("distingue el orden de los números", () => {
    expect(sameNumbers("4 × 6", "6 × 4")).toBe(false);
  });
});

describe("translatePlan — integridad numérica de punta a punta", () => {
  it("si OpenAI altera un número, esa frase se queda en español y NO se cachea", async () => {
    process.env.OPENAI_API_KEY = "test";
    // Traduce todo bien salvo que convierte cualquier "4" en "5".
    global.fetch = mockOpenAi((items) =>
      items.map((s) => `EN:${s.replace(/4/g, "5")}`)
    ) as unknown as typeof fetch;

    const plan = generatePlan(profile(), HOY);
    const { db, writes } = fakeDb();
    const r = await translatePlan(db as never, plan, "en");

    const conCuatro = (s: string) => /4/.test(s);
    const originales = plan.weeks.flatMap((w) => w.sessions.flatMap((s) => [s.title, ...s.blocks]));
    const traducidos = r.plan.weeks.flatMap((w) => w.sessions.flatMap((s) => [s.title, ...s.blocks]));

    // Toda frase que llevaba un 4 tiene que haberse quedado igual que el original.
    originales.forEach((orig, i) => {
      if (conCuatro(orig)) expect(traducidos[i]).toBe(orig);
    });
    // Y ninguna de esas frases alteradas puede haberse guardado en la caché.
    expect(writes.every((w) => !/EN:.*5/.test(w.text) || !conCuatro(w.text))).toBe(true);
  });
});
