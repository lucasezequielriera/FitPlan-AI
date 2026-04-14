import type { NextApiRequest, NextApiResponse } from "next";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value === "object") {
    if ("toDate" in value && typeof (value as { toDate: () => Date }).toDate === "function") {
      return (value as { toDate: () => Date }).toDate();
    }
    if ("seconds" in value && typeof (value as { seconds: number }).seconds === "number") {
      const ts = value as { seconds: number; nanoseconds?: number };
      return new Date(ts.seconds * 1000 + (ts.nanoseconds || 0) / 1000000);
    }
  }
  return null;
}

function isQuotaError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error || "");
  const normalized = msg.toUpperCase();
  return normalized.includes("RESOURCE_EXHAUSTED") || normalized.includes("QUOTA EXCEEDED");
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) {
      return res.status(401).json({ error: "Token requerido" });
    }

    const adminAuth = getAdminAuth();
    const db = getAdminDb();
    if (!adminAuth || !db) {
      return res.status(500).json({ error: "Firebase Admin SDK no configurado" });
    }

    const decoded = await adminAuth.verifyIdToken(token);
    const userId = decoded.uid;
    const userRef = db.collection("usuarios").doc(userId);
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const userData = userDoc.data() || {};
    const premium = userData.premium === true;
    const expiresAt = toDate(userData.premiumExpiresAt);
    const now = new Date();

    if (!premium) {
      return res.status(200).json({ premium: false, expired: false });
    }

    if (!expiresAt || expiresAt.getTime() <= now.getTime()) {
      await userRef.set(
        {
          premium: false,
          premiumStatus: "expired",
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      return res.status(200).json({ premium: false, expired: true });
    }

    return res.status(200).json({ premium: true, expired: false, expiresAt: expiresAt.toISOString() });
  } catch (error) {
    if (isQuotaError(error)) {
      return res.status(200).json({
        premium: false,
        expired: false,
        degraded: true,
        warning: "No se pudo validar premium temporalmente por límite de cuota.",
      });
    }
    console.error("Error verificando expiración premium:", error);
    return res.status(500).json({ error: "No se pudo verificar premium" });
  }
}

