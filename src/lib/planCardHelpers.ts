import type { SavedPlan } from "@/types/savedPlan";

/** Texto de peso objetivo "XX kg" para la flecha en tarjetas (misma lógica que el dashboard). */
export function getPlanTargetWeightLine(plan: SavedPlan): string | null {
  const user = plan.plan?.user as Record<string, unknown> | undefined;
  if (!user) return null;
  const pesoRaw = user.pesoKg;
  if (pesoRaw === undefined || pesoRaw === null || Number(pesoRaw) === 0) return null;
  const objetivo = String(user.objetivo || "");
  if (objetivo === "mantener" || objetivo === "mantenimiento_avanzado") return null;

  const pesoKg = typeof pesoRaw === "number" ? pesoRaw : Number(pesoRaw) || 0;

  if (objetivo === "bulk_cut" || objetivo === "lean_bulk") {
    const pesoObjetivo =
      plan.planMultiFase?.pesoObjetivoFinal ?? user.pesoObjetivoKg;
    if (pesoObjetivo != null && String(pesoObjetivo) !== "") return `${pesoObjetivo} kg`;
    return objetivo === "bulk_cut" ? `${Math.round(pesoKg * 1.1)} kg` : `${Math.round(pesoKg * 1.08)} kg`;
  }
  if (objetivo === "perder_grasa") return `${Math.max(1, Math.round(pesoKg * 0.95))} kg`;
  if (objetivo === "definicion") return `${Math.max(1, Math.round(pesoKg * 0.92))} kg`;
  if (objetivo === "corte") return `${Math.max(1, Math.round(pesoKg * 0.9))} kg`;
  if (objetivo === "ganar_masa") return `${Math.round(pesoKg * 1.05)} kg`;
  if (objetivo === "volumen") return `${Math.round(pesoKg * 1.08)} kg`;
  if (objetivo === "powerlifting") return `${Math.round(pesoKg * 1.1)} kg`;
  if (objetivo === "rendimiento_deportivo") return `${pesoKg} kg`;
  if (objetivo === "atleta_elite") return `${pesoKg} kg`;
  if (objetivo === "resistencia") return `${Math.round(pesoKg * 0.98)} kg`;
  if (objetivo === "recomposicion") return `${pesoKg} kg`;
  return `${pesoKg} kg`;
}
