import fs from "fs";
import path from "path";
import { HYROX_LANDING } from "@/lib/hyrox/landingCopy";
import { getStripeSubscriptionPlans } from "@/lib/stripePlanPrices";
import { generatePlan } from "@/lib/hyrox/generator";
import { estimatePace } from "@/lib/hyrox/pacing";
import { emptyProfile, DAYS_MAX, DAYS_MIN, MIN_WEEKS, type HyroxProfile } from "@/lib/hyrox/profile";

/**
 * La landing es una promesa pública. Estos tests comprueban que lo que promete
 * es lo que el producto hace de verdad, porque la forma más fácil de mentir sin
 * darse cuenta es que el copy envejezca mientras el código cambia.
 *
 * No es paranoia: esta misma app llegó a publicar credenciales profesionales
 * que no tenía y 150 valoraciones inventadas.
 */

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), "utf8");

describe("Landing de HYROX — el precio sale de la fuente, no del copy", () => {
  it("el precio mostrado es el que se cobra", () => {
    const eur = getStripeSubscriptionPlans("eur");
    expect(HYROX_LANDING.heroNote).toContain(String(eur.monthly.price));
    const faqPrecio = HYROX_LANDING.faq.find((f) => /cuesta/i.test(f.q))!;
    expect(faqPrecio.a).toContain(String(eur.monthly.price));
    expect(faqPrecio.a).toContain(String(eur.quarterly.price));
    expect(faqPrecio.a).toContain(String(eur.annual.price));
  });

  it("no hay ningún importe escrito a mano en el archivo de copy", () => {
    const src = read("src/lib/hyrox/landingCopy.ts");
    // Cifras seguidas de € o "EUR" fuera de una interpolación.
    const hardcoded = src.match(/\b\d+(?:[.,]\d{2})?\s*(?:€|EUR)\b/g) ?? [];
    expect(hardcoded).toEqual([]);
  });
});

describe("Landing de HYROX — lo que promete existe", () => {
  it("promete el rango de días que el generador acepta de verdad", () => {
    expect(HYROX_LANDING.faq.some((f) => f.a.includes(`Desde ${DAYS_MIN}`))).toBe(true);
    const feature = HYROX_LANDING.features.find((f) => /días y a tu material/i.test(f.title))!;
    expect(feature.body).toContain(`${DAYS_MIN} a ${DAYS_MAX} días`);
  });

  it("con el mínimo de días prometido, el plan sigue trayendo la sesión específica", () => {
    // La landing promete: "Con pocos días lo que se cae es la segunda sesión de
    // fuerza, nunca la específica de HYROX". Se comprueba contra el generador.
    const p: HyroxProfile = { ...(emptyProfile() as HyroxProfile), raceDate: "2026-12-21", daysPerWeek: DAYS_MIN };
    const plan = generatePlan(p, "2026-09-07");
    for (const w of plan.weeks) {
      expect(w.sessions.some((s) => s.type === "hyrox")).toBe(true);
    }
  });

  it("el aviso de plazo corto que promete la landing lo emite el generador", () => {
    const p: HyroxProfile = { ...(emptyProfile() as HyroxProfile), raceDate: "2026-09-28" };
    const plan = generatePlan(p, "2026-09-07"); // 3 semanas: por debajo del mínimo
    expect(plan.periodization.totalWeeks).toBeLessThan(MIN_WEEKS);
    expect(plan.periodization.warning).toMatch(/se gestiona, no se construye/);
    // Y la landing dice exactamente eso.
    expect(HYROX_LANDING.honestyBody).toMatch(/se gestiona, no se construye/);
  });

  it("las tres divisiones que anuncia están soportadas", () => {
    const faqDiv = HYROX_LANDING.faq.find((f) => /individual, dobles y relevos/i.test(f.q))!;
    expect(faqDiv).toBeDefined();
    for (const division of ["individual", "doubles", "relay"] as const) {
      const p: HyroxProfile = { ...(emptyProfile() as HyroxProfile), raceDate: "2026-12-21", division };
      expect(generatePlan(p, "2026-09-07").weeks.length).toBeGreaterThan(0);
    }
  });
});

describe("Landing de HYROX — la tesis coincide con el modelo", () => {
  it("la carrera es MÁS de la mitad del tiempo, como dice la landing", () => {
    // Una versión anterior afirmaba "65% en dobles frente a 50% en individual".
    // El propio modelo lo desmentía: en dobles se reparte el TRABAJO, no el
    // RELOJ, así que el reparto de tiempo es casi idéntico en las dos
    // divisiones. Este test ata la afirmación pública al cálculo real.
    expect(HYROX_LANDING.thesisTitle).toMatch(/como mínimo, la mitad/i);

    for (const min5k of [22, 25, 30]) {
      for (const division of ["individual", "doubles"] as const) {
        const p: HyroxProfile = {
          ...(emptyProfile() as HyroxProfile),
          raceDate: "2026-12-21",
          division,
          current5kMinutes: min5k,
        };
        const e = estimatePace(p)!;
        const total = e.runMinutes + e.stationsMinutes + e.roxzoneMinutes;
        const cuota = e.runMinutes / total;
        // "como mínimo la mitad": >= 50%. Con 5 km en 22' y en dobles sale
        // exactamente 50%, así que afirmar "más de la mitad" era falso para
        // los corredores rápidos.
        expect({ min5k, division, alMenosLaMitad: cuota >= 0.5 }).toEqual({ min5k, division, alMenosLaMitad: true });
      }
    }
  });

  it("la landing NO afirma un reparto de tiempo distinto entre divisiones", () => {
    // Porque el modelo da prácticamente el mismo porcentaje en ambas.
    const texto = `${HYROX_LANDING.thesisTitle} ${HYROX_LANDING.thesisBody}`;
    expect(texto).not.toMatch(/\d{2}\s*%[^.]{0,40}frente a[^.]{0,20}\d{2}\s*%/);
  });
});

describe("Landing de HYROX — SEO y honestidad", () => {
  const page = () => read("src/pages/hyrox/index.tsx");

  it("es indexable y declara su canonical", () => {
    expect(page()).toMatch(/content="index,follow/);
    expect(HYROX_LANDING.canonical).toBe("https://www.fitplan-ai.com/hyrox");
  });

  it("no declara valoraciones: no existe sistema de reseñas", () => {
    expect(page()).not.toMatch(/aggregateRating\s*:/);
    expect(page()).not.toMatch(/ratingValue\s*:/);
  });

  it("no usa initial opacity 0, que ya dejó una landing en blanco dos veces", () => {
    // Se quitan los comentarios antes de buscar: el propio aviso del archivo
    // menciona el patrón prohibido y se detectaba a sí mismo.
    const codigo = page()
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(codigo).not.toMatch(/initial:\s*\{[^}]*opacity:\s*0/);
  });

  it("está en el sitemap, y la app tras login está excluida en robots", () => {
    expect(read("public/sitemap.xml")).toContain("<loc>https://www.fitplan-ai.com/hyrox</loc>");
    expect(read("public/robots.txt")).toContain("Disallow: /hyrox/plan");
  });

  it("el título y la descripción caben en un resultado de búsqueda", () => {
    expect(HYROX_LANDING.metaTitle.length).toBeLessThanOrEqual(60);
    expect(HYROX_LANDING.metaDescription.length).toBeGreaterThan(80);
    expect(HYROX_LANDING.metaDescription.length).toBeLessThanOrEqual(165);
  });
});
