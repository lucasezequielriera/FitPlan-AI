import fs from "fs";
import path from "path";

/**
 * FitPlan NO tiene nutricionistas ni entrenadores certificados detrás
 * (confirmado por Lucas, 2026-09). Afirmarlo en textos de cara al público es a
 * la vez un problema de conversión —la gente lo verifica y no encuentra a
 * nadie— y de exposición legal en España, por tratarse de afirmaciones de
 * salud y de publicidad ante consumidores.
 *
 * Estos textos estuvieron publicados, incluida la FAQ con datos estructurados
 * que indexa Google. Este test evita que vuelvan.
 */

const PROHIBIDOS = [
  /nutricionistas?\s+certificad/i,
  /entrenadores?\s+profesional/i,
  /entrenador\s+personal\s+certificado/i,
  /dise[ñn]ado[s]?\s+por\s+nutricionistas/i,
  /por\s+nutricionistas\s+y\s+entrenadores/i,
  /certified\s+nutritionist/i,
  /professional\s+trainers/i,
  /certified\s+personal\s+trainer/i,
  /designed\s+by\s+certified/i,
];

/**
 * `legal/disclaimer.tsx` queda fuera a propósito: ahí la mención es al revés
 * —le dice al usuario que consulte a un profesional certificado porque la app
 * NO lo sustituye—, que es exactamente lo que debe decir.
 */
const EXENTOS = ["src/pages/legal/disclaimer.tsx"];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(path.join(process.cwd(), dir), { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) walk(rel, out);
    else if (/\.tsx?$/.test(entry.name) && !rel.includes("__tests__")) out.push(rel);
  }
  return out;
}

/**
 * Copy público que NO vive en `src`.
 *
 * El guard solo recorría `src/**\/*.tsx?`, así que el manifest se le escapó: la
 * decisión del 2026-09-05 de retirar "diseñado por nutricionistas y entrenadores
 * profesionales" se aplicó a la landing y a los datos estructurados, pero la
 * frase siguió viva en `site.webmanifest` durante semanas — y ese texto es el
 * que ve quien instala la app en su móvil.
 *
 * Lo encontró una revisión mirando a mano, no este test. Ahora entra aquí.
 */
const COPY_FUERA_DE_SRC = ["public/site.webmanifest"];

/** Todo lo que el guard revisa. Una sola fuente, para que un test pueda
 *  comprobar la cobertura además del contenido. */
function revisados(): string[] {
  return [...walk("src"), ...COPY_FUERA_DE_SRC];
}

/**
 * Quita comentarios antes de buscar.
 *
 * Los archivos que documentan POR QUÉ una frase está prohibida la citan, y el
 * test se detectaba a sí mismo. Quitar comentarios no debilita el guard: un
 * comentario nunca llega al usuario. Lo que se sigue revisando es todo el
 * código y todas las cadenas de texto.
 */
function sinComentarios(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

describe("Textos públicos: credenciales que no tenemos", () => {
  it("ningún texto afirma que hay nutricionistas o entrenadores certificados detrás", () => {
    const ofensores: string[] = [];
    for (const file of revisados()) {
      if (EXENTOS.includes(file)) continue;
      const src = sinComentarios(fs.readFileSync(path.join(process.cwd(), file), "utf8"));
      for (const re of PROHIBIDOS) {
        const hit = src.match(re);
        if (hit) ofensores.push(`${file}: "${hit[0]}"`);
      }
    }
    expect(ofensores).toEqual([]);
  });

  it("el manifest entra en el barrido, no solo existe", () => {
    // Comprobar que el manifest está limpio no basta: si alguien reduce el
    // barrido a `src`, el test sigue verde porque ya no hay nada que encontrar,
    // y la cobertura se pierde en silencio hasta que alguien vuelve a meter la
    // frase. Lo que hay que fijar es que el archivo se MIRA.
    expect(revisados()).toContain("public/site.webmanifest");

    for (const f of COPY_FUERA_DE_SRC) {
      expect({ archivo: f, existe: fs.existsSync(path.join(process.cwd(), f)) }).toEqual({
        archivo: f,
        existe: true,
      });
    }
  });

  it("no se publican valoraciones inventadas en datos estructurados", () => {
    // La landing declaraba un `aggregateRating` de 4,8 sobre 150 valoraciones.
    // La app no tiene sistema de reseñas: el número era inventado, y Google lo
    // mostraba como estrellas en los resultados. Además de engañar al usuario,
    // los datos estructurados falsos son sancionables con acción manual.
    // Si algún día hay reseñas reales, este test tiene que cambiar a la vez que
    // se conecta el número a la fuente que las cuenta.
    const ofensores: string[] = [];
    for (const file of walk("src")) {
      const src = fs.readFileSync(path.join(process.cwd(), file), "utf8");
      // Solo cuenta si declara un valor, no si lo menciona un comentario.
      if (/(aggregateRating|ratingValue|ratingCount)\s*:\s*["'{]/.test(src)) ofensores.push(file);
    }
    expect(ofensores).toEqual([]);
  });
});
