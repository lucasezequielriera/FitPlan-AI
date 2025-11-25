import type { NextApiRequest, NextApiResponse } from "next";
import { MercadoPagoConfig, Preference } from "mercadopago";

const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN || "",
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { userId, userEmail, planType } = req.body;

  if (!userId || !userEmail) {
    return res.status(400).json({ error: "userId y userEmail son requeridos" });
  }

  // Definir precios según el tipo de plan (en ARS para Argentina)
  // Equivalente a: Mensual $10 USD | Trimestral $7/mes | Anual $5/mes
  // Tasa aproximada: 1 USD = 1050 ARS
  const planPrices: Record<string, { price: number; title: string; description: string }> = {
    monthly: {
      price: 10500, // ~$10 USD/mes
      title: "Plan Premium Mensual - FitPlan AI",
      description: "Acceso premium mensual a objetivos avanzados, dietas personalizadas y análisis avanzado",
    },
    quarterly: {
      price: 22000, // ~$7 USD/mes x 3 = $21 USD (~$22.000 ARS) - 30% ahorro
      title: "Plan Premium Trimestral - FitPlan AI",
      description: "Acceso premium trimestral (3 meses) - Ahorrás 30%",
    },
    annual: {
      price: 63000, // ~$5 USD/mes x 12 = $60 USD (~$63.000 ARS) - 50% ahorro
      title: "Plan Premium Anual - FitPlan AI",
      description: "Acceso premium anual (12 meses) - Ahorrás 50%",
    },
  };

  // Validar planType o usar mensual por defecto
  const selectedPlan = planType && planPrices[planType] ? planPrices[planType] : planPrices.monthly;

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
          title: selectedPlan.title,
          description: selectedPlan.description,
          quantity: 1,
          unit_price: selectedPlan.price,
          currency_id: "ARS",
        },
      ],
      payer: {
        email: userEmail,
      },
      external_reference: `${userId}|${planType || 'monthly'}`, // userId|planType para identificar usuario y tipo de plan
      back_urls: {
        success: `${baseUrl}/payment/success`,
        failure: `${baseUrl}/payment/failure`,
        pending: `${baseUrl}/payment/pending`,
      },
      statement_descriptor: "FitPlan AI Premium",
      payment_methods: {
        excluded_payment_types: [],
        excluded_payment_methods: [],
        installments: 1,
        default_installments: 1,
      },
      binary_mode: false, // Permitir estados pendientes
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

