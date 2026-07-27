import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaTimes, FaChartLine, FaFire, FaUtensils, FaCalendar, FaTrash, FaClock, FaExclamationTriangle } from "react-icons/fa";
import { useAppLocale } from "@/contexts/AppLocaleContext";
import { foodLogEntryCountLabel, mealOffPlanCountLabel, p, pFmt } from "@/lib/i18n/planUi";

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
  const { locale } = useAppLocale();
  const dateLocale = locale === "en" ? "en-US" : "es-AR";
  const weekdayFromIso = (iso: string, style: "short" | "long") =>
    new Date(`${iso}T12:00:00`).toLocaleDateString(dateLocale, { weekday: style });

  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<WeeklyStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
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
    setWarning(null);
    
    try {
      const response = await fetch("/api/getWeeklyStats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, userId, locale }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: p(locale, "foodErrUnknown") }));
        console.error("❌ Error del servidor:", errorData);
        throw new Error(errorData.detail || errorData.error || p(locale, "weeklyErrLoad"));
      }

      const data = await response.json();
      setStats(data);
      if (typeof data?.warning === "string" && data.warning.trim().length > 0) {
        setWarning(data.warning);
      }
    } catch (err) {
      console.error("❌ Error al cargar estadísticas:", err);
      setError(err instanceof Error ? err.message : p(locale, "weeklyErrLoadRetry"));
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
        body: JSON.stringify({ planId, userId, foodIndex: confirmDelete.foodIndex, locale }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: p(locale, "foodErrUnknown") }));
        throw new Error(errorData.detail || errorData.error || p(locale, "weeklyErrDelete"));
      }

      // Recargar estadísticas después de eliminar
      await loadStats();
    } catch (err) {
      console.error("❌ Error al eliminar comida:", err);
      alert(err instanceof Error ? err.message : p(locale, "weeklyErrDeleteRetry"));
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
            className="fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-4"
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="fixed inset-0 bg-black/65 backdrop-blur-md"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 10 }}
              transition={{ type: "spring", damping: 26, stiffness: 320 }}
              onClick={(e) => e.stopPropagation()}
              className="relative flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[var(--landing-border)] bg-[color-mix(in_oklab,var(--background)_94%,#0f172a)] shadow-[0_24px_60px_-30px_rgba(0,0,0,0.75)]"
            >
              <div className="flex items-start justify-between gap-3 border-b border-[var(--landing-border)] bg-[var(--landing-surface)]/55 px-4 py-3 sm:px-5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <FaChartLine className="h-4 w-4 text-[var(--brand-end)]" />
                    <h2 className="text-base font-semibold text-[var(--foreground)] sm:text-lg">Estadísticas semanales</h2>
                  </div>
                  <p className="mt-1 text-xs text-[var(--landing-muted)]">Comidas fuera del plan en los últimos 7 días</p>
                </div>
                <button
                  onClick={onClose}
                  className="rounded-lg p-1.5 text-[var(--landing-muted)] transition hover:bg-[var(--landing-surface-2)] hover:text-[var(--foreground)]"
                >
                  <FaTimes className="h-4 w-4" />
                </button>
              </div>

              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
                {loading ? (
                  <div className="flex items-center justify-center py-10">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--landing-border)] border-t-[var(--brand-end)]" />
                  </div>
                ) : error ? (
                  <div className="rounded-xl border border-danger/35 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</div>
                ) : stats ? (
                  <>
                    {warning && (
                      <div className="rounded-xl border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
                        {warning}
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <StatCard label={p(locale, "weeklyStatTotalExtras")} value={`${stats.summary.totalExtras} kcal`} icon={<FaFire className="h-3.5 w-3.5 text-warning" />} />
                      <StatCard label={p(locale, "weeklyStatAvgDaily")} value={`${stats.summary.averageExtras} kcal`} icon={<FaChartLine className="h-3.5 w-3.5 text-[var(--brand-end)]" />} />
                      <StatCard label={p(locale, "weeklyStatMeals")} value={`${stats.summary.totalFoods}`} icon={<FaUtensils className="h-3.5 w-3.5 text-success" />} />
                      <StatCard label={p(locale, "weeklyStatDaysLogged")} value={`${stats.summary.daysWithFoods}/7`} icon={<FaCalendar className="h-3.5 w-3.5 text-info" />} />
                    </div>

                    <div className="rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface)]/45 p-3">
                      <h3 className="mb-2 text-sm font-semibold text-[var(--foreground)]">{p(locale, "weeklyChartExtrasTitle")}</h3>
                      <div className="space-y-2">
                        {stats.weekStats.map((day) => {
                          const percentage = maxCalories > 0 ? (day.calories / maxCalories) * 100 : 0;
                          return (
                            <div key={day.date} className="flex items-center gap-2">
                              <div className="w-14 shrink-0 text-[11px] text-[var(--landing-muted)]">{weekdayFromIso(day.date, "short")}</div>
                              <div className="h-5 flex-1 overflow-hidden rounded-md bg-[color-mix(in_oklab,var(--foreground)_8%,transparent)]">
                                <div
                                  className="flex h-full items-center justify-end rounded-md bg-[linear-gradient(90deg,var(--brand-start),var(--brand-end))] px-1.5 text-[10px] font-semibold text-[#0a1628]"
                                  style={{ width: `${Math.max(percentage, day.calories > 0 ? 7 : 0)}%` }}
                                >
                                  {day.calories > 0 ? `${day.calories}` : ""}
                                </div>
                              </div>
                              <div className="w-16 shrink-0 text-right text-[11px] text-[var(--landing-muted)]">
                                {day.foodsCount > 0 ? mealOffPlanCountLabel(locale, day.foodsCount) : "-"}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {stats.summary.maxDay && stats.summary.maxDay.calories > 0 && (
                      <div className="rounded-xl border border-warning/25 bg-warning/10 px-3 py-2 text-xs text-warning">
                        {pFmt(locale, "weeklyPeakWeek", {
                          day: weekdayFromIso(stats.summary.maxDay.date, "long"),
                          kcal: stats.summary.maxDay.calories,
                        })}
                      </div>
                    )}

                    <div className="space-y-2">
                      {stats.weekStats.map((day) => {
                        const date = new Date(`${day.date}T12:00:00`);
                        const dateStr = date.toLocaleDateString(dateLocale, { day: "numeric", month: "short" });
                        return (
                          <details key={day.date} className="overflow-hidden rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface)]/35">
                            <summary className="flex cursor-pointer items-center justify-between gap-2 px-3 py-2">
                              <div>
                                <p className="text-sm font-medium text-[var(--foreground)]">{weekdayFromIso(day.date, "long")} · {dateStr}</p>
                                <p className="text-[11px] text-[var(--landing-muted)]">
                                  {day.foodsCount > 0 ? foodLogEntryCountLabel(locale, day.foodsCount) : p(locale, "weeklyNoEntries")}
                                </p>
                              </div>
                              <span className="text-xs font-semibold text-warning">{day.calories} kcal</span>
                            </summary>
                            {day.foods.length > 0 && (
                              <div className="space-y-1 border-t border-[var(--landing-border)] bg-[color-mix(in_oklab,var(--foreground)_2%,transparent)] px-3 py-2">
                                {day.foods.map((food, idx) => (
                                  <div key={`${day.date}-${food.foodIndex ?? idx}-${food.description}`} className="flex items-center justify-between gap-2 rounded-lg border border-[var(--landing-border)] bg-[var(--landing-surface)]/65 px-2.5 py-2">
                                    <div className="min-w-0">
                                      <p className="truncate text-xs text-[var(--foreground)]">{food.description}</p>
                                      {food.hour && (
                                        <p className="mt-0.5 flex items-center gap-1 text-[10px] text-[var(--landing-muted)]">
                                          <FaClock className="h-2.5 w-2.5" />
                                          {food.hour}
                                        </p>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-[11px] font-semibold text-warning">{food.calories} kcal</span>
                                      {food.foodIndex !== undefined && (
                                        <button
                                          onClick={() => handleDeleteClick(food.foodIndex!, food.description)}
                                          disabled={deletingIndex === food.foodIndex}
                                          className="rounded-md p-1 text-danger transition hover:bg-danger/10 hover:text-danger disabled:opacity-50"
                                          title={p(locale, "weeklyDeleteMealTitle")}
                                        >
                                          {deletingIndex === food.foodIndex ? (
                                            <div className="h-3.5 w-3.5 animate-spin rounded-full border border-danger border-t-transparent" />
                                          ) : (
                                            <FaTrash className="h-3.5 w-3.5" />
                                          )}
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </details>
                        );
                      })}
                    </div>
                  </>
                ) : null}
              </div>
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
              className="relative w-full max-w-md rounded-2xl border border-danger/30 bg-[color-mix(in_oklab,var(--background)_96%,#0f172a)] p-4 shadow-2xl"
            >
              <div className="flex items-center gap-2 md:gap-3 mb-3 md:mb-4">
                <div className="p-2 md:p-3 rounded-full bg-danger/20 border border-danger/30">
                  <FaExclamationTriangle className="h-5 w-5 md:h-6 md:w-6 text-danger" />
                </div>
                <h3 className="text-lg font-semibold text-[var(--foreground)]">{p(locale, "weeklyConfirmDeleteTitle")}</h3>
              </div>

              <p className="mb-2 text-sm text-[var(--foreground)]/85">
                {p(locale, "weeklyConfirmDeleteBody")}
              </p>
              
              {confirmDelete.foodDescription && (
                <div className="mb-4 rounded-lg border border-[var(--landing-border)] bg-[var(--landing-surface)] px-3 py-2">
                  <p className="mb-1 text-xs text-[var(--landing-muted)]">{p(locale, "weeklyFoodToDelete")}</p>
                  <p className="break-words text-sm font-medium text-[var(--foreground)]">"{confirmDelete.foodDescription}"</p>
                </div>
              )}

              <p className="mb-4 text-xs text-[var(--landing-muted)]">
                {p(locale, "weeklyCannotUndo")}
              </p>

              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  onClick={handleCancelDelete}
                  className="flex-1 rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface)] px-4 py-2 text-sm text-[var(--foreground)] transition hover:bg-[var(--landing-surface-2)]"
                >
                  {p(locale, "cancel")}
                </button>
                <button
                  onClick={handleConfirmDelete}
                  className="btn btn-danger flex-1 text-sm"
                >
                  <FaTrash className="h-4 w-4" />
                  {p(locale, "weeklyDelete")}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface)]/55 px-3 py-2">
      <div className="mb-1 flex items-center gap-1.5 text-[11px] text-[var(--landing-muted)]">
        {icon}
        <span>{label}</span>
      </div>
      <p className="text-sm font-semibold text-[var(--foreground)]">{value}</p>
    </div>
  );
}

