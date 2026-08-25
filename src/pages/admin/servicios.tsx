import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import { useAuthStore } from "@/store/authStore";
import { getIsAdminClient, adminFetch } from "@/lib/adminAuthClient";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { useAdminFadeUp } from "@/components/admin/adminMotion";
import { FaSync, FaCheckCircle, FaTimesCircle, FaMinusCircle, FaHistory } from "react-icons/fa";

type ServiceStatus = {
  key: string;
  name: string;
  category: "ia" | "publicacion" | "pagos" | "infraestructura";
  configured: boolean;
  ok: boolean | null;
  detail: string;
  credit?: { label: string; value: string };
};

type PlatformResult = { ok: boolean; platformPostId?: string; message?: string; status?: string } | undefined;

type HistoryItem = {
  id: string;
  source: "automatico" | "manual";
  category: string;
  headline: string;
  videoUrl: string | null;
  instagram: PlatformResult;
  tiktok: PlatformResult;
  status: string;
  createdAt: string | null;
};

const CONTENT_STATUS_LABELS: Record<string, { label: string; className: string }> = {
  generating: { label: "generando...", className: "badge-warning" },
  published: { label: "publicado", className: "badge-success" },
  publish_failed: { label: "no se pudo publicar", className: "badge-danger" },
  failed: { label: "falló", className: "badge-danger" },
  draft: { label: "borrador", className: "badge-warning" },
  scheduled: { label: "programado", className: "badge-info" },
};

function contentStatusBadge(status: string) {
  const info = CONTENT_STATUS_LABELS[status] || { label: status, className: "badge-warning" };
  return <span className={`badge ${info.className} text-xs`}>{info.label}</span>;
}

const CATEGORY_LABELS: Record<ServiceStatus["category"], string> = {
  ia: "IA / Generación de contenido",
  publicacion: "Publicación",
  pagos: "Pagos",
  infraestructura: "Infraestructura",
};

function StatusIcon({ configured, ok }: { configured: boolean; ok: boolean | null }) {
  if (!configured) return <FaMinusCircle className="text-white/30" title="No configurado" />;
  if (ok === true) return <FaCheckCircle className="text-success" title="OK" />;
  if (ok === false) return <FaTimesCircle className="text-danger" title="Con problemas" />;
  return <FaMinusCircle className="text-white/30" title="Sin chequeo en vivo" />;
}

function platformBadge(result: PlatformResult) {
  if (!result) return <span className="text-white/30">—</span>;
  if (result.ok) return <span className="badge badge-success text-xs">OK</span>;
  if (result.status === "not_configured") return <span className="badge badge-warning text-xs">no configurado</span>;
  return <span className="badge badge-danger text-xs" title={result.message}>error</span>;
}

