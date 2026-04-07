import type { NextApiRequest, NextApiResponse } from "next";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { isAllowedPosterUrl, isAllowedVideoUrl, normalizeExerciseMediaKey } from "@/lib/exerciseMedia";

export const maxDuration = 30;

type OverrideEntry = { demo_video_url?: string; demo_poster_url?: string };

/**
 * Guarda URLs de vídeo/póster propios (HTTPS directo, sin YouTube) en
 * plan.training_plan.exercise_media_overrides, indexado por nombre de ejercicio normalizado.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { userId, planId, exercise_media_overrides: rawOverrides } = req.body as {
    userId?: string;
    planId?: string;
    exercise_media_overrides?: unknown;
  };

  if (!userId || !planId) {
    return res.status(400).json({ error: "Faltan userId o planId" });
  }
  if (!rawOverrides || typeof rawOverrides !== "object" || Array.isArray(rawOverrides)) {
    return res.status(400).json({ error: "exercise_media_overrides debe ser un objeto" });
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

    const planRef = db.collection("intakeClientPlans").doc(planId);
    const snap = await planRef.get();
    if (!snap.exists) {
      return res.status(404).json({ error: "Plan no encontrado" });
    }

    const data = snap.data() as Record<string, unknown>;
    const planRoot = data.plan && typeof data.plan === "object" ? ({ ...(data.plan as Record<string, unknown>) } as Record<string, unknown>) : null;
    if (!planRoot) {
      return res.status(400).json({ error: "El documento no tiene plan" });
    }

    const trainingPlan =
      planRoot.training_plan && typeof planRoot.training_plan === "object"
        ? ({ ...(planRoot.training_plan as Record<string, unknown>) } as Record<string, unknown>)
        : null;
    if (!trainingPlan) {
      return res.status(400).json({ error: "El plan no incluye training_plan" });
    }

    const sanitized: Record<string, OverrideEntry> = {};
    for (const [rawKey, val] of Object.entries(rawOverrides as Record<string, unknown>)) {
      const key = normalizeExerciseMediaKey(rawKey);
      if (!key) continue;
      if (!val || typeof val !== "object" || Array.isArray(val)) continue;
      const o = val as Record<string, unknown>;
      const video = typeof o.demo_video_url === "string" ? o.demo_video_url.trim() : "";
      const poster = typeof o.demo_poster_url === "string" ? o.demo_poster_url.trim() : "";
      const entry: OverrideEntry = {};
      if (video) {
        if (!isAllowedVideoUrl(video)) {
          return res.status(400).json({ error: `URL de vídeo no permitida para «${rawKey}» (usa https y .mp4 / .webm / .mov; sin YouTube).` });
        }
        entry.demo_video_url = video;
      }
      if (poster) {
        if (!isAllowedPosterUrl(poster)) {
          return res.status(400).json({ error: `URL de póster no permitida para «${rawKey}».` });
        }
        entry.demo_poster_url = poster;
      }
      if (Object.keys(entry).length > 0) {
        sanitized[key] = entry;
      }
    }

    trainingPlan.exercise_media_overrides = sanitized;
    planRoot.training_plan = trainingPlan;

    await planRef.update({
      plan: planRoot,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return res.status(200).json({ ok: true, keys: Object.keys(sanitized) });
  } catch (e) {
    console.error("patchIntakePlanExerciseMedia:", e);
    return res.status(500).json({ error: "No se pudo guardar", detail: e instanceof Error ? e.message : String(e) });
  }
}
