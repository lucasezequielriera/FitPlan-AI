import type { NextApiRequest, NextApiResponse } from "next";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/adminAuthServer";
import { postVideoToInstagram } from "@/lib/socialContent/postToInstagram";
import { postVideoToTikTok } from "@/lib/socialContent/postToTikTok";
import { getInstagramAccessToken } from "@/lib/socialContent/instagramTokenStore";
import { sendTelegramMessage } from "@/lib/telegram";

/** Publica un borrador ya generado (socialContentGeneratePreview) a Instagram/TikTok. */
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

  try {
    const draftSnap = await draftRef.get();
    if (!draftSnap.exists) {
      return res.status(404).json({ error: "Borrador no encontrado" });
    }
    const draft = draftSnap.data() || {};
    if (draft.status === "published") {
      return res.status(200).json({ ok: true, alreadyPublished: true, instagram: draft.instagram, tiktok: draft.tiktok });
    }

    const videoUrl = draft.videoUrl as string;
    const copy = draft.copy as { instagramCaption?: string; tiktokCaption?: string; hashtags?: string[]; altText?: string };
    const hashtagsLine = Array.isArray(copy.hashtags) ? copy.hashtags.map((h) => `#${h}`).join(" ") : "";

    const instagramAccessToken = await getInstagramAccessToken(db);
    const instagramResult = await postVideoToInstagram({
      videoUrl,
      caption: `${copy.instagramCaption || ""}\n\n${hashtagsLine}`,
      altText: copy.altText,
      accessToken: instagramAccessToken,
    });

    const tiktokResult = await postVideoToTikTok({
      videoUrl,
      caption: `${copy.tiktokCaption || ""}\n\n${hashtagsLine}`,
    });

    await draftRef.set(
      {
        status: "published",
        instagram: instagramResult,
        tiktok: tiktokResult,
        publishedBy: auth.uid,
        publishedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    const telegramLines = [
      `📱 Contenido social publicado manualmente ("${draft.topic}"):`,
      instagramResult.ok
        ? `✅ Instagram (post ${instagramResult.platformPostId})`
        : `⚠️ Instagram: ${instagramResult.message}`,
      tiktokResult.ok ? `✅ TikTok (post ${tiktokResult.platformPostId})` : `⚠️ TikTok: ${tiktokResult.message}`,
    ];
    await sendTelegramMessage(telegramLines.join("\n")).catch(() => {});

    return res.status(200).json({ ok: true, instagram: instagramResult, tiktok: tiktokResult });
  } catch (error) {
    console.error("Error publicando borrador de contenido social:", error);
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: "No se pudo publicar el contenido", detail: message });
  }
}
