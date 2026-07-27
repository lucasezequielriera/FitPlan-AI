import type { NextApiRequest, NextApiResponse } from "next";
import { getAdminDb } from "@/lib/firebase-admin";
import { getEurArsRateForPricing, roundArsPrice } from "@/lib/exchangeRate";
import { getStripeSubscriptionPlans, type PlanTypeKey } from "@/lib/stripePlanPrices";
import { isEligibleForFreeTrial } from "@/lib/premiumTrialEligibility";

type MercadoPagoPreapprovalResponse = {
  id?: string;
  init_point?: string;
  sandbox_init_point?: string;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { userId, userEmail, planType } = req.body;

  if (!userId || !userEmail) {
    return res.status(400).json({ error: "userId y userEmail son requeridos" });
  }

  if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
    return res.status(500).json({ error: "MercadoPago no está configurado. Falta MERCADOPAGO_ACCESS_TOKEN en las variables de entorno." });
  }

  const db = getAdminDb();
  if (!db) {
    return res.status(500).json({ error: "Firebase Admin SDK no configurado" });
  }

  // El precio objetivo real es el de la lista EUR (única fuente de verdad,
  // compartida con Stripe en stripePlanPrices.ts). El monto en ARS se deriva
  // de ese precio en EUR multiplicado por la cotización oficial cacheada
  // (ver src/lib/exchangeRate.ts) — así nunca vuelve a quedar desactualizado
  // como pasaba con el número fijo anterior ("1 EUR = 2000 ARS" hardcodeado).
  const eurPlans = getStripeSubscriptionPlans("eur");
  const selectedPlanKey: PlanTypeKey =
    planType === "quarterly" || planType === "annual" || planType === "monthly" ? planType : "monthly";
  const eurPlan = eurPlans[selectedPlanKey];

  const { rate: eurArsRate, source: rateSource } = await getEurArsRateForPricing(db);
  const arsAmount = roundArsPrice(eurPlan.price * eurArsRate);

  const planDescriptions: Record<PlanTypeKey, string> = {
    monthly: "Acceso premium mensual a objetivos avanzados, dietas personalizadas y análisis avanzado",
    quarterly: "Acceso premium trimestral (3 meses) - Ahorrás 20%",
    annual: "Acceso premium anual (12 meses) - Ahorrás 58%",
  };
  const selectedPlan = {
    price: arsAmount,
    title: eurPlan.title,
    description: planDescriptions[selectedPlanKey],
  };

  console.log(
    `💱 Precio ARS calculado para plan ${selectedPlanKey}: ${eurPlan.price} EUR × ${eurArsRate} (fuente: ${rateSource}) = ${arsAmount} ARS`
  );

  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    
    // Verificar que la URL base sea válida
    if (!baseUrl || baseUrl === "") {
      throw new Error("NEXT_PUBLIC_BASE_URL no está configurada");
    }

    const frequency = selectedPlanKey === "annual" ? 12 : selectedPlanKey === "quarterly" ? 3 : 1;
    const eligibleForTrial = await isEligibleForFreeTrial(db, userId);
    const autoRecurring: Record<string, unknown> = {
      frequency,
      frequency_type: "months",
      transaction_amount: selectedPlan.price,
      currency_id: "ARS",
    };
    if (eligibleForTrial) {
      // Primer mes gratis: MP cobra a partir del siguiente ciclo. Solo para
      // usuarios que nunca fueron premium (ver premiumTrialEligibility.ts) —
      // si no, cancelar y resuscribirse daría un trial infinito.
      autoRecurring.free_trial = {
        frequency: 1,
        frequency_type: "months",
      };
    }
    const preapprovalPayload: Record<string, unknown> = {
      reason: selectedPlan.title,
      external_reference: `${userId}|${selectedPlanKey}`,
      payer_email: userEmail,
      back_url: `${baseUrl}/payment/success?redirect=dashboard&provider=mercadopago`,
      status: "pending",
      auto_recurring: autoRecurring,
    };

    if (baseUrl && !baseUrl.includes("localhost")) {
      preapprovalPayload.notification_url = `${baseUrl}/api/payment/webhook`;
    }

    const preapprovalResponse = await fetch("https://api.mercadopago.com/preapproval", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(preapprovalPayload),
    });

    if (!preapprovalResponse.ok) {
      const detail = await preapprovalResponse.text();
      return res.status(preapprovalResponse.status).json({
        error: "No se pudo crear la suscripción en MercadoPago",
        detail,
      });
    }

    const response = (await preapprovalResponse.json()) as MercadoPagoPreapprovalResponse;
    const initPoint = response.init_point || response.sandbox_init_point;

    if (initPoint) {
      return res.status(200).json({
        init_point: initPoint,
        preapproval_id: response.id || null,
      });
    } else {
      return res.status(500).json({ error: "No se pudo crear el link de suscripción" });
    }
  } catch (error: unknown) {
    console.error("Error al crear suscripción en MercadoPago:", error);
    const message = error instanceof Error ? error.message : "Error desconocido";
    return res.status(500).json({ error: "Error al crear la suscripción", detail: message });
  }
}

