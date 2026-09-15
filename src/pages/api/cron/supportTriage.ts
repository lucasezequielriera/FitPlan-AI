import type { NextApiRequest, NextApiResponse } from "next";
import { getAdminDb } from "@/lib/firebase-admin";
import { sendTelegramMessage } from "@/lib/telegram";
import { escapeHtml } from "@/lib/email/html";

/**
 * Corre una vez al día. Objetivo: que Lucas no tenga que abrir el panel de
 * mensajes todos los días — solo se entera cuando hay algo que de verdad
 * necesita su atención.
 *
 * La clasificación es 100% determinística (palabras clave), a propósito:
 * no hay LLM en este runtime clasificando soporte. Es una regla, no un
 * criterio ambiguo, así que no hace falta pagar la latencia/costo/no
 * determinismo de un modelo para decidirla.
 */

const WINDOW_DAYS = 7;
// Suficiente para cubrir varios días de volumen de mensajes sin forzar un
// índice compuesto en Firestore (mismo criterio que collectSocialMetrics.ts:
// se pide por fecha con un solo orderBy y se filtra el resto en memoria).
const RECENT_MESSAGES_LIMIT = 500;
const INTAKE_CLIENTS_LIMIT = 1000;

// Este cron corre TODOS los días (vercel.json: "0 7 * * *"). Si algún día se
// toca uno de los dos límites de arriba, avisar sin modular mandaría el mismo
// mensaje cada mañana mientras el volumen se mantenga alto — el ruido exacto
// que hace que los avisos de Telegram dejen de leerse (issue #6).
//
// La forma "correcta" de evitarlo sería guardar en algún lado "ya avisé de
// esto" y no repetir hasta que el límite deje de tocarse — pero eso exige un
// sitio donde persistir ese estado, y no hay ninguno hoy: crear una colección
// nueva en Firestore solo para el estado de un aviso es un cambio de esquema,
// y este issue pide solo la alarma. En vez de eso, se usa un throttle sin
// estado: avisar solo los lunes, el mismo día que ya usa weeklyDigest.ts para
// todo lo que no necesita enterarse el mismo día. Peor caso: hasta 6 días de
// demora en la primera alerta — aceptable para una alarma técnica de "podemos
// estar perdiendo datos si esto sigue creciendo", que es distinta del aviso de
// mensajes pendientes de este mismo cron, que sí es diario porque ahí sí hay
// un usuario esperando respuesta.
const ALERT_WEEKDAY_UTC = 1; // Lunes en UTC

function esDiaDeAvisarLimite(fecha: Date): boolean {
  return fecha.getUTCDay() === ALERT_WEEKDAY_UTC;
}

function isAuthorized(req: NextApiRequest): boolean {
  if (req.headers["x-vercel-cron"] === "1") return true;
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return (req.headers.authorization || "") === `Bearer ${secret}`;
}

/** Minúsculas y sin acentos, para que el matching de keywords no dependa de tildes. */
function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

type TriageCategory = {
  label: string;
  keywords: string[];
};

// Categorías de escalado explícitas del brief. Cada una es una lista de
// substrings (ya normalizados) sobre el texto del mensaje — agregar un
// caso nuevo es agregar una palabra a la lista, no tocar lógica.
const MONEY_CATEGORY: TriageCategory = {
  label: "menciona plata/cobros",
  keywords: [
    "reembolso",
    "reembolsen",
    "devolucion",
    "devuelvan mi dinero",
    "me devuelvan",
    "cobro",
    "cobraron",
    "cobrando",
    "doble cobro",
    "cargo duplicado",
    "cargo indebido",
    "no autorice el cobro",
    "cancelar mi suscripcion",
    "cancelar la suscripcion",
    "cancelar suscripcion",
    "dar de baja el pago",
    "dar de baja la suscripcion",
    "cargo",
    "estafa",
    "fraude",
  ],
};

const COMPLAINT_CATEGORY: TriageCategory = {
  label: "reclamo o enojo",
  keywords: [
    "reclamo",
    "queja",
    "pesimo",
    "pesima",
    "terrible",
    "horrible",
    "verguenza",
    "estoy harto",
    "estoy harta",
    "indignado",
    "indignada",
    "enojado",
    "enojada",
    "furioso",
    "furiosa",
    "denuncia",
    "tomada de pelo",
    "muy mal servicio",
    "esto es un desastre",
  ],
};

