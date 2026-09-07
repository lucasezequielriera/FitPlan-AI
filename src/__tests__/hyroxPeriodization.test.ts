import {
  buildPeriodization,
  computeDeloadWeeks,
  phaseForWeek,
  weeksUntilRace,
} from "@/lib/hyrox/periodization";
import { MAX_WEEKS, MIN_WEEKS, emptyProfile, type HyroxProfile, type RunningBase } from "@/lib/hyrox/profile";

/**
 * La periodización es la parte del sistema HYROX con criterio de entrenador.
 * Si el reparto de semanas está mal, el plan entero está mal — y un plan con
 * las fases mal repartidas se ve exactamente igual de convincente que uno bien
 * repartido. De ahí que se teste al detalle.
 */

const HOY = "2026-09-07";

function profile(over: Partial<HyroxProfile> = {}): HyroxProfile {
  return {
    ...(emptyProfile() as HyroxProfile),
    raceDate: "2026-12-21", // 15 semanas exactas después de HOY
    ...over,
  };
}

/** Fecha de carrera a N semanas exactas de HOY. */
function raceIn(weeks: number): string {
  const base = new Date("2026-09-07T00:00:00Z");
  base.setUTCDate(base.getUTCDate() + weeks * 7);
  return base.toISOString().slice(0, 10);
}

describe("weeksUntilRace", () => {
  it("cuenta semanas completas", () => {
    expect(weeksUntilRace(raceIn(12), HOY)).toBe(12);
    expect(weeksUntilRace(raceIn(1), HOY)).toBe(1);
  });

  it("una carrera pasada o de hoy devuelve 0", () => {
    expect(weeksUntilRace("2026-09-07", HOY)).toBe(0);
    expect(weeksUntilRace("2026-01-01", HOY)).toBe(0);
  });

  it("no rompe con fechas inválidas", () => {
    expect(weeksUntilRace("no-es-fecha", HOY)).toBe(0);
    expect(weeksUntilRace(raceIn(10), "tampoco")).toBe(0);
  });
});

describe("buildPeriodization — el reparto tiene que cuadrar SIEMPRE", () => {
  it("la suma de fases es exactamente el total, para cualquier plazo", () => {
    // Es el invariante que rompe redondear cada fase por su cuenta: el plan
    // acabaría con una semana de más o de menos que el calendario real.
    for (let w = MIN_WEEKS; w <= MAX_WEEKS + 6; w++) {
      for (const base of ["ninguna", "poca", "solida"] as RunningBase[]) {
        const p = buildPeriodization(profile({ raceDate: raceIn(w), runningBase: base }), HOY);
        const suma = p.allocations.reduce((s, a) => s + a.weeks, 0);
        expect({ semanas: w, base, suma }).toEqual({ semanas: w, base, suma: p.totalWeeks });
      }
    }
  });

  it("nunca asigna semanas negativas", () => {
    for (let w = 0; w <= MAX_WEEKS + 4; w++) {
      const p = buildPeriodization(profile({ raceDate: raceIn(w) }), HOY);
      for (const a of p.allocations) expect(a.weeks).toBeGreaterThanOrEqual(0);
    }
  });

  it("aplica el tope de semanas y avisa", () => {
    const p = buildPeriodization(profile({ raceDate: raceIn(40) }), HOY);
    expect(p.totalWeeks).toBe(MAX_WEEKS);
    expect(p.weeksUntilRace).toBe(40);
    expect(p.warning).toMatch(/últimas 20/);
  });

  it("con plazo holgado y base normal no mete avisos innecesarios", () => {
    const p = buildPeriodization(profile({ raceDate: raceIn(16), runningBase: "poca" }), HOY);
    expect(p.warning).toBeNull();
  });

  it("las cuatro fases existen cuando hay tiempo de sobra", () => {
    const p = buildPeriodization(profile({ raceDate: raceIn(16) }), HOY);
    for (const a of p.allocations) expect(a.weeks).toBeGreaterThan(0);
  });

  it("siempre reserva taper: nadie debe llegar a competir sin afinar", () => {
    for (let w = MIN_WEEKS; w <= MAX_WEEKS; w++) {
      const p = buildPeriodization(profile({ raceDate: raceIn(w) }), HOY);
      const taper = p.allocations.find((a) => a.key === "taper")!;
      expect({ semanas: w, taper: taper.weeks > 0 }).toEqual({ semanas: w, taper: true });
    }
  });
});

