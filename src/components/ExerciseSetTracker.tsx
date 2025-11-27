import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaCheckCircle, FaHistory, FaChevronDown, FaChevronUp } from "react-icons/fa";

interface ExerciseSetTrackerProps {
  exercise: {
    name: string;
    sets: number;
    reps: string | number;
    rpe?: number;
    muscle_group: string;
  };
  week: number;
  day: string;
  planId: string;
  userId: string;
  onSave?: () => void;
  onProgressChange?: (completed: number, total: number) => void;
}

interface SetData {
  setNumber: number;
  weight: number;
  reps: string | number;
  completed: boolean;
}

interface ExerciseHistory {
  history: Array<{
    sets: Array<{ weight: number; setNumber: number }>;
    date: string;
  }>;
  stats: {
    maxWeight: number | null;
    avgWeight: number | null;
    lastWeight: number | null;
    totalSessions: number;
  };
}

export default function ExerciseSetTracker({
  exercise,
  week,
  day,
  planId,
  userId,
  onSave,
  onProgressChange,
}: ExerciseSetTrackerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [sets, setSets] = useState<SetData[]>([]);
  const [history, setHistory] = useState<ExerciseHistory | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const onProgressChangeRef = useRef(onProgressChange);
  const lastNotifiedProgress = useRef<{ completed: number; total: number } | null>(null);
  
  // Actualizar la referencia cuando cambia la función
  useEffect(() => {
    onProgressChangeRef.current = onProgressChange;
  }, [onProgressChange]);

  // Calcular RIR desde RPE (RPE 10 = 0 RIR, RPE 9 = 1 RIR, etc.)
  const getRIR = (rpe?: number): number => {
    if (!rpe) return 3; // Default
    return Math.max(0, 10 - rpe);
  };

  // Calcular intensidad %RM basada en RPE
  const getIntensity = (rpe?: number, setNumber?: number, totalSets?: number): number => {
    if (!rpe) return 75;
    
    // Mapeo RPE a %RM
    const rpeToPercentage: Record<number, number> = {
      6: 65,
      7: 75,
      8: 82,
      9: 88,
      10: 100,
    };

    let base = rpeToPercentage[rpe] || 75;
    
    // Primera serie puede ser 5% menos
    if (setNumber === 1 && totalSets && totalSets > 1) {
      base = base * 0.95;
    }
    
    return Math.round(base);
  };

  // Función para cargar historial
  const loadHistory = useCallback(async () => {
    if (loadingHistory || !userId || !exercise.name || !planId) return; // Evitar cargas duplicadas
    
    setLoadingHistory(true);
    try {
      const response = await fetch(
        `/api/getExerciseHistory?userId=${userId}&exerciseName=${encodeURIComponent(exercise.name)}&planId=${planId}`
      );
      if (response.ok) {
        const data = await response.json();
        setHistory(data);
        
        // Cargar los datos de la sesión más reciente para pre-llenar
        if (data.history && data.history.length > 0) {
          const latestSession = data.history[0];
          if (latestSession.sets && latestSession.sets.length > 0) {
            // Mapear los sets guardados a nuestro formato
            const loadedSets: SetData[] = Array.from({ length: exercise.sets }, (_, i) => {
              const savedSet = latestSession.sets.find((s: { setNumber: number }) => s.setNumber === i + 1);
              return {
                setNumber: i + 1,
                weight: savedSet?.weight || 0,
                reps: savedSet?.reps || exercise.reps,
                completed: savedSet?.completed || false,
              };
            });
            setSets(loadedSets);
            
            // Si hay datos guardados, expandir automáticamente
            if (loadedSets.some(s => s.weight > 0 || s.completed)) {
              setIsExpanded(true);
            }
            
            // Notificar progreso cargado después de un delay para evitar loops
            setTimeout(() => {
              const completed = loadedSets.filter(s => s.completed).length;
              if (onProgressChangeRef.current) {
                onProgressChangeRef.current(completed, exercise.sets);
                // Actualizar el último valor notificado
                lastNotifiedProgress.current = { completed, total: exercise.sets };
              }
            }, 200);
          }
        }
      } else {
        console.error("Error en respuesta:", response.status, response.statusText);
      }
    } catch (error) {
      console.error("Error cargando historial:", error);
    } finally {
      setLoadingHistory(false);
    }
  }, [loadingHistory, userId, exercise.name, planId, exercise.sets, exercise.reps]);

  // Inicializar sets
  useEffect(() => {
    const initialSets: SetData[] = Array.from({ length: exercise.sets }, (_, i) => ({
      setNumber: i + 1,
      weight: 0,
      reps: exercise.reps,
      completed: false,
    }));
    setSets(initialSets);
    // NO notificar progreso inicial aquí para evitar loops
    // El progreso se notificará cuando el usuario interactúe con los sets
  }, [exercise.sets, exercise.reps]);

  // Cargar historial solo cuando se expande (para evitar demasiadas peticiones simultáneas)
  // El progreso se carga desde plan.tsx, aquí solo cargamos el historial completo cuando se necesita
  useEffect(() => {
    if (isExpanded && !history && !loadingHistory && userId && exercise.name && planId) {
      loadHistory();
    }
  }, [isExpanded, history, loadingHistory, userId, exercise.name, planId, loadHistory]);

  const handleWeightChange = (setNumber: number, weight: number) => {
    setSets((prev) =>
      prev.map((set) =>
        set.setNumber === setNumber
          ? { ...set, weight: Math.max(0, weight) }
          : set
      )
    );
    setSaved(false);
  };

  const handleSetComplete = (setNumber: number) => {
    setSets((prev) => {
      const updated = prev.map((set) =>
        set.setNumber === setNumber
          ? { ...set, completed: !set.completed }
          : set
      );
      return updated;
    });
  };

  // Notificar cambio de progreso cuando cambian los sets (con debounce para evitar loops)
  useEffect(() => {
    if (sets.length === 0) return;
    
    const completed = sets.filter(s => s.completed).length;
    const total = exercise.sets;
    
    // Solo notificar si el progreso realmente cambió
    if (
      lastNotifiedProgress.current &&
      lastNotifiedProgress.current.completed === completed &&
      lastNotifiedProgress.current.total === total
    ) {
      return; // No notificar si no cambió
    }
    
    // Usar un timeout para evitar llamadas excesivas
    const timeoutId = setTimeout(() => {
      if (onProgressChangeRef.current) {
        onProgressChangeRef.current(completed, total);
        lastNotifiedProgress.current = { completed, total };
      }
    }, 100); // Debounce más largo para evitar loops
    
    return () => clearTimeout(timeoutId);
  }, [sets, exercise.sets]);

  const handleSave = async () => {
    if (sets.every((s) => s.weight === 0)) {
      return; // No guardar si no hay pesos
    }

    setSaving(true);
    try {
      const response = await fetch("/api/saveExerciseWeights", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          planId,
          exerciseName: exercise.name,
          week,
          day,
          sets: sets.map((s) => ({
            setNumber: s.setNumber,
            weight: s.weight,
            reps: s.reps,
            completed: s.completed,
            date: new Date().toISOString(),
          })),
        }),
      });

      if (response.ok) {
        setSaved(true);
        if (onSave) onSave();
        // Recargar historial para actualizar estadísticas
        await loadHistory();
        setTimeout(() => setSaved(false), 2000);
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error("Error al guardar:", errorData);
        alert("Error al guardar los datos. Por favor, intenta nuevamente.");
      }
    } catch (error) {
      console.error("Error guardando pesos:", error);
    } finally {
      setSaving(false);
    }
  };

  // Calcular peso sugerido
  const referenceWeight = history?.stats?.maxWeight || history?.stats?.lastWeight || null;
  const getSuggestedWeight = (setNumber: number): number | null => {
    if (!referenceWeight) return null;
    const intensity = getIntensity(exercise.rpe, setNumber, exercise.sets);
    const estimatedRM = referenceWeight / 0.9;
    return Math.round((estimatedRM * intensity) / 100);
  };

  const rir = getRIR(exercise.rpe);

  return (
    <div className="mt-3 border-t border-white/10 pt-3">
      {/* Botón para expandir/colapsar */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between text-sm font-medium text-cyan-300 hover:text-cyan-200 transition-colors mb-2"
      >
        <span className="flex items-center gap-2">
          {isExpanded ? <FaChevronUp className="text-xs" /> : <FaChevronDown className="text-xs" />}
          <span>Registrar series</span>
        </span>
        {history && history.stats.totalSessions > 0 && (
          <span className="text-xs text-white/50">
            {history.stats.totalSessions} sesiones
          </span>
        )}
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
            {/* Tabla compacta de series */}
            <div className="space-y-2">
        {/* Header de la tabla */}
        <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-2 text-xs font-medium text-white/70 pb-1 border-b border-white/10">
          <div className="text-center">Series x Repeticiones</div>
          <div className="text-center">RIR</div>
          <div className="text-center">Intensidad</div>
          <div className="text-center">Peso (kg)</div>
          <div className="w-6"></div>
        </div>

        {/* Filas de series */}
        {sets.map((set) => {
          const intensity = getIntensity(exercise.rpe, set.setNumber, exercise.sets);
          const suggestedWeight = getSuggestedWeight(set.setNumber);

          return (
            <motion.div
              key={set.setNumber}
              className={`grid grid-cols-[auto_1fr_auto_auto_auto] gap-2 items-center p-2 rounded-lg transition-colors ${
                set.completed
                  ? "bg-green-500/10 border border-green-500/30"
                  : "bg-white/5 border border-white/10"
              }`}
            >
              {/* SxR */}
              <div className="text-xs font-medium text-white/90 text-center min-w-[50px]">
                {set.setNumber} x {set.reps}
              </div>

              {/* RIR */}
              <div className="text-xs text-white/70 text-center">
                {rir}
              </div>

              {/* Intensidad */}
              <div className="text-xs text-white/70 text-center min-w-[60px]">
                {intensity}% RM
              </div>

              {/* Input de peso */}
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={set.weight || ""}
                  onChange={(e) =>
                    handleWeightChange(
                      set.setNumber,
                      parseFloat(e.target.value) || 0
                    )
                  }
                  onBlur={() => {
                    if (sets.some(s => s.weight > 0)) {
                      handleSave();
                    }
                  }}
                  placeholder={suggestedWeight ? suggestedWeight.toString() : "0"}
                  className="w-16 px-2 py-1 text-xs bg-white/10 border border-white/20 rounded text-white placeholder-white/40 focus:outline-none focus:border-cyan-500/50 focus:bg-white/15 text-center"
                />
              </div>

              {/* Checkbox de completado */}
              <button
                onClick={() => {
                  handleSetComplete(set.setNumber);
                  if (set.weight > 0) handleSave();
                }}
                className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                  set.completed
                    ? "bg-green-500 border-green-500"
                    : "border-white/30 hover:border-white/50"
                }`}
              >
                {set.completed && (
                  <FaCheckCircle className="text-[10px] text-white" />
                )}
              </button>
            </motion.div>
          );
        })}
      </div>

            {/* Info de historial (compacta) */}
            <div className="mt-2 flex items-center gap-3 text-[10px] text-white/50">
              {history && history.stats.totalSessions > 0 && (
                <>
                  <FaHistory className="text-[10px]" />
                  <span>
                    Máx: {history.stats.maxWeight?.toFixed(1)}kg | 
                    Prom: {history.stats.avgWeight?.toFixed(1)}kg | 
                    Sesiones: {history.stats.totalSessions}
                  </span>
                </>
              )}
              {saving && (
                <span className="text-cyan-400 ml-auto">Guardando...</span>
              )}
              {saved && !saving && (
                <span className="text-green-400 ml-auto">✓ Guardado</span>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
