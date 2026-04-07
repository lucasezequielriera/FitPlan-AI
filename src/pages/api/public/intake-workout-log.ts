import type { NextApiRequest, NextApiResponse } from "next";
import type { QueryDocumentSnapshot } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { assertIntakePublicToken } from "@/lib/intakePublicTokenServer";
import type { IntakeWorkoutExerciseLog, IntakeWorkoutSession, IntakeWorkoutSetLog } from "@/types/intakeWorkoutLog";

type SerializedSetLog = IntakeWorkoutSetLog;
type SerializedExerciseLog = IntakeWorkoutExerciseLog;
type SerializedWorkoutSession = IntakeWorkoutSession;

function sanitizeDocIdPart(s: string): string {
  return s.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 800);
}

function buildSessionDocId(planId: string, weekIndex: number, dayIndex: number, completedOn: string): string {
  return sanitizeDocIdPart(`${planId}_w${weekIndex}_d${dayIndex}_${completedOn}`);
}

function parsePositiveInt(n: unknown, max: number, fallback: number): number {
  if (typeof n === "number" && Number.isFinite(n)) return Math.max(0, Math.min(max, Math.floor(n)));
  return fallback;
}

function parseOptionalNumber(n: unknown): number | null {
  if (n === null || n === undefined || n === "") return null;
  if (typeof n === "number" && Number.isFinite(n)) return Math.round(n * 100) / 100;
  if (typeof n === "string") {
    const t = n.trim().replace(",", ".");
    if (!t) return null;
    const v = Number(t);
    if (Number.isFinite(v)) return Math.round(v * 100) / 100;
  }
  return null;
}

function toISO(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    if ("toDate" in value && typeof (value as { toDate: () => Date }).toDate === "function") {
      return (value as { toDate: () => Date }).toDate().toISOString();
    }
    if ("seconds" in value && typeof (value as { seconds: number }).seconds === "number") {
      const ts = value as { seconds: number; nanoseconds?: number };
      return new Date(ts.seconds * 1000 + (ts.nanoseconds || 0) / 1000000).toISOString();
    }
  }
  return null;
}

function mapDocToSession(d: QueryDocumentSnapshot): SerializedWorkoutSession {
  const data = d.data() || {};
  return {
    id: d.id,
    planId: typeof data.planId === "string" ? data.planId : "",
    weekIndex: typeof data.weekIndex === "number" ? data.weekIndex : 0,
    dayIndex: typeof data.dayIndex === "number" ? data.dayIndex : 0,
    dayLabel: typeof data.dayLabel === "string" ? data.dayLabel : "",
    completedOn: typeof data.completedOn === "string" ? data.completedOn : "",
    exercises: Array.isArray(data.exercises) ? (data.exercises as SerializedExerciseLog[]) : [],
    updatedAt: toISO(data.updatedAt),
  };
}

