import Head from "next/head";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Space_Grotesk, Inter } from "next/font/google";

/**
 * REDISEÑO "FitPlan Volt" — APROBADO
 * -----------------------------------------------------------
 * Esta pantalla fue la propuesta de muestra para aprobar dirección.
 * Ya está aprobada y los tokens (paleta, radios, tipografía) se
 * promovieron al :root canónico de globals.css — ver DESIGN_SYSTEM.md.
 * Esta página queda como referencia de estilo (guía visual viva),
 * no como pantalla real de producto. Datos hardcodeados, sin
 * Firestore/auth.
 *
 * Pendiente (fuera de esta tarea):
 *  - `frontend`: adoptar font-display y limpiar la deuda de colores
 *    crudos de Tailwind en las pantallas reales (ver DESIGN_SYSTEM.md §5)
 *  - `marketing`: revisar si las plantillas de contenido para redes
 *    (ej. carrusel de IG) deberían alinearse a esta paleta
 */

const displayFont = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-preview-display",
});

const uiFont = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-preview-ui",
});

const DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const EXERCISES = [
  { name: "Sentadilla con barra", sets: "4 × 8", weight: "60 kg", done: true },
  { name: "Prensa de piernas", sets: "3 × 12", weight: "120 kg", done: true },
  { name: "Zancadas caminando", sets: "3 × 10 / pierna", weight: "20 kg", done: false },
  { name: "Extensión de cuádriceps", sets: "3 × 15", weight: "35 kg", done: false },
];

const MEALS = [
  { name: "Desayuno", detail: "Avena + huevos + banana", kcal: 480 },
  { name: "Almuerzo", detail: "Pollo, arroz y ensalada", kcal: 620 },
  { name: "Merienda", detail: "Yogur + frutos secos", kcal: 260 },
  { name: "Cena", detail: "Salmón con vegetales", kcal: 480 },
];

