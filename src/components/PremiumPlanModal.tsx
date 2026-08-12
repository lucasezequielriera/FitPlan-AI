import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { FaBolt, FaCheck, FaCrown, FaStar, FaTimes } from "react-icons/fa";
import type { IconType } from "react-icons";
import { getPaymentProvider, getStripeCurrency } from "@/lib/paymentUtils";
import {
  getStripeSubscriptionPlans,
  PLANS_EUR_UI,
  PLANS_USD_UI,
} from "@/lib/stripePlanPrices";
import { trackEvent } from "@/lib/analytics";

export interface PremiumPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Si faltan, el botón de pago llama a `onRequireAuth` (p. ej. abrir login en la landing). */
  userId?: string;
  userEmail?: string;
  returnUrl?: string;
  locale?: "es" | "en";
  onRequireAuth?: () => void;
}

type PlanType = "monthly" | "quarterly" | "annual";

interface Plan {
  type: PlanType;
  name: string;
  price: number;
  period: string;
  savings?: string;
  popular?: boolean;
}

const plansARS: Plan[] = [
  {
    type: "monthly",
    name: "Plan Mensual",
    price: 10000,
    period: "mes",
  },
  {
    type: "quarterly",
    name: "Plan Trimestral",
    price: 24000,
    period: "3 meses",
    savings: "Ahorras 20%",
    popular: true,
  },
  {
    type: "annual",
    name: "Plan Anual",
    price: 50000,
    period: "12 meses",
    savings: "Ahorras 58%",
  },
];

function buildStripePlans(currency: "eur" | "usd"): Plan[] {
  const stripe = getStripeSubscriptionPlans(currency);
  const ui = currency === "usd" ? PLANS_USD_UI : PLANS_EUR_UI;
  return (["monthly", "quarterly", "annual"] as const).map((key) => {
    const row = ui[key];
    const savings = "savings" in row && typeof row.savings === "string" ? row.savings : undefined;
    const popular = "popular" in row && row.popular === true ? true : undefined;
    return {
      type: key,
      name: row.name,
      price: stripe[key].price,
      period: row.period,
      savings,
      popular,
    };
  });
}

type CompareRow = { label: string; free: boolean; premium: boolean };

function getCompareRows(locale: "es" | "en"): CompareRow[] {
  if (locale === "en") {
    return [
      { label: "Full AI plan (not just templates)", free: false, premium: true },
      { label: "Quick template-based plan", free: true, premium: false },
      { label: "Advanced goals & sport modes", free: false, premium: true },
      { label: "30-day trial window", free: true, premium: false },
      { label: "Unlimited while subscribed", free: false, premium: true },
      { label: "Calendar, multi-plan, PDF & meal log", free: false, premium: true },
    ];
  }
  return [
    { label: "Plan con IA completa (no solo plantillas)", free: false, premium: true },
    { label: "Plan rápido por plantillas", free: true, premium: false },
    { label: "Objetivos y modos deporte avanzados", free: false, premium: true },
    { label: "Ventana de prueba 30 días", free: true, premium: false },
    { label: "Ilimitado con la suscripción activa", free: false, premium: true },
    { label: "Calendario, multi-plan, PDF y comidas", free: false, premium: true },
  ];
}

type Highlight = { Icon: IconType; text: string };
function getPremiumHighlights(locale: "es" | "en"): Highlight[] {
  if (locale === "en") {
    return [
      { Icon: FaBolt, text: "AI-built plans" },
      { Icon: FaStar, text: "Train + eat, one flow" },
      { Icon: FaCrown, text: "Full app, no day cap" },
    ];
  }
  return [
    { Icon: FaBolt, text: "Plan con IA de verdad" },
    { Icon: FaStar, text: "Gym y comidas, mismo flujo" },
    { Icon: FaCrown, text: "App completa, sin tope de días" },
  ];
}

