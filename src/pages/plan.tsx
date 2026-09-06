import { useRouter } from "next/router";
import Head from "next/head";
import dynamic from "next/dynamic";
import React, { useEffect, useState, useRef, useMemo, type ReactNode, type ReactElement } from "react";
import { usePlanStore } from "@/store/planStore";
import { motion, AnimatePresence } from "framer-motion";
import type { Goal, TipoDieta, Intensidad, UserInput, PlanMultiFase } from "@/types/plan";
import { obtenerInfoFaseActual, calcularProgresoTotal } from "@/types/plan";
import { calculateBMI, bmiCategory, calculateBodyFatUSNavy, bodyFatCategory, waistToHeightRatio, whtrCategory, calculateBMR, calculateTDEE, sugerirEntrenamiento, calcularProyeccionesMotivacionales, analizarCambiosEntrenamiento, calcularCaloriasObjetivoPorMeta, calcularMacrosObjetivo, clampCaloriesToSafeFloor } from "@/utils/calculations";
import Navbar from "@/components/Navbar";
import type { TrainingDayPlan, TrainingWeekPlan } from "@/types/plan";
import { getAuthSafe, getDbSafe } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { useAuthStore } from "@/store/authStore";
import { FaUtensils, FaChartLine } from "react-icons/fa";
import ExerciseDemoMedia from "@/components/ExerciseDemoMedia";
import { useAppLocale } from "@/contexts/AppLocaleContext";
import { p, pFmt, exerciseCountLabel, dietTypeLabel, intensityLabel } from "@/lib/i18n/planUi";
import { goalLabel, difficultyLabel } from "@/lib/i18n/appUi";
import { translatePlanDayLabel, translateMealSlotName, translateMuscleGroup } from "@/lib/i18n/planContentLocale";
import { loadCachedPlanSnapshot, saveCachedPlanSnapshot } from "@/lib/planLocalCache";

const PremiumPlanModal = dynamic(() => import("@/components/PremiumPlanModal"), { ssr: false });
const FoodTrackingModal = dynamic(() => import("@/components/FoodTrackingModal"), { ssr: false });
const WeeklyStatsModal = dynamic(() => import("@/components/WeeklyStatsModal"), { ssr: false });
const IMCInfoModal = dynamic(() => import("@/components/IMCInfoModal"), { ssr: false });
const PlanContinuityModal = dynamic(() => import("@/components/PlanContinuityModal"), { ssr: false });
const MonthChangesModal = dynamic(() => import("@/components/MonthChangesModal"), { ssr: false });

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
  demo_video_url?: string;
  demo_poster_url?: string;
  // Campos legacy (para compatibilidad)
  url?: string;
  rest_sec?: number;
  alt?: string[];
}

interface TrainingPlan {
  split?: string; // Tipo de división de entrenamiento: "Full Body", "Upper/Lower", "Push/Pull/Legs", etc.
  weeks?: TrainingWeek[];
  exercise_media_overrides?: Record<string, { demo_video_url?: string; demo_poster_url?: string }>;
}

