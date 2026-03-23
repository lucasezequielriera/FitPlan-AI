import type { NextApiRequest, NextApiResponse } from "next";
import nodemailer from "nodemailer";
import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";

const DESTINATION_EMAIL = "lucasezequielriera@gmail.com";
const MALE_TRAINER_NAME = "Lucas";
const FEMALE_TRAINER_NAME = "Entrenadora del equipo FitPlan";
const TRAINER_WHATSAPP = "+34 627043397";

async function sendPersonalTrainerChatMessage(params: {
  userId: string;
  nombre: string | null;
  userEmail: string | null;
  note: string | null;
  trainerPreference: "hombre" | "mujer";
  trainerName: string;
  trainerFocus: string;
  db: Firestore;
}) {
  const nombreCliente = params.nombre?.trim() || "Cliente";
  const noteLine = params.note ? `\nMotivo del usuario: ${params.note}` : "";

  await params.db.collection("mensajes").add({
    userId: params.userId,
    userName: params.nombre || null,
    userEmail: params.userEmail || null,
    subject: "Entrenador personal solicitado",
    message: "Iniciado automáticamente desde dashboard",
    read: true,
    replied: true,
    closed: false,
    initiatedByAdmin: true,
    userRead: false,
    replies: [
      {
        message: `Hola ${nombreCliente}, soy ${params.trainerName}. Vi que pediste entrenador personal humano. Tu preferencia fue entrenador ${params.trainerPreference}. Area principal: ${params.trainerFocus}. Puedes escribirme por WhatsApp al ${TRAINER_WHATSAPP}.${noteLine}`,
        senderName: "admin",
        senderType: "admin",
        createdAt: new Date(),
      },
    ],
    createdAt: FieldValue.serverTimestamp(),
    lastReplyAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) {
      return res.status(401).json({ error: "Token requerido" });
    }

    const adminAuth = getAdminAuth();
    const adminDb = getAdminDb();
    if (!adminAuth || !adminDb) {
      return res.status(500).json({ error: "Firebase Admin SDK no configurado" });
    }

    const decoded = await adminAuth.verifyIdToken(token);
    const userId = decoded.uid;
    const userRef = adminDb.collection("usuarios").doc(userId);
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const requestNoteRaw = req.body?.requestNote;
    const requestNote =
      typeof requestNoteRaw === "string" && requestNoteRaw.trim().length > 0
        ? requestNoteRaw.trim().slice(0, 500)
        : null;
    const preferenceRaw = req.body?.trainerPreference;
    const trainerPreference =
      preferenceRaw === "mujer" || preferenceRaw === "hombre" ? preferenceRaw : null;
    if (!trainerPreference) {
      return res.status(400).json({ error: "Debes seleccionar si prefieres entrenador hombre o mujer." });
    }

    const trainerName = trainerPreference === "mujer" ? FEMALE_TRAINER_NAME : MALE_TRAINER_NAME;
    const trainerFocus =
      trainerPreference === "mujer"
        ? "entrenamiento funcional, alto rendimiento y recomposicion corporal"
        : "hipertrofia y rendimiento deportivo";

    const userData = userDoc.data() || {};
    const nombre = typeof userData.nombre === "string" ? userData.nombre : null;
    const email = typeof userData.email === "string" ? userData.email : null;
    const premium = userData.premium === true;
    const alreadyAssigned = userData.personalTrainerAssigned === true;
    const alreadyNotified = userData.personalTrainerRequestNotifiedAt !== undefined;

    if (!alreadyAssigned) {
      await userRef.set(
        {
          personalTrainerAssigned: true,
          personalTrainerAssignedAt: FieldValue.serverTimestamp(),
          personalTrainerName: trainerName,
          personalTrainerPreference: trainerPreference,
          personalTrainerFocus: trainerFocus,
          personalTrainerWhatsapp: TRAINER_WHATSAPP,
          personalTrainerRequestedByButton: true,
          personalTrainerStatus: "assigned",
          personalTrainerRequestNote: requestNote,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }

    const smtpHost = process.env.INTAKE_SMTP_HOST;
    const smtpPort = Number(process.env.INTAKE_SMTP_PORT || "587");
    const smtpUser = process.env.INTAKE_SMTP_USER;
    const smtpPass = process.env.INTAKE_SMTP_PASS;
    const from = process.env.INTAKE_FROM_EMAIL || smtpUser;

    let mailSent = false;
    let chatNotified = false;
    if (!alreadyNotified && smtpHost && smtpUser && smtpPass && from) {
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

        await transporter.sendMail({
          from: `FitPlan AI <${from}>`,
          to: DESTINATION_EMAIL,
          subject: "Nuevo usuario solicitó entrenador personal humano",
          text: [
            "Un usuario solicitó entrenador personal humano.",
            "",
            `userId: ${userId}`,
            `nombre: ${nombre || "N/A"}`,
            `email: ${email || "N/A"}`,
            `premium: ${premium ? "sí" : "no"}`,
            `preferencia entrenador: ${trainerPreference}`,
            `entrenador asignado: ${trainerName}`,
            `enfoque: ${trainerFocus}`,
            `whatsapp entrenador: ${TRAINER_WHATSAPP}`,
            `motivo: ${requestNote || "N/A"}`,
          ].join("\n"),
        });
        mailSent = true;
      } catch (mailError) {
        console.error("Error enviando email de solicitud de entrenador:", mailError);
      }
    }

    if (!alreadyNotified) {
      try {
        await sendPersonalTrainerChatMessage({
          userId,
          nombre,
          userEmail: email,
          note: requestNote,
          trainerPreference,
          trainerName,
          trainerFocus,
          db: adminDb,
        });
        chatNotified = true;
      } catch (chatError) {
        console.error("Error enviando mensaje de chat por solicitud de entrenador:", chatError);
      }

      await userRef.set(
        {
          personalTrainerRequestNotifiedAt: FieldValue.serverTimestamp(),
          personalTrainerRequestEmailSent: mailSent,
          personalTrainerRequestChatSent: chatNotified,
          personalTrainerRequestNote: requestNote,
          personalTrainerPreference: trainerPreference,
          personalTrainerFocus: trainerFocus,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }

    return res.status(200).json({
      ok: true,
      alreadyAssigned,
      alreadyNotified,
      mailSent,
      chatNotified,
      trainer: {
        name: trainerName,
        preference: trainerPreference,
        focus: trainerFocus,
        whatsapp: TRAINER_WHATSAPP,
      },
    });
  } catch (error) {
    console.error("Error solicitando entrenador personal:", error);
    return res.status(500).json({ error: "No se pudo procesar la solicitud" });
  }
}

