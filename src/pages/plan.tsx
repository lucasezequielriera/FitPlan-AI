import { useRouter } from "next/router";
import React, { useEffect, useState, useRef } from "react";
import { usePlanStore } from "@/store/planStore";
import { motion, AnimatePresence } from "framer-motion";
import type { Goal, TipoDieta, Intensidad, UserInput } from "@/types/plan";
import { calculateBMI, bmiCategory, calculateBodyFatUSNavy, bodyFatCategory, waistToHeightRatio, whtrCategory, calculateBMR, calculateTDEE, sugerirEntrenamiento, calcularProyeccionesMotivacionales, analizarCambiosEntrenamiento } from "@/utils/calculations";
import jsPDF from "jspdf";
import Navbar from "@/components/Navbar";
import PremiumPlanModal from "@/components/PremiumPlanModal";
import FoodTrackingModal from "@/components/FoodTrackingModal";
import WeeklyStatsModal from "@/components/WeeklyStatsModal";
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
  const { plan, user, planId, setUser, setPlan, setPlanId } = usePlanStore();
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
  const [vistaPlan, setVistaPlan] = useState<'entrenamiento' | 'alimentacion'>('alimentacion');
  const [modalAlimentosAbierto, setModalAlimentosAbierto] = useState<null | { diaIdx: number }>(null);
  const [foodDetails, setFoodDetails] = useState<Record<string, { ingredientes?: string[]; pasos_preparacion?: string[]; loading?: boolean; error?: string }>>({});
  const [foodTrackingModalOpen, setFoodTrackingModalOpen] = useState(false);
  const [weeklyStatsModalOpen, setWeeklyStatsModalOpen] = useState(false);

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

          {/* Botón para abrir modal de entrenamiento */}
          {vistaPlan === 'entrenamiento' && isPremium && (plan as unknown as Record<string, unknown>)?.training_plan && (
            <div className="mt-6 flex justify-center">
              <button
                onClick={() => setModalEntrenamientoAbierto(true)}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 hover:from-cyan-500/30 hover:to-blue-500/30 transition-all text-white font-medium"
              >
                🏋️ Ver Plan de Entrenamiento
              </button>
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
              onClick={() => setModalEntrenamientoAbierto(false)}
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
                    onClick={() => setModalEntrenamientoAbierto(false)}
                    className="text-white/70 hover:text-white transition-colors"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

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
                        const getMusculosDelDia = (): string | null => {
                          const tp = (plan as unknown as Record<string, unknown>)?.training_plan as TrainingPlan | undefined;
                          const splitGeneral = (tp as unknown as Record<string, unknown>)?.split as string | undefined;
                          
                          // Si el día tiene un split específico, usarlo
                          if (dia.split) {
                            const splitLower = dia.split.toLowerCase();
                            
                            // Si es Full Body, mostrar "Full Body"
                            if (splitLower.includes("full body")) {
                              return "Full Body";
                            }
                            
                            // Mapear splits comunes a músculos
                            if (splitLower.includes("push")) {
                              return "Pecho, Hombros, Tríceps";
                            } else if (splitLower.includes("pull")) {
                              return "Espalda, Bíceps, Trapecio";
                            } else if (splitLower.includes("legs") || splitLower.includes("piernas")) {
                              return "Cuádriceps, Isquiotibiales, Glúteos, Gemelos";
                            } else if (splitLower.includes("upper")) {
                              return "Pecho, Espalda, Hombros, Bíceps, Tríceps";
                            } else if (splitLower.includes("lower")) {
                              return "Cuádriceps, Isquiotibiales, Glúteos, Gemelos, Abdominales";
                            } else if (splitLower.includes("chest") || splitLower.includes("pecho")) {
                              return "Pecho, Tríceps";
                            } else if (splitLower.includes("back") || splitLower.includes("espalda")) {
                              return "Espalda, Bíceps";
                            } else if (splitLower.includes("shoulders") || splitLower.includes("hombros")) {
                              return "Hombros, Trapecio";
                            }
                          }
                          
                          // Si el split general es Full Body, mostrar "Full Body"
                          if (splitGeneral === "Full Body" || splitGeneral?.toLowerCase().includes("full body")) {
                            return "Full Body";
                          }
                          
                          // Si no hay split específico, analizar los muscle_group de los ejercicios
                          if (dia.ejercicios && dia.ejercicios.length > 0) {
                            const muscleGroups = new Set<string>();
                            dia.ejercicios.forEach(ej => {
                              if (ej.muscle_group) {
                                muscleGroups.add(ej.muscle_group);
                              }
                            });
                            
                            // Si hay 4 o más músculos diferentes, probablemente es Full Body
                            if (muscleGroups.size >= 4) {
                              return "Full Body";
                            }
                            
                            // Devolver los músculos únicos encontrados
                            if (muscleGroups.size > 0) {
                              return Array.from(muscleGroups).join(", ");
                            }
                          }
                          
                          return null;
                        };
                        
                        const musculos = getMusculosDelDia();
                        
                        return (
                        <div key={`dia-${semanaSeleccionada}-${di}`} className="rounded-lg border border-white/10 bg-white/5 p-4">
                          <h4 className="text-base font-semibold mb-3 text-white">
                            {dia.day}
                            {musculos && (
                              <span className="text-sm font-normal opacity-70 ml-2">({musculos})</span>
                            )}
                          </h4>
                          
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
                                const restTime = ejercicio.rest_seconds || ejercicio.rest_sec;
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
                                    </div>
                                  </li>
                                );
                              })}
                            </ul>
                          ) : (
                            <p className="text-sm text-white/50">No hay ejercicios registrados para este día</p>
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

