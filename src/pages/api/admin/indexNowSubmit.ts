import type { NextApiRequest, NextApiResponse } from "next";
import { requireAdmin } from "@/lib/adminAuthServer";
import { INDEXABLE_PATHS, submitUrlsToIndexNow } from "@/lib/seo/indexNow";

/**
 * Notifica a los buscadores compatibles con IndexNow (Bing, Yandex, Seznam…)
 * que el contenido ha cambiado, sin esperar a que pasen a rastrear.
 *
 * Sin cuerpo envía todas las páginas públicas indexables; con
 * `{ "urls": ["/ruta"] }` envía solo esas, que es lo habitual tras tocar una
 * página concreta.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const auth = await requireAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const bodyUrls = Array.isArray(req.body?.urls)
    ? req.body.urls.filter((u: unknown): u is string => typeof u === "string" && u.length > 0)
    : null;

  const urls = bodyUrls && bodyUrls.length > 0 ? bodyUrls : INDEXABLE_PATHS;

  try {
    const result = await submitUrlsToIndexNow(urls);
    return res.status(result.ok ? 200 : 502).json(result);
  } catch (error) {
    console.error("Error enviando URLs a IndexNow:", error);
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: "No se pudo contactar con IndexNow", detail: message });
  }
}
