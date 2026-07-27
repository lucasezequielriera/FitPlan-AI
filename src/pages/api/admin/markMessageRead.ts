import type { NextApiRequest, NextApiResponse } from "next";
import { getAdminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireAdmin } from "@/lib/adminAuthServer";

/**
 * API para marcar mensaje como leído (solo admin)
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

    // Marcar mensaje como leído
    await db.collection("mensajes").doc(messageId).update({
      read: true,
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

