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
  // Segunda tanda (#27-bis): el mismo patrón se repetía en ocho endpoints más.
  "src/pages/api/saveExerciseWeights.ts",
  "src/pages/api/saveUserLocation.ts",
  "src/pages/api/saveMonthlySnapshot.ts",
  "src/pages/api/analyzeFood.ts",
  "src/pages/api/generatePlan.ts",
  "src/pages/api/user/replyMessage.ts",
  "src/pages/api/user/markMessageRead.ts",
  "src/pages/api/sendMessage.ts",
];

/**
 * Endpoints donde el UID efectivo NO siempre es el de quien llama, así que no
 * cumplen la regla general de `= auth.uid` y se comprueban aparte.
 */
const EXCEPCIONES = new Map<string, string>([
  // El admin guarda snapshots de OTROS usuarios desde el panel.
  ["src/pages/api/saveMonthlySnapshot.ts", "requireSelfOrAdmin"],
  // Sirve también a quien no ha iniciado sesión: sin token es un usuario free.
  ["src/pages/api/generatePlan.ts", "authOpcional"],
]);

describe("#27 — la identidad sale del token, no del cuerpo", () => {
  it("todos verifican identidad antes de actuar", () => {
    const sinVerificar = ENDPOINTS_DE_USUARIO.filter(
      (f) => !/requireUser|requireSelfOrAdmin/.test(read(f))
    );
    expect(sinVerificar).toEqual([]);
  });

  it("las excepciones son deliberadas y están documentadas", () => {
    // Dos endpoints no pueden usar `= auth.uid` a secas. Que sean excepciones
    // no las exime: se comprueba que usen el mecanismo que les corresponde, y
    // no que simplemente les falte la verificación.
    for (const [archivo, mecanismo] of EXCEPCIONES) {
      const src = sinComentarios(read(archivo));
      expect({ archivo, usa: mecanismo, ok: src.includes(mecanismo) }).toEqual({
        archivo,
        usa: mecanismo,
        ok: true,
      });
    }
  });

  it("ninguno lee `userId` del cuerpo de la petición", () => {
    // El bug exacto. Si vuelve a aparecer un `const { userId } = req.body`, es
    // que alguien reintrodujo el patrón.
    const ofensores: string[] = [];
    for (const f of ENDPOINTS_DE_USUARIO) {
      // `saveMonthlySnapshot` sí lee un userId del cuerpo, a propósito: es el
      // usuario OBJETIVO que indica el admin, y `requireSelfOrAdmin` comprueba
      // que quien llama tenga derecho a actuar sobre él. Es distinto de sacar
      // la identidad de quien llama del cuerpo, que es el bug.
      if (EXCEPCIONES.get(f) === "requireSelfOrAdmin") continue;
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
      if (EXCEPCIONES.has(f)) continue; // comprobados en su propio test
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
    const rutas = [
      "saveUserProfile", "savePlan", "createPayment", "createStripePayment", "checkStripePayment",
      "saveExerciseWeights", "saveUserLocation", "saveMonthlySnapshot", "analyzeFood",
      "generatePlan", "user/replyMessage", "user/markMessageRead", "sendMessage",
    ];
    // `adminFetch` también adjunta token (el del admin), así que vale.
    const patron = new RegExp(`(?<!authed)(?<!admin)fetch\\(\\s*[\`"']/api/(${rutas.join("|")})`, "g");

    const ofensores: string[] = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(path.join(process.cwd(), dir), { withFileTypes: true })) {
        const rel = `${dir}/${e.name}`;
        if (e.isDirectory()) walk(rel);
        else if (/\.tsx?$/.test(e.name) && !rel.startsWith("src/pages/api")) {
          const src = sinComentarios(read(rel));
          let m: RegExpExecArray | null;
          patron.lastIndex = 0;
          while ((m = patron.exec(src)) !== null) {
            // Adjuntar el token a mano también vale: `authStore` lo hace así
            // porque lo saca del `userCredential` recién creado, sin depender
            // de que `auth.currentUser` ya esté poblado.
            const alrededor = src.slice(m.index, m.index + 400);
            if (!/Authorization/.test(alrededor)) {
              ofensores.push(rel);
              break;
            }
          }
          patron.lastIndex = 0;
        }
      }
    };
    walk("src");
    expect(ofensores).toEqual([]);
  });
});
