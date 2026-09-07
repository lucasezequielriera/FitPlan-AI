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

  it("la app tras login NO se envía ni se indexa", () => {
    expect(INDEXABLE_PATHS).not.toContain("/hyrox/plan");
    expect(enSitemap).not.toContain("/hyrox/plan");
    expect(robots).toContain("Disallow: /hyrox/plan");
  });
});
