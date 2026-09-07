import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { DAYS_MAX, DAYS_MIN, type HyroxProfile } from "@/lib/hyrox/profile";

/**
 * Persistencia del perfil HYROX.
 *
 * Se guarda solo el PERFIL, nunca el plan generado. El plan se deriva del
 * perfil de forma determinista (`generatePlan`), así que guardarlo sería
 * duplicar estado: en cuanto se mejorase el generador, todos los usuarios
 * seguirían viendo el plan viejo hasta que alguien recordase migrarlos.
 *
 * Es exactamente el error que ya ocurrió en este repo con `priceLabel` en
 * `config/carouselSchedule`: un valor persistido siguió pisando el código
 * durante semanas.
 */

const USERS = "usuarios";
const FIELD = "hyroxProfile";

export async function getHyroxProfile(db: Firestore, userId: string): Promise<HyroxProfile | null> {
  const snap = await db.collection(USERS).doc(userId).get();
  if (!snap.exists) return null;
  return sanitizeProfile(snap.data()?.[FIELD]);
}

export async function setHyroxProfile(db: Firestore, userId: string, profile: HyroxProfile): Promise<void> {
  await db.collection(USERS).doc(userId).set(
    {
      [FIELD]: { ...profile, updatedAt: FieldValue.serverTimestamp() },
    },
    { merge: true }
  );
}

export async function clearHyroxProfile(db: Firestore, userId: string): Promise<void> {
  await db.collection(USERS).doc(userId).update({ [FIELD]: FieldValue.delete() });
}

/**
 * Normaliza lo que venga de la base o del cliente a un perfil válido.
 *
 * Devuelve `null` en vez de un perfil a medias si falta lo imprescindible: un
 * plan generado sobre datos incompletos sería peor que no tener plan, porque
 * el usuario lo daría por bueno.
 */
export function sanitizeProfile(raw: unknown): HyroxProfile | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  const raceDate = typeof r.raceDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.raceDate) ? r.raceDate : null;
  if (!raceDate) return null;

  return {
    raceDate,
    division: oneOf(r.division, ["individual", "doubles", "relay"] as const, "individual"),
    category: oneOf(r.category, ["hombre", "mujer"] as const, "hombre"),
    daysPerWeek: clampInt(r.daysPerWeek, DAYS_MIN, DAYS_MAX, 4),
    runningBase: oneOf(r.runningBase, ["ninguna", "poca", "solida"] as const, "poca"),
    strengthBase: oneOf(r.strengthBase, ["principiante", "intermedio", "avanzado"] as const, "intermedio"),
    equipment: oneOf(r.equipment, ["completo", "gimnasio", "casa"] as const, "gimnasio"),
    hasRacedBefore: r.hasRacedBefore === true,
    goalMinutes: optionalNumber(r.goalMinutes, 45, 180),
    current5kMinutes: optionalNumber(r.current5kMinutes, 12, 60),
    // Se guarda como texto y se muestra tal cual; no se interpreta ni se usa
    // para decidir nada del plan. Recortado para que no sea un vector de abuso.
    limitations: typeof r.limitations === "string" && r.limitations.trim() ? r.limitations.trim().slice(0, 500) : null,
  };
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/** Un número dentro de rango, o `null`. Fuera de rango es `null`, no el extremo. */
function optionalNumber(value: unknown, min: number, max: number): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return Math.round(n);
}
