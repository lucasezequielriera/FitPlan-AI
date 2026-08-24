import { motion } from "framer-motion";
import { HiChevronRight, HiOutlineChartBar, HiOutlineTrash } from "react-icons/hi2";
import type { AppLocale } from "@/contexts/AppLocaleContext";
import { dash, dashFmt, difficultyLabel, goalLabel, planCardTitle } from "@/lib/i18n/appUi";
import { getPlanTargetWeightLine } from "@/lib/planCardHelpers";
import type { SavedPlan } from "@/types/savedPlan";
import type { Timestamp } from "firebase/firestore";

type Props = {
  plan: SavedPlan;
  locale: AppLocale;
  isPremium: boolean;
  /** Clases Tailwind para la barra superior (gradiente). */
  accentBar: string;
  onCardClick: () => void;
  onProgressClick: (e: React.MouseEvent) => void;
  onDeleteClick: (e: React.MouseEvent) => void;
  calculateProgress: (createdAt: Timestamp | undefined) => number;
  calculateDaysRemaining: (createdAt: Timestamp | undefined) => number;
  onContinuityClick: (e: React.MouseEvent) => void;
};

function StatBox({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-[color-mix(in_oklab,var(--foreground)_8%,transparent)] bg-[color-mix(in_oklab,var(--foreground)_4%,transparent)] p-3 ${className}`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--landing-muted)]">{label}</p>
      <div className="font-display mt-1.5 min-h-[2.5rem] text-sm font-semibold leading-snug text-[var(--foreground)]">{children}</div>
    </div>
  );
}

export function DashboardPlanCard({
  plan,
  locale,
  isPremium,
  accentBar,
  onCardClick,
  onProgressClick,
  onDeleteClick,
  calculateProgress,
  calculateDaysRemaining,
  onContinuityClick,
}: Props) {
  const user = plan.plan?.user as Record<string, unknown> | undefined;
  const planInner = plan.plan?.plan as Record<string, unknown> | undefined;
  const title = planCardTitle(
    locale,
    user?.objetivo as string | undefined,
    Boolean(plan.isOldest),
    String(user?.nombre || dash(locale, "unnamedPlan"))
  );

  const createdStr = (() => {
    const d = plan.createdAt?.toDate?.() || (plan.createdAt?.seconds ? new Date(plan.createdAt.seconds * 1000) : null);
    if (!d || isNaN(d.getTime())) return dash(locale, "dateUnknown");
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  })();

  const pesoKg = user?.pesoKg;
  const hasPeso = pesoKg !== undefined && pesoKg !== null && Number(pesoKg) !== 0;
  const targetLine = getPlanTargetWeightLine(plan);
  const calorias = planInner?.calorias_diarias;
  const hasCals = calorias != null && String(calorias).length > 0;
  const dificultad = planInner?.dificultad;
  const hasDif = dificultad != null && String(dificultad).length > 0;

  const lesiones = (user?.doloresLesiones as string[] | undefined)?.filter((s) => typeof s === "string" && s.trim().length > 0);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      onClick={onCardClick}
      className="group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-[var(--landing-border)] bg-[color-mix(in_oklab,var(--background)_50%,#0c1222)] shadow-[0_16px_48px_-28px_rgba(0,0,0,0.55)] ring-1 ring-[color-mix(in_oklab,var(--foreground)_4%,transparent)] transition-all duration-300 hover:-translate-y-1 hover:border-[color-mix(in_oklab,var(--landing-accent)_30%,transparent)] hover:shadow-[0_28px_56px_-28px_color-mix(in_oklab,var(--landing-accent)_15%,transparent)]"
    >
      <div className={`pointer-events-none absolute inset-x-0 top-0 z-[1] h-1.5 ${accentBar}`} />

      {/* Cabecera: título + acciones secundarias */}
      <div
        className={`relative z-10 gap-3 px-4 pb-2 pt-5 sm:px-5 sm:pt-6 ${
          isPremium ? "flex flex-col items-start" : "flex items-start justify-between"
        }`}
      >
        <div className="min-w-0 flex-1 pr-2">
          <h3 className="text-base font-semibold leading-snug text-[var(--foreground)] sm:text-lg">{title}</h3>
          <p className="mt-1.5 text-[11px] text-[var(--landing-muted)] sm:text-xs">
            <span className="font-medium uppercase tracking-wider">{dash(locale, "creation")}</span> {createdStr}
          </p>
        </div>
        <div
          className={`flex shrink-0 gap-1.5 ${isPremium ? "w-full flex-wrap" : ""}`}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={onProgressClick}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--landing-border)] bg-[color-mix(in_oklab,var(--foreground)_6%,transparent)] px-2.5 py-2 text-xs font-medium text-[var(--landing-accent)] backdrop-blur-sm transition hover:bg-[color-mix(in_oklab,var(--landing-accent)_12%,transparent)] hover:text-[var(--foreground)]"
            title={dash(locale, "viewProgress")}
            aria-label={dash(locale, "viewProgress")}
          >
            <HiOutlineChartBar className="h-4 w-4 shrink-0" aria-hidden />
            <span className="hidden sm:inline">{dash(locale, "cardOpenProgress")}</span>
          </button>
          {isPremium && (
            <button
              type="button"
              onClick={onDeleteClick}
              className="inline-flex items-center gap-1 rounded-xl border border-danger/35 bg-danger/10 px-2.5 py-2 text-xs font-medium text-danger transition hover:bg-danger/25"
              title={dash(locale, "deletePlan")}
              aria-label={dash(locale, "deletePlan")}
            >
              <HiOutlineTrash className="h-4 w-4 shrink-0" aria-hidden />
              <span className="hidden lg:inline">{dash(locale, "deleteVerb")}</span>
            </button>
          )}
        </div>
      </div>

      {/* Badges contexto (fase / dificultad resumida) */}
      <div className="relative z-10 flex flex-wrap gap-2 px-4 sm:px-5">
        {plan.planMultiFase && (
          <div
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 ${
              plan.planMultiFase.faseActual === "BULK"
                ? "badge-phase-bulk"
                : plan.planMultiFase.faseActual === "CUT"
                  ? "badge-phase-cut"
                  : plan.planMultiFase.faseActual === "LEAN_BULK"
                    ? "badge-phase-lean-bulk"
                    : "badge-phase-maintenance"
            }`}
          >
            <span className="font-display text-xs font-semibold">
              {plan.planMultiFase.faseActual === "BULK" && "🏋️"}
              {plan.planMultiFase.faseActual === "CUT" && "✂️"}
              {plan.planMultiFase.faseActual === "LEAN_BULK" && "💎"}
              {plan.planMultiFase.faseActual === "MANTENIMIENTO" && "⚖️"}{" "}
              {dash(locale, "month")} {plan.planMultiFase.mesActual || 1}/{plan.planMultiFase.totalMeses || 1}
            </span>
          </div>
        )}
        {hasDif && (
          <div
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.05] px-2.5 py-1"
            style={{
              borderColor:
                planInner?.dificultad === "dificil"
                  ? "color-mix(in oklab, var(--danger) 40%, transparent)"
                  : planInner?.dificultad === "media"
                    ? "color-mix(in oklab, var(--warning) 40%, transparent)"
                    : "color-mix(in oklab, var(--success) 40%, transparent)",
            }}
          >
            <span className="text-[11px] text-[var(--landing-muted)]">{dash(locale, "difficulty")}</span>
            <span
              className="text-xs font-medium capitalize"
              style={{
                color:
                  planInner?.dificultad === "dificil"
                    ? "color-mix(in oklab, var(--danger) 55%, var(--foreground))"
                    : planInner?.dificultad === "media"
                      ? "color-mix(in oklab, var(--warning) 55%, var(--foreground))"
                      : "color-mix(in oklab, var(--success) 55%, var(--foreground))",
              }}
            >
              {difficultyLabel(locale, planInner?.dificultad as string | undefined)}
            </span>
          </div>
        )}
      </div>

      {/* Resumen: métricas en cuadrícula */}
      <div className="relative z-10 mx-4 mt-4 rounded-2xl border border-[color-mix(in_oklab,var(--foreground)_8%,transparent)] bg-[color-mix(in_oklab,var(--foreground)_3%,transparent)] p-3 sm:mx-5">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--landing-muted)]">
          {dash(locale, "cardAtAGlance")}
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <StatBox label={dash(locale, "goal").replace(":", "")}>
            {goalLabel(locale, user?.objetivo as string | undefined)}
          </StatBox>
          {hasPeso ? (
            <StatBox label={dash(locale, "weightLabel").replace(":", "")}>
              <span>
                {String(user?.pesoKg)} kg
                {targetLine ? (
                  <span className="mt-0.5 block text-xs font-normal text-[var(--landing-muted)]">
                    → {targetLine}
                  </span>
                ) : null}
              </span>
            </StatBox>
          ) : null}
          {hasCals ? (
            <StatBox label={dash(locale, "caloriesLabel").replace(":", "")} className="sm:col-span-2">
              {String(calorias)} kcal
            </StatBox>
          ) : null}
        </div>

        {lesiones && lesiones.length > 0 ? (
          <div className="mt-3 flex gap-2 rounded-xl border border-info/25 bg-info/5 px-3 py-2 text-xs text-[color-mix(in_oklab,var(--info)_55%,var(--foreground))]">
            <span className="shrink-0 text-info" aria-hidden>
              ℹ
            </span>
            <p>
              <span className="text-[var(--landing-muted)]">{dash(locale, "adaptedFor")} </span>
              <span className="font-medium">{lesiones.join(", ")}</span>
            </p>
          </div>
        ) : null}
      </div>

      {/* Progreso */}
      <div className="relative z-10 mt-3 flex-1 border-t border-[var(--landing-border)]/90 px-4 py-4 sm:px-5">
        {plan.planMultiFase ? (
          <PlanMultiFaseBlock plan={plan} locale={locale} />
        ) : (
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--landing-muted)]">
              {dash(locale, "cardOpenProgress")}
            </p>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs text-[var(--landing-muted)]">{dash(locale, "simplePlanProgress")}</span>
              <span className="font-display text-xs font-semibold tabular-nums text-[var(--foreground)]">
                {calculateProgress(plan.createdAt).toFixed(1)}%
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${calculateProgress(plan.createdAt)}%`,
                  background: "linear-gradient(90deg, var(--brand-start), var(--brand-mid), var(--brand-end))",
                }}
              />
            </div>
            <p className="mt-2 text-[11px] text-[var(--landing-muted)]">
              {calculateProgress(plan.createdAt) >= 100
                ? dash(locale, "planCompleted")
                : dashFmt(locale, "daysRemaining", { n: calculateDaysRemaining(plan.createdAt) })}
            </p>
            {calculateProgress(plan.createdAt) >= 90 && !plan.completado && (
              <motion.button
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onContinuityClick(e);
                }}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--success)] to-[var(--accent-strong)] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_28px_-14px_color-mix(in_oklab,var(--success)_50%,transparent)] transition hover:brightness-110"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                  <path d="M12 5v14M5 12l7 7 7-7" />
                </svg>
                {dash(locale, "prepareContinuity")}
              </motion.button>
            )}
          </div>
        )}
      </div>

      <div className="relative z-10 flex items-center justify-center gap-1 border-t border-dashed border-[var(--landing-border)]/70 bg-[color-mix(in_oklab,var(--foreground)_2%,transparent)] py-2.5 text-[11px] text-[var(--landing-muted)]">
        <span>{dash(locale, "cardFooterHint")}</span>
        <HiChevronRight className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
      </div>
    </motion.div>
  );
}

function PlanMultiFaseBlock({ plan, locale }: { plan: SavedPlan; locale: AppLocale }) {
  const pmf = plan.planMultiFase!;
  const faseActual = pmf.faseActual;
  const mesActual = pmf.mesActual || 1;
  const totalMeses = pmf.totalMeses || 1;
  const progresoTotal = Math.round((mesActual / totalMeses) * 100);

  const calcularProgresoMes = () => {
    try {
      const historialMeses = pmf.historialMeses ?? [];
      const mesActualIndex = mesActual - 1;
      const mesActualData = historialMeses[mesActualIndex];
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
  };

  const progresoMes = calcularProgresoMes();
  const mesCompleto = progresoMes >= 90;
  const diasRestantesMes = Math.max(0, Math.ceil(30 - (progresoMes / 100) * 30));

  const faseColors: Record<string, { bg: string; text: string; border: string; gradient: string }> = {
    BULK: { bg: "bg-phase-bulk/20", text: "text-phase-bulk", border: "border-phase-bulk/40", gradient: "linear-gradient(90deg, var(--phase-bulk), color-mix(in oklab, var(--phase-bulk) 70%, white))" },
    CUT: { bg: "bg-phase-cut/20", text: "text-phase-cut", border: "border-phase-cut/40", gradient: "linear-gradient(90deg, var(--phase-cut), color-mix(in oklab, var(--phase-cut) 70%, white))" },
    LEAN_BULK: { bg: "bg-phase-lean-bulk/20", text: "text-phase-lean-bulk", border: "border-phase-lean-bulk/40", gradient: "linear-gradient(90deg, var(--phase-lean-bulk), color-mix(in oklab, var(--phase-lean-bulk) 70%, white))" },
    MANTENIMIENTO: { bg: "bg-phase-maintenance/20", text: "text-phase-maintenance", border: "border-phase-maintenance/40", gradient: "linear-gradient(90deg, var(--phase-maintenance), color-mix(in oklab, var(--phase-maintenance) 70%, white))" },
  };
  const colors = faseColors[faseActual] || faseColors.MANTENIMIENTO;

  const faseLabelKey =
    faseActual === "BULK"
      ? "mfPhaseBulk"
      : faseActual === "CUT"
        ? "mfPhaseCut"
        : faseActual === "LEAN_BULK"
          ? "mfPhaseLeanBulk"
          : "mfPhaseMaint";

  return (
    <div className="space-y-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--landing-muted)]">
        {dash(locale, "cardOpenProgress")} · {dash(locale, faseLabelKey)}
      </p>
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--landing-muted)]">{dashFmt(locale, "mfProgressThisMonth", { n: mesActual })}</span>
          <span className="font-display text-xs font-medium tabular-nums">{Math.round(progresoMes)}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full transition-all duration-300" style={{ width: `${progresoMes}%`, background: colors.gradient }} />
        </div>
        <p className="text-[11px] text-[var(--landing-muted)]">
          {mesCompleto
            ? dashFmt(locale, "mfMonthDoneNext", { m: mesActual, next: mesActual + 1 })
            : dashFmt(locale, "mfDaysLeftInMonth", { d: diasRestantesMes, m: mesActual })}
        </p>
      </div>
      <div className="space-y-1 border-t border-white/10 pt-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--landing-muted)]">{dash(locale, "mfProgressFullProgram")}</span>
          <span className="font-display text-xs font-medium tabular-nums">{progresoTotal}%</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${progresoTotal}%`,
              background: "linear-gradient(90deg, var(--brand-start), var(--brand-mid), var(--brand-end))",
            }}
          />
        </div>
      </div>
    </div>
  );
}
