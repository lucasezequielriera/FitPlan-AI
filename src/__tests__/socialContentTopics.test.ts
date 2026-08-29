import { SOCIAL_TOPICS, TOPIC_REGISTRY, pickNextTopic, type SocialTopic } from "@/lib/socialContent/topics";
import { dueReelSlotsNow, madridDateId, slotDocId, type SocialSchedule } from "@/lib/socialContent/scheduleStore";

/**
 * `pickNextTopic` es el reemplazo de `functionForSlot` + `pickTopicForFunction`
 * (retirados 2026-08): con la cadencia bajada a un reel cada 2 días en solo
 * dos horarios fuera de la franja de mediodía, el mapeo hora→función dejaba
 * ~11 temas de nutrición/conversión sin generarse nunca. Ahora el tema rota
 * por FECHA (y `intervalDays`, la cadencia real — ver `SocialSchedule` en
 * scheduleStore.ts) sobre todo el registro. Estos tests verifican las dos
 * garantías de las que depende ese diseño: cobertura completa sin huecos y
 * ausencia de repetición cercana, SIN llamar a HeyGen ni a Firestore (fecha
 * simulada, `recentTopics` en memoria).
 */

const DEPLOYED_INTERVAL_DAYS = 2; // SocialSchedule.intervalDays real (ver scheduleStore.ts DEFAULT_SCHEDULE)

/** Simula `startCommercialGeneration`: en cada pieza, `recentTopics` son las últimas 8 ya "publicadas". */
function simulateSequence(count: number, startDate: Date, stepDays: number): SocialTopic[] {
  const picked: SocialTopic[] = [];
  for (let i = 0; i < count; i++) {
    const date = new Date(startDate.getTime() + i * stepDays * 86400000);
    const recentTopics = picked.slice(-8).reverse(); // más nuevo primero, como el query real (orderBy createdAt desc)
    const selection = pickNextTopic(recentTopics, date, {}, stepDays);
    picked.push(selection.topic);
  }
  return picked;
}

describe("pickNextTopic — cobertura del registro completo (fecha, no hora)", () => {
  it("una vuelta completa (largo del registro) cubre cada SocialTopic EXACTAMENTE una vez, a la cadencia real deployada", () => {
    const n = SOCIAL_TOPICS.length;
    const sequence = simulateSequence(n, new Date("2026-08-29T20:30:00Z"), DEPLOYED_INTERVAL_DAYS);
    const seen = new Set(sequence);
    expect(seen.size).toBe(n);
    for (const t of SOCIAL_TOPICS) expect(seen.has(t)).toBe(true);
  });

  it("CUALQUIER ventana de N piezas consecutivas cubre el registro sin huecos, no solo la que arranca justo en una vuelta — es la garantía que realmente importa en producción, donde siempre se arranca desde 'hoy', nunca desde un punto alineado", () => {
    const n = SOCIAL_TOPICS.length;
    // Arranca desde una fecha deliberadamente "desalineada" (no múltiplo de N
    // ocurrencias desde epoch) para forzar que la ventana de N piezas cruce
    // un límite de vuelta si el mecanismo tuviera el bug de offset-por-vuelta
    // que se descartó a propósito en `rotationIndex` (ver el comentario ahí).
    const sequence = simulateSequence(n * 3, new Date("2026-09-03T20:30:00Z"), DEPLOYED_INTERVAL_DAYS);
    for (let start = 0; start <= sequence.length - n; start++) {
      const window = sequence.slice(start, start + n);
      expect(new Set(window).size).toBe(n);
    }
  });
});

