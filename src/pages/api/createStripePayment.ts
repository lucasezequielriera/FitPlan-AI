import type { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";

// Inicializar Stripe con la clave secreta
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2025-11-17.clover",
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { userId, userEmail, planType } = req.body;

  if (!userId || !userEmail) {
    return res.status(400).json({ error: "userId y userEmail son requeridos" });
  }

  // Definir precios según el tipo de plan (en EUR para usuarios internacionales)
  // Precio: 1 EUR/mes
  const planPrices: Record<string, { price: number; title: string; description: string; currency: string }> = {
    monthly: {
      price: 1, // 1 EUR/mes
      currency: "eur",
      title: "Plan Premium Mensual - FitPlan AI",
      description: "Acceso premium mensual a objetivos avanzados, dietas personalizadas y análisis avanzado",
    },
    quarterly: {
      price: 2.70, // 0.90 EUR/mes x 3 = 2.70 EUR total (10% ahorro)
      currency: "eur",
      title: "Plan Premium Trimestral - FitPlan AI",
      description: "Acceso premium trimestral (3 meses) - 0.90 EUR/mes - Ahorrás 10%",
    },
    annual: {
      price: 10.80, // 0.90 EUR/mes x 12 = 10.80 EUR total (10% ahorro)
      currency: "eur",
      title: "Plan Premium Anual - FitPlan AI",
      description: "Acceso premium anual (12 meses) - 0.90 EUR/mes - Ahorrás 10%",
    },
  };

  // Validar planType o usar mensual por defecto
  const selectedPlan = planType && planPrices[planType] ? planPrices[planType] : planPrices.monthly;

  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(500).json({ error: "Stripe no está configurado. Falta STRIPE_SECRET_KEY en las variables de entorno." });
  }

  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    
    // Verificar que la URL base sea válida
    if (!baseUrl || baseUrl === "") {
      throw new Error("NEXT_PUBLIC_BASE_URL no está configurada");
    }

    // Crear una sesión de checkout de Stripe
    const currency = selectedPlan.currency || "eur";
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: currency,
            product_data: {
              name: selectedPlan.title,
              description: selectedPlan.description,
            },
            unit_amount: Math.round(selectedPlan.price * 100), // Stripe usa centavos/céntimos
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      customer_email: userEmail,
      success_url: `${baseUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}&provider=stripe&redirect=create-plan`,
      cancel_url: `${baseUrl}/payment/failure?provider=stripe`,
      metadata: {
        userId: userId,
        planType: planType || "monthly",
      },
    });

    if (session.url) {
      return res.status(200).json({
        url: session.url,
        session_id: session.id,
      });
    } else {
      return res.status(500).json({ error: "No se pudo crear la sesión de pago" });
    }
  } catch (error: unknown) {
    console.error("Error al crear sesión de pago de Stripe:", error);
    const message = error instanceof Error ? error.message : "Error desconocido";
    return res.status(500).json({ error: "Error al crear la sesión de pago", detail: message });
  }
}

