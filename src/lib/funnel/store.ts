import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { madridDateId } from "@/lib/dates/madrid";
import { normalizeActiveDays } from "@/lib/funnel/report";
import { ACTIVE_DAYS_CAP, type FunnelUser, type TrackableMilestone } from "@/lib/funnel/types";

/**
 * Escritura de los hitos del embudo sobre el documento de `usuarios`.
 *
 * Regla que atraviesa todo el módulo: **el embudo nunca puede romper el flujo
 * del usuario**. Si una escritura falla (cuota de Firestore agotada, red), se
 * traga el error y se sigue. Es telemetría: perder un dato es aceptable,
 * bloquear un registro o un pago no lo es.
 */

const USERS = "usuarios";

/** Campo del documento donde se guarda la marca de cada hito. */
const MILESTONE_FIELD: Record<TrackableMilestone, string> = {
  firstPlan: "funnel.firstPlanAt",
  paywall: "funnel.paywallFirstAt",
  checkout: "funnel.checkoutStartedAt",
};

/**
 * Marca un hito la PRIMERA vez que ocurre, y nunca lo pisa después.
 *
 * Se lee antes de escribir a propósito: `firstPlanAt` tiene que ser la primera
 * vez, no la última. Sobrescribirlo convertiría la métrica de activación en
 * "última actividad", que es otra cosa y además haría imposible medir cuánto
 * tarda un usuario nuevo en generar su primer plan.
 */
export async function markMilestone(
  db: Firestore,
  userId: string,
  milestone: TrackableMilestone,
  now: Date = new Date()
): Promise<void> {
  try {
    const ref = db.collection(USERS).doc(userId);
    const snap = await ref.get();
    if (!snap.exists) return;

    const current = (snap.data()?.funnel ?? {}) as Record<string, unknown>;
    const field = MILESTONE_FIELD[milestone];
    const shortName = field.split(".")[1];

    const update: Record<string, unknown> = {};
    if (!current[shortName]) update[field] = now.toISOString();

    // El muro además se cuenta: verlo tres veces sin pagar es una señal muy
    // distinta de verlo una, y distingue "no le interesa" de "no puede/no se fía".
    if (milestone === "paywall") update["funnel.paywallCount"] = FieldValue.increment(1);

    if (Object.keys(update).length > 0) await ref.update(update);
  } catch (error) {
    console.warn(`[funnel] no se pudo marcar "${milestone}" para ${userId}:`, error);
  }
}

/**
 * Calcula el array de días activos tras añadir el día de hoy, o `null` si el
 * día ya estaba registrado y no hay nada que escribir.
 *
 * Devuelve el valor en vez de escribirlo para que `updateLastLogin` lo incluya
 * en la MISMA escritura que ya hace (lastLogin, país…), en lugar de disparar
 * una segunda. Antes existían dos implementaciones de esto —una aquí sin usar
 * y otra en línea en el endpoint— con el riesgo de que divergieran.
 */
export function nextActiveDays(storedActiveDays: unknown, now: Date = new Date()): string[] | null {
  const today = madridDateId(now);
  const existing = normalizeActiveDays(storedActiveDays);
  if (existing.includes(today)) return null;
  return [...existing, today].slice(-ACTIVE_DAYS_CAP);
}

/** Convierte un documento crudo de `usuarios` a la forma que consume el informe. */
export function toFunnelUser(id: string, data: Record<string, unknown>): FunnelUser {
  const funnel = (data.funnel ?? {}) as Record<string, unknown>;
  return {
    id,
    signupDateId: toDateId(data.createdAt),
    premium: data.premium === true,
    paidDateId: toDateId((data.premiumPayment as Record<string, unknown> | undefined)?.date ?? null),
    funnel: {
      firstPlanAt: asString(funnel.firstPlanAt),
      paywallFirstAt: asString(funnel.paywallFirstAt),
      paywallCount: typeof funnel.paywallCount === "number" ? funnel.paywallCount : 0,
      checkoutStartedAt: asString(funnel.checkoutStartedAt),
      activeDays: normalizeActiveDays(funnel.activeDays),
    },
  };
}

function asString(v: unknown): string | null {
  return typeof v === "string" && v ? v : null;
}

/**
 * Normaliza a "YYYY-MM-DD" cualquiera de las formas en que este repo guarda una
 * fecha: `Timestamp` de Firestore, `Date`, o string ISO. Los documentos son de
 * distintas épocas del proyecto y conviven las tres.
 */
function toDateId(value: unknown): string | null {
  if (!value) return null;
  try {
    if (typeof value === "object" && value !== null && "toDate" in value) {
      const d = (value as { toDate: () => Date }).toDate();
      return Number.isNaN(d.getTime()) ? null : madridDateId(d);
    }
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : madridDateId(value);
    if (typeof value === "string") {
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? null : madridDateId(d);
    }
  } catch {
    return null;
  }
  return null;
}
