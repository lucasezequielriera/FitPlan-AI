import type { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";
import { requireUser } from "@/lib/userAuthServer";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2025-11-17.clover",
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { session_id } = req.query;

  if (!session_id || typeof session_id !== "string") {
    return res.status(400).json({ error: "session_id es requerido" });
  }

  // Mismo tratamiento que ya tenía `checkPayment.ts` para MercadoPago (ver
  // AUDIT.md §0): sin esto, cualquiera con un `session_id` podía leer importe,
  // moneda, UID y datos de la suscripción de un cobro ajeno.
  const auth = await requireUser(req);
  if (!auth.ok) {
    return res.status(auth.status).json({
      error:
        auth.code === "unauthenticated"
          ? "Necesitas iniciar sesión para continuar con el pago"
          : "No se pudo verificar tu sesión",
    });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(500).json({ error: "Stripe no está configurado" });
  }

  try {
    // Obtener la sesión de checkout
    const session = await stripe.checkout.sessions.retrieve(session_id, {
      expand: ["payment_intent", "subscription"],
    });

    if (!session) {
      return res.status(404).json({ error: "Sesión no encontrada" });
    }

    const paymentIntent = session.payment_intent as Stripe.PaymentIntent | null;
    const subscription = session.subscription as Stripe.Subscription | null;

    // La sesión tiene que ser de quien pregunta. El checkout graba el UID en la
    // metadata de la sesión y en la de la suscripción (ver
    // createStripePayment.ts); se aceptan las dos, igual que hace la respuesta
    // de abajo, para no rechazar una sesión legítima que solo tenga una.
    const sessionUserId = session.metadata?.userId || subscription?.metadata?.userId || null;
    if (sessionUserId !== auth.uid) {
      return res.status(403).json({ error: "Este pago no corresponde a tu cuenta" });
    }
    const subscriptionCurrentPeriodEnd =
      subscription &&
      typeof (subscription as unknown as { current_period_end?: number }).current_period_end === "number"
        ? (subscription as unknown as { current_period_end: number }).current_period_end
        : null;
    const isSubscriptionCompleted = session.mode === "subscription" && session.status === "complete";
    const normalizedStatus =
      session.payment_status === "paid" || isSubscriptionCompleted ? "succeeded" : session.payment_status;

    return res.status(200).json({
      sessionId: session.id,
      status: normalizedStatus,
      amount: session.amount_total ? session.amount_total / 100 : 0,
      currency: session.currency?.toUpperCase() || "EUR",
      userId: session.metadata?.userId || subscription?.metadata?.userId || null,
      planType: session.metadata?.planType || subscription?.metadata?.planType || null,
      paymentIntentId: paymentIntent?.id || null,
      subscriptionId: subscription?.id || null,
      subscriptionStatus: subscription?.status || null,
      currentPeriodEnd: subscriptionCurrentPeriodEnd,
    });
  } catch (error: unknown) {
    console.error("Error al verificar pago de Stripe:", error);
    const message = error instanceof Error ? error.message : "Error desconocido";
    return res.status(500).json({ error: "Error al verificar el pago", detail: message });
  }
}

