import type { NextApiRequest, NextApiResponse } from "next";
import { getAdminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

/**
 * API para enviar mensajes de usuarios al admin
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

    const { userId, userName, userEmail, message, subject } = req.body;

    if (!userId || !message) {
      return res.status(400).json({ error: "Faltan datos requeridos: userId y message" });
    }

    // Guardar mensaje en la colección mensajes
    const messageData = {
      userId,
      userName: userName || null,
      userEmail: userEmail || null,
      subject: subject || "Consulta",
      message,
      read: false,
      replied: false,
      replies: [], // Array de respuestas del admin
      userRead: true, // El usuario ya leyó su propio mensaje
      createdAt: FieldValue.serverTimestamp(),
      lastReplyAt: null,
    };

    const messageRef = await db.collection("mensajes").add(messageData);

    return res.status(200).json({ 
      message: "Mensaje enviado exitosamente",
      id: messageRef.id
    });
  } catch (error) {
    console.error("Error al enviar mensaje:", error);
    return res.status(500).json({ 
      error: "Error al enviar mensaje",
      detail: error instanceof Error ? error.message : String(error)
    });
  }
}

