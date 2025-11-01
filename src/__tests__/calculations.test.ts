import { applyGoalCalories, calculateBMR, calculateTDEE, splitMacros } from "@/utils/calculations";

describe("calculation utilities", () => {
  test("calculates BMR (Mifflin-St Jeor)", () => {
    expect(calculateBMR(70, 175, 25, "masculino")).toBeGreaterThan(1500);
  });

  test("applies activity to get TDEE", () => {
    const bmr = 1600;
    expect(calculateTDEE(bmr, "moderado")).toBe(Math.round(1600 * 1.55));
  });

  test("goal calories adjustment", () => {
    expect(applyGoalCalories(2500, "perder_grasa")).toBe(2000);
    expect(applyGoalCalories(2500, "ganar_masa")).toBe(2875);
  });

  test("macro split returns strings with g", () => {
    const m = splitMacros(2200, 70, "mantener");
    expect(m.proteinas.endsWith("g")).toBe(true);
    expect(m.grasas.endsWith("g")).toBe(true);
    expect(m.carbohidratos.endsWith("g")).toBe(true);
  });
});

