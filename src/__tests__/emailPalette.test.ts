import fs from "fs";
import path from "path";
import { EMAIL, META_ESQUEMA_COLOR, botonEmail, enlaceEmail } from "@/lib/email/palette";

/**
 * #18 — los emails eran la última superficie con la paleta anterior.
 *
 * Y la peor de todas para dejarla atrás: un email no tiene "deploy y miro cómo
 * quedó". Sale de nuestro servidor y entra en la bandeja de alguien. Si va con
 * los colores viejos, ese envío ya no se corrige.
 *
 * Los emails no pueden usar los tokens de `globals.css` —los clientes de correo
 * no soportan variables CSS ni hojas externas—, así que los valores viven en
 * `@/lib/email/palette`. Este test comprueba que las plantillas los usen en vez
 * de volver a escribir hex a mano, que es como la app acabó con tres paletas.
 */

const leer = (p: string) => fs.readFileSync(path.join(process.cwd(), p), "utf8");

/** Emails de cara al cliente. Son los que llevan la marca. */
const PLANTILLAS = [
  "src/pages/api/admin/sendIntakeWelcomeEmail.ts",
  "src/pages/api/cron/intakeWeeklyDigest.ts",
];

/**
 * Arma HTML de email pero queda fuera a propósito, con el motivo escrito.
 *
 * `intakeEmail.ts` es la notificación interna de un lead nuevo: va solo al
 * correo de Lucas y es una tabla de datos sobre fondo claro, para leerse de un
 * vistazo. No es un mensaje de marca, y forzarle la paleta oscura la haría peor
 * sin que nadie lo agradezca.
 *
 * Está declarada aquí y no ignorada en silencio porque la primera versión de
 * este trabajo afirmaba que ese archivo "no tiene ni un hex". Era falso: tiene
 * cuatro, y dos están en `PALETA_VIEJA`. El grep que lo comprobó miró el
 * endpoint que envía y no siguió el import al módulo que construye.
 */
const EXCLUIDAS = new Map<string, string>([
  ["src/lib/intakeEmail.ts", "notificación interna a Lucas, paleta clara a propósito"],
]);

/** Los hex exactos de la paleta anterior que había en estos dos archivos. */
const PALETA_VIEJA = [
  "#0b1220", "#0f172a", "#111827", "#334155", "#94a3b8", "#cbd5e1", "#e2e8f0",
  "#22d3ee", "#67e8f9", "#14b8a6", "#5eead4",
];

function sinComentarios(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

/**
 * ¿Este archivo arma HTML de email?
 *
 * Basta con que construya marcado con estilos inline y colores literales: en un
 * `.ts` de este repo eso no tiene otro uso. Deliberadamente NO exige que el
 * mismo archivo envíe el correo, que era el hueco de la primera versión.
 */
function armaHtmlDeEmail(rel: string): boolean {
  const src = sinComentarios(leer(rel));
  return (
    /<(div|table|td|body)\b[^>]*style="[^"]*(background|color):/.test(src) &&
    /#[0-9a-fA-F]{6}/.test(src)
  );
}

