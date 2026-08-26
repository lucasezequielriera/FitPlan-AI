/**
 * Shell de modal único — DESIGN_SYSTEM.md §13.4-D.
 *
 * Los modales de cliente (dashboard, PremiumPlanModal, PlanContinuityModal)
 * armaban cada uno su propia combinación de border/shadow/color-mix para el
 * backdrop y el panel, ligeramente distinta entre sí. Estos son los valores
 * que ya usaba el modal de progreso (el más nuevo/completo de los 6) — se
 * promueven acá como el estándar compartido en vez de mantener 6 variantes.
 *
 * También centraliza la animación del panel/backdrop: nunca `opacity: 0`
 * inicial (DESIGN_SYSTEM.md §12/§13.7) — el backdrop aparece/desaparece sin
 * fade (mismo patrón ya usado en `dashboard-design-preview.tsx`) y el panel
 * anima solo posición (`y`).
 */

export const MODAL_BACKDROP_CLASS = "fixed inset-0 bg-black/75 backdrop-blur-md";

export const MODAL_PANEL_CLASS =
  "rounded-2xl border border-border bg-[color-mix(in_oklab,var(--background)_88%,#0a0f18)] shadow-[0_40px_100px_-36px_rgba(0,0,0,0.9)] ring-1 ring-[color-mix(in_oklab,var(--foreground)_5%,transparent)]";

export const MODAL_BACKDROP_MOTION = {
  initial: { opacity: 1 },
  animate: { opacity: 1 },
  exit: { opacity: 1 },
} as const;

export const MODAL_PANEL_MOTION = {
  initial: { y: 14 },
  animate: { y: 0 },
  exit: { y: 14 },
  transition: { type: "spring" as const, damping: 26, stiffness: 320 },
} as const;
