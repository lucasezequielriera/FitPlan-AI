import type { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";
import { getAdminDb } from "@/lib/firebase-admin";
import { recordStripeMonthlyEarningIfNew } from "@/lib/adminMonthlyEarningsStripe";
import { FieldValue, Timestamp as AdminTimestamp, type Firestore } from "firebase-admin/firestore";
import { sendTelegramMessage, formatPaymentMessage } from "@/lib/telegram";
import { alertarActivacionFallida } from "@/lib/payments/activationAlert";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2025-11-17.clover",
});

// Stripe requiere el body raw para verificar la firma
export const config = {
  api: {
    bodyParser: false,
  },
};

async function sendPremiumWelcomeChatMessage(params: {
  userId: string;
  nombre: string | null;
  userName: string | null;
  userEmail: string | null;
  db: Firestore;
}): Promise<void> {
  const nombreCliente = params.nombre?.trim() || "Cliente";
  await params.db.collection("mensajes").add({
    userId: params.userId,
    userName: params.userName || null,
    userEmail: params.userEmail || null,
    subject: "Bienvenido a Premium",
    message: "Iniciado automáticamente tras pago premium",
    read: true,
    replied: true,
    closed: false,
    initiatedByAdmin: true,
    userRead: false,
    replies: [
      {
        message: `Hola ${nombreCliente}, ¡bienvenido a FitPlan Premium! Ya activamos tu acceso premium. Si necesitas ayuda para empezar, escríbenos por este chat y te acompañamos.`,
        senderName: "admin",
        senderType: "admin",
        createdAt: new Date(),
      },
    ],
    createdAt: FieldValue.serverTimestamp(),
    lastReplyAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
}

async function createAdminPaymentNotification(params: {
  db: Firestore;
  userId: string;
  userName?: string | null;
  userEmail?: string | null;
  provider: "stripe";
  amount: number;
  currency: string;
  planType: string;
  paymentId: string;
}) {
  await params.db.collection("adminNotifications").add({
    type: "payment_success",
    read: false,
    userId: params.userId,
    userName: params.userName || null,
    userEmail: params.userEmail || null,
    provider: params.provider,
    amount: params.amount,
    currency: params.currency,
    planType: params.planType,
    paymentId: params.paymentId,
    createdAt: FieldValue.serverTimestamp(),
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const sig = req.headers["stripe-signature"];

  if (!sig) {
    return res.status(400).json({ error: "No se encontró la firma de Stripe" });
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error("STRIPE_WEBHOOK_SECRET no configurado");
    return res.status(500).json({ error: "Webhook secret no configurado" });
  }

  let event: Stripe.Event;

  try {
    // Leer el body como buffer
    const buf = await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      req.on("data", (chunk: Buffer) => {
        chunks.push(chunk);
      });
      req.on("end", () => {
        resolve(Buffer.concat(chunks));
      });
      req.on("error", reject);
    });

    // Verificar la firma del webhook
    event = stripe.webhooks.constructEvent(buf, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Error al verificar webhook de Stripe:", err);
    return res.status(400).json({ error: `Webhook Error: ${err instanceof Error ? err.message : "Unknown error"}` });
  }

  console.log("🔔 Webhook recibido de Stripe:", event.type);

  try {
    const adminDb = getAdminDb();
    if (!adminDb) {
      console.error("❌ Firebase Admin SDK no configurado");
      return res.status(200).json({ received: true });
    }

    const resolveExpiryByPlan = (baseDate: Date, planType: string): Date => {
      const expiresAt = new Date(baseDate);
      if (planType === "annual") {
        expiresAt.setFullYear(expiresAt.getFullYear() + 1);
      } else if (planType === "quarterly") {
        expiresAt.setMonth(expiresAt.getMonth() + 3);
      } else {
        expiresAt.setMonth(expiresAt.getMonth() + 1);
      }
      return expiresAt;
    };

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.metadata?.paymentFlow === "intake_client" && session.metadata?.intakeClientId) {
        const intakeClientId = session.metadata.intakeClientId;
        const amountTotal = typeof session.amount_total === "number" ? session.amount_total / 100 : 0;
        const currency = session.currency?.toUpperCase() || "EUR";
        // La misma protección que la activación de premium (#13), aplicada al
        // flujo B2B. Esta escritura es la que hace que el cliente conste como
        // pagado; si falla y devolvemos 200, Stripe da el evento por entregado y
        // no reintenta: cobrado y sin registrar, sin que nadie se entere (#42).
        try {
          await adminDb.collection("intakeClients").doc(intakeClientId).set(
            {
              paymentStatus: "paid",
              paymentProvider: "stripe",
              paymentLastPaidAt: FieldValue.serverTimestamp(),
              paymentCurrentMonthPaid: true,
              paymentLastAmount: amountTotal,
              paymentLastCurrency: currency,
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
        } catch (error: unknown) {
          console.error(`❌ CRÍTICO: checkout ${session.id} cobrado pero NO se pudo marcar como pagado al cliente ${intakeClientId}:`, error);
          await alertarActivacionFallida({
            proveedor: "Stripe",
            paymentId: String(session.id),
            userId: intakeClientId,
            userEmail: session.customer_details?.email ?? null,
            error,
            accion: "registrar-cobro-b2b",
          });
          return res.status(500).json({ error: "No se pudo registrar el cobro del cliente", retry: true });
        }

        // Lo que sigue son efectos secundarios: el cobro ya consta. Si fallan,
        // se responde 200 igual — un reintento reescribiría lo ya escrito y
        // duplicaría la notificación, que es peor que perderla.
        try {
          await adminDb.collection("adminNotifications").add({
            type: "payment_success",
            read: false,
            flow: "intake_client",
            intakeClientId,
            provider: "stripe",
            amount: amountTotal,
            currency,
            paymentId: session.id,
            createdAt: FieldValue.serverTimestamp(),
          });
        } catch (notifErr) {
          console.warn("⚠️ No se pudo crear la notificación admin (intake Stripe):", notifErr);
        }
        try {
          const paidAt =
            typeof session.created === "number" ? new Date(session.created * 1000) : new Date();
          const inv = session.invoice;
          const ledgerKey =
            typeof inv === "string"
              ? inv
              : inv && typeof inv === "object" && "id" in inv
                ? String((inv as { id: string }).id)
                : `cs_${session.id}`;
          await recordStripeMonthlyEarningIfNew(adminDb, ledgerKey, paidAt, amountTotal);
        } catch (ledgerErr) {
          console.warn("⚠️ No se pudo registrar ganancia mensual (intake Stripe):", ledgerErr);
        }
        return res.status(200).json({ received: true });
      }

      const userId = session.metadata?.userId;
      const planType = session.metadata?.planType || "monthly";
      const subscriptionId = typeof session.subscription === "string" ? session.subscription : null;
      if (!userId || !subscriptionId) {
        return res.status(200).json({ received: true });
      }

      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const userRef = adminDb.collection("usuarios").doc(userId);
      const userDoc = await userRef.get();
      if (!userDoc.exists) return res.status(200).json({ received: true });
      const userData = userDoc.data() || {};
      const wasPremium = userData.premium === true;
      const welcomeAlreadySent = typeof userData.premiumWelcomeChatSentAt !== "undefined";
      const currentPeriodEnd =
        typeof (subscription as unknown as { current_period_end?: number }).current_period_end === "number"
          ? (subscription as unknown as { current_period_end: number }).current_period_end
          : null;
      const expiresAt =
        typeof currentPeriodEnd === "number"
          ? new Date(currentPeriodEnd * 1000)
          : resolveExpiryByPlan(new Date(), planType);

      // La escritura que activa premium se aísla del catch exterior, que
      // responde 200 pase lo que pase. Si falla y devolvemos 200, Stripe da el
      // evento por entregado y no reintenta: el usuario paga y no recibe nada,
      // sin que nadie se entere (issue #13).
      try {
        await userRef.set(
          {
            premium: true,
            premiumStatus: subscription.status === "trialing" ? "trialing" : "active",
            premiumPlanType: planType,
            premiumExpiresAt: AdminTimestamp.fromDate(expiresAt),
            premiumStripeSubscriptionId: subscription.id,
            updatedAt: FieldValue.serverTimestamp(),
            ...(wasPremium ? {} : { premiumSince: FieldValue.serverTimestamp() }),
          },
          { merge: true }
        );
      } catch (error: unknown) {
        console.error(`❌ CRÍTICO: checkout ${session.id} cobrado pero NO se pudo activar premium a ${userId}:`, error);
        await alertarActivacionFallida({
          proveedor: "Stripe",
          paymentId: String(session.id),
          userId,
          userEmail: session.customer_details?.email ?? null,
          error,
        });
        return res.status(500).json({ error: "No se pudo activar premium", retry: true });
      }

      const checkoutAmount = typeof session.amount_total === "number" ? session.amount_total / 100 : 0;
      const checkoutCurrency = session.currency?.toUpperCase() || "EUR";
      await createAdminPaymentNotification({
        db: adminDb,
        userId,
        userName: typeof userData?.nombre === "string" ? userData.nombre : null,
        userEmail: typeof userData?.email === "string" ? userData.email : null,
        provider: "stripe",
        amount: checkoutAmount,
        currency: checkoutCurrency,
        planType,
        paymentId: session.id,
      }).catch((err) => {
        console.warn("⚠️ Error al crear notificación admin de pago Stripe:", err);
      });

      try {
        const paidAt =
          typeof session.created === "number" ? new Date(session.created * 1000) : new Date();
        const invoiceRef = session.invoice;
        const ledgerKey =
          typeof invoiceRef === "string"
            ? invoiceRef
            : invoiceRef && typeof invoiceRef === "object" && "id" in invoiceRef
              ? String((invoiceRef as { id: string }).id)
              : null;
        if (ledgerKey && checkoutAmount > 0) {
          await recordStripeMonthlyEarningIfNew(adminDb, ledgerKey, paidAt, checkoutAmount);
        }
      } catch (ledgerErr) {
        console.warn("⚠️ No se pudo registrar ganancia mensual (checkout Stripe):", ledgerErr);
      }

      if (!wasPremium || !welcomeAlreadySent) {
        try {
          const userEmail = typeof userData?.email === "string" ? userData.email.trim() : null;
          await sendPremiumWelcomeChatMessage({
            userId,
            nombre: typeof userData?.nombre === "string" ? userData.nombre : null,
            userName: typeof userData?.nombre === "string" ? userData.nombre : null,
            userEmail,
            db: adminDb,
          });
          await userRef.set({ premiumWelcomeChatSentAt: FieldValue.serverTimestamp() }, { merge: true });
        } catch (chatError) {
          console.warn("⚠️ No se pudo enviar mensaje de bienvenida premium por chat:", chatError);
        }
      }
    }

    if (event.type === "invoice.paid") {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId =
        typeof (invoice as unknown as { subscription?: string }).subscription === "string"
          ? (invoice as unknown as { subscription: string }).subscription
          : null;
      if (!subscriptionId) return res.status(200).json({ received: true });
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const userId = subscription.metadata?.userId;
      const planType = subscription.metadata?.planType || "monthly";
      if (!userId) return res.status(200).json({ received: true });

      const userRef = adminDb.collection("usuarios").doc(userId);
      const userDoc = await userRef.get();
      if (!userDoc.exists) return res.status(200).json({ received: true });
      const userData = userDoc.data() || {};

      const amount = typeof invoice.amount_paid === "number" ? invoice.amount_paid / 100 : 0;
      const currency = invoice.currency?.toUpperCase() || "EUR";
      const paymentDate =
        typeof invoice.status_transitions?.paid_at === "number"
          ? new Date(invoice.status_transitions.paid_at * 1000)
          : new Date();
      const currentPeriodEnd =
        typeof (subscription as unknown as { current_period_end?: number }).current_period_end === "number"
          ? (subscription as unknown as { current_period_end: number }).current_period_end
          : null;
      const expiresAt =
        typeof currentPeriodEnd === "number"
          ? new Date(currentPeriodEnd * 1000)
          : resolveExpiryByPlan(paymentDate, planType);

      // isNewInvoicePayment es el guard de idempotencia: Stripe puede reentregar el
      // mismo evento de webhook más de una vez (comportamiento documentado), y solo
      // la primera entrega de esta invoice debe reenviar Telegram / notificaciones.
      // El ledger (recordStripeMonthlyEarningIfNew) ya es idempotente por sí mismo
      // vía transacción, pero lo dejamos también dentro del guard por claridad.
      const existingPayment = await adminDb
        .collection("pagos")
        .where("stripePaymentId", "==", invoice.id)
        .limit(1)
        .get();
      const isNewInvoicePayment = existingPayment.empty;

      if (isNewInvoicePayment) {
        await adminDb.collection("pagos").add({
          userId,
          amount,
          currency,
          date: AdminTimestamp.fromDate(paymentDate),
          planType,
          expiresAt: AdminTimestamp.fromDate(expiresAt),
          status: "approved",
          paymentId: invoice.id,
          stripePaymentId: invoice.id,
          stripeInvoiceId: invoice.id,
          stripeSubscriptionId: subscription.id,
          paymentMethod: "stripe",
          isManual: false,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }

      // Mismo aislamiento que arriba: una renovación cobrada que no se escribe
      // deja al usuario sin acceso pese a haber pagado.
      try {
      await userRef.set(
        {
          premium: true,
          premiumStatus: "active",
          premiumLastPay: FieldValue.serverTimestamp(),
          premiumExpiresAt: AdminTimestamp.fromDate(expiresAt),
          premiumPlanType: planType,
          premiumStripeSubscriptionId: subscription.id,
          premiumPayment: {
            paymentId: invoice.id,
            amount,
            currency,
            date: FieldValue.serverTimestamp(),
            method: "stripe",
            status: "succeeded",
            planType,
          },
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      } catch (error: unknown) {
        console.error(`❌ CRÍTICO: factura ${invoice.id} cobrada pero NO se pudo renovar premium a ${userId}:`, error);
        await alertarActivacionFallida({
          proveedor: "Stripe",
          paymentId: String(invoice.id),
          userId,
          userEmail: null,
          error,
        });
        return res.status(500).json({ error: "No se pudo renovar premium", retry: true });
      }

      if (isNewInvoicePayment) {
        try {
          const message = formatPaymentMessage({
            nombre: userData?.nombre || null,
            email: userData?.email || null,
            amount,
            currency,
            planType,
            paymentMethod: "stripe",
            paymentId: invoice.id,
            date: paymentDate,
          });
          await sendTelegramMessage(message).catch((err) => {
            console.warn("⚠️ Error al enviar notificación de pago a Telegram:", err);
          });
        } catch (telegramError) {
          console.warn("⚠️ Error al enviar notificación de pago a Telegram:", telegramError);
        }

        try {
          await recordStripeMonthlyEarningIfNew(adminDb, invoice.id, paymentDate, amount);
        } catch (adminError: unknown) {
          console.error("❌ Error al registrar ganancias mensuales:", adminError);
        }
      }
    }

    if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId =
        typeof (invoice as unknown as { subscription?: string }).subscription === "string"
          ? (invoice as unknown as { subscription: string }).subscription
          : null;
      if (subscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const userId = subscription.metadata?.userId;
        if (userId) {
          // Si esta escritura falla, el usuario conserva premium pese a que el
          // cobro falló. Es menos grave que #13 —Stripe reintenta la factura—
          // pero es una fuga de ingresos, así que sigue el mismo patrón.
          try {
            await adminDb.collection("usuarios").doc(userId).set(
              { premiumStatus: "past_due", updatedAt: FieldValue.serverTimestamp() },
              { merge: true }
            );
          } catch (error: unknown) {
            console.error(`❌ No se pudo marcar como past_due la suscripción ${subscriptionId} de ${userId}:`, error);
            await alertarActivacionFallida({
              proveedor: "Stripe",
              paymentId: String(subscriptionId),
              userId,
              error,
              accion: "actualizar-suscripcion",
            });
            return res.status(500).json({ error: "No se pudo aplicar el estado de la suscripción", retry: true });
          }
        }
      }
    }

    // Siempre responder 200 para que Stripe sepa que recibimos el webhook
    return res.status(200).json({ received: true });
  } catch (error: unknown) {
    console.error("Error al procesar webhook de Stripe:", error);
    return res.status(200).json({ received: true });
  }
}

