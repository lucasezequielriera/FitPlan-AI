import type { ComponentType } from "react";

/**
 * Botón de acción por ícono para filas de tabla/tarjeta densas — DESIGN_SYSTEM.md §7.3-C.
 * Reemplaza los 5-6 botones de texto con colores dispares por fila. Tono
 * neutral por defecto (decorativo, sin estado real, criterio §6); solo
 * usa color cuando representa un estado real (success = crear/cobrar,
 * info = acción neutra/informativa, warning = pendiente, danger = destructivo).
 * Siempre lleva title + aria-label explícito (accesibilidad, §7.3-D).
 */

type ActionTone = "neutral" | "success" | "info" | "warning" | "danger";

const TONE_CLASSES: Record<Exclude<ActionTone, "neutral">, string> = {
  success: "border-success/40 bg-success/15 text-success hover:bg-success/25",
  info: "border-info/40 bg-info/15 text-info hover:bg-info/25",
  warning: "border-warning/40 bg-warning/15 text-warning hover:bg-warning/25",
  danger: "hover:border-danger/40 hover:bg-danger/10 hover:text-danger",
};

export function AdminActionIcon({
  icon: Icon,
  label,
  onClick,
  tone = "neutral",
  disabled,
  loading,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  onClick?: () => void;
  tone?: ActionTone;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`btn-ghost flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        tone === "neutral" ? "hover:border-border-strong" : TONE_CLASSES[tone]
      }`}
    >
      {loading ? (
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current/30 border-t-current" aria-hidden />
      ) : (
        <Icon className="h-3.5 w-3.5" aria-hidden />
      )}
    </button>
  );
}
