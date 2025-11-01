import { generateAIPlan } from "@/lib/aiPlanGenerator";

const baseUser = {
  nombre: "Test",
  edad: 25,
  pesoKg: 70,
  alturaCm: 175,
  sexo: "masculino" as const,
  actividad: "moderado" as const,
  objetivo: "mantener" as const,
};

describe("aiPlanGenerator", () => {
  test("returns weekly plan with required fields", () => {
    const plan = generateAIPlan(baseUser);
    expect(plan.calorias_diarias).toBeGreaterThan(0);
    expect(plan.macros).toBeDefined();
    expect(plan.plan_semanal.length).toBe(7);
    expect(plan.plan_semanal[0].comidas.length).toBeGreaterThanOrEqual(4);
  });
});

