import Head from "next/head";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  FaChartLine,
  FaUserFriends,
  FaVideo,
  FaDumbbell,
  FaColumns,
  FaServer,
  FaBolt,
  FaSearch,
  FaEye,
  FaEnvelope,
  FaLink,
  FaTrashAlt,
  FaSyncAlt,
} from "react-icons/fa";

/**
 * PROPUESTA DE REESTRUCTURACIÓN DEL ADMIN — fase de definición de `diseño`
 * -----------------------------------------------------------------------
 * NO es una pantalla real: es la demo visual que acompaña la spec de
 * DESIGN_SYSTEM.md §8. Datos hardcodeados, navegación inerte salvo el
 * toggle Resumen/Clientes (para mostrar 2 vistas sin duplicar rutas).
 * Usa los tokens/clases YA existentes en globals.css — nada nuevo que
 * aprobar a nivel de sistema de diseño, es reorganización de IA.
 *
 * Pendiente (para `frontend`, no implementado acá):
 *  - Construir <AdminShell> real con este sidebar, envolviendo las 12
 *    vistas reales de /admin/*.
 *  - Reemplazar los headers ad hoc por color (gradientes hex crudos) de
 *    cada vista por el patrón de header descrito en la spec.
 *  - Migrar clientes-fitplan.tsx/clientes-1-1.tsx de lista de tarjetas
 *    con botones de color inconsistente a la tabla/tarjeta de esta demo.
 */

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const },
};

type SectionId = "resumen" | "clientes" | "contenido" | "ejercicios" | "backlog" | "servicios" | "hyrox";

const NAV_ITEMS: Array<{
  id: SectionId;
  label: string;
  icon: typeof FaChartLine;
  badge?: string;
  demo?: boolean;
  muted?: boolean;
  statusDot?: "success" | "warning";
}> = [
  { id: "resumen", label: "Resumen", icon: FaChartLine, demo: true },
  { id: "clientes", label: "Clientes", icon: FaUserFriends, badge: "3", demo: true },
  { id: "contenido", label: "Contenido", icon: FaVideo, badge: "3" },
  { id: "ejercicios", label: "Ejercicios", icon: FaDumbbell },
  { id: "backlog", label: "Backlog del equipo", icon: FaColumns },
  { id: "servicios", label: "Servicios", icon: FaServer, statusDot: "success" },
  { id: "hyrox", label: "HYROX", icon: FaBolt, muted: true },
];

const CLIENTS = [
  { name: "Sofía Martínez", email: "sofia.martinez@mail.com", status: "success" as const, statusLabel: "Premium activo", phase: "bulk" as const, phaseLabel: "Volumen · Mes 2/4", lastActivity: "Hoy, 09:14" },
  { name: "Bruno Acosta", email: "bruno.acosta@mail.com", status: "warning" as const, statusLabel: "Vence en 3 días", phase: "cut" as const, phaseLabel: "Definición · Mes 1/3", lastActivity: "Ayer, 21:02" },
  { name: "Micaela Funes", email: "mica.funes@mail.com", status: "success" as const, statusLabel: "Premium activo", phase: "lean-bulk" as const, phaseLabel: "Recomposición · Mes 3/3", lastActivity: "Hoy, 07:40" },
  { name: "Diego Herrera", email: "diego.herrera@mail.com", status: "neutral" as const, statusLabel: "Free", phase: "maintenance" as const, phaseLabel: "Mantenimiento", lastActivity: "Hace 4 días" },
  { name: "Lucía Fernández", email: "lucia.fernandez@mail.com", status: "danger" as const, statusLabel: "Pago fallido", phase: "bulk" as const, phaseLabel: "Volumen · Mes 1/5", lastActivity: "Hace 2 horas" },
];

