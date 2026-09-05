import type { NextApiRequest, NextApiResponse } from "next";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/adminAuthServer";
import { buildCarousel, MAX_SLIDES, MIN_SLIDES } from "@/lib/socialContent/buildCarousel";
import { getCarouselSchedule } from "@/lib/socialContent/carouselScheduleStore";

/**
 * Genera (pero NO publica) un carrusel de Instagram: copy + imágenes ya
 * subidas a Cloudinary, guardadas como borrador para que publicar después no
 * tenga que volver a renderizar. Instagram descarga las imágenes por URL, así
 * que tienen que ser públicas.
 *
 * Sin `topic`, el tema lo elige la IA. Sin `priceLabel`, se usa el que esté
 * configurado para los automáticos, para que ambos caminos digan lo mismo.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const auth = await requireAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const db = getAdminDb();
  if (!db) return res.status(500).json({ error: "Firebase Admin SDK no configurado" });

  const requested = Number(req.body?.slideCount);
  const slideCount = Number.isFinite(requested)
    ? Math.min(MAX_SLIDES, Math.max(MIN_SLIDES, Math.round(requested)))
    : 5;

  const topic = typeof req.body?.topic === "string" ? req.body.topic.trim() : "";
  const priceLabel = typeof req.body?.priceLabel === "string" ? req.body.priceLabel.trim() : "";

  try {
    const schedule = await getCarouselSchedule(db);
    const result = await buildCarousel(db, {
      topic: topic || undefined,
      slideCount,
      priceLabel: priceLabel || (schedule.showPrice ? schedule.priceLabel : ""),
      createdBy: auth.uid,
    });
    return res.status(200).json({ ok: true, ...result });
  } catch (error) {
    console.error("Error generando carrusel:", error);
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: "No se pudo generar el carrusel", detail: message });
  }
}
