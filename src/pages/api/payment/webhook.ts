import type { NextApiRequest, NextApiResponse } from "next";
import { createHmac, timingSafeEqual } from "crypto";
import { getAdminDb } from "@/lib/firebase-admin";
import { FieldValue, Timestamp as AdminTimestamp, type Firestore } from "firebase-admin/firestore";
import { sendTelegramMessage, formatPaymentMessage } from "@/lib/telegram";
import { recordMercadoPagoMonthlyEarningIfNew } from "@/lib/adminMonthlyEarningsMercadoPago";

/**
 * Verifica la firma HMAC que MercadoPago envía en el header `x-signature`
 * (esquema documentado en https://www.mercadopago.com.ar/developers/es/docs/checkout-api/additional-content/your-integrations/notifications/webhooks#editor_1).
 * Sin esto, cualquiera podía llamar este endpoint con un `data.id` real y
 * forzar al servidor a reprocesar ese pago/suscripción sin límite.
 *
 * Si MERCADOPAGO_WEBHOOK_SECRET no está configurado, se deja pasar (modo
 * degradado, igual que el comportamiento previo) pero se loguea una
 * advertencia para que se note en producción.
 */
function verifyMercadoPagoSignature(req: NextApiRequest, dataId: string | number | undefined): boolean {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!secret) {
    console.warn("⚠️ MERCADOPAGO_WEBHOOK_SECRET no configurado: no se puede verificar la firma del webhook.");
    return true;
  }

  const xSignature = req.headers["x-signature"];
  const xRequestId = req.headers["x-request-id"];
  const signatureHeader = Array.isArray(xSignature) ? xSignature[0] : xSignature;
  const requestIdHeader = Array.isArray(xRequestId) ? xRequestId[0] : xRequestId;

  if (!signatureHeader || !requestIdHeader || !dataId) {
    return false;
  }

  const parts = signatureHeader.split(",").reduce<Record<string, string>>((acc, part) => {
    const [key, value] = part.split("=");
    if (key && value) acc[key.trim()] = value.trim();
    return acc;
  }, {});

  const ts = parts.ts;
  const receivedHash = parts.v1;
  if (!ts || !receivedHash) return false;

  const manifest = `id:${String(dataId).toLowerCase()};request-id:${requestIdHeader};ts:${ts};`;
  const expectedHash = createHmac("sha256", secret).update(manifest).digest("hex");

  const expectedBuf = Buffer.from(expectedHash, "utf8");
  const receivedBuf = Buffer.from(receivedHash, "utf8");
  if (expectedBuf.length !== receivedBuf.length) return false;
  return timingSafeEqual(expectedBuf, receivedBuf);
}

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

  // MercadoPago envía notificaciones cuando cambia un pago o suscripción (preapproval)
  const { type, data } = req.body;

  const dataIdFromQuery = typeof req.query["data.id"] === "string" ? req.query["data.id"] : undefined;
  if (!verifyMercadoPagoSignature(req, dataIdFromQuery || data?.id)) {
    console.error("❌ Firma de webhook de MercadoPago inválida — solicitud rechazada.");
    return res.status(401).json({ error: "Firma inválida" });
  }

  console.log("🔔 Webhook recibido de MercadoPago:", { type, dataId: data?.id });

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

        // Guardar pago en colección pagos de forma idempotente. MercadoPago puede
        // reentregar el mismo webhook más de una vez (comportamiento documentado de
        // "al menos una entrega"): `isNewPayment` es la única fuente de verdad sobre
        // si ESTE pago ya fue procesado antes, y controla todos los efectos que NO
        // deben repetirse (libro de ganancias, Telegram, notificación admin) más abajo.
        const existingPayment = await adminDb
          .collection("pagos")
          .where("mercadopagoPaymentId", "==", String(paymentId))
          .limit(1)
          .get();
        const isNewPayment = existingPayment.empty;
        if (isNewPayment) {
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
          console.log(`ℹ️ Pago MP ${paymentId} ya existía en colección pagos, se omite duplicado (webhook reentregado).`);
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

          // Todo lo que sigue en este bloque son efectos que deben ocurrir UNA sola
          // vez por pago real, no una vez por cada entrega del webhook. isNewPayment
          // es el guard de idempotencia (ver arriba, basado en mercadopagoPaymentId).
          if (isNewPayment) {
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

            // Registrar ganancia mensual (idempotente y atómico por paymentId)
            try {
              const ledgerDate = payment.date_approved ? new Date(payment.date_approved) : new Date();
              await recordMercadoPagoMonthlyEarningIfNew(
                adminDb,
                String(paymentId),
                ledgerDate,
                typeof payment.transaction_amount === "number" ? payment.transaction_amount : 0
              );
            } catch (adminError: unknown) {
              console.error("❌ Error al registrar ganancias mensuales:", adminError);
              // No bloquear el flujo si falla el registro de ganancias
            }
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

