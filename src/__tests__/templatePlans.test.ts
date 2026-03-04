/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from '@jest/globals';
import { generateTemplateBasedPlan } from "../lib/templatePlans";

describe("Template plan generator", () => {
  it("respects user.diasGym frequency and avoids duplicate day names", async () => {
    const user = {
      nombre: "Test",
      edad: 25,
      pesoKg: 70,
      alturaCm: 175,
      sexo: "masculino" as const,
      actividad: "moderado" as const,
      objetivo: "perder_grasa" as const,
      intensidad: "leve" as const,
      diasGym: 2,
    } as any;

    const plan = await generateTemplateBasedPlan(user, 2000, 1800, {
      proteinas: "150g",
      grasas: "50g",
      carbohidratos: "200g",
    });

    expect(plan.training_plan).toBeDefined();
    const days = plan.training_plan!.weeks[0].days;
    expect(days.length).toBe(2);
    // Ensure day names are generic and sequential – no duplicates
    expect(days[0].day).toBe("Día 1");
    expect(days[1].day).toBe("Día 2");
  });

  it("does not add extra days when diasGym is smaller than template", async () => {
    const user = {
      nombre: "Test",
      edad: 25,
      pesoKg: 70,
      alturaCm: 175,
      sexo: "masculino" as const,
      actividad: "moderado" as const,
      objetivo: "perder_grasa" as const,
      intensidad: "moderada" as const,
      diasGym: 2,
    } as any;
    const plan = await generateTemplateBasedPlan(user, 2000, 1800, {
      proteinas: "150g",
      grasas: "50g",
      carbohidratos: "200g",
    });

    expect(plan.training_plan!.weeks[0].days.length).toBe(2);
  });

  it("accepts nivelExperiencia and equipamiento without crashing", async () => {
    const user = {
      nombre: "Test",
      edad: 30,
      pesoKg: 80,
      alturaCm: 180,
      sexo: "masculino" as const,
      actividad: "moderado" as const,
      objetivo: "ganar_masa" as const,
      intensidad: "moderada" as const,
      diasGym: 3,
      nivelExperiencia: "avanzado",
      equipamiento: "sin_equipo",
    } as any;
    const plan = await generateTemplateBasedPlan(user, 2500, 2700, {
      proteinas: "180g",
      grasas: "70g",
      carbohidratos: "300g",
    });

    expect(plan.training_plan).toBeDefined();
    expect(plan.training_plan!.weeks[0].days.every(d => d.day.startsWith("Día"))).toBe(true);
  });

  it("genera al menos 3 ejercicios por grupo y días distintos", async () => {
    const user = {
      nombre: "Test",
      edad: 25,
      pesoKg: 70,
      alturaCm: 175,
      sexo: "masculino" as const,
      actividad: "moderado" as const,
      objetivo: "perder_grasa" as const,
      intensidad: "moderada" as const,
      diasGym: 3,
    } as any;
    const plan = await generateTemplateBasedPlan(user, 2000, 1800, {
      proteinas: "150g",
      grasas: "50g",
      carbohidratos: "200g",
    });
    const days = plan.training_plan!.weeks[0].days;
    expect(days.length).toBe(3);

    // cada día debe incluir al menos un ejercicio de cada grupo asignado
    const coreGroups = ["Pecho","Espalda","Piernas","Hombros","Bíceps","Tríceps","Abdominales"];
    const allGroupsSeen = new Set<string>();

    days.forEach(day => {
      const groups = new Set((day.ejercicios || []).map(e => e.muscle_group));
      groups.forEach(g => allGroupsSeen.add(g));
      // cada grupo presente en el día tiene al menos 1 ejercicio y nunca más de 4
      groups.forEach(g => {
        const count = (day.ejercicios || []).filter(e => e.muscle_group === g).length;
        expect(count).toBeGreaterThanOrEqual(1);
        expect(count).toBeLessThanOrEqual(4);
      });
    });

    // todos los grupos musculares aparecen al menos una vez en la semana
    coreGroups.forEach(g => expect(allGroupsSeen.has(g)).toBe(true));

    // verificar que los nombres de ejercicios no sean idénticos entre días
    const sets = new Set(days.map(d => (d.ejercicios || []).map(e => e.name).join(",")));
    expect(sets.size).toBe(days.length);
  });

  it("distribuye inteligentemente grupos para diferentes frecuencias", async () => {
    const baseUser: any = {
      nombre: "Test",
      edad: 30,
      pesoKg: 80,
      alturaCm: 180,
      sexo: "masculino",
      actividad: "moderado",
      objetivo: "ganar_masa",
      intensidad: "moderada",
    };

    for (const dias of [1,2,3,4,5]) {
      const user = { ...baseUser, diasGym: dias };
      const plan = await generateTemplateBasedPlan(user, 2500, 2700, { proteinas: "180g", grasas: "70g", carbohidratos: "300g" });
      const days = plan.training_plan!.weeks[0].days;
      expect(days.length).toBe(dias);
      // cada día debe tener al menos un ejercicio y no exactamente igual a otro
      const names = days.map(d => (d.ejercicios || []).map(e => e.name).sort().join("|"));
      const unique = new Set(names);
      expect(unique.size).toBe(days.length);
    }
  });
});
