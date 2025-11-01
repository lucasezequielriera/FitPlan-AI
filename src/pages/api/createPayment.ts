import type { NextApiRequest, NextApiResponse } from "next";
import { MercadoPagoConfig, Preference } from "mercadopago";

const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN || "",
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { userId, userEmail } = req.body;

  if (!userId || !userEmail) {
    return res.status(400).json({ error: "userId y userEmail son requeridos" });
  }

  if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
    return res.status(500).json({ error: "MercadoPago no está configurado. Falta MERCADOPAGO_ACCESS_TOKEN en las variables de entorno." });
  }

  try {
    const preference = new Preference(client);

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    
    // Verificar que la URL base sea válida
    if (!baseUrl || baseUrl === "") {
      throw new Error("NEXT_PUBLIC_BASE_URL no está configurada");
    }

    const paymentPreference: any = {
      items: [
        {
          title: "Plan Premium - FitPlan AI",
          description: "Acceso premium a objetivos avanzados, dietas personalizadas y análisis avanzado",
          quantity: 1,
          unit_price: 25000, // $25.000 ARS
          currency_id: "ARS",
        },
      ],
      payer: {
        email: userEmail,
      },
      external_reference: userId, // Para identificar al usuario cuando regrese del pago
      back_urls: {
        success: `${baseUrl}/payment/success`,
        failure: `${baseUrl}/payment/failure`,
        pending: `${baseUrl}/payment/pending`,
      },
      statement_descriptor: "FitPlan AI Premium",
    };

    // Agregar notification_url solo si no es localhost (para desarrollo local no funcionará)
    if (baseUrl && !baseUrl.includes("localhost")) {
      paymentPreference.notification_url = `${baseUrl}/api/payment/webhook`;
    }

    const response = await preference.create({ body: paymentPreference });

    if (response.init_point) {
      return res.status(200).json({
        init_point: response.init_point,
        preference_id: response.id,
      });
    } else {
      return res.status(500).json({ error: "No se pudo crear la preferencia de pago" });
    }
  } catch (error: unknown) {
    console.error("Error al crear preferencia de pago:", error);
    const message = error instanceof Error ? error.message : "Error desconocido";
    return res.status(500).json({ error: "Error al crear la preferencia de pago", detail: message });
  }
}

