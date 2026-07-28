import type { NextApiRequest, NextApiResponse } from "next";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/adminAuthServer";

/**
 * Programa (o cancela la programación de) un borrador de `socialContentManual`
 * para publicarse en un momento futuro específico, en vez de ahora mismo.
 * El tick de generateDailyContent.ts (cada 10 min vía GitHub Actions) es
 * quien efectivamente lo publica cuando llega la hora — ver
 * publishManualDraft.ts para la lógica de publicación compartida.
 */
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

  const draftRef = db.collection("socialContentManual").doc(draftId);
  const draftSnap = await draftRef.get();
  if (!draftSnap.exists) {
    return res.status(404).json({ error: "Borrador no encontrado" });
  }
  const draft = draftSnap.data() || {};
  if (draft.status === "published") {
    return res.status(400).json({ error: "Este borrador ya fue publicado, no se puede reprogramar." });
  }

  const cancel = req.body?.cancel === true;
  if (cancel) {
    await draftRef.set({ status: "draft", scheduledFor: FieldValue.delete() }, { merge: true });
    return res.status(200).json({ ok: true, cancelled: true });
  }

  const scheduledForIso = typeof req.body?.scheduledFor === "string" ? req.body.scheduledFor : "";
  const scheduledFor = new Date(scheduledForIso);
  if (!scheduledForIso || Number.isNaN(scheduledFor.getTime())) {
    return res.status(400).json({ error: "Falta o es inválido scheduledFor" });
  }
  if (scheduledFor.getTime() < Date.now() - 60_000) {
    return res.status(400).json({ error: "La fecha programada tiene que ser en el futuro" });
  }

  await draftRef.set(
    {
      status: "scheduled",
      scheduledFor: Timestamp.fromDate(scheduledFor),
      scheduledBy: auth.uid,
      scheduledAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return res.status(200).json({ ok: true, scheduledFor: scheduledFor.toISOString() });
}
