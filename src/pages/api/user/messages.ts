import type { NextApiRequest, NextApiResponse } from "next";
import { getAdminDb } from "@/lib/firebase-admin";

/**
 * API para que usuarios obtengan sus mensajes
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const db = getAdminDb();
    if (!db) {
      return res.status(500).json({ error: "Firebase Admin SDK no configurado" });
    }

    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: "Falta userId" });
    }

    // Obtener todos los mensajes del usuario
    // Nota: No usamos orderBy aquí porque requiere un índice compuesto con where
    // En su lugar, ordenamos en memoria después
    const messagesSnapshot = await db.collection("mensajes")
      .where("userId", "==", userId as string)
      .get();

    const convertTimestamp = (timestamp: unknown): string | null => {
      if (!timestamp) return null;
      try {
        if (timestamp && typeof timestamp === 'object' && 'toDate' in timestamp && typeof timestamp.toDate === 'function') {
          return (timestamp as { toDate: () => Date }).toDate().toISOString();
        }
        if (timestamp && typeof timestamp === 'object' && 'seconds' in timestamp) {
          const ts = timestamp as { seconds: number; nanoseconds?: number };
          return new Date(ts.seconds * 1000 + (ts.nanoseconds || 0) / 1000000).toISOString();
        }
      } catch (error) {
        console.error("Error al convertir timestamp:", error);
      }
      return null;
    };

    const messages = messagesSnapshot.docs.map(doc => {
      const data = doc.data();
      const replies = data.replies || [];
      return {
        id: doc.id,
        subject: data.subject || "Consulta",
        message: data.message || "",
        userName: data.userName || null, // Nombre del usuario que envió el mensaje
        replied: data.replied === true,
        replies: replies.map((reply: { message?: string; senderName?: string; senderType?: string; createdAt?: unknown }) => ({
          message: reply.message || "",
          senderName: reply.senderName || "Equipo de FitPlan",
          senderType: reply.senderType || "admin",
          createdAt: convertTimestamp(reply.createdAt),
        })),
        createdAt: convertTimestamp(data.createdAt),
        lastReplyAt: convertTimestamp(data.lastReplyAt),
        userRead: data.userRead !== false, // Si no existe, asumir que está leído
      };
    });

    // Ordenar por fecha de creación (más recientes primero) en memoria
    messages.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA; // Orden descendente
    });

    // Limitar a 50 mensajes más recientes
    const limitedMessages = messages.slice(0, 50);

    // Contar mensajes con respuestas no leídas
    const unreadRepliesCount = limitedMessages.filter(m => m.replied && !m.userRead).length;

    return res.status(200).json({
      messages: limitedMessages,
      unreadRepliesCount,
    });
  } catch (error) {
    console.error("Error al obtener mensajes del usuario:", error);
    return res.status(500).json({ 
      error: "Error al obtener mensajes",
      detail: error instanceof Error ? error.message : String(error)
    });
  }
}

