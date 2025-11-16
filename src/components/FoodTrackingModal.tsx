import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaTimes, FaUtensils, FaFire, FaDumbbell, FaCheckCircle, FaHistory } from "react-icons/fa";
import { getDbSafe } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

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
      alert("Por favor, describe qué comiste");
      return;
    }

    setLoading(true);
    setResult(null);

    // Obtener hora actual y zona horaria del usuario
    const now = new Date();
    const currentHour = now.getHours();
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    try {
      const response = await fetch("/api/analyzeFood", {
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
        }),
      });

      if (!response.ok) {
        throw new Error("Error al analizar la comida");
      }

      const data = await response.json();
      setResult(data);
      // Recargar historial después de agregar
      if (planId) {
        await loadTodayFoods();
      }
    } catch (error) {
      console.error("Error:", error);
      alert("Error al analizar la comida. Intenta nuevamente.");
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
          className="fixed inset-0 bg-black/80 backdrop-blur-sm"
        />

        {/* Modal */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-2xl max-h-[95vh] md:max-h-[90vh] overflow-y-auto rounded-lg md:rounded-xl border border-white/10 bg-black/95 p-4 md:p-6 shadow-2xl"
        >
          <button
            onClick={handleClose}
            className="absolute top-3 right-3 md:top-4 md:right-4 text-white/60 hover:text-white transition-colors z-10"
          >
            <FaTimes className="h-5 w-5 md:h-6 md:w-6" />
          </button>

          {!result ? (
            <>
              <div className="mb-4 md:mb-6">
                <div className="flex items-center gap-2 md:gap-3 mb-2">
                  <FaUtensils className="h-5 w-5 md:h-6 md:w-6 text-blue-400" />
                  <h2 className="text-xl md:text-2xl font-bold">Registrar comida fuera del plan</h2>
                </div>
                <p className="text-white/70 text-xs md:text-sm">
                  Describe qué comiste y te ayudaremos a entender el impacto y cómo retomar tu plan
                </p>
              </div>

              {/* Historial del día */}
              {previousFoodsToday.length > 0 && (
                <div className="mb-4 md:mb-6 p-3 md:p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                  <div className="flex items-center gap-2 mb-2 md:mb-3">
                    <FaHistory className="h-4 w-4 md:h-5 md:w-5 text-yellow-400" />
                    <h3 className="font-semibold text-yellow-300 text-sm md:text-base">Comidas registradas hoy</h3>
                  </div>
                  <div className="space-y-2 mb-2 md:mb-3">
                    {previousFoodsToday.map((food, index) => (
                      <div key={index} className="flex items-center justify-between text-xs md:text-sm">
                        <span className="text-white/80 truncate pr-2">• {food.description}</span>
                        <span className="text-yellow-400 font-medium flex-shrink-0">{food.calories} kcal</span>
                      </div>
                    ))}
                  </div>
                  <div className="pt-2 md:pt-3 border-t border-yellow-500/20">
                    <div className="flex items-center justify-between">
                      <span className="text-white/90 font-medium text-xs md:text-sm">Total acumulado hoy:</span>
                      <span className="text-yellow-300 font-bold text-base md:text-lg">{totalCaloriesToday} kcal</span>
                    </div>
                    <p className="text-xs text-white/60 mt-1">
                      Plan diario: {planCalories} kcal | Extras: +{totalCaloriesToday} kcal
                    </p>
                  </div>
                </div>
              )}

              <div className="mb-4 md:mb-6">
                <label className="block text-xs md:text-sm font-medium mb-2">
                  ¿Qué comiste? <span className="text-white/50 hidden md:inline">(ej: "Un chocolate", "Una porción de pizza", "Un helado")</span>
                </label>
                <textarea
                  value={foodDescription}
                  onChange={(e) => setFoodDescription(e.target.value)}
                  placeholder="Ej: Un chocolate mediano, una porción de pizza mediana, un helado de 2 bochas..."
                  className="w-full px-3 md:px-4 py-2 md:py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none text-sm md:text-base"
                  rows={4}
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-2 md:gap-3">
                <button
                  onClick={handleClose}
                  className="flex-1 px-4 py-2 md:py-3 rounded-lg bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-colors text-sm md:text-base"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={loading || !foodDescription.trim()}
                  className="flex-1 px-4 py-2 md:py-3 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm md:text-base"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Analizando...
                    </>
                  ) : (
                    <>
                      <FaCheckCircle className="h-4 w-4" />
                      Analizar
                    </>
                  )}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="mb-4 md:mb-6">
                <h2 className="text-xl md:text-2xl font-bold mb-2">Análisis de tu comida</h2>
                <p className="text-white/70 text-xs md:text-sm">Aquí está el impacto y cómo retomar tu plan</p>
              </div>

              {/* Calorías */}
              <div className="mb-4 md:mb-6 p-3 md:p-4 rounded-lg bg-white/5 border border-white/10">
                <div className="flex items-center gap-2 md:gap-3 mb-2">
                  <FaFire className="h-4 w-4 md:h-5 md:w-5 text-orange-400" />
                  <h3 className="font-semibold text-sm md:text-base">Calorías estimadas</h3>
                </div>
                <p className="text-2xl md:text-3xl font-bold text-orange-400">{result.calories} kcal</p>
                <p className="text-xs md:text-sm text-white/60 mt-1">
                  Tu plan diario: {planCalories} kcal
                </p>
                {result.totalCaloriesToday !== undefined && result.totalCaloriesToday > result.calories && (
                  <div className="mt-2 md:mt-3 pt-2 md:pt-3 border-t border-white/10">
                    <p className="text-xs md:text-sm text-white/70">
                      Total acumulado hoy: <span className="text-yellow-400 font-bold">{result.totalCaloriesToday} kcal</span>
                    </p>
                    <p className="text-xs text-white/50 mt-1">
                      {result.previousFoodsCount || 0} comida(s) previa(s) + esta comida
                    </p>
                  </div>
                )}
              </div>

              {/* Impacto */}
              <div className="mb-4 md:mb-6 p-3 md:p-4 rounded-lg bg-white/5 border border-white/10">
                <h3 className="font-semibold mb-2 text-sm md:text-base">📊 Impacto en tu plan</h3>
                <p className="text-white/80 text-xs md:text-sm">{result.impact}</p>
              </div>

              {/* Recomendaciones */}
              <div className="mb-4 md:mb-6 p-3 md:p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <h3 className="font-semibold mb-2 md:mb-3 flex items-center gap-2 text-sm md:text-base">
                  <FaCheckCircle className="h-4 w-4 md:h-5 md:w-5 text-blue-400" />
                  Cómo retomar tu plan
                </h3>
                <ul className="space-y-2">
                  {result.recommendations.map((rec, index) => (
                    <li key={index} className="flex items-start gap-2 text-xs md:text-sm text-white/80">
                      <span className="text-blue-400 mt-1">•</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Compensación con ejercicio */}
              {result.exerciseCompensation && (
                <div className="mb-4 md:mb-6 p-3 md:p-4 rounded-lg bg-purple-500/10 border border-purple-500/20">
                  <h3 className="font-semibold mb-2 flex items-center gap-2 text-sm md:text-base">
                    <FaDumbbell className="h-4 w-4 md:h-5 md:w-5 text-purple-400" />
                    Compensación con ejercicio
                  </h3>
                  <p className="text-xs md:text-sm text-white/80">{result.exerciseCompensation}</p>
                </div>
              )}

              {/* Motivación */}
              <div className="mb-4 md:mb-6 p-3 md:p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                <p className="text-xs md:text-sm text-white/90 italic">💪 {result.motivation}</p>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 md:gap-3">
                <button
                  onClick={async () => {
                    setResult(null);
                    setFoodDescription("");
                    // Recargar historial para mostrar la comida recién agregada
                    if (planId) {
                      await loadTodayFoods();
                    }
                  }}
                  className="flex-1 px-4 py-2 md:py-3 rounded-lg bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-colors text-sm md:text-base"
                >
                  Agregar otra comida
                </button>
                <button
                  onClick={handleClose}
                  className="flex-1 px-4 py-2 md:py-3 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-medium transition-all text-sm md:text-base"
                >
                  Entendido, gracias
                </button>
              </div>
            </>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

