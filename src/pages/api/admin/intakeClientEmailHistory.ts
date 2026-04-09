import type { NextApiRequest, NextApiResponse } from "next";
import { getAdminDb } from "@/lib/firebase-admin";

function toISO(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    if ("toDate" in value && typeof (value as { toDate: () => Date }).toDate === "function") {
      return (value as { toDate: () => Date }).toDate().toISOString();
    }
  }
  return null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const adminUserId = typeof req.query.adminUserId === "string" ? req.query.adminUserId : "";
  const clientId = typeof req.query.clientId === "string" ? req.query.clientId : "";
  if (!adminUserId || !clientId) return res.status(400).json({ error: "Faltan adminUserId o clientId" });
  const db = getAdminDb();
  if (!db) return res.status(500).json({ error: "Firebase Admin SDK no configurado" });
  const adminDoc = await db.collection("usuarios").doc(adminUserId).get();
  const email = adminDoc.data()?.email?.toLowerCase() || "";
  if (!adminDoc.exists || email !== "admin@fitplan-ai.com") {
    return res.status(403).json({ error: "Solo administradores" });
  }
  const snap = await db
    .collection("intakeClients")
    .doc(clientId)
    .collection("emailHistory")
    .orderBy("createdAt", "desc")
    .limit(40)
    .get();
  return res.status(200).json({
    items: snap.docs.map((d) => {
      const data = d.data() as Record<string, unknown>;
      return {
        id: d.id,
        kind: typeof data.kind === "string" ? data.kind : null,
        weekKey: typeof data.weekKey === "string" ? data.weekKey : null,
        frequency: typeof data.frequency === "string" ? data.frequency : null,
        status: typeof data.status === "string" ? data.status : "sent",
        to: typeof data.to === "string" ? data.to : null,
        subject: typeof data.subject === "string" ? data.subject : null,
        html: typeof data.html === "string" ? data.html : null,
        text: typeof data.text === "string" ? data.text : null,
        error: typeof data.error === "string" ? data.error : null,
        createdAt: toISO(data.createdAt),
      };
    }),
  });
}

