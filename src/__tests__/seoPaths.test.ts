import fs from "fs";
import path from "path";
import { INDEXABLE_PATHS } from "@/lib/seo/indexNow";

/**
 * Hay dos listas de páginas indexables —`INDEXABLE_PATHS` (lo que se envía a
 * los buscadores) y `public/sitemap.xml` (lo que rastrean por su cuenta)— y
 * nada impedía que divergieran. De hecho divergieron: la landing de HYROX se
 * añadió al sitemap y se olvidó en `INDEXABLE_PATHS`, así que nunca se habría
 * enviado a ningún buscador.
 */

const SITE = "https://www.fitplan-ai.com";
const sitemap = fs.readFileSync(path.join(process.cwd(), "public/sitemap.xml"), "utf8");
const robots = fs.readFileSync(path.join(process.cwd(), "public/robots.txt"), "utf8");

const enSitemap = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)]
  .map((m) => m[1].replace(SITE, ""))
  .map((p) => (p === "" ? "/" : p.replace(/\/$/, "") || "/"));

describe("Coherencia de páginas indexables", () => {
  it("todo lo que se envía a los buscadores está en el sitemap", () => {
    const faltan = INDEXABLE_PATHS.filter((p) => !enSitemap.includes(p));
    expect(faltan).toEqual([]);
  });

  it("ninguna página indexable está bloqueada en robots.txt", () => {
    const bloqueadas = robots
      .split("\n")
      .filter((l) => l.trim().startsWith("Disallow:"))
      .map((l) => l.split("Disallow:")[1].trim())
      .filter(Boolean);

    const conflicto = INDEXABLE_PATHS.filter((p) =>
      bloqueadas.some((b) => b !== "/" && p.startsWith(b))
    );
    expect(conflicto).toEqual([]);
  });

  it("la landing de HYROX se envía a los buscadores", () => {
    expect(INDEXABLE_PATHS).toContain("/hyrox");
  });

  it("ninguna página que se declara noindex se envía a los buscadores", () => {
    // Issue #28: `/create-plan` estaba en INDEXABLE_PATHS y en el sitemap con
    // prioridad 0.9, mientras la propia página servía `noindex, nofollow`. El
    // buscador descarta la página al llegar, así que solo se gastaba cuota y se
    // ensuciaba el sitemap con una URL que nunca iba a indexarse.
    const contradictorias = INDEXABLE_PATHS.filter((ruta) => {
      const base = ruta === "/" ? "index" : ruta.replace(/^\//, "");
      for (const cand of [`src/pages/${base}.tsx`, `src/pages/${base}/index.tsx`]) {
        const full = path.join(process.cwd(), cand);
        if (!fs.existsSync(full)) continue;
        const src = fs.readFileSync(full, "utf8");
        // `noindex` como prop del componente Seo o como meta directa.
        if (/noindex/.test(src)) return true;
      }
      return false;
    });
    expect(contradictorias).toEqual([]);
  });

  it("la confirmación de pago declara noindex TAMBIÉN en su estado de carga", () => {
    // `loading` arranca en true, así que el estado de carga es lo que renderiza
    // el servidor y lo que ve un buscador. El `<Seo noindex />` del return
    // principal no llegaba nunca al HTML servido: comprobado con curl, mientras
    // /payment/failure y /pending sí lo traían, /payment/success no.
    const src = fs.readFileSync(path.join(process.cwd(), "src/pages/payment/success.tsx"), "utf8");
    const inicio = src.indexOf("if (loading)");
    expect(inicio).toBeGreaterThan(-1);
    const bloqueCarga = src.slice(inicio, src.indexOf("\n  return (", inicio));
    expect(bloqueCarga).toMatch(/<Seo/);
    expect(bloqueCarga).toMatch(/noindex/);
  });

  it("la app tras login NO se envía ni se indexa", () => {
    expect(INDEXABLE_PATHS).not.toContain("/hyrox/plan");
    expect(enSitemap).not.toContain("/hyrox/plan");
    expect(robots).toContain("Disallow: /hyrox/plan");
  });
});
