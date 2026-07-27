import type { NextApiRequest, NextApiResponse } from "next";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { getSiteOriginFromRequest } from "@/lib/requestSiteOrigin";
import { pickNextTopic, type SocialTopic } from "@/lib/socialContent/topics";
import { generateSocialCopy } from "@/lib/socialContent/generateCopy";
import { renderZoomVideoFromImage } from "@/lib/socialContent/renderVideo";
import { uploadBufferToCloudinary } from "@/lib/socialContent/cloudinaryUpload";
import { postVideoToInstagram } from "@/lib/socialContent/postToInstagram";
import { postVideoToTikTok } from "@/lib/socialContent/postToTikTok";
import { getInstagramAccessToken } from "@/lib/socialContent/instagramTokenStore";
import { sendTelegramMessage } from "@/lib/telegram";

function isAuthorized(req: NextApiRequest): boolean {
  const cronHeader = req.headers["x-vercel-cron"];
  if (cronHeader === "1") return true;

  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const authHeader = req.headers.authorization || "";
  return authHeader === `Bearer ${secret}`;
}

function todayId(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Genera y publica el contenido social del día:
 * 1. Elige un tema (rotando, sin repetir los últimos 5 días) y genera el
 *    copy con IA (ver generateCopy.ts).
 * 2. Renderiza un frame de marca vertical (9:16) vía @vercel/og.
 * 3. Lo convierte en un video corto (6s, zoom lento) con ffmpeg — ver
 *    renderVideo.ts para por qué no se usa Remotion/Chromium acá.
 * 4. Sube el video a Cloudinary y lo publica como Reel en Instagram y como
 *    video en TikTok (cualquiera de los dos que tenga credenciales
 *    configuradas; si a alguno le faltan, se guarda igual y se avisa).
 *
 * Idempotente por día: si ya existe un doc para hoy, no vuelve a generar
 * (evita duplicar posts si el cron se dispara más de una vez).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!isAuthorized(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const db = getAdminDb();
  if (!db) {
    return res.status(500).json({ error: "Firebase Admin SDK no configurado" });
  }

  const docId = todayId();
  const docRef = db.collection("socialContent").doc(docId);

  try {
    const existing = await docRef.get();
    if (existing.exists) {
      return res.status(200).json({ ok: true, skipped: true, reason: "already_generated_today", docId });
    }

    // Evitar repetir el mismo tema que los últimos 5 días.
    const recentSnap = await db
      .collection("socialContent")
      .orderBy("createdAt", "desc")
      .limit(5)
      .get();
    const recentTopics = recentSnap.docs
      .map((d) => d.data().topic as SocialTopic | undefined)
      .filter((t): t is SocialTopic => !!t);

    const topic = pickNextTopic(recentTopics);
    const copy = await generateSocialCopy(topic);

    const origin = getSiteOriginFromRequest(req.headers);
    const imageParams = new URLSearchParams({
      headline: copy.imageHeadline,
      subtext: copy.imageSubtext,
      format: "story",
    });
    const frameResp = await fetch(`${origin}/api/internal/renderSocialImage?${imageParams}`);
    if (!frameResp.ok) {
      throw new Error(`No se pudo renderizar el frame social (HTTP ${frameResp.status})`);
    }
    const frameBuffer = Buffer.from(await frameResp.arrayBuffer());

    const videoBuffer = await renderZoomVideoFromImage(frameBuffer);
    const videoUrl = await uploadBufferToCloudinary(videoBuffer, {
      folder: "fitplan-social",
      publicId: `social-${docId}`,
      resourceType: "video",
    });

    const instagramCaption = `${copy.instagramCaption}\n\n${copy.hashtags.map((h) => `#${h}`).join(" ")}`;
    const instagramAccessToken = await getInstagramAccessToken(db);
    const instagramResult = await postVideoToInstagram({
      videoUrl,
      caption: instagramCaption,
      accessToken: instagramAccessToken,
    });

    const tiktokCaption = `${copy.tiktokCaption}\n\n${copy.hashtags.map((h) => `#${h}`).join(" ")}`;
    const tiktokResult = await postVideoToTikTok({
      videoUrl,
      caption: tiktokCaption,
    });

    await docRef.set({
      date: docId,
      topic,
      copy,
      videoUrl,
      instagram: instagramResult,
      tiktok: tiktokResult,
      createdAt: FieldValue.serverTimestamp(),
    });

    const telegramLines = [
      `📱 Contenido social del día generado (${topic}):`,
      `"${copy.imageHeadline}"`,
      instagramResult.ok
        ? `✅ Publicado en Instagram (post ${instagramResult.platformPostId})`
        : `⚠️ Instagram: ${instagramResult.message}`,
      tiktokResult.ok
        ? `✅ Publicado en TikTok (post ${tiktokResult.platformPostId})`
        : `⚠️ TikTok: ${tiktokResult.message}`,
    ];
    await sendTelegramMessage(telegramLines.join("\n")).catch((err) => {
      console.warn("⚠️ No se pudo enviar notificación de Telegram de contenido social:", err);
    });

    return res.status(200).json({
      ok: true,
      docId,
      topic,
      videoUrl,
      instagram: instagramResult,
      tiktok: tiktokResult,
    });
  } catch (error) {
    console.error("Error generando contenido social diario:", error);
    const message = error instanceof Error ? error.message : String(error);
    await sendTelegramMessage(`❌ Falló la generación de contenido social del día: ${message}`).catch(() => {});
    return res.status(500).json({ error: "No se pudo generar el contenido social", detail: message });
  }
}
