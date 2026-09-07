import { useCallback, useEffect, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { motion, useReducedMotion } from "framer-motion";
import { FaBolt, FaRunning, FaDumbbell, FaBed, FaPen } from "react-icons/fa";
import Navbar from "@/components/Navbar";
import { useAuthStore } from "@/store/authStore";
import { useAppLocale } from "@/contexts/AppLocaleContext";
import { authedFetch } from "@/lib/userAuthClient";
import { HyroxProfileForm } from "@/components/hyrox/HyroxProfileForm";
import { hyroxCopy, type HyroxLocale } from "@/lib/hyrox/copy";
import { formatDuration, formatPace, type PaceEstimate } from "@/lib/hyrox/pacing";
import { STATIONS } from "@/lib/hyrox/strategy";
import type { GeneratedPlan } from "@/lib/hyrox/generator";
import type { HyroxProfile } from "@/lib/hyrox/profile";
import type { PhaseKey, Session, SessionType } from "@/lib/hyrox/plan";

/**
 * Vista HYROX del cliente.
 *
 * Colorimetría (regla de 3 colores del DESIGN_SYSTEM): neutros + acento, y el
 * color de fase solo como punto de identificación, nunca como relleno grande.
 *
 * NOTA de motion: `initial: { opacity: 0 }` está prohibido en contenido que
 * llega al HTML del servidor — dejó la landing en blanco dos veces. Aquí solo
 * se anima la posición.
 */

type ApiResponse = {
  profile: HyroxProfile | null;
  plan: GeneratedPlan | null;
  pace?: PaceEstimate | null;
  goalAssessment?: string | null;
};

export default function HyroxPage() {
  const router = useRouter();
  const authUser = useAuthStore((s) => s.user);
  const authLoading = useAuthStore((s) => s.loading);
  const { locale } = useAppLocale();
  const c = hyroxCopy((locale as HyroxLocale) ?? "es");
  const reduceMotion = useReducedMotion();
  const fadeUp = reduceMotion ? { initial: false as const } : { initial: { y: 12 }, animate: { y: 0 } };

  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !authUser) void router.replace("/");
  }, [authUser, authLoading, router]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authedFetch("/api/hyrox/plan");
      if (!res.ok) throw new Error(`Error ${res.status}`);
      setData((await res.json()) as ApiResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar tu plan");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authUser) void load();
  }, [authUser, load]);

  const save = async (profile: HyroxProfile) => {
    setSaving(true);
    setError(null);
    try {
      const res = await authedFetch("/api/hyrox/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || `Error ${res.status}`);
      }
      setData((await res.json()) as ApiResponse);
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar tu perfil");
    } finally {
      setSaving(false);
    }
  };

  const plan = data?.plan ?? null;
  const showForm = editing || (!loading && !data?.profile);

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <Head>
        <title>HYROX | FitPlan</title>
        <meta name="robots" content="noindex" />
      </Head>
      <Navbar />

      <main className="mx-auto w-full max-w-4xl px-4 pb-24 pt-6 sm:px-6">
        <motion.div {...fadeUp}>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--accent)]">{c.kicker}</p>

          {loading ? (
            <p className="mt-6 text-sm text-[var(--text-muted)]">…</p>
          ) : showForm ? (
            <>
              <h1 className="mt-2 text-2xl font-extrabold sm:text-3xl">{c.titleNoProfile}</h1>
              <p className="mt-2 max-w-2xl text-sm text-[var(--text-muted)]">{c.introNoProfile}</p>
              <div className="mt-6">
                <HyroxProfileForm
                  initial={data?.profile ?? null}
                  locale={(locale as HyroxLocale) ?? "es"}
                  saving={saving}
                  onSubmit={save}
                  onCancel={data?.profile ? () => setEditing(false) : undefined}
                />
              </div>
            </>
          ) : plan ? (
            <PlanView
              plan={plan}
              pace={data?.pace ?? null}
              goalAssessment={data?.goalAssessment ?? null}
              copy={c}
              onEdit={() => setEditing(true)}
            />
          ) : null}

          {error && (
            <div className="mt-6 rounded-lg border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
              {error}
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
}

/**
 * Las fases se distinguen por INTENSIDAD del acento, no por colores distintos.
 *
 * Los tokens `--phase-hyrox-*` existen (azul/teal/naranja/rosa) y se usan en el
 * panel de admin, pero aquí meterían cuatro hues a la vez que, sumados al
 * acento, dejan cinco colores compitiendo en una pantalla. El techo son tres
 * (DESIGN_SYSTEM §13.10.9). La progresión de opacidad además comunica algo que
 * el color no comunicaba: que las fases van de menos a más específicas.
 */
const PHASE_OPACITY: Record<PhaseKey, number> = {
  base: 0.35,
  construccion: 0.55,
  especifico: 0.78,
  taper: 1,
};

type Copy = ReturnType<typeof hyroxCopy>;

function PlanView({
  plan,
  pace,
  goalAssessment,
  copy: c,
  onEdit,
}: {
  plan: GeneratedPlan;
  pace: PaceEstimate | null;
  goalAssessment: string | null;
  copy: Copy;
  onEdit: () => void;
}) {
  const current = plan.currentWeek ? plan.weeks.find((w) => w.week === plan.currentWeek) : plan.weeks[0];

  return (
    <>
      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-2xl font-extrabold sm:text-3xl">
          {plan.daysUntilRace} <span className="text-[var(--accent)]">{c.daysWord}</span> {c.daysToRace}
        </h1>
        <button type="button" onClick={onEdit} className="btn btn-secondary text-sm">
          <FaPen aria-hidden /> {c.edit}
        </button>
      </div>

      {c.contentLanguageNote && (
        <p className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-sm text-[var(--text-muted)]">
          {c.contentLanguageNote}
        </p>
      )}

      {plan.periodization.warning && (
        <p className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-sm text-[var(--text-muted)]">
          {plan.periodization.warning}
        </p>
      )}

      {pace && (
        <section className="card-surface mt-6 rounded-2xl p-5">
          <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">{c.estimateTitle}</p>
          <p className="mt-1 text-3xl font-extrabold">
            {formatDuration(pace.totalMinutes.min)} – {formatDuration(pace.totalMinutes.max)}
          </p>
          <p className="mt-2 text-sm text-[var(--text-muted)]">{pace.basis}</p>

          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            <Metric label={c.estimateRun} value={formatDuration(pace.runMinutes)} sub={`${formatPace(pace.runPaceSecPerKm)}/km`} />
            <Metric label={c.estimateStations} value={formatDuration(pace.stationsMinutes)} />
            <Metric label={c.estimateRoxzone} value={formatDuration(pace.roxzoneMinutes)} />
          </div>

          <div className="mt-4 rounded-xl bg-[var(--surface-2)] px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">{c.leverTitle}</p>
            <p className="mt-1 text-sm">{c.leverLabels[pace.biggestLever]}</p>
          </div>

          {goalAssessment && <p className="mt-3 text-sm text-[var(--text-muted)]">{goalAssessment}</p>}
        </section>
      )}

      <section className="mt-6">
        <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">{c.phasesTitle}</p>
        <div className="mt-3 flex gap-1.5 overflow-hidden rounded-full">
          {plan.periodization.allocations
            .filter((a) => a.weeks > 0)
            .map((a) => (
              <div
                key={a.key}
                className="h-2.5 rounded-full"
                style={{ flexGrow: a.weeks, background: "var(--accent)", opacity: PHASE_OPACITY[a.key] }}
                title={`${c.phaseNames[a.key]}: ${a.weeks}`}
              />
            ))}
        </div>
        <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--text-muted)]">
          {plan.periodization.allocations
            .filter((a) => a.weeks > 0)
            .map((a) => (
              <span key={a.key} className="inline-flex items-center gap-1.5">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: "var(--accent)", opacity: PHASE_OPACITY[a.key] }}
                  aria-hidden
                />
                {c.phaseNames[a.key]} · {a.weeks}
              </span>
            ))}
        </div>
      </section>

      {current && (
        <section className="mt-8">
          <div className="flex flex-wrap items-baseline gap-2">
            <h2 className="text-lg font-bold">{c.thisWeek}</h2>
            <span className="text-sm text-[var(--text-muted)]">
              {c.weekOf} {current.week} {c.ofWeeks} {plan.periodization.totalWeeks} · {current.headline}
            </span>
            {current.deload && (
              <span className="rounded-full bg-[var(--surface-2)] px-2.5 py-0.5 text-xs text-[var(--text-muted)]">
                {c.deloadBadge}
              </span>
            )}
          </div>
          <p className="mt-1.5 text-sm text-[var(--text-muted)]">
            <strong className="text-[var(--foreground)]">{c.weekGoal}:</strong> {current.keyGoal}
          </p>

          <div className="mt-4 space-y-2.5">
            {current.sessions.map((s) => (
              <SessionRow key={s.day} session={s} copy={c} />
            ))}
          </div>
        </section>
      )}

      <section className="mt-10">
        <h2 className="text-lg font-bold">{c.stationsTitle}</h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">{c.stationsIntro}</p>
        <div className="mt-4 space-y-2.5">
          {STATIONS.map((st) => (
            <details key={st.order} className="card-surface rounded-xl p-4">
              <summary className="cursor-pointer list-none">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="font-semibold">
                    {st.order}. {st.name}
                  </span>
                  <span className="text-sm text-[var(--text-muted)]">{st.spec}</span>
                </span>
              </summary>
              <div className="mt-3 space-y-2 text-sm text-[var(--text-muted)]">
                <p>
                  <strong className="text-[var(--foreground)]">{c.commonMistake}:</strong> {st.commonMistake}
                </p>
                {plan.profile.division !== "individual" && (
                  <p>
                    <strong className="text-[var(--foreground)]">{c.doublesSplit}:</strong> {st.doublesSplit}
                  </p>
                )}
              </div>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl bg-[var(--surface-2)] px-2 py-3">
      <p className="text-xs text-[var(--text-muted)]">{label}</p>
      <p className="mt-0.5 font-bold">{value}</p>
      {sub && <p className="text-xs text-[var(--text-muted)]">{sub}</p>}
    </div>
  );
}

const SESSION_ICON: Record<SessionType, typeof FaBolt> = {
  fuerza: FaDumbbell,
  carrera: FaRunning,
  hyrox: FaBolt,
  descanso: FaBed,
};

function SessionRow({ session, copy: c }: { session: Session; copy: Copy }) {
  const Icon = SESSION_ICON[session.type];
  const isRest = session.type === "descanso";

  return (
    <details className={`card-surface rounded-xl p-4 ${isRest ? "opacity-60" : ""}`}>
      <summary className="cursor-pointer list-none">
        <span className="flex items-baseline justify-between gap-3">
          <span className="flex items-baseline gap-2.5">
            <Icon className="text-[var(--text-muted)]" aria-hidden />
            <span>
              <span className="text-xs uppercase tracking-wide text-[var(--text-muted)]">{session.day}</span>
              <span className="block font-semibold">{session.title}</span>
            </span>
          </span>
          <span className="shrink-0 text-xs text-[var(--text-muted)]">{c.sessionTypes[session.type]}</span>
        </span>
      </summary>
      <div className="mt-3 space-y-2 text-sm">
        <p className="text-[var(--text-muted)]">{session.focus}</p>
        <ul className="space-y-1">
          {session.blocks.map((b, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-[var(--accent)]" aria-hidden>
                ·
              </span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
        {session.notes && <p className="text-xs text-[var(--text-muted)]">{session.notes}</p>}
      </div>
    </details>
  );
}
