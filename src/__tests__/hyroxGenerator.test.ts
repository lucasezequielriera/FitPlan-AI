import { addDays, generatePlan, mondayOnOrAfter } from "@/lib/hyrox/generator";
import { emptyProfile, type Equipment, type HyroxProfile, type RunningBase } from "@/lib/hyrox/profile";
import type { Division } from "@/lib/hyrox/profile";

/**
 * El generador es lo que el usuario ve. Un plan con una sesión vacía, una
 * semana duplicada o un volumen que no progresa destruye la confianza en el
 * producto entero — y son fallos que no lanzan ninguna excepción.
 *
 * Por eso, además de los casos concretos, hay barridos sobre TODAS las
 * combinaciones de perfil: es la única forma de saber que no hay un hueco.
 */

const HOY = "2026-09-07"; // lunes

function raceIn(weeks: number): string {
  const base = new Date("2026-09-07T00:00:00Z");
  base.setUTCDate(base.getUTCDate() + weeks * 7);
  return base.toISOString().slice(0, 10);
}

function profile(over: Partial<HyroxProfile> = {}): HyroxProfile {
  return { ...(emptyProfile() as HyroxProfile), raceDate: raceIn(15), ...over };
}

describe("mondayOnOrAfter", () => {
  it("un lunes se queda igual", () => {
    expect(mondayOnOrAfter("2026-09-07")).toBe("2026-09-07");
  });

  it("un martes salta al lunes siguiente", () => {
    expect(mondayOnOrAfter("2026-09-08")).toBe("2026-09-14");
  });

  it("un domingo salta al lunes de mañana", () => {
    expect(mondayOnOrAfter("2026-09-13")).toBe("2026-09-14");
  });

  it("cruza bien el fin de mes y de año", () => {
    expect(mondayOnOrAfter("2026-12-30")).toBe("2027-01-04");
  });
});

describe("addDays", () => {
  it("cruza meses y años", () => {
    expect(addDays("2026-12-30", 7)).toBe("2027-01-06");
    expect(addDays("2026-02-27", 2)).toBe("2026-03-01");
  });
});

describe("generatePlan — estructura", () => {
  it("genera exactamente las semanas de la periodización", () => {
    const plan = generatePlan(profile(), HOY);
    expect(plan.weeks).toHaveLength(plan.periodization.totalWeeks);
  });

  it("las semanas van numeradas y ordenadas sin huecos", () => {
    const plan = generatePlan(profile(), HOY);
    plan.weeks.forEach((w, i) => expect(w.week).toBe(i + 1));
  });

  it("cada semana empieza un lunes y siete días después de la anterior", () => {
    const plan = generatePlan(profile(), HOY);
    for (let i = 1; i < plan.weeks.length; i++) {
      expect(plan.weeks[i].startDate).toBe(addDays(plan.weeks[i - 1].startDate, 7));
    }
  });

  it("toda semana tiene los 7 días, sin repetir ninguno", () => {
    const plan = generatePlan(profile({ daysPerWeek: 5 }), HOY);
    for (const w of plan.weeks) {
      expect(w.sessions).toHaveLength(7);
      expect(new Set(w.sessions.map((s) => s.day)).size).toBe(7);
    }
  });

  it("ninguna sesión llega vacía de contenido", () => {
    // Un bloque vacío no lanza ningún error: simplemente el usuario abre su
    // plan y ve un día en blanco. Hay que detectarlo aquí.
    for (const days of [3, 4, 5, 6]) {
      const plan = generatePlan(profile({ daysPerWeek: days }), HOY);
      for (const w of plan.weeks) {
        for (const s of w.sessions) {
          expect({ dia: s.day, titulo: s.title.length > 0 }).toEqual({ dia: s.day, titulo: true });
          expect(s.focus.length).toBeGreaterThan(0);
          expect(s.blocks.length).toBeGreaterThan(0);
          for (const b of s.blocks) expect(b.trim().length).toBeGreaterThan(0);
        }
      }
    }
  });
});

