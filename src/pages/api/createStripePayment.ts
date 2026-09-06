import type { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";
import { getStripeSubscriptionPlans, type PlanTypeKey } from "@/lib/stripePlanPrices";
import { getCountryCodeFromRequest } from "@/lib/getCountryFromRequest";
import { getStripeCurrencyForCountry, usesMercadoPagoForCountry } from "@/lib/paymentUtils";
import { getAdminDb } from "@/lib/firebase-admin";
import { isEligibleForFreeTrial } from "@/lib/premiumTrialEligibility";
import { requireUser } from "@/lib/userAuthServer";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2025-11-17.clover",
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { planType } = req.body;

  // Identidad verificada: el UID se graba en `metadata.userId` de la sesión y de
  // la suscripción, que es lo que el webhook usa para decidir qué cuenta queda
  // premium — y además define la elegibilidad para el trial gratis. Aceptarlo
  // del body permitía abrir un checkout a nombre de otra persona.
  const auth = await requireUser(req);
  if (!auth.ok) {
    return res.status(auth.status).json({
      error:
        auth.code === "unauthenticated"
          ? "Necesitas iniciar sesión para continuar con el pago"
          : "No se pudo verificar tu sesión",
    });
  }
  const userId = auth.uid;

  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(500).json({ error: "Stripe no está configurado. Falta STRIPE_SECRET_KEY en las variables de entorno." });
  }

  const countryCode = await getCountryCodeFromRequest(req);
  if (usesMercadoPagoForCountry(countryCode)) {
    return res.status(400).json({
      error: "Para tu región el pago se procesa con MercadoPago. Vuelve a intentar desde el modal de planes.",
    });
  }

  const currency = getStripeCurrencyForCountry(countryCode);
  const planPrices = getStripeSubscriptionPlans(currency);

  const selectedPlanKey: PlanTypeKey =
    planType === "quarterly" || planType === "annual" || planType === "monthly" ? planType : "monthly";
  const selectedPlan = planPrices[selectedPlanKey];

  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

    if (!baseUrl || baseUrl === "") {
      throw new Error("NEXT_PUBLIC_BASE_URL no está configurada");
    }

    const intervalCount = selectedPlanKey === "annual" ? 12 : selectedPlanKey === "quarterly" ? 3 : 1;

    const db = getAdminDb();

    // El email del cliente sale del token; si el proveedor de identidad no lo
    // trae, se cae al de la cuenta en Firestore. Nunca del body.
    const userEmail =
      auth.email || (db ? ((await db.collection("usuarios").doc(userId).get()).data()?.email as string | undefined) : undefined);
    if (!userEmail) {
      return res.status(400).json({ error: "La cuenta no tiene un email asociado" });
    }

    // Solo dar el trial de 30 días a quien nunca fue premium — si no, cancelar
    // y resuscribirse daría un trial infinito (ver premiumTrialEligibility.ts).
    // Si el Admin SDK no está disponible, ser conservador y no dar trial.
    const eligibleForTrial = db ? await isEligibleForFreeTrial(db, userId) : false;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      payment_method_collection: "always",
      line_items: [
        {
          price_data: {
            currency: selectedPlan.currency,
            product_data: {
              name: selectedPlan.title,
              description: selectedPlan.description,
            },
            unit_amount: Math.round(selectedPlan.price * 100),
            recurring: {
              interval: "month",
              interval_count: intervalCount,
            },
          },
          quantity: 1,
        },
      ],
      mode: "subscription",
      customer_email: userEmail,
      subscription_data: {
        ...(eligibleForTrial ? { trial_period_days: 30 } : {}),
        metadata: {
          userId: userId,
          planType: selectedPlanKey,
          stripeCurrency: currency,
        },
      },
      success_url: `${baseUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}&provider=stripe&redirect=dashboard`,
      cancel_url: `${baseUrl}/dashboard?payment=cancelled`,
      metadata: {
        userId: userId,
        planType: selectedPlanKey,
        stripeCurrency: currency,
      },
    });

    if (session.url) {
      return res.status(200).json({
        url: session.url,
        session_id: session.id,
      });
    }
    return res.status(500).json({ error: "No se pudo crear la sesión de pago" });
  } catch (error: unknown) {
    console.error("Error al crear sesión de pago de Stripe:", error);
    const message = error instanceof Error ? error.message : "Error desconocido";
    return res.status(500).json({ error: "Error al crear la sesión de pago", detail: message });
  }
}
