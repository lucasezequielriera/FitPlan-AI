import {
  applyGoalCalories,
  calculateBMR,
  calculateTDEE,
  clampCaloriesToSafeFloor,
  splitMacros,
} from "@/utils/calculations";

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

  describe("clampCaloriesToSafeFloor", () => {
    test("leaves a sane calorie target untouched", () => {
      expect(clampCaloriesToSafeFloor(2000, 1600, "masculino")).toBe(2000);
    });

    test("raises a dangerously low target up to the absolute minimum (small sedentary woman, aggressive cut)", () => {
      // 145cm/45kg/50y/sedentaria + perder_grasa+ultra da ~334 kcal sin piso
      const bmr = calculateBMR(45, 145, 50, "femenino");
      const clamped = clampCaloriesToSafeFloor(334, bmr, "femenino");
      expect(clamped).toBeGreaterThanOrEqual(1200);
      expect(clamped).toBeGreaterThanOrEqual(bmr);
    });

    test("uses BMR as the floor when BMR is above the absolute minimum", () => {
      expect(clampCaloriesToSafeFloor(1000, 1800, "masculino")).toBe(1800);
    });

    test("never returns below the absolute minimum for men (1500) or women (1200)", () => {
      expect(clampCaloriesToSafeFloor(100, 900, "masculino")).toBe(1500);
      expect(clampCaloriesToSafeFloor(100, 900, "femenino")).toBe(1200);
    });
  });
});

