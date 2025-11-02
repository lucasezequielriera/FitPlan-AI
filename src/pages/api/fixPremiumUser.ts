import type { NextApiRequest, NextApiResponse } from "next";
import { getDbSafe } from "@/lib/firebase";
import { doc, getDoc, updateDoc, serverTimestamp, query, collection, where, getDocs, limit } from "firebase/firestore";

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

  // Verificar clave secreta para seguridad
  const authHeader = req.headers.authorization;
  const expectedSecret = process.env.FIX_PREMIUM_SECRET || process.env.MERCADOPAGO_ACCESS_TOKEN?.slice(-10); // Fallback a última parte del token como secreto
  
  if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
    return res.status(401).json({ 
      error: "No autorizado. Se requiere token de autorización.",
      hint: "Usa: Authorization: Bearer [SECRET] en el header"
    });
  }

  const { email, userId, payment_id, nombre } = req.body;

  try {
    const db = getDbSafe();
    if (!db) {
      return res.status(500).json({ error: "Firestore no configurado" });
    }

    let targetUserId = userId;

    // Si solo tenemos email, buscar el userId
    // Nota: Los usuarios pueden no tener email en la colección "usuarios"
    // Si no se encuentra, buscar por nombre usando Firestore
    if (!targetUserId && email) {
      // Primero intentar buscar por email
      const usersQuery = query(
        collection(db, "usuarios"),
        where("email", "==", email)
      );
      const userSnapshot = await getDocs(usersQuery);
      
      if (!userSnapshot.empty) {
        targetUserId = userSnapshot.docs[0].id;
      }
    }
    
    // Si no encontramos por email pero tenemos nombre, buscar por nombre
    if (!targetUserId && nombre) {
      const nombreLower = nombre.toLowerCase();
      const usersQuery = query(
        collection(db, "usuarios"),
        limit(100)
      );
      const userSnapshot = await getDocs(usersQuery);
      
      // Buscar en memoria por nombre (case insensitive)
      for (const userDoc of userSnapshot.docs) {
        const userData = userDoc.data();
        if (userData.nombre && userData.nombre.toLowerCase() === nombreLower) {
          targetUserId = userDoc.id;
          break;
        }
      }
    }

    if (!targetUserId) {
      return res.status(400).json({ 
        error: "Se requiere 'email', 'userId' o 'nombre' en el body",
        received: { email: !!email, userId: !!userId, nombre: !!nombre }
      });
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
    
    let userDoc;
    let currentPremium = false;
    let userData: any = null;
    try {
      userDoc = await getDoc(userRef);
      if (userDoc.exists()) {
        userData = userDoc.data();
        currentPremium = userData.premium === true;
      } else {
        // Si el documento no existe, crearlo con premium
        console.log(`⚠️ Usuario ${targetUserId} no existe, se creará con premium`);
        currentPremium = false;
      }
    } catch (error) {
      console.error(`Error al leer usuario ${targetUserId}:`, error);
      // Continuar intentando crear/actualizar aunque falle la lectura
      currentPremium = false;
    }

    // Actualizar a premium usando updateDoc (solo actualiza campos, no crea documento)
    const premiumData: any = {
      premium: true,
      premiumStatus: "active",
      updatedAt: serverTimestamp(),
    };

    // Solo agregar campos adicionales si existen
    if (payment_id) {
      premiumData.premiumPayment = {
        paymentId: payment_id,
        date: serverTimestamp(),
        manuallyFixed: true,
        fixedAt: serverTimestamp(),
      };
    }

    // Agregar premiumSince solo si el usuario no era premium antes
    if (!currentPremium) {
      premiumData.premiumSince = serverTimestamp();
    }

    try {
      // Intentar actualizar primero
      if (userDoc?.exists()) {
        await updateDoc(userRef, premiumData);
      } else {
        // Si no existe, usar setDoc con merge para crearlo
        const { setDoc } = await import("firebase/firestore");
        await setDoc(userRef, premiumData, { merge: true });
      }
    } catch (updateError: any) {
      console.error("Error al actualizar:", updateError);
      // Si falla updateDoc, intentar con setDoc
      if (updateError.code === 'permission-denied' || updateError.code === 'not-found') {
        try {
          const { setDoc } = await import("firebase/firestore");
          await setDoc(userRef, premiumData, { merge: true });
        } catch (setError) {
          throw new Error(`No se pudo actualizar usuario: ${setError instanceof Error ? setError.message : 'Error desconocido'}`);
        }
      } else {
        throw updateError;
      }
    }

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

