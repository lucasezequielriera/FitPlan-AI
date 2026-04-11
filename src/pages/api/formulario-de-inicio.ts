import type { NextApiRequest, NextApiResponse } from "next";
import nodemailer from "nodemailer";
import { buildIntakeEmail } from "@/lib/intakeEmail";
import { validateIntakeForm, type IntakeFormLocale, type IntakeFormState } from "@/lib/intakeFormSchema";
import { getAdminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

const DESTINATION_EMAIL = "lucasezequielriera@gmail.com";

function buildSearchKeywords(input: {
  nombreCompleto?: string;
  email?: string;
  whatsapp?: string;
  instagram?: string;
}): string[] {
  const values = [input.nombreCompleto, input.email, input.whatsapp, input.instagram]
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .flatMap((raw) => {
      const clean = raw.trim().toLowerCase();
      const noAt = clean.replace(/^@/, "");
      const localPart = clean.includes("@") ? clean.split("@")[0] : clean;
      return [clean, noAt, localPart];
    })
    .map((v) => v.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  return Array.from(new Set(values));
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const rawBody = (req.body || {}) as Record<string, unknown>;
  const formLocale: IntakeFormLocale = rawBody.formLocale === "en" ? "en" : "es";
  const { formLocale: _omitLocale, ...restPayload } = rawBody;
  const body = restPayload as Partial<IntakeFormState>;
  const validationErrors = validateIntakeForm(body, formLocale);
  if (validationErrors.length > 0) {
    return res.status(400).json({
      error: validationErrors[0],
      errors: validationErrors,
    });
  }

  const smtpHost = process.env.INTAKE_SMTP_HOST;
  const smtpPort = Number(process.env.INTAKE_SMTP_PORT || "587");
  const smtpUser = process.env.INTAKE_SMTP_USER;
  const smtpPass = process.env.INTAKE_SMTP_PASS;

  try {
    // Persistir primero en Firestore para que siempre quede trazabilidad del lead.
    const adminDb = getAdminDb();
    if (!adminDb) {
      return res.status(500).json({ error: "Firebase Admin SDK no configurado para guardar el formulario." });
    }

    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const instagramRaw = typeof body.instagram === "string" ? body.instagram.trim() : "";
    const instagramHandle = instagramRaw ? instagramRaw.replace(/^@/, "").toLowerCase() : "";
    const nombre = typeof body.nombreCompleto === "string" ? body.nombreCompleto.trim() : "";
    const objetivo = typeof body.objetivoPrincipal === "string" ? body.objetivoPrincipal : "";
    const servicioInteres = typeof body.servicioInteres === "string" ? body.servicioInteres.trim() : "";
    const trabajoTurnos = typeof body.trabajoTurnos === "string" ? body.trabajoTurnos.trim() : "";
    const diasTrabajo = Array.isArray(body.diasTrabajo)
      ? body.diasTrabajo.filter((d): d is string => typeof d === "string" && d.trim().length > 0)
      : [];
    const objetivoRendimiento =
      typeof body.objetivoRendimiento === "string" ? body.objetivoRendimiento.trim() : "";
    const objetivoEstetico =
      typeof body.objetivoEstetico === "string" ? body.objetivoEstetico.trim() : "";

    const savedDoc = await adminDb.collection("intakeClients").add({
      source: "formulario-de-inicio",
      status: "new",
      nombreCompleto: nombre || null,
      email: email || null,
      whatsapp: typeof body.whatsapp === "string" ? body.whatsapp.trim() : null,
      instagram: instagramRaw || null,
      instagramHandle: instagramHandle || null,
      servicioInteres: servicioInteres || null,
      objetivoPrincipal: objetivo || null,
      objetivoRendimiento: objetivoRendimiento || null,
      objetivoEstetico: objetivoEstetico || null,
      trabajoTurnos: trabajoTurnos || null,
      diasTrabajo,
      diasDisponibles: Array.isArray(body.diasDisponibles) ? body.diasDisponibles : [],
      whereToTrain: Array.isArray(body.dondeEntrena) ? body.dondeEntrena : [],
      searchKeywords: buildSearchKeywords({
        nombreCompleto: nombre,
        email,
        whatsapp: typeof body.whatsapp === "string" ? body.whatsapp : "",
        instagram: instagramHandle,
      }),
      formData: body,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    if (!smtpHost || !smtpUser || !smtpPass) {
      return res.status(200).json({
        ok: true,
        intakeId: savedDoc.id,
        mailSent: false,
        warning: "Formulario guardado, pero falta configurar SMTP para el envío por email.",
      });
    }

    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      const mail = buildIntakeEmail(body);
      const from = process.env.INTAKE_FROM_EMAIL || smtpUser;

      await transporter.sendMail({
        from: `FitPlan Formulario <${from}>`,
        to: DESTINATION_EMAIL,
        replyTo: typeof body.email === "string" ? body.email : undefined,
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
      });

      return res.status(200).json({ ok: true, intakeId: savedDoc.id, mailSent: true });
    } catch (mailError) {
      console.error("Error enviando email del formulario de inicio:", mailError);
      return res.status(200).json({
        ok: true,
        intakeId: savedDoc.id,
        mailSent: false,
        warning: "Formulario guardado, pero falló el envío del email.",
      });
    }
  } catch (error) {
    console.error("Error guardando formulario de inicio:", error);
    return res.status(500).json({ error: "No se pudo guardar el formulario." });
  }
}
