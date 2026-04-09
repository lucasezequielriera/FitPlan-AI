import type { NextApiRequest, NextApiResponse } from "next";
import { getAdminDb } from "@/lib/firebase-admin";
import {
  isAllowedVideoUrl,
  normalizeExerciseMediaKey,
  resolveCustomExerciseMediaInputToAbsoluteUrl,
} from "@/lib/exerciseMedia";
import { getSiteOriginFromRequest } from "@/lib/requestSiteOrigin";
import {
  adminDeleteExerciseWgerCatalogEntry,
  adminListExerciseWgerCatalog,
  adminUpsertExerciseCatalogEntry,
} from "@/lib/exerciseWgerCatalogServer";
import { clearWgerExerciseMediaResolutionCache } from "@/lib/wgerExerciseMedia";

async function assertAdmin(userId: string): Promise<boolean> {
  const db = getAdminDb();
  if (!db) return false;
  const doc = await db.collection("usuarios").doc(userId).get();
  const email = (doc.data()?.email as string | undefined)?.toLowerCase() || "";
  return doc.exists && email === "admin@fitplan-ai.com";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    const userId = typeof req.query.userId === "string" ? req.query.userId.trim() : "";
    if (!userId) {
      return res.status(400).json({ error: "Falta userId" });
    }
    if (!(await assertAdmin(userId))) {
      return res.status(403).json({ error: "Solo administradores" });
    }
    try {
      const entries = await adminListExerciseWgerCatalog();
      return res.status(200).json({ entries });
    } catch (e) {
      console.error("exerciseWgerCatalog GET:", e);
      return res.status(500).json({ error: "No se pudo leer el catálogo" });
    }
  }

  if (req.method === "POST") {
    const body = req.body as {
      userId?: string;
      label?: string;
      mode?: string;
      wgerExerciseId?: unknown;
      customImageUrl?: string;
    };
    const { userId, label, mode, wgerExerciseId, customImageUrl } = body;
    if (!userId || !(await assertAdmin(userId))) {
      return res.status(403).json({ error: "Solo administradores" });
    }
    const lab = typeof label === "string" ? label.trim() : "";
    if (!lab || lab.length < 2) {
      return res.status(400).json({ error: "Nombre de ejercicio inválido" });
    }
    const normKey = normalizeExerciseMediaKey(lab);
    if (!normKey) {
      return res.status(400).json({ error: "No se pudo normalizar el nombre" });
    }

    const m = mode === "custom" ? "custom" : "wger";

    try {
      let resolvedCustomImageUrl: string | undefined;
      if (m === "custom") {
        const raw = typeof customImageUrl === "string" ? customImageUrl.trim() : "";
        const siteOrigin = getSiteOriginFromRequest(req.headers);
        let url = resolveCustomExerciseMediaInputToAbsoluteUrl(raw, siteOrigin);
        if (!url && isAllowedVideoUrl(raw)) {
          url = raw;
        }
        if (!url) {
          return res.status(400).json({
            error:
              "URL no válida: imagen (.png, .jpg, .gif, .webp, .avif), archivo en public/ejercicios/, o vídeo HTTPS (.mp4, .webm, .mov, p. ej. Cloudinary …/video/upload/…).",
          });
        }
        resolvedCustomImageUrl = url;
        await adminUpsertExerciseCatalogEntry(normKey, lab, { kind: "custom", customImageUrl: url });
      } else {
        const idNum = typeof wgerExerciseId === "number" ? wgerExerciseId : Number(wgerExerciseId);
        if (!Number.isFinite(idNum) || idNum < 1) {
          return res.status(400).json({ error: "ID wger inválido (número exerciseinfo ≥ 1)" });
        }
        await adminUpsertExerciseCatalogEntry(normKey, lab, { kind: "wger", wgerExerciseId: Math.floor(idNum) });
      }
      clearWgerExerciseMediaResolutionCache();
      return res.status(200).json({
        ok: true,
        normKey,
        ...(resolvedCustomImageUrl ? { resolvedCustomImageUrl } : {}),
      });
    } catch (e) {
      console.error("exerciseWgerCatalog POST:", e);
      return res.status(500).json({ error: "No se pudo guardar" });
    }
  }

  if (req.method === "DELETE") {
    const { userId, normKey } = req.body as { userId?: string; normKey?: string };
    if (!userId || !(await assertAdmin(userId))) {
      return res.status(403).json({ error: "Solo administradores" });
    }
    const nk = typeof normKey === "string" ? normKey.trim() : "";
    if (!nk) {
      return res.status(400).json({ error: "Falta normKey" });
    }
    try {
      await adminDeleteExerciseWgerCatalogEntry(nk);
      clearWgerExerciseMediaResolutionCache();
      return res.status(200).json({ ok: true });
    } catch (e) {
      console.error("exerciseWgerCatalog DELETE:", e);
      return res.status(500).json({ error: "No se pudo eliminar" });
    }
  }

  res.setHeader("Allow", "GET, POST, DELETE");
  return res.status(405).json({ error: "Method not allowed" });
}
