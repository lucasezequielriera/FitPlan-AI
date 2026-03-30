import type { NextApiRequest, NextApiResponse } from "next";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";

type ActionType = "generate" | "update";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const {
    userId,
    clientId,
    actionType,
    includeNutrition,
    includeTraining,
  } = req.body as {
    userId?: string;
    clientId?: string;
    actionType?: ActionType;
    includeNutrition?: boolean;
    includeTraining?: boolean;
  };

  if (!userId || !clientId || !actionType) {
    return res.status(400).json({ error: "Faltan datos requeridos: userId, clientId y actionType" });
  }
  if (actionType !== "generate" && actionType !== "update") {
    return res.status(400).json({ error: "actionType inválido" });
  }
  if (!includeNutrition && !includeTraining) {
    return res.status(400).json({ error: "Debes elegir al menos un tipo de plan" });
  }

  try {
    const db = getAdminDb();
    if (!db) {
      return res.status(500).json({ error: "Firebase Admin SDK no configurado" });
    }

    const adminDoc = await db.collection("usuarios").doc(userId).get();
    const email = adminDoc.data()?.email?.toLowerCase() || "";
    if (!adminDoc.exists || email !== "admin@fitplan-ai.com") {
      return res.status(403).json({ error: "Solo administradores pueden ejecutar esta acción" });
    }

    const targetRef = db.collection("intakeClients").doc(clientId);
    const targetDoc = await targetRef.get();
    if (!targetDoc.exists) {
      return res.status(404).json({ error: "Cliente no encontrado" });
    }

    const status = actionType === "generate" ? "plan_pending_generation" : "plan_pending_update";
    const entry = {
      type: actionType,
      includeNutrition: includeNutrition === true,
      includeTraining: includeTraining === true,
      period: "monthly",
      createdAt: new Date().toISOString(),
      createdBy: userId,
    };

    await targetRef.set(
      {
        status,
        planAction: {
          ...entry,
          updatedAt: FieldValue.serverTimestamp(),
        },
        planActionHistory: FieldValue.arrayUnion(entry),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Error guardando acción de plan de intake:", error);
    return res.status(500).json({ error: "No se pudo guardar la acción" });
  }
}

