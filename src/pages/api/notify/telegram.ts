import type { NextApiRequest, NextApiResponse } from "next";
import { sendTelegramMessage, formatNewUserMessage, formatPaymentMessage } from "@/lib/telegram";
import { getAdminDb } from "@/lib/firebase-admin";

/**
 * Endpoint para enviar notificaciones a Telegram
 * POST /api/notify/telegram
 * Body: { type: "new_user" | "payment", data: {...} }
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { type, data } = req.body;

  if (!type || !data) {
    return res.status(400).json({ error: "type y data son requeridos" });
  }

  try {
    let message = "";

    if (type === "new_user") {
      // Obtener datos completos del usuario desde Firestore si es necesario
      const adminDb = getAdminDb();
      if (adminDb && data.userId) {
        try {
          const userDoc = await adminDb.collection("usuarios").doc(data.userId).get();
          if (userDoc.exists) {
            const userData = userDoc.data();
            message = formatNewUserMessage({
              nombre: userData?.nombre || null,
              email: userData?.email || data.email || null,
              createdAt: userData?.createdAt?.toDate?.() || userData?.createdAt || new Date(),
              ciudad: userData?.ciudad || null,
              pais: userData?.pais || null,
            });
          } else {
            // Si no existe en Firestore, usar los datos proporcionados
            message = formatNewUserMessage({
              nombre: data.nombre || null,
              email: data.email || null,
              createdAt: new Date(),
              ciudad: data.ciudad || null,
              pais: data.pais || null,
            });
          }
        } catch (error) {
          console.error("Error al obtener datos del usuario:", error);
          // Fallback a datos proporcionados
          message = formatNewUserMessage({
            nombre: data.nombre || null,
            email: data.email || null,
            createdAt: new Date(),
            ciudad: data.ciudad || null,
            pais: data.pais || null,
          });
        }
      } else {
        // Sin Admin SDK, usar datos proporcionados
        message = formatNewUserMessage({
          nombre: data.nombre || null,
          email: data.email || null,
          createdAt: data.createdAt || new Date(),
          ciudad: data.ciudad || null,
          pais: data.pais || null,
        });
      }
    } else if (type === "payment") {
      message = formatPaymentMessage({
        nombre: data.nombre || null,
        email: data.email || null,
        amount: data.amount || 0,
        currency: data.currency || "ARS",
        planType: data.planType || "monthly",
        paymentMethod: data.paymentMethod || "mercadopago",
        paymentId: data.paymentId || null,
        date: data.date || new Date(),
      });
    } else {
      return res.status(400).json({ error: "Tipo de notificación no válido" });
    }

    const success = await sendTelegramMessage(message);

    if (success) {
      return res.status(200).json({ success: true, message: "Notificación enviada" });
    } else {
      return res.status(500).json({ error: "No se pudo enviar la notificación" });
    }
  } catch (error) {
    console.error("Error al procesar notificación:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
}