const DELETE_ACCOUNT_CATEGORY: TriageCategory = {
  label: "pide borrar cuenta/datos",
  keywords: [
    "borrar mi cuenta",
    "borrar mis datos",
    "eliminar mi cuenta",
    "eliminar mis datos",
    "borrenme",
    "eliminenme",
    "quiero borrarme",
    "cerrar mi cuenta",
    "cancelar mi cuenta",
    "derecho al olvido",
    "gdpr",
  ],
};

const MEDICAL_CATEGORY: TriageCategory = {
  label: "tema medico/lesion",
  keywords: [
    "lesion",
    "me lesione",
    "me duele",
    "dolor de",
    "dolor en",
    "medico",
    "doctor",
    "operacion",
    "cirugia",
    "hernia",
    "desgarro",
    "fractura",
    "embarazada",
    "embarazo",
    "diabetes",
    "hipertension",
    "presion arterial",
    "cardiaco",
    "problema del corazon",
    "asma",
    "epilepsia",
    "tendinitis",
  ],
};

const KEYWORD_CATEGORIES = [MONEY_CATEGORY, COMPLAINT_CATEGORY, DELETE_ACCOUNT_CATEGORY, MEDICAL_CATEGORY];

/**
 * Palabras sueltas (sin espacio) matchean con límite de palabra para evitar
 * falsos positivos por substring — "cargo" no debe disparar con "encargo" o
 * "descargo". Las frases (con espacio) matchean por substring simple, que ya
 * es lo bastante específico.
 */
function textMatchesKeyword(normalizedText: string, keyword: string): boolean {
  if (keyword.includes(" ")) return normalizedText.includes(keyword);
  return new RegExp(`\\b${keyword}\\b`).test(normalizedText);
}

function matchedCategoryLabels(text: string): string[] {
  const normalized = normalize(text);
  return KEYWORD_CATEGORIES.filter((cat) =>
    cat.keywords.some((kw) => textMatchesKeyword(normalized, kw))
  ).map((cat) => cat.label);
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

function excerpt(text: string, maxLen = 140): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > maxLen ? `${clean.slice(0, maxLen)}…` : clean;
}

