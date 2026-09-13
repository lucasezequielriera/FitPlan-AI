import type { NextApiRequest, NextApiResponse } from "next";
import nodemailer from "nodemailer";
import { randomBytes } from "crypto";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/adminAuthServer";
import { EMAIL, META_ESQUEMA_COLOR, botonEmail } from "@/lib/email/palette";
import { escapeHtml } from "@/lib/email/html";

function firstName(fullName: string | null): string {
  if (!fullName) return "campeón";
  const p = fullName.trim().split(/\s+/).filter(Boolean);
  return p.length ? p[0] : "campeón";
}

function normalizeObjective(raw: string | null): string {
  if (!raw) return "mejorar tu composición corporal";
  const value = raw.trim().toLowerCase();
  if (!value) return "mejorar tu composición corporal";
  const map: Record<string, string> = {
    perder_grasa: "pérdida de grasa",
    "perder grasa": "pérdida de grasa",
    bajar_grasa: "pérdida de grasa",
    ganar_musculo: "ganancia muscular",
    "ganar musculo": "ganancia muscular",
    ganar_masa_muscular: "ganancia muscular",
    recomposicion: "recomposición corporal",
    recomposicion_corporal: "recomposición corporal",
    mantenimiento: "mantenimiento",
  };
  return map[value] || raw.replace(/_/g, " ");
}

function normalizeGender(raw: unknown): "masculino" | "femenino" | "neutral" {
  if (typeof raw !== "string") return "neutral";
  const v = raw.trim().toLowerCase();
  if (v === "masculino" || v === "hombre") return "masculino";
  if (v === "femenino" || v === "mujer") return "femenino";
  return "neutral";
}

function byGender(
  g: "masculino" | "femenino" | "neutral",
  text: { m: string; f: string; n: string }
): string {
  if (g === "masculino") return text.m;
  if (g === "femenino") return text.f;
  return text.n;
}

function welcomeWord(g: "masculino" | "femenino" | "neutral"): string {
  if (g === "masculino") return "Bienvenido";
  if (g === "femenino") return "Bienvenida";
  return "Bienvenido/a";
}

