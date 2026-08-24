import Link from "next/link";

export type AdminSubTab = { label: string; href: string; active: boolean };

/**
 * Sub-pestañas de un mismo dominio dentro de una sección del sidebar
 * (ej. Clientes: FitPlan / 1:1 / Actividad — Contenido: generador / carrusel / métricas).
 * Cada pestaña es una ruta real distinta; el estado activo se decide por
 * la página que la renderiza, no por matching de router acá.
 */
export function AdminSubTabs({ tabs }: { tabs: AdminSubTab[] }) {
  return (
    <div className="mt-5 flex flex-wrap gap-2">
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className="rounded-xl px-4 py-2 text-sm font-semibold transition-colors"
          style={
            t.active
              ? { background: "var(--accent)", color: "var(--accent-ink)" }
              : { background: "var(--surface-2)", color: "var(--text-muted)", border: "1px solid var(--border)" }
          }
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
