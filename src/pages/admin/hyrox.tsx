import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import { useAuthStore } from "@/store/authStore";
import { getIsAdminClient, adminFetch } from "@/lib/adminAuthClient";
import Navbar from "@/components/Navbar";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { useAdminFadeUp } from "@/components/admin/adminMotion";
import { FaCheck, FaChevronDown, FaChevronRight } from "react-icons/fa";
import {
  BENCHMARKS,
  FIRST_MONDAY,
  PARTNER_ADJUSTMENTS,
  PHASES,
  RACE_DATE,
  WEEKS,
  currentWeekNumber,
  daysUntilRace,
  type PhaseKey,
  type Session,
} from "@/lib/hyrox/plan";
import { CONTENT_ANGLES, DOUBLES_PRINCIPLES, NUTRITION, PACE_TARGETS, STATIONS } from "@/lib/hyrox/strategy";

type Progress = {
  done: Record<string, boolean>;
  benchmarks: Record<string, Record<string, string>>;
  notes: Record<string, string>;
};

const TYPE_STYLES: Record<Session["type"], { badge: string; label: string }> = {
  fuerza: { badge: "badge-info", label: "Fuerza" },
  carrera: { badge: "badge-success", label: "Carrera" },
  hyrox: { badge: "badge-warning", label: "HYROX" },
  descanso: { badge: "badge-secondary", label: "Descanso" },
};

const PHASE_COLORS: Record<PhaseKey, string> = {
  base: "bg-blue-500/15 border-blue-400/30 text-blue-200",
  construccion: "bg-emerald-500/15 border-emerald-400/30 text-emerald-200",
  especifico: "bg-amber-500/15 border-amber-400/30 text-amber-200",
  taper: "bg-violet-500/15 border-violet-400/30 text-violet-200",
};

type TabKey = "plan" | "estrategia" | "nutricion" | "tests" | "contenido";

const TABS: { key: TabKey; label: string }[] = [
  { key: "plan", label: "Plan semanal" },
  { key: "estrategia", label: "Estrategia de carrera" },
  { key: "tests", label: "Tests" },
  { key: "nutricion", label: "Nutrición" },
  { key: "contenido", label: "Contenido" },
];

