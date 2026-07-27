import { FieldValue, type Firestore } from "firebase-admin/firestore";

const DOC_COLLECTION = "config";
const DOC_ID = "socialSchedule";

export type SocialSchedule = {
  enabled: boolean;
  /** Horarios en UTC, formato "HH:MM" (24hs). Uno por reel/día. */
  timesUtc: string[];
};

const DEFAULT_SCHEDULE: SocialSchedule = { enabled: true, timesUtc: ["14:00"] };

export async function getSocialSchedule(db: Firestore): Promise<SocialSchedule> {
  const snap = await db.collection(DOC_COLLECTION).doc(DOC_ID).get();
  if (!snap.exists) return DEFAULT_SCHEDULE;
  const data = snap.data() || {};
  const timesUtc = Array.isArray(data.timesUtc)
    ? data.timesUtc.filter((t): t is string => typeof t === "string" && /^\d{2}:\d{2}$/.test(t))
    : DEFAULT_SCHEDULE.timesUtc;
  return {
    enabled: typeof data.enabled === "boolean" ? data.enabled : true,
    timesUtc,
  };
}

export async function setSocialSchedule(db: Firestore, schedule: SocialSchedule): Promise<void> {
  await db.collection(DOC_COLLECTION).doc(DOC_ID).set(
    {
      enabled: schedule.enabled,
      timesUtc: schedule.timesUtc,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

/**
 * Slots configurados cuya hora cae dentro de la ventana actual (tolerancia
 * en minutos, para no depender de que el cron dispare exactamente al
 * segundo). Devuelve los horarios ("HH:MM") que deberían disparar ahora.
 */
export function matchingSlotsNow(schedule: SocialSchedule, now: Date, toleranceMinutes: number): string[] {
  if (!schedule.enabled) return [];
  const nowMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();

  return schedule.timesUtc.filter((t) => {
    const [h, m] = t.split(":").map((n) => parseInt(n, 10));
    if (Number.isNaN(h) || Number.isNaN(m)) return false;
    const slotMinutes = h * 60 + m;
    const diff = Math.abs(nowMinutes - slotMinutes);
    return diff <= toleranceMinutes;
  });
}

export function slotDocId(dateId: string, timeUtc: string): string {
  return `${dateId}_${timeUtc.replace(":", "")}`;
}
