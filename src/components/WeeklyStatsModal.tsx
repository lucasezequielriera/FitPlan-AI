import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaTimes, FaChartLine, FaFire, FaUtensils, FaCalendar, FaTrash, FaClock, FaExclamationTriangle } from "react-icons/fa";

interface WeeklyStatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  planId: string;
  userId?: string;
}

interface DayStats {
  date: string;
  dayName: string;
  calories: number;
  foodsCount: number;
  foods: Array<{
    description: string;
    calories: number;
    hour?: string;
    foodIndex?: number;
  }>;
}

interface WeeklyStats {
  weekStats: DayStats[];
  summary: {
    totalCalories: number;
    totalFoods: number;
    averageCalories: number;
    daysWithFoods: number;
    daysWithoutFoods: number;
    maxDay: {
      date: string;
      dayName: string;
      calories: number;
    } | null;
    planCalories: number;
    totalExtras: number;
    averageExtras: number;
  };
}

export default function WeeklyStatsModal({ isOpen, onClose, planId, userId }: WeeklyStatsModalProps) {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<WeeklyStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deletingIndex, setDeletingIndex] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ show: boolean; foodIndex: number | null; foodDescription: string }>({
    show: false,
    foodIndex: null,
    foodDescription: "",
  });

  useEffect(() => {
    if (isOpen && planId) {
      loadStats();
    }
  }, [isOpen, planId]);

  const loadStats = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch("/api/getWeeklyStats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, userId }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Error desconocido" }));
        console.error("❌ Error del servidor:", errorData);
        throw new Error(errorData.detail || errorData.error || "Error al cargar estadísticas");
      }

      const data = await response.json();
      setStats(data);
    } catch (err) {
      console.error("❌ Error al cargar estadísticas:", err);
      setError(err instanceof Error ? err.message : "Error al cargar estadísticas. Intenta nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (foodIndex: number, foodDescription: string) => {
    setConfirmDelete({
      show: true,
      foodIndex,
      foodDescription,
    });
  };

  const handleConfirmDelete = async () => {
    if (confirmDelete.foodIndex === null) return;

    setDeletingIndex(confirmDelete.foodIndex);
    setConfirmDelete({ show: false, foodIndex: null, foodDescription: "" });
    
    try {
      const response = await fetch("/api/deleteTrackedFood", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, userId, foodIndex: confirmDelete.foodIndex }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Error desconocido" }));
        throw new Error(errorData.detail || errorData.error || "Error al eliminar la comida");
      }

      // Recargar estadísticas después de eliminar
      await loadStats();
    } catch (err) {
      console.error("❌ Error al eliminar comida:", err);
      alert(err instanceof Error ? err.message : "Error al eliminar la comida. Intenta nuevamente.");
    } finally {
      setDeletingIndex(null);
    }
  };

  const handleCancelDelete = () => {
    setConfirmDelete({ show: false, foodIndex: null, foodDescription: "" });
  };

  const maxCalories = stats?.weekStats.reduce((max, day) => 
    Math.max(max, day.calories), 0
  ) || 1;

  if (!isOpen) return null;

  return (
    <>
      <AnimatePresence mode="wait">
        {isOpen && (
          <motion.div
            key="weekly-stats-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center p-2 md:p-4"
          >
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm"
            />

            {/* Modal */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-4xl max-h-[100vh] md:max-h-[90vh] overflow-y-auto rounded-lg md:rounded-xl border border-white/10 bg-black/95 p-4 md:p-6 shadow-2xl"
            >
          <button
            onClick={onClose}
            className="absolute top-3 right-3 md:top-4 md:right-4 text-white/60 hover:text-white transition-colors z-10"
          >
            <FaTimes className="h-5 w-5 md:h-6 md:w-6" />
          </button>

          <div className="mb-4 md:mb-6">
            <div className="flex items-center gap-2 md:gap-3 mb-2">
              <FaChartLine className="h-5 w-5 md:h-6 md:w-6 text-blue-400" />
              <h2 className="text-xl md:text-2xl font-bold">Estadísticas Semanales</h2>
            </div>
            <p className="text-white/70 text-xs md:text-sm">
              Resumen de comidas fuera del plan de los últimos 7 días
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
          ) : error ? (
            <div className="p-4 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300">
              {error}
            </div>
          ) : stats ? (
            <>
              {/* Resumen general */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 mb-4 md:mb-6">
                <div className="p-3 md:p-4 rounded-lg bg-white/5 border border-white/10">
                  <div className="flex items-center gap-1 md:gap-2 mb-1">
                    <FaFire className="h-3 w-3 md:h-4 md:w-4 text-orange-400" />
                    <p className="text-xs opacity-70">Total extras</p>
                  </div>
                  <p className="text-xl md:text-2xl font-bold text-orange-400">{stats.summary.totalExtras}</p>
                  <p className="text-xs text-white/50">kcal en 7 días</p>
                </div>

                <div className="p-3 md:p-4 rounded-lg bg-white/5 border border-white/10">
                  <div className="flex items-center gap-1 md:gap-2 mb-1">
                    <FaChartLine className="h-3 w-3 md:h-4 md:w-4 text-blue-400" />
                    <p className="text-xs opacity-70">Promedio diario</p>
                  </div>
                  <p className="text-xl md:text-2xl font-bold text-blue-400">{stats.summary.averageExtras}</p>
                  <p className="text-xs text-white/50">kcal por día</p>
                </div>

                <div className="p-3 md:p-4 rounded-lg bg-white/5 border border-white/10">
                  <div className="flex items-center gap-1 md:gap-2 mb-1">
                    <FaUtensils className="h-3 w-3 md:h-4 md:w-4 text-green-400" />
                    <p className="text-xs opacity-70">Comidas registradas</p>
                  </div>
                  <p className="text-xl md:text-2xl font-bold text-green-400">{stats.summary.totalFoods}</p>
                  <p className="text-xs text-white/50">en total</p>
                </div>

                <div className="p-3 md:p-4 rounded-lg bg-white/5 border border-white/10">
                  <div className="flex items-center gap-1 md:gap-2 mb-1">
                    <FaCalendar className="h-3 w-3 md:h-4 md:w-4 text-purple-400" />
                    <p className="text-xs opacity-70">Días con registro</p>
                  </div>
                  <p className="text-xl md:text-2xl font-bold text-purple-400">{stats.summary.daysWithFoods}</p>
                  <p className="text-xs text-white/50">de 7 días</p>
                </div>
              </div>

              {/* Gráfico de barras */}
              <div className="mb-4 md:mb-6 p-3 md:p-4 rounded-lg bg-white/5 border border-white/10">
                <h3 className="font-semibold mb-3 md:mb-4 text-sm md:text-base">Calorías extras por día</h3>
                <div className="space-y-3">
                  {stats.weekStats.map((day) => {
                    const percentage = maxCalories > 0 ? (day.calories / maxCalories) * 100 : 0;
                    const date = new Date(day.date);
                    const dateStr = date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
                    
                    return (
                      <div key={day.date} className="flex items-center gap-2 md:gap-3">
                        <div className="w-16 md:w-20 text-xs text-white/70 flex-shrink-0">
                          <span className="hidden md:inline">{day.dayName.substring(0, 3)}</span>
                          <span className="md:hidden">{day.dayName.substring(0, 2)}</span>
                          <br />
                          <span className="text-white/50 text-[10px] md:text-xs">{dateStr}</span>
                        </div>
                        <div className="flex-1 relative min-w-0">
                          <div className="h-6 md:h-8 bg-white/10 rounded-lg overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-orange-500 to-pink-500 rounded-lg transition-all duration-500 flex items-center justify-end pr-1 md:pr-2"
                              style={{ width: `${Math.max(percentage, day.calories > 0 ? 5 : 0)}%` }}
                            >
                              {day.calories > 0 && (
                                <span className="text-[10px] md:text-xs font-medium text-white whitespace-nowrap">
                                  <span className="hidden sm:inline">{day.calories} kcal</span>
                                  <span className="sm:hidden">{day.calories}</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="w-12 md:w-16 text-right text-xs text-white/70 flex-shrink-0">
                          {day.foodsCount > 0 && (
                            <span className="text-green-400 text-[10px] md:text-xs">
                              <span className="hidden sm:inline">{day.foodsCount} comida{day.foodsCount !== 1 ? 's' : ''}</span>
                              <span className="sm:hidden">{day.foodsCount}</span>
                            </span>
                          )}
                          {day.foodsCount === 0 && (
                            <span className="text-white/30">-</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Día con más calorías */}
              {stats.summary.maxDay && stats.summary.maxDay.calories > 0 && (
                <div className="mb-4 md:mb-6 p-3 md:p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                  <h3 className="font-semibold mb-2 text-yellow-300 text-sm md:text-base">📊 Día con más calorías extras</h3>
                  <p className="text-white/80 text-sm md:text-base">
                    <span className="font-medium">{stats.summary.maxDay.dayName}</span> con{" "}
                    <span className="font-bold text-yellow-400">{stats.summary.maxDay.calories} kcal</span> extras
                  </p>
                </div>
              )}

              {/* Detalle por día */}
              <div className="mb-4 md:mb-6">
                <h3 className="font-semibold mb-3 md:mb-4 text-sm md:text-base">Detalle por día</h3>
                <div className="space-y-3">
                  {stats.weekStats.map((day) => {
                    const date = new Date(day.date);
                    const dateStr = date.toLocaleDateString('es-AR', { day: 'numeric', month: 'long' });
                    
                    return (
                      <div key={day.date} className="p-3 md:p-4 rounded-lg bg-white/5 border border-white/10">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2 gap-2">
                          <div>
                            <p className="font-medium text-sm md:text-base">{day.dayName}, {dateStr}</p>
                            <p className="text-xs text-white/50">
                              {day.foodsCount > 0 
                                ? `${day.foodsCount} comida${day.foodsCount !== 1 ? 's' : ''} registrada${day.foodsCount !== 1 ? 's' : ''}`
                                : "Sin comidas registradas"}
                            </p>
                          </div>
                          {day.calories > 0 && (
                            <span className="text-base md:text-lg font-bold text-orange-400">
                              {day.calories} kcal
                            </span>
                          )}
                        </div>
                        {day.foods.length > 0 && (
                          <div className="mt-3 space-y-2">
                            {day.foods.map((food, idx) => (
                              <div key={`${day.date}-${food.foodIndex ?? idx}-${food.description}`} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm bg-white/5 rounded-lg p-2 md:p-3">
                                <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
                                  <span className="text-white/80 text-xs md:text-sm truncate">• {food.description}</span>
                                  {food.hour && (
                                    <span className="flex items-center gap-1 text-white/50 text-xs flex-shrink-0">
                                      <FaClock className="h-3 w-3" />
                                      {food.hour}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 md:gap-3 justify-end sm:justify-start">
                                  <span className="text-orange-400 font-medium text-xs md:text-sm">{food.calories} kcal</span>
                                  {food.foodIndex !== undefined && (
                                    <button
                                      onClick={() => handleDeleteClick(food.foodIndex!, food.description)}
                                      disabled={deletingIndex === food.foodIndex}
                                      className="text-red-400 hover:text-red-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                                      title="Eliminar comida"
                                    >
                                      {deletingIndex === food.foodIndex ? (
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-400"></div>
                                      ) : (
                                        <FaTrash className="h-4 w-4" />
                                      )}
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <button
                onClick={onClose}
                className="w-full px-4 py-2 md:py-3 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-medium transition-all text-sm md:text-base"
              >
                Cerrar
              </button>
            </>
          ) : null}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de confirmación de eliminación */}
      <AnimatePresence mode="wait">
        {confirmDelete.show && (
          <motion.div
            key="confirm-delete-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10000] flex items-center justify-center p-2 md:p-4"
          >
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleCancelDelete}
              className="fixed inset-0 bg-black/90 backdrop-blur-sm"
            />

            {/* Modal de confirmación */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-md rounded-lg md:rounded-xl border border-red-500/30 bg-black/95 p-4 md:p-6 shadow-2xl"
            >
              <div className="flex items-center gap-2 md:gap-3 mb-3 md:mb-4">
                <div className="p-2 md:p-3 rounded-full bg-red-500/20 border border-red-500/30">
                  <FaExclamationTriangle className="h-5 w-5 md:h-6 md:w-6 text-red-400" />
                </div>
                <h3 className="text-lg md:text-xl font-bold text-white">Confirmar eliminación</h3>
              </div>

              <p className="text-white/80 mb-2 text-sm md:text-base">
                ¿Estás seguro de que quieres eliminar esta comida?
              </p>
              
              {confirmDelete.foodDescription && (
                <div className="mb-4 md:mb-6 p-2 md:p-3 rounded-lg bg-white/5 border border-white/10">
                  <p className="text-xs md:text-sm text-white/60 mb-1">Comida a eliminar:</p>
                  <p className="text-white/90 font-medium text-sm md:text-base break-words">"{confirmDelete.foodDescription}"</p>
                </div>
              )}

              <p className="text-xs md:text-sm text-white/50 mb-4 md:mb-6">
                Esta acción no se puede deshacer.
              </p>

              <div className="flex flex-col sm:flex-row gap-2 md:gap-3">
                <button
                  onClick={handleCancelDelete}
                  className="flex-1 px-4 py-2 md:py-3 rounded-lg bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-colors text-sm md:text-base"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmDelete}
                  className="flex-1 px-4 py-2 md:py-3 rounded-lg bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-medium transition-all flex items-center justify-center gap-2 text-sm md:text-base"
                >
                  <FaTrash className="h-4 w-4" />
                  Eliminar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

