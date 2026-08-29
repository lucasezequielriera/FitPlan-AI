import { madridDateId, matchingSlotsNow, slotDocId, isDueByInterval, dueReelSlotsNow, type SocialSchedule } from "@/lib/socialContent/scheduleStore";

describe("isDueByInterval — cadencia 'cada N días' sin estado en Firestore", () => {
  it("con intervalDays 1 (o menor/no numérico) siempre está due — preserva el comportamiento diario de siempre", () => {
    expect(isDueByInterval("2026-08-24", 1)).toBe(true);
    expect(isDueByInterval("2026-08-25", 1)).toBe(true);
    expect(isDueByInterval("2026-08-24", 0)).toBe(true);
    expect(isDueByInterval("2026-08-24", NaN)).toBe(true);
  });

  it("con intervalDays 2, alterna entre días calendario consecutivos (uno sí, uno no)", () => {
    const results = [
      isDueByInterval("2026-08-24", 2),
      isDueByInterval("2026-08-25", 2),
      isDueByInterval("2026-08-26", 2),
      isDueByInterval("2026-08-27", 2),
    ];
    expect(results[0]).not.toBe(results[1]);
    expect(results[1]).not.toBe(results[2]);
    expect(results[2]).not.toBe(results[3]);
  });

  it("es determinístico: mismo dateId, mismo resultado siempre (no depende de estado)", () => {
    expect(isDueByInterval("2026-08-24", 2)).toBe(isDueByInterval("2026-08-24", 2));
  });

  it("con intervalDays 2, exactamente 1 de cada 2 días de un rango largo está due (sin acumular drift)", () => {
    let dueCount = 0;
    const start = Date.UTC(2026, 0, 1);
    const days = 60;
    for (let i = 0; i < days; i++) {
      const d = new Date(start + i * 86400000);
      const dateId = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
      if (isDueByInterval(dateId, 2)) dueCount++;
    }
    expect(dueCount).toBe(days / 2);
  });
});

describe("matchingSlotsNow / slotDocId / madridDateId — sin cambios de comportamiento", () => {
  it("matchingSlotsNow solo necesita enabled/timesLocal (no requiere intervalDays)", () => {
    const now = new Date(Date.UTC(2026, 7, 24, 18, 30)); // 20:30 Madrid (CEST, UTC+2) ese día
    const slots = matchingSlotsNow({ enabled: true, timesLocal: ["20:30"] }, now, 6);
    expect(slots).toEqual(["20:30"]);
  });

  it("slotDocId sigue generando el mismo formato de id que antes (compat con docs históricos)", () => {
    expect(slotDocId("2026-08-24", "20:30")).toBe("2026-08-24_2030");
  });

  it("madridDateId no cruza de día para el horario 20:30 Madrid", () => {
    const at2030Madrid = new Date(Date.UTC(2026, 7, 24, 18, 30));
    expect(madridDateId(at2030Madrid)).toBe("2026-08-24");
  });

  it("madridDateId SÍ cae en el día calendario siguiente para 01:30 Madrid — esperado y no es un bug (ver dueReelSlotsNow)", () => {
    // 01:30 del 25/08 hora Madrid (CEST, UTC+2) = 23:30 UTC del 24/08.
    const at0130Madrid25 = new Date(Date.UTC(2026, 7, 24, 23, 30));
    expect(madridDateId(at0130Madrid25)).toBe("2026-08-25");
  });
});

