/**
 * Script para probar las notificaciones de Telegram directamente
 */

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "8580489521:AAEjCA8bwe6jySokivSWPolCbEn2lHhrQiI";
const CHAT_ID = process.env.TELEGRAM_CHAT_ID || "8061894989";

async function testNotification() {
  console.log("🧪 Probando notificación de nuevo usuario...\n");
  console.log(`Bot Token: ${BOT_TOKEN.substring(0, 20)}...`);
  console.log(`Chat ID: ${CHAT_ID}\n`);
  
  const testMessage = `🆕 <b>Nuevo Usuario Registrado</b>

👤 <b>Nombre:</b> Usuario de Prueba
📧 <b>Email:</b> test@example.com
📍 <b>Ubicación:</b> Buenos Aires, Argentina
📅 <b>Fecha:</b> ${new Date().toLocaleString('es-AR')}`;

  try {
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: testMessage,
        parse_mode: "HTML",
      }),
    });

    const data = await response.json();

    if (data.ok) {
      console.log("✅ ¡Notificación enviada exitosamente!");
      console.log("📱 Revisa tu Telegram, deberías haber recibido un mensaje de prueba.\n");
      return true;
    } else {
      console.error("❌ Error:", data.description);
      if (data.error_code === 401) {
        console.error("⚠️ El token del bot es inválido");
      } else if (data.error_code === 400) {
        console.error("⚠️ El Chat ID puede ser incorrecto o el bot no tiene acceso");
      }
      return false;
    }
  } catch (error) {
    console.error("❌ Error al enviar mensaje:", error.message);
    return false;
  }
}

testNotification();

