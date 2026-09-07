import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import { FaSync } from "react-icons/fa";
import { useAuthStore } from "@/store/authStore";
import { getIsAdminClient, adminFetch } from "@/lib/adminAuthClient";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { useAdminFadeUp } from "@/components/admin/adminMotion";
import { STAGE_LABELS, type FunnelReport } from "@/lib/funnel/types";

/**
 * Embudo de conversión.
 *
 * Responde la pregunta que estaba sin responder: si nadie paga, ¿es porque el
 * producto no convence o porque nadie llega al muro? Son problemas opuestos.
 *
 * Colorimetría: neutros + acento, y el rojo SOLO en el escalón donde más gente
 * se cae. Si todo se pinta, nada destaca (regla de 3 colores del DESIGN_SYSTEM).
 */

const WINDOWS: Array<{ label: string; days: number | null }> = [
  { label: "7 días", days: 7 },
  { label: "30 días", days: 30 },
  { label: "90 días", days: 90 },
  { label: "Siempre", days: null },
];

export default function AdminEmbudoPage() {
  const router = useRouter();
  const authUser = useAuthStore((s) => s.user);
  const authLoading = useAuthStore((s) => s.loading);
  const fadeUp = useAdminFadeUp();

  const [data, setData] = useState<FunnelReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [windowDays, setWindowDays] = useState<number | null>(30);

  // Mismo patrón de guardia que el resto de /admin/* (ver metricas-rs.tsx):
  // la comprobación de admin es asíncrona, no se puede evaluar en línea.
  const [allowed, setAllowed] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const run = async () => {
      if (authLoading) return;
      if (!authUser) {
        void router.replace("/");
        return;
      }
      const ok = await getIsAdminClient();
      setAllowed(ok);
      setChecking(false);
      if (!ok) void router.replace("/");
    };
    void run();
  }, [authUser, authLoading, router]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = windowDays === null ? "" : `?windowDays=${windowDays}`;
      const res = await adminFetch(`/api/admin/funnel${qs}`);
      if (!res.ok) throw new Error(`Error ${res.status}`);
      setData((await res.json()) as FunnelReport);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar el embudo");
    } finally {
      setLoading(false);
    }
  }, [windowDays]);

  useEffect(() => {
    if (allowed) void load();
  }, [allowed, load]);

  const top = data?.stages[0]?.users ?? 0;

  // Mientras se comprueba el acceso se muestra un spinner, no `null`.
  // Devolver `null` deja una pantalla COMPLETAMENTE en blanco, sin ninguna
  // señal de que algo esté pasando: es el peor modo de fallo posible, porque
  // no se distingue de la app rota. Se detectó mirando la vista en producción.
  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)]">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-[var(--accent)]" />
      </div>
    );
  }
  if (!allowed) return null;

  return (
    <AdminShell active="embudo">
      <motion.div {...fadeUp}>
        <AdminPageHeader
          kicker="Negocio"
          title="Embudo de conversión"
          subtitle="Dónde se pierde la gente entre registrarse y pagar."
          actions={
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="btn btn-secondary text-sm disabled:opacity-50"
            >
              <FaSync className={loading ? "animate-spin" : ""} />
              Actualizar
            </button>
          }
        />

        <div className="mt-5 flex flex-wrap gap-2">
          {WINDOWS.map((w) => (
            <button
              key={w.label}
              type="button"
              onClick={() => setWindowDays(w.days)}
              className="rounded-xl px-4 py-2 text-sm font-semibold transition-colors"
              style={
                windowDays === w.days
                  ? { background: "var(--accent)", color: "var(--accent-ink)" }
                  : { background: "var(--surface-2)", color: "var(--text-muted)", border: "1px solid var(--border)" }
              }
            >
              {w.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="mt-6 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </div>
        )}

        {loading && !data ? (
          <p className="mt-6 text-sm text-[var(--text-muted)]">Cargando embudo…</p>
        ) : !data ? null : data.signups === 0 ? (
          <EmptyState windowDays={windowDays} />
        ) : (
          <div className="mt-6 space-y-6">
            {data.biggestDrop && (
              <div className="card-surface rounded-2xl p-5">
                <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Dónde se pierde más gente</p>
                <p className="mt-2 text-lg font-bold text-[var(--foreground)]">
                  Entre “{STAGE_LABELS[data.biggestDrop.from]}” y “{STAGE_LABELS[data.biggestDrop.to]}”
                </p>
                <p className="mt-1 text-sm text-[var(--text-muted)]">
                  Se caen <strong className="text-[var(--danger)]">{data.biggestDrop.lostUsers}</strong> personas (
                  {data.biggestDrop.lostPct}%). Es el escalón con más margen de mejora.
                </p>
              </div>
            )}

            <div className="card-surface rounded-2xl p-5">
              <p className="text-xs uppercase tracking-wide text-[var(--text-muted)] mb-4">Etapas</p>
              <div className="space-y-3">
                {data.stages.map((s) => {
                  const isWorstTarget = data.biggestDrop?.to === s.key;
                  const width = top === 0 ? 0 : Math.max(2, (s.users / top) * 100);
                  return (
                    <div key={s.key}>
                      <div className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="text-[var(--foreground)]">{s.label}</span>
                        <span className="tabular-nums text-[var(--text-muted)]">
                          <strong className="text-[var(--foreground)]">{s.users}</strong>
                          {s.pctOfPrevious !== null && <> · {s.pctOfPrevious}% del paso anterior</>}
                        </span>
                      </div>
                      <div className="mt-1.5 h-2.5 rounded-full" style={{ background: "var(--surface-2)" }}>
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${width}%`,
                            background: isWorstTarget ? "var(--danger)" : "var(--accent)",
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="card-surface rounded-2xl p-5">
              <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Retención</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                De quienes ya llevan suficiente tiempo registrados, cuántos volvieron a abrir la app.
              </p>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                {([["Día 1", data.retention.d1], ["Día 7", data.retention.d7], ["Día 30", data.retention.d30]] as const).map(
                  ([label, r]) => (
                    <div key={label} className="card-surface-2 rounded-xl p-4">
                      <p className="text-sm text-[var(--text-muted)]">{label}</p>
                      <p className="mt-1 text-2xl font-extrabold text-[var(--foreground)]">{r.pct}%</p>
                      <p className="text-xs text-[var(--text-muted)]">
                        {r.eligible === 0 ? "Nadie lleva tanto tiempo aún" : `${r.returned} de ${r.eligible}`}
                      </p>
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </AdminShell>
  );
}

function EmptyState({ windowDays }: { windowDays: number | null }) {
  return (
    <div className="card-surface mt-6 rounded-2xl p-6">
      <p className="text-lg font-bold text-[var(--foreground)]">Todavía no hay altas en este periodo</p>
      <p className="mt-2 text-sm text-[var(--text-muted)]">
        {windowDays === null
          ? "No hay ningún usuario registrado, o ninguno tiene fecha de alta guardada."
          : "Prueba con una ventana más amplia."}{" "}
        Los hitos del embudo empiezan a registrarse desde que se desplegó esta medición, así que los usuarios
        anteriores solo aparecerán en las etapas que se pueden deducir de sus datos (alta y pago), no en las que
        necesitan haberse registrado en su momento.
      </p>
    </div>
  );
}
