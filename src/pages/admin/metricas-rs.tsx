import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import { useAuthStore } from "@/store/authStore";
import { getIsAdminClient, adminFetch } from "@/lib/adminAuthClient";
import Navbar from "@/components/Navbar";
import { FaArrowLeft, FaChartLine, FaSync, FaExclamationTriangle, FaExternalLinkAlt } from "react-icons/fa";

type GroupStat = {
  key: string;
  label: string;
  pieces: number;
  avgRetention: number | null;
  avgReach: number | null;
  avgAmplification: number | null;
  avgInteractions: number | null;
};

type Piece = {
  id: string;
  topicName: string;
  contentFunction: string | null;
  hookFamily: string | null;
  slotLocal: string | null;
  headline: string;
  permalink: string | null;
  publishedAt: string | null;
  reach: number | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saved: number | null;
  retention: number | null;
  amplification: number | null;
};

type Performance = {
  insightsAvailable: boolean;
  insightsError: string | null;
  totals: { published: number; withMetrics: number };
  byHookFamily: GroupStat[];
  byFunction: GroupStat[];
  bySlot: GroupStat[];
  byTopic: GroupStat[];
  best: Piece[];
  worst: Piece[];
};

/** Métrica sobre la que se comparan los grupos. */
type MetricKey = "avgRetention" | "avgReach" | "avgAmplification" | "avgInteractions";

const METRICS: { key: MetricKey; label: string; help: string; format: (v: number) => string }[] = [
  {
    key: "avgRetention",
    label: "Retención",
    help: "Fracción del video que se ve de media. Es la señal que más pesa en la distribución: por encima de 1 significa que hubo replays.",
    format: (v) => `${Math.round(v * 100)}%`,
  },
  {
    key: "avgReach",
    label: "Alcance",
    help: "Cuentas únicas alcanzadas de media. Es el resultado de haber retenido, no la causa.",
    format: (v) => Math.round(v).toLocaleString("es-ES"),
  },
  {
    key: "avgAmplification",
    label: "Amplificación",
    help: "(compartidos + guardados) / alcance. Son las señales más caras de conseguir y las que más empujan a lotes de distribución mayores.",
    format: (v) => `${(v * 100).toFixed(1)}%`,
  },
  {
    key: "avgInteractions",
    label: "Interacciones",
    help: "Likes + comentarios + compartidos + guardados de media.",
    format: (v) => Math.round(v).toLocaleString("es-ES"),
  },
];

