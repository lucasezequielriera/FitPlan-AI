import type { NextApiRequest, NextApiResponse } from "next";
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
import { requireAdmin } from "@/lib/adminAuthServer";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.error });
  }

  if (req.method === "GET") {
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
      label?: string;
      mode?: string;
      wgerExerciseId?: unknown;
      customImageUrl?: string;
    };
    const { label, mode, wgerExerciseId, customImageUrl } = body;
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
    const { normKey } = req.body as { normKey?: string };
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
