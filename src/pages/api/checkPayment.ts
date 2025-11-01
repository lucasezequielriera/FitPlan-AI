import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { payment_id } = req.query;

  if (!payment_id || typeof payment_id !== "string") {
    return res.status(400).json({ error: "payment_id es requerido" });
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

