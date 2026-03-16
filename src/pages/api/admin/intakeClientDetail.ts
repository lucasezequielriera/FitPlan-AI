import type { NextApiRequest, NextApiResponse } from "next";
import { getAdminDb } from "@/lib/firebase-admin";

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
  const clientId = req.query.clientId as string | undefined;

  if (!userId) {
    return res.status(401).json({ error: "No se proporcionó userId" });
  }
  if (!clientId) {
    return res.status(400).json({ error: "No se proporcionó clientId" });
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

    const intakeDoc = await db.collection("intakeClients").doc(clientId).get();
    if (!intakeDoc.exists) {
      return res.status(404).json({ error: "Cliente no encontrado" });
    }

    const data = intakeDoc.data() || {};
    const formData =
      typeof data.formData === "object" && data.formData !== null
        ? (data.formData as Record<string, unknown>)
        : null;

    return res.status(200).json({
      client: {
        id: intakeDoc.id,
        nombreCompleto: (data.nombreCompleto as string) || null,
        email: (data.email as string) || null,
        whatsapp: (data.whatsapp as string) || null,
        instagram: (data.instagram as string) || null,
        objetivoPrincipal: (data.objetivoPrincipal as string) || null,
        status: (data.status as string) || "new",
        createdAt: toISO(data.createdAt),
        updatedAt: toISO(data.updatedAt),
        formData,
      },
    });
  } catch (error) {
    console.error("Error obteniendo detalle de cliente del formulario:", error);
    return res.status(500).json({ error: "No se pudo obtener el detalle del cliente" });
  }
}
