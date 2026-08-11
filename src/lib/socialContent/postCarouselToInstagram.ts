import type { PostResult } from "@/lib/socialContent/postToInstagram";

const GRAPH_BASE = "https://graph.facebook.com/v21.0";

/** Instagram acepta entre 2 y 10 imágenes por carrusel. */
export const CAROUSEL_MIN = 2;
export const CAROUSEL_MAX = 10;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Publica un carrusel de imágenes en Instagram.
 *
 * Son tres pasos en la Graph API, no uno:
 * 1. Un contenedor por imagen, con `is_carousel_item=true`.
 * 2. Un contenedor padre `media_type=CAROUSEL` con los hijos en orden.
 * 3. `media_publish` del contenedor padre.
 *
 * Las imágenes tienen que estar accesibles por URL pública (las subimos antes
 * a Cloudinary): Instagram las descarga por su cuenta, no se envían bytes.
 */
export async function postCarouselToInstagram(params: {
  imageUrls: string[];
  caption: string;
  accessToken?: string | null;
  /** Tope de espera del procesamiento del contenedor padre. */
  maxWaitMs?: number;
}): Promise<PostResult> {
  const accessToken = params.accessToken || process.env.INSTAGRAM_ACCESS_TOKEN;
  const igUserId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;

  if (!accessToken || !igUserId) {
    return {
      ok: false,
      status: "not_configured",
      message:
        "Instagram no está configurado todavía (faltan INSTAGRAM_ACCESS_TOKEN / INSTAGRAM_BUSINESS_ACCOUNT_ID). El carrusel se generó pero no se publicó.",
    };
  }

  const urls = params.imageUrls.filter((u) => typeof u === "string" && u.length > 0);
  if (urls.length < CAROUSEL_MIN || urls.length > CAROUSEL_MAX) {
    return {
      ok: false,
      status: "error",
      message: `Instagram admite entre ${CAROUSEL_MIN} y ${CAROUSEL_MAX} imágenes por carrusel, y se han pasado ${urls.length}.`,
    };
  }

  try {
    // 1. Un contenedor por imagen. En serie y no en paralelo: Instagram limita
    //    la tasa de creación de contenedores y responde 429 si se le disparan
    //    varias a la vez.
    const childIds: string[] = [];
    for (const imageUrl of urls) {
      const resp = await fetch(
        `${GRAPH_BASE}/${igUserId}/media?${new URLSearchParams({
          image_url: imageUrl,
          is_carousel_item: "true",
          access_token: accessToken,
        })}`,
        { method: "POST" }
      );
      const data = await resp.json();
      if (!resp.ok || !data.id) {
        return {
          ok: false,
          status: "error",
          message: `Instagram (crear imagen ${childIds.length + 1} del carrusel) falló: ${JSON.stringify(data)}`,
        };
      }
      childIds.push(String(data.id));
    }

    // 2. Contenedor padre con los hijos en orden.
    const parentResp = await fetch(
      `${GRAPH_BASE}/${igUserId}/media?${new URLSearchParams({
        media_type: "CAROUSEL",
        children: childIds.join(","),
        caption: params.caption,
        access_token: accessToken,
      })}`,
      { method: "POST" }
    );
    const parentData = await parentResp.json();
    if (!parentResp.ok || !parentData.id) {
      return { ok: false, status: "error", message: `Instagram (crear carrusel) falló: ${JSON.stringify(parentData)}` };
    }
    const creationId = String(parentData.id);

    // 3. Esperar a que el contenedor padre termine de procesarse. Igual que en
    //    los reels, un ERROR aislado puede ser transitorio y recuperarse, así
    //    que solo se abandona si persiste.
    const maxWaitMs = params.maxWaitMs ?? 120000;
    const deadline = Date.now() + maxWaitMs;
    const errorToleranceMs = 45000;
    let errorSince: number | null = null;

    while (Date.now() < deadline) {
      const statusResp = await fetch(
        `${GRAPH_BASE}/${creationId}?${new URLSearchParams({ fields: "status_code", access_token: accessToken })}`
      );
      const statusData = await statusResp.json();
      const statusCode = statusData?.status_code;

      if (statusCode === "FINISHED") break;

      if (statusCode === "ERROR") {
        errorSince = errorSince ?? Date.now();
        if (Date.now() - errorSince >= errorToleranceMs) {
          return {
            ok: false,
            status: "error",
            message: `Instagram no pudo procesar el carrusel (ERROR sostenido): ${JSON.stringify(statusData)}`,
          };
        }
      } else {
        errorSince = null;
      }

      await sleep(2500);
    }

    const publishResp = await fetch(
      `${GRAPH_BASE}/${igUserId}/media_publish?${new URLSearchParams({
        creation_id: creationId,
        access_token: accessToken,
      })}`,
      { method: "POST" }
    );
    const publishData = await publishResp.json();
    if (!publishResp.ok || !publishData.id) {
      return { ok: false, status: "error", message: `Instagram (publicar carrusel) falló: ${JSON.stringify(publishData)}` };
    }

    return { ok: true, platformPostId: String(publishData.id) };
  } catch (error) {
    return { ok: false, status: "error", message: error instanceof Error ? error.message : String(error) };
  }
}