export default function AdminDesignPreview() {
  const router = useRouter();
  // Permite linkear/capturar cada vista de la demo directamente (?view=clientes) sin
  // pisar la selección manual del usuario una vez que hizo click en el sidebar.
  const [manualActive, setManualActive] = useState<SectionId | null>(null);
  const active = manualActive ?? (router.query.view === "clientes" ? "clientes" : "resumen");
  const setActive = (id: SectionId) => setManualActive(id);
  const [filter, setFilter] = useState<"all" | "premium" | "free">("all");
  const reduceMotion = useReducedMotion();

  const motionProps = (delay = 0) =>
    reduceMotion
      ? {}
      : { initial: { opacity: 0, y: 12 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: "-40px" }, transition: { duration: 0.3, delay } };

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <Head>
        <title>Propuesta de reestructuración — Panel admin — FitPlan</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <div className="border-b border-border bg-[color-mix(in_oklab,var(--warning)_10%,var(--surface))] px-4 py-2.5 text-center text-xs text-[var(--warning)] sm:text-sm">
        Propuesta de reestructuración del admin — no es una pantalla real, datos de muestra.{" "}
        <Link href="/admin" className="underline underline-offset-2 hover:no-underline">
          Ver el admin real
        </Link>
      </div>

      <div className="flex w-full">
        {/* ============= SIDEBAR (desktop) ============= */}
        <aside className="sticky top-0 hidden h-[100dvh] w-[248px] shrink-0 flex-col border-r border-border bg-surface px-3 py-5 lg:flex">
          <Link href="/admin" className="mb-6 flex items-center gap-2.5 px-2">
            <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-lg bg-surface-2 ring-1 ring-border">
              <Image src="/brand/icon-social-transparent.svg" alt="" width={32} height={32} className="object-contain p-1" />
            </span>
            <span className="font-display text-sm font-bold tracking-tight">FitPlan · Admin</span>
          </Link>

          <nav className="flex flex-1 flex-col gap-1">
            {NAV_ITEMS.map((item) => {
              const isActive = item.id === active;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={!item.demo}
                  onClick={() => item.demo && setActive(item.id)}
                  title={item.demo ? undefined : "No implementado en esta demo — ver spec"}
                  className={`group flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-accent/12 text-accent"
                      : item.muted
                        ? "text-text-subtle hover:bg-surface-2 hover:text-text-muted"
                        : "text-text-muted hover:bg-surface-2 hover:text-foreground"
                  } ${!item.demo ? "cursor-default opacity-70" : ""}`}
                >
                  <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-accent" : ""}`} aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
                  {item.badge && (
                    <span className="shrink-0 rounded-full bg-surface-3 px-1.5 py-0.5 text-[10px] font-semibold text-text-muted">
                      {item.badge}
                    </span>
                  )}
                  {item.statusDot && (
                    <span
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${item.statusDot === "success" ? "bg-success" : "bg-warning"}`}
                      aria-hidden
                    />
                  )}
                </button>
              );
            })}
          </nav>

          <p className="px-2 text-[10px] leading-relaxed text-text-subtle">
            Notificaciones, Chat admin y Cerrar sesión viven en el sidebar (debajo de HYROX) y &ldquo;Ver sitio&rdquo; al
            pie, separado del resto (ver DESIGN_SYSTEM.md §9) — la barra horizontal (Navbar) ya no se monta en el admin.
            No implementado en esta demo estática.
          </p>
        </aside>

        {/* ============= MOBILE NAV: tira horizontal ============= */}
        <div className="fixed inset-x-0 bottom-0 z-40 flex gap-1.5 overflow-x-auto border-t border-border bg-[color-mix(in_oklab,var(--background)_92%,transparent)] px-3 py-2 backdrop-blur-md lg:hidden">
          {NAV_ITEMS.map((item) => {
            const isActive = item.id === active;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                disabled={!item.demo}
                onClick={() => item.demo && setActive(item.id)}
                className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  isActive ? "bg-accent/15 text-accent" : "text-text-muted"
                }`}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden />
                {item.label}
              </button>
            );
          })}
        </div>

        {/* ============= CONTENIDO ============= */}
        <main className="min-w-0 flex-1 px-4 pb-24 pt-6 sm:px-6 lg:px-8 lg:pb-8 lg:pt-8">
          {active === "resumen" && (
            <motion.section {...fadeUp} className="w-full">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">FitPlan · Admin</p>
              <h1 className="font-display mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Resumen</h1>
              <p className="mt-2 max-w-xl text-sm text-text-muted">
                Vista general de ingresos y actividad. El detalle de cada dominio vive en su propia sección del menú.
              </p>

              {/* Hero de marca: reservado SOLO para esta vista, no se repite en subpáginas */}
              <div
                className="mt-6 overflow-hidden rounded-2xl border border-border p-5 sm:p-6"
                style={{
                  background:
                    "linear-gradient(135deg, color-mix(in oklab, var(--brand-start) 14%, var(--surface)), color-mix(in oklab, var(--brand-mid) 10%, var(--surface)) 55%, color-mix(in oklab, var(--brand-end) 12%, var(--surface)))",
                }}
              >
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <StatCard label="Ingresos del mes" value="$482.300" unit="ARS · +12% vs. mes anterior" accent />
                  <StatCard label="Clientes activos" value="134" unit="FitPlan + 1:1" />
                  <StatCard label="Altas este mes" value="18" unit="9 premium" />
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-2.5">
                <button type="button" className="btn btn-secondary text-sm">Copiar enlace del formulario</button>
                <button type="button" className="btn btn-secondary text-sm">Descargar reporte</button>
              </div>

              <p className="mt-8 text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">Accesos directos</p>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {NAV_ITEMS.filter((i) => i.id !== "resumen").map((item, i) => {
                  const Icon = item.icon;
                  return (
                    <motion.button
                      key={item.id}
                      type="button"
                      onClick={() => item.demo && setActive(item.id)}
                      {...motionProps(i * 0.04)}
                      className="card-surface flex items-center gap-3 p-4 text-left transition-colors hover:bg-surface-2"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-accent">
                        <Icon />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{item.label}</p>
                        <p className="truncate text-xs text-text-muted">{item.demo ? "Ver demo" : "Ver spec"}</p>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </motion.section>
          )}

          {active === "clientes" && (
            <motion.section {...fadeUp} className="w-full">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">Clientes</p>
              <h1 className="font-display mt-1 text-2xl font-bold tracking-tight sm:text-3xl">FitPlan · 1:1 · Actividad</h1>
              <p className="mt-2 max-w-xl text-sm text-text-muted">
                Los 3 destinos actuales (clientes-fitplan, clientes-1:1, actividad) conviven acá como sub-pestañas de un mismo dominio.
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                {["FitPlan (134)", "1:1 (22)", "Actividad"].map((label, i) => (
                  <button
                    key={label}
                    type="button"
                    className="rounded-xl px-4 py-2 text-sm font-semibold transition-colors"
                    style={
                      i === 0
                        ? { background: "var(--accent)", color: "var(--accent-ink)" }
                        : { background: "var(--surface-2)", color: "var(--text-muted)", border: "1px solid var(--border)" }
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative w-full sm:max-w-xs">
                  <FaSearch className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-subtle" aria-hidden />
                  <input
                    type="text"
                    placeholder="Buscar por nombre o email..."
                    className="w-full rounded-lg border border-border bg-surface-2 py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-accent/50"
                  />
                </div>
                <div className="flex gap-1.5">
                  {(["all", "premium", "free"] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFilter(f)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                        filter === f ? "border-accent/40 bg-accent/12 text-accent" : "border-border bg-surface-2 text-text-muted hover:text-foreground"
                      }`}
                    >
                      {f === "all" ? "Todos" : f === "premium" ? "Premium" : "Free"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tabla — desktop */}
              <div className="mt-5 hidden overflow-hidden rounded-2xl border border-border lg:block">
                <table className="w-full text-left text-sm">
                  <thead className="bg-surface-2 text-xs uppercase tracking-wide text-text-muted">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Cliente</th>
                      <th className="px-4 py-3 font-semibold">Estado</th>
                      <th className="px-4 py-3 font-semibold">Plan</th>
                      <th className="px-4 py-3 font-semibold">Última actividad</th>
                      <th className="px-4 py-3 font-semibold text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {CLIENTS.map((c, i) => (
                      <tr key={c.email} className={i % 2 === 0 ? "bg-surface" : "bg-[color-mix(in_oklab,var(--surface)_60%,var(--surface-2))]"}>
                        <td className="px-4 py-3">
                          <p className="font-medium">{c.name}</p>
                          <p className="text-xs text-text-muted">{c.email}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`badge ${c.status === "neutral" ? "badge-neutral" : `badge-${c.status}`}`}>{c.statusLabel}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`badge badge-phase-${c.phase}`}>{c.phaseLabel}</span>
                        </td>
                        <td className="px-4 py-3 text-text-muted">{c.lastActivity}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <ActionIcon icon={FaEye} label="Ver datos" />
                            <ActionIcon icon={FaEnvelope} label="Enviar email" />
                            <ActionIcon icon={FaLink} label="Enlace de pago" />
                            <ActionIcon icon={FaSyncAlt} label="Pedir peso" />
                            <ActionIcon icon={FaTrashAlt} label="Eliminar" danger />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Tarjetas — mobile */}
              <div className="mt-5 flex flex-col gap-3 lg:hidden">
                {CLIENTS.map((c, i) => (
                  <motion.div key={c.email} {...motionProps(i * 0.04)} className="card-surface-2 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{c.name}</p>
                        <p className="truncate text-xs text-text-muted">{c.email}</p>
                      </div>
                      <span className={`badge max-w-[45%] shrink-0 truncate ${c.status === "neutral" ? "badge-neutral" : `badge-${c.status}`}`}>{c.statusLabel}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                      <span className={`badge badge-phase-${c.phase}`}>{c.phaseLabel}</span>
                      <span className="text-xs text-text-muted">{c.lastActivity}</span>
                    </div>
                    <div className="mt-3 flex items-center gap-1 border-t border-border pt-3">
                      <ActionIcon icon={FaEye} label="Ver datos" />
                      <ActionIcon icon={FaEnvelope} label="Enviar email" />
                      <ActionIcon icon={FaLink} label="Enlace de pago" />
                      <ActionIcon icon={FaSyncAlt} label="Pedir peso" />
                      <ActionIcon icon={FaTrashAlt} label="Eliminar" danger />
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.section>
          )}
        </main>
      </div>
    </div>
  );
}

function StatCard({ label, value, unit, accent }: { label: string; value: string; unit: string; accent?: boolean }) {
  return (
    <div className="rounded-xl bg-[color-mix(in_oklab,var(--surface)_70%,transparent)] p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-text-muted">{label}</p>
      <p className={`font-display mt-1 text-2xl font-bold sm:text-3xl ${accent ? "text-accent" : ""}`}>{value}</p>
      <p className="mt-0.5 text-xs text-text-muted">{unit}</p>
    </div>
  );
}

function ActionIcon({ icon: Icon, label, danger }: { icon: typeof FaEye; label: string; danger?: boolean }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={`btn-ghost flex h-8 w-8 items-center justify-center rounded-lg border text-xs transition-colors ${
        danger ? "hover:border-danger/40 hover:bg-danger/10 hover:text-danger" : "hover:border-border-strong"
      }`}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
    </button>
  );
}
