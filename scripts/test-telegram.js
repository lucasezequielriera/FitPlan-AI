/**
 * Script para probar las notificaciones de Telegram
 */

const BOT_TOKEN = "8580489521:AAEjCA8bwe6jySokivSWPolCbEn2lHhrQiI";
const CHAT_ID = "8061894989";

async function testTelegram() {
  console.log("🧪 Probando conexión con Telegram...\n");
  
  try {
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: "✅ ¡Prueba exitosa! Las notificaciones de FitPlan AI están funcionando correctamente.",
        parse_mode: "HTML",
      }),
    });

    const data = await response.json();

    if (data.ok) {
      console.log("✅ ¡Mensaje enviado exitosamente!");
      console.log("📱 Revisa tu Telegram, deberías haber recibido un mensaje de prueba.\n");
      return true;
    } else {
      console.error("❌ Error:", data.description);
      return false;
    }
  } catch (error) {
    console.error("❌ Error al enviar mensaje:", error.message);
    return false;
  }
}

testTelegram();

