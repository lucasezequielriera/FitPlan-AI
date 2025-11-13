import type { NextApiRequest, NextApiResponse } from "next";
import { getAdminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

/**
 * API para marcar mensaje como leído (solo admin)
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

    const { adminUserId, messageId } = req.body;

    if (!adminUserId || !messageId) {
      return res.status(400).json({ error: "Faltan adminUserId o messageId" });
    }

    // Verificar que el usuario es administrador
    const adminUserRef = db.collection("usuarios").doc(adminUserId);
    const adminUserDoc = await adminUserRef.get();
    
    if (!adminUserDoc.exists) {
      return res.status(403).json({ error: "Admin no encontrado" });
    }

    const adminUserData = adminUserDoc.data();
    const email = adminUserData?.email?.toLowerCase() || "";
    const isAdmin = email === "admin@fitplan-ai.com";

    if (!isAdmin) {
      return res.status(403).json({ error: "Solo administradores pueden acceder" });
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

