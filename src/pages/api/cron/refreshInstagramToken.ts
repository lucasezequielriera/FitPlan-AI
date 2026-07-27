import type { NextApiRequest, NextApiResponse } from "next";
import { getAdminDb } from "@/lib/firebase-admin";
import { getInstagramAccessToken, storeInstagramAccessToken } from "@/lib/socialContent/instagramTokenStore";
import { sendTelegramMessage } from "@/lib/telegram";

function isAuthorized(req: NextApiRequest): boolean {
  const cronHeader = req.headers["x-vercel-cron"];
  if (cronHeader === "1") return true;

  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const authHeader = req.headers.authorization || "";
  return authHeader === `Bearer ${secret}`;
}

/**
 * Renueva el token de acceso de larga duración de Instagram (dura ~60 días)
 * ANTES de que expire, para que la publicación diaria nunca se corte
 * silenciosamente. Corre diario; Meta permite refrescar un token de larga
 * duración vigente (no expirado) y devuelve uno nuevo con otros ~60 días.
 *
 * El nuevo token se guarda en Firestore (instagramTokenStore.ts), no en la
 * env var — una función serverless no puede reescribir las env vars de
 * Vercel en runtime, así que ese es el mecanismo real de persistencia acá.
 *
 * Env vars necesarias (además de las de Instagram ya configuradas):
 * - INSTAGRAM_APP_ID / INSTAGRAM_APP_SECRET: de tu app en Meta for Developers
 *   (Configuración > Básica). El App Secret NUNCA se loguea ni se expone.
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

  const appId = process.env.INSTAGRAM_APP_ID;
  const appSecret = process.env.INSTAGRAM_APP_SECRET;

  if (!appId || !appSecret) {
    const message = "No se pudo renovar el token de Instagram: faltan INSTAGRAM_APP_ID / INSTAGRAM_APP_SECRET.";
    console.error(`❌ ${message}`);
    await sendTelegramMessage(`❌ ${message}`).catch(() => {});
    return res.status(500).json({ error: message });
  }

  try {
    const currentToken = await getInstagramAccessToken(db);
    if (!currentToken) {
      throw new Error("No hay ningún token de Instagram configurado todavía (ni en Firestore ni en INSTAGRAM_ACCESS_TOKEN).");
    }

    const params = new URLSearchParams({
      grant_type: "fb_exchange_token",
      client_id: appId,
      client_secret: appSecret,
      fb_exchange_token: currentToken,
    });
    const resp = await fetch(`https://graph.facebook.com/v21.0/oauth/access_token?${params}`);
    const data = await resp.json();

    if (!resp.ok || typeof data.access_token !== "string") {
      throw new Error(`Meta respondió con error al renovar el token: ${JSON.stringify(data)}`);
    }

    const expiresIn = typeof data.expires_in === "number" ? data.expires_in : 60 * 24 * 60 * 60; // fallback 60 días
    await storeInstagramAccessToken(db, data.access_token, expiresIn);

    const expiresAtLabel = new Date(Date.now() + expiresIn * 1000).toISOString().slice(0, 10);
    console.log(`✅ Token de Instagram renovado, vence aproximadamente el ${expiresAtLabel}`);

    return res.status(200).json({ ok: true, expiresAt: expiresAtLabel });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("❌ Error renovando el token de Instagram:", message);
    await sendTelegramMessage(
      `❌ Falló la renovación automática del token de Instagram: ${message}\n\nSi no se soluciona antes de que venza el token actual, el contenido diario va a dejar de publicarse en Instagram.`
    ).catch(() => {});
    return res.status(500).json({ error: "No se pudo renovar el token de Instagram", detail: message });
  }
}
