import type { NextApiRequest, NextApiResponse } from "next";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/adminAuthServer";

const MONTH_NAMES_ES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

// Ajustes manuales puntuales para pagos que no quedaron asentados por webhook.
const MANUAL_MONTH_OVERRIDES: Record<string, { addArs?: number; addEur?: number; addPayments?: number }> = {
  "2026-03": {
    addEur: 1,
    addPayments: 1,
  },
};

/**
 * Ganancias mensuales agregadas para un año (colección admin, docs YYYY-MM).
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

    const { year: yearStr } = req.query;

    if (!yearStr) {
      return res.status(400).json({ error: "Falta parámetro: year" });
    }

    const year = parseInt(String(yearStr), 10);
    if (!Number.isFinite(year) || year < 2000 || year > 2100) {
      return res.status(400).json({ error: "Año inválido" });
    }

    const refs = Array.from({ length: 12 }, (_, i) => {
      const m = String(i + 1).padStart(2, "0");
      return db.collection("admin").doc(`${year}-${m}`);
    });

    const snapshots = await db.getAll(...refs);

    let yearlyTotalArs = 0;
    let yearlyTotalEur = 0;
    let yearlyLegacyTotal = 0;

    const months = snapshots.map((snap, i) => {
      const monthId = `${year}-${String(i + 1).padStart(2, "0")}`;
      const data = snap.exists ? snap.data() : undefined;
      const override = MANUAL_MONTH_OVERRIDES[monthId];
      const ars = typeof data?.totalEarningsArs === "number" ? data.totalEarningsArs : 0;
      const eur = typeof data?.totalEarningsEur === "number" ? data.totalEarningsEur : 0;
      const legacyTotal =
        typeof data?.totalEarnings === "number" ? data.totalEarnings : 0;
      const hasSplit =
        typeof data?.totalEarningsArs === "number" || typeof data?.totalEarningsEur === "number";
      const legacyOnly = !hasSplit && legacyTotal > 0;
      const paymentCountBase = typeof data?.paymentCount === "number" ? data.paymentCount : 0;

      const rowArs = (legacyOnly ? 0 : ars) + (override?.addArs || 0);
      const rowEur = (legacyOnly ? 0 : eur) + (override?.addEur || 0);
      const rowLegacy = legacyOnly ? legacyTotal : 0;
      const paymentCount = paymentCountBase + (override?.addPayments || 0);

      yearlyTotalArs += rowArs;
      yearlyTotalEur += rowEur;
      yearlyLegacyTotal += rowLegacy;

      return {
        monthIndex: i + 1,
        monthId,
        monthLabel: MONTH_NAMES_ES[i],
        totalEarningsArs: rowArs,
        totalEarningsEur: rowEur,
        legacyTotal: rowLegacy,
        paymentCount,
      };
    });

    return res.status(200).json({
      year,
      months,
      yearlyTotalArs,
      yearlyTotalEur,
      yearlyLegacyTotal,
    });
  } catch (error) {
    console.error("Error al obtener ganancias anuales:", error);
    return res.status(500).json({
      error: "Error al obtener ganancias anuales",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}
