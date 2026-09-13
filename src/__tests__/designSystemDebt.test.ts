import fs from "fs";
import path from "path";
import { contarColoresCrudos } from "@/lib/design/rawColors";

/**
 * #11 — que `DESIGN_SYSTEM.md` no pueda mentir sobre el estado del código.
 *
 * El issue reportaba que el documento daba por migrados archivos llenos de
 * colores crudos. Al ir a arreglarlo apareció algo peor: estaba equivocado en
 * las DOS direcciones. Daba por migrados 104 usos que existían, y listaba unas
 * 227 de deuda en archivos que ya estaban a cero.
 *
 * Y el comentario que "corregía" el issue con números nuevos (43 y 25) también
 * era falso: con su propio patrón salen 58 y 46. Tres recuentos del mismo
 * archivo, tres cifras, ninguno verificable.
 *
 * Corregir la tabla a mano habría durado hasta el siguiente cambio. Lo que
 * arregla el problema es que el documento sea comprobable, que es lo que hace
 * este test: la tabla es la afirmación y el código es la verdad, y si se
 * separan, falla.
 */

const DOC = "DESIGN_SYSTEM.md";
const leer = (p: string) => fs.readFileSync(path.join(process.cwd(), p), "utf8");

/** Filas `| \`ruta\` | N | …` de la tabla de deuda. */
function tablaDelDocumento(): Map<string, number> {
  const doc = leer(DOC);
  const inicio = doc.indexOf("### Deuda real");
  if (inicio === -1) {
    throw new Error("No se encontró la sección 'Deuda real' en DESIGN_SYSTEM.md");
  }
  const fin = doc.indexOf("**Total:", inicio);
  const filas = [...doc.slice(inicio, fin).matchAll(/^\|\s*`([^`]+)`\s*\|\s*(\d+)\s*\|/gm)];
  return new Map(filas.map((f) => [f[1], Number(f[2])]));
}

/** Recuento real, archivo por archivo, de todo `src`. */
function deudaReal(): Map<string, number> {
  const real = new Map<string, number>();
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(path.join(process.cwd(), dir), { withFileTypes: true })) {
      const rel = `${dir}/${e.name}`;
      if (e.isDirectory()) {
        walk(rel);
      } else if (/\.(tsx?|css)$/.test(e.name) && !rel.includes("__tests__")) {
        const n = contarColoresCrudos(leer(rel));
        if (n > 0) real.set(rel, n);
      }
    }
  };
  walk("src");
  return real;
}

describe("#11 — la tabla de deuda visual dice la verdad", () => {
  const tabla = tablaDelDocumento();
  const real = deudaReal();

  it("ningún archivo con deuda se queda fuera de la tabla", () => {
    // La propiedad importante. Sin esto, la tabla podría estar correcta en
    // todas sus filas y aun así ocultar un archivo entero — que es exactamente
    // lo que pasaba con `IntakeClientPlanPublicView.tsx`, listado como migrado.
    const ausentes = [...real.keys()].filter((f) => !tabla.has(f)).sort();
    expect(ausentes).toEqual([]);
  });

  it("ningún archivo de la tabla está ya limpio", () => {
    // El error contrario, y el que nadie mira: seguir listando como pendiente
    // lo que ya se arregló. Hace que la deuda parezca mayor de lo que es y que
    // el trabajo hecho no cuente.
    const yaLimpios = [...tabla.keys()].filter((f) => !real.has(f)).sort();
    expect(yaLimpios).toEqual([]);
  });

  it("los recuentos de cada fila coinciden con el código", () => {
    const desviados = [...tabla.entries()]
      .filter(([f, n]) => real.has(f) && real.get(f) !== n)
      .map(([f, n]) => ({ archivo: f, dice: n, real: real.get(f) }));
    expect(desviados).toEqual([]);
  });

  it("el total declarado es la suma de las filas", () => {
    const doc = leer(DOC);
    const declarado = doc.match(/\*\*Total:\s*(\d+)\s*clases en\s*(\d+)\s*archivos/);
    expect(declarado).not.toBeNull();
    const suma = [...tabla.values()].reduce((a, b) => a + b, 0);
    expect({ clases: Number(declarado![1]), archivos: Number(declarado![2]) }).toEqual({
      clases: suma,
      archivos: tabla.size,
    });
  });

  it("los archivos que el documento da por migrados están de verdad migrados", () => {
    // La afirmación exacta del issue #11. Se comprueban los que el párrafo de
    // arriba nombra como aplicados "a fondo" y que no tienen fila propia.
    const doc = leer(DOC);
    const parrafo = doc.slice(doc.indexOf("Esta sesión aplicó"), doc.indexOf("### Deuda real"));
    const nombrados = [...parrafo.matchAll(/`([A-Za-z[\]/.-]+\.tsx?)`/g)].map((m) => m[1]);
    expect(nombrados.length).toBeGreaterThan(5); // si el párrafo cambia de forma, que se note

    const mentiras = nombrados.filter((nombre) => {
      // El párrafo los nombra por basename; se busca su fila por sufijo.
      const conDeuda = [...real.keys()].filter((f) => f.endsWith(nombre.replace(/^.*\//, "")));
      return conDeuda.some((f) => !tabla.has(f));
    });
    expect(mentiras).toEqual([]);
  });
});

describe("#11 — ningún `hover:` que no haga nada", () => {
  it("no hay un `hover:bg-X` igual que su `bg-X` base", () => {
    // Lo introdujo una sustitución automática de esta misma tanda: al mapear
    // `bg-emerald-500/25` y `hover:bg-emerald-500/35` al mismo token, los dos
    // acabaron en `bg-success/25` y el botón dejó de responder al puntero.
    //
    // No lo veía ni el typecheck ni el guard de colores —la clase es válida y
    // el token es correcto—, solo se notaba usándolo. Por eso hace falta un
    // guard propio: es el tipo de fallo que sobrevive a todo lo demás.
    // Deuda que ya existía antes de este guard. Arreglar cada una exige decidir
    // qué debería hacer ese hover, y eso es diseño, no sustitución mecánica.
    // Se declaran para que el guard bloquee las NUEVAS sin fingir que estas no
    // están: la lista solo puede encoger.
    const YA_EXISTENTES = [
      "src/components/ExerciseSetTracker.tsx: hover:text-info",
      "src/components/PremiumPlanModal.tsx: hover:border-[var(--landing-border)]",
      "src/components/WeeklyStatsModal.tsx: hover:text-danger",
      "src/components/admin/AdminApp.tsx: hover:bg-success",
      "src/pages/plan.tsx: hover:text-info",
      "src/pages/plan.tsx: hover:text-warning",
    ];

    const ofensores: string[] = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(path.join(process.cwd(), dir), { withFileTypes: true })) {
        const rel = `${dir}/${e.name}`;
        if (e.isDirectory()) walk(rel);
        else if (/\.tsx$/.test(e.name) && !rel.includes("__tests__")) {
          for (const m of leer(rel).matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)) {
            const clases = (m[1] || m[2] || "").split(/\s+/);
            for (const c of clases) {
              const hover = c.match(/^hover:(bg|text|border)-(.+)$/);
              if (hover && clases.includes(`${hover[1]}-${hover[2]}`)) {
                ofensores.push(`${rel}: ${c}`);
              }
            }
          }
        }
      }
    };
    walk("src");
    const nuevos = [...new Set(ofensores)].filter((o) => !YA_EXISTENTES.includes(o)).sort();
    expect(nuevos).toEqual([]);

    // La lista solo puede encoger: si alguien arregla una, tiene que sacarla de
    // aquí. Si no, el trinquete se afloja solo y vuelve a dar por bueno lo que
    // ya no existe — el mismo error que la tabla de deuda tenía en §5.
    const obsoletos = YA_EXISTENTES.filter((e) => !ofensores.includes(e));
    expect(obsoletos).toEqual([]);
  });
});

describe("#11 — el contador es uno solo", () => {
  it("cuenta un uso crudo y no cuenta un token", () => {
    expect(contarColoresCrudos(`<div className="bg-emerald-500 text-slate-100" />`)).toBe(2);
    expect(contarColoresCrudos(`<div className="bg-success text-foreground border-border" />`)).toBe(0);
  });

  it("no cuenta lo que hay dentro de un comentario", () => {
    // `globals.css` documenta cada token con su equivalente Tailwind. Contar
    // eso penalizaría justo al archivo que define los tokens — y es el mismo
    // error que ya se coló tres veces en otros guards de este repo, donde el
    // comentario que explicaba el arreglo satisfacía la comprobación.
    expect(contarColoresCrudos(`--success: #10b981; /* bg-emerald-500 */`)).toBe(0);
    expect(contarColoresCrudos(`// usar text-slate-100 aquí sería deuda`)).toBe(0);
  });

  it("cubre más prefijos que `bg`/`text`/`border`", () => {
    // El recuento del comentario del issue usaba seis prefijos y por eso daba
    // cifras más bajas que la realidad.
    expect(contarColoresCrudos(`<div className="ring-sky-400 divide-zinc-700 fill-rose-500" />`)).toBe(3);
  });
});
