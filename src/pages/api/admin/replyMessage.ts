import type { NextApiRequest, NextApiResponse } from "next";
import { getAdminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireAdmin } from "@/lib/adminAuthServer";

/**
 * API para responder mensajes (solo admin)
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) {
      return res.status(auth.status).json({ error: auth.error });
    }

    const db = getAdminDb();
    if (!db) {
      return res.status(500).json({ error: "Firebase Admin SDK no configurado" });
    }

    const { messageId, reply } = req.body;

    if (!messageId || !reply) {
      return res.status(400).json({ error: "Faltan messageId o reply" });
    }

    const adminName = "Equipo de FitPlan"; // Nombre fijo para admin

    // Obtener el mensaje actual para agregar la respuesta al array
    const messageRef = db.collection("mensajes").doc(messageId);
    const messageDoc = await messageRef.get();
    
    if (!messageDoc.exists) {
      return res.status(404).json({ error: "Mensaje no encontrado" });
    }

    const currentData = messageDoc.data();
    if (!currentData) {
      return res.status(404).json({ error: "Datos del mensaje no encontrados" });
    }

    // Verificar si el chat está cerrado
    if (currentData.closed === true) {
      return res.status(403).json({ error: "Este chat ha sido finalizado. No se pueden enviar más mensajes." });
    }

    // Obtener respuestas existentes, asegurándonos de que sea un array
    // Manejar tanto el formato antiguo (reply) como el nuevo (replies)
    let existingReplies: Array<{ message: string; senderName?: string; senderType?: string; createdAt?: unknown }> = [];
    
    if (Array.isArray(currentData.replies)) {
      // Formato nuevo: array de respuestas
      existingReplies = currentData.replies;
    } else if (currentData.reply && typeof currentData.reply === 'string') {
      // Formato antiguo: una sola respuesta como string
      // Convertir a formato nuevo
      console.log("⚠️ Mensaje con formato antiguo (reply), migrando a formato nuevo...");
      existingReplies = [{
        message: currentData.reply,
        senderName: "Equipo de FitPlan",
        senderType: "admin",
        createdAt: currentData.repliedAt || currentData.updatedAt || null,
      }];
    } else if (currentData.replies && typeof currentData.replies === 'object') {
      // Si es un objeto pero no array, intentar convertirlo
      console.warn("⚠️ replies es un objeto, convirtiendo a array...");
      existingReplies = [currentData.replies];
    }
    
    // Crear nueva respuesta con timestamp
    // Nota: No podemos usar FieldValue.serverTimestamp() dentro de un array
    // Usamos Date en lugar de FieldValue.serverTimestamp()
    const newReply = {
      message: String(reply),
      senderName: adminName,
      senderType: "admin",
      createdAt: new Date(), // Usar Date en lugar de FieldValue.serverTimestamp()
    };
    
    // Crear nuevo array con la respuesta agregada
    const updatedReplies = [...existingReplies, newReply];

    console.log("📝 Agregando respuesta al mensaje:", {
      messageId,
      existingRepliesCount: existingReplies.length,
      newReplyMessage: reply.substring(0, 50) + "...",
    });

    // Actualizar mensaje con nueva respuesta
    await messageRef.update({
      replied: true,
      replies: updatedReplies,
      lastReplyAt: FieldValue.serverTimestamp(),
      read: true,
      userRead: false, // Marcar que el usuario no ha leído la nueva respuesta
      updatedAt: FieldValue.serverTimestamp(),
    });

    console.log("✅ Respuesta agregada exitosamente");

    return res.status(200).json({ message: "Respuesta enviada exitosamente" });
  } catch (error) {
    console.error("Error al responder mensaje:", error);
    return res.status(500).json({ 
      error: "Error al responder mensaje",
      detail: error instanceof Error ? error.message : String(error)
    });
  }
}

