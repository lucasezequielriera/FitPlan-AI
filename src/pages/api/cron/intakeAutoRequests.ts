import type { NextApiRequest, NextApiResponse } from "next";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";

function isAuthorized(req: NextApiRequest): boolean {
  const cronHeader = req.headers["x-vercel-cron"];
  if (cronHeader === "1") return true;
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.authorization === `Bearer ${secret}`;
}

function parseYmd(value: unknown): Date | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00.000Z`);
  return isNaN(d.getTime()) ? null : d;
}

function daysSince(last: unknown): number | null {
  if (!last) return null;
  let d: Date | null = null;
  if (typeof last === "string") d = new Date(last);
  else if (typeof last === "object" && last && "toDate" in last && typeof (last as { toDate: () => Date }).toDate === "function") {
    d = (last as { toDate: () => Date }).toDate();
  }
  if (!d || isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

function weightMinDays(freq: unknown): number {
  if (freq === "weekly") return 7;
  if (freq === "biweekly") return 14;
  return 30;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  if (!isAuthorized(req)) return res.status(401).json({ error: "Unauthorized" });
  const db = getAdminDb();
  if (!db) return res.status(500).json({ error: "Firebase Admin SDK no configurado" });

  const snap = await db.collection("intakeClients").limit(300).get();
  let wellnessRequested = 0;
  let weightRequested = 0;

  for (const doc of snap.docs) {
    const data = doc.data() || {};
    const ref = doc.ref;
    const patch: Record<string, unknown> = {};

    if (data.wellnessAutoEnabled === true && data.wellnessCheckinRequested !== true) {
      const start = parseYmd(data.wellnessAutoStartDate);
      const lastDays = daysSince(data.lastWellnessCheckinAt);
      const canStart = !start || Date.now() >= start.getTime();
      if (canStart && (lastDays == null || lastDays >= 1)) {
        const requestId = `auto-${Date.now()}`;
        patch.wellnessCheckinRequested = true;
        patch.wellnessCheckinRequestedAt = FieldValue.serverTimestamp();
        patch.wellnessCheckinRequest = {
          active: true,
          requestId,
          requestedAt: FieldValue.serverTimestamp(),
          source: "auto",
        };
        await ref.collection("engagementEvents").add({
          kind: "wellness_request",
          status: "requested",
          source: "auto",
          requestId,
          createdAt: FieldValue.serverTimestamp(),
          actorType: "system",
          actorId: "cron:intakeAutoRequests",
        });
        wellnessRequested += 1;
      }
    }

    if (data.weightRequestAutoEnabled === true && data.weightCheckRequested !== true) {
      const start = parseYmd(data.weightRequestStartDate);
      const minDays = weightMinDays(data.weightRequestFrequency);
      const lastDays = daysSince(data.latestWeightAt);
      const canStart = !start || Date.now() >= start.getTime();
      if (canStart && (lastDays == null || lastDays >= minDays)) {
        const requestId = `auto-${Date.now()}`;
        patch.weightCheckRequested = true;
        patch.weightCheckRequestedAt = FieldValue.serverTimestamp();
        patch.weightCheckRequest = {
          active: true,
          requestId,
          requestedAt: FieldValue.serverTimestamp(),
          source: "auto",
          frequency: data.weightRequestFrequency || "monthly",
        };
        await ref.collection("engagementEvents").add({
          kind: "weight_request",
          status: "requested",
          source: "auto",
          requestId,
          createdAt: FieldValue.serverTimestamp(),
          actorType: "system",
          actorId: "cron:intakeAutoRequests",
        });
        weightRequested += 1;
      }
    }

    if (Object.keys(patch).length > 0) {
      patch.updatedAt = FieldValue.serverTimestamp();
      await ref.set(patch, { merge: true });
    }
  }

  return res.status(200).json({ ok: true, wellnessRequested, weightRequested });
}

