import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { FaTimes, FaDumbbell, FaCheck } from "react-icons/fa";
import { getDbSafe, getAuthSafe } from "@/lib/firebase";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";

interface GymCalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function GymCalendarModal({ isOpen, onClose }: GymCalendarModalProps) {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [gymDays, setGymDays] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currentMonthGymDays, setCurrentMonthGymDays] = useState(0);
  const [allGymDays, setAllGymDays] = useState<string[]>([]);
  const [weeklyAverage, setWeeklyAverage] = useState(0);
  const [yearTotal, setYearTotal] = useState(0);
  const [monthlyData, setMonthlyData] = useState<{ month: string; days: number }[]>([]);

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
      alert("Error al guardar. Intenta nuevamente.");
    } finally {
      setSaving(false);
    }
  };

  const calculateStats = (gymDaysArray: string[]) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Calcular promedio semanal (últimas 4 semanas)
    const fourWeeksAgo = new Date(today);
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
    const recentDays = gymDaysArray.filter(date => {
      const dateObj = new Date(date);
      dateObj.setHours(0, 0, 0, 0);
      return dateObj >= fourWeeksAgo && dateObj <= today;
    });
    setWeeklyAverage(Math.round((recentDays.length / 4) * 10) / 10);
    
    // Calcular total del año
    const currentYear = today.getFullYear();
    const yearDays = gymDaysArray.filter(date => date.startsWith(`${currentYear}-`));
    setYearTotal(yearDays.length);
    
    // Calcular datos mensuales del año actual
    const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    const monthlyStats: { month: string; days: number }[] = [];
    
    for (let month = 0; month < 12; month++) {
      const monthKey = `${currentYear}-${String(month + 1).padStart(2, '0')}`;
      const monthDays = gymDaysArray.filter(date => date.startsWith(monthKey));
      monthlyStats.push({
        month: monthNames[month],
        days: monthDays.length
      });
    }
    
    setMonthlyData(monthlyStats);
  };

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

  const monthNames = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];

  const weekDays = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

  const daysInMonth = getDaysInMonth(selectedMonth, selectedYear);
  const firstDay = getFirstDayOfMonth(selectedMonth, selectedYear);

  const changeMonth = (direction: number) => {
    const newDate = new Date(selectedYear, selectedMonth + direction, 1);
    setSelectedMonth(newDate.getMonth());
    setSelectedYear(newDate.getFullYear());
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
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
        className="bg-gray-900 rounded-xl border border-white/10 p-6 max-w-md w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/20 border border-blue-500/30">
              <FaDumbbell className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Días de Gym</h2>
              <p className="text-sm text-white/60">
                {currentMonthGymDays} día{currentMonthGymDays !== 1 ? 's' : ''} este mes
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white transition-colors"
          >
            <FaTimes className="h-5 w-5" />
          </button>
        </div>

        {/* Navegación de mes */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => changeMonth(-1)}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5 text-white"
            >
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <h3 className="text-lg font-semibold text-white">
            {monthNames[selectedMonth]} {selectedYear}
          </h3>
          <button
            onClick={() => changeMonth(1)}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5 text-white"
            >
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
          </div>
        ) : (
          <>
            {/* Días de la semana */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {weekDays.map((day) => (
                <div
                  key={day}
                  className="text-center text-xs font-medium text-white/60 py-2"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendario */}
            <div className="grid grid-cols-7 gap-1 mb-6">
              {/* Espacios vacíos antes del primer día */}
              {Array.from({ length: firstDay }).map((_, index) => (
                <div key={`empty-${index}`} className="aspect-square" />
              ))}

              {/* Días del mes */}
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
                    onClick={() => !future && toggleDay(dateString)}
                    disabled={future}
                    className={`
                      aspect-square rounded-lg border-2 transition-all relative
                      ${isGymDay
                        ? "bg-gradient-to-br from-blue-500 to-cyan-500 border-blue-400 text-white"
                        : today
                        ? "bg-blue-500/20 border-blue-400/50 text-white"
                        : past
                        ? "bg-white/5 border-white/10 text-white/60 hover:bg-white/10"
                        : "bg-white/5 border-white/10 text-white/40 opacity-50 cursor-not-allowed"
                      }
                      ${!future && !isGymDay ? "hover:bg-white/10" : ""}
                    `}
                  >
                    <span className="text-sm font-medium">{day}</span>
                    {isGymDay && (
                      <div className="absolute top-0.5 right-0.5">
                        <FaCheck className="h-3 w-3 text-white" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Estadísticas - 3 contadores arriba */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-lg p-3 border border-blue-500/30">
                <p className="text-[10px] text-white/60 mb-1">Este mes</p>
                <p className="text-xl font-bold text-white">{gymDays.size}</p>
                <p className="text-[10px] text-blue-400 mt-0.5">días</p>
              </div>
              <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                <p className="text-[10px] text-white/60 mb-1">Promedio</p>
                <p className="text-xl font-bold text-white">{weeklyAverage}</p>
                <p className="text-[10px] text-white/40 mt-0.5">semanal</p>
              </div>
              <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                <p className="text-[10px] text-white/60 mb-1">Total año</p>
                <p className="text-xl font-bold text-white">{yearTotal}</p>
                <p className="text-[10px] text-white/40 mt-0.5">días</p>
              </div>
            </div>

            {/* Gráfico de días por mes */}
            <div className="bg-white/5 rounded-lg p-3 border border-white/10 mb-4">
              <p className="text-xs text-white/60 mb-3 text-center">Días de gym por mes ({selectedYear})</p>
              <div className="flex items-end justify-between gap-1 h-24">
                {monthlyData.map((data, index) => {
                  const maxDays = Math.max(...monthlyData.map(m => m.days), 1);
                  const height = maxDays > 0 ? (data.days / maxDays) * 100 : 0;
                  
                  return (
                    <div key={index} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full flex flex-col items-center justify-end h-16">
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: `${height}%` }}
                          transition={{ duration: 0.5, delay: index * 0.05 }}
                          className={`w-full rounded-t ${
                            data.days > 0
                              ? "bg-gradient-to-t from-blue-500 to-cyan-500"
                              : "bg-white/10"
                          } min-h-[2px]`}
                          style={{ maxHeight: "100%" }}
                        />
                      </div>
                      <span className="text-[9px] text-white/60 rotate-[-45deg] origin-bottom-left whitespace-nowrap">
                        {data.month}
                      </span>
                      <span className="text-[10px] font-semibold text-white/80 mt-[-4px]">
                        {data.days}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Botón de cerrar */}
            <button
              onClick={onClose}
              className="w-full px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-medium transition-all"
            >
              Cerrar
            </button>
          </>
        )}
      </motion.div>
    </div>
  );
}

