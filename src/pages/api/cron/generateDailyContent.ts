import type { NextApiRequest, NextApiResponse } from "next";
import { FieldValue, Timestamp, type Firestore, type DocumentSnapshot } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { pickNextTopic, type SocialTopic } from "@/lib/socialContent/topics";
import { generateSocialCopy, type SocialCopy } from "@/lib/socialContent/generateCopy";
import { buildCommercialPrompt } from "@/lib/socialContent/buildCommercialPrompt";
import { createCommercialSession, getSessionStatus, getVideoStatus } from "@/lib/socialContent/heygenVideoAgent";
import { uploadBufferToCloudinary } from "@/lib/socialContent/cloudinaryUpload";
import { postVideoToInstagram } from "@/lib/socialContent/postToInstagram";
import { postVideoToTikTok } from "@/lib/socialContent/postToTikTok";
import { getInstagramAccessToken } from "@/lib/socialContent/instagramTokenStore";
import { getStoredTikTokTokens } from "@/lib/socialContent/tiktokTokenStore";
import { getSocialSchedule, matchingSlotsNow, slotDocId } from "@/lib/socialContent/scheduleStore";
import { publishManualDraft } from "@/lib/socialContent/publishManualDraft";
import { sendTelegramMessage } from "@/lib/telegram";

// El cron corre cada 10 minutos (ver vercel.json + cron-job.org); la
// tolerancia cubre que el horario configurado no caiga justo en un tick y
// pequeños atrasos al disparar el cron.
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

/**
 * Arranca la generación de un reel (comercial elaborado vía HeyGen Video
 * Agent) para un horario que recién venció, y guarda el doc con
 * status "generating" — NO espera a que termine acá adentro: Video Agent
 * puede tardar varios minutos, mucho más de lo prudente para una sola
 * invocación serverless. `finalizeGeneratingDoc` es quien, en un tick
 * posterior, chequea si ya terminó y recién ahí sube/publica.
 */
async function startCommercialGeneration(db: Firestore, docId: string): Promise<void> {
  const recentSnap = await db.collection("socialContent").orderBy("createdAt", "desc").limit(5).get();
  const recentTopics = recentSnap.docs
    .map((d) => d.data().topic as SocialTopic | undefined)
    .filter((t): t is SocialTopic => !!t);

  const topic = pickNextTopic(recentTopics);
  const copy = await generateSocialCopy({ type: "rotation", topic });
  const prompt = buildCommercialPrompt(copy);
  const { sessionId, videoId } = await createCommercialSession(prompt);

  await db.collection("socialContent").doc(docId).set({
    date: docId,
    topic,
    copy,
    status: "generating",
    heygenSessionId: sessionId,
    heygenVideoId: videoId,
    createdAt: FieldValue.serverTimestamp(),
  });
}

/**
 * Chequea un doc en estado "generating": si HeyGen ya terminó el render,
 * descarga el video, lo sube a Cloudinary, publica en Instagram/TikTok y
 * marca el doc "published". Si sigue procesando, no hace nada (se vuelve a
 * chequear en el próximo tick). Si falló, marca "failed" y avisa por
 * Telegram.
 */
