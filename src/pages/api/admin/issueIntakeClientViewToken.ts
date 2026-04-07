import type { NextApiRequest, NextApiResponse } from "next";
import { randomBytes } from "crypto";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { getSiteOriginFromRequest } from "@/lib/requestSiteOrigin";

/**
 * Genera o reutiliza un token de solo lectura para que el cliente vea su plan (nutrición + entreno) sin login.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body =
      req.body && typeof req.body === "object" && !Array.isArray(req.body)
        ? (req.body as Record<string, unknown>)
        : {};
    const adminUserId = body.adminUserId as string | undefined;
    const intakeClientId = body.intakeClientId as string | undefined;

    if (!adminUserId || !intakeClientId) {
      return res.status(400).json({ error: "Faltan adminUserId o intakeClientId" });
    }

    const db = getAdminDb();
    if (!db) {
      return res.status(500).json({ error: "Firebase Admin SDK no configurado" });
    }

    const adminDoc = await db.collection("usuarios").doc(adminUserId).get();
    const email = adminDoc.data()?.email?.toLowerCase() || "";
    if (!adminDoc.exists || email !== "admin@fitplan-ai.com") {
      return res.status(403).json({ error: "Solo administradores pueden acceder" });
    }

    const intakeRef = db.collection("intakeClients").doc(intakeClientId);
    const intakeSnap = await intakeRef.get();
    if (!intakeSnap.exists) {
      return res.status(404).json({ error: "Cliente no encontrado" });
    }

    const data = intakeSnap.data() || {};
    if (!data.latestPlanId) {
      return res.status(400).json({ error: "Este cliente aún no tiene un plan generado" });
    }

    let token = typeof data.publicViewToken === "string" && data.publicViewToken.length >= 32 ? data.publicViewToken : null;
    if (!token) {
      token = randomBytes(32).toString("hex");
      await intakeRef.set(
        {
          publicViewToken: token,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }

    const originFromRequest = getSiteOriginFromRequest(req.headers);
    const originFromEnvRaw = (process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "").trim();
    const originFromEnv = originFromEnvRaw ? originFromEnvRaw.replace(/\/$/, "") : "";
    const useEnvOrigin = originFromRequest.includes("localhost") && originFromEnv.length > 0;
    const origin = useEnvOrigin ? originFromEnv : originFromRequest;
    const url = `${origin}/mi-plan/${encodeURIComponent(intakeClientId)}?t=${encodeURIComponent(token)}`;

    return res.status(200).json({ url, intakeClientId });
  } catch (error) {
    console.error("issueIntakeClientViewToken:", error);
    return res.status(500).json({
      error: "No se pudo generar el enlace",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}
