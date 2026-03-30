import type { NextApiRequest, NextApiResponse } from "next";
import { getAdminDb } from "@/lib/firebase-admin";
import { FieldValue, Timestamp as AdminTimestamp, type Firestore } from "firebase-admin/firestore";
import { sendTelegramMessage, formatPaymentMessage } from "@/lib/telegram";

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
  provider: "mercadopago";
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

  console.log("🔔 Webhook recibido de MercadoPago:", JSON.stringify(req.body, null, 2));

  // MercadoPago envía notificaciones cuando cambia un pago o suscripción (preapproval)
  const { type, data } = req.body;

  try {
    // Suscripción de MercadoPago (preapproval) con trial de 30 días.
    if (type === "subscription_preapproval" || type === "preapproval") {
      const preapprovalId = data?.id;
      if (!preapprovalId) {
        return res.status(200).json({ received: true });
      }

      const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
      if (!accessToken) {
        console.error("MERCADOPAGO_ACCESS_TOKEN no configurado");
        return res.status(200).json({ received: true });
      }

      const preapprovalResponse = await fetch(
        `https://api.mercadopago.com/preapproval/${preapprovalId}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!preapprovalResponse.ok) {
        console.error("Error al obtener información de suscripción MP:", await preapprovalResponse.text());
        return res.status(200).json({ received: true });
      }

      const preapproval = await preapprovalResponse.json();
      const externalRef = preapproval.external_reference || "";
      const [userId, planTypeRaw] = externalRef.includes("|") ? externalRef.split("|") : [externalRef, "monthly"];
      const planType = planTypeRaw || "monthly";

      if (!userId) {
        return res.status(200).json({ received: true });
      }

      const adminDb = getAdminDb();
      if (!adminDb) {
        console.error("❌ Firebase Admin SDK no configurado");
        return res.status(200).json({ received: true });
      }

      const userRef = adminDb.collection("usuarios").doc(userId);
      const userDoc = await userRef.get();
      if (!userDoc.exists) {
        return res.status(200).json({ received: true });
      }

      const nextPaymentDate =
        typeof preapproval.next_payment_date === "string" ? new Date(preapproval.next_payment_date) : null;
      const fallbackNextDate = new Date();
      fallbackNextDate.setMonth(fallbackNextDate.getMonth() + 1);
      const expiresAt = nextPaymentDate && !Number.isNaN(nextPaymentDate.getTime()) ? nextPaymentDate : fallbackNextDate;

      const subscriptionStatus = preapproval.status || "authorized";
      const premiumStatus =
        subscriptionStatus === "authorized"
          ? "trialing"
          : subscriptionStatus === "paused"
            ? "past_due"
            : subscriptionStatus === "cancelled"
              ? "inactive"
              : "active";

      await userRef.set(
        {
          premium: subscriptionStatus !== "cancelled",
          premiumStatus,
          premiumPlanType: planType,
          premiumExpiresAt: AdminTimestamp.fromDate(expiresAt),
          premiumMercadoPagoPreapprovalId: String(preapprovalId),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      return res.status(200).json({ received: true });
    }

    // Verificar que es una notificación de pago
    if (type === "payment") {
      const paymentId = data.id;
      
      console.log(`💰 Procesando notificación de pago. ID: ${paymentId}`);

      // Obtener información del pago desde MercadoPago
      const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
      if (!accessToken) {
        console.error("MERCADOPAGO_ACCESS_TOKEN no configurado");
        return res.status(200).json({ received: true }); // Responder 200 para que MP no reenvíe
      }

      const paymentResponse = await fetch(
        `https://api.mercadopago.com/v1/payments/${paymentId}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!paymentResponse.ok) {
        console.error("Error al obtener información del pago:", await paymentResponse.text());
        return res.status(200).json({ received: true });
      }

      const payment = await paymentResponse.json();

      console.log(`📊 Estado del pago ${paymentId}: ${payment.status}, detail: ${payment.status_detail}`);
      console.log(`👤 External reference (userId): ${payment.external_reference}`);

      // Verificar que el pago fue aprobado
      if (payment.status === "approved" && payment.status_detail === "accredited") {
        // Extraer userId y planType del external_reference (formato: "userId|planType")
        const externalRef = payment.external_reference || "";
        if (externalRef.startsWith("intake:")) {
          const [rawIntakeId, intakePlanType] = externalRef.replace("intake:", "").split("|");
          const intakeClientId = rawIntakeId || "";
          if (intakeClientId) {
            const adminDb = getAdminDb();
            if (adminDb) {
              await adminDb.collection("intakeClients").doc(intakeClientId).set(
                {
                  paymentStatus: "paid",
                  paymentProvider: "mercadopago",
                  paymentLastPaidAt: FieldValue.serverTimestamp(),
                  paymentCurrentMonthPaid: true,
                  paymentPlanType: intakePlanType || "monthly",
                  paymentLastAmount: typeof payment.transaction_amount === "number" ? payment.transaction_amount : 0,
                  paymentLastCurrency: payment.currency_id || "ARS",
                  updatedAt: FieldValue.serverTimestamp(),
                },
                { merge: true }
              );
              await adminDb.collection("adminNotifications").add({
                type: "payment_success",
                flow: "intake_client",
                read: false,
                intakeClientId,
                provider: "mercadopago",
                amount: typeof payment.transaction_amount === "number" ? payment.transaction_amount : 0,
                currency: payment.currency_id || "ARS",
                paymentId: String(paymentId),
                createdAt: FieldValue.serverTimestamp(),
              });
            }
          }
          return res.status(200).json({ received: true });
        }
        const [userId, planType] = externalRef.includes("|") 
          ? externalRef.split("|") 
          : [externalRef, "monthly"]; // Fallback a monthly si no hay planType
        
        if (!userId) {
          console.error("❌ No se encontró external_reference en el pago");
          return res.status(200).json({ received: true });
        }

        // Calcular fecha de vencimiento según el tipo de plan
        const paymentDate = payment.date_approved ? new Date(payment.date_approved) : new Date();
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
            expiresAt.setMonth(expiresAt.getMonth() + 1); // Default a 1 mes
        }
        
        console.log(`📅 Plan ${planType} - Vencimiento calculado: ${expiresAt.toISOString()}`);

        const adminDb = getAdminDb();
        if (!adminDb) {
          console.error("❌ Firebase Admin SDK no configurado");
          return res.status(200).json({ received: true });
        }

        // Actualizar el estado premium del usuario
        const userRef = adminDb.collection("usuarios").doc(userId);

        // Verificar que el documento existe antes de actualizar
        const userDoc = await userRef.get();
        if (!userDoc.exists) {
          console.error(`❌ Usuario ${userId} no existe en la base de datos`);
          return res.status(200).json({ received: true });
        }

        const userData = userDoc.data() || {};
        const wasPremium = userData.premium === true;
        const welcomeAlreadySent = typeof userData.premiumWelcomeChatSentAt !== "undefined";

        // Guardar pago en colección pagos de forma idempotente
        const existingPayment = await adminDb
          .collection("pagos")
          .where("mercadopagoPaymentId", "==", String(paymentId))
          .limit(1)
          .get();
        if (existingPayment.empty) {
          const paymentDate = payment.date_approved ? new Date(payment.date_approved) : new Date();
          await adminDb.collection("pagos").add({
            userId: userId,
            amount: payment.transaction_amount,
            currency: payment.currency_id || "ARS",
            date: AdminTimestamp.fromDate(paymentDate),
            planType: planType || "monthly",
            expiresAt: AdminTimestamp.fromDate(expiresAt),
            status: "approved",
            paymentId: String(paymentId),
            mercadopagoPaymentId: String(paymentId),
            paymentMethod: "mercadopago",
            isManual: false,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          });
          console.log(`✅ Pago guardado en colección pagos. ID: ${paymentId}, Usuario: ${userId}, Monto: ${payment.transaction_amount} ${payment.currency_id || "ARS"}`);
        } else {
          console.log(`ℹ️ Pago MP ${paymentId} ya existía en colección pagos, se omite duplicado.`);
        }
        
        // Crear registro de pago premium bien estructurado
        const premiumData: Record<string, unknown> = {
          premium: true,
          premiumStatus: "active",
          premiumLastPay: FieldValue.serverTimestamp(),
          premiumExpiresAt: AdminTimestamp.fromDate(expiresAt),
          premiumPlanType: planType || "monthly",
          premiumPayment: {
            paymentId: paymentId,
            amount: payment.transaction_amount,
            currency: payment.currency_id || "ARS",
            date: FieldValue.serverTimestamp(),
            method: payment.payment_method_id || "unknown",
            status: payment.status,
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
          console.log(`✅ Usuario ${userId} actualizado a premium. Pago ID: ${paymentId}, Monto: ${payment.transaction_amount} ${payment.currency_id || "ARS"}`);

          await createAdminPaymentNotification({
            db: adminDb,
            userId,
            userName: typeof userData?.nombre === "string" ? userData.nombre : null,
            userEmail: typeof userData?.email === "string" ? userData.email : null,
            provider: "mercadopago",
            amount: typeof payment.transaction_amount === "number" ? payment.transaction_amount : 0,
            currency: payment.currency_id || "ARS",
            planType: planType || "monthly",
            paymentId: String(paymentId),
          }).catch((err) => {
            console.warn("⚠️ Error al crear notificación admin de pago MP:", err);
          });
          
          // Enviar notificación a Telegram
          try {
            const message = formatPaymentMessage({
              nombre: userData?.nombre || null,
              email: userData?.email || null,
              amount: payment.transaction_amount,
              currency: payment.currency_id || "ARS",
              planType: planType || "monthly",
              paymentMethod: "mercadopago",
              paymentId: String(paymentId),
              date: payment.date_approved || new Date(),
            });
            
            await sendTelegramMessage(message).catch((err) => {
              console.warn("⚠️ Error al enviar notificación de pago a Telegram:", err);
            });
          } catch (telegramError) {
            console.warn("⚠️ Error al enviar notificación de pago a Telegram:", telegramError);
          }

          if (!wasPremium || !welcomeAlreadySent) {
            try {
              await sendPremiumWelcomeChatMessage({
                userId,
                nombre: typeof userData?.nombre === "string" ? userData.nombre : null,
                userName: typeof userData?.nombre === "string" ? userData.nombre : null,
                userEmail: typeof userData?.email === "string" ? userData.email : null,
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
            const adminDb = getAdminDb();
            if (adminDb) {
              // Obtener año y mes del pago (formato: YYYY-MM)
              const paymentDate = payment.date_approved ? new Date(payment.date_approved) : new Date();
              const year = paymentDate.getFullYear();
              const month = String(paymentDate.getMonth() + 1).padStart(2, '0');
              const monthId = `${year}-${month}`;
              
              // Referencia al documento del mes en la colección admin
              const adminMonthRef = adminDb.collection("admin").doc(monthId);
              
              // Obtener el documento actual
              const adminMonthDoc = await adminMonthRef.get();
              
              const amount = payment.transaction_amount || 0;
              
              if (!adminMonthDoc.exists) {
                // Crear documento inicial para el mes
                await adminMonthRef.set({
                  month: monthId,
                  year: year,
                  monthNumber: parseInt(month),
                  totalEarnings: amount,
                  paymentCount: 1,
                  createdAt: FieldValue.serverTimestamp(),
                  updatedAt: FieldValue.serverTimestamp(),
                });
                console.log(`✅ Ganancias mensuales creadas para ${monthId}: $${amount} ARS`);
              } else {
                // Actualizar documento existente con incremento atómico
                await adminMonthRef.update({
                  totalEarnings: FieldValue.increment(amount),
                  paymentCount: FieldValue.increment(1),
                  updatedAt: FieldValue.serverTimestamp(),
                });
                console.log(`✅ Ganancias mensuales actualizadas para ${monthId}: +$${amount} ARS`);
              }
            } else {
              console.warn("⚠️ Firebase Admin SDK no disponible para registrar ganancias mensuales");
            }
          } catch (adminError: unknown) {
            console.error("❌ Error al registrar ganancias mensuales:", adminError);
            // No bloquear el flujo si falla el registro de ganancias
          }
        } catch (error: unknown) {
          console.error(`❌ Error al actualizar usuario ${userId} a premium:`, error);
        }
      } else {
        console.log(`⚠️ Pago ${paymentId} no está aprobado aún. Estado: ${payment.status}, Detail: ${payment.status_detail}`);
      }
    }

    // Siempre responder 200 para que MercadoPago sepa que recibimos la notificación
    return res.status(200).json({ received: true });
  } catch (error: unknown) {
    console.error("Error al procesar webhook de MercadoPago:", error);
    // Aún así responder 200 para evitar reenvíos
    return res.status(200).json({ received: true });
  }
}

