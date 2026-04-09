import type { NextApiRequest, NextApiResponse } from "next";
import { assertIntakePublicToken } from "@/lib/intakePublicTokenServer";

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

function parseExistingEdad(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.floor(value);
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    if (Number.isFinite(n)) return Math.floor(n);
  }
  return null;
}

/**
 * Plan de intake (nutrición + entreno) para el cliente, sin login. Requiere clientId + token.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const clientId = typeof req.query.clientId === "string" ? req.query.clientId : "";
  const token = typeof req.query.t === "string" ? req.query.t : "";

  if (!clientId || !token) {
    return res.status(400).json({ error: "Faltan parámetros clientId o t (token)" });
  }

  try {
    const auth = await assertIntakePublicToken(clientId, token);
    if (!auth.ok) {
      return res.status(auth.status).json({ error: auth.error });
    }
    const { db, intakeData } = auth;

    const planId = typeof intakeData.latestPlanId === "string" ? intakeData.latestPlanId : null;
    if (!planId) {
      return res.status(404).json({ error: "Aún no hay plan para mostrar" });
    }

    const planDoc = await db.collection("intakeClientPlans").doc(planId).get();
    if (!planDoc.exists) {
      return res.status(404).json({ error: "Plan no encontrado" });
    }

    const planData = planDoc.data() || {};
    const planIntakeId = typeof planData.intakeClientId === "string" ? planData.intakeClientId : null;
    if (planIntakeId !== clientId) {
      return res.status(403).json({ error: "No autorizado" });
    }

    const clientName =
      typeof intakeData.nombreCompleto === "string" && intakeData.nombreCompleto.trim()
        ? intakeData.nombreCompleto.trim()
        : null;
    const profileSource =
      intakeData.formData && typeof intakeData.formData === "object"
        ? (intakeData.formData as Record<string, unknown>)
        : {};
    const nameParts = (clientName || "").split(/\s+/).filter(Boolean);
    const edad = parseExistingEdad(profileSource.edad) ?? parseExistingEdad((intakeData as Record<string, unknown>).edad);

    return res.status(200).json({
      clientName,
      profile: {
        nombre: nameParts.length ? nameParts[0] : null,
        apellido: nameParts.length > 1 ? nameParts.slice(1).join(" ") : null,
        email: typeof intakeData.email === "string" ? intakeData.email : null,
        edad,
        ciudad: typeof profileSource.ciudadPais === "string" ? profileSource.ciudadPais : null,
        instagram: typeof intakeData.instagram === "string" ? intakeData.instagram : null,
        whatsapp: typeof intakeData.whatsapp === "string" ? intakeData.whatsapp : null,
        privacyConsentAccepted:
          intakeData.privacyConsentAccepted === true ||
          (typeof profileSource.privacyConsentAccepted === "boolean" && profileSource.privacyConsentAccepted),
      },
      plan: {
        id: planDoc.id,
        intakeClientId: planIntakeId,
        actionType: (planData.actionType as string) || null,
        includeNutrition: Boolean(planData.includeNutrition),
        includeTraining: Boolean(planData.includeTraining),
        nutritionTargets:
          planData.nutritionTargets && typeof planData.nutritionTargets === "object"
            ? (planData.nutritionTargets as Record<string, unknown>)
            : null,
        input: planData.input && typeof planData.input === "object" ? (planData.input as Record<string, unknown>) : null,
        plan: planData.plan && typeof planData.plan === "object" ? (planData.plan as Record<string, unknown>) : null,
        createdAt: toISO(planData.createdAt),
        updatedAt: toISO(planData.updatedAt),
      },
    });
  } catch (error) {
    console.error("public intake-client-plan:", error);
    return res.status(500).json({ error: "No se pudo cargar el plan" });
  }
}