describe("generatePlan — respeta los días disponibles", () => {
  it("entrena exactamente los días que dijo el usuario", () => {
    for (const days of [3, 4, 5, 6]) {
      const plan = generatePlan(profile({ daysPerWeek: days }), HOY);
      for (const w of plan.weeks) {
        const entrenos = w.sessions.filter((s) => s.type !== "descanso").length;
        expect({ days, entrenos }).toEqual({ days, entrenos: days });
      }
    }
  });

  it("con pocos días NUNCA se sacrifica la sesión específica de HYROX", () => {
    // Es la sesión que decide la prueba: si se cae, el plan deja de ser un plan
    // de HYROX y pasa a ser un plan de gimnasio con carrera.
    const plan = generatePlan(profile({ daysPerWeek: 3 }), HOY);
    for (const w of plan.weeks) {
      expect(w.sessions.some((s) => s.type === "hyrox")).toBe(true);
    }
  });
});

describe("generatePlan — barrido de todas las combinaciones de perfil", () => {
  it("ningún perfil produce un plan roto", () => {
    const divisions: Division[] = ["individual", "doubles", "relay"];
    const bases: RunningBase[] = ["ninguna", "poca", "solida"];
    const equipos: Equipment[] = ["completo", "gimnasio", "casa"];

    for (const division of divisions) {
      for (const runningBase of bases) {
        for (const equipment of equipos) {
          for (const daysPerWeek of [3, 4, 5, 6]) {
            for (const semanas of [4, 8, 12, 16, 20]) {
              const plan = generatePlan(
                profile({ division, runningBase, equipment, daysPerWeek, raceDate: raceIn(semanas) }),
                HOY
              );
              const id = { division, runningBase, equipment, daysPerWeek, semanas };
              expect({ ...id, semanasGeneradas: plan.weeks.length }).toEqual({
                ...id,
                semanasGeneradas: plan.periodization.totalWeeks,
              });
              expect({ ...id, vacias: plan.weeks.filter((w) => w.sessions.length !== 7).length }).toEqual({
                ...id,
                vacias: 0,
              });
            }
          }
        }
      }
    }
  });
});

