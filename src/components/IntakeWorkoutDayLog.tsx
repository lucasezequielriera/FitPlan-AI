import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { IntakeWorkoutSession } from "@/types/intakeWorkoutLog";

type ExerciseRow = {
  name: string;
  setsRaw: unknown;
  repsRaw: unknown;
};

type Props = {
  clientId: string;
  viewToken: string;
  planId: string;
  weekIndex: number;
  dayIndex: number;
  dayLabel: string;
  exercises: ExerciseRow[];
  sessions: IntakeWorkoutSession[];
  onSessionSaved: (session: IntakeWorkoutSession) => void;
};

function localDateYMD(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseSetsCount(raw: unknown): number {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return Math.max(1, Math.min(20, Math.floor(raw)));
  }
  if (typeof raw === "string") {
    const n = parseInt(raw.replace(/\D/g, ""), 10);
    if (Number.isFinite(n)) return Math.max(1, Math.min(20, n));
  }
  return 4;
}

function formatKgLine(sets: { kg: number | null }[]): string {
  const parts = sets.map((s) => (s.kg != null ? `${s.kg}` : "—"));
  return `${parts.join(" · ")} kg`;
}

function avgRestSec(sets: { restAfterSec: number | null }[]): number | null {
  const vals = sets.map((s) => s.restAfterSec).filter((v): v is number => typeof v === "number" && v >= 0);
  if (vals.length === 0) return null;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

export default function IntakeWorkoutDayLog({
  clientId,
  viewToken,
  planId,
  weekIndex,
  dayIndex,
  dayLabel,
  exercises,
  sessions,
  onSessionSaved,
}: Props) {
  const [completedOn, setCompletedOn] = useState(localDateYMD);
  const [draft, setDraft] = useState<Record<number, { kg: string; rest: string }[]>>({});
  const [saving, setSaving] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [banner, setBanner] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const sameSlotSessions = useMemo(() => {
    return sessions
      .filter((s) => s.planId === planId && s.dayIndex === dayIndex)
      .sort((a, b) => {
        const c = b.completedOn.localeCompare(a.completedOn);
        if (c !== 0) return c;
        return b.weekIndex - a.weekIndex;
      });
  }, [sessions, planId, dayIndex]);

  const initDraft = useCallback(() => {
    const next: Record<number, { kg: string; rest: string }[]> = {};
    const session = sessions.find(
      (s) =>
        s.planId === planId &&
        s.weekIndex === weekIndex &&
        s.dayIndex === dayIndex &&
        s.completedOn === completedOn
    );
    exercises.forEach((ex, exIdx) => {
      const nSets = parseSetsCount(ex.setsRaw);
      const fromSession = session?.exercises.find((e) => e.exerciseIndex === exIdx);
      if (fromSession && fromSession.sets.length > 0) {
        next[exIdx] = fromSession.sets.map((s) => ({
          kg: s.kg != null ? String(s.kg) : "",
          rest: s.restAfterSec != null ? String(s.restAfterSec) : "",
        }));
        if (next[exIdx].length < nSets) {
          const pad = nSets - next[exIdx].length;
          next[exIdx] = next[exIdx].concat(Array.from({ length: pad }, () => ({ kg: "", rest: "" })));
        }
      } else {
        next[exIdx] = Array.from({ length: nSets }, () => ({ kg: "", rest: "" }));
      }
    });
    setDraft(next);
  }, [sessions, planId, weekIndex, dayIndex, completedOn, exercises]);

  useEffect(() => {
    initDraft();
  }, [initDraft]);

  const updateCell = (exIdx: number, setIdx: number, field: "kg" | "rest", value: string) => {
    setDraft((prev) => {
      const row = prev[exIdx] ? [...prev[exIdx]] : [];
      const cell = row[setIdx] || { kg: "", rest: "" };
      row[setIdx] = { ...cell, [field]: value };
      return { ...prev, [exIdx]: row };
    });
  };

  const handleSave = async () => {
    setBanner(null);
    const exercisesPayload: {
      exerciseIndex: number;
      exerciseName: string;
      sets: { kg: number | null; restAfterSec: number | null }[];
    }[] = [];

    for (let exIdx = 0; exIdx < exercises.length; exIdx++) {
      const ex = exercises[exIdx];
      const rows = draft[exIdx] || [];
      const sets = rows.map((r) => ({
        kg: r.kg.trim() === "" ? null : Number(r.kg.replace(",", ".")),
        restAfterSec: r.rest.trim() === "" ? null : Number(r.rest.replace(",", ".")),
      }));
      const cleaned = sets.map((s) => ({
        kg: s.kg != null && Number.isFinite(s.kg) ? Math.round(s.kg * 100) / 100 : null,
        restAfterSec:
          s.restAfterSec != null && Number.isFinite(s.restAfterSec)
            ? Math.max(0, Math.min(3600, Math.floor(s.restAfterSec)))
            : null,
      }));
      for (const s of cleaned) {
        if (s.kg !== null && (s.kg < 0 || s.kg > 600)) {
          setBanner({ type: "err", text: "Revisa los kg (0–600) en todas las series." });
          return;
        }
      }
      exercisesPayload.push({
        exerciseIndex: exIdx,
        exerciseName: ex.name,
        sets: cleaned,
      });
    }

    setSaving(true);
    try {
      const res = await fetch(
        `/api/public/intake-workout-log?clientId=${encodeURIComponent(clientId)}&t=${encodeURIComponent(viewToken)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            planId,
            weekIndex,
            dayIndex,
            dayLabel,
            completedOn,
            exercises: exercisesPayload,
          }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : `Error ${res.status}`);
      }
      const session = data.session as IntakeWorkoutSession | undefined;
      if (session) onSessionSaved(session);
      setBanner({ type: "ok", text: "Guardado. Podés seguir completando otros días cuando te toque." });
    } catch (e) {
      setBanner({ type: "err", text: e instanceof Error ? e.message : "No se pudo guardar." });
    } finally {
      setSaving(false);
    }
  };

  if (exercises.length === 0) return null;

  return (
    <div className="mt-4 rounded-xl border border-emerald-400/25 bg-emerald-950/20 px-3 py-3">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-200/90">Tu registro de entreno</p>
        <label className="flex items-center gap-2 text-[11px] text-emerald-100/80">
          <span className="shrink-0">Fecha del entreno</span>
          <input
            type="date"
            value={completedOn}
            onChange={(e) => setCompletedOn(e.target.value)}
            className="rounded-lg border border-white/15 bg-black/30 px-2 py-1.5 text-sm text-white outline-none focus:border-emerald-400/50"
          />
        </label>
      </div>
      <p className="text-[11px] text-emerald-100/60 mt-1">
        Anotá el peso de cada serie y cuánto descansaste después (segundos). Se guarda en tu enlace para ver la evolución.
      </p>

      {banner ? (
        <div
          className={`mt-2 rounded-lg px-3 py-2 text-xs ${
            banner.type === "ok" ? "bg-emerald-500/15 text-emerald-100 border border-emerald-400/30" : "bg-red-500/15 text-red-100 border border-red-400/30"
          }`}
        >
          {banner.text}
        </div>
      ) : null}

      <div className="mt-3 space-y-4">
        {exercises.map((ex, exIdx) => {
          const nSets = parseSetsCount(ex.setsRaw);
          const rows = draft[exIdx] || Array.from({ length: nSets }, () => ({ kg: "", rest: "" }));
          const lastSessionWithEx = sameSlotSessions.find((sess) =>
            sess.exercises.some((e) => e.exerciseIndex === exIdx)
          );
          const prevSameExercise = lastSessionWithEx?.exercises.find((e) => e.exerciseIndex === exIdx);
          const lastKg = prevSameExercise?.sets?.map((s) => s.kg).filter((k): k is number => k != null) ?? [];
          const maxPrev = lastKg.length ? Math.max(...lastKg) : null;

          return (
            <div key={`log-ex-${exIdx}`} className="rounded-lg border border-white/10 bg-black/25 px-3 py-3">
              <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between">
                <p className="text-sm font-medium text-white">
                  {exIdx + 1}. {ex.name}
                </p>
                <p className="text-[11px] text-white/50">
                  Plan: {String(ex.setsRaw ?? "?")} × {String(ex.repsRaw ?? "?")}
                  {maxPrev != null ? (
                    <span className="text-emerald-300/90"> · último máx. {maxPrev} kg (este día)</span>
                  ) : null}
                </p>
              </div>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[280px] text-left text-[11px]">
                  <thead>
                    <tr className="text-white/45 border-b border-white/10">
                      <th className="py-1 pr-2 font-medium">Serie</th>
                      <th className="py-1 pr-2 font-medium">Kg</th>
                      <th className="py-1 font-medium">Descanso después (seg)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: Math.max(nSets, rows.length) }).map((_, setIdx) => (
                      <tr key={`set-${exIdx}-${setIdx}`} className="border-b border-white/5 last:border-0">
                        <td className="py-2 pr-2 text-white/70">{setIdx + 1}</td>
                        <td className="py-2 pr-2">
                          <input
                            inputMode="decimal"
                            placeholder="—"
                            value={rows[setIdx]?.kg ?? ""}
                            onChange={(e) => updateCell(exIdx, setIdx, "kg", e.target.value)}
                            className="w-full min-w-[4rem] rounded-md border border-white/15 bg-black/40 px-2 py-1.5 text-sm text-white placeholder:text-white/25 outline-none focus:border-emerald-400/40"
                          />
                        </td>
                        <td className="py-2">
                          <input
                            inputMode="numeric"
                            placeholder="—"
                            value={rows[setIdx]?.rest ?? ""}
                            onChange={(e) => updateCell(exIdx, setIdx, "rest", e.target.value)}
                            className="w-full min-w-[4rem] rounded-md border border-white/15 bg-black/40 px-2 py-1.5 text-sm text-white placeholder:text-white/25 outline-none focus:border-emerald-400/40"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        disabled={saving}
        onClick={() => void handleSave()}
        className="mt-4 w-full rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-900/30 disabled:opacity-50"
      >
        {saving ? "Guardando…" : "Guardar registro de este día"}
      </button>

      <button
        type="button"
        onClick={() => setHistoryOpen((v) => !v)}
        className="mt-2 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs text-white/80 hover:bg-white/10"
      >
        {historyOpen ? "Ocultar historial" : "Ver historial de este día del plan"}
      </button>

      {historyOpen && sameSlotSessions.length > 0 ? (
        <div className="mt-3 space-y-2 rounded-lg border border-white/10 bg-black/20 px-3 py-3">
          <p className="text-[11px] text-white/50">
            Mismos ejercicios en este día de la semana (distintas semanas del plan), más reciente primero.
          </p>
          {sameSlotSessions.slice(0, 24).map((sess) => (
            <div key={sess.id} className="rounded-md border border-white/10 bg-black/30 px-3 py-2">
              <p className="text-xs text-emerald-200/90">
                {sess.completedOn} · Semana {sess.weekIndex + 1}
              </p>
              <ul className="mt-1 space-y-1 text-[11px] text-white/75">
                {sess.exercises.map((ex) => {
                  const ar = avgRestSec(ex.sets);
                  return (
                    <li key={`${sess.id}-ex-${ex.exerciseIndex}`}>
                      <span className="text-white/90">{ex.exerciseName}:</span> {formatKgLine(ex.sets)}
                      {ar != null ? ` · descanso medio ~${ar}s` : ""}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      ) : null}

      {historyOpen && sameSlotSessions.length === 0 ? (
        <p className="mt-2 text-[11px] text-white/45">Todavía no hay registros para este día. Guardá tu primer entreno arriba.</p>
      ) : null}
    </div>
  );
}
