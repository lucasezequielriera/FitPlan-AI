import { FaChevronRight } from "react-icons/fa";
import type { AppLocale } from "@/contexts/AppLocaleContext";
import { dash, dashFmt, goalLabel } from "@/lib/i18n/appUi";
import type { SavedPlan } from "@/types/savedPlan";
import type { Timestamp } from "firebase/firestore";

type Props = {
  plan: SavedPlan;
  locale: AppLocale;
  onOpenPlan: () => void;
  onProgressClick: (e: React.MouseEvent) => void;
  onContinuityClick: (e: React.MouseEvent) => void;
  calculateProgress: (createdAt: Timestamp | undefined) => number;
  calculateDaysRemaining: (createdAt: Timestamp | undefined) => number;
};

const faseLabelKey: Record<string, "mfPhaseBulk" | "mfPhaseCut" | "mfPhaseLeanBulk" | "mfPhaseMaint"> = {
  BULK: "mfPhaseBulk",
  CUT: "mfPhaseCut",
  LEAN_BULK: "mfPhaseLeanBulk",
  MANTENIMIENTO: "mfPhaseMaint",
};

const phaseBadgeClass: Record<string, string> = {
  BULK: "badge-phase-bulk",
  CUT: "badge-phase-cut",
  LEAN_BULK: "badge-phase-lean-bulk",
  MANTENIMIENTO: "badge-phase-maintenance",
};

function calcularProgresoMes(plan: SavedPlan): number {
  try {
    const pmf = plan.planMultiFase;
    if (!pmf) return 0;
    const historialMeses = pmf.historialMeses ?? [];
    const mesActual = pmf.mesActual || 1;
    const mesActualData = historialMeses[mesActual - 1];
    if (mesActualData?.fechaGeneracion) {
      const fechaInicio = new Date(mesActualData.fechaGeneracion);
      const now = new Date();
      const diffDays = (now.getTime() - fechaInicio.getTime()) / (1000 * 60 * 60 * 24);
      return Math.min(100, Math.max(0, (diffDays / 30) * 100));
    }
  } catch {
    /* ignore */
  }
  return 0;
}

/**
 * Tarjeta "hero" del plan activo (DESIGN_SYSTEM.md §13.2/§13.3) — nombre,
 * fase/progreso y un solo CTA primario ("Ver mi plan"). Reemplaza el
 * tratamiento "todo incluido" que antes usaba la misma tarjeta para el plan
 * activo y para el historial (ver DashboardPlanRow para ese otro caso).
 */
export function DashboardPlanHero({
  plan,
  locale,
  onOpenPlan,
  onProgressClick,
  onContinuityClick,
  calculateProgress,
  calculateDaysRemaining,
}: Props) {
  const user = plan.plan?.user as Record<string, unknown> | undefined;
  const pmf = plan.planMultiFase;

  const title = pmf
    ? `${dash(locale, faseLabelKey[pmf.faseActual])} · ${dash(locale, "month")} ${pmf.mesActual || 1}/${pmf.totalMeses || 1}`
    : plan.isOldest
      ? dash(locale, "planBase")
      : goalLabel(locale, user?.objetivo as string | undefined);

  const pct = pmf ? Math.round(calcularProgresoMes(plan)) : calculateProgress(plan.createdAt);
  const diasRestantes = pmf
    ? Math.max(0, Math.ceil(30 - (calcularProgresoMes(plan) / 100) * 30))
    : calculateDaysRemaining(plan.createdAt);

  const showContinuity = !pmf && pct >= 90 && !plan.completado;

  return (
    <section className="card-surface relative overflow-hidden p-5 sm:p-6">
      {/* Gradiente de marca — uso aprobado (franja fina), no en el CTA (DESIGN_SYSTEM.md §13.5 Opción A) */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-1.5"
        style={{ background: "linear-gradient(90deg, var(--brand-start), var(--brand-mid), var(--brand-end))" }}
      />
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-text-subtle">
            {dash(locale, "activePlanLabel")}
          </p>
          <h2 className="font-display mt-1 text-xl font-bold text-foreground sm:text-2xl">{title}</h2>
          {pmf && (
            <span className={`badge ${phaseBadgeClass[pmf.faseActual]} mt-2 inline-flex`}>
              {dash(locale, faseLabelKey[pmf.faseActual])}
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <div
            className="relative h-16 w-16 shrink-0 rounded-full p-[3px]"
            style={{
              background: `conic-gradient(from -90deg, var(--accent) 0%, var(--accent) ${pct}%, color-mix(in oklab, var(--foreground) 12%, transparent) ${pct}%, color-mix(in oklab, var(--foreground) 12%, transparent) 100%)`,
            }}
          >
            <div className="flex h-full w-full items-center justify-center rounded-full bg-background">
              <p className="font-display text-sm font-bold tabular-nums text-foreground">{pct}%</p>
            </div>
          </div>
          <div className="hidden text-sm text-text-muted sm:block">
            <p>{dashFmt(locale, "daysRemaining", { n: diasRestantes })}</p>
          </div>
        </div>
      </div>

      <div className="mt-5 h-2 w-full overflow-hidden rounded-full bg-surface-2">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${pct}%`,
            background: "linear-gradient(90deg, var(--brand-start), var(--brand-mid), var(--brand-end))",
          }}
        />
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <button type="button" onClick={onOpenPlan} className="btn btn-primary w-full sm:w-auto">
          {dash(locale, "viewMyPlan")}
          <FaChevronRight className="h-3.5 w-3.5" aria-hidden />
        </button>
        {showContinuity && (
          <button type="button" onClick={onContinuityClick} className="btn btn-success w-full sm:w-auto">
            {dash(locale, "prepareContinuity")}
          </button>
        )}
        {/* `hidden`/`lg:flex` no pueden ir en el mismo nodo que `.btn`: `.btn` se
            define en globals.css fuera de un `@layer` de Tailwind, así que gana
            el empate de especificidad contra la utilidad `hidden` sin importar
            el orden de las clases en el JSX — se envuelve en un contenedor. */}
        <div className="hidden lg:block">
          <button type="button" onClick={onProgressClick} className="btn btn-secondary">
            {dash(locale, "cardOpenProgress")}
          </button>
        </div>
      </div>
    </section>
  );
}
