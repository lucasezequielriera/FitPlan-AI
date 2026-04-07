import type { Firestore } from "firebase-admin/firestore";
import { normalizeExerciseMediaKey } from "@/lib/exerciseMedia";
import { collectTrainingExercisesFromPlanRoot } from "@/lib/collectTrainingExercisesFromPlanRoot";

export type PlanExerciseCatalogBuckets = {
  globalByNorm: Map<string, { label: string; muscles: Set<string> }>;
  muscleBuckets: Map<string, { displayLabel: string; byNorm: Map<string, { label: string }> }>;
  meta: {
    intakeDocsScanned: number;
    intakeDocsWithTraining: number;
    planesDocsScanned: number;
    planesDocsWithTraining: number;
  };
};

/**
 * Agrega nombres de ejercicios de entrenamiento desde planes intake recientes y colección `planes`.
 */
export async function loadUniquePlanExercisesForCatalog(
  db: Firestore,
  opts: { limitIntake: number; limitPlanes: number }
): Promise<PlanExerciseCatalogBuckets> {
  const muscleBuckets = new Map<
    string,
    { displayLabel: string; byNorm: Map<string, { label: string }> }
  >();
  const globalByNorm = new Map<string, { label: string; muscles: Set<string> }>();

  const touch = (muscleKey: string, muscleLabel: string, exLabel: string) => {
    const nk = normalizeExerciseMediaKey(exLabel);
    if (!nk) return;
    const label = exLabel.trim();
    if (!muscleBuckets.has(muscleKey)) {
      muscleBuckets.set(muscleKey, { displayLabel: muscleLabel, byNorm: new Map() });
    }
    const b = muscleBuckets.get(muscleKey)!;
    const prev = b.byNorm.get(nk);
    if (!prev || label.length > prev.label.length) {
      b.byNorm.set(nk, { label });
    }

    let g = globalByNorm.get(nk);
    if (!g) {
      g = { label, muscles: new Set<string>() };
      globalByNorm.set(nk, g);
    }
    if (label.length > g.label.length) g.label = label;
    if (muscleLabel && muscleKey !== "__sin_grupo__") {
      g.muscles.add(muscleLabel);
    }
  };

  const [intakeSnap, planesSnap] = await Promise.all([
    db.collection("intakeClientPlans").orderBy("createdAt", "desc").limit(opts.limitIntake).get(),
    db.collection("planes").orderBy("createdAt", "desc").limit(opts.limitPlanes).get(),
  ]);

  let intakeWithTraining = 0;
  intakeSnap.forEach((doc) => {
    const d = doc.data() as Record<string, unknown>;
    if (d.includeTraining !== true) return;
    const plan = d.plan && typeof d.plan === "object" ? (d.plan as Record<string, unknown>) : null;
    if (!plan) return;
    intakeWithTraining += 1;
    for (const occ of collectTrainingExercisesFromPlanRoot(plan)) {
      touch(occ.muscleKey, occ.muscleLabel, occ.label);
    }
  });

  let planesWithTraining = 0;
  planesSnap.forEach((doc) => {
    const d = doc.data() as Record<string, unknown>;
    const plan = d.plan && typeof d.plan === "object" ? (d.plan as Record<string, unknown>) : null;
    if (!plan) return;
    const occs = collectTrainingExercisesFromPlanRoot(plan);
    if (occs.length === 0) return;
    planesWithTraining += 1;
    for (const occ of occs) {
      touch(occ.muscleKey, occ.muscleLabel, occ.label);
    }
  });

  return {
    globalByNorm,
    muscleBuckets,
    meta: {
      intakeDocsScanned: intakeSnap.size,
      intakeDocsWithTraining: intakeWithTraining,
      planesDocsScanned: planesSnap.size,
      planesDocsWithTraining: planesWithTraining,
    },
  };
}
