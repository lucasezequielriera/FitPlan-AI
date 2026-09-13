import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import { useAuthStore } from "@/store/authStore";
import { getIsAdminClient, adminFetch } from "@/lib/adminAuthClient";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { useAdminFadeUp } from "@/components/admin/adminMotion";
import { FaExclamationTriangle, FaTrash, FaSync } from "react-icons/fa";

/**
 * Mantenimiento de datos — hoy, los planes huérfanos del issue #5.
 *
 * La causa que los generaba está cerrada (#12), pero los que ya existen siguen
 * ahí. Esta vista existe porque el borrado lo tiene que disparar una persona
 * sobre una lista que ha visto: es irreversible en la práctica y un fallo en la
 * detección se llevaría por delante planes de usuarios vivos.
 */

type PlanHuerfano = {
  id: string;
  userId: string | null;
  createdAt: string | null;
  resumen: string;
};

type Informe = {
  totalPlanes: number;
  conDuenyo: number;
  huerfanos: PlanHuerfano[];
  sinDuenyo: PlanHuerfano[];
  comprobacionIncompleta: boolean;
  uidsSinComprobar: number;
};

function fecha(iso: string | null): string {
  if (!iso) return "sin fecha";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "sin fecha";
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
}

export default function MantenimientoPage() {
  const router = useRouter();
  const { user: authUser, loading: authLoading } = useAuthStore();
  const [allowed, setAllowed] = useState(false);
  const [checking, setChecking] = useState(true);
  const fadeUp = useAdminFadeUp();

  const [informe, setInforme] = useState<Informe | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [confirmando, setConfirmando] = useState(false);
  const [borrando, setBorrando] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      if (authLoading) return;
      if (!authUser) {
        router.replace("/");
        return;
      }
      const ok = await getIsAdminClient();
      setAllowed(ok);
      setChecking(false);
      if (!ok) router.replace("/");
    };
    void run();
  }, [authUser, authLoading, router]);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    setSeleccion(new Set());
    setConfirmando(false);
    try {
      const resp = await adminFetch("/api/admin/orphanPlans");
      if (!resp.ok) throw new Error(`Respuesta ${resp.status}`);
      setInforme((await resp.json()) as Informe);
    } catch {
      setError("No se pudo cargar el informe. Inténtalo de nuevo en un momento.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (allowed) void cargar();
  }, [allowed, cargar]);

  const alternar = (id: string) => {
    setConfirmando(false);
    setSeleccion((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const borrar = async () => {
    setBorrando(true);
    setError(null);
    try {
      const resp = await adminFetch("/api/admin/orphanPlans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planIds: [...seleccion] }),
      });
      const data = await resp.json();
      if (!resp.ok && resp.status !== 207) throw new Error(data?.error || `Respuesta ${resp.status}`);

      const partes = [`${data.borrados} plan(es) archivado(s) y borrado(s)`];
      if (data.rechazados?.length) partes.push(`${data.rechazados.length} rechazado(s) por no constar como huérfanos`);
      if (data.fallidos?.length) partes.push(`${data.fallidos.length} con error, siguen ahí`);
      setResultado(partes.join(" · "));
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo completar el borrado.");
    } finally {
      setBorrando(false);
      setConfirmando(false);
    }
  };

  if (authLoading || checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-accent" />
      </div>
    );
  }
  if (!allowed) return null;

  const borrables = informe ? [...informe.huerfanos, ...informe.sinDuenyo] : [];

  const Fila = ({ plan }: { plan: PlanHuerfano }) => (
    <li className="flex items-start gap-3 rounded-lg border border-border bg-surface-2 px-3 py-3">
      <input
        type="checkbox"
        id={`plan-${plan.id}`}
        checked={seleccion.has(plan.id)}
        onChange={() => alternar(plan.id)}
        className="mt-1 h-4 w-4 shrink-0 accent-[var(--accent)]"
      />
      <label htmlFor={`plan-${plan.id}`} className="min-w-0 flex-1 cursor-pointer">
        <p className="truncate text-sm font-medium">{plan.resumen}</p>
        <p className="mt-0.5 truncate font-mono text-xs text-text-muted">
          {plan.id} · {plan.userId ? `userId ${plan.userId}` : "sin userId"} · {fecha(plan.createdAt)}
        </p>
      </label>
    </li>
  );

  return (
    <AdminShell active="mantenimiento">
      <motion.div {...fadeUp}>
        <AdminPageHeader
          kicker="Mantenimiento"
          title="Planes huérfanos"
          subtitle="Planes cuyo usuario ya no existe ni en la base de datos ni en las cuentas. Se archivan antes de borrarse, así que la operación se puede deshacer desde Firestore."
          actions={
            <button type="button" onClick={() => void cargar()} disabled={cargando} className="btn btn-secondary">
              <FaSync className={cargando ? "animate-spin" : ""} aria-hidden /> Recalcular
            </button>
          }
        />

        <div className="mt-8 space-y-6">
          {error && (
            <p role="alert" className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
              {error}
            </p>
          )}

          {resultado && (
            <p role="status" className="rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
              {resultado}
            </p>
          )}

          {cargando && !informe && <p className="text-sm text-text-muted">Comprobando cada plan contra usuarios y cuentas…</p>}

          {informe && (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { etiqueta: "Planes en total", valor: informe.totalPlanes },
                  { etiqueta: "Con dueño", valor: informe.conDuenyo },
                  { etiqueta: "Huérfanos", valor: informe.huerfanos.length },
                  { etiqueta: "Sin userId", valor: informe.sinDuenyo.length },
                ].map((s) => (
                  <div key={s.etiqueta} className="card-surface p-4">
                    <p className="text-xs text-text-muted">{s.etiqueta}</p>
                    <p className="font-display mt-1 text-2xl font-bold">{s.valor}</p>
                  </div>
                ))}
              </div>

              {informe.comprobacionIncompleta && (
                // Si Auth no respondió por algunos UIDs, esos planes se cuentan
                // como "con dueño" por precaución. Hay que decirlo: si no, la
                // lista parece completa cuando no lo es.
                <p role="alert" className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
                  <FaExclamationTriangle className="mt-0.5 shrink-0" aria-hidden />
                  <span>
                    La lista está incompleta: no se pudo comprobar {informe.uidsSinComprobar} usuario(s) contra las
                    cuentas, y ante la duda se han dejado fuera. Vuelve a recalcular más tarde.
                  </span>
                </p>
              )}

              {borrables.length === 0 ? (
                <p className="rounded-lg border border-border bg-surface-2 px-4 py-6 text-center text-sm text-text-muted">
                  No hay planes huérfanos. Nada que limpiar.
                </p>
              ) : (
                <>
                  {informe.huerfanos.length > 0 && (
                    <section>
                      <h2 className="text-sm font-semibold">Su usuario ya no existe ({informe.huerfanos.length})</h2>
                      <p className="mt-1 text-xs text-text-muted">
                        El <code>userId</code> no aparece ni en la colección de usuarios ni en las cuentas.
                      </p>
                      <ul className="mt-3 space-y-2">
                        {informe.huerfanos.map((p) => <Fila key={p.id} plan={p} />)}
                      </ul>
                    </section>
                  )}

                  {informe.sinDuenyo.length > 0 && (
                    <section>
                      <h2 className="text-sm font-semibold">Nunca tuvieron userId ({informe.sinDuenyo.length})</h2>
                      <p className="mt-1 text-xs text-text-muted">
                        Se cuentan aparte porque su causa es otra: no es una cuenta borrada, es un plan que se guardó sin dueño.
                      </p>
                      <ul className="mt-3 space-y-2">
                        {informe.sinDuenyo.map((p) => <Fila key={p.id} plan={p} />)}
                      </ul>
                    </section>
                  )}

                  <div className="flex flex-wrap items-center gap-3 border-t border-border pt-5">
                    <button
                      type="button"
                      onClick={() => setSeleccion(new Set(borrables.map((p) => p.id)))}
                      className="btn btn-secondary"
                    >
                      Seleccionar los {borrables.length}
                    </button>

                    {confirmando ? (
                      <>
                        <span className="text-sm text-text-muted">
                          Se archivarán y borrarán {seleccion.size}. ¿Seguro?
                        </span>
                        <button type="button" onClick={() => void borrar()} disabled={borrando} className="btn btn-danger">
                          {borrando ? "Borrando…" : "Sí, borrar"}
                        </button>
                        <button type="button" onClick={() => setConfirmando(false)} className="btn btn-secondary">
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmando(true)}
                        disabled={seleccion.size === 0}
                        className="btn btn-danger"
                      >
                        <FaTrash aria-hidden /> Borrar {seleccion.size > 0 ? `los ${seleccion.size} marcados` : "marcados"}
                      </button>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </motion.div>
    </AdminShell>
  );
}
