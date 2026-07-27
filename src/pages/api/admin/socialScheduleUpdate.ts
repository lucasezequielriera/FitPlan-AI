import type { NextApiRequest, NextApiResponse } from "next";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/adminAuthServer";
import { setSocialSchedule } from "@/lib/socialContent/scheduleStore";

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.error });
  }

  const db = getAdminDb();
  if (!db) {
    return res.status(500).json({ error: "Firebase Admin SDK no configurado" });
  }

  const enabled = req.body?.enabled === true;
  const timesUtc = Array.isArray(req.body?.timesUtc) ? req.body.timesUtc : null;

  if (!timesUtc || !timesUtc.every((t: unknown) => typeof t === "string" && TIME_RE.test(t))) {
    return res.status(400).json({ error: "timesUtc debe ser un array de horarios HH:MM válidos" });
  }
  if (timesUtc.length > 10) {
    return res.status(400).json({ error: "Máximo 10 horarios por día" });
  }

  try {
    await setSocialSchedule(db, { enabled, timesUtc });
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Error guardando configuración de reels automáticos:", error);
    return res.status(500).json({ error: "No se pudo guardar la configuración" });
  }
}