function buildWelcomeHtml(params: {
  name: string;
  objective: string;
  service: string;
  coachName: string;
  route: string;
  gender: "masculino" | "femenino" | "neutral";
}) {
  const header = escapeHtml(`${welcomeWord(params.gender)} a FitPlan con tu trainer: Lucas Riera`);
  const addressed = byGender(params.gender, {
    m: "acompañado",
    f: "acompañada",
    n: "acompañado/a",
  });
  const sustained = byGender(params.gender, {
    m: "sostenerlo",
    f: "sostenerla",
    n: "sostenerlo",
  });
  return `
  ${META_ESQUEMA_COLOR}
  <div style="background:${EMAIL.fondo};color:${EMAIL.texto};padding:24px;font-family:Arial,sans-serif">
    <h2 style="margin:0 0 8px;color:${EMAIL.acento}">${header}</h2>
    <p style="margin:0 0 14px;color:${EMAIL.textoSuave}">Hola ${escapeHtml(params.name)},</p>
    <p style="margin:0 0 12px;color:${EMAIL.textoSuave}">
      Te doy la bienvenida oficialmente. A partir de hoy empezamos un proceso serio, pero sostenible: progreso real, paso a paso, con foco en tu objetivo <strong>${escapeHtml(params.objective)}</strong>.
    </p>
    <p style="margin:0 0 12px;color:${EMAIL.textoSuave}">
      Ya revisé tu perfil y vamos a trabajar con el enfoque <strong>${escapeHtml(params.service)}</strong>. Mi idea es que te sientas ${addressed}, con claridad total en cada etapa, y que puedas ${sustained} en tu vida real.
    </p>
    <div style="background:${EMAIL.caja};border:1px solid ${EMAIL.borde};border-radius:12px;padding:14px;margin:14px 0">
      <p style="margin:0 0 6px"><strong>Qué espero de vos:</strong></p>
      <ul style="margin:0;padding-left:18px;color:${EMAIL.textoSuave}">
        <li>Constancia antes que perfección</li>
        <li>Registrar tus entrenos y sensaciones</li>
        <li>Hablar claro cuando algo no te cierre</li>
      </ul>
    </div>
    <p style="margin:0 0 12px;color:${EMAIL.textoSuave}">
      Tu avance va a venir de hacer bien lo básico, una y otra vez. Yo me encargo de ajustar la estrategia, vos de ejecutar.
    </p>
    <p style="margin:0 0 12px;color:${EMAIL.textoSuave}">
      Cuando quieras revisar tu plan, entra desde aquí:
    </p>
    <p style="margin:0 0 18px">${botonEmail(params.route, "Ver mi plan")}</p>
    <p style="margin:14px 0 0;color:${EMAIL.texto}">
      Vamos con todo.<br/>
      — ${escapeHtml(params.coachName)}
    </p>
  </div>`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.error });
  }

  const body = (req.body || {}) as { clientId?: string };
  if (!body.clientId) return res.status(400).json({ error: "Falta clientId" });

  const db = getAdminDb();
  if (!db) return res.status(500).json({ error: "Firebase Admin SDK no configurado" });

  const smtpHost = process.env.INTAKE_SMTP_HOST;
  const smtpPort = Number(process.env.INTAKE_SMTP_PORT || "587");
  const smtpUser = process.env.INTAKE_SMTP_USER;
  const smtpPass = process.env.INTAKE_SMTP_PASS;
  const from = process.env.INTAKE_FROM_EMAIL || smtpUser;
  if (!smtpHost || !smtpUser || !smtpPass || !from) {
    return res.status(500).json({ error: "SMTP no configurado" });
  }

  const clientRef = db.collection("intakeClients").doc(body.clientId);
  const snap = await clientRef.get();
  if (!snap.exists) return res.status(404).json({ error: "Cliente no encontrado" });
  const data = snap.data() || {};
  const to = typeof data.email === "string" ? data.email.trim() : "";
  if (!to) return res.status(400).json({ error: "Cliente sin email cargado" });
  const latestPlanId = typeof data.latestPlanId === "string" ? data.latestPlanId : "";
  if (!latestPlanId) return res.status(400).json({ error: "Cliente sin plan generado para compartir enlace web" });

  const coachName = (process.env.WEEKLY_COACH_NAME || "Lucas").trim();
  const name = firstName(typeof data.nombreCompleto === "string" ? data.nombreCompleto : null);
  const objective = normalizeObjective(
    typeof data.objetivoPrincipal === "string" && data.objetivoPrincipal.trim() ? data.objetivoPrincipal.trim() : null
  );
  const service = typeof data.servicioInteres === "string" && data.servicioInteres.trim() ? data.servicioInteres.trim() : "entrenamiento y nutrición";
  const formData =
    data.formData && typeof data.formData === "object" ? (data.formData as Record<string, unknown>) : {};
  const gender = normalizeGender(data.sexo ?? formData.sexo);
  const origin = (process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "https://www.fitplan-ai.com").replace(/\/$/, "");
  let token = typeof data.publicViewToken === "string" && data.publicViewToken.length >= 32 ? data.publicViewToken : null;
  if (!token) {
    token = randomBytes(32).toString("hex");
    await clientRef.set({ publicViewToken: token, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  }
  const route = `${origin}/mi-plan/${encodeURIComponent(body.clientId)}?t=${encodeURIComponent(token)}`;
  const subject = `${welcomeWord(gender)} a FitPlan con tu trainer: Lucas Riera`;
  const html = buildWelcomeHtml({ name, objective, service, coachName, route, gender });
  const text = `Hola ${name},\n\nTe doy la bienvenida oficialmente a FitPlan. Desde hoy trabajamos con foco en tu objetivo (${objective}) y en un proceso sostenible.\n\nMi enfoque con vos será ${service}. Lo más importante: constancia, registrar entrenos y comunicación clara.\n\nVamos con todo.\n— ${coachName}`;

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: { user: smtpUser, pass: smtpPass },
  });

  try {
    await transporter.sendMail({
      from: `FitPlan <${from}>`,
      to,
      subject,
      html,
      text,
    });
    await clientRef.collection("emailHistory").add({
      kind: "welcome",
      status: "sent",
      to,
      subject,
      html,
      text,
      createdAt: FieldValue.serverTimestamp(),
    });
    return res.status(200).json({ ok: true });
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    await clientRef.collection("emailHistory").add({
      kind: "welcome",
      status: "failed",
      to,
      subject,
      error: errMsg,
      createdAt: FieldValue.serverTimestamp(),
    });
    return res.status(500).json({ error: `No se pudo enviar: ${errMsg}` });
  }
}

