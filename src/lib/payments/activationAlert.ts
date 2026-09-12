import { sendTelegramMessage } from "@/lib/telegram";

/**
 * Aviso inmediato cuando un pago se cobró pero NO se pudo activar premium.
 *
 * Es el peor fallo posible del sistema: el dinero ya salió de la cuenta del
 * usuario y el producto no llega. Antes esto solo dejaba una línea en los logs
 * de Vercel, que nadie mira, y el webhook respondía 200 igual — así que la
 * pasarela no reintentaba y el caso desaparecía sin rastro (issue #13).
 *
 * El aviso NUNCA debe impedir la respuesta del webhook: si Telegram falla, se
 * traga el error. Lo que garantiza el reintento es el código de estado que
 * devuelve el endpoint, no este mensaje.
 */
export async function alertarActivacionFallida(datos: {
  proveedor: "MercadoPago" | "Stripe";
  paymentId: string;
  userId: string;
  userEmail?: string | null;
  error: unknown;
  /**
   * Qué se estaba haciendo. Por defecto, activar premium tras un cobro — pero
   * la misma escritura también revoca al cancelar una suscripción, y anunciar
   * "pago cobrado" ahí sería falso.
   */
  accion?: "activar" | "actualizar-suscripcion";
}): Promise<void> {
  const detalle = datos.error instanceof Error ? datos.error.message : String(datos.error ?? "desconocido");

  const mensaje = [
    datos.accion === "actualizar-suscripcion"
      ? "🚨 <b>ESTADO DE SUSCRIPCIÓN SIN APLICAR</b>"
      : "🚨 <b>PAGO COBRADO SIN PREMIUM ACTIVADO</b>",
    "",
    `<b>Proveedor:</b> ${datos.proveedor}`,
    `<b>Pago:</b> ${datos.paymentId}`,
    `<b>Usuario:</b> ${datos.userId}`,
    datos.userEmail ? `<b>Email:</b> ${datos.userEmail}` : null,
    `<b>Fallo:</b> ${detalle.slice(0, 300)}`,
    "",
    "El webhook devolvió 500 para que la pasarela reintente. Si tras varios",
    "reintentos sigue fallando, hay que activarlo a mano desde el panel.",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    await sendTelegramMessage(mensaje);
  } catch (err) {
    console.error("❌ No se pudo avisar del fallo de activación por Telegram:", err);
  }
}
