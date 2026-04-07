import { normalizeExerciseMediaKey } from "@/lib/exerciseMedia";
import {
  exerciseName,
  getDayExercises,
  getWeekDays,
  normalizeTrainingWeeksForExport,
  resolveTrainingPlan,
} from "@/lib/intakePlanExcel";

function safeStr(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v);
}

export type CollectedPlanExercise = {
  normKey: string;
  label: string;
  muscleKey: string;
  muscleLabel: string;
};

function muscleMeta(ex: Record<string, unknown>): { muscleKey: string; muscleLabel: string } {
  const raw = safeStr(ex.muscle_group ?? ex.musculo ?? ex.grupo_muscular ?? "").trim();
  if (!raw) {
    return { muscleKey: "__sin_grupo__", muscleLabel: "Sin grupo muscular" };
  }
  const muscleKey = normalizeExerciseMediaKey(raw) || "__sin_grupo__";
  return { muscleKey, muscleLabel: raw };
}

/**
 * Extrae ejercicios de entrenamiento de la raíz de un plan (training_plan / trainingPlan).
 */
export function collectTrainingExercisesFromPlanRoot(planRoot: Record<string, unknown>): CollectedPlanExercise[] {
  const tp = resolveTrainingPlan(planRoot);
  if (!tp) return [];
  const weeks = normalizeTrainingWeeksForExport(tp.weeks);
  const out: CollectedPlanExercise[] = [];
  for (const week of weeks) {
    for (const day of getWeekDays(week)) {
      for (const ex of getDayExercises(day)) {
        const label = exerciseName(ex).trim();
        if (!label || label === "Ejercicio") continue;
        const normKey = normalizeExerciseMediaKey(label);
        if (!normKey) continue;
        const m = muscleMeta(ex);
        out.push({ normKey, label, muscleKey: m.muscleKey, muscleLabel: m.muscleLabel });
      }
    }
  }
  return out;
}
