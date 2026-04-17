import type { NextApiRequest, NextApiResponse } from "next";
import { getAdminDb } from "@/lib/firebase-admin";

type ActivityItem = {
  id: string;
  source: "system" | "users";
  type: string;
  label: string;
  message: string;
  userName?: string;
  userEmail?: string;
  provider?: string;
  amount?: number;
  currency?: string;
  createdAt: string | null;
};

const toIso = (value: unknown): string | null => {
  if (!value) return null;
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  if (typeof value === "object") {
    if ("toDate" in value && typeof (value as { toDate?: () => Date }).toDate === "function") {
      const parsed = (value as { toDate: () => Date }).toDate();
      return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
    }
    if ("seconds" in value) {
      const ts = value as { seconds: number; nanoseconds?: number };
      const parsed = new Date(ts.seconds * 1000 + (ts.nanoseconds || 0) / 1000000);
      return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
    }
  }
  return null;
};

const getSystemLabel = (type: string): string => {
  if (type === "payment_success") return "Cobro";
  if (type === "coach_alert") return "Fatiga";
  if (type === "adherence_risk_weekly") return "Riesgo";
  if (type === "weekly_digest_sent") return "Email";
  if (type === "weekly_digest_failed") return "Email";
  return "Sistema";
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const adminUserId = req.query.adminUserId as string | undefined;
  if (!adminUserId) {
    return res.status(400).json({ error: "Falta adminUserId" });
  }

  const db = getAdminDb();
  if (!db) {
    return res.status(500).json({ error: "Firebase Admin SDK no configurado" });
  }

  const adminDoc = await db.collection("usuarios").doc(adminUserId).get();
  const email = adminDoc.data()?.email?.toLowerCase() || "";
  if (!adminDoc.exists || email !== "admin@fitplan-ai.com") {
    return res.status(403).json({ error: "Solo administradores" });
  }
  const lastUsersCheck = toIso((adminDoc.data() as Record<string, unknown>)?.lastUsersCheck);

  const [systemSnap, usersSnap] = await Promise.all([
    db
      .collection("adminNotifications")
      .where("type", "in", [
        "payment_success",
        "coach_alert",
        "weekly_digest_sent",
        "weekly_digest_failed",
        "adherence_risk_weekly",
      ])
      .orderBy("createdAt", "desc")
      .limit(400)
      .get(),
    db.collection("usuarios").orderBy("createdAt", "desc").limit(250).get(),
  ]);

  const systemItems: ActivityItem[] = systemSnap.docs.map((docSnap) => {
    const data = docSnap.data() as Record<string, unknown>;
    const type = typeof data.type === "string" ? data.type : "system";
    const userName = typeof data.userName === "string" ? data.userName : undefined;
    const userEmail = typeof data.userEmail === "string" ? data.userEmail : undefined;
    const message = typeof data.message === "string" ? data.message : "Notificación del sistema";
    return {
      id: docSnap.id,
      source: "system",
      type,
      label: getSystemLabel(type),
      message,
      userName,
      userEmail,
      provider: typeof data.provider === "string" ? data.provider : undefined,
      amount: typeof data.amount === "number" ? data.amount : undefined,
      currency: typeof data.currency === "string" ? data.currency : undefined,
      createdAt: toIso(data.createdAt),
    };
  });

  const userItems = usersSnap.docs
    .map((docSnap) => {
      const data = docSnap.data() as Record<string, unknown>;
      const userEmail = typeof data.email === "string" ? data.email : undefined;
      if (userEmail?.toLowerCase() === "admin@fitplan-ai.com") return null;
      const createdAt = toIso(data.createdAt);
      if (!createdAt) return null;
      return {
        id: `user-registered-${docSnap.id}`,
        source: "users" as const,
        type: "user_registered",
        label: "Usuarios",
        message: "Nuevo registro en FitPlan",
        userName: typeof data.nombre === "string" ? data.nombre : undefined,
        userEmail,
        createdAt,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const items = [...systemItems, ...userItems].sort((a, b) => {
    const aMs = a.createdAt ? Date.parse(a.createdAt) : 0;
    const bMs = b.createdAt ? Date.parse(b.createdAt) : 0;
    return bMs - aMs;
  });

  return res.status(200).json({ items, lastUsersCheck });
}
