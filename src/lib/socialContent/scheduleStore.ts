import { FieldValue, type Firestore } from "firebase-admin/firestore";

const DOC_COLLECTION = "config";
const DOC_ID = "socialSchedule";
const MADRID_TZ = "Europe/Madrid";

export type SocialSchedule = {
  enabled: boolean;
  /**
   * Horarios en hora local de Madrid, formato "HH:MM" (24hs). Uno por pieza.
   *
   * Se guardan en local y NO en UTC a propósito: Madrid cambia de huso dos
   * veces al año (CET/CEST), así que un horario fijo en UTC se desfasaría una
   * hora cada cambio y las publicaciones dejarían de caer en la franja
   * elegida. La conversión a UTC se hace en cada tick con el offset real de
   * ese momento (ver `madridOffsetMinutes`).
   */
  timesLocal: string[];
  /**
   * Cada cuántos días se genera un reel nuevo. 1 = todos los días (y es el
   * valor asumido si un doc viejo no tiene este campo, para no cambiarle el
   * comportamiento a una config guardada antes de que existiera). HeyGen
   * factura por render generado, así que este número es también la palanca
   * directa de costo — ver `isDueByInterval`.
   */
  intervalDays: number;
};

/**
 * Uno cada 2 días, alternando entre dos horarios (público en España y en
 * Argentina, con 5hs de diferencia — no hay una sola hora buena para los
 * dos): 20:30 Madrid (noche en España) y 01:30 Madrid (20:30 Argentina, su
 * franja de noche). El ORDEN de `timesLocal` es el orden de rotación — ver
 * `dueReelSlotsNow`.
 */
const DEFAULT_SCHEDULE: SocialSchedule = { enabled: true, timesLocal: ["20:30", "01:30"], intervalDays: 2 };

const TIME_RE = /^\d{2}:\d{2}$/;

function madridParts(at: Date): Record<string, string> {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: MADRID_TZ,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const out: Record<string, string> = {};
  for (const part of fmt.formatToParts(at)) {
    if (part.type !== "literal") out[part.type] = part.value;
  }
  return out;
}

/** Minutos que Madrid va por delante de UTC en ese instante (60 en CET, 120 en CEST). */
export function madridOffsetMinutes(at: Date): number {
  const p = madridParts(at);
  const asIfUtc = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(p.hour),
    Number(p.minute),
    Number(p.second)
  );
  return Math.round((asIfUtc - at.getTime()) / 60000);
}

/** Minutos transcurridos del día según el reloj de pared de Madrid. */
function madridMinutesOfDay(at: Date): number {
  const p = madridParts(at);
  return Number(p.hour) * 60 + Number(p.minute);
}

/** Fecha "YYYY-MM-DD" según el calendario de Madrid (base de los IDs de doc). */
export function madridDateId(at: Date): string {
  const p = madridParts(at);
  return `${p.year}-${p.month}-${p.day}`;
}

function minutesToHHMM(totalMinutes: number): string {
  const norm = ((totalMinutes % 1440) + 1440) % 1440;
  const h = String(Math.floor(norm / 60)).padStart(2, "0");
  const m = String(norm % 60).padStart(2, "0");
  return `${h}:${m}`;
}

export async function getSocialSchedule(db: Firestore): Promise<SocialSchedule> {
  const snap = await db.collection(DOC_COLLECTION).doc(DOC_ID).get();
  if (!snap.exists) return DEFAULT_SCHEDULE;
  const data = snap.data() || {};

  const parseTimes = (value: unknown): string[] | null => {
    if (!Array.isArray(value)) return null;
    const times = value.filter((t): t is string => typeof t === "string" && TIME_RE.test(t));
    return times.length > 0 ? times : null;
  };

  // Formato nuevo (hora local de Madrid). Si el doc todavía tiene el formato
  // viejo en UTC, se convierte al vuelo con el offset actual para no perder la
  // configuración existente en la migración.
  let timesLocal = parseTimes(data.timesLocal);
  if (!timesLocal) {
    const legacyUtc = parseTimes(data.timesUtc);
    if (legacyUtc) {
      const offset = madridOffsetMinutes(new Date());
      timesLocal = legacyUtc.map((t) => {
        const [h, m] = t.split(":").map(Number);
        return minutesToHHMM(h * 60 + m + offset);
      });
    }
  }

  const rawInterval = Number(data.intervalDays);
  const intervalDays =
    Number.isFinite(rawInterval) && rawInterval >= 1 ? Math.round(rawInterval) : DEFAULT_SCHEDULE.intervalDays;

  return {
    enabled: typeof data.enabled === "boolean" ? data.enabled : true,
    timesLocal: timesLocal ?? DEFAULT_SCHEDULE.timesLocal,
    intervalDays,
  };
}

