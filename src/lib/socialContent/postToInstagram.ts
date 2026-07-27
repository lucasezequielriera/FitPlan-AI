export type PostResult =
  | { ok: true; platformPostId: string }
  | { ok: false; status: "not_configured" | "error"; message: string };

const API_VERSION = "v21.0";
const GRAPH_BASE = `https://graph.facebook.com/${API_VERSION}`;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Publica un container ya creado (paso 2, común a imagen y video). */
async function publishContainer(igUserId: string, creationId: string, accessToken: string): Promise<PostResult> {
  const publishResp = await fetch(
    `${GRAPH_BASE}/${igUserId}/media_publish?${new URLSearchParams({
      creation_id: creationId,
      access_token: accessToken,
    })}`,
    { method: "POST" }
  );
  const publishData = await publishResp.json();
  if (!publishResp.ok || !publishData.id) {
    return { ok: false, status: "error", message: `Instagram (publicar) falló: ${JSON.stringify(publishData)}` };
  }
  return { ok: true, platformPostId: String(publishData.id) };
}

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

  try {
    const createResp = await fetch(
      `${GRAPH_BASE}/${igUserId}/media?${new URLSearchParams({
        image_url: params.imageUrl,
        caption: params.caption,
        access_token: accessToken,
      })}`,
      { method: "POST" }
    );
    const createData = await createResp.json();
    if (!createResp.ok || !createData.id) {
      return { ok: false, status: "error", message: `Instagram (crear media) falló: ${JSON.stringify(createData)}` };
    }

    return await publishContainer(igUserId, createData.id, accessToken);
  } catch (error) {
    return { ok: false, status: "error", message: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Publica un video como Reel en Instagram vía Graph API. A diferencia de la
 * imagen, Instagram procesa/transcodea el video de forma asíncrona: hay que
 * crear el container, esperar a que su `status_code` pase a FINISHED, y
 * recién ahí publicarlo. El polling tiene un tope de tiempo para no colgar
 * la función serverless indefinidamente si Instagram tarda de más — si se
 * agota, el cron lo reporta como error (no rompe el resto del pipeline).
 *
 * Env vars: mismas que postImageToInstagram.
 */
export async function postVideoToInstagram(params: {
  videoUrl: string;
  caption: string;
  accessToken?: string | null;
  /** Tope de espera del procesamiento de Instagram, en ms (default 4 min). */
  maxWaitMs?: number;
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

  try {
    const createResp = await fetch(
      `${GRAPH_BASE}/${igUserId}/media?${new URLSearchParams({
        media_type: "REELS",
        video_url: params.videoUrl,
        caption: params.caption,
        access_token: accessToken,
      })}`,
      { method: "POST" }
    );
    const createData = await createResp.json();
    if (!createResp.ok || !createData.id) {
      return { ok: false, status: "error", message: `Instagram (crear media de video) falló: ${JSON.stringify(createData)}` };
    }
    const creationId = String(createData.id);

    const maxWaitMs = params.maxWaitMs ?? 4 * 60 * 1000;
    const pollIntervalMs = 3000;
    const deadline = Date.now() + maxWaitMs;

    while (Date.now() < deadline) {
      const statusResp = await fetch(
        `${GRAPH_BASE}/${creationId}?${new URLSearchParams({
          fields: "status_code",
          access_token: accessToken,
        })}`
      );
      const statusData = await statusResp.json();
      const statusCode = statusData?.status_code;

      if (statusCode === "FINISHED") {
        return await publishContainer(igUserId, creationId, accessToken);
      }
      if (statusCode === "ERROR") {
        return {
          ok: false,
          status: "error",
          message: `Instagram no pudo procesar el video (status_code ERROR): ${JSON.stringify(statusData)}`,
        };
      }
      // IN_PROGRESS / PUBLISHED (raro en este punto) / desconocido: seguir esperando.
      await sleep(pollIntervalMs);
    }

    return {
      ok: false,
      status: "error",
      message: `Instagram no terminó de procesar el video dentro de ${Math.round(maxWaitMs / 1000)}s (creation_id ${creationId}).`,
    };
  } catch (error) {
    return { ok: false, status: "error", message: error instanceof Error ? error.message : String(error) };
  }
}