async function finalizeGeneratingDoc(db: Firestore, doc: DocumentSnapshot) {
  const data = doc.data() || {};
  const docId = doc.id;
  const topic = data.topic as string;
  const copy = data.copy as SocialCopy;
  let heygenVideoId = data.heygenVideoId as string | null;

  try {
    if (!heygenVideoId && data.heygenSessionId) {
      const session = await getSessionStatus(data.heygenSessionId);
      if (session.status === "failed") {
        throw new Error("La sesión de Video Agent falló antes de asignar un video.");
      }
      heygenVideoId = session.videoId;
      if (heygenVideoId) {
        await doc.ref.set({ heygenVideoId }, { merge: true });
      }
    }
    if (!heygenVideoId) {
      return { docId, status: "still_generating" as const };
    }

    const videoStatus = await getVideoStatus(heygenVideoId);
    if (videoStatus.status === "failed") {
      throw new Error(`HeyGen reportó el render como fallido (video_id ${heygenVideoId}).`);
    }
    if (videoStatus.status !== "completed" || !videoStatus.videoUrl) {
      return { docId, status: "still_generating" as const };
    }

    const videoResp = await fetch(videoStatus.videoUrl);
    if (!videoResp.ok) {
      throw new Error(`No se pudo descargar el video terminado de HeyGen (HTTP ${videoResp.status}).`);
    }
    const videoBuffer = Buffer.from(await videoResp.arrayBuffer());

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

    await doc.ref.set(
      {
        status: "published",
        videoUrl,
        instagram: instagramResult,
        tiktok: tiktokResult,
        publishedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

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
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error finalizando reel automático ${docId}:`, error);
    await doc.ref.set({ status: "failed", error: message, failedAt: FieldValue.serverTimestamp() }, { merge: true });
    await sendTelegramMessage(`❌ Falló la generación del reel automático "${topic}": ${message}`).catch(() => {});
    return { docId, ok: false, error: message };
  }
}

/**
 * Publica los borradores manuales (`socialContentManual`) que el admin
 * programó para un horario específico (botón "Programar para más tarde" en
 * /admin/configuraciones/contenido-social) y ya vencieron. A diferencia de
 * `startCommercialGeneration`, acá el video/copy ya existen — solo hay que
 * publicarlos.
 */
async function publishDueScheduledDrafts(db: Firestore, now: Date) {
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
 * Corre cada 10 minutos y hace tres cosas en cada tick, cada una acotada a
 * pocos segundos (nada de esperas largas dentro de la función):
 *
 * 1. Publica borradores manuales programados (`socialContentManual`) que ya
 *    vencieron.
 * 2. Revisa docs "generating" de ticks anteriores: si HeyGen ya terminó el
 *    comercial, lo sube y publica; si no, lo deja para el próximo tick.
 * 3. Para cada horario configurado que caiga en la ventana actual y todavía
 *    no tenga doc hoy, ARRANCA una generación nueva (rápido, solo crea la
 *    sesión de Video Agent) y la deja en "generating".
 *
 * El comercial de HeyGen Video Agent puede tardar varios minutos en
 * terminar — con el tick de 10 min, normalmente se resuelve 1-2 ticks
 * después de arrancar, no en la misma corrida.
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
    const results: unknown[] = [];

    results.push(...(await publishDueScheduledDrafts(db, now)));

    const generatingSnap = await db.collection("socialContent").where("status", "==", "generating").get();
    for (const doc of generatingSnap.docs) {
      results.push(await finalizeGeneratingDoc(db, doc));
    }

    const schedule = await getSocialSchedule(db);
    const matchingSlots = matchingSlotsNow(schedule, now, TICK_TOLERANCE_MINUTES);
    const dateId = todayId(now);

    for (const slot of matchingSlots) {
      const docId = slotDocId(dateId, slot);
      const docRef = db.collection("socialContent").doc(docId);
      const existing = await docRef.get();
      if (existing.exists) {
        results.push({ docId, skipped: true, reason: "already_generated" });
        continue;
      }
      await startCommercialGeneration(db, docId);
      results.push({ docId, started: true });
    }

    if (results.length === 0) {
      return res.status(200).json({ ok: true, skipped: true, reason: "no_matching_slot" });
    }

    return res.status(200).json({ ok: true, results });
  } catch (error) {
    console.error("Error en el tick de contenido social:", error);
    const message = error instanceof Error ? error.message : String(error);
    await sendTelegramMessage(`❌ Falló el tick de generación de contenido social: ${message}`).catch(() => {});
    return res.status(500).json({ error: "No se pudo procesar el contenido social", detail: message });
  }
}
