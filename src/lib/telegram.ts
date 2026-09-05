/**
 * Utilidades para enviar notificaciones a Telegram
 */

interface TelegramMessage {
  chat_id: string;
  text: string;
  parse_mode?: "HTML" | "Markdown";
}

/**
 * Envía un mensaje a Telegram
 * @param message - El mensaje a enviar
 * @returns Promise<boolean> - true si se envió correctamente, false en caso contrario
 */
export async function sendTelegramMessage(message: string): Promise<boolean> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    console.warn("⚠️ Telegram no configurado: TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID no están definidos");
    return false;
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: "HTML",
      } as TelegramMessage),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("❌ Error al enviar mensaje a Telegram:", errorData);
      return false;
    }

    return true;
  } catch (error) {
    console.error("❌ Error al enviar mensaje a Telegram:", error);
    return false;
  }
}

/**
 * Formatea un mensaje para notificación de nuevo usuario
 */
export function formatNewUserMessage(userData: {
  nombre?: string | null;
  email?: string | null;
  createdAt?: string | Date;
  ciudad?: string | null;
  pais?: string | null;
}): string {
  const nombre = userData.nombre || "Sin nombre";
  const email = userData.email || "Sin email";
  const fecha = userData.createdAt 
    ? new Date(userData.createdAt).toLocaleString('es-AR', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : "Fecha no disponible";
  const ubicacion = userData.ciudad && userData.pais 
    ? `${userData.ciudad}, ${userData.pais}`
    : userData.pais || userData.ciudad || "Ubicación no disponible";

  return `🆕 <b>Nuevo Usuario Registrado</b>

👤 <b>Nombre:</b> ${nombre}
📧 <b>Email:</b> ${email}
📍 <b>Ubicación:</b> ${ubicacion}
📅 <b>Fecha:</b> ${fecha}`;
}

/**
 * Formatea un mensaje para notificación de pago
 */
export function formatPaymentMessage(paymentData: {
  nombre?: string | null;
  email?: string | null;
  amount: number;
  currency?: string;
  planType: string;
  paymentMethod: string;
  paymentId?: string;
  date?: string | Date;
}): string {
  const nombre = paymentData.nombre || "Sin nombre";
  const email = paymentData.email || "Sin email";
  const monto = paymentData.amount.toLocaleString('es-AR');
  const moneda = paymentData.currency || "ARS";
  // El importe se toma del pago real, no de una tabla escrita a mano: antes
  // decía "€5 EUR / $10.000 ARS" fijo y reportaba mal en cuanto cambiaba un
  // precio o se movía la cotización EUR→ARS.
  const planNombre =
    paymentData.planType === "monthly" ? "Mensual" : paymentData.planType === "quarterly" ? "Trimestral" : "Anual";
  const planType = `${planNombre} (${monto} ${moneda})`;
  const metodo = paymentData.paymentMethod === "mercadopago"
    ? "💳 MercadoPago"
    : paymentData.paymentMethod === "stripe"
    ? "💳 Stripe"
    : paymentData.paymentMethod === "transferencia"
    ? "🏦 Transferencia"
    : paymentData.paymentMethod === "efectivo"
    ? "💵 Efectivo"
    : "📝 Otro";
  const fecha = paymentData.date
    ? new Date(paymentData.date).toLocaleString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : new Date().toLocaleString('es-AR');
  const paymentId = paymentData.paymentId ? `\n🆔 <b>ID de Pago:</b> ${paymentData.paymentId}` : "";

  const simboloMoneda = moneda === "EUR" ? "€" : "$";
  
  return `💰 <b>Nuevo Pago Recibido</b>

👤 <b>Usuario:</b> ${nombre}
📧 <b>Email:</b> ${email}
💵 <b>Monto:</b> ${simboloMoneda}${monto} ${moneda}
📦 <b>Plan:</b> ${planType}
${metodo}
📅 <b>Fecha:</b> ${fecha}${paymentId}`;
}

