/**
 * Script para obtener el Chat ID de Telegram
 * 
 * Instrucciones:
 * 1. Inicia una conversación con tu bot en Telegram (@fitplan_ai_bot)
 * 2. Envía cualquier mensaje (ej: /start)
 * 3. Ejecuta este script: node scripts/get-telegram-chat-id.js
 */

const BOT_TOKEN = "8580489521:AAEjCA8bwe6jySokivSWPolCbEn2lHhrQiI";

async function getChatId() {
  try {
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getUpdates`);
    const data = await response.json();
    
    if (!data.ok) {
      console.error("❌ Error:", data.description);
      return;
    }
    
    if (data.result && data.result.length > 0) {
      // Obtener el último mensaje
      const lastUpdate = data.result[data.result.length - 1];
      const chatId = lastUpdate.message?.chat?.id;
      
      if (chatId) {
        console.log("\n✅ Chat ID encontrado:");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log(`TELEGRAM_CHAT_ID=${chatId}`);
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
        console.log("Agrega esta variable a tu .env.local y a Vercel:\n");
        console.log(`TELEGRAM_BOT_TOKEN=${BOT_TOKEN}`);
        console.log(`TELEGRAM_CHAT_ID=${chatId}\n`);
      } else {
        console.log("⚠️ No se encontró Chat ID. Asegúrate de haber enviado un mensaje al bot primero.");
      }
    } else {
      console.log("⚠️ No hay mensajes. Por favor:");
      console.log("1. Abre Telegram");
      console.log("2. Busca @fitplan_ai_bot");
      console.log("3. Inicia conversación y envía /start");
      console.log("4. Ejecuta este script nuevamente");
    }
  } catch (error) {
    console.error("❌ Error al obtener Chat ID:", error.message);
  }
}

getChatId();

