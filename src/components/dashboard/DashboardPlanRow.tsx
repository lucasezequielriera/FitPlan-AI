import { FaChevronRight } from "react-icons/fa";
import { HiOutlineTrash } from "react-icons/hi2";
import type { AppLocale } from "@/contexts/AppLocaleContext";
import { dash, planCardTitle } from "@/lib/i18n/appUi";
import type { SavedPlan } from "@/types/savedPlan";
import type { Timestamp } from "firebase/firestore";

type Props = {
  plan: SavedPlan;
  locale: AppLocale;
  isPremium: boolean;
  onRowClick: () => void;
  onDeleteClick: (e: React.MouseEvent) => void;
  calculateProgress: (createdAt: Timestamp | undefined) => number;
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

/**
 * Fila compacta para "Otros planes" (historial) — DESIGN_SYSTEM.md §13.2-13.3.
 * Reemplaza la tarjeta densa que antes se repetía igual para cada plan del
 * usuario: acá solo título/fecha/fase/progreso/chevron, nunca un `<table>`.
 */
export function DashboardPlanRow({ plan, locale, isPremium, onRowClick, onDeleteClick, calculateProgress }: Props) {
  const user = plan.plan?.user as Record<string, unknown> | undefined;
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

  const pmf = plan.planMultiFase;
  const pct = Math.round(calculateProgress(plan.createdAt));

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onRowClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onRowClick();
      }}
      className="flex min-h-[44px] cursor-pointer items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{title}</p>
        <p className="text-xs text-text-subtle">{createdStr}</p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {/* `hidden`/`sm:` no puede ir en el mismo nodo que `.badge`: `.badge` se
            define en globals.css fuera de un `@layer` de Tailwind y gana el
            empate de especificidad contra `hidden` sin importar el orden de
            clases en el JSX — se envuelve en un contenedor. */}
        <div className="hidden sm:block">
          {pmf ? (
            <span className={`badge ${phaseBadgeClass[pmf.faseActual]}`}>{dash(locale, faseLabelKey[pmf.faseActual])}</span>
          ) : (
            <span className="badge badge-neutral">{dash(locale, "noPhaseLabel")}</span>
          )}
        </div>
        <span className="font-display text-xs font-semibold tabular-nums text-text-muted">{pct}%</span>
        {isPremium && (
          <button
            type="button"
            onClick={onDeleteClick}
            className="rounded-lg p-1.5 text-danger/80 transition hover:bg-danger/15 hover:text-danger"
            title={dash(locale, "deletePlan")}
            aria-label={dash(locale, "deletePlan")}
          >
            <HiOutlineTrash className="h-4 w-4" aria-hidden />
          </button>
        )}
        <FaChevronRight className="h-3.5 w-3.5 text-text-subtle" aria-hidden />
      </div>
    </div>
  );
}
