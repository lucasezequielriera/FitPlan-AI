import type { NextApiRequest, NextApiResponse } from "next";
import { getAdminDb } from "@/lib/firebase-admin";

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

function toDateOnly(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 86400000);
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const userId = req.query.userId as string | undefined;
  const clientId = req.query.clientId as string | undefined;

  if (!userId) {
    return res.status(401).json({ error: "No se proporcionó userId" });
  }
  if (!clientId) {
    return res.status(400).json({ error: "No se proporcionó clientId" });
  }

  try {
    const db = getAdminDb();
    if (!db) {
      return res.status(500).json({ error: "Firebase Admin SDK no configurado" });
    }

    const adminDoc = await db.collection("usuarios").doc(userId).get();
    const email = adminDoc.data()?.email?.toLowerCase() || "";
    if (!adminDoc.exists || email !== "admin@fitplan-ai.com") {
      return res.status(403).json({ error: "Solo administradores pueden acceder" });
    }

    const intakeDoc = await db.collection("intakeClients").doc(clientId).get();
    if (!intakeDoc.exists) {
      return res.status(404).json({ error: "Cliente no encontrado" });
    }

    const data = intakeDoc.data() || {};
    const formData =
      typeof data.formData === "object" && data.formData !== null
        ? (data.formData as Record<string, unknown>)
        : null;

    const latestPlanId = typeof data.latestPlanId === "string" ? data.latestPlanId : "";
    let adherence: {
      sessionsLast28d: number;
      sessionsLast56d: number;
      activeWeeksLast4: number;
      weeklyAvgLast4: number;
    } | null = null;
    let profileEdits: Array<{
      id: string;
      actorType: string | null;
      createdAt: string | null;
      after: Record<string, unknown> | null;
    }> = [];
    let engagementEvents: Array<{
      id: string;
      kind: string | null;
      status: string | null;
      source: string | null;
      createdAt: string | null;
      ymd: string | null;
      weightKg: number | null;
    }> = [];
    let wellnessRecent: Array<{ ymd: string; energia: number | null; sueno: number | null; dolor: number | null; estres: number | null }> = [];
    let weightSeries: Array<{ ymd: string; weightKg: number }> = [];
    let timelines: {
      day: Record<string, number>;
      week: Record<string, number>;
      month: Record<string, number>;
    } | null = null;
    try {
      const sessionsSnap = await intakeDoc.ref.collection("workoutSessions").limit(140).get();
      const sessions = sessionsSnap.docs
        .map((d) => d.data() as Record<string, unknown>)
        .filter((s) => typeof s.completedOn === "string" && (!latestPlanId || s.planId === latestPlanId));
      const today = new Date();
      const d28 = new Date(today.getTime() - 28 * 86400000);
      const d56 = new Date(today.getTime() - 56 * 86400000);
      const key28 = toDateOnly(d28);
      const key56 = toDateOnly(d56);
      const last28 = sessions.filter((s) => (s.completedOn as string) >= key28);
      const last56 = sessions.filter((s) => (s.completedOn as string) >= key56);
      const activeWeeks = new Set<string>(
        last28.map((s) => {
          const d = new Date(`${String(s.completedOn)}T00:00:00`);
          const day = d.getDay() || 7;
          d.setDate(d.getDate() + 4 - day);
          const y = d.getFullYear();
          const yStart = new Date(y, 0, 1);
          const week = Math.ceil((((d.getTime() - yStart.getTime()) / 86400000) + 1) / 7);
          return `${y}-W${String(week).padStart(2, "0")}`;
        })
      );
      adherence = {
        sessionsLast28d: last28.length,
        sessionsLast56d: last56.length,
        activeWeeksLast4: activeWeeks.size,
        weeklyAvgLast4: Number((last28.length / 4).toFixed(2)),
      };
    } catch {
      adherence = null;
    }
    try {
      const editsSnap = await intakeDoc.ref.collection("profileEdits").orderBy("createdAt", "desc").limit(8).get();
      profileEdits = editsSnap.docs.map((d) => {
        const ed = d.data() as Record<string, unknown>;
        return {
          id: d.id,
          actorType: typeof ed.actorType === "string" ? ed.actorType : null,
          createdAt: toISO(ed.createdAt),
          after: ed.after && typeof ed.after === "object" ? (ed.after as Record<string, unknown>) : null,
        };
      });
    } catch {
      profileEdits = [];
    }
    try {
      const [eventsSnap, wellnessSnap, weightSnap] = await Promise.all([
        intakeDoc.ref.collection("engagementEvents").orderBy("createdAt", "desc").limit(160).get(),
        intakeDoc.ref.collection("wellnessCheckins").orderBy("createdAt", "desc").limit(120).get(),
        intakeDoc.ref.collection("weightLogs").orderBy("createdAt", "desc").limit(120).get(),
      ]);
      engagementEvents = eventsSnap.docs.map((d) => {
        const row = d.data() as Record<string, unknown>;
        return {
          id: d.id,
          kind: typeof row.kind === "string" ? row.kind : null,
          status: typeof row.status === "string" ? row.status : null,
          source: typeof row.source === "string" ? row.source : null,
          createdAt: toISO(row.createdAt),
          ymd: typeof row.ymd === "string" ? row.ymd : null,
          weightKg: typeof row.weightKg === "number" ? row.weightKg : null,
        };
      });
      wellnessRecent = wellnessSnap.docs
        .map((d) => {
          const row = d.data() as Record<string, unknown>;
          return {
            ymd: typeof row.ymd === "string" ? row.ymd : d.id,
            energia: typeof row.energia === "number" ? row.energia : null,
            sueno: typeof row.sueno === "number" ? row.sueno : null,
            dolor: typeof row.dolor === "number" ? row.dolor : null,
            estres: typeof row.estres === "number" ? row.estres : null,
          };
        })
        .slice(0, 60);
      weightSeries = weightSnap.docs
        .map((d) => {
          const row = d.data() as Record<string, unknown>;
          const ymd = typeof row.ymd === "string" ? row.ymd : null;
          const weightKg = typeof row.weightKg === "number" ? row.weightKg : null;
          if (!ymd || weightKg == null) return null;
          return { ymd, weightKg };
        })
        .filter((x): x is { ymd: string; weightKg: number } => Boolean(x))
        .sort((a, b) => a.ymd.localeCompare(b.ymd))
        .slice(-60);

      const today = new Date();
      const weekStart = daysAgo(7);
      const monthStart = daysAgo(30);
      const weekKey = toDateOnly(weekStart);
      const monthKeyStart = toDateOnly(monthStart);
      const thisMonth = monthKey(today);

      const dayStats = {
        workouts: sessionsLastN(1),
        checkins: wellnessRecent.filter((w) => w.ymd >= toDateOnly(daysAgo(1))).length,
        weights: weightSeries.filter((w) => w.ymd >= toDateOnly(daysAgo(1))).length,
      };
      const weekStats = {
        workouts: sessionsLastN(7),
        checkins: wellnessRecent.filter((w) => w.ymd >= weekKey).length,
        weights: weightSeries.filter((w) => w.ymd >= weekKey).length,
        requests: engagementEvents.filter((e) => e.status === "requested" && (e.ymd || e.createdAt || "") >= weekKey).length,
        completed: engagementEvents.filter((e) => e.status === "completed" && (e.ymd || e.createdAt || "") >= weekKey).length,
      };
      const monthStats = {
        workouts: sessionsLastN(30),
        checkins: wellnessRecent.filter((w) => w.ymd >= monthKeyStart).length,
        weights: weightSeries.filter((w) => w.ymd >= monthKeyStart).length,
        requests: engagementEvents.filter((e) => e.status === "requested" && (e.ymd || e.createdAt || "") >= monthKeyStart).length,
        completed: engagementEvents.filter((e) => e.status === "completed" && (e.ymd || e.createdAt || "") >= monthKeyStart).length,
        digestSent: engagementEvents.filter(
          (e) => e.kind === "digest_email" && e.status === "sent" && (e.createdAt || "").slice(0, 7) === thisMonth
        ).length,
      };
      timelines = { day: dayStats, week: weekStats, month: monthStats };
    } catch {
      engagementEvents = [];
      wellnessRecent = [];
      weightSeries = [];
      timelines = null;
    }

    function sessionsLastN(days: number): number {
      const from = toDateOnly(daysAgo(days));
      return adherence
        ? (() => {
            // Recalcular leyendo sessions directas no está disponible aquí; usamos ventanas conocidas.
            if (days <= 28) return Math.round((adherence.sessionsLast28d / 28) * days);
            if (days <= 56) return Math.round((adherence.sessionsLast56d / 56) * days);
            return adherence.sessionsLast56d;
          })()
        : 0;
    }

    return res.status(200).json({
      client: {
        id: intakeDoc.id,
        nombreCompleto: (data.nombreCompleto as string) || null,
        email: (data.email as string) || null,
        whatsapp: (data.whatsapp as string) || null,
        instagram: (data.instagram as string) || null,
        objetivoPrincipal: (data.objetivoPrincipal as string) || null,
        status: (data.status as string) || "new",
        createdAt: toISO(data.createdAt),
        updatedAt: toISO(data.updatedAt),
        emailVerified: data.emailVerified === true,
        whatsappVerified: data.whatsappVerified === true,
        privacyConsentAccepted: data.privacyConsentAccepted === true,
        privacyConsentAt: toISO(data.privacyConsentAt),
        adherence,
        profileEdits,
        engagementEvents,
        wellnessRecent,
        weightSeries,
        timelines,
        formData,
      },
    });
  } catch (error) {
    console.error("Error obteniendo detalle de cliente del formulario:", error);
    return res.status(500).json({ error: "No se pudo obtener el detalle del cliente" });
  }
}
