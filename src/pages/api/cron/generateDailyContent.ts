import type { NextApiRequest, NextApiResponse } from "next";
import { FieldValue, Timestamp, type Firestore } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { pickNextTopic, type SocialTopic } from "@/lib/socialContent/topics";
import { generateSocialCopy } from "@/lib/socialContent/generateCopy";
import { buildAvatarSocialVideo } from "@/lib/socialContent/buildSocialVideo";
import { uploadBufferToCloudinary } from "@/lib/socialContent/cloudinaryUpload";
import { postVideoToInstagram } from "@/lib/socialContent/postToInstagram";
import { postVideoToTikTok } from "@/lib/socialContent/postToTikTok";
import { getInstagramAccessToken } from "@/lib/socialContent/instagramTokenStore";
import { getStoredTikTokTokens } from "@/lib/socialContent/tiktokTokenStore";
import { getSocialSchedule, matchingSlotsNow, slotDocId } from "@/lib/socialContent/scheduleStore";
import { publishManualDraft } from "@/lib/socialContent/publishManualDraft";
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

async function generateAndPublishOne(db: Firestore, docId: string) {
  const docRef = db.collection("socialContent").doc(docId);

  const recentSnap = await db.collection("socialContent").orderBy("createdAt", "desc").limit(5).get();
  const recentTopics = recentSnap.docs
    .map((d) => d.data().topic as SocialTopic | undefined)
    .filter((t): t is SocialTopic => !!t);

  const topic = pickNextTopic(recentTopics);
  const copy = await generateSocialCopy({ type: "rotation", topic });

  const videoBuffer = await buildAvatarSocialVideo(copy.narration);
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
    altText: copy.altText,
    accessToken: instagramAccessToken,
  });

  const tiktokTokens = await getStoredTikTokTokens(db);
  const tiktokResult = await postVideoToTikTok({
    videoUrl,
    caption: `${copy.tiktokCaption}\n\n${hashtagsLine}`,
    accessToken: tiktokTokens?.accessToken,
    openId: tiktokTokens?.openId,
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
 * Publica los borradores manuales (`socialContentManual`) que el admin
 * programó para un horario específico (botón "Programar para más tarde" en
 * /admin/configuraciones/contenido-social) y ya vencieron. A diferencia de
 * `generateAndPublishOne`, acá el video/copy ya existen — solo hay que
 * publicarlos.
 */
async function publishDueScheduledDrafts(db: Firestore, now: Date) {
  // Filtra solo por igualdad acá (índice de campo único, automático) y
  // compara `scheduledFor` en JS en vez de sumar un `where` de rango — evita
  // necesitar un índice compuesto para una colección que en la práctica
  // tiene pocos documentos "scheduled" pendientes a la vez.
  const scheduledSnap = await db.collection("socialContentManual").where("status", "==", "scheduled").get();
  const dueDocs = scheduledSnap.docs.filter((doc) => {
    const scheduledFor = doc.data().scheduledFor as Timestamp | undefined;
    return scheduledFor && scheduledFor.toMillis() <= now.getTime();
  });

  const results = [];
  for (const doc of dueDocs) {
    try {
      const result = await publishManualDraft(db, doc.id, "cron-scheduled");
      results.push({ draftId: doc.id, scheduled: true, ...result });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Error publicando borrador programado ${doc.id}:`, error);
      await sendTelegramMessage(`❌ Falló la publicación programada de un borrador manual (${doc.id}): ${message}`).catch(() => {});
      results.push({ draftId: doc.id, scheduled: true, ok: false, error: message });
    }
  }
  return results;
}

/**
 * Corre cada 10 minutos (vercel.json + GitHub Actions) y hace dos cosas en
 * cada tick: (1) publica cualquier borrador manual programado
 * (`socialContentManual` con status "scheduled") cuyo `scheduledFor` ya
 * llegó, sin importar la hora; y (2) genera/publica un reel automático por
 * cada horario configurado (`config/socialSchedule`, editable desde
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
    const now = new Date();
    const scheduledDraftResults = await publishDueScheduledDrafts(db, now);

    const schedule = await getSocialSchedule(db);
    const matchingSlots = matchingSlotsNow(schedule, now, TICK_TOLERANCE_MINUTES);

    if (matchingSlots.length === 0) {
      if (scheduledDraftResults.length === 0) {
        return res.status(200).json({ ok: true, skipped: true, reason: "no_matching_slot" });
      }
      return res.status(200).json({ ok: true, results: scheduledDraftResults });
    }

    const dateId = todayId(now);
    const results: unknown[] = [...scheduledDraftResults];

    for (const slot of matchingSlots) {
      const docId = slotDocId(dateId, slot);
      const docRef = db.collection("socialContent").doc(docId);
      const existing = await docRef.get();
      if (existing.exists) {
        results.push({ docId, skipped: true, reason: "already_generated" });
        continue;
      }
      const result = await generateAndPublishOne(db, docId);
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
