import type { NextApiRequest, NextApiResponse } from "next";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/adminAuthServer";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "DELETE") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.error });
  }

  const { clientId, planId, deleteNutrition, deleteTraining } = req.body as {
    clientId?: string;
    planId?: string;
    deleteNutrition?: boolean;
    deleteTraining?: boolean;
  };

  if (!clientId || !planId) {
    return res.status(400).json({ error: "Faltan datos requeridos: clientId y planId" });
  }
  if (!deleteNutrition && !deleteTraining) {
    return res.status(400).json({ error: "Debes seleccionar al menos un tipo de plan para eliminar." });
  }

  try {
    const db = getAdminDb();
    if (!db) {
      return res.status(500).json({ error: "Firebase Admin SDK no configurado" });
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

    const planData = planDoc.data() as Record<string, unknown>;
    const hasNutrition = planData.includeNutrition === true;
    const hasTraining = planData.includeTraining === true;

    const nextNutrition = hasNutrition && !deleteNutrition;
    const nextTraining = hasTraining && !deleteTraining;

    if (!nextNutrition && !nextTraining) {
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
      return res.status(200).json({ ok: true, deletedAll: true });
    }

    const planObject =
      planData.plan && typeof planData.plan === "object"
        ? { ...(planData.plan as Record<string, unknown>) }
        : {};
    if (deleteNutrition) {
      delete planObject.plan_semanal;
      delete planObject.calorias_diarias;
      delete planObject.macros;
      delete planObject.distribucion_diaria_pct;
      delete planObject.lista_compras;
      delete planObject.suplementacion_recomendada;
    }
    if (deleteTraining) {
      delete planObject.training_plan;
      delete planObject.minutos_sesion_gym;
      delete planObject.cardio_recomendado;
    }

    await planRef.set(
      {
        includeNutrition: nextNutrition,
        includeTraining: nextTraining,
        plan: planObject,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    await clientRef.set(
      {
        latestPlanIncludeNutrition: nextNutrition,
        latestPlanIncludeTraining: nextTraining,
        status: "plan_generated",
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return res.status(200).json({ ok: true, deletedAll: false, includeNutrition: nextNutrition, includeTraining: nextTraining });
  } catch (error) {
    console.error("Error eliminando plan de intake:", error);
    return res.status(500).json({ error: "No se pudo eliminar el plan" });
  }
}
