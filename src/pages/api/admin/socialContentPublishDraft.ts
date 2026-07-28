import type { NextApiRequest, NextApiResponse } from "next";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/adminAuthServer";
import { publishManualDraft } from "@/lib/socialContent/publishManualDraft";

/** Publica un borrador ya generado (socialContentGeneratePreview) a Instagram/TikTok, ahora mismo. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.error });
  }

  const db = getAdminDb();
  if (!db) {
    return res.status(500).json({ error: "Firebase Admin SDK no configurado" });
  }

  const draftId = typeof req.body?.draftId === "string" ? req.body.draftId.trim() : "";
  if (!draftId) {
    return res.status(400).json({ error: "Falta draftId" });
  }

  try {
    const result = await publishManualDraft(db, draftId, auth.uid);
    return res.status(200).json(result);
  } catch (error) {
    console.error("Error publicando borrador de contenido social:", error);
    const message = error instanceof Error ? error.message : String(error);
    const status = message === "Borrador no encontrado" ? 404 : 500;
    return res.status(status).json({ error: status === 404 ? message : "No se pudo publicar el contenido", detail: message });
  }
}
