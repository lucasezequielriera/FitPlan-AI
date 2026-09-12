import fs from "fs";
import path from "path";

/**
 * Ningún endpoint que actúe en nombre de un usuario puede sacar su identidad
 * del cuerpo de la petición.
 *
 * El patrón se repitió en cinco archivos a la vez (issue #27): todos aceptaban
 * un `userId` y solo comprobaban que no estuviera vacío. Con el UID de otra
 * persona se le podía sobrescribir el perfil, crear planes en su cuenta o
 * generar un checkout a su nombre.
 */

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), "utf8");

/** Quita comentarios: las explicaciones del arreglo mencionan los términos. */
function sinComentarios(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

/**
 * Endpoints que actúan en nombre de un usuario concreto. Lista explícita, no un
 * recorrido automático del directorio: los endpoints públicos legítimos
 * (`planPrices`, los webhooks, los `cron`) no deben exigir token, y un barrido
 * ciego los marcaría como fallo.
 */
const ENDPOINTS_DE_USUARIO = [
  "src/pages/api/saveUserProfile.ts",
  "src/pages/api/savePlan.ts",
  "src/pages/api/createPayment.ts",
  "src/pages/api/createStripePayment.ts",
  "src/pages/api/checkStripePayment.ts",
  "src/pages/api/updateLastLogin.ts",
  "src/pages/api/funnel/track.ts",
];

describe("#27 — la identidad sale del token, no del cuerpo", () => {
  it("todos verifican identidad antes de actuar", () => {
    const sinVerificar = ENDPOINTS_DE_USUARIO.filter((f) => !/requireUser/.test(read(f)));
    expect(sinVerificar).toEqual([]);
  });

  it("ninguno lee `userId` del cuerpo de la petición", () => {
    // El bug exacto. Si vuelve a aparecer un `const { userId } = req.body`, es
    // que alguien reintrodujo el patrón.
    const ofensores: string[] = [];
    for (const f of ENDPOINTS_DE_USUARIO) {
      const src = sinComentarios(read(f));
      // `userId` desestructurado de req.body, en cualquier orden de campos.
      if (/const\s*\{[^}]*\buserId\b[^}]*\}\s*=\s*(req\.body|\(req\.body)/.test(src)) {
        ofensores.push(f);
      }
    }
    expect(ofensores).toEqual([]);
  });

  it("el UID que usan viene de `auth.uid`", () => {
    for (const f of ENDPOINTS_DE_USUARIO) {
      const src = sinComentarios(read(f));
      if (!/\buserId\b/.test(src)) continue; // no todos lo nombran
      expect({ endpoint: f, derivaDelToken: /=\s*auth\.uid/.test(src) }).toEqual({
        endpoint: f,
        derivaDelToken: true,
      });
    }
  });
});

describe("#27 — los llamadores adjuntan el token", () => {
  it("ningún componente llama a estos endpoints con fetch pelado", () => {
    // Si un llamador se queda en `fetch`, el endpoint responderá 401 y la
    // función deja de funcionar. Es la forma de romper el pago sin que ningún
    // test unitario se entere.
    const rutas = ["saveUserProfile", "savePlan", "createPayment", "createStripePayment", "checkStripePayment"];
    const patron = new RegExp(`(?<!authed)fetch\\(\\s*[\`"']/api/(${rutas.join("|")})`, "g");

    const ofensores: string[] = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(path.join(process.cwd(), dir), { withFileTypes: true })) {
        const rel = `${dir}/${e.name}`;
        if (e.isDirectory()) walk(rel);
        else if (/\.tsx?$/.test(e.name) && !rel.startsWith("src/pages/api")) {
          if (patron.test(sinComentarios(read(rel)))) ofensores.push(rel);
          patron.lastIndex = 0;
        }
      }
    };
    walk("src");
    expect(ofensores).toEqual([]);
  });
});
