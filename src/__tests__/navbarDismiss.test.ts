import fs from "fs";
import path from "path";

/**
 * El menú de Cuenta de móvil estuvo INUSABLE desde que se implementó el navbar
 * nuevo (commit 38164bd): tocar cualquier opción cerraba la hoja antes de que
 * el click llegara al botón.
 *
 * La causa: hay un escuchador de `mousedown` sobre `document` que cierra los
 * menús abiertos si el clic cae fuera de ciertos contenedores. Ese guard listaba
 * el desplegable de escritorio y el de notificaciones, pero NO la hoja de móvil,
 * que es un elemento distinto. El `stopPropagation` del `onClick` de la hoja no
 * ayuda: es un escuchador nativo sobre `document`, y se ejecuta igual.
 *
 * No se detectó durante meses porque nadie probó el menú con una sesión real en
 * un móvil. Este test lo bloquea sin necesidad de montar el componente entero
 * (que exigiría simular router, store de sesión y Firebase).
 */

const src = fs.readFileSync(path.join(process.cwd(), "src/components/Navbar.tsx"), "utf8");

/** El bloque del guard: desde el listener de mousedown hasta su `return`. */
function guardDeClicFuera(): string {
  const desde = src.indexOf("const handleDown = (e: MouseEvent)");
  expect(desde).toBeGreaterThan(-1);
  const hasta = src.indexOf("setAdminNotificationsOpen(false);", desde);
  return src.slice(desde, hasta);
}

describe("Navbar — cierre al pulsar fuera", () => {
  it("el guard contempla TODOS los contenedores que pueden estar abiertos", () => {
    const guard = guardDeClicFuera();
    // Si se añade un menú nuevo y no se suma aquí, ese menú será inusable:
    // cualquier pulsación dentro se interpretará como "clic fuera".
    for (const contenedor of ["desktopAccountRef", "adminNotificationsRef", "mobileAccountSheetRef"]) {
      expect({ contenedor, contemplado: guard.includes(contenedor) }).toEqual({ contenedor, contemplado: true });
    }
  });

  it("la hoja de Cuenta de móvil tiene el ref enganchado en el DOM", () => {
    // Listarlo en el guard no sirve de nada si el ref nunca se asigna al elemento.
    expect(src).toMatch(/ref=\{mobileAccountSheetRef\}/);
    expect(src).toMatch(/const mobileAccountSheetRef = useRef/);
  });

  it("cada ref del guard se declara y se engancha a un elemento", () => {
    const guard = guardDeClicFuera();
    const refs = [...guard.matchAll(/(\w+Ref)\.current\?\.contains/g)].map((m) => m[1]);
    expect(refs.length).toBeGreaterThanOrEqual(3);
    for (const ref of refs) {
      expect({ ref, declarado: new RegExp(`const ${ref} = useRef`).test(src) }).toEqual({ ref, declarado: true });
      expect({ ref, enganchado: new RegExp(`ref=\\{${ref}\\}`).test(src) }).toEqual({ ref, enganchado: true });
    }
  });
});
