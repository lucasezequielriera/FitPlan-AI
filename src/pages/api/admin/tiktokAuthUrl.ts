import type { NextApiRequest, NextApiResponse } from "next";
import { randomBytes } from "crypto";
import { requireAdmin } from "@/lib/adminAuthServer";
import { TIKTOK_OAUTH_STATE_COOKIE, TIKTOK_REDIRECT_URI } from "@/lib/socialContent/tiktokOAuth";

/**
 * Arma la URL de autorización de TikTok (Login Kit) y devuelve un `state`
 * anti-CSRF guardado en una cookie httpOnly de corta duración, que
 * callback.ts valida al volver. El admin hace `window.location.href = url`
 * con lo que devuelve este endpoint.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.error });
  }

  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  if (!clientKey) {
    return res.status(500).json({ error: "Falta TIKTOK_CLIENT_KEY" });
  }

  const state = randomBytes(24).toString("hex");
  res.setHeader(
    "Set-Cookie",
    `${TIKTOK_OAUTH_STATE_COOKIE}=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`
  );

  const params = new URLSearchParams({
    client_key: clientKey,
    response_type: "code",
    scope: "user.info.basic,video.publish",
    redirect_uri: TIKTOK_REDIRECT_URI,
    state,
  });

  return res.status(200).json({ url: `https://www.tiktok.com/v2/auth/authorize/?${params}` });
}
