import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import { useAuthStore } from "@/store/authStore";
import { getIsAdminClient, adminFetch } from "@/lib/adminAuthClient";
import Navbar from "@/components/Navbar";
import {
  FaArrowLeft,
  FaColumns,
  FaSync,
  FaExclamationTriangle,
  FaExternalLinkAlt,
  FaRegClock,
} from "react-icons/fa";

type BacklogIssue = {
  number: number;
  title: string;
  url: string;
  state: "open" | "closed";
  priority: string | null;
  labels: string[];
  createdAt: string;
  closedAt: string | null;
  durationDays: number;
};

type PendingDecision = BacklogIssue & {
  domain: string;
  excerpt: string | null;
  waitingDays: number;
};

type BacklogGroup = {
  domain: string;
  issues: BacklogIssue[];
};

type Backlog = {
  configured: boolean;
  rateLimited?: boolean;
  reason?: string;
  checkedAt: string;
  totals?: { total: number; open: number; closed: number; pendingDecisions: number };
  pendingDecisions?: PendingDecision[];
  groups?: BacklogGroup[];
};

/** Nombre del equipo detrás de cada label `dominio:*`. */
const DOMAIN_LABELS: Record<string, string> = {
  backend: "Backend y arquitectura",
  frontend: "Frontend",
  diseno: "Diseño",
  marketing: "Marketing y contenido",
  atencion: "Atención a clientes",
  "sin-asignar": "Sin asignar",
};

/** Qué hace cada equipo, para que el panel se lea sin conocer la taxonomía. */
const DOMAIN_DESCRIPTIONS: Record<string, string> = {
  backend: "Modelo de datos, API, integraciones y trabajos programados.",
  frontend: "Pantallas, componentes y su conexión con el backend.",
  diseno: "Identidad visual, tokens y consistencia de la experiencia.",
  marketing: "Contenido, redes y el aprendizaje por métricas.",
  atencion: "Mensajes de usuarios: respuestas y clasificación.",
  "sin-asignar": "Todavía sin equipo asignado.",
};

const PRIORITY_STYLES: Record<string, string> = {
  alta: "border-danger/40 bg-danger/10 text-danger",
  media: "border-warning/40 bg-warning/10 text-warning",
  baja: "border-white/15 bg-white/5 text-white/50",
};

function daysLabel(days: number): string {
  if (days === 0) return "hoy";
  if (days === 1) return "1 día";
  return `${days} días`;
}

function IssueRow({ issue }: { issue: BacklogIssue }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-white/90">
            <span className="text-white/35 tabular-nums">#{issue.number}</span> {issue.title}
          </p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span
              className={`text-[11px] px-1.5 py-0.5 rounded border ${
                issue.state === "open"
                  ? "border-info/40 bg-info/10 text-info"
                  : "border-success/40 bg-success/10 text-success"
              }`}
            >
              {issue.state === "open" ? "Abierto" : "Cerrado"}
            </span>
            {issue.priority && (
              <span
                className={`text-[11px] px-1.5 py-0.5 rounded border ${
                  PRIORITY_STYLES[issue.priority] ?? PRIORITY_STYLES.baja
                }`}
              >
                {issue.priority}
              </span>
            )}
            <span className="text-[11px] text-white/40 tabular-nums">
              {issue.state === "closed"
                ? `tardó ${daysLabel(issue.durationDays)}`
                : `abierto hace ${daysLabel(issue.durationDays)}`}
            </span>
          </div>
        </div>
        <a
          href={issue.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-info hover:underline shrink-0"
        >
          ver <FaExternalLinkAlt className="text-[9px]" />
        </a>
      </div>
    </div>
  );
}