type Escalated = {
  subject: string;
  excerpt: string;
  reasons: string[];
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  if (!isAuthorized(req)) return res.status(401).json({ error: "Unauthorized" });

  const db = getAdminDb();
  if (!db) return res.status(500).json({ error: "Firebase Admin SDK no configurado" });

  try {
    // Set de emails de clientes de coaching activos (colección intakeClients),
    // para poder escalar automáticamente cualquier mensaje suyo sin importar
    // el contenido del texto: son la cuenta de mayor valor/mayor riesgo de
    // churn, así que cualquier mensaje suyo amerita revisión humana.
    const intakeSnap = await db.collection("intakeClients").limit(INTAKE_CLIENTS_LIMIT).get();
    const coachingClientEmails = new Set(
      intakeSnap.docs
        .map((doc) => (typeof doc.data().email === "string" ? doc.data().email.trim().toLowerCase() : null))
        .filter((email): email is string => !!email)
    );

    const messagesSnap = await db
      .collection("mensajes")
      .orderBy("createdAt", "desc")
      .limit(RECENT_MESSAGES_LIMIT)
      .get();

    // La alarma del issue #6: si una query devuelve exactamente su límite, no
    // hay forma de distinguir "eso es todo lo que había" de "había más y se
    // cortó en silencio". Se avisa aparte del resultado del triage en sí — este
    // bloque no toca `escalated`/`routine` ni el código de estado de la
    // respuesta, para que un fallo de Telegram acá no pueda tumbar el cron
    // (mismo principio que `alertarActivacionFallida`).
    const intakeLimitAlcanzado = intakeSnap.docs.length === INTAKE_CLIENTS_LIMIT;
    const messagesLimitAlcanzado = messagesSnap.docs.length === RECENT_MESSAGES_LIMIT;
    if ((intakeLimitAlcanzado || messagesLimitAlcanzado) && esDiaDeAvisarLimite(new Date())) {
      const limitesTocados = [
        intakeLimitAlcanzado
          ? `• <b>intakeClients</b>: se llegó al tope de ${INTAKE_CLIENTS_LIMIT} documentos leídos.`
          : null,
        messagesLimitAlcanzado
          ? `• <b>mensajes</b>: se llegó al tope de ${RECENT_MESSAGES_LIMIT} documentos leídos.`
          : null,
      ].filter((line): line is string => line !== null);

      const avisoLimite = [
        "⚠️ <b>Triage de soporte: consulta al límite</b>",
        "",
        ...limitesTocados,
        "",
        "El cron siguió corriendo, pero puede estar dejando mensajes o clientes",
        "fuera de este análisis sin que se note: la query no pagina, corta en el",
        "límite en vez de traer el resto.",
      ].join("\n");

      await sendTelegramMessage(avisoLimite).catch((err) => {
        console.warn("⚠️ No se pudo avisar del límite de supportTriage por Telegram:", err);
      });
    }

    const since = Date.now() - WINDOW_DAYS * 86400000;

    let checked = 0;
    let routine = 0;
    const escalated: Escalated[] = [];

    for (const doc of messagesSnap.docs) {
      const data = doc.data();
      const createdAtMs = toMillis(data.createdAt);
      if (createdAtMs !== null && createdAtMs < since) continue;

      const isPending = data.read !== true || data.replied !== true;
      if (!isPending) continue;

      checked++;

      const subject = typeof data.subject === "string" && data.subject ? data.subject : "Consulta";
      const message = typeof data.message === "string" ? data.message : "";
      const email = typeof data.userEmail === "string" ? data.userEmail.trim().toLowerCase() : "";

      const reasons = matchedCategoryLabels(`${subject} ${message}`);
      const isCoachingClient = !!email && coachingClientEmails.has(email);
      if (isCoachingClient) reasons.push("cliente de coaching");

      if (reasons.length > 0) {
        escalated.push({ subject, excerpt: excerpt(message), reasons });
      } else {
        routine++;
      }
    }

    // Silencio explícito si no hay nada que escalar — Lucas pidió
    // específicamente no recibir ruido los días sin novedad.
    if (escalated.length === 0) {
      return res.status(200).json({ ok: true, checked, escalated: 0, routine });
    }

    const lines = [
      `🚨 <b>Soporte: ${escalated.length} mensaje(s) para revisar</b>`,
      "",
      ...escalated.map(
        (item) =>
          `• <b>${escapeHtml(item.subject)}</b>\n"${escapeHtml(item.excerpt)}"\n↳ ${escapeHtml(item.reasons.join(" · "))}`
      ),
      "",
      `📋 ${routine} mensaje(s) de rutina quedaron pendientes de respuesta (sin escalar).`,
    ];
    const telegramOk = await sendTelegramMessage(lines.join("\n")).catch((err) => {
      console.warn("⚠️ No se pudo enviar el triage de soporte a Telegram:", err);
      return false;
    });

    // El único propósito de este cron es avisarle a Lucas: si el envío a
    // Telegram falla, un 200 dejaría el fallo invisible (el análisis se hizo
    // pero nadie se entera). Se refleja en el status HTTP para que quede
    // marcado como fallido en el panel de crons de Vercel, sin perder el
    // resultado del análisis ya hecho.
    if (!telegramOk) {
      return res.status(502).json({
        ok: false,
        error: "No se pudo enviar el triage de soporte a Telegram",
        checked,
        escalated: escalated.length,
        routine,
      });
    }

    return res.status(200).json({ ok: true, checked, escalated: escalated.length, routine });
  } catch (error) {
    console.error("Error en el triage diario de soporte:", error);
    const message = error instanceof Error ? error.message : String(error);
    await sendTelegramMessage(`❌ Falló el triage diario de soporte: ${message}`).catch(() => {});
    return res.status(500).json({ error: "No se pudo procesar el triage de soporte", detail: message });
  }
}
