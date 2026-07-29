import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { postVideoToInstagram, type PostResult } from "@/lib/socialContent/postToInstagram";
import { postVideoToTikTok } from "@/lib/socialContent/postToTikTok";
import { getInstagramAccessToken } from "@/lib/socialContent/instagramTokenStore";
import { getStoredTikTokTokens } from "@/lib/socialContent/tiktokTokenStore";
import { sendTelegramMessage } from "@/lib/telegram";

export type PublishManualDraftResult = {
  ok: true;
  alreadyPublished?: true;
  instagram: PostResult;
  tiktok: PostResult;
};

/**
 * Publica un borrador de `socialContentManual` a Instagram/TikTok. Extraído
 * de socialContentPublishDraft.ts para que tanto el botón "Publicar" del
 * admin como el tick del cron (para borradores programados con
 * `scheduledFor`) compartan la misma lógica en vez de duplicarla.
 */
export async function publishManualDraft(db: Firestore, draftId: string, publishedBy: string): Promise<PublishManualDraftResult> {
  const draftRef = db.collection("socialContentManual").doc(draftId);
  const draftSnap = await draftRef.get();
  if (!draftSnap.exists) {
    throw new Error("Borrador no encontrado");
  }
  const draft = draftSnap.data() || {};
  if (draft.status === "published") {
    return { ok: true, alreadyPublished: true, instagram: draft.instagram, tiktok: draft.tiktok };
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

  const tiktokTokens = await getStoredTikTokTokens(db);
  const tiktokResult = await postVideoToTikTok({
    videoUrl,
    caption: `${copy.tiktokCaption || ""}\n\n${hashtagsLine}`,
    accessToken: tiktokTokens?.accessToken,
    openId: tiktokTokens?.openId,
  });

  await draftRef.set(
    {
      status: "published",
      instagram: instagramResult,
      tiktok: tiktokResult,
      publishedBy,
      publishedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  const telegramLines = [
    `📱 Contenido social publicado ("${draft.topic}"):`,
    instagramResult.ok
      ? `✅ Instagram (post ${instagramResult.platformPostId})`
      : `⚠️ Instagram: ${instagramResult.message}`,
    tiktokResult.ok ? `✅ TikTok (post ${tiktokResult.platformPostId})` : `⚠️ TikTok: ${tiktokResult.message}`,
  ];
  await sendTelegramMessage(telegramLines.join("\n")).catch(() => {});

  return { ok: true, instagram: instagramResult, tiktok: tiktokResult };
}
