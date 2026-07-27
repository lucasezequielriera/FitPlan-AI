import type { NextApiRequest, NextApiResponse } from "next";
import { getAdminAuth } from "@/lib/firebase-admin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { payment_id } = req.query;

  if (!payment_id || typeof payment_id !== "string") {
    return res.status(400).json({ error: "payment_id es requerido" });
  }

  // Requiere sesión: sin esto, cualquiera podía consultar el monto/estado de
  // CUALQUIER payment_id de MercadoPago (no solo el propio) simplemente
  // adivinando/enumerando IDs, ya que este endpoint no verificaba identidad.
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) {
    return res.status(401).json({ error: "Token requerido" });
  }
  const adminAuth = getAdminAuth();
  if (!adminAuth) {
    return res.status(500).json({ error: "Firebase Admin SDK no configurado" });
  }
  let requesterUid: string;
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    requesterUid = decoded.uid;
  } catch {
    return res.status(401).json({ error: "Token inválido o expirado" });
  }

  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!accessToken) {
    return res.status(500).json({ error: "MercadoPago no está configurado" });
  }

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

    if (!paymentResponse.ok) {
      const errorText = await paymentResponse.text();
      return res.status(paymentResponse.status).json({ 
        error: "Error al obtener información del pago",
        detail: errorText 
      });
    }

    const payment = await paymentResponse.json();

    // El external_reference tiene formato "userId|planType" (o "intake:...").
    // Solo el dueño del pago puede consultarlo — evita que un uid autenticado
    // cualquiera vea el monto/estado de un pago ajeno probando otros payment_id.
    const externalRef: string = payment.external_reference || "";
    const paymentOwnerUid = externalRef.includes("|") ? externalRef.split("|")[0] : externalRef;
    if (paymentOwnerUid !== requesterUid) {
      return res.status(403).json({ error: "No autorizado para consultar este pago" });
    }

    return res.status(200).json({
      paymentId: payment.id,
      status: payment.status,
      statusDetail: payment.status_detail,
      transactionAmount: payment.transaction_amount,
      currencyId: payment.currency_id,
      paymentMethodId: payment.payment_method_id,
      externalReference: payment.external_reference,
    });
  } catch (error: unknown) {
    console.error("Error al verificar pago:", error);
    const message = error instanceof Error ? error.message : "Error desconocido";
    return res.status(500).json({ error: "Error al verificar el pago", detail: message });
  }
}

