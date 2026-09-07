import { daysBetween, isDateId } from "@/lib/dates/madrid";
import { buildPeriodization, type Periodization } from "@/lib/hyrox/periodization";
import { PHASES, type PhaseKey, type WeekPlan } from "@/lib/hyrox/plan";
import { buildSessions } from "@/lib/hyrox/sessions";
import type { HyroxProfile } from "@/lib/hyrox/profile";

/**
 * Ensambla el plan completo: periodización + sesiones semana a semana.
 *
 * Puro y determinista. Mismo perfil y misma fecha ⇒ mismo plan, siempre. Eso
 * importa para que el usuario no vea su plan cambiar solo entre visitas, y para
 * poder testear el resultado entero sin mocks.
 */

export type GeneratedPlan = {
  profile: HyroxProfile;
  periodization: Periodization;
  /** Lunes de la primera semana del plan, "YYYY-MM-DD". */
  firstMonday: string;
  weeks: WeekPlan[];
  /** Semana en la que está el usuario hoy, o `null` si el plan aún no empezó o ya acabó. */
  currentWeek: number | null;
  daysUntilRace: number;
};

export function generatePlan(profile: HyroxProfile, todayDateId: string): GeneratedPlan {
  const periodization = buildPeriodization(profile, todayDateId);
  const firstMonday = mondayOnOrAfter(todayDateId);

  const weeks: WeekPlan[] = [];
  let weekNumber = 0;

  for (const allocation of periodization.allocations) {
    for (let i = 0; i < allocation.weeks; i++) {
      weekNumber++;
      const isDeload = periodization.deloadWeeks.includes(weekNumber);
      // `progress` va de 0 a 1 dentro de la fase. Con una sola semana se toma 0
      // (el principio de la progresión), no 1: no tiene sentido empezar un
      // bloque por su sesión más dura.
      const progress = allocation.weeks <= 1 ? 0 : i / (allocation.weeks - 1);

      weeks.push({
        week: weekNumber,
        phase: allocation.key,
        startDate: addDays(firstMonday, (weekNumber - 1) * 7),
        headline: headlineFor(allocation.key, progress, isDeload, weekNumber, periodization.totalWeeks),
        keyGoal: goalFor(allocation.key),
        deload: isDeload,
        progress,
        sessions: buildSessions({
          profile,
          phase: allocation.key,
          progress,
          isDeload,
          week: weekNumber,
          totalWeeks: periodization.totalWeeks,
        }),
      });
    }
  }

  return {
    profile,
    periodization,
    firstMonday,
    weeks,
    currentWeek: currentWeekFor(firstMonday, todayDateId, weeks.length),
    daysUntilRace: isDateId(profile.raceDate) ? Math.max(0, daysBetween(todayDateId, profile.raceDate)) : 0,
  };
}

function goalFor(phase: PhaseKey): string {
  return PHASES.find((p) => p.key === phase)?.goal ?? "";
}

function headlineFor(
  phase: PhaseKey,
  progress: number,
  isDeload: boolean,
  week: number,
  totalWeeks: number
): string {
  if (week === totalWeeks) return "Semana de competición";
  if (isDeload) return "Descarga y asimilación";

  const byPhase: Record<PhaseKey, [string, string, string]> = {
    base: ["Arranque y referencias", "Acumular minutos", "Consolidar la base"],
    construccion: ["Entra la intensidad", "Umbral y estaciones", "Semana clave del bloque"],
    especifico: ["Ritmo objetivo en fatiga", "Media simulación", "Simulación a ritmo real"],
    taper: ["Bajar volumen, mantener chispa", "Afinado final", "Afinado final"],
  };
  const [inicio, medio, fin] = byPhase[phase];
  if (progress < 0.34) return inicio;
  if (progress < 0.67) return medio;
  return fin;
}

/** Primer lunes en o después de la fecha dada. El plan siempre arranca en lunes. */
export function mondayOnOrAfter(dateId: string): string {
  if (!isDateId(dateId)) return dateId;
  const [y, m, d] = dateId.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  // getUTCDay: 0 = domingo, 1 = lunes.
  const dow = date.getUTCDay();
  const delta = dow === 1 ? 0 : dow === 0 ? 1 : 8 - dow;
  return addDays(dateId, delta);
}

export function addDays(dateId: string, days: number): string {
  const [y, m, d] = dateId.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function currentWeekFor(firstMonday: string, todayDateId: string, totalWeeks: number): number | null {
  const offset = daysBetween(firstMonday, todayDateId);
  if (offset < 0) return null;
  const week = Math.floor(offset / 7) + 1;
  return week >= 1 && week <= totalWeeks ? week : null;
}
