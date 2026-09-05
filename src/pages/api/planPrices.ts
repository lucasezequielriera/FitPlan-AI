import type { NextApiRequest, NextApiResponse } from "next";
import { getAdminDb } from "@/lib/firebase-admin";
import { getEurArsRateForPricing, roundArsPrice } from "@/lib/exchangeRate";
import {
  getPlanSavingsLabel,
  getStripeSubscriptionPlans,
  PLANS_EUR_UI,
  type PlanTypeKey,
} from "@/lib/stripePlanPrices";

/**
 * Precios en ARS para mostrar en el modal premium (MercadoPago).
 *
 * Existe porque el importe que realmente se cobra se deriva del precio EUR por
 * la cotización cacheada (ver `createPayment.ts`), mientras que el modal tenía
 * los importes en ARS escritos a mano. Con la cotización actual eso ya no
 * coincidía: el usuario veía un número y se le cobraba otro. Esta ruta hace que
 * el modal lea exactamente el mismo cálculo que usa el cobro.
 */

const PLAN_KEYS: PlanTypeKey[] = ["monthly", "quarterly", "annual"];

export type PlanPricesResponse = {
  currency: "ars";
  rate: number;
  rateSource: string;
  plans: Array<{
    type: PlanTypeKey;
    name: string;
    period: string;
    price: number;
    savings?: string;
    popular?: boolean;
  }>;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const db = getAdminDb();
  if (!db) {
    return res.status(500).json({ error: "Firebase Admin SDK no configurado" });
  }

  try {
    const eurPlans = getStripeSubscriptionPlans("eur");
    const { rate, source } = await getEurArsRateForPricing(db);

    const plans = PLAN_KEYS.map((key) => {
      const ui = PLANS_EUR_UI[key];
      return {
        type: key,
        name: ui.name,
        period: ui.period,
        price: roundArsPrice(eurPlans[key].price * rate),
        savings: getPlanSavingsLabel("eur", key),
        popular: "popular" in ui && ui.popular === true ? true : undefined,
      };
    });

    // Cache corto: la cotización se refresca por cron, no por request.
    res.setHeader("Cache-Control", "public, s-maxage=600, stale-while-revalidate=3600");
    return res.status(200).json({ currency: "ars", rate, rateSource: source, plans } satisfies PlanPricesResponse);
  } catch (error) {
    console.error("No se pudieron calcular los precios en ARS:", error);
    return res.status(500).json({ error: "No se pudieron calcular los precios" });
  }
}