export default function AdminServiciosPage() {
  const router = useRouter();
  const fadeUp = useAdminFadeUp();
  const { user: authUser, loading: authLoading } = useAuthStore();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);

  const [services, setServices] = useState<ServiceStatus[] | null>(null);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);

  const [history, setHistory] = useState<HistoryItem[] | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const loadServices = async () => {
    setServicesLoading(true);
    setError(null);
    try {
      const resp = await adminFetch("/api/admin/servicesStatus");
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "No se pudo obtener el estado de los servicios");
      setServices(data.services);
      setCheckedAt(data.checkedAt);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al chequear servicios");
    } finally {
      setServicesLoading(false);
    }
  };

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const resp = await adminFetch("/api/admin/socialContentHistory");
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "No se pudo obtener el historial");
      setHistory(data.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al obtener el historial");
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (!allowed) return;
    void loadServices();
    void loadHistory();
  }, [allowed]);

  if (authLoading || checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-accent" />
      </div>
    );
  }

  if (!allowed) return null;

  const categories = (["ia", "publicacion", "pagos", "infraestructura"] as const).filter((cat) =>
    services?.some((s) => s.category === cat)
  );

  return (
    <AdminShell active="servicios">
      <motion.div {...fadeUp}>
        <AdminPageHeader
          kicker="Servicios"
          title="Servicios"
          subtitle="Estado y crédito de cada servicio externo, e historial de contenido publicado."
          actions={
            <button
              type="button"
              onClick={() => {
                void loadServices();
                void loadHistory();
              }}
              disabled={servicesLoading || historyLoading}
              className="btn btn-secondary text-sm disabled:opacity-50"
            >
              <FaSync className={servicesLoading || historyLoading ? "animate-spin" : ""} />
              Actualizar
            </button>
          }
        />

        {error && <div className="mt-6 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</div>}

        <div className="mt-6 space-y-6">
          {servicesLoading && !services ? (
            <p className="text-sm text-white/50">Chequeando servicios...</p>
          ) : (
            categories.map((cat) => (
              <motion.div key={cat} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="card-surface p-5">
                <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wide mb-3">{CATEGORY_LABELS[cat]}</h2>
                <div className="space-y-2">
                  {services!
                    .filter((s) => s.category === cat)
                    .map((s) => (
                      <div key={s.key} className="flex items-start gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5">
                        <span className="mt-0.5 shrink-0">
                          <StatusIcon configured={s.configured} ok={s.ok} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-white">{s.name}</p>
                          <p className="text-xs text-white/50 mt-0.5">{s.detail}</p>
                        </div>
                        {s.credit && (
                          <div className="shrink-0 text-right">
                            <p className="text-xs text-white/40">{s.credit.label}</p>
                            <p className="text-sm font-semibold text-white">{s.credit.value}</p>
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              </motion.div>
            ))
          )}
          {checkedAt && <p className="text-xs text-white/35 text-right">Último chequeo: {new Date(checkedAt).toLocaleString("es-AR")}</p>}
        </div>

        <div className="mt-10">
          <div className="flex items-center gap-3 mb-4">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-info/15 border border-info/25 text-info">
              <FaHistory />
            </span>
            <h2 className="text-lg font-semibold text-white">Historial de contenido</h2>
          </div>

          {historyLoading && !history ? (
            <p className="text-sm text-white/50">Cargando historial...</p>
          ) : !history || history.length === 0 ? (
            <p className="text-sm text-white/40">Todavía no hay contenido generado.</p>
          ) : (
            <div className="card-surface overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-white/45 text-xs uppercase tracking-wide border-b border-white/10">
                    <th className="px-4 py-3 font-medium">Fecha</th>
                    <th className="px-4 py-3 font-medium">Origen</th>
                    <th className="px-4 py-3 font-medium">Categoría</th>
                    <th className="px-4 py-3 font-medium">De qué trató</th>
                    <th className="px-4 py-3 font-medium">Estado</th>
                    <th className="px-4 py-3 font-medium">IG</th>
                    <th className="px-4 py-3 font-medium">TikTok</th>
                    <th className="px-4 py-3 font-medium">Video</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((item) => (
                    <tr key={`${item.source}-${item.id}`} className="border-b border-white/5 last:border-0">
                      <td className="px-4 py-3 text-white/70 whitespace-nowrap">
                        {item.createdAt ? new Date(item.createdAt).toLocaleString("es-ES", { timeZone: "Europe/Madrid" }) : "—"}
                      </td>
                      <td className="px-4 py-3 text-white/60 capitalize">{item.source}</td>
                      <td className="px-4 py-3 text-white/60 whitespace-nowrap">{item.category}</td>
                      <td className="px-4 py-3 text-white/85 max-w-[280px] truncate" title={item.headline}>
                        {item.headline}
                      </td>
                      <td className="px-4 py-3">{contentStatusBadge(item.status)}</td>
                      <td className="px-4 py-3">{platformBadge(item.instagram)}</td>
                      <td className="px-4 py-3">{platformBadge(item.tiktok)}</td>
                      <td className="px-4 py-3">
                        {item.videoUrl ? (
                          <a href={item.videoUrl} target="_blank" rel="noopener noreferrer" className="text-info hover:underline">
                            ver
                          </a>
                        ) : (
                          <span className="text-white/30">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </motion.div>
    </AdminShell>
  );
}
