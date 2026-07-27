import type { NextApiRequest, NextApiResponse } from "next";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/adminAuthServer";

type Body = {
  intakeClientId?: string;
  digestEmailEnabled?: boolean;
  digestFrequency?: "weekly" | "biweekly" | "monthly";
  digestStartDate?: string | null;
  wellnessAutoEnabled?: boolean;
  wellnessAutoStartDate?: string | null;
  weightRequestAutoEnabled?: boolean;
  weightRequestFrequency?: "weekly" | "biweekly" | "monthly";
  weightRequestStartDate?: string | null;
};

function parseYmd(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  return t;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.error });
  }

  const body = (req.body || {}) as Body;
  if (!body.intakeClientId) return res.status(400).json({ error: "Falta intakeClientId" });
  const db = getAdminDb();
  if (!db) return res.status(500).json({ error: "Firebase Admin SDK no configurado" });
  const enabled = body.digestEmailEnabled !== false;
  const frequency = body.digestFrequency === "biweekly" || body.digestFrequency === "monthly" ? body.digestFrequency : "weekly";
  const digestStartDate = parseYmd(body.digestStartDate) || null;
  const wellnessAutoEnabled = body.wellnessAutoEnabled === true;
  const wellnessAutoStartDate = parseYmd(body.wellnessAutoStartDate) || null;
  const weightRequestAutoEnabled = body.weightRequestAutoEnabled === true;
  const weightRequestFrequency =
    body.weightRequestFrequency === "weekly" || body.weightRequestFrequency === "biweekly" || body.weightRequestFrequency === "monthly"
      ? body.weightRequestFrequency
      : "monthly";
  const weightRequestStartDate = parseYmd(body.weightRequestStartDate) || null;
  await db.collection("intakeClients").doc(body.intakeClientId).set(
    {
      digestEmailEnabled: enabled,
      digestFrequency: frequency,
      digestStartDate,
      wellnessAutoEnabled,
      wellnessAutoStartDate,
      weightRequestAutoEnabled,
      weightRequestFrequency,
      weightRequestStartDate,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  return res.status(200).json({
    ok: true,
    digestEmailEnabled: enabled,
    digestFrequency: frequency,
    digestStartDate,
    wellnessAutoEnabled,
    wellnessAutoStartDate,
    weightRequestAutoEnabled,
    weightRequestFrequency,
    weightRequestStartDate,
  });
}

