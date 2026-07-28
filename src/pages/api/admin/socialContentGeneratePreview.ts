import type { NextApiRequest, NextApiResponse } from "next";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/adminAuthServer";
import { generateSocialCopy } from "@/lib/socialContent/generateCopy";
import { buildAvatarSocialVideo } from "@/lib/socialContent/buildSocialVideo";
import { uploadBufferToCloudinary } from "@/lib/socialContent/cloudinaryUpload";

/**
 * Genera (pero NO publica) una pieza de contenido social a pedido del
 * fundador desde el panel admin: copy + video con el tema que haya escrito
 * (o el sugerido por IA que haya aceptado). Guarda un borrador en Firestore
 * (`socialContentManual`) para que el paso de publicar no tenga que
 * re-mandar el video — el admin lo revisa y aprieta "Publicar" por separado.
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

  const topic = typeof req.body?.topic === "string" ? req.body.topic.trim() : "";
  if (!topic) {
    return res.status(400).json({ error: "Falta el tema (topic)" });
  }

  try {
    const copy = await generateSocialCopy({ type: "custom", description: topic });

    const videoBuffer = await buildAvatarSocialVideo(copy.narration);

    const draftRef = db.collection("socialContentManual").doc();
    const videoUrl = await uploadBufferToCloudinary(videoBuffer, {
      folder: "fitplan-social-manual",
      publicId: draftRef.id,
      resourceType: "video",
    });

    await draftRef.set({
      topic,
      copy,
      videoUrl,
      status: "draft",
      createdBy: auth.uid,
      createdAt: FieldValue.serverTimestamp(),
    });

    return res.status(200).json({ ok: true, draftId: draftRef.id, videoUrl, copy });
  } catch (error) {
    console.error("Error generando preview de contenido social:", error);
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: "No se pudo generar el contenido", detail: message });
  }
}
