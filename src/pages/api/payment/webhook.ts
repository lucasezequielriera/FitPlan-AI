import type { NextApiRequest, NextApiResponse } from "next";
import { getDbSafe } from "@/lib/firebase";
import { collection, doc, updateDoc, serverTimestamp, getDoc, Timestamp } from "firebase/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  console.log("🔔 Webhook recibido de MercadoPago:", JSON.stringify(req.body, null, 2));

  // MercadoPago envía notificaciones cuando cambia el estado de un pago
  const { type, data } = req.body;

  try {
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
        
        // Crear registro de pago premium bien estructurado
        const premiumData: {
          premium: boolean;
          premiumStatus: string;
          premiumLastPay: ReturnType<typeof serverTimestamp>;
          premiumExpiresAt: ReturnType<typeof Timestamp.fromDate>; // Fecha de vencimiento del plan como Timestamp
          premiumPlanType: string; // Tipo de plan: monthly, quarterly, annual
          premiumPayment: {
            paymentId: string | number;
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
          premiumStatus: "active", // active, expired, cancelled
          premiumLastPay: serverTimestamp(), // Fecha del último pago completado
          premiumExpiresAt: Timestamp.fromDate(expiresAt), // Fecha de vencimiento calculada como Timestamp de Firestore
          premiumPlanType: planType || "monthly", // Tipo de plan
          premiumPayment: {
            paymentId: paymentId,
            amount: payment.transaction_amount,
            currency: payment.currency_id || "ARS",
            date: serverTimestamp(),
            method: payment.payment_method_id || "unknown",
            status: payment.status,
            planType: planType || "monthly",
          },
          updatedAt: serverTimestamp(),
        };

        // Solo agregar premiumSince si no era premium antes
        if (!wasPremium) {
          premiumData.premiumSince = serverTimestamp();
        }
        
        try {
          // Intentar actualizar primero
          await updateDoc(userRef, premiumData);
          console.log(`✅ Usuario ${userId} actualizado a premium. Pago ID: ${paymentId}, Monto: ${payment.transaction_amount} ${payment.currency_id || "ARS"}`);
          
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
          const errorCode = error && typeof error === 'object' && 'code' in error ? error.code : 'unknown';
          console.error(`Código del error:`, errorCode);
          
          // Si falla updateDoc (permisos o documento no existe), intentar con setDoc
          if (errorCode === 'permission-denied' || errorCode === 'not-found') {
            try {
              const { setDoc } = await import("firebase/firestore");
              await setDoc(userRef, premiumData, { merge: true });
              console.log(`✅ Usuario ${userId} actualizado a premium usando setDoc como fallback`);
            } catch (setError) {
              console.error(`❌ Error crítico al actualizar con setDoc:`, setError);
              // No lanzar error, solo loguear - el webhook debe responder 200
            }
          } else {
            console.error(`❌ Error desconocido:`, error);
          }
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

