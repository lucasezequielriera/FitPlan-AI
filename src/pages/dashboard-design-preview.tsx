import Head from "next/head";
import Link from "next/link";
import { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  FaChartLine,
  FaWeight,
  FaChevronRight,
  FaCrown,
  FaUserFriends,
  FaTimes,
  FaTrash,
} from "react-icons/fa";

/**
 * PROPUESTA DE REESTRUCTURACIÓN DEL DASHBOARD DE CLIENTE — fase de definición de `diseño`
 * -----------------------------------------------------------------------------------------
 * NO es una pantalla real: es la demo visual que acompaña la spec de DESIGN_SYSTEM.md §13.
 * Datos hardcodeados/simulados con los controles de abajo — nada de Firestore/auth real.
 * Usa solo tokens/clases YA existentes en globals.css (--accent, --accent-strong,
 * --surface*, --brand-start/mid/end en su uso aprobado de barras de progreso, .btn-primary,
 * .card-surface, .badge-phase-*, font-display).
 *
 * Qué muestra:
 *  - Mobile (`< lg`): una columna, orden por prioridad — plan activo (hero compacto) →
 *    acciones rápidas → otros planes (lista, no tarjetas) → franja de upsell → espacio
 *    reservado para la tab bar de §11.
 *  - Desktop (`lg:` y arriba): hero + sidebar de 320px (premium / registrar peso /
 *    entrenador), columna principal con lista compacta de otros planes debajo del hero.
 *  - Modal de progreso consolidado (sin la caja redundante que repetía el % del anillo).
 *  - Selector de Opción A / Opción B para el CTA con gradiente — DESIGN_SYSTEM.md §13.5,
 *    pendiente de que Lucas decida. Nada de esto se aplicó todavía al código real.
 *
 * Pendiente (para `frontend`, no implementado acá): ver DESIGN_SYSTEM.md §13.9.
 *
 * Restricción de motion: sin `initial: { opacity: 0 }` en ningún lado (regla nueva,
 * ver §12/§11.6) — se anima solo posición (`y`), nunca opacidad desde 0.
 */

type PlanCount = "none" | "one" | "many";
type CtaOption = "A" | "B";

type DemoPlan = {
  id: string;
  title: string;
  createdLabel: string;
  phase: "bulk" | "cut" | "lean-bulk" | "maintenance" | null;
  phaseLabel: string;
  progress: number;
  daysRemaining: number;
};

const OTHER_PLANS: DemoPlan[] = [
  {
    id: "p2",
    title: "Definición · Verano",
    createdLabel: "12/05/2026",
    phase: "cut",
    phaseLabel: "Definición",
    progress: 100,
    daysRemaining: 0,
  },
  {
    id: "p3",
    title: "Plan Base",
    createdLabel: "02/02/2026",
    phase: null,
    phaseLabel: "Sin fase",
    progress: 100,
    daysRemaining: 0,
  },
];

const phaseBadgeClass: Record<string, string> = {
  bulk: "badge-phase-bulk",
  cut: "badge-phase-cut",
  "lean-bulk": "badge-phase-lean-bulk",
  maintenance: "badge-phase-maintenance",
};