export default function PremiumPlanModal({
  isOpen,
  onClose,
  userId,
  userEmail,
  returnUrl,
  locale = "es",
  onRequireAuth,
}: PremiumPlanModalProps) {
  const [selectedPlan, setSelectedPlan] = useState<PlanType | null>(null);
  const [processing, setProcessing] = useState(false);
  const [paymentProvider, setPaymentProvider] = useState<"stripe" | "mercadopago" | null>(null);
  const [stripeCurrency, setStripeCurrency] = useState<"eur" | "usd">("eur");
  const [loadingProvider, setLoadingProvider] = useState(true);

  const copy = useMemo(() => {
    if (locale === "en") {
      return {
        title: "Go Premium",
        subtitle: "Three billing rhythms. One full Premium—pick what fits your wallet.",
        compareTitle: "Free vs Premium",
        colFree: "Free",
        colPremium: "Premium",
        billingTitle: "Choose billing",
        sameFeatures: "Same features in every tier—only how often you pay changes.",
        includedTitle: "Every tier includes",
        includedBullets: [
          "Full AI + advanced goals",
          "Unlimited while your sub is active",
          "Calendar, PDF, stats & meals",
        ],
        planChips: ["Full AI", "Gym + meals", "All-in"],
        planHook: {
          monthly: "Pay monthly — stop anytime",
          quarterly: "Best balance: save without a year upfront",
          annual: "Lowest per month · max savings",
        } satisfies Record<PlanType, string>,
        selectPlan: "Continue",
        loading: "Loading…",
        processing: "Processing…",
        loginHint: "Sign in to complete checkout",
        close: "Close",
      };
    }
    return {
      title: "Pasá a Premium",
      subtitle: "Tres formas de pagar. El mismo Premium completo: elige la que te cierra.",
      compareTitle: "Gratis vs Premium",
      colFree: "Gratis",
      colPremium: "Premium",
      billingTitle: "Elige la cuota",
      sameFeatures: "Mismas funciones en los tres precios; solo cambia cada cuánto cobramos.",
      includedTitle: "En los tres tienes",
      includedBullets: [
        "IA completa + objetivos avanzados",
        "Todo desbloqueado mientras siga activa la suscripción",
        "Calendario, PDF, stats y comidas",
      ],
      planChips: ["IA completa", "Gym + comidas", "Todo incluido"],
      planHook: {
        monthly: "Mes a mes — sales cuando quieras",
        quarterly: "El equilibrio: ahorras sin atarte al año",
        annual: "Lo más barato al mes · máximo ahorro",
      } satisfies Record<PlanType, string>,
      selectPlan: "Continuar",
      loading: "Cargando…",
      processing: "Procesando…",
      loginHint: "Iniciá sesión para completar el pago",
      close: "Cerrar",
    };
  }, [locale]);

  const compareRows = useMemo(() => getCompareRows(locale), [locale]);
  const premiumHighlights = useMemo(() => getPremiumHighlights(locale), [locale]);

  useEffect(() => {
    if (isOpen) {
      const detectProvider = async () => {
        setLoadingProvider(true);
        try {
          const provider = await getPaymentProvider();
          setPaymentProvider(provider);
          if (provider === "stripe") {
            const cur = await getStripeCurrency();
            setStripeCurrency(cur);
          }
        } catch (error) {
          console.error("Error al detectar proveedor de pago:", error);
          setPaymentProvider("mercadopago");
        } finally {
          setLoadingProvider(false);
        }
      };
      void detectProvider();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const plans = paymentProvider === "stripe" ? buildStripePlans(stripeCurrency) : plansARS;
  const hasAccount = Boolean(userId && userEmail);

  const handleSelectPlan = async (planType: PlanType) => {
    if (!hasAccount) {
      onRequireAuth?.();
      return;
    }

    if (!paymentProvider) {
      alert(locale === "en" ? "Loading payment info, please wait…" : "Cargando información de pago, por favor espera…");
      return;
    }

    setProcessing(true);
    try {
      const selected = plans.find((p) => p.type === planType);
      const normalizedCurrency = paymentProvider === "stripe" ? stripeCurrency.toUpperCase() : "ARS";
      trackEvent("begin_checkout", {
        source: "premium-modal",
        plan_type: planType,
        provider: paymentProvider,
        currency: normalizedCurrency,
        value: selected?.price,
      }, { sendServer: true, user: { email: userEmail } });

      const endpoint = paymentProvider === "stripe" ? "/api/createStripePayment" : "/api/createPayment";

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          returnUrl: returnUrl || `${typeof window !== "undefined" ? window.location.origin : ""}/dashboard`,
          userEmail,
          planType,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Error al crear el pago");
      }

      const data = await response.json();

      if (paymentProvider === "stripe" && data.url) {
        window.location.href = data.url;
      } else if (paymentProvider === "mercadopago" && data.init_point) {
        window.location.href = data.init_point;
      } else {
        throw new Error("No se recibió el link de pago");
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Error desconocido";
      alert(locale === "en" ? `Payment error: ${message}` : `Error al procesar el pago: ${message}`);
      console.error("Error al crear pago:", error);
    } finally {
      setProcessing(false);
    }
  };

  const handlePlanSelection = (planType: PlanType) => {
    const selected = plans.find((p) => p.type === planType);
    const normalizedCurrency = paymentProvider === "stripe" ? stripeCurrency.toUpperCase() : "ARS";
    setSelectedPlan(planType);
    trackEvent("add_to_cart", {
      source: "premium-modal",
      content_type: "subscription_plan",
      plan_type: planType,
      currency: normalizedCurrency,
      value: selected?.price,
    });
  };

  const priceLabel = (plan: Plan) => {
    if (paymentProvider === "stripe") {
      if (stripeCurrency === "usd") {
        return `$${plan.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      }
      return `${plan.price.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
    }
    return `$${plan.price.toLocaleString("es-AR")}`;
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/70 backdrop-blur-sm p-0 sm:items-center sm:p-4"
      style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.98, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: 16 }}
        className="relative bg-[color-mix(in_oklab,var(--background)_95%,#0f172a)] sm:rounded-2xl rounded-t-2xl border border-[var(--landing-border)] border-b-0 sm:border-b p-3 pt-12 sm:p-6 sm:pt-6 max-w-5xl w-full max-h-[min(92dvh,100dvh)] sm:max-h-[92vh] overflow-y-auto overscroll-contain shadow-2xl pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-6"
        onClick={(e) => e.stopPropagation()}
        lang={locale}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-4">
          <div className="min-w-0 pr-2">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--foreground)] flex flex-wrap items-center gap-2">
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--landing-accent)]/30 to-[var(--info)]/20 ring-1 ring-[var(--landing-accent)]/40 text-[var(--landing-accent)]" aria-hidden>
                ✦
              </span>
              <span className="bg-gradient-to-r from-[var(--foreground)] to-[var(--landing-accent)] bg-clip-text text-transparent text-balance">
                {copy.title}
              </span>
            </h2>
            <p className="text-[var(--landing-muted)] text-sm sm:text-base mt-2 max-w-xl font-medium text-pretty">{copy.subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="absolute right-2 top-2 sm:relative sm:right-0 sm:top-0 text-[var(--foreground)]/70 hover:text-[var(--foreground)] transition-colors flex-shrink-0 rounded-lg p-2 sm:p-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent)] touch-manipulation self-end sm:self-start"
            aria-label={copy.close}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5 sm:h-6 sm:w-6">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mb-4 sm:mb-5 rounded-2xl border border-[var(--landing-accent)]/35 bg-gradient-to-br from-[color-mix(in_oklab,var(--landing-accent)_14%,transparent)] via-[var(--landing-surface)] to-[color-mix(in_oklab,#6366f1_8%,transparent)] p-3 sm:p-4 shadow-[0_0_40px_-12px_rgba(45,212,191,0.35)]">
          <p className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] text-[var(--landing-accent)] mb-2.5">Premium</p>
          <ul className="flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:gap-3">
            {premiumHighlights.map(({ Icon, text }) => (
              <li
                key={text}
                className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl bg-black/25 px-3 py-2.5 ring-1 ring-white/10 sm:min-w-[140px] sm:flex-[1_1_30%]"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--landing-accent)]/20 text-[var(--landing-accent)]">
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <span className="text-xs sm:text-sm font-semibold leading-snug text-[var(--foreground)] text-pretty">{text}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mb-4 rounded-xl border border-dashed border-[var(--landing-accent)]/40 bg-[var(--landing-surface)]/80 px-3 py-3 sm:px-4 sm:py-3.5">
          <p className="text-[11px] sm:text-xs font-bold uppercase tracking-wide text-[var(--landing-accent)] mb-2">{copy.includedTitle}</p>
          <ul className="space-y-1.5">
            {copy.includedBullets.map((line) => (
              <li key={line} className="flex items-start gap-2 text-xs sm:text-sm text-[var(--foreground)]/95">
                <FaCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--landing-accent)]" aria-hidden />
                <span className="leading-snug font-medium">{line}</span>
              </li>
            ))}
          </ul>
        </div>

        <section className="mb-6 sm:mb-8 rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface)] overflow-hidden relative">
          <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-b border-[var(--landing-border)] bg-[color-mix(in_oklab,var(--landing-accent)_12%,transparent)]">
            <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wide text-[var(--landing-accent)]">{copy.compareTitle}</h3>
          </div>

          <ul className="md:hidden divide-y divide-[var(--landing-border)]">
            {compareRows.map((row) => (
              <li key={row.label} className="px-3 py-3">
                <p className="text-xs font-medium text-[var(--foreground)] leading-snug text-pretty mb-2.5">{row.label}</p>
                <div className="flex items-center justify-between gap-3 text-[11px] sm:text-xs">
                  <span className="flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg bg-black/20 px-2 py-2 text-[var(--landing-muted)]">
                    <span className="truncate font-medium">{copy.colFree}</span>
                    {row.free ? (
                      <FaCheck className="h-3.5 w-3.5 shrink-0 text-success" aria-hidden />
                    ) : (
                      <FaTimes className="h-3.5 w-3.5 shrink-0 text-white/25" aria-hidden />
                    )}
                  </span>
                  <span className="flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg bg-[color-mix(in_oklab,var(--landing-accent)_10%,transparent)] px-2 py-2 text-[var(--landing-accent)]">
                    <span className="truncate font-medium">{copy.colPremium}</span>
                    {row.premium ? (
                      <FaCheck className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    ) : (
                      <FaTimes className="h-3.5 w-3.5 shrink-0 text-white/25" aria-hidden />
                    )}
                  </span>
                </div>
              </li>
            ))}
          </ul>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm text-left min-w-0">
              <thead>
                <tr className="border-b border-[var(--landing-border)]">
                  <th className="px-3 py-3 font-medium text-[var(--foreground)] w-[min(50%,28rem)]"></th>
                  <th className="px-2 py-3 font-semibold text-center text-[var(--landing-muted)] w-[12%]">{copy.colFree}</th>
                  <th className="px-2 py-3 font-semibold text-center text-[var(--landing-accent)] w-[12%]">{copy.colPremium}</th>
                </tr>
              </thead>
              <tbody>
                {compareRows.map((row) => (
                  <tr key={row.label} className="border-b border-[var(--landing-border)]/80 last:border-0">
                    <td className="px-3 py-2.5 text-[var(--foreground)]/90 leading-snug text-pretty">{row.label}</td>
                    <td className="px-2 py-2.5 text-center align-middle">
                      {row.free ? (
                        <FaCheck className="inline h-4 w-4 text-success" aria-label="Yes" />
                      ) : (
                        <FaTimes className="inline h-4 w-4 text-white/25" aria-label="No" />
                      )}
                    </td>
                    <td className="px-2 py-2.5 text-center align-middle">
                      {row.premium ? (
                        <FaCheck className="inline h-4 w-4 text-[var(--landing-accent)]" aria-label="Yes" />
                      ) : (
                        <FaTimes className="inline h-4 w-4 text-white/25" aria-label="No" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="mb-3 sm:mb-4">
          <h3 className="text-base sm:text-lg font-bold text-[var(--foreground)] flex items-center gap-2">
            <span className="inline-block h-1 w-6 rounded-full bg-[var(--landing-accent)]" aria-hidden />
            {copy.billingTitle}
          </h3>
          <p className="text-[var(--landing-muted)] text-xs sm:text-sm mt-1.5 text-pretty font-medium">{copy.sameFeatures}</p>
        </div>

        {!hasAccount && (
          <p className="mb-3 sm:mb-4 text-center text-[11px] sm:text-xs text-warning bg-warning/10 border border-warning/25 rounded-lg px-3 py-2 text-pretty">
            {copy.loginHint}
          </p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-3 sm:mb-4">
          {plans.map((plan) => (
            <div
              key={plan.type}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") handlePlanSelection(plan.type);
              }}
              onClick={() => handlePlanSelection(plan.type)}
              className={`relative flex flex-col p-4 sm:pl-5 sm:pr-5 sm:py-5 rounded-xl border cursor-pointer transition-all text-left touch-manipulation min-h-0 border-l-[3px] pl-[1.1rem] sm:pl-6 ${
                plan.type === "monthly"
                  ? "border-l-cyan-400/75"
                  : plan.type === "annual"
                    ? "border-l-amber-400/70"
                    : "border-l-[color-mix(in_oklab,var(--landing-accent)_85%,transparent)]"
              } ${
                selectedPlan === plan.type
                  ? "bg-[color-mix(in_oklab,var(--landing-accent)_18%,transparent)] border-[var(--landing-accent)] ring-1 ring-[var(--landing-accent)]/50"
                  : plan.popular
                    ? "bg-[color-mix(in_oklab,var(--landing-accent)_8%,transparent)] border-[var(--landing-accent)]/40 hover:border-[var(--landing-accent)]/70"
                    : "bg-[var(--landing-surface)] border-[var(--landing-border)] hover:border-[var(--landing-border)] hover:bg-[var(--landing-surface-2)]"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                  <span className="px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide rounded-full bg-[var(--landing-accent)] text-[#0a1628]">
                    {locale === "en" ? "Popular" : "Popular"}
                  </span>
                </div>
              )}

              <h3 className="text-base sm:text-lg font-bold text-[var(--foreground)] mb-1 pt-1 text-balance">{plan.name}</h3>
              <div className="mb-1 break-words">
                <span className="text-xl sm:text-2xl md:text-3xl font-bold bg-gradient-to-r from-white to-[var(--landing-accent)]/90 bg-clip-text text-transparent tabular-nums">{priceLabel(plan)}</span>
              </div>
              <p className="text-[var(--landing-muted)] text-[11px] sm:text-xs mb-2 font-medium">{plan.period}</p>
              {plan.savings && (
                <p className="text-success text-[10px] sm:text-xs font-bold mb-2 px-2 py-0.5 rounded-md bg-success/15 border border-success/30 w-fit">
                  {plan.savings}
                </p>
              )}
              <p className="mb-2 mt-3 border-t border-white/10 pt-3 text-xs sm:text-sm font-extrabold leading-snug text-pretty bg-gradient-to-r from-[var(--foreground)] via-[var(--landing-accent)] to-[var(--info)]/90 bg-clip-text text-transparent">
                {copy.planHook[plan.type]}
              </p>
              <div className="mb-3 flex flex-wrap gap-1.5" aria-label={locale === "en" ? "Included in plan" : "Incluido en el plan"}>
                {copy.planChips.map((chip) => (
                  <span
                    key={chip}
                    className="inline-flex items-center rounded-full border border-[var(--landing-accent)]/35 bg-[color-mix(in_oklab,var(--landing-accent)_12%,transparent)] px-2 py-0.5 text-[9px] sm:text-[10px] font-bold uppercase tracking-wide text-[var(--landing-accent)]"
                  >
                    {chip}
                  </span>
                ))}
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  void handleSelectPlan(plan.type);
                }}
                disabled={processing || loadingProvider}
                className={`w-full mt-auto min-h-[44px] px-4 py-2.5 rounded-lg font-medium transition-all text-sm ${
                  selectedPlan === plan.type
                    ? "bg-[var(--landing-accent)] text-[#0a1628] hover:brightness-110"
                    : plan.popular
                      ? "bg-[color-mix(in_oklab,var(--landing-accent)_35%,#0f172a)] text-[var(--foreground)] border border-[var(--landing-accent)]/50 hover:bg-[color-mix(in_oklab,var(--landing-accent)_45%,#0f172a)]"
                      : "bg-[var(--landing-surface-2)] text-[var(--foreground)] border border-[var(--landing-border)] hover:bg-[color-mix(in_oklab,var(--foreground)_10%,transparent)]"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {loadingProvider ? copy.loading : processing ? copy.processing : copy.selectPlan}
              </button>
            </div>
          ))}
        </div>

        <p className="text-center text-[var(--landing-muted)] text-[11px] sm:text-xs">
          {locale === "en"
            ? "Taxes may apply depending on your country. Subscription renews until cancelled."
            : "Los impuestos pueden aplicar según tu país. La suscripción se renueva hasta que la canceles."}
        </p>
      </motion.div>
    </div>
  );
}
