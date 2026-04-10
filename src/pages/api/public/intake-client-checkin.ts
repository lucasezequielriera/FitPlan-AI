import type { NextApiRequest, NextApiResponse } from "next";
import { FieldValue } from "firebase-admin/firestore";
import { assertIntakePublicToken } from "@/lib/intakePublicTokenServer";

type WellnessPayload = {
  energia: number;
  sueno: number;
  hambre: number;
  dolor: number;
  estres: number;
  motivacion: number;
  notas: string | null;
};

function parseLevel(v: unknown): number | null {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  const i = Math.floor(n);
  if (i < 1 || i > 5) return null;
  return i;
}

function parseBody(body: unknown): WellnessPayload | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const b = body as Record<string, unknown>;
  const energia = parseLevel(b.energia);
  const sueno = parseLevel(b.sueno);
  const hambre = parseLevel(b.hambre);
  const dolor = parseLevel(b.dolor);
  const estres = parseLevel(b.estres);
  const motivacion = parseLevel(b.motivacion);
  if (
    energia == null ||
    sueno == null ||
    hambre == null ||
    dolor == null ||
    estres == null ||
    motivacion == null
  ) {
    return null;
  }
  const notas = typeof b.notas === "string" ? b.notas.trim().slice(0, 800) : "";
  return { energia, sueno, hambre, dolor, estres, motivacion, notas: notas || null };
}

function riskSignals(data: WellnessPayload): string[] {
  const flags: string[] = [];
  if (data.dolor >= 4) flags.push("dolor alto");
  if (data.estres >= 4) flags.push("estrés alto");
  if (data.energia <= 2) flags.push("energía baja");
  if (data.sueno <= 2) flags.push("sueño bajo");
  if (data.motivacion <= 2) flags.push("motivación baja");
  if (data.hambre >= 4) flags.push("hambre alta");
  return flags;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const clientId = typeof req.query.clientId === "string" ? req.query.clientId : "";
  const token = typeof req.query.t === "string" ? req.query.t : "";
  if (!clientId || !token) return res.status(400).json({ error: "Faltan clientId o t" });

  const auth = await assertIntakePublicToken(clientId, token);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const parsed = parseBody(req.body);
  if (!parsed) return res.status(400).json({ error: "Payload inválido. Usa valores 1 a 5." });

  const ymd = new Date().toISOString().slice(0, 10);
  const ref = auth.db.collection("intakeClients").doc(clientId);
  const checkinRef = ref.collection("wellnessCheckins").doc(ymd);

  await checkinRef.set(
    {
      ...parsed,
      createdAt: FieldValue.serverTimestamp(),
      source: "client_plan",
    },
    { merge: true }
  );

  await ref.set(
    {
      wellnessCheckinRequested: false,
      wellnessCheckinRequest: {
        active: false,
        completedAt: FieldValue.serverTimestamp(),
      },
      lastWellnessCheckinAt: FieldValue.serverTimestamp(),
      lastWellnessCheckin: {
        ...parsed,
        createdAt: FieldValue.serverTimestamp(),
      },
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  await ref.collection("engagementEvents").add({
    kind: "wellness_request",
    status: "completed",
    source: "client_plan",
    requestId:
      auth.intakeData.wellnessCheckinRequest &&
      typeof auth.intakeData.wellnessCheckinRequest === "object" &&
      typeof (auth.intakeData.wellnessCheckinRequest as Record<string, unknown>).requestId === "string"
        ? ((auth.intakeData.wellnessCheckinRequest as Record<string, unknown>).requestId as string)
        : null,
    ymd,
    metrics: parsed,
    createdAt: FieldValue.serverTimestamp(),
    actorType: "client",
    actorId: clientId,
  });

  const flags = riskSignals(parsed);
  if (flags.length > 0) {
    const clientName =
      typeof auth.intakeData.nombreCompleto === "string" && auth.intakeData.nombreCompleto.trim()
        ? auth.intakeData.nombreCompleto.trim()
        : "Cliente intake";
    const alertId = `coach_wellness_${clientId}_${ymd}`;
    await auth.db.collection("adminNotifications").doc(alertId).set(
      {
        type: "coach_alert",
        read: false,
        provider: "coach",
        userName: clientName,
        userEmail: typeof auth.intakeData.email === "string" ? auth.intakeData.email : null,
        message: `Check-in con señales de riesgo: ${flags.join(", ")}.`,
        payload: {
          kind: "wellness_risk",
          clientId,
          ymd,
          flags,
          metrics: parsed,
        },
        createdAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }

  return res.status(200).json({ ok: true, savedAt: ymd, flags });
}

