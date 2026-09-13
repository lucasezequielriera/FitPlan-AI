/**
 * Paleta "Volt" para email (issue #18).
 *
 * Los emails eran la última superficie del producto con la paleta anterior
 * —navy `#0b1220` con acentos cian y teal— y es la que llega a la bandeja de un
 * cliente real, así que se ve aunque nunca abra la app.
 *
 * No se pueden usar los tokens de `globals.css`: los clientes de correo no
 * soportan variables CSS ni hojas externas, así que todo va en hex literal
 * inline. Tampoco vale `color-mix()`, que es como la app define sus superficies.
 *
 * Por eso estos valores viven aquí y no se escriben en cada plantilla: son dos
 * plantillas hoy y serán más, y colores repetidos a mano en varios archivos es
 * exactamente cómo la app acabó con tres paletas conviviendo.
 *
 * Decisión de `diseno` (2026-09-13). Los valores literales de token salen de
 * `globals.css`; las superficies son aproximaciones deliberadas, porque el
 * `color-mix` real da separaciones que en una pantalla al sol se pierden.
 */
export const EMAIL = {
  /** `--background`. */
  fondo: "#08090c",
  /** Aproximación de `--surface`, subida respecto al 4% real: en un email no
   *  hay superficies vecinas con las que comparar, así que necesita más
   *  separación para leerse como caja. */
  caja: "#14161c",
  /** Aproximación de `--border-strong`. */
  borde: "#2c2f36",
  /** `--foreground`. Nunca `#ffffff` puro: Outlook lo fuerza a oscuro en su
   *  modo oscuro y deja texto ilegible sobre fondo oscuro. */
  texto: "#f5f7f2",
  /** Aproximación de `--text-muted`. 9,25:1 sobre el fondo, 8,40:1 sobre caja. */
  textoSuave: "#aeb2ab",
  /** `--accent`. Solo titular y fondo de botón; nunca párrafo largo ni borde. */
  acento: "#cbff3d",
  /** `--accent-strong`. Distingue el enlace del titular sin inventar un tono:
   *  en un email no hay hover que "gaste" ese valor. */
  enlace: "#a6e600",
  /** `--accent-ink`. El texto sobre lima NUNCA es blanco. */
  sobreAcento: "#0a0f05",
  /** `--info`. La caja de consejo del resumen semanal era teal decorativo;
   *  es un tip, que es la definición de `--info` en DESIGN_SYSTEM.md §1. */
  info: "#06b6d4",
} as const;

/**
 * Cabecera obligatoria de todo email.
 *
 * Sin esto, los motores de modo oscuro (Outlook.com es el más agresivo)
 * reinvierten un diseño ya oscuro y lo dejan peor de lo que estaba. Declararlo
 * es lo que hace que lo lean como intencional y no lo toquen.
 */
export const META_ESQUEMA_COLOR =
  '<meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark">';

/** Botón de acción. Es la única forma en que el lima puede ser fondo. */
export function botonEmail(href: string, texto: string): string {
  return `<a href="${href}" style="display:inline-block;background:${EMAIL.acento};color:${EMAIL.sobreAcento};text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:10px">${texto}</a>`;
}

/** Enlace de texto. Siempre subrayado: varios clientes fuerzan el azul por
 *  defecto si el enlace no declara `text-decoration`. */
export function enlaceEmail(href: string, texto: string): string {
  return `<a href="${href}" style="color:${EMAIL.enlace};text-decoration:underline">${texto}</a>`;
}
