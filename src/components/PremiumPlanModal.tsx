import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { getPaymentProvider } from "@/lib/paymentUtils";

interface PremiumPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userEmail: string;
}

type PlanType = "monthly" | "quarterly" | "annual";

interface Plan {
  type: PlanType;
  name: string;
  price: number;
  priceEUR?: number;
  period: string;
  savings?: string;
  savingsEUR?: string;
  popular?: boolean;
}

// Planes en ARS (MercadoPago)
const plansARS: Plan[] = [
  {
    type: "monthly",
    name: "Plan Mensual",
    price: 30000,
    period: "mes",
  },
  {
    type: "quarterly",
    name: "Plan Trimestral",
    price: 75000,
    period: "3 meses",
    savings: "Ahorrás $15.000",
    popular: true,
  },
  {
    type: "annual",
    name: "Plan Anual",
    price: 250000,
    period: "12 meses",
    savings: "Ahorrás $110.000",
  },
];

// Planes en EUR (Stripe)
const plansEUR: Plan[] = [
  {
    type: "monthly",
    name: "Plan Mensual",
    price: 30,
    priceEUR: 30,
    period: "mes",
  },
  {
    type: "quarterly",
    name: "Plan Trimestral",
    price: 75,
    priceEUR: 75,
    period: "3 meses",
    savings: "Ahorrás €15",
    savingsEUR: "Ahorrás €15",
    popular: true,
  },
  {
    type: "annual",
    name: "Plan Anual",
    price: 250,
    priceEUR: 250,
    period: "12 meses",
    savings: "Ahorrás €110",
    savingsEUR: "Ahorrás €110",
  },
];

export default function PremiumPlanModal({ isOpen, onClose, userId, userEmail }: PremiumPlanModalProps) {
  const [selectedPlan, setSelectedPlan] = useState<PlanType | null>(null);
  const [processing, setProcessing] = useState(false);
  const [paymentProvider, setPaymentProvider] = useState<"stripe" | "mercadopago" | null>(null);
  const [loadingProvider, setLoadingProvider] = useState(true);

  // Detectar el proveedor de pago al abrir el modal
  useEffect(() => {
    if (isOpen) {
      const detectProvider = async () => {
        setLoadingProvider(true);
        try {
          const provider = await getPaymentProvider();
          setPaymentProvider(provider);
        } catch (error) {
          console.error("Error al detectar proveedor de pago:", error);
          // Fallback a MercadoPago si hay error
          setPaymentProvider("mercadopago");
        } finally {
          setLoadingProvider(false);
        }
      };
      detectProvider();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const plans = paymentProvider === "stripe" ? plansEUR : plansARS;

  const handleSelectPlan = async (planType: PlanType) => {
    if (!userId || !userEmail) {
      alert("Debes estar registrado para acceder al plan Premium");
      return;
    }

    if (!paymentProvider) {
      alert("Cargando información de pago, por favor espera...");
      return;
    }

    setProcessing(true);
    try {
      const endpoint = paymentProvider === "stripe" ? "/api/createStripePayment" : "/api/createPayment";
      
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
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
        // Redirigir al checkout de Stripe
        window.location.href = data.url;
      } else if (paymentProvider === "mercadopago" && data.init_point) {
        // Redirigir al checkout de MercadoPago
        window.location.href = data.init_point;
      } else {
        throw new Error("No se recibió el link de pago");
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Error desconocido";
      alert(`Error al procesar el pago: ${message}`);
      console.error("Error al crear pago:", error);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-2 sm:p-4"
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="bg-gray-900 rounded-xl border border-white/10 p-4 sm:p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <span className="text-2xl">🌟</span>
            Elige tu Plan Premium
          </h2>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white transition-colors flex-shrink-0"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5 sm:h-6 sm:w-6">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <p className="text-white/60 text-sm sm:text-base mb-6">
          Desbloquea objetivos avanzados, dietas personalizadas, planes de entrenamiento completos y análisis detallados.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {plans.map((plan) => (
            <div
              key={plan.type}
              onClick={() => setSelectedPlan(plan.type)}
              className={`relative p-4 sm:p-6 rounded-xl border cursor-pointer transition-all ${
                selectedPlan === plan.type
                  ? "bg-blue-500/20 border-blue-500/50 scale-105"
                  : plan.popular
                  ? "bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border-yellow-500/30 hover:border-yellow-500/50"
                  : "bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/10"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <span className="px-3 py-1 text-xs font-semibold rounded-full bg-gradient-to-r from-yellow-500 to-orange-500 text-white">
                    Más Popular
                  </span>
                </div>
              )}

              <div className="text-center">
                <h3 className="text-lg sm:text-xl font-bold text-white mb-2">{plan.name}</h3>
                <div className="mb-4">
                  <span className="text-3xl sm:text-4xl font-bold text-white">
                    {paymentProvider === "stripe" ? "€" : "$"}{plan.price.toLocaleString(paymentProvider === "stripe" ? "es-ES" : "es-AR")}
                  </span>
                  <span className="text-white/60 text-sm ml-1">{paymentProvider === "stripe" ? "EUR" : "ARS"}</span>
                </div>
                <p className="text-white/60 text-sm mb-4">{plan.period}</p>
                {((paymentProvider === "stripe" && plan.savingsEUR) || (paymentProvider === "mercadopago" && plan.savings)) && (
                  <p className="text-green-400 text-sm font-medium mb-4">
                    {paymentProvider === "stripe" ? plan.savingsEUR : plan.savings}
                  </p>
                )}

                <div className="space-y-2 text-left mb-6">
                  <div className="flex items-start gap-2">
                    <svg className="h-5 w-5 text-green-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-white/80 text-sm">Objetivos avanzados</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <svg className="h-5 w-5 text-green-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-white/80 text-sm">Dietas personalizadas</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <svg className="h-5 w-5 text-green-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-white/80 text-sm">Planes de entrenamiento</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <svg className="h-5 w-5 text-green-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-white/80 text-sm">Planes ilimitados</span>
                  </div>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelectPlan(plan.type);
                  }}
                  disabled={processing || loadingProvider}
                  className={`w-full px-4 py-2.5 rounded-lg font-medium transition-all ${
                    selectedPlan === plan.type
                      ? "bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white"
                      : plan.popular
                      ? "bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white"
                      : "bg-white/10 hover:bg-white/20 text-white border border-white/20"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {loadingProvider ? "Cargando..." : processing ? "Procesando..." : "Seleccionar Plan"}
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center">
          <p className="text-white/40 text-xs">
            Todos los planes incluyen las mismas funcionalidades premium. Elige el que mejor se adapte a tus necesidades.
          </p>
        </div>
      </motion.div>
    </div>
  );
}

