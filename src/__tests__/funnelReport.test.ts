import {
  buildFunnelReport,
  countReturnDays,
  findBiggestDrop,
  normalizeActiveDays,
  reachedStage,
  retentionAt,
} from "@/lib/funnel/report";
import { ACTIVE_DAYS_CAP, type FunnelUser } from "@/lib/funnel/types";

/**
 * El cálculo del embudo es puro, así que se testea entero con datos inventados.
 * Importa que esté bien: un porcentaje mal calculado se ve exactamente igual de
 * convincente que uno bien calculado, y sobre estos números se van a tomar
 * decisiones de producto.
 */

const NOW = new Date("2026-09-07T10:00:00Z"); // 12:00 en Madrid (CEST)

function user(id: string, over: Partial<FunnelUser> = {}): FunnelUser {
  return { id, signupDateId: "2026-09-01", premium: false, ...over };
}

describe("normalizeActiveDays", () => {
  it("descarta basura y deduplica", () => {
    expect(normalizeActiveDays(["2026-09-01", "2026-09-01", "no-es-fecha", null, 42])).toEqual(["2026-09-01"]);
  });

  it("no es un array => vacío", () => {
    expect(normalizeActiveDays(undefined)).toEqual([]);
    expect(normalizeActiveDays("2026-09-01")).toEqual([]);
  });

  it("respeta el tope conservando los días MÁS RECIENTES", () => {
    const many = Array.from({ length: ACTIVE_DAYS_CAP + 10 }, (_, i) => {
      const d = new Date(Date.UTC(2026, 0, 1 + i));
      return d.toISOString().slice(0, 10);
    });
    const out = normalizeActiveDays(many);
    expect(out).toHaveLength(ACTIVE_DAYS_CAP);
    expect(out[out.length - 1]).toBe(many[many.length - 1]);
  });
});

describe("countReturnDays", () => {
  it("el día del alta no cuenta como vuelta", () => {
    const u = user("a", { signupDateId: "2026-09-01", funnel: { activeDays: ["2026-09-01"] } });
    expect(countReturnDays(u)).toBe(0);
  });

  it("cuenta solo días distintos del alta", () => {
    const u = user("a", {
      signupDateId: "2026-09-01",
      funnel: { activeDays: ["2026-09-01", "2026-09-02", "2026-09-05"] },
    });
    expect(countReturnDays(u)).toBe(2);
  });
});

describe("reachedStage", () => {
  it("las etapas se detectan por su hito, y 'paid' acepta premium o fecha de pago", () => {
    expect(reachedStage(user("a"), "signup")).toBe(true);
    expect(reachedStage(user("a"), "firstPlan")).toBe(false);
    expect(reachedStage(user("a", { funnel: { firstPlanAt: "2026-09-01T10:00:00Z" } }), "firstPlan")).toBe(true);
    expect(reachedStage(user("a", { premium: true }), "paid")).toBe(true);
    expect(reachedStage(user("a", { paidDateId: "2026-09-03" }), "paid")).toBe(true);
    expect(reachedStage(user("a"), "paid")).toBe(false);
  });
});

describe("retentionAt — elegibilidad", () => {
  it("quien se registró ayer NO cuenta como fallo de retención a 7 días", () => {
    // Es el error clásico: contarlo hunde la métrica cuanto más rápido creces.
    const recien = user("nuevo", { signupDateId: "2026-09-06" });
    const r = retentionAt([recien], 7, "2026-09-07");
    expect(r.eligible).toBe(0);
    expect(r.pct).toBe(0);
  });

  it("cuenta como retenido a quien volvió en el día N o después", () => {
    const vuelve = user("a", { signupDateId: "2026-08-01", funnel: { activeDays: ["2026-08-01", "2026-08-08"] } });
    const noVuelve = user("b", { signupDateId: "2026-08-01", funnel: { activeDays: ["2026-08-01", "2026-08-02"] } });
    const r = retentionAt([vuelve, noVuelve], 7, "2026-09-07");
    expect(r.eligible).toBe(2);
    expect(r.returned).toBe(1);
    expect(r.pct).toBe(50);
  });

  it("sin elegibles devuelve 0 y no NaN", () => {
    expect(retentionAt([], 7, "2026-09-07")).toEqual({ eligible: 0, returned: 0, pct: 0 });
  });

  it("un usuario sin fecha de alta no rompe el cálculo", () => {
    const r = retentionAt([user("x", { signupDateId: null })], 7, "2026-09-07");
    expect(r.eligible).toBe(0);
  });
});

