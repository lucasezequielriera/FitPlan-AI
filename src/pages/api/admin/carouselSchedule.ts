import type { NextApiRequest, NextApiResponse } from "next";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/adminAuthServer";
import { getCarouselSchedule, setCarouselSchedule, DEFAULT_PRICE_LABEL } from "@/lib/socialContent/carouselScheduleStore";

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Lee (GET) y guarda (POST) la configuración de carruseles automáticos. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const db = getAdminDb();
  if (!db) return res.status(500).json({ error: "Firebase Admin SDK no configurado" });

  if (req.method === "GET") {
    try {
      return res.status(200).json(await getCarouselSchedule(db));
    } catch (error) {
      console.error("Error leyendo la configuración de carruseles:", error);
      return res.status(500).json({ error: "No se pudo leer la configuración" });
    }
  }

  if (req.method === "POST") {
    const enabled = req.body?.enabled === true;
    const timesLocal = Array.isArray(req.body?.timesLocal) ? req.body.timesLocal : null;

    if (!timesLocal || !timesLocal.every((t: unknown) => typeof t === "string" && TIME_RE.test(t))) {
      return res.status(400).json({ error: "timesLocal debe ser un array de horarios HH:MM válidos" });
    }
    if (timesLocal.length > 6) {
      return res.status(400).json({ error: "Máximo 6 carruseles automáticos por día" });
    }

    const rawCount = Number(req.body?.slideCount);
    if (!Number.isFinite(rawCount) || rawCount < 3 || rawCount > 10) {
      return res.status(400).json({ error: "slideCount debe estar entre 3 y 10" });
    }

    const priceLabel = typeof req.body?.priceLabel === "string" ? req.body.priceLabel.trim() : "";
    if (priceLabel.length > 60) {
      return res.status(400).json({ error: "El texto de precio no puede pasar de 60 caracteres" });
    }

    try {
      await setCarouselSchedule(db, {
        enabled,
        timesLocal,
        slideCount: Math.round(rawCount),
        showPrice: req.body?.showPrice === true,
        priceLabel: priceLabel || DEFAULT_PRICE_LABEL,
      });
      return res.status(200).json({ ok: true });
    } catch (error) {
      console.error("Error guardando la configuración de carruseles:", error);
      return res.status(500).json({ error: "No se pudo guardar la configuración" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
