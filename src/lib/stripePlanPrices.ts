/**
 * Precios Stripe compartidos (EUR zona euro / USD EE.UU. y Canadá).
 *
 * ESTE ARCHIVO ES LA ÚNICA FUENTE DE VERDAD DEL PRECIO. Nada de precios,
 * porcentajes de ahorro ni equivalencias por mes escritos a mano en otro
 * lado: derivalos con los helpers de abajo. Antes había doce lugares con el
 * número copiado (landing ES/EN, datos estructurados schema.org, modal
 * premium, admin, Telegram, carruseles) y se desincronizaron.
 *
 * Los montos en ARS (MercadoPago) NO se declaran acá: se derivan de EUR con
 * la cotización cacheada en `src/lib/exchangeRate.ts`.
 */

export type PlanTypeKey = "monthly" | "quarterly" | "annual";

export type StripePlanLine = {
  price: number;
  currency: "eur" | "usd";
  title: string;
  description: string;
};

/** Meses que cubre cada plan — base de los cálculos de ahorro y precio/mes. */
export const PLAN_MONTHS: Record<PlanTypeKey, number> = {
  monthly: 1,
  quarterly: 3,
  annual: 12,
};

/**
 * LOS PRECIOS. Único lugar del repo donde se escribe un importe a mano.
 * Todo lo demás (checkout, landing ES/EN, datos estructurados de Google, modal
 * premium, admin, Telegram, carruseles, ARS de MercadoPago) deriva de acá.
 */
const PRICES: Record<"eur" | "usd", Record<PlanTypeKey, number>> = {
  eur: { monthly: 14.99, quarterly: 39, annual: 99 },
  usd: { monthly: 16.99, quarterly: 44.99, annual: 109.99 },
};

export function getStripeSubscriptionPlans(currency: "eur" | "usd"): Record<PlanTypeKey, StripePlanLine> {
  if (currency === "usd") {
    return {
      monthly: {
        price: PRICES.usd.monthly,
        currency: "usd",
        title: "FitPlan Premium — Monthly",
        description:
          "Monthly premium access: personalized training & nutrition plans, advanced goals, and detailed tracking.",
      },
      quarterly: {
        price: PRICES.usd.quarterly,
        currency: "usd",
        title: "FitPlan Premium — Quarterly",
        description:
          "Quarterly premium (3 months billed once). Save vs monthly — full premium features.",
      },
      annual: {
        price: PRICES.usd.annual,
        currency: "usd",
        title: "FitPlan Premium — Annual",
        description:
          "Annual premium (12 months billed once). Best value for long-term consistency.",
      },
    };
  }

  return {
    monthly: {
      price: PRICES.eur.monthly,
      currency: "eur",
      title: "Plan Premium Mensual - FitPlan",
      description:
        "Acceso premium mensual a objetivos avanzados, dietas personalizadas y análisis avanzado",
    },
    quarterly: {
      price: PRICES.eur.quarterly,
      currency: "eur",
      title: "Plan Premium Trimestral - FitPlan",
      description: buildPlanDescription("es", "quarterly"),
    },
    annual: {
      price: PRICES.eur.annual,
      currency: "eur",
      title: "Plan Premium Anual - FitPlan",
      description: buildPlanDescription("es", "annual"),
    },
  };
}

/** Precio por mes equivalente de un plan, redondeado a 2 decimales. */
export function getPlanMonthlyEquivalent(currency: "eur" | "usd", plan: PlanTypeKey): number {
  const price = rawPrice(currency, plan);
  return Math.round((price / PLAN_MONTHS[plan]) * 100) / 100;
}

/**
 * Ahorro porcentual entero frente a pagar el mensual todos los meses.
 * Devuelve 0 para `monthly` (no ahorra contra sí mismo).
 */
export function getPlanSavingsPercent(currency: "eur" | "usd", plan: PlanTypeKey): number {
  if (plan === "monthly") return 0;
  const monthly = rawPrice(currency, "monthly");
  const full = monthly * PLAN_MONTHS[plan];
  if (full <= 0) return 0;
  return Math.round((1 - rawPrice(currency, plan) / full) * 100);
}

/** Etiqueta de ahorro lista para UI, o `undefined` si no aplica. */
export function getPlanSavingsLabel(currency: "eur" | "usd", plan: PlanTypeKey): string | undefined {
  const pct = getPlanSavingsPercent(currency, plan);
  if (pct <= 0) return undefined;
  return currency === "usd" ? `Save ${pct}%` : `Ahorras ${pct}%`;
}

/** Descripción para la pasarela de pago (Stripe/MercadoPago), derivada del precio. */
export function buildPlanDescription(locale: "es" | "en", plan: PlanTypeKey): string {
  const currency = locale === "en" ? "usd" : "eur";
  const months = PLAN_MONTHS[plan];
  const perMonth = getPlanMonthlyEquivalent(currency, plan).toFixed(2);
  const pct = getPlanSavingsPercent(currency, plan);
  if (locale === "en") {
    if (plan === "monthly") return "Monthly premium access — full plans, advanced goals and tracking.";
    return `Premium for ${months} months billed once — $${perMonth}/mo. Save ${pct}%.`;
  }
  if (plan === "monthly") {
    return "Acceso premium mensual a objetivos avanzados, dietas personalizadas y análisis avanzado";
  }
  return `Acceso premium ${plan === "annual" ? "anual" : "trimestral"} (${months} meses) - ${perMonth} EUR/mes - Ahorras ${pct}%`;
}

/**
 * Precio crudo, sin pasar por `getStripeSubscriptionPlans`. Existe para cortar
 * la recursión: `getStripeSubscriptionPlans` llama a `buildPlanDescription`,
 * que necesita saber los precios.
 *
 * Lee de `PRICES`, la MISMA tabla que usa `getStripeSubscriptionPlans` — no una
 * copia. Tener dos tablas distintas era justamente el bug que este archivo
 * existe para evitar.
 */
function rawPrice(currency: "eur" | "usd", plan: PlanTypeKey): number {
  return PRICES[currency][plan];
}

/** Etiquetas para UI (modal premium) — EUR. El ahorro se calcula, no se escribe. */
export const PLANS_EUR_UI = {
  monthly: { name: "Plan Mensual", period: "mes" },
  quarterly: {
    name: "Plan Trimestral",
    period: "3 meses",
    savings: getPlanSavingsLabel("eur", "quarterly"),
    popular: true,
  },
  annual: { name: "Plan Anual", period: "12 meses", savings: getPlanSavingsLabel("eur", "annual") },
} as const;

/** Etiquetas para UI — USD. */
export const PLANS_USD_UI = {
  monthly: { name: "Monthly", period: "per month" },
  quarterly: {
    name: "Quarterly",
    period: "every 3 months",
    savings: getPlanSavingsLabel("usd", "quarterly"),
    popular: true,
  },
  annual: { name: "Annual", period: "every 12 months", savings: getPlanSavingsLabel("usd", "annual") },
} as const;
