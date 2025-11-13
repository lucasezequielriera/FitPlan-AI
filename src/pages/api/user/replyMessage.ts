import type { NextApiRequest, NextApiResponse } from "next";
import { getAdminDb } from "@/lib/firebase-admin";

/**
 * API para que usuarios respondan a sus mensajes
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const db = getAdminDb();
    if (!db) {
      return res.status(500).json({ error: "Firebase Admin SDK no configurado" });
    }

    const { userId, messageId, reply, userName } = req.body;

    if (!userId || !messageId || !reply) {
      return res.status(400).json({ error: "Faltan userId, messageId o reply" });
    }

    // Verificar que el mensaje pertenece al usuario
    const messageRef = db.collection("mensajes").doc(messageId);
    const messageDoc = await messageRef.get();
    
    if (!messageDoc.exists) {
      return res.status(404).json({ error: "Mensaje no encontrado" });
    }

    const messageData = messageDoc.data();
    if (messageData?.userId !== userId) {
      return res.status(403).json({ error: "No tienes permiso para este mensaje" });
    }

    // Obtener respuestas existentes
    const existingReplies = messageData?.replies || [];
    
    // Capitalizar nombre del usuario
    const formattedUserName = userName 
      ? userName.charAt(0).toUpperCase() + userName.slice(1).toLowerCase()
      : "Usuario";

    // Crear nueva respuesta del usuario
    const newReply = {
      message: String(reply),
      senderName: formattedUserName,
      senderType: "user",
      createdAt: new Date(),
    };
    
    // Agregar respuesta al array
    const updatedReplies = [...existingReplies, newReply];

    // Actualizar mensaje con nueva respuesta
    await messageRef.update({
      replies: updatedReplies,
      lastReplyAt: new Date(),
      updatedAt: new Date(),
    });

    return res.status(200).json({ message: "Respuesta enviada exitosamente" });
  } catch (error) {
    console.error("Error al responder mensaje:", error);
    return res.status(500).json({ 
      error: "Error al responder mensaje",
      detail: error instanceof Error ? error.message : String(error)
    });
  }
}

