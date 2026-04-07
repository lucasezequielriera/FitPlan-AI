import type { NextApiRequest, NextApiResponse } from "next";
import { getAdminDb } from "@/lib/firebase-admin";
import { loadUniquePlanExercisesForCatalog } from "@/lib/planExerciseCatalogIndexServer";
import { adminListExerciseWgerCatalog } from "@/lib/exerciseWgerCatalogServer";
import { resolveWgerExerciseMedia } from "@/lib/wgerExerciseMedia";

export const maxDuration = 60;

async function assertAdmin(userId: string): Promise<boolean> {
  const db = getAdminDb();
  if (!db) return false;
  const doc = await db.collection("usuarios").doc(userId).get();
  const email = (doc.data()?.email as string | undefined)?.toLowerCase() || "";
  return doc.exists && email === "admin@fitplan-ai.com";
}

function clampLimit(v: unknown, def: number, max: number): number {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : def;
  if (!Number.isFinite(n) || n < 1) return def;
  return Math.min(Math.floor(n), max);
}

type Row = { normKey: string; label: string; muscleLabels: string[] };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const userId = typeof req.query.userId === "string" ? req.query.userId.trim() : "";
  if (!userId) {
    return res.status(400).json({ error: "Falta userId" });
  }
  if (!(await assertAdmin(userId))) {
    return res.status(403).json({ error: "Solo administradores" });
  }

  const db = getAdminDb();
  if (!db) {
    return res.status(500).json({ error: "Firebase Admin no configurado" });
  }

  const limitIntake = clampLimit(req.query.limitIntake, 220, 400);
  const limitPlanes = clampLimit(req.query.limitPlanes, 120, 300);
  /** Máx. ejercicios sin catálogo a consultar contra wger en esta petición (evita timeout y rate limit). */
  const maxResolve = clampLimit(req.query.maxResolve, 20, 40);

  try {
    const [catalogEntries, buckets] = await Promise.all([
      adminListExerciseWgerCatalog(),
      loadUniquePlanExercisesForCatalog(db, { limitIntake, limitPlanes }),
    ]);

    const catalogNorm = new Set(catalogEntries.map((e) => e.normKey).filter(Boolean));

    const notInCatalog: Row[] = [];
    buckets.globalByNorm.forEach((g, normKey) => {
      if (catalogNorm.has(normKey)) return;
      const muscleLabels = Array.from(g.muscles).sort((x, y) => x.localeCompare(y, "es", { sensitivity: "base" }));
      notInCatalog.push({ normKey, label: g.label, muscleLabels });
    });
    notInCatalog.sort((a, b) => a.label.localeCompare(b.label, "es", { sensitivity: "base" }));

    const toProbe = notInCatalog.slice(0, maxResolve);
    const noMediaAnywhere: Row[] = [];
    const hasLibraryFallback: Row[] = [];

    const batchSignal = AbortSignal.timeout(55000);
    for (const row of toProbe) {
      const media = await resolveWgerExerciseMedia(row.label, batchSignal);
      if (media?.imageUrl) {
        hasLibraryFallback.push(row);
      } else {
        noMediaAnywhere.push(row);
      }
    }

    const skippedNotInCatalog = notInCatalog.length - toProbe.length;

    return res.status(200).json({
      noMediaAnywhere,
      hasLibraryFallback,
      probedNormKeys: toProbe.map((r) => r.normKey),
      meta: {
        uniqueInPlans: buckets.globalByNorm.size,
        catalogEntryCount: catalogEntries.length,
        inCatalogCount: buckets.globalByNorm.size - notInCatalog.length,
        notInCatalogCount: notInCatalog.length,
        probedThisRequest: toProbe.length,
        skippedDueToProbesLimit: skippedNotInCatalog,
        noMediaAmongProbed: noMediaAnywhere.length,
        libraryOkAmongProbed: hasLibraryFallback.length,
        maxResolve,
        ...buckets.meta,
      },
    });
  } catch (e) {
    console.error("exerciseCatalogMediaCoverage:", e);
    return res.status(500).json({ error: "No se pudo calcular la cobertura de ilustraciones" });
  }
}
