import type { NextApiRequest, NextApiResponse } from "next";
import { FieldValue } from "firebase-admin/firestore";
import { requirePlanAccess, type AuthFailureCode } from "@/lib/userAuthServer";

type UiLang = "es" | "en";

interface DeleteTrackedFoodRequest {
  planId: string;
  foodIndex: number;
  locale?: string;
}

/** Mensaje legible para cada motivo de rechazo de `requirePlanAccess`. */
function authErrorMessage(code: AuthFailureCode, lang: UiLang): string {
  switch (code) {
    case "unauthenticated":
      return lang === "en" ? "You need to sign in to modify this plan" : "Necesitas iniciar sesión para modificar este plan";
    case "forbidden":
      return lang === "en" ? "You don't have permission to modify this plan" : "No tienes permiso para modificar este plan";
    case "not-found":
      return lang === "en" ? "Plan not found" : "Plan no encontrado";
    case "unconfigured":
      return lang === "en" ? "Firebase Admin SDK is not configured" : "Firebase Admin SDK no configurado";
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { planId, foodIndex, locale: localeRaw }: DeleteTrackedFoodRequest = req.body;
  const lang: UiLang = localeRaw === "en" ? "en" : "es";

  if (!planId || foodIndex === undefined) {
    return res.status(400).json({
      error: lang === "en" ? "planId and foodIndex are required" : "planId y foodIndex son requeridos",
    });
  }

  try {
    // Identidad verificada con el ID token: el UID nunca sale del body.
    // Antes, omitir `userId` saltaba el chequeo de dueño por completo.
    const access = await requirePlanAccess(req, planId);
    if (!access.ok) {
      return res.status(access.status).json({ error: authErrorMessage(access.code, lang) });
    }

    const { planRef, planData } = access;
    const trackedFoods = planData.trackedFoods || [];

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
