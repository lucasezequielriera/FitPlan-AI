import type { NextApiRequest, NextApiResponse } from "next";
import { getAdminDb } from "@/lib/firebase-admin";
import { storeTikTokTokens } from "@/lib/socialContent/tiktokTokenStore";
import { TIKTOK_OAUTH_STATE_COOKIE, TIKTOK_REDIRECT_URI } from "@/lib/socialContent/tiktokOAuth";

const RETURN_PATH = "/admin/configuraciones/contenido-social";

function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {};
  return Object.fromEntries(
    header.split(";").map((part) => {
      const idx = part.indexOf("=");
      return [part.slice(0, idx).trim(), decodeURIComponent(part.slice(idx + 1).trim())];
    })
  );
}

/**
 * Recibe la redirección de TikTok después de que el admin autoriza la app
 * (Login Kit). Valida el `state` (cookie seteada por tiktokAuthUrl.ts) para
 * evitar CSRF, cambia el `code` por access_token/refresh_token/open_id, y
 * los guarda en Firestore (tiktokTokenStore.ts) — de ahí en más
 * postToTikTok.ts los usa para publicar.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Limpiar la cookie de state sin importar el resultado.
  res.setHeader("Set-Cookie", `${TIKTOK_OAUTH_STATE_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);

  const { code, state, error: tiktokError } = req.query;
  if (tiktokError) {
    return res.redirect(`${RETURN_PATH}?tiktok=error&message=${encodeURIComponent(String(tiktokError))}`);
  }

  const cookies = parseCookies(req.headers.cookie);
  const expectedState = cookies[TIKTOK_OAUTH_STATE_COOKIE];
  if (!expectedState || expectedState !== state) {
    return res.redirect(`${RETURN_PATH}?tiktok=error&message=${encodeURIComponent("state inválido (¿sesión expirada?)")}`);
  }

  if (typeof code !== "string" || !code) {
    return res.redirect(`${RETURN_PATH}?tiktok=error&message=${encodeURIComponent("Falta el código de autorización")}`);
  }

  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
  if (!clientKey || !clientSecret) {
    return res.redirect(`${RETURN_PATH}?tiktok=error&message=${encodeURIComponent("Faltan TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET")}`);
  }

  const db = getAdminDb();
  if (!db) {
    return res.redirect(`${RETURN_PATH}?tiktok=error&message=${encodeURIComponent("Firebase Admin SDK no configurado")}`);
  }

  try {
    const tokenResp = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_key: clientKey,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: TIKTOK_REDIRECT_URI,
      }),
    });
    const tokenData = await tokenResp.json();
    if (!tokenResp.ok || !tokenData.access_token) {
      throw new Error(JSON.stringify(tokenData));
    }

    await storeTikTokTokens(db, {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      openId: tokenData.open_id,
      expiresInSeconds: typeof tokenData.expires_in === "number" ? tokenData.expires_in : 86400,
    });

    return res.redirect(`${RETURN_PATH}?tiktok=connected`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error conectando TikTok:", message);
    return res.redirect(`${RETURN_PATH}?tiktok=error&message=${encodeURIComponent(message)}`);
  }
}