export default function AdminBacklogPage() {
  const router = useRouter();
  const { user: authUser, loading: authLoading } = useAuthStore();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);

  const [data, setData] = useState<Backlog | null>(null);
  const [loading, setLoading] = useState(true);
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

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await adminFetch("/api/admin/githubIssues");
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || "No se pudo obtener el backlog");
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al obtener el backlog");
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

  const pending = data?.pendingDecisions ?? [];

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
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-violet-500/20 border border-violet-400/35 text-violet-200">
                <FaColumns className="text-lg" />
              </span>
              <div>
                <h1 className="text-2xl sm:text-3xl font-semibold text-white">Backlog del equipo</h1>
                <p className="text-sm text-white/55 mt-1">
                  Qué está haciendo cada equipo y qué está esperando una decisión tuya.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="btn btn-secondary text-sm disabled:opacity-50"
            >
              <FaSync className={loading ? "animate-spin" : ""} />
              Actualizar
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger mb-6">{error}</div>
        )}

        {loading && !data ? (
          <p className="text-sm text-white/50">Cargando backlog...</p>
        ) : !data ? null : !data.configured ? (
          <div className="rounded-lg border border-warning/30 bg-warning/10 px-4 py-3">
            <div className="flex items-start gap-3">
              <FaExclamationTriangle className="text-warning mt-0.5 shrink-0" />
              <div className="text-sm text-white/80">
                <p className="font-medium text-warning mb-1">Falta conectar GitHub</p>
                <p className="text-white/65">
                  El backlog vive en los issues del repositorio, pero todavía no están configuradas las variables{" "}
                  <code className="text-xs bg-black/30 px-1.5 py-0.5 rounded">GITHUB_TOKEN</code> y{" "}
                  <code className="text-xs bg-black/30 px-1.5 py-0.5 rounded">GITHUB_REPO</code> en Vercel. Al cargarlas,
                  este panel y la sección de decisiones del resumen semanal se activan solos.
                </p>
                {data.reason && <p className="text-xs text-white/40 mt-2">{data.reason}</p>}
              </div>
            </div>
          </div>
        ) : data.rateLimited ? (
          <div className="rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-white/75">
            GitHub limitó temporalmente las consultas. Volvé a intentar en unos minutos.
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Esperando tu decisión", value: data.totals?.pendingDecisions ?? 0, highlight: true },
                { label: "Abiertos", value: data.totals?.open ?? 0 },
                { label: "Cerrados", value: data.totals?.closed ?? 0 },
                { label: "Total", value: data.totals?.total ?? 0 },
              ].map((card) => (
                <div
                  key={card.label}
                  className={`card-surface px-4 py-3 ${
                    card.highlight && card.value > 0 ? "border border-danger/40 bg-danger/5" : ""
                  }`}
                >
                  <p
                    className={`text-xl font-semibold tabular-nums ${
                      card.highlight && card.value > 0 ? "text-danger" : "text-white"
                    }`}
                  >
                    {card.value}
                  </p>
                  <p className="text-xs text-white/45 mt-0.5">{card.label}</p>
                </div>
              ))}
            </div>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="card-surface p-5 border border-danger/25"
            >
              <h2 className="text-sm font-semibold text-white/80 uppercase tracking-wide mb-1">
                Decisiones que tenés que tomar
              </h2>
              <p className="text-xs text-white/45 mb-4">
                Trabajo que un equipo dejó frenado esperando tu criterio. Lo que más tiempo lleva esperando va primero.
              </p>

              {pending.length === 0 ? (
                <p className="text-sm text-white/40">
                  Nada esperando decisión. Cuando un equipo escale algo, va a aparecer acá.
                </p>
              ) : (
                <div className="space-y-3">
                  {pending.map((issue) => (
                    <div key={issue.number} className="rounded-lg border border-danger/25 bg-danger/5 px-4 py-3">
                      <div className="flex items-start justify-between gap-3 mb-1">
                        <p className="text-sm font-medium text-white/95">
                          <span className="text-white/35 tabular-nums">#{issue.number}</span> {issue.title}
                        </p>
                        <a
                          href={issue.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-info hover:underline shrink-0"
                        >
                          decidir <FaExternalLinkAlt className="text-[9px]" />
                        </a>
                      </div>
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className="text-[11px] px-1.5 py-0.5 rounded border border-white/15 bg-white/5 text-white/70">
                          {DOMAIN_LABELS[issue.domain] ?? issue.domain}
                        </span>
                        {issue.priority && (
                          <span
                            className={`text-[11px] px-1.5 py-0.5 rounded border ${
                              PRIORITY_STYLES[issue.priority] ?? PRIORITY_STYLES.baja
                            }`}
                          >
                            {issue.priority}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1 text-[11px] text-white/45 tabular-nums">
                          <FaRegClock className="text-[9px]" />
                          esperando {daysLabel(issue.waitingDays)}
                        </span>
                      </div>
                      {issue.excerpt && (
                        <p className="text-xs text-white/60 whitespace-pre-line border-l-2 border-white/10 pl-3">
                          {issue.excerpt}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </motion.div>

            {(data.groups ?? []).map((group) => (
              <motion.div
                key={group.domain}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="card-surface p-5"
              >
                <div className="flex items-baseline justify-between gap-3 flex-wrap mb-1">
                  <h2 className="text-sm font-semibold text-white/80 uppercase tracking-wide">
                    {DOMAIN_LABELS[group.domain] ?? group.domain}
                  </h2>
                  <span className="text-xs text-white/40 tabular-nums">
                    {group.issues.filter((i) => i.state === "open").length} abiertos · {group.issues.length} en total
                  </span>
                </div>
                <p className="text-xs text-white/45 mb-4">{DOMAIN_DESCRIPTIONS[group.domain] ?? ""}</p>

                {group.issues.length === 0 ? (
                  <p className="text-sm text-white/40">Sin tareas todavía.</p>
                ) : (
                  <div className="space-y-2">
                    {group.issues.map((issue) => (
                      <IssueRow key={issue.number} issue={issue} />
                    ))}
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
