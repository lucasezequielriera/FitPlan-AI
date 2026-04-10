import type { NextApiRequest, NextApiResponse } from "next";
import { FieldValue } from "firebase-admin/firestore";
import { assertIntakePublicToken } from "@/lib/intakePublicTokenServer";

function parseWeight(v: unknown): number | null {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  if (n < 30 || n > 350) return null;
  return Math.round(n * 10) / 10;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const clientId = typeof req.query.clientId === "string" ? req.query.clientId : "";
  const token = typeof req.query.t === "string" ? req.query.t : "";
  if (!clientId || !token) return res.status(400).json({ error: "Faltan clientId o t" });
  const auth = await assertIntakePublicToken(clientId, token);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const body = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
  const weightKg = parseWeight(body.weightKg);
  if (weightKg == null) return res.status(400).json({ error: "Peso inválido (30-350 kg)." });
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 300) : "";
  const ymd = new Date().toISOString().slice(0, 10);
  const clientRef = auth.db.collection("intakeClients").doc(clientId);

  await clientRef.collection("weightLogs").add({
    weightKg,
    note: note || null,
    source: "client_plan",
    ymd,
    createdAt: FieldValue.serverTimestamp(),
  });

  await clientRef.set(
    {
      latestWeightKg: weightKg,
      latestWeightAt: FieldValue.serverTimestamp(),
      weightCheckRequested: false,
      weightCheckRequest: {
        active: false,
        completedAt: FieldValue.serverTimestamp(),
      },
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  await clientRef.collection("engagementEvents").add({
    kind: "weight_request",
    status: "completed",
    source: "client_plan",
    requestId:
      auth.intakeData.weightCheckRequest &&
      typeof auth.intakeData.weightCheckRequest === "object" &&
      typeof (auth.intakeData.weightCheckRequest as Record<string, unknown>).requestId === "string"
        ? ((auth.intakeData.weightCheckRequest as Record<string, unknown>).requestId as string)
        : null,
    ymd,
    weightKg,
    note: note || null,
    createdAt: FieldValue.serverTimestamp(),
    actorType: "client",
    actorId: clientId,
  });

  return res.status(200).json({ ok: true, weightKg, ymd });
}

