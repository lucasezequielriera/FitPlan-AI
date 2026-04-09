import type { NextApiRequest, NextApiResponse } from "next";
import { FieldValue } from "firebase-admin/firestore";
import { assertIntakePublicToken } from "@/lib/intakePublicTokenServer";

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

function parseExistingEdad(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.floor(value);
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    if (Number.isFinite(n)) return Math.floor(n);
  }
  return null;
}

function splitFullName(nombreCompleto: string | null): { nombre: string | null; apellido: string | null } {
  if (!nombreCompleto) return { nombre: null, apellido: null };
  const parts = nombreCompleto.split(/\s+/).filter(Boolean);
  if (!parts.length) return { nombre: null, apellido: null };
  if (parts.length === 1) return { nombre: parts[0], apellido: null };
  return { nombre: parts[0], apellido: parts.slice(1).join(" ") };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const clientId = typeof req.query.clientId === "string" ? req.query.clientId : "";
  const token = typeof req.query.t === "string" ? req.query.t : "";
  if (!clientId || !token) return res.status(400).json({ error: "Faltan clientId o t" });

  const auth = await assertIntakePublicToken(clientId, token);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const currentName =
    typeof auth.intakeData.nombreCompleto === "string" && auth.intakeData.nombreCompleto.trim()
      ? auth.intakeData.nombreCompleto.trim()
      : null;
  const formData =
    auth.intakeData.formData && typeof auth.intakeData.formData === "object"
      ? (auth.intakeData.formData as Record<string, unknown>)
      : {};

  if (req.method === "GET") {
    const edad = parseExistingEdad(formData.edad) ?? parseExistingEdad((auth.intakeData as Record<string, unknown>).edad);
    return res.status(200).json({
      profile: {
        ...splitFullName(currentName),
        email: typeof auth.intakeData.email === "string" ? auth.intakeData.email : null,
        edad,
        ciudad: typeof formData.ciudadPais === "string" ? formData.ciudadPais : null,
        instagram: typeof auth.intakeData.instagram === "string" ? auth.intakeData.instagram : null,
        whatsapp: typeof auth.intakeData.whatsapp === "string" ? auth.intakeData.whatsapp : null,
        privacyConsentAccepted: auth.intakeData.privacyConsentAccepted === true || formData.privacyConsentAccepted === true,
      },
    });
  }

  if (req.method === "POST") {
    const body = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
    const nombre = toTrimmed(body.nombre, 80);
    const apellido = toTrimmed(body.apellido, 120);
    const nombreCompleto = [nombre, apellido].filter(Boolean).join(" ").trim() || null;
    const email = toTrimmed(body.email, 160)?.toLowerCase() || null;
    const edad = parseEdad(body.edad);
    const ciudad = toTrimmed(body.ciudad, 120);
    const instagram = toTrimmed(body.instagram, 120);
    const whatsapp = toTrimmed(body.whatsapp, 80);
    const privacyConsentAccepted = body.privacyConsentAccepted === true;
    const prevData = auth.intakeData as Record<string, unknown>;

    const nextFormData: Record<string, unknown> = { ...formData };
    nextFormData.nombreCompleto = nombreCompleto;
    nextFormData.email = email;
    nextFormData.edad = edad;
    nextFormData.ciudadPais = ciudad;
    nextFormData.instagram = instagram;
    nextFormData.whatsapp = whatsapp;
    nextFormData.privacyConsentAccepted = privacyConsentAccepted;

    await auth.db.collection("intakeClients").doc(clientId).set(
      {
        nombreCompleto,
        email,
        whatsapp,
        instagram,
        privacyConsentAccepted,
        privacyConsentAt: privacyConsentAccepted ? FieldValue.serverTimestamp() : null,
        formData: nextFormData,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    await auth.db.collection("intakeClients").doc(clientId).collection("profileEdits").add({
      actorType: "client",
      actorId: clientId,
      before: {
        nombreCompleto: prevData.nombreCompleto ?? null,
        email: prevData.email ?? null,
        whatsapp: prevData.whatsapp ?? null,
        instagram: prevData.instagram ?? null,
        edad: formData.edad ?? null,
        ciudad: formData.ciudadPais ?? null,
        privacyConsentAccepted: prevData.privacyConsentAccepted ?? false,
      },
      after: {
        nombreCompleto,
        email,
        whatsapp,
        instagram,
        edad,
        ciudad,
        privacyConsentAccepted,
      },
      createdAt: FieldValue.serverTimestamp(),
    });

    return res.status(200).json({
      ok: true,
      profile: { nombre, apellido, email, edad, ciudad, instagram, whatsapp, privacyConsentAccepted },
    });
  }

  return res.status(405).json({ error: "Method not allowed" });
}

