import { assessGoal, estimatePace, formatDuration, formatPace } from "@/lib/hyrox/pacing";
import { emptyProfile, type HyroxProfile } from "@/lib/hyrox/profile";

/**
 * La estimación de tiempo es lo primero que el usuario va a contrastar con la
 * realidad el día de la carrera. Si está mal calibrada, pierde la confianza en
 * todo lo demás — así que importa tanto que los números sean coherentes entre
 * sí como que no prometan de más.
 */

function profile(over: Partial<HyroxProfile> = {}): HyroxProfile {
  return { ...(emptyProfile() as HyroxProfile), raceDate: "2026-12-21", current5kMinutes: 25, ...over };
}

describe("formatPace / formatDuration", () => {
  it("formatea ritmos y duraciones de forma legible", () => {
    expect(formatPace(360)).toBe("6:00");
    expect(formatPace(345)).toBe("5:45");
    expect(formatPace(305)).toBe("5:05");
    expect(formatDuration(85)).toBe("1h 25min");
    expect(formatDuration(45)).toBe("45min");
    expect(formatDuration(120)).toBe("2h 00min");
  });
});

describe("estimatePace", () => {
  it("sin marca de 5 km no inventa una estimación", () => {
    // Preferible no dar número a dar uno falso: el usuario lo tomaría por bueno.
    expect(estimatePace(profile({ current5kMinutes: null }))).toBeNull();
  });

  it("las partes suman el total central", () => {
    const e = estimatePace(profile())!;
    const central = e.runMinutes + e.stationsMinutes + e.roxzoneMinutes;
    expect(central).toBeGreaterThanOrEqual(e.totalMinutes.min);
    expect(central).toBeLessThanOrEqual(e.totalMinutes.max);
  });

  it("el rango es un rango de verdad, no un punto disfrazado", () => {
    const e = estimatePace(profile())!;
    expect(e.totalMinutes.max).toBeGreaterThan(e.totalMinutes.min);
  });

  it("correr más rápido en 5 km predice un HYROX más rápido", () => {
    const lento = estimatePace(profile({ current5kMinutes: 30 }))!;
    const rapido = estimatePace(profile({ current5kMinutes: 20 }))!;
    expect(rapido.totalMinutes.min).toBeLessThan(lento.totalMinutes.min);
    expect(rapido.runPaceSecPerKm).toBeLessThan(lento.runPaceSecPerKm);
  });

  it("dentro del HYROX siempre se corre más lento que el ritmo de 5 km en fresco", () => {
    for (const min5k of [18, 22, 25, 30, 35]) {
      const e = estimatePace(profile({ current5kMinutes: min5k }))!;
      const pace5k = (min5k * 60) / 5;
      expect({ min5k, masLento: e.runPaceSecPerKm > pace5k }).toEqual({ min5k, masLento: true });
    }
  });

  it("en dobles se corre más rápido que en individual con la misma marca", () => {
    // Se hace la mitad del trabajo de estaciones, así que se llega menos
    // fundido a cada tramo de carrera.
    const solo = estimatePace(profile({ division: "individual" }))!;
    const dobles = estimatePace(profile({ division: "doubles" }))!;
    const relevos = estimatePace(profile({ division: "relay" }))!;
    expect(dobles.runPaceSecPerKm).toBeLessThan(solo.runPaceSecPerKm);
    expect(relevos.runPaceSecPerKm).toBeLessThan(dobles.runPaceSecPerKm);
  });

  it("más base de fuerza reduce el tiempo de estaciones", () => {
    const novato = estimatePace(profile({ strengthBase: "principiante" }))!;
    const experto = estimatePace(profile({ strengthBase: "avanzado" }))!;
    expect(experto.stationsMinutes).toBeLessThan(novato.stationsMinutes);
  });

  it("quien nunca ha competido pierde más tiempo en transiciones", () => {
    const primera = estimatePace(profile({ hasRacedBefore: false }))!;
    const veterano = estimatePace(profile({ hasRacedBefore: true }))!;
    expect(primera.roxzoneMinutes).toBeGreaterThan(veterano.roxzoneMinutes);
  });

  it("señala la carrera como mayor margen para quien corre lento", () => {
    const e = estimatePace(profile({ current5kMinutes: 33, strengthBase: "avanzado" }))!;
    expect(e.biggestLever).toBe("carrera");
  });

  it("señala las estaciones cuando la carrera ya es buena", () => {
    const e = estimatePace(profile({ current5kMinutes: 18, strengthBase: "principiante", division: "relay" }))!;
    expect(e.biggestLever).toBe("estaciones");
  });

  it("nunca devuelve tiempos absurdos para marcas plausibles", () => {
    for (const min5k of [18, 25, 35]) {
      for (const division of ["individual", "doubles", "relay"] as const) {
        const e = estimatePace(profile({ current5kMinutes: min5k, division }))!;
        expect({ min5k, division, ok: e.totalMinutes.min > 40 && e.totalMinutes.max < 200 }).toEqual({
          min5k,
          division,
          ok: true,
        });
      }
    }
  });
});

describe("assessGoal — honestidad con el objetivo del usuario", () => {
  it("sin objetivo no dice nada", () => {
    expect(assessGoal(profile({ goalMinutes: null }), estimatePace(profile()))).toBeNull();
  });

  it("un objetivo holgado se reconoce como conservador", () => {
    const p = profile({ goalMinutes: 150 });
    expect(assessGoal(p, estimatePace(p))).toMatch(/conservador/);
  });

  it("un objetivo dentro del rango se confirma como realista", () => {
    const p = profile();
    const e = estimatePace(p)!;
    const dentro = { ...p, goalMinutes: Math.round((e.totalMinutes.min + e.totalMinutes.max) / 2) };
    expect(assessGoal(dentro, e)).toMatch(/realista/);
  });

  it("un objetivo inalcanzable se dice claro y se explica dónde está el margen", () => {
    // Callarlo hace que la gente salga demasiado rápido y reviente a mitad.
    const p = profile({ goalMinutes: 50 });
    const texto = assessGoal(p, estimatePace(p))!;
    expect(texto).toMatch(/por debajo/);
    expect(texto).toMatch(/carrera/);
  });
});
