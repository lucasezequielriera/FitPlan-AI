import type { NextApiRequest, NextApiResponse } from "next";
import { getAdminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

interface DeleteTrackedFoodRequest {
  planId: string;
  userId?: string;
  foodIndex: number; // Índice de la comida en el array trackedFoods
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { planId, userId, foodIndex }: DeleteTrackedFoodRequest = req.body;

  if (!planId || foodIndex === undefined) {
    return res.status(400).json({ error: "planId y foodIndex son requeridos" });
  }

  try {
    const db = getAdminDb();
    if (!db) {
      return res.status(501).json({ error: "Firebase Admin SDK no configurado" });
    }

    const planRef = db.collection("planes").doc(planId);
    const planDoc = await planRef.get();

    if (!planDoc.exists) {
      return res.status(404).json({ error: "Plan no encontrado" });
    }

    const planData = planDoc.data();
    
    // Verificar que el usuario es el dueño del plan (si se proporciona userId)
    if (userId && planData?.userId !== userId) {
      return res.status(403).json({ error: "No tienes permiso para modificar este plan" });
    }

    const trackedFoods = planData?.trackedFoods || [];
    
    if (foodIndex < 0 || foodIndex >= trackedFoods.length) {
      return res.status(400).json({ error: "Índice de comida inválido" });
    }

    // Eliminar la comida del array
    const updatedFoods = trackedFoods.filter((_: any, index: number) => index !== foodIndex);

    await planRef.update({
      trackedFoods: updatedFoods,
      updatedAt: FieldValue.serverTimestamp(),
    });

    console.log("✅ Comida eliminada correctamente del plan:", planId, "- Índice:", foodIndex);

    return res.status(200).json({ 
      success: true,
      message: "Comida eliminada correctamente",
      remainingFoods: updatedFoods.length,
    });
  } catch (error) {
    console.error("❌ Error al eliminar comida:", error);
    return res.status(500).json({
      error: "Error al eliminar la comida",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}

