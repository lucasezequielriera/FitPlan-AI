import {
  applyTrainingPlanPostProcess,
  blobSuggestsKneeCare,
  buildTrainingConstraintBlob,
  filterUnsafeExercisesByDoloresLesiones,
  sanitizeTrainingRepsValue,
  shouldBlockSquatsAndLunges,
} from "@/lib/trainingPlanGuards";

describe("blobSuggestsKneeCare", () => {
  test("detecta menciones directas de rodilla", () => {
    expect(blobSuggestsKneeCare("dolor de rodilla derecha")).toBe(true);
  });

  test("detecta menisco y ligamento cruzado", () => {
    expect(blobSuggestsKneeCare("rotura de menisco hace 2 años")).toBe(true);
    expect(blobSuggestsKneeCare("lesión de ligamento cruzado anterior")).toBe(true);
  });

  test("no detecta lesiones ajenas a la rodilla", () => {
    expect(blobSuggestsKneeCare("dolor de hombro al levantar peso")).toBe(false);
  });
});

describe("shouldBlockSquatsAndLunges", () => {
  test("bloquea si el coach lo indica explícitamente aunque el texto no lo sugiera", () => {
    expect(
      shouldBlockSquatsAndLunges({ textBlob: "sin lesiones reportadas", coachAvoidSquats: true })
    ).toBe(true);
  });

  test("bloquea si el texto sugiere cuidado de rodilla aunque el coach no lo haya marcado", () => {
    expect(
      shouldBlockSquatsAndLunges({ textBlob: "operado de rodilla el año pasado", coachAvoidSquats: false })
    ).toBe(true);
  });

  test("no bloquea cuando no hay señales de ninguna fuente", () => {
    expect(
      shouldBlockSquatsAndLunges({ textBlob: "usuario sano, sin lesiones", coachAvoidSquats: false })
    ).toBe(false);
  });
});

describe("sanitizeTrainingRepsValue", () => {
  test("convierte 'segundos reps' a segundos", () => {
    expect(sanitizeTrainingRepsValue("30 segundos reps")).toBe("30 s");
  });

  test("convierte 'minutos reps' a minutos", () => {
    expect(sanitizeTrainingRepsValue("2 minutos reps")).toBe("2 min");
  });

  test("elimina un sufijo 'reps' colgado al final", () => {
    expect(sanitizeTrainingRepsValue("12-15 reps")).toBe("12-15");
  });

  test("deja intacto un valor ya limpio", () => {
    expect(sanitizeTrainingRepsValue("8-10")).toBe("8-10");
  });
});

describe("filterUnsafeExercisesByDoloresLesiones", () => {
  test("sin dolores/lesiones reportadas devuelve la lista intacta", () => {
    const ejercicios = [{ name: "Sentadilla" }, { name: "Press banca" }];
    expect(filterUnsafeExercisesByDoloresLesiones(ejercicios, undefined)).toEqual(ejercicios);
    expect(filterUnsafeExercisesByDoloresLesiones(ejercicios, [])).toEqual(ejercicios);
  });

  test("hernia de disco excluye peso muerto, sentadilla y remo con barra", () => {
    const ejercicios = [
      { name: "Peso muerto" },
      { name: "Sentadilla" },
      { name: "Remo con barra" },
      { name: "Curl de bíceps" },
    ];
    const result = filterUnsafeExercisesByDoloresLesiones(ejercicios, ["hernia de disco lumbar"]);
    const names = result.map((e) => e.name);
    expect(names).toEqual(["Curl de bíceps"]);
  });

  test("dolor de hombro excluye press militar pero conserva ejercicios de piernas", () => {
    const ejercicios = [{ name: "Press militar" }, { name: "Sentadilla" }, { name: "Curl de bíceps" }];
    const result = filterUnsafeExercisesByDoloresLesiones(ejercicios, ["dolor de hombro"]);
    const names = result.map((e) => e.name);
    expect(names).toContain("Sentadilla");
    expect(names).toContain("Curl de bíceps");
    expect(names).not.toContain("Press militar");
  });

  test("dolor de rodilla excluye zancadas y sentadillas", () => {
    const ejercicios = [{ name: "Zancada con mancuernas" }, { name: "Sentadilla" }, { name: "Press banca" }];
    const result = filterUnsafeExercisesByDoloresLesiones(ejercicios, ["dolor de rodilla"]);
    const names = result.map((e) => e.name);
    expect(names).toEqual(["Press banca"]);
  });
});

describe("buildTrainingConstraintBlob", () => {
  test("combina doloresLesiones, formData y comentario del coach en minúsculas", () => {
    const blob = buildTrainingConstraintBlob(
      { lesionesDolores: "Rodilla derecha operada", patologias: ["Hernia discal"] },
      ["Molestia en hombro"],
      "Evitar sentadillas por indicación médica"
    );
    expect(blob).toContain("molestia en hombro");
    expect(blob).toContain("rodilla derecha operada");
    expect(blob).toContain("hernia discal");
    expect(blob).toContain("evitar sentadillas");
    expect(blob).toBe(blob.toLowerCase());
  });
});

describe("applyTrainingPlanPostProcess", () => {
  function buildPlan(exerciseName: string) {
    return {
      training_plan: {
        weeks: [
          {
            days: [
              {
                ejercicios: [{ name: exerciseName, reps: "12 reps" }],
              },
            ],
          },
        ],
      },
    };
  }

  test("sin bloqueo de sentadillas, solo sanea el formato de reps", () => {
    const plan = buildPlan("Sentadilla libre");
    const replaced = applyTrainingPlanPostProcess(plan, { blockSquatsLunges: false });
    expect(replaced).toBe(0);
    const ex = plan.training_plan.weeks[0].days[0].ejercicios[0];
    expect(ex.name).toBe("Sentadilla libre");
    expect(ex.reps).toBe("12");
  });

  test("con bloqueo activo, sustituye sentadillas/zancadas por una alternativa segura", () => {
    const plan = buildPlan("Sentadilla libre");
    const replaced = applyTrainingPlanPostProcess(plan, { blockSquatsLunges: true });
    expect(replaced).toBe(1);
    const ex = plan.training_plan.weeks[0].days[0].ejercicios[0] as Record<string, unknown>;
    expect(ex.name).toBe("Extensión de cuádriceps en máquina (ROM corto, controlado)");
    expect(String(ex.alternative)).toContain("Sentadilla libre");
    expect(plan.training_plan.weeks[0]).toHaveProperty(
      "days.0.ejercicios.0.name",
      "Extensión de cuádriceps en máquina (ROM corto, controlado)"
    );
    expect((plan.training_plan as Record<string, unknown>).safety_notes).toBeDefined();
  });

  test("con bloqueo activo pero sin ejercicios prohibidos, no sustituye nada y no rompe", () => {
    const plan = buildPlan("Press banca");
    const replaced = applyTrainingPlanPostProcess(plan, { blockSquatsLunges: true });
    expect(replaced).toBe(0);
    const ex = plan.training_plan.weeks[0].days[0].ejercicios[0];
    expect(ex.name).toBe("Press banca");
  });

  test("maneja un training_plan ausente o mal formado sin lanzar excepción", () => {
    expect(applyTrainingPlanPostProcess({}, { blockSquatsLunges: true })).toBe(0);
    expect(applyTrainingPlanPostProcess({ training_plan: null }, { blockSquatsLunges: true })).toBe(0);
  });
});
