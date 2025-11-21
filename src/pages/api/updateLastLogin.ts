import type { NextApiRequest, NextApiResponse } from "next";
import { getAdminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

/**
 * API para actualizar la última vez que el usuario se conectó
 * Se llama automáticamente cuando el usuario accede a la app
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { userId } = req.body;

    if (!userId || typeof userId !== "string") {
      return res.status(400).json({ error: "userId es requerido" });
    }

    const db = getAdminDb();
    if (!db) {
      return res.status(500).json({ error: "Firebase Admin SDK no configurado" });
    }

    const userRef = db.collection("usuarios").doc(userId);

    // Verificar que el documento existe
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    // Actualizar lastLogin usando Admin SDK
    await userRef.update({
      lastLogin: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    console.log(`✅ lastLogin actualizado para usuario ${userId}`);
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error al actualizar lastLogin:", error);
    return res.status(500).json({ 
      error: "Error al actualizar última conexión",
      detail: error instanceof Error ? error.message : String(error)
    });
  }
}

