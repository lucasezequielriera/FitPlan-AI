import type { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2025-11-17.clover",
});

type Provider = "stripe" | "mercadopago";
type PlanType = "monthly" | "quarterly" | "annual";

function inferProviderByCountry(country?: string | null): Provider {
  const c = (country || "").toLowerCase();
  return c.includes("argentina") ? "mercadopago" : "stripe";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { adminUserId, intakeClientId, provider, planType } = req.body as {
    adminUserId?: string;
    intakeClientId?: string;
    provider?: Provider;
    planType?: PlanType;
  };
  if (!adminUserId || !intakeClientId) return res.status(400).json({ error: "Faltan adminUserId e intakeClientId" });

  try {
    const db = getAdminDb();
    if (!db) return res.status(500).json({ error: "Firebase Admin SDK no configurado" });
    const adminDoc = await db.collection("usuarios").doc(adminUserId).get();
    const email = adminDoc.data()?.email?.toLowerCase() || "";
    if (!adminDoc.exists || email !== "admin@fitplan-ai.com") return res.status(403).json({ error: "Solo administradores" });

    const intakeRef = db.collection("intakeClients").doc(intakeClientId);
    const intakeDoc = await intakeRef.get();
    if (!intakeDoc.exists) return res.status(404).json({ error: "Cliente intake no encontrado" });
    const intake = intakeDoc.data() || {};
    const userEmail = (intake.email as string | undefined)?.trim();
    if (!userEmail) return res.status(400).json({ error: "El cliente no tiene email cargado" });

    const selectedPlan: PlanType = planType === "quarterly" || planType === "annual" ? planType : "monthly";
    const selectedProvider: Provider = provider || inferProviderByCountry((intake.pais as string | undefined) || null);
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    let link: string | null = null;

    if (selectedProvider === "stripe") {
      const planPrices: Record<PlanType, { price: number; title: string; currency: string }> = {
        monthly: { price: 5, currency: "eur", title: "Mensualidad asesoría personal - Lucas Riera" },
        quarterly: { price: 12, currency: "eur", title: "Trimestral asesoría personal - Lucas Riera" },
        annual: { price: 25, currency: "eur", title: "Anual asesoría personal - Lucas Riera" },
      };
      const p = planPrices[selectedPlan];
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        mode: "payment",
        customer_email: userEmail,
        line_items: [
          {
            price_data: {
              currency: p.currency,
              product_data: { name: p.title },
              unit_amount: Math.round(p.price * 100),
            },
            quantity: 1,
          },
        ],
        success_url: `${baseUrl}/payment/success?provider=stripe&redirect=dashboard`,
        cancel_url: `${baseUrl}/dashboard?payment=cancelled`,
        metadata: {
          paymentFlow: "intake_client",
          intakeClientId,
          planType: selectedPlan,
        },
      });
      link = session.url || null;
    } else {
      const planPrices: Record<PlanType, { price: number; title: string }> = {
        monthly: { price: 10000, title: "Mensualidad asesoría personal - Lucas Riera" },
        quarterly: { price: 24000, title: "Trimestral asesoría personal - Lucas Riera" },
        annual: { price: 50000, title: "Anual asesoría personal - Lucas Riera" },
      };
      const p = planPrices[selectedPlan];
      const prefPayload: Record<string, unknown> = {
        items: [{ title: p.title, quantity: 1, unit_price: p.price, currency_id: "ARS" }],
        payer: { email: userEmail },
        external_reference: `intake:${intakeClientId}|${selectedPlan}`,
        back_urls: {
          success: `${baseUrl}/payment/success?provider=mercadopago&redirect=dashboard`,
          failure: `${baseUrl}/dashboard?payment=cancelled`,
          pending: `${baseUrl}/dashboard?payment=pending`,
        },
        auto_return: "approved",
        notification_url: `${baseUrl}/api/payment/webhook`,
      };
      const mpResp = await fetch("https://api.mercadopago.com/checkout/preferences", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(prefPayload),
      });
      if (!mpResp.ok) {
        const detail = await mpResp.text();
        return res.status(mpResp.status).json({ error: "No se pudo crear preferencia MercadoPago", detail });
      }
      const data = (await mpResp.json()) as { init_point?: string; sandbox_init_point?: string };
      link = data.init_point || data.sandbox_init_point || null;
    }

    if (!link) return res.status(500).json({ error: "No se pudo crear el link de pago" });

    await intakeRef.set(
      {
        paymentStatus: "pending",
        paymentProvider: selectedProvider,
        paymentLink: link,
        paymentRequestedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return res.status(200).json({ ok: true, link, provider: selectedProvider, planType: selectedPlan });
  } catch (error) {
    console.error("Error creando link de pago para intake client:", error);
    return res.status(500).json({ error: "No se pudo crear el link de pago para el cliente" });
  }
}

