import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { postCarouselToInstagram } from "@/lib/socialContent/postCarouselToInstagram";
import { getInstagramAccessToken } from "@/lib/socialContent/instagramTokenStore";
import { sendTelegramMessage } from "@/lib/telegram";
import type { PostResult } from "@/lib/socialContent/postToInstagram";

export type PublishCarouselResult = { draftId: string; instagram: PostResult };

/**
 * Publica un borrador de carrusel ya generado. Lo comparten el botón
 * "Publicar" del panel y el cron que despacha los programados, para que ambos
 * caminos hagan exactamente lo mismo.
 */
export async function publishCarouselDraft(db: Firestore, draftId: string, publishedBy: string): Promise<PublishCarouselResult> {
  const ref = db.collection("socialContentCarousel").doc(draftId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error(`El carrusel ${draftId} no existe.`);

  const draft = snap.data() || {};
  if (draft.status === "published") {
    throw new Error("Este carrusel ya se publicó.");
  }

  const imageUrls = Array.isArray(draft.imageUrls) ? (draft.imageUrls as string[]) : [];
  if (imageUrls.length === 0) throw new Error("El borrador no tiene imágenes generadas.");

  const accessToken = await getInstagramAccessToken(db);
  const instagram = await postCarouselToInstagram({
    imageUrls,
    caption: String(draft.caption || ""),
    accessToken,
  });

  await ref.set(
    {
      // Igual que en los reels: solo cuenta como publicado si Instagram lo
      // aceptó, para que un fallo no quede invisible en el panel.
      status: instagram.ok ? "published" : "publish_failed",
      ...(instagram.ok ? {} : { error: instagram.message }),
      instagram,
      publishedBy,
      publishedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  await sendTelegramMessage(
    instagram.ok
      ? `🖼️ Carrusel publicado en Instagram (${imageUrls.length} imágenes, post ${instagram.platformPostId}):\n"${draft.topic || ""}"`
      : `⚠️ No se pudo publicar el carrusel "${draft.topic || ""}": ${instagram.message}`
  ).catch(() => {});

  return { draftId, instagram };
}
