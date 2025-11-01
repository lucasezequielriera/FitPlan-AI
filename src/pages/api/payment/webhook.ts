import type { NextApiRequest, NextApiResponse } from "next";
import { getDbSafe } from "@/lib/firebase";
import { collection, doc, setDoc, serverTimestamp } from "firebase/firestore";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // MercadoPago envía notificaciones cuando cambia el estado de un pago
  const { type, data } = req.body;

  try {
    // Verificar que es una notificación de pago
    if (type === "payment") {
      const paymentId = data.id;

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

      // Verificar que el pago fue aprobado
      if (payment.status === "approved" && payment.status_detail === "accredited") {
        const userId = payment.external_reference;
        
        if (!userId) {
          console.error("No se encontró external_reference en el pago");
          return res.status(200).json({ received: true });
        }

        const db = getDbSafe();
        if (!db) {
          console.error("Firestore no configurado");
          return res.status(200).json({ received: true });
        }

        // Actualizar el estado premium del usuario
        const userRef = doc(collection(db, "usuarios"), userId);
        
        // Crear registro de pago premium bien estructurado
        const premiumData = {
          premium: true,
          premiumSince: serverTimestamp(),
          premiumStatus: "active", // active, expired, cancelled
          premiumPayment: {
            paymentId: paymentId,
            amount: payment.transaction_amount,
            currency: payment.currency_id || "ARS",
            date: serverTimestamp(),
            method: payment.payment_method_id || "unknown",
            status: payment.status,
          },
          updatedAt: serverTimestamp(),
        };
        
        await setDoc(userRef, premiumData, { merge: true });

        console.log(`✅ Usuario ${userId} actualizado a premium. Pago ID: ${paymentId}, Monto: ${payment.transaction_amount} ${payment.currency_id || "ARS"}`);
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

