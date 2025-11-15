/**
 * Método alternativo para obtener Chat ID
 * 
 * Instrucciones:
 * 1. Envía CUALQUIER mensaje a @fitplan_ai_bot (no importa si responde o no)
 * 2. Ejecuta: node scripts/get-chat-id-direct.js
 * 3. Si no funciona, espera 1-2 minutos y vuelve a intentar
 */

const BOT_TOKEN = "8580489521:AAEjCA8bwe6jySokivSWPolCbEn2lHhrQiI";

async function getChatId() {
  console.log("🔍 Buscando tu Chat ID...\n");
  
  try {
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?offset=-1&limit=1`);
    const data = await response.json();
    
    if (!data.ok) {
      console.error("❌ Error de la API:", data.description);
      if (data.error_code === 401) {
        console.error("⚠️ El token del bot es inválido");
      }
      return;
    }
    
    if (data.result && data.result.length > 0) {
      const update = data.result[0];
      const chatId = update.message?.chat?.id;
      const chatType = update.message?.chat?.type;
      const firstName = update.message?.chat?.first_name || "Usuario";
      
      if (chatId) {
        console.log("✅ ¡Chat ID encontrado!\n");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log(`👤 Nombre: ${firstName}`);
        console.log(`💬 Tipo: ${chatType}`);
        console.log(`🆔 Chat ID: ${chatId}`);
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
        console.log("📝 Agrega estas variables a tu .env.local:\n");
        console.log(`TELEGRAM_BOT_TOKEN=8580489521:AAEjCA8bwe6jySokivSWPolCbEn2lHhrQiI`);
        console.log(`TELEGRAM_CHAT_ID=${chatId}\n`);
        console.log("📝 Y también en Vercel (Settings → Environment Variables):\n");
        console.log(`TELEGRAM_BOT_TOKEN=8580489521:AAEjCA8bwe6jySokivSWPolCbEn2lHhrQiI`);
        console.log(`TELEGRAM_CHAT_ID=${chatId}`);
        console.log(`NEXT_PUBLIC_BASE_URL=https://www.fitplan-ai.com\n`);
      } else {
        console.log("⚠️ No se encontró Chat ID en el mensaje");
      }
    } else {
      console.log("⚠️ No se encontraron mensajes.\n");
      console.log("📱 Por favor:");
      console.log("   1. Abre Telegram");
      console.log("   2. Busca @fitplan_ai_bot");
      console.log("   3. Envía CUALQUIER mensaje (ej: 'Hola', '/start', 'test')");
      console.log("   4. NO importa si el bot responde o no");
      console.log("   5. Espera 5-10 segundos");
      console.log("   6. Ejecuta este script nuevamente\n");
    }
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

getChatId();