describe("buildPeriodization — adapta a la base de carrera", () => {
  it("quien no corre recibe MÁS base que quien corre habitualmente", () => {
    const sin = buildPeriodization(profile({ raceDate: raceIn(16), runningBase: "ninguna" }), HOY);
    const con = buildPeriodization(profile({ raceDate: raceIn(16), runningBase: "solida" }), HOY);
    const baseDe = (p: typeof sin) => p.allocations.find((a) => a.key === "base")!.weeks;
    expect(baseDe(sin)).toBeGreaterThan(baseDe(con));
  });

  it("la base extra sale de construcción, no de específico ni de taper", () => {
    const sin = buildPeriodization(profile({ raceDate: raceIn(16), runningBase: "ninguna" }), HOY);
    const con = buildPeriodization(profile({ raceDate: raceIn(16), runningBase: "solida" }), HOY);
    const get = (p: typeof sin, k: string) => p.allocations.find((a) => a.key === k)!.weeks;
    expect(get(sin, "especifico")).toBe(get(con, "especifico"));
    expect(get(sin, "taper")).toBe(get(con, "taper"));
    expect(get(sin, "construccion")).toBeLessThan(get(con, "construccion"));
  });
});

describe("buildPeriodization — plazos imposibles se dicen, no se disimulan", () => {
  it("con menos del mínimo, solo específico y taper, y avisa", () => {
    const p = buildPeriodization(profile({ raceDate: raceIn(3) }), HOY);
    expect(p.allocations.find((a) => a.key === "base")!.weeks).toBe(0);
    expect(p.allocations.find((a) => a.key === "construccion")!.weeks).toBe(0);
    expect(p.allocations.reduce((s, a) => s + a.weeks, 0)).toBe(3);
    expect(p.warning).toMatch(/no da tiempo|No da tiempo/i);
  });

  it("una carrera ya pasada no genera plan y lo dice claro", () => {
    const p = buildPeriodization(profile({ raceDate: "2026-01-01" }), HOY);
    expect(p.totalWeeks).toBe(0);
    expect(p.allocations.every((a) => a.weeks === 0)).toBe(true);
    expect(p.warning).toMatch(/ya pasó/);
  });

  it("avisa específicamente a quien va corto de tiempo Y sin base de carrera", () => {
    const p = buildPeriodization(profile({ raceDate: raceIn(6), runningBase: "ninguna" }), HOY);
    expect(p.warning).toMatch(/sin base de carrera/);
  });
});

describe("computeDeloadWeeks", () => {
  it("una descarga cada 4 semanas", () => {
    expect(computeDeloadWeeks(16)).toEqual([4, 8, 12]);
  });

  it("nunca cae dentro del taper", () => {
    for (let w = 6; w <= MAX_WEEKS; w++) {
      const deloads = computeDeloadWeeks(w);
      for (const d of deloads) expect(d).toBeLessThan(w - 1);
    }
  });

  it("un plan corto no lleva descargas", () => {
    expect(computeDeloadWeeks(5)).toEqual([]);
    expect(computeDeloadWeeks(4)).toEqual([]);
  });
});

describe("phaseForWeek", () => {
  it("cada semana del plan pertenece a exactamente una fase", () => {
    const p = buildPeriodization(profile({ raceDate: raceIn(16) }), HOY);
    for (let w = 1; w <= p.totalWeeks; w++) {
      expect(phaseForWeek(p, w)).not.toBeNull();
    }
  });

  it("las fases van en orden: la primera semana es base, la última taper", () => {
    const p = buildPeriodization(profile({ raceDate: raceIn(16) }), HOY);
    expect(phaseForWeek(p, 1)).toBe("base");
    expect(phaseForWeek(p, p.totalWeeks)).toBe("taper");
  });

  it("una semana fuera del plan devuelve null", () => {
    const p = buildPeriodization(profile({ raceDate: raceIn(16) }), HOY);
    expect(phaseForWeek(p, p.totalWeeks + 1)).toBeNull();
  });
});

describe("avisos de plazo corto — no pueden contradecir al titular", () => {
  it("una carrera dentro de pocos días NO dice que la fecha ya pasó", () => {
    // El titular mostraba "faltan 3 días" y justo debajo "esa fecha ya pasó",
    // porque ambos casos daban weeksUntilRace = 0.
    for (const dias of [1, 2, 3, 6]) {
      const fecha = new Date("2026-09-07T00:00:00Z");
      fecha.setUTCDate(fecha.getUTCDate() + dias);
      const p = buildPeriodization(profile({ raceDate: fecha.toISOString().slice(0, 10) }), HOY);
      expect({ dias, warning: p.warning }).not.toEqual({ dias, warning: expect.stringMatching(/ya pasó/) });
      expect(p.warning).toMatch(new RegExp(`${dias} día`));
    }
  });

  it("la carrera de hoy tiene su propio mensaje", () => {
    const p = buildPeriodization(profile({ raceDate: HOY }), HOY);
    expect(p.warning).toMatch(/es hoy/);
    expect(p.warning).not.toMatch(/ya pasó/);
  });

  it("una carrera pasada sí dice que pasó", () => {
    const p = buildPeriodization(profile({ raceDate: "2026-08-01" }), HOY);
    expect(p.warning).toMatch(/ya pasó/);
  });
});
