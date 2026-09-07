import { daysBetween, isDateId, madridDateId } from "@/lib/dates/madrid";
import {
  ACTIVE_DAYS_CAP,
  FUNNEL_STAGES,
  STAGE_LABELS,
  type FunnelReport,
  type FunnelStageKey,
  type FunnelUser,
  type RetentionSlice,
  type StageCount,
} from "@/lib/funnel/types";

/**
 * Arma el informe del embudo a partir de los documentos de usuario.
 *
 * Función PURA a propósito: no toca Firestore ni el reloj del sistema (`now`
 * entra por parámetro). Así se puede testear todo el cálculo con datos
 * inventados, que es donde están los errores de verdad — un porcentaje mal
 * calculado se ve igual de convincente que uno bien calculado.
 */

/** ¿El usuario alcanzó esta etapa? Las etapas son acumulativas por definición. */
export function reachedStage(user: FunnelUser, stage: FunnelStageKey): boolean {
  const f = user.funnel ?? {};
  switch (stage) {
    case "signup":
      return true;
    case "firstPlan":
      return Boolean(f.firstPlanAt);
    case "returned":
      return countReturnDays(user) > 0;
    case "paywall":
      return Boolean(f.paywallFirstAt);
    case "checkout":
      return Boolean(f.checkoutStartedAt);
    case "paid":
      return user.premium === true || Boolean(user.paidDateId);
  }
}

/**
 * Días activos DISTINTOS del día de alta. Volver el mismo día en que te
 * registraste no es retención: es la misma sesión.
 */
export function countReturnDays(user: FunnelUser): number {
  const days = normalizeActiveDays(user.funnel?.activeDays);
  if (!user.signupDateId) return days.length;
  return days.filter((d) => d !== user.signupDateId).length;
}

/** Limpia el array guardado: sin duplicados, sin basura, ordenado, y con tope. */
export function normalizeActiveDays(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const unique = [...new Set(raw.filter(isDateId))];
  unique.sort();
  // Se conservan los más recientes si algún documento excede el tope.
  return unique.slice(-ACTIVE_DAYS_CAP);
}

/**
 * Retención a N días: de los usuarios que se dieron de alta hace al menos N
 * días, cuántos volvieron en el día N o después.
 *
 * El filtro de elegibilidad es la parte que más se equivoca: quien se registró
 * ayer NO puede tener retención a 7 días, y contarlo como que "no volvió"
 * hunde la métrica artificialmente cuanto más creces.
 */
export function retentionAt(users: FunnelUser[], dayN: number, todayDateId: string): RetentionSlice {
  const eligibles = users.filter(
    (u) => u.signupDateId !== null && daysBetween(u.signupDateId, todayDateId) >= dayN
  );
  const returned = eligibles.filter((u) => {
    const signup = u.signupDateId as string;
    return normalizeActiveDays(u.funnel?.activeDays).some((d) => daysBetween(signup, d) >= dayN);
  });
  return {
    eligible: eligibles.length,
    returned: returned.length,
    pct: eligibles.length === 0 ? 0 : round1((returned.length / eligibles.length) * 100),
  };
}

export function buildFunnelReport(
  users: FunnelUser[],
  now: Date,
  windowDays: number | null = null
): FunnelReport {
  const todayDateId = madridDateId(now);
  const inWindow =
    windowDays === null
      ? users
      : users.filter((u) => u.signupDateId !== null && daysBetween(u.signupDateId, todayDateId) < windowDays);

  const signups = inWindow.length;

  const stages: StageCount[] = FUNNEL_STAGES.map((key, i) => {
    const count = inWindow.filter((u) => reachedStage(u, key)).length;
    const previous = i === 0 ? null : inWindow.filter((u) => reachedStage(u, FUNNEL_STAGES[i - 1])).length;
    return {
      key,
      label: STAGE_LABELS[key],
      users: count,
      pctOfPrevious: previous === null ? null : previous === 0 ? 0 : round1((count / previous) * 100),
      pctOfSignups: signups === 0 ? 0 : round1((count / signups) * 100),
    };
  });

  return {
    windowDays,
    generatedAt: now.toISOString(),
    signups,
    stages,
    retention: {
      d1: retentionAt(inWindow, 1, todayDateId),
      d7: retentionAt(inWindow, 7, todayDateId),
      d30: retentionAt(inWindow, 30, todayDateId),
    },
    biggestDrop: findBiggestDrop(stages),
  };
}

/**
 * El escalón donde se pierde más gente en términos absolutos.
 *
 * Absolutos y no porcentaje a propósito: un 100% de caída sobre 2 usuarios no
 * es el problema a resolver, y ordenar por porcentaje lo pondría primero.
 */
export function findBiggestDrop(stages: StageCount[]): FunnelReport["biggestDrop"] {
  let worst: FunnelReport["biggestDrop"] = null;
  for (let i = 1; i < stages.length; i++) {
    const from = stages[i - 1];
    const to = stages[i];
    const lost = from.users - to.users;
    if (lost <= 0) continue;
    if (!worst || lost > worst.lostUsers) {
      worst = {
        from: from.key,
        to: to.key,
        lostUsers: lost,
        lostPct: from.users === 0 ? 0 : round1((lost / from.users) * 100),
      };
    }
  }
  return worst;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