describe("pickNextTopic — dry-run de las próximas ~20 publicaciones (cadencia real: 1 cada 2 días)", () => {
  const start = new Date("2026-08-29T20:30:00Z"); // fecha real del cambio, slot de las 20:30
  const sequence = simulateSequence(20, start, DEPLOYED_INTERVAL_DAYS);

  it("nunca repite un tema en las primeras 20 piezas (el registro tiene 23 temas, más de una vuelta completa)", () => {
    const seen = new Set(sequence);
    expect(seen.size).toBe(sequence.length);
  });

  it("nunca repite el mismo tema en dos piezas consecutivas", () => {
    for (let i = 1; i < sequence.length; i++) {
      expect(sequence[i]).not.toBe(sequence[i - 1]);
    }
  });

  it("la función de embudo (derivada del tema, no de la hora) varía: no son todas 'alcance'", () => {
    const functions = new Set(sequence.map((t) => TOPIC_REGISTRY[t].fn));
    expect(functions.has("nutricion")).toBe(true);
    expect(functions.has("conversion")).toBe(true);
    expect(functions.has("alcance")).toBe(true);
  });

  it("no abre con la misma familia de gancho dos piezas seguidas", () => {
    for (let i = 1; i < sequence.length; i++) {
      const prevHook = TOPIC_REGISTRY[sequence[i - 1]].hook;
      const hook = TOPIC_REGISTRY[sequence[i]].hook;
      expect(hook).not.toBe(prevHook);
    }
  });

  it("es determinístico: la misma fecha de arranque siempre produce la misma secuencia (auditable, sin estado)", () => {
    const again = simulateSequence(20, start, DEPLOYED_INTERVAL_DAYS);
    expect(again).toEqual(sequence);
  });

  it("muestra la secuencia real que saldría (referencia visual para revisión manual, no dispara HeyGen)", () => {
    // No es una aserción — deja constancia en el output de test de la
    // secuencia real para poder confirmarla a ojo sin llamar a HeyGen (que
    // cuesta ~$1 por render y el crédito está casi agotado).
    console.log(
      "Próximas 20 piezas (tema · función · gancho):",
      sequence.map((t) => `${t}·${TOPIC_REGISTRY[t].fn}·${TOPIC_REGISTRY[t].hook}`).join(", ")
    );
    expect(sequence.length).toBe(20);
  });
});

describe("pickNextTopic — cobertura robusta ante distintas cadencias (intervalDays 1 a 14, rango que permite el panel admin)", () => {
  it.each([1, 2, 3, 4, 5, 6, 7, 14])(
    "con intervalDays=%i, una vuelta completa cubre todos los temas sin huecos ni repeticiones",
    (stepDays) => {
      const n = SOCIAL_TOPICS.length;
      const sequence = simulateSequence(n, new Date("2026-01-01T00:00:00Z"), stepDays);
      const seen = new Set(sequence);
      expect(seen.size).toBe(n);
    }
  );
});

describe("pickNextTopic — contra los disparos REALES de dueReelSlotsNow (no fechas sintéticas espaciadas a mano)", () => {
  // Regresión: una primera versión de `rotationIndex` usaba el día UTC crudo
  // (`date.getTime()`), que asume que los horarios reales quedan espaciados
  // por `intervalDays` de forma pareja. Eso es falso con los horarios reales
  // (20:30/01:30 hora Madrid): en horario de verano (CEST), 01:30 Madrid es
  // 23:30 UTC del día ANTERIOR, así que dos piezas separadas por
  // `intervalDays` en el calendario de Madrid podían caer en el mismo día UTC
  // (o saltar de más) — rompiendo el incremento "+1 exacto" del que depende
  // la cobertura. Este test dispara con la MISMA función que usa el cron real
  // (`dueReelSlotsNow`), cruzando además el cambio de horario de verano a
  // invierno de fines de octubre, para que ese bug no pueda colarse de nuevo
  // sin que un test lo note.
  it("simulando ~4 meses de disparos reales (cruzando el cambio de horario CEST→CET), cualquier ventana de N piezas sigue sin huecos", () => {
    const schedule: SocialSchedule = { enabled: true, timesLocal: ["20:30", "01:30"], intervalDays: 2 };
    const picks: SocialTopic[] = [];
    const seenDocIds = new Set<string>();
    let cursor = new Date("2026-08-29T00:00:00Z");
    const end = new Date("2026-12-29T00:00:00Z");
    while (cursor < end) {
      // Tolerancia ancha porque este test avanza el reloj de a 1h (no de a 10
      // min como el cron real) para no hacer miles de iteraciones — con eso
      // alcanza para no perderse ningún horario due real.
      const slots = dueReelSlotsNow(schedule, cursor, 30);
      for (const slot of slots) {
        const docId = slotDocId(madridDateId(cursor), slot);
        if (seenDocIds.has(docId)) continue;
        seenDocIds.add(docId);
        const recentTopics = picks.slice(-8).reverse();
        const selection = pickNextTopic(recentTopics, cursor, {}, schedule.intervalDays);
        picks.push(selection.topic);
      }
      cursor = new Date(cursor.getTime() + 60 * 60000);
    }

    const n = SOCIAL_TOPICS.length;
    expect(picks.length).toBeGreaterThan(n * 2); // suficientes piezas simuladas para que el chequeo tenga sentido

    for (let start = 0; start <= picks.length - n; start++) {
      const window = picks.slice(start, start + n);
      expect(new Set(window).size).toBe(n);
    }
  });
});
