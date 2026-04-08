import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

function monthKeyFromYmd(ymd: string): string {
  return ymd.slice(0, 7);
}

function weekOfMonthFromYmd(ymd: string): 1 | 2 | 3 | 4 {
  const day = Number(ymd.slice(8, 10));
  if (Number.isNaN(day) || day <= 7) return 1;
  if (day <= 14) return 2;
  if (day <= 21) return 3;
  return 4;
}

function monthLabelFromKey(key: string): string {
  const [year, month] = key.split("-");
  const y = Number(year);
  const m = Number(month);
  if (!Number.isFinite(y) || !Number.isFinite(m)) return key;
  return new Date(y, m - 1, 1).toLocaleDateString("es-AR", { month: "long", year: "numeric" });
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
  const [hasPendingChanges, setHasPendingChanges] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const lastSavedSnapshotRef = useRef<string>("");

  const sameSlotSessions = useMemo(() => {
    return sessions
      .filter((s) => s.planId === planId && s.dayIndex === dayIndex)
      .sort((a, b) => {
        const c = b.completedOn.localeCompare(a.completedOn);
        if (c !== 0) return c;
        return b.weekIndex - a.weekIndex;
      });
  }, [sessions, planId, dayIndex]);

  const historyByMonth = useMemo(() => {
    const grouped = new Map<string, IntakeWorkoutSession[]>();
    for (const sess of sameSlotSessions) {
      const key = monthKeyFromYmd(sess.completedOn);
      const arr = grouped.get(key) || [];
      arr.push(sess);
      grouped.set(key, arr);
    }
    return Array.from(grouped.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([key, monthSessions]) => ({ key, sessions: monthSessions }));
  }, [sameSlotSessions]);

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
    setHasPendingChanges(true);
    setDraft((prev) => {
      const row = prev[exIdx] ? [...prev[exIdx]] : [];
      const cell = row[setIdx] || { kg: "", rest: "" };
      row[setIdx] = { ...cell, [field]: value };
      return { ...prev, [exIdx]: row };
    });
  };

  const buildExercisesPayload = useCallback(() => {
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
          return { error: "Revisa los kg (0–600) en todas las series." as const };
        }
      }
      exercisesPayload.push({
        exerciseIndex: exIdx,
        exerciseName: ex.name,
        sets: cleaned,
      });
    }
    return { exercisesPayload } as const;
  }, [draft, exercises]);

  const saveDraft = useCallback(async () => {
    setBanner(null);
    const parsed = buildExercisesPayload();
    if ("error" in parsed) {
      setBanner({ type: "err", text: parsed.error });
      return false;
    }
    const snapshot = JSON.stringify({
      completedOn,
      exercises: parsed.exercisesPayload,
    });
    if (snapshot === lastSavedSnapshotRef.current) {
      setHasPendingChanges(false);
      return true;
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
            exercises: parsed.exercisesPayload,
          }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : `Error ${res.status}`);
      }
      const session = data.session as IntakeWorkoutSession | undefined;
      if (session) onSessionSaved(session);
      lastSavedSnapshotRef.current = snapshot;
      setHasPendingChanges(false);
      setLastSavedAt(new Date());
      setBanner({ type: "ok", text: "Guardado automático." });
      return true;
    } catch (e) {
      setBanner({ type: "err", text: e instanceof Error ? e.message : "No se pudo guardar." });
      return false;
    } finally {
      setSaving(false);
    }
  }, [
    buildExercisesPayload,
    clientId,
    completedOn,
    dayIndex,
    dayLabel,
    onSessionSaved,
    planId,
    viewToken,
    weekIndex,
  ]);

  useEffect(() => {
    if (!hasPendingChanges) return;
    const timer = setTimeout(() => {
      void saveDraft();
    }, 800);
    return () => clearTimeout(timer);
  }, [draft, completedOn, hasPendingChanges, saveDraft]);

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
            onChange={(e) => {
              setHasPendingChanges(true);
              setCompletedOn(e.target.value);
            }}
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

      <div className="mt-4 rounded-lg border border-emerald-400/20 bg-emerald-900/20 px-3 py-2 text-xs text-emerald-100/90">
        {saving ? "Guardando automáticamente..." : hasPendingChanges ? "Cambios pendientes de guardado..." : "Guardado automático activo."}
        {!saving && !hasPendingChanges && lastSavedAt ? (
          <span className="ml-2 text-emerald-200/80">Último guardado: {lastSavedAt.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
        ) : null}
      </div>

      <button
        type="button"
        onClick={() => setHistoryOpen((v) => !v)}
        className="mt-2 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs text-white/80 hover:bg-white/10"
      >
        {historyOpen ? "Ocultar historial" : "Ver historial de este día del plan"}
      </button>

      {historyOpen && sameSlotSessions.length > 0 ? (
        <div className="mt-3 space-y-2 rounded-lg border border-white/10 bg-black/20 px-3 py-3">
          <p className="text-[11px] text-white/50">Historial mensual de este día del plan, separado por semanas 1/2/3/4.</p>
          {historyByMonth.map(({ key, sessions: monthSessions }) => {
            const slotMap = new Map<number, IntakeWorkoutSession>();
            for (const sess of monthSessions) {
              const weekSlot = weekOfMonthFromYmd(sess.completedOn);
              if (!slotMap.has(weekSlot)) slotMap.set(weekSlot, sess);
            }
            return (
              <div key={key} className="rounded-lg border border-white/10 bg-black/30 px-3 py-3">
                <p className="text-sm font-semibold text-emerald-200/90 capitalize">{monthLabelFromKey(key)}</p>
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full min-w-[680px] text-[11px]">
                    <thead>
                      <tr className="border-b border-white/10 text-white/60">
                        <th className="py-2 pr-2 text-left font-medium">Ejercicio</th>
                        <th className="py-2 px-2 text-left font-medium">Semana 1</th>
                        <th className="py-2 px-2 text-left font-medium">Semana 2</th>
                        <th className="py-2 px-2 text-left font-medium">Semana 3</th>
                        <th className="py-2 pl-2 text-left font-medium">Semana 4</th>
                      </tr>
                    </thead>
                    <tbody>
                      {exercises.map((ex, idx) => (
                        <tr key={`month-${key}-ex-${idx}`} className="border-b border-white/5 last:border-0 align-top">
                          <td className="py-2 pr-2 text-white/90 font-medium">{ex.name}</td>
                          {[1, 2, 3, 4].map((slot) => {
                            const session = slotMap.get(slot);
                            const exLog = session?.exercises.find((e) => e.exerciseIndex === idx);
                            const ar = exLog ? avgRestSec(exLog.sets) : null;
                            return (
                              <td key={`slot-${slot}`} className="py-2 px-2 text-white/75">
                                {exLog ? (
                                  <div>
                                    <p>{formatKgLine(exLog.sets)}</p>
                                    <p className="text-white/45">
                                      {ar != null ? `Descanso medio ~${ar}s` : "Sin descanso cargado"}
                                    </p>
                                  </div>
                                ) : (
                                  <span className="text-white/30">—</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {historyOpen && sameSlotSessions.length === 0 ? (
        <p className="mt-2 text-[11px] text-white/45">Todavía no hay registros para este día. Guardá tu primer entreno arriba.</p>
      ) : null}
    </div>
  );
}
