import type { NextApiRequest, NextApiResponse } from "next";
import { getAdminDb } from "@/lib/firebase-admin";
import { sendTelegramMessage } from "@/lib/telegram";
import { getTopicPerformance } from "@/lib/socialContent/performanceInsights";
import { topicLabel } from "@/lib/socialContent/topics";
import { fetchAllGithubIssues } from "@/lib/githubIssues";
import { escapeHtml } from "@/lib/email/html";

/**
 * Corre los lunes. Un único mensaje semanal consolidado por Telegram, con
 * las decisiones que necesitan a Lucas arriba de todo y el resto como
 * contexto — el objetivo es que abrir Telegram el lunes reemplace abrir
 * cuatro pestañas distintas (GitHub, admin de contenido, admin de usuarios,
 * bandeja de mensajes).
 *
 * Cada sección se resuelve de forma independiente y con su propio
 * try/catch: si una falla (por ejemplo, GitHub no configurado, o una
 * colección de Firestore con un error puntual), el resto del dígest se
 * arma igual — mismo criterio de resiliencia que los demás crons del repo.
 */

const WINDOW_DAYS = 7;
const SMALL_SAMPLE_THRESHOLD = 10;
const MIN_TOPIC_SAMPLES_FOR_SUMMARY = 2;

function isAuthorized(req: NextApiRequest): boolean {
  if (req.headers["x-vercel-cron"] === "1") return true;
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return (req.headers.authorization || "") === `Bearer ${secret}`;
}

function toMillis(value: unknown): number | null {
  if (!value) return null;
  if (typeof value === "object") {
    if ("toMillis" in value && typeof (value as { toMillis: () => number }).toMillis === "function") {
      return (value as { toMillis: () => number }).toMillis();
    }
    if ("seconds" in value && typeof (value as { seconds: number }).seconds === "number") {
      const ts = value as { seconds: number; nanoseconds?: number };
      return ts.seconds * 1000 + Math.floor((ts.nanoseconds || 0) / 1000000);
    }
  }
  return null;
}

/** Anota "(muestra chica)" cuando el conteo no alcanza para sacar conclusiones. */
function withSampleNote(count: number): string {
  return count < SMALL_SAMPLE_THRESHOLD ? `${count} (muestra chica, no saques conclusiones todavía)` : `${count}`;
}

type SectionResult = { lines: string[]; error?: string };

/**
 * DECISIONES PENDIENTES: issues de GitHub abiertos con label `vertical:nuevo`
 * o `prioridad:alta`.
 *
 * Usa `fetchAllGithubIssues` (src/lib/githubIssues.ts) — el mismo fetch
 * paginado que alimenta el panel de backlog en
 * `src/pages/api/admin/githubIssues.ts` — y filtra localmente. Requiere
 * `GITHUB_TOKEN` (fine-grained, permiso de lectura de Issues) y
 * `GITHUB_REPO` ("owner/repo") en las env vars de Vercel. Sin esas dos
 * variables, esta sección se omite de forma explícita (se avisa en el
 * mensaje, no se inventa contenido) — pedirle a Lucas que genere el token
 * es lo único que falta para activarla.
 */