describe("#18 — ninguna plantilla lleva la paleta anterior", () => {
  it.each(PLANTILLAS)("%s está limpia", (f) => {
    const src = sinComentarios(leer(f)).toLowerCase();
    expect(PALETA_VIEJA.filter((h) => src.includes(h))).toEqual([]);
  });

  it.each(PLANTILLAS)("%s no escribe ningún hex a mano", (f) => {
    // La regla que evita que vuelva a pasar. Un hex suelto en una plantilla es
    // un color que nadie va a actualizar en el siguiente cambio de paleta,
    // porque nadie mira los emails hasta que llega uno feo.
    const src = sinComentarios(leer(f));
    const hex = [...src.matchAll(/#[0-9a-fA-F]{6}\b/g)].map((m) => m[0]);
    expect(hex).toEqual([]);
  });

  it.each(PLANTILLAS)("%s declara el esquema de color oscuro en el HTML", (f) => {
    // Sin esto, los motores de modo oscuro (Outlook.com el peor) reinvierten un
    // diseño ya oscuro y lo dejan peor que antes. Declararlo es lo que hace que
    // lo lean como intencional.
    //
    // Se busca la interpolación, no el nombre: la primera versión comprobaba
    // que la cadena "META_ESQUEMA_COLOR" apareciera en el archivo, y la línea
    // del `import` ya la satisfacía. Quitar la meta del HTML dejaba el import
    // huérfano y el test verde.
    expect(sinComentarios(leer(f))).toContain("${META_ESQUEMA_COLOR}");
  });
});

describe("#18 — la paleta de email respeta las reglas del sistema", () => {
  it("el texto sobre lima nunca es claro", () => {
    // Regla de DESIGN_SYSTEM.md: sobre `--accent` va `--accent-ink`. En un
    // email no hay forma de corregirlo después de enviarlo.
    const boton = botonEmail("https://ejemplo", "Ver mi plan");
    expect(boton).toContain(`background:${EMAIL.acento}`);
    expect(boton).toContain(`color:${EMAIL.sobreAcento}`);
    expect(boton).not.toMatch(/color:#f|color:#e|color:#fff/i);
  });

  it("los enlaces van subrayados, no solo coloreados", () => {
    // Varios clientes fuerzan su azul por defecto si el enlace no declara
    // `text-decoration`, y entonces el color de marca no llega.
    expect(enlaceEmail("https://ejemplo", "texto")).toContain("text-decoration:underline");
  });

  it("no hay blanco ni negro puros", () => {
    // `#ffffff` es el caso que Outlook fuerza a oscuro en modo oscuro, dejando
    // texto ilegible sobre fondo oscuro.
    const valores = Object.values(EMAIL).map((v) => v.toLowerCase());
    expect(valores.filter((v) => v === "#ffffff" || v === "#000000")).toEqual([]);
  });

  it("declara el esquema oscuro, no el claro", () => {
    expect(META_ESQUEMA_COLOR).toContain('content="dark"');
    expect(META_ESQUEMA_COLOR).toContain("supported-color-schemes");
  });
});

describe("#18 — la lista de plantillas no se queda corta", () => {
  it("no hay ninguna plantilla de email fuera de la lista", () => {
    // El fallo que este guard previene: alguien añade un email nuevo, lo pinta
    // a mano, y el test sigue verde porque solo mira los dos de siempre.
    //
    // La primera versión exigía que el MISMO archivo armara el HTML y enviara
    // el correo, y ya había un caso en el repo que se colaba por tener las dos
    // mitades separadas: `formulario-de-inicio.ts` envía y `lib/intakeEmail.ts`
    // construye, así que ninguno de los dos disparaba nada. Ahora basta con
    // armar HTML de email, que en un `.ts` de este repo no tiene otro uso.
    const sospechosas: string[] = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(path.join(process.cwd(), dir), { withFileTypes: true })) {
        const rel = `${dir}/${e.name}`;
        if (e.isDirectory()) walk(rel);
        else if (/\.ts$/.test(e.name) && !rel.includes("__tests__")) {
          if (armaHtmlDeEmail(rel) && !PLANTILLAS.includes(rel) && !EXCLUIDAS.has(rel)) {
            sospechosas.push(rel);
          }
        }
      }
    };
    walk("src");
    expect(sospechosas).toEqual([]);
  });

  it("el detector ve de verdad el archivo que se colaba", () => {
    // La prueba de que la cobertura existe, no solo de que la lista está bien.
    // Si alguien vuelve a exigir que el mismo archivo envíe el correo, este
    // test cae — mientras que el anterior seguiría verde, porque `intakeEmail`
    // está excluido y no hay nada más que encontrar.
    expect(armaHtmlDeEmail("src/lib/intakeEmail.ts")).toBe(true);
    // Y no marca cualquier cosa: un módulo sin HTML no es una plantilla.
    expect(armaHtmlDeEmail("src/lib/email/palette.ts")).toBe(false);
  });

  it("las exclusiones siguen existiendo y siguen armando HTML", () => {
    // Una exclusión que apunta a un archivo borrado o ya migrado se queda ahí
    // dando permiso a nada. Misma regla que el trinquete de los `hover`
    // inertes: la lista solo puede encoger.
    for (const [f, motivo] of EXCLUIDAS) {
      expect({ f, existe: fs.existsSync(path.join(process.cwd(), f)) }).toEqual({ f, existe: true });
      expect({ f, sigueConHex: /#[0-9a-fA-F]{6}/.test(leer(f)) }).toEqual({ f, sigueConHex: true });
      expect(motivo.length).toBeGreaterThan(10);
    }
  });
});
