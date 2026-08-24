import type { ReactNode } from "react";

/**
 * Header estándar de página — DESIGN_SYSTEM.md §7.3-B.
 * Kicker + h1 (font-display) + subtítulo, igual en las 11 vistas que no
 * son Resumen (el gradiente de marca queda reservado solo para Resumen).
 */
export function AdminPageHeader({
  kicker,
  title,
  subtitle,
  actions,
}: {
  kicker: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">{kicker}</p>
        <h1 className="font-display mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-2 max-w-xl text-sm text-text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2.5 shrink-0">{actions}</div>}
    </div>
  );
}
