import type { PostResult } from "@/lib/socialContent/postToInstagram";

/**
 * Publica contenido en TikTok vía Content Posting API. TikTok exige que la
 * app pase su propio proceso de revisión para el scope `video.publish`
 * (más estricto y lento que el de Meta) — hasta que esté aprobado, todo lo
 * que se publique queda restringido a `SELF_ONLY` (privado, solo vos lo ves).
 *
 * Usa `source: "FILE_UPLOAD"` en vez de `PULL_FROM_URL`: TikTok exige que
 * las URLs de video vengan de un dominio propio verificado, y nuestros
 * videos están en Cloudinary (dominio que no controlamos) — así que en vez
 * de pasarle la URL, bajamos el video acá y se lo subimos directo como
 * bytes (un solo chunk, nuestros videos son chicos).
 *
 * Flujo:
 * 1. POST /v2/post/publish/video/init/ con post_info + source_info (tamaño del archivo)
 * 2. PUT del video completo al `upload_url` que devuelve el init
 * 3. TikTok procesa async — alcanza con loguear el publish_id (no se
 *    implementa polling de estado todavía)
 */
export async function postVideoToTikTok(params: {
  videoUrl: string;
  caption: string;
  accessToken?: string | null;
  openId?: string | null;
}): Promise<PostResult> {
  const accessToken = params.accessToken;
  const openId = params.openId;

  if (!accessToken || !openId) {
    return {
      ok: false,
      status: "not_configured",
      message: "TikTok no está conectado todavía (conectalo desde /admin/configuraciones/contenido-social). El contenido se generó pero no se publicó.",
    };
  }

  try {
    const videoResp = await fetch(params.videoUrl);
    if (!videoResp.ok) {
      return { ok: false, status: "error", message: `No se pudo descargar el video para subirlo a TikTok (HTTP ${videoResp.status}).` };
    }
    const videoBuffer = Buffer.from(await videoResp.arrayBuffer());

    const initResp = await fetch("https://open.tiktokapis.com/v2/post/publish/video/init/", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        post_info: {
          title: params.caption,
          privacy_level: "SELF_ONLY", // cambiar una vez aprobado el review de TikTok (video.publish auditado)
          disable_duet: false,
          disable_comment: false,
          disable_stitch: false,
        },
        source_info: {
          source: "FILE_UPLOAD",
          video_size: videoBuffer.length,
          chunk_size: videoBuffer.length,
          total_chunk_count: 1,
        },
      }),
    });
    const initData = await initResp.json();
    if (!initResp.ok || initData?.error?.code !== "ok") {
      return { ok: false, status: "error", message: `TikTok (publish/video/init) falló: ${JSON.stringify(initData)}` };
    }

    const publishId = String(initData.data?.publish_id || "");
    const uploadUrl = String(initData.data?.upload_url || "");
    if (!publishId || !uploadUrl) {
      return { ok: false, status: "error", message: `TikTok no devolvió publish_id/upload_url: ${JSON.stringify(initData)}` };
    }

    const putResp = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": "video/mp4",
        "Content-Length": String(videoBuffer.length),
        "Content-Range": `bytes 0-${videoBuffer.length - 1}/${videoBuffer.length}`,
      },
      body: videoBuffer,
    });
    if (!putResp.ok) {
      const detail = await putResp.text().catch(() => "");
      return { ok: false, status: "error", message: `TikTok (subida del archivo) falló: HTTP ${putResp.status} ${detail}` };
    }

    return { ok: true, platformPostId: publishId };
  } catch (error) {
    return {
      ok: false,
      status: "error",
      message: error instanceof Error ? error.message : String(error),
    };
  }
}
