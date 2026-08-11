import type { NextApiRequest, NextApiResponse } from "next";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/adminAuthServer";
import { publishCarouselDraft } from "@/lib/socialContent/publishCarouselDraft";

/**
 * Publica un carrusel ya generado, o lo programa para más tarde.
 *
 * - `{ draftId }`                      → publica ahora
 * - `{ draftId, scheduledFor: ISO }`   → lo deja programado; lo despacha el cron
 * - `{ draftId, cancel: true }`        → cancela la programación
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const auth = await requireAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const db = getAdminDb();
  if (!db) return res.status(500).json({ error: "Firebase Admin SDK no configurado" });

  const draftId = typeof req.body?.draftId === "string" ? req.body.draftId : "";
  if (!draftId) return res.status(400).json({ error: "Falta draftId" });

  const ref = db.collection("socialContentCarousel").doc(draftId);

  try {
    if (req.body?.cancel === true) {
      await ref.set({ status: "draft", scheduledFor: FieldValue.delete() }, { merge: true });
      return res.status(200).json({ ok: true, status: "draft" });
    }

    const scheduledFor = typeof req.body?.scheduledFor === "string" ? req.body.scheduledFor : null;
    if (scheduledFor) {
      const when = new Date(scheduledFor);
      if (Number.isNaN(when.getTime())) {
        return res.status(400).json({ error: "scheduledFor no es una fecha válida" });
      }
      if (when.getTime() <= Date.now()) {
        return res.status(400).json({ error: "La fecha programada tiene que ser futura" });
      }
      await ref.set({ status: "scheduled", scheduledFor: Timestamp.fromDate(when) }, { merge: true });
      return res.status(200).json({ ok: true, status: "scheduled", scheduledFor: when.toISOString() });
    }

    const result = await publishCarouselDraft(db, draftId, auth.uid);
    return res.status(result.instagram.ok ? 200 : 502).json({ ok: result.instagram.ok, ...result });
  } catch (error) {
    console.error("Error publicando carrusel:", error);
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: "No se pudo publicar el carrusel", detail: message });
  }
}
