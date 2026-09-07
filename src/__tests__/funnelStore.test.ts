import { nextActiveDays, toFunnelUser } from "@/lib/funnel/store";
import { ACTIVE_DAYS_CAP } from "@/lib/funnel/types";

/**
 * `toFunnelUser` traduce el documento crudo de `usuarios` a la forma que
 * consume el informe. Es el punto donde más fácil se cuela un bug silencioso:
 * los documentos son de distintas épocas del proyecto y la fecha de alta
 * aparece como `Timestamp` de Firestore, como `Date` o como string ISO. Si una
 * de las tres se normaliza mal, esos usuarios desaparecen del embudo sin que
 * nada falle a la vista.
 */

/** Imita un `Timestamp` de Firestore sin depender de firebase-admin. */
function fakeTimestamp(iso: string) {
  return { toDate: () => new Date(iso) };
}

describe("toFunnelUser — normalización de la fecha de alta", () => {
  it("acepta Timestamp de Firestore", () => {
    const u = toFunnelUser("a", { createdAt: fakeTimestamp("2026-09-01T10:00:00Z") });
    expect(u.signupDateId).toBe("2026-09-01");
  });

  it("acepta Date", () => {
    const u = toFunnelUser("a", { createdAt: new Date("2026-09-01T10:00:00Z") });
    expect(u.signupDateId).toBe("2026-09-01");
  });

  it("acepta string ISO", () => {
    const u = toFunnelUser("a", { createdAt: "2026-09-01T10:00:00Z" });
    expect(u.signupDateId).toBe("2026-09-01");
  });

  it("usa el calendario de Madrid, no UTC", () => {
    // 23:30 UTC del 1 de septiembre ya es el día 2 en Madrid (CEST, +2).
    // Agrupar por UTC metería esa alta en el día equivocado.
    const u = toFunnelUser("a", { createdAt: "2026-09-01T23:30:00Z" });
    expect(u.signupDateId).toBe("2026-09-02");
  });

  it("una fecha ausente o corrupta no rompe, devuelve null", () => {
    expect(toFunnelUser("a", {}).signupDateId).toBeNull();
    expect(toFunnelUser("a", { createdAt: "no soy una fecha" }).signupDateId).toBeNull();
    expect(toFunnelUser("a", { createdAt: 12345 }).signupDateId).toBeNull();
    expect(toFunnelUser("a", { createdAt: null }).signupDateId).toBeNull();
  });
});

describe("toFunnelUser — resto de campos", () => {
  it("premium solo es true si es exactamente true", () => {
    expect(toFunnelUser("a", { premium: true }).premium).toBe(true);
    expect(toFunnelUser("a", { premium: "true" }).premium).toBe(false);
    expect(toFunnelUser("a", {}).premium).toBe(false);
  });

  it("un documento sin objeto funnel devuelve valores neutros, no undefined suelto", () => {
    const u = toFunnelUser("a", { createdAt: "2026-09-01T10:00:00Z" });
    expect(u.funnel).toEqual({
      firstPlanAt: null,
      paywallFirstAt: null,
      paywallCount: 0,
      checkoutStartedAt: null,
      activeDays: [],
    });
  });

  it("limpia los días activos guardados", () => {
    const u = toFunnelUser("a", {
      funnel: { activeDays: ["2026-09-02", "2026-09-01", "2026-09-02", "basura"] },
    });
    expect(u.funnel?.activeDays).toEqual(["2026-09-01", "2026-09-02"]);
  });

  it("lee la fecha de pago desde premiumPayment", () => {
    const u = toFunnelUser("a", { premiumPayment: { date: "2026-09-03T08:00:00Z" } });
    expect(u.paidDateId).toBe("2026-09-03");
  });
});

describe("nextActiveDays", () => {
  const HOY = new Date("2026-09-07T10:00:00Z"); // 2026-09-07 en Madrid

  it("devuelve null si el día ya estaba registrado (no hay nada que escribir)", () => {
    expect(nextActiveDays(["2026-09-07"], HOY)).toBeNull();
  });

  it("añade el día de hoy si falta", () => {
    expect(nextActiveDays(["2026-09-05"], HOY)).toEqual(["2026-09-05", "2026-09-07"]);
  });

  it("funciona con un usuario sin días previos", () => {
    expect(nextActiveDays(undefined, HOY)).toEqual(["2026-09-07"]);
  });

  it("respeta el tope descartando los días más antiguos", () => {
    const muchos = Array.from({ length: ACTIVE_DAYS_CAP + 5 }, (_, i) =>
      new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10)
    );
    const out = nextActiveDays(muchos, HOY)!;
    expect(out).toHaveLength(ACTIVE_DAYS_CAP);
    expect(out[out.length - 1]).toBe("2026-09-07");
    expect(out).not.toContain(muchos[0]);
  });

  it("usa el calendario de Madrid: 23:30 UTC ya es el día siguiente", () => {
    const nocheUtc = new Date("2026-09-07T23:30:00Z");
    expect(nextActiveDays([], nocheUtc)).toEqual(["2026-09-08"]);
  });
});
