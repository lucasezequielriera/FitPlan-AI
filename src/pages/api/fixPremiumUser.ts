import type { NextApiRequest, NextApiResponse } from "next";
import { getDbSafe } from "@/lib/firebase";
import { doc, getDoc, setDoc, serverTimestamp, query, collection, where, getDocs } from "firebase/firestore";

/**
 * API para arreglar manualmente el estado premium de un usuario
 * Uso: POST /api/fixPremiumUser
 * Body: { email: "email@example.com" } o { userId: "userId" }
 * 
 * También puede recibir payment_id para verificar desde MercadoPago
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { email, userId, payment_id } = req.body;

  try {
    const db = getDbSafe();
    if (!db) {
      return res.status(500).json({ error: "Firestore no configurado" });
    }

    let targetUserId = userId;

    // Si solo tenemos email, buscar el userId
    if (!targetUserId && email) {
      const usersQuery = query(
        collection(db, "usuarios"),
        where("email", "==", email)
      );
      const userSnapshot = await getDocs(usersQuery);
      
      if (userSnapshot.empty) {
        return res.status(404).json({ error: `Usuario con email "${email}" no encontrado` });
      }
      
      targetUserId = userSnapshot.docs[0].id;
    }

    if (!targetUserId) {
      return res.status(400).json({ error: "Se requiere 'email' o 'userId' en el body" });
    }

    // Verificar si hay un pago aprobado en MercadoPago
    let paymentVerified = false;
    if (payment_id) {
      const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
      if (accessToken) {
        try {
          const paymentResponse = await fetch(
            `https://api.mercadopago.com/v1/payments/${payment_id}`,
            {
              method: "GET",
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
              },
            }
          );

          if (paymentResponse.ok) {
            const payment = await paymentResponse.json();
            if (payment.status === "approved" && payment.external_reference === targetUserId) {
              paymentVerified = true;
            }
          }
        } catch (error) {
          console.error("Error al verificar pago:", error);
        }
      }
    }

    // Obtener el usuario actual
    const userRef = doc(db, "usuarios", targetUserId);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      return res.status(404).json({ error: `Usuario con ID "${targetUserId}" no encontrado` });
    }

    const userData = userDoc.data();
    const currentPremium = userData.premium === true;

    // Actualizar a premium
    const premiumData = {
      premium: true,
      premiumSince: serverTimestamp(),
      premiumStatus: "active",
      premiumPayment: {
        ...(payment_id && { paymentId: payment_id }),
        date: serverTimestamp(),
        manuallyFixed: true,
        fixedAt: serverTimestamp(),
      },
      updatedAt: serverTimestamp(),
    };

    await setDoc(userRef, premiumData, { merge: true });

    return res.status(200).json({
      success: true,
      message: `Usuario ${targetUserId} actualizado a premium${currentPremium ? " (ya era premium pero se actualizó)" : ""}`,
      userId: targetUserId,
      email: userData.email || email,
      wasPremium: currentPremium,
      paymentVerified,
    });
  } catch (error: unknown) {
    console.error("Error al arreglar usuario premium:", error);
    const message = error instanceof Error ? error.message : "Error desconocido";
    return res.status(500).json({ error: "Error al procesar la solicitud", detail: message });
  }
}

