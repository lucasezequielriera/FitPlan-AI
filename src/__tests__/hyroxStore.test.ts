import { sanitizeProfile } from "@/lib/hyrox/store";

/**
 * `sanitizeProfile` es la frontera entre lo que manda el cliente (o lo que hay
 * guardado de una versión anterior) y el generador. Todo lo que pase de aquí se
 * trata como válido, así que un hueco aquí se convierte en un plan absurdo
 * mostrado con total confianza.
 */

const valido = { raceDate: "2026-12-21" };

describe("sanitizeProfile", () => {
  it("sin fecha de carrera devuelve null, no un perfil a medias", () => {
    expect(sanitizeProfile({})).toBeNull();
    expect(sanitizeProfile({ raceDate: "mañana" })).toBeNull();
    expect(sanitizeProfile(null)).toBeNull();
    expect(sanitizeProfile("texto")).toBeNull();
    expect(sanitizeProfile(undefined)).toBeNull();
  });

  it("rellena con valores por defecto sensatos lo que falte", () => {
    const p = sanitizeProfile(valido)!;
    expect(p.division).toBe("individual");
    expect(p.daysPerWeek).toBe(4);
    expect(p.runningBase).toBe("poca");
    expect(p.goalMinutes).toBeNull();
  });

  it("rechaza valores de enumeración inventados", () => {
    const p = sanitizeProfile({ ...valido, division: "cuadruples", equipment: "nave espacial" })!;
    expect(p.division).toBe("individual");
    expect(p.equipment).toBe("gimnasio");
  });

  it("acota los días de entrenamiento al rango posible", () => {
    expect(sanitizeProfile({ ...valido, daysPerWeek: 99 })!.daysPerWeek).toBe(6);
    expect(sanitizeProfile({ ...valido, daysPerWeek: 0 })!.daysPerWeek).toBe(3);
    expect(sanitizeProfile({ ...valido, daysPerWeek: -5 })!.daysPerWeek).toBe(3);
    expect(sanitizeProfile({ ...valido, daysPerWeek: "cinco" })!.daysPerWeek).toBe(4);
  });

  it("una marca de 5 km imposible se descarta en vez de acotarse", () => {
    // Acotar un 5 km de 3 minutos a 12 daría por buena una entrada errónea y
    // generaría objetivos de ritmo absurdos con apariencia de calculados.
    expect(sanitizeProfile({ ...valido, current5kMinutes: 3 })!.current5kMinutes).toBeNull();
    expect(sanitizeProfile({ ...valido, current5kMinutes: 500 })!.current5kMinutes).toBeNull();
    expect(sanitizeProfile({ ...valido, current5kMinutes: 25 })!.current5kMinutes).toBe(25);
  });

  it("hasRacedBefore solo es true si es exactamente true", () => {
    expect(sanitizeProfile({ ...valido, hasRacedBefore: "sí" })!.hasRacedBefore).toBe(false);
    expect(sanitizeProfile({ ...valido, hasRacedBefore: 1 })!.hasRacedBefore).toBe(false);
    expect(sanitizeProfile({ ...valido, hasRacedBefore: true })!.hasRacedBefore).toBe(true);
  });

  it("recorta las limitaciones para que no sean un vector de abuso", () => {
    const largo = "x".repeat(5000);
    expect(sanitizeProfile({ ...valido, limitations: largo })!.limitations).toHaveLength(500);
    expect(sanitizeProfile({ ...valido, limitations: "   " })!.limitations).toBeNull();
  });

  it("nunca devuelve undefined en ningún campo", () => {
    const p = sanitizeProfile(valido)!;
    for (const [k, v] of Object.entries(p)) {
      expect({ campo: k, esUndefined: v === undefined }).toEqual({ campo: k, esUndefined: false });
    }
  });
});
