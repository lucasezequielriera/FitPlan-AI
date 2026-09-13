import type { NextApiRequest, NextApiResponse } from "next";
import nodemailer from "nodemailer";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import type { IntakeWorkoutSession } from "@/types/intakeWorkoutLog";
import { EMAIL, META_ESQUEMA_COLOR } from "@/lib/email/palette";

function isAuthorized(req: NextApiRequest): boolean {
  const cronHeader = req.headers["x-vercel-cron"];
  if (cronHeader === "1") return true;
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.authorization === `Bearer ${secret}`;
}

function getWeekKey(date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function toDateOnly(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function toMillis(value: unknown): number | null {
  if (!value) return null;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "string") {
    const t = Date.parse(value);
    return Number.isFinite(t) ? t : null;
  }
  if (typeof value === "object") {
    if ("toDate" in value && typeof (value as { toDate: () => Date }).toDate === "function") {
      return (value as { toDate: () => Date }).toDate().getTime();
    }
    if ("seconds" in value && typeof (value as { seconds: number }).seconds === "number") {
      const ts = value as { seconds: number; nanoseconds?: number };
      return ts.seconds * 1000 + Math.floor((ts.nanoseconds || 0) / 1000000);
    }
  }
  return null;
}

function minDaysByFrequency(freq: unknown): number {
  if (freq === "monthly") return 30;
  if (freq === "biweekly") return 14;
  return 7;
}

function parseYmd(value: unknown): Date | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00.000Z`);
  return isNaN(d.getTime()) ? null : d;
}

function parseSession(raw: Record<string, unknown>): IntakeWorkoutSession | null {
  if (typeof raw.planId !== "string" || typeof raw.completedOn !== "string") return null;
  return {
    id: typeof raw.id === "string" ? raw.id : "",
    planId: raw.planId,
    weekIndex: typeof raw.weekIndex === "number" ? raw.weekIndex : 0,
    dayIndex: typeof raw.dayIndex === "number" ? raw.dayIndex : 0,
    dayLabel: typeof raw.dayLabel === "string" ? raw.dayLabel : "Día",
    completedOn: raw.completedOn,
    exercises: Array.isArray(raw.exercises) ? (raw.exercises as IntakeWorkoutSession["exercises"]) : [],
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : null,
  };
}

function sessionScore(session: IntakeWorkoutSession): number {
  let score = 0;
  session.exercises.forEach((ex) => {
    ex.sets.forEach((s) => {
      if (typeof s.kg === "number" && s.kg > 0) score += 1;
      if (typeof s.rir === "number") score += 0.5;
    });
  });
  return score;
}

function computeSuggestion(sessions7d: IntakeWorkoutSession[], sessionsPrev7d: IntakeWorkoutSession[]): string {
  if (sessions7d.length === 0) {
    return "Esta semana no hubo sesiones registradas. Volvé con una sesión corta y consistente para retomar ritmo.";
  }
  const score7 = sessions7d.reduce((a, s) => a + sessionScore(s), 0);
  const scorePrev = sessionsPrev7d.reduce((a, s) => a + sessionScore(s), 0);
  const rirVals: number[] = [];
  sessions7d.forEach((s) =>
    s.exercises.forEach((ex) => ex.sets.forEach((set) => {
      if (typeof set.rir === "number") rirVals.push(set.rir);
    }))
  );
  const avgRir = rirVals.length ? rirVals.reduce((a, b) => a + b, 0) / rirVals.length : null;
  if (avgRir != null && avgRir >= 2 && score7 <= scorePrev + 1) {
    return "Hay margen de progreso: mantén técnica y prueba subir ligeramente la carga (+2 a +2.5kg) en los básicos.";
  }
  if (avgRir != null && avgRir <= 1) {
    return "Semana intensa. Priorizá recuperación (sueño/hidratación) y mantén cargas antes de volver a subir.";
  }
  return "Buen ritmo. Sostené la constancia y busca una mejora pequeña en 1-2 ejercicios clave la próxima semana.";
}

type AdherenceRisk = {
  level: "medium" | "high";
  score: number;
  reason: string;
  sessions7d: number;
  sessionsPrev7d: number;
};

function computeAdherenceRisk(
  sessions7d: IntakeWorkoutSession[],
  sessionsPrev7d: IntakeWorkoutSession[]
): AdherenceRisk | null {
  const currentSessions = sessions7d.length;
  const prevSessions = sessionsPrev7d.length;
  const currentLoad = sessions7d.reduce((acc, s) => acc + sessionScore(s), 0);
  const prevLoad = sessionsPrev7d.reduce((acc, s) => acc + sessionScore(s), 0);

  const sessionsComponent = Math.min(currentSessions / 3, 1) * 60;
  const loadBaseline = Math.max(prevLoad, 1);
  const loadRatio = Math.max(0, Math.min(currentLoad / loadBaseline, 1.15));
  const loadComponent = Math.min(loadRatio / 1.15, 1) * 25;
  const consistencyComponent = currentSessions >= prevSessions ? 15 : Math.max(0, 15 - (prevSessions - currentSessions) * 7);
  const score = Math.max(0, Math.min(100, Math.round(sessionsComponent + loadComponent + consistencyComponent)));

  if (currentSessions === 0) {
    return {
      level: "high",
      score,
      reason: "Sin entrenamientos registrados en los últimos 7 días.",
      sessions7d: currentSessions,
      sessionsPrev7d: prevSessions,
    };
  }
  if (prevSessions >= 2 && currentSessions <= 1 && prevSessions - currentSessions >= 2) {
    return {
      level: "high",
      score,
      reason: `Caída fuerte de adherencia (${prevSessions} → ${currentSessions} sesiones).`,
      sessions7d: currentSessions,
      sessionsPrev7d: prevSessions,
    };
  }
  if (score < 45) {
    return {
      level: "high",
      score,
      reason: "Score de adherencia semanal muy bajo.",
      sessions7d: currentSessions,
      sessionsPrev7d: prevSessions,
    };
  }
  if (score < 65) {
    return {
      level: "medium",
      score,
      reason: "Riesgo moderado de baja adherencia semanal.",
      sessions7d: currentSessions,
      sessionsPrev7d: prevSessions,
    };
  }
  return null;
}

function buildMailHtml(params: {
  clientName: string;
  weekKey: string;
  sessions7d: IntakeWorkoutSession[];
  totalSessions: number;
  suggestion: string;
  motivational: string;
}) {
  const list = params.sessions7d
    .map((s) => `<li><strong>${s.completedOn}</strong> · ${s.dayLabel} · ${s.exercises.length} ejercicios</li>`)
    .join("");
  return `
  ${META_ESQUEMA_COLOR}
  <div style="background:${EMAIL.fondo};color:${EMAIL.texto};padding:24px;font-family:Arial,sans-serif">
    <h2 style="margin:0 0 8px;color:${EMAIL.acento}">Resumen semanal FitPlan</h2>
    <p style="margin:0 0 16px;color:${EMAIL.textoSuave}">Semana ${params.weekKey} · Hola ${params.clientName}</p>
    <div style="background:${EMAIL.caja};border:1px solid ${EMAIL.borde};border-radius:12px;padding:16px;margin-bottom:14px">
      <p style="margin:0 0 6px"><strong>Sesiones esta semana:</strong> ${params.sessions7d.length}</p>
      <p style="margin:0"><strong>Sesiones acumuladas:</strong> ${params.totalSessions}</p>
    </div>
    <div style="background:${EMAIL.caja};border:1px solid ${EMAIL.borde};border-radius:12px;padding:16px;margin-bottom:14px">
      <p style="margin:0 0 8px"><strong>Tu progreso reciente</strong></p>
      <ul style="margin:0;padding-left:18px">${list || "<li>Sin sesiones registradas esta semana.</li>"}</ul>
    </div>
    <div style="background:${EMAIL.caja};border:1px solid ${EMAIL.info};border-radius:12px;padding:16px;margin-bottom:14px">
      <p style="margin:0 0 6px"><strong>Recomendación de la semana</strong></p>
      <p style="margin:0">${params.suggestion}</p>
    </div>
    <p style="margin:16px 0 0;color:${EMAIL.textoSuave}">${params.motivational}</p>
  </div>`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  if (!isAuthorized(req)) return res.status(401).json({ error: "Unauthorized" });

  const smtpHost = process.env.INTAKE_SMTP_HOST;
  const smtpPort = Number(process.env.INTAKE_SMTP_PORT || "587");
  const smtpUser = process.env.INTAKE_SMTP_USER;
  const smtpPass = process.env.INTAKE_SMTP_PASS;
  const from = process.env.INTAKE_FROM_EMAIL || smtpUser;
  if (!smtpHost || !smtpUser || !smtpPass || !from) {
    return res.status(500).json({ error: "SMTP no configurado" });
  }

  const db = getAdminDb();
  if (!db) return res.status(500).json({ error: "Firebase Admin SDK no configurado" });

  const weekKey = getWeekKey();
  const coachName = (process.env.WEEKLY_COACH_NAME || "tu coach").trim();
  const motivationalTpl =
    process.env.WEEKLY_MOTIVATIONAL_TEMPLATE ||
    "Estoy orgulloso de tu constancia. Lo que estás construyendo no es solo físico, es disciplina real. Seguimos juntos. — {coach}";
  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: { user: smtpUser, pass: smtpPass },
  });

  const now = new Date();
  const day7 = new Date(now.getTime() - 7 * 86400000);
  const day14 = new Date(now.getTime() - 14 * 86400000);
  const lower7 = toDateOnly(day7);
  const lower14 = toDateOnly(day14);

  const clientsSnap = await db.collection("intakeClients").limit(250).get();
  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const doc of clientsSnap.docs) {
    const data = doc.data() || {};
    const email = typeof data.email === "string" ? data.email.trim() : "";
    const latestPlanId = typeof data.latestPlanId === "string" ? data.latestPlanId : "";
    const digestEnabled = data.digestEmailEnabled !== false;
    if (!email || !latestPlanId || !digestEnabled) {
      skipped += 1;
      continue;
    }
    if (data.weeklyDigestSentWeekKey === weekKey) {
      skipped += 1;
      continue;
    }
    const lastSentMs = toMillis(data.weeklyDigestSentAt);
    const minDays = minDaysByFrequency(data.digestFrequency);
    const digestStartDate = parseYmd(data.digestStartDate);
    if (digestStartDate && Date.now() < digestStartDate.getTime()) {
      skipped += 1;
      continue;
    }
    if (lastSentMs != null) {
      const elapsedDays = (Date.now() - lastSentMs) / 86400000;
      if (elapsedDays < minDays) {
        skipped += 1;
        continue;
      }
    }

    try {
      const sessionsSnap = await doc.ref.collection("workoutSessions").limit(80).get();
      const sessions = sessionsSnap.docs
        .map((s) => parseSession({ id: s.id, ...(s.data() as Record<string, unknown>) }))
        .filter((s): s is IntakeWorkoutSession => Boolean(s))
        .filter((s) => s.planId === latestPlanId)
        .sort((a, b) => b.completedOn.localeCompare(a.completedOn));
      const sessions7d = sessions.filter((s) => s.completedOn >= lower7);
      const sessionsPrev7d = sessions.filter((s) => s.completedOn < lower7 && s.completedOn >= lower14);
      const suggestion = computeSuggestion(sessions7d, sessionsPrev7d);
      const adherenceRisk = computeAdherenceRisk(sessions7d, sessionsPrev7d);
      const clientName =
        typeof data.nombreCompleto === "string" && data.nombreCompleto.trim()
          ? data.nombreCompleto.trim().split(" ")[0]
          : "campeón";
      const motivational = motivationalTpl
        .replaceAll("{name}", clientName)
        .replaceAll("{coach}", coachName);
      const html = buildMailHtml({
        clientName,
        weekKey,
        sessions7d,
        totalSessions: sessions.length,
        suggestion,
        motivational,
      });
      await transporter.sendMail({
        from: `FitPlan <${from}>`,
        to: email,
        subject: `Tu resumen semanal FitPlan · ${weekKey}`,
        html,
        text: `Hola ${clientName}.\n\nSesiones semana: ${sessions7d.length}\nSesiones acumuladas: ${sessions.length}\n\nRecomendación:\n${suggestion}\n\n${motivational}`,
      });
      await doc.ref.collection("emailHistory").add({
        kind: "weekly_digest",
        weekKey,
        frequency: typeof data.digestFrequency === "string" ? data.digestFrequency : "weekly",
        status: "sent",
        to: email,
        subject: `Tu resumen semanal FitPlan · ${weekKey}`,
        html,
        text: `Hola ${clientName}.\n\nSesiones semana: ${sessions7d.length}\nSesiones acumuladas: ${sessions.length}\n\nRecomendación:\n${suggestion}\n\n${motivational}`,
        createdAt: FieldValue.serverTimestamp(),
      });
      await doc.ref.collection("engagementEvents").add({
        kind: "digest_email",
        status: "sent",
        source: "auto",
        weekKey,
        frequency: typeof data.digestFrequency === "string" ? data.digestFrequency : "weekly",
        createdAt: FieldValue.serverTimestamp(),
        actorType: "system",
        actorId: "cron:intakeWeeklyDigest",
      });
      await db.collection("adminNotifications").add({
        type: "weekly_digest_sent",
        read: false,
        userId: doc.id,
        userName: typeof data.nombreCompleto === "string" ? data.nombreCompleto : null,
        userEmail: email,
        provider: "email",
        message: `Resumen semanal enviado (${weekKey})`,
        createdAt: FieldValue.serverTimestamp(),
      });
      if (adherenceRisk) {
        const riskDocId = `adherence-risk-${doc.id}-${weekKey}`;
        await db.collection("adminNotifications").doc(riskDocId).set(
          {
            type: "adherence_risk_weekly",
            read: false,
            userId: doc.id,
            userName: typeof data.nombreCompleto === "string" ? data.nombreCompleto : null,
            userEmail: email,
            provider: "fitplan-risk",
            message: `Riesgo ${adherenceRisk.level === "high" ? "alto" : "moderado"} · Score ${adherenceRisk.score}/100 · ${adherenceRisk.reason}`,
            payload: {
              weekKey,
              level: adherenceRisk.level,
              score: adherenceRisk.score,
              sessions7d: adherenceRisk.sessions7d,
              sessionsPrev7d: adherenceRisk.sessionsPrev7d,
            },
            createdAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      }
      await doc.ref.set(
        {
          weeklyDigestSentWeekKey: weekKey,
          weeklyDigestSentAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      sent += 1;
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      await doc.ref.collection("emailHistory").add({
        kind: "weekly_digest",
        weekKey,
        frequency: typeof data.digestFrequency === "string" ? data.digestFrequency : "weekly",
        status: "failed",
        to: email || null,
        subject: `Tu resumen semanal FitPlan · ${weekKey}`,
        error: errMsg,
        createdAt: FieldValue.serverTimestamp(),
      });
      await doc.ref.collection("engagementEvents").add({
        kind: "digest_email",
        status: "failed",
        source: "auto",
        weekKey,
        frequency: typeof data.digestFrequency === "string" ? data.digestFrequency : "weekly",
        error: errMsg,
        createdAt: FieldValue.serverTimestamp(),
        actorType: "system",
        actorId: "cron:intakeWeeklyDigest",
      });
      await db.collection("adminNotifications").add({
        type: "weekly_digest_failed",
        read: false,
        userId: doc.id,
        userName: typeof data.nombreCompleto === "string" ? data.nombreCompleto : null,
        userEmail: email || null,
        provider: "email",
        message: `Error enviando resumen semanal (${weekKey}): ${errMsg}`,
        createdAt: FieldValue.serverTimestamp(),
      });
      errors.push(`${doc.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return res.status(200).json({ ok: true, weekKey, sent, skipped, errors: errors.slice(0, 20) });
}

