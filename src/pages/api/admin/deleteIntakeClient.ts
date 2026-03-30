import type { NextApiRequest, NextApiResponse } from "next";
import { getAdminDb } from "@/lib/firebase-admin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "DELETE") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { userId, clientId } = req.body as { userId?: string; clientId?: string };
  if (!userId || !clientId) {
    return res.status(400).json({ error: "Faltan datos requeridos: userId y clientId" });
  }

  try {
    const db = getAdminDb();
    if (!db) {
      return res.status(500).json({ error: "Firebase Admin SDK no configurado" });
    }

    const adminDoc = await db.collection("usuarios").doc(userId).get();
    const email = adminDoc.data()?.email?.toLowerCase() || "";
    if (!adminDoc.exists || email !== "admin@fitplan-ai.com") {
      return res.status(403).json({ error: "Solo administradores pueden eliminar clientes" });
    }

    const targetRef = db.collection("intakeClients").doc(clientId);
    const targetDoc = await targetRef.get();
    if (!targetDoc.exists) {
      return res.status(404).json({ error: "Cliente no encontrado" });
    }

    await targetRef.delete();
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Error eliminando cliente de intake:", error);
    return res.status(500).json({ error: "No se pudo eliminar el cliente" });
  }
}

