import type { NextApiRequest, NextApiResponse } from "next";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "DELETE") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { userId, clientId, planId } = req.body as {
    userId?: string;
    clientId?: string;
    planId?: string;
  };

  if (!userId || !clientId || !planId) {
    return res.status(400).json({ error: "Faltan datos requeridos: userId, clientId y planId" });
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

    const clientRef = db.collection("intakeClients").doc(clientId);
    const clientDoc = await clientRef.get();
    if (!clientDoc.exists) {
      return res.status(404).json({ error: "Cliente no encontrado" });
    }

    const planRef = db.collection("intakeClientPlans").doc(planId);
    const planDoc = await planRef.get();
    if (!planDoc.exists) {
      return res.status(404).json({ error: "Plan no encontrado" });
    }

    const batch = db.batch();
    batch.delete(planRef);
    batch.set(
      clientRef,
      {
        latestPlanId: FieldValue.delete(),
        latestPlanActionType: FieldValue.delete(),
        latestPlanIncludeNutrition: FieldValue.delete(),
        latestPlanIncludeTraining: FieldValue.delete(),
        status: "new",
        planAction: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    await batch.commit();

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Error eliminando plan de intake:", error);
    return res.status(500).json({ error: "No se pudo eliminar el plan" });
  }
}
