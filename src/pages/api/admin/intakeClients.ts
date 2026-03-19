import type { NextApiRequest, NextApiResponse } from "next";
import { getAdminDb } from "@/lib/firebase-admin";

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
  createdAt: string | null;
};

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

  const userId = req.query.userId as string | undefined;
  if (!userId) {
    return res.status(401).json({ error: "No se proporcionó userId" });
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
        createdAt: toISO(data.createdAt),
      };
    });

    return res.status(200).json({ clients });
  } catch (error) {
    console.error("Error obteniendo clientes del formulario:", error);
    return res.status(500).json({ error: "No se pudieron obtener los clientes del formulario" });
  }
}