function SessionCard({
  session,
  weekNumber,
  done,
  onToggle,
}: {
  session: Session;
  weekNumber: number;
  done: boolean;
  onToggle: () => void;
}) {
  const style = TYPE_STYLES[session.type];
  return (
    <div className={`rounded-lg border px-3 py-3 ${done ? "border-success/30 bg-success/5" : "border-white/10 bg-white/5"}`}>
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={onToggle}
          aria-label={done ? "Marcar como no hecha" : "Marcar como hecha"}
          className={`mt-0.5 h-5 w-5 shrink-0 rounded border flex items-center justify-center transition-colors ${
            done ? "bg-success/80 border-success text-white" : "border-white/25 hover:border-white/50"
          }`}
        >
          {done && <FaCheck className="text-[10px]" />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-white">{session.day}</span>
            <span className={`badge ${style.badge} text-xs`}>{style.label}</span>
            <span className="text-sm text-white/70">{session.title}</span>
          </div>
          <p className="text-xs text-white/45 mt-1">{session.focus}</p>
          <ul className="mt-2 space-y-1">
            {session.blocks.map((block, i) => (
              <li key={i} className="text-sm text-white/80 flex gap-2">
                <span className="text-white/25">·</span>
                <span>{block}</span>
              </li>
            ))}
          </ul>
          {session.notes && (
            <p className="text-xs text-warning/90 mt-2 border-l-2 border-warning/40 pl-2">{session.notes}</p>
          )}
          <span className="sr-only">Semana {weekNumber}</span>
        </div>
      </div>
    </div>
  );
}

export default function AdminHyroxPage() {
  const router = useRouter();
  const fadeUp = useAdminFadeUp();
  const { user: authUser, loading: authLoading } = useAuthStore();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);

  const today = useMemo(() => new Date(), []);
  const activeWeek = currentWeekNumber(today);
  const daysLeft = daysUntilRace(today);

  const [tab, setTab] = useState<TabKey>("plan");
  const [progress, setProgress] = useState<Progress>({ done: {}, benchmarks: {}, notes: {} });
  // Arranca desplegada la semana en curso: es la que se va a consultar el 99%
  // de las veces al abrir la página.
  const [openWeek, setOpenWeek] = useState<number | null>(activeWeek ?? 1);
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

  useEffect(() => {
    if (!allowed) return;
    const load = async () => {
      try {
        const resp = await adminFetch("/api/admin/hyroxProgress");
        const data = await resp.json();
        if (resp.ok) setProgress({ done: data.done, benchmarks: data.benchmarks, notes: data.notes });
      } catch {
        // Si falla, se muestra el plan igual: la parte de progreso es secundaria.
      }
    };
    void load();
  }, [allowed]);

  const toggleSession = async (weekNumber: number, day: string) => {
    const key = `${weekNumber}-${day}`;
    const next = !progress.done[key];
    setProgress((p) => ({ ...p, done: { ...p.done, [key]: next } }));
    try {
      await adminFetch("/api/admin/hyroxProgress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionKey: key, done: next }),
      });
    } catch {
      setError("No se pudo guardar el progreso");
      setProgress((p) => ({ ...p, done: { ...p.done, [key]: !next } }));
    }
  };

  const saveBenchmark = async (benchmarkKey: string, week: number, value: string) => {
    setProgress((p) => ({
      ...p,
      benchmarks: { ...p.benchmarks, [benchmarkKey]: { ...(p.benchmarks[benchmarkKey] || {}), [String(week)]: value } },
    }));
    try {
      await adminFetch("/api/admin/hyroxProgress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ benchmarkKey, week, value }),
      });
    } catch {
      setError("No se pudo guardar el test");
    }
  };

  if (authLoading || checking) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-accent" />
        </div>
      </div>
    );
  }
  if (!allowed) return null;

  const doneCount = Object.values(progress.done).filter(Boolean).length;
  const totalTrainingSessions = WEEKS.reduce((acc, w) => acc + w.sessions.filter((s) => s.type !== "descanso").length, 0);

  return (
    <AdminShell active="hyrox">
      <motion.div {...fadeUp}>
        <AdminPageHeader
          kicker="HYROX"
          title="HYROX"
          subtitle={`Doubles · División Open · ${new Date(RACE_DATE).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}`}
        />

        {error && <div className="mt-6 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</div>}

        <div className="mt-6">

        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="card-surface px-4 py-3">
            <p className="text-2xl font-semibold text-white tabular-nums">{daysLeft}</p>
            <p className="text-xs text-white/45 mt-0.5">días para la carrera</p>
          </div>
          <div className="card-surface px-4 py-3">
            <p className="text-2xl font-semibold text-white tabular-nums">{activeWeek ? `${activeWeek}/15` : "0/15"}</p>
            <p className="text-xs text-white/45 mt-0.5">
              {activeWeek ? "semana actual" : `empieza el ${new Date(FIRST_MONDAY).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}`}
            </p>
          </div>
          <div className="card-surface px-4 py-3">
            <p className="text-2xl font-semibold text-white tabular-nums">
              {doneCount}
              <span className="text-sm text-white/35">/{totalTrainingSessions}</span>
            </p>
            <p className="text-xs text-white/45 mt-0.5">sesiones hechas</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${
                tab === t.key
                  ? "border-orange-400/40 bg-orange-500/15 text-orange-100"
                  : "border-white/10 bg-white/5 text-white/60 hover:text-white/85"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "plan" && (
          <div className="space-y-6">
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="card-surface p-5">
              <h2 className="text-sm font-semibold text-white/80 uppercase tracking-wide mb-3">Las 4 fases</h2>
              <div className="space-y-2">
                {PHASES.map((p) => (
                  <div key={p.key} className={`rounded-lg border px-3 py-2.5 ${PHASE_COLORS[p.key]}`}>
                    <div className="flex items-baseline justify-between gap-2 flex-wrap">
                      <span className="font-medium">{p.name}</span>
                      <span className="text-xs opacity-70">
                        semanas {p.weeks[0]}-{p.weeks[1]}
                      </span>
                    </div>
                    <p className="text-sm mt-1 text-white/75">{p.goal}</p>
                    <p className="text-xs mt-1 text-white/45">Contrapartida: {p.tradeoff}</p>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="card-surface p-5">
              <h2 className="text-sm font-semibold text-white/80 uppercase tracking-wide mb-1">Ajustes para el que corre peor</h2>
              <p className="text-xs text-white/45 mb-3">
                Estáis igualados en fuerza pero no en carrera, y el tiempo del equipo lo marca el más lento. El plan deja de ser simétrico.
              </p>
              <div className="space-y-2">
                {PARTNER_ADJUSTMENTS.map((a) => (
                  <div key={a.title} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2.5">
                    <p className="text-sm font-medium text-white">{a.title}</p>
                    <p className="text-sm text-white/60 mt-1">{a.detail}</p>
                  </div>
                ))}
              </div>
            </motion.div>

            <div className="space-y-3">
              {WEEKS.map((w) => {
                const isOpen = openWeek === w.week;
                const isActive = activeWeek === w.week;
                return (
                  <motion.div
                    key={w.week}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`card-surface overflow-hidden ${isActive ? "ring-1 ring-orange-400/40" : ""}`}
                  >
                    <button
                      type="button"
                      onClick={() => setOpenWeek(isOpen ? null : w.week)}
                      className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-white/[0.03] transition-colors"
                    >
                      {isOpen ? <FaChevronDown className="text-white/40 text-xs shrink-0" /> : <FaChevronRight className="text-white/40 text-xs shrink-0" />}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-white">Semana {w.week}</span>
                          {isActive && <span className="badge badge-warning text-xs">actual</span>}
                          {w.deload && <span className="badge badge-info text-xs">descarga</span>}
                          <span className="text-sm text-white/70">{w.headline}</span>
                        </div>
                        <p className="text-xs text-white/40 mt-0.5">
                          {new Date(w.startDate).toLocaleDateString("es-ES", { day: "numeric", month: "short" })} · {w.keyGoal}
                        </p>
                      </div>
                    </button>
                    {isOpen && (
                      <div className="px-5 pb-5 space-y-2">
                        {w.sessions.map((s) => (
                          <SessionCard
                            key={s.day}
                            session={s}
                            weekNumber={w.week}
                            done={!!progress.done[`${w.week}-${s.day}`]}
                            onToggle={() => void toggleSession(w.week, s.day)}
                          />
                        ))}
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

        {tab === "estrategia" && (
          <div className="space-y-6">
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="card-surface p-5">
              <h2 className="text-sm font-semibold text-white/80 uppercase tracking-wide mb-1">Dónde se va el tiempo</h2>
              <p className="text-xs text-white/45 mb-4">
                En dobles corréis los 8 km enteros pero repartís las estaciones, así que la carrera pesa más que en individual. Ahí está vuestro margen.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[520px]">
                  <thead>
                    <tr className="text-white/45 text-xs">
                      <th className="text-left font-medium pb-2">Objetivo</th>
                      <th className="text-left font-medium pb-2">Ritmo</th>
                      <th className="text-left font-medium pb-2">Carrera</th>
                      <th className="text-left font-medium pb-2">Estaciones</th>
                      <th className="text-left font-medium pb-2">Roxzone</th>
                    </tr>
                  </thead>
                  <tbody>
                    {PACE_TARGETS.map((t) => (
                      <tr key={t.totalTime} className="border-t border-white/10">
                        <td className="py-2.5 pr-3">
                          <p className="text-white font-medium">{t.totalTime}</p>
                          <p className="text-xs text-white/45">{t.level}</p>
                        </td>
                        <td className="py-2.5 pr-3 text-white/80 tabular-nums">{t.runPace}</td>
                        <td className="py-2.5 pr-3 text-white/80 tabular-nums">{t.runTotal}</td>
                        <td className="py-2.5 pr-3 text-white/80 tabular-nums">{t.stationsTotal}</td>
                        <td className="py-2.5 text-white/80 tabular-nums">{t.roxzone}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 space-y-1">
                {PACE_TARGETS.map((t) => (
                  <p key={t.totalTime} className="text-xs text-white/45">
                    <span className="text-white/70">{t.totalTime}:</span> {t.feasibility}
                  </p>
                ))}
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="card-surface p-5">
              <h2 className="text-sm font-semibold text-white/80 uppercase tracking-wide mb-3">Principios del formato dobles</h2>
              <div className="space-y-3">
                {DOUBLES_PRINCIPLES.map((p) => (
                  <div key={p.title} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2.5">
                    <p className="text-sm font-medium text-white">{p.title}</p>
                    <p className="text-sm text-white/60 mt-1">{p.detail}</p>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="card-surface p-5">
              <h2 className="text-sm font-semibold text-white/80 uppercase tracking-wide mb-1">Las 8 estaciones</h2>
              <p className="text-xs text-white/45 mb-4">
                Entre cada estación se corre 1 km. Pesos de división Open — conviene confirmarlos en el reglamento oficial del evento.
              </p>
              <div className="space-y-3">
                {STATIONS.map((s) => (
                  <div key={s.order} className="rounded-lg border border-white/10 bg-white/5 px-3 py-3">
                    <div className="flex items-baseline justify-between gap-2 flex-wrap">
                      <span className="text-sm font-medium text-white">
                        {s.order}. {s.name} — <span className="text-white/60">{s.spec}</span>
                      </span>
                      <span className="text-xs text-white/50 tabular-nums">objetivo {s.targetTime}</span>
                    </div>
                    {s.weightsMen !== "—" && (
                      <p className="text-xs text-white/45 mt-1">
                        Hombres: {s.weightsMen} · Mujeres: {s.weightsWomen}
                      </p>
                    )}
                    <p className="text-sm text-white/75 mt-2">
                      <span className="text-emerald-300/90">Reparto:</span> {s.doublesSplit}
                    </p>
                    <p className="text-sm text-white/60 mt-1.5">
                      <span className="text-warning/90">Error típico:</span> {s.commonMistake}
                    </p>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}

        {tab === "tests" && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="card-surface p-5">
            <h2 className="text-sm font-semibold text-white/80 uppercase tracking-wide mb-1">Tests de referencia</h2>
            <p className="text-xs text-white/45 mb-4">
              Se repiten en las semanas 1, 8 y 14. Sin medir no hay forma de saber si el plan está funcionando ni de ajustar los ritmos.
            </p>
            <div className="space-y-4">
              {BENCHMARKS.map((b) => (
                <div key={b.key} className="rounded-lg border border-white/10 bg-white/5 px-3 py-3">
                  <p className="text-sm font-medium text-white">{b.label}</p>
                  <p className="text-xs text-white/45 mt-0.5 mb-2">{b.why}</p>
                  <div className="flex flex-wrap gap-3">
                    {b.weeks.map((w) => (
                      <label key={w} className="flex items-center gap-2">
                        <span className="text-xs text-white/45">Sem. {w}</span>
                        <input
                          type="text"
                          placeholder={b.unit}
                          defaultValue={progress.benchmarks[b.key]?.[String(w)] || ""}
                          onBlur={(e) => void saveBenchmark(b.key, w, e.target.value)}
                          className="w-24 rounded-lg bg-black/25 border border-white/15 px-2 py-1.5 text-sm text-white tabular-nums outline-none focus:border-orange-400/50"
                        />
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {tab === "nutricion" && (
          <div className="space-y-6">
            {[
              { title: "Día a día durante el bloque", items: NUTRITION.daily },
              { title: "Semana de competición", items: NUTRITION.raceWeek },
              { title: "El día de la carrera", items: NUTRITION.raceDay },
            ].map((section) => (
              <motion.div key={section.title} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="card-surface p-5">
                <h2 className="text-sm font-semibold text-white/80 uppercase tracking-wide mb-3">{section.title}</h2>
                <ul className="space-y-2">
                  {section.items.map((item, i) => (
                    <li key={i} className="text-sm text-white/75 flex gap-2">
                      <span className="text-orange-300/60 shrink-0">·</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        )}

        {tab === "contenido" && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="card-surface p-5">
            <h2 className="text-sm font-semibold text-white/80 uppercase tracking-wide mb-1">El reto como contenido</h2>
            <p className="text-xs text-white/45 mb-4">
              Ángulos por fase para documentar la preparación en Instagram y TikTok.
            </p>
            <div className="space-y-3">
              {CONTENT_ANGLES.map((a) => (
                <div key={a.phase} className="rounded-lg border border-white/10 bg-white/5 px-3 py-3">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="badge badge-info text-xs">{a.phase}</span>
                    <span className="text-sm font-medium text-white">{a.angle}</span>
                  </div>
                  <p className="text-sm text-white/65 mt-1.5">{a.detail}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-white/10">
              <Link href="/admin/metricas-rs" className="text-sm text-info hover:underline">
                Ver métricas de RS para comparar el rendimiento de estas piezas →
              </Link>
            </div>
          </motion.div>
        )}
        </div>
      </motion.div>
    </AdminShell>
  );
}
