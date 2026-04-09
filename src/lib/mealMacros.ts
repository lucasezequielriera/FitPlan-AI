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

function distributeByProportions(total: number, values: number[]): number[] {
  if (total <= 0 || values.length === 0) return values.map(() => 0);
  const safe = values.map((v) => (Number.isFinite(v) && v > 0 ? v : 0));
  const sum = safe.reduce((a, b) => a + b, 0);
  if (sum <= 0) return distributeGrams(total, Array.from({ length: values.length }, () => 1 / values.length));
  const raw = safe.map((v) => Math.round((v / sum) * total));
  let diff = total - raw.reduce((a, b) => a + b, 0);
  if (diff !== 0 && raw.length > 0) raw[raw.length - 1] += diff;
  return raw;
}

function buildPortionGuide(pg: number, fg: number, cg: number): {
  proteinaMagraG: number;
  carboComplejoCocidoG: number;
  grasaSaludableG: number;
  guia: string[];
} {
  const proteinaMagraG = Math.max(0, Math.round(pg / 0.24)); // pollo/pavo/pescado aprox 24g prot / 100g
  const carboComplejoCocidoG = Math.max(0, Math.round(cg / 0.28)); // arroz/pasta cocidos aprox 28g carb / 100g
  const grasaSaludableG = Math.max(0, Math.round(fg / 0.9)); // aceite/frutos secos aprox 90g grasa / 100g
  const guia = [
    `Proteína magra: ~${proteinaMagraG} g`,
    `Carbohidrato complejo cocido: ~${carboComplejoCocidoG} g`,
    `Grasa saludable: ~${grasaSaludableG} g`,
    "Vegetales: libres (1-2 tazas)",
  ];
  return { proteinaMagraG, carboComplejoCocidoG, grasaSaludableG, guia };
}

function optionSpecificPortions(
  optionText: string,
  portions: { proteinaMagraG: number; carboComplejoCocidoG: number; grasaSaludableG: number }
): string[] {
  const t = optionText.toLowerCase();
  const proteinFood =
    /huevo|huevos|claras/.test(t)
      ? `Huevos: ~${Math.max(1, Math.round(portions.proteinaMagraG / 55))} unid`
      : /atun|atún/.test(t)
        ? `Atún al natural: ~${Math.round(portions.proteinaMagraG)} g`
        : /salm|pescado|merluza|pollo|pavo|carne|ternera/.test(t)
          ? `Proteína principal: ~${Math.round(portions.proteinaMagraG)} g`
          : `Proteína: ~${Math.round(portions.proteinaMagraG)} g`;
  const arrozCrudoEq = Math.max(15, Math.round(portions.carboComplejoCocidoG / 2.8));
  const pastaSecaEq = Math.max(20, Math.round(portions.carboComplejoCocidoG / 2.4));
  const carbFood =
    /arroz/.test(t)
      ? `Arroz cocido: ~${Math.round(portions.carboComplejoCocidoG)} g (≈ ${arrozCrudoEq} g crudo)`
      : /pasta/.test(t)
        ? `Pasta cocida: ~${Math.round(portions.carboComplejoCocidoG)} g (≈ ${pastaSecaEq} g seca)`
        : /avena/.test(t)
          ? `Avena en seco: ~${Math.max(20, Math.round(portions.carboComplejoCocidoG * 0.4))} g (≈ ${Math.max(120, Math.round(portions.carboComplejoCocidoG))} g cocida)`
          : /pan|tostada/.test(t)
            ? `Pan integral: ~${Math.max(30, Math.round(portions.carboComplejoCocidoG * 0.45))} g (≈ ${Math.max(1, Math.round(Math.max(30, Math.round(portions.carboComplejoCocidoG * 0.45)) / 30))} rebanadas)`
            : /fruta|banana|plátano|manzana/.test(t)
              ? `Fruta: ~${Math.max(120, Math.round(portions.carboComplejoCocidoG * 1.1))} g`
              : `Carbohidrato principal: ~${Math.round(portions.carboComplejoCocidoG)} g`;
  const fatFood =
    /aguacate|palta/.test(t)
      ? `Aguacate: ~${Math.max(20, Math.round(portions.grasaSaludableG * 3.3))} g`
      : /nuez|almendra|mani|maní|frutos secos/.test(t)
        ? `Frutos secos: ~${Math.max(8, Math.round(portions.grasaSaludableG * 1.15))} g`
        : /aceite/.test(t)
          ? `Aceite de oliva: ~${Math.max(4, Math.round(portions.grasaSaludableG))} g (≈ ${Math.max(1, Math.round(Math.max(4, Math.round(portions.grasaSaludableG)) / 5))} cdtas)`
          : `Grasa saludable: ~${Math.max(4, Math.round(portions.grasaSaludableG))} g`;
  return [proteinFood, carbFood, fatFood];
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

    const existingP = meals.map((meal) => {
      const existing = meal.macros_aprox && typeof meal.macros_aprox === "object" ? (meal.macros_aprox as Record<string, unknown>) : {};
      return typeof existing.proteinas_g === "number" && Number.isFinite(existing.proteinas_g) ? Math.max(0, Math.round(existing.proteinas_g)) : 0;
    });
    const existingF = meals.map((meal) => {
      const existing = meal.macros_aprox && typeof meal.macros_aprox === "object" ? (meal.macros_aprox as Record<string, unknown>) : {};
      return typeof existing.grasas_g === "number" && Number.isFinite(existing.grasas_g) ? Math.max(0, Math.round(existing.grasas_g)) : 0;
    });
    const existingC = meals.map((meal) => {
      const existing = meal.macros_aprox && typeof meal.macros_aprox === "object" ? (meal.macros_aprox as Record<string, unknown>) : {};
      return typeof existing.carbohidratos_g === "number" && Number.isFinite(existing.carbohidratos_g)
        ? Math.max(0, Math.round(existing.carbohidratos_g))
        : 0;
    });

    const hasExistingAny = existingP.some((v) => v > 0) || existingF.some((v) => v > 0) || existingC.some((v) => v > 0);
    const pParts = hasExistingAny ? distributeByProportions(pTotal, existingP) : distributeGrams(pTotal, w);
    const fParts = hasExistingAny ? distributeByProportions(fTotal, existingF) : distributeGrams(fTotal, w);
    const cParts = hasExistingAny ? distributeByProportions(cTotal, existingC) : distributeGrams(cTotal, w);

    meals.forEach((meal, i) => {
      const pg = pParts[i] ?? 0;
      const fg = fParts[i] ?? 0;
      const cg = cParts[i] ?? 0;
      meal.macros_aprox = { proteinas_g: pg, grasas_g: fg, carbohidratos_g: cg };
      const portions = buildPortionGuide(pg, fg, cg);
      meal.porciones_aprox = portions;
      const option0 = Array.isArray(meal.opciones) ? String((meal.opciones as unknown[])[0] || "") : "";
      meal.porciones_opcion_aprox = optionSpecificPortions(option0, portions);
    });

    day.macro_alignment = {
      target: { proteinas_g: pTotal, grasas_g: fTotal, carbohidratos_g: cTotal },
      actual: {
        proteinas_g: pParts.reduce((a, b) => a + b, 0),
        grasas_g: fParts.reduce((a, b) => a + b, 0),
        carbohidratos_g: cParts.reduce((a, b) => a + b, 0),
      },
      status: "normalized",
    };
  }
}
