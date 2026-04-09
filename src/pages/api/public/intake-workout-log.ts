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

/** RIR 0–4 (entero). */
function parseOptionalRir(n: unknown): number | null {
  if (n === null || n === undefined || n === "") return null;
  let v: number;
  if (typeof n === "number" && Number.isFinite(n)) v = Math.floor(n);
  else if (typeof n === "string") {
    const t = n.trim();
    if (!t) return null;
    const p = Number(t);
    if (!Number.isFinite(p)) return null;
    v = Math.floor(p);
  } else return null;
  if (v < 0 || v > 4) return null;
  return v;
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

function monthKeyFromYmd(ymd: string): string {
  return ymd.slice(0, 7);
}

function exerciseMaxKg(ex: SerializedExerciseLog): number {
  return Math.max(...ex.sets.map((s) => (typeof s.kg === "number" ? s.kg : 0)));
}

function avgRir(session: SerializedWorkoutSession): number | null {
  const vals: number[] = [];
  session.exercises.forEach((ex) =>
    ex.sets.forEach((s) => {
      if (typeof s.rir === "number") vals.push(s.rir);
    })
  );
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
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
    const noteRaw = o.note;
    if (noteRaw !== undefined && noteRaw !== null && typeof noteRaw !== "string") {
      return { error: "note inválido" };
    }
    const exerciseNote = typeof noteRaw === "string" ? noteRaw.slice(0, 2000).trim() || null : null;
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
      const rir = parseOptionalRir(so.rir);
      if (so.rir !== undefined && so.rir !== null && so.rir !== "" && rir === null) {
        return { error: "RIR debe ser un entero entre 0 y 4" };
      }
      sets.push({ kg, restAfterSec: rest, rir });
    }
    exercises.push({ exerciseIndex, exerciseName, sets, note: exerciseNote });
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

      try {
        const sessionsSnap = await auth.db
          .collection("intakeClients")
          .doc(clientId)
          .collection("workoutSessions")
          .where("planId", "==", parsed.planId)
          .where("dayIndex", "==", parsed.dayIndex)
          .get();
        const recent = sessionsSnap.docs
          .map(mapDocToSession)
          .sort((a, b) => b.completedOn.localeCompare(a.completedOn))
          .slice(0, 6);
        const clientName =
          typeof auth.intakeData.nombreCompleto === "string" && auth.intakeData.nombreCompleto.trim()
            ? auth.intakeData.nombreCompleto.trim()
            : "Cliente intake";
        const monthKey = monthKeyFromYmd(parsed.completedOn);

        // Fatiga alta sostenida: promedio RIR <= 1 en 2+ sesiones recientes.
        const highFatigueCount = recent
          .map((s) => avgRir(s))
          .filter((v): v is number => typeof v === "number" && v <= 1).length;
        if (highFatigueCount >= 2) {
          const alertId = `coach_fatigue_${clientId}_${parsed.planId}_${parsed.dayIndex}_${monthKey}`;
          await auth.db.collection("adminNotifications").doc(alertId).set(
            {
              type: "coach_alert",
              read: false,
              provider: "coach",
              userName: clientName,
              userEmail: auth.intakeData.email || null,
              amount: 0,
              currency: "N/A",
              message: `Fatiga alta sostenida en ${parsed.dayLabel}. Revisar volumen/intensidad.`,
              createdAt: FieldValue.serverTimestamp(),
              payload: { kind: "fatigue_high", clientId, planId: parsed.planId, dayIndex: parsed.dayIndex },
            },
            { merge: true }
          );
        }

        // Estancamiento: sin mejora de carga máxima en >=3 registros recientes y RIR medio >=2.
        const stalled = recent.some((session) => {
          const rir = avgRir(session);
          if (rir == null || rir < 2) return false;
          const exMap = new Map<number, number>();
          session.exercises.forEach((ex) => exMap.set(ex.exerciseIndex, exerciseMaxKg(ex)));
          return Array.from(exMap.values()).some((maxKg) => maxKg > 0);
        });
        const hasNoLoadIncrease =
          recent.length >= 3 &&
          (() => {
            const byExercise = new Map<number, number[]>();
            recent.forEach((s) => {
              s.exercises.forEach((ex) => {
                const arr = byExercise.get(ex.exerciseIndex) || [];
                arr.push(exerciseMaxKg(ex));
                byExercise.set(ex.exerciseIndex, arr);
              });
            });
            return Array.from(byExercise.values()).some((series) => {
              if (series.length < 3) return false;
              const latest3 = series.slice(0, 3);
              return latest3.every((v) => Math.abs(v - latest3[0]) < 0.01);
            });
          })();
        if (stalled && hasNoLoadIncrease) {
          const alertId = `coach_stall_${clientId}_${parsed.planId}_${parsed.dayIndex}_${monthKey}`;
          await auth.db.collection("adminNotifications").doc(alertId).set(
            {
              type: "coach_alert",
              read: false,
              provider: "coach",
              userName: clientName,
              userEmail: auth.intakeData.email || null,
              amount: 0,
              currency: "N/A",
              message: `Posible estancamiento en ${parsed.dayLabel}. Sugerir +carga/+reps.`,
              createdAt: FieldValue.serverTimestamp(),
              payload: { kind: "stagnation", clientId, planId: parsed.planId, dayIndex: parsed.dayIndex },
            },
            { merge: true }
          );
        }
      } catch (alertErr) {
        console.error("intake-workout-log alert side-effect:", alertErr);
      }

      return res.status(200).json({ session: out });
    } catch (e) {
      console.error("intake-workout-log POST:", e);
      return res.status(500).json({ error: "No se pudo guardar" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
