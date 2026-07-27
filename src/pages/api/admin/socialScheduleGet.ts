import type { NextApiRequest, NextApiResponse } from "next";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/adminAuthServer";
import { getSocialSchedule } from "@/lib/socialContent/scheduleStore";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
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

  try {
    const schedule = await getSocialSchedule(db);
    return res.status(200).json(schedule);
  } catch (error) {
    console.error("Error leyendo configuración de reels automáticos:", error);
    return res.status(500).json({ error: "No se pudo leer la configuración" });
  }
}
