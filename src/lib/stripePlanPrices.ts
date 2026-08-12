/**
 * Precios Stripe compartidos (EUR zona euro / USD EE.UU. y Canadá).
 * Mantener sincronizado con landing y admin.
 */

export type PlanTypeKey = "monthly" | "quarterly" | "annual";

export type StripePlanLine = {
  price: number;
  currency: "eur" | "usd";
  title: string;
  description: string;
};

export function getStripeSubscriptionPlans(currency: "eur" | "usd"): Record<PlanTypeKey, StripePlanLine> {
  if (currency === "usd") {
    return {
      monthly: {
        price: 5.99,
        currency: "usd",
        title: "FitPlan Premium — Monthly",
        description:
          "Monthly premium access: personalized training & nutrition plans, advanced goals, and detailed tracking.",
      },
      quarterly: {
        price: 13.99,
        currency: "usd",
        title: "FitPlan Premium — Quarterly",
        description:
          "Quarterly premium (3 months billed once). Save vs monthly — full premium features.",
      },
      annual: {
        price: 26.99,
        currency: "usd",
        title: "FitPlan Premium — Annual",
        description:
          "Annual premium (12 months billed once). Best value for long-term consistency.",
      },
    };
  }

  return {
    monthly: {
      price: 5,
      currency: "eur",
      title: "Plan Premium Mensual - FitPlan",
      description:
        "Acceso premium mensual a objetivos avanzados, dietas personalizadas y análisis avanzado",
    },
    quarterly: {
      price: 12,
      currency: "eur",
      title: "Plan Premium Trimestral - FitPlan",
      description: "Acceso premium trimestral (3 meses) - 4 EUR/mes - Ahorrás 20%",
    },
    annual: {
      price: 25,
      currency: "eur",
      title: "Plan Premium Anual - FitPlan",
      description: "Acceso premium anual (12 meses) - 2.08 EUR/mes - Ahorrás 58%",
    },
  };
}

/** Etiquetas para UI (modal premium) — EUR */
export const PLANS_EUR_UI = {
  monthly: { name: "Plan Mensual", period: "mes" },
  quarterly: { name: "Plan Trimestral", period: "3 meses", savings: "Ahorrás 20%", popular: true },
  annual: { name: "Plan Anual", period: "12 meses", savings: "Ahorrás 58%" },
} as const;

/** Etiquetas para UI — USD */
export const PLANS_USD_UI = {
  monthly: { name: "Monthly", period: "per month" },
  quarterly: {
    name: "Quarterly",
    period: "every 3 months",
    savings: "Save vs monthly",
    popular: true,
  },
  annual: { name: "Annual", period: "every 12 months", savings: "Best value" },
} as const;
