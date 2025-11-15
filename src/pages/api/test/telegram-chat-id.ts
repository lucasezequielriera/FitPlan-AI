import type { NextApiRequest, NextApiResponse } from "next";

/**
 * Endpoint temporal para obtener el Chat ID de Telegram
 * 
 * Uso:
 * 1. Envía un mensaje a @fitplan_ai_bot
 * 2. Visita: http://localhost:3000/api/test/telegram-chat-id
 * 3. Verás tu Chat ID
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const BOT_TOKEN = "8580489521:AAEjCA8bwe6jySokivSWPolCbEn2lHhrQiI";

  try {
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getUpdates`);
    const data = await response.json();

    if (!data.ok) {
      return res.status(400).json({
        error: "Error de la API de Telegram",
        description: data.description,
        ok: false,
      });
    }

    if (data.result && data.result.length > 0) {
      // Obtener el último mensaje
      const lastUpdate = data.result[data.result.length - 1];
      const chatId = lastUpdate.message?.chat?.id;
      const firstName = lastUpdate.message?.chat?.first_name || "Usuario";
      const chatType = lastUpdate.message?.chat?.type;

      if (chatId) {
        return res.status(200).json({
          success: true,
          chatId: chatId,
          userInfo: {
            firstName,
            chatType,
          },
          instructions: {
            local: `Agrega a tu .env.local:\nTELEGRAM_BOT_TOKEN=8580489521:AAEjCA8bwe6jySokivSWPolCbEn2lHhrQiI\nTELEGRAM_CHAT_ID=${chatId}`,
            vercel: `Agrega en Vercel (Settings → Environment Variables):\nTELEGRAM_BOT_TOKEN=8580489521:AAEjCA8bwe6jySokivSWPolCbEn2lHhrQiI\nTELEGRAM_CHAT_ID=${chatId}\nNEXT_PUBLIC_BASE_URL=https://www.fitplan-ai.com`,
          },
        });
      }
    }

    return res.status(200).json({
      success: false,
      message: "No se encontraron mensajes",
      instructions: [
        "1. Abre Telegram",
        "2. Busca @fitplan_ai_bot",
        "3. Envía CUALQUIER mensaje (ej: 'Hola', '/start', 'test')",
        "4. NO importa si el bot responde o no",
        "5. Espera 5-10 segundos",
        "6. Recarga esta página",
      ],
    });
  } catch (error) {
    return res.status(500).json({
      error: "Error al obtener Chat ID",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

