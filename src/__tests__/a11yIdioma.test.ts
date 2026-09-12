import fs from "fs";
import path from "path";
import { langForPath } from "@/pages/_document";

/**
 * Dos fallos de accesibilidad que solo se ven en el HTML servido, no leyendo
 * el componente: el idioma declarado del documento y el nombre accesible de un
 * enlace que en móvil se queda mudo.
 */

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), "utf8");

describe("#29 — el idioma del documento sale de la ruta", () => {
  it("las rutas en inglés declaran inglés", () => {
    for (const ruta of ["/en", "/en/", "/en/transformacion-fitplan", "/en/formulario-de-inicio"]) {
      expect({ ruta, lang: langForPath(ruta) }).toEqual({ ruta, lang: "en" });
    }
  });

  it("el resto declara español", () => {
    for (const ruta of ["/", "/transformacion-fitplan", "/hyrox", "/dashboard", "/plan"]) {
      expect({ ruta, lang: langForPath(ruta) }).toEqual({ ruta, lang: "es" });
    }
  });

  it("una ruta que EMPIEZA por 'en' pero no es inglés no se confunde", () => {
    // El caso que rompe un `startsWith("/en")` ingenuo. Hoy no existen estas
    // rutas, pero "entrenamiento" es una palabra probable en este producto.
    for (const ruta of ["/entrenamiento", "/encuesta", "/entrenador/123"]) {
      expect({ ruta, lang: langForPath(ruta) }).toEqual({ ruta, lang: "es" });
    }
  });

  it("sin ruta cae a español, no a undefined", () => {
    expect(langForPath(undefined)).toBe("es");
    expect(langForPath("")).toBe("es");
  });

  it("el lang no vuelve a quedar fijo en el markup", () => {
    // La regresión concreta: `<Html lang="es">` escrito a mano.
    const src = read("src/pages/_document.tsx");
    expect(src).not.toMatch(/<Html\s+lang="es"/);
    expect(src).toMatch(/<Html\s+lang=\{/);
  });
});

describe("#30 — el enlace del logo tiene nombre accesible en móvil", () => {
  const src = read("src/components/Navbar.tsx");

  it("el texto de marca no está oculto con `hidden`", () => {
    // `hidden` lo saca del árbol de accesibilidad. Como la imagen lleva
    // `alt=""`, el enlace se anunciaba como "enlace" a secas: sin decir a dónde
    // lleva. `sr-only` lo oculta visualmente pero lo mantiene anunciable.
    expect(src).toMatch(/className="sr-only[^"]*sm:not-sr-only[^"]*">\s*\n?\s*FitPlan/);
    expect(src).not.toMatch(/className="hidden[^"]*">FitPlan</);
  });

  it("si algún día se oculta del todo, tiene que haber un aria-label", () => {
    // La propiedad que de verdad importa: el enlace tiene nombre por alguna
    // vía. Si alguien vuelve a `hidden`, este test exige la alternativa.
    const inicioEnlace = src.indexOf("href={homeHref}");
    expect(inicioEnlace).toBeGreaterThan(-1);
    const bloque = src.slice(inicioEnlace, src.indexOf("</Link>", inicioEnlace));
    const tieneNombre = /sr-only/.test(bloque) || /aria-label/.test(bloque) || /alt="[^"]+"/.test(bloque);
    expect({ enlaceDelLogo: "tiene nombre accesible", ok: tieneNombre }).toEqual({
      enlaceDelLogo: "tiene nombre accesible",
      ok: true,
    });
  });
});
