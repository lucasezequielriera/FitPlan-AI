import type { NextApiRequest, NextApiResponse } from "next";
import { getAdminDb } from "@/lib/firebase-admin";
import { fetchLiveEurArsRate, cacheEurArsRate } from "@/lib/exchangeRate";

function isAuthorized(req: NextApiRequest): boolean {
  const cronHeader = req.headers["x-vercel-cron"];
  if (cronHeader === "1") return true;

  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const authHeader = req.headers.authorization || "";
  return authHeader === `Bearer ${secret}`;
}

/**
 * Refresca diariamente la cotización EUR/ARS cacheada que usa createPayment.ts
 * para fijar el precio en ARS del plan Premium. Ver src/lib/exchangeRate.ts.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!isAuthorized(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const db = getAdminDb();
    if (!db) {
      return res.status(500).json({ error: "Firebase Admin SDK no configurado" });
    }

    const rate = await fetchLiveEurArsRate();
    await cacheEurArsRate(db, rate);

    return res.status(200).json({ ok: true, rate });
  } catch (error) {
    console.error("Error actualizando cotización EUR/ARS en cron:", error);
    return res.status(500).json({ error: "No se pudo actualizar la cotización" });
  }
}