function BarChart({ title, subtitle, rows, metric }: { title: string; subtitle: string; rows: GroupStat[]; metric: MetricKey }) {
  const meta = METRICS.find((m) => m.key === metric)!;
  const withValue = rows.filter((r) => r[metric] !== null);
  const max = Math.max(...withValue.map((r) => r[metric] as number), 0);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="card-surface p-5">
      <h2 className="text-sm font-semibold text-white/80 uppercase tracking-wide">{title}</h2>
      <p className="text-xs text-white/45 mt-1 mb-4">{subtitle}</p>

      {withValue.length === 0 ? (
        <p className="text-sm text-white/40">Todavía no hay datos de esta métrica.</p>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => {
            const value = row[metric];
            const pct = value !== null && max > 0 ? (value / max) * 100 : 0;
            return (
              <div key={row.key}>
                <div className="flex items-baseline justify-between gap-3 mb-1">
                  <span className="text-sm text-white/85 truncate">{row.label}</span>
                  <span className="text-sm font-medium text-white shrink-0 tabular-nums">
                    {value === null ? "—" : meta.format(value)}
                    <span className="text-white/35 text-xs ml-2">
                      {row.pieces} {row.pieces === 1 ? "pieza" : "piezas"}
                    </span>
                  </span>
                </div>
                <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-blue-500 via-emerald-400 to-cyan-400 transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

function PieceRow({ piece }: { piece: Piece }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-white/90 truncate">{piece.headline}</p>
          <p className="text-xs text-white/40 mt-0.5">
            {piece.topicName}
            {piece.slotLocal ? ` · ${piece.slotLocal}` : ""}
            {piece.publishedAt ? ` · ${new Date(piece.publishedAt).toLocaleDateString("es-ES")}` : ""}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-medium text-white tabular-nums">
            {piece.retention !== null ? `${Math.round(piece.retention * 100)}%` : "—"}
          </p>
          <p className="text-[11px] text-white/35">retención</p>
        </div>
      </div>
      <div className="flex items-center gap-3 mt-2 text-[11px] text-white/45 tabular-nums flex-wrap">
        <span>alcance {piece.reach ?? "—"}</span>
        <span>·</span>
        <span>likes {piece.likes ?? "—"}</span>
        <span>·</span>
        <span>coment. {piece.comments ?? "—"}</span>
        <span>·</span>
        <span>comp. {piece.shares ?? "—"}</span>
        <span>·</span>
        <span>guard. {piece.saved ?? "—"}</span>
        {piece.permalink && (
          <>
            <span>·</span>
            <a
              href={piece.permalink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-info hover:underline"
            >
              ver <FaExternalLinkAlt className="text-[9px]" />
            </a>
          </>
        )}
      </div>
    </div>
  );
}

export default function AdminMetricasRsPage() {
  const router = useRouter();
  const { user: authUser, loading: authLoading } = useAuthStore();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);

  const [data, setData] = useState<Performance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metric, setMetric] = useState<MetricKey>("avgRetention");

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

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await adminFetch("/api/admin/socialContentPerformance");
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || "No se pudo obtener el rendimiento");
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al obtener métricas");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!allowed) return;
    void load();
  }, [allowed]);

  if (authLoading || checking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900">
        <Navbar />
        <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-violet-400" />
        </div>
      </div>
    );
  }

  if (!allowed) return null;

  const activeMetric = METRICS.find((m) => m.key === metric)!;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <div className="mb-8">
          <Link
            href="/admin/configuraciones"
            className="inline-flex items-center gap-2 text-sm text-white/55 hover:text-white/85 transition-colors mb-4"
          >
            <FaArrowLeft className="text-xs" />
            Volver a configuraciones
          </Link>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-500/20 border border-cyan-400/35 text-cyan-200">
                <FaChartLine className="text-lg" />
              </span>
              <div>
                <h1 className="text-2xl sm:text-3xl font-semibold text-white">Métricas de RS</h1>
                <p className="text-sm text-white/55 mt-1">Qué engancha de verdad: retención, alcance y amplificación por gancho, franja y tema.</p>
              </div>
            </div>
            <button type="button" onClick={() => void load()} disabled={loading} className="btn btn-secondary text-sm disabled:opacity-50">
              <FaSync className={loading ? "animate-spin" : ""} />
              Actualizar
            </button>
          </div>
        </div>

        {error && <div className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger mb-6">{error}</div>}

        {loading && !data ? (
          <p className="text-sm text-white/50">Cargando métricas...</p>
        ) : !data ? null : (
          <div className="space-y-6">
            {!data.insightsAvailable && (
              <div className="rounded-lg border border-warning/30 bg-warning/10 px-4 py-3">
                <div className="flex items-start gap-3">
                  <FaExclamationTriangle className="text-warning mt-0.5 shrink-0" />
                  <div className="text-sm text-white/80">
                    <p className="font-medium text-warning mb-1">Faltan las métricas que de verdad importan</p>
                    <p className="text-white/65">
                      Ahora mismo solo se leen likes y comentarios, que son las señales de menor peso del algoritmo. Para ver{" "}
                      <strong className="text-white/85">retención, alcance, compartidos y guardados</strong> hace falta añadir el permiso{" "}
                      <code className="text-xs bg-black/30 px-1.5 py-0.5 rounded">instagram_manage_insights</code> al token de Instagram.
                    </p>
                    {data.insightsError && <p className="text-xs text-white/40 mt-2">Respuesta de Instagram: {data.insightsError}</p>}
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Publicadas", value: data.totals.published },
                { label: "Con métricas", value: data.totals.withMetrics },
                {
                  label: "Retención media",
                  value: (() => {
                    const vals = data.best.concat(data.worst).map((p) => p.retention).filter((v): v is number => v !== null);
                    return vals.length ? `${Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100)}%` : "—";
                  })(),
                },
                {
                  label: "Alcance medio",
                  value: (() => {
                    const vals = data.byFunction.map((g) => g.avgReach).filter((v): v is number => v !== null);
                    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length).toLocaleString("es-ES") : "—";
                  })(),
                },
              ].map((card) => (
                <div key={card.label} className="card-surface px-4 py-3">
                  <p className="text-xl font-semibold text-white tabular-nums">{card.value}</p>
                  <p className="text-xs text-white/45 mt-0.5">{card.label}</p>
                </div>
              ))}
            </div>

            <div className="card-surface p-4">
              <p className="text-xs text-white/50 mb-2">Comparar grupos por:</p>
              <div className="flex flex-wrap gap-2">
                {METRICS.map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => setMetric(m.key)}
                    className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${
                      metric === m.key
                        ? "border-cyan-400/40 bg-cyan-500/15 text-cyan-100"
                        : "border-white/10 bg-white/5 text-white/60 hover:text-white/85"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-white/40 mt-3">{activeMetric.help}</p>
            </div>

            <BarChart
              title="Por familia de gancho"
              subtitle="Con qué tipo de apertura retiene más la audiencia. Es la palanca más rápida de mover: cambiar el gancho es gratis."
              rows={data.byHookFamily}
              metric={metric}
            />
            <BarChart
              title="Por función de embudo"
              subtitle="Alcance, nutrición y conversión no se comparan entre sí en volumen — cada una busca algo distinto. Sirve para ver si alguna está fallando en lo suyo."
              rows={data.byFunction}
              metric={metric}
            />
            <BarChart
              title="Por franja horaria"
              subtitle="Si una franja rinde consistentemente peor, conviene moverla antes que cambiar el contenido."
              rows={data.bySlot}
              metric={metric}
            />
            <BarChart
              title="Por tema"
              subtitle="Qué ángulos repetir y cuáles descartar de la rotación."
              rows={data.byTopic}
              metric={metric}
            />

            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="card-surface p-5">
              <h2 className="text-sm font-semibold text-white/80 uppercase tracking-wide mb-3">Mejores piezas</h2>
              <div className="space-y-2">
                {data.best.length === 0 ? (
                  <p className="text-sm text-white/40">Sin datos todavía.</p>
                ) : (
                  data.best.map((p) => <PieceRow key={p.id} piece={p} />)
                )}
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="card-surface p-5">
              <h2 className="text-sm font-semibold text-white/80 uppercase tracking-wide mb-3">Peores piezas</h2>
              <p className="text-xs text-white/45 mb-3">Mirar los ganchos de estas es más útil que mirar los de las mejores: el fallo suele estar en los 3 primeros segundos.</p>
              <div className="space-y-2">
                {data.worst.length === 0 ? (
                  <p className="text-sm text-white/40">Sin datos todavía.</p>
                ) : (
                  data.worst.map((p) => <PieceRow key={p.id} piece={p} />)
                )}
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}
