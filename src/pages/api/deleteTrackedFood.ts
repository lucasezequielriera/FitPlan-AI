import type { NextApiRequest, NextApiResponse } from "next";
import { getAdminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

type UiLang = "es" | "en";

interface DeleteTrackedFoodRequest {
  planId: string;
  userId?: string;
  foodIndex: number;
  locale?: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { planId, userId, foodIndex, locale: localeRaw }: DeleteTrackedFoodRequest = req.body;
  const lang: UiLang = localeRaw === "en" ? "en" : "es";

  if (!planId || foodIndex === undefined) {
    return res.status(400).json({
      error: lang === "en" ? "planId and foodIndex are required" : "planId y foodIndex son requeridos",
    });
  }

  try {
    const db = getAdminDb();
    if (!db) {
      return res.status(501).json({
        error: lang === "en" ? "Firebase Admin SDK is not configured" : "Firebase Admin SDK no configurado",
      });
    }

    const planRef = db.collection("planes").doc(planId);
    const planDoc = await planRef.get();

    if (!planDoc.exists) {
      return res.status(404).json({
        error: lang === "en" ? "Plan not found" : "Plan no encontrado",
      });
    }

    const planData = planDoc.data();

    if (userId && planData?.userId !== userId) {
      return res.status(403).json({
        error: lang === "en" ? "You don't have permission to modify this plan" : "No tienes permiso para modificar este plan",
      });
    }

    const trackedFoods = planData?.trackedFoods || [];

    if (foodIndex < 0 || foodIndex >= trackedFoods.length) {
      return res.status(400).json({
        error: lang === "en" ? "Invalid meal index" : "Índice de comida inválido",
      });
    }

    const updatedFoods = trackedFoods.filter((_: unknown, index: number) => index !== foodIndex);

    await planRef.update({
      trackedFoods: updatedFoods,
      updatedAt: FieldValue.serverTimestamp(),
    });

    console.log("✅ Comida eliminada correctamente del plan:", planId, "- Índice:", foodIndex);

    return res.status(200).json({
      success: true,
      message: lang === "en" ? "Meal removed successfully" : "Comida eliminada correctamente",
      remainingFoods: updatedFoods.length,
    });
  } catch (error) {
    console.error("❌ Error al eliminar comida:", error);
    return res.status(500).json({
      error: lang === "en" ? "Could not delete the meal" : "Error al eliminar la comida",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}
