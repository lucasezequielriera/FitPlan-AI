import { useRouter } from "next/router";
import React, { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { usePlanStore } from "@/store/planStore";
import { motion, AnimatePresence } from "framer-motion";
import type { Goal, TipoDieta, Intensidad, UserInput, PlanMultiFase } from "@/types/plan";
import { obtenerInfoFaseActual, calcularProgresoTotal } from "@/types/plan";
import { calculateBMI, bmiCategory, calculateBodyFatUSNavy, bodyFatCategory, waistToHeightRatio, whtrCategory, calculateBMR, calculateTDEE, sugerirEntrenamiento, calcularProyeccionesMotivacionales, analizarCambiosEntrenamiento } from "@/utils/calculations";
import jsPDF from "jspdf";
import Navbar from "@/components/Navbar";
import PremiumPlanModal from "@/components/PremiumPlanModal";
import FoodTrackingModal from "@/components/FoodTrackingModal";
import WeeklyStatsModal from "@/components/WeeklyStatsModal";
import IMCInfoModal from "@/components/IMCInfoModal";
import PlanContinuityModal from "@/components/PlanContinuityModal";
import MonthChangesModal from "@/components/MonthChangesModal";
import ExerciseSetTracker from "@/components/ExerciseSetTracker";
import TrainingCalendar from "@/components/TrainingCalendar";
import type { TrainingDayPlan } from "@/types/plan";
import { getAuthSafe, getDbSafe } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { useAuthStore } from "@/store/authStore";
import { FaUtensils, FaChartLine } from "react-icons/fa";

interface TrainingWeek {
  week: number;
  days: TrainingDay[];
}

interface TrainingDay {
  day: string;
  ejercicios?: TrainingExercise[]; // Nueva estructura simplificada
  // Campos legacy (para compatibilidad)
  split?: string;
  duration_min?: number;
  warmup?: {
    duration_minutes: number;
    description: string;
  };
  warmup_min?: number;
  blocks?: TrainingBlock[];
  finisher?: string;
  mobility?: string[];
}

interface TrainingBlock {
  name: string;
  level?: string;
  exercises?: TrainingExercise[];
}

interface TrainingExercise {
  name: string;
  sets: number;
  reps: string | number;
  muscle_group: string; // OBLIGATORIO: músculo trabajado
  // Campos técnicos nuevos
  rpe?: number; // RPE 1-10
  tempo?: string; // Tempo del movimiento (ej: "2-0-1-0")
  rest_seconds?: number; // Descanso entre series en segundos
  technique?: string; // Puntos clave de técnica para principiantes y avanzados
  progression?: string; // Cómo progresar este ejercicio
  alternative?: string; // Ejercicio alternativo si hay lesión o falta de equipo
  cues?: string[]; // Pistas mentales para ejecución correcta
  // Campos legacy (para compatibilidad)
  url?: string;
  rest_sec?: number;
  alt?: string[];
}

interface TrainingPlan {
  split?: string; // Tipo de división de entrenamiento: "Full Body", "Upper/Lower", "Push/Pull/Legs", etc.
  weeks?: TrainingWeek[];
}

export default function PlanPage() {
  const router = useRouter();
  const { plan, user, planId, planMultiFase, setUser, setPlan, setPlanId, setPlanMultiFase } = usePlanStore();
  const { user: authUser } = useAuthStore();

  useEffect(() => {
    // Si no hay plan ni user en el store, redirigir
    if (!plan || !user) {
      router.push("/");
      return;
    }
  }, [plan, user, router]);
  
  // Valores editables de entrenamiento
  const [diasGymEditado, setDiasGymEditado] = useState<number | null>(null);
  const [minutosCaminataEditado, setMinutosCaminataEditado] = useState<number | null>(null);
  const [minutosGymEditado, setMinutosGymEditado] = useState<number | null>(null);
  // Info modal para sueño/siesta se maneja con modalInfoAbierto ('sueno')
  const [horasSuenoEditado, setHorasSuenoEditado] = useState<number | null>(null);
  
  // Estados para regenerar plan
  const [regenerandoPlan, setRegenerandoPlan] = useState(false);
  const [errorRegeneracion, setErrorRegeneracion] = useState<string | null>(null);
  
  // Estado para modal de edición
  const [modalAbierto, setModalAbierto] = useState(false);
  const [datosEdicion, setDatosEdicion] = useState<UserInput | null>(null);
  
  // Estados temporales para inputs de texto (restricciones/preferencias/patologías)
  const [preferenciasTexto, setPreferenciasTexto] = useState("");
  const [restriccionesTexto, setRestriccionesTexto] = useState("");
  const [patologiasTexto, setPatologiasTexto] = useState("");
  const [doloresLesionesTexto, setDoloresLesionesTexto] = useState("");
  const [guardandoPDF, setGuardandoPDF] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [premiumModalOpen, setPremiumModalOpen] = useState(false);
  
  // Estado para modales de información (tooltips)
  const [modalInfoAbierto, setModalInfoAbierto] = useState<'imc' | 'macros' | 'sueno' | 'dificultad' | 'split' | null>(null);
  const [modalEntrenamientoAbierto, setModalEntrenamientoAbierto] = useState(false);
  const [semanaSeleccionada, setSemanaSeleccionada] = useState<number>(1);
  const [diasExpandidos, setDiasExpandidos] = useState<Record<string, boolean>>({});
  const [diaProgressCache, setDiaProgressCache] = useState<Record<string, { total: number; completed: number; porcentaje: number }>>({});
  const [vistaPlan, setVistaPlan] = useState<'entrenamiento' | 'alimentacion'>('alimentacion');
  // Estados para calendario de entrenamiento
  const [selectedTrainingDate, setSelectedTrainingDate] = useState<Date | null>(null);
  const [selectedDayData, setSelectedDayData] = useState<{ day: TrainingDayPlan; week: number; dayIndex: number } | null>(null);
  // Estado separado para el progreso del día seleccionado (evita loops)
  const [selectedDayProgress, setSelectedDayProgress] = useState<Record<string, { completed: number; total: number }>>({});
  // Estado para mostrar loader mientras se cargan los datos del día seleccionado
  const [loadingSelectedDay, setLoadingSelectedDay] = useState(false);
  // Cache de progreso cargado por día (evita recargas innecesarias)
  const dayProgressCache = useRef<Map<string, Record<string, { completed: number; total: number }>>>(new Map());
  const [modalAlimentosAbierto, setModalAlimentosAbierto] = useState<null | { diaIdx: number }>(null);
  const [foodDetails, setFoodDetails] = useState<Record<string, { ingredientes?: string[]; pasos_preparacion?: string[]; loading?: boolean; error?: string }>>({});
  const [foodTrackingModalOpen, setFoodTrackingModalOpen] = useState(false);
  const [weeklyStatsModalOpen, setWeeklyStatsModalOpen] = useState(false);
  const [imcModalOpen, setImcModalOpen] = useState(false);
  
  // Estado para rastrear progreso de ejercicios (ejercicioId -> { completed, total })
  const [exerciseProgress, setExerciseProgress] = useState<Record<string, { completed: number; total: number }>>({});
  
  // Ref para mantener una referencia estable de selectedDayData dentro de loadExerciseProgress
  const selectedDayDataRefForLoad = useRef(selectedDayData);
  
  useEffect(() => {
    selectedDayDataRefForLoad.current = selectedDayData;
  }, [selectedDayData]);
  
  const loadExerciseProgress = useCallback(async () => {
    if (!authUser || !planId) return;
    
    // IMPORTANTE: NO cargar si hay un día seleccionado del calendario
    // Esto previene que se actualice exerciseProgress cuando hay un día seleccionado
    // Usar ref para evitar que el callback se recree cuando selectedDayData cambia
    if (selectedDayDataRefForLoad.current) {
      return; // NO cargar si hay un día seleccionado
    }
    
    try {
      const tp = (plan as unknown as Record<string, unknown>)?.training_plan as TrainingPlan | undefined;
      const weeks = tp?.weeks || [];
      
      // Obtener todos los ejercicios de todas las semanas
      const allExercises: Array<{ exerciseName: string; week: number; day: string; sets: number; exerciseId: string; isCurrent: boolean }> = [];
      
      weeks.forEach((week, wi) => {
        const weekNumber = week.week ?? wi + 1;
        const isCurrentWeek = weekNumber === semanaSeleccionada;
        (week.days || []).forEach((day, di) => {
          (day.ejercicios || []).forEach((ejercicio: TrainingExercise, ei: number) => {
            const exerciseId = `w${weekNumber}-d${di}-e${ei}`;
            allExercises.push({
              exerciseName: ejercicio.name,
              week: weekNumber,
              day: day.day,
              sets: ejercicio.sets,
              exerciseId,
              isCurrent: isCurrentWeek, // Priorizar semana actual
            });
          });
        });
      });
      
      // Separar ejercicios actuales y del resto
      const currentExercises = allExercises.filter(e => e.isCurrent);
      const otherExercises = allExercises.filter(e => !e.isCurrent);
      
      // Función para cargar progreso de un ejercicio
      const loadExerciseProgress = async ({ exerciseName, exerciseId, sets }: { exerciseName: string; exerciseId: string; sets: number }) => {
        try {
          const response = await fetch(
            `/api/getExerciseHistory?userId=${authUser.uid}&exerciseName=${encodeURIComponent(exerciseName)}&planId=${planId}`
          );
          if (response.ok) {
            const data = await response.json();
            if (data.history && data.history.length > 0) {
              const latestSession = data.history[0];
              if (latestSession.sets && latestSession.sets.length > 0) {
                const completed = latestSession.sets.filter((s: { completed: boolean }) => s.completed).length;
                return { exerciseId, completed, total: sets };
              }
            }
          }
        } catch (error) {
          console.error(`Error cargando progreso de ${exerciseName}:`, error);
        }
        return { exerciseId, completed: 0, total: sets };
      };
      
      // Función para procesar peticiones en lotes (evitar demasiadas peticiones simultáneas)
      const processInBatches = async <T, R>(
        items: T[],
        batchSize: number,
        processor: (item: T) => Promise<R>
      ): Promise<R[]> => {
        const results: R[] = [];
        for (let i = 0; i < items.length; i += batchSize) {
          const batch = items.slice(i, i + batchSize);
          const batchResults = await Promise.all(batch.map(processor));
          results.push(...batchResults);
          // Pequeño delay entre lotes para no sobrecargar
          if (i + batchSize < items.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }
        return results;
      };
      
      // 1. Cargar primero los ejercicios de la semana actual (prioridad, en lotes de 3)
      const currentProgressResults = await processInBatches(
        currentExercises,
        3,
        loadExerciseProgress
      );
      
      // Actualizar estado inmediatamente con los ejercicios actuales
      // IMPORTANTE: Verificar nuevamente antes de actualizar exerciseProgress usando ref
      if (!selectedDayDataRefForLoad.current) {
        const currentProgressMap: Record<string, { completed: number; total: number }> = {};
        currentProgressResults.forEach(({ exerciseId, completed, total }) => {
          currentProgressMap[exerciseId] = { completed, total };
        });
        setExerciseProgress(prev => ({ ...prev, ...currentProgressMap }));
      }
      
      // 2. Cargar el resto de ejercicios en segundo plano (en lotes de 2 para no sobrecargar)
      if (otherExercises.length > 0 && !selectedDayDataRefForLoad.current) {
        // Usar setTimeout para no bloquear la UI
        setTimeout(async () => {
          // Verificar nuevamente antes de cargar usando ref
          if (selectedDayDataRefForLoad.current) {
            return; // NO cargar si hay un día seleccionado
          }
          
          const otherProgressResults = await processInBatches(
            otherExercises,
            2,
            loadExerciseProgress
          );
          
          // Verificar nuevamente antes de actualizar usando ref
          if (!selectedDayDataRefForLoad.current) {
            const otherProgressMap: Record<string, { completed: number; total: number }> = {};
            otherProgressResults.forEach(({ exerciseId, completed, total }) => {
              otherProgressMap[exerciseId] = { completed, total };
            });
            
            setExerciseProgress(prev => ({ ...prev, ...otherProgressMap }));
          }
        }, 200); // Delay un poco más largo
      }
    } catch (error) {
      console.error("Error cargando progreso de ejercicios:", error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser, planId, semanaSeleccionada, plan]); // NO incluir selectedDayData para evitar recrear el callback
  
  // Ref para prevenir llamadas duplicadas
  const loadingProgressRef = useRef<string | null>(null);
  const isLoadingDayRef = useRef(false);
  const lastLoadedDayRef = useRef<string | null>(null);
  const processingSelectionRef = useRef(false);
  const lastSelectedDateRef = useRef<string | null>(null);
  
  // Función para cargar progreso solo de un día específico
  // NUEVA VERSIÓN: Usa un estado separado para evitar loops
  const loadExerciseProgressForDay = useCallback(async (week: number, dayIndex: number, dayData: TrainingDayPlan) => {
    if (!authUser || !planId || !dayData.ejercicios) {
      setLoadingSelectedDay(false);
      return;
    }
    
    // Crear una clave única para este día
    const dayKey = `w${week}-d${dayIndex}`;
    
    // PREVENIR LLAMADAS DUPLICADAS - Verificaciones múltiples y estrictas
    if (isLoadingDayRef.current) {
      console.warn("🚫 Ya se está cargando un día, omitiendo");
      return; // Ya se está cargando, omitir
    }
    
    if (loadingProgressRef.current === dayKey) {
      console.warn("🚫 Este día ya se está cargando, omitiendo");
      return; // Ya se está cargando este día específico, omitir
    }
    
    // Verificar si ya tenemos los datos en cache
    const cachedProgress = dayProgressCache.current.get(dayKey);
    if (cachedProgress) {
      console.log("✅ Usando datos del cache para este día");
      setSelectedDayProgress(cachedProgress);
      setLoadingSelectedDay(false);
      return; // Usar cache, no recargar
    }
    
    if (lastLoadedDayRef.current === dayKey) {
      // Si ya fue cargado pero no está en cache, no recargar
      console.log("✅ Este día ya fue procesado, omitiendo");
      setLoadingSelectedDay(false);
      return;
    }
    
    // Marcar que estamos cargando ANTES de hacer cualquier cosa
    isLoadingDayRef.current = true;
    loadingProgressRef.current = dayKey;
    
    try {
      const exercises = dayData.ejercicios.map((ejercicio, ei) => ({
        exerciseName: ejercicio.name,
        exerciseId: `w${week}-d${dayIndex}-e${ei}`,
        sets: ejercicio.sets,
      }));
      
      // Cargar progreso de todos los ejercicios del día en paralelo (máximo 5 a la vez)
      const batchSize = 5;
      const progressMap: Record<string, { completed: number; total: number }> = {};
      
      for (let i = 0; i < exercises.length; i += batchSize) {
        const batch = exercises.slice(i, i + batchSize);
        const batchPromises = batch.map(async ({ exerciseName, exerciseId, sets }) => {
          try {
            const response = await fetch(
              `/api/getExerciseHistory?userId=${authUser.uid}&exerciseName=${encodeURIComponent(exerciseName)}&planId=${planId}`
            );
            if (response.ok) {
              const data = await response.json();
              if (data.history && data.history.length > 0) {
                const latestSession = data.history[0];
                if (latestSession.sets && latestSession.sets.length > 0) {
                  const completed = latestSession.sets.filter((s: { completed: boolean }) => s.completed).length;
                  return { exerciseId, completed, total: sets };
                }
              }
            }
          } catch (error) {
            console.error(`Error cargando progreso de ${exerciseName}:`, error);
          }
          return { exerciseId, completed: 0, total: sets };
        });
        
        const batchResults = await Promise.all(batchPromises);
        batchResults.forEach(({ exerciseId, completed, total }) => {
          progressMap[exerciseId] = { completed, total };
        });
      }
      
      // IMPORTANTE: Actualizar el estado separado para el día seleccionado
      // Esto NO dispara el useEffect que recalcula el progreso global
      // Solo actualizar si realmente hay datos
      if (Object.keys(progressMap).length > 0) {
        setSelectedDayProgress(progressMap);
        // Guardar en cache para evitar recargas futuras
        dayProgressCache.current.set(dayKey, progressMap);
      }
      
      // Marcar que este día ya fue cargado
      lastLoadedDayRef.current = dayKey;
    } catch (error) {
      console.error("Error cargando progreso del día:", error);
    } finally {
      // Limpiar las referencias INMEDIATAMENTE
      isLoadingDayRef.current = false;
      loadingProgressRef.current = null;
      setLoadingSelectedDay(false); // Ocultar loader
    }
  }, [authUser, planId]);
  
  // Componente para mostrar el entrenamiento de un día específico
  const DayTrainingPanel = ({
    dayData,
    week,
    dayIndex,
    date,
    exerciseProgress,
    planId,
    userId,
    onProgressChange,
  }: {
    dayData: TrainingDayPlan;
    week: number;
    dayIndex: number;
    date: Date | null;
    exerciseProgress: Record<string, { completed: number; total: number }>;
    planId?: string;
    userId?: string;
    onProgressChange: (exerciseId: string, completed: number, total: number) => void;
  }) => {
    // Calcular progreso del día
    const totalSeries = dayData.ejercicios?.reduce((sum, e) => sum + e.sets, 0) || 0;
    const completedSeries = dayData.ejercicios?.reduce((sum, e, ei) => {
      const exerciseId = `w${week}-d${dayIndex}-e${ei}`;
      return sum + (exerciseProgress[exerciseId]?.completed || 0);
    }, 0) || 0;
    const porcentaje = totalSeries > 0 ? Math.round((completedSeries / totalSeries) * 100) : 0;
    
    // Obtener músculos trabajados
    const muscleGroups = new Set<string>();
    dayData.ejercicios?.forEach(ej => {
      if (ej.muscle_group) {
        muscleGroups.add(ej.muscle_group);
      }
    });
    const musculos = muscleGroups.size >= 5 
      ? "Full Body" 
      : Array.from(muscleGroups).sort().join(", ");
    
    const dateStr = date ? date.toLocaleDateString('es-AR', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    }) : dayData.day;
    
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-6 rounded-xl border-2 border-cyan-500/30 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="text-cyan-400">🏋️</span>
              {dayData.day}
              {musculos && (
                <span className="text-sm font-normal opacity-70 ml-2">({musculos})</span>
              )}
            </h3>
            {date && (
              <p className="text-sm text-white/60 mt-1 capitalize">{dateStr}</p>
            )}
          </div>
          <div className="text-right">
            <div className="text-sm text-white/70">Progreso del día</div>
            <div className="text-lg font-bold text-cyan-300">
              {completedSeries}/{totalSeries} ({porcentaje}%)
            </div>
          </div>
        </div>
        
        {/* Calentamiento */}
        {dayData.warmup && (
          <div className="mb-4 p-3 rounded-md bg-gradient-to-r from-orange-500/20 to-yellow-500/20 border border-orange-500/30">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-semibold text-orange-300">🔥 Calentamiento</span>
              <span className="text-xs opacity-70">({dayData.warmup.duration_minutes} min)</span>
            </div>
            <p className="text-sm opacity-90 leading-relaxed">{dayData.warmup.description}</p>
          </div>
        )}
        
        {/* Ejercicios */}
        {dayData.ejercicios && dayData.ejercicios.length > 0 ? (
          <ul className="space-y-3">
            {dayData.ejercicios.map((ejercicio, ei) => {
              const restTime = ejercicio.rest_seconds || (ejercicio as unknown as { rest_sec?: number }).rest_sec;
              const exerciseId = `w${week}-d${dayIndex}-e${ei}`;
              const progress = exerciseProgress[exerciseId] || { completed: 0, total: ejercicio.sets };
              
              return (
                <li key={`ej-${week}-${dayIndex}-${ei}`} className="rounded-lg bg-white/5 border border-white/10 p-3">
                  <div className="flex-1">
                    {/* Header del ejercicio */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-semibold text-white">{ejercicio.name}</span>
                          <span className="text-sm opacity-70">· {ejercicio.sets}x{String(ejercicio.reps)}</span>
                          <span className="ml-auto text-sm font-medium text-cyan-300">
                            {progress.completed}/{progress.total}
                          </span>
                          {ejercicio.muscle_group && (
                            <span className="text-xs px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                              {ejercicio.muscle_group}
                            </span>
                          )}
                        </div>
                        {/* Detalles técnicos compactos */}
                        <div className="flex items-center gap-3 flex-wrap text-xs opacity-80">
                          {ejercicio.rpe && (
                            <span className="flex items-center gap-1">
                              <span className="opacity-60">RPE:</span>
                              <span className="font-medium">{ejercicio.rpe}/10</span>
                            </span>
                          )}
                          {ejercicio.tempo && (
                            <span className="flex items-center gap-1">
                              <span className="opacity-60">Tempo:</span>
                              <span className="font-medium">{ejercicio.tempo}</span>
                            </span>
                          )}
                          {restTime && (
                            <span className="flex items-center gap-1">
                              <span className="opacity-60">Descanso:</span>
                              <span className="font-medium">{restTime}s</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Técnica, progresión, cues, alternativa (igual que en el modal) */}
                    {ejercicio.technique && (
                      <details className="mt-2">
                        <summary className="text-xs font-medium text-cyan-300 cursor-pointer hover:text-cyan-200">
                          💡 Técnica
                        </summary>
                        <p className="mt-1 text-xs opacity-90 leading-relaxed pl-2 border-l-2 border-cyan-500/30">
                          {ejercicio.technique}
                        </p>
                      </details>
                    )}
                    
                    {ejercicio.progression && (
                      <details className="mt-2">
                        <summary className="text-xs font-medium text-yellow-300 cursor-pointer hover:text-yellow-200">
                          📈 Progresión
                        </summary>
                        <p className="mt-1 text-xs opacity-90 leading-relaxed pl-2 border-l-2 border-yellow-500/30">
                          {ejercicio.progression}
                        </p>
                      </details>
                    )}
                    
                    {ejercicio.cues && ejercicio.cues.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs font-medium text-purple-300 mb-1">🎯 Pistas mentales:</p>
                        <ul className="list-disc pl-4 space-y-0.5">
                          {ejercicio.cues.map((cue, cueIdx) => (
                            <li key={`cue-${ei}-${cueIdx}`} className="text-xs opacity-90">{cue}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {ejercicio.alternative && (
                      <div className="mt-2 p-2 rounded bg-orange-500/10 border border-orange-500/30">
                        <p className="text-xs font-medium text-orange-300 mb-1">⚠️ Alternativa (si tienes lesión):</p>
                        <p className="text-xs opacity-90">{ejercicio.alternative}</p>
                      </div>
                    )}
                    
                    {/* Tracker de pesos por serie */}
                    {userId && planId && (
                      <ExerciseSetTracker
                        exercise={ejercicio}
                        week={week}
                        day={dayData.day}
                        planId={planId}
                        userId={userId}
                        onProgressChange={(completed, total) => {
                          onProgressChange(exerciseId, completed, total);
                        }}
                      />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-center py-8 text-white/70">No hay ejercicios programados para este día</p>
        )}
      </motion.div>
    );
  };
  
  // Función para calcular el progreso de todos los días (solo se llama al abrir el modal)
  // IMPORTANTE: NO usar exerciseProgress en las dependencias para evitar loops
  const calcularProgresoDias = useCallback(() => {
    if (!plan) return;
    
    const tp = (plan as unknown as Record<string, unknown>)?.training_plan as TrainingPlan | undefined;
    const weeks = tp?.weeks || [];
    
    // Calcular progreso para todas las semanas
    const newCache: Record<string, { total: number; completed: number; porcentaje: number }> = {};
    
    weeks.forEach((week, wi) => {
      const weekNumber = week.week ?? wi + 1;
      (week.days || []).forEach((dia: TrainingDay, di: number) => {
        const dayKey = `w${weekNumber}-d${di}`;
        let totalSeriesDia = 0;
        let seriesCompletadasDia = 0;
        
        if (dia.ejercicios && dia.ejercicios.length > 0) {
          dia.ejercicios.forEach((ejercicio: TrainingExercise, ei: number) => {
            const exerciseId = `w${weekNumber}-d${di}-e${ei}`;
            // Usar el estado actual de exerciseProgress directamente (no como dependencia)
            const progress = exerciseProgress[exerciseId];
            
            // Siempre usar ejercicio.sets como total (valor del plan)
            const totalEjercicio = ejercicio.sets;
            const completadasEjercicio = progress?.completed || 0;
            
            totalSeriesDia += totalEjercicio;
            seriesCompletadasDia += completadasEjercicio;
          });
        }
        
        // Guardar en cache siempre, incluso si es 0, para tener el total correcto
        const porcentajeDia = totalSeriesDia > 0 ? Math.round((seriesCompletadasDia / totalSeriesDia) * 100) : 0;
        newCache[dayKey] = { total: totalSeriesDia, completed: seriesCompletadasDia, porcentaje: porcentajeDia };
      });
    });
    
    setDiaProgressCache(newCache);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan]); // NO incluir exerciseProgress para evitar loops
  
  // Cargar progreso de ejercicios cuando se abre el modal de entrenamiento
  // Ref para prevenir que este useEffect se ejecute múltiples veces
  const modalOpenedRef = useRef(false);
  
  useEffect(() => {
    // IMPORTANTE: Si hay un día seleccionado del calendario, NO hacer nada
    // Verificar tanto el estado como el ref para mayor seguridad
    if (selectedDayData || selectedDayDataRefForLoad.current) {
      return;
    }
    
    // Solo cargar si se abre el modal desde el botón tradicional (no desde el calendario)
    // Y solo si no se ha ejecutado ya para esta apertura del modal
    if (modalEntrenamientoAbierto && authUser && planId && !modalOpenedRef.current) {
      // Verificar nuevamente antes de ejecutar (por si selectedDayData cambió entre renders)
      if (selectedDayData || selectedDayDataRefForLoad.current) {
        return;
      }
      
      modalOpenedRef.current = true;
      
      // Limpiar cache al abrir el modal
      setDiaProgressCache({});
      
      // Calcular progreso inicial (solo totales, sin datos guardados aún)
      calcularProgresoDias();
      
      // Solo cargar progreso si NO hay un día seleccionado
      if (!selectedDayData && !selectedDayDataRefForLoad.current) {
        loadExerciseProgress();
      }
      
      // Expandir automáticamente el día actual
      const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
      const hoy = new Date().getDay();
      const diaActualNombre = diasSemana[hoy];
      
      // Buscar el día actual en la semana seleccionada
      const tp = (plan as unknown as Record<string, unknown>)?.training_plan as TrainingPlan | undefined;
      const weeks = tp?.weeks || [];
      const semanaActual = weeks.find((w) => (w.week ?? 1) === semanaSeleccionada) || weeks[semanaSeleccionada - 1];
      
      if (semanaActual && semanaActual.days) {
        semanaActual.days.forEach((dia, di) => {
          if (dia.day === diaActualNombre) {
            const dayKey = `w${semanaSeleccionada}-d${di}`;
            setDiasExpandidos(prev => ({ ...prev, [dayKey]: true }));
          }
        });
      }
    }
    
    // Resetear el ref cuando se cierra el modal
    if (!modalEntrenamientoAbierto) {
      modalOpenedRef.current = false;
      // Limpiar TODAS las referencias de carga cuando se cierra el modal
      isLoadingDayRef.current = false;
      loadingProgressRef.current = null;
      lastLoadedDayRef.current = null;
      isRecalculatingRef.current = false;
      processingSelectionRef.current = false;
      lastSelectedDateRef.current = null;
      lastExerciseProgressRef.current = ''; // Limpiar también este
      // Limpiar el cache también
      dayProgressCache.current.clear();
    }
  }, [modalEntrenamientoAbierto, authUser, planId, semanaSeleccionada, loadExerciseProgress, plan, calcularProgresoDias, selectedDayData]);
  
  // DESHABILITAR COMPLETAMENTE este useEffect cuando hay un día seleccionado del calendario
  // Solo recalcular progreso cuando NO hay selectedDayData
  const lastExerciseProgressRef = useRef<string>('');
  const isRecalculatingRef = useRef(false);
  const selectedDayDataRef = useRef(selectedDayData);
  
  // Actualizar ref cuando cambia selectedDayData
  useEffect(() => {
    selectedDayDataRef.current = selectedDayData;
  }, [selectedDayData]);
  
  // DESHABILITAR COMPLETAMENTE este useEffect cuando hay un día seleccionado del calendario
  // Este useEffect SOLO debe ejecutarse cuando el modal se abre desde el botón tradicional
  // IMPORTANTE: Si hay selectedDayData, este useEffect NO debe ejecutarse EN ABSOLUTO
  useEffect(() => {
    // PRIMERA VERIFICACIÓN CRÍTICA: Si hay un día seleccionado del calendario, NO HACER NADA
    // Esta es la verificación MÁS IMPORTANTE - debe ser la primera y más estricta
    if (selectedDayData || selectedDayDataRef.current) {
      return; // NO hacer nada si hay un día seleccionado - SALIR INMEDIATAMENTE
    }
    
    // SEGUNDA VERIFICACIÓN: Si el modal no está abierto, NO HACER NADA
    if (!modalEntrenamientoAbierto) {
      return;
    }
    
    // TERCERA VERIFICACIÓN: Si ya se está procesando algo, NO HACER NADA
    if (!plan || isRecalculatingRef.current || loadingProgressRef.current || isLoadingDayRef.current || processingSelectionRef.current) {
      return;
    }
    
    // CUARTA VERIFICACIÓN: Solo procesar si exerciseProgress tiene datos
    if (Object.keys(exerciseProgress).length === 0) {
      return;
    }
    
    const progressKey = JSON.stringify(exerciseProgress);
    
    // QUINTA VERIFICACIÓN: Prevenir recálculos duplicados
    if (lastExerciseProgressRef.current === progressKey) {
      return;
    }
    
    // SEXTA VERIFICACIÓN: Verificar nuevamente antes de marcar como recalculando
    if (selectedDayData || selectedDayDataRef.current || loadingProgressRef.current || isLoadingDayRef.current || processingSelectionRef.current) {
      return;
    }
    
    // Marcar como recalculando
    isRecalculatingRef.current = true;
    lastExerciseProgressRef.current = progressKey;
    
    // Usar setTimeout para evitar loops inmediatos
    const timeoutId = setTimeout(() => {
      // SÉPTIMA VERIFICACIÓN: Verificar nuevamente antes de recalcular
      if (
        !modalEntrenamientoAbierto || 
        selectedDayData ||
        selectedDayDataRef.current || 
        loadingProgressRef.current || 
        isLoadingDayRef.current || 
        processingSelectionRef.current
      ) {
        isRecalculatingRef.current = false;
        return;
      }
      
      // Solo recalcular si todas las verificaciones pasan
      calcularProgresoDias();
      isRecalculatingRef.current = false;
    }, 500);
    
    // Cleanup: cancelar el timeout si el componente se desmonta o cambian las dependencias
    return () => {
      clearTimeout(timeoutId);
      isRecalculatingRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exerciseProgress, modalEntrenamientoAbierto, plan, calcularProgresoDias]); // NO incluir selectedDayData en dependencias para evitar re-ejecuciones
  
  // Estados para modal de siguiente mes (plan multi-fase)
  const [modalSiguienteMesAbierto, setModalSiguienteMesAbierto] = useState(false);
  const [datosSiguienteMes, setDatosSiguienteMes] = useState({
    pesoActual: 0,
    cinturaActual: 0,
    energia: "normal" as "muy_baja" | "baja" | "normal" | "alta" | "muy_alta",
    recuperacion: "normal" as "mala" | "regular" | "normal" | "buena" | "excelente",
    adherenciaComida: ">80%" as "<50%" | "50-70%" | "70-80%" | ">80%",
    adherenciaEntreno: ">80%" as "<50%" | "50-70%" | "70-80%" | ">80%",
    lesionesNuevas: "",
    comentarios: ""
  });
  const [generandoSiguienteMes, setGenerandoSiguienteMes] = useState(false);
  const [errorSiguienteMes, setErrorSiguienteMes] = useState<string | null>(null);
  
  // Estados para modal de continuidad (planes simples)
  const [continuityModalOpen, setContinuityModalOpen] = useState(false);
  const [registrosPeso, setRegistrosPeso] = useState<Array<{ fecha: string; peso: number }>>([]);
  
  // Estados para modal de cambios (planes multi-fase)
  const [monthChangesModalOpen, setMonthChangesModalOpen] = useState(false);
  const [monthChangesData, setMonthChangesData] = useState<any>(null);

  // Ref para prevenir cargas duplicadas de registros de peso
  const loadingRegistrosPesoRef = useRef(false);
  const lastLoadedPlanIdRef = useRef<string | null>(null);
  
  // Cargar registros de peso para el modal de continuidad
  useEffect(() => {
    // Prevenir cargas duplicadas
    if (!planId || loadingRegistrosPesoRef.current || lastLoadedPlanIdRef.current === planId) {
      return;
    }
    
    loadingRegistrosPesoRef.current = true;
    lastLoadedPlanIdRef.current = planId;
    
    const loadRegistrosPeso = async () => {
      try {
        const db = getDbSafe();
        if (!db) {
          loadingRegistrosPesoRef.current = false;
          return;
        }
        
        const planRef = doc(db, "planes", planId);
        const planDoc = await getDoc(planRef);
        
        if (planDoc.exists()) {
          const data = planDoc.data();
          if (data.registrosPeso && Array.isArray(data.registrosPeso)) {
            setRegistrosPeso(data.registrosPeso.map((r: Record<string, unknown>) => ({
              fecha: String(r.fecha || ''),
              peso: Number(r.peso || 0)
            })));
          }
        }
      } catch (error) {
        console.error("Error al cargar registros de peso:", error);
      } finally {
        loadingRegistrosPesoRef.current = false;
      }
    };
    
    loadRegistrosPeso();
  }, [planId]);
  
  // Mostrar modal de IMC solo la primera vez que el usuario ve su plan
  useEffect(() => {
    if (!user || !planId) return;
    
    // Verificar si ya se mostró el modal para este plan
    const imcModalShownKey = `imc_modal_shown_${planId}`;
    const alreadyShown = localStorage.getItem(imcModalShownKey);
    
    if (!alreadyShown) {
      // Esperar un poco para que el usuario vea el plan primero
      const timer = setTimeout(() => {
        setImcModalOpen(true);
        localStorage.setItem(imcModalShownKey, 'true');
      }, 1500);
      
      return () => clearTimeout(timer);
    }
  }, [user, planId]);

  // Resumen de split de entrenamiento para el título
  const splitResumen = (() => {
    const tp = (plan as unknown as Record<string, unknown>)?.training_plan as TrainingPlan | undefined;
    const days = (tp?.weeks || []).flatMap((w: TrainingWeek) => w?.days || []);
    
    // Primero intentar obtener del campo split
    const splits = new Set<string>(
      days
        .map((d: TrainingDay) => String(d?.split || '').toLowerCase())
        .filter((s: string) => s && s !== 'undefined' && s !== '')
    );
    
    // Si no hay splits en el campo split, analizar los músculos trabajados
    if (splits.size === 0) {
      const allMuscles = new Set<string>();
      days.forEach((d: TrainingDay) => {
        (d.ejercicios || []).forEach((e: TrainingExercise) => {
          if (e.muscle_group) {
            allMuscles.add(e.muscle_group.toLowerCase());
          }
        });
      });
      
      // Determinar split basado en músculos trabajados
      const hasUpper = allMuscles.has('pecho') || allMuscles.has('espalda') || allMuscles.has('hombros') || allMuscles.has('bíceps') || allMuscles.has('tríceps');
      const hasLower = allMuscles.has('piernas') || allMuscles.has('cuádriceps') || allMuscles.has('isquiotibiales') || allMuscles.has('glúteos') || allMuscles.has('gemelos');
      
      // Si cada día tiene músculos variados, probablemente es Full Body
      const daysWithVariedMuscles = days.filter((d: TrainingDay) => {
        const musclesInDay = new Set<string>();
        (d.ejercicios || []).forEach((e: TrainingExercise) => {
          if (e.muscle_group) musclesInDay.add(e.muscle_group.toLowerCase());
        });
        return musclesInDay.size >= 4; // 4+ músculos diferentes = Full Body
      });
      
      if (daysWithVariedMuscles.length >= days.length * 0.7) {
        return 'Full Body';
      }
      
      // Si hay días con solo tren superior y otros con solo tren inferior
      if (hasUpper && hasLower) {
        const upperDays = days.filter((d: TrainingDay) => {
          const muscles = new Set<string>();
          (d.ejercicios || []).forEach((e: TrainingExercise) => {
            if (e.muscle_group) muscles.add(e.muscle_group.toLowerCase());
          });
          return muscles.has('pecho') || muscles.has('espalda') || muscles.has('hombros');
        });
        const lowerDays = days.filter((d: TrainingDay) => {
          const muscles = new Set<string>();
          (d.ejercicios || []).forEach((e: TrainingExercise) => {
            if (e.muscle_group) muscles.add(e.muscle_group.toLowerCase());
          });
          return muscles.has('piernas') || muscles.has('cuádriceps') || muscles.has('isquiotibiales');
        });
        if (upperDays.length > 0 && lowerDays.length > 0) return 'Upper/Lower';
      }
      
      return allMuscles.size > 0 ? 'Mixto' : 'Plan';
    }
    
    const has = (s: string) => Array.from(splits).some(x => x.includes(s));
    const hasUpper = has('upper');
    const hasLower = has('lower');
    const hasFull = has('full');
    const hasPush = has('push');
    const hasPull = has('pull');
    const hasLegs = has('leg');
    if (hasFull && splits.size === 1) return 'Full Body';
    if (hasUpper && hasLower && splits.size <= 2) return 'Upper/Lower';
    if (hasPush && hasPull && hasLegs && splits.size <= 3) return 'Push/Pull/Legs';
    return splits.size > 0 ? 'Mixto' : 'Plan';
  })();
  
  // Verificar estado premium del usuario
  useEffect(() => {
    const checkPremium = async () => {
      const auth = getAuthSafe();
      if (!auth?.currentUser) {
        setIsPremium(false);
        return;
      }

      try {
        const db = getDbSafe();
        if (!db) {
          setIsPremium(false);
          return;
        }

        const userRef = doc(db, "usuarios", auth.currentUser.uid);
        const userDoc = await getDoc(userRef);
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setIsPremium(userData.premium === true);
        } else {
          setIsPremium(false);
        }
      } catch (error) {
        console.error("Error al verificar estado premium:", error);
        setIsPremium(false);
      }
    };

    checkPremium();
  }, [user]);

  // Si el usuario no es premium y está viendo entrenamiento, cambiar a alimentación
  useEffect(() => {
    if (!isPremium && vistaPlan === 'entrenamiento') {
      setVistaPlan('alimentacion');
    }
  }, [isPremium, vistaPlan]);
  
  // Obtener fecha de inicio del plan desde localStorage o usar fecha actual
  const fechaInicioPlan = (() => {
    if (typeof window !== 'undefined' && user && plan) {
      const stored = localStorage.getItem(`fecha_inicio_${user.nombre}_${plan.duracion_plan_dias || 30}`);
      if (stored) {
        return new Date(stored);
      }
      // Si no existe, guardarla ahora
      const ahora = new Date();
      localStorage.setItem(`fecha_inicio_${user.nombre}_${plan.duracion_plan_dias || 30}`, ahora.toISOString());
      return ahora;
    }
    return new Date();
  })();


  // Vista por defecto: alimentación
  // (el usuario puede cambiar entre alimentación y entrenamiento con los botones)
  
  // Calcular progreso del plan
  const progresoPlan = (() => {
    if (!plan?.duracion_plan_dias) return { diasTranscurridos: 0, porcentaje: 0 };
    const ahora = new Date();
    const diasTranscurridos = Math.floor((ahora.getTime() - fechaInicioPlan.getTime()) / (1000 * 60 * 60 * 24));
    const porcentaje = Math.min(100, Math.max(0, (diasTranscurridos / plan.duracion_plan_dias) * 100));
    return { diasTranscurridos: Math.min(plan.duracion_plan_dias, Math.max(0, diasTranscurridos)), porcentaje };
  })();
  
  // Guardar valores originales para comparar
  const [valoresOriginales, setValoresOriginales] = useState<{
    objetivo: Goal;
    intensidad: Intensidad;
    tipoDieta?: TipoDieta;
  } | null>(null);
  
  // Inicializar valores originales cuando se carga el plan
  useEffect(() => {
    if (user && !valoresOriginales) {
      setValoresOriginales({
        objetivo: user.objetivo,
        intensidad: user.intensidad,
        tipoDieta: user.tipoDieta,
      });
    }
  }, [user, valoresOriginales]);
  
  // Determinar si el objetivo es básico o premium
  const esObjetivoBasico = user ? (user.objetivo === "perder_grasa" || user.objetivo === "mantener" || user.objetivo === "ganar_masa") : false;

  // Mostrar siempre la intensidad guardada en el plan (no forzar 'leve' en la vista)
  
  // Comparar valores actuales con originales
  const hayCambios = user && valoresOriginales ? (
    user.objetivo !== valoresOriginales.objetivo ||
    (!esObjetivoBasico && user.intensidad !== valoresOriginales.intensidad) ||
    (user.tipoDieta || undefined) !== (valoresOriginales.tipoDieta || undefined)
  ) : false;
  
  // Helper para obtener texto del objetivo (versión corta para badge)
  const getObjetivoTexto = (objetivo: Goal) => {
    const textos: Record<Goal, string> = {
      perder_grasa: "Perder peso",
      mantener: "Mantener",
      ganar_masa: "Aumentar peso",
      recomposicion: "Transformación Total",
      definicion: "Definición Extrema",
      volumen: "Hipertrofia Máxima",
      corte: "Corte Avanzado",
      mantenimiento_avanzado: "Mantenimiento Elite",
      rendimiento_deportivo: "Rendimiento Deportivo",
      powerlifting: "Powerlifting/Fuerza",
      resistencia: "Resistencia/Endurance",
      atleta_elite: "Atleta Elite",
      bulk_cut: "Bulk + Cut",
      lean_bulk: "Lean Bulk",
    };
    return textos[objetivo] || objetivo;
  };
  
  // Helper para obtener texto de intensidad
  const getIntensidadTexto = (intensidad: Intensidad) => {
    return intensidad.charAt(0).toUpperCase() + intensidad.slice(1);
  };
  
  // Helper para obtener texto de dieta
  const getDietaTexto = (dieta?: TipoDieta) => {
    if (!dieta || dieta === "estandar") return "Estándar";
    const textos: Record<TipoDieta, string> = {
      estandar: "Estándar",
      antiinflamatoria: "Antiinflamatoria",
      atkins: "Atkins",
      clinica_mayo: "Clínica Mayo",
      dash: "DASH",
      flexitariana: "Flexitariana",
      keto: "Keto",
      low_carb: "Low Carb",
      mind: "MIND",
      mediterranea: "Mediterránea",
      menopausia: "Menopausia",
      paleo: "Paleo",
      pescatariana: "Pescatariana",
      sin_gluten: "Sin Gluten",
      tlc: "TLC",
      vegana: "Vegana",
      vegetariana: "Vegetariana",
    };
    return textos[dieta] || dieta;
  };

  useEffect(() => {
    if (!plan) router.replace("/");
  }, [plan, router]);

  useEffect(() => {
    // Esta función ya no se usa, pero se mantiene por compatibilidad
  }, [plan]);

  // Función para regenerar el plan con los nuevos valores
  async function regenerarPlan() {
    if (!user) return;
    setRegenerandoPlan(true);
    setErrorRegeneracion(null);
    
    try {
      // Asegurar que objetivos básicos siempre usen intensidad leve
      const intensidadFinal = esObjetivoBasico ? "leve" : user.intensidad;
      
      // Actualizar sugerencias de entrenamiento si cambió el objetivo o intensidad
      const bmi = calculateBMI(user.pesoKg, user.alturaCm);
      const nuevasSugerencias = sugerirEntrenamiento(
        user.objetivo,
        intensidadFinal,
        user.edad,
        bmi,
        user.atletico
      );
      
      // Actualizar valores de entrenamiento si no están editados manualmente
      const userActualizado = {
        ...user,
        intensidad: intensidadFinal,
        diasGym: diasGymEditado !== null ? diasGymEditado : nuevasSugerencias.diasGym,
        diasCardio: minutosCaminataEditado !== null 
          ? Math.ceil(minutosCaminataEditado / (minutosCaminataEditado > 45 ? 60 : minutosCaminataEditado > 30 ? 45 : 30))
          : Math.ceil(nuevasSugerencias.minutosCaminata / (nuevasSugerencias.minutosCaminata > 45 ? 60 : nuevasSugerencias.minutosCaminata > 30 ? 45 : 30))
      };
      
      const resp = await fetch("/api/generatePlan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userActualizado),
      });
      
      if (!resp.ok) {
        const data = await resp.json().catch(() => null);
        const combined = data?.error && data?.detail ? `${data.error}: ${data.detail}` : (data?.error || data?.detail);
        const msg = combined || `No se pudo generar el plan (HTTP ${resp.status})`;
        throw new Error(msg);
      }
      
      const nuevoPlan = await resp.json();
      
      // Mostrar objeto de debug en consola del navegador
      if (nuevoPlan._debug_training_plan) {
        console.log("=".repeat(80));
        console.log("📊 DEBUG: DATOS USADOS PARA GENERAR TRAINING_PLAN (REGENERADO)");
        console.log("=".repeat(80));
        console.log(nuevoPlan._debug_training_plan);
        console.log("=".repeat(80));
        // También exponerlo globalmente para fácil acceso
        (window as unknown as { __TRAINING_PLAN_DEBUG__?: unknown }).__TRAINING_PLAN_DEBUG__ = nuevoPlan._debug_training_plan;
        console.log("💡 También disponible en: window.__TRAINING_PLAN_DEBUG__");
      }
      
      setUser(userActualizado);
      setPlan(nuevoPlan);
      
      // Guardar o actualizar en Firestore
      try {
        const auth = getAuthSafe();
        const db = await import("@/lib/firebase").then(m => m.getDbSafe());
        
        if (auth?.currentUser && db) {
          const { collection, doc, updateDoc, addDoc, setDoc, getDoc, serverTimestamp } = await import("firebase/firestore");
          
          // Actualizar perfil del usuario en la colección "usuarios"
          try {
            const userRef = doc(db, "usuarios", auth.currentUser.uid);
            const userDoc = await getDoc(userRef);
            
            // Obtener el email del usuario autenticado
            const userEmail = auth.currentUser?.email?.toLowerCase() || "";
            
            const userProfileData: Record<string, unknown> = {
              nombre: userActualizado.nombre,
              sexo: userActualizado.sexo,
              alturaCm: userActualizado.alturaCm,
              edad: userActualizado.edad,
              peso: userActualizado.pesoKg, // Guardar peso del usuario
              objetivo: userActualizado.objetivo, // Guardar objetivo
              atletico: Boolean(userActualizado.atletico), // Guardar perfil atlético
              doloresLesiones: Array.isArray(userActualizado.doloresLesiones) ? userActualizado.doloresLesiones : [],
              updatedAt: serverTimestamp(),
            };
            
            // Agregar tipoDieta solo si tiene valor (no undefined)
            if (userActualizado.tipoDieta !== undefined && userActualizado.tipoDieta !== null) {
              userProfileData.tipoDieta = userActualizado.tipoDieta;
            }
            
            // Asegurar que email y premium estén presentes
            if (!userDoc.exists() || !userDoc.data()?.email) {
              userProfileData.email = userEmail;
            }
            if (!userDoc.exists() || userDoc.data()?.premium === undefined) {
              userProfileData.premium = false;
            }
            
            // Agregar medidas opcionales si existen y tienen valores válidos
            if (userActualizado.cinturaCm !== undefined && userActualizado.cinturaCm !== null && userActualizado.cinturaCm !== 0) {
              userProfileData.cinturaCm = Number(userActualizado.cinturaCm);
            }
            if (userActualizado.cuelloCm !== undefined && userActualizado.cuelloCm !== null && userActualizado.cuelloCm !== 0) {
              userProfileData.cuelloCm = Number(userActualizado.cuelloCm);
            }
            if (userActualizado.caderaCm !== undefined && userActualizado.caderaCm !== null && userActualizado.caderaCm !== 0) {
              userProfileData.caderaCm = Number(userActualizado.caderaCm);
            }
            
            // Limpiar campos undefined antes de guardar
            const cleanUserProfileData = Object.fromEntries(
              Object.entries(userProfileData).filter(([, v]) => v !== undefined && v !== null)
            );
            
            if (!userDoc.exists()) {
              await setDoc(userRef, {
                ...cleanUserProfileData,
                createdAt: serverTimestamp(),
              });
            } else {
              await setDoc(userRef, cleanUserProfileData, { merge: true });
            }
            console.log("✅ Perfil del usuario actualizado en Firestore (incluye peso)");
          } catch (profileError) {
            console.error("Error al actualizar perfil del usuario:", profileError);
            // No bloqueamos el flujo si falla guardar el perfil
          }
          
          // Limpiar datos: eliminar campos undefined y null
          const cleanUser = Object.fromEntries(
            Object.entries(userActualizado).filter(([, v]) => v !== undefined && v !== null)
          );
          
          const cleanPlan = JSON.parse(JSON.stringify({ plan: nuevoPlan, user: cleanUser }));
          
          if (planId) {
            // Actualizar plan existente
            const planRef = doc(db, "planes", planId);
            await updateDoc(planRef, {
              plan: cleanPlan,
              updatedAt: serverTimestamp(),
            });
            console.log("Plan actualizado en Firestore:", planId);
                          } else {
                            // Crear nuevo plan (si no tiene ID, es un plan nuevo)
                            const docRef = await addDoc(collection(db, "planes"), {
                              userId: auth.currentUser.uid,
                              plan: cleanPlan,
                              createdAt: serverTimestamp(),
                            });
                            console.log("Plan guardado en Firestore:", docRef.id);
                            // Guardar el planId en el store para futuras actualizaciones
                            setPlanId(docRef.id);
                          }
        }
      } catch (saveError) {
        console.error("Error al guardar plan actualizado:", saveError);
        // No bloqueamos el flujo si falla guardar
      }
      
      // Actualizar valores originales con los nuevos valores
      setValoresOriginales({
        objetivo: userActualizado.objetivo,
        intensidad: userActualizado.intensidad,
        tipoDieta: userActualizado.tipoDieta,
      });
      // Resetear valores editados para que usen las nuevas sugerencias
      setDiasGymEditado(null);
      setMinutosCaminataEditado(null);
      setHorasSuenoEditado(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Ocurrió un error";
      setErrorRegeneracion(message);
      console.error("Error al regenerar plan:", err);
    } finally {
      setRegenerandoPlan(false);
    }
  }

  // Guardar valores originales del plan al cargar (incluyendo recomendaciones calculadas)
  const valoresOriginalesPlan = useRef<{
    diasGym?: number;
    diasCardio?: number;
    minutosSesionGym?: number;
    horasSueno?: number;
    minutosCaminata?: number;
  } | null>(null);

  useEffect(() => {
    if (user && plan && !valoresOriginalesPlan.current) {
      const bmiOriginal = calculateBMI(user.pesoKg, user.alturaCm);
      const recomendacionesOriginales = sugerirEntrenamiento(
        user.objetivo,
        user.intensidad,
        user.edad,
        bmiOriginal,
        user.atletico
      );
      
      valoresOriginalesPlan.current = {
        diasGym: user.diasGym,
        diasCardio: user.diasCardio,
        minutosSesionGym: Number((plan as unknown as Record<string, unknown>)?.minutos_sesion_gym) || undefined,
        horasSueno: recomendacionesOriginales.horasSueno,
        minutosCaminata: recomendacionesOriginales.minutosCaminata
      };
    }
  }, [user, plan]);

  // NO actualizar automáticamente las recomendaciones cuando solo cambia el select
  // Solo se actualizan cuando el usuario regenera el plan explícitamente

  if (!plan) return null;



  const bmi = user ? calculateBMI(user.pesoKg, user.alturaCm) : 0;
  const bmiCat = bmiCategory(bmi);
  
  // Calcular TDEE y déficit/superávit
  const tdee = user ? (() => {
    const bmr = calculateBMR(user.pesoKg, user.alturaCm, user.edad, user.sexo);
    return calculateTDEE(bmr, user.actividad);
  })() : 0;
  const deficitSuperavit = user && plan ? plan.calorias_diarias - tdee : 0;
  
  // Calcular sugerencias de entrenamiento inteligentes
  const sugerenciaEntrenamiento: ReturnType<typeof sugerirEntrenamiento> | null = user ? sugerirEntrenamiento(
    user.objetivo,
    user.intensidad,
    user.edad,
    bmi,
    user.atletico
  ) : null;

  // Ajustar días de gym según lesiones reportadas
  const ajustarDiasGymPorLesiones = (diasGymSugeridos: number): number => {
    if (!user?.doloresLesiones || user.doloresLesiones.length === 0) {
      return diasGymSugeridos;
    }
    
    const lesionesGraves = user.doloresLesiones.some((d) => 
      d.toLowerCase().includes('hernia') && d.toLowerCase().includes('disco') ||
      d.toLowerCase().includes('hernia discal') ||
      d.toLowerCase().includes('fractura') ||
      d.toLowerCase().includes('desgarro')
    );
    const lesionesModeradas = user.doloresLesiones.some((d) =>
      d.toLowerCase().includes('lumbar') ||
      d.toLowerCase().includes('espalda baja') ||
      d.toLowerCase().includes('rodilla') ||
      d.toLowerCase().includes('hombro') ||
      d.toLowerCase().includes('manguito')
    );
    
    if (lesionesGraves) {
      return Math.min(2, diasGymSugeridos); // Máximo 2 días para lesiones graves
    } else if (lesionesModeradas) {
      return Math.min(3, diasGymSugeridos); // Máximo 3 días para lesiones moderadas
    } else {
      return Math.min(4, diasGymSugeridos); // Máximo 4 días para lesiones leves
    }
  };

  // Priorizar valores originales del plan guardado, luego valores editados, luego valores del user actual, luego sugerencias ajustadas por lesiones, luego defaults
  const diasGymOriginal = valoresOriginalesPlan.current?.diasGym;
  const diasGymSugeridoAjustado = sugerenciaEntrenamiento 
    ? ajustarDiasGymPorLesiones(sugerenciaEntrenamiento.diasGym)
    : 3;
  const diasGymActual = diasGymEditado !== null 
    ? diasGymEditado 
    : (diasGymOriginal !== undefined && diasGymOriginal !== null
      ? diasGymOriginal
      : (user?.diasGym !== undefined && user.diasGym !== null 
        ? ajustarDiasGymPorLesiones(user.diasGym)
        : diasGymSugeridoAjustado));
  
  // Para minutos de caminata, usar valores originales del plan primero
  const minutosCaminataOriginal = valoresOriginalesPlan.current?.minutosCaminata;
  const diasCardioOriginal = valoresOriginalesPlan.current?.diasCardio;
  const minutosCaminataActual = minutosCaminataEditado !== null
    ? minutosCaminataEditado
    : (minutosCaminataOriginal !== undefined && minutosCaminataOriginal !== null
      ? minutosCaminataOriginal
      : (diasCardioOriginal !== undefined && diasCardioOriginal !== null
        ? (diasCardioOriginal <= 2 ? 30 : diasCardioOriginal <= 4 ? 45 : 60)
        : (user?.diasCardio !== undefined && user.diasCardio !== null
          ? (user.diasCardio <= 2 ? 30 : user.diasCardio <= 4 ? 45 : 60)
          : (sugerenciaEntrenamiento?.minutosCaminata || 30))));
  
  // Para horas de sueño, usar valores originales del plan primero
  const horasSuenoActual = horasSuenoEditado !== null 
    ? horasSuenoEditado 
    : (valoresOriginalesPlan.current?.horasSueno !== undefined && valoresOriginalesPlan.current?.horasSueno !== null
      ? valoresOriginalesPlan.current.horasSueno
      : (sugerenciaEntrenamiento?.horasSueno || 7));
  
  // Usar proyecciones de OpenAI si están disponibles, sino calcular localmente como fallback
  const proyecciones = (plan as unknown as Record<string, unknown>)?.proyecciones 
    ? (plan as unknown as Record<string, unknown>).proyecciones as {
        musculoGananciaMensual?: string;
        grasaPerdidaMensual?: string;
        proyecciones: string[];
        tiempoEstimado: string;
      }
    : (user ? calcularProyeccionesMotivacionales(
        user.objetivo,
        user.intensidad,
        user.edad,
        user.sexo,
        bmi,
        user.atletico,
        diasGymActual
      ) : null);
  
  // Ajustar sugerencias de entrenamiento según lesiones para comparación
  const sugerenciaEntrenamientoAjustada = sugerenciaEntrenamiento ? {
    ...sugerenciaEntrenamiento,
    diasGym: ajustarDiasGymPorLesiones(sugerenciaEntrenamiento.diasGym)
  } : null;

  // Verificar si hay diferencias con las sugerencias ajustadas
  const hayDiferencias = sugerenciaEntrenamientoAjustada && (
    diasGymEditado !== null || 
    minutosCaminataEditado !== null || 
    horasSuenoEditado !== null ||
    (diasGymActual !== sugerenciaEntrenamientoAjustada.diasGym) ||
    minutosGymEditado !== null
  );
  
  // Analizar pros y contras si hay cambios
  const analisisCambios = hayDiferencias && sugerenciaEntrenamientoAjustada && user ? analizarCambiosEntrenamiento(
    user.objetivo,
    sugerenciaEntrenamientoAjustada.diasGym,
    diasGymActual,
    sugerenciaEntrenamientoAjustada.minutosCaminata,
    minutosCaminataActual,
    sugerenciaEntrenamientoAjustada.horasSueno,
    horasSuenoActual,
    Number((plan as unknown as Record<string, unknown>)?.minutos_sesion_gym) || 75,
    minutosGymEditado !== null ? minutosGymEditado : (Number((plan as unknown as Record<string, unknown>)?.minutos_sesion_gym) || 75)
  ) : null;
  const bmiText =
    bmiCat === "bajo_peso"
      ? "Bajo peso"
      : bmiCat === "saludable"
      ? "Saludable"
      : bmiCat === "sobrepeso"
      ? "Sobrepeso"
      : "Obesidad";

  const distrib = plan.distribucion_diaria_pct;
  // Normalizar snack/snacks para manejar ambos casos (compatibilidad con respuestas que usen "snack" o "snacks")
  type DistribType = { desayuno: number; almuerzo: number; cena: number; snacks?: number; snack?: number };
  const distribTyped = distrib as DistribType | undefined;
  const snackPct = distribTyped ? (distribTyped.snacks ?? distribTyped.snack ?? 0) : 0;
  // Calcular snack si falta y tenemos los otros valores
  const snackCalculado = distribTyped && !distribTyped.snacks && !distribTyped.snack && distribTyped.desayuno && distribTyped.almuerzo && distribTyped.cena
    ? Math.max(0, 100 - (distribTyped.desayuno + distribTyped.almuerzo + distribTyped.cena))
    : snackPct;

  function bmiPercent(b: number): number {
    // Mapea IMC al rango 15-35 -> 0-100
    if (!b || !isFinite(b)) return 0;
    const clamped = Math.max(15, Math.min(35, b));
    return Math.round(((clamped - 15) / (35 - 15)) * 100);
  }
  const bmiPct = bmiPercent(bmi);

  function bmiBadgeColor(): string {
    if (bmiCat === "bajo_peso") return "#60a5fa"; // azul
    if (bmiCat === "saludable") return "#10b981"; // verde
    if (bmiCat === "sobrepeso") return "#f59e0b"; // ámbar
    return "#ef4444"; // rojo
  }

  // Gradiente continuo Mal → Excelente (rojo→naranja→verde)
  function percentFromValue(v: number) {
    return Math.round(((v - 15) / (35 - 15)) * 100);
  }
  const p18 = percentFromValue(18.5);
  const p25 = percentFromValue(25);
  const p30 = percentFromValue(30);
  // Barra neutra; el color lo da el rango activo según categoría
  const bmiGradient = `linear-gradient(90deg, #ffffff22 0%, #ffffff22 100%)`;

  // Rango activo según categoría para resaltar zona correcta
  let activeRangeStart = 0;
  let activeRangeEnd = 100;
  const activeRangeColor = bmiBadgeColor();
  if (bmiCat === "bajo_peso") {
    activeRangeStart = 0; activeRangeEnd = p18;
  } else if (bmiCat === "saludable") {
    activeRangeStart = p18; activeRangeEnd = p25;
  } else if (bmiCat === "sobrepeso") {
    activeRangeStart = p25; activeRangeEnd = p30;
  } else {
    activeRangeStart = p30; activeRangeEnd = 100;
  }

  // Función para generar el siguiente mes del plan multi-fase
  const handleGenerarSiguienteMes = async () => {
    if (!planMultiFase || !planId || !user || !authUser || !datosSiguienteMes.pesoActual) return;
    
    setGenerandoSiguienteMes(true);
    setErrorSiguienteMes(null);
    
    // Guardar datos del mes anterior para comparación
    const mesAnteriorIndex = planMultiFase.mesActual - 1;
    const datosNutricionAnterior = {
      calorias: planMultiFase.historialMeses[mesAnteriorIndex]?.caloriasObjetivo || plan.calorias_diarias,
      macros: planMultiFase.historialMeses[mesAnteriorIndex]?.macros || plan.macros
    };
    const mesAnteriorCompleto = planMultiFase.historialMeses[mesAnteriorIndex];
    
    try {
      const db = getDbSafe();
      if (!db) throw new Error("Base de datos no disponible");
      
      // Obtener info de la fase actual
      const infoFase = obtenerInfoFaseActual(planMultiFase);
      const siguienteMes = planMultiFase.mesActual + 1;
      
      // Determinar si cambia de fase
      const siguienteFase = planMultiFase.fases.find(f => f.mesesIncluidos.includes(siguienteMes));
      const cambiaFase = siguienteFase && siguienteFase.nombre !== planMultiFase.faseActual;
      
      // Calcular ajustes basados en feedback
      const ajustes: string[] = [];
      const pesoAnterior = planMultiFase.historialMeses[planMultiFase.mesActual - 1]?.datosAlIniciar.peso || planMultiFase.datosIniciales.pesoInicial;
      const cambioPeso = datosSiguienteMes.pesoActual - pesoAnterior;
      
      // Ajustes de calorías basados en progreso
      if (planMultiFase.faseActual === "BULK" || planMultiFase.faseActual === "LEAN_BULK") {
        if (cambioPeso < 0.5) {
          ajustes.push("Aumentar calorías +150-200 kcal (ganancia muy lenta)");
        } else if (cambioPeso > 1.5) {
          ajustes.push("Reducir calorías -100-150 kcal (ganancia muy rápida, posible grasa excesiva)");
        }
      } else if (planMultiFase.faseActual === "CUT") {
        if (cambioPeso > -0.3) {
          ajustes.push("Aumentar déficit -150-200 kcal (pérdida muy lenta)");
        } else if (cambioPeso < -1.5) {
          ajustes.push("Reducir déficit +100-150 kcal (pérdida muy rápida, riesgo de pérdida muscular)");
        }
      }
      
      // Ajustes basados en energía
      if (datosSiguienteMes.energia === "muy_baja" || datosSiguienteMes.energia === "baja") {
        ajustes.push("Considerar subir carbohidratos o revisar sueño/estrés");
        if (planMultiFase.faseActual === "CUT") {
          ajustes.push("Posible día de recarga con más carbohidratos 1x/semana");
        }
      }
      
      // Ajustes basados en recuperación
      if (datosSiguienteMes.recuperacion === "mala" || datosSiguienteMes.recuperacion === "regular") {
        ajustes.push("Reducir volumen de entrenamiento o agregar día de descanso");
        ajustes.push("Revisar proteína y sueño para mejorar recuperación");
      }
      
      // Ajustes basados en adherencia
      if (datosSiguienteMes.adherenciaComida === "<50%" || datosSiguienteMes.adherenciaComida === "50-70%") {
        ajustes.push("Simplificar comidas y agregar opciones más flexibles");
      }
      if (datosSiguienteMes.adherenciaEntreno === "<50%" || datosSiguienteMes.adherenciaEntreno === "50-70%") {
        ajustes.push("Reducir días de entrenamiento o duración de sesiones");
      }
      
      // Lesiones nuevas
      if (datosSiguienteMes.lesionesNuevas) {
        ajustes.push(`Adaptar ejercicios para lesión: ${datosSiguienteMes.lesionesNuevas}`);
      }
      
      // Preparar input para generar el nuevo plan
      const userInput = {
        ...user,
        pesoKg: datosSiguienteMes.pesoActual,
        cinturaCm: datosSiguienteMes.cinturaActual || user.cinturaCm,
        doloresLesiones: [
          ...(user.doloresLesiones || []),
          ...(datosSiguienteMes.lesionesNuevas ? [datosSiguienteMes.lesionesNuevas] : [])
        ].filter(Boolean),
        // Ajustar objetivo según la nueva fase
        objetivo: cambiaFase && siguienteFase ? 
          (siguienteFase.nombre === "CUT" ? "corte" : siguienteFase.nombre === "LEAN_BULK" ? "lean_bulk" : "volumen") as typeof user.objetivo
          : user.objetivo
      };
      
      // Generar nuevo plan
      const response = await fetch("/api/generatePlan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...userInput,
          // Contexto adicional para el siguiente mes
          _contextoMultiFase: {
            mesActual: siguienteMes,
            totalMeses: planMultiFase.totalMeses,
            faseActual: siguienteFase?.nombre || planMultiFase.faseActual,
            pesoInicial: planMultiFase.datosIniciales.pesoInicial,
            pesoObjetivoFinal: planMultiFase.datosIniciales.pesoObjetivoFinal,
            ajustesRecomendados: ajustes,
            feedbackUsuario: datosSiguienteMes.comentarios,
            cambiaFase
          }
        })
      });
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Error desconocido" }));
        throw new Error(error.error || "Error al generar el plan");
      }
      
      const nuevoPlan = await response.json();
      
      // Actualizar datos del mes anterior con datos finales
      const mesAnteriorActualizado = {
        ...planMultiFase.historialMeses[planMultiFase.mesActual - 1],
        fechaFin: new Date().toISOString(),
        datosAlFinalizar: {
          peso: datosSiguienteMes.pesoActual,
          cintura: datosSiguienteMes.cinturaActual || undefined,
          energia: datosSiguienteMes.energia,
          recuperacion: datosSiguienteMes.recuperacion,
          adherenciaComida: datosSiguienteMes.adherenciaComida,
          adherenciaEntreno: datosSiguienteMes.adherenciaEntreno,
          lesionesNuevas: datosSiguienteMes.lesionesNuevas || undefined,
          comentarios: datosSiguienteMes.comentarios || undefined,
          fechaRegistro: new Date().toISOString()
        }
      };
      
      // Crear nuevo mes en historial
      const nuevoMesHistorial = {
        mesNumero: siguienteMes,
        faseEnEsteMes: siguienteFase?.nombre || planMultiFase.faseActual,
        fechaGeneracion: new Date().toISOString(),
        datosAlIniciar: {
          peso: datosSiguienteMes.pesoActual,
          cintura: datosSiguienteMes.cinturaActual || undefined,
          fechaRegistro: new Date().toISOString()
        },
        planAlimentacion: nuevoPlan.plan_semanal || [],
        caloriasObjetivo: nuevoPlan.calorias_diarias || 2200,
        macros: nuevoPlan.macros || { proteinas: "150g", grasas: "70g", carbohidratos: "240g" },
        planEntrenamiento: nuevoPlan.training_plan,
        suplementos: planMultiFase.suplementosBase, // Mantener los mismos suplementos base
        ajustesAplicados: ajustes,
        dificultad: nuevoPlan.dificultad,
        mensajeMotivacional: nuevoPlan.mensaje_motivacional
      };
      
      // Actualizar planMultiFase
      const planMultiFaseActualizado: PlanMultiFase = {
        ...planMultiFase,
        mesActual: siguienteMes,
        faseActual: siguienteFase?.nombre || planMultiFase.faseActual,
        historialMeses: [
          ...planMultiFase.historialMeses.slice(0, planMultiFase.mesActual - 1),
          mesAnteriorActualizado,
          nuevoMesHistorial
        ]
      };
      
      // Guardar en Firebase
      const { doc, updateDoc, serverTimestamp } = await import("firebase/firestore");
      const planRef = doc(db, "planes", planId);
      
      const cleanUser = Object.fromEntries(
        Object.entries(userInput).filter(([, v]) => v !== undefined && v !== null)
      );
      const cleanPlan = JSON.parse(JSON.stringify({ plan: nuevoPlan, user: cleanUser }));
      
      await updateDoc(planRef, {
        plan: cleanPlan,
        planMultiFase: JSON.parse(JSON.stringify(planMultiFaseActualizado)),
        updatedAt: serverTimestamp()
      });
      
      // Actualizar store
      setUser(userInput);
      setPlan(nuevoPlan);
      setPlanMultiFase(planMultiFaseActualizado);
      
      // Calcular cambios entre meses para mostrar en modal
      const calcularCambiosEntrenamiento = () => {
        const diasGymAnterior = mesAnteriorCompleto?.planEntrenamiento?.weeks?.[0]?.days?.length || user.diasGym || 4;
        const diasGymNuevo = nuevoPlan.training_plan?.weeks?.[0]?.days?.length || user.diasGym || 4;
        
        // Contar ejercicios totales
        const ejerciciosAnterior = mesAnteriorCompleto?.planEntrenamiento?.weeks?.reduce((acc: number, week: any) => 
          acc + (week.days?.reduce((dayAcc: number, day: any) => dayAcc + (day.ejercicios?.length || 0), 0) || 0), 0) || 0;
        const ejerciciosNuevo = nuevoPlan.training_plan?.weeks?.reduce((acc: number, week: any) => 
          acc + (week.days?.reduce((dayAcc: number, day: any) => dayAcc + (day.ejercicios?.length || 0), 0) || 0), 0) || 0;
        
        let cambioVolumen: "aumentado" | "reducido" | "mantenido" = "mantenido";
        if (ejerciciosNuevo > ejerciciosAnterior + 2) cambioVolumen = "aumentado";
        else if (ejerciciosNuevo < ejerciciosAnterior - 2) cambioVolumen = "reducido";
        
        let descripcion = "";
        if (cambioVolumen === "aumentado") {
          descripcion = "Se ha incrementado el volumen de entrenamiento para progresar según tus capacidades actuales.";
        } else if (cambioVolumen === "reducido") {
          descripcion = "Se ha reducido el volumen para mejorar la recuperación según tu feedback del mes anterior.";
        } else {
          descripcion = "El volumen de entrenamiento se mantiene para consolidar adaptaciones.";
        }
        
        return {
          diasGymAnterior,
          diasGymNuevo,
          cambioVolumen,
          ejerciciosNuevos: Math.max(0, ejerciciosNuevo - ejerciciosAnterior),
          descripcionCambios: descripcion
        };
      };
      
      const extraerGramos = (str: string): number => {
        const match = str.match(/(\d+(\.\d+)?)/);
        return match ? parseFloat(match[1]) : 0;
      };
      
      // Calcular progreso del usuario
      const calcularProgresoUsuario = () => {
        const pesoInicial = planMultiFase.datosIniciales.pesoInicial;
        const pesoActual = datosSiguienteMes.pesoActual;
        const pesoObjetivo = planMultiFase.datosIniciales.pesoObjetivoFinal;
        
        const cambioPesoTotal = pesoActual - pesoInicial;
        const cambioPesoUltimoMes = datosSiguienteMes.pesoActual - (mesAnteriorCompleto?.datosAlIniciar?.peso || pesoInicial);
        
        // Calcular porcentaje hacia objetivo
        const pesoARecorrer = pesoObjetivo - pesoInicial;
        const pesoRecorrido = pesoActual - pesoInicial;
        const porcentajeHaciaObjetivo = pesoARecorrer !== 0 ? (pesoRecorrido / pesoARecorrer) * 100 : 0;
        
        // Calcular adherencia promedio de todos los meses
        const mapAdherencia = (s: string) => {
          if (s === ">80%") return 85;
          if (s === "70-80%") return 75;
          if (s === "50-70%") return 60;
          return 40;
        };
        
        const mesesConDatos = planMultiFaseActualizado.historialMeses.filter(m => m.datosAlFinalizar);
        const adherencias = mesesConDatos.map(m => {
          const comida = m.datosAlFinalizar!.adherenciaComida;
          const entreno = m.datosAlFinalizar!.adherenciaEntreno;
          return (mapAdherencia(comida) + mapAdherencia(entreno)) / 2;
        });
        const adherenciaPromedio = adherencias.length > 0 
          ? adherencias.reduce((a, b) => a + b, 0) / adherencias.length 
          : 0;
        
        // Calcular tendencias de energía y recuperación
        const mapEnergia = (e: string): number => {
          if (e === "muy_alta") return 5;
          if (e === "alta") return 4;
          if (e === "normal") return 3;
          if (e === "baja") return 2;
          return 1;
        };
        
        const mapRecuperacion = (r: string): number => {
          if (r === "excelente") return 5;
          if (r === "buena") return 4;
          if (r === "normal") return 3;
          if (r === "regular") return 2;
          return 1;
        };
        
        const energias = mesesConDatos.map(m => mapEnergia(m.datosAlFinalizar!.energia));
        const recuperaciones = mesesConDatos.map(m => mapRecuperacion(m.datosAlFinalizar!.recuperacion));
        
        let tendenciaEnergia: "mejorando" | "estable" | "empeorando" = "estable";
        if (energias.length >= 2) {
          const ultimaDos = energias.slice(-2);
          if (ultimaDos[1] > ultimaDos[0]) tendenciaEnergia = "mejorando";
          else if (ultimaDos[1] < ultimaDos[0]) tendenciaEnergia = "empeorando";
        }
        
        let tendenciaRecuperacion: "mejorando" | "estable" | "empeorando" = "estable";
        if (recuperaciones.length >= 2) {
          const ultimaDos = recuperaciones.slice(-2);
          if (ultimaDos[1] > ultimaDos[0]) tendenciaRecuperacion = "mejorando";
          else if (ultimaDos[1] < ultimaDos[0]) tendenciaRecuperacion = "empeorando";
        }
        
        return {
          pesoInicial,
          pesoActual,
          pesoObjetivo,
          cambioPesoTotal,
          cambioPesoUltimoMes,
          porcentajeHaciaObjetivo,
          mesesCompletados: planMultiFase.mesActual, // El mes que acaba de completar
          totalMeses: planMultiFase.totalMeses,
          adherenciaPromedio,
          tendenciaEnergia,
          tendenciaRecuperacion
        };
      };
      
      const cambiosData = {
        mesAnterior: planMultiFase.mesActual,
        mesNuevo: siguienteMes,
        faseAnterior: planMultiFase.faseActual,
        faseNueva: siguienteFase?.nombre || planMultiFase.faseActual,
        cambiaFase,
        nutricion: {
          caloriasAnterior: datosNutricionAnterior.calorias,
          caloriasNueva: nuevoPlan.calorias_diarias,
          diferenciaCalorias: nuevoPlan.calorias_diarias - datosNutricionAnterior.calorias,
          macrosAnterior: datosNutricionAnterior.macros,
          macrosNuevo: nuevoPlan.macros,
          cambioMacros: {
            proteinas: extraerGramos(nuevoPlan.macros.proteinas) - extraerGramos(datosNutricionAnterior.macros.proteinas),
            carbohidratos: extraerGramos(nuevoPlan.macros.carbohidratos) - extraerGramos(datosNutricionAnterior.macros.carbohidratos),
            grasas: extraerGramos(nuevoPlan.macros.grasas) - extraerGramos(datosNutricionAnterior.macros.grasas),
          }
        },
        entrenamiento: calcularCambiosEntrenamiento(),
        ajustesAplicados: ajustes,
        razonCambios: ajustes.length > 0 
          ? "Los ajustes se realizaron para optimizar tu progreso basándose en los resultados del mes anterior."
          : cambiaFase
          ? `Cambio de fase automático según tu plan multi-fase. Tu fase ${planMultiFase.faseActual} ha finalizado y ahora comienza la fase ${siguienteFase.nombre}.`
          : "El plan se mantiene consistente con tu progreso actual. Continuarás con la misma estructura para consolidar adaptaciones.",
        progresoUsuario: calcularProgresoUsuario()
      };
      
      setMonthChangesData(cambiosData);
      
      // Cerrar modal de datos y abrir modal de cambios
      setModalSiguienteMesAbierto(false);
      setMonthChangesModalOpen(true);
      
      // Resetear datos del formulario
      setDatosSiguienteMes({
        pesoActual: 0,
        cinturaActual: 0,
        energia: "normal",
        recuperacion: "normal",
        adherenciaComida: ">80%",
        adherenciaEntreno: ">80%",
        lesionesNuevas: "",
        comentarios: ""
      });
      
      console.log("✅ Plan del mes", siguienteMes, "generado exitosamente");
      
    } catch (err) {
      console.error("Error al generar siguiente mes:", err);
      setErrorSiguienteMes(err instanceof Error ? err.message : "Error al generar el plan");
    } finally {
      setGenerandoSiguienteMes(false);
    }
  };

  // Renderizar recomendaciones de entrenamiento como ReactNode
  const renderRecomendacionesEntrenamiento = (): React.ReactNode => {
    if (!sugerenciaEntrenamientoAjustada) return null;
  return (
    <div key="sugerencias-entrenamiento" className="mt-6 rounded-xl border border-white/10 p-4 bg-gradient-to-r from-white/5 to-white/10">
      <h2 className="text-lg font-semibold mb-3">💪 Recomendaciones de entrenamiento y recuperación</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-medium opacity-90">
              Días de gym:
              <span className="ml-2 text-xs opacity-70">
                (≈ {(() => {
                  const min = minutosGymEditado !== null ? minutosGymEditado : (Number((plan as unknown as Record<string, unknown>)?.minutos_sesion_gym) || 75);
                  const total = Math.max(0, Math.round(min));
                  const h = Math.floor(total / 60);
                  const m = total % 60;
                  const hStr = h > 0 ? `${h} h` : "0 h";
                  const mStr = m > 0 ? ` ${m} min` : "";
                  return `${hStr}${mStr} por día`;
                })()})
              </span>
            </p>
            {sugerenciaEntrenamientoAjustada.diasGym !== diasGymActual && (
              <span className="text-xs opacity-70">(sugerido: {sugerenciaEntrenamientoAjustada.diasGym})</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              max="7"
              value={diasGymActual}
              onChange={(e) => setDiasGymEditado(Number(e.target.value))}
              className="text-2xl font-bold bg-transparent border-b-2 border-white/20 focus:border-white/50 outline-none w-16"
            />
            <span className="text-2xl font-bold">días por semana</span>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-sm opacity-80 min-w-[130px]">Duración por sesión:</span>
            <input
              type="number"
              min="30"
              max="240"
              step="5"
              value={minutosGymEditado !== null ? minutosGymEditado : (Number((plan as unknown as Record<string, unknown>)?.minutos_sesion_gym) || 75)}
              onChange={(e) => setMinutosGymEditado(Number(e.target.value))}
              className="text-lg font-semibold bg-transparent border-b-2 border-white/20 focus:border-white/50 outline-none w-24"
            />
            <span className="text-sm font-medium">min</span>
          </div>
          <p className="text-xs opacity-75 mt-1">Entrenamiento de fuerza con pesas</p>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-medium opacity-90">Caminata diaria:</p>
            {sugerenciaEntrenamientoAjustada.minutosCaminata !== minutosCaminataActual && (
              <span className="text-xs opacity-70">(sugerido: {sugerenciaEntrenamientoAjustada.minutosCaminata})</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              max="120"
              step="5"
              value={minutosCaminataActual}
              onChange={(e) => setMinutosCaminataEditado(Number(e.target.value))}
              className="text-2xl font-bold bg-transparent border-b-2 border-white/20 focus:border-white/50 outline-none w-16"
            />
            <span className="text-2xl font-bold">minutos</span>
          </div>
          <p className="text-xs opacity-75 mt-1">Caminata moderada todos los días</p>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-medium opacity-90 flex items-center gap-2">
              Horas de sueño:
              <button
                type="button"
                onClick={() => setModalInfoAbierto('sueno')}
                className="inline-flex items-center cursor-pointer hover:opacity-100 transition-opacity"
                aria-label="Info sueño y siesta"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="h-4 w-4 opacity-90"
                >
                  <path d="M12 2a10 10 0 1 0 10 10A10.011 10.011 0 0 0 12 2Zm.75 15h-1.5v-1.5h1.5Zm1.971-6.279-.675.693A3.375 3.375 0 0 0 12.75 14.25h-1.5a4.875 4.875 0 0 1 1.425-3.45l.93-.936a1.875 1.875 0 1 0-3.195-1.326h-1.5a3.375 3.375 0 1 1 6.03 1.283Z" />
                </svg>
              </button>
            </p>
            {sugerenciaEntrenamientoAjustada.horasSueno !== horasSuenoActual && (
              <span className="text-xs opacity-70">(sugerido: {sugerenciaEntrenamientoAjustada.horasSueno})</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="5"
              max="12"
              step="0.5"
              value={horasSuenoActual}
              onChange={(e) => setHorasSuenoEditado(Number(e.target.value))}
              className="text-2xl font-bold bg-transparent border-b-2 border-white/20 focus:border-white/50 outline-none w-20"
            />
            <span className="text-2xl font-bold">horas</span>
          </div>
          <p className="text-xs opacity-75 mt-1">Para óptima recuperación diaria</p>
        </div>
      </div>
      <p className="mt-3 text-sm opacity-80 leading-relaxed">
        {sugerenciaEntrenamientoAjustada.descripcion}
      </p>
      
      {/* Análisis de cambios */}
      {analisisCambios && (analisisCambios.pros.length > 0 || analisisCambios.contras.length > 0) && (
        <div className="mt-4 pt-4 border-t border-white/10">
          <h3 className="text-sm font-semibold mb-3">📊 Impacto de tus cambios:</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {analisisCambios.pros.length > 0 && (
              <div>
                <p className="text-sm font-medium text-emerald-400 mb-2">✅ Pros:</p>
                <ul className="space-y-1">
                  {analisisCambios.pros.map((pro, idx) => (
                    <li key={`pro-${idx}-${pro}`} className="text-xs opacity-90 flex items-start gap-2">
                      <span className="text-emerald-400 mt-1">•</span>
                      <span>{pro}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {analisisCambios.contras.length > 0 && (
              <div>
                <p className="text-sm font-medium text-orange-400 mb-2">⚠️ Contras:</p>
                <ul className="space-y-1">
                  {analisisCambios.contras.map((contra, idx) => (
                    <li key={`contra-${idx}-${contra}`} className="text-xs opacity-90 flex items-start gap-2">
                      <span className="text-orange-400 mt-1">•</span>
                      <span>{contra}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
      {user?.doloresLesiones && user.doloresLesiones.filter((s: string) => typeof s === "string" && s.trim().length > 0).length > 0 && (
        <div className="mt-4 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-100">
          <p className="font-medium text-cyan-100 flex items-center gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="h-4 w-4"
            >
              <path d="M12 2a10 10 0 1 0 10 10A10.011 10.011 0 0 0 12 2Zm.75 15h-1.5v-1.5h1.5Zm1.971-6.279-.675.693A3.375 3.375 0 0 0 12.75 14.25h-1.5a4.875 4.875 0 0 1 1.425-3.45l.93-.936a1.875 1.875 0 1 0-3.195-1.326h-1.5a3.375 3.375 0 1 1 6.03 1.283Z" />
            </svg>
            Entrenamiento adaptado para proteger:
          </p>
          <p className="mt-1 text-cyan-100/80">
            {user.doloresLesiones.filter((s: string) => typeof s === "string" && s.trim().length > 0).join(", ")}
          </p>
          <p className="mt-1 opacity-80">
            Incluye calentamientos dirigidos, variaciones seguras y recordatorios de técnica para evitar agravar estas zonas.
          </p>
        </div>
      )}
    </div>
    );
  };

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="px-4 py-8 md:px-8">
      <div className="mx-auto max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl p-6 md:p-8"
        >
          <div className="flex flex-col gap-2">
            {/* Banner de Plan Multi-Fase */}
            {planMultiFase && planMultiFase.tipo !== "simple" && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`mb-4 p-4 rounded-xl border ${
                  planMultiFase.faseActual === "BULK" 
                    ? "bg-gradient-to-r from-amber-500/20 to-orange-500/20 border-amber-500/30" 
                    : planMultiFase.faseActual === "CUT"
                    ? "bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border-cyan-500/30"
                    : planMultiFase.faseActual === "LEAN_BULK"
                    ? "bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border-emerald-500/30"
                    : "bg-gradient-to-r from-purple-500/20 to-pink-500/20 border-purple-500/30"
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`px-3 py-1 rounded-lg text-sm font-bold ${
                      planMultiFase.faseActual === "BULK" 
                        ? "bg-amber-500/30 text-amber-200" 
                        : planMultiFase.faseActual === "CUT"
                        ? "bg-cyan-500/30 text-cyan-200"
                        : planMultiFase.faseActual === "LEAN_BULK"
                        ? "bg-emerald-500/30 text-emerald-200"
                        : "bg-purple-500/30 text-purple-200"
                    }`}>
                      {planMultiFase.faseActual === "BULK" && "🔥 BULK"}
                      {planMultiFase.faseActual === "CUT" && "✨ CUT"}
                      {planMultiFase.faseActual === "LEAN_BULK" && "💎 LEAN BULK"}
                      {planMultiFase.faseActual === "MANTENIMIENTO" && "⚡ MANTENIMIENTO"}
                    </div>
                    <div className="text-sm">
                      <span className="font-semibold">Mes {planMultiFase.mesActual}</span>
                      <span className="opacity-70"> de {planMultiFase.totalMeses}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="opacity-70">Peso actual:</span>
                      <span className="font-semibold">
                        {planMultiFase.historialMeses[planMultiFase.mesActual - 1]?.datosAlIniciar.peso || planMultiFase.datosIniciales.pesoInicial} kg
                      </span>
                    </div>
                    <div className="text-white/30">→</div>
                    <div className="flex items-center gap-2">
                      <span className="opacity-70">Meta fase:</span>
                      <span className="font-semibold">
                        {(() => {
                          const infoFase = obtenerInfoFaseActual(planMultiFase);
                          return infoFase.fase?.pesoMeta || planMultiFase.datosIniciales.pesoObjetivoFinal;
                        })()} kg
                      </span>
                    </div>
                  </div>
                </div>
                
                {/* Barra de progreso del plan completo */}
                <div className="mt-3">
                  <div className="flex justify-between text-xs opacity-70 mb-1">
                    <span>{planMultiFase.datosIniciales.pesoInicial} kg (inicio)</span>
                    <span>{planMultiFase.datosIniciales.pesoObjetivoFinal} kg (meta final)</span>
                  </div>
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${(planMultiFase.mesActual / planMultiFase.totalMeses) * 100}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                      className={`h-full rounded-full ${
                        planMultiFase.faseActual === "BULK" 
                          ? "bg-gradient-to-r from-amber-500 to-orange-500" 
                          : planMultiFase.faseActual === "CUT"
                          ? "bg-gradient-to-r from-cyan-500 to-blue-500"
                          : planMultiFase.faseActual === "LEAN_BULK"
                          ? "bg-gradient-to-r from-emerald-500 to-teal-500"
                          : "bg-gradient-to-r from-purple-500 to-pink-500"
                      }`}
                    />
                  </div>
                  <div className="flex justify-between mt-1">
                    {planMultiFase.fases.map((fase, idx) => (
                      <div 
                        key={idx} 
                        className={`text-xs ${fase.nombre === planMultiFase.faseActual ? "font-semibold" : "opacity-50"}`}
                        style={{ width: `${(fase.mesesIncluidos.length / planMultiFase.totalMeses) * 100}%` }}
                      >
                        {fase.nombre} ({fase.mesesIncluidos.length}m)
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
            
            {/* Banner de Continuidad - Planes simples al 90-100% */}
            {!planMultiFase && planId && authUser && (() => {
              const ContinuityBanner = () => {
                const [planData, setPlanData] = useState<any>(null);
                const [progress, setProgress] = useState(0);
                
                useEffect(() => {
                  const loadData = async () => {
                    try {
                      const db = getDbSafe();
                      if (!db) return;
                      
                      const planRef = doc(db, "planes", planId);
                      const planDoc = await getDoc(planRef);
                      
                      if (planDoc.exists()) {
                        const data = planDoc.data();
                        setPlanData(data);
                        
                        if (data.createdAt) {
                          const createdDate = data.createdAt.toDate?.() || new Date(data.createdAt.seconds * 1000);
                          const now = new Date();
                          const diffTime = now.getTime() - createdDate.getTime();
                          const diffDays = diffTime / (1000 * 60 * 60 * 24);
                          const prog = Math.min(100, Math.max(0, (diffDays / 30) * 100));
                          setProgress(prog);
                        }
                      }
                    } catch (error) {
                      console.error("Error al cargar datos del plan:", error);
                    }
                  };
                  
                  loadData();
                }, []);
                
                if (!planData || progress < 90 || planData.completado) return null;
                
                return (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-4 p-4 rounded-xl border bg-gradient-to-r from-green-500/20 to-emerald-500/20 border-green-500/30"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-lg">🎯</span>
                          <h3 className="font-bold text-green-200">
                            {progress >= 100 ? "¡Plan completado!" : "Plan casi completado"}
                          </h3>
                        </div>
                        <p className="text-sm opacity-80">
                          {progress >= 100 
                            ? "¡Felicidades! Es momento de generar tu siguiente plan basado en tus resultados." 
                            : `Estás al ${Math.round(progress)}%. Pronto podrás generar tu siguiente plan personalizado.`}
                        </p>
                      </div>
                      <button
                        onClick={() => setContinuityModalOpen(true)}
                        className="px-4 py-2 rounded-lg bg-green-500 hover:bg-green-600 text-white text-sm font-medium transition-all shadow-lg whitespace-nowrap"
                      >
                        Preparar continuidad
                      </button>
                    </div>
                  </motion.div>
                );
              };
              
              return <ContinuityBanner />;
            })()}

            {/* Banner de Continuidad - Planes Multi-Fase mes a mes */}
            {planMultiFase && planMultiFase.tipo !== "simple" && planId && authUser && (() => {
              const MultiPhaseContinuityBanner = () => {
                const [mesProgress, setMesProgress] = useState(0);
                const [fechaInicioMesActual, setFechaInicioMesActual] = useState<Date | null>(null);
                
                useEffect(() => {
                  const loadData = async () => {
                    try {
                      const db = getDbSafe();
                      if (!db) {
                        return;
                      }
                      
                      const planRef = doc(db, "planes", planId);
                      const planDoc = await getDoc(planRef);
                      
                      if (planDoc.exists()) {
                        const data = planDoc.data();
                        
                        // Obtener fecha de inicio del mes actual
                        const mesActualIndex = planMultiFase.mesActual - 1;
                        const mesActualData = planMultiFase.historialMeses[mesActualIndex];
                        
                        if (mesActualData && mesActualData.fechaGeneracion) {
                          const fechaInicio = new Date(mesActualData.fechaGeneracion);
                          setFechaInicioMesActual(fechaInicio);
                          
                          // Calcular progreso del mes actual (30 días)
                          const now = new Date();
                          const diffTime = now.getTime() - fechaInicio.getTime();
                          const diffDays = diffTime / (1000 * 60 * 60 * 24);
                          const prog = Math.min(100, Math.max(0, (diffDays / 30) * 100));
                          setMesProgress(prog);
                        }
                      }
                    } catch (error) {
                      console.error("Error al cargar datos del mes actual:", error);
                    }
                  };
                  
                  loadData();
                }, []);
                
                // Solo mostrar si el mes actual está al 90-100% Y no es el último mes
                // TEMPORAL: Usando 5% para testing
                // Solo mostrar si el mes actual está al 90-100% Y no es el último mes
                if (!fechaInicioMesActual || mesProgress < 90 || planMultiFase.mesActual >= planMultiFase.totalMeses) {
                  return null;
                }
                
                const siguienteMes = planMultiFase.mesActual + 1;
                const siguienteFase = planMultiFase.fases.find(f => f.mesesIncluidos.includes(siguienteMes));
                const cambiaFase = siguienteFase && siguienteFase.nombre !== planMultiFase.faseActual;
                
                return (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`mb-4 p-4 rounded-xl border ${
                      planMultiFase.faseActual === "BULK"
                        ? "bg-gradient-to-r from-amber-500/20 to-orange-500/20 border-amber-500/30"
                        : planMultiFase.faseActual === "CUT"
                        ? "bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border-cyan-500/30"
                        : planMultiFase.faseActual === "LEAN_BULK"
                        ? "bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border-emerald-500/30"
                        : "bg-gradient-to-r from-purple-500/20 to-pink-500/20 border-purple-500/30"
                    }`}
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-lg">
                            {cambiaFase ? "🔄" : "📈"}
                          </span>
                          <h3 className={`font-bold ${
                            planMultiFase.faseActual === "BULK" ? "text-amber-200" :
                            planMultiFase.faseActual === "CUT" ? "text-cyan-200" :
                            planMultiFase.faseActual === "LEAN_BULK" ? "text-emerald-200" :
                            "text-purple-200"
                          }`}>
                            {Math.round(mesProgress) >= 100 
                              ? `¡Mes ${planMultiFase.mesActual} completado!` 
                              : Math.round(mesProgress) >= 90
                              ? `Mes ${planMultiFase.mesActual} casi completado`
                              : `Mes ${planMultiFase.mesActual} en progreso`}
                          </h3>
                        </div>
                        <p className="text-sm opacity-80">
                          {Math.round(mesProgress) >= 100 
                            ? cambiaFase 
                              ? `Es momento de cambiar a la fase ${siguienteFase.nombre} y generar el mes ${siguienteMes}.`
                              : `Es momento de generar el mes ${siguienteMes} de tu plan multi-fase.`
                            : Math.round(mesProgress) >= 90
                            ? `Estás al ${Math.round(mesProgress)}% del mes ${planMultiFase.mesActual}. Pronto podrás generar el siguiente mes.`
                            : `Estás al ${Math.round(mesProgress)}% del mes ${planMultiFase.mesActual}.`}
                        </p>
                        {cambiaFase && (
                          <p className="text-xs opacity-70 mt-1">
                            🔥 Cambio de fase: <span className="font-semibold">{planMultiFase.faseActual}</span> → <span className="font-semibold">{siguienteFase.nombre}</span>
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => setModalSiguienteMesAbierto(true)}
                        className={`px-4 py-2 rounded-lg text-white text-sm font-medium transition-all shadow-lg whitespace-nowrap ${
                          planMultiFase.faseActual === "BULK"
                            ? "bg-amber-500 hover:bg-amber-600"
                            : planMultiFase.faseActual === "CUT"
                            ? "bg-cyan-500 hover:bg-cyan-600"
                            : planMultiFase.faseActual === "LEAN_BULK"
                            ? "bg-emerald-500 hover:bg-emerald-600"
                            : "bg-purple-500 hover:bg-purple-600"
                        }`}
                      >
                        Preparar mes {siguienteMes} de {planMultiFase.totalMeses}
                      </button>
                    </div>
                    
                    {/* Barra de progreso del mes actual */}
                    <div className="mt-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs opacity-60">Progreso del mes {planMultiFase.mesActual}</span>
                        <span className="text-xs font-medium">{Math.round(mesProgress)}%</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            planMultiFase.faseActual === "BULK"
                              ? "bg-gradient-to-r from-amber-500 to-orange-500"
                              : planMultiFase.faseActual === "CUT"
                              ? "bg-gradient-to-r from-cyan-500 to-blue-500"
                              : planMultiFase.faseActual === "LEAN_BULK"
                              ? "bg-gradient-to-r from-emerald-500 to-teal-500"
                              : "bg-gradient-to-r from-purple-500 to-pink-500"
                          }`}
                          style={{ width: `${mesProgress}%` }}
                        />
                      </div>
                      <p className="text-xs opacity-50 mt-1">
                        {Math.round(mesProgress) >= 100 
                          ? "Mes completado - Listo para continuar" 
                          : `${Math.max(0, Math.ceil(30 - (mesProgress / 100 * 30)))} días restantes`}
                      </p>
                    </div>
                  </motion.div>
                );
              };
              
              return <MultiPhaseContinuityBanner />;
            })()}
            
            <div className="flex items-center justify-between gap-4 flex-wrap">
            <h1 className="text-2xl md:text-3xl font-semibold">Tu plan inteligente</h1>
              <div className="flex gap-3">
                <div className="relative group">
                  <button
                    className={`rounded-xl px-4 py-2 text-sm font-medium border transition-colors ${
                      !isPremium 
                        ? 'bg-blue-500/10 border-blue-500/20 text-blue-300/50 cursor-not-allowed opacity-50' 
                        : 'bg-blue-500/20 border-blue-500/30 hover:bg-blue-500/30'
                    }`}
                    onClick={() => {
                      if (!isPremium) return;
                      if (user) {
                        setDatosEdicion({ ...user });
                        setPreferenciasTexto(user.preferencias?.join(", ") || "");
                        setRestriccionesTexto(user.restricciones?.join(", ") || "");
                        setPatologiasTexto(user.patologias?.join(", ") || "");
                        setDoloresLesionesTexto(user.doloresLesiones?.join(", ") || "");
                        setModalAbierto(true);
                      }
                    }}
                    disabled={!isPremium}
                  >
                    ✏️ Editar
                  </button>
                  {!isPremium && (
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gradient-to-r from-yellow-500/95 to-orange-500/95 text-white text-xs font-medium rounded-lg shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 border border-yellow-400/50">
                      💳 Requiere Premium para editar el plan
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                        <div className="w-2 h-2 bg-gradient-to-r from-yellow-500 to-orange-500 rotate-45 border-r border-b border-yellow-400/50"></div>
                      </div>
                    </div>
                  )}
                </div>
                <div className="relative group">
                  <button
                    className={`rounded-xl px-4 py-2 text-sm font-medium border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      !isPremium 
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300/50 cursor-not-allowed opacity-50' 
                        : 'bg-emerald-500/20 border-emerald-500/30 hover:bg-emerald-500/30'
                    }`}
                    onClick={async () => {
                      if (!isPremium) return;
                    if (!plan || !user) return;
                    setGuardandoPDF(true);
                    try {
                      const pdf = new jsPDF('p', 'mm', 'a4');
                      const pageWidth = pdf.internal.pageSize.getWidth();
                      const pageHeight = pdf.internal.pageSize.getHeight();
                      let yPos = 20;
                      const margin = 20;
                      const maxWidth = pageWidth - (margin * 2);
                      
                      // Colores de marca (coinciden con la web)
                      const colorAzul: [number, number, number] = [59, 130, 246]; // blue-500 #3b82f6
                      const colorVerde: [number, number, number] = [16, 185, 129]; // emerald-500 #10b981
                      const colorCyan: [number, number, number] = [6, 182, 212]; // cyan-500 #06b6d4
                      const colorFondo: [number, number, number] = [11, 16, 32]; // background #0b1020
                      const colorTexto: [number, number, number] = [230, 246, 255]; // foreground #e6f6ff
                      const colorSubtitulo: [number, number, number] = [203, 213, 225]; // slate-300
                      const colorFondoOscuro: [number, number, number] = [30, 41, 59]; // slate-800 para cajas
                      
                      // Helper para dibujar fondo oscuro en una página
                      const drawDarkBackground = () => {
                        pdf.setFillColor(colorFondo[0], colorFondo[1], colorFondo[2]);
                        pdf.rect(0, 0, pageWidth, pageHeight, 'F');
                      };
                      
                      // Helper para verificar si necesita nueva página
                      const checkNewPage = (neededSpace: number) => {
                        if (yPos + neededSpace > pageHeight - 30) {
                          pdf.addPage();
                          // Dibujar fondo oscuro en la nueva página
                          drawDarkBackground();
                          yPos = 20;
                          return true;
                        }
                        return false;
                      };
                      
                      // Helper para dibujar caja con fondo
                      const drawBox = (x: number, y: number, w: number, h: number, fillColor?: [number, number, number], strokeColor?: [number, number, number]) => {
                        if (fillColor) {
                          pdf.setFillColor(fillColor[0], fillColor[1], fillColor[2]);
                        }
                        if (strokeColor) {
                          pdf.setDrawColor(strokeColor[0], strokeColor[1], strokeColor[2]);
                          pdf.setLineWidth(0.5);
                        }
                        pdf.rect(x, y, w, h, fillColor ? 'FD' : (strokeColor ? 'D' : 'S'));
                      };
                      
                      // Helper para dibujar línea decorativa
                      const drawLine = (x: number, y: number, w: number, color: [number, number, number], width = 0.5) => {
                        pdf.setDrawColor(color[0], color[1], color[2]);
                        pdf.setLineWidth(width);
                        pdf.line(x, y, x + w, y);
                      };
                      
                      // Fondo oscuro (simulado con rectángulo)
                      pdf.setFillColor(colorFondo[0], colorFondo[1], colorFondo[2]);
                      pdf.rect(0, 0, pageWidth, pageHeight, 'F');
                      
                      // Header con gradiente simulado
                      const azulClaro: [number, number, number] = [96, 165, 250]; // blue-400 para fondo más claro
                      drawBox(margin, yPos - 5, maxWidth, 35, azulClaro, colorAzul);
                      pdf.setTextColor(colorAzul[0], colorAzul[1], colorAzul[2]);
                      pdf.setFontSize(28);
                      pdf.setFont('helvetica', 'bold');
                      pdf.text('Tu Plan Inteligente', margin + 10, yPos + 12);
                      
                      if (user.nombre) {
                        pdf.setTextColor(colorSubtitulo[0], colorSubtitulo[1], colorSubtitulo[2]);
                        pdf.setFontSize(11);
                        pdf.setFont('helvetica', 'normal');
                        pdf.text(`Generado para ${user.nombre}`, margin + 10, yPos + 22);
                      }
                      
                      pdf.setTextColor(colorCyan[0], colorCyan[1], colorCyan[2]);
                      pdf.setFontSize(9);
                      pdf.text(`Fecha: ${new Date().toLocaleDateString('es-AR', { year: 'numeric', month: 'long', day: 'numeric' })}`, margin + 10, yPos + 28);
                      
                      yPos += 45;
                      checkNewPage(5);
                      
                      // Información General en caja destacada
                      const infoBoxY = yPos;
                      drawBox(margin, yPos, maxWidth, 70, colorFondoOscuro, colorAzul);
                      
                      pdf.setTextColor(colorVerde[0], colorVerde[1], colorVerde[2]);
                      pdf.setFontSize(16);
                      pdf.setFont('helvetica', 'bold');
                      pdf.text('Información General', margin + 8, yPos + 10);
                      drawLine(margin + 8, yPos + 12, maxWidth - 16, colorVerde, 1);
                      
                      yPos += 18;
                      pdf.setTextColor(colorTexto[0], colorTexto[1], colorTexto[2]);
                      pdf.setFontSize(10);
                      pdf.setFont('helvetica', 'normal');
                      
                      const infoItems = [
                        { label: 'Calorías diarias', value: `${plan.calorias_diarias} kcal` },
                        { label: 'Proteínas', value: plan.macros.proteinas },
                        { label: 'Grasas', value: plan.macros.grasas },
                        { label: 'Carbohidratos', value: plan.macros.carbohidratos },
                      ];
                      
                      if (user.objetivo) {
                        infoItems.push({ label: 'Objetivo', value: getObjetivoTexto(user.objetivo) });
                      }
                      if (user.intensidad) {
                        infoItems.push({ label: 'Intensidad', value: getIntensidadTexto(user.intensidad) });
                      }
                      if (user.tipoDieta) {
                        infoItems.push({ label: 'Dieta', value: getDietaTexto(user.tipoDieta) });
                      }
                      
                      // Layout de dos columnas para información
                      const colWidth = maxWidth / 2 - 5;
                      infoItems.forEach((item, idx) => {
                        const col = idx % 2;
                        const x = margin + 8 + (col * (colWidth + 10));
                        const lineY = yPos + (Math.floor(idx / 2) * 8);
                        
                        pdf.setTextColor(colorSubtitulo[0], colorSubtitulo[1], colorSubtitulo[2]);
                        pdf.text(`${item.label}:`, x, lineY);
                        pdf.setTextColor(colorTexto[0], colorTexto[1], colorTexto[2]);
                        pdf.setFont('helvetica', 'bold');
                        pdf.text(item.value, x + 35, lineY);
                        pdf.setFont('helvetica', 'normal');
                      });
                      
                      yPos = infoBoxY + 75;
                      checkNewPage(10);
                      
                      // Plan Semanal
                      pdf.setTextColor(colorVerde[0], colorVerde[1], colorVerde[2]);
                      pdf.setFontSize(18);
                      pdf.setFont('helvetica', 'bold');
                      pdf.text('Plan Semanal', margin, yPos);
                      drawLine(margin, yPos + 3, maxWidth, colorVerde, 1.5);
                      yPos += 12;
                      
                      plan.plan_semanal.forEach((dia) => {
                        checkNewPage(30);
                        
                        // Caja para cada día
                        const azulMuyClaro: [number, number, number] = [147, 197, 253]; // blue-300 para fondo
                        drawBox(margin, yPos, maxWidth, 25, azulMuyClaro, colorAzul);
                        
                        pdf.setTextColor(colorAzul[0], colorAzul[1], colorAzul[2]);
                        pdf.setFontSize(14);
                        pdf.setFont('helvetica', 'bold');
                        pdf.text(dia.dia, margin + 8, yPos + 8);
                        
                        yPos += 30;
                        
                        // Ordenar comidas
                        const ordenComidas = ['Desayuno', 'Almuerzo', 'Snack', 'Merienda', 'Cena'];
                        const comidasOrdenadas = [...dia.comidas].sort((a, b) => {
                          const nombreA = (a.nombre || '').trim();
                          const nombreB = (b.nombre || '').trim();
                          const indexA = ordenComidas.findIndex(o => nombreA === o);
                          const indexB = ordenComidas.findIndex(o => nombreB === o);
                          if (indexA === -1 && indexB === -1) {
                            return (a.hora || '00:00').localeCompare(b.hora || '00:00');
                          }
                          if (indexA === -1) return 999;
                          if (indexB === -1) return -999;
                          return indexA - indexB;
                        });
                        
                        comidasOrdenadas.forEach((comida) => {
                          checkNewPage(25);
                          
                          // Caja pequeña para cada comida
                          drawBox(margin + 5, yPos, maxWidth - 10, 20, colorFondoOscuro, colorCyan);
                          
                          // Hora y nombre
                          pdf.setTextColor(colorCyan[0], colorCyan[1], colorCyan[2]);
                          pdf.setFontSize(10);
                          pdf.setFont('helvetica', 'bold');
                          pdf.text(`${comida.hora}`, margin + 10, yPos + 7);
                          
                          pdf.setTextColor(colorTexto[0], colorTexto[1], colorTexto[2]);
                          pdf.text(comida.nombre, margin + 30, yPos + 7);
                          
                          // Opciones principales
                          yPos += 12;
                          pdf.setFontSize(9);
                          pdf.setFont('helvetica', 'normal');
                          pdf.setTextColor(colorSubtitulo[0], colorSubtitulo[1], colorSubtitulo[2]);
                          const opcionesTexto = comida.opciones.slice(0, 2).join(' • ');
                          const opcionesLines = pdf.splitTextToSize(opcionesTexto, maxWidth - 25);
                          pdf.text(opcionesLines, margin + 10, yPos);
                          yPos += opcionesLines.length * 4 + 2;
                          
                          // Info nutricional si está disponible
                          if (comida.calorias_kcal || comida.cantidad_gramos) {
                            const info = [];
                            if (comida.calorias_kcal) info.push(`${comida.calorias_kcal} kcal`);
                            if (comida.cantidad_gramos) info.push(`${comida.cantidad_gramos} g`);
                            pdf.setTextColor(colorVerde[0], colorVerde[1], colorVerde[2]);
                            pdf.setFontSize(8);
                            pdf.text(info.join(' • '), margin + 10, yPos);
                            yPos += 4;
                          }
                          
                          yPos += 3;
                        });
                        
                        yPos += 5;
                      });
                      
                      // Lista de compras
                      if (plan.lista_compras && plan.lista_compras.length > 0) {
                        checkNewPage(40);
                        
                        pdf.setTextColor(colorVerde[0], colorVerde[1], colorVerde[2]);
                        pdf.setFontSize(18);
                        pdf.setFont('helvetica', 'bold');
                        pdf.text('Lista de Compras', margin, yPos);
                        drawLine(margin, yPos + 3, maxWidth, colorVerde, 1.5);
                        yPos += 12;
                        
                        // Caja para lista
                        const listaLength = plan.lista_compras?.length || 0;
                        const listaHeight = Math.min(listaLength * 6 + 10, pageHeight - yPos - 30);
                        drawBox(margin, yPos, maxWidth, listaHeight, colorFondoOscuro, colorVerde);
                        
                        yPos += 8;
                        plan.lista_compras.forEach((item, idx) => {
                          if (yPos > pageHeight - 30) {
                            pdf.addPage();
                            drawDarkBackground();
                            yPos = 30;
                            const remainingHeight = Math.min((listaLength - idx) * 6 + 10, pageHeight - yPos - 20);
                            drawBox(margin, yPos - 8, maxWidth, remainingHeight, colorFondoOscuro, colorVerde);
                            yPos += 8;
                          }
                          pdf.setTextColor(colorTexto[0], colorTexto[1], colorTexto[2]);
                          pdf.setFontSize(10);
                          pdf.setFont('helvetica', 'normal');
                          pdf.text(`• ${item}`, margin + 8, yPos);
                          yPos += 6;
                        });
                        yPos += 5;
                      }
                      
                      // Mensaje motivacional
                      if (plan.mensaje_motivacional) {
                        checkNewPage(40);
                        
                        // Caja destacada para mensaje
                        const verdeClaro: [number, number, number] = [110, 231, 183]; // emerald-300 para fondo
                        drawBox(margin, yPos, maxWidth, 30, verdeClaro, colorVerde);
                        
                        pdf.setTextColor(colorVerde[0], colorVerde[1], colorVerde[2]);
                        pdf.setFontSize(11);
                        pdf.setFont('helvetica', 'italic');
                        const mensajeLines = pdf.splitTextToSize(plan.mensaje_motivacional, maxWidth - 16);
                        pdf.text(mensajeLines, margin + 8, yPos + 10);
                        yPos += mensajeLines.length * 5 + 15;
                      }
                      
                      // Footer
                      const footerY = pageHeight - 15;
                      pdf.setTextColor(colorSubtitulo[0], colorSubtitulo[1], colorSubtitulo[2]);
                      pdf.setFontSize(8);
                      pdf.setFont('helvetica', 'normal');
                      pdf.text('Generado con FitPlan AI', pageWidth / 2, footerY, { align: 'center' });
                      
                      const nombreArchivo = user?.nombre ? `Plan_${user.nombre}_${new Date().toISOString().split('T')[0]}.pdf` : `Plan_${new Date().toISOString().split('T')[0]}.pdf`;
                      pdf.save(nombreArchivo);
                    } catch (error) {
                      console.error('Error al generar PDF:', error);
                      alert('Error al generar el PDF. Por favor, intenta de nuevo.');
                    } finally {
                      setGuardandoPDF(false);
                    }
                  }}
                  disabled={guardandoPDF || !isPremium}
                >
                  {guardandoPDF ? '⏳ Guardando...' : '💾 Guardar PDF'}
                </button>
                {!isPremium && (
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gradient-to-r from-yellow-500/95 to-orange-500/95 text-white text-xs font-medium rounded-lg shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 border border-yellow-400/50">
                    💳 Requiere Premium para guardar el PDF
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                      <div className="w-2 h-2 bg-gradient-to-r from-yellow-500 to-orange-500 rotate-45 border-r border-b border-yellow-400/50"></div>
                    </div>
                  </div>
                )}
                </div>
                
                {/* Botón Generar Siguiente Mes - Solo para planes multi-fase */}
                {/* Botón secundario para generar siguiente mes (solo si no hay banner activo) - Oculto cuando el banner al 90-100% está visible */}
                
                {!isPremium && (
                  <button
                    className="rounded-xl px-4 py-2 text-sm font-medium bg-blue-500/20 border border-blue-500/30 hover:bg-blue-500/30 transition-colors"
                    onClick={() => {
                      if (!authUser) {
                        alert("Debes estar registrado para acceder al plan Premium");
                        return;
                      }
                      setPremiumModalOpen(true);
                    }}
                  >
                    🌟 Ser premium
                  </button>
                )}
              </div>
            </div>
            {user?.nombre ? (
              <p className="text-sm opacity-80">Hola {user.nombre}, este es tu plan personalizado.</p>
            ) : null}
            {user && (
              <div className="flex flex-wrap items-center gap-3 mt-2">
                {/* Objetivo - Solo lectura */}
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
                  <span className="text-xs opacity-70 whitespace-nowrap flex-shrink-0">Objetivo:</span>
                  <span className="text-sm font-medium text-white whitespace-nowrap max-w-[150px] md:max-w-none truncate">
                    {getObjetivoTexto(user.objetivo)}
                  </span>
                      </div>
                {/* Intensidad - Solo lectura */}
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
                  <span className="text-xs opacity-70 whitespace-nowrap">Intensidad:</span>
                  <span className="text-sm font-medium text-white capitalize">
                    {getIntensidadTexto(user.intensidad)}
                    </span>
                        </div>
                {/* Dieta - Solo lectura */}
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
                    <span className="text-xs opacity-70 whitespace-nowrap">Dieta:</span>
                  <span className="text-sm font-medium text-white">
                    {getDietaTexto(user.tipoDieta)}
                  </span>
                </div>
                {plan?.dificultad && (
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors w-fit"
                    style={{
                      backgroundColor: 'rgba(255,255,255,0.05)',
                      borderColor: plan.dificultad === 'dificil' ? 'rgba(248,113,113,0.4)' : plan.dificultad === 'media' ? 'rgba(250,204,21,0.4)' : 'rgba(52,211,153,0.4)'
                    }}
                  >
                    <span className="text-xs opacity-70 whitespace-nowrap">Dificultad:</span>
                    <span className="text-sm font-medium capitalize"
                      style={{
                        color: plan.dificultad === 'dificil' ? '#fecaca' : plan.dificultad === 'media' ? '#fde68a' : '#a7f3d0'
                      }}
                    >
                      {plan.dificultad}
                    </span>
                  </div>
                )}
                {hayCambios && (
                  <button
                    onClick={regenerarPlan}
                    disabled={regenerandoPlan}
                    className="inline-flex px-4 py-1.5 rounded-lg bg-blue-500/20 border border-blue-500/30 hover:bg-blue-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium whitespace-nowrap"
                  >
                    {regenerandoPlan ? "Regenerando..." : "🔄 Regenerar plan"}
                  </button>
                )}
                {errorRegeneracion && (
                  <div className="text-xs text-red-400 mt-1 w-full">{errorRegeneracion}</div>
                )}
              </div>
            )}
          </div>

          {/* Primera fila: Peso - Calorías - IMC */}
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-black/30 p-4">
              <p className="text-sm opacity-70">Peso actual</p>
              <p className="text-2xl font-bold">{user?.pesoKg || 0} kg</p>
              {user?.alturaCm ? (
                <div className="mt-2 space-y-1">
                  <p className="text-xs opacity-75">Altura: {user.alturaCm} cm</p>
                </div>
              ) : null}
            </div>
            <div className="rounded-xl border border-white/10 bg-black/30 p-4">
              <p className="text-sm opacity-70">Calorías diarias</p>
              <p className="text-2xl font-bold">{plan.calorias_diarias} kcal</p>
              {tdee > 0 ? (
                <div className="mt-2 space-y-1">
                  <p className="text-xs opacity-75">Mantenimiento: {tdee} kcal</p>
                  {Math.abs(deficitSuperavit) > 50 ? (
                    <p className={`text-xs font-medium ${deficitSuperavit < 0 ? "text-green-400" : "text-orange-400"}`}>
                      {deficitSuperavit < 0 ? `Déficit: ${Math.abs(deficitSuperavit)} kcal/día` : `Superávit: +${deficitSuperavit} kcal/día`}
                    </p>
                  ) : (
                    <p className="text-xs opacity-75">Equilibrio calórico</p>
                  )}
            </div>
              ) : null}
            </div>
            <div className="rounded-xl border border-white/10 bg-black/30 p-4 relative overflow-visible">
              <p className="flex items-center gap-2 text-sm opacity-70">
                IMC estimado
                <button
                  type="button"
                  onClick={() => setModalInfoAbierto('imc')}
                  className="inline-flex items-center cursor-pointer hover:opacity-100 transition-opacity"
                  aria-label="¿Qué es el IMC?"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="h-4 w-4 opacity-90"
                  >
                    <path d="M12 2a10 10 0 1 0 10 10A10.011 10.011 0 0 0 12 2Zm.75 15h-1.5v-1.5h1.5Zm1.971-6.279-.675.693A3.375 3.375 0 0 0 12.75 14.25h-1.5a4.875 4.875 0 0 1 1.425-3.45l.93-.936a1.875 1.875 0 1 0-3.195-1.326h-1.5a3.375 3.375 0 1 1 6.03 1.283Z" />
                  </svg>
                </button>
              </p>
              <p className="text-2xl font-bold">{bmi.toFixed(1) || "-"}</p>
              <p className="text-sm opacity-80">Según tu altura y peso: {bmi ? bmiText : "completa tus datos"}</p>
              {/* Indicador visual Mal → Excelente */}
              <div className="mt-3">
                <div className="flex items-center justify-between text-[10px] uppercase tracking-wide opacity-70">
                  <span>Bajo peso</span>
                  <span>Obesidad</span>
            </div>
                <div className="relative mt-2 h-2 w-full rounded-full"
                  style={{
                    background: bmiGradient,
                  }}
                >
                  {/* Resaltado del rango de tu categoría */}
                  <div
                    className="absolute top-0 h-2 rounded-full"
                    style={{
                      left: `${activeRangeStart}%`,
                      width: `${Math.max(activeRangeEnd - activeRangeStart, 2)}%`,
                      background: activeRangeColor + '66',
                    }}
                    aria-hidden
                  />
                  {/* Marcador */}
                  <div
                    className="absolute -top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white shadow-md"
                    style={{ left: `${bmiPct}%`, transform: "translateX(-50%)", background: activeRangeColor }}
                    aria-label="Indicador de estado IMC"
                  />
                  {/* Marcas */}
                  <div className="absolute -bottom-1 left-0 right-0">
                    <div className="relative h-2 w-full">
                      <span className="absolute h-2 w-px bg-white/50" style={{ left: `${p18}%` }} />
                      <span className="absolute h-2 w-px bg-white/50" style={{ left: `${p25}%` }} />
                      <span className="absolute h-2 w-px bg-white/50" style={{ left: `${p30}%` }} />
              </div>
            </div>
          </div>
                {bmi ? (
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className="opacity-75">Tu estado actual:</span>
                    <span
                      className="rounded-full px-3 py-1 text-white"
                      style={{ background: bmiBadgeColor() }}
                    >
                      {bmiText}
                    </span>
                  </div>
                ) : null}
              </div>
            </div>
            {/* Composición opcional */}
            {(user?.cinturaCm && user?.cuelloCm) ? (
              <div className="rounded-xl border border-white/10 p-4 md:col-span-2">
                <p className="text-sm opacity-70">Composición estimada (opcional)</p>
                {(() => {
                  const bf = calculateBodyFatUSNavy(user!.sexo, user!.alturaCm, user!.cuelloCm, user!.cinturaCm, user!.caderaCm);
                  const bfCat = bodyFatCategory(user!.sexo, bf, user!.atletico);
                  const whtr = waistToHeightRatio(user!.cinturaCm, user!.alturaCm);
                  const whtrCat = whtrCategory(whtr ?? undefined);
                  return (
                    <div className="mt-1 text-sm">
                      {bf != null ? (
                        <p className="opacity-90">Grasa corporal estimada: {bf}% {bfCat ? `· ${bfCat}` : ""}</p>
                      ) : (
                        <p className="opacity-70">Completá medidas para estimar % de grasa.</p>
                      )}
                      {whtr != null ? (
                        <p className="opacity-90">Relación cintura/altura: {whtr} {whtrCat ? `· ${whtrCat}` : ""}</p>
                      ) : null}
                      <p className="mt-1 text-xs opacity-70">Estas estimaciones son orientativas y no reemplazan evaluación clínica.</p>
                    </div>
                  );
                })()}
              </div>
            ) : null}
          </div>

          {/* Segunda fila: Progreso del plan - Información personal - Distribución de macros */}
          <div className="mt-6 flex flex-col gap-4 md:flex-row">
            {/* Cuadro de progreso del plan */}
            <div className="rounded-xl border border-white/10 bg-black/30 p-4 md:w-1/4">
              <p className="text-sm font-medium opacity-70 mb-3">Progreso del plan</p>
                  <div className="space-y-3">
                <div>
                  <p className="text-xs opacity-70 mb-1">Fecha de inicio:</p>
                  <p className="text-sm font-medium">
                    {fechaInicioPlan.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                        </div>
                {plan?.dificultad && (
                  <div>
                    <p className="text-xs opacity-70 mb-1 flex items-center gap-2">
                      Dificultad del plan
                      <button
                        type="button"
                        onClick={() => setModalInfoAbierto('dificultad')}
                        className="inline-flex items-center cursor-pointer hover:opacity-100 transition-opacity"
                        aria-label="¿Qué implica esta dificultad?"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          className="h-4 w-4 opacity-90"
                        >
                          <path d="M12 2a10 10 0 1 0 10 10A10.011 10.011 0 0 0 12 2Zm.75 15h-1.5v-1.5h1.5Zm1.971-6.279-.675.693A3.375 3.375 0 0 0 12.75 14.25h-1.5a4.875 4.875 0 0 1 1.425-3.45l.93-.936a1.875 1.875 0 1 0-3.195-1.326h-1.5a3.375 3.375 0 1 1 6.03 1.283Z" />
                        </svg>
                      </button>
                    </p>
                    <div
                      className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md border"
                      style={{
                        backgroundColor: 'rgba(255,255,255,0.05)',
                        borderColor: plan.dificultad === 'dificil' ? 'rgba(248,113,113,0.4)' : plan.dificultad === 'media' ? 'rgba(250,204,21,0.4)' : 'rgba(52,211,153,0.4)'
                      }}
                    >
                      <span
                        className="text-xs font-medium capitalize"
                        style={{
                          color: plan.dificultad === 'dificil' ? '#fecaca' : plan.dificultad === 'media' ? '#fde68a' : '#a7f3d0'
                        }}
                      >
                        {plan.dificultad}
                      </span>
                      </div>
                  </div>
                )}
                <div>
                  <p className="text-xs opacity-70 mb-1">Progreso:</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full transition-all duration-300"
                        style={{ width: `${progresoPlan.porcentaje}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium">
                      {Math.round(progresoPlan.porcentaje)}%
                    </span>
                  </div>
                  <p className="text-xs opacity-60 mt-1">
                    {progresoPlan.diasTranscurridos} / {plan?.duracion_plan_dias || 30} días
                  </p>
                </div>
              </div>
            </div>
            {/* Información personal */}
            <div className="rounded-xl border border-white/10 bg-black/30 p-4 md:w-1/4">
              <p className="text-sm font-medium opacity-70 mb-3 flex items-center gap-2">
                Información personal
                {user?.doloresLesiones && user.doloresLesiones.filter((s: string) => typeof s === "string" && s.trim().length > 0).length > 0 && (
                  <div className="relative group">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="h-4 w-4 opacity-80 text-cyan-200"
                    >
                      <path d="M12 2a10 10 0 1 0 10 10A10.011 10.011 0 0 0 12 2Zm.75 15h-1.5v-1.5h1.5Zm1.971-6.279-.675.693A3.375 3.375 0 0 0 12.75 14.25h-1.5a4.875 4.875 0 0 1 1.425-3.45l.93-.936a1.875 1.875 0 1 0-3.195-1.326h-1.5a3.375 3.375 0 1 1 6.03 1.283Z" />
                    </svg>
                    <div className="pointer-events-none absolute left-1/2 top-full z-40 mt-2 w-56 -translate-x-1/2 rounded-lg border border-cyan-500/40 bg-black/90 px-3 py-2 text-xs text-cyan-50 opacity-0 shadow-lg transition-opacity duration-200 group-hover:opacity-100">
                      Entrenamiento y recuperación moderados para:{" "}
                      <span className="font-medium">
                        {user.doloresLesiones.filter((s: string) => typeof s === "string" && s.trim().length > 0).join(", ")}
                      </span>
                    </div>
                  </div>
                )}
              </p>
                  <div className="space-y-3">
                {user?.preferencias && user.preferencias.filter((s: string) => typeof s === 'string' && s.trim().length > 0).length > 0 && (
                  <div>
                    <p className="text-xs font-medium opacity-70 mb-1">Preferencias:</p>
                    <div className="flex flex-wrap gap-1">
                      {user.preferencias.filter((s: string) => typeof s === 'string' && s.trim().length > 0).map((pref: string, idx: number) => (
                        <span key={`pref-${idx}-${pref}`} className="inline-flex items-center rounded-full px-2 py-0.5 text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          {pref}
                        </span>
                    ))}
                  </div>
                      </div>
                )}
                {user?.restricciones && user.restricciones.filter((s: string) => typeof s === 'string' && s.trim().length > 0).length > 0 && (
                  <div>
                    <p className="text-xs font-medium opacity-70 mb-1">Restricciones:</p>
                    <div className="flex flex-wrap gap-1">
                      {user.restricciones.filter((s: string) => typeof s === 'string' && s.trim().length > 0).map((restr: string, idx: number) => (
                        <span key={`restr-${idx}-${restr}`} className="inline-flex items-center rounded-full px-2 py-0.5 text-xs bg-orange-500/20 text-orange-300 border border-orange-500/30">
                          {restr}
                        </span>
                    ))}
                  </div>
                  </div>
                )}
                {user?.patologias && user.patologias.filter((s: string) => typeof s === 'string' && s.trim().length > 0).length > 0 && (
                  <div>
                    <p className="text-xs font-medium opacity-70 mb-1">Patologías:</p>
                    <div className="flex flex-wrap gap-1">
                      {user.patologias.filter((s: string) => typeof s === 'string' && s.trim().length > 0).map((pat: string, idx: number) => (
                        <span key={`pat-${idx}-${pat}`} className="inline-flex items-center rounded-full px-2 py-0.5 text-xs bg-red-500/20 text-red-300 border border-red-500/30">
                          {pat}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {user?.doloresLesiones && user.doloresLesiones.filter((s: string) => typeof s === 'string' && s.trim().length > 0).length > 0 && (
                  <div>
                    <p className="text-xs font-medium opacity-70 mb-1">Dolores / Lesiones:</p>
                    <div className="flex flex-wrap gap-1">
                      {user.doloresLesiones.filter((s: string) => typeof s === 'string' && s.trim().length > 0).map((dolor: string, idx: number) => (
                        <span key={`dolor-${idx}-${dolor}`} className="inline-flex items-center rounded-full px-2 py-0.5 text-xs bg-cyan-500/20 text-cyan-200 border border-cyan-500/30">
                          {dolor}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {(!user?.preferencias || user.preferencias.length === 0) && 
                 (!user?.restricciones || user.restricciones.length === 0) && 
                 (!user?.patologias || user.patologias.length === 0) &&
                 (!user?.doloresLesiones || user.doloresLesiones.length === 0) && (
                  <p className="text-xs opacity-60">No hay preferencias, restricciones, patologías ni lesiones registradas</p>
                )}
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/30 p-4 md:w-1/2 self-start relative overflow-visible">
              <p className="flex items-center gap-2 text-sm opacity-70">
                Distribución de macronutrientes
                <button
                  type="button"
                  onClick={() => setModalInfoAbierto('macros')}
                  className="inline-flex items-center cursor-pointer hover:opacity-100 transition-opacity"
                  aria-label="¿Qué son los macronutrientes?"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="h-4 w-4 opacity-90"
                  >
                    <path d="M12 2a10 10 0 1 0 10 10A10.011 10.011 0 0 0 12 2Zm.75 15h-1.5v-1.5h1.5Zm1.971-6.279-.675.693A3.375 3.375 0 0 0 12.75 14.25h-1.5a4.875 4.875 0 0 1 1.425-3.45l.93-.936a1.875 1.875 0 1 0-3.195-1.326h-1.5a3.375 3.375 0 1 1 6.03 1.283Z" />
                  </svg>
                </button>
              </p>
              <p className="mt-1 text-sm">Proteínas: {plan.macros.proteinas}</p>
              <p className="text-sm">Grasas: {plan.macros.grasas}</p>
              <p className="text-sm">Carbohidratos: {plan.macros.carbohidratos}</p>
              {distrib ? (
                <div className="mt-2 text-xs opacity-75">
                  <p>
                    Distribución diaria: Desayuno {distrib.desayuno || 0}% · Almuerzo {distrib.almuerzo || 0}% · Snacks {snackCalculado}% · Cena {distrib.cena || 0}%
                  </p>
                </div>
              ) : null}
            </div>
          </div>

          <p className="mt-4 text-sm opacity-80">{String((plan as unknown as Record<string, unknown>)?.mensaje_motivacional || '')}</p>

          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {(renderRecomendacionesEntrenamiento() as any)}

          {/* Selector de vista (Entrenamiento/Alimentación) - Centrado */}
          <div className="mt-6 flex items-center justify-center gap-3">
            <div className="relative group">
            <button
                type="button"
              onClick={() => {
                  if (isPremium) {
                    setVistaPlan('entrenamiento');
                  }
                }}
                disabled={!isPremium}
                className={`px-4 py-2.5 text-sm font-medium rounded-lg border transition-colors relative ${
                  !isPremium 
                    ? 'bg-white/5 border-white/10 text-white/40 cursor-not-allowed opacity-50' 
                    : vistaPlan === 'entrenamiento' 
                      ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300' 
                      : 'bg-white/5 border-white/10 text-white/80 hover:bg-white/10'
                }`}
              >
                🏋️ Ver entrenamiento
                {!isPremium && (
                  <span className="ml-1.5 text-xs">🌟</span>
                )}
            </button>
              {!isPremium && (
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gradient-to-r from-yellow-500/95 to-orange-500/95 text-white text-xs font-medium rounded-lg shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 border border-yellow-400/50">
                  💳 Requiere Premium para ver el contenido
                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                    <div className="w-2 h-2 bg-gradient-to-r from-yellow-500 to-orange-500 rotate-45 border-r border-b border-yellow-400/50"></div>
                  </div>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setVistaPlan('alimentacion')}
              className={`px-4 py-2.5 text-sm font-medium rounded-lg border transition-colors ${vistaPlan === 'alimentacion' ? 'bg-cyan-500/20 border-cyan-500/30 text-cyan-300' : 'bg-white/5 border-white/10 text-white/80 hover:bg-white/10'}`}
            >
              🍽️ Ver alimentación
            </button>
          </div>

          {/* Calendario de entrenamiento */}
          {vistaPlan === 'entrenamiento' && isPremium && (plan as unknown as Record<string, unknown>)?.training_plan && (
            <div className="mt-6">
              <TrainingCalendar
                trainingPlan={(plan as unknown as Record<string, unknown>)?.training_plan as TrainingPlan}
                planStartDate={fechaInicioPlan}
                planDurationDays={plan?.duracion_plan_dias || 30}
                onDaySelect={(date, dayData, week, dayIndex) => {
                  // Prevenir procesamiento duplicado
                  if (processingSelectionRef.current) {
                    console.warn("🚫 Ya se está procesando una selección, omitiendo");
                    return;
                  }
                  
                  // Prevenir selecciones duplicadas del mismo día
                  const dateKey = date.toISOString().split('T')[0];
                  if (lastSelectedDateRef.current === dateKey && selectedDayData) {
                    console.warn("🚫 Este día ya está seleccionado, omitiendo");
                    return;
                  }
                  
                  // Prevenir llamadas duplicadas
                  const dayKey = `w${week}-d${dayIndex}`;
                  if (isLoadingDayRef.current || loadingProgressRef.current === dayKey) {
                    console.warn("🚫 Ya se está cargando este día, omitiendo");
                    return;
                  }
                  
                  // Marcar que estamos procesando
                  processingSelectionRef.current = true;
                  lastSelectedDateRef.current = dateKey;
                  
                  // Limpiar y establecer estados
                  setSelectedDayProgress({});
                  setSelectedTrainingDate(date);
                  
                  if (dayData && dayData.ejercicios && dayData.ejercicios.length > 0) {
                    // IMPORTANTE: Establecer selectedDayData PRIMERO para prevenir que el useEffect problemático se ejecute
                    setSelectedDayData({ day: dayData, week, dayIndex });
                    
                    // Usar setTimeout para asegurar que selectedDayData se establezca antes de abrir el modal
                    setTimeout(() => {
                      // Verificar cache primero antes de cargar
                      const dayKey = `w${week}-d${dayIndex}`;
                      const cachedProgress = dayProgressCache.current.get(dayKey);
                      
                      if (cachedProgress) {
                        // Usar cache, no cargar
                        setSelectedDayProgress(cachedProgress);
                        setLoadingSelectedDay(false);
                        processingSelectionRef.current = false;
                      } else if (authUser && planId) {
                        // Solo cargar si no está en cache
                        setLoadingSelectedDay(true);
                        loadExerciseProgressForDay(week, dayIndex, dayData).finally(() => {
                          processingSelectionRef.current = false;
                        });
                      } else {
                        setLoadingSelectedDay(false);
                        processingSelectionRef.current = false;
                      }
                      
                      // Abrir el modal DESPUÉS de establecer selectedDayData
                      setModalEntrenamientoAbierto(true);
                    }, 0);
                  } else {
                    setSelectedDayData(null);
                    setSelectedDayProgress({});
                    setLoadingSelectedDay(false);
                    processingSelectionRef.current = false;
                    setModalEntrenamientoAbierto(true);
                  }
                }}
                selectedDate={selectedTrainingDate}
              />
            </div>
          )}

          {/* Vista: Alimentación (resumen semanal) */}
          {vistaPlan === 'alimentacion' && plan?.plan_semanal && (
            <div className="mt-6 rounded-xl border border-white/10 p-4 bg-black/30">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
                <h2 className="text-lg font-semibold">🍽️ Plan de Alimentación (vista rápida)</h2>
                {/* Botones de seguimiento - Alineados a la derecha del título */}
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="relative group">
                    <button
              onClick={() => {
                        if (isPremium) {
                          setWeeklyStatsModalOpen(true);
                        }
                      }}
                      disabled={!isPremium}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all text-xs font-medium ${
                        !isPremium
                          ? 'bg-white/5 border-white/10 text-white/40 cursor-not-allowed opacity-50'
                          : 'bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border-blue-500/30 text-blue-300 hover:from-blue-500/30 hover:to-cyan-500/30'
                      }`}
                    >
                      <FaChartLine className="h-3.5 w-3.5" />
                      Ver estadísticas semanales
                      {!isPremium && (
                        <span className="ml-1 text-xs">🌟</span>
                      )}
            </button>
                    {!isPremium && (
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gradient-to-r from-yellow-500/95 to-orange-500/95 text-white text-xs font-medium rounded-lg shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 border border-yellow-400/50">
                        💳 Requiere Premium
                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                          <div className="w-2 h-2 bg-gradient-to-r from-yellow-500 to-orange-500 rotate-45 border-r border-b border-yellow-400/50"></div>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="relative group">
            <button
              onClick={() => {
                        if (isPremium) {
                          setFoodTrackingModalOpen(true);
                        }
                      }}
                      disabled={!isPremium}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all text-xs font-medium ${
                        !isPremium
                          ? 'bg-white/5 border-white/10 text-white/40 cursor-not-allowed opacity-50'
                          : 'bg-gradient-to-r from-orange-500/20 to-pink-500/20 border-orange-500/30 text-orange-300 hover:from-orange-500/30 hover:to-pink-500/30'
                      }`}
                    >
                      <FaUtensils className="h-3.5 w-3.5" />
                      Registrar comida fuera del plan
                      {!isPremium && (
                        <span className="ml-1 text-xs">🌟</span>
                      )}
            </button>
                    {!isPremium && (
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gradient-to-r from-yellow-500/95 to-orange-500/95 text-white text-xs font-medium rounded-lg shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 border border-yellow-400/50">
                        💳 Requiere Premium
                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                          <div className="w-2 h-2 bg-gradient-to-r from-yellow-500 to-orange-500 rotate-45 border-r border-b border-yellow-400/50"></div>
          </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {plan.plan_semanal.map((dia, idx) => (
                  <div
                    key={`food-day-${idx}-${dia.dia}`}
                    className="relative rounded-lg border border-white/10 bg-white/5 p-3 group cursor-pointer"
                    onClick={() => setModalAlimentosAbierto({ diaIdx: idx })}
                  >
                    <p className="text-sm font-semibold mb-2">{dia.dia}</p>
                    <div className="space-y-1.5 text-sm">
                      {dia.comidas.map((c, ci) => (
                        <div key={`food-${idx}-${ci}`} className="flex items-start justify-between gap-2">
                          <span className="opacity-80 min-w-[84px]">{c.nombre}</span>
                          <span className="flex-1 text-right opacity-90">{Array.isArray(c.opciones) && c.opciones.length > 0 && c.opciones[0] ? c.opciones[0] : 'Cargando opciones...'}</span>
                        </div>
                      ))}
                    </div>
                    <div className="pointer-events-none absolute inset-0 rounded-lg border border-transparent group-hover:border-cyan-400/40 transition-colors" />
                    <div className="pointer-events-none absolute bottom-2 right-2 text-[11px] px-2 py-1 rounded-md bg-cyan-500/20 text-cyan-200 border border-cyan-500/30 opacity-0 group-hover:opacity-100 transition-opacity">
                      Ver variantes
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Proyecciones motivacionales */}
          {proyecciones && (
            <div className="mt-6 rounded-xl border border-white/10 p-4 bg-gradient-to-br from-emerald-500/10 via-cyan-500/10 to-blue-500/10">
              <h2 className="text-lg font-semibold mb-3">🚀 Proyecciones y resultados esperados</h2>
              
              {(user?.objetivo === "ganar_masa" || user?.objetivo === "volumen" || user?.objetivo === "recomposicion") && proyecciones.musculoGananciaMensual && (
                <div className="mb-4 p-3 rounded-lg bg-white/5 border border-white/10">
                  <p className="text-sm font-medium opacity-90 mb-1">Ganancia de músculo por mes:</p>
                  <p className="text-3xl font-bold text-emerald-400">{proyecciones.musculoGananciaMensual}</p>
                  <p className="text-xs opacity-75 mt-1">Crecimiento muscular estimado con entrenamiento constante</p>
                </div>
              )}
              
              {(user?.objetivo === "perder_grasa" || user?.objetivo === "corte" || user?.objetivo === "definicion") && proyecciones.grasaPerdidaMensual && (
                <div className="mb-4 p-3 rounded-lg bg-white/5 border border-white/10">
                  <p className="text-sm font-medium opacity-90 mb-1">Pérdida de grasa por mes:</p>
                  <p className="text-3xl font-bold text-red-400">{proyecciones.grasaPerdidaMensual}</p>
                  <p className="text-xs opacity-75 mt-1">Reducción de grasa corporal estimada con dieta y entrenamiento constante</p>
                </div>
              )}
              
              <div className="space-y-2 mb-4">
                {proyecciones.proyecciones.map((proyeccion, idx) => (
                  <div key={`proj-${idx}-${proyeccion}`} className="flex items-start gap-2 text-sm opacity-90">
                    <span className="text-emerald-400 mt-0.5">✓</span>
                    <span className="leading-relaxed">{proyeccion}</span>
                  </div>
                ))}
              </div>
              
              <div className="mt-4 pt-4 border-t border-white/10">
                <p className="text-sm font-medium opacity-90">
                  <span className="text-emerald-400">⏱️ Tiempo estimado:</span> {proyecciones.tiempoEstimado}
                </p>
                <p className="text-xs opacity-75 mt-2">
                  * Estas proyecciones son estimaciones basadas en factores promedio. Los resultados individuales pueden variar según genética, adherencia al plan y consistencia.
                </p>
              </div>
            </div>
          )}

          {/* Sección de Suplementos - Solo para planes multi-fase */}
          {planMultiFase && planMultiFase.suplementosBase && planMultiFase.suplementosBase.length > 0 && (
            <div className="mt-8">
              <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
                💊 Suplementación Recomendada
                <span className={`px-2 py-0.5 text-xs rounded-lg ${
                  planMultiFase.faseActual === "BULK" 
                    ? "bg-amber-500/20 text-amber-300" 
                    : planMultiFase.faseActual === "CUT"
                    ? "bg-cyan-500/20 text-cyan-300"
                    : "bg-emerald-500/20 text-emerald-300"
                }`}>
                  Fase {planMultiFase.faseActual}
                </span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {planMultiFase.suplementosBase.map((sup, idx) => (
                  <div 
                    key={`sup-${idx}-${sup.nombre}`}
                    className={`rounded-xl border p-4 ${
                      sup.prioridad === "esencial" 
                        ? "bg-emerald-500/10 border-emerald-500/30" 
                        : sup.prioridad === "recomendado"
                        ? "bg-blue-500/10 border-blue-500/30"
                        : "bg-white/5 border-white/10"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-medium flex items-center gap-2">
                          {sup.nombre}
                          {sup.prioridad === "esencial" && (
                            <span className="px-1.5 py-0.5 text-xs bg-emerald-500/30 text-emerald-300 rounded">
                              Esencial
                            </span>
                          )}
                          {sup.prioridad === "recomendado" && (
                            <span className="px-1.5 py-0.5 text-xs bg-blue-500/30 text-blue-300 rounded">
                              Recomendado
                            </span>
                          )}
                          {sup.prioridad === "opcional" && (
                            <span className="px-1.5 py-0.5 text-xs bg-white/20 text-white/70 rounded">
                              Opcional
                            </span>
                          )}
                        </h3>
                        <p className="text-sm opacity-70 mt-1">{sup.motivo}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-3 mt-3 text-xs">
                      <span className="px-2 py-1 rounded-lg bg-white/10">
                        💪 {sup.dosis}
                      </span>
                      <span className="px-2 py-1 rounded-lg bg-white/10">
                        ⏰ {sup.momento === "mañana" ? "Por la mañana" : 
                           sup.momento === "pre-entreno" ? "Pre-entreno" :
                           sup.momento === "post-entreno" ? "Post-entreno" :
                           sup.momento === "noche" ? "Antes de dormir" : sup.momento}
                      </span>
                      {sup.duracion && (
                        <span className="px-2 py-1 rounded-lg bg-white/10">
                          📅 {sup.duracion}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs opacity-50 mt-3">
                * La suplementación es complementaria a una buena alimentación. Consulta con un profesional de la salud antes de comenzar cualquier régimen de suplementos.
              </p>
            </div>
          )}

          {plan.lista_compras?.length ? (
            <div className="mt-8">
              <h2 className="text-xl font-semibold mb-3">Lista de compras</h2>
              <div className="rounded-xl border border-white/10 p-4">
                <ul className="list-disc pl-5 text-sm opacity-90 columns-1 md:columns-2">
                  {plan.lista_compras.map((item, i) => (
                    <li key={`compras-${i}-${item}`}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}

          {plan.progresion_semanal?.length ? (
            <div className="mt-8">
              <h2 className="text-xl font-semibold mb-3">Progresión semanal</h2>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {plan.progresion_semanal.map((p, i) => (
                  <div key={`prog-${p.semana ?? i}-${i}`} className="rounded-xl border border-white/10 p-4">
                    <p className="text-sm opacity-70">Semana {p.semana}</p>
                    <p className="text-lg font-medium">Ajuste: {p.ajuste_calorias_pct}%</p>
                    {p.motivo ? <p className="mt-1 text-sm opacity-80">{p.motivo}</p> : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          
          {/* Sección de Historial y Progreso - Solo para planes multi-fase con historial */}
          {planMultiFase && planMultiFase.tipo !== "simple" && planMultiFase.historialMeses.length > 0 && (
            <div className="mt-8">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                📈 Historial y Progreso
                {planMultiFase.estado === "activo" && (
                  <span className="px-2 py-0.5 text-xs rounded-lg bg-emerald-500/20 text-emerald-300">
                    Plan Activo
                  </span>
                )}
              </h2>
              
              {/* Resumen de Progreso */}
              {(() => {
                const progreso = calcularProgresoTotal(planMultiFase);
                return (
                  <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-white/5 to-white/10 border border-white/10">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                      <div>
                        <p className="text-2xl font-bold text-emerald-400">
                          {progreso.mesesCompletados}/{planMultiFase.totalMeses}
                        </p>
                        <p className="text-xs opacity-70">Meses completados</p>
                      </div>
                      <div>
                        <p className={`text-2xl font-bold ${progreso.cambioNeto > 0 ? "text-amber-400" : progreso.cambioNeto < 0 ? "text-cyan-400" : "text-white"}`}>
                          {progreso.cambioNeto > 0 ? "+" : ""}{progreso.cambioNeto.toFixed(1)} kg
                        </p>
                        <p className="text-xs opacity-70">Cambio neto</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-blue-400">
                          {progreso.adherenciaPromedio.toFixed(0)}%
                        </p>
                        <p className="text-xs opacity-70">Adherencia promedio</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-purple-400">
                          {progreso.porcentajeCompletado.toFixed(0)}%
                        </p>
                        <p className="text-xs opacity-70">Progreso total</p>
                      </div>
                    </div>
                    
                    {/* Barra de progreso */}
                    <div className="mt-4">
                      <div className="flex justify-between text-xs opacity-70 mb-1">
                        <span>Inicio: {planMultiFase.datosIniciales.pesoInicial} kg</span>
                        <span>Meta: {planMultiFase.datosIniciales.pesoObjetivoFinal} kg</span>
                      </div>
                      <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                        {planMultiFase.fases.map((fase, idx) => (
                          <motion.div
                            key={`fase-prog-${idx}`}
                            initial={{ width: 0 }}
                            animate={{ 
                              width: `${(fase.mesesIncluidos.filter(m => m <= planMultiFase.mesActual).length / planMultiFase.totalMeses) * 100}%` 
                            }}
                            transition={{ duration: 1, ease: "easeOut", delay: idx * 0.2 }}
                            className={`h-full inline-block ${
                              fase.nombre === "BULK" 
                                ? "bg-gradient-to-r from-amber-500 to-orange-500" 
                                : fase.nombre === "CUT"
                                ? "bg-gradient-to-r from-cyan-500 to-blue-500"
                                : fase.nombre === "LEAN_BULK"
                                ? "bg-gradient-to-r from-emerald-500 to-teal-500"
                                : "bg-gradient-to-r from-purple-500 to-pink-500"
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()}
              
              {/* Lista de Meses del Historial */}
              <div className="space-y-3">
                {planMultiFase.historialMeses.slice().reverse().map((mes, idx) => {
                  const esActual = mes.mesNumero === planMultiFase.mesActual;
                  const completado = !!mes.datosAlFinalizar;
                  
                  return (
                    <motion.div
                      key={`historial-mes-${mes.mesNumero}`}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      className={`p-4 rounded-xl border ${
                        esActual 
                          ? "bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-blue-500/30" 
                          : completado
                          ? "bg-white/5 border-white/10"
                          : "bg-white/3 border-white/5 opacity-70"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                            esActual 
                              ? "bg-blue-500/30 text-blue-200" 
                              : completado
                              ? "bg-emerald-500/30 text-emerald-200"
                              : "bg-white/10 text-white/50"
                          }`}>
                            {esActual ? "📍" : completado ? "✓" : mes.mesNumero}
                          </div>
                          <div>
                            <p className="font-medium flex items-center gap-2">
                              Mes {mes.mesNumero}
                              <span className={`px-2 py-0.5 text-xs rounded ${
                                mes.faseEnEsteMes === "BULK" 
                                  ? "bg-amber-500/20 text-amber-300" 
                                  : mes.faseEnEsteMes === "CUT"
                                  ? "bg-cyan-500/20 text-cyan-300"
                                  : "bg-emerald-500/20 text-emerald-300"
                              }`}>
                                {mes.faseEnEsteMes}
                              </span>
                              {esActual && (
                                <span className="px-2 py-0.5 text-xs rounded bg-blue-500/20 text-blue-300">
                                  Actual
                                </span>
                              )}
                            </p>
                            <p className="text-xs opacity-60">
                              {new Date(mes.fechaGeneracion).toLocaleDateString('es-AR', { 
                                day: 'numeric', 
                                month: 'short', 
                                year: 'numeric' 
                              })}
                              {mes.fechaFin && ` - ${new Date(mes.fechaFin).toLocaleDateString('es-AR', { 
                                day: 'numeric', 
                                month: 'short'
                              })}`}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-4 text-sm">
                          <div className="text-center">
                            <p className="font-medium">{mes.datosAlIniciar.peso} kg</p>
                            <p className="text-xs opacity-50">Inicio</p>
                          </div>
                          {mes.datosAlFinalizar && (
                            <>
                              <div className="text-white/30">→</div>
                              <div className="text-center">
                                <p className={`font-medium ${
                                  mes.datosAlFinalizar.peso > mes.datosAlIniciar.peso 
                                    ? "text-amber-400" 
                                    : mes.datosAlFinalizar.peso < mes.datosAlIniciar.peso
                                    ? "text-cyan-400"
                                    : "text-white"
                                }`}>
                                  {mes.datosAlFinalizar.peso} kg
                                  <span className="text-xs ml-1 opacity-70">
                                    ({mes.datosAlFinalizar.peso > mes.datosAlIniciar.peso ? "+" : ""}
                                    {(mes.datosAlFinalizar.peso - mes.datosAlIniciar.peso).toFixed(1)})
                                  </span>
                                </p>
                                <p className="text-xs opacity-50">Fin</p>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                      
                      {/* Detalles adicionales si el mes está completado */}
                      {mes.datosAlFinalizar && (
                        <div className="mt-3 pt-3 border-t border-white/10 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                          <div className="flex items-center gap-1">
                            <span className="opacity-50">Energía:</span>
                            <span>{
                              mes.datosAlFinalizar.energia === "muy_alta" ? "🔥 Muy alta" :
                              mes.datosAlFinalizar.energia === "alta" ? "💪 Alta" :
                              mes.datosAlFinalizar.energia === "normal" ? "😊 Normal" :
                              mes.datosAlFinalizar.energia === "baja" ? "😕 Baja" :
                              "😴 Muy baja"
                            }</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="opacity-50">Recuperación:</span>
                            <span>{
                              mes.datosAlFinalizar.recuperacion === "excelente" ? "🌟" :
                              mes.datosAlFinalizar.recuperacion === "buena" ? "💪" :
                              mes.datosAlFinalizar.recuperacion === "normal" ? "😊" :
                              mes.datosAlFinalizar.recuperacion === "regular" ? "😐" :
                              "😓"
                            } {mes.datosAlFinalizar.recuperacion}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="opacity-50">Adherencia alimentación:</span>
                            <span className={
                              mes.datosAlFinalizar.adherenciaComida === ">80%" ? "text-emerald-400" :
                              mes.datosAlFinalizar.adherenciaComida === "70-80%" ? "text-blue-400" :
                              mes.datosAlFinalizar.adherenciaComida === "50-70%" ? "text-amber-400" :
                              "text-red-400"
                            }>{mes.datosAlFinalizar.adherenciaComida}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="opacity-50">Adherencia entreno:</span>
                            <span className={
                              mes.datosAlFinalizar.adherenciaEntreno === ">80%" ? "text-emerald-400" :
                              mes.datosAlFinalizar.adherenciaEntreno === "70-80%" ? "text-blue-400" :
                              mes.datosAlFinalizar.adherenciaEntreno === "50-70%" ? "text-amber-400" :
                              "text-red-400"
                            }>{mes.datosAlFinalizar.adherenciaEntreno}</span>
                          </div>
                        </div>
                      )}
                      
                      {/* Ajustes aplicados */}
                      {mes.ajustesAplicados && mes.ajustesAplicados.length > 0 && (
                        <div className="mt-2 text-xs">
                          <span className="opacity-50">Ajustes aplicados:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {mes.ajustesAplicados.slice(0, 3).map((ajuste, i) => (
                              <span key={i} className="px-2 py-0.5 rounded bg-white/10">
                                {ajuste.length > 40 ? ajuste.substring(0, 40) + "..." : ajuste}
                              </span>
                            ))}
                            {mes.ajustesAplicados.length > 3 && (
                              <span className="px-2 py-0.5 rounded bg-white/10 opacity-50">
                                +{mes.ajustesAplicados.length - 3} más
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}
        </motion.div>
      </div>
      
      {/* Modal de Edición */}
      {/* Modal de Variantes de Alimentación */}
      <AnimatePresence>
        {modalAlimentosAbierto && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) setModalAlimentosAbierto(null);
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass rounded-2xl p-6 md:p-8 max-w-3xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xl font-semibold">Variantes y preparación</h3>
                <button onClick={() => setModalAlimentosAbierto(null)} className="text-white/70 hover:text-white">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>
              {(() => {
                const idx = modalAlimentosAbierto.diaIdx;
                const dia = plan?.plan_semanal?.[idx];
                if (!dia) return null;
                return (
                  <div className="space-y-4">
                    {dia.comidas.map((c, ci) => {
                      const key = `modal-${idx}-${ci}`;
                      const opciones = (Array.isArray(c.opciones) && c.opciones.length > 0) ? c.opciones.filter((o: string) => o && typeof o === 'string' && o.trim().length > 0 && !o.toLowerCase().includes('opción disponible') && !o.toLowerCase().includes('opcion disponible')) : [];
                      const selected = opciones[0] || c.nombre;
                      const detailKey = `${key}-${selected}`;
                      const det = foodDetails[detailKey] || {};
                      return (
                        <div key={`modal-comida-${idx}-${ci}`} className="rounded-lg border border-white/10 bg-white/5 p-3">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-medium">{c.nombre}</p>
                            <span className="text-xs opacity-70">{c.hora || ''}</span>
                          </div>
                          <div className="text-sm opacity-90">
                            <p className="font-medium">Opción principal:</p>
                            <p className="opacity-90 mb-2">{selected}</p>
                            {opciones.length > 1 && (
                              <>
                                <p className="font-medium">Variantes:</p>
                                <ul className="list-disc pl-5 space-y-1">
                                  {opciones.slice(1).map((o, oi) => (
                                    <li key={`opt-${oi}-${o}`}>{o}</li>
                                  ))}
                                </ul>
                              </>
                            )}
                          </div>
                          {/* Carga de detalles de la opción seleccionada si no están */}
                          {!det.ingredientes && !det.pasos_preparacion && (
                            <FetchDetails
                              k={detailKey}
                              dish={selected}
                              onLoaded={(p) => setFoodDetails((s) => ({ ...s, [detailKey]: { ...p, loading: false } }))}
                              onError={(msg) => setFoodDetails((s) => ({ ...s, [detailKey]: { ...s[detailKey], loading: false, error: msg } }))}
                            />
                          )}
                          {det?.ingredientes && det.ingredientes.length > 0 && (
                            <div className="mt-2">
                              <p className="text-sm font-medium">Ingredientes (cantidades exactas):</p>
                              <ul className="mt-1 list-disc pl-5 text-sm opacity-90">
                                {det.ingredientes.map((ing, ii) => (
                                  <li key={`ing-${ii}-${ing}`}>{ing}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {det?.pasos_preparacion && det.pasos_preparacion.length > 0 && (
                            <div className="mt-2">
                              <p className="text-sm font-medium">Preparación detallada:</p>
                              <ol className="mt-1 list-decimal pl-5 text-sm opacity-90">
                                {det.pasos_preparacion.map((p, pi) => (
                                  <li key={`step-${pi}-${p}`}>{p}</li>
                                ))}
                              </ol>
                            </div>
                          )}
    </div>
  );
                    })}
                  </div>
                );
              })()}
        </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {modalAbierto && datosEdicion && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setModalAbierto(false);
              }
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass rounded-2xl p-6 md:p-8 max-w-3xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-2xl font-semibold mb-4">Editar datos del plan</h2>
              
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 mt-6">
                <label className="flex flex-col gap-1">
                  <span className="text-sm opacity-80">Nombre</span>
                  <input
                    className="rounded-xl bg-white/5 px-3 py-2 outline-none"
                    value={datosEdicion.nombre}
                    onChange={(e) => setDatosEdicion({ ...datosEdicion, nombre: e.target.value })}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-sm opacity-80">Edad</span>
                  <input
                    type="number"
                    className="rounded-xl bg-white/5 px-3 py-2 outline-none"
                    value={datosEdicion.edad}
                    onChange={(e) => setDatosEdicion({ ...datosEdicion, edad: Number(e.target.value) })}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-sm opacity-80">Peso (kg)</span>
                  <input
                    type="number"
                    className="rounded-xl bg-white/5 px-3 py-2 outline-none"
                    value={datosEdicion.pesoKg}
                    onChange={(e) => setDatosEdicion({ ...datosEdicion, pesoKg: Number(e.target.value) })}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-sm opacity-80">Altura (cm)</span>
                  <input
                    type="number"
                    className="rounded-xl bg-white/5 px-3 py-2 outline-none"
                    value={datosEdicion.alturaCm}
                    onChange={(e) => setDatosEdicion({ ...datosEdicion, alturaCm: Number(e.target.value) })}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-sm opacity-80">Sexo</span>
                  <select
                    className="rounded-xl bg-white/5 px-3 py-2 text-white"
                    style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)', color: '#e6f6ff' }}
                    value={datosEdicion.sexo}
                    onChange={(e) => setDatosEdicion({ ...datosEdicion, sexo: e.target.value as "masculino" | "femenino" })}
                  >
                    <option value="masculino">Masculino</option>
                    <option value="femenino">Femenino</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-sm opacity-80">Cintura (cm) (opcional)</span>
                  <input
                    type="number"
                    className="rounded-xl bg-white/5 px-3 py-2 outline-none"
                    value={datosEdicion.cinturaCm ?? ""}
                    onChange={(e) => setDatosEdicion({ ...datosEdicion, cinturaCm: e.target.value ? Number(e.target.value) : undefined })}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-sm opacity-80">Cuello (cm) (opcional)</span>
                  <input
                    type="number"
                    className="rounded-xl bg-white/5 px-3 py-2 outline-none"
                    value={datosEdicion.cuelloCm ?? ""}
                    onChange={(e) => setDatosEdicion({ ...datosEdicion, cuelloCm: e.target.value ? Number(e.target.value) : undefined })}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-sm opacity-80">Cadera (cm) (opcional)</span>
                  <input
                    type="number"
                    className="rounded-xl bg-white/5 px-3 py-2 outline-none"
                    value={datosEdicion.caderaCm ?? ""}
                    onChange={(e) => setDatosEdicion({ ...datosEdicion, caderaCm: e.target.value ? Number(e.target.value) : undefined })}
                  />
                </label>
                <label className="flex flex-col gap-1 md:col-span-2">
                  <span className="text-sm opacity-80 flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={datosEdicion.atletico || false}
                      onChange={(e) => setDatosEdicion({ ...datosEdicion, atletico: e.target.checked })}
                      className="rounded"
                    />
                    Perfil atlético
                  </span>
                </label>
                <label className="flex flex-col gap-1 md:col-span-2">
                  <span className="text-sm opacity-80">Preferencias (separadas por comas)</span>
                  <input
                    className="rounded-xl bg-white/5 px-3 py-2 outline-none"
                    value={preferenciasTexto}
                    onChange={(e) => setPreferenciasTexto(e.target.value)}
                    onBlur={(e) => {
                      const array = e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean);
                      setDatosEdicion({ ...datosEdicion, preferencias: array });
                    }}
                    placeholder="ej: pollo, avena, salmón"
                  />
                </label>
                <label className="flex flex-col gap-1 md:col-span-2">
                  <span className="text-sm opacity-80">Restricciones (separadas por comas)</span>
                  <input
                    className="rounded-xl bg-white/5 px-3 py-2 outline-none"
                    value={restriccionesTexto}
                    onChange={(e) => setRestriccionesTexto(e.target.value)}
                    onBlur={(e) => {
                      const array = e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean);
                      setDatosEdicion({ ...datosEdicion, restricciones: array });
                    }}
                    placeholder="ej: gluten, lácteos, cerdo"
                  />
                </label>
                <label className="flex flex-col gap-1 md:col-span-2">
                  <span className="text-sm opacity-80">Patologías (separadas por comas)</span>
                  <input
                    className="rounded-xl bg-white/5 px-3 py-2 outline-none"
                    value={patologiasTexto}
                    onChange={(e) => setPatologiasTexto(e.target.value)}
                    onBlur={(e) => {
                      const array = e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean);
                      setDatosEdicion({ ...datosEdicion, patologias: array });
                    }}
                    placeholder="ej: hígado graso, intolerancia a la lactosa, diabetes tipo 2"
                  />
                  <p className="text-xs opacity-60 mt-1">
                    Indica condiciones médicas relevantes para ajustar el plan nutricional
                  </p>
                </label>
                <label className="flex flex-col gap-1 md:col-span-2">
                  <span className="text-sm opacity-80 flex items-center gap-2">
                    Dolores, lesiones o molestias (separadas por comas)
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="h-4 w-4 opacity-70"
                    >
                      <path d="M12 2a10 10 0 1 0 10 10A10.011 10.011 0 0 0 12 2Zm.75 15h-1.5v-1.5h1.5Zm1.971-6.279-.675.693A3.375 3.375 0 0 0 12.75 14.25h-1.5a4.875 4.875 0 0 1 1.425-3.45l.93-.936a1.875 1.875 0 1 0-3.195-1.326h-1.5a3.375 3.375 0 1 1 6.03 1.283Z" />
                    </svg>
                  </span>
                  <input
                    className="rounded-xl bg-white/5 px-3 py-2 outline-none"
                    value={doloresLesionesTexto}
                    onChange={(e) => setDoloresLesionesTexto(e.target.value)}
                    onBlur={(e) => {
                      const array = e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean);
                      setDatosEdicion({ ...datosEdicion, doloresLesiones: array });
                    }}
                    placeholder="ej: rodilla derecha, zona lumbar, hombro izquierdo"
                  />
                  <p className="text-xs opacity-60 mt-1">
                    Ajustamos el entrenamiento para cuidar estas zonas y recomendar movilidad o precalentamientos específicos.
                  </p>
                </label>
                <label className="flex items-start gap-3 md:col-span-2">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4"
                    checked={!!((datosEdicion as unknown as Record<string, unknown>).preferirRutina)}
                    onChange={(e) => setDatosEdicion({ ...datosEdicion, preferirRutina: e.target.checked } as unknown as UserInput)}
                  />
                  <span className="text-sm opacity-80">
                    Mantener comidas rutinarias (poca variación entre días)
                    <span className="block text-xs opacity-60 mt-0.5">
                      Repetir comidas facilita el seguimiento (p. ej., papa en déficit o pasta en volumen). Podés cambiarlo cuando quieras.
                    </span>
                  </span>
                </label>
      </div>
              
              <div className="flex gap-3 mt-6 justify-end">
            <button
                  className="rounded-xl px-6 py-2 text-sm font-medium bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                  onClick={() => setModalAbierto(false)}
                >
                  Cancelar
            </button>
            <button
                  className="rounded-xl px-6 py-2 text-sm font-medium bg-blue-500/20 border border-blue-500/30 hover:bg-blue-500/30 transition-colors"
                  onClick={async () => {
                    if (!datosEdicion) return;
                    setModalAbierto(false);
                    setRegenerandoPlan(true);
                    setErrorRegeneracion(null);
                    
                    try {
                      if (!user) {
                        throw new Error("No hay datos de usuario disponibles");
                      }
                      
                      // Procesar los arrays de preferencias, restricciones y patologías
                      const preferenciasArray = preferenciasTexto.split(",").map((s: string) => s.trim()).filter(Boolean);
                      const restriccionesArray = restriccionesTexto.split(",").map((s: string) => s.trim()).filter(Boolean);
                      const patologiasArray = patologiasTexto.split(",").map((s: string) => s.trim()).filter(Boolean);
                      const doloresLesionesArray = doloresLesionesTexto.split(",").map((s: string) => s.trim()).filter(Boolean);
                      
                      const bmi = calculateBMI(datosEdicion.pesoKg, datosEdicion.alturaCm);
                      const nuevasSugerencias = sugerirEntrenamiento(
                        user.objetivo, // Usar el objetivo original del usuario
                        user.intensidad, // Usar la intensidad original del usuario
                        datosEdicion.edad,
                        bmi,
                        datosEdicion.atletico
                      );
                      
                      const userActualizado = {
                        ...user, // Mantener todos los datos originales (objetivo, intensidad, tipoDieta)
                        ...datosEdicion, // Aplicar cambios de datos básicos
                        preferencias: preferenciasArray,
                        restricciones: restriccionesArray,
                        patologias: patologiasArray,
                        doloresLesiones: doloresLesionesArray,
                        diasGym: nuevasSugerencias.diasGym,
                        diasCardio: Math.ceil(nuevasSugerencias.minutosCaminata / (nuevasSugerencias.minutosCaminata > 45 ? 60 : nuevasSugerencias.minutosCaminata > 30 ? 45 : 30))
                      };
                      
                      const resp = await fetch("/api/generatePlan", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(userActualizado),
                      });
                      
                      if (!resp.ok) {
                        const data = await resp.json().catch(() => null);
                        const combined = data?.error && data?.detail ? `${data.error}: ${data.detail}` : (data?.error || data?.detail);
                        const msg = combined || `No se pudo generar el plan (HTTP ${resp.status})`;
                        throw new Error(msg);
                      }
                      
                      const nuevoPlan = await resp.json();
                      
                      // Mostrar objeto de debug en consola del navegador
                      if (nuevoPlan._debug_training_plan) {
                        console.log("=".repeat(80));
                        console.log("📊 DEBUG: DATOS USADOS PARA GENERAR TRAINING_PLAN (EDITADO)");
                        console.log("=".repeat(80));
                        console.log(nuevoPlan._debug_training_plan);
                        console.log("=".repeat(80));
                        // También exponerlo globalmente para fácil acceso
                        (window as unknown as { __TRAINING_PLAN_DEBUG__?: unknown }).__TRAINING_PLAN_DEBUG__ = nuevoPlan._debug_training_plan;
                        console.log("💡 También disponible en: window.__TRAINING_PLAN_DEBUG__");
                      }
                      
                      setUser(userActualizado);
                      setPlan(nuevoPlan);
                      
                      // Guardar o actualizar en Firestore
                      try {
                        const auth = getAuthSafe();
                        const db = await import("@/lib/firebase").then(m => m.getDbSafe());
                        
                        if (auth?.currentUser && db) {
                          const { collection, doc, updateDoc, addDoc, setDoc, getDoc, serverTimestamp } = await import("firebase/firestore");
                          
                          // Actualizar perfil del usuario en la colección "usuarios"
                          try {
                            const userRef = doc(db, "usuarios", auth.currentUser.uid);
                            const userDoc = await getDoc(userRef);
                            
                            // Obtener el email del usuario autenticado
                            const userEmail = auth.currentUser?.email?.toLowerCase() || "";
                            
                            const userProfileData: Record<string, unknown> = {
                              nombre: userActualizado.nombre,
                              sexo: userActualizado.sexo,
                              alturaCm: userActualizado.alturaCm,
                              edad: userActualizado.edad,
                              peso: userActualizado.pesoKg, // Guardar peso del usuario
                              objetivo: userActualizado.objetivo, // Guardar objetivo
                              atletico: Boolean(userActualizado.atletico), // Guardar perfil atlético
                              doloresLesiones: Array.isArray(userActualizado.doloresLesiones) ? userActualizado.doloresLesiones : [],
                              updatedAt: serverTimestamp(),
                            };
                            
                            // Agregar tipoDieta solo si tiene valor (no undefined)
                            if (userActualizado.tipoDieta !== undefined && userActualizado.tipoDieta !== null) {
                              userProfileData.tipoDieta = userActualizado.tipoDieta;
                            }
                            
                            // Asegurar que email y premium estén presentes
                            if (!userDoc.exists() || !userDoc.data()?.email) {
                              userProfileData.email = userEmail;
                            }
                            if (!userDoc.exists() || userDoc.data()?.premium === undefined) {
                              userProfileData.premium = false;
                            }
                            
                            // Agregar medidas opcionales si existen y tienen valores válidos
                            if (userActualizado.cinturaCm !== undefined && userActualizado.cinturaCm !== null && userActualizado.cinturaCm !== 0) {
                              userProfileData.cinturaCm = Number(userActualizado.cinturaCm);
                            }
                            if (userActualizado.cuelloCm !== undefined && userActualizado.cuelloCm !== null && userActualizado.cuelloCm !== 0) {
                              userProfileData.cuelloCm = Number(userActualizado.cuelloCm);
                            }
                            if (userActualizado.caderaCm !== undefined && userActualizado.caderaCm !== null && userActualizado.caderaCm !== 0) {
                              userProfileData.caderaCm = Number(userActualizado.caderaCm);
                            }
                            
                            // Limpiar campos undefined antes de guardar
                            const cleanUserProfileData = Object.fromEntries(
                              Object.entries(userProfileData).filter(([, v]) => v !== undefined && v !== null)
                            );
                            
                            if (!userDoc.exists()) {
                              await setDoc(userRef, {
                                ...cleanUserProfileData,
                                createdAt: serverTimestamp(),
                                email: userEmail,
                                premium: false,
                              });
                            } else {
                              await setDoc(userRef, cleanUserProfileData, { merge: true });
                            }
                            console.log("✅ Perfil del usuario actualizado en Firestore (incluye peso)");
                          } catch (profileError) {
                            console.error("Error al actualizar perfil del usuario:", profileError);
                            // No bloqueamos el flujo si falla guardar el perfil
                          }
                          
                          // Limpiar datos: eliminar campos undefined y null
                          const cleanUser = Object.fromEntries(
                            Object.entries(userActualizado).filter(([, v]) => v !== undefined && v !== null)
                          );
                          
                          const cleanPlan = JSON.parse(JSON.stringify({ plan: nuevoPlan, user: cleanUser }));
                          
                          if (planId) {
                            // Actualizar plan existente
                            const planRef = doc(db, "planes", planId);
                            await updateDoc(planRef, {
                              plan: cleanPlan,
                              updatedAt: serverTimestamp(),
                            });
                            console.log("Plan actualizado en Firestore desde modal:", planId);
                          } else {
                            // Crear nuevo plan (si no tiene ID, es un plan nuevo)
                            const docRef = await addDoc(collection(db, "planes"), {
                              userId: auth.currentUser.uid,
                              plan: cleanPlan,
                              createdAt: serverTimestamp(),
                            });
                            console.log("Plan guardado en Firestore desde modal:", docRef.id);
                          }
                        }
                      } catch (saveError) {
                        console.error("Error al guardar plan actualizado desde modal:", saveError);
                        // No bloqueamos el flujo si falla guardar
                      }
                      
                      setValoresOriginales({
                        objetivo: userActualizado.objetivo,
                        intensidad: userActualizado.intensidad,
                        tipoDieta: userActualizado.tipoDieta,
                      });
                      setDiasGymEditado(null);
                      setMinutosCaminataEditado(null);
                      setHorasSuenoEditado(null);
                    } catch (err: unknown) {
                      const message = err instanceof Error ? err.message : "Ocurrió un error";
                      setErrorRegeneracion(message);
                      console.error("Error al regenerar plan:", err);
                    } finally {
                      setRegenerandoPlan(false);
                    }
                  }}
                >
                  Aceptar
            </button>
          </div>
        </motion.div>
          </motion.div>
        )}
        </AnimatePresence>

        {/* Modal de carga - Regenerando plan */}
        <AnimatePresence>
          {regenerandoPlan && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="glass rounded-2xl p-8 max-w-md w-full text-center"
              >
                <div className="mb-4">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-500/20 mb-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
                  <h3 className="text-xl font-semibold mb-2">Regenerando plan</h3>
                  <p className="text-sm opacity-70">
                    Estamos generando tu nuevo plan personalizado con IA...
                  </p>
                </div>
                {errorRegeneracion && (
                  <div className="mt-4 p-3 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300 text-sm">
                    {errorRegeneracion}
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Modal de información (tooltips) */}
        <AnimatePresence>
          {modalInfoAbierto && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              onClick={() => setModalInfoAbierto(null)}
            >
              <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" />
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="relative z-10 w-full max-w-md rounded-xl border border-white/10 bg-black/95 p-6 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
            <button
                  onClick={() => setModalInfoAbierto(null)}
                  className="absolute right-4 top-4 text-white/70 hover:text-white transition-colors"
                  aria-label="Cerrar"
                >
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
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
            </button>
                <h3 className="text-lg font-semibold mb-4">
                  {modalInfoAbierto === 'imc' && '¿Qué es el IMC?'}
                  {modalInfoAbierto === 'macros' && '¿Qué son los macronutrientes?'}
                  {modalInfoAbierto === 'sueno' && '¿Cómo contar las horas de sueño?'}
                  {modalInfoAbierto === 'dificultad' && '¿Qué implica la dificultad del plan?'}
                  {modalInfoAbierto === 'split' && '¿Qué es la división de entrenamiento?'}
                </h3>
                <div className="text-sm opacity-90 leading-relaxed space-y-2">
                  {modalInfoAbierto === 'imc' && (
                    <p>El Índice de Masa Corporal (IMC) relaciona peso y altura. Es una guía general y no sustituye evaluación clínica.</p>
                  )}
                  {modalInfoAbierto === 'macros' && (
                    <p>Los macronutrientes son proteínas, grasas y carbohidratos. Tu plan reparte las calorías diarias entre ellos para apoyar tu objetivo.</p>
                  )}
                  {modalInfoAbierto === 'sueno' && (
                    <>
                      <p>Tu objetivo actual: <strong>{typeof horasSuenoActual === 'number' ? horasSuenoActual : (sugerenciaEntrenamiento?.horasSueno ?? 8)}</strong> h por noche.</p>
                      <p className="opacity-90">Las siestas suman al total diario, pero ideal que sean cortas (20–30 min) y no muy tarde para no afectar el sueño nocturno.</p>
                    </>
                  )}
                  {modalInfoAbierto === 'dificultad' && (
                    (() => {
                      const cambios = (plan as unknown as Record<string, unknown>)?.cambios_semanales as Record<string, unknown> | undefined;
                      const fallback = {
                        semana1: 'Adaptación: posible fatiga suave y cambios en el apetito. Enfocá en técnica y rutina.',
                        semana2: 'Mejora de energía y rendimiento. Hambre más estable. El buen descanso acelera la adaptación.',
                        semana3_4: 'Progreso visible: fuerza/resistencia mejoran; cintura y peso empiezan a reflejar el objetivo.',
                        post_mes: 'Consolidación de hábitos y ajustes finos para seguir progresando.',
                        fisiologia: [
                          'Mejor sensibilidad a la insulina y control de glucosa',
                          'Adaptaciones musculares (reclutamiento y eficiencia neuromuscular)',
                          `${user?.objetivo === 'perder_grasa' || user?.objetivo === 'corte' ? 'Déficit calórico → reducción de grasa' : user?.objetivo === 'ganar_masa' || user?.objetivo === 'volumen' ? 'Superávit calórico → síntesis muscular' : 'Balance energético optimizado'}`,
                          `Recuperación mejorada con ${typeof horasSuenoActual === 'number' ? horasSuenoActual : (sugerenciaEntrenamiento?.horasSueno ?? 8)} h de sueño`
                        ]
                      };
                      return (
                        <>
                          <p>
                            Tu plan está marcado como <strong className="capitalize">{String((plan as unknown as Record<string, unknown>)?.dificultad || 'media')}</strong>
                            {(plan as unknown as Record<string, unknown>)?.dificultad_detalle ? ` — ${String((plan as unknown as Record<string, unknown>).dificultad_detalle)}` : ''}.
                          </p>
                          <p className="mt-2 font-medium">¿Qué vas a sentir:</p>
                          <ul className="list-disc pl-5 space-y-1">
                            <li><strong>Semana 1:</strong> {String(cambios?.semana1 || fallback.semana1)}</li>
                            <li><strong>Semana 2:</strong> {String(cambios?.semana2 || fallback.semana2)}</li>
                            <li><strong>Semana 3-4:</strong> {String(cambios?.semana3_4 || fallback.semana3_4)}</li>
                            <li><strong>Después del mes:</strong> {String(cambios?.post_mes || fallback.post_mes)}</li>
                          </ul>
                          <p className="mt-2 font-medium">¿Qué cambios pasan en tu cuerpo:</p>
                          <ul className="list-disc pl-5 space-y-1">
                            {(Array.isArray(cambios?.fisiologia) ? cambios.fisiologia : fallback.fisiologia).map((t: string, i: number) => (
                              <li key={`fisio-${i}`}>{t}</li>
                            ))}
                          </ul>
                        </>
                      );
                    })()
                  )}
                  {modalInfoAbierto === 'split' && (
                    <>
                      <p>La división de entrenamiento describe cómo se reparten los grupos musculares a lo largo de la semana:</p>
                      <ul className="list-disc pl-5 space-y-1">
                        <li><strong>Full Body</strong>: todo el cuerpo en cada sesión. Ideal para 2–3 días/sem.</li>
                        <li><strong>Upper/Lower</strong>: tren superior y tren inferior alternados. 4 días/sem típicos.</li>
                        <li><strong>Push/Pull/Legs</strong>: empuje, tirón y piernas. 3–6 días/sem según volumen.</li>
                        <li><strong>Mixto</strong>: combinación adaptada a tu objetivo, intensidad y disponibilidad.</li>
                      </ul>
                      <p className="opacity-90">Tu plan actual: <strong>{splitResumen}</strong>. Esto se ajusta a tus <em>días de gym</em>, intensidad y objetivo para optimizar progreso y recuperación.</p>
                    </>
                  )}
          </div>
        </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Modal de Plan de Entrenamiento */}
        <AnimatePresence>
          {modalEntrenamientoAbierto && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
              onClick={() => {
                // Limpiar TODAS las referencias al cerrar el modal
                isLoadingDayRef.current = false;
                loadingProgressRef.current = null;
                lastLoadedDayRef.current = null;
                isRecalculatingRef.current = false;
                processingSelectionRef.current = false;
                lastSelectedDateRef.current = null;
                lastExerciseProgressRef.current = ''; // Limpiar también este
                dayProgressCache.current.clear(); // Limpiar cache
                
                // Cerrar modal y limpiar estados
                setModalEntrenamientoAbierto(false);
                setSelectedTrainingDate(null);
                setSelectedDayData(null);
                setSelectedDayProgress({});
                setLoadingSelectedDay(false);
              }}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl border border-white/10 p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-bold">🏋️ Plan de Entrenamiento</h2>
                    {splitResumen && (
                      <span className="text-sm px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-medium">
                        {splitResumen}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      setModalEntrenamientoAbierto(false);
                      setSelectedTrainingDate(null);
                      setSelectedDayData(null);
                    }}
                    className="text-white/70 hover:text-white transition-colors"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Mostrar día seleccionado del calendario o todas las semanas */}
                {selectedDayData && selectedDayData.day && selectedDayData.day.ejercicios ? (
                  // Mostrar solo el día seleccionado del calendario
                  loadingSelectedDay ? (
                    // Mostrar loader mientras se cargan los datos
                    <div className="flex flex-col items-center justify-center py-20">
                      <div className="relative w-16 h-16 mb-4">
                        <div className="absolute inset-0 border-4 border-cyan-500/30 rounded-full"></div>
                        <div className="absolute inset-0 border-4 border-transparent border-t-cyan-500 rounded-full animate-spin"></div>
                      </div>
                      <p className="text-white/70 text-sm">Cargando datos del entrenamiento...</p>
                    </div>
                  ) : (
                    <DayTrainingPanel
                      dayData={selectedDayData.day}
                      week={selectedDayData.week}
                      dayIndex={selectedDayData.dayIndex}
                      date={selectedTrainingDate}
                      exerciseProgress={selectedDayProgress} // Usar el progreso separado para evitar loops
                      planId={planId || undefined}
                      userId={authUser?.uid || undefined}
                      onProgressChange={(exerciseId, completed, total) => {
                        // Actualizar solo el progreso del día seleccionado (no el global)
                        setSelectedDayProgress(prev => ({
                          ...prev,
                          [exerciseId]: { completed, total }
                        }));
                      }}
                    />
                  )
                ) : selectedTrainingDate && !selectedDayData ? (
                  // Día seleccionado pero sin entrenamiento
                  <div className="text-center py-12">
                    <div className="text-6xl mb-4">📅</div>
                    <h3 className="text-xl font-semibold text-white mb-2">
                      {selectedTrainingDate.toLocaleDateString('es-AR', { 
                        weekday: 'long', 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}
                    </h3>
                    <p className="text-white/70">
                      No hay entrenamiento programado para este día.
                    </p>
                    <p className="text-sm text-white/50 mt-2">
                      Este es un día de descanso o no está incluido en tu plan de entrenamiento.
                    </p>
                  </div>
                ) : (
                  // Vista completa con todas las semanas (fallback si se abre de otra forma)
                  <>
                {/* Botones de semanas */}
                <div className="flex gap-2 mb-6 flex-wrap">
                  {[1, 2, 3, 4].map((semana) => (
                    <button
                      key={semana}
                      onClick={() => setSemanaSeleccionada(semana)}
                      className={`px-4 py-2 rounded-lg font-medium transition-all ${
                        semanaSeleccionada === semana
                          ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white'
                          : 'bg-white/10 text-white/70 hover:bg-white/20'
                      }`}
                    >
                      Semana {semana}
                    </button>
                  ))}
                </div>

                {/* Contenido de la semana seleccionada */}
                {(() => {
                  const tp = (plan as unknown as Record<string, unknown>)?.training_plan as TrainingPlan | undefined;
                  const weeks = tp?.weeks || [];
                  const semanaActual = weeks.find((w) => (w.week ?? 1) === semanaSeleccionada) || weeks[semanaSeleccionada - 1];
                  
                  if (!semanaActual) {
                    return (
                      <div className="text-center py-8 text-white/70">
                        <p>No hay datos de entrenamiento para la Semana {semanaSeleccionada}</p>
    </div>
  );
                  }

                  return (
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-cyan-400 mb-4">
                        Semana {semanaActual.week ?? semanaSeleccionada}
                      </h3>
                      {(semanaActual.days || []).map((dia: TrainingDay, di: number) => {
                        // Función para determinar qué músculos se trabajan en este día
                        // Basado en los muscle_group reales de los ejercicios
                        const getMusculosDelDia = (): string | null => {
                          if (!dia.ejercicios || dia.ejercicios.length === 0) {
                            return null;
                          }
                          
                          // Obtener todos los muscle_group únicos de los ejercicios del día
                            const muscleGroups = new Set<string>();
                            dia.ejercicios.forEach(ej => {
                              if (ej.muscle_group) {
                                muscleGroups.add(ej.muscle_group);
                              }
                            });
                            
                          if (muscleGroups.size === 0) {
                            return null;
                          }
                          
                          // Si hay muchos músculos diferentes, puede ser Full Body
                          if (muscleGroups.size >= 5) {
                            return "Full Body";
                          }
                          
                          // Devolver los músculos únicos encontrados, ordenados alfabéticamente
                          return Array.from(muscleGroups).sort().join(", ");
                        };
                        
                        const musculos = getMusculosDelDia();
                        
                        // Usar el progreso del día desde el cache (calculado una sola vez al abrir el modal)
                        // NO calcular aquí, solo usar el cache
                        const dayKey = `w${semanaSeleccionada}-d${di}`;
                        const cachedProgress = diaProgressCache[dayKey];
                        
                        // Si no hay cache, usar valores por defecto (se calculará cuando se cargue exerciseProgress)
                        const finalTotal = cachedProgress?.total || 0;
                        const finalCompleted = cachedProgress?.completed || 0;
                        const finalPorcentaje = cachedProgress?.porcentaje || 0;
                        
                        // Identificar día actual
                        const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
                        const hoy = new Date().getDay();
                        const diaActualNombre = diasSemana[hoy];
                        const esDiaActual = dia.day === diaActualNombre;
                        
                        // Estado de expansión del día
                        const isExpanded = diasExpandidos[dayKey] || false;
                        
                        return (
                        <div 
                          key={`dia-${semanaSeleccionada}-${di}`} 
                          className={`rounded-lg border-2 bg-white/5 p-4 transition-all ${
                            esDiaActual 
                              ? 'border-cyan-500/50 bg-cyan-500/10 shadow-lg shadow-cyan-500/20' 
                              : 'border-white/10'
                          }`}
                        >
                          <button
                            onClick={() => setDiasExpandidos(prev => ({ ...prev, [dayKey]: !prev[dayKey] }))}
                            className="w-full flex items-center justify-between mb-3"
                          >
                            <h4 className={`text-base font-semibold text-white flex items-center gap-2 ${
                              esDiaActual ? 'text-cyan-300' : ''
                            }`}>
                              {esDiaActual && <span className="text-cyan-400">📍</span>}
                            {dia.day}
                            {musculos && (
                              <span className="text-sm font-normal opacity-70 ml-2">({musculos})</span>
                            )}
                              <span className="ml-auto text-sm font-medium text-cyan-300">
                                {finalCompleted}/{finalTotal} ({finalPorcentaje}%)
                              </span>
                          </h4>
                            <span className="text-white/50 text-sm">
                              {isExpanded ? '▼' : '▶'}
                            </span>
                          </button>
                          
                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden"
                              >
                          {/* Calentamiento */}
                          {dia.warmup && (
                            <div className="mb-4 p-3 rounded-md bg-gradient-to-r from-orange-500/20 to-yellow-500/20 border border-orange-500/30">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-sm font-semibold text-orange-300">🔥 Calentamiento</span>
                                <span className="text-xs opacity-70">({dia.warmup.duration_minutes} min)</span>
                              </div>
                              <p className="text-sm opacity-90 leading-relaxed">{dia.warmup.description}</p>
                            </div>
                          )}
                          
                          {(dia.ejercicios || []).length > 0 ? (
                            <ul className="space-y-3">
                              {(dia.ejercicios || []).map((ejercicio: TrainingExercise, ei: number) => {
                                const restTime = ejercicio.rest_seconds || (ejercicio as unknown as { rest_sec?: number }).rest_sec;
                                const exerciseId = `w${semanaSeleccionada}-d${di}-e${ei}`;
                                const progress = exerciseProgress[exerciseId] || { completed: 0, total: ejercicio.sets };
                                
                                return (
                                  <li key={`ej-${semanaSeleccionada}-${di}-${ei}`} className="rounded-lg bg-white/5 border border-white/10 p-3">
                                    <div className="flex-1">
                                      {/* Header del ejercicio */}
                                      <div className="flex items-start justify-between gap-2 mb-2">
                                        <div className="flex-1">
                                          <div className="flex items-center gap-2 flex-wrap mb-1">
                                            <span className="font-semibold text-white">{ejercicio.name}</span>
                                            <span className="text-sm opacity-70">· {ejercicio.sets}x{String(ejercicio.reps)}</span>
                                            <span className="ml-auto text-sm font-medium text-cyan-300">
                                              {progress.completed}/{progress.total}
                                            </span>
                                            {ejercicio.muscle_group && (
                                              <span className="text-xs px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                                                {ejercicio.muscle_group}
                                              </span>
                                            )}
                                          </div>
                                          {/* Detalles técnicos compactos */}
                                          <div className="flex items-center gap-3 flex-wrap text-xs opacity-80">
                                            {ejercicio.rpe && (
                                              <span className="flex items-center gap-1">
                                                <span className="opacity-60">RPE:</span>
                                                <span className="font-medium">{ejercicio.rpe}/10</span>
                                              </span>
                                            )}
                                            {ejercicio.tempo && (
                                              <span className="flex items-center gap-1">
                                                <span className="opacity-60">Tempo:</span>
                                                <span className="font-medium">{ejercicio.tempo}</span>
                                              </span>
                                            )}
                                            {restTime && (
                                              <span className="flex items-center gap-1">
                                                <span className="opacity-60">Descanso:</span>
                                                <span className="font-medium">{restTime}s</span>
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                      
                                      {/* Técnica (expandible) */}
                                      {ejercicio.technique && (
                                        <details className="mt-2">
                                          <summary className="text-xs font-medium text-cyan-300 cursor-pointer hover:text-cyan-200">
                                            💡 Técnica
                                          </summary>
                                          <p className="mt-1 text-xs opacity-90 leading-relaxed pl-2 border-l-2 border-cyan-500/30">
                                            {ejercicio.technique}
                                          </p>
                                        </details>
                                      )}
                                      
                                      {/* Progresión */}
                                      {ejercicio.progression && (
                                        <details className="mt-2">
                                          <summary className="text-xs font-medium text-yellow-300 cursor-pointer hover:text-yellow-200">
                                            📈 Progresión
                                          </summary>
                                          <p className="mt-1 text-xs opacity-90 leading-relaxed pl-2 border-l-2 border-yellow-500/30">
                                            {ejercicio.progression}
                                          </p>
                                        </details>
                                      )}
                                      
                                      {/* Cues mentales */}
                                      {ejercicio.cues && ejercicio.cues.length > 0 && (
                                        <div className="mt-2">
                                          <p className="text-xs font-medium text-purple-300 mb-1">🎯 Pistas mentales:</p>
                                          <ul className="list-disc pl-4 space-y-0.5">
                                            {ejercicio.cues.map((cue, cueIdx) => (
                                              <li key={`cue-${ei}-${cueIdx}`} className="text-xs opacity-90">{cue}</li>
                                            ))}
                                          </ul>
                                        </div>
                                      )}
                                      
                                      {/* Alternativa (si hay lesión) */}
                                      {ejercicio.alternative && (
                                        <div className="mt-2 p-2 rounded bg-orange-500/10 border border-orange-500/30">
                                          <p className="text-xs font-medium text-orange-300 mb-1">⚠️ Alternativa (si tienes lesión):</p>
                                          <p className="text-xs opacity-90">{ejercicio.alternative}</p>
                                        </div>
                                      )}
                                      
                                      {/* Tracker de pesos por serie */}
                                      {authUser && planId && (
                                        <ExerciseSetTracker
                                          exercise={ejercicio}
                                          week={semanaActual.week}
                                          day={dia.day}
                                          planId={planId}
                                          userId={authUser.uid}
                                          onProgressChange={(completed, total) => {
                                            // Solo actualizar exerciseProgress si NO hay un día seleccionado del calendario
                                            // Si hay un día seleccionado, NO actualizar exerciseProgress para evitar loops
                                            if (!selectedDayData) {
                                              setExerciseProgress(prev => ({
                                                ...prev,
                                                [exerciseId]: { completed, total }
                                              }));
                                            }
                                          }}
                                        />
                                      )}
                                    </div>
                                  </li>
                                );
                              })}
                            </ul>
                          ) : (
                            <p className="text-sm text-white/50">No hay ejercicios registrados para este día</p>
                          )}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                        );
                      })}
                    </div>
                  );
                })()}
                  </>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Modal de selección de plan premium */}
      {premiumModalOpen && authUser && (
        <PremiumPlanModal
          isOpen={premiumModalOpen}
          onClose={() => setPremiumModalOpen(false)}
          userId={authUser.uid}
          userEmail={authUser.email || ""}
        />
      )}

      {/* Modal de Continuidad de Plan (solo para planes simples) */}
      {continuityModalOpen && authUser && user && plan && planId && !planMultiFase && (
        <PlanContinuityModal
          isOpen={continuityModalOpen}
          onClose={() => setContinuityModalOpen(false)}
          planData={{
            id: planId,
            plan: plan,
            user: user,
            createdAt: new Date(), // La fecha real se carga desde Firestore dentro del modal
          }}
          registrosPeso={registrosPeso}
          userId={authUser.uid}
        />
      )}

      {/* Modal de Cambios del Nuevo Mes (planes multi-fase) */}
      <AnimatePresence>
        {monthChangesModalOpen && monthChangesData && (
          <MonthChangesModal
            isOpen={monthChangesModalOpen}
            onClose={() => {
              setMonthChangesModalOpen(false);
              setMonthChangesData(null);
            }}
            cambios={monthChangesData}
          />
        )}
      </AnimatePresence>

      {/* Modal de registro de comida fuera del plan */}
      <FoodTrackingModal
        isOpen={foodTrackingModalOpen}
        onClose={() => setFoodTrackingModalOpen(false)}
        planCalories={plan?.calorias_diarias || 2000}
        userObjective={user?.objetivo}
        planId={planId || undefined}
        userId={authUser?.uid || undefined}
      />

      {/* Modal de estadísticas semanales */}
      {planId && (
        <WeeklyStatsModal
          isOpen={weeklyStatsModalOpen}
          onClose={() => setWeeklyStatsModalOpen(false)}
          planId={planId}
          userId={authUser?.uid || undefined}
        />
      )}

      {/* Modal de información del IMC - se muestra la primera vez que el usuario ve su plan */}
      {user && (
        <IMCInfoModal
          isOpen={imcModalOpen}
          onClose={() => setImcModalOpen(false)}
          imc={bmi}
          pesoActual={user.pesoKg}
          alturaCm={user.alturaCm}
          objetivo={user.objetivo}
          intensidad={user.intensidad}
          sexo={user.sexo}
        />
      )}
      
      {/* Modal de Generar Siguiente Mes */}
      <AnimatePresence>
        {modalSiguienteMesAbierto && planMultiFase && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => !generandoSiguienteMes && setModalSiguienteMesAbierto(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-900 border border-white/10 rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">
                  🚀 Generar Mes {planMultiFase.mesActual + 1}
                </h2>
                <button
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                  onClick={() => !generandoSiguienteMes && setModalSiguienteMesAbierto(false)}
                  disabled={generandoSiguienteMes}
                >
                  ✕
                </button>
              </div>
              
              <p className="text-sm opacity-70 mb-4">
                Ingresá tus datos actuales para generar el plan del próximo mes con ajustes personalizados.
              </p>
              
              {/* Info de fase actual */}
              <div className={`mb-4 p-3 rounded-xl ${
                planMultiFase.faseActual === "BULK" 
                  ? "bg-amber-500/10 border border-amber-500/20" 
                  : planMultiFase.faseActual === "CUT"
                  ? "bg-cyan-500/10 border border-cyan-500/20"
                  : "bg-emerald-500/10 border border-emerald-500/20"
              }`}>
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-semibold">Fase actual: {planMultiFase.faseActual}</span>
                  <span className="opacity-70">• Mes {planMultiFase.mesActual} de {planMultiFase.totalMeses}</span>
                </div>
                <p className="text-xs opacity-70 mt-1">
                  {(() => {
                    const infoFase = obtenerInfoFaseActual(planMultiFase);
                    return infoFase.fase?.descripcion || "";
                  })()}
                </p>
              </div>
              
              <div className="space-y-4">
                {/* Peso Actual (OBLIGATORIO) */}
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Peso Actual (kg) <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2 outline-none focus:border-white/30"
                    value={datosSiguienteMes.pesoActual || ""}
                    onChange={(e) => setDatosSiguienteMes(prev => ({ ...prev, pesoActual: parseFloat(e.target.value) || 0 }))}
                    placeholder="Ej: 82.5"
                  />
                  {planMultiFase.historialMeses[planMultiFase.mesActual - 1] && (
                    <p className="text-xs opacity-50 mt-1">
                      Peso al iniciar este mes: {planMultiFase.historialMeses[planMultiFase.mesActual - 1].datosAlIniciar.peso} kg
                    </p>
                  )}
                </div>
                
                {/* Cintura Actual (Opcional) */}
                <div>
                  <label className="block text-sm font-medium mb-1">Cintura Actual (cm) <span className="text-xs opacity-50">(opcional)</span></label>
                  <input
                    type="number"
                    step="0.5"
                    className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2 outline-none focus:border-white/30"
                    value={datosSiguienteMes.cinturaActual || ""}
                    onChange={(e) => setDatosSiguienteMes(prev => ({ ...prev, cinturaActual: parseFloat(e.target.value) || 0 }))}
                    placeholder="Ej: 84"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  {/* Energía */}
                  <div>
                    <label className="block text-sm font-medium mb-1">Energía</label>
                    <select
                      className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2 outline-none focus:border-white/30"
                      value={datosSiguienteMes.energia}
                      onChange={(e) => setDatosSiguienteMes(prev => ({ ...prev, energia: e.target.value as typeof prev.energia }))}
                    >
                      <option value="muy_baja">😴 Muy baja</option>
                      <option value="baja">😕 Baja</option>
                      <option value="normal">😊 Normal</option>
                      <option value="alta">💪 Alta</option>
                      <option value="muy_alta">🔥 Muy alta</option>
                    </select>
                  </div>
                  
                  {/* Recuperación */}
                  <div>
                    <label className="block text-sm font-medium mb-1">Recuperación</label>
                    <select
                      className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2 outline-none focus:border-white/30"
                      value={datosSiguienteMes.recuperacion}
                      onChange={(e) => setDatosSiguienteMes(prev => ({ ...prev, recuperacion: e.target.value as typeof prev.recuperacion }))}
                    >
                      <option value="mala">😓 Mala</option>
                      <option value="regular">😐 Regular</option>
                      <option value="normal">😊 Normal</option>
                      <option value="buena">💪 Buena</option>
                      <option value="excelente">🌟 Excelente</option>
                    </select>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  {/* Adherencia Comida */}
                  <div>
                    <label className="block text-sm font-medium mb-1">Adherencia Alimentación</label>
                    <select
                      className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2 outline-none focus:border-white/30"
                      value={datosSiguienteMes.adherenciaComida}
                      onChange={(e) => setDatosSiguienteMes(prev => ({ ...prev, adherenciaComida: e.target.value as typeof prev.adherenciaComida }))}
                    >
                      <option value="<50%">{"<50%"} - Muy baja</option>
                      <option value="50-70%">50-70% - Regular</option>
                      <option value="70-80%">70-80% - Buena</option>
                      <option value=">80%">{">80%"} - Excelente</option>
                    </select>
                  </div>
                  
                  {/* Adherencia Entreno */}
                  <div>
                    <label className="block text-sm font-medium mb-1">Adherencia Entreno</label>
                    <select
                      className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2 outline-none focus:border-white/30"
                      value={datosSiguienteMes.adherenciaEntreno}
                      onChange={(e) => setDatosSiguienteMes(prev => ({ ...prev, adherenciaEntreno: e.target.value as typeof prev.adherenciaEntreno }))}
                    >
                      <option value="<50%">{"<50%"} - Muy baja</option>
                      <option value="50-70%">50-70% - Regular</option>
                      <option value="70-80%">70-80% - Buena</option>
                      <option value=">80%">{">80%"} - Excelente</option>
                    </select>
                  </div>
                </div>
                
                {/* Lesiones nuevas */}
                <div>
                  <label className="block text-sm font-medium mb-1">Lesiones o molestias nuevas <span className="text-xs opacity-50">(opcional)</span></label>
                  <input
                    type="text"
                    className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2 outline-none focus:border-white/30"
                    value={datosSiguienteMes.lesionesNuevas}
                    onChange={(e) => setDatosSiguienteMes(prev => ({ ...prev, lesionesNuevas: e.target.value }))}
                    placeholder="Ej: Dolor en hombro derecho, molestia en rodilla..."
                  />
                </div>
                
                {/* Comentarios */}
                <div>
                  <label className="block text-sm font-medium mb-1">Ajustes o comentarios <span className="text-xs opacity-50">(opcional)</span></label>
                  <textarea
                    className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2 outline-none focus:border-white/30 resize-none"
                    rows={2}
                    value={datosSiguienteMes.comentarios}
                    onChange={(e) => setDatosSiguienteMes(prev => ({ ...prev, comentarios: e.target.value }))}
                    placeholder="Ej: Quisiera más variedad en desayunos, menos cardio..."
                  />
                </div>
              </div>
              
              {errorSiguienteMes && (
                <div className="mt-4 p-3 rounded-xl bg-red-500/20 border border-red-500/30 text-red-200 text-sm">
                  {errorSiguienteMes}
                </div>
              )}
              
              <div className="flex gap-3 mt-6">
                <button
                  className="flex-1 rounded-xl px-4 py-3 bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                  onClick={() => setModalSiguienteMesAbierto(false)}
                  disabled={generandoSiguienteMes}
                >
                  Cancelar
                </button>
                <button
                  className={`flex-1 rounded-xl px-4 py-3 font-medium transition-colors disabled:opacity-50 ${
                    planMultiFase.faseActual === "BULK" 
                      ? "bg-amber-500/20 border border-amber-500/30 hover:bg-amber-500/30 text-amber-200" 
                      : planMultiFase.faseActual === "CUT"
                      ? "bg-cyan-500/20 border border-cyan-500/30 hover:bg-cyan-500/30 text-cyan-200"
                      : "bg-emerald-500/20 border border-emerald-500/30 hover:bg-emerald-500/30 text-emerald-200"
                  }`}
                  onClick={handleGenerarSiguienteMes}
                  disabled={!datosSiguienteMes.pesoActual || generandoSiguienteMes}
                >
                  {generandoSiguienteMes ? "⏳ Generando..." : "🚀 Generar Siguiente Mes"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function FetchDetails({ k, dish, onLoaded, onError }: { k: string; dish: string; onLoaded: (p: { ingredientes?: string[]; pasos_preparacion?: string[] }) => void; onError: (msg: string) => void }) {
  const { user } = usePlanStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch('/api/mealDetails', { 
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' }, 
          body: JSON.stringify({ 
            dish,
            tipoDieta: user?.tipoDieta,
            restricciones: user?.restricciones,
            preferencias: user?.preferencias,
            patologias: user?.patologias
          }) 
        });
        if (!resp.ok) {
          const data = await resp.json().catch(() => null);
          throw new Error(data?.error || `HTTP ${resp.status}`);
        }
        const data = await resp.json();
        if (!cancelled) {
          onLoaded({ ingredientes: data.ingredientes, pasos_preparacion: data.pasos_preparacion });
          setLoading(false);
        }
      } catch (e: unknown) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : 'Error';
          setError(msg);
          onError(msg);
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dish, k, user?.tipoDieta, user?.restricciones, user?.preferencias, user?.patologias]);

  if (loading) return <p className="text-xs opacity-70">Cargando detalles…</p>;
  if (error) return <p className="text-xs text-red-300">{String(error)}</p>;
  return null;
}

