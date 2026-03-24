import type { NextApiRequest, NextApiResponse } from "next";
type MercadoPagoPreapprovalResponse = {
  id?: string;
  init_point?: string;
  sandbox_init_point?: string;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { userId, userEmail, planType } = req.body;

  if (!userId || !userEmail) {
    return res.status(400).json({ error: "userId y userEmail son requeridos" });
  }

  // Definir precios según el tipo de plan (en ARS para Argentina)
  // Referencia actual: 1 EUR = 2000 ARS (ajustar según cotización real)
  const planPrices: Record<string, { price: number; title: string; description: string }> = {
    monthly: {
      price: 10000, // 5 EUR/mes
      title: "Plan Premium Mensual - FitPlan AI",
      description: "Acceso premium mensual a objetivos avanzados, dietas personalizadas y análisis avanzado",
    },
    quarterly: {
      price: 24000, // 12 EUR total (~24000 ARS)
      title: "Plan Premium Trimestral - FitPlan AI",
      description: "Acceso premium trimestral (3 meses) - Ahorrás 20%",
    },
    annual: {
      price: 50000, // 25 EUR total (~50000 ARS)
      title: "Plan Premium Anual - FitPlan AI",
      description: "Acceso premium anual (12 meses) - Ahorrás 58%",
    },
  };

  // Validar planType o usar mensual por defecto
  const selectedPlan = planType && planPrices[planType] ? planPrices[planType] : planPrices.monthly;

  if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
    return res.status(500).json({ error: "MercadoPago no está configurado. Falta MERCADOPAGO_ACCESS_TOKEN en las variables de entorno." });
  }

  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    
    // Verificar que la URL base sea válida
    if (!baseUrl || baseUrl === "") {
      throw new Error("NEXT_PUBLIC_BASE_URL no está configurada");
    }

    const frequency = planType === "annual" ? 12 : planType === "quarterly" ? 3 : 1;
    const preapprovalPayload: Record<string, unknown> = {
      reason: selectedPlan.title,
      external_reference: `${userId}|${planType || "monthly"}`,
      payer_email: userEmail,
      back_url: `${baseUrl}/payment/success?redirect=dashboard&provider=mercadopago`,
      status: "pending",
      auto_recurring: {
        frequency,
        frequency_type: "months",
        transaction_amount: selectedPlan.price,
        currency_id: "ARS",
        // Primer mes gratis: MP cobra a partir del siguiente ciclo
        free_trial: {
          frequency: 1,
          frequency_type: "months",
        },
      },
    };

    if (baseUrl && !baseUrl.includes("localhost")) {
      preapprovalPayload.notification_url = `${baseUrl}/api/payment/webhook`;
    }

    const preapprovalResponse = await fetch("https://api.mercadopago.com/preapproval", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(preapprovalPayload),
    });

    if (!preapprovalResponse.ok) {
      const detail = await preapprovalResponse.text();
      return res.status(preapprovalResponse.status).json({
        error: "No se pudo crear la suscripción en MercadoPago",
        detail,
      });
    }

    const response = (await preapprovalResponse.json()) as MercadoPagoPreapprovalResponse;
    const initPoint = response.init_point || response.sandbox_init_point;

    if (initPoint) {
      return res.status(200).json({
        init_point: initPoint,
        preapproval_id: response.id || null,
      });
    } else {
      return res.status(500).json({ error: "No se pudo crear el link de suscripción" });
    }
  } catch (error: unknown) {
    console.error("Error al crear suscripción en MercadoPago:", error);
    const message = error instanceof Error ? error.message : "Error desconocido";
    return res.status(500).json({ error: "Error al crear la suscripción", detail: message });
  }
}