export default function DesignPreview() {
  const [activeDay, setActiveDay] = useState(2); // Miércoles, "hoy"
  // Accesibilidad: si el usuario tiene prefers-reduced-motion, no animamos
  // (DESIGN_SYSTEM.md §7.3-D — deuda detectada de paso en la auditoría del admin).
  const reduceMotion = useReducedMotion();
  const fadeUp = reduceMotion
    ? { initial: false as const }
    : {
        initial: { opacity: 0, y: 16 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const },
      };

  return (
    <div className={`${displayFont.variable} ${uiFont.variable} fp-preview`}>
      <Head>
        <title>Propuesta de rediseño 2026 — FitPlan</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      {/* Aviso de contexto: no es UI real, es una muestra para aprobar dirección */}
      <div className="fp-ribbon">
        <span className="block">
          Rediseño aprobado — ya está en los tokens globales (ver DESIGN_SYSTEM.md). Esta pantalla queda como referencia de estilo, no como pantalla real.
        </span>
        <Link href="/dashboard" className="mt-0.5 block underline hover:no-underline">
          Ver el dashboard real
        </Link>
      </div>

      {/* Header, réplica liviana del Navbar real para dar contexto de marca */}
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-xl bg-[var(--surface)] ring-1 ring-[var(--border)]">
            <Image
              src="/brand/icon-social-transparent.svg"
              alt=""
              width={36}
              height={36}
              className="object-contain p-1"
            />
          </span>
          <div className="min-w-0">
            <span className="fp-display block text-base font-bold tracking-tight">FitPlan</span>
            <span className="block truncate text-[10px] text-[var(--text-subtle)]">Logo sin cambios — a decidir con Lucas</span>
          </div>
        </div>
        <span
          className="shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold"
          style={{ background: "color-mix(in oklab, var(--accent) 18%, transparent)", color: "var(--accent)", borderColor: "color-mix(in oklab, var(--accent) 40%, transparent)" }}
        >
          Vista previa
        </span>
      </header>

      <main className="mx-auto w-full max-w-6xl overflow-x-hidden px-4 py-8 sm:px-6 sm:py-10">
        {/* ================= SECCIÓN 1: DASHBOARD ================= */}
        <motion.section {...fadeUp}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">Muestra 1 de 2</p>
          <h1 className="fp-display mt-1 text-3xl font-bold tracking-tight sm:text-4xl">Hola, Sofía</h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--text-muted)] sm:text-base">
            Este es tu resumen de hoy. Llevás 7 días seguidos entrenando con tu plan.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <button type="button" className="btn btn-primary">Generar plan nuevo</button>
            <button type="button" className="btn btn-ghost">Ver progreso</button>
          </div>

          {/* Stats grandes: números en la tipográfica de display, tabulares */}
          <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard label="Racha activa" value="7" unit="días" accent />
            <StatCard label="Calorías hoy" value="1.840" unit="/ 2.200 kcal" />
            <StatCard label="Peso" value="78,4" unit="kg → objetivo 74 kg" />
          </div>

          {/* Tarjetas de plan */}
          <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2">
            <PlanCard
              title="Plan de Sofía — Volumen"
              phase="bulk"
              phaseLabel="🏋️ Mes 2/4"
              progress={62}
              detail="Objetivo: ganar masa muscular · 2.200 kcal/día"
            />
            <PlanCard
              title="Plan de Sofía — Definición"
              phase="cut"
              phaseLabel="✂️ Mes 1/3"
              progress={24}
              detail="Objetivo: bajar grasa · 1.850 kcal/día"
            />
          </div>
        </motion.section>

        <div className="my-12 border-t border-dashed border-[var(--border)]" />

        {/* ================= SECCIÓN 2: PLAN DEL DÍA ================= */}
        <motion.section {...fadeUp}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">Muestra 2 de 2</p>
          <h2 className="fp-display mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Mi plan — Día de hoy</h2>

          {/* Selector de días */}
          <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
            {DAYS.map((day, i) => (
              <button
                key={day}
                type="button"
                onClick={() => setActiveDay(i)}
                className="shrink-0 rounded-xl px-4 py-2 text-sm font-semibold transition-colors"
                style={
                  i === activeDay
                    ? { background: "var(--accent)", color: "#0a0f05" }
                    : { background: "var(--surface-2)", color: "var(--text-muted)", border: "1px solid var(--border)" }
                }
              >
                {day}
              </button>
            ))}
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Entrenamiento */}
            <div className="card-surface p-4 sm:p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                <h3 className="fp-display text-lg font-bold">Entrenamiento — Piernas</h3>
                <span className="badge badge-success">2/4 hechos</span>
              </div>
              <ul className="space-y-2">
                {EXERCISES.map((ex) => (
                  <li
                    key={ex.name}
                    className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{ex.name}</p>
                      <p className="text-xs text-[var(--text-muted)]">{ex.sets} · {ex.weight}</p>
                    </div>
                    <span
                      className="ml-3 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                      style={
                        ex.done
                          ? { background: "var(--accent)", color: "#0a0f05" }
                          : { background: "var(--surface-3)", color: "var(--text-subtle)" }
                      }
                    >
                      {ex.done ? "✓" : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Nutrición */}
            <div className="card-surface p-4 sm:p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                <h3 className="fp-display text-lg font-bold">Nutrición</h3>
                <span className="fp-display text-sm font-bold text-[var(--accent)]">1.840 kcal</span>
              </div>

              <div className="mb-4 space-y-2.5">
                <MacroBar label="Proteína" value={140} max={160} unit="g" />
                <MacroBar label="Carbohidratos" value={180} max={220} unit="g" />
                <MacroBar label="Grasas" value={55} max={70} unit="g" />
              </div>

              <ul className="space-y-2 border-t border-[var(--border)] pt-3">
                {MEALS.map((meal) => (
                  <li key={meal.name} className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium">{meal.name}</p>
                      <p className="truncate text-xs text-[var(--text-muted)]">{meal.detail}</p>
                    </div>
                    <span className="fp-display shrink-0 text-xs font-semibold text-[var(--text-muted)]">{meal.kcal} kcal</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <button type="button" className="btn btn-primary mt-6 w-full sm:w-auto">
            Marcar día como completado
          </button>
        </motion.section>
      </main>
    </div>
  );
}

function StatCard({ label, value, unit, accent }: { label: string; value: string; unit: string; accent?: boolean }) {
  return (
    <div className="card-surface p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">{label}</p>
      <p className={`fp-display mt-1 text-3xl font-bold ${accent ? "text-[var(--accent)]" : ""}`}>{value}</p>
      <p className="mt-0.5 text-xs text-[var(--text-muted)]">{unit}</p>
    </div>
  );
}

function PlanCard({
  title,
  phase,
  phaseLabel,
  progress,
  detail,
}: {
  title: string;
  phase: "bulk" | "cut";
  phaseLabel: string;
  progress: number;
  detail: string;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="card-surface overflow-hidden"
    >
      <div className={`h-1.5 w-full ${phase === "bulk" ? "bg-phase-bulk" : "bg-phase-cut"}`} />
      <div className="p-4 sm:p-5">
        <h3 className="fp-display text-base font-bold leading-snug sm:text-lg">{title}</h3>
        <p className="mt-1 text-xs text-[var(--text-muted)]">{detail}</p>
        <span className={`badge mt-3 ${phase === "bulk" ? "badge-phase-bulk" : "badge-phase-cut"}`}>{phaseLabel}</span>

        <div className="mt-4">
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-xs text-[var(--text-muted)]">
            <span>Progreso</span>
            <span className="fp-display font-semibold text-[var(--foreground)]">{progress}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-3)]">
            <div
              className="h-full rounded-full"
              style={{
                width: `${progress}%`,
                background: "linear-gradient(90deg, var(--brand-start), var(--brand-mid), var(--brand-end))",
              }}
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function MacroBar({ label, value, max, unit }: { label: string; value: number; max: number; unit: string }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-xs">
        <span className="text-[var(--text-muted)]">{label}</span>
        <span className="fp-display font-semibold">{value}{unit} <span className="text-[var(--text-subtle)] font-normal">/ {max}{unit}</span></span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-3)]">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "var(--accent)" }} />
      </div>
    </div>
  );
}
