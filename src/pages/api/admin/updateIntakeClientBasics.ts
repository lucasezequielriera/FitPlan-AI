import type { NextApiRequest, NextApiResponse } from "next";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/adminAuthServer";

type Body = {
  intakeClientId?: string;
  nombre?: string;
  apellido?: string;
  email?: string;
  edad?: number | null;
  ciudad?: string;
  instagram?: string;
  whatsapp?: string;
  emailVerified?: boolean;
  whatsappVerified?: boolean;
  privacyConsentAccepted?: boolean;
};

function toTrimmed(v: unknown, max = 200): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return null;
  return t.slice(0, max);
}

function parseEdad(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  const i = Math.floor(n);
  if (i < 10 || i > 100) return null;
  return i;
}

function splitFullName(nombreCompleto: string | null): { nombre: string | null; apellido: string | null } {
  if (!nombreCompleto) return { nombre: null, apellido: null };
  const parts = nombreCompleto.split(/\s+/).filter(Boolean);
  if (!parts.length) return { nombre: null, apellido: null };
  if (parts.length === 1) return { nombre: parts[0], apellido: null };
  return { nombre: parts[0], apellido: parts.slice(1).join(" ") };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) {
      return res.status(auth.status).json({ error: auth.error });
    }

    const body = (req.body || {}) as Body;
    if (!body.intakeClientId) return res.status(400).json({ error: "Falta intakeClientId" });
    const db = getAdminDb();
    if (!db) return res.status(500).json({ error: "Firebase Admin SDK no configurado" });

    const nombre = toTrimmed(body.nombre, 80);
    const apellido = toTrimmed(body.apellido, 120);
    const nombreCompleto = [nombre, apellido].filter(Boolean).join(" ").trim() || null;
    const email = toTrimmed(body.email, 160)?.toLowerCase() || null;
    const edad = parseEdad(body.edad);
    const ciudad = toTrimmed(body.ciudad, 120);
    const instagram = toTrimmed(body.instagram, 120);
    const whatsapp = toTrimmed(body.whatsapp, 80);
    const emailVerified = body.emailVerified === true;
    const whatsappVerified = body.whatsappVerified === true;
    const privacyConsentAccepted = body.privacyConsentAccepted === true;

    const ref = db.collection("intakeClients").doc(body.intakeClientId);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: "Cliente no encontrado" });

    const prevData = snap.data() || {};
    const prevFormData =
      prevData.formData && typeof prevData.formData === "object"
        ? ({ ...(prevData.formData as Record<string, unknown>) } as Record<string, unknown>)
        : {};
    const currentFormData =
      prevData.formData && typeof prevData.formData === "object"
        ? ({ ...(prevData.formData as Record<string, unknown>) } as Record<string, unknown>)
        : {};
    currentFormData.nombreCompleto = nombreCompleto;
    currentFormData.email = email;
    currentFormData.edad = edad;
    currentFormData.ciudadPais = ciudad;
    currentFormData.instagram = instagram;
    currentFormData.whatsapp = whatsapp;
    currentFormData.privacyConsentAccepted = privacyConsentAccepted;
    currentFormData.emailVerified = emailVerified;
    currentFormData.whatsappVerified = whatsappVerified;

    await ref.set(
      {
        nombreCompleto,
        email,
        whatsapp,
        instagram,
        emailVerified,
        whatsappVerified,
        privacyConsentAccepted,
        privacyConsentAt: privacyConsentAccepted ? FieldValue.serverTimestamp() : null,
        updatedAt: FieldValue.serverTimestamp(),
        formData: currentFormData,
      },
      { merge: true }
    );
    await ref.collection("profileEdits").add({
      actorType: "admin",
      actorId: auth.uid,
      before: {
        nombreCompleto: prevData.nombreCompleto ?? null,
        email: prevData.email ?? null,
        whatsapp: prevData.whatsapp ?? null,
        instagram: prevData.instagram ?? null,
        edad: prevFormData.edad ?? null,
        ciudad: prevFormData.ciudadPais ?? null,
        emailVerified: prevData.emailVerified ?? false,
        whatsappVerified: prevData.whatsappVerified ?? false,
        privacyConsentAccepted: prevData.privacyConsentAccepted ?? false,
      },
      after: {
        nombreCompleto,
        email,
        whatsapp,
        instagram,
        edad,
        ciudad,
        emailVerified,
        whatsappVerified,
        privacyConsentAccepted,
      },
      createdAt: FieldValue.serverTimestamp(),
    });

    return res.status(200).json({
      ok: true,
      client: {
        id: body.intakeClientId,
        nombreCompleto,
        ...splitFullName(nombreCompleto),
        email,
        edad,
        ciudad,
        instagram,
        whatsapp,
        emailVerified,
        whatsappVerified,
        privacyConsentAccepted,
      },
    });
  } catch (e) {
    console.error("updateIntakeClientBasics:", e);
    return res.status(500).json({ error: "No se pudieron actualizar los datos" });
  }
}

