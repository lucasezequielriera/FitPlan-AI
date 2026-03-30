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
    if ("seconds" in value && typeof (value as { seconds: number }).seconds === "number") {
      const ts = value as { seconds: number; nanoseconds?: number };
      return new Date(ts.seconds * 1000 + (ts.nanoseconds || 0) / 1000000).toISOString();
    }
  }
  return null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const userId = req.query.userId as string | undefined;
  const planId = req.query.planId as string | undefined;

  if (!userId) {
    return res.status(401).json({ error: "No se proporcionó userId" });
  }
  if (!planId) {
    return res.status(400).json({ error: "No se proporcionó planId" });
  }

  try {
    const db = getAdminDb();
    if (!db) {
      return res.status(500).json({ error: "Firebase Admin SDK no configurado" });
    }

    const adminDoc = await db.collection("usuarios").doc(userId).get();
    const email = adminDoc.data()?.email?.toLowerCase() || "";
    if (!adminDoc.exists || email !== "admin@fitplan-ai.com") {
      return res.status(403).json({ error: "Solo administradores pueden acceder" });
    }

    const planDoc = await db.collection("intakeClientPlans").doc(planId).get();
    if (!planDoc.exists) {
      return res.status(404).json({ error: "Plan no encontrado" });
    }

    const data = planDoc.data() || {};
    return res.status(200).json({
      plan: {
        id: planDoc.id,
        intakeClientId: (data.intakeClientId as string) || null,
        actionType: (data.actionType as string) || null,
        includeNutrition: Boolean(data.includeNutrition),
        includeTraining: Boolean(data.includeTraining),
        nutritionTargets:
          data.nutritionTargets && typeof data.nutritionTargets === "object"
            ? (data.nutritionTargets as Record<string, unknown>)
            : null,
        input: data.input && typeof data.input === "object" ? (data.input as Record<string, unknown>) : null,
        plan: data.plan && typeof data.plan === "object" ? (data.plan as Record<string, unknown>) : null,
        createdAt: toISO(data.createdAt),
        updatedAt: toISO(data.updatedAt),
      },
    });
  } catch (error) {
    console.error("Error obteniendo plan generado de intake:", error);
    return res.status(500).json({ error: "No se pudo obtener el plan generado" });
  }
}
