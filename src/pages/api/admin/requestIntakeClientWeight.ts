import type { NextApiRequest, NextApiResponse } from "next";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";

type Body = {
  adminUserId?: string;
  intakeClientId?: string;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const body = (req.body || {}) as Body;
    if (!body.adminUserId || !body.intakeClientId) {
      return res.status(400).json({ error: "Faltan adminUserId o intakeClientId" });
    }
    const db = getAdminDb();
    if (!db) return res.status(500).json({ error: "Firebase Admin SDK no configurado" });
    const adminDoc = await db.collection("usuarios").doc(body.adminUserId).get();
    const email = adminDoc.data()?.email?.toLowerCase() || "";
    if (!adminDoc.exists || email !== "admin@fitplan-ai.com") return res.status(403).json({ error: "Solo administradores" });

    const clientRef = db.collection("intakeClients").doc(body.intakeClientId);
    const clientSnap = await clientRef.get();
    if (!clientSnap.exists) return res.status(404).json({ error: "Cliente no encontrado" });

    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await clientRef.set(
      {
        weightCheckRequested: true,
        weightCheckRequestedAt: FieldValue.serverTimestamp(),
        weightCheckRequest: {
          active: true,
          requestId,
          requestedAt: FieldValue.serverTimestamp(),
          source: "manual",
        },
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    await clientRef.collection("engagementEvents").add({
      kind: "weight_request",
      status: "requested",
      source: "manual",
      requestId,
      createdAt: FieldValue.serverTimestamp(),
      actorType: "admin",
      actorId: body.adminUserId,
    });
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("requestIntakeClientWeight:", e);
    return res.status(500).json({ error: "No se pudo solicitar el peso" });
  }
}

