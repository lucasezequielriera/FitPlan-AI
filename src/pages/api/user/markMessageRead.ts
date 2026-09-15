import type { NextApiRequest, NextApiResponse } from "next";
import { getAdminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireUser } from "@/lib/userAuthServer";

/**
 * API para marcar mensaje como leído por el usuario
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

  // La identidad sale del ID token verificado, NUNCA del cuerpo (issue #27).
    const auth = await requireUser(req);
    if (!auth.ok) return res.status(auth.status).json({ error: "Identidad no verificada" });
    const userId = auth.uid;

    const { messageId } = req.body;

    if (!userId || !messageId) {
      return res.status(400).json({ error: "Faltan userId o messageId" });
    }

    // Verificar que el mensaje pertenece al usuario
    const messageRef = db.collection("mensajes").doc(messageId);
    const messageDoc = await messageRef.get();
    
    if (!messageDoc.exists) {
      return res.status(404).json({ error: "Mensaje no encontrado" });
    }

    const messageData = messageDoc.data();
    if (messageData?.userId !== userId) {
      return res.status(403).json({ error: "Sin permiso para este mensaje" });
    }

    // Marcar como leído por el usuario
    await messageRef.update({
      userRead: true,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return res.status(200).json({ message: "Mensaje marcado como leído" });
  } catch (error) {
    console.error("Error al marcar mensaje como leído:", error);
    return res.status(500).json({ 
      error: "Error al marcar mensaje como leído",
      detail: error instanceof Error ? error.message : String(error)
    });
  }
}

