export type PostResult =
  | { ok: true; platformPostId: string }
  | { ok: false; status: "not_configured" | "error"; message: string };

/**
 * Publica una imagen en Instagram vía Graph API (cuenta Business/Creator).
 * Requiere que la app de Meta for Developers tenga el permiso
 * `instagram_content_publish` aprobado (App Review) — sin eso, esta llamada
 * va a fallar con un error de permisos aunque las credenciales sean válidas.
 *
 * Flujo Graph API (2 pasos):
 * 1. POST /{ig-user-id}/media (crea el "media container" con la imagen + caption)
 * 2. POST /{ig-user-id}/media_publish (publica el container creado)
 *
 * Env vars necesarias:
 * - INSTAGRAM_ACCESS_TOKEN: token de larga duración de la app de Meta (bootstrap
 *   inicial — una vez que el cron de renovación corre, el token vigente se lee
 *   de Firestore vía instagramTokenStore.ts y se pasa acá como `accessToken`).
 * - INSTAGRAM_BUSINESS_ACCOUNT_ID: ID de la cuenta de Instagram Business/Creator.
 */
export async function postImageToInstagram(params: {
  imageUrl: string;
  caption: string;
  /** Si no se pasa, cae a la env var INSTAGRAM_ACCESS_TOKEN. */
  accessToken?: string | null;
}): Promise<PostResult> {
  const accessToken = params.accessToken || process.env.INSTAGRAM_ACCESS_TOKEN;
  const igUserId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;

  if (!accessToken || !igUserId) {
    return {
      ok: false,
      status: "not_configured",
      message:
        "Instagram no está configurado todavía (faltan INSTAGRAM_ACCESS_TOKEN / INSTAGRAM_BUSINESS_ACCOUNT_ID). El contenido se generó pero no se publicó.",
    };
  }

  const apiVersion = "v21.0";
  const base = `https://graph.facebook.com/${apiVersion}`;

  try {
    const createResp = await fetch(
      `${base}/${igUserId}/media?${new URLSearchParams({
        image_url: params.imageUrl,
        caption: params.caption,
        access_token: accessToken,
      })}`,
      { method: "POST" }
    );
    const createData = await createResp.json();
    if (!createResp.ok || !createData.id) {
      return {
        ok: false,
        status: "error",
        message: `Instagram (crear media) falló: ${JSON.stringify(createData)}`,
      };
    }

    const publishResp = await fetch(
      `${base}/${igUserId}/media_publish?${new URLSearchParams({
        creation_id: createData.id,
        access_token: accessToken,
      })}`,
      { method: "POST" }
    );
    const publishData = await publishResp.json();
    if (!publishResp.ok || !publishData.id) {
      return {
        ok: false,
        status: "error",
        message: `Instagram (publicar) falló: ${JSON.stringify(publishData)}`,
      };
    }

    return { ok: true, platformPostId: String(publishData.id) };
  } catch (error) {
    return {
      ok: false,
      status: "error",
      message: error instanceof Error ? error.message : String(error),
    };
  }
}