export async function setSocialSchedule(db: Firestore, schedule: SocialSchedule): Promise<void> {
  await db.collection(DOC_COLLECTION).doc(DOC_ID).set(
    {
      enabled: schedule.enabled,
      timesLocal: schedule.timesLocal,
      intervalDays: schedule.intervalDays,
      // El campo viejo se borra para que no queden dos fuentes de verdad
      // contradiciéndose si alguien lee el doc a mano.
      timesUtc: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

/**
 * Slots configurados cuya hora local de Madrid cae dentro de la ventana
 * actual (tolerancia en minutos, para no depender de que el cron dispare
 * exactamente al segundo). Devuelve los horarios ("HH:MM" locales) que
 * deberían disparar ahora.
 */
export function matchingSlotsNow(
  schedule: Pick<SocialSchedule, "enabled" | "timesLocal">,
  now: Date,
  toleranceMinutes: number
): string[] {
  if (!schedule.enabled) return [];
  const nowMinutes = madridMinutesOfDay(now);

  return schedule.timesLocal.filter((t) => {
    const [h, m] = t.split(":").map((n) => parseInt(n, 10));
    if (Number.isNaN(h) || Number.isNaN(m)) return false;
    const slotMinutes = h * 60 + m;
    const rawDiff = Math.abs(nowMinutes - slotMinutes);
    // Distancia circular: un slot a las 00:05 tiene que hacer match a las 23:59.
    const diff = Math.min(rawDiff, 1440 - rawDiff);
    return diff <= toleranceMinutes;
  });
}

export function slotDocId(dateId: string, timeLocal: string): string {
  return `${dateId}_${timeLocal.replace(":", "")}`;
}

/**
 * `dateId` ("YYYY-MM-DD") a un índice de día absoluto (días desde epoch UTC).
 * Exportada porque `topics.ts` la reutiliza para la rotación de temas
 * (`rotationIndex`): necesita el mismo día "de calendario de Madrid" que usa
 * este archivo para decidir cuándo toca generar, no el día crudo de
 * `date.getTime()` — con los horarios reales (20:30/01:30 Madrid) ese día
 * crudo en UTC no queda espaciado por `intervalDays` de forma confiable
 * (01:30 Madrid en CEST es 23:30 UTC del día anterior), lo que rompía la
 * garantía de cobertura de la rotación.
 */
export function dateIdToDayIndex(dateId: string): number {
  const [y, mo, d] = dateId.split("-").map((n) => parseInt(n, 10));
  return Math.floor(Date.UTC(y, mo - 1, d) / 86400000);
}

/**
 * Si corresponde generar hoy dado un intervalo de N días (ver
 * `SocialSchedule.intervalDays`). Sin estado en Firestore: se deriva
 * matemáticamente del propio `dateId` (mismo calendario de Madrid que agrupa
 * los docs), así que no depende de recordar cuándo se generó la última pieza
 * — mismo patrón determinista que ya usa el repo para rotaciones (`dayOfYear`
 * en topics.ts, `pickPersonaForDate` en generateDailyContent.ts). Si un tick
 * se pierde (el cron falla un día) el próximo día que sí caiga en la
 * paridad correcta retoma solo, sin arrastrar ni duplicar generaciones.
 */
export function isDueByInterval(dateId: string, intervalDays: number): boolean {
  const n = Math.round(intervalDays);
  if (!Number.isFinite(n) || n <= 1) return true;
  return dateIdToDayIndex(dateId) % n === 0;
}

/**
 * Slots de reel que corresponden AHORA: combina el matching de hora del día
 * (`matchingSlotsNow`) con la cadencia `intervalDays` y, si hay más de un
 * horario configurado, con a cuál de ellos le toca el turno hoy.
 *
 * Con más de un horario NO se disparan todos el mismo día "due" — rotan en
 * el ORDEN de `timesLocal`, un horario distinto por cada ciclo de
 * `intervalDays` días. Ejemplo con `["20:30", "01:30"]` e `intervalDays=2`:
 * día D (ciclo par) → solo puede disparar 20:30 ese día; día D+2 (ciclo
 * impar) → solo 01:30; día D+4 → vuelve a 20:30. Así "uno cada 2 días" se
 * cumple exacto en cantidad (1 pieza cada 2 días calendario de Madrid, ni
 * más ni menos) y de paso alterna el horario.
 *
 * Con un solo horario configurado se comporta exactamente como antes de
 * que existiera la rotación (todo ciclo usa ese único horario).
 *
 * El chequeo de "a qué día pertenece" un horario usa el `dateId` del propio
 * día calendario en que cae el chequeo (sin mirar a qué otro huso horario
 * "pertenece" conceptualmente ese horario) — por eso 01:30, aunque en hora
 * argentina represente la noche del día anterior, no necesita ningún ajuste
 * especial: para el gate y la rotación es simplemente el chequeo del propio
 * día de Madrid en que ese reloj marca 01:30, igual que 20:30 es el chequeo
 * del día de Madrid en que marca 20:30. Sin estado en Firestore — mismo
 * criterio determinista que `isDueByInterval`.
 */
export function dueReelSlotsNow(schedule: SocialSchedule, now: Date, toleranceMinutes: number): string[] {
  if (!schedule.enabled || schedule.timesLocal.length === 0) return [];

  const dateId = madridDateId(now);
  const cycleLength = Math.max(1, Math.round(schedule.intervalDays) || 1);
  if (!isDueByInterval(dateId, cycleLength)) return [];

  const rotationIndex =
    schedule.timesLocal.length > 1 ? (dateIdToDayIndex(dateId) / cycleLength) % schedule.timesLocal.length : 0;
  const assignedTime = schedule.timesLocal[rotationIndex];

  return matchingSlotsNow({ enabled: true, timesLocal: [assignedTime] }, now, toleranceMinutes);
}