describe("dueReelSlotsNow — cadencia + rotación de horarios (sin estado en Firestore)", () => {
  const scheduleTwoSlots: SocialSchedule = { enabled: true, timesLocal: ["20:30", "01:30"], intervalDays: 2 };

  function at(dateUtcMs: number): Date {
    return new Date(dateUtcMs);
  }

  /** Réplica de la conversión interna dateId → día absoluto, solo para aserciones del test. */
  function dateIdToDayIndexForTest(dateId: string): number {
    const [y, mo, d] = dateId.split("-").map((n) => parseInt(n, 10));
    return Math.floor(Date.UTC(y, mo - 1, d) / 86400000);
  }

  // Helpers en CEST (Madrid = UTC+2), válido para todo agosto 2026 (sin
  // cambio de horario en el rango usado por estos tests).
  function madrid2030(day: number): Date {
    return at(Date.UTC(2026, 7, day, 18, 30)); // 20:30 Madrid = 18:30 UTC
  }
  function madrid0130(day: number): Date {
    // 01:30 Madrid del día `day` = 23:30 UTC del día calendario anterior.
    return at(Date.UTC(2026, 7, day - 1, 23, 30));
  }

  // No se hardcodea qué día calendario específico es "due" (depende de la
  // paridad del día absoluto desde epoch, un detalle de implementación
  // irrelevante para lo que hay que garantizar): se detecta dinámicamente
  // buscando el primer día del rango que dispare algo.
  function firstDueDayFrom(startDay: number): number {
    for (let day = startDay; day < startDay + 4; day++) {
      if (dueReelSlotsNow(scheduleTwoSlots, madrid2030(day), 6).length > 0) return day;
      if (dueReelSlotsNow(scheduleTwoSlots, madrid0130(day), 6).length > 0) return day;
    }
    throw new Error("No se encontró ningún día due en el rango de prueba — revisar isDueByInterval");
  }

  it("con un solo horario configurado, se comporta igual que matchingSlotsNow + isDueByInterval de toda la vida", () => {
    const schedule: SocialSchedule = { enabled: true, timesLocal: ["20:30"], intervalDays: 2 };
    const dueDay = firstDueDayFrom(20);
    expect(dueReelSlotsNow(schedule, madrid2030(dueDay), 6)).toEqual(["20:30"]);
    expect(dueReelSlotsNow(schedule, madrid2030(dueDay + 1), 6)).toEqual([]); // día siguiente, no due
  });

  it("no dispara fuera de la ventana de tolerancia aunque el día esté due", () => {
    const dueDay = firstDueDayFrom(20);
    const dueDayMidday = at(Date.UTC(2026, 7, dueDay, 10, 0)); // mediodía, ni 20:30 ni 01:30
    expect(dueReelSlotsNow(scheduleTwoSlots, dueDayMidday, 6)).toEqual([]);
  });

  it("con dos horarios, el rol (cuál de los dos) es el mismo para cualquier tick del mismo día calendario de Madrid", () => {
    const dueDay = firstDueDayFrom(20);
    const at2030 = dueReelSlotsNow(scheduleTwoSlots, madrid2030(dueDay), 6);
    const at0130 = dueReelSlotsNow(scheduleTwoSlots, madrid0130(dueDay), 6);
    // Exactamente uno de los dos ticks del día dispara, nunca ambos ni ninguno.
    expect([...at2030, ...at0130]).toHaveLength(1);
  });

  it("alterna el horario entre días 'due' consecutivos, recorriendo días calendario reales de Madrid", () => {
    const startDay = firstDueDayFrom(20);
    const fired: { dateId: string; slot: string }[] = [];
    for (let day = startDay; day < startDay + 8; day++) {
      const slotsAt2030 = dueReelSlotsNow(scheduleTwoSlots, madrid2030(day), 6);
      const slotsAt0130 = dueReelSlotsNow(scheduleTwoSlots, madrid0130(day), 6);
      const daySlots = [...slotsAt2030, ...slotsAt0130];

      expect(daySlots.length).toBeLessThanOrEqual(1); // nunca los dos el mismo día
      if (daySlots.length === 1) fired.push({ dateId: madridDateId(madrid2030(day)), slot: daySlots[0] });
    }

    // Cada 2 días calendario dispara (nunca dos seguidos), y alterna el horario.
    expect(fired).toHaveLength(4);
    expect(fired[0].slot).not.toBe(fired[1].slot);
    expect(fired[1].slot).not.toBe(fired[2].slot);
    expect(fired[2].slot).not.toBe(fired[3].slot);
    expect(fired[0].slot).toBe(fired[2].slot); // vuelve a rotar al mismo horario 2 ciclos después
    for (let i = 1; i < fired.length; i++) {
      const prevIdx = dateIdToDayIndexForTest(fired[i - 1].dateId);
      const curIdx = dateIdToDayIndexForTest(fired[i].dateId);
      expect(curIdx - prevIdx).toBe(2); // exactamente cada 2 días calendario, sin drift
    }
  });

  it("con enabled=false o timesLocal vacío, no dispara nunca", () => {
    const day = madrid2030(20);
    expect(dueReelSlotsNow({ enabled: false, timesLocal: ["20:30", "01:30"], intervalDays: 2 }, day, 6)).toEqual([]);
    expect(dueReelSlotsNow({ enabled: true, timesLocal: [], intervalDays: 2 }, day, 6)).toEqual([]);
  });
});
