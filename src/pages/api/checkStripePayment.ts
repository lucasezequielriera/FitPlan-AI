import type { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2024-11-20.acacia",
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { session_id } = req.query;

  if (!session_id || typeof session_id !== "string") {
    return res.status(400).json({ error: "session_id es requerido" });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(500).json({ error: "Stripe no está configurado" });
  }

  try {
    // Obtener la sesión de checkout
    const session = await stripe.checkout.sessions.retrieve(session_id, {
      expand: ["payment_intent"],
    });

    if (!session) {
      return res.status(404).json({ error: "Sesión no encontrada" });
    }

    const paymentIntent = session.payment_intent as Stripe.PaymentIntent | null;

    return res.status(200).json({
      sessionId: session.id,
      status: session.payment_status === "paid" ? "succeeded" : session.payment_status,
      amount: session.amount_total ? session.amount_total / 100 : 0,
      currency: session.currency?.toUpperCase() || "EUR",
      userId: session.metadata?.userId || null,
      planType: session.metadata?.planType || null,
      paymentIntentId: paymentIntent?.id || null,
    });
  } catch (error: unknown) {
    console.error("Error al verificar pago de Stripe:", error);
    const message = error instanceof Error ? error.message : "Error desconocido";
    return res.status(500).json({ error: "Error al verificar el pago", detail: message });
  }
}

