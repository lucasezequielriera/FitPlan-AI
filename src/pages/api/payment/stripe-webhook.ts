import type { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";
import { getAdminDb } from "@/lib/firebase-admin";
import { FieldValue, Timestamp as AdminTimestamp, type Firestore } from "firebase-admin/firestore";
import { sendTelegramMessage, formatPaymentMessage } from "@/lib/telegram";

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
    // Manejar eventos de checkout finalizado en pago exitoso
    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      const session = event.data.object as Stripe.Checkout.Session;

      console.log(`💰 Procesando pago completado. Session ID: ${session.id}`);

      if (session.payment_status !== "paid") {
        console.log(`ℹ️ Session ${session.id} recibida sin estado paid (${session.payment_status}), no se procesa premium.`);
        return res.status(200).json({ received: true });
      }

      // Obtener metadata del usuario y plan
      const userId = session.metadata?.userId;
      const planType = session.metadata?.planType || "monthly";

      if (!userId) {
        console.error("❌ No se encontró userId en la metadata de la sesión");
        return res.status(200).json({ received: true });
      }

      // ID del payment intent asociado a la sesión
      const paymentIntentId = session.payment_intent as string;

      const amount = session.amount_total ? session.amount_total / 100 : 0; // Convertir de centavos a euros
      const currency = session.currency?.toUpperCase() || "EUR";

      // Calcular fecha de vencimiento según el tipo de plan
      const paymentDate = new Date();
      const expiresAt = new Date(paymentDate);

      switch (planType) {
        case "monthly":
          expiresAt.setMonth(expiresAt.getMonth() + 1);
          break;
        case "quarterly":
          expiresAt.setMonth(expiresAt.getMonth() + 3);
          break;
        case "annual":
          expiresAt.setFullYear(expiresAt.getFullYear() + 1);
          break;
        default:
          expiresAt.setMonth(expiresAt.getMonth() + 1);
      }

      console.log(`📅 Plan ${planType} - Vencimiento calculado: ${expiresAt.toISOString()}`);

      const adminDb = getAdminDb();
      if (!adminDb) {
        console.error("❌ Firebase Admin SDK no configurado");
        return res.status(200).json({ received: true });
      }

      const userRef = adminDb.collection("usuarios").doc(userId);
      const userDoc = await userRef.get();
      if (!userDoc.exists) {
        console.error(`❌ Usuario ${userId} no existe en la base de datos`);
        return res.status(200).json({ received: true });
      }
      const userData = userDoc.data() || {};
      const wasPremium = userData.premium === true;
      const welcomeAlreadySent = typeof userData.premiumWelcomeChatSentAt !== "undefined";

      // Guardar pago en colección pagos de forma idempotente (evita duplicados por reintentos webhook)
      const existingPayment = await adminDb
        .collection("pagos")
        .where("stripePaymentId", "==", session.id)
        .limit(1)
        .get();
      if (existingPayment.empty) {
        await adminDb.collection("pagos").add({
          userId,
          amount,
          currency,
          date: AdminTimestamp.fromDate(paymentDate),
          planType: planType || "monthly",
          expiresAt: AdminTimestamp.fromDate(expiresAt),
          status: "approved",
          paymentId: session.id,
          stripePaymentId: session.id,
          stripePaymentIntentId: paymentIntentId || null,
          paymentMethod: "stripe",
          isManual: false,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        console.log(`✅ Pago guardado en colección pagos. ID: ${session.id}, Usuario: ${userId}, Monto: ${amount} ${currency}`);
      } else {
        console.log(`ℹ️ Pago ${session.id} ya existía en colección pagos, se omite duplicado.`);
      }

      // Actualizar usuario premium usando Admin SDK (sin depender de reglas cliente)
      const premiumData: Record<string, unknown> = {
        premium: true,
        premiumStatus: "active",
        premiumLastPay: FieldValue.serverTimestamp(),
        premiumExpiresAt: AdminTimestamp.fromDate(expiresAt),
        premiumPlanType: planType || "monthly",
        premiumPayment: {
          paymentId: session.id,
          amount,
          currency,
          date: FieldValue.serverTimestamp(),
          method: "stripe",
          status: "succeeded",
          planType: planType || "monthly",
        },
        updatedAt: FieldValue.serverTimestamp(),
      };

      // Solo agregar premiumSince si no era premium antes
      if (!wasPremium) {
        premiumData.premiumSince = FieldValue.serverTimestamp();
      }

      try {
        await userRef.set(premiumData, { merge: true });
        console.log(`✅ Usuario ${userId} actualizado a premium. Pago ID: ${session.id}, Monto: ${amount} ${currency}`);

        // Enviar notificación a Telegram
        try {
          const message = formatPaymentMessage({
            nombre: userData?.nombre || null,
            email: userData?.email || null,
            amount,
            currency,
            planType: planType || "monthly",
            paymentMethod: "stripe",
            paymentId: session.id,
            date: paymentDate,
          });

          await sendTelegramMessage(message).catch((err) => {
            console.warn("⚠️ Error al enviar notificación de pago a Telegram:", err);
          });
        } catch (telegramError) {
          console.warn("⚠️ Error al enviar notificación de pago a Telegram:", telegramError);
        }

        // Enviar mensaje de bienvenida en el chat la primera vez
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
            console.log(`✅ Mensaje de bienvenida premium enviado por chat a user ${userId}`);
          } catch (chatError) {
            console.warn("⚠️ No se pudo enviar mensaje de bienvenida premium por chat:", chatError);
          }
        }

        // Registrar ganancia mensual en la colección admin
        try {
          const year = paymentDate.getFullYear();
          const month = String(paymentDate.getMonth() + 1).padStart(2, "0");
          const monthId = `${year}-${month}`;

          const adminMonthRef = adminDb.collection("admin").doc(monthId);
          const adminMonthDoc = await adminMonthRef.get();

          if (!adminMonthDoc.exists) {
            await adminMonthRef.set({
              month: monthId,
              year: year,
              monthNumber: parseInt(month, 10),
              totalEarnings: amount,
              paymentCount: 1,
              createdAt: FieldValue.serverTimestamp(),
              updatedAt: FieldValue.serverTimestamp(),
            });
            console.log(`✅ Ganancias mensuales creadas para ${monthId}: €${amount}`);
          } else {
            await adminMonthRef.update({
              totalEarnings: FieldValue.increment(amount),
              paymentCount: FieldValue.increment(1),
              updatedAt: FieldValue.serverTimestamp(),
            });
            console.log(`✅ Ganancias mensuales actualizadas para ${monthId}: +€${amount}`);
          }
        } catch (adminError: unknown) {
          console.error("❌ Error al registrar ganancias mensuales:", adminError);
        }
      } catch (error: unknown) {
        console.error(`❌ Error al actualizar usuario ${userId} a premium:`, error);
      }
    }

    // Siempre responder 200 para que Stripe sepa que recibimos el webhook
    return res.status(200).json({ received: true });
  } catch (error: unknown) {
    console.error("Error al procesar webhook de Stripe:", error);
    return res.status(200).json({ received: true });
  }
}

