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
  /** El sujeto del cobro: un UID de usuario, o un id de `intakeClients` en B2B. */
  userId: string;
  userEmail?: string | null;
  error: unknown;
  /**
   * Qué se estaba haciendo. Por defecto, activar premium tras un cobro — pero
   * la misma escritura también revoca al cancelar una suscripción, y anunciar
   * "pago cobrado" ahí sería falso.
   *
   * `registrar-cobro-b2b` es el flujo de captación (#42): ahí no hay premium ni
   * usuario, sino una ficha de `intakeClients`. Decir "Usuario" y "premium" en
   * ese aviso mandaría a Lucas a buscar al sitio equivocado.
   */
  accion?: "activar" | "actualizar-suscripcion" | "registrar-cobro-b2b";
}): Promise<void> {
  const detalle = datos.error instanceof Error ? datos.error.message : String(datos.error ?? "desconocido");

  const titulo =
    datos.accion === "actualizar-suscripcion"
      ? "🚨 <b>ESTADO DE SUSCRIPCIÓN SIN APLICAR</b>"
      : datos.accion === "registrar-cobro-b2b"
        ? "🚨 <b>COBRO DE CLIENTE B2B SIN REGISTRAR</b>"
        : "🚨 <b>PAGO COBRADO SIN PREMIUM ACTIVADO</b>";

  const esB2B = datos.accion === "registrar-cobro-b2b";

  const mensaje = [
    titulo,
    "",
    `<b>Proveedor:</b> ${datos.proveedor}`,
    `<b>Pago:</b> ${datos.paymentId}`,
    `<b>${esB2B ? "Cliente" : "Usuario"}:</b> ${datos.userId}`,
    datos.userEmail ? `<b>Email:</b> ${datos.userEmail}` : null,
    `<b>Fallo:</b> ${detalle.slice(0, 300)}`,
    "",
    "El webhook devolvió 500 para que la pasarela reintente. Si tras varios",
    esB2B
      ? "reintentos sigue fallando, hay que marcarlo como pagado a mano en el panel."
      : "reintentos sigue fallando, hay que activarlo a mano desde el panel.",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    await sendTelegramMessage(mensaje);
  } catch (err) {
    console.error("❌ No se pudo avisar del fallo de activación por Telegram:", err);
  }
}
