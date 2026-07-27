import type { PostResult } from "@/lib/socialContent/postToInstagram";

/**
 * Publica contenido en TikTok vía Content Posting API. TikTok exige que la
 * app pase su propio proceso de revisión para el scope `video.publish`
 * (más estricto y lento que el de Meta) — hasta que esté aprobado, esta
 * llamada puede quedar limitada a subir como borrador ("inbox") en vez de
 * publicar directo, según lo que TikTok haya aprobado para esta app.
 *
 * Flujo (init + subida por URL, ver docs de TikTok Content Posting API):
 * 1. POST /v2/post/publish/content/init/ con post_info + source_info (video_url)
 * 2. TikTok procesa async — el resultado final se puede consultar con
 *    /v2/post/publish/status/fetch/ (no implementado acá todavía: para un v1
 *    alcanza con disparar la publicación y loguear el publish_id).
 *
 * Env vars necesarias:
 * - TIKTOK_ACCESS_TOKEN: token de acceso de la app (scope video.publish).
 * - TIKTOK_OPEN_ID: identificador de la cuenta de TikTok conectada.
 */
export async function postVideoToTikTok(params: {
  videoUrl: string;
  caption: string;
}): Promise<PostResult> {
  const accessToken = process.env.TIKTOK_ACCESS_TOKEN;
  const openId = process.env.TIKTOK_OPEN_ID;

  if (!accessToken || !openId) {
    return {
      ok: false,
      status: "not_configured",
      message:
        "TikTok no está configurado todavía (faltan TIKTOK_ACCESS_TOKEN / TIKTOK_OPEN_ID). El contenido se generó pero no se publicó.",
    };
  }

  try {
    const resp = await fetch("https://open.tiktokapis.com/v2/post/publish/content/init/", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        post_info: {
          title: params.caption,
          privacy_level: "SELF_ONLY", // cambiar a PUBLIC_TO_EVERYONE una vez aprobado el scope de publicación directa
          disable_duet: false,
          disable_comment: false,
          disable_stitch: false,
        },
        source_info: {
          source: "PULL_FROM_URL",
          video_url: params.videoUrl,
        },
      }),
    });

    const data = await resp.json();
    if (!resp.ok || data?.error?.code !== "ok") {
      return {
        ok: false,
        status: "error",
        message: `TikTok (publish/content/init) falló: ${JSON.stringify(data)}`,
      };
    }

    return { ok: true, platformPostId: String(data.data?.publish_id || "unknown") };
  } catch (error) {
    return {
      ok: false,
      status: "error",
      message: error instanceof Error ? error.message : String(error),
    };
  }
}
