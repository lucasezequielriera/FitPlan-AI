/**
 * Escapado de HTML para emails.
 *
 * Vivía como función privada dentro de `intakeEmail.ts`, así que las dos
 * plantillas escritas después no la tenían a mano y interpolaban datos de
 * terceros en crudo: el nombre que la persona escribe en el formulario de
 * intake, su objetivo, el texto del resumen semanal.
 *
 * El riesgo real es acotado —el correo va a la propia persona que escribió el
 * dato— pero un nombre con `<` o `>` rompe el mensaje, y un correo roto no se
 * puede corregir después de enviarlo. No hay motivo para no escaparlo.
 *
 * Que fuera privada es lo que hizo que se perdiera. Ahora es compartida.
 */
export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