function validateSessionPayload(body: Record<string, unknown>): SerializedWorkoutSession | { error: string } {
  const planId = typeof body.planId === "string" ? body.planId.trim() : "";
  if (!planId) return { error: "Falta planId" };
  const weekIndex = parsePositiveInt(body.weekIndex, 52, -1);
  const dayIndex = parsePositiveInt(body.dayIndex, 14, -1);
  if (weekIndex < 0 || dayIndex < 0) return { error: "weekIndex o dayIndex inválidos" };
  const dayLabel = typeof body.dayLabel === "string" ? body.dayLabel.slice(0, 200) : "";
  const completedOn = typeof body.completedOn === "string" ? body.completedOn.trim() : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(completedOn)) return { error: "completedOn debe ser YYYY-MM-DD" };

  const rawEx = body.exercises;
  if (!Array.isArray(rawEx) || rawEx.length === 0 || rawEx.length > 40) return { error: "exercises inválido" };

  const exercises: SerializedExerciseLog[] = [];
  for (let i = 0; i < rawEx.length; i++) {
    const ex = rawEx[i];
    if (!ex || typeof ex !== "object") return { error: `Ejercicio ${i + 1} inválido` };
    const o = ex as Record<string, unknown>;
    const exerciseIndex = parsePositiveInt(o.exerciseIndex, 40, -1);
    if (exerciseIndex < 0) return { error: "exerciseIndex inválido" };
    const exerciseName = typeof o.exerciseName === "string" ? o.exerciseName.slice(0, 200) : "";
    if (!exerciseName) return { error: "Falta nombre de ejercicio" };
    const setsRaw = o.sets;
    if (!Array.isArray(setsRaw) || setsRaw.length === 0 || setsRaw.length > 25) {
      return { error: "sets inválido" };
    }
    const sets: SerializedSetLog[] = [];
    for (let j = 0; j < setsRaw.length; j++) {
      const s = setsRaw[j];
      if (!s || typeof s !== "object") return { error: "Serie inválida" };
      const so = s as Record<string, unknown>;
      const kg = parseOptionalNumber(so.kg);
      if (kg !== null && (kg < 0 || kg > 600)) return { error: "kg fuera de rango" };
      const rest = parseOptionalNumber(so.restAfterSec);
      if (rest !== null && (rest < 0 || rest > 3600)) return { error: "Descanso fuera de rango" };
      sets.push({ kg, restAfterSec: rest });
    }
    exercises.push({ exerciseIndex, exerciseName, sets });
  }

  return {
    id: buildSessionDocId(planId, weekIndex, dayIndex, completedOn),
    planId,
    weekIndex,
    dayIndex,
    dayLabel,
    completedOn,
    exercises,
    updatedAt: null,
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const clientId = typeof req.query.clientId === "string" ? req.query.clientId : "";
  const token = typeof req.query.t === "string" ? req.query.t : "";

  if (!clientId || !token) {
    return res.status(400).json({ error: "Faltan clientId o t (token)" });
  }

  const auth = await assertIntakePublicToken(clientId, token);
  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.error });
  }

  const latestPlanId = typeof auth.intakeData.latestPlanId === "string" ? auth.intakeData.latestPlanId : null;

  if (req.method === "GET") {
    const planIdFilter = typeof req.query.planId === "string" ? req.query.planId.trim() : "";
    try {
      const snap = await auth.db.collection("intakeClients").doc(clientId).collection("workoutSessions").get();
      let sessions: SerializedWorkoutSession[] = snap.docs.map(mapDocToSession);

      if (planIdFilter) {
        sessions = sessions.filter((s) => s.planId === planIdFilter);
      }
      sessions.sort((a, b) => {
        const ca = a.completedOn || "";
        const cb = b.completedOn || "";
        if (ca !== cb) return cb.localeCompare(ca);
        return b.weekIndex - a.weekIndex;
      });

      return res.status(200).json({
        latestPlanId,
        sessions: sessions.slice(0, 400),
      });
    } catch (e) {
      console.error("intake-workout-log GET:", e);
      return res.status(500).json({ error: "No se pudo cargar el registro" });
    }
  }

  if (req.method === "POST") {
    const body =
      req.body && typeof req.body === "object" && !Array.isArray(req.body)
        ? (req.body as Record<string, unknown>)
        : {};
    const parsed = validateSessionPayload(body);
    if ("error" in parsed) {
      return res.status(400).json({ error: parsed.error });
    }

    if (latestPlanId && parsed.planId !== latestPlanId) {
      return res.status(409).json({ error: "El plan cambió. Recarga la página para registrar con el plan actual." });
    }

    const ref = auth.db.collection("intakeClients").doc(clientId).collection("workoutSessions").doc(parsed.id);
    try {
      await ref.set(
        {
          planId: parsed.planId,
          weekIndex: parsed.weekIndex,
          dayIndex: parsed.dayIndex,
          dayLabel: parsed.dayLabel,
          completedOn: parsed.completedOn,
          exercises: parsed.exercises,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      const saved = await ref.get();
      const data = saved.data() || {};
      const out: SerializedWorkoutSession = {
        id: saved.id,
        planId: typeof data.planId === "string" ? data.planId : parsed.planId,
        weekIndex: typeof data.weekIndex === "number" ? data.weekIndex : parsed.weekIndex,
        dayIndex: typeof data.dayIndex === "number" ? data.dayIndex : parsed.dayIndex,
        dayLabel: typeof data.dayLabel === "string" ? data.dayLabel : parsed.dayLabel,
        completedOn: typeof data.completedOn === "string" ? data.completedOn : parsed.completedOn,
        exercises: Array.isArray(data.exercises) ? (data.exercises as SerializedExerciseLog[]) : parsed.exercises,
        updatedAt: toISO(data.updatedAt),
      };
      return res.status(200).json({ session: out });
    } catch (e) {
      console.error("intake-workout-log POST:", e);
      return res.status(500).json({ error: "No se pudo guardar" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
