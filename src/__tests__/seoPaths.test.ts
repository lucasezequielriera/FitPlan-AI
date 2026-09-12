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

/** Quita comentarios: JSX, de bloque y de línea. */
function sinComentarios(src: string): string {
  return src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

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

  it("toda página noindex lo declara en TODAS sus ramas de render", () => {
    // La clase de bug, no el caso concreto. `loading`/`authLoading` arrancan en
    // `true`, así que el HTML que entrega el servidor —y el que ve un
    // buscador— es el del return temprano. Si el `noindex` vive solo en el
    // return principal, nunca llega.
    //
    // Pasó dos veces: /payment/success (issue #28) y /dashboard (issue #36),
    // ambas sirviendo HTML indexable pese a tener el meta en el código.
    //
    // LÍMITES CONOCIDOS de esta comprobación, verificados con mutaciones: solo
    // reconoce returns dentro de bloques `if (...) { }` indentados a dos
    // espacios. NO detecta un `if` de una línea sin llaves, un `return` dentro
    // de un `switch`, un ternario en el return, ni ramas que vivan en otro
    // archivo. Cubre la forma en que el bug apareció las dos veces, no la
    // totalidad del espacio de fallo — la red que no tiene agujeros es el
    // `Disallow` de robots.txt, que se comprueba más abajo.
    const paginas = [
      "src/pages/dashboard.tsx",
      "src/pages/payment/success.tsx",
      "src/pages/payment/failure.tsx",
      "src/pages/payment/pending.tsx",
      "src/pages/create-plan.tsx",
    ];

    const fallos: string[] = [];
    for (const rel of paginas) {
      // Se quitan los comentarios ANTES de analizar: los comentarios que
      // explican por qué hace falta el noindex contienen la palabra, y el test
      // se daba por satisfecho con ellos. Tercer falso negativo de este tipo en
      // el repo — un comentario no llega nunca al HTML.
      const src = sinComentarios(fs.readFileSync(path.join(process.cwd(), rel), "utf8"));
      expect({ pagina: rel, declaraNoindex: /noindex/.test(src) }).toEqual({ pagina: rel, declaraNoindex: true });

      // Bloques `if (...) { ... return ... }` en el primer nivel del componente:
      // son exactamente los returns tempranos que puede servir el servidor.
      for (const m of src.matchAll(/^ {2}if \s*\([^)]*\)\s*\{\n([\s\S]*?)^ {2}\}/gm)) {
        const bloque = m[1];
        // Solo importan los returns que RENDERIZAN: `return (<...`, `return <...`
        // o `return null`. Un `return ts.toDate()` de una función auxiliar no
        // es una rama de render y no debe contarse.
        const renderiza = /return\s*\(\s*\n?\s*</.test(bloque) || /return\s*</.test(bloque) || /return\s+null\s*;/.test(bloque);
        if (!renderiza) continue;
        if (!/noindex|NoIndexHead/i.test(bloque)) {
          fallos.push(`${rel}: ${bloque.trim().split("\n")[0].slice(0, 60)}`);
        }
      }
    }
    expect(fallos).toEqual([]);
  });

  it("toda página noindex tiene además su red en robots.txt", () => {
    // Esta comprobación SÍ es completa: no depende de analizar código. Si el
    // meta vuelve a quedarse fuera del HTML servido por cualquier vía —
    // incluidas las que el test de arriba no ve— el Disallow lo cubre.
    //
    // /create-plan queda fuera a propósito: es una página pública cuyo contenido
    // sí se sirve, y bloquear el rastreo impediría que el buscador llegara a
    // leer su `noindex`. Ahí la barrera correcta es el meta, no el Disallow.
    const bloqueadas = robots
      .split("\n")
      .filter((l) => l.trim().startsWith("Disallow:"))
      .map((l) => l.split("Disallow:")[1].trim());

    for (const ruta of ["/dashboard", "/hyrox/plan"]) {
      expect({ ruta, protegida: bloqueadas.some((b) => ruta.startsWith(b)) }).toEqual({ ruta, protegida: true });
    }
  });

  it("la app tras login NO se envía ni se indexa", () => {
    expect(INDEXABLE_PATHS).not.toContain("/hyrox/plan");
    expect(enSitemap).not.toContain("/hyrox/plan");
    expect(robots).toContain("Disallow: /hyrox/plan");
  });
});
