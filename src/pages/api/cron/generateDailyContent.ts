import type { NextApiRequest, NextApiResponse } from "next";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { getSiteOriginFromRequest } from "@/lib/requestSiteOrigin";
import { pickNextTopic, type SocialTopic } from "@/lib/socialContent/topics";
import { generateSocialCopy } from "@/lib/socialContent/generateCopy";
import { uploadBufferToCloudinary } from "@/lib/socialContent/cloudinaryUpload";
import { postImageToInstagram } from "@/lib/socialContent/postToInstagram";
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
 * Genera y publica el contenido social del día: elige un tema, genera copy
 * con IA, renderiza una imagen de marca, la sube a Cloudinary, y la publica
 * en Instagram (si hay credenciales configuradas). TikTok todavía no está
 * conectado acá — el pipeline de video (necesario para TikTok, que es una
 * red mayormente de video) es un paso siguiente, no construido en esta
 * pasada. Ver INSTAGRAM_ACCESS_TOKEN/INSTAGRAM_BUSINESS_ACCOUNT_ID en el
 * README para activar la publicación real.
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
    });
    const imageResp = await fetch(`${origin}/api/internal/renderSocialImage?${imageParams}`);
    if (!imageResp.ok) {
      throw new Error(`No se pudo renderizar la imagen social (HTTP ${imageResp.status})`);
    }
    const imageBuffer = Buffer.from(await imageResp.arrayBuffer());
    const imageUrl = await uploadBufferToCloudinary(imageBuffer, {
      folder: "fitplan-social",
      publicId: `social-${docId}`,
    });

    const instagramAccessToken = await getInstagramAccessToken(db);
    const instagramResult = await postImageToInstagram({
      imageUrl,
      caption: `${copy.instagramCaption}\n\n${copy.hashtags.map((h) => `#${h}`).join(" ")}`,
      accessToken: instagramAccessToken,
    });

    await docRef.set({
      date: docId,
      topic,
      copy,
      imageUrl,
      instagram: instagramResult,
      tiktok: { ok: false, status: "not_configured", message: "Pipeline de video no construido todavía." },
      createdAt: FieldValue.serverTimestamp(),
    });

    const telegramLines = [
      `📱 Contenido social del día generado (${topic}):`,
      `"${copy.imageHeadline}"`,
      instagramResult.ok
        ? `✅ Publicado en Instagram (post ${instagramResult.platformPostId})`
        : `⚠️ Instagram: ${instagramResult.message}`,
      `⏳ TikTok: pendiente (falta pipeline de video)`,
    ];
    await sendTelegramMessage(telegramLines.join("\n")).catch((err) => {
      console.warn("⚠️ No se pudo enviar notificación de Telegram de contenido social:", err);
    });

    return res.status(200).json({
      ok: true,
      docId,
      topic,
      imageUrl,
      instagram: instagramResult,
    });
  } catch (error) {
    console.error("Error generando contenido social diario:", error);
    const message = error instanceof Error ? error.message : String(error);
    await sendTelegramMessage(`❌ Falló la generación de contenido social del día: ${message}`).catch(() => {});
    return res.status(500).json({ error: "No se pudo generar el contenido social", detail: message });
  }
}