describe("buildFunnelReport", () => {
  const cohorte: FunnelUser[] = [
    // Llegó hasta el final.
    user("pago", {
      premium: true,
      funnel: {
        firstPlanAt: "x",
        paywallFirstAt: "x",
        checkoutStartedAt: "x",
        activeDays: ["2026-09-01", "2026-09-03"],
      },
    }),
    // Vio el muro pero no pulsó pagar.
    user("muro", {
      funnel: { firstPlanAt: "x", paywallFirstAt: "x", activeDays: ["2026-09-01", "2026-09-02"] },
    }),
    // Generó plan y no volvió nunca.
    user("plan", { funnel: { firstPlanAt: "x", activeDays: ["2026-09-01"] } }),
    // Se registró y no hizo nada.
    user("vacio", { funnel: { activeDays: ["2026-09-01"] } }),
  ];

  it("cuenta cada etapa de forma acumulativa y coherente", () => {
    const r = buildFunnelReport(cohorte, NOW);
    const by = Object.fromEntries(r.stages.map((s) => [s.key, s.users]));
    expect(r.signups).toBe(4);
    expect(by.signup).toBe(4);
    expect(by.firstPlan).toBe(3);
    expect(by.returned).toBe(2);
    expect(by.paywall).toBe(2);
    expect(by.checkout).toBe(1);
    expect(by.paid).toBe(1);
  });

  it("ninguna etapa supera a la anterior", () => {
    const r = buildFunnelReport(cohorte, NOW);
    for (let i = 1; i < r.stages.length; i++) {
      expect(r.stages[i].users).toBeLessThanOrEqual(r.stages[i - 1].users);
    }
  });

  it("los porcentajes se calculan sobre la base correcta", () => {
    const r = buildFunnelReport(cohorte, NOW);
    const plan = r.stages.find((s) => s.key === "firstPlan")!;
    expect(plan.pctOfPrevious).toBe(75); // 3 de 4
    expect(plan.pctOfSignups).toBe(75);
    expect(r.stages[0].pctOfPrevious).toBeNull();
  });

  it("con cero usuarios devuelve ceros, nunca NaN", () => {
    const r = buildFunnelReport([], NOW);
    expect(r.signups).toBe(0);
    for (const s of r.stages) {
      expect(Number.isNaN(s.pctOfSignups)).toBe(false);
      expect(s.pctOfSignups).toBe(0);
    }
    expect(r.biggestDrop).toBeNull();
  });

  it("la ventana temporal excluye altas anteriores", () => {
    const viejo = user("viejo", { signupDateId: "2026-01-01" });
    const r = buildFunnelReport([...cohorte, viejo], NOW, 30);
    expect(r.signups).toBe(4); // el viejo queda fuera
  });
});

describe("findBiggestDrop", () => {
  it("elige la caída mayor en ABSOLUTO, no en porcentaje", () => {
    // 100→50 pierde 50 personas (50%); 2→0 pierde 2 (100%). El problema real
    // es el primero: ordenar por porcentaje señalaría el equivocado.
    const stages = [
      { key: "signup" as const, label: "", users: 100, pctOfPrevious: null, pctOfSignups: 100 },
      { key: "firstPlan" as const, label: "", users: 50, pctOfPrevious: 50, pctOfSignups: 50 },
      { key: "returned" as const, label: "", users: 2, pctOfPrevious: 4, pctOfSignups: 2 },
      { key: "paywall" as const, label: "", users: 0, pctOfPrevious: 0, pctOfSignups: 0 },
    ];
    const drop = findBiggestDrop(stages)!;
    expect(drop.lostUsers).toBe(50);
    expect(drop.from).toBe("signup");
    expect(drop.to).toBe("firstPlan");
    // Lo importante: NO eligió returned→paywall, que es el 100% de caída pero
    // solo 2 personas. Ordenar por porcentaje habría señalado ese escalón.
    expect(drop.lostPct).toBe(50);
  });

  it("sin caídas devuelve null", () => {
    const stages = [
      { key: "signup" as const, label: "", users: 5, pctOfPrevious: null, pctOfSignups: 100 },
      { key: "firstPlan" as const, label: "", users: 5, pctOfPrevious: 100, pctOfSignups: 100 },
    ];
    expect(findBiggestDrop(stages)).toBeNull();
  });
});
