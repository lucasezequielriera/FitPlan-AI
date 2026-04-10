import type { NextApiRequest, NextApiResponse } from "next";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";

type Body = {
  adminUserId?: string;
  intakeClientId?: string;
  note?: string;
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
    const emailAdmin = adminDoc.data()?.email?.toLowerCase() || "";
    if (!adminDoc.exists || emailAdmin !== "admin@fitplan-ai.com") {
      return res.status(403).json({ error: "Solo administradores pueden acceder" });
    }

    const clientRef = db.collection("intakeClients").doc(body.intakeClientId);
    const clientSnap = await clientRef.get();
    if (!clientSnap.exists) return res.status(404).json({ error: "Cliente no encontrado" });
    const client = clientSnap.data() || {};
    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const cleanNote = typeof body.note === "string" ? body.note.trim().slice(0, 300) : "";

    await clientRef.set(
      {
        wellnessCheckinRequested: true,
        wellnessCheckinRequestedAt: FieldValue.serverTimestamp(),
        wellnessCheckinRequest: {
          active: true,
          requestId,
          note: cleanNote || null,
          requestedAt: FieldValue.serverTimestamp(),
          requestedBy: body.adminUserId,
        },
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    await clientRef.collection("engagementEvents").add({
      kind: "wellness_request",
      status: "requested",
      source: "manual",
      requestId,
      note: cleanNote || null,
      createdAt: FieldValue.serverTimestamp(),
      actorType: "admin",
      actorId: body.adminUserId,
    });

    await db.collection("adminNotifications").add({
      type: "coach_alert",
      read: false,
      provider: "coach",
      userId: body.intakeClientId,
      userName: typeof client.nombreCompleto === "string" ? client.nombreCompleto : null,
      userEmail: typeof client.email === "string" ? client.email : null,
      message: "Solicitud de check-in enviada al cliente (bienestar/adherencia).",
      payload: { kind: "wellness_checkin_requested", clientId: body.intakeClientId, requestId },
      createdAt: FieldValue.serverTimestamp(),
    });

    return res.status(200).json({ ok: true, requestId });
  } catch (e) {
    console.error("requestIntakeClientCheckin:", e);
    return res.status(500).json({ error: "No se pudo solicitar el check-in" });
  }
}

