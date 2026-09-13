import fs from "fs";
import path from "path";

/**
 * #24 — que los entregables de marca no describan una marca que ya no existe.
 *
 * El issue pedía limpiar los assets viejos. Al mirarlo, casi todo ya estaba
 * hecho: no quedaba ningún SVG ni PNG de la paleta azul/cian. Lo que quedaba
 * era peor y no estaba en la lista: `colores/tokens.css`, el archivo que
 * cualquiera abre para saber los colores de FitPlan, seguía siendo la paleta
 * vieja entera —azul, cian, verde— más un tema "Pro" dorado que ya no existe.
 *
 * Un PNG viejo se ve viejo. Un archivo de tokens viejo se copia.
 *
 * El arreglo no fue corregirlo: fue generarlo desde `globals.css`, que es donde
 * vive la paleta de verdad. Este test comprueba que sigan atados.
 */

const leer = (p: string) => fs.readFileSync(path.join(process.cwd(), p), "utf8");

/** Tokens con hex literal del `:root` de un CSS. */
function tokensDe(css: string): Map<string, string> {
  const root = css.slice(css.indexOf(":root"), css.indexOf("}", css.indexOf(":root")));
  const out = new Map<string, string>();
  for (const m of root.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{3,8})\s*;/g)) {
    out.set(m[1], m[2].toLowerCase());
  }
  return out;
}

describe("#24 — los colores de marca son los de la app", () => {
  const app = tokensDe(leer("src/styles/globals.css"));
  const marca = tokensDe(leer("brand&designs/colores/tokens.css"));

  it("el entregable tiene exactamente los tokens de la app", () => {
    expect([...marca.keys()].sort()).toEqual([...app.keys()].sort());
  });

  it("y con los mismos valores", () => {
    const desviados = [...app.entries()]
      .filter(([k, v]) => marca.get(k) !== v)
      .map(([k, v]) => ({ token: k, app: v, marca: marca.get(k) }));
    expect(desviados).toEqual([]);
  });

  it("no queda rastro de la paleta anterior ni del tema Pro", () => {
    // Los hex exactos que tenía el `tokens.css` viejo. `#3b82f6` NO está en la
    // lista a propósito: hoy es `--phase-hyrox-base`, un azul aprobado para las
    // fases de periodización, no un resto de la marca azul.
    const viejos = ["#22d3ee", "#10e5b0", "#e3c77e", "#b08d3f", "#080e18", "#111b2b"];
    const css = leer("brand&designs/colores/tokens.css").toLowerCase();
    expect(viejos.filter((h) => css.includes(h))).toEqual([]);
    expect(css).not.toContain("data-brand");
  });

  it("el entregable dice que está generado", () => {
    // Sin esto, alguien lo edita a mano, el generador se lo pisa en la siguiente
    // corrida, y el cambio se pierde sin que nadie entienda por qué.
    expect(leer("brand&designs/colores/tokens.css")).toMatch(/GENERADO/);
  });
});

describe("#24 — nada apunta a un asset que no existe", () => {
  it("todas las rutas de marca referenciadas están en public/", () => {
    // Renombrar un asset y olvidar una referencia deja un icono roto en la
    // pestaña, el manifest o una tarjeta compartida — sitios donde nadie mira
    // hasta que alguien lo comparte.
    const fuentes: string[] = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(path.join(process.cwd(), dir), { withFileTypes: true })) {
        const rel = `${dir}/${e.name}`;
        if (e.isDirectory()) walk(rel);
        else if (/\.(tsx?|json|webmanifest)$/.test(e.name)) fuentes.push(rel);
      }
    };
    walk("src");
    fuentes.push("public/site.webmanifest");

    const rotas: string[] = [];
    for (const f of fuentes) {
      for (const m of leer(f).matchAll(/"(\/(?:brand\/[\w.-]+|favicon\.\w+))"/g)) {
        if (!fs.existsSync(path.join(process.cwd(), "public", m[1]))) {
          rotas.push(`${f} → ${m[1]}`);
        }
      }
    }
    expect(rotas).toEqual([]);
  });
});

describe("#24 — el generador es la fuente única", () => {
  // Sin comentarios. El bloque que explica de dónde salen los colores nombra
  // `globals.css`, así que un guard que buscara ese texto en el archivo entero
  // pasaría aunque el código dejara de leerlo. Es la cuarta vez en este repo
  // que la explicación de un arreglo satisface a la comprobación del arreglo.
  const script = leer("brand&designs/_generar.mjs")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

  it("genera también el .ico", () => {
    // El issue lo señalaba: `sharp` no escribe `.ico`, así que el favicon se
    // generaba aparte y se quedó con el logo viejo mientras el resto ya era
    // lima. Lo que sale del proceso manual es lo que se desincroniza.
    expect(script).toMatch(/favicon\.ico/);
    expect(script).toMatch(/buildIco/);
  });

  it("genera los colores en vez de llevarlos escritos", () => {
    expect(script).toMatch(/globals\.css/);
    expect(script).toMatch(/colores\/tokens\.css/);
  });

  it("copia a public/ desde los entregables, no al revés", () => {
    // Si la app y la carpeta de marca tuvieran cada una su copia editable,
    // volverían a divergir. La dirección importa.
    expect(script).toMatch(/A_PUBLIC/);
    expect(script).toMatch(/copyFileSync/);
  });
});
