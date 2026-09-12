import fs from "fs";
import path from "path";

/**
 * El README es lo primero que ve cualquiera que llegue al repo público, y está
 * lleno de referencias a archivos concretos — es lo que permite comprobar sus
 * afirmaciones en vez de creerlas.
 *
 * Un enlace roto convierte esa promesa en lo contrario. La versión anterior
 * apuntaba a `VERCEL_DEPLOY.md` y `HOSTING_COMPARISON.md`, que no existen: el
 * README afirmaba tener documentación que no estaba. Mismo problema que los
 * tests de `landingClaims`, aplicado a la documentación.
 */

const raiz = process.cwd();
const readme = fs.readFileSync(path.join(raiz, "README.md"), "utf8");

/** Enlaces markdown que apuntan a archivos del repo (no a URLs externas ni anclas). */
function enlacesLocales(): string[] {
  const todos = [...readme.matchAll(/\]\(([^)]+)\)/g)].map((m) => m[1]);
  return [...new Set(todos)].filter((h) => !/^(https?:|mailto:|#)/.test(h)).map((h) => h.split("#")[0]);
}

describe("README", () => {
  it("todos los archivos que enlaza existen", () => {
    const rotos = enlacesLocales().filter((rel) => !fs.existsSync(path.join(raiz, rel)));
    expect(rotos).toEqual([]);
  });

  it("enlaza al menos los documentos principales del proyecto", () => {
    // Si alguno se borra o se renombra, que salte aquí y no en la cara de
    // quien clone el repo.
    for (const doc of ["DESIGN_SYSTEM.md", "firestore.rules", ".claude/DECISIONS.md"]) {
      expect({ doc, enlazado: enlacesLocales().includes(doc) }).toEqual({ doc, enlazado: true });
    }
  });

  it("no quedó nada de la plantilla de create-next-app", () => {
    // El README original era la plantilla por defecto con la documentación de
    // instalación pegada debajo. En un repo público eso señala abandono.
    expect(readme).not.toMatch(/bootstrapped with/i);
    expect(readme).not.toMatch(/Learn Next\.js/i);
  });

  it("documenta las variables de entorno que el código realmente exige", () => {
    // Sin estas, un clon limpio no arranca. Ya pasó: el README documentaba
    // solo un subconjunto.
    for (const v of [
      "OPENAI_API_KEY",
      "NEXT_PUBLIC_FIREBASE_API_KEY",
      "FIREBASE_ADMIN_CLIENT_EMAIL",
      "FIREBASE_ADMIN_PRIVATE_KEY",
      "STRIPE_SECRET_KEY",
    ]) {
      expect({ variable: v, documentada: readme.includes(v) }).toEqual({ variable: v, documentada: true });
    }
  });
});
