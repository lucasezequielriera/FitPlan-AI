import type { NextApiRequest, NextApiResponse } from "next";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";

interface SavePlanBody {
  plan?: unknown;
  userId?: string;
  planAnteriorId?: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { plan, userId, planAnteriorId } = (req.body || {}) as SavePlanBody;

  if (!plan || !userId) {
    return res.status(400).json({ error: "plan y userId son requeridos" });
  }

  try {
    const db = getAdminDb();
    if (!db) {
      return res.status(501).json({ error: "Firebase Admin SDK no configurado" });
    }

    const docRef = await db.collection("planes").add({
      userId,
      plan,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      ...(planAnteriorId ? { planAnteriorId } : {}),
      source: "plan_continuity",
    });

    return res.status(200).json({ id: docRef.id });
  } catch (error) {
    console.error("❌ Error al guardar plan:", error);
    return res.status(500).json({
      error: "No se pudo guardar el plan",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}
