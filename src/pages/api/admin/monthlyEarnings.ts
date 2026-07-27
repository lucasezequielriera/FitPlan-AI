import type { NextApiRequest, NextApiResponse } from "next";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/adminAuthServer";
import { getEurArsRateForPricing } from "@/lib/exchangeRate";

/**
 * API para obtener las ganancias mensuales reales desde Firestore (solo admin)
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) {
      return res.status(auth.status).json({ error: auth.error });
    }

    const db = getAdminDb();
    if (!db) {
      return res.status(500).json({ error: "Firebase Admin SDK no configurado" });
    }

    const { monthId } = req.query;

    if (!monthId) {
      return res.status(400).json({ error: "Falta parámetro: monthId" });
    }

    // Obtener las ganancias del mes desde la colección admin
    const adminMonthRef = db.collection("admin").doc(monthId as string);
    const adminMonthDoc = await adminMonthRef.get();

    if (!adminMonthDoc.exists) {
      // Si no existe el documento, retornar 0
      return res.status(200).json({
        monthId: monthId as string,
        totalEarnings: 0,
        paymentCount: 0,
      });
    }

    const data = adminMonthDoc.data();
    const ars = typeof data?.totalEarningsArs === "number" ? data.totalEarningsArs : 0;
    const eur = typeof data?.totalEarningsEur === "number" ? data.totalEarningsEur : 0;
    const legacy = typeof data?.totalEarnings === "number" ? data.totalEarnings : 0;
    const hasSplit =
      typeof data?.totalEarningsArs === "number" || typeof data?.totalEarningsEur === "number";
    const totalEarningsArs = hasSplit ? ars : legacy;
    const totalEarningsEur = hasSplit ? eur : 0;
    const paymentCount = data?.paymentCount || 0;

    // Cotización cacheada (ver src/lib/exchangeRate.ts) en vez del "* 2000"
    // hardcodeado anterior, que quedaba desactualizado con el tiempo.
    const { rate: eurArsRate } = await getEurArsRateForPricing(db);

    return res.status(200).json({
      monthId: monthId as string,
      totalEarningsArs,
      totalEarningsEur,
      /** Compat: suma aproximada en “pesos equivalentes” para la tarjeta del panel */
      totalEarnings: totalEarningsArs + totalEarningsEur * eurArsRate,
      paymentCount,
    });
  } catch (error) {
    console.error("Error al obtener ganancias mensuales:", error);
    return res.status(500).json({ 
      error: "Error al obtener ganancias mensuales",
      detail: error instanceof Error ? error.message : String(error)
    });
  }
}

