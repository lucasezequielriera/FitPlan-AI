import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaTimes, FaUtensils, FaFire, FaDumbbell, FaCheckCircle, FaHistory } from "react-icons/fa";
import { getDbSafe } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { useAppLocale } from "@/contexts/AppLocaleContext";
import { p, pFmt } from "@/lib/i18n/planUi";
import { authedFetch } from "@/lib/userAuthClient";

interface FoodTrackingModalProps {
  isOpen: boolean;
  onClose: () => void;
  planCalories: number;
  userObjective?: string;
  planId?: string;
  userId?: string;
}

interface TrackedFood {
  description: string;
  calories: number;
  timestamp: any;
  impact?: string;
  recommendations?: string[];
  exerciseCompensation?: string;
  motivation?: string;
}

export default function FoodTrackingModal({ isOpen, onClose, planCalories, userObjective, planId, userId }: FoodTrackingModalProps) {
  const { locale } = useAppLocale();
  const [foodDescription, setFoodDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [previousFoodsToday, setPreviousFoodsToday] = useState<TrackedFood[]>([]);
  const [result, setResult] = useState<{
    calories: number;
    impact: string;
    recommendations: string[];
    motivation: string;
    exerciseCompensation?: string;
    totalCaloriesToday?: number;
    previousFoodsCount?: number;
  } | null>(null);

  // Cargar historial de comidas del día al abrir el modal
  useEffect(() => {
    if (isOpen && planId) {
      loadTodayFoods();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, planId]);

  const loadTodayFoods = async () => {
    if (!planId) return;
    
    setLoadingHistory(true);
    try {
      const db = getDbSafe();
      if (!db) return;

      const planRef = doc(db, "planes", planId);
      const planDoc = await getDoc(planRef);
      
      if (planDoc.exists()) {
        const planData = planDoc.data();
        const trackedFoods = planData.trackedFoods || [];
        
        // Filtrar comidas del día actual
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const foodsToday = trackedFoods.filter((food: TrackedFood) => {
          let foodDate: Date;
          if (food.timestamp?.toDate) {
            foodDate = food.timestamp.toDate();
          } else if (food.timestamp?.seconds) {
            foodDate = new Date(food.timestamp.seconds * 1000);
          } else {
            return false;
          }
          foodDate.setHours(0, 0, 0, 0);
          return foodDate.getTime() === today.getTime();
        });
        
        setPreviousFoodsToday(foodsToday);
      }
    } catch (error) {
      console.error("Error al cargar historial:", error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleSubmit = async () => {
    if (!foodDescription.trim()) {
      alert(p(locale, "foodAlertEmpty"));
      return;
    }

    setLoading(true);
    setResult(null);

    // Obtener hora actual y zona horaria del usuario (con manejo de errores para móviles)
    const now = new Date();
    const currentHour = now.getHours();
    let userTimezone: string | undefined;
    
    try {
      userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch (e) {
      console.warn("No se pudo obtener timezone, usando hora local:", e);
      // Si falla, no enviamos timezone y el servidor usará la hora local
    }

    try {
      const response = await authedFetch("/api/analyzeFood", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          foodDescription,
          planCalories,
          userObjective,
          planId,
          userId,
          currentHour,
          userTimezone,
          locale,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: p(locale, "foodErrUnknown") }));
        throw new Error(errorData.error || errorData.detail || p(locale, "foodErrAnalyze"));
      }

      const data = await response.json();
      
      if (!data || !data.calories) {
        throw new Error(p(locale, "foodErrInvalidResponse"));
      }
      
      setResult(data);
      // Recargar historial después de agregar
      if (planId) {
        await loadTodayFoods();
      }
    } catch (error) {
      console.error("Error al analizar comida:", error);
      const errorMessage = error instanceof Error ? error.message : p(locale, "foodErrAnalyzeRetry");
      alert(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFoodDescription("");
    setResult(null);
    setPreviousFoodsToday([]);
    onClose();
  };

  const totalCaloriesToday = previousFoodsToday.reduce((sum, food) => sum + (food.calories || 0), 0);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-2 md:p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
          className="fixed inset-0 bg-black/65 backdrop-blur-md"
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.97, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: 10 }}
          transition={{ type: "spring", damping: 26, stiffness: 320 }}
          onClick={(e) => e.stopPropagation()}
          className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[var(--landing-border)] bg-[color-mix(in_oklab,var(--background)_94%,#0f172a)] shadow-[0_24px_60px_-30px_rgba(0,0,0,0.75)]"
        >
          <div className="flex items-start justify-between gap-3 border-b border-[var(--landing-border)] bg-[var(--landing-surface)]/55 px-4 py-3 sm:px-5">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <FaUtensils className="h-4 w-4 text-[var(--brand-end)]" />
                <h2 className="text-base font-semibold text-[var(--foreground)] sm:text-lg">{p(locale, "foodModalTitle")}</h2>
              </div>
              <p className="mt-1 text-xs text-[var(--landing-muted)]">{p(locale, "foodModalSubtitle")}</p>
            </div>
            <button
              onClick={handleClose}
              className="rounded-lg p-1.5 text-[var(--landing-muted)] transition hover:bg-[var(--landing-surface-2)] hover:text-[var(--foreground)]"
            >
              <FaTimes className="h-4 w-4" />
            </button>
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
            {!result ? (
              <>
                {loadingHistory ? (
                  <div className="rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface)]/50 px-3 py-2 text-xs text-[var(--landing-muted)]">
                    {p(locale, "foodLoadingHistory")}
                  </div>
                ) : null}

                {previousFoodsToday.length > 0 && (
                  <div className="rounded-xl border border-warning/25 bg-warning/10 p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <FaHistory className="h-3.5 w-3.5 text-warning" />
                      <h3 className="text-sm font-semibold text-[var(--foreground)]">{p(locale, "foodHistoryTodayTitle")}</h3>
                    </div>
                    <div className="space-y-1">
                      {previousFoodsToday.map((food, index) => (
                        <div key={index} className="flex items-center justify-between gap-2 rounded-md border border-warning/15 bg-black/10 px-2 py-1.5">
                          <span className="truncate text-xs text-[var(--foreground)]/90">{food.description}</span>
                          <span className="shrink-0 text-xs font-semibold text-warning">{food.calories} kcal</span>
                        </div>
                      ))}
                    </div>
                    <p className="mt-2 text-[11px] text-[var(--landing-muted)]">
                      {pFmt(locale, "foodTotalToday", { total: totalCaloriesToday, plan: planCalories })}
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-xs font-medium text-[var(--foreground)]">¿Qué comiste?</label>
                  <textarea
                    value={foodDescription}
                    onChange={(e) => setFoodDescription(e.target.value)}
                    placeholder="Ej: Una porción de pizza + helado."
                    className="w-full resize-none rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface)] px-3 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--landing-muted)]/70 focus:border-[color-mix(in_oklab,var(--brand-end)_45%,transparent)] focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklab,var(--brand-end)_25%,transparent)]"
                    rows={4}
                  />
                </div>
              </>
            ) : (
              <>
                <div className="rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface)]/55 p-3">
                  <div className="mb-1 flex items-center gap-2 text-xs text-[var(--landing-muted)]">
                    <FaFire className="h-3.5 w-3.5 text-warning" />
                    {p(locale, "foodCalEstimated")}
                  </div>
                  <p className="text-xl font-semibold text-[var(--foreground)]">{result.calories} kcal</p>
                  <p className="mt-1 text-xs text-[var(--landing-muted)]">{pFmt(locale, "foodPlanDaily", { n: planCalories })}</p>
                  {result.totalCaloriesToday !== undefined && result.totalCaloriesToday > result.calories && (
                    <p className="mt-1 text-xs text-[var(--landing-muted)]">
                      {p(locale, "foodAccumulatedToday")}{" "}
                      <span className="font-semibold text-[var(--foreground)]">{result.totalCaloriesToday} kcal</span>
                    </p>
                  )}
                </div>

                <div className="rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface)]/45 p-3">
                  <p className="mb-1 text-xs font-semibold text-[var(--foreground)]">{p(locale, "foodImpact")}</p>
                  <p className="text-sm text-[var(--foreground)]/90">{result.impact}</p>
                </div>

                <div className="rounded-xl border border-[color-mix(in_oklab,var(--brand-end)_28%,transparent)] bg-[color-mix(in_oklab,var(--brand-end)_10%,transparent)] p-3">
                  <p className="mb-2 flex items-center gap-2 text-xs font-semibold text-[var(--foreground)]">
                    <FaCheckCircle className="h-3.5 w-3.5 text-[var(--brand-end)]" />
                    Cómo retomar tu plan
                  </p>
                  <ul className="space-y-1">
                    {result.recommendations.map((rec, index) => (
                      <li key={index} className="text-xs text-[var(--foreground)]/90">- {rec}</li>
                    ))}
                  </ul>
                </div>

                {result.exerciseCompensation && (
                  <div className="rounded-xl border border-info/25 bg-info/10 p-3">
                    <p className="mb-1 flex items-center gap-2 text-xs font-semibold text-[var(--foreground)]">
                      <FaDumbbell className="h-3.5 w-3.5 text-info" />
                      {p(locale, "foodExerciseComp")}
                    </p>
                    <p className="text-xs text-[var(--foreground)]/90">{result.exerciseCompensation}</p>
                  </div>
                )}

                <div className="rounded-xl border border-success/25 bg-success/10 p-3">
                  <p className="text-xs italic text-[var(--foreground)]/90">{result.motivation}</p>
                </div>
              </>
            )}
          </div>

          <div className="border-t border-[var(--landing-border)] bg-[var(--landing-surface)]/45 px-4 py-3 sm:px-5">
            {!result ? (
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  onClick={handleClose}
                  className="flex-1 rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface)] px-4 py-2 text-sm text-[var(--foreground)] transition hover:bg-[var(--landing-surface-2)]"
                >
                  {p(locale, "cancel")}
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={loading || !foodDescription.trim()}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[color-mix(in_oklab,var(--brand-end)_45%,transparent)] bg-[color-mix(in_oklab,var(--brand-end)_16%,transparent)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[color-mix(in_oklab,var(--brand-end)_24%,transparent)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <div className="h-3.5 w-3.5 animate-spin rounded-full border border-[var(--foreground)]/55 border-t-transparent" />
                      {p(locale, "foodAnalyzing")}
                    </>
                  ) : (
                    <>
                      <FaCheckCircle className="h-3.5 w-3.5" />
                      {p(locale, "foodAnalyzeBtn")}
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  onClick={async () => {
                    setResult(null);
                    setFoodDescription("");
                    if (planId) {
                      await loadTodayFoods();
                    }
                  }}
                  className="flex-1 rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface)] px-4 py-2 text-sm text-[var(--foreground)] transition hover:bg-[var(--landing-surface-2)]"
                >
                  {p(locale, "foodAddAnother")}
                </button>
                <button
                  onClick={handleClose}
                  className="flex-1 rounded-xl border border-[color-mix(in_oklab,var(--brand-end)_45%,transparent)] bg-[color-mix(in_oklab,var(--brand-end)_16%,transparent)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[color-mix(in_oklab,var(--brand-end)_24%,transparent)]"
                >
                  {p(locale, "foodGotIt")}
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