describe("generatePlan — la progresión tiene sentido", () => {
  it("la carrera larga crece a lo largo del plan", () => {
    const plan = generatePlan(profile({ daysPerWeek: 5, runningBase: "poca", raceDate: raceIn(16) }), HOY);
    const minutos = plan.weeks
      .filter((w) => !w.deload && w.phase !== "taper")
      .map((w) => {
        const larga = w.sessions.find((s) => s.day === "Sábado")!;
        return Number(larga.title.match(/(\d+)'/)?.[1] ?? 0);
      });
    expect(minutos[minutos.length - 1]).toBeGreaterThan(minutos[0]);
  });

  it("las semanas de descarga bajan el volumen respecto de la anterior", () => {
    const plan = generatePlan(profile({ daysPerWeek: 5, raceDate: raceIn(16) }), HOY);
    const deload = plan.weeks.find((w) => w.deload)!;
    const anterior = plan.weeks.find((w) => w.week === deload.week - 1)!;
    const min = (w: typeof deload) =>
      Number(w.sessions.find((s) => s.day === "Sábado")!.title.match(/(\d+)'/)?.[1] ?? 0);
    expect(min(deload)).toBeLessThan(min(anterior));
  });

  it("el taper baja el volumen respecto del pico", () => {
    const plan = generatePlan(profile({ daysPerWeek: 5, raceDate: raceIn(16) }), HOY);
    const min = (w: (typeof plan.weeks)[number]) =>
      Number(w.sessions.find((s) => s.day === "Sábado")!.title.match(/(\d+)'/)?.[1] ?? 0);
    const pico = Math.max(...plan.weeks.filter((w) => w.phase !== "taper").map(min));
    const taper = plan.weeks.filter((w) => w.phase === "taper").map(min);
    for (const t of taper) expect(t).toBeLessThan(pico);
  });

  it("quien no corre nunca recibe más volumen que quien sí corre", () => {
    // Sería la forma más directa de lesionar a un usuario.
    const sin = generatePlan(profile({ runningBase: "ninguna", daysPerWeek: 5, raceDate: raceIn(16) }), HOY);
    const con = generatePlan(profile({ runningBase: "solida", daysPerWeek: 5, raceDate: raceIn(16) }), HOY);
    const maxMin = (p: typeof sin) =>
      Math.max(...p.weeks.map((w) => Number(w.sessions.find((s) => s.day === "Sábado")!.title.match(/(\d+)'/)?.[1] ?? 0)));
    expect(maxMin(sin)).toBeLessThan(maxMin(con));
  });
});

describe("generatePlan — situación temporal", () => {
  it("marca la semana actual cuando el plan ya arrancó", () => {
    const plan = generatePlan(profile({ raceDate: raceIn(16) }), HOY);
    expect(plan.currentWeek).toBe(1);
  });

  it("calcula los días que faltan para la carrera", () => {
    const plan = generatePlan(profile({ raceDate: raceIn(10) }), HOY);
    expect(plan.daysUntilRace).toBe(70);
  });

  it("una carrera pasada no genera semanas", () => {
    const plan = generatePlan(profile({ raceDate: "2026-01-01" }), HOY);
    expect(plan.weeks).toHaveLength(0);
    expect(plan.daysUntilRace).toBe(0);
  });
});

describe("generatePlan — adapta el contenido al perfil", () => {
  it("sin material específico, avisa de las sustituciones", () => {
    const plan = generatePlan(profile({ equipment: "casa" }), HOY);
    const hyrox = plan.weeks[0].sessions.find((s) => s.type === "hyrox")!;
    expect(hyrox.notes).toMatch(/casa/i);
  });

  it("con material completo no mete avisos de sustitución", () => {
    const plan = generatePlan(profile({ equipment: "completo" }), HOY);
    const hyrox = plan.weeks[0].sessions.find((s) => s.type === "hyrox")!;
    expect(hyrox.notes).toBeUndefined();
  });

  it("en dobles y relevos se practica el reparto; en individual no", () => {
    const dobles = generatePlan(profile({ division: "doubles", raceDate: raceIn(16) }), HOY);
    const solo = generatePlan(profile({ division: "individual", raceDate: raceIn(16) }), HOY);
    const textoDe = (p: typeof dobles) =>
      p.weeks
        .filter((w) => w.phase === "especifico")
        .flatMap((w) => w.sessions.filter((s) => s.type === "hyrox").flatMap((s) => s.blocks))
        .join(" ");
    expect(textoDe(dobles)).toMatch(/reparto|relevos/i);
    expect(textoDe(solo)).not.toMatch(/reparto|relevos/i);
  });

  it("es determinista: el mismo perfil da exactamente el mismo plan", () => {
    const a = generatePlan(profile(), HOY);
    const b = generatePlan(profile(), HOY);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe("generatePlan — huecos que detectó la revisión por mutación", () => {
  it("la última semana de cada fase llega a progress = 1 exacto", () => {
    // Con `i / weeks` en vez de `i / (weeks - 1)` la última semana se queda en
    // 0,75 y nunca alcanza el contenido pico del bloque. Comprobarlo por el
    // titular NO lo detecta: 0,75 ya cruza el umbral del titular "fin". Hay que
    // mirar el número.
    const plan = generatePlan(profile({ raceDate: raceIn(16), daysPerWeek: 5 }), HOY);
    const fases = new Set(plan.weeks.map((w) => w.phase));
    for (const fase of fases) {
      const semanas = plan.weeks.filter((w) => w.phase === fase);
      if (semanas.length < 2) continue;
      expect({ fase, primera: semanas[0].progress }).toEqual({ fase, primera: 0 });
      expect({ fase, ultima: semanas[semanas.length - 1].progress }).toEqual({ fase, ultima: 1 });
    }
  });

  it("una fase de una sola semana empieza por el principio de la progresión", () => {
    // No tendría sentido arrancar un bloque por su sesión más dura.
    const plan = generatePlan(profile({ raceDate: raceIn(5), daysPerWeek: 4 }), HOY);
    for (const w of plan.weeks) {
      const semanas = plan.weeks.filter((x) => x.phase === w.phase);
      if (semanas.length === 1) expect(w.progress).toBe(0);
    }
  });

  it("la simulación completa aparece en MÁS de una semana, no solo en la última", () => {
    // Si el umbral se endurece (0.6 -> 0.99) la simulación queda reducida a una
    // sola sesión en todo el plan, y el usuario llega a competir habiendo hecho
    // el recorrido completo una única vez.
    const plan = generatePlan(profile({ raceDate: raceIn(16), daysPerWeek: 5 }), HOY);
    const conSimulacion = plan.weeks.filter((w) =>
      w.sessions.some((s) => /Simulación completa/i.test(s.title))
    );
    expect(conSimulacion.length).toBeGreaterThanOrEqual(2);
  });
});
