import type { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { getStripeSubscriptionPlans, type PlanTypeKey } from "@/lib/stripePlanPrices";
import { getEurArsRateForPricing, roundArsPrice } from "@/lib/exchangeRate";
import { inferStripeCurrencyFromCountryLabel } from "@/lib/paymentUtils";
import { requireAdmin } from "@/lib/adminAuthServer";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2025-11-17.clover",
});

type Provider = "stripe" | "mercadopago";
type PlanType = "monthly" | "quarterly" | "annual";

function inferProviderByCountry(country?: string | null): Provider {
  const c = (country || "").toLowerCase();
  if (c.includes("argentina")) return "mercadopago";
  return "stripe";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.error });
  }

  const { targetUserId, provider, planType } = req.body as {
    targetUserId?: string;
    provider?: Provider;
    planType?: PlanType;
  };

  if (!targetUserId) {
    return res.status(400).json({ error: "Faltan datos requeridos: targetUserId" });
  }

  try {
    const db = getAdminDb();
    if (!db) return res.status(500).json({ error: "Firebase Admin SDK no configurado" });

    const userRef = db.collection("usuarios").doc(targetUserId);
    const userDoc = await userRef.get();
    if (!userDoc.exists) return res.status(404).json({ error: "Usuario no encontrado" });
    const userData = userDoc.data() || {};
    const userEmail = (userData.email as string | undefined)?.trim();
    if (!userEmail) return res.status(400).json({ error: "El usuario no tiene email cargado" });

    const selectedPlanType: PlanType =
      planType === "quarterly" || planType === "annual" || planType === "monthly" ? planType : "monthly";
    const selectedProvider: Provider =
      provider === "stripe" || provider === "mercadopago"
        ? provider
        : inferProviderByCountry((userData.pais as string | undefined) || null);

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    let link: string | null = null;

    if (selectedProvider === "stripe") {
      if (!process.env.STRIPE_SECRET_KEY) {
        return res.status(500).json({ error: "Falta STRIPE_SECRET_KEY" });
      }
      const stripeCurrency = inferStripeCurrencyFromCountryLabel((userData.pais as string | undefined) || null);
      const planPrices = getStripeSubscriptionPlans(stripeCurrency);
      const selectedPlan = planPrices[selectedPlanType as PlanTypeKey];
      const intervalCount = selectedPlanType === "annual" ? 12 : selectedPlanType === "quarterly" ? 3 : 1;
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        payment_method_collection: "always",
        line_items: [
          {
            price_data: {
              currency: selectedPlan.currency,
              product_data: { name: selectedPlan.title, description: selectedPlan.description },
              unit_amount: Math.round(selectedPlan.price * 100),
              recurring: { interval: "month", interval_count: intervalCount },
            },
            quantity: 1,
          },
        ],
        mode: "subscription",
        customer_email: userEmail,
        subscription_data: {
          trial_period_days: 30,
          metadata: { userId: targetUserId, planType: selectedPlanType },
        },
        success_url: `${baseUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}&provider=stripe&redirect=dashboard`,
        cancel_url: `${baseUrl}/dashboard?payment=cancelled`,
        metadata: { userId: targetUserId, planType: selectedPlanType },
      });
      link = session.url || null;
    } else {
      if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
        return res.status(500).json({ error: "Falta MERCADOPAGO_ACCESS_TOKEN" });
      }
      // El importe en ARS se deriva del precio EUR por la cotización cacheada,
      // igual que en createPayment.ts. Antes era una tabla fija (10.000/24.000/
      // 50.000 ARS) que quedó cobrando el precio viejo cuando cambió la lista.
      const eurPlansArs = getStripeSubscriptionPlans("eur");
      const { rate: eurArsRate } = await getEurArsRateForPricing(db);
      const selectedPlan = {
        price: roundArsPrice(eurPlansArs[selectedPlanType].price * eurArsRate),
        title: eurPlansArs[selectedPlanType].title,
      };
      const frequency = selectedPlanType === "annual" ? 12 : selectedPlanType === "quarterly" ? 3 : 1;
      const preapprovalPayload: Record<string, unknown> = {
        reason: selectedPlan.title,
        external_reference: `${targetUserId}|${selectedPlanType}`,
        payer_email: userEmail,
        back_url: `${baseUrl}/payment/success?redirect=dashboard&provider=mercadopago`,
        status: "pending",
        auto_recurring: {
          frequency,
          frequency_type: "months",
          transaction_amount: selectedPlan.price,
          currency_id: "ARS",
          free_trial: { frequency: 1, frequency_type: "months" },
        },
      };
      if (baseUrl && !baseUrl.includes("localhost")) {
        preapprovalPayload.notification_url = `${baseUrl}/api/payment/webhook`;
      }
      const mpResponse = await fetch("https://api.mercadopago.com/preapproval", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(preapprovalPayload),
      });
      if (!mpResponse.ok) {
        const detail = await mpResponse.text();
        return res.status(mpResponse.status).json({ error: "No se pudo crear link MercadoPago", detail });
      }
      const data = (await mpResponse.json()) as { init_point?: string; sandbox_init_point?: string };
      link = data.init_point || data.sandbox_init_point || null;
    }

    if (!link) return res.status(500).json({ error: "No se pudo generar el link de pago" });

    await userRef.set(
      {
        lastPaymentRequest: {
          provider: selectedProvider,
          planType: selectedPlanType,
          link,
          status: "pending",
          createdAt: FieldValue.serverTimestamp(),
        },
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return res.status(200).json({
      ok: true,
      provider: selectedProvider,
      planType: selectedPlanType,
      link,
    });
  } catch (error) {
    console.error("Error creando link de pago para usuario:", error);
    return res.status(500).json({ error: "No se pudo crear el link de pago" });
  }
}

