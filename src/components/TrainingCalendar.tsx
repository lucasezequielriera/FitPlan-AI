import { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import type { TrainingPlan, TrainingDayPlan } from "@/types/plan";

// Mapear días de la semana (constante fuera del componente)
const dayNameMap: Record<string, number> = {
  'domingo': 0, 'Domingo': 0,
  'lunes': 1, 'Lunes': 1,
  'martes': 2, 'Martes': 2,
  'miercoles': 3, 'miércoles': 3, 'Miércoles': 3,
  'jueves': 4, 'Jueves': 4,
  'viernes': 5, 'Viernes': 5,
  'sabado': 6, 'sábado': 6, 'Sábado': 6,
};

interface TrainingCalendarProps {
  trainingPlan: TrainingPlan;
  onDaySelect: (date: Date, dayData: TrainingDayPlan | null, week: number, dayIndex: number) => void;
  selectedDate: Date | null;
  planStartDate?: Date;
  planDurationDays?: number;
  resetToCurrentMonth?: boolean; // Nueva prop para forzar reset al mes actual
}

export default function TrainingCalendar({
  trainingPlan,
  onDaySelect,
  selectedDate,
  planStartDate,
  planDurationDays = 30,
  resetToCurrentMonth = false,
}: TrainingCalendarProps) {
  // IMPORTANTE: currentMonth es solo para MOSTRAR qué mes ver en el calendario
  // Debe SIEMPRE inicializar con el mes ACTUAL, no con el mes de inicio del plan
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  
  // Resetear al mes actual cada vez que se abre la vista de entrenamiento
  // Esto asegura que el usuario vea el mes actual al abrir el calendario
  useEffect(() => {
    const now = new Date();
    const currentMonthDate = new Date(now.getFullYear(), now.getMonth(), 1);
    setCurrentMonth(currentMonthDate);
  }, [resetToCurrentMonth]); // Reset cuando cambia resetToCurrentMonth (cuando se abre la vista)

  // Calcular fecha de inicio del plan (para calcular los días de entrenamiento)
  const startDate = useMemo(() => {
    if (planStartDate) {
      const date = new Date(planStartDate);
      date.setHours(0, 0, 0, 0);
      return date;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  }, [planStartDate]);

  // Crear mapa simple de fecha -> datos de entrenamiento
  const trainingMap = useMemo(() => {
    const map = new Map<string, { day: TrainingDayPlan; week: number; dayIndex: number }>();
    
    if (!trainingPlan.weeks) return map;

    trainingPlan.weeks.forEach((week, weekIndex) => {
      const weekNum = week.week ?? weekIndex + 1;
      
      week.days?.forEach((day, dayIndex) => {
        const dayName = day.day?.trim();
        if (!dayName) return;
        
        const dayOfWeek = dayNameMap[dayName] ?? dayNameMap[dayName.toLowerCase()];
        if (dayOfWeek === undefined) return;

        // Calcular todas las fechas para este día de la semana dentro del rango del plan
        const startDayOfWeek = startDate.getDay();
        let daysOffset = (dayOfWeek - startDayOfWeek + 7) % 7;
        if (daysOffset === 0 && dayOfWeek !== startDayOfWeek) {
          daysOffset = 7;
        }

        // Calcular fecha de fin (1 mes desde la fecha de inicio)
        const endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + 1);
        endDate.setHours(23, 59, 59, 999);
        
        // Mapear todas las semanas del plan (hasta 1 mes desde la fecha de inicio)
        const maxDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        for (let weekOffset = 0; weekOffset < Math.ceil(maxDays / 7) + 1; weekOffset++) {
          const date = new Date(startDate);
          date.setDate(startDate.getDate() + daysOffset + (weekOffset * 7));
          date.setHours(0, 0, 0, 0);
          
          if (date >= startDate && date <= endDate) {
            const actualWeekIndex = weekOffset % trainingPlan.weeks.length;
            if (actualWeekIndex === weekIndex) {
              const dateKey = date.toISOString().split('T')[0];
              map.set(dateKey, { day, week: weekNum, dayIndex });
            }
          }
        }
      });
    });

    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trainingPlan.weeks, startDate, planDurationDays]);

  // Calcular fecha de fin del plan (1 mes desde la fecha de inicio)
  const planEndDate = useMemo(() => {
    if (!startDate) return null;
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1);
    endDate.setHours(23, 59, 59, 999);
    return endDate;
  }, [startDate]);

  // Generar días del calendario
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days: Array<{
      date: Date;
      isCurrentMonth: boolean;
      isToday: boolean;
      hasTraining: boolean;
      trainingData: { day: TrainingDayPlan; week: number; dayIndex: number } | null;
      isInPlanRange: boolean;
    }> = [];

    // Días del mes anterior
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const date = new Date(year, month - 1, prevMonthLastDay - i);
      date.setHours(0, 0, 0, 0);
      const dateKey = date.toISOString().split('T')[0];
      const isInRange = startDate && planEndDate && date >= startDate && date <= planEndDate;
      days.push({
        date,
        isCurrentMonth: false,
        isToday: false,
        hasTraining: isInRange ? trainingMap.has(dateKey) : false,
        trainingData: isInRange ? (trainingMap.get(dateKey) || null) : null,
        isInPlanRange: isInRange || false,
      });
    }

    // Días del mes actual
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      date.setHours(0, 0, 0, 0);
      const dateKey = date.toISOString().split('T')[0];
      const isInRange = startDate && planEndDate && date >= startDate && date <= planEndDate;
      days.push({
        date,
        isCurrentMonth: true,
        isToday: date.getTime() === today.getTime(),
        hasTraining: isInRange ? trainingMap.has(dateKey) : false,
        trainingData: isInRange ? (trainingMap.get(dateKey) || null) : null,
        isInPlanRange: isInRange || false,
      });
    }

    // Días del mes siguiente
    const remainingDays = 42 - days.length;
    for (let day = 1; day <= remainingDays; day++) {
      const date = new Date(year, month + 1, day);
      date.setHours(0, 0, 0, 0);
      const dateKey = date.toISOString().split('T')[0];
      const isInRange = startDate && planEndDate && date >= startDate && date <= planEndDate;
      days.push({
        date,
        isCurrentMonth: false,
        isToday: false,
        hasTraining: isInRange ? trainingMap.has(dateKey) : false,
        trainingData: isInRange ? (trainingMap.get(dateKey) || null) : null,
        isInPlanRange: isInRange || false,
      });
    }

    return days;
  }, [currentMonth, trainingMap, startDate, planEndDate]);

  const monthNames = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];

  const dayNames = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

  const handleDayClick = (day: typeof calendarDays[0]) => {
    // Solo permitir clicks en días que estén en el rango del plan
    if (!day.isInPlanRange) return;
    
    if (day.hasTraining && day.trainingData) {
      onDaySelect(day.date, day.trainingData.day, day.trainingData.week, day.trainingData.dayIndex);
    } else {
      onDaySelect(day.date, null, 0, -1);
    }
  };

  const goToPreviousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  return (
    <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl border border-white/10 p-6 shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={goToPreviousMonth}
          className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 transition-all text-white/70 hover:text-white border border-white/10 hover:border-white/20"
          aria-label="Mes anterior"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        
        <h3 className="text-xl font-bold text-white">
          {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
        </h3>
        
        <button
          onClick={goToNextMonth}
          className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 transition-all text-white/70 hover:text-white border border-white/10 hover:border-white/20"
          aria-label="Mes siguiente"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Días de la semana */}
      <div className="grid grid-cols-7 gap-2 mb-3">
        {dayNames.map((day) => (
          <div key={day} className="text-center text-sm font-semibold text-white/50 py-2">
            {day}
          </div>
        ))}
      </div>

      {/* Calendario */}
      <div className="grid grid-cols-7 gap-2">
        {calendarDays.map((day, index) => {
          const dateKey = day.date.toISOString().split('T')[0];
          const isSelected = selectedDate && selectedDate.toISOString().split('T')[0] === dateKey;
          
          return (
            <motion.button
              key={index}
              onClick={() => handleDayClick(day)}
              disabled={!day.isCurrentMonth}
              whileHover={day.isCurrentMonth ? { scale: 1.05 } : {}}
              whileTap={day.isCurrentMonth ? { scale: 0.95 } : {}}
              className={`
                aspect-square rounded-xl text-sm font-medium transition-all duration-200
                ${!day.isInPlanRange 
                  ? 'opacity-20 cursor-not-allowed' 
                  : 'cursor-pointer'
                }
                ${day.isToday 
                  ? 'bg-gradient-to-br from-cyan-500/30 to-blue-500/30 border-2 border-cyan-400 text-cyan-100 shadow-lg shadow-cyan-500/20' 
                  : isSelected
                  ? 'bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border-2 border-cyan-500 text-cyan-200 shadow-md'
                  : day.hasTraining && day.isInPlanRange
                  ? 'bg-gradient-to-br from-blue-500/20 to-indigo-500/20 border border-blue-500/40 text-blue-200 hover:from-blue-500/30 hover:to-indigo-500/30 hover:border-blue-500/60 hover:shadow-lg'
                  : day.isInPlanRange
                  ? 'bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 hover:border-white/20'
                  : 'bg-white/5 border border-white/10 text-white/20'
                }
              `}
            >
              <div className="flex flex-col items-center justify-center h-full relative">
                <span className={day.isToday ? 'font-bold' : ''}>{day.date.getDate()}</span>
                {day.hasTraining && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute bottom-1.5 w-1.5 h-1.5 rounded-full bg-blue-400"
                  />
                )}
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Leyenda */}
      <div className="mt-6 pt-4 border-t border-white/10 flex flex-wrap items-center justify-center gap-6 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-400"></div>
          <span className="text-white/60">Día con entrenamiento</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-gradient-to-br from-cyan-400 to-blue-400 border-2 border-cyan-300"></div>
          <span className="text-white/60">Hoy</span>
        </div>
      </div>
    </div>
  );
}
