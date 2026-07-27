import type { NextApiRequest, NextApiResponse } from "next";
import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { getSiteOriginFromRequest } from "@/lib/requestSiteOrigin";
import { pickNextTopic, type SocialTopic } from "@/lib/socialContent/topics";
import { generateSocialCopy } from "@/lib/socialContent/generateCopy";
import { buildSocialVideoFromScenes } from "@/lib/socialContent/buildSocialVideo";
import { uploadBufferToCloudinary } from "@/lib/socialContent/cloudinaryUpload";
import { postVideoToInstagram } from "@/lib/socialContent/postToInstagram";
import { postVideoToTikTok } from "@/lib/socialContent/postToTikTok";
import { getInstagramAccessToken } from "@/lib/socialContent/instagramTokenStore";
import { getSocialSchedule, matchingSlotsNow, slotDocId } from "@/lib/socialContent/scheduleStore";
import { sendTelegramMessage } from "@/lib/telegram";

// El cron corre cada 10 minutos (ver vercel.json); la tolerancia cubre que
// el horario configurado no caiga justo en un tick y pequeños atrasos de
// Vercel al disparar el cron.
const TICK_TOLERANCE_MINUTES = 6;

function isAuthorized(req: NextApiRequest): boolean {
  const cronHeader = req.headers["x-vercel-cron"];
  if (cronHeader === "1") return true;

  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const authHeader = req.headers.authorization || "";
  return authHeader === `Bearer ${secret}`;
}

function todayId(now: Date): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

async function generateAndPublishOne(db: Firestore, docId: string, origin: string) {
  const docRef = db.collection("socialContent").doc(docId);

  const recentSnap = await db.collection("socialContent").orderBy("createdAt", "desc").limit(5).get();
  const recentTopics = recentSnap.docs
    .map((d) => d.data().topic as SocialTopic | undefined)
    .filter((t): t is SocialTopic => !!t);

  const topic = pickNextTopic(recentTopics);
  const copy = await generateSocialCopy({ type: "rotation", topic });

  const videoBuffer = await buildSocialVideoFromScenes(copy.scenes, origin);
  const videoUrl = await uploadBufferToCloudinary(videoBuffer, {
    folder: "fitplan-social",
    publicId: `social-${docId}`,
    resourceType: "video",
  });

  const hashtagsLine = copy.hashtags.map((h) => `#${h}`).join(" ");
  const instagramAccessToken = await getInstagramAccessToken(db);
  const instagramResult = await postVideoToInstagram({
    videoUrl,
    caption: `${copy.instagramCaption}\n\n${hashtagsLine}`,
    accessToken: instagramAccessToken,
  });

  const tiktokResult = await postVideoToTikTok({
    videoUrl,
    caption: `${copy.tiktokCaption}\n\n${hashtagsLine}`,
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
    `📱 Reel automático generado (${topic}):`,
    `"${copy.scenes[0]?.headline || ""}"`,
    instagramResult.ok
      ? `✅ Publicado en Instagram (post ${instagramResult.platformPostId})`
      : `⚠️ Instagram: ${instagramResult.message}`,
    tiktokResult.ok ? `✅ Publicado en TikTok (post ${tiktokResult.platformPostId})` : `⚠️ TikTok: ${tiktokResult.message}`,
  ];
  await sendTelegramMessage(telegramLines.join("\n")).catch((err) => {
    console.warn("⚠️ No se pudo enviar notificación de Telegram de contenido social:", err);
  });

  return { docId, topic, videoUrl, instagram: instagramResult, tiktok: tiktokResult };
}

/**
 * Corre cada 10 minutos (vercel.json) y genera/publica un reel por cada
 * horario configurado (`config/socialSchedule`, editable desde
 * /admin/configuraciones/contenido-social) que caiga dentro de la ventana
 * actual y todavía no se haya generado hoy. Soporta múltiples reels por día
 * — cada horario tiene su propio doc idempotente
 * (`socialContent/{fecha}_{HHMM}`), así que aunque el cron dispare de nuevo
 * dentro de la misma ventana no duplica el post.
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

  try {
    const schedule = await getSocialSchedule(db);
    const now = new Date();
    const matchingSlots = matchingSlotsNow(schedule, now, TICK_TOLERANCE_MINUTES);

    if (matchingSlots.length === 0) {
      return res.status(200).json({ ok: true, skipped: true, reason: "no_matching_slot" });
    }

    const origin = getSiteOriginFromRequest(req.headers);
    const dateId = todayId(now);
    const results = [];

    for (const slot of matchingSlots) {
      const docId = slotDocId(dateId, slot);
      const docRef = db.collection("socialContent").doc(docId);
      const existing = await docRef.get();
      if (existing.exists) {
        results.push({ docId, skipped: true, reason: "already_generated" });
        continue;
      }
      const result = await generateAndPublishOne(db, docId, origin);
      results.push(result);
    }

    return res.status(200).json({ ok: true, results });
  } catch (error) {
    console.error("Error generando contenido social:", error);
    const message = error instanceof Error ? error.message : String(error);
    await sendTelegramMessage(`❌ Falló la generación de un reel automático: ${message}`).catch(() => {});
    return res.status(500).json({ error: "No se pudo generar el contenido social", detail: message });
  }
}
