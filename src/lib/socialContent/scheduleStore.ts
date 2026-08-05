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
};

/** 09:00 (franja de alcance) y 13:00 (franja de profundidad/conversión). */
const DEFAULT_SCHEDULE: SocialSchedule = { enabled: true, timesLocal: ["09:00", "13:00"] };

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

  return {
    enabled: typeof data.enabled === "boolean" ? data.enabled : true,
    timesLocal: timesLocal ?? DEFAULT_SCHEDULE.timesLocal,
  };
}

export async function setSocialSchedule(db: Firestore, schedule: SocialSchedule): Promise<void> {
  await db.collection(DOC_COLLECTION).doc(DOC_ID).set(
    {
      enabled: schedule.enabled,
      timesLocal: schedule.timesLocal,
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
export function matchingSlotsNow(schedule: SocialSchedule, now: Date, toleranceMinutes: number): string[] {
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
