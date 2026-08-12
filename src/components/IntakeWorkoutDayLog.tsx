import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { IntakeWorkoutExerciseLog, IntakeWorkoutSession } from "@/types/intakeWorkoutLog";

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

/** Fila de borrador: kg, descanso, RIR por serie. */
export type DraftRow = { kg: string; rest: string; rir: string };

const LS_VERSION = 2 as const;

type LocalWorkoutDraftStored = {
  v: typeof LS_VERSION;
  clientId: string;
  planId: string;
  weekIndex: number;
  dayIndex: number;
  completedOn: string;
  draft: Record<string, DraftRow[]>;
  exerciseNotes: Record<string, string>;
  lastSyncedSnapshot: string;
  pendingSync: boolean;
  updatedAt: number;
};

function localDateYMD(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getWorkoutStorageKey(
  clientId: string,
  planId: string,
  weekIndex: number,
  dayIndex: number,
  completedOn: string
): string {
  return `fitplan:intakeWorkout:${clientId}:${planId}:w${weekIndex}:d${dayIndex}:date:${completedOn}`;
}

function emptyRow(): DraftRow {
  return { kg: "", rest: "", rir: "" };
}

function draftToStorage(d: Record<number, DraftRow[]>): Record<string, DraftRow[]> {
  const out: Record<string, DraftRow[]> = {};
  for (const k of Object.keys(d)) {
    out[k] = d[Number(k)];
  }
  return out;
}

function draftFromStorage(raw: Record<string, DraftRow[]>): Record<number, DraftRow[]> {
  const out: Record<number, DraftRow[]> = {};
  for (const k of Object.keys(raw)) {
    const rows = raw[k].map((r) => ({
      kg: r.kg ?? "",
      rest: r.rest ?? "",
      rir: r.rir ?? "",
    }));
    out[Number(k)] = rows;
  }
  return out;
}

/** Migra borrador v1 (solo kg/rest) a DraftRow. */
function migrateV1Draft(raw: Record<string, { kg?: string; rest?: string }[]>): Record<number, DraftRow[]> {
  const out: Record<number, DraftRow[]> = {};
  for (const k of Object.keys(raw)) {
    out[Number(k)] = raw[k].map((r) => ({
      kg: r.kg ?? "",
      rest: r.rest ?? "",
      rir: "",
    }));
  }
  return out;
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

function formatRirLine(sets: { rir?: number | null }[]): string {
  const parts = sets.map((s) => (s.rir != null && s.rir !== undefined ? `${s.rir}` : "—"));
  return `RIR ${parts.join(" · ")}`;
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

function isOnline(): boolean {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine;
}

function draftHasAnyValue(d: Record<number, DraftRow[]>, notes: Record<number, string>): boolean {
  const noteHit = Object.values(notes).some((t) => t.trim().length > 0);
  if (noteHit) return true;
  return Object.values(d).some((rows) =>
    rows.some((r) => r.kg.trim().length > 0 || r.rest.trim().length > 0 || r.rir.trim().length > 0)
  );
}

type ExercisesPayloadItem = {
  exerciseIndex: number;
  exerciseName: string;
  note: string | null;
  sets: { kg: number | null; restAfterSec: number | null; rir: number | null }[];
};

function parseRirFromInput(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  const v = Math.floor(n);
  if (v < 0 || v > 4) return null;
  return v;
}

function normalizeExerciseName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function buildExercisesPayloadFromDraft(
  sourceDraft: Record<number, DraftRow[]>,
  exerciseNotes: Record<number, string>,
  exerciseList: ExerciseRow[]
): { exercisesPayload: ExercisesPayloadItem[] } | { error: string } {
  const exercisesPayload: ExercisesPayloadItem[] = [];

  for (let exIdx = 0; exIdx < exerciseList.length; exIdx++) {
    const ex = exerciseList[exIdx];
    const rows = sourceDraft[exIdx] || [];
    const noteTrim = (exerciseNotes[exIdx] ?? "").trim();
    const sets = rows.map((r) => ({
      kg: r.kg.trim() === "" ? null : Number(r.kg.replace(",", ".")),
      restAfterSec: r.rest.trim() === "" ? null : Number(r.rest.replace(",", ".")),
      rirRaw: r.rir.trim(),
    }));
    const cleaned: { kg: number | null; restAfterSec: number | null; rir: number | null }[] = [];
    for (const s of sets) {
      const rir = parseRirFromInput(s.rirRaw);
      if (s.rirRaw.length > 0 && rir === null) {
        return { error: "RIR: usa un entero de 0 a 4 por serie (0 = muy duro)." };
      }
      const kg = s.kg != null && Number.isFinite(s.kg) ? Math.round(s.kg * 100) / 100 : null;
      if (kg !== null && (kg < 0 || kg > 600)) {
        return { error: "Revisa los kg (0–600) en todas las series." };
      }
      const restAfterSec =
        s.restAfterSec != null && Number.isFinite(s.restAfterSec)
          ? Math.max(0, Math.min(3600, Math.floor(s.restAfterSec)))
          : null;
      cleaned.push({ kg, restAfterSec, rir });
    }
    exercisesPayload.push({
      exerciseIndex: exIdx,
      exerciseName: ex.name,
      note: noteTrim.length ? noteTrim.slice(0, 2000) : null,
      sets: cleaned,
    });
  }
  return { exercisesPayload };
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
  const [draft, setDraft] = useState<Record<number, DraftRow[]>>({});
  const [exerciseNotes, setExerciseNotes] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [banner, setBanner] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [hasPendingChanges, setHasPendingChanges] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [offlinePending, setOfflinePending] = useState(false);
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [compareWeekA, setCompareWeekA] = useState<number | null>(null);
  const [compareWeekB, setCompareWeekB] = useState<number | null>(null);
  const lastSavedSnapshotRef = useRef<string>("");

  const storageKey = useMemo(
    () => getWorkoutStorageKey(clientId, planId, weekIndex, dayIndex, completedOn),
    [clientId, planId, weekIndex, dayIndex, completedOn]
  );

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

  const weekIndexes = useMemo(() => {
    return Array.from(new Set(sameSlotSessions.map((s) => s.weekIndex))).sort((a, b) => a - b);
  }, [sameSlotSessions]);

  useEffect(() => {
    if (weekIndexes.length === 0) {
      setCompareWeekA(null);
      setCompareWeekB(null);
      return;
    }
    setCompareWeekA((prev) => (prev != null && weekIndexes.includes(prev) ? prev : weekIndexes[0]));
    setCompareWeekB((prev) => {
      if (prev != null && weekIndexes.includes(prev) && prev !== (compareWeekA ?? -1)) return prev;
      const candidate = weekIndexes.find((w) => w !== (compareWeekA ?? weekIndexes[0]));
      return candidate ?? weekIndexes[0];
    });
  }, [weekIndexes, compareWeekA]);

  const latestSession = sameSlotSessions[0] ?? null;
  const fatigue = useMemo(() => {
    if (!latestSession) return null;
    const rirVals: number[] = [];
    latestSession.exercises.forEach((ex) =>
      ex.sets.forEach((s) => {
        if (typeof s.rir === "number") rirVals.push(s.rir);
      })
    );
    if (rirVals.length === 0) return null;
    const avg = rirVals.reduce((a, b) => a + b, 0) / rirVals.length;
    if (avg <= 1) return { level: "high" as const, label: `Fatiga alta (RIR medio ${avg.toFixed(1)})`, color: "text-danger" };
    if (avg <= 2) return { level: "medium" as const, label: `Fatiga media (RIR medio ${avg.toFixed(1)})`, color: "text-warning" };
    return { level: "low" as const, label: `Fatiga baja (RIR medio ${avg.toFixed(1)})`, color: "text-success" };
  }, [latestSession]);

  const stagnationRows = useMemo(() => {
    const rows: Array<{ exerciseName: string; status: "stalled" | "progressing" | "insufficient"; recommendation: string }> = [];
    exercises.forEach((ex, exIdx) => {
      const points = sameSlotSessions
        .slice(0, 6)
        .map((sess) => {
          const log = sess.exercises.find((e) => e.exerciseIndex === exIdx);
          if (!log) return null;
          const maxKg = Math.max(...log.sets.map((s) => (typeof s.kg === "number" ? s.kg : 0)));
          const rirVals = log.sets.map((s) => s.rir).filter((v): v is number => typeof v === "number");
          const avgRir = rirVals.length ? rirVals.reduce((a, b) => a + b, 0) / rirVals.length : null;
          return { maxKg, avgRir };
        })
        .filter(Boolean) as Array<{ maxKg: number; avgRir: number | null }>;
      if (points.length < 3) {
        rows.push({ exerciseName: ex.name, status: "insufficient", recommendation: "Necesitamos 3 sesiones para evaluar tendencia." });
        return;
      }
      const recent = points.slice(0, 3);
      const old = points.slice(3, 6);
      const recentMax = Math.max(...recent.map((p) => p.maxKg));
      const oldMax = old.length ? Math.max(...old.map((p) => p.maxKg)) : recentMax;
      const recentRir = recent
        .map((p) => p.avgRir)
        .filter((v): v is number => typeof v === "number");
      const avgRecentRir = recentRir.length ? recentRir.reduce((a, b) => a + b, 0) / recentRir.length : null;
      const stalled = recentMax <= oldMax + 0.01;
      if (stalled && avgRecentRir != null && avgRecentRir >= 2) {
        rows.push({
          exerciseName: ex.name,
          status: "stalled",
          recommendation: "Estancado con RIR alto: prueba subir +2.5 kg o +1 repetición.",
        });
      } else {
        rows.push({
          exerciseName: ex.name,
          status: "progressing",
          recommendation: "Vas progresando. Mantené técnica y sobrecarga gradual.",
        });
      }
    });
    return rows;
  }, [exercises, sameSlotSessions]);
  const visibleStagnationRows = useMemo(
    () => stagnationRows.filter((r) => r.status !== "insufficient"),
    [stagnationRows]
  );

  const lastSessionForCopy = useMemo(() => {
    return sameSlotSessions.find((s) => s.completedOn !== completedOn) ?? sameSlotSessions[0] ?? null;
  }, [sameSlotSessions, completedOn]);

  const buildDraftFromServerSession = useCallback(
    (session: IntakeWorkoutSession | undefined): {
      draft: Record<number, DraftRow[]>;
      notes: Record<number, string>;
    } => {
      const next: Record<number, DraftRow[]> = {};
      const notes: Record<number, string> = {};
      exercises.forEach((ex, exIdx) => {
        const nSets = parseSetsCount(ex.setsRaw);
        const fromSession = session?.exercises.find((e) => e.exerciseIndex === exIdx);
        if (typeof fromSession?.note === "string" && fromSession.note.trim()) {
          notes[exIdx] = fromSession.note;
        }
        if (fromSession && fromSession.sets.length > 0) {
          next[exIdx] = fromSession.sets.map((s) => ({
            kg: s.kg != null ? String(s.kg) : "",
            rest: s.restAfterSec != null ? String(s.restAfterSec) : "",
            rir: s.rir != null && s.rir !== undefined ? String(s.rir) : "",
          }));
          if (next[exIdx].length < nSets) {
            const pad = nSets - next[exIdx].length;
            next[exIdx] = next[exIdx].concat(Array.from({ length: pad }, () => emptyRow()));
          }
        } else {
          next[exIdx] = Array.from({ length: nSets }, () => emptyRow());
        }
      });
      return { draft: next, notes };
    },
    [exercises]
  );

  const persistLocal = useCallback(
    (
      nextDraft: Record<number, DraftRow[]>,
      nextNotes: Record<number, string>,
      pendingSync: boolean,
      lastSynced: string
    ) => {
      if (typeof window === "undefined") return;
      try {
        const notesStr: Record<string, string> = {};
        for (const k of Object.keys(nextNotes)) {
          notesStr[k] = nextNotes[Number(k)];
        }
        const payload: LocalWorkoutDraftStored = {
          v: LS_VERSION,
          clientId,
          planId,
          weekIndex,
          dayIndex,
          completedOn,
          draft: draftToStorage(nextDraft),
          exerciseNotes: notesStr,
          lastSyncedSnapshot: lastSynced,
          pendingSync,
          updatedAt: Date.now(),
        };
        localStorage.setItem(storageKey, JSON.stringify(payload));
        setOfflinePending(pendingSync);
      } catch {
        // private mode / quota
      }
    },
    [clientId, planId, weekIndex, dayIndex, completedOn, storageKey]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    let loaded = false;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        if (
          (parsed.v === 2 || parsed.v === 1) &&
          parsed.clientId === clientId &&
          parsed.planId === planId &&
          parsed.weekIndex === weekIndex &&
          parsed.dayIndex === dayIndex &&
          parsed.completedOn === completedOn &&
          parsed.draft &&
          typeof parsed.draft === "object"
        ) {
          const d =
            parsed.v === 2
              ? draftFromStorage(parsed.draft as Record<string, DraftRow[]>)
              : migrateV1Draft(parsed.draft as Record<string, { kg?: string; rest?: string }[]>);
          const notesRaw = parsed.v === 2 && parsed.exerciseNotes && typeof parsed.exerciseNotes === "object"
            ? (parsed.exerciseNotes as Record<string, string>)
            : {};
          const notes: Record<number, string> = {};
          for (const k of Object.keys(notesRaw)) {
            notes[Number(k)] = notesRaw[k];
          }
          const pendingSync = Boolean(parsed.pendingSync);
          const lastSync = typeof parsed.lastSyncedSnapshot === "string" ? parsed.lastSyncedSnapshot : "";
          const worthKeeping = pendingSync || draftHasAnyValue(d, notes) || lastSync.length > 0;
          if (worthKeeping) {
            setDraft(d);
            setExerciseNotes(notes);
            lastSavedSnapshotRef.current = lastSync;
            setOfflinePending(pendingSync);
            loaded = true;
          }
        }
      }
    } catch {
      // ignore
    }
    if (!loaded) {
      const session = sessions.find(
        (s) =>
          s.planId === planId &&
          s.weekIndex === weekIndex &&
          s.dayIndex === dayIndex &&
          s.completedOn === completedOn
      );
      const { draft: fromServer, notes } = buildDraftFromServerSession(session);
      setDraft(fromServer);
      setExerciseNotes(notes);
      const payload = buildExercisesPayloadFromDraft(fromServer, notes, exercises);
      if (!("error" in payload)) {
        const snap = JSON.stringify({
          completedOn,
          exercises: payload.exercisesPayload,
        });
        lastSavedSnapshotRef.current = snap;
      } else {
        lastSavedSnapshotRef.current = "";
      }
      setOfflinePending(false);
    }
  }, [
    storageKey,
    clientId,
    planId,
    weekIndex,
    dayIndex,
    completedOn,
    sessions,
    exercises,
    buildDraftFromServerSession,
  ]);

  const updateCell = (exIdx: number, setIdx: number, field: keyof DraftRow, value: string) => {
    setHasPendingChanges(true);
    setDraft((prev) => {
      const row = prev[exIdx] ? [...prev[exIdx]] : [];
      const cell = row[setIdx] || emptyRow();
      row[setIdx] = { ...cell, [field]: value };
      return { ...prev, [exIdx]: row };
    });
  };

  const updateExerciseNote = (exIdx: number, value: string) => {
    setHasPendingChanges(true);
    setExerciseNotes((prev) => ({ ...prev, [exIdx]: value }));
  };

  const copyFromRowAbove = (exIdx: number, setIdx: number) => {
    if (setIdx <= 0) return;
    setHasPendingChanges(true);
    setDraft((prev) => {
      const row = prev[exIdx] ? [...prev[exIdx]] : [];
      const src = row[setIdx - 1] || emptyRow();
      row[setIdx] = { kg: src.kg, rest: src.rest, rir: src.rir };
      return { ...prev, [exIdx]: row };
    });
  };

  const repeatLastSession = () => {
    if (!lastSessionForCopy) {
      setBanner({ type: "err", text: "No hay una sesión anterior para copiar." });
      return;
    }
    setHasPendingChanges(true);
    let matchedByNameCount = 0;
    let matchedByIndexCount = 0;
    setExerciseNotes((prev) => {
      const next = { ...prev };
      exercises.forEach((_, exIdx) => {
        const currentName = normalizeExerciseName(exercises[exIdx].name);
        const fromByName = lastSessionForCopy.exercises.find(
          (e) => normalizeExerciseName(e.exerciseName) === currentName
        );
        const fromByIndex = lastSessionForCopy.exercises.find((e) => e.exerciseIndex === exIdx);
        const from = fromByName ?? fromByIndex;
        if (fromByName) matchedByNameCount += 1;
        else if (fromByIndex) matchedByIndexCount += 1;
        if (typeof from?.note === "string" && from.note.trim()) {
          next[exIdx] = from.note;
        }
      });
      return next;
    });
    setDraft((prev) => {
      const next = { ...prev };
      exercises.forEach((ex, exIdx) => {
        const nSets = parseSetsCount(ex.setsRaw);
        const currentName = normalizeExerciseName(ex.name);
        const fromByName = lastSessionForCopy.exercises.find(
          (e) => normalizeExerciseName(e.exerciseName) === currentName
        );
        const fromByIndex = lastSessionForCopy.exercises.find((e) => e.exerciseIndex === exIdx);
        const from = fromByName ?? fromByIndex;
        if (from && from.sets.length > 0) {
          let rows = from.sets.map((s) => ({
            kg: s.kg != null ? String(s.kg) : "",
            rest: s.restAfterSec != null ? String(s.restAfterSec) : "",
            rir: s.rir != null && s.rir !== undefined ? String(s.rir) : "",
          }));
          if (rows.length < nSets) {
            rows = rows.concat(Array.from({ length: nSets - rows.length }, () => emptyRow()));
          } else if (rows.length > nSets) {
            rows = rows.slice(0, nSets);
          }
          next[exIdx] = rows;
        }
      });
      return next;
    });
    setBanner({
      type: "ok",
      text: `Valores copiados desde el ${lastSessionForCopy.completedOn}. Match por nombre: ${matchedByNameCount}, fallback índice: ${matchedByIndexCount}.`,
    });
  };

  const buildExercisesPayload = useCallback(() => {
    return buildExercisesPayloadFromDraft(draft, exerciseNotes, exercises);
  }, [draft, exerciseNotes, exercises]);

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
      persistLocal(draft, exerciseNotes, false, lastSavedSnapshotRef.current);
      return true;
    }

    if (!isOnline()) {
      persistLocal(draft, exerciseNotes, true, lastSavedSnapshotRef.current);
      setHasPendingChanges(false);
      setLastSavedAt(new Date());
      setBanner({ type: "ok", text: "Sin conexión: guardado en este dispositivo. Se sincronizará al volver internet." });
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
      persistLocal(draft, exerciseNotes, false, snapshot);
      setHasPendingChanges(false);
      setOfflinePending(false);
      setLastSavedAt(new Date());
      setBanner({ type: "ok", text: "Guardado automático." });
      return true;
    } catch (e) {
      persistLocal(draft, exerciseNotes, true, lastSavedSnapshotRef.current);
      setOfflinePending(true);
      setBanner({ type: "err", text: e instanceof Error ? e.message : "No se pudo guardar. Quedó en este dispositivo." });
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
    draft,
    exerciseNotes,
    onSessionSaved,
    persistLocal,
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
  }, [draft, exerciseNotes, completedOn, hasPendingChanges, saveDraft]);

  useEffect(() => {
    if (Object.keys(draft).length === 0) return;
    if (!draftHasAnyValue(draft, exerciseNotes) && !offlinePending) return;
    const t = setTimeout(() => {
      const pending = hasPendingChanges || offlinePending;
      persistLocal(draft, exerciseNotes, pending, lastSavedSnapshotRef.current);
    }, 400);
    return () => clearTimeout(t);
  }, [draft, exerciseNotes, hasPendingChanges, offlinePending, persistLocal]);

  useEffect(() => {
    const onOnline = () => {
      void saveDraft();
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [saveDraft]);

  const openWeekSessions = (targetWeek: number | null): IntakeWorkoutSession[] => {
    if (targetWeek == null) return [];
    return sameSlotSessions
      .filter((s) => s.weekIndex === targetWeek)
      .sort((a, b) => b.completedOn.localeCompare(a.completedOn));
  };

  const exportMonthlyPdf = async (monthKey: string, monthSessions: IntakeWorkoutSession[]) => {
    try {
      const { default: jsPDF } = await import("jspdf");
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const pageW = 595;
      const pageH = 842;
      const pad = 34;

      const paintBg = () => {
        doc.setFillColor(8, 14, 30);
        doc.rect(0, 0, pageW, pageH, "F");
      };
      paintBg();

      // Header premium
      doc.setFillColor(20, 184, 166);
      doc.roundedRect(pad, 26, pageW - pad * 2, 72, 10, 10, "F");
      doc.setTextColor(6, 12, 24);
      doc.setFontSize(20);
      doc.text("INFORME MENSUAL FITPLAN", pad + 14, 54);
      doc.setFontSize(11);
      doc.text(`${monthLabelFromKey(monthKey)} · Día: ${dayLabel}`, pad + 14, 74);

      let y = 120;
      const slotMap = new Map<number, IntakeWorkoutSession>();
      const monthSessionsSorted = [...monthSessions].sort((a, b) => b.completedOn.localeCompare(a.completedOn));
      for (const sess of monthSessions) {
        const w = weekOfMonthFromYmd(sess.completedOn);
        if (!slotMap.has(w)) slotMap.set(w, sess);
      }

      // KPI cards
      const filledWeeks = [1, 2, 3, 4].filter((w) => slotMap.has(w)).length;
      const totalSets = monthSessions.reduce((acc, s) => acc + s.exercises.reduce((a, e) => a + e.sets.length, 0), 0);
      const rirVals = monthSessions.flatMap((s) => s.exercises.flatMap((e) => e.sets.map((st) => st.rir).filter((v): v is number => typeof v === "number")));
      const avgRirVal = rirVals.length ? (rirVals.reduce((a, b) => a + b, 0) / rirVals.length).toFixed(2) : "N/A";

      const cardW = (pageW - pad * 2 - 16) / 3;
      const cards = [
        { title: "Semanas completadas", value: `${filledWeeks}/4` },
        { title: "Series registradas", value: String(totalSets) },
        { title: "RIR medio mensual", value: avgRirVal },
      ];
      cards.forEach((c, idx) => {
        const x = pad + idx * (cardW + 8);
        doc.setFillColor(15, 23, 42);
        doc.setDrawColor(45, 212, 191);
        doc.roundedRect(x, y, cardW, 54, 8, 8, "FD");
        doc.setTextColor(148, 163, 184);
        doc.setFontSize(9);
        doc.text(c.title, x + 10, y + 18);
        doc.setTextColor(240, 253, 250);
        doc.setFontSize(16);
        doc.text(c.value, x + 10, y + 40);
      });
      y += 72;

      for (let exIdx = 0; exIdx < exercises.length; exIdx++) {
        const ex = exercises[exIdx];
        if (y > 748) {
          doc.addPage();
          paintBg();
          y = 40;
        }
        doc.setFillColor(15, 23, 42);
        doc.setDrawColor(56, 189, 248);
        doc.roundedRect(pad, y - 12, pageW - pad * 2, 72, 8, 8, "FD");
        doc.setTextColor(125, 211, 252);
        doc.setFontSize(11);
        doc.text(`${exIdx + 1}. ${ex.name}`, pad + 10, y + 2);
        y += 16;
        doc.setTextColor(226, 232, 240);
        doc.setFontSize(9);
        for (const slot of [1, 2, 3, 4]) {
          const sess = slotMap.get(slot);
          const exLog = sess?.exercises.find((e) => e.exerciseIndex === exIdx);
          const line = exLog
            ? `S${slot}: ${formatKgLine(exLog.sets)} · ${formatRirLine(exLog.sets)}`
            : `Semana ${slot}: —`;
          doc.text(line, pad + 12, y);
          y += 10;
        }
        const latestLog = monthSessionsSorted
          .map((s) => s.exercises.find((e) => e.exerciseIndex === exIdx))
          .find(Boolean);
        const note = typeof latestLog?.note === "string" && latestLog.note.trim() ? latestLog.note.trim() : null;
        if (note) {
          doc.setTextColor(148, 163, 184);
          doc.text(`Nota: ${note.slice(0, 120)}`, pad + 12, y);
          y += 10;
        }
        y += 12;
      }

      doc.setTextColor(148, 163, 184);
      doc.setFontSize(8);
      doc.text("Generado por FitPlan · Reporte de progreso mensual", pad, 820);
      doc.save(`fitplan-informe-${monthKey}-${dayLabel.toLowerCase().replace(/\s+/g, "-")}.pdf`);
    } catch (e) {
      setBanner({ type: "err", text: e instanceof Error ? e.message : "No se pudo exportar el PDF." });
    }
  };

  if (exercises.length === 0) return null;

  const inp = "rounded-md border border-white/15 bg-black/40 px-2 py-1.5 text-sm text-white placeholder:text-white/25 outline-none focus:border-success/40";

  return (
    <div className="mt-4 rounded-xl border border-success/25 bg-success/10 px-3 py-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-success/90">Tu registro de entreno</p>
          <button
            type="button"
            onClick={() => setComparisonOpen(true)}
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] font-medium text-white/90 hover:bg-white/10"
          >
            Comparador de semanas
          </button>
        </div>
        <label className="flex items-center gap-2 text-[11px] text-success/80">
          <span className="shrink-0">Fecha del entreno</span>
          <input
            type="date"
            value={completedOn}
            onChange={(e) => {
              setHasPendingChanges(true);
              setCompletedOn(e.target.value);
            }}
            className="rounded-lg border border-white/15 bg-black/30 px-2 py-1.5 text-sm text-white outline-none focus:border-success/50"
          />
        </label>
      </div>
      <p className="mt-1 text-[11px] text-success/60">
        Kg, descanso y RIR (0–4 por serie). Incluye notas por ejercicio y análisis automático de progreso.
      </p>

      {fatigue ? (
        <div className="mt-2 rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-xs">
          <span className="text-white/60">Semáforo de fatiga:</span> <span className={fatigue.color}>{fatigue.label}</span>
        </div>
      ) : null}

      {visibleStagnationRows.length > 0 ? (
        <div className="mt-2 rounded-lg border border-white/10 bg-black/25 px-3 py-2">
          <p className="text-[11px] text-white/55">Detección de estancamientos</p>
          <ul className="mt-1 space-y-1 text-[11px] text-white/80">
            {visibleStagnationRows.slice(0, 6).map((row) => (
              <li key={row.exerciseName}>
                <span
                  className={row.status === "stalled" ? "text-warning" : "text-success"}
                >
                  {row.exerciseName}:
                </span>{" "}
                {row.recommendation}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={repeatLastSession}
          disabled={!lastSessionForCopy}
          className="rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-medium text-white/90 hover:bg-white/15 disabled:opacity-40"
        >
          Repetir última sesión
        </button>
        {!isOnline() ? (
          <span className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-1.5 text-[11px] text-warning">
            Sin conexión · borrador local
          </span>
        ) : offlinePending ? (
          <span className="rounded-lg border border-info/30 bg-info/10 px-3 py-1.5 text-[11px] text-info">
            Pendiente de sincronizar con el servidor
          </span>
        ) : null}
      </div>

      {banner ? (
        <div className={`mt-2 rounded-lg border px-3 py-2 text-xs ${banner.type === "ok" ? "border-success/30 bg-success/15 text-success" : "border-danger/30 bg-danger/15 text-danger"}`}>
          {banner.text}
        </div>
      ) : null}

      <div className="mt-3 space-y-4">
        {exercises.map((ex, exIdx) => {
          const nSets = parseSetsCount(ex.setsRaw);
          const rows = draft[exIdx] || Array.from({ length: nSets }, () => emptyRow());
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
                    <span className="text-success/90"> · último máx. {maxPrev} kg (este día)</span>
                  ) : null}
                </p>
              </div>
              <label className="mt-2 block text-[11px]">
                <span className="text-white/55">Nota (opcional)</span>
                <textarea
                  value={exerciseNotes[exIdx] ?? ""}
                  onChange={(e) => updateExerciseNote(exIdx, e.target.value)}
                  rows={2}
                  placeholder="Sensaciones, técnica, molestias…"
                  className="mt-1 w-full resize-y rounded-lg border border-white/15 bg-black/35 px-2 py-1.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-success/45"
                />
              </label>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-[11px]">
                  <thead>
                    <tr className="text-white/45 border-b border-white/10">
                      <th className="py-1 pr-2 font-medium">Serie</th>
                      <th className="py-1 pr-2 font-medium">Kg</th>
                      <th className="py-1 pr-2 font-medium">Descanso (seg)</th>
                      <th className="py-1 pr-2 font-medium">RIR 0–4</th>
                      <th className="py-1 w-24 font-medium text-right">Rápido</th>
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
                            className={`w-full min-w-[4rem] ${inp}`}
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            inputMode="numeric"
                            placeholder="—"
                            value={rows[setIdx]?.rest ?? ""}
                            onChange={(e) => updateCell(exIdx, setIdx, "rest", e.target.value)}
                            className={`w-full min-w-[4rem] ${inp}`}
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            inputMode="numeric"
                            placeholder="—"
                            value={rows[setIdx]?.rir ?? ""}
                            onChange={(e) => updateCell(exIdx, setIdx, "rir", e.target.value)}
                            className={`w-full min-w-[3rem] max-w-[5rem] ${inp}`}
                            title="Reps en reserva: 0 muy duro, 4 muy fácil"
                          />
                        </td>
                        <td className="py-2 text-right">
                          {setIdx > 0 ? (
                            <button
                              type="button"
                              onClick={() => copyFromRowAbove(exIdx, setIdx)}
                              className="text-[10px] font-medium text-success/90 underline-offset-2 hover:underline"
                            >
                              Igual arriba
                            </button>
                          ) : (
                            <span className="text-white/25">—</span>
                          )}
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

      <div className="mt-4 rounded-lg border border-success/20 bg-success/10 px-3 py-2 text-xs text-success/90">
        {saving
          ? "Guardando automáticamente..."
          : hasPendingChanges
            ? "Cambios pendientes de guardado..."
            : offlinePending
              ? "Listo en el dispositivo; pendiente de subir al servidor."
              : "Guardado automático activo."}
        {!saving && !hasPendingChanges && lastSavedAt ? (
          <span className="ml-2 text-success/80">
            Último guardado: {lastSavedAt.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </span>
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
          <p className="text-white/50">Historial mensual de este día del plan, semanas 1–4 del mes.</p>
          {historyByMonth.map(({ key, sessions: monthSessions }) => {
            const slotMap = new Map<number, IntakeWorkoutSession>();
            for (const sess of monthSessions) {
              const weekSlot = weekOfMonthFromYmd(sess.completedOn);
              if (!slotMap.has(weekSlot)) slotMap.set(weekSlot, sess);
            }
            return (
              <div key={key} className="rounded-lg border border-white/10 bg-black/30 px-3 py-3">
                <p className="font-semibold text-success/90 capitalize">{monthLabelFromKey(key)}</p>
                <div className="mt-2 flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => void exportMonthlyPdf(key, monthSessions)}
                    className="rounded-md border border-info/30 bg-info/10 px-2.5 py-1 text-[11px] text-info hover:bg-info/20"
                  >
                    Exportar PDF mensual
                  </button>
                </div>
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full min-w-[720px] text-[11px]">
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
                            const note = typeof exLog?.note === "string" && exLog.note.trim() ? exLog.note.trim() : null;
                            return (
                              <td key={`slot-${slot}`} className="py-2 px-2 text-white/75">
                                {exLog ? (
                                  <div className="space-y-1">
                                    <p>{formatKgLine(exLog.sets)}</p>
                                    <p className="text-[var(--phase-maintenance)]/90">{formatRirLine(exLog.sets)}</p>
                                    <p className="text-white/45">
                                      {ar != null ? `Descanso medio ~${ar}s` : "Sin descanso cargado"}
                                    </p>
                                    {note ? <p className="text-white/55 italic line-clamp-3">{note}</p> : null}
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

      {comparisonOpen ? (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-5xl rounded-xl border border-white/15 bg-slate-900 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Comparador de semanas</h3>
              <button className="text-white/70 hover:text-white" onClick={() => setComparisonOpen(false)}>
                Cerrar
              </button>
            </div>
            <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-white/80">
              <label className="flex items-center gap-2">
                Semana A
                <select
                  value={compareWeekA ?? ""}
                  onChange={(e) => setCompareWeekA(Number(e.target.value))}
                  className="rounded border border-white/20 bg-slate-800 px-2 py-1"
                >
                  {weekIndexes.map((w) => (
                    <option key={`a-${w}`} value={w}>
                      Semana {w + 1}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2">
                Semana B
                <select
                  value={compareWeekB ?? ""}
                  onChange={(e) => setCompareWeekB(Number(e.target.value))}
                  className="rounded border border-white/20 bg-slate-800 px-2 py-1"
                >
                  {weekIndexes.map((w) => (
                    <option key={`b-${w}`} value={w}>
                      Semana {w + 1}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-[11px]">
                <thead>
                  <tr className="border-b border-white/10 text-white/60">
                    <th className="py-2 pr-2 text-left">Ejercicio</th>
                    <th className="py-2 px-2 text-left">Semana A</th>
                    <th className="py-2 px-2 text-left">Semana B</th>
                    <th className="py-2 pl-2 text-left">Evolución</th>
                  </tr>
                </thead>
                <tbody>
                  {exercises.map((ex, exIdx) => {
                    const getLastLog = (week: number | null): IntakeWorkoutExerciseLog | null => {
                      if (week == null) return null;
                      const sess = openWeekSessions(week)[0];
                      return sess?.exercises.find((e) => e.exerciseIndex === exIdx) ?? null;
                    };
                    const aLog = getLastLog(compareWeekA);
                    const bLog = getLastLog(compareWeekB);
                    const aMax = aLog ? Math.max(...aLog.sets.map((s) => (typeof s.kg === "number" ? s.kg : 0))) : null;
                    const bMax = bLog ? Math.max(...bLog.sets.map((s) => (typeof s.kg === "number" ? s.kg : 0))) : null;
                    const delta = aMax != null && bMax != null ? bMax - aMax : null;
                    return (
                      <tr key={`cmp-${exIdx}`} className="border-b border-white/5 align-top">
                        <td className="py-2 pr-2 text-white/90">{ex.name}</td>
                        <td className="py-2 px-2 text-white/75">{aLog ? formatKgLine(aLog.sets) : "—"}</td>
                        <td className="py-2 px-2 text-white/75">{bLog ? formatKgLine(bLog.sets) : "—"}</td>
                        <td className="py-2 pl-2">
                          {delta == null ? (
                            <span className="text-white/40">Sin datos suficientes</span>
                          ) : delta > 0 ? (
                            <span className="text-success">Subiste +{delta.toFixed(2)} kg máx.</span>
                          ) : delta < 0 ? (
                            <span className="text-warning">Bajaste {delta.toFixed(2)} kg máx.</span>
                          ) : (
                            <span className="text-white/60">Sin cambio de carga máxima</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