export default function DashboardDesignPreview() {
  const [planCount, setPlanCount] = useState<PlanCount>("many");
  const [multiFase, setMultiFase] = useState(true);
  const [isPremium, setIsPremium] = useState(true);
  const [progressModalOpen, setProgressModalOpen] = useState(false);
  const [ctaOption, setCtaOption] = useState<CtaOption>("A");
  const reduceMotion = useReducedMotion();

  const hasActivePlan = planCount !== "none";
  const hasOtherPlans = planCount === "many";
  const pct = multiFase ? 42 : 68;

  const ctaGradientStyle: React.CSSProperties | undefined =
    ctaOption === "B"
      ? {
          background:
            "linear-gradient(135deg, var(--accent) 0%, color-mix(in oklab, var(--accent-strong) 45%, var(--background)) 100%)",
        }
      : undefined;

  const primaryCtaClass =
    ctaOption === "A"
      ? "btn btn-primary"
      : "inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-accent-ink transition hover:brightness-110";

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <Head>
        <title>Propuesta de rediseño — Dashboard de cliente — FitPlan</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <div className="border-b border-border bg-[color-mix(in_oklab,var(--warning)_10%,var(--surface))] px-4 py-2.5 text-center text-xs text-[var(--warning)] sm:text-sm">
        Propuesta de rediseño del dashboard de cliente — no es una pantalla real, datos y estado simulados con los controles de abajo.{" "}
        <Link href="/dashboard" className="underline underline-offset-2 hover:no-underline">
          Ver el dashboard real
        </Link>
      </div>

      {/* ============= CONTROLES DE LA DEMO (no forman parte de la propuesta) ============= */}
      <div className="border-b border-border bg-surface px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-text-subtle">Planes:</span>
            {(
              [
                { id: "none", label: "Sin planes" },
                { id: "one", label: "1 plan" },
                { id: "many", label: "3 planes (premium)" },
              ] as Array<{ id: PlanCount; label: string }>
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setPlanCount(opt.id)}
                className={`rounded-lg border px-2.5 py-1 font-medium transition-colors ${
                  planCount === opt.id
                    ? "border-accent/40 bg-accent/12 text-accent"
                    : "border-border bg-surface-2 text-text-muted hover:text-foreground"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <label className="flex items-center gap-1.5 text-text-muted">
            <input type="checkbox" checked={multiFase} onChange={(e) => setMultiFase(e.target.checked)} />
            Plan activo multi-fase
          </label>

          <label className="flex items-center gap-1.5 text-text-muted">
            <input type="checkbox" checked={isPremium} onChange={(e) => setIsPremium(e.target.checked)} />
            Premium
          </label>

          <button
            type="button"
            onClick={() => setProgressModalOpen(true)}
            className="rounded-lg border border-border bg-surface-2 px-2.5 py-1 font-medium text-text-muted transition-colors hover:text-foreground"
          >
            Abrir modal de progreso (rediseño)
          </button>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-text-subtle">Gradiente CTA (pendiente de Lucas — §13.5):</span>
            {(
              [
                { id: "A", label: "Opción A · sólido lima (recomendada)" },
                { id: "B", label: "Opción B · glow lima→negro" },
              ] as Array<{ id: CtaOption; label: string }>
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setCtaOption(opt.id)}
                className={`rounded-lg border px-2.5 py-1 font-medium transition-colors ${
                  ctaOption === opt.id
                    ? "border-accent/40 bg-accent/12 text-accent"
                    : "border-border bg-surface-2 text-text-muted hover:text-foreground"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ============= DASHBOARD ============= */}
      <div className="mx-auto max-w-6xl px-4 py-6 pb-24 sm:px-6 sm:py-8 lg:pb-10">
        {/* Header mínimo — sin CTAs compitiendo (13.2-A) */}
        <header className="mb-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-text-subtle">FitPlan</p>
          <h1 className="font-display mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Hola, Sofía
          </h1>
          <p className="mt-1 text-sm text-text-muted">Esto es lo que necesitás saber hoy.</p>
        </header>

        {!hasActivePlan ? (
          <EmptyState primaryCtaClass={primaryCtaClass} ctaGradientStyle={ctaGradientStyle} />
        ) : (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px] lg:gap-6">
            {/* Columna principal */}
            <div className="flex flex-col gap-5">
              <ActivePlanHero
                pct={pct}
                multiFase={multiFase}
                primaryCtaClass={primaryCtaClass}
                ctaGradientStyle={undefined /* "Ver mi plan" siempre .btn-primary, no es el CTA en discusión */}
              />

              {/* Acciones rápidas — visibles siempre, con más presencia en mobile (13.3) */}
              <div className="grid grid-cols-2 gap-3 lg:hidden">
                <button
                  type="button"
                  onClick={() => setProgressModalOpen(true)}
                  className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-border bg-surface px-4 py-3 text-sm font-medium text-foreground transition hover:border-accent/30"
                >
                  <FaChartLine className="h-4 w-4 text-accent" aria-hidden />
                  Progreso
                </button>
                <button
                  type="button"
                  className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-border bg-surface px-4 py-3 text-sm font-medium text-foreground transition hover:border-accent/30"
                >
                  <FaWeight className="h-4 w-4 text-accent" aria-hidden />
                  Registrar peso
                </button>
              </div>

              {hasOtherPlans && (
                <section className="card-surface p-4 sm:p-5">
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.15em] text-text-subtle">
                    Otros planes
                  </p>
                  <div className="divide-y divide-border">
                    {OTHER_PLANS.map((plan) => (
                      <OtherPlanRow key={plan.id} plan={plan} />
                    ))}
                  </div>
                </section>
              )}

              {/* Franja de upsell — al final, no compite con el contenido principal (13.2-D) */}
              {!isPremium && (
                <UpsellStrip primaryCtaClass={primaryCtaClass} ctaGradientStyle={ctaGradientStyle} />
              )}

              <TrainerLink />
            </div>

            {/* Sidebar — solo desktop, usa el ancho que mobile no tiene (13.3) */}
            <aside className="hidden flex-col gap-4 lg:flex">
              {!isPremium && (
                <SidebarCard
                  icon={<FaCrown className="h-4 w-4" aria-hidden />}
                  title="Hazte premium"
                  body="Planes ilimitados y acceso completo a tu historial."
                >
                  <button
                    type="button"
                    style={ctaGradientStyle}
                    className={`mt-3 w-full ${primaryCtaClass}`}
                  >
                    Ver planes premium
                  </button>
                </SidebarCard>
              )}
              <SidebarCard
                icon={<FaWeight className="h-4 w-4" aria-hidden />}
                title="Registrar peso"
                body="Carga rápida, sin abrir el detalle."
              >
                <div className="mt-3 flex gap-2">
                  <input
                    type="number"
                    placeholder="kg"
                    className="min-w-0 flex-1 rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-foreground placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-accent/40"
                  />
                  <button type="button" className="btn btn-secondary px-3">
                    Guardar
                  </button>
                </div>
              </SidebarCard>
              <SidebarCard
                icon={<FaUserFriends className="h-4 w-4" aria-hidden />}
                title="Entrenador personal"
                body="Soporte humano vía WhatsApp para tu plan."
              >
                <button type="button" className="btn btn-secondary mt-3 w-full">
                  Solicitar
                </button>
              </SidebarCard>
            </aside>
          </div>
        )}
      </div>

      {/* ============= MODAL DE PROGRESO CONSOLIDADO (13.4-A) ============= */}
      <AnimatePresence>
        {progressModalOpen && (
          <>
            <motion.div
              initial={reduceMotion ? undefined : { opacity: 1 }}
              animate={{ opacity: 1 }}
              exit={reduceMotion ? undefined : { opacity: 1 }}
              onClick={() => setProgressModalOpen(false)}
              className="fixed inset-0 z-[9999] bg-black/75 backdrop-blur-md"
            />
            <div className="pointer-events-none fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-4">
              <motion.div
                initial={{ y: 14 }}
                animate={{ y: 0 }}
                exit={{ y: 14 }}
                transition={{ type: "spring", damping: 26, stiffness: 320 }}
                onClick={(e) => e.stopPropagation()}
                className="pointer-events-auto flex max-h-[min(92vh,calc(100vh-2rem))] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-[color-mix(in_oklab,var(--background)_88%,#0a0f18)] shadow-[0_40px_100px_-36px_rgba(0,0,0,0.9)] ring-1 ring-[color-mix(in_oklab,var(--foreground)_5%,transparent)]"
              >
                <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4 sm:px-6">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-text-subtle">FitPlan</p>
                    <h2 className="font-display mt-1 text-xl font-bold text-foreground">Progreso del plan</h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setProgressModalOpen(false)}
                    className="rounded-xl border border-border bg-surface p-2 text-text-muted transition hover:text-foreground"
                    aria-label="Cerrar"
                  >
                    <FaTimes className="h-4 w-4" aria-hidden />
                  </button>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
                  {/* Anillo + UNA sola caja de estado (se eliminó la caja redundante de "% del plan") */}
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                    <div
                      className="relative h-20 w-20 shrink-0 rounded-full p-[3px]"
                      style={{
                        background: `conic-gradient(from -90deg, var(--accent) 0%, var(--accent) ${pct}%, color-mix(in oklab, var(--foreground) 12%, transparent) ${pct}%, color-mix(in oklab, var(--foreground) 12%, transparent) 100%)`,
                      }}
                    >
                      <div className="flex h-full w-full items-center justify-center rounded-full bg-background text-center">
                        <p className="font-display text-xl font-bold tabular-nums text-foreground">{pct}%</p>
                      </div>
                    </div>
                    <div className="rounded-xl border border-border bg-surface-2 px-4 py-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-text-subtle">
                        Peso inicial → actual
                      </p>
                      <p className="font-display mt-1 text-sm font-semibold text-foreground">
                        78.0 kg <span className="text-success">→ 75.4 kg (-2.6 kg)</span>
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <div className="rounded-2xl border border-border bg-surface-2 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-subtle">
                        Registrar peso
                      </p>
                      <div className="mt-3 flex gap-2">
                        <input
                          type="number"
                          placeholder="75.4"
                          className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-accent/40"
                        />
                        <button type="button" className="btn btn-primary shrink-0">
                          Guardar
                        </button>
                      </div>
                      <div className="mt-4 space-y-1.5">
                        {["12 mar · 75.4 kg", "05 mar · 76.1 kg", "27 feb · 76.8 kg"].map((row) => (
                          <div
                            key={row}
                            className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2 text-xs text-text-muted"
                          >
                            <span>{row}</span>
                            <button type="button" className="text-danger/80 hover:text-danger" aria-label="Eliminar registro">
                              <FaTrash className="h-3 w-3" aria-hidden />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-border bg-surface-2 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-subtle">
                        Evolución
                      </p>
                      <div className="mt-3 flex h-32 items-end justify-between gap-1.5">
                        {[70, 60, 55, 45, 40, 30].map((h, i) => (
                          <div key={i} className="w-full max-w-[2.5rem] rounded-t-md bg-success/80" style={{ height: `${h}%` }} />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

      {/* ============= NOTA: TABLA → TARJETAS / CAJAS ANIDADAS → CONSOLIDADAS (13.4-B/C) ============= */}
      <div className="mx-auto max-w-6xl px-4 pb-14 sm:px-6">
        <section className="card-surface p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-text-subtle">
            Referencia — patrón para PremiumPlanModal y PlanContinuityModal (§13.4-B/C)
          </p>
          <p className="mt-2 max-w-2xl text-sm text-text-muted">
            No se reconstruyen acá los 2 modales completos (fuera de alcance de esta demo) — se ilustra el
            patrón que <code className="text-xs">frontend</code> debe aplicar: ninguna tabla HTML real, y ningún
            grupo de campos relacionados en su propia tarjeta suelta.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-semibold text-danger">Antes — tabla + tarjetas anidadas</p>
              <div className="overflow-hidden rounded-xl border border-danger/30 bg-danger/5 p-3 text-xs text-text-muted">
                <div className="mb-2 grid grid-cols-3 gap-2 border-b border-danger/20 pb-2 font-semibold text-foreground">
                  <span>Característica</span>
                  <span>Free</span>
                  <span>Premium</span>
                </div>
                <div className="grid grid-cols-3 gap-2 py-1">
                  <span>Planes simultáneos</span>
                  <span>1</span>
                  <span>Ilimitados</span>
                </div>
                <div className="mt-3 rounded-lg border border-danger/25 bg-surface p-2">Campo A + Campo B</div>
                <div className="mt-2 rounded-lg border border-danger/25 bg-surface p-2">Campo C + Campo D</div>
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold text-success">Después — filas/tarjetas + secciones con separador</p>
              <div className="rounded-xl border border-success/30 bg-success/5 p-3 text-xs text-text-muted">
                <div className="flex items-center justify-between border-b border-border py-1.5">
                  <span>Planes simultáneos</span>
                  <span className="text-foreground">1 → Ilimitados</span>
                </div>
                <div className="border-b border-border py-2">Campo A + Campo B</div>
                <div className="py-2">Campo C + Campo D</div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function ActivePlanHero({
  pct,
  multiFase,
  primaryCtaClass,
  ctaGradientStyle,
}: {
  pct: number;
  multiFase: boolean;
  primaryCtaClass: string;
  ctaGradientStyle?: React.CSSProperties;
}) {
  return (
    <section className="card-surface relative overflow-hidden p-5 sm:p-6">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-1.5"
        style={{ background: "linear-gradient(90deg, var(--brand-start), var(--brand-mid), var(--brand-end))" }}
      />
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-text-subtle">Plan activo</p>
          <h2 className="font-display mt-1 text-xl font-bold text-foreground sm:text-2xl">
            {multiFase ? "Recomposición · Mes 2/4" : "Volumen limpio"}
          </h2>
          {multiFase && (
            <span className={`badge ${phaseBadgeClass["lean-bulk"]} mt-2 inline-flex`}>Fase: Recomposición</span>
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
            <p>{Math.round((30 * (100 - pct)) / 100)} días restantes</p>
          </div>
        </div>
      </div>

      <div className="mt-5 h-2 w-full overflow-hidden rounded-full bg-surface-2">
        <div
          className="h-full rounded-full"
          style={{
            width: `${pct}%`,
            background: "linear-gradient(90deg, var(--brand-start), var(--brand-mid), var(--brand-end))",
          }}
        />
      </div>

      <button type="button" style={ctaGradientStyle} className={`mt-5 w-full sm:w-auto ${primaryCtaClass}`}>
        Ver mi plan
        <FaChevronRight className="h-3.5 w-3.5" aria-hidden />
      </button>
    </section>
  );
}

function OtherPlanRow({ plan }: { plan: DemoPlan }) {
  return (
    <div className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">{plan.title}</p>
        <p className="text-xs text-text-subtle">{plan.createdLabel}</p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {plan.phase ? (
          <span className={`badge ${phaseBadgeClass[plan.phase]} hidden sm:inline-flex`}>{plan.phaseLabel}</span>
        ) : (
          <span className="badge badge-neutral hidden sm:inline-flex">{plan.phaseLabel}</span>
        )}
        <span className="font-display text-xs font-semibold tabular-nums text-text-muted">{plan.progress}%</span>
        <FaChevronRight className="h-3.5 w-3.5 text-text-subtle" aria-hidden />
      </div>
    </div>
  );
}

function UpsellStrip({
  primaryCtaClass,
  ctaGradientStyle,
}: {
  primaryCtaClass: string;
  ctaGradientStyle?: React.CSSProperties;
}) {
  return (
    <section className="card-surface flex flex-col items-start justify-between gap-3 p-4 sm:flex-row sm:items-center sm:p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/12 text-accent">
          <FaCrown className="h-4 w-4" aria-hidden />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Hazte premium</p>
          <p className="text-xs text-text-muted">Planes ilimitados y acceso completo a tu historial.</p>
        </div>
      </div>
      <button type="button" style={ctaGradientStyle} className={`w-full sm:w-auto ${primaryCtaClass}`}>
        Ver planes premium
      </button>
    </section>
  );
}

function TrainerLink() {
  return (
    <button
      type="button"
      className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-surface px-4 py-3 text-xs font-medium text-text-muted transition hover:border-accent/30 hover:text-foreground lg:hidden"
    >
      <FaUserFriends className="h-3.5 w-3.5" aria-hidden />
      Pedir entrenador personal
    </button>
  );
}

function SidebarCard({
  icon,
  title,
  body,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card-surface p-4">
      <div className="flex items-center gap-2 text-accent">
        {icon}
        <p className="text-sm font-semibold text-foreground">{title}</p>
      </div>
      <p className="mt-1.5 text-xs text-text-muted">{body}</p>
      {children}
    </div>
  );
}

function EmptyState({
  primaryCtaClass,
  ctaGradientStyle,
}: {
  primaryCtaClass: string;
  ctaGradientStyle?: React.CSSProperties;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-surface px-6 py-14 text-center">
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-2 ring-1 ring-border">
        <span className="text-4xl" aria-hidden>
          📋
        </span>
      </div>
      <h2 className="font-display text-xl font-semibold text-foreground">Todavía no tenés un plan</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-text-muted">
        Creá tu primer plan personalizado para empezar a entrenar hoy mismo.
      </p>
      <button type="button" style={ctaGradientStyle} className={`mx-auto mt-8 ${primaryCtaClass}`}>
        Crear mi primer plan
      </button>
    </div>
  );
}
