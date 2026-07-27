import type { NextApiRequest, NextApiResponse } from "next";
import { getAdminDb } from "@/lib/firebase-admin";
import { formatIntakeClinicalHintForList } from "@/lib/trainingPlanGuards";
import { requireAdmin } from "@/lib/adminAuthServer";

type IntakeClient = {
  id: string;
  nombreCompleto: string | null;
  email: string | null;
  whatsapp: string | null;
  instagram: string | null;
  servicioInteres: string | null;
  objetivoPrincipal: string | null;
  trabajoTurnos: string | null;
  diasTrabajo: string[];
  status: string | null;
  latestPlanId?: string | null;
  latestPlanActionType?: "generate" | "update" | null;
  latestPlanIncludeNutrition?: boolean;
  latestPlanIncludeTraining?: boolean;
  pais?: string | null;
  paymentStatus?: "pending" | "paid" | "failed" | null;
  paymentProvider?: "stripe" | "mercadopago" | null;
  paymentLastPaidAt?: string | null;
  createdAt: string | null;
  /** Lesiones/cirugías resumidas del formulario (solo lectura en admin). */
  clinicalTrainingHint?: string | null;
  /** Peso declarado en el formulario (kg). */
  pesoInicialKg?: number | null;
  digestEmailEnabled?: boolean;
  digestFrequency?: "weekly" | "biweekly" | "monthly";
  weeklyDigestSentAt?: string | null;
  digestStartDate?: string | null;
  wellnessAutoEnabled?: boolean;
  wellnessAutoStartDate?: string | null;
  wellnessCheckinRequested?: boolean;
  wellnessCheckinRequestedAt?: string | null;
  lastWellnessCheckinAt?: string | null;
  weightRequestAutoEnabled?: boolean;
  weightRequestFrequency?: "weekly" | "biweekly" | "monthly";
  weightRequestStartDate?: string | null;
  weightCheckRequested?: boolean;
  latestWeightKg?: number | null;
  latestWeightAt?: string | null;
};

function parsePesoInicialKg(formData: Record<string, unknown> | null): number | null {
  if (!formData) return null;
  const raw = formData.pesoKg;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string") {
    const n = parseFloat(raw.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.error });
  }

  try {
    const db = getAdminDb();
    if (!db) {
      return res.status(500).json({ error: "Firebase Admin SDK no configurado" });
    }

    const snapshot = await db.collection("intakeClients").orderBy("createdAt", "desc").limit(100).get();
    const clients: IntakeClient[] = snapshot.docs.map((doc) => {
      const data = doc.data();
      const formData =
        typeof data.formData === "object" && data.formData !== null
          ? (data.formData as Record<string, unknown>)
          : null;
      const fallbackDiasTrabajo = Array.isArray(formData?.diasTrabajo)
        ? (formData?.diasTrabajo as unknown[]).filter((item): item is string => typeof item === "string")
        : [];
      return {
        id: doc.id,
        nombreCompleto: (data.nombreCompleto as string) || null,
        email: (data.email as string) || null,
        whatsapp: (data.whatsapp as string) || null,
        instagram: (data.instagram as string) || null,
        servicioInteres: (data.servicioInteres as string) || ((formData?.servicioInteres as string) || null),
        objetivoPrincipal: (data.objetivoPrincipal as string) || null,
        trabajoTurnos: (data.trabajoTurnos as string) || ((formData?.trabajoTurnos as string) || null),
        diasTrabajo: Array.isArray(data.diasTrabajo)
          ? (data.diasTrabajo as unknown[]).filter((item): item is string => typeof item === "string")
          : fallbackDiasTrabajo,
        status: (data.status as string) || "new",
        latestPlanId: (data.latestPlanId as string) || null,
        latestPlanActionType: ((data.latestPlanActionType as "generate" | "update" | undefined) || null),
        latestPlanIncludeNutrition: data.latestPlanIncludeNutrition === true,
        latestPlanIncludeTraining: data.latestPlanIncludeTraining === true,
        pais: (data.pais as string) || ((formData?.ciudadPais as string) || null),
        paymentStatus: ((data.paymentStatus as "pending" | "paid" | "failed" | undefined) || null),
        paymentProvider: ((data.paymentProvider as "stripe" | "mercadopago" | undefined) || null),
        paymentLastPaidAt: toISO(data.paymentLastPaidAt),
        createdAt: toISO(data.createdAt),
        clinicalTrainingHint: formatIntakeClinicalHintForList(formData),
        pesoInicialKg: parsePesoInicialKg(formData),
        digestEmailEnabled: data.digestEmailEnabled !== false,
        digestFrequency:
          data.digestFrequency === "biweekly" || data.digestFrequency === "monthly"
            ? (data.digestFrequency as "biweekly" | "monthly")
            : "weekly",
        weeklyDigestSentAt: toISO(data.weeklyDigestSentAt),
        digestStartDate: typeof data.digestStartDate === "string" ? data.digestStartDate : null,
        wellnessAutoEnabled: data.wellnessAutoEnabled === true,
        wellnessAutoStartDate: typeof data.wellnessAutoStartDate === "string" ? data.wellnessAutoStartDate : null,
        wellnessCheckinRequested: data.wellnessCheckinRequested === true,
        wellnessCheckinRequestedAt: toISO(data.wellnessCheckinRequestedAt),
        lastWellnessCheckinAt: toISO(data.lastWellnessCheckinAt),
        weightRequestAutoEnabled: data.weightRequestAutoEnabled === true,
        weightRequestFrequency:
          data.weightRequestFrequency === "weekly" || data.weightRequestFrequency === "biweekly"
            ? (data.weightRequestFrequency as "weekly" | "biweekly")
            : "monthly",
        weightRequestStartDate: typeof data.weightRequestStartDate === "string" ? data.weightRequestStartDate : null,
        weightCheckRequested: data.weightCheckRequested === true,
        latestWeightKg: typeof data.latestWeightKg === "number" ? data.latestWeightKg : null,
        latestWeightAt: toISO(data.latestWeightAt),
      };
    });

    return res.status(200).json({ clients });
  } catch (error) {
    console.error("Error obteniendo clientes del formulario:", error);
    return res.status(500).json({ error: "No se pudieron obtener los clientes del formulario" });
  }
}
