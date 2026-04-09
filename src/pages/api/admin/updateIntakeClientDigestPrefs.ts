import type { NextApiRequest, NextApiResponse } from "next";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";

type Body = {
  adminUserId?: string;
  intakeClientId?: string;
  digestEmailEnabled?: boolean;
  digestFrequency?: "weekly" | "biweekly" | "monthly";
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const body = (req.body || {}) as Body;
  if (!body.adminUserId || !body.intakeClientId) return res.status(400).json({ error: "Faltan adminUserId o intakeClientId" });
  const db = getAdminDb();
  if (!db) return res.status(500).json({ error: "Firebase Admin SDK no configurado" });
  const adminDoc = await db.collection("usuarios").doc(body.adminUserId).get();
  const email = adminDoc.data()?.email?.toLowerCase() || "";
  if (!adminDoc.exists || email !== "admin@fitplan-ai.com") {
    return res.status(403).json({ error: "Solo administradores" });
  }
  const enabled = body.digestEmailEnabled !== false;
  const frequency = body.digestFrequency === "biweekly" || body.digestFrequency === "monthly" ? body.digestFrequency : "weekly";
  await db.collection("intakeClients").doc(body.intakeClientId).set(
    {
      digestEmailEnabled: enabled,
      digestFrequency: frequency,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  return res.status(200).json({ ok: true, digestEmailEnabled: enabled, digestFrequency: frequency });
}

