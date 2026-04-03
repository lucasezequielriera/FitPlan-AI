/**
 * Macros aproximados por comida (g/día distribuidos).
 * Usado en planes IA y plantillas para que el admin/export muestre P/G/CHO por comida.
 */

export function parseMacroGrams(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.round(value));
  const s = String(value ?? "")
    .replace(/\s/g, "")
    .replace(",", ".");
  const m = s.match(/([\d.]+)/);
  if (!m) return 0;
  const n = Number(m[1]);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
}

function mealWeights(mealCount: number): number[] {
  if (mealCount === 4) return [0.25, 0.35, 0.12, 0.28];
  if (mealCount === 5) return [0.22, 0.28, 0.1, 0.12, 0.28];
  const w = 1 / Math.max(1, mealCount);
  return Array.from({ length: mealCount }, () => w);
}

function distributeGrams(total: number, weights: number[]): number[] {
  if (total <= 0) return weights.map(() => 0);
  const raw = weights.map((w) => Math.round(total * w));
  let diff = total - raw.reduce((a, b) => a + b, 0);
  if (raw.length > 0 && diff !== 0) raw[raw.length - 1] += diff;
  return raw;
}

/** Rellena o completa macros_aprox en cada comida; muta planSemanal in-place. */
export function ensureMealMacrosAprox(
  planSemanal: Array<Record<string, unknown>> | undefined,
  dailyMacros: { proteinas: string; grasas: string; carbohidratos: string }
): void {
  if (!Array.isArray(planSemanal) || planSemanal.length === 0) return;
  const pTotal = parseMacroGrams(dailyMacros.proteinas);
  const fTotal = parseMacroGrams(dailyMacros.grasas);
  const cTotal = parseMacroGrams(dailyMacros.carbohidratos);
  if (pTotal <= 0 && fTotal <= 0 && cTotal <= 0) return;

  for (const day of planSemanal) {
    const meals = Array.isArray(day.comidas) ? (day.comidas as Array<Record<string, unknown>>) : [];
    if (meals.length === 0) continue;
    const w = mealWeights(meals.length);
    const pParts = distributeGrams(pTotal, w);
    const fParts = distributeGrams(fTotal, w);
    const cParts = distributeGrams(cTotal, w);

    meals.forEach((meal, i) => {
      const existing =
        meal.macros_aprox && typeof meal.macros_aprox === "object"
          ? (meal.macros_aprox as Record<string, unknown>)
          : {};
      const pg =
        typeof existing.proteinas_g === "number" && existing.proteinas_g > 0 ? existing.proteinas_g : pParts[i] ?? 0;
      const fg = typeof existing.grasas_g === "number" && existing.grasas_g > 0 ? existing.grasas_g : fParts[i] ?? 0;
      const cg =
        typeof existing.carbohidratos_g === "number" && existing.carbohidratos_g > 0
          ? existing.carbohidratos_g
          : cParts[i] ?? 0;
      meal.macros_aprox = { proteinas_g: pg, grasas_g: fg, carbohidratos_g: cg };
    });
  }
}
