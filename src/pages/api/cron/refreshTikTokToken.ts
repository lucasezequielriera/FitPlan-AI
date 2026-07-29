import type { NextApiRequest, NextApiResponse } from "next";
import { getAdminDb } from "@/lib/firebase-admin";
import { getStoredTikTokTokens, storeTikTokTokens } from "@/lib/socialContent/tiktokTokenStore";
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
 * Renueva el access_token de TikTok ANTES de que expire — a diferencia del
 * de Instagram (~60 días), este dura apenas 24hs, así que corre diario para
 * tener margen de sobra. El refresh_token dura 365 días y TikTok puede
 * devolver uno nuevo en la respuesta (hay que guardar siempre el que
 * devuelva, no asumir que es el mismo).
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

  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
  if (!clientKey || !clientSecret) {
    // TikTok todavía no está conectado — no es un error, simplemente no hay nada que renovar.
    return res.status(200).json({ ok: true, skipped: true, reason: "tiktok_not_configured" });
  }

  try {
    const stored = await getStoredTikTokTokens(db);
    if (!stored) {
      return res.status(200).json({ ok: true, skipped: true, reason: "tiktok_not_connected" });
    }

    const resp = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_key: clientKey,
        client_secret: clientSecret,
        grant_type: "refresh_token",
        refresh_token: stored.refreshToken,
      }),
    });
    const data = await resp.json();
    if (!resp.ok || !data.access_token) {
      throw new Error(JSON.stringify(data));
    }

    await storeTikTokTokens(db, {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || stored.refreshToken,
      openId: data.open_id || stored.openId,
      expiresInSeconds: typeof data.expires_in === "number" ? data.expires_in : 86400,
    });

    console.log("✅ Token de TikTok renovado.");
    return res.status(200).json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("❌ Error renovando el token de TikTok:", message);
    await sendTelegramMessage(
      `❌ Falló la renovación automática del token de TikTok: ${message}\n\nSi no se soluciona antes de que venza el token actual (24hs), la publicación en TikTok va a dejar de funcionar hasta reconectar desde /admin/configuraciones/contenido-social.`
    ).catch(() => {});
    return res.status(500).json({ error: "No se pudo renovar el token de TikTok", detail: message });
  }
}
