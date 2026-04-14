import { useState, useEffect, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { FaTimes, FaDumbbell, FaCheck } from "react-icons/fa";
import { getDbSafe, getAuthSafe } from "@/lib/firebase";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { useAppLocale } from "@/contexts/AppLocaleContext";
import { dash, dashFmt } from "@/lib/i18n/appUi";

interface GymCalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function GymCalendarModal({ isOpen, onClose }: GymCalendarModalProps) {
  const { locale } = useAppLocale();
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [gymDays, setGymDays] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currentMonthGymDays, setCurrentMonthGymDays] = useState(0);
  const [allGymDays, setAllGymDays] = useState<string[]>([]);
  const [yearTotal, setYearTotal] = useState(0);
  const [monthlyData, setMonthlyData] = useState<{ month: string; days: number }[]>([]);

  const monthNamesLong = useMemo(
    () =>
      locale === "en"
        ? [
            "January",
            "February",
            "March",
            "April",
            "May",
            "June",
            "July",
            "August",
            "September",
            "October",
            "November",
            "December",
          ]
        : [
            "Enero",
            "Febrero",
            "Marzo",
            "Abril",
            "Mayo",
            "Junio",
            "Julio",
            "Agosto",
            "Septiembre",
            "Octubre",
            "Noviembre",
            "Diciembre",
          ],
    [locale]
  );

  const monthLabelsShort = useMemo(
    () =>
      locale === "en"
        ? ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
        : ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"],
    [locale]
  );

  const weekDays = useMemo(
    () =>
      locale === "en"
        ? ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
        : ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"],
    [locale]
  );

  // Cargar días de gym guardados
  useEffect(() => {
    if (isOpen) {
      loadGymDays();
    }
  }, [isOpen, selectedMonth, selectedYear]);

  const loadGymDays = async () => {
    try {
      setLoading(true);
      const auth = getAuthSafe();
      const db = getDbSafe();
      
      if (!auth?.currentUser || !db) {
        return;
      }

      const userRef = doc(db, "usuarios", auth.currentUser.uid);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const savedGymDays = userData.gymDays || [];
        setAllGymDays(savedGymDays);
        
        // Filtrar solo los días del mes actual
        const monthKey = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
        const monthGymDays = savedGymDays
          .filter((date: string) => date.startsWith(monthKey))
          .map((date: string) => date);
        
        setGymDays(new Set(monthGymDays));
        setCurrentMonthGymDays(monthGymDays.length);
        
        // Calcular estadísticas
        calculateStats(savedGymDays);
      }
    } catch (error) {
      console.error("Error al cargar días de gym:", error);
    } finally {
      setLoading(false);
    }
  };

  const saveGymDays = async () => {
    try {
      setSaving(true);
      const auth = getAuthSafe();
      const db = getDbSafe();
      
      if (!auth?.currentUser || !db) {
        return;
      }

      const userRef = doc(db, "usuarios", auth.currentUser.uid);
      const userDoc = await getDoc(userRef);
      
      if (!userDoc.exists()) {
        return;
      }

      const userData = userDoc.data();
      const allGymDays = userData.gymDays || [];
      
      // Remover días del mes actual
      const monthKey = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
      const filteredGymDays = allGymDays.filter((date: string) => !date.startsWith(monthKey));
      
      // Agregar los nuevos días del mes actual
      const updatedGymDays = [...filteredGymDays, ...Array.from(gymDays)];
      
      await updateDoc(userRef, {
        gymDays: updatedGymDays,
        updatedAt: serverTimestamp(),
      });

      setCurrentMonthGymDays(gymDays.size);
      setAllGymDays(updatedGymDays);
      calculateStats(updatedGymDays);
    } catch (error) {
      console.error("Error al guardar días de gym:", error);
      alert(dash(locale, "gymSaveError"));
    } finally {
      setSaving(false);
    }
  };

  const calculateStats = useCallback(
    (gymDaysArray: string[]) => {
      const yearDays = gymDaysArray.filter((date) => date.startsWith(`${selectedYear}-`));
      setYearTotal(yearDays.length);

      const monthlyStats: { month: string; days: number }[] = [];
      for (let month = 0; month < 12; month++) {
        const monthKey = `${selectedYear}-${String(month + 1).padStart(2, "0")}`;
        const monthDays = gymDaysArray.filter((date) => date.startsWith(monthKey));
        monthlyStats.push({
          month: monthLabelsShort[month],
          days: monthDays.length,
        });
      }
      setMonthlyData(monthlyStats);
    },
    [selectedYear, monthLabelsShort]
  );

  useEffect(() => {
    if (!isOpen || allGymDays.length === 0) return;
    calculateStats(allGymDays);
  }, [locale, isOpen, allGymDays, calculateStats]);

  const toggleDay = async (dateString: string) => {
    const newGymDays = new Set(gymDays);
    if (newGymDays.has(dateString)) {
      newGymDays.delete(dateString);
    } else {
      newGymDays.add(dateString);
    }
    setGymDays(newGymDays);
    
    // Auto-guardar después de un pequeño delay
    setTimeout(() => {
      saveGymDaysSilent(newGymDays);
    }, 500);
  };

  const saveGymDaysSilent = async (newGymDaysSet: Set<string>) => {
    try {
      const auth = getAuthSafe();
      const db = getDbSafe();
      
      if (!auth?.currentUser || !db) {
        return;
      }

      const userRef = doc(db, "usuarios", auth.currentUser.uid);
      const userDoc = await getDoc(userRef);
      
      if (!userDoc.exists()) {
        return;
      }

      const userData = userDoc.data();
      const allGymDaysArray = userData.gymDays || [];
      
      // Remover días del mes actual
      const monthKey = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
      const filteredGymDays = allGymDaysArray.filter((date: string) => !date.startsWith(monthKey));
      
      // Agregar los nuevos días del mes actual
      const updatedGymDays = [...filteredGymDays, ...Array.from(newGymDaysSet)];
      
      await updateDoc(userRef, {
        gymDays: updatedGymDays,
        updatedAt: serverTimestamp(),
      });

      setCurrentMonthGymDays(newGymDaysSet.size);
      setAllGymDays(updatedGymDays);
      calculateStats(updatedGymDays);
    } catch (error) {
      console.error("Error al guardar días de gym:", error);
    }
  };

  const getDaysInMonth = (month: number, year: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (month: number, year: number) => {
    return new Date(year, month, 1).getDay();
  };

  const formatDateString = (day: number) => {
    const monthStr = String(selectedMonth + 1).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    return `${selectedYear}-${monthStr}-${dayStr}`;
  };

  const isToday = (day: number) => {
    const today = new Date();
    return (
      day === today.getDate() &&
      selectedMonth === today.getMonth() &&
      selectedYear === today.getFullYear()
    );
  };

  const isPast = (day: number) => {
    const date = new Date(selectedYear, selectedMonth, day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  };

  const isFuture = (day: number) => {
    const date = new Date(selectedYear, selectedMonth, day);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    return date > today;
  };

  const daysInMonth = getDaysInMonth(selectedMonth, selectedYear);
  const firstDay = getFirstDayOfMonth(selectedMonth, selectedYear);

  const changeMonth = (direction: number) => {
    const newDate = new Date(selectedYear, selectedMonth + direction, 1);
    setSelectedMonth(newDate.getMonth());
    setSelectedYear(newDate.getFullYear());
  };

  if (!isOpen) return null;

  const panelClass =
    "relative z-10 flex max-h-[min(92dvh,calc(100dvh-1rem))] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-[var(--landing-border)] bg-[color-mix(in_oklab,var(--background)_94%,#0f172a)] shadow-[0_24px_60px_-28px_rgba(45,212,191,0.22)] sm:max-h-[90vh]";

  const softBtn =
    "flex h-11 min-w-[44px] touch-manipulation items-center justify-center rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface)] text-[var(--foreground)] transition hover:bg-[var(--landing-surface-2)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent)] active:scale-[0.98] sm:h-10 sm:min-w-10";

  return (
    <div
      className="fixed inset-0 z-[9999] flex min-h-0 items-center justify-center bg-black/70 p-2 backdrop-blur-sm sm:p-4"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 16 }}
        transition={{ type: "spring", damping: 28, stiffness: 320 }}
        className={panelClass}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="gym-calendar-title"
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-20 rounded-t-[1.35rem] bg-gradient-to-br from-[color-mix(in_oklab,var(--landing-accent)_12%,transparent)] via-transparent to-[color-mix(in_oklab,#6366f1_8%,transparent)] opacity-90 sm:rounded-t-2xl" />

        <div className="relative flex max-h-[inherit] flex-col">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 border-b border-[var(--landing-border)]/80 px-4 pb-4 pt-4 sm:px-5 sm:pt-5">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_oklab,var(--landing-accent)_14%,transparent)] ring-1 ring-[var(--landing-accent)]/30">
                <FaDumbbell className="h-5 w-5 text-[var(--landing-accent)]" aria-hidden />
              </div>
              <div className="min-w-0">
                <h2 id="gym-calendar-title" className="text-lg font-bold tracking-tight text-[var(--foreground)] sm:text-xl">
                  {dash(locale, "gymTitle")}
                </h2>
                <p className="text-sm text-[var(--landing-muted)]">
                  {dashFmt(locale, "gymRegisteredMonth", { n: currentMonthGymDays })}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[var(--landing-muted)] transition hover:bg-[var(--landing-surface)] hover:text-[var(--foreground)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent)]"
              aria-label={dash(locale, "modalClose")}
            >
              <FaTimes className="h-5 w-5" />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 sm:px-5">
            {/* Navegación de mes */}
            <div className="mb-4 flex items-center justify-between gap-2">
              <button type="button" onClick={() => changeMonth(-1)} className={softBtn} aria-label="Mes anterior">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5"
                >
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
              </button>
              <h3 className="min-w-0 flex-1 truncate text-center text-base font-semibold text-[var(--foreground)] sm:text-lg">
                {monthNamesLong[selectedMonth]} {selectedYear}
              </h3>
              <button type="button" onClick={() => changeMonth(1)} className={softBtn} aria-label={dash(locale, "gymNextMonth")}>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5"
                >
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center gap-3 py-14">
                <div className="h-9 w-9 animate-spin rounded-full border-2 border-[var(--landing-border)] border-t-[var(--landing-accent)]" />
                <p className="text-sm text-[var(--landing-muted)]">{dash(locale, "gymLoading")}</p>
              </div>
            ) : (
              <>
                <p className="mb-3 text-center text-[11px] leading-snug text-[var(--landing-muted)] sm:text-xs">
                  {dash(locale, "gymHint")}
                </p>

                {/* Días de la semana */}
                <div className="mb-1.5 grid grid-cols-7 gap-0.5 sm:gap-1">
                  {weekDays.map((day) => (
                    <div key={day} className="py-1.5 text-center text-[10px] font-semibold uppercase tracking-wide text-[var(--landing-muted)] sm:text-xs sm:normal-case">
                      {day}
                    </div>
                  ))}
                </div>

                {/* Calendario */}
                <div className="mb-5 grid grid-cols-7 gap-0.5 sm:gap-1">
                  {Array.from({ length: firstDay }).map((_, index) => (
                    <div key={`empty-${index}`} className="aspect-square min-h-0" />
                  ))}

                  {Array.from({ length: daysInMonth }).map((_, index) => {
                    const day = index + 1;
                    const dateString = formatDateString(day);
                    const isGymDay = gymDays.has(dateString);
                    const today = isToday(day);
                    const past = isPast(day);
                    const future = isFuture(day);

                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => !future && toggleDay(dateString)}
                        disabled={future}
                        className={[
                          "relative flex aspect-square min-h-[2.25rem] touch-manipulation items-center justify-center rounded-lg border text-sm font-medium transition sm:min-h-0",
                          isGymDay
                            ? "border-[var(--landing-accent)] bg-[color-mix(in_oklab,var(--landing-accent)_22%,transparent)] text-[var(--foreground)] shadow-[0_0_20px_-8px_var(--landing-accent)]"
                            : today
                              ? "border-[color-mix(in_oklab,var(--landing-accent)_45%,transparent)] bg-[color-mix(in_oklab,var(--landing-accent)_8%,transparent)] text-[var(--foreground)]"
                              : past
                                ? "border-[var(--landing-border)] bg-[var(--landing-surface)] text-[var(--foreground)]/80 hover:bg-[var(--landing-surface-2)]"
                                : "cursor-not-allowed border-[var(--landing-border)]/50 bg-[color-mix(in_oklab,var(--foreground)_3%,transparent)] text-[var(--landing-muted)] opacity-60",
                        ].join(" ")}
                      >
                        <span>{day}</span>
                        {isGymDay && (
                          <span className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--landing-accent)] text-[#0a1628]">
                            <FaCheck className="h-2.5 w-2.5" aria-hidden />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="mb-4 grid grid-cols-2 gap-2 sm:gap-3">
                  <div className="rounded-xl border border-[var(--landing-accent)]/35 bg-[color-mix(in_oklab,var(--landing-accent)_10%,transparent)] p-3 sm:p-4">
                    <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-[var(--landing-muted)]">{dash(locale, "gymStatThisMonth")}</p>
                    <p className="text-2xl font-bold tabular-nums text-[var(--foreground)]">{gymDays.size}</p>
                    <p className="mt-0.5 text-[10px] text-[var(--landing-accent)]">{dash(locale, "gymStatDaysMarked")}</p>
                  </div>
                  <div className="rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface)] p-3 sm:p-4">
                    <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-[var(--landing-muted)]">
                      {dashFmt(locale, "gymStatYearTotal", { year: selectedYear })}
                    </p>
                    <p className="text-2xl font-bold tabular-nums text-[var(--foreground)]">{yearTotal}</p>
                    <p className="mt-0.5 text-[10px] text-[var(--landing-muted)]">{dash(locale, "gymStatDaysInYear")}</p>
                  </div>
                </div>

                <div className="mb-4 rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface)]/60 p-3 sm:p-4">
                  <p className="mb-3 text-center text-xs font-medium text-[var(--foreground)]">
                    {dashFmt(locale, "gymChartTitle", { year: selectedYear })}
                  </p>
                  <div className="-mx-1 overflow-x-auto pb-1 sm:mx-0 sm:overflow-visible">
                    <div className="flex min-w-[min(100%,520px)] items-end justify-between gap-1 px-1 sm:min-w-0 sm:gap-1.5">
                      {monthlyData.map((data, index) => {
                        const maxDays = Math.max(...monthlyData.map((m) => m.days), 1);
                        const height = maxDays > 0 ? (data.days / maxDays) * 100 : 0;

                        return (
                          <div key={index} className="flex min-w-[1.5rem] flex-1 flex-col items-center gap-1 sm:min-w-0">
                            <div className="flex h-16 w-full flex-col items-center justify-end">
                              <motion.div
                                initial={{ height: 0 }}
                                animate={{ height: `${height}%` }}
                                transition={{ duration: 0.45, delay: index * 0.04 }}
                                className={`w-full min-h-[3px] rounded-t-md ${
                                  data.days > 0
                                    ? "bg-[linear-gradient(180deg,color-mix(in_oklab,var(--landing-accent)_85%,#0f766e),var(--landing-accent))]"
                                    : "bg-[color-mix(in_oklab,var(--foreground)_8%,transparent)]"
                                }`}
                                style={{ maxHeight: "100%" }}
                              />
                            </div>
                            <span className="w-full truncate text-center text-[8px] font-medium text-[var(--landing-muted)] sm:text-[9px]">
                              {data.month}
                            </span>
                            <span className="text-[10px] font-semibold tabular-nums text-[var(--foreground)]/90">{data.days}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  className="mb-1 w-full min-h-[48px] rounded-xl bg-[var(--landing-accent)] px-4 py-3 text-sm font-semibold text-[#0a1628] shadow-[0_12px_32px_-16px_var(--landing-accent)] transition hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
                >
                  {dash(locale, "gymDone")}
                </button>
              </>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

