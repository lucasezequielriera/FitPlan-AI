import type { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";
import { getDbSafe } from "@/lib/firebase";
import { collection, doc, updateDoc, serverTimestamp, getDoc, Timestamp } from "firebase/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { FieldValue, Timestamp as AdminTimestamp } from "firebase-admin/firestore";
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
    // Manejar el evento checkout.session.completed
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      console.log(`💰 Procesando pago completado. Session ID: ${session.id}`);

      // Obtener metadata del usuario y plan
      const userId = session.metadata?.userId;
      const planType = session.metadata?.planType || "monthly";

      if (!userId) {
        console.error("❌ No se encontró userId en la metadata de la sesión");
        return res.status(200).json({ received: true });
      }

      // Obtener información del pago desde Stripe
      const paymentIntentId = session.payment_intent as string;
      let paymentIntent: Stripe.PaymentIntent | null = null;

      if (paymentIntentId) {
        try {
          paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
        } catch (error) {
          console.error("Error al obtener payment intent:", error);
        }
      }

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

      const db = getDbSafe();
      if (!db) {
        console.error("❌ Firestore no configurado");
        return res.status(200).json({ received: true });
      }

      // Actualizar el estado premium del usuario
      const userRef = doc(collection(db, "usuarios"), userId);

      // Verificar que el documento existe antes de actualizar
      const userDoc = await getDoc(userRef);
      if (!userDoc.exists()) {
        console.error(`❌ Usuario ${userId} no existe en la base de datos`);
        return res.status(200).json({ received: true });
      }

      const wasPremium = userDoc.data()?.premium === true;

      // Usar Admin SDK para crear el pago en la colección pagos
      const adminDb = getAdminDb();

      if (adminDb) {
        const paymentData = {
          userId: userId,
          amount: amount,
          currency: currency,
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
        };

        try {
          await adminDb.collection("pagos").add(paymentData);
          console.log(`✅ Pago guardado en colección pagos. ID: ${session.id}, Usuario: ${userId}, Monto: ${amount} ${currency}`);
        } catch (paymentError) {
          console.error(`❌ Error al guardar pago en colección pagos:`, paymentError);
        }
      } else {
        console.warn("⚠️ Admin SDK no disponible, el pago no se guardará en la colección pagos");
      }

      // Crear registro de pago premium bien estructurado
      const premiumData: {
        premium: boolean;
        premiumStatus: string;
        premiumLastPay: ReturnType<typeof serverTimestamp>;
        premiumExpiresAt: ReturnType<typeof Timestamp.fromDate>;
        premiumPlanType: string;
        premiumPayment: {
          paymentId: string;
          amount: number;
          currency: string;
          date: ReturnType<typeof serverTimestamp>;
          method: string;
          status: string;
          planType: string;
        };
        updatedAt: ReturnType<typeof serverTimestamp>;
        premiumSince?: ReturnType<typeof serverTimestamp>;
      } = {
        premium: true,
        premiumStatus: "active",
        premiumLastPay: serverTimestamp(),
        premiumExpiresAt: Timestamp.fromDate(expiresAt),
        premiumPlanType: planType || "monthly",
        premiumPayment: {
          paymentId: session.id,
          amount: amount,
          currency: currency,
          date: serverTimestamp(),
          method: "stripe",
          status: "succeeded",
          planType: planType || "monthly",
        },
        updatedAt: serverTimestamp(),
      };

      // Solo agregar premiumSince si no era premium antes
      if (!wasPremium) {
        premiumData.premiumSince = serverTimestamp();
      }

      try {
        await updateDoc(userRef, premiumData);
        console.log(`✅ Usuario ${userId} actualizado a premium. Pago ID: ${session.id}, Monto: ${amount} ${currency}`);

        // Enviar notificación a Telegram
        try {
          const userData = userDoc.data();
          const message = formatPaymentMessage({
            nombre: userData?.nombre || null,
            email: userData?.email || null,
            amount: amount,
            currency: currency,
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

        // Registrar ganancia mensual en la colección admin
        try {
          const adminDb = getAdminDb();
          if (adminDb) {
            const year = paymentDate.getFullYear();
            const month = String(paymentDate.getMonth() + 1).padStart(2, "0");
            const monthId = `${year}-${month}`;

            const adminMonthRef = adminDb.collection("admin").doc(monthId);
            const adminMonthDoc = await adminMonthRef.get();

            if (!adminMonthDoc.exists) {
              await adminMonthRef.set({
                month: monthId,
                year: year,
                monthNumber: parseInt(month),
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
          } else {
            console.warn("⚠️ Firebase Admin SDK no disponible para registrar ganancias mensuales");
          }
        } catch (adminError: unknown) {
          console.error("❌ Error al registrar ganancias mensuales:", adminError);
        }
      } catch (error: unknown) {
        console.error(`❌ Error al actualizar usuario ${userId} a premium:`, error);
        const errorCode = error && typeof error === "object" && "code" in error ? error.code : "unknown";

        if (errorCode === "permission-denied" || errorCode === "not-found") {
          try {
            const { setDoc } = await import("firebase/firestore");
            await setDoc(userRef, premiumData, { merge: true });
            console.log(`✅ Usuario ${userId} actualizado a premium usando setDoc como fallback`);
          } catch (setError) {
            console.error(`❌ Error crítico al actualizar con setDoc:`, setError);
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

