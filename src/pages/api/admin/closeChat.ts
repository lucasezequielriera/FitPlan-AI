import type { NextApiRequest, NextApiResponse } from "next";
import { getAdminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireAdmin } from "@/lib/adminAuthServer";

/**
 * API para que el admin finalice un chat
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

    const { messageId } = req.body;

    if (!messageId) {
      return res.status(400).json({ error: "Falta messageId" });
    }

    // Verificar que el mensaje existe
    const messageRef = db.collection("mensajes").doc(messageId);
    const messageDoc = await messageRef.get();

    if (!messageDoc.exists) {
      return res.status(404).json({ error: "Mensaje no encontrado" });
    }

    // Marcar el chat como finalizado
    await messageRef.update({
      closed: true,
      closedAt: FieldValue.serverTimestamp(),
      closedBy: auth.uid,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return res.status(200).json({ message: "Chat finalizado exitosamente" });
  } catch (error) {
    console.error("Error al finalizar chat:", error);
    return res.status(500).json({ 
      error: "Error al finalizar chat",
      detail: error instanceof Error ? error.message : String(error)
    });
  }
}

