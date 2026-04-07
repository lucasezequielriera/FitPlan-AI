import type { NextApiRequest, NextApiResponse } from "next";
import { getAdminDb } from "@/lib/firebase-admin";
import { loadUniquePlanExercisesForCatalog } from "@/lib/planExerciseCatalogIndexServer";
import { adminListExerciseWgerCatalog } from "@/lib/exerciseWgerCatalogServer";

async function assertAdmin(userId: string): Promise<boolean> {
  const db = getAdminDb();
  if (!db) return false;
  const doc = await db.collection("usuarios").doc(userId).get();
  const email = (doc.data()?.email as string | undefined)?.toLowerCase() || "";
  return doc.exists && email === "admin@fitplan-ai.com";
}

type ExerciseRow = { normKey: string; label: string; inCatalog: boolean };
type MuscleGroupRow = { key: string; label: string; exercises: ExerciseRow[]; missingInCatalog: number };
type AllRow = ExerciseRow & { muscleLabels: string[] };

function clampLimit(v: unknown, def: number, max: number): number {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : def;
  if (!Number.isFinite(n) || n < 1) return def;
  return Math.min(Math.floor(n), max);
}

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

  try {
    const [catalogEntries, buckets] = await Promise.all([
      adminListExerciseWgerCatalog(),
      loadUniquePlanExercisesForCatalog(db, { limitIntake, limitPlanes }),
    ]);

    const catalogNorm = new Set(catalogEntries.map((e) => e.normKey).filter(Boolean));

    const toRows = (byNorm: Map<string, { label: string }>): ExerciseRow[] => {
      const rows: ExerciseRow[] = [];
      byNorm.forEach((v, normKey) => {
        rows.push({ normKey, label: v.label, inCatalog: catalogNorm.has(normKey) });
      });
      rows.sort((a, b) => {
        if (a.inCatalog !== b.inCatalog) return a.inCatalog ? 1 : -1;
        return a.label.localeCompare(b.label, "es", { sensitivity: "base" });
      });
      return rows;
    };

    const muscleGroups: MuscleGroupRow[] = [];
    buckets.muscleBuckets.forEach((bucket, key) => {
      const exercises = toRows(bucket.byNorm);
      muscleGroups.push({
        key,
        label: bucket.displayLabel,
        exercises,
        missingInCatalog: exercises.filter((e) => !e.inCatalog).length,
      });
    });

    muscleGroups.sort((a, b) => {
      if (a.key === "__sin_grupo__") return 1;
      if (b.key === "__sin_grupo__") return -1;
      return a.label.localeCompare(b.label, "es", { sensitivity: "base" });
    });

    const allExercises: AllRow[] = [];
    buckets.globalByNorm.forEach((g, normKey) => {
      const muscleLabels = Array.from(g.muscles).sort((x, y) => x.localeCompare(y, "es", { sensitivity: "base" }));
      allExercises.push({
        normKey,
        label: g.label,
        inCatalog: catalogNorm.has(normKey),
        muscleLabels,
      });
    });
    allExercises.sort((a, b) => {
      if (a.inCatalog !== b.inCatalog) return a.inCatalog ? 1 : -1;
      return a.label.localeCompare(b.label, "es", { sensitivity: "base" });
    });

    return res.status(200).json({
      muscleGroups,
      allExercises,
      meta: {
        catalogEntryCount: catalogEntries.length,
        uniqueInPlans: buckets.globalByNorm.size,
        intakeDocsScanned: buckets.meta.intakeDocsScanned,
        intakeDocsWithTraining: buckets.meta.intakeDocsWithTraining,
        planesDocsScanned: buckets.meta.planesDocsScanned,
        planesDocsWithTraining: buckets.meta.planesDocsWithTraining,
      },
    });
  } catch (e) {
    console.error("exerciseCatalogPlanMuscleIndex:", e);
    return res.status(500).json({ error: "No se pudo armar el índice de ejercicios" });
  }
}