export default function PlanPage() {
  const router = useRouter();
  const { plan, user, planId, planMultiFase, planCreatedAt, setUser, setPlan, setPlanId, setPlanMultiFase, setPlanCreatedAt } = usePlanStore();
  const { user: authUser } = useAuthStore();
  const { locale } = useAppLocale();
  const [recoveringPlan, setRecoveringPlan] = useState(false);
  const [cacheNotice, setCacheNotice] = useState<string | null>(null);

  useEffect(() => {
    // Al refrescar, el store se limpia. Intentamos rehidratar el último plan del usuario
    // para evitar redirigirlo fuera de /plan si ya tenía un plan guardado.
    if (plan && user) return;

    let cancelled = false;

    const recoverPlanFromFirestore = async () => {
      if (typeof window === "undefined") return;
      const uid = authUser?.uid || getAuthSafe()?.currentUser?.uid;
      if (!uid) {
        router.replace("/");
        return;
      }

      setRecoveringPlan(true);
      const recoverFromCache = () => {
        const cached = loadCachedPlanSnapshot(uid);
        if (!cached) return false;
        setUser(cached.user);
        setPlan(cached.plan);
        setPlanId(cached.planId);
        setPlanMultiFase(cached.planMultiFase);
        setPlanCreatedAt(cached.planCreatedAt);
        setCacheNotice(
          locale === "en"
            ? "Showing your latest saved plan due to temporary connectivity issues."
            : "Mostrando tu ultimo plan guardado por un problema temporal de conectividad."
        );
        return true;
      };
      try {
        const db = getDbSafe();
        if (!db) {
          if (!recoverFromCache()) router.replace("/");
          return;
        }

        const { collection, query, where, limit, getDocs } = await import("firebase/firestore");
        const q = query(collection(db, "planes"), where("userId", "==", uid), limit(20));
        const snapshot = await getDocs(q);

        if (cancelled) return;
        if (snapshot.empty) {
          if (!recoverFromCache()) router.replace("/dashboard");
          return;
        }

        const docs = snapshot.docs;
        const parseDate = (value: unknown): Date | null => {
          if (!value) return null;
          if (typeof value === "object" && value && "toDate" in (value as Record<string, unknown>)) {
            return (value as { toDate: () => Date }).toDate();
          }
          if (typeof value === "object" && value && "seconds" in (value as Record<string, unknown>)) {
            const ts = value as { seconds: number; nanoseconds?: number };
            return new Date(ts.seconds * 1000 + (ts.nanoseconds || 0) / 1000000);
          }
          if (typeof value === "string" || typeof value === "number") {
            const d = new Date(value);
            return isNaN(d.getTime()) ? null : d;
          }
          return null;
        };

        const bestDoc = docs
          .map((d) => {
            const data = d.data() as Record<string, unknown>;
            const updatedAt = parseDate(data.updatedAt);
            const createdAt = parseDate(data.createdAt);
            const score = (updatedAt || createdAt)?.getTime() || 0;
            return { d, score };
          })
          .sort((a, b) => b.score - a.score)[0]?.d;

        if (!bestDoc) {
          if (!recoverFromCache()) router.replace("/dashboard");
          return;
        }

        const data = bestDoc.data() as Record<string, unknown>;
        const nested = data.plan as { user?: UserInput; plan?: import("@/types/plan").PlanAIResponse } | undefined;

        if (!nested?.user || !nested?.plan) {
          if (!recoverFromCache()) router.replace("/dashboard");
          return;
        }

        setUser(nested.user);
        setPlan(nested.plan);
        setPlanId(bestDoc.id);

        const mpf = (data.planMultiFase || (nested.plan as unknown as Record<string, unknown>)?.planMultiFase) as PlanMultiFase | undefined;
        setPlanMultiFase(mpf);

        const createdAt = parseDate(data.createdAt);
        if (createdAt) {
          setPlanCreatedAt(createdAt.toISOString());
        }
        saveCachedPlanSnapshot(uid, {
          planId: bestDoc.id,
          user: nested.user,
          plan: nested.plan,
          planMultiFase: mpf,
          planCreatedAt: createdAt ? createdAt.toISOString() : undefined,
        });
        setCacheNotice(null);
      } catch (error) {
        console.error("Error rehidratando plan al refrescar:", error);
        if (!cancelled && !recoverFromCache()) router.replace("/");
      } finally {
        if (!cancelled) setRecoveringPlan(false);
      }
    };

    void recoverPlanFromFirestore();

    return () => {
      cancelled = true;
    };
  }, [plan, user, authUser?.uid, router, setPlan, setPlanCreatedAt, setPlanId, setPlanMultiFase, setUser]);

  // Estado local para la fecha de inicio del plan (se carga desde store o Firestore)
  const [fechaInicioPlan, setFechaInicioPlan] = useState<Date | null>(null);
  const [loadingFechaInicio, setLoadingFechaInicio] = useState(true);

  // Cargar fecha de creación desde el store o Firestore
  useEffect(() => {
    // Asegurar que solo se ejecute en el cliente
    if (typeof window === 'undefined') return;
    
    if (!planId) {
      setLoadingFechaInicio(false);
      return;
    }

    const loadCreatedAt = async () => {
      try {
        // Primero intentar usar planCreatedAt del store si está disponible
        if (planCreatedAt) {
          const d = new Date(planCreatedAt);
          if (!isNaN(d.getTime())) {
            d.setHours(0, 0, 0, 0);
            setFechaInicioPlan(d);
            setLoadingFechaInicio(false);
            console.log('✅ Fecha de creación desde store:', d.toISOString());
            return;
          }
        }

        // Si no está en el store, cargar desde Firestore
        try {
          const db = getDbSafe();
          if (!db) {
            console.warn('⚠️ Firestore no disponible, usando fecha actual como fallback');
            setLoadingFechaInicio(false);
            return;
          }
          
          const planRef = doc(db, "planes", planId);
          const planDoc = await getDoc(planRef);
          
          if (planDoc.exists()) {
            const data = planDoc.data();
            const createdAt = data.createdAt;
            
            if (createdAt) {
              let createdDate: Date;
              // Manejar diferentes formatos de timestamp de Firestore
              if (createdAt && typeof createdAt === 'object' && 'toDate' in createdAt) {
                createdDate = (createdAt as { toDate: () => Date }).toDate();
              } else if (createdAt && typeof createdAt === 'object' && 'seconds' in createdAt) {
                const ts = createdAt as { seconds: number; nanoseconds?: number };
                createdDate = new Date(ts.seconds * 1000 + (ts.nanoseconds || 0) / 1000000);
              } else if (typeof createdAt === 'string') {
                createdDate = new Date(createdAt);
              } else {
                console.warn('⚠️ No se pudo parsear la fecha de creación');
                setLoadingFechaInicio(false);
                return; // No podemos parsear la fecha
              }
              
              // Normalizar a inicio del día
              createdDate.setHours(0, 0, 0, 0);
              setFechaInicioPlan(createdDate);
              
              // Guardar en el store para uso futuro
              setPlanCreatedAt(createdDate.toISOString());
              console.log('✅ Fecha de creación cargada desde Firestore:', createdDate.toISOString());
            } else {
              console.warn('⚠️ No se encontró createdAt en el documento del plan');
            }
          } else {
            console.warn('⚠️ Plan no encontrado en Firestore');
          }
        } catch (firestoreError) {
          console.error('Error al acceder a Firestore:', firestoreError);
          // No lanzar el error, solo loguearlo
        }
      } catch (error) {
        console.error('Error al cargar fecha de creación del plan:', error);
        // No lanzar el error para evitar que rompa la página
      } finally {
        setLoadingFechaInicio(false);
      }
    };
    
    loadCreatedAt();
  }, [planId, planCreatedAt, setPlanCreatedAt]);

  // Limpiar caché de localStorage al entrar a cada plan
  useEffect(() => {
    if (typeof window === 'undefined' || !plan || !user || !planId) return;

    try {
      // Mantener claves útiles (registros de peso, etc.) y solo limpiar las que ya no se usan
      const fechaInicioKey = `fecha_inicio_${user.nombre}_${plan.duracion_plan_dias || 30}`;
      localStorage.removeItem(fechaInicioKey);
    } catch (error) {
      console.error('Error al limpiar localStorage:', error);
    }
  }, [plan, user, planId]);

  useEffect(() => {
    if (typeof window === "undefined" || !plan || !user || !planId) return;
    const uid = authUser?.uid || getAuthSafe()?.currentUser?.uid;
    if (!uid) return;
    saveCachedPlanSnapshot(uid, {
      planId,
      user,
      plan,
      planMultiFase,
      planCreatedAt,
    });
  }, [authUser?.uid, plan, user, planId, planMultiFase, planCreatedAt]);
  
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
  const [isPremium, setIsPremium] = useState(false);
  const [premiumModalOpen, setPremiumModalOpen] = useState(false);
  
  // Estado para modales de información (tooltips)
  const [modalInfoAbierto, setModalInfoAbierto] = useState<'imc' | 'macros' | 'sueno' | 'dificultad' | 'split' | null>(null);
  const [modalEntrenamientoAbierto, setModalEntrenamientoAbierto] = useState(false);
  const [semanaSeleccionada, setSemanaSeleccionada] = useState<number>(1);
  const [diasExpandidos, setDiasExpandidos] = useState<Record<string, boolean>>({});
  const [vistaPlan, setVistaPlan] = useState<'entrenamiento' | 'alimentacion'>('alimentacion');
  const [calendarResetKey, setCalendarResetKey] = useState(0);
  // Estados para calendario de entrenamiento
  const [selectedTrainingDate, setSelectedTrainingDate] = useState<Date | null>(null);
  const [selectedDayData, setSelectedDayData] = useState<{ day: TrainingDayPlan; week: number; dayIndex: number } | null>(null);
  // Estado separado para el progreso del día seleccionado (evita loops)
  const [selectedDayProgress, setSelectedDayProgress] = useState<Record<string, { completed: number; total: number }>>({});
  const [foodTrackingModalOpen, setFoodTrackingModalOpen] = useState(false);
  const [weeklyStatsModalOpen, setWeeklyStatsModalOpen] = useState(false);
  const [imcModalOpen, setImcModalOpen] = useState(false);
  
  
  // Ref para prevenir procesamiento duplicado (sin llamadas al backend)
  const processingSelectionRef = useRef(false);
  
  // FUNCIÓN ELIMINADA: loadExerciseProgressForDay
  // Ya no se hacen llamadas al backend al seleccionar un día del calendario
  // Solo se muestran los datos del plan que ya están cargados en memoria
  
  // Componente rediseñado para registrar pesos con RM y porcentajes de esfuerzo
  function ExerciseWeightTracker({
    exercise,
    exerciseIndex,
    week,
    dayIndex,
    dayName,
    planId,
    userId,
    date,
  }: {
    exercise: TrainingExercise;
    exerciseIndex?: number;
    week: number;
    dayIndex: number;
    dayName: string;
    planId?: string;
    userId?: string;
    date?: Date | null;
  }) {
    const [weights, setWeights] = useState<number[]>(() => Array(exercise.sets).fill(0));
    const [reps, setReps] = useState<number[]>(() => Array(exercise.sets).fill(0));
    const [rm, setRm] = useState<number | null>(null);
    const [percentages, setPercentages] = useState<number[]>([]);
    const [previousWeights, setPreviousWeights] = useState<number[] | null>(null);
    const [previousReps, setPreviousReps] = useState<number[] | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [comparison, setComparison] = useState<"better" | "same" | "worse" | null>(null);
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const weightsRef = useRef(weights);
    const repsRef = useRef(reps);
    const rmRef = useRef(rm);
    
    // Mantener refs actualizados para el cleanup
    useEffect(() => {
      weightsRef.current = weights;
    }, [weights]);
    
    useEffect(() => {
      repsRef.current = reps;
    }, [reps]);
    
    useEffect(() => {
      rmRef.current = rm;
    }, [rm]);
    
    // Cleanup: guardar valores pendientes cuando el componente se desmonte
    useEffect(() => {
      return () => {
        // Cancelar timeout pendiente y guardar inmediatamente
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
          // Guardar los valores actuales antes de desmontar
          const currentWeights = weightsRef.current;
          const currentReps = repsRef.current;
          const currentRm = rmRef.current;
          
          if (currentWeights.some(w => w > 0) || currentReps.some(r => r > 0) || currentRm) {
            // Guardar en localStorage como backup inmediato
            const storageKey = `exercise_weight_${userId || 'local'}_${planId || 'local'}_${exercise.name}_${week}_${dayIndex}_${dayName}`;
            if (typeof window !== "undefined") {
              localStorage.setItem(storageKey, JSON.stringify(currentWeights));
              localStorage.setItem(`${storageKey}_reps`, JSON.stringify(currentReps));
              if (currentRm !== null && currentRm > 0) {
                localStorage.setItem(`${storageKey}_rm`, currentRm.toString());
              }
            }
            
            // Intentar guardar en Firestore (sin await para no bloquear el desmontaje)
            if (planId && userId) {
              // Usar los valores actuales del estado a través de los refs
              const saveData = async () => {
                try {
                  const { getDbSafe } = await import("@/lib/firebase");
                  const { collection, query, where, getDocs, setDoc, doc, serverTimestamp } = await import("firebase/firestore");
                  const db = getDbSafe();
                  
                  if (db) {
                    const weightData = {
                      userId,
                      planId,
                      exerciseName: exercise.name,
                      week,
                      day: dayName,
                      dayIndex,
                      rm: currentRm !== null && currentRm > 0 ? currentRm : null,
                      sets: currentWeights.map((weight, i) => ({
                        setNumber: i + 1,
                        weight,
                        reps: exercise.reps,
                        actualReps: currentReps[i] > 0 ? currentReps[i] : null,
                        percentage: null, // No calculamos porcentajes en cleanup
                        completed: weight > 0,
                        date: new Date().toISOString(),
                      })),
                      date: date ? date.toISOString() : new Date().toISOString(),
                      updatedAt: serverTimestamp(),
                    };
                    
                    const existingQuery = query(
                      collection(db, "exercise_weights"),
                      where("userId", "==", userId),
                      where("planId", "==", planId),
                      where("exerciseName", "==", exercise.name),
                      where("week", "==", week),
                      where("day", "==", dayName),
                      where("dayIndex", "==", dayIndex)
                    );
                    
                    const existingDocs = await getDocs(existingQuery);
                    
                    if (!existingDocs.empty) {
                      const existingDoc = existingDocs.docs[0];
                      const docRef = doc(db, "exercise_weights", existingDoc.id);
                      await setDoc(docRef, weightData, { merge: true });
                    } else {
                      const docRef = doc(collection(db, "exercise_weights"));
                      await setDoc(docRef, {
                        ...weightData,
                        createdAt: serverTimestamp(),
                      });
                    }
                  }
                } catch (e) {
                  console.error("Error guardando en cleanup:", e);
                }
              };
              
              saveData();
            }
          }
        }
      };
    }, [planId, userId, exercise.name, exercise.reps, week, dayIndex, dayName, date]);

    // Cargar pesos anteriores y RM desde Firestore y localStorage
    useEffect(() => {
      const loadPrevious = async () => {
        if (!exercise.name) {
          setLoading(false);
          return;
        }

        try {
          // Primero intentar cargar desde localStorage (más rápido)
          const storageKey = `exercise_weight_${userId || 'local'}_${planId || 'local'}_${exercise.name}_${week}_${dayIndex}_${dayName}`;
          if (typeof window !== "undefined") {
            const saved = localStorage.getItem(storageKey);
            if (saved) {
              try {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length === exercise.sets) {
                  setWeights(parsed);
                }
              } catch (e) {
                console.error("Error parseando localStorage:", e);
              }
            }

            // Cargar RM desde localStorage con precisión completa
            const savedRm = localStorage.getItem(`${storageKey}_rm`);
            if (savedRm) {
              const rmValue = parseFloat(savedRm);
              if (!isNaN(rmValue) && rmValue > 0) {
                setRm(rmValue);
                console.log("📥 RM cargado desde localStorage:", rmValue, "tipo:", typeof rmValue);
              }
            }
            
            // Cargar repeticiones desde localStorage
            const savedReps = localStorage.getItem(`${storageKey}_reps`);
            if (savedReps) {
              try {
                const parsed = JSON.parse(savedReps);
                if (Array.isArray(parsed) && parsed.length === exercise.sets) {
                  setReps(parsed);
                }
              } catch (e) {
                console.error("Error parseando repeticiones desde localStorage:", e);
              }
            }
          }

          // Luego cargar desde Firestore
          if (planId && userId) {
            const { getDbSafe } = await import("@/lib/firebase");
            const { collection, query, where, orderBy, limit, getDocs } = await import("firebase/firestore");
            const db = getDbSafe();
            
            if (db) {
              // Primero intentar cargar el registro específico de este día
              const specificQuery = query(
                collection(db, "exercise_weights"),
                where("userId", "==", userId),
                where("planId", "==", planId),
                where("exerciseName", "==", exercise.name),
                where("week", "==", week),
                where("day", "==", dayName),
                where("dayIndex", "==", dayIndex)
              );
              
              const specificSnap = await getDocs(specificQuery);
              
              if (!specificSnap.empty) {
                // Cargar los pesos y repeticiones del día específico
                const data = specificSnap.docs[0].data();
                if (data.sets?.length) {
                  // Ordenar los sets por setNumber para asegurar el orden correcto
                  const sortedSets = [...data.sets].sort((a: { setNumber: number }, b: { setNumber: number }) => 
                    (a.setNumber || 0) - (b.setNumber || 0)
                  );
                  const dayWeights = sortedSets.map((s: { weight: number }) => s.weight || 0);
                  const dayReps = sortedSets.map((s: { actualReps?: number; reps?: number | string }) => {
                    // Priorizar actualReps (repeticiones reales), luego reps
                    if (s.actualReps !== undefined && s.actualReps !== null) {
                      return typeof s.actualReps === 'number' ? s.actualReps : parseInt(String(s.actualReps)) || 0;
                    }
                    // Si no hay actualReps, intentar parsear reps
                    if (s.reps !== undefined && s.reps !== null) {
                      const repsValue = typeof s.reps === 'number' ? s.reps : parseInt(String(s.reps)) || 0;
                      return repsValue;
                    }
                    return 0;
                  });
                  console.log("📥 Pesos del día cargados:", dayWeights, "Repeticiones:", dayReps);
                  setWeights(dayWeights);
                  setReps(dayReps);
                }
              }
              
              // Cargar el RM del ÚLTIMO registro de este ejercicio (sin importar el día)
              // Esto asegura que siempre se muestre el último RM que pusiste
              const rmQuery = query(
                collection(db, "exercise_weights"),
                where("userId", "==", userId),
                where("planId", "==", planId),
                where("exerciseName", "==", exercise.name),
                orderBy("date", "desc"),
                limit(10) // Buscar en los últimos 10 registros
              );
              
              const rmSnap = await getDocs(rmQuery);
              
              if (!rmSnap.empty) {
                // Buscar el primer registro que tenga RM
                for (const doc of rmSnap.docs) {
                  const rmData = doc.data();
                  if (rmData.rm !== null && rmData.rm !== undefined) {
                    const rmValue = typeof rmData.rm === 'number' ? rmData.rm : parseFloat(rmData.rm);
                    if (!isNaN(rmValue) && rmValue > 0) {
                      setRm(rmValue);
                      console.log("📥 RM cargado desde Firestore (último valor):", rmValue, "del día:", rmData.day, "semana:", rmData.week);
                      break; // Usar el primero que encontremos con RM
                    }
                  }
                }
              }
              
              // Buscar el último registro de este ejercicio de OTRO día (para mostrar como "anterior")
              // IMPORTANTE: No mostrar valores del mismo día como "anteriores"
              const lastQuery = query(
                collection(db, "exercise_weights"),
                where("userId", "==", userId),
                where("planId", "==", planId),
                where("exerciseName", "==", exercise.name),
                orderBy("date", "desc"),
                limit(50) // Buscar más registros para asegurar encontrar uno de otro día
              );
              
              const lastSnap = await getDocs(lastQuery);
              
              if (!lastSnap.empty) {
                // Obtener la fecha del día actual para comparación más precisa
                const currentDateStr = date ? new Date(date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
                
                // Buscar el primer registro que NO sea del mismo día y que tenga sets válidos
                for (const doc of lastSnap.docs) {
                  const lastData = doc.data();
                  
                  // Comparación más estricta: verificar semana, día, dayIndex Y fecha
                  const isSameDay = lastData.week === week && 
                                   lastData.day === dayName && 
                                   lastData.dayIndex === dayIndex;
                  
                  // También comparar por fecha si está disponible
                  let isSameDate = false;
                  if (lastData.date) {
                    const lastDateStr = typeof lastData.date === 'string' 
                      ? lastData.date.split('T')[0] 
                      : new Date(lastData.date).toISOString().split('T')[0];
                    isSameDate = lastDateStr === currentDateStr;
                  }
                  
                  // Excluir si es el mismo día O la misma fecha
                  if (isSameDay || isSameDate) {
                    console.log("⏭️ Saltando registro del mismo día:", {
                      semana: lastData.week,
                      dia: lastData.day,
                      dayIndex: lastData.dayIndex,
                      fecha: lastData.date,
                      esMismoDia: isSameDay,
                      esMismaFecha: isSameDate
                    });
                    continue; // Saltar este registro, es del mismo día
                  }
                  
                  // Si encontramos un registro de otro día, usarlo como "anterior"
                  if (lastData.sets?.length && Array.isArray(lastData.sets)) {
                    // Ordenar los sets por setNumber para asegurar el orden correcto
                    const sortedSets = [...lastData.sets]
                      .filter((s: { setNumber: number; weight: number } | undefined) => s && typeof s === 'object' && 'setNumber' in s && 'weight' in s)
                      .sort((a: { setNumber: number }, b: { setNumber: number }) => 
                        (a.setNumber || 0) - (b.setNumber || 0)
                      );
                    
                    // Mapear solo si tenemos sets válidos
                    if (sortedSets.length > 0) {
                      const prevWeights = sortedSets.map((s: { weight: number }) => {
                        const weight = s.weight;
                        // Validar que el peso sea un número válido
                        return (typeof weight === 'number' && !isNaN(weight) && weight >= 0) ? weight : 0;
                      });
                      
                      const prevReps = sortedSets.map((s: { setNumber: number; weight: number; actualReps?: number; reps?: number | string }) => {
                        // Priorizar actualReps (repeticiones reales), luego reps
                        if (s.actualReps !== undefined && s.actualReps !== null) {
                          return typeof s.actualReps === 'number' ? s.actualReps : parseInt(String(s.actualReps)) || 0;
                        }
                        if (s.reps !== undefined && s.reps !== null) {
                          const repsValue = typeof s.reps === 'number' ? s.reps : parseInt(String(s.reps)) || 0;
                          return repsValue;
                        }
                        return 0;
                      });
                      
                      // Solo usar si hay al menos un peso mayor a 0
                      if (prevWeights.some(w => w > 0)) {
                        console.log("📥 Pesos anteriores cargados (de OTRO día):", {
                          pesos: prevWeights,
                          repeticiones: prevReps,
                          setsOriginales: lastData.sets,
                          setsOrdenados: sortedSets,
                          delDia: lastData.day,
                          semana: lastData.week,
                          dayIndex: lastData.dayIndex,
                          fecha: lastData.date,
                          ejercicio: exercise.name,
                          diaActual: { week, day: dayName, dayIndex, fecha: currentDateStr }
                        });
                        setPreviousWeights(prevWeights);
                        setPreviousReps(prevReps);
                        break; // Usar el primero que encontremos de otro día con datos válidos
                      }
                    }
                  }
                }
              }
            }
          }
        } catch (e) {
          console.error("Error cargando pesos anteriores:", e);
        } finally {
          setLoading(false);
        }
      };

      loadPrevious();
    }, [exercise.name, exercise.sets, planId, userId, week, dayIndex, dayName, date]);

    // Calcular porcentajes basados en RM y RPE usando OpenAI
    useEffect(() => {
      const calculatePercentages = async () => {
        if (!rm || rm <= 0) {
          setPercentages([]);
          return;
        }

        try {
          // Llamar a OpenAI para calcular porcentajes basados en RPE y series
          const response = await fetch("/api/calculateExercisePercentages", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              rm,
              sets: exercise.sets,
              reps: exercise.reps,
              rpe: exercise.rpe || 8,
            }),
          });

          if (response.ok) {
            const data = await response.json();
            setPercentages(data.percentages || []);
          } else {
            // Fallback: cálculo manual básico
            const basePercentage = exercise.rpe ? 
              (exercise.rpe >= 9 ? 90 : exercise.rpe >= 8 ? 85 : exercise.rpe >= 7 ? 80 : 75) : 80;
            const calculated = Array(exercise.sets).fill(0).map((_, i) => {
              // Primera serie puede ser 5% menos, última serie igual
              if (i === 0 && exercise.sets > 1) return basePercentage - 5;
              return basePercentage;
            });
            setPercentages(calculated);
          }
        } catch (e) {
          console.error("Error calculando porcentajes:", e);
          // Fallback manual
          const basePercentage = exercise.rpe ? 
            (exercise.rpe >= 9 ? 90 : exercise.rpe >= 8 ? 85 : exercise.rpe >= 7 ? 80 : 75) : 80;
          const calculated = Array(exercise.sets).fill(0).map((_, i) => {
            if (i === 0 && exercise.sets > 1) return basePercentage - 5;
            return basePercentage;
          });
          setPercentages(calculated);
        }
      };

      calculatePercentages();
    }, [rm, exercise.sets, exercise.reps, exercise.rpe]);

    // Comparar pesos actuales con anteriores
    useEffect(() => {
      if (!previousWeights || weights.every(w => w === 0)) {
        setComparison(null);
        return;
      }

      const currentAvg = weights.filter(w => w > 0).length > 0
        ? weights.filter(w => w > 0).reduce((a, b) => a + b, 0) / weights.filter(w => w > 0).length
        : 0;
      const previousAvg = previousWeights.reduce((a, b) => a + b, 0) / previousWeights.length;
      
      if (currentAvg === 0) {
        setComparison(null);
        return;
      }
      
      const diff = currentAvg - previousAvg;
      const threshold = 0.5; // kg

      if (Math.abs(diff) < threshold) {
        setComparison("same");
      } else if (diff > 0) {
        setComparison("better");
      } else {
        setComparison("worse");
      }
    }, [weights, previousWeights]);

    const saveWeights = async (weightsToSave: number[]) => {
      // Guardar siempre, incluso si todos los pesos son 0 O si solo hay RM
      // Esto asegura que el RM se guarde siempre y persista
      
      console.log("🔄 Iniciando guardado de pesos:", {
        exercise: exercise.name,
        weights: weightsToSave,
        planId: planId || "NO HAY",
        userId: userId || "NO HAY",
        week,
        dayIndex,
        dayName,
        rm: rm || "NO HAY",
      });

      setSaving(true);
      try {
        // Guardar en localStorage como backup (siempre)
        const storageKey = `exercise_weight_${userId || 'local'}_${planId || 'local'}_${exercise.name}_${week}_${dayIndex}_${dayName}`;
        if (typeof window !== "undefined") {
          localStorage.setItem(storageKey, JSON.stringify(weightsToSave));
          localStorage.setItem(`${storageKey}_reps`, JSON.stringify(reps));
          if (rm !== null && rm > 0) {
            // Guardar RM con precisión completa
            localStorage.setItem(`${storageKey}_rm`, rm.toString());
            console.log("💾 RM guardado en localStorage (desde saveWeights):", rm, "tipo:", typeof rm);
          }
          console.log("💾 Guardado en localStorage:", { storageKey, weights: weightsToSave, reps, rm, rmType: typeof rm });
        }

        // Guardar en Firestore si hay planId y userId
        // IMPORTANTE: Guardar siempre, incluso si solo hay RM (sin pesos)
        if (planId && userId) {
          const { getDbSafe } = await import("@/lib/firebase");
          const { collection, query, where, getDocs, setDoc, doc, serverTimestamp } = await import("firebase/firestore");
          const db = getDbSafe();
          
          if (db) {
            const weightData = {
              userId,
              planId,
              exerciseName: exercise.name,
              week,
              day: dayName,
              dayIndex,
              // Guardar RM con precisión completa, sin redondeo
              rm: rm !== null && rm > 0 ? rm : null,
              sets: weightsToSave.map((weight, i) => ({
                setNumber: i + 1,
                weight,
                reps: exercise.reps, // Repeticiones objetivo del plan
                actualReps: reps[i] > 0 ? reps[i] : null, // Repeticiones reales que hizo el usuario
                percentage: percentages[i] || null,
                completed: weight > 0,
                date: new Date().toISOString(),
              })),
              date: date ? date.toISOString() : new Date().toISOString(),
              updatedAt: serverTimestamp(),
            };
            
            console.log("📤 Guardando en Firestore:", {
              rm: rm !== null && rm > 0 ? rm : null,
              rmTipo: typeof rm,
              pesos: weightsToSave,
              tienePesos: weightsToSave.some(w => w > 0),
              tieneRM: rm !== null && rm > 0
            });

            // Buscar si ya existe un documento para este ejercicio, semana, día y dayIndex
            const existingQuery = query(
              collection(db, "exercise_weights"),
              where("userId", "==", userId),
              where("planId", "==", planId),
              where("exerciseName", "==", exercise.name),
              where("week", "==", week),
              where("day", "==", dayName),
              where("dayIndex", "==", dayIndex)
            );

            const existingDocs = await getDocs(existingQuery);
            
            if (!existingDocs.empty) {
              // Actualizar documento existente - REEMPLAZAR completamente (no merge) para evitar valores antiguos
              const existingDoc = existingDocs.docs[0];
              const docRef = doc(db, "exercise_weights", existingDoc.id);
              // Usar setDoc sin merge para reemplazar completamente el documento
              await setDoc(docRef, {
                ...weightData,
                createdAt: existingDoc.data().createdAt || serverTimestamp(), // Preservar createdAt original
              });
              console.log("✅ Datos actualizados en Firestore (reemplazado completamente). ID:", existingDoc.id, {
                rm: weightData.rm,
                tienePesos: weightData.sets.some(s => s.weight > 0)
              });
            } else {
              // Crear nuevo documento (incluso si solo hay RM, sin pesos)
              const docRef = doc(collection(db, "exercise_weights"));
              await setDoc(docRef, {
                ...weightData,
                createdAt: serverTimestamp(),
              });
              console.log("✅ Nuevo documento creado en Firestore. ID:", docRef.id, {
                rm: weightData.rm,
                tienePesos: weightData.sets.some(s => s.weight > 0)
              });
            }
          } else {
            console.warn("⚠️ Firestore no disponible, solo guardado en localStorage");
          }
        } else {
          console.warn("💾 Guardado solo en localStorage (sin planId/userId)", { 
            planId: planId || "undefined", 
            userId: userId || "undefined" 
          });
        }
        
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } catch (e) {
        console.error("❌ Error guardando pesos:", e);
        // Mostrar error más descriptivo
        const errorMessage = e instanceof Error ? e.message : "Error desconocido";
        console.error("Detalles del error:", errorMessage);
        console.error("Stack:", e instanceof Error ? e.stack : "N/A");
        alert(`Error al guardar: ${errorMessage}. Los datos se guardaron localmente.`);
      } finally {
        setSaving(false);
      }
    };

    const handleWeightChange = (idx: number, val: number) => {
      const next = [...weights];
      next[idx] = Math.max(0, val);
      setWeights(next);
      setSaved(false);
      
      // Guardar inmediatamente en localStorage
      const storageKey = `exercise_weight_${userId || 'local'}_${planId || 'local'}_${exercise.name}_${week}_${dayIndex}_${dayName}`;
      if (typeof window !== "undefined") {
        localStorage.setItem(storageKey, JSON.stringify(next));
        console.log("💾 Guardado inmediato en localStorage:", { serie: idx + 1, peso: val, todos: next });
      }
      
      // Guardar en Firestore con delay corto (500ms) para evitar demasiadas llamadas mientras escribe
      // Pero guardar siempre, incluso si todos son 0 (para limpiar)
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        console.log("⏰ Guardando pesos en Firestore...");
        saveWeights(next);
      }, 500);
    };

    const handleRepsChange = (idx: number, val: number) => {
      const next = [...reps];
      next[idx] = Math.max(0, Math.floor(val)); // Solo números enteros
      setReps(next);
      setSaved(false);
      
      // Guardar inmediatamente en localStorage
      const storageKey = `exercise_weight_${userId || 'local'}_${planId || 'local'}_${exercise.name}_${week}_${dayIndex}_${dayName}`;
      if (typeof window !== "undefined") {
        localStorage.setItem(`${storageKey}_reps`, JSON.stringify(next));
        console.log("💾 Repeticiones guardadas en localStorage:", { serie: idx + 1, reps: val, todos: next });
      }
      
      // Guardar en Firestore con delay corto
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        console.log("⏰ Guardando repeticiones en Firestore...");
        saveWeights(weights);
      }, 500);
    };

    const handleRmChange = (val: number) => {
      console.log("🔄 handleRmChange llamado con:", val, "tipo:", typeof val);
      
      // Preservar el valor exacto, incluso si es 0 (el usuario puede querer limpiar el campo)
      const newRm = val > 0 ? val : null;
      console.log("✅ Nuevo RM establecido:", newRm, "tipo:", typeof newRm);
      setRm(newRm);
      
      // Guardar RM en localStorage inmediatamente con precisión completa
      const storageKey = `exercise_weight_${userId || 'local'}_${planId || 'local'}_${exercise.name}_${week}_${dayIndex}_${dayName}`;
      if (typeof window !== "undefined" && newRm !== null) {
        // Guardar como número completo, sin redondeo
        const rmString = newRm.toString();
        localStorage.setItem(`${storageKey}_rm`, rmString);
        console.log("💾 RM guardado en localStorage:", {
          valor: newRm,
          string: rmString,
          tipo: typeof newRm,
          longitud: rmString.length
        });
      }
      
      // Guardar RM en Firestore inmediatamente (incluso sin pesos)
      // Esto asegura que el RM se guarde siempre y persista para futuros días
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        console.log("⏰ Guardando RM en Firestore...");
        // Guardar RM incluso si no hay pesos todavía
        saveWeights(weights);
      }, 500);
    };

    const getSuggestedWeight = (setIndex: number): number | null => {
      if (!rm || !percentages[setIndex]) return null;
      return Math.round((rm * percentages[setIndex]) / 100);
    };

    const avgWeight = weights.some(w => w > 0)
      ? weights.filter(w => w > 0).reduce((a, b) => a + b, 0) / weights.filter(w => w > 0).length
      : 0;

    const previousAvg = previousWeights
      ? previousWeights.reduce((a, b) => a + b, 0) / previousWeights.length
      : 0;

    if (loading) {
      return (
        <div className="mt-3 pt-3 border-t border-white/10">
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-info"></div>
          </div>
        </div>
      );
    }

    return (
      <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-white/10">
        {/* Header con comparación */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0 mb-3 sm:mb-4">
          <h4 className="font-display text-sm sm:text-base font-semibold text-info flex items-center gap-2">
            💪 Registro de Pesos
          </h4>
          {comparison && previousWeights && (
            <div className={`flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-lg text-xs font-medium ${
              comparison === "better" ? "bg-success/20 text-success border border-success/30" :
              comparison === "worse" ? "bg-danger/20 text-danger border border-danger/30" :
              "bg-info/20 text-info border border-info/30"
            }`}>
              {comparison === "better" && "📈 Mejoraste!"}
              {comparison === "same" && "➡️ Igual"}
              {comparison === "worse" && "📉 Baja"}
              {comparison !== "same" && ` ${Math.abs(avgWeight - previousAvg).toFixed(1)}kg`}
            </div>
          )}
        </div>

        {/* Input de RM */}
        <div className="mb-3 sm:mb-4 p-2 sm:p-3 rounded-lg bg-phase-maintenance/10 border border-phase-maintenance/20">
          <label className="text-xs sm:text-sm font-medium text-phase-maintenance mb-1.5 sm:mb-2 block">
            🎯 RM (Repetición Máxima) - Opcional
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              inputMode="decimal"
              value={rm !== null ? rm.toString() : ""}
              onChange={(e) => {
                const value = e.target.value.trim();
                console.log("🔤 Input RM cambiado:", value, "longitud:", value.length);
                
                // Permitir solo números y punto decimal
                const validPattern = /^-?\d*\.?\d*$/;
                if (value === "" || validPattern.test(value)) {
                  if (value === "" || value === null || value === "-" || value === ".") {
                    // Permitir campo vacío, signo negativo o punto mientras se escribe
                    setRm(null);
                  } else {
                    // Parsear el valor completo
                    const numValue = parseFloat(value);
                    console.log("🔢 Valor parseado:", numValue, "tipo:", typeof numValue, "string original:", value);
                    
                    if (!isNaN(numValue) && numValue > 0) {
                      setRm(numValue);
                      handleRmChange(numValue);
                    } else {
                      setRm(null);
                    }
                  }
                }
              }}
              onBlur={(e) => {
                // Al perder el foco, asegurar que el valor sea válido
                const value = e.target.value.trim();
                if (value === "" || value === null || value === "-" || value === ".") {
                  setRm(null);
                } else {
                  const numValue = parseFloat(value);
                  console.log("💾 RM final después de blur:", numValue, "string:", value);
                  if (!isNaN(numValue) && numValue > 0) {
                    setRm(numValue);
                    handleRmChange(numValue);
                  } else {
                    setRm(null);
                  }
                }
              }}
              placeholder="Ej: 100"
              className="w-[100px] px-2 sm:px-3 py-1.5 sm:py-2 text-sm sm:text-base bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-phase-maintenance/50 focus:bg-white/15"
            />
            <span className="text-xs sm:text-sm text-white/60">kg</span>
          </div>
          {rm && (
            <p className="text-xs text-phase-maintenance/80 mt-1.5 sm:mt-2">
              Con este RM, se calcularán los porcentajes de esfuerzo para cada serie
            </p>
          )}
        </div>

        {/* Inputs de pesos por serie */}
        <div className="space-y-1.5 sm:space-y-2">
          {Array.from({ length: exercise.sets }).map((_, i) => {
            const suggestedWeight = getSuggestedWeight(i);
            const previousWeight = previousWeights?.[i] || null;
            const previousRep = previousReps?.[i] || null;
            const hasWeight = weights[i] > 0;
            const hasReps = reps[i] > 0;
            const isComplete = hasWeight && hasReps; // Completo: tiene peso Y repeticiones
            const isIncomplete = (hasWeight || hasReps) && !isComplete; // Incompleto: solo tiene uno
            const hasPrevious = previousWeight || previousRep; // Tiene valores anteriores pero no los ha cargado
            const repsObjective = typeof exercise.reps === 'string' ? exercise.reps : `${exercise.reps}`;

            return (
              <div
                key={i}
                className={`p-1.5 sm:p-2 rounded-md border transition-all ${
                  isComplete
                    ? "bg-success/10 border-success/30"
                    : isIncomplete
                    ? "bg-warning/10 border-warning/30"
                    : hasPrevious
                    ? "bg-warning/10 border-warning/30"
                    : "bg-white/5 border-white/10"
                }`}
              >
                <div className="flex items-center gap-1.5 sm:gap-2">
                  {/* Número de serie */}
                  <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-md bg-info/20 border border-info/30 flex items-center justify-center">
                    <span className="text-xs font-bold text-info">{i + 1}</span>
                  </div>

                  {/* Inputs de peso y repeticiones - responsive */}
                  <div className="flex-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5 sm:gap-2">
                    {/* Input de peso */}
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={weights[i] || ""}
                        onChange={(e) => handleWeightChange(i, parseFloat(e.target.value) || 0)}
                        placeholder={suggestedWeight ? suggestedWeight.toString() : previousWeight ? previousWeight.toString() : "0"}
                        className="w-[100px] px-2 py-1.5 sm:py-2 text-sm sm:text-base font-semibold bg-white/10 border border-white/20 rounded-md text-white placeholder-white/30 focus:outline-none focus:border-info/50 focus:bg-white/15 text-center"
                      />
                      <span className="text-xs sm:text-sm text-white/60 w-6 sm:w-8">kg</span>
                    </div>
                    
                    {/* Input de repeticiones */}
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={reps[i] || ""}
                        onChange={(e) => handleRepsChange(i, parseInt(e.target.value) || 0)}
                        placeholder={previousRep ? previousRep.toString() : repsObjective}
                        className="w-[100px] px-2 py-1.5 sm:py-2 text-sm sm:text-base bg-white/10 border border-white/20 rounded-md text-white placeholder-white/30 focus:outline-none focus:border-warning/50 focus:bg-white/15 text-center"
                      />
                      <span className="text-xs sm:text-sm text-white/60 w-10 sm:w-12">reps</span>
                    </div>
                  </div>

                  {/* Indicador de estado */}
                  {isComplete ? (
                    // Verde: Completo (tiene peso Y repeticiones)
                    <div className="flex-shrink-0">
                      <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-success flex items-center justify-center" title="Completo: peso y repeticiones">
                        <svg className="w-3 h-3 sm:w-4 sm:h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    </div>
                  ) : isIncomplete ? (
                    // Amarillo: Incompleto (solo tiene peso O solo repeticiones)
                    <div className="flex-shrink-0">
                      <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-warning flex items-center justify-center" title="Incompleto: falta peso o repeticiones">
                        <svg className="w-3 h-3 sm:w-4 sm:h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      </div>
                    </div>
                  ) : hasPrevious ? (
                    // Naranja: Tiene valores anteriores pero no los ha cargado
                    <div className="flex-shrink-0">
                      <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-warning flex items-center justify-center" title="Tienes valores anteriores, completa los datos">
                        <svg className="w-3 h-3 sm:w-4 sm:h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                    </div>
                  ) : null}
                </div>
                
                {/* Info adicional (más compacta) - responsive */}
                <div className="flex items-center gap-1.5 sm:gap-2 text-xs mt-1 ml-8 sm:ml-10 flex-wrap">
                  {percentages[i] && (
                    <span className="text-phase-maintenance/80">
                      {percentages[i]}% RM
                    </span>
                  )}
                  {previousWeight && (
                    <span className="text-white/40">
                      <span className="hidden sm:inline">Anterior: </span>{previousWeight}kg
                    </span>
                  )}
                  {previousRep && (
                    <span className="text-white/40">
                      <span className="hidden sm:inline">Reps: </span>{previousRep}
                    </span>
                  )}
                  {suggestedWeight && !hasWeight && (
                    <span className="text-info/60">
                      <span className="hidden sm:inline">Sug: </span>{suggestedWeight}kg
                    </span>
                  )}
                  {!hasReps && !previousRep && (
                    <span className="text-warning/60">
                      <span className="hidden sm:inline">Obj: </span>{repsObjective}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Resumen */}
        {avgWeight > 0 && (
          <div className="mt-4 p-3 rounded-lg bg-info/10 border border-info/20">
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/70">Promedio de hoy:</span>
              <span className="text-base font-bold text-info">{avgWeight.toFixed(1)} kg</span>
            </div>
            {previousAvg > 0 && (
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-white/70">Promedio anterior:</span>
                <span className="text-sm font-medium text-white/60">{previousAvg.toFixed(1)} kg</span>
              </div>
            )}
          </div>
        )}

        {/* Estado de guardado */}
        {(saving || saved) && (
          <div className="mt-3 text-center">
            {saving && (
              <span className="text-xs text-info flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-info"></div>
                Guardando...
              </span>
            )}
            {saved && !saving && (
              <span className="text-xs text-success flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Guardado automáticamente
              </span>
            )}
          </div>
        )}
      </div>
    );
  };

  const DayTrainingPanel = ({
    dayData,
    week,
    dayIndex,
    date,
    planId,
    userId,
  }: {
    dayData: TrainingDayPlan;
    week: number;
    dayIndex: number;
    date: Date | null;
    planId?: string;
    userId?: string;
  }) => {
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

    const exerciseMediaOverrides = useMemo(() => {
      const tp = (plan as unknown as Record<string, unknown>)?.training_plan as TrainingPlan | undefined;
      return tp?.exercise_media_overrides ?? null;
    }, [plan]);
    
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
        className="mt-6 rounded-xl border-2 border-info/30 bg-[color-mix(in_oklab,var(--background)_95%,#0f172a)] p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-display text-xl font-bold text-white flex items-center gap-2">
              <span className="text-info">🏋️</span>
              {dayData.day}
              {musculos && (
                <span className="text-sm font-normal opacity-70 ml-2">({musculos})</span>
              )}
            </h3>
            {date && (
              <p className="text-sm text-white/60 mt-1 capitalize">{dateStr}</p>
            )}
          </div>
        </div>
        
        {/* Calentamiento */}
        {dayData.warmup && (
          <div className="mb-4 p-3 rounded-md bg-warning/20 border border-warning/30">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-semibold text-warning">🔥 Calentamiento</span>
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
              
              return (
                <li key={`ej-${week}-${dayIndex}-${ei}`} className="rounded-lg bg-white/5 border border-white/10 p-3">
                  <div className="flex-1">
                    {/* Header del ejercicio */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-semibold text-white">{ejercicio.name}</span>
                          <span className="text-sm opacity-70">· {ejercicio.sets}x{String(ejercicio.reps)}</span>
                          {ejercicio.muscle_group && (
                            <span className="text-xs px-2 py-0.5 rounded bg-info/20 text-info border border-info/30">
                              {translateMuscleGroup(ejercicio.muscle_group, locale)}
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

                    <ExerciseDemoMedia
                      exerciseName={ejercicio.name}
                      demoVideoUrl={ejercicio.demo_video_url}
                      demoPosterUrl={ejercicio.demo_poster_url}
                      planMediaOverrides={exerciseMediaOverrides}
                    />
                    
                    {/* Técnica, progresión, cues, alternativa (igual que en el modal) */}
                    {ejercicio.technique && (
                      <details className="mt-2">
                        <summary className="text-xs font-medium text-info cursor-pointer hover:text-info">
                          💡 Técnica
                        </summary>
                        <p className="mt-1 text-xs opacity-90 leading-relaxed pl-2 border-l-2 border-info/30">
                          {ejercicio.technique}
                        </p>
                      </details>
                    )}
                    
                    {ejercicio.progression && (
                      <details className="mt-2">
                        <summary className="text-xs font-medium text-warning cursor-pointer hover:text-warning">
                          📈 Progresión
                        </summary>
                        <p className="mt-1 text-xs opacity-90 leading-relaxed pl-2 border-l-2 border-warning/30">
                          {ejercicio.progression}
                        </p>
                      </details>
                    )}
                    
                    {ejercicio.cues && ejercicio.cues.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs font-medium text-phase-maintenance mb-1">🎯 Pistas mentales:</p>
                        <ul className="list-disc pl-4 space-y-0.5">
                          {ejercicio.cues.map((cue, cueIdx) => (
                            <li key={`cue-${ei}-${cueIdx}`} className="text-xs opacity-90">{cue}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {ejercicio.alternative && (
                      <div className="mt-2 p-2 rounded bg-warning/10 border border-warning/30">
                        <p className="text-xs font-medium text-warning mb-1">⚠️ Alternativa (si tienes lesión):</p>
                        <p className="text-xs opacity-90">{ejercicio.alternative}</p>
                      </div>
                    )}
                    
                    {/* Tracker de pesos */}
                    <ExerciseWeightTracker
                      exercise={ejercicio}
                      exerciseIndex={ei}
                      week={week}
                      dayIndex={dayIndex}
                      dayName={dayData.day}
                      planId={planId}
                      userId={userId}
                      date={date}
                    />
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
  
  // Función eliminada: calcularProgresoDias - ya no se calcula progreso de ejercicios
  
  // Cargar progreso de ejercicios cuando se abre el modal de entrenamiento
  // Ref para prevenir que este useEffect se ejecute múltiples veces
  const modalOpenedRef = useRef(false);
  
  useEffect(() => {
    // CRÍTICO: Si hay un día seleccionado del calendario, NO hacer NADA en absoluto
    // Esta verificación debe ser la PRIMERA y más estricta
    if (selectedDayData) {
      // Si hay un día seleccionado, NO ejecutar NADA de este useEffect
      // Solo resetear el ref cuando se cierra el modal
      if (!modalEntrenamientoAbierto) {
        modalOpenedRef.current = false;
        processingSelectionRef.current = false;
      }
      return; // SALIR INMEDIATAMENTE si hay un día seleccionado
    }
    
    // Solo cargar si se abre el modal desde el botón tradicional (no desde el calendario)
    // Y solo si no se ha ejecutado ya para esta apertura del modal
    if (modalEntrenamientoAbierto && authUser && planId && !modalOpenedRef.current) {
      modalOpenedRef.current = true;
      
      
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
      // Limpiar referencias cuando se cierra el modal
      processingSelectionRef.current = false;
    }
  }, [modalEntrenamientoAbierto, authUser, planId, semanaSeleccionada, plan, selectedDayData]);
  
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
  // Tipo para datos de cambios mensuales (planes multi-fase)
  type MonthChangesData = {
    mesAnterior: number;
    mesNuevo: number;
    faseAnterior: string;
    faseNueva: string;
    cambiaFase: boolean;
    nutricion: {
      caloriasAnterior: number;
      caloriasNueva: number;
      diferenciaCalorias: number;
      macrosAnterior: { proteinas: string; carbohidratos: string; grasas: string };
      macrosNuevo: { proteinas: string; carbohidratos: string; grasas: string };
      cambioMacros: {
        proteinas: number;
        carbohidratos: number;
        grasas: number;
      };
    };
    entrenamiento: {
      diasGymAnterior: number;
      diasGymNuevo: number;
      cambioVolumen: "aumentado" | "reducido" | "mantenido";
      ejerciciosNuevos: number;
      descripcionCambios: string;
    };
    ajustesAplicados: string[];
    razonCambios: string;
    progresoUsuario?: {
      pesoInicial: number;
      pesoActual: number;
      pesoObjetivo: number;
      cambioPesoTotal: number;
      cambioPesoUltimoMes: number;
      porcentajeHaciaObjetivo: number;
      mesesCompletados: number;
      totalMeses: number;
      adherenciaPromedio: number;
      tendenciaEnergia: "mejorando" | "estable" | "empeorando";
      tendenciaRecuperacion: "mejorando" | "estable" | "empeorando";
    };
  };
  const [monthChangesData, setMonthChangesData] = useState<MonthChangesData | null>(null);

  // Peso actual priorizando el último registro de seguimiento (si existe)
  const pesoActualDesdeRegistros = registrosPeso.length > 0
    ? registrosPeso.reduce<{ fecha: string; peso: number } | null>((acc, curr) => {
        if (!acc) return curr;
        if (!acc.fecha) return curr;
        if (!curr.fecha) return acc;
        return curr.fecha > acc.fecha ? curr : acc;
      }, null)?.peso
    : null;

  const pesoActual = pesoActualDesdeRegistros && pesoActualDesdeRegistros > 0
    ? pesoActualDesdeRegistros
    : user?.pesoKg || 0;

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
            const registros = data.registrosPeso.map((r: Record<string, unknown>) => ({
              fecha: String(r.fecha || ''),
              peso: Number(r.peso || 0)
            }));
            setRegistrosPeso(registros);

            // Actualizar el peso actual del usuario en el store con el último registro
            if (user && registros.length > 0) {
              const ultimoRegistro = registros.reduce((acc, curr) => {
                // Comparar por fecha (YYYY-MM-DD) o, si es igual, por orden en el array
                if (!acc) return curr;
                if (!acc.fecha) return curr;
                if (!curr.fecha) return acc;
                return curr.fecha > acc.fecha ? curr : acc;
              });

              if (ultimoRegistro && ultimoRegistro.peso > 0 && ultimoRegistro.peso !== user.pesoKg) {
                setUser({ ...user, pesoKg: ultimoRegistro.peso });
              }
            }
          }
        }
      } catch (error) {
        console.error("Error al cargar registros de peso:", error);
      } finally {
        loadingRegistrosPesoRef.current = false;
      }
    };
    
    loadRegistrosPeso();
  }, [planId, setUser, user]);
  
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
  const splitResumen = useMemo(() => {
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
  }, [plan]);

  const hasTrainingPlan = Boolean((plan as unknown as Record<string, unknown>)?.training_plan);
  const hasFoodPlan = Boolean(plan?.plan_semanal && plan.plan_semanal.length > 0);
  
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
  // DESBLOQUEADO TEMPORALMENTE: permitir que usuarios gratuitos vean entrenamiento con templates
  // useEffect(() => {
  //   if (!isPremium && vistaPlan === 'entrenamiento') {
  //     setVistaPlan('alimentacion');
  //   }
  // }, [isPremium, vistaPlan]);
  
  // Vista por defecto: alimentación
  // (el usuario puede cambiar entre alimentación y entrenamiento con los botones)
  
  // Fecha de inicio de la etapa actual (para planes multi-fase)
  const fechaInicioEtapaActual = useMemo(() => {
    if (!planMultiFase) return null;
    try {
      const mesIndex = (planMultiFase.mesActual || 1) - 1;
      const mesData = planMultiFase.historialMeses?.[mesIndex];
      let inicio: Date | null = null;

      if (mesData?.fechaGeneracion) {
        inicio = new Date(mesData.fechaGeneracion);
      } else if (planMultiFase.fechaInicio) {
        inicio = new Date(planMultiFase.fechaInicio);
      }

      if (!inicio || isNaN(inicio.getTime())) return null;
      inicio.setHours(0, 0, 0, 0);
      return inicio;
    } catch {
      return null;
    }
  }, [planMultiFase]);

  // Calcular progreso del plan:
  // - Para planes multi-fase: según la fecha de inicio de la etapa/mes actual (ventana de 30 días)
  // - Para planes simples: según la fecha de inicio del plan completo y su duración
  const progresoPlan = useMemo(() => {
    const ahora = new Date();

    // Caso 1: plan multi-fase -> usar etapa actual (30 días)
    if (planMultiFase && fechaInicioEtapaActual) {
      const inicio = fechaInicioEtapaActual;
      const diffTime = ahora.getTime() - inicio.getTime();

      // Usar horas para evitar 0% el primer día
      const diffHours = diffTime / (1000 * 60 * 60);
      const diffDays = Math.max(0, diffHours / 24);

      const totalDays = 30;
      const porcentaje = Math.min(100, Math.max(0, (diffDays / totalDays) * 100));
      const diasTranscurridos = Math.min(totalDays, Math.max(0, Math.ceil(diffDays)));

      return { diasTranscurridos, porcentaje };
    }

    // Caso 2: plan simple -> usar fechaInicioPlan y duracion_plan_dias
    if (!fechaInicioPlan) {
      return { diasTranscurridos: 0, porcentaje: 0 };
    }

    const diffTime = ahora.getTime() - fechaInicioPlan.getTime();
    const diffHours = diffTime / (1000 * 60 * 60);
    const diffDays = Math.max(0, diffHours / 24);

    const totalDays = plan?.duracion_plan_dias || 30;
    const porcentaje = Math.min(100, Math.max(0, (diffDays / totalDays) * 100));
    const diasTranscurridos = Math.min(totalDays, Math.max(0, Math.ceil(diffDays)));

    return { diasTranscurridos, porcentaje };
  }, [planMultiFase, fechaInicioEtapaActual, fechaInicioPlan, plan?.duracion_plan_dias]);

  // Determinar si el acceso gratuito de 30 días al plan está vencido (solo aplica a usuarios no premium)
  const freeAccessExpired = useMemo(() => {
    if (isPremium) return false;
    if (!fechaInicioPlan) return false;

    try {
      const now = new Date();
      const diffTime = now.getTime() - fechaInicioPlan.getTime();
      const diffHours = diffTime / (1000 * 60 * 60);
      const diffDays = diffHours / 24;
      return diffDays >= 30;
    } catch {
      return false;
    }
  }, [isPremium, fechaInicioPlan]);
  
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
        user.atletico,
        locale
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
      
      // Mismo guardrail determinístico que create-plan.tsx y la regeneración
      // de mes siguiente — sin esto, cambiar la intensidad/objetivo acá
      // dejaba que la IA recalculara calorías/macros sin piso de seguridad.
      const bmrRegen = calculateBMR(userActualizado.pesoKg, userActualizado.alturaCm, userActualizado.edad, userActualizado.sexo);
      const tdeeRegen = calculateTDEE(bmrRegen, userActualizado.actividad, userActualizado.diasGym, userActualizado.diasCardio);
      const caloriasObjetivoRegen = clampCaloriesToSafeFloor(
        calcularCaloriasObjetivoPorMeta(tdeeRegen, userActualizado.objetivo, intensidadFinal),
        bmrRegen,
        userActualizado.sexo
      );
      const macrosObjetivoRegen = calcularMacrosObjetivo(caloriasObjetivoRegen, userActualizado.pesoKg, userActualizado.objetivo, intensidadFinal);

      const resp = await fetch("/api/generatePlan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...userActualizado,
          userId: authUser?.uid,
          locale,
          _tdeeCalculado: tdeeRegen,
          _caloriasObjetivo: caloriasObjetivoRegen,
          _bmrCalculado: bmrRegen,
          _macrosObjetivo: macrosObjetivoRegen,
        }),
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
              appLocale: locale,
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
        user.atletico,
        locale
      );
      
      valoresOriginalesPlan.current = {
        diasGym: user.diasGym,
        diasCardio: user.diasCardio,
        minutosSesionGym: Number((plan as unknown as Record<string, unknown>)?.minutos_sesion_gym) || undefined,
        horasSueno: recomendacionesOriginales.horasSueno,
        minutosCaminata: recomendacionesOriginales.minutosCaminata
      };
    }
  }, [user, plan, locale]);

  // NO actualizar automáticamente las recomendaciones cuando solo cambia el select
  // Solo se actualizan cuando el usuario regenera el plan explícitamente


  const bmi = user ? calculateBMI(user.pesoKg, user.alturaCm) : 0;
  const bmiCat = bmiCategory(bmi);
  
  // Calcular TDEE y déficit/superávit
  const tdee = useMemo(() => {
    if (!user) return 0;
    const bmr = calculateBMR(user.pesoKg, user.alturaCm, user.edad, user.sexo);
    return calculateTDEE(bmr, user.actividad);
  }, [user]);
  const deficitSuperavit = user && plan ? plan.calorias_diarias - tdee : 0;
  
  // Calcular sugerencias de entrenamiento inteligentes
  const sugerenciaEntrenamiento: ReturnType<typeof sugerirEntrenamiento> | null = user ? sugerirEntrenamiento(
    user.objetivo,
    user.intensidad,
    user.edad,
    bmi,
    user.atletico,
    locale
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

  // En recomendaciones mostramos como base el valor sugerido ajustado por lesiones.
  // Si el usuario modifica manualmente el campo, se respeta su edición local.
  const diasGymSugeridoAjustado = sugerenciaEntrenamiento 
    ? ajustarDiasGymPorLesiones(sugerenciaEntrenamiento.diasGym)
    : 3;
  const diasGymActual = diasGymEditado !== null ? diasGymEditado : diasGymSugeridoAjustado;
  
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
  
  // Premium: prioriza proyecciones IA si existen. Gratis: cálculo local sin IA.
  const proyeccionesIA = (plan as unknown as Record<string, unknown>)?.proyecciones
    ? (plan as unknown as Record<string, unknown>).proyecciones as {
        musculoGananciaMensual?: string;
        grasaPerdidaMensual?: string;
        proyecciones: string[];
        tiempoEstimado: string;
      }
    : null;
  const proyeccionesLocales = useMemo(() => {
    if (!user) return null;
    return calcularProyeccionesMotivacionales(
      user.objetivo,
      user.intensidad,
      user.edad,
      user.sexo,
      bmi,
      user.atletico,
      diasGymActual,
      locale
    );
  }, [user, bmi, diasGymActual, locale]);
  const proyecciones = isPremium ? (proyeccionesIA ?? proyeccionesLocales) : proyeccionesLocales;
  const extraerPromedioMensual = (texto?: string): number | null => {
    if (!texto) return null;
    const nums = (texto.match(/\d+(?:[.,]\d+)?/g) || []).map((n) => Number(n.replace(",", "."))).filter((n) => Number.isFinite(n));
    if (nums.length === 0) return null;
    const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
    return Number.isFinite(avg) ? avg : null;
  };
  const { mesesCambiosVisibles, deltaPesoProyectado } = useMemo(() => {
    const mesesBase = (() => {
      if (!isPremium) {
        const absDiff = Math.abs(deficitSuperavit);
        return absDiff >= 400 ? 2 : 3;
      }
      const match = proyecciones?.tiempoEstimado?.match(/\d+/);
      const n = match ? Number(match[0]) : 2;
      return Number.isFinite(n) && n > 0 ? n : 2;
    })();

    const mesesProyeccionPeso = Math.max(2, Math.min(mesesBase, 3));
    const deltaMensualGrasa = extraerPromedioMensual(proyecciones?.grasaPerdidaMensual);
    const deltaMensualMusculo = extraerPromedioMensual(proyecciones?.musculoGananciaMensual);
    const kgPorMes = (deficitSuperavit * 30) / 7700;
    const deltaMensualPorCalorias = Number.isFinite(kgPorMes) ? kgPorMes : 0;

    const obj = user?.objetivo;
    if (!obj) return { mesesCambiosVisibles: mesesBase, deltaPesoProyectado: 0 };
    if (!isPremium) {
      const deltaLocal = deltaMensualPorCalorias * mesesProyeccionPeso;
      const min = -1.2 * mesesProyeccionPeso;
      const max = 1.2 * mesesProyeccionPeso;
      return {
        mesesCambiosVisibles: mesesBase,
        deltaPesoProyectado: Math.max(min, Math.min(deltaLocal, max)),
      };
    }
    if (obj === "perder_grasa" || obj === "definicion" || obj === "corte") {
      return { mesesCambiosVisibles: mesesBase, deltaPesoProyectado: -((deltaMensualGrasa ?? 0.6) * mesesProyeccionPeso) };
    }
    if (obj === "ganar_masa" || obj === "volumen" || obj === "bulk_cut" || obj === "lean_bulk") {
      return { mesesCambiosVisibles: mesesBase, deltaPesoProyectado: (deltaMensualMusculo ?? 0.7) * mesesProyeccionPeso };
    }
    if (obj === "recomposicion") {
      return { mesesCambiosVisibles: mesesBase, deltaPesoProyectado: (deltaMensualMusculo ?? 0.4) * mesesProyeccionPeso };
    }
    return { mesesCambiosVisibles: mesesBase, deltaPesoProyectado: 0 };
  }, [isPremium, deficitSuperavit, proyecciones, user]);

  // Guard de carga: recién acá es seguro devolver early return, todos los hooks
  // (useMemo de tdee/proyecciones/mesesCambiosVisibles) ya se ejecutaron arriba.
  if (!plan || !user) {
    if (!recoveringPlan) return null;
    return (
      <div className="min-h-screen pb-[calc(var(--client-bottom-nav-h,4rem)+env(safe-area-inset-bottom))] md:pb-0">
        <Navbar />
        <div className="flex min-h-[50vh] items-center justify-center px-4">
          <div className="text-sm text-[var(--landing-muted)]">{p(locale, "loadingPlan")}</div>
        </div>
      </div>
    );
  }

  const mesesProyeccionPeso = Math.max(2, Math.min(mesesCambiosVisibles, 3));
  const pesoProyectado = Math.max(35, Number((pesoActual + deltaPesoProyectado).toFixed(1)));
  const deltaTextoPeso = `${deltaPesoProyectado >= 0 ? "+" : ""}${deltaPesoProyectado.toFixed(1)} kg`;
  
  // Ajustar sugerencias de entrenamiento según lesiones para comparación
  const sugerenciaEntrenamientoAjustada = (sugerenciaEntrenamiento ? {
    ...sugerenciaEntrenamiento,
    diasGym: ajustarDiasGymPorLesiones(sugerenciaEntrenamiento.diasGym)
  } : null) as ReturnType<typeof sugerirEntrenamiento> | null;

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
    minutosGymEditado !== null ? minutosGymEditado : (Number((plan as unknown as Record<string, unknown>)?.minutos_sesion_gym) || 75),
    locale
  ) : null;
  const bmiText =
    bmiCat === "bajo_peso"
      ? p(locale, "underweight")
      : bmiCat === "saludable"
        ? p(locale, "bmiHealthy")
        : bmiCat === "sobrepeso"
          ? p(locale, "bmiOverweight")
          : p(locale, "obesity");

  const distrib = plan.distribucion_diaria_pct;
  // Normalizar snack/snacks para manejar ambos casos (compatibilidad con respuestas que usen "snack" o "snacks")
  type DistribType = { desayuno: number; almuerzo: number; cena: number; snacks?: number; snack?: number };
  const distribTyped = distrib as DistribType | undefined;
  const snackPct = distribTyped ? (distribTyped.snacks ?? distribTyped.snack ?? 0) : 0;
  // Calcular snack si falta y tenemos los otros valores
  const snackCalculado = distribTyped && !distribTyped.snacks && !distribTyped.snack && distribTyped.desayuno && distribTyped.almuerzo && distribTyped.cena
    ? Math.max(0, 100 - (distribTyped.desayuno + distribTyped.almuerzo + distribTyped.cena))
    : snackPct;

  const dateLocale = locale === "en" ? "en-US" : "es-AR";

  function bmiPercent(b: number): number {
    // Mapea IMC al rango 15-35 -> 0-100
    if (!b || !isFinite(b)) return 0;
    const clamped = Math.max(15, Math.min(35, b));
    return Math.round(((clamped - 15) / (35 - 15)) * 100);
  }
  const bmiPct = bmiPercent(bmi);

  function bmiBadgeColor(): string {
    if (bmiCat === "bajo_peso") return "var(--info)";
    if (bmiCat === "saludable") return "var(--success)";
    if (bmiCat === "sobrepeso") return "var(--warning)";
    return "var(--danger)";
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

      // Igual que en la creación inicial del plan (create-plan.tsx): calcular
      // valores nutricionales determinísticos para el mes nuevo (peso/objetivo
      // actualizados) y enviarlos como guardrail obligatorio. Antes, la
      // regeneración de mes siguiente no enviaba nada de esto y la IA
      // calculaba calorías/macros libremente, sin el piso de seguridad ni el
      // chequeo de desviación ±15% que sí protege al mes 1.
      const intensidadNueva = userInput.intensidad || "moderada";
      const bmrNuevo = calculateBMR(userInput.pesoKg, user.alturaCm, user.edad, user.sexo);
      const tdeeNuevo = calculateTDEE(bmrNuevo, user.actividad, userInput.diasGym, userInput.diasCardio);
      const caloriasObjetivoNuevo = clampCaloriesToSafeFloor(
        calcularCaloriasObjetivoPorMeta(tdeeNuevo, userInput.objetivo, intensidadNueva),
        bmrNuevo,
        user.sexo
      );
      const macrosObjetivoNuevo = calcularMacrosObjetivo(caloriasObjetivoNuevo, userInput.pesoKg, userInput.objetivo, intensidadNueva);

      // Generar nuevo plan
      const response = await fetch("/api/generatePlan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...userInput,
          userId: authUser?.uid,
          locale,
          _tdeeCalculado: tdeeNuevo,
          _caloriasObjetivo: caloriasObjetivoNuevo,
          _bmrCalculado: bmrNuevo,
          _macrosObjetivo: macrosObjetivoNuevo,
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
        const ejerciciosAnterior = mesAnteriorCompleto?.planEntrenamiento?.weeks?.reduce((acc: number, week: TrainingWeekPlan) => 
          acc + (week.days?.reduce((dayAcc: number, day: TrainingDayPlan) => dayAcc + (day.ejercicios?.length || 0), 0) || 0), 0) || 0;
        const ejerciciosNuevo = nuevoPlan.training_plan?.weeks?.reduce((acc: number, week: TrainingWeekPlan) => 
          acc + (week.days?.reduce((dayAcc: number, day: TrainingDayPlan) => dayAcc + (day.ejercicios?.length || 0), 0) || 0), 0) || 0;
        
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
      
      setMonthChangesData({
        ...cambiosData,
        cambiaFase: cambiosData.cambiaFase ?? false,
      });
      
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

  // Renderizar recomendaciones de entrenamiento
  const _renderRecomendaciones = (): ReactNode => {
    const rec = sugerenciaEntrenamientoAjustada as ReturnType<typeof sugerirEntrenamiento> | null;
    if (!rec) return null;
    return (
    <div
      key="sugerencias-entrenamiento"
      className="mt-6 rounded-2xl border border-[var(--landing-border)] bg-[var(--landing-surface)] p-4"
    >
      <h2 className="font-display mb-3 text-lg font-semibold text-[var(--foreground)]">💪 {p(locale, "trainingRecoveryHeading")}</h2>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-[var(--landing-border)] bg-[color-mix(in_oklab,var(--foreground)_3%,transparent)] p-3">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-medium text-[var(--foreground)]">
              {p(locale, "gymDaysLabel")}
              <span className="ml-2 text-xs text-[var(--landing-muted)]">
                (≈ {(() => {
                  const min = minutosGymEditado !== null ? minutosGymEditado : (Number((plan as unknown as Record<string, unknown>)?.minutos_sesion_gym) || 75);
                  const total = Math.max(0, Math.round(min));
                  const h = Math.floor(total / 60);
                  const m = total % 60;
                  const hStr = h > 0 ? `${h} h` : "0 h";
                  const mStr = m > 0 ? ` ${m} ${p(locale, "minAbbr")}` : "";
                  return locale === "en" ? `${hStr}${mStr} per day` : `${hStr}${mStr} por día`;
                })()})
              </span>
            </p>
            {rec.diasGym !== diasGymActual && (
                      <span className="text-xs text-[var(--landing-muted)]">{pFmt(locale, "suggestedShort", { n: rec.diasGym })}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              max="7"
              value={diasGymActual}
              onChange={(e) => setDiasGymEditado(Number(e.target.value))}
              className="font-display w-16 border-b-2 border-[var(--landing-border)] bg-transparent text-2xl font-bold text-[var(--foreground)] outline-none focus:border-[color-mix(in_oklab,var(--landing-accent)_45%,transparent)]"
            />
            <span className="font-display text-2xl font-bold text-[var(--foreground)]">{p(locale, "dayPerWeek")}</span>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span className="min-w-[130px] text-sm text-[var(--landing-muted)]">{p(locale, "sessionDuration")}</span>
            <input
              type="number"
              min="30"
              max="240"
              step="5"
              value={minutosGymEditado !== null ? minutosGymEditado : (Number((plan as unknown as Record<string, unknown>)?.minutos_sesion_gym) || 75)}
              onChange={(e) => setMinutosGymEditado(Number(e.target.value))}
              className="w-24 border-b-2 border-[var(--landing-border)] bg-transparent text-lg font-semibold text-[var(--foreground)] outline-none focus:border-[color-mix(in_oklab,var(--landing-accent)_45%,transparent)]"
            />
            <span className="text-sm font-medium text-[var(--foreground)]">{p(locale, "minAbbr")}</span>
          </div>
          <p className="mt-1 text-xs text-[var(--landing-muted)]">{p(locale, "strengthTraining")}</p>
        </div>
        <div className="rounded-xl border border-[var(--landing-border)] bg-[color-mix(in_oklab,var(--foreground)_3%,transparent)] p-3">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-medium text-[var(--foreground)]">{p(locale, "dailyWalk")}</p>
            {rec.minutosCaminata !== minutosCaminataActual && (
              <span className="text-xs text-[var(--landing-muted)]">{pFmt(locale, "suggestedShort", { n: rec.minutosCaminata })}</span>
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
              className="font-display w-16 border-b-2 border-[var(--landing-border)] bg-transparent text-2xl font-bold text-[var(--foreground)] outline-none focus:border-[color-mix(in_oklab,var(--landing-accent)_45%,transparent)]"
            />
            <span className="font-display text-2xl font-bold text-[var(--foreground)]">{p(locale, "minutes")}</span>
          </div>
          <p className="mt-1 text-xs text-[var(--landing-muted)]">{p(locale, "moderateWalkDaily")}</p>
        </div>
        <div className="rounded-xl border border-[var(--landing-border)] bg-[color-mix(in_oklab,var(--foreground)_3%,transparent)] p-3">
          <div className="flex items-center justify-between mb-1">
            <p className="flex items-center gap-2 text-sm font-medium text-[var(--foreground)]">
              {p(locale, "sleepHoursHeading")}
              <button
                type="button"
                onClick={() => setModalInfoAbierto('sueno')}
                className="inline-flex items-center cursor-pointer hover:opacity-100 transition-opacity"
                aria-label={p(locale, "sleepHelpAria")}
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
            {rec.horasSueno !== horasSuenoActual && (
              <span className="text-xs text-[var(--landing-muted)]">{pFmt(locale, "suggestedShort", { n: rec.horasSueno })}</span>
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
              className="font-display w-20 border-b-2 border-[var(--landing-border)] bg-transparent text-2xl font-bold text-[var(--foreground)] outline-none focus:border-[color-mix(in_oklab,var(--landing-accent)_45%,transparent)]"
            />
            <span className="font-display text-2xl font-bold text-[var(--foreground)]">{p(locale, "hours")}</span>
          </div>
          <p className="mt-1 text-xs text-[var(--landing-muted)]">{p(locale, "sleepRecovery")}</p>
        </div>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-[var(--foreground)]">
        {rec.descripcion}
      </p>
      {analisisCambios && (analisisCambios.pros.length > 0 || analisisCambios.contras.length > 0) && (
        <div className="mt-4 border-t border-[var(--landing-border)] pt-4">
          <h3 className="font-display mb-3 text-sm font-semibold text-[var(--foreground)]">📊 {p(locale, "impactChangesHeading")}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {analisisCambios.pros.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-medium text-[var(--brand-end)]">✅ {p(locale, "prosHeading")}</p>
                <ul className="space-y-1">
                  {analisisCambios.pros.map((pro, idx) => (
                    <li key={`pro-${idx}-${pro}`} className="text-xs opacity-90 flex items-start gap-2">
                      <span className="mt-1 text-[var(--brand-end)]">•</span>
                      <span>{pro}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {analisisCambios.contras.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-medium text-[var(--brand-start)]">⚠️ {p(locale, "consHeading")}</p>
                <ul className="space-y-1">
                  {analisisCambios.contras.map((contra, idx) => (
                    <li key={`contra-${idx}-${contra}`} className="text-xs opacity-90 flex items-start gap-2">
                      <span className="mt-1 text-[var(--brand-start)]">•</span>
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
        <div className="mt-4 rounded-lg border border-[color-mix(in_oklab,var(--landing-accent)_35%,transparent)] bg-[color-mix(in_oklab,var(--landing-accent)_14%,transparent)] px-3 py-2 text-xs text-[var(--foreground)]">
          <p className="flex items-center gap-2 font-medium text-[var(--foreground)]">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="h-4 w-4"
            >
              <path d="M12 2a10 10 0 1 0 10 10A10.011 10.011 0 0 0 12 2Zm.75 15h-1.5v-1.5h1.5Zm1.971-6.279-.675.693A3.375 3.375 0 0 0 12.75 14.25h-1.5a4.875 4.875 0 0 1 1.425-3.45l.93-.936a1.875 1.875 0 1 0-3.195-1.326h-1.5a3.375 3.375 0 1 1 6.03 1.283Z" />
            </svg>
            {p(locale, "recInjuriesTitle")}
          </p>
          <p className="mt-1 text-[var(--foreground)]/80">
            {user.doloresLesiones.filter((s: string) => typeof s === "string" && s.trim().length > 0).join(", ")}
          </p>
          <p className="mt-1 opacity-80">
            {p(locale, "recInjuriesFoot")}
          </p>
        </div>
      )}
    </div>
    );
  };
  

  return (
    <div className="min-h-screen">
      <Head>
        <title>{p(locale, "headTitle")}</title>
        <meta name="description" content="Tu plan de alimentación y entrenamiento personalizado con IA. Menú semanal detallado, rutinas de gym y seguimiento de progreso." />
        <meta name="robots" content="noindex, nofollow" />
        <meta property="og:title" content="Mi Plan | FitPlan" />
        <meta property="og:url" content="https://www.fitplan-ai.com/plan" />
      </Head>
      <Navbar />
      {/* Padding inferior para que la tab bar fija de mobile (DESIGN_SYSTEM.md
          §11.4-B, `Navbar.tsx`) no tape el último elemento — mismo mecanismo
          de variable CSS medida que `dashboard.tsx` (`--client-bottom-nav-h`,
          publicada por `Navbar` con ResizeObserver mientras está montada). */}
      <div className="px-4 py-8 pb-[calc(var(--client-bottom-nav-h,4rem)+env(safe-area-inset-bottom))] md:px-8 md:pb-8">
      <div className="mx-auto max-w-6xl">
        {cacheNotice ? (
          <div className="mb-4 rounded-xl border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
            {cacheNotice}
          </div>
        ) : null}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="flex flex-col gap-2">
            {/* Banner de Plan Multi-Fase */}
            {planMultiFase && planMultiFase.tipo !== "simple" && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`mb-4 p-4 rounded-xl border ${
                  planMultiFase.faseActual === "BULK"
                    ? "bg-phase-bulk/20 border-phase-bulk/30"
                    : planMultiFase.faseActual === "CUT"
                    ? "bg-phase-cut/20 border-phase-cut/30"
                    : planMultiFase.faseActual === "LEAN_BULK"
                    ? "bg-phase-lean-bulk/20 border-phase-lean-bulk/30"
                    : "bg-phase-maintenance/20 border-phase-maintenance/30"
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`px-3 py-1 rounded-lg text-sm font-bold ${
                      planMultiFase.faseActual === "BULK"
                        ? "bg-phase-bulk/30 text-phase-bulk"
                        : planMultiFase.faseActual === "CUT"
                        ? "bg-phase-cut/30 text-phase-cut"
                        : planMultiFase.faseActual === "LEAN_BULK"
                        ? "bg-phase-lean-bulk/30 text-phase-lean-bulk"
                        : "bg-phase-maintenance/30 text-phase-maintenance"
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
                      <span className="opacity-70">Peso inicial:</span>
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
                          ? "bg-phase-bulk"
                          : planMultiFase.faseActual === "CUT"
                          ? "bg-phase-cut"
                          : planMultiFase.faseActual === "LEAN_BULK"
                          ? "bg-phase-lean-bulk"
                          : "bg-phase-maintenance"
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
                const [planData, setPlanData] = useState<Record<string, unknown> | null>(null);
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
                    className="mb-4 p-4 rounded-xl border bg-success/20 border-success/30"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-lg">🎯</span>
                          <h3 className="font-display font-bold text-success">
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
                        className="btn btn-success text-sm whitespace-nowrap"
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
            {planMultiFase && planMultiFase.tipo !== "simple" && planId && (() => {
              const MultiPhaseContinuityBanner = () => {
                const [mesProgress, setMesProgress] = useState(0);
                const [fechaInicioMesActual, setFechaInicioMesActual] = useState<Date | null>(null);
                
                useEffect(() => {
                  const loadData = async () => {
                    try {
                      // Obtener fecha de inicio del mes actual
                      const mesActualIndex = planMultiFase.mesActual - 1;
                      const mesActualData = planMultiFase.historialMeses[mesActualIndex];
                      
                      console.log("🔍 DEBUG MultiPhase Banner:", {
                        mesActual: planMultiFase.mesActual,
                        mesActualIndex,
                        totalMeses: planMultiFase.totalMeses,
                        historialMesesLength: planMultiFase.historialMeses.length,
                        mesActualData: mesActualData ? {
                          mesNumero: mesActualData.mesNumero,
                          fechaGeneracion: mesActualData.fechaGeneracion,
                          faseEnEsteMes: mesActualData.faseEnEsteMes
                        } : null,
                        todosLosMeses: planMultiFase.historialMeses.map(m => ({
                          mesNumero: m.mesNumero,
                          fechaGeneracion: m.fechaGeneracion,
                          fase: m.faseEnEsteMes
                        }))
                      });
                      
                      if (mesActualData && mesActualData.fechaGeneracion) {
                        const fechaInicio = new Date(mesActualData.fechaGeneracion);
                        setFechaInicioMesActual(fechaInicio);
                        
                        // Calcular progreso del mes actual (30 días)
                        // Normalizar fechas a medianoche para cálculo más preciso
                        const now = new Date();
                        const inicioNormalizado = new Date(fechaInicio.getFullYear(), fechaInicio.getMonth(), fechaInicio.getDate());
                        const ahoraNormalizado = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                        
                        const diffTime = ahoraNormalizado.getTime() - inicioNormalizado.getTime();
                        const diffDays = diffTime / (1000 * 60 * 60 * 24);
                        const prog = Math.min(100, Math.max(0, (diffDays / 30) * 100));
                        
                        console.log("📊 Progreso del mes calculado:", {
                          fechaInicioOriginal: fechaInicio.toISOString(),
                          fechaInicioNormalizada: inicioNormalizado.toISOString().split('T')[0],
                          ahoraOriginal: now.toISOString(),
                          ahoraNormalizada: ahoraNormalizado.toISOString().split('T')[0],
                          diffDays: diffDays.toFixed(2),
                          diasCompletos: Math.floor(diffDays),
                          progreso: prog.toFixed(2) + "%",
                          mesActual: planMultiFase.mesActual,
                          totalMeses: planMultiFase.totalMeses,
                          mostrarBanner: prog >= 90 && planMultiFase.mesActual < planMultiFase.totalMeses
                        });
                        
                        setMesProgress(prog);
                      } else {
                        // Fallback: usar la fecha del plan completo si no hay fecha del mes
                        console.warn("⚠️ No se encontró fechaGeneracion para el mes actual, usando fallback:", {
                          mesActual: planMultiFase.mesActual,
                          mesActualIndex,
                          historialMeses: planMultiFase.historialMeses.map(m => ({
                            mesNumero: m.mesNumero,
                            tieneFecha: !!m.fechaGeneracion
                          }))
                        });
                        
                        // Intentar usar la fecha del primer mes o la fecha de inicio del plan
                        const primerMes = planMultiFase.historialMeses[0];
                        if (primerMes && primerMes.fechaGeneracion) {
                          const fechaInicio = new Date(primerMes.fechaGeneracion);
                          // Calcular días desde el inicio del plan
                          const now = new Date();
                          const diffTime = now.getTime() - fechaInicio.getTime();
                          const diffDays = diffTime / (1000 * 60 * 60 * 24);
                          // Asumir que cada mes son 30 días
                          const diasDesdeInicio = diffDays;
                          const diasDelMesActual = diasDesdeInicio - ((planMultiFase.mesActual - 1) * 30);
                          const prog = Math.min(100, Math.max(0, (diasDelMesActual / 30) * 100));
                          
                          console.log("📊 Progreso calculado con fallback:", {
                            diasDesdeInicio: diasDesdeInicio.toFixed(2),
                            diasDelMesActual: diasDelMesActual.toFixed(2),
                            progreso: prog.toFixed(2) + "%"
                          });
                          
                          setFechaInicioMesActual(fechaInicio);
                          setMesProgress(prog);
                        }
                      }
                    } catch (error) {
                      console.error("Error al cargar datos del mes actual:", error);
                    }
                  };
                  
                  loadData();
                }, []);
                
                // Mostrar el banner solo cuando:
                // - Tengamos una fecha de inicio válida
                // - No estemos en el último mes del plan
                // - El progreso del mes actual sea >= 90% (casi completado)
                const puedeMostrar = !!fechaInicioMesActual && 
                                     planMultiFase.mesActual < planMultiFase.totalMeses &&
                                     mesProgress >= 90;
                
                console.log("🔍 Condición para mostrar banner:", {
                  tieneFecha: !!fechaInicioMesActual,
                  progreso: mesProgress.toFixed(2) + "%",
                  progresoOk: mesProgress >= 90,
                  mesActual: planMultiFase.mesActual,
                  totalMeses: planMultiFase.totalMeses,
                  noEsUltimo: planMultiFase.mesActual < planMultiFase.totalMeses,
                  puedeMostrar
                });
                
                if (!puedeMostrar) return null;
                
                const siguienteMes = planMultiFase.mesActual + 1;
                const siguienteFase = planMultiFase.fases.find(f => f.mesesIncluidos.includes(siguienteMes));
                const cambiaFase = siguienteFase && siguienteFase.nombre !== planMultiFase.faseActual;
                
                return (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`mb-4 p-4 rounded-xl border ${
                      planMultiFase.faseActual === "BULK"
                        ? "bg-phase-bulk/20 border-phase-bulk/30"
                        : planMultiFase.faseActual === "CUT"
                        ? "bg-phase-cut/20 border-phase-cut/30"
                        : planMultiFase.faseActual === "LEAN_BULK"
                        ? "bg-phase-lean-bulk/20 border-phase-lean-bulk/30"
                        : "bg-phase-maintenance/20 border-phase-maintenance/30"
                    }`}
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-lg">
                            {cambiaFase ? "🔄" : "📈"}
                          </span>
                          <h3 className={`font-display font-bold ${
                            planMultiFase.faseActual === "BULK" ? "text-phase-bulk" :
                            planMultiFase.faseActual === "CUT" ? "text-phase-cut" :
                            planMultiFase.faseActual === "LEAN_BULK" ? "text-phase-lean-bulk" :
                            "text-phase-maintenance"
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
                        className={`px-4 py-2 rounded-lg text-white text-sm font-medium transition-all shadow-lg whitespace-nowrap hover:brightness-90 ${
                          planMultiFase.faseActual === "BULK"
                            ? "bg-phase-bulk"
                            : planMultiFase.faseActual === "CUT"
                            ? "bg-phase-cut"
                            : planMultiFase.faseActual === "LEAN_BULK"
                            ? "bg-phase-lean-bulk"
                            : "bg-phase-maintenance"
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
                              ? "bg-phase-bulk"
                              : planMultiFase.faseActual === "CUT"
                              ? "bg-phase-cut"
                              : planMultiFase.faseActual === "LEAN_BULK"
                              ? "bg-phase-lean-bulk"
                              : "bg-phase-maintenance"
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
            
            <div className="flex flex-wrap items-center justify-between gap-4">
            <h1 className="font-display text-3xl font-bold tracking-tight text-[var(--foreground)] md:text-4xl">{p(locale, "smartPlanHeading")}</h1>
              <div className="flex gap-3">
                <div className="relative group">
                  <button
                    className={`rounded-xl px-4 py-2 text-sm font-medium border transition-colors ${
                      !isPremium 
                        ? 'bg-[var(--landing-surface)] border-[var(--landing-border)] text-[var(--landing-muted)] cursor-not-allowed opacity-50' 
                        : 'bg-[var(--landing-surface)] border-[var(--landing-border)] text-[var(--foreground)] hover:border-[color-mix(in_oklab,var(--landing-accent)_45%,transparent)]'
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
                    {p(locale, "edit")}
                  </button>
                  {!isPremium && (
                    <div className="absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-warning/50 bg-warning px-3 py-2 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity duration-200 pointer-events-none group-hover:opacity-100">
                      💳 {p(locale, "requiresPremiumEdit")}
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                        <div className="w-2 h-2 bg-warning rotate-45 border-r border-b border-warning/50"></div>
                      </div>
                    </div>
                  )}
                </div>
                </div>
                
                {/* Botón Generar Siguiente Mes - Solo para planes multi-fase */}
                {/* Botón secundario para generar siguiente mes (solo si no hay banner activo) - Oculto cuando el banner al 90-100% está visible */}
                
                {!isPremium && (
                  <button
                    className="rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface)] px-4 py-2 text-sm font-medium text-[var(--foreground)] transition-colors hover:border-[color-mix(in_oklab,var(--landing-accent)_45%,transparent)]"
                    onClick={() => {
                      if (!authUser) {
                        alert(p(locale, "registerForPremium"));
                        return;
                      }
                      setPremiumModalOpen(true);
                    }}
                  >
                    🌟 {p(locale, "premiumCta")}
                  </button>
                )}
            </div>
            {user?.nombre ? (
              <p className="text-sm text-[var(--landing-muted)]">{p(locale, "greeting")} {user.nombre}, {p(locale, "planIntro")}</p>
            ) : null}
            {user && (
              <div className="flex flex-wrap items-center gap-3 mt-2">
                {/* Objetivo - Solo lectura */}
                <div className="inline-flex items-center gap-2 rounded-lg border border-[var(--landing-border)] bg-[var(--landing-surface)] px-3 py-1.5">
                  <span className="text-xs text-[var(--landing-muted)] whitespace-nowrap flex-shrink-0">{p(locale, "goal")}</span>
                  <span className="text-sm font-medium text-[var(--foreground)] whitespace-nowrap max-w-[150px] md:max-w-none truncate">
                    {goalLabel(locale, user.objetivo)}
                  </span>
                      </div>
                {/* Intensidad - Solo lectura */}
                <div className="inline-flex items-center gap-2 rounded-lg border border-[var(--landing-border)] bg-[var(--landing-surface)] px-3 py-1.5">
                  <span className="text-xs text-[var(--landing-muted)] whitespace-nowrap">{p(locale, "intensity")}</span>
                  <span className="text-sm font-medium text-[var(--foreground)] capitalize">
                    {intensityLabel(locale, user.intensidad)}
                    </span>
                        </div>
                {/* Dieta - Solo lectura */}
                <div className="inline-flex items-center gap-2 rounded-lg border border-[var(--landing-border)] bg-[var(--landing-surface)] px-3 py-1.5">
                    <span className="text-xs text-[var(--landing-muted)] whitespace-nowrap">{p(locale, "diet")}</span>
                  <span className="text-sm font-medium text-[var(--foreground)]">
                    {dietTypeLabel(locale, user.tipoDieta)}
                  </span>
                </div>
                {plan?.dificultad && (
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors w-fit"
                    style={{
                      backgroundColor: 'rgba(255,255,255,0.05)',
                      borderColor: plan.dificultad === 'dificil' ? 'color-mix(in oklab, var(--danger) 40%, transparent)' : plan.dificultad === 'media' ? 'color-mix(in oklab, var(--warning) 40%, transparent)' : 'color-mix(in oklab, var(--success) 40%, transparent)'
                    }}
                  >
                    <span className="text-xs opacity-70 whitespace-nowrap">{p(locale, "difficulty")}</span>
                    <span className="text-sm font-medium capitalize"
                      style={{
                        color: plan.dificultad === 'dificil' ? 'var(--danger)' : plan.dificultad === 'media' ? 'var(--warning)' : 'var(--success)'
                      }}
                    >
                      {difficultyLabel(locale, plan.dificultad)}
                    </span>
                  </div>
                )}
                {hayCambios && (
                  <button
                    onClick={regenerarPlan}
                    disabled={regenerandoPlan}
                    className="inline-flex rounded-lg border border-[var(--landing-border)] bg-[var(--landing-surface)] px-4 py-1.5 text-sm font-medium text-[var(--foreground)] transition-colors hover:border-[color-mix(in_oklab,var(--landing-accent)_45%,transparent)] disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap"
                  >
                    {regenerandoPlan ? p(locale, "regenerating") : `🔄 ${p(locale, "regeneratePlan")}`}
                  </button>
                )}
                {errorRegeneracion && (
                  <div className="text-xs text-danger mt-1 w-full">{errorRegeneracion}</div>
                )}
              </div>
            )}
          </div>

          {/* Resumen corporal y energético */}
          <section className="mt-2">
            <div className="mb-2">
              <h2 className="font-display text-base font-semibold text-[var(--foreground)]">{p(locale, "todaySummary")}</h2>
              <p className="text-xs text-[var(--landing-muted)]">{p(locale, "todaySummarySub")}</p>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-[var(--landing-border)] bg-[var(--landing-surface)] p-4">
                <p className="text-xs uppercase tracking-wide text-[var(--landing-muted)]">{p(locale, "currentWeight")}</p>
                <p className="font-display mt-1 text-3xl font-bold text-[var(--foreground)]">{pesoActual} kg</p>
                <p className="mt-2 text-xs text-[var(--landing-muted)]">
                  {pFmt(locale, "weightProjectedLine", { months: mesesProyeccionPeso })}{" "}
                  <span className="font-semibold text-success">{pesoProyectado} kg</span>
                </p>
                <div className="mt-3 rounded-lg bg-[color-mix(in_oklab,var(--foreground)_4%,transparent)] px-3 py-2 text-xs text-[var(--landing-muted)]">
                  {pFmt(locale, "weightDeltaBlurb", { delta: deltaTextoPeso })}
                </div>
              </div>

              <div className="rounded-2xl border border-[var(--landing-border)] bg-[var(--landing-surface)] p-4">
                <p className="text-xs uppercase tracking-wide text-[var(--landing-muted)]">{p(locale, "dailyCalories")}</p>
                <p className="font-display mt-1 text-3xl font-bold text-[var(--foreground)]">{plan.calorias_diarias} kcal</p>
                {tdee > 0 ? (
                  <div className="mt-3 space-y-1 text-xs">
                    <p className="text-[var(--landing-muted)]">{p(locale, "maintenance")} {tdee} kcal</p>
                    {Math.abs(deficitSuperavit) > 50 ? (
                      <p className={`font-semibold ${deficitSuperavit < 0 ? "text-success" : "text-[var(--brand-start)]"}`}>
                        {deficitSuperavit < 0
                          ? pFmt(locale, "deficitKcalDay", { n: Math.abs(deficitSuperavit) })
                          : pFmt(locale, "surplusKcalDay", { n: deficitSuperavit })}
                      </p>
                    ) : (
                      <p className="text-[var(--landing-muted)]">{p(locale, "kcalBalance")}</p>
                    )}
                  </div>
                ) : null}
              </div>

              <div className="relative overflow-visible rounded-2xl border border-[var(--landing-border)] bg-[var(--landing-surface)] p-4">
                <p className="flex items-center gap-2 text-xs uppercase tracking-wide text-[var(--landing-muted)]">
                  {p(locale, "estimatedBmi")}
                  <button
                    type="button"
                    onClick={() => setModalInfoAbierto('imc')}
                    className="inline-flex items-center cursor-pointer transition-opacity hover:opacity-100"
                    aria-label={p(locale, "bmiWhatIsAria")}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 opacity-90">
                      <path d="M12 2a10 10 0 1 0 10 10A10.011 10.011 0 0 0 12 2Zm.75 15h-1.5v-1.5h1.5Zm1.971-6.279-.675.693A3.375 3.375 0 0 0 12.75 14.25h-1.5a4.875 4.875 0 0 1 1.425-3.45l.93-.936a1.875 1.875 0 1 0-3.195-1.326h-1.5a3.375 3.375 0 1 1 6.03 1.283Z" />
                    </svg>
                  </button>
                </p>
                <div className="mt-1 flex items-end gap-2">
                  <p className="font-display text-3xl font-bold text-[var(--foreground)]">{bmi.toFixed(1) || "-"}</p>
                  {bmi ? (
                    <span className="mb-1 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white" style={{ background: bmiBadgeColor() }}>
                      {bmiText}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-[var(--landing-muted)]">{p(locale, "bmiHint")}</p>

                <div className="mt-3">
                  <div className="flex items-center justify-between text-[10px] uppercase tracking-wide text-[var(--landing-muted)]">
                    <span>{p(locale, "underweight")}</span>
                    <span>{p(locale, "obesity")}</span>
                  </div>
                  <div className="relative mt-2 h-2 w-full rounded-full" style={{ background: bmiGradient }}>
                    <div
                      className="absolute top-0 h-2 rounded-full"
                      style={{
                        left: `${activeRangeStart}%`,
                        width: `${Math.max(activeRangeEnd - activeRangeStart, 2)}%`,
                        background: activeRangeColor + "66",
                      }}
                      aria-hidden
                    />
                    <div
                      className="absolute -top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white shadow-md"
                      style={{ left: `${bmiPct}%`, transform: "translateX(-50%)", background: activeRangeColor }}
                      aria-label={p(locale, "bmiGaugeAria")}
                    />
                    <div className="absolute -bottom-1 left-0 right-0">
                      <div className="relative h-2 w-full">
                        <span className="absolute h-2 w-px bg-white/50" style={{ left: `${p18}%` }} />
                        <span className="absolute h-2 w-px bg-white/50" style={{ left: `${p25}%` }} />
                        <span className="absolute h-2 w-px bg-white/50" style={{ left: `${p30}%` }} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Contexto del plan */}
          <section className="mt-6">
            <div className="mb-2">
              <h2 className="font-display text-base font-semibold text-[var(--foreground)]">{p(locale, "planContext")}</h2>
              <p className="text-xs text-[var(--landing-muted)]">{p(locale, "planContextSub")}</p>
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
              <div className="rounded-2xl border border-[var(--landing-border)] bg-[var(--landing-surface)] p-4 lg:col-span-3">
                <p className="mb-3 text-sm font-medium text-[var(--landing-muted)]">{p(locale, "planProgress")}</p>
                <div className="space-y-3">
                  <div>
                    <p className="mb-1 text-xs text-[var(--landing-muted)]">
                      {planMultiFase ? p(locale, "planStartCurrentPhase") : p(locale, "planStartDate")}
                    </p>
                    <p className="text-sm font-medium text-[var(--foreground)]">
                      {(planMultiFase ? fechaInicioEtapaActual : fechaInicioPlan)
                        ? (planMultiFase ? fechaInicioEtapaActual : fechaInicioPlan)!.toLocaleDateString(dateLocale, {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                        : p(locale, "loadingShort")}
                    </p>
                  </div>

                  {plan?.dificultad && (
                    <div>
                      <p className="mb-1 flex items-center gap-2 text-xs text-[var(--landing-muted)]">
                        {p(locale, "planDifficultyLabel")}
                        <button
                          type="button"
                          onClick={() => setModalInfoAbierto("dificultad")}
                          className="inline-flex items-center cursor-pointer transition-opacity hover:opacity-100"
                          aria-label={p(locale, "planDifficultyHelpAria")}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 opacity-90">
                            <path d="M12 2a10 10 0 1 0 10 10A10.011 10.011 0 0 0 12 2Zm.75 15h-1.5v-1.5h1.5Zm1.971-6.279-.675.693A3.375 3.375 0 0 0 12.75 14.25h-1.5a4.875 4.875 0 0 1 1.425-3.45l.93-.936a1.875 1.875 0 1 0-3.195-1.326h-1.5a3.375 3.375 0 1 1 6.03 1.283Z" />
                          </svg>
                        </button>
                      </p>
                      <div
                        className="inline-flex items-center gap-2 rounded-md border px-2.5 py-1"
                        style={{
                          backgroundColor: "rgba(255,255,255,0.05)",
                          borderColor:
                            plan.dificultad === "dificil"
                              ? "color-mix(in oklab, var(--danger) 40%, transparent)"
                              : plan.dificultad === "media"
                                ? "color-mix(in oklab, var(--warning) 40%, transparent)"
                                : "color-mix(in oklab, var(--success) 40%, transparent)",
                        }}
                      >
                        <span
                          className="text-xs font-medium capitalize"
                          style={{
                            color:
                              plan.dificultad === "dificil"
                                ? "var(--danger)"
                                : plan.dificultad === "media"
                                  ? "var(--warning)"
                                  : "var(--success)",
                          }}
                        >
                          {difficultyLabel(locale, plan.dificultad)}
                        </span>
                      </div>
                    </div>
                  )}

                  <div>
                    <p className="mb-1 text-xs text-[var(--landing-muted)]">{p(locale, "progressLabel")}</p>
                    <div className="flex items-center gap-2">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[var(--brand-start)] to-[var(--brand-end)] transition-all duration-300"
                          style={{ width: `${progresoPlan.porcentaje}%` }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-[var(--foreground)]">{Math.round(progresoPlan.porcentaje)}%</span>
                    </div>
                    <p className="mt-1 text-xs text-[var(--landing-muted)]">
                      {pFmt(locale, "daysProgress", {
                        current: progresoPlan.diasTranscurridos,
                        total: plan?.duracion_plan_dias || 30,
                      })}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-[var(--landing-border)] bg-[var(--landing-surface)] p-4 lg:col-span-3">
                <p className="mb-3 text-sm font-medium text-[var(--landing-muted)]">{p(locale, "personalProfile")}</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-[color-mix(in_oklab,var(--foreground)_4%,transparent)] px-2.5 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-[var(--landing-muted)]">{p(locale, "sex")}</p>
                    <p className="mt-1 text-sm font-semibold text-[var(--foreground)] capitalize">
                      {user?.sexo
                        ? user.sexo === "masculino"
                          ? p(locale, "sexMale")
                          : user.sexo === "femenino"
                            ? p(locale, "sexFemale")
                            : user.sexo
                        : "—"}
                    </p>
                  </div>
                  <div className="rounded-lg bg-[color-mix(in_oklab,var(--foreground)_4%,transparent)] px-2.5 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-[var(--landing-muted)]">{p(locale, "age")}</p>
                    <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">
                      {user?.edad ? `${user.edad} ${p(locale, "yearsOld")}` : "—"}
                    </p>
                  </div>
                  <div className="rounded-lg bg-[color-mix(in_oklab,var(--foreground)_4%,transparent)] px-2.5 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-[var(--landing-muted)]">{p(locale, "height")}</p>
                    <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">
                      {user?.alturaCm ? `${user.alturaCm} cm` : "—"}
                    </p>
                  </div>
                  <div className="rounded-lg bg-[color-mix(in_oklab,var(--foreground)_4%,transparent)] px-2.5 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-[var(--landing-muted)]">{p(locale, "baseWeight")}</p>
                    <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">
                      {user?.pesoKg ? `${user.pesoKg} kg` : "—"}
                    </p>
                  </div>
                </div>

                {(user?.pesoObjetivoKg || user?.atletico || user?.preferirRutina) && (
                  <div className="mt-2.5 space-y-1.5">
                    {user?.pesoObjetivoKg && (
                      <p className="text-xs text-[var(--landing-muted)]">
                        {p(locale, "targetWeightLine")}{" "}
                        <span className="font-semibold text-[var(--foreground)]">{user.pesoObjetivoKg} kg</span>
                      </p>
                    )}
                    {user?.atletico && (
                      <p className="text-xs text-[var(--landing-muted)]">
                        {p(locale, "athleticProfileYes")}{" "}
                        <span className="font-semibold text-[var(--foreground)]">{p(locale, "yes")}</span>
                      </p>
                    )}
                    {user?.preferirRutina && (
                      <p className="text-xs text-[var(--landing-muted)]">
                        {p(locale, "routineMealsActivated")}{" "}
                        <span className="font-semibold text-[var(--foreground)]">{p(locale, "activated")}</span>
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-[var(--landing-border)] bg-[var(--landing-surface)] p-4 lg:col-span-3">
                <p className="mb-3 flex items-center gap-2 text-sm font-medium text-[var(--landing-muted)]">
                  {p(locale, "preferencesRestrictionsTitle")}
                  {user?.doloresLesiones && user.doloresLesiones.filter((s: string) => typeof s === "string" && s.trim().length > 0).length > 0 && (
                    <div className="group relative">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 text-[var(--landing-accent)] opacity-80">
                        <path d="M12 2a10 10 0 1 0 10 10A10.011 10.011 0 0 0 12 2Zm.75 15h-1.5v-1.5h1.5Zm1.971-6.279-.675.693A3.375 3.375 0 0 0 12.75 14.25h-1.5a4.875 4.875 0 0 1 1.425-3.45l.93-.936a1.875 1.875 0 1 0-3.195-1.326h-1.5a3.375 3.375 0 1 1 6.03 1.283Z" />
                      </svg>
                      <div className="pointer-events-none absolute left-1/2 top-full z-40 mt-2 w-56 -translate-x-1/2 rounded-lg border border-[var(--landing-border)] bg-[color-mix(in_oklab,var(--background)_94%,#0b1020)] px-3 py-2 text-xs text-[var(--foreground)] opacity-0 shadow-lg transition-opacity duration-200 group-hover:opacity-100">
                        {p(locale, "injuriesTooltipModerate")}{" "}
                        <span className="font-medium">
                          {user.doloresLesiones.filter((s: string) => typeof s === "string" && s.trim().length > 0).join(", ")}
                        </span>
                      </div>
                    </div>
                  )}
                </p>
                <div className="space-y-2.5">
                  {user?.preferencias && user.preferencias.filter((s: string) => typeof s === "string" && s.trim().length > 0).length > 0 && (
                    <div>
                      <p className="mb-1 text-xs font-medium text-[var(--landing-muted)]">{p(locale, "preferences")}</p>
                      <div className="flex flex-wrap gap-1">
                        {user.preferencias.filter((s: string) => typeof s === "string" && s.trim().length > 0).map((pref: string, idx: number) => (
                          <span key={`pref-${idx}-${pref}`} className="inline-flex items-center rounded-full border border-[color-mix(in_oklab,var(--brand-end)_35%,transparent)] bg-[color-mix(in_oklab,var(--brand-end)_20%,transparent)] px-2 py-0.5 text-xs text-[var(--foreground)]">
                            {pref}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {user?.restricciones && user.restricciones.filter((s: string) => typeof s === "string" && s.trim().length > 0).length > 0 && (
                    <div>
                      <p className="mb-1 text-xs font-medium text-[var(--landing-muted)]">{p(locale, "restrictions")}</p>
                      <div className="flex flex-wrap gap-1">
                        {user.restricciones.filter((s: string) => typeof s === "string" && s.trim().length > 0).map((restr: string, idx: number) => (
                          <span key={`restr-${idx}-${restr}`} className="inline-flex items-center rounded-full border border-[color-mix(in_oklab,var(--brand-start)_35%,transparent)] bg-[color-mix(in_oklab,var(--brand-start)_20%,transparent)] px-2 py-0.5 text-xs text-[var(--foreground)]">
                            {restr}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {user?.patologias && user.patologias.filter((s: string) => typeof s === "string" && s.trim().length > 0).length > 0 && (
                    <div>
                      <p className="mb-1 text-xs font-medium text-[var(--landing-muted)]">{p(locale, "conditions")}</p>
                      <div className="flex flex-wrap gap-1">
                        {user.patologias.filter((s: string) => typeof s === "string" && s.trim().length > 0).map((pat: string, idx: number) => (
                          <span key={`pat-${idx}-${pat}`} className="inline-flex items-center rounded-full border border-[color-mix(in_oklab,var(--landing-accent)_35%,transparent)] bg-[color-mix(in_oklab,var(--landing-accent)_20%,transparent)] px-2 py-0.5 text-xs text-[var(--foreground)]">
                            {pat}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {user?.doloresLesiones && user.doloresLesiones.filter((s: string) => typeof s === "string" && s.trim().length > 0).length > 0 && (
                    <div>
                      <p className="mb-1 text-xs font-medium text-[var(--landing-muted)]">{p(locale, "painInjuries")}</p>
                      <div className="flex flex-wrap gap-1">
                        {user.doloresLesiones.filter((s: string) => typeof s === "string" && s.trim().length > 0).map((dolor: string, idx: number) => (
                          <span key={`dolor-${idx}-${dolor}`} className="inline-flex items-center rounded-full border border-[color-mix(in_oklab,var(--brand-mid)_35%,transparent)] bg-[color-mix(in_oklab,var(--brand-mid)_20%,transparent)] px-2 py-0.5 text-xs text-[var(--foreground)]">
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
                      <p className="text-xs text-[var(--landing-muted)]">{p(locale, "noPrefsRegistered")}</p>
                    )}
                </div>
              </div>

              <div className="relative overflow-visible rounded-2xl border border-[var(--landing-border)] bg-[var(--landing-surface)] p-4 lg:col-span-3">
                <p className="flex items-center gap-2 text-sm font-medium text-[var(--landing-muted)]">
                  {p(locale, "macrosSectionTitle")}
                  <button
                    type="button"
                    onClick={() => setModalInfoAbierto("macros")}
                    className="inline-flex items-center cursor-pointer transition-opacity hover:opacity-100"
                    aria-label={p(locale, "macrosWhatAria")}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 opacity-90">
                      <path d="M12 2a10 10 0 1 0 10 10A10.011 10.011 0 0 0 12 2Zm.75 15h-1.5v-1.5h1.5Zm1.971-6.279-.675.693A3.375 3.375 0 0 0 12.75 14.25h-1.5a4.875 4.875 0 0 1 1.425-3.45l.93-.936a1.875 1.875 0 1 0-3.195-1.326h-1.5a3.375 3.375 0 1 1 6.03 1.283Z" />
                    </svg>
                  </button>
                </p>

                <div className="mt-3 grid grid-cols-3 gap-2">
                  <div className="rounded-lg bg-[color-mix(in_oklab,var(--foreground)_4%,transparent)] p-2 text-center">
                    <p className="text-[10px] uppercase tracking-wide text-[var(--landing-muted)]">{p(locale, "protein")}</p>
                    <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">{plan.macros.proteinas}</p>
                  </div>
                  <div className="rounded-lg bg-[color-mix(in_oklab,var(--foreground)_4%,transparent)] p-2 text-center">
                    <p className="text-[10px] uppercase tracking-wide text-[var(--landing-muted)]">{p(locale, "fats")}</p>
                    <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">{plan.macros.grasas}</p>
                  </div>
                  <div className="rounded-lg bg-[color-mix(in_oklab,var(--foreground)_4%,transparent)] p-2 text-center">
                    <p className="text-[10px] uppercase tracking-wide text-[var(--landing-muted)]">{p(locale, "carbs")}</p>
                    <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">{plan.macros.carbohidratos}</p>
                  </div>
                </div>

                {distrib ? (
                  <div className="mt-3 rounded-lg bg-[color-mix(in_oklab,var(--foreground)_3%,transparent)] px-3 py-2 text-xs text-[var(--landing-muted)]">
                    {pFmt(locale, "dailyDistribMeals", {
                      b: distrib.desayuno || 0,
                      l: distrib.almuerzo || 0,
                      s: snackCalculado,
                      c: distrib.cena || 0,
                    })}
                  </div>
                ) : null}
              </div>
            </div>

            {/* Composición opcional */}
            {(user?.cinturaCm && user?.cuelloCm) ? (
              <div className="mt-4 rounded-2xl border border-[var(--landing-border)] bg-[var(--landing-surface)] p-4">
                <p className="text-sm font-medium text-[var(--landing-muted)]">{p(locale, "optionalComposition")}</p>
                {(() => {
                  const bf = calculateBodyFatUSNavy(user!.sexo, user!.alturaCm, user!.cuelloCm, user!.cinturaCm, user!.caderaCm);
                  const bfCat = bodyFatCategory(user!.sexo, bf, user!.atletico);
                  const whtr = waistToHeightRatio(user!.cinturaCm, user!.alturaCm);
                  const whtrCat = whtrCategory(whtr ?? undefined);
                  return (
                    <div className="mt-2 grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
                      {bf != null ? (
                        <p className="text-[var(--foreground)]">
                          {p(locale, "bodyFatEstimated")} {bf}% {bfCat ? `· ${bfCat}` : ""}
                        </p>
                      ) : (
                        <p className="text-[var(--landing-muted)]">{p(locale, "addMeasuresHint")}</p>
                      )}
                      {whtr != null ? (
                        <p className="text-[var(--foreground)]">
                          {p(locale, "waistHeightLabel")} {whtr} {whtrCat ? `· ${whtrCat}` : ""}
                        </p>
                      ) : null}
                      <p className="md:col-span-2 text-xs text-[var(--landing-muted)]">{p(locale, "bodyCompDisclaimerShort")}</p>
                    </div>
                  );
                })()}
              </div>
            ) : null}
          </section>

          {(() => {
            const content = _renderRecomendaciones();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return content as any;
          })()}

          {/* Selector de vista (Entrenamiento/Alimentación) */}
          <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => {
                setVistaPlan("entrenamiento");
                setCalendarResetKey((prev) => prev + 1);
              }}
              className={`rounded-xl border px-4 py-3 text-left transition-colors ${
                vistaPlan === "entrenamiento"
                  ? "border-[color-mix(in_oklab,var(--brand-end)_45%,var(--landing-border))] bg-[color-mix(in_oklab,var(--brand-end)_14%,transparent)]"
                  : "border-[var(--landing-border)] bg-[color-mix(in_oklab,var(--foreground)_3%,transparent)] hover:bg-[color-mix(in_oklab,var(--foreground)_6%,transparent)]"
              }`}
            >
              <p className="text-sm font-semibold text-[var(--foreground)]">🏋️ {p(locale, "viewTraining")}</p>
              <p className="mt-1 text-xs text-[var(--landing-muted)]">
                {hasTrainingPlan ? p(locale, "viewTrainingSub") : p(locale, "viewTrainingSubEmpty")}
              </p>
            </button>
            <button
              type="button"
              onClick={() => setVistaPlan("alimentacion")}
              className={`rounded-xl border px-4 py-3 text-left transition-colors ${
                vistaPlan === "alimentacion"
                  ? "border-success/40 bg-success/15"
                  : "border-[var(--landing-border)] bg-[color-mix(in_oklab,var(--foreground)_3%,transparent)] hover:bg-[color-mix(in_oklab,var(--foreground)_6%,transparent)]"
              }`}
            >
              <p className="text-sm font-semibold text-[var(--foreground)]">🍽️ {p(locale, "viewFood")}</p>
              <p className="mt-1 text-xs text-[var(--landing-muted)]">
                {hasFoodPlan ? p(locale, "viewFoodSub") : p(locale, "viewFoodSubEmpty")}
              </p>
            </button>
          </div>

          {/* Calendario de entrenamiento */}
          {vistaPlan === "entrenamiento" && (
            <div className="mt-4 rounded-2xl border border-[var(--landing-border)] bg-[var(--landing-surface)] p-4 md:p-5">
              {!hasTrainingPlan ? (
                <div className="rounded-xl border border-[var(--landing-border)] bg-[color-mix(in_oklab,var(--foreground)_2%,transparent)] px-4 py-6 text-center">
                  <p className="text-sm font-medium text-[var(--foreground)]">{p(locale, "noRoutineYet")}</p>
                  <p className="mt-1 text-xs text-[var(--landing-muted)]">{p(locale, "noRoutineHint")}</p>
                  <button
                    type="button"
                    onClick={() => setVistaPlan("alimentacion")}
                    className="mt-3 rounded-lg border border-success/35 bg-success/15 px-3 py-1.5 text-xs font-medium text-[var(--foreground)] transition-colors hover:bg-success/25"
                  >
                    {p(locale, "goToFood")}
                  </button>
                </div>
              ) : hasTrainingPlan ? (
                <div>
                  {(() => {
                    const trainingPlanView = ((plan as unknown as Record<string, unknown>)?.training_plan as TrainingPlan | undefined);
                    const weekList = trainingPlanView?.weeks ?? [];
                    return (
                      <>
                  <div className="mb-3">
                    <h3 className="font-display text-base font-semibold text-[var(--foreground)]">{p(locale, "trainingPlanHeading")}</h3>
                  </div>
                  {weekList.length > 0 ? (
                    <div className="space-y-4">
                      {weekList.map((week, weekIdx) => (
                        <div key={weekIdx} className="overflow-hidden rounded-lg border border-[var(--landing-border)]">
                          <div className="divide-y divide-[var(--landing-border)]">
                            {(week.days ?? []).map((day, dayIdx) => (
                              <details key={dayIdx} className="group">
                                <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 transition-colors hover:bg-[color-mix(in_oklab,var(--foreground)_4%,transparent)]">
                                  {(() => {
                                    const grupos = Array.from(
                                      new Set(
                                        (day.ejercicios ?? [])
                                          .map((ex) => (typeof ex.muscle_group === "string" ? ex.muscle_group.trim() : ""))
                                          .filter((g) => g.length > 0)
                                      )
                                    );
                                    return (
                                      <span className="text-sm font-semibold text-[var(--foreground)]">
                                        {translatePlanDayLabel(day.day || `Día ${dayIdx + 1}`, locale)}
                                        {grupos.length > 0 ? ` (${grupos.join(", ")})` : ""}
                                      </span>
                                    );
                                  })()}
                                  <span className="ml-auto text-sm text-[var(--landing-muted)]">
                                    {exerciseCountLabel(locale, day.ejercicios?.length || 0)}
                                  </span>
                                </summary>
                                <div className="space-y-3 bg-[color-mix(in_oklab,var(--foreground)_3%,transparent)] px-4 py-4">
                                  {day.ejercicios && day.ejercicios.length > 0 ? (
                                    day.ejercicios.map((ex, exIdx) => (
                                      <div key={exIdx} className="rounded border border-[var(--landing-border)] bg-[var(--landing-surface)] p-3 text-sm">
                                        <div className="font-medium text-[var(--brand-end)]">{ex.name}</div>
                                        <div className="mt-1 space-y-0.5 text-[var(--landing-muted)]">
                                          <div>
                                            💪{" "}
                                            {pFmt(locale, "seriesRepsLine", {
                                              sets: ex.sets,
                                              reps: ex.reps,
                                            })}
                                          </div>
                                          {ex.rpe && (
                                            <div>
                                              📊 {p(locale, "rpeLine")} {ex.rpe}/10
                                            </div>
                                          )}
                                          {ex.rest_seconds && (
                                            <div>
                                              ⏱️ {p(locale, "restSeconds")} {ex.rest_seconds}s
                                            </div>
                                          )}
                                          {ex.muscle_group && (
                                            <div>
                                              🎯 {p(locale, "musculatura")} {translateMuscleGroup(ex.muscle_group, locale)}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    ))
                                  ) : (
                                    <div className="text-sm italic text-[var(--landing-muted)]">{p(locale, "restOff")}</div>
                                  )}
                                </div>
                              </details>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-4 text-center text-[var(--landing-muted)]">{p(locale, "noTrainingAvailable")}</div>
                  )}
                      </>
                    );
                  })()}
                </div>
              ) : null}
            </div>
          )}

          {/* Vista: Alimentación (resumen semanal) */}
          {vistaPlan === "alimentacion" && (
            <div className="mt-4 rounded-2xl border border-[var(--landing-border)] bg-[var(--landing-surface)] p-4 md:p-5">
              {!hasFoodPlan ? (
                <div className="rounded-xl border border-[var(--landing-border)] bg-[color-mix(in_oklab,var(--foreground)_2%,transparent)] px-4 py-6 text-center">
                  <p className="text-sm font-medium text-[var(--foreground)]">{p(locale, "noMealPlan")}</p>
                  <p className="mt-1 text-xs text-[var(--landing-muted)]">{p(locale, "genMealPlanHint")}</p>
                </div>
              ) : (
                <>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-display text-base font-semibold text-[var(--foreground)]">{p(locale, "mealPlanHeading")}</h3>
                {/* Botones de seguimiento - Alineados a la derecha del título */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative group">
                    <button
              onClick={() => {
                        if (isPremium) {
                          setWeeklyStatsModalOpen(true);
                        }
                      }}
                      disabled={!isPremium}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                        !isPremium
                          ? 'cursor-not-allowed border-[var(--landing-border)] bg-[color-mix(in_oklab,var(--foreground)_4%,transparent)] text-[var(--landing-muted)] opacity-50'
                          : 'border-success/40 bg-success/15 text-[var(--foreground)] hover:bg-success/25'
                      }`}
                    >
                      <FaChartLine className="h-3.5 w-3.5" />
                      {p(locale, "weeklyOverageStats")}
                      {!isPremium && (
                        <span className="ml-1 text-xs">🌟</span>
                      )}
            </button>
                    {!isPremium && (
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-warning text-white text-xs font-medium rounded-lg shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 border border-warning/50">
                        💳 {p(locale, "requiresPremium")}
                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                          <div className="w-2 h-2 bg-warning rotate-45 border-r border-b border-warning/50"></div>
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
                      className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                        !isPremium
                          ? 'cursor-not-allowed border-[var(--landing-border)] bg-[color-mix(in_oklab,var(--foreground)_4%,transparent)] text-[var(--landing-muted)] opacity-50'
                          : 'border-[color-mix(in_oklab,var(--brand-end)_50%,var(--landing-border))] bg-[color-mix(in_oklab,var(--brand-end)_16%,transparent)] text-[var(--foreground)] hover:bg-[color-mix(in_oklab,var(--brand-end)_24%,transparent)]'
                      }`}
                    >
                      <FaUtensils className="h-3.5 w-3.5" />
                      {p(locale, "ateTooMuch")}
                      {!isPremium && (
                        <span className="ml-1 text-xs">🌟</span>
                      )}
            </button>
                    {!isPremium && (
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-warning text-white text-xs font-medium rounded-lg shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 border border-warning/50">
                        💳 {p(locale, "requiresPremium")}
                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                          <div className="w-2 h-2 bg-warning rotate-45 border-r border-b border-warning/50"></div>
          </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                {plan.plan_semanal.map((dia, idx) => (
                  <details
                    key={`food-day-${idx}-${dia.dia}`}
                    className="group overflow-hidden rounded-xl border border-[var(--landing-border)] bg-[color-mix(in_oklab,var(--foreground)_3%,transparent)]"
                  >
                    <summary className="flex cursor-pointer items-center justify-between gap-2 px-3 py-2.5 transition-colors hover:bg-[color-mix(in_oklab,var(--foreground)_4%,transparent)]">
                      <span className="text-sm font-semibold text-[var(--foreground)]">{translatePlanDayLabel(dia.dia, locale)}</span>
                      <span className="text-xs text-[var(--landing-muted)]">{dia.comidas.length} {p(locale, "mealsCount")}</span>
                    </summary>
                    <div className="space-y-2 border-t border-[var(--landing-border)] px-3 py-3">
                      {dia.comidas.map((c, ci) => (
                        <div key={`food-${idx}-${ci}`} className="rounded-lg border border-[var(--landing-border)] bg-[var(--landing-surface)] p-2.5">
                          <div className="mb-1.5 flex items-center justify-between gap-2">
                            <span className="text-sm font-medium text-[var(--foreground)]">{translateMealSlotName(c.nombre, locale)}</span>
                            {c.hora ? (
                              <span className="rounded-md bg-[color-mix(in_oklab,var(--foreground)_6%,transparent)] px-2 py-0.5 text-[11px] text-[var(--landing-muted)]">
                                {c.hora}
                              </span>
                            ) : null}
                          </div>
                          {(() => {
                            const opciones = (Array.isArray(c.opciones) && c.opciones.length > 0)
                              ? c.opciones.filter((o: string) => o && typeof o === "string" && o.trim().length > 0 && !o.toLowerCase().includes("opción disponible") && !o.toLowerCase().includes("opcion disponible"))
                              : [];
                            const principal = opciones[0] || c.nombre;
                            const variantes = opciones.slice(1);
                            return (
                              <div>
                                <p className="text-sm text-[var(--foreground)]">{principal}</p>
                                {variantes.length > 0 ? (
                                  <ul className="mt-1 space-y-0.5 pl-4 text-xs text-[var(--landing-muted)]">
                                    {variantes.map((v, vi) => (
                                      <li key={`food-var-${idx}-${ci}-${vi}`} className="list-disc">{v}</li>
                                    ))}
                                  </ul>
                                ) : null}
                              </div>
                            );
                          })()}
                        </div>
                      ))}
                    </div>
                  </details>
                ))}
              </div>
                </>
              )}
            </div>
          )}

          {/* Sección de Suplementos - Solo para planes multi-fase */}
          {planMultiFase && planMultiFase.suplementosBase && planMultiFase.suplementosBase.length > 0 && (
            <div className="mt-8">
              <h2 className="font-display text-xl font-semibold mb-3 flex items-center gap-2">
                💊 Suplementación Recomendada
                <span className={`px-2 py-0.5 text-xs rounded-lg ${
                  planMultiFase.faseActual === "BULK"
                    ? "bg-phase-bulk/20 text-phase-bulk"
                    : planMultiFase.faseActual === "CUT"
                    ? "bg-phase-cut/20 text-phase-cut"
                    : "bg-phase-lean-bulk/20 text-phase-lean-bulk"
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
                        ? "bg-success/10 border-success/30" 
                        : sup.prioridad === "recomendado"
                        ? "bg-info/10 border-info/30"
                        : "bg-white/5 border-white/10"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-display font-medium flex items-center gap-2">
                          {sup.nombre}
                          {sup.prioridad === "esencial" && (
                            <span className="px-1.5 py-0.5 text-xs bg-success/30 text-success rounded">
                              Esencial
                            </span>
                          )}
                          {sup.prioridad === "recomendado" && (
                            <span className="px-1.5 py-0.5 text-xs bg-info/30 text-info rounded">
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
            <section className="mt-8">
              <details className="group overflow-hidden rounded-2xl border border-[var(--landing-border)] bg-[var(--landing-surface)]">
                <summary className="flex cursor-pointer items-center justify-between gap-2 px-4 py-3 transition-colors hover:bg-[color-mix(in_oklab,var(--foreground)_3%,transparent)]">
                  <h2 className="font-display text-base font-semibold text-[var(--foreground)]">{p(locale, "shoppingList")}</h2>
                  <span className="rounded-full border border-[var(--landing-border)] bg-[color-mix(in_oklab,var(--foreground)_3%,transparent)] px-2.5 py-1 text-xs text-[var(--landing-muted)]">
                    {plan.lista_compras.length} items
                  </span>
                </summary>
                <div className="border-t border-[var(--landing-border)] p-4">
                  <p className="mb-3 text-xs text-[var(--landing-muted)]">{p(locale, "shoppingListSub")}</p>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    {plan.lista_compras.map((item, i) => (
                      <div
                        key={`compras-${i}-${item}`}
                        className="flex items-start gap-2 rounded-lg border border-[var(--landing-border)] bg-[color-mix(in_oklab,var(--foreground)_3%,transparent)] px-3 py-2"
                      >
                        <span className="mt-0.5 text-success">✓</span>
                        <span className="text-sm text-[var(--foreground)]">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </details>
            </section>
          ) : null}

          {plan.progresion_semanal?.length ? (
            <div className="mt-8">
              <h2 className="font-display text-xl font-semibold mb-3">Progresión semanal</h2>
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
              <h2 className="font-display text-xl font-semibold mb-4 flex items-center gap-2">
                📈 Historial y Progreso
                {planMultiFase.estado === "activo" && (
                  <span className="px-2 py-0.5 text-xs rounded-lg bg-success/20 text-success">
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
                        <p className="font-display text-2xl font-bold text-success">
                          {progreso.mesesCompletados}/{planMultiFase.totalMeses}
                        </p>
                        <p className="text-xs opacity-70">Meses completados</p>
                      </div>
                      <div>
                        <p className={`font-display text-2xl font-bold ${progreso.cambioNeto > 0 ? "text-warning" : progreso.cambioNeto < 0 ? "text-info" : "text-white"}`}>
                          {progreso.cambioNeto > 0 ? "+" : ""}{progreso.cambioNeto.toFixed(1)} kg
                        </p>
                        <p className="text-xs opacity-70">Cambio neto</p>
                      </div>
                      <div>
                        <p className="font-display text-2xl font-bold text-info">
                          {progreso.adherenciaPromedio.toFixed(0)}%
                        </p>
                        <p className="text-xs opacity-70">Adherencia promedio</p>
                      </div>
                      <div>
                        <p className="font-display text-2xl font-bold text-phase-maintenance">
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
                                ? "bg-phase-bulk"
                                : fase.nombre === "CUT"
                                ? "bg-phase-cut"
                                : fase.nombre === "LEAN_BULK"
                                ? "bg-phase-lean-bulk"
                                : "bg-phase-maintenance"
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
                          ? "bg-gradient-to-r from-info/10 to-phase-maintenance/10 border-info/30" 
                          : completado
                          ? "bg-white/5 border-white/10"
                          : "bg-white/3 border-white/5 opacity-70"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                            esActual 
                              ? "bg-info/30 text-info" 
                              : completado
                              ? "bg-success/30 text-success"
                              : "bg-white/10 text-white/50"
                          }`}>
                            {esActual ? "📍" : completado ? "✓" : mes.mesNumero}
                          </div>
                          <div>
                            <p className="font-medium flex items-center gap-2">
                              Mes {mes.mesNumero}
                              <span className={`px-2 py-0.5 text-xs rounded ${
                                mes.faseEnEsteMes === "BULK"
                                  ? "bg-phase-bulk/20 text-phase-bulk"
                                  : mes.faseEnEsteMes === "CUT"
                                  ? "bg-phase-cut/20 text-phase-cut"
                                  : "bg-phase-lean-bulk/20 text-phase-lean-bulk"
                              }`}>
                                {mes.faseEnEsteMes}
                              </span>
                              {esActual && (
                                <span className="px-2 py-0.5 text-xs rounded bg-info/20 text-info">
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
                                    ? "text-warning" 
                                    : mes.datosAlFinalizar.peso < mes.datosAlIniciar.peso
                                    ? "text-info"
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
                              mes.datosAlFinalizar.adherenciaComida === ">80%" ? "text-success" :
                              mes.datosAlFinalizar.adherenciaComida === "70-80%" ? "text-info" :
                              mes.datosAlFinalizar.adherenciaComida === "50-70%" ? "text-warning" :
                              "text-danger"
                            }>{mes.datosAlFinalizar.adherenciaComida}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="opacity-50">Adherencia entreno:</span>
                            <span className={
                              mes.datosAlFinalizar.adherenciaEntreno === ">80%" ? "text-success" :
                              mes.datosAlFinalizar.adherenciaEntreno === "70-80%" ? "text-info" :
                              mes.datosAlFinalizar.adherenciaEntreno === "50-70%" ? "text-warning" :
                              "text-danger"
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

          {/* Proyecciones y resultados esperados */}
          {proyecciones && (
            <section className="mt-8">
              <div className="mb-2">
                <h2 className="font-display text-base font-semibold text-[var(--foreground)]">{p(locale, "projectionsHeading")}</h2>
                <p className="text-xs text-[var(--landing-muted)]">{p(locale, "projectionsSub")}</p>
              </div>

              <div className="rounded-2xl border border-[var(--landing-border)] bg-[var(--landing-surface)] p-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="rounded-xl border border-[var(--landing-border)] bg-[color-mix(in_oklab,var(--foreground)_3%,transparent)] p-3">
                    <p className="text-xs uppercase tracking-wide text-[var(--landing-muted)]">{p(locale, "changeHorizon")}</p>
                    <p className="mt-1 text-lg font-semibold text-[var(--foreground)]">{proyecciones.tiempoEstimado}</p>
                    <p className="mt-1 text-xs text-[var(--landing-muted)]">
                      {pFmt(locale, "resultsVisibleFrom", { n: mesesCambiosVisibles })}
                    </p>
                  </div>

                  {(user?.objetivo === "ganar_masa" || user?.objetivo === "volumen" || user?.objetivo === "recomposicion") && proyecciones.musculoGananciaMensual ? (
                    <div className="rounded-xl border border-success/35 bg-success/10 p-3">
                      <p className="text-xs uppercase tracking-wide text-[var(--landing-muted)]">{p(locale, "monthlyGainEst")}</p>
                      <p className="mt-1 text-lg font-semibold text-success">{proyecciones.musculoGananciaMensual}</p>
                    </div>
                  ) : null}

                  {(user?.objetivo === "perder_grasa" || user?.objetivo === "corte" || user?.objetivo === "definicion") && proyecciones.grasaPerdidaMensual ? (
                    <div className="rounded-xl border border-success/35 bg-success/10 p-3">
                      <p className="text-xs uppercase tracking-wide text-[var(--landing-muted)]">{p(locale, "monthlyLossEst")}</p>
                      <p className="mt-1 text-lg font-semibold text-success">{proyecciones.grasaPerdidaMensual}</p>
                    </div>
                  ) : null}
                </div>

                {proyecciones.proyecciones.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {proyecciones.proyecciones.map((proyeccion, idx) => (
                      <div key={`proj-last-${idx}-${proyeccion}`} className="flex items-start gap-2 text-sm text-[var(--foreground)]">
                        <span className="mt-0.5 text-[var(--brand-end)]">•</span>
                        <span className="leading-relaxed">{proyeccion}</span>
                      </div>
                    ))}
                  </div>
                ) : null}

                <p className="mt-3 border-t border-[var(--landing-border)] pt-3 text-xs text-[var(--landing-muted)]">{p(locale, "projectionsFootnote")}</p>
              </div>
            </section>
          )}
        </motion.div>
      </div>
      
      {/* Modal de Edición */}
      <AnimatePresence>
        {modalAbierto && datosEdicion && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-2 backdrop-blur-md sm:p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setModalAbierto(false);
              }
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 10 }}
              transition={{ type: "spring", damping: 26, stiffness: 320 }}
              className="relative w-full max-w-3xl overflow-y-auto rounded-2xl border border-[var(--landing-border)] bg-[color-mix(in_oklab,var(--background)_94%,#0f172a)] p-4 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.75)] sm:p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setModalAbierto(false)}
                className="absolute right-3 top-3 rounded-lg p-1.5 text-[var(--landing-muted)] transition hover:bg-[var(--landing-surface)] hover:text-[var(--foreground)]"
                aria-label={p(locale, "modalClose")}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>

              <h2 className="font-display pr-10 text-xl font-semibold text-[var(--foreground)] sm:text-2xl">{p(locale, "editPlanTitle")}</h2>
              <p className="mt-1 text-xs text-[var(--landing-muted)]">{p(locale, "editPlanSubtitle")}</p>
              
              <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-[var(--landing-muted)]">{p(locale, "fieldName")}</span>
                  <input
                    className="rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface)] px-3 py-2 text-sm text-[var(--foreground)] outline-none transition focus:border-[color-mix(in_oklab,var(--brand-end)_45%,transparent)] focus:ring-2 focus:ring-[color-mix(in_oklab,var(--brand-end)_22%,transparent)]"
                    value={datosEdicion.nombre}
                    onChange={(e) => setDatosEdicion({ ...datosEdicion, nombre: e.target.value })}
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-[var(--landing-muted)]">{p(locale, "age")}</span>
                  <input
                    type="number"
                    className="rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface)] px-3 py-2 text-sm text-[var(--foreground)] outline-none transition focus:border-[color-mix(in_oklab,var(--brand-end)_45%,transparent)] focus:ring-2 focus:ring-[color-mix(in_oklab,var(--brand-end)_22%,transparent)]"
                    value={datosEdicion.edad}
                    onChange={(e) => setDatosEdicion({ ...datosEdicion, edad: Number(e.target.value) })}
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-[var(--landing-muted)]">{p(locale, "fieldWeightKg")}</span>
                  <input
                    type="number"
                    className="rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface)] px-3 py-2 text-sm text-[var(--foreground)] outline-none transition focus:border-[color-mix(in_oklab,var(--brand-end)_45%,transparent)] focus:ring-2 focus:ring-[color-mix(in_oklab,var(--brand-end)_22%,transparent)]"
                    value={datosEdicion.pesoKg}
                    onChange={(e) => setDatosEdicion({ ...datosEdicion, pesoKg: Number(e.target.value) })}
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-[var(--landing-muted)]">{p(locale, "fieldHeightCm")}</span>
                  <input
                    type="number"
                    className="rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface)] px-3 py-2 text-sm text-[var(--foreground)] outline-none transition focus:border-[color-mix(in_oklab,var(--brand-end)_45%,transparent)] focus:ring-2 focus:ring-[color-mix(in_oklab,var(--brand-end)_22%,transparent)]"
                    value={datosEdicion.alturaCm}
                    onChange={(e) => setDatosEdicion({ ...datosEdicion, alturaCm: Number(e.target.value) })}
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-[var(--landing-muted)]">{p(locale, "fieldSex")}</span>
                  <select
                    className="rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface)] px-3 py-2 text-sm text-[var(--foreground)] outline-none transition focus:border-[color-mix(in_oklab,var(--brand-end)_45%,transparent)] focus:ring-2 focus:ring-[color-mix(in_oklab,var(--brand-end)_22%,transparent)]"
                    value={datosEdicion.sexo}
                    onChange={(e) => setDatosEdicion({ ...datosEdicion, sexo: e.target.value as "masculino" | "femenino" })}
                  >
                    <option value="masculino">{p(locale, "sexMale")}</option>
                    <option value="femenino">{p(locale, "sexFemale")}</option>
                  </select>
                </label>
                {!isPremium && (
                  <>
                    <label className="flex flex-col gap-1">
                      <span className="text-sm opacity-80">{p(locale, "fieldGymDaysWeek")}</span>
                      <input
                        type="number"
                        min={1} max={7}
                        className="rounded-xl bg-white/5 px-3 py-2 outline-none w-24"
                        value={datosEdicion.diasGym || ''}
                        onChange={(e) => setDatosEdicion({ ...datosEdicion, diasGym: e.target.value ? Number(e.target.value) : undefined })}
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-sm opacity-80">{p(locale, "fieldCardioDaysWeek")}</span>
                      <input
                        type="number"
                        min={0} max={7}
                        className="rounded-xl bg-white/5 px-3 py-2 outline-none w-24"
                        value={datosEdicion.diasCardio || ''}
                        onChange={(e) => setDatosEdicion({ ...datosEdicion, diasCardio: e.target.value ? Number(e.target.value) : undefined })}
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-sm opacity-80">{p(locale, "fieldExperience")}</span>
                      <select
                        className="rounded-xl bg-white/5 px-3 py-2 text-white"
                        style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)', color: 'var(--foreground)' }}
                        value={datosEdicion.nivelExperiencia || 'intermedio'}
                        onChange={(e) =>
                          setDatosEdicion({
                            ...datosEdicion,
                            nivelExperiencia: e.target.value as "principiante" | "intermedio" | "avanzado",
                          })
                        }
                      >
                        <option value="principiante">{p(locale, "expBeginner")}</option>
                        <option value="intermedio">{p(locale, "expIntermediate")}</option>
                        <option value="avanzado">{p(locale, "expAdvanced")}</option>
                      </select>
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-sm opacity-80">{p(locale, "fieldEquipment")}</span>
                      <select
                        className="rounded-xl bg-white/5 px-3 py-2 text-white"
                        style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)', color: 'var(--foreground)' }}
                        value={datosEdicion.equipamiento || 'gimnasio'}
                        onChange={(e) =>
                          setDatosEdicion({
                            ...datosEdicion,
                            equipamiento: e.target.value as "gimnasio" | "casa" | "sin_equipo",
                          })
                        }
                      >
                        <option value="gimnasio">{p(locale, "equipFullGym")}</option>
                        <option value="casa">{p(locale, "equipHomeDb")}</option>
                        <option value="sin_equipo">{p(locale, "equipNoEquip")}</option>
                      </select>
                    </label>
                  </>
                )}
                <label className="flex flex-col gap-1">
                  <span className="text-sm opacity-80">{p(locale, "fieldWaistOptional")}</span>
                  <input
                    type="number"
                    className="rounded-xl bg-white/5 px-3 py-2 outline-none"
                    value={datosEdicion.cinturaCm ?? ""}
                    onChange={(e) => setDatosEdicion({ ...datosEdicion, cinturaCm: e.target.value ? Number(e.target.value) : undefined })}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-sm opacity-80">{p(locale, "fieldNeckOptional")}</span>
                  <input
                    type="number"
                    className="rounded-xl bg-white/5 px-3 py-2 outline-none"
                    value={datosEdicion.cuelloCm ?? ""}
                    onChange={(e) => setDatosEdicion({ ...datosEdicion, cuelloCm: e.target.value ? Number(e.target.value) : undefined })}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-sm opacity-80">{p(locale, "fieldHipOptional")}</span>
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
                    {p(locale, "fieldAthleticProfile")}
                  </span>
                </label>
                <label className="flex flex-col gap-1 md:col-span-2">
                  <span className="text-sm opacity-80">{p(locale, "prefsComma")}</span>
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
                  <span className="text-sm opacity-80">{p(locale, "restrComma")}</span>
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
                  <span className="text-sm opacity-80">{p(locale, "pathologiasComma")}</span>
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
                  <p className="text-xs opacity-60 mt-1">{p(locale, "pathologiasHint")}</p>
                </label>
                <label className="flex flex-col gap-1 md:col-span-2">
                  <span className="text-sm opacity-80 flex items-center gap-2">
                    {p(locale, "injuriesComma")}
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
                  <p className="text-xs opacity-60 mt-1">{p(locale, "injuriesHint")}</p>
                </label>
                <label className="flex items-start gap-3 md:col-span-2">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4"
                    checked={!!((datosEdicion as unknown as Record<string, unknown>).preferirRutina)}
                    onChange={(e) => setDatosEdicion({ ...datosEdicion, preferirRutina: e.target.checked } as unknown as UserInput)}
                  />
                  <span className="text-sm opacity-80">
                    {p(locale, "routineMealsCheckbox")}
                    <span className="block text-xs opacity-60 mt-0.5">
                      {p(locale, "routineMealsCheckboxSub")}
                    </span>
                  </span>
                </label>
      </div>
              
              <div className="mt-6 flex flex-col-reverse gap-2 border-t border-[var(--landing-border)] pt-4 sm:flex-row sm:justify-end">
            <button
                  className="rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface)] px-5 py-2.5 text-sm font-medium text-[var(--foreground)] transition hover:bg-[var(--landing-surface-2)]"
                  onClick={() => setModalAbierto(false)}
                >
                  {p(locale, "cancel")}
            </button>
            <button
                  className="rounded-xl border border-[color-mix(in_oklab,var(--brand-end)_45%,transparent)] bg-[color-mix(in_oklab,var(--brand-end)_16%,transparent)] px-5 py-2.5 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[color-mix(in_oklab,var(--brand-end)_24%,transparent)]"
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
                      
                      // Mismo guardrail determinístico que el resto de flujos de
                      // (re)generación — ver create-plan.tsx / calculations.ts.
                      const intensidadEdicion = userActualizado.intensidad || "moderada";
                      const bmrEdicion = calculateBMR(userActualizado.pesoKg, userActualizado.alturaCm, userActualizado.edad, userActualizado.sexo);
                      const tdeeEdicion = calculateTDEE(bmrEdicion, userActualizado.actividad, userActualizado.diasGym, userActualizado.diasCardio);
                      const caloriasObjetivoEdicion = clampCaloriesToSafeFloor(
                        calcularCaloriasObjetivoPorMeta(tdeeEdicion, userActualizado.objetivo, intensidadEdicion),
                        bmrEdicion,
                        userActualizado.sexo
                      );
                      const macrosObjetivoEdicion = calcularMacrosObjetivo(caloriasObjetivoEdicion, userActualizado.pesoKg, userActualizado.objetivo, intensidadEdicion);

                      const resp = await fetch("/api/generatePlan", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          ...userActualizado,
                          userId: authUser?.uid,
                          locale,
                          _tdeeCalculado: tdeeEdicion,
                          _caloriasObjetivo: caloriasObjetivoEdicion,
                          _bmrCalculado: bmrEdicion,
                          _macrosObjetivo: macrosObjetivoEdicion,
                        }),
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
                              appLocale: locale,
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
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-info/20 mb-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-info"></div>
      </div>
                  <h3 className="font-display text-xl font-semibold mb-2">Regenerando plan</h3>
                  <p className="text-sm opacity-70">
                    Estamos generando tu nuevo plan personalizado con IA...
                  </p>
                </div>
                {errorRegeneracion && (
                  <div className="mt-4 p-3 rounded-lg bg-danger/20 border border-danger/30 text-danger text-sm">
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
              <div className="fixed inset-0 bg-[color-mix(in_oklab,#020617_84%,black)] backdrop-blur-sm" />
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="relative z-10 w-full max-w-lg rounded-2xl border border-[var(--landing-border)] bg-[color-mix(in_oklab,var(--background)_88%,#0a0f18)] p-5 shadow-[0_24px_80px_-30px_rgba(0,0,0,0.82)]"
                onClick={(e) => e.stopPropagation()}
              >
            <button
                  onClick={() => setModalInfoAbierto(null)}
                  className="absolute right-4 top-4 rounded-lg border border-[var(--landing-border)] bg-[var(--landing-surface)] p-1.5 text-[var(--landing-muted)] transition-colors hover:text-[var(--foreground)]"
                  aria-label={p(locale, "modalClose")}
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
                <div className="mb-4 flex items-center gap-2">
                  <span className="inline-flex rounded-full border border-[var(--landing-border)] bg-[var(--landing-surface)] px-2.5 py-1 text-[10px] uppercase tracking-wide text-[var(--landing-muted)]">
                    {p(locale, "helpBadge")}
                  </span>
                  <h3 className="font-display text-lg font-semibold text-[var(--foreground)]">
                    {modalInfoAbierto === 'imc' && p(locale, "helpImcTitle")}
                    {modalInfoAbierto === 'macros' && p(locale, "helpMacrosTitle")}
                    {modalInfoAbierto === 'sueno' && p(locale, "helpSleepTitle")}
                    {modalInfoAbierto === 'dificultad' && p(locale, "helpDifficultyTitle")}
                    {modalInfoAbierto === 'split' && p(locale, "helpSplitTitle")}
                  </h3>
                </div>
                <div className="space-y-2 text-sm leading-relaxed text-[var(--foreground)]">
                  {modalInfoAbierto === 'imc' && (
                    <p className="rounded-lg bg-[var(--landing-surface)] px-3 py-2">{p(locale, "helpImcBody")}</p>
                  )}
                  {modalInfoAbierto === 'macros' && (
                    <p className="rounded-lg bg-[var(--landing-surface)] px-3 py-2">{p(locale, "helpMacrosBody")}</p>
                  )}
                  {modalInfoAbierto === 'sueno' && (
                    <>
                      <p className="rounded-lg bg-[var(--landing-surface)] px-3 py-2">Tu objetivo actual: <strong>{typeof horasSuenoActual === 'number' ? horasSuenoActual : (sugerenciaEntrenamiento?.horasSueno ?? 8)}</strong> h por noche.</p>
                      <p className="rounded-lg bg-[var(--landing-surface)] px-3 py-2 text-[var(--landing-muted)]">Las siestas suman al total diario, pero ideal que sean cortas (20–30 min) y no muy tarde para no afectar el sueño nocturno.</p>
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
                          <p className="rounded-lg bg-[var(--landing-surface)] px-3 py-2">
                            Tu plan está marcado como <strong className="capitalize">{String((plan as unknown as Record<string, unknown>)?.dificultad || 'media')}</strong>
                            {(plan as unknown as Record<string, unknown>)?.dificultad_detalle ? ` — ${String((plan as unknown as Record<string, unknown>).dificultad_detalle)}` : ''}.
                          </p>
                          <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">¿Qué vas a sentir?</p>
                          <ul className="list-disc space-y-1 pl-5 text-[var(--landing-muted)]">
                            <li><strong>Semana 1:</strong> {String(cambios?.semana1 || fallback.semana1)}</li>
                            <li><strong>Semana 2:</strong> {String(cambios?.semana2 || fallback.semana2)}</li>
                            <li><strong>Semana 3-4:</strong> {String(cambios?.semana3_4 || fallback.semana3_4)}</li>
                            <li><strong>Después del mes:</strong> {String(cambios?.post_mes || fallback.post_mes)}</li>
                          </ul>
                          <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">¿Qué cambios pasan en tu cuerpo?</p>
                          <ul className="list-disc space-y-1 pl-5 text-[var(--landing-muted)]">
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
                      <p className="rounded-lg bg-[var(--landing-surface)] px-3 py-2">La división de entrenamiento describe cómo se reparten los grupos musculares a lo largo de la semana:</p>
                      <ul className="list-disc space-y-1 pl-5 text-[var(--landing-muted)]">
                        <li><strong>Full Body</strong>: todo el cuerpo en cada sesión. Ideal para 2–3 días/sem.</li>
                        <li><strong>Upper/Lower</strong>: tren superior y tren inferior alternados. 4 días/sem típicos.</li>
                        <li><strong>Push/Pull/Legs</strong>: empuje, tirón y piernas. 3–6 días/sem según volumen.</li>
                        <li><strong>Mixto</strong>: combinación adaptada a tu objetivo, intensidad y disponibilidad.</li>
                      </ul>
                      <p className="rounded-lg bg-[var(--landing-surface)] px-3 py-2 text-[var(--landing-muted)]">Tu plan actual: <strong>{splitResumen}</strong>. Esto se ajusta a tus <em>días de gym</em>, intensidad y objetivo para optimizar progreso y recuperación.</p>
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
                // Limpiar referencias al cerrar el modal
                processingSelectionRef.current = false;
                
                // Cerrar modal y limpiar estados
                setModalEntrenamientoAbierto(false);
                setSelectedTrainingDate(null);
                setSelectedDayData(null);
                setSelectedDayProgress({});
              }}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-[color-mix(in_oklab,var(--background)_95%,#0f172a)] rounded-2xl border border-white/10 p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <h2 className="font-display text-2xl font-bold">🏋️ Plan de Entrenamiento</h2>
                    {splitResumen && (
                      <span className="text-sm px-3 py-1 rounded-full bg-info/20 text-info border border-info/30 font-medium">
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
                  // NO hay loader porque los datos ya están en memoria (vienen del plan)
                  <DayTrainingPanel
                    dayData={selectedDayData.day}
                    week={selectedDayData.week}
                    dayIndex={selectedDayData.dayIndex}
                    date={selectedTrainingDate}
                    planId={planId}
                    userId={authUser?.uid}
                  />
                ) : selectedTrainingDate && !selectedDayData ? (
                  // Día seleccionado pero sin entrenamiento
                  <div className="text-center py-12">
                    <div className="text-6xl mb-4">📅</div>
                    <h3 className="font-display text-xl font-semibold text-white mb-2">
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
                          ? 'bg-info text-white'
                          : 'bg-white/10 text-white/70 hover:bg-white/20'
                      }`}
                    >
                      {isPremium ? `Semana ${semana}` : `Mes ${semana}`}
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
                        <p>
                          {isPremium
                            ? `No hay datos de entrenamiento para la Semana ${semanaSeleccionada}`
                            : `No hay datos de entrenamiento para el Mes ${semanaSeleccionada}`}
                        </p>
    </div>
  );
                  }

                  return (
                    <div className="space-y-4">
                      <h3 className="font-display text-lg font-semibold text-info mb-4">
                        {isPremium
                          ? `Semana ${semanaActual.week ?? semanaSeleccionada}`
                          : `Mes ${semanaActual.week ?? semanaSeleccionada}`}
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
                        
                        // Identificar día actual
                        const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
                        const hoy = new Date().getDay();
                        const diaActualNombre = diasSemana[hoy];
                        const esDiaActual = dia.day === diaActualNombre;
                        
                        // Estado de expansión del día
                        const dayKey = `w${semanaSeleccionada}-d${di}`;
                        const isExpanded = diasExpandidos[dayKey] || false;
                        
                        return (
                        <div 
                          key={`dia-${semanaSeleccionada}-${di}`} 
                          className={`rounded-lg border-2 bg-white/5 p-4 transition-all ${
                            esDiaActual 
                              ? 'border-info/50 bg-info/10 shadow-[0_10px_30px_-14px_color-mix(in_oklab,var(--info)_45%,transparent)]' 
                              : 'border-white/10'
                          }`}
                        >
                          <button
                            onClick={() => setDiasExpandidos(prev => ({ ...prev, [dayKey]: !prev[dayKey] }))}
                            className="w-full flex items-center justify-between mb-3"
                          >
                            <h4 className={`font-display text-base font-semibold text-white flex items-center gap-2 ${
                              esDiaActual ? 'text-info' : ''
                            }`}>
                              {esDiaActual && <span className="text-info">📍</span>}
                            {dia.day}
                            {musculos && (
                              <span className="text-sm font-normal opacity-70 ml-2">({musculos})</span>
                            )}
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
                            <div className="mb-4 p-3 rounded-md bg-warning/20 border border-warning/30">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-sm font-semibold text-warning">🔥 Calentamiento</span>
                                <span className="text-xs opacity-70">({dia.warmup.duration_minutes} min)</span>
                              </div>
                              <p className="text-sm opacity-90 leading-relaxed">{dia.warmup.description}</p>
                            </div>
                          )}
                          
                          {(dia.ejercicios || []).length > 0 ? (
                            <ul className="space-y-3">
                              {(dia.ejercicios || []).map((ejercicio: TrainingExercise, ei: number) => {
                                const restTime = ejercicio.rest_seconds || (ejercicio as unknown as { rest_sec?: number }).rest_sec;
                                
                                return (
                                  <li key={`ej-${semanaSeleccionada}-${di}-${ei}`} className="rounded-lg bg-white/5 border border-white/10 p-3">
                                    <div className="flex-1">
                                      {/* Header del ejercicio */}
                                      <div className="flex items-start justify-between gap-2 mb-2">
                                        <div className="flex-1">
                                          <div className="flex items-center gap-2 flex-wrap mb-1">
                                            <span className="font-semibold text-white">{ejercicio.name}</span>
                                            <span className="text-sm opacity-70">· {ejercicio.sets}x{String(ejercicio.reps)}</span>
                                            {ejercicio.muscle_group && (
                                              <span className="text-xs px-2 py-0.5 rounded bg-info/20 text-info border border-info/30">
                                                {translateMuscleGroup(ejercicio.muscle_group, locale)}
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

                                      <ExerciseDemoMedia
                                        exerciseName={ejercicio.name}
                                        demoVideoUrl={ejercicio.demo_video_url}
                                        demoPosterUrl={ejercicio.demo_poster_url}
                                        planMediaOverrides={tp?.exercise_media_overrides ?? null}
                                      />
                                      
                                      {/* Técnica (expandible) */}
                                      {ejercicio.technique && (
                                        <details className="mt-2">
                                          <summary className="text-xs font-medium text-info cursor-pointer hover:text-info">
                                            💡 Técnica
                                          </summary>
                                          <p className="mt-1 text-xs opacity-90 leading-relaxed pl-2 border-l-2 border-info/30">
                                            {ejercicio.technique}
                                          </p>
                                        </details>
                                      )}
                                      
                                      {/* Progresión */}
                                      {ejercicio.progression && (
                                        <details className="mt-2">
                                          <summary className="text-xs font-medium text-warning cursor-pointer hover:text-warning">
                                            📈 Progresión
                                          </summary>
                                          <p className="mt-1 text-xs opacity-90 leading-relaxed pl-2 border-l-2 border-warning/30">
                                            {ejercicio.progression}
                                          </p>
                                        </details>
                                      )}
                                      
                                      {/* Cues mentales */}
                                      {ejercicio.cues && ejercicio.cues.length > 0 && (
                                        <div className="mt-2">
                                          <p className="text-xs font-medium text-phase-maintenance mb-1">🎯 Pistas mentales:</p>
                                          <ul className="list-disc pl-4 space-y-0.5">
                                            {ejercicio.cues.map((cue, cueIdx) => (
                                              <li key={`cue-${ei}-${cueIdx}`} className="text-xs opacity-90">{cue}</li>
                                            ))}
                                          </ul>
                                        </div>
                                      )}
                                      
                                      {/* Alternativa (si hay lesión) */}
                                      {ejercicio.alternative && (
                                        <div className="mt-2 p-2 rounded bg-warning/10 border border-warning/30">
                                          <p className="text-xs font-medium text-warning mb-1">⚠️ Alternativa (si tienes lesión):</p>
                                          <p className="text-xs opacity-90">{ejercicio.alternative}</p>
                                        </div>
                                      )}
                    
                    {/* Tracker de pesos */}
                    <ExerciseWeightTracker
                      exercise={ejercicio}
                      exerciseIndex={ei}
                      week={semanaActual.week ?? semanaSeleccionada}
                      dayIndex={di}
                      dayName={dia.day}
                      planId={planId}
                      userId={authUser?.uid}
                      date={null}
                    />
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
            cambios={{
              ...monthChangesData,
              cambioFase: monthChangesData.cambiaFase,
            } as Omit<typeof monthChangesData, 'cambiaFase'> & { cambioFase: boolean }}
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
              className="bg-[color-mix(in_oklab,var(--background)_95%,#0f172a)] border border-white/10 rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-xl font-semibold">
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
                Este proceso puede tardar hasta <span className="font-semibold text-success">1 minuto</span>. 
                No cierres esta página mientras se genera la nueva etapa.
              </p>
              
              {/* Info de fase actual */}
              <div className={`mb-4 p-3 rounded-xl ${
                planMultiFase.faseActual === "BULK"
                  ? "bg-phase-bulk/10 border border-phase-bulk/20"
                  : planMultiFase.faseActual === "CUT"
                  ? "bg-phase-cut/10 border border-phase-cut/20"
                  : "bg-phase-lean-bulk/10 border border-phase-lean-bulk/20"
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
                    Peso Actual (kg) <span className="text-danger">*</span>
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
                <div className="mt-4 p-3 rounded-xl bg-danger/20 border border-danger/30 text-danger text-sm">
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
                      ? "bg-phase-bulk/20 border border-phase-bulk/30 hover:bg-phase-bulk/30 text-phase-bulk"
                      : planMultiFase.faseActual === "CUT"
                      ? "bg-phase-cut/20 border border-phase-cut/30 hover:bg-phase-cut/30 text-phase-cut"
                      : "bg-phase-lean-bulk/20 border border-phase-lean-bulk/30 hover:bg-phase-lean-bulk/30 text-phase-lean-bulk"
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