async function buildDecisionsSection(): Promise<SectionResult> {
  try {
    const result = await fetchAllGithubIssues();

    if (!result.configured) {
      return {
        lines: ["🗳️ <b>Decisiones pendientes</b>", `Sin datos: ${result.reason}`],
      };
    }

    if (result.rateLimited) {
      return {
        lines: ["🗳️ <b>Decisiones pendientes</b>", "⚠️ GitHub devolvió rate limit esta semana, no se pudo consultar."],
        error: "decisions: github rate limited",
      };
    }

    const relevantLabels = new Set(["vertical:nuevo", "prioridad:alta"]);
    const issues = result.issues.filter(
      (issue) => issue.state === "open" && issue.labels.some((label) => relevantLabels.has(label))
    );

    if (issues.length === 0) {
      return { lines: ["🗳️ <b>Decisiones pendientes</b>", "Sin issues abiertos con label vertical:nuevo o prioridad:alta."] };
    }

    return {
      lines: [
        `🗳️ <b>Decisiones pendientes (${issues.length})</b>`,
        ...issues.map(
          (issue) => `• #${issue.number} ${escapeHtml(issue.title)} [${escapeHtml(issue.labels.join(", "))}]\n${issue.url}`
        ),
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      lines: ["🗳️ <b>Decisiones pendientes</b>", "⚠️ No se pudo consultar GitHub esta semana."],
      error: `decisions: ${message}`,
    };
  }
}

/**
 * CONTENIDO: piezas publicadas esta semana (`socialContent`) + resumen de
 * rendimiento. Reusa `getTopicPerformance` de performanceInsights.ts a
 * propósito — el scoring/ponderación de piezas vive ahí y sólo ahí.
 */
async function buildContentSection(db: FirebaseFirestore.Firestore): Promise<SectionResult> {
  try {
    const since = Date.now() - WINDOW_DAYS * 86400000;
    const snap = await db.collection("socialContent").orderBy("createdAt", "desc").limit(200).get();

    let publishedThisWeek = 0;
    for (const doc of snap.docs) {
      const data = doc.data();
      if (data.status !== "published") continue;
      const publishedAtMs = toMillis(data.publishedAt) ?? toMillis(data.createdAt);
      if (publishedAtMs !== null && publishedAtMs < since) continue;
      publishedThisWeek++;
    }

    if (publishedThisWeek === 0) {
      return { lines: ["📱 <b>Contenido</b>", "Sin datos esta semana: no se publicó ninguna pieza."] };
    }

    const performance = await getTopicPerformance(db);
    const withEnoughData = Object.entries(performance).filter(
      ([, stats]) => stats.sampleSize >= MIN_TOPIC_SAMPLES_FOR_SUMMARY
    );

    const lines = [`📱 <b>Contenido</b>`, `${publishedThisWeek} pieza(s) publicada(s) esta semana.`];
    if (withEnoughData.length === 0) {
      lines.push("Todavía no hay suficientes piezas medidas por tema para sacar conclusiones de rendimiento.");
    } else {
      const sorted = [...withEnoughData].sort((a, b) => b[1].avgScore - a[1].avgScore);
      const best = sorted[0];
      const worst = sorted[sorted.length - 1];
      lines.push(
        `Mejor rindiendo: ${escapeHtml(topicLabel(best[0]))} (score ${best[1].avgScore.toFixed(2)}, ${best[1].sampleSize} piezas medidas).`
      );
      if (worst[0] !== best[0]) {
        lines.push(
          `Peor rindiendo: ${escapeHtml(topicLabel(worst[0]))} (score ${worst[1].avgScore.toFixed(2)}, ${worst[1].sampleSize} piezas medidas).`
        );
      }
    }
    return { lines };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { lines: ["📱 <b>Contenido</b>", "⚠️ No se pudo leer el contenido de esta semana."], error: `content: ${message}` };
  }
}

/**
 * EMBUDO: altas nuevas, planes generados y pagos con datos reales de
 * Firestore. Cada número trae su tamaño de muestra explícito.
 *
 * "Usuarios que entrenaron" queda deliberadamente afuera: no existe una
 * colección `workoutSessions` para la base general de usuarios (solo
 * `trackedFoods` de comida dentro de `planes`). La única fuente real de
 * sesiones de entrenamiento en Firestore hoy es `intakeClients/{id}/
 * workoutSessions`, que es la cohorte de clientes de coaching 1:1 — una
 * población distinta y mucho más chica. Mezclarla en este embudo general
 * sería inventar una comparación que no existe.
 *
 * TODO(producto): si se quiere medir adherencia de entrenamiento para la
 * base general de usuarios, hace falta decidir y crear una fuente de datos
 * para eso (cambio de esquema — no se resuelve acá sin luz verde de Lucas).
 */
async function buildFunnelSection(db: FirebaseFirestore.Firestore): Promise<SectionResult> {
  const lines = ["📈 <b>Embudo</b>"];
  const errors: string[] = [];
  const since = Date.now() - WINDOW_DAYS * 86400000;

  try {
    const usersSnap = await db.collection("usuarios").orderBy("createdAt", "desc").limit(500).get();
    const newUsers = usersSnap.docs.filter((doc) => {
      const ms = toMillis(doc.data().createdAt);
      return ms !== null && ms >= since;
    }).length;
    lines.push(`Altas nuevas: ${withSampleNote(newUsers)}.`);
  } catch (error) {
    errors.push(`usuarios: ${error instanceof Error ? error.message : String(error)}`);
    lines.push("Altas nuevas: ⚠️ no se pudo leer.");
  }

  try {
    const plansSnap = await db.collection("planes").orderBy("createdAt", "desc").limit(500).get();
    const newPlans = plansSnap.docs.filter((doc) => {
      const ms = toMillis(doc.data().createdAt);
      return ms !== null && ms >= since;
    }).length;
    lines.push(`Planes generados: ${withSampleNote(newPlans)}.`);
  } catch (error) {
    errors.push(`planes: ${error instanceof Error ? error.message : String(error)}`);
    lines.push("Planes generados: ⚠️ no se pudo leer.");
  }

  lines.push(
    "Usuarios que entrenaron: sin dato (no hay tracking de sesiones para la base general de usuarios — solo existe para clientes de coaching, que es otra cohorte; ver TODO en el código)."
  );

  try {
    const paymentsSnap = await db.collection("pagos").orderBy("date", "desc").limit(500).get();
    const weekPayments = paymentsSnap.docs.filter((doc) => {
      const data = doc.data();
      const ms = toMillis(data.date);
      return data.status === "approved" && ms !== null && ms >= since;
    });
    const totalsByCurrency = new Map<string, number>();
    for (const doc of weekPayments) {
      const data = doc.data();
      const currency = typeof data.currency === "string" ? data.currency : "ARS";
      const amount = typeof data.amount === "number" ? data.amount : 0;
      totalsByCurrency.set(currency, (totalsByCurrency.get(currency) || 0) + amount);
    }
    const totalsLine = Array.from(totalsByCurrency.entries())
      .map(([currency, total]) => `${total.toLocaleString("es-AR")} ${currency}`)
      .join(" + ");
    lines.push(
      `Pagos aprobados: ${withSampleNote(weekPayments.length)}${totalsLine ? ` (${totalsLine})` : ""}.`
    );
  } catch (error) {
    errors.push(`pagos: ${error instanceof Error ? error.message : String(error)}`);
    lines.push("Pagos aprobados: ⚠️ no se pudo leer.");
  }

  return { lines, error: errors.length > 0 ? errors.join(" | ") : undefined };
}

/** SOPORTE: cuántos mensajes entraron esta semana y cuántos quedan sin responder. */
async function buildSupportSection(db: FirebaseFirestore.Firestore): Promise<SectionResult> {
  try {
    const since = Date.now() - WINDOW_DAYS * 86400000;
    const snap = await db.collection("mensajes").orderBy("createdAt", "desc").limit(500).get();

    let enteredThisWeek = 0;
    let unanswered = 0;
    for (const doc of snap.docs) {
      const data = doc.data();
      const ms = toMillis(data.createdAt);
      if (ms !== null && ms >= since) enteredThisWeek++;
      if (data.replied !== true) unanswered++;
    }

    return {
      lines: [
        "💬 <b>Soporte</b>",
        `Mensajes entrantes esta semana: ${withSampleNote(enteredThisWeek)}.`,
        `Sin responder (backlog actual, sobre los últimos ${snap.docs.length} mensajes): ${withSampleNote(unanswered)}.`,
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { lines: ["💬 <b>Soporte</b>", "⚠️ No se pudo leer la bandeja de mensajes."], error: `support: ${message}` };
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  if (!isAuthorized(req)) return res.status(401).json({ error: "Unauthorized" });

  const db = getAdminDb();
  if (!db) return res.status(500).json({ error: "Firebase Admin SDK no configurado" });

  const sectionErrors: string[] = [];

  try {
    const [decisions, content, funnel, support] = await Promise.all([
      buildDecisionsSection(),
      buildContentSection(db),
      buildFunnelSection(db),
      buildSupportSection(db),
    ]);

    for (const section of [decisions, content, funnel, support]) {
      if (section.error) sectionErrors.push(section.error);
    }

    const message = [
      "🗓️ <b>Resumen semanal FitPlan</b>",
      "",
      ...decisions.lines,
      "",
      ...content.lines,
      "",
      ...funnel.lines,
      "",
      ...support.lines,
    ].join("\n");

    const telegramOk = await sendTelegramMessage(message).catch((err) => {
      console.warn("⚠️ No se pudo enviar el resumen semanal a Telegram:", err);
      return false;
    });

    // El único propósito de este cron es avisarle a Lucas: si el envío a
    // Telegram falla, un 200 dejaría el fallo invisible (el dígest se armó
    // pero nadie se entera). Se refleja en el status HTTP para que quede
    // marcado como fallido en el panel de crons de Vercel, sin perder el
    // trabajo de armado del dígest ya hecho.
    if (!telegramOk) {
      return res.status(502).json({
        ok: false,
        error: "No se pudo enviar el resumen semanal a Telegram",
        sectionErrors,
      });
    }

    return res.status(200).json({ ok: true, sectionErrors });
  } catch (error) {
    console.error("Error armando el resumen semanal:", error);
    const message = error instanceof Error ? error.message : String(error);
    await sendTelegramMessage(`❌ Falló el resumen semanal: ${message}`).catch(() => {});
    return res.status(500).json({ error: "No se pudo armar el resumen semanal", detail: message });
  }
}
