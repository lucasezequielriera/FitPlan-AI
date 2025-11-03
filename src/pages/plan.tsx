import { useRouter } from "next/router";
import React, { useEffect, useState } from "react";
import { usePlanStore } from "@/store/planStore";
import { motion, AnimatePresence } from "framer-motion";
import type { Goal, TipoDieta, Intensidad, UserInput } from "@/types/plan";
import { calculateBMI, bmiCategory, calculateBodyFatUSNavy, bodyFatCategory, waistToHeightRatio, whtrCategory, calculateBMR, calculateTDEE, sugerirEntrenamiento, calcularProyeccionesMotivacionales, analizarCambiosEntrenamiento } from "@/utils/calculations";
import jsPDF from "jspdf";
import Navbar from "@/components/Navbar";
import { getAuthSafe, getDbSafe } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

export default function PlanPage() {
  const router = useRouter();
  const { plan, user, planId, setUser, setPlan, setPlanId } = usePlanStore();

  useEffect(() => {
    // Si no hay plan ni user en el store, redirigir
    if (!plan || !user) {
      router.push("/");
      return;
    }
  }, [plan, user, router]);
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({});
  // seed de variantes fijo para simplicidad
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, { ingredientes?: string[]; pasos_preparacion?: string[]; loading?: boolean; error?: string }>>({});
  
  // Valores editables de entrenamiento
  const [diasGymEditado, setDiasGymEditado] = useState<number | null>(null);
  const [minutosCaminataEditado, setMinutosCaminataEditado] = useState<number | null>(null);
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
  const [guardandoPDF, setGuardandoPDF] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  
  // Estado para modales de información (tooltips)
  const [modalInfoAbierto, setModalInfoAbierto] = useState<'imc' | 'macros' | null>(null);
  
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
  }, []);
  
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

  // Asegurar que si no es premium, la intensidad sea leve (excepto para objetivos básicos que ya están en leve)
  useEffect(() => {
    if (user && !isPremium && !esObjetivoBasico && user.intensidad !== "leve") {
      setUser({ ...user, intensidad: "leve" });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPremium, esObjetivoBasico]);
  
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
    if (!plan) return;
    const dias = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"] as const;
    const today = dias[new Date().getDay()];
    const existsToday = plan.plan_semanal.find((d) => d.dia === today);
    setSelectedDay((prev) => prev ?? (existsToday ? today : plan.plan_semanal[0]?.dia ?? null));
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

  // Actualizar sugerencias de entrenamiento cuando cambie objetivo o intensidad
  useEffect(() => {
    if (!user) return;
    
    const bmi = calculateBMI(user.pesoKg, user.alturaCm);
    const nuevasSugerencias = sugerirEntrenamiento(
      user.objetivo,
      user.intensidad,
      user.edad,
      bmi,
      user.atletico
    );
    
    // Solo actualizar si no han sido editados manualmente
    const cambios: Partial<UserInput> = {};
    if (diasGymEditado === null && user.diasGym !== nuevasSugerencias.diasGym) {
      cambios.diasGym = nuevasSugerencias.diasGym;
    }
    if (minutosCaminataEditado === null) {
      const diasCardio = Math.ceil(nuevasSugerencias.minutosCaminata / (nuevasSugerencias.minutosCaminata > 45 ? 60 : nuevasSugerencias.minutosCaminata > 30 ? 45 : 30));
      if (user.diasCardio !== diasCardio) {
        cambios.diasCardio = diasCardio;
      }
    }
    
    if (Object.keys(cambios).length > 0) {
      setUser({ ...user, ...cambios });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.objetivo, user?.intensidad, diasGymEditado, minutosCaminataEditado]);

  if (!plan) return null;

  function keyFor(dia: string, mealIndex: number) {
    return `${dia}-${mealIndex}`;
  }

  function toggleExpanded(k: string) {
    setExpandedKeys((s) => ({ ...s, [k]: !s[k] }));
    // Cargar detalles on-open si no existen
    setDetails((prev) => {
      if (prev[k]) return prev;
      const next = { ...prev } as Record<string, { ingredientes?: string[]; pasos_preparacion?: string[]; loading?: boolean; error?: string }>;
      next[k] = { loading: true };
      return next;
    });
  }

  // refresh removido (no se usa)

function pickThree(options: string[], seed: number = 0, exclude: string[] = []) {
  // normaliza y elimina duplicados
  const seen = new Set<string>();
  const unique = options.filter((o) => {
    const k = o.trim().toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const excludeSet = new Set(exclude.map((o) => o.trim().toLowerCase()));
  const pool = unique.filter((o) => !excludeSet.has(o.trim().toLowerCase()));
  if (pool.length <= 3) return pool;
  const a = [...pool];
  let x = 1103515245 * (seed + 1) + 12345;
  for (let i = a.length - 1; i > 0; i--) {
    x = (1103515245 * x + 12345) & 0x7fffffff;
    const j = x % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, 3);
}

function buildPrimaryAndVariants(options: string[], seed: number) {
  const primary = pickThree(options, seed);
  let variants = pickThree(options, seed + 1, primary);
  const primSet = new Set(primary.map((o) => o.trim().toLowerCase()));
  variants = variants.filter((v) => !primSet.has(v.trim().toLowerCase()));
  if (variants.length < 3) {
    const pool = options.filter((o) => !primSet.has(o.trim().toLowerCase()));
    for (const o of pool) {
      if (!variants.find((v) => v.trim().toLowerCase() === o.trim().toLowerCase())) {
        variants.push(o);
        if (variants.length === 3) break;
      }
    }
  }
  return { primary, variants };
}

  const bmi = user ? calculateBMI(user.pesoKg, user.alturaCm) : 0;
  const bmiCat = bmiCategory(bmi);
  
  // Calcular TDEE y déficit/superávit
  const tdee = user ? (() => {
    const bmr = calculateBMR(user.pesoKg, user.alturaCm, user.edad, user.sexo);
    return calculateTDEE(bmr, user.actividad);
  })() : 0;
  const deficitSuperavit = user && plan ? plan.calorias_diarias - tdee : 0;
  
  // Calcular sugerencias de entrenamiento inteligentes
  const sugerenciaEntrenamiento = user ? sugerirEntrenamiento(
    user.objetivo,
    user.intensidad,
    user.edad,
    bmi,
    user.atletico
  ) : null;
  
  // Usar valores editados si existen, sino los sugeridos
  const diasGymActual = diasGymEditado !== null ? diasGymEditado : (sugerenciaEntrenamiento?.diasGym || 3);
  const minutosCaminataActual = minutosCaminataEditado !== null ? minutosCaminataEditado : (sugerenciaEntrenamiento?.minutosCaminata || 30);
  const horasSuenoActual = horasSuenoEditado !== null ? horasSuenoEditado : (sugerenciaEntrenamiento?.horasSueno || 7);
  
  // Calcular proyecciones motivacionales con valores actuales
  const proyecciones = user ? calcularProyeccionesMotivacionales(
    user.objetivo,
    user.intensidad,
    user.edad,
    user.sexo,
    bmi,
    user.atletico,
    diasGymActual
  ) : null;
  
  // Verificar si hay diferencias con las sugerencias
  const hayDiferencias = sugerenciaEntrenamiento && (
    diasGymEditado !== null || 
    minutosCaminataEditado !== null || 
    horasSuenoEditado !== null
  );
  
  // Analizar pros y contras si hay cambios
  const analisisCambios = hayDiferencias && sugerenciaEntrenamiento && user ? analizarCambiosEntrenamiento(
    user.objetivo,
    sugerenciaEntrenamiento.diasGym,
    diasGymActual,
    sugerenciaEntrenamiento.minutosCaminata,
    minutosCaminataActual,
    sugerenciaEntrenamiento.horasSueno,
    horasSuenoActual
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
                <button
                  className="rounded-xl px-4 py-2 text-sm font-medium bg-blue-500/20 border border-blue-500/30 hover:bg-blue-500/30 transition-colors"
                  onClick={() => {
                    if (user) {
                      setDatosEdicion({ ...user });
                    setPreferenciasTexto(user.preferencias?.join(", ") || "");
                    setRestriccionesTexto(user.restricciones?.join(", ") || "");
                    setPatologiasTexto(user.patologias?.join(", ") || "");
                      setModalAbierto(true);
                    }
                  }}
                >
                  ✏️ Editar
                </button>
                <button
                  className="rounded-xl px-4 py-2 text-sm font-medium bg-emerald-500/20 border border-emerald-500/30 hover:bg-emerald-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={async () => {
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
                  disabled={guardandoPDF}
                >
                  {guardandoPDF ? '⏳ Guardando...' : '💾 Guardar PDF'}
                </button>
              </div>
            </div>
            {user?.nombre ? (
              <p className="text-sm opacity-80">Hola {user.nombre}, este es tu plan personalizado.</p>
            ) : null}
            {user && (
              <div className="flex flex-wrap items-center gap-3 mt-2">
                <div className="relative inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors max-w-full">
                  <span className="text-xs opacity-70 whitespace-nowrap flex-shrink-0">Objetivo:</span>
                  <span className="text-sm font-medium text-white whitespace-nowrap max-w-[150px] md:max-w-none truncate">
                    {getObjetivoTexto(user.objetivo)}
                  </span>
                  <select
                    value={user.objetivo}
                    onChange={(e) => {
                      const nuevoObjetivo = e.target.value as Goal;
                      const nuevoEsBasico = nuevoObjetivo === "perder_grasa" || nuevoObjetivo === "mantener" || nuevoObjetivo === "ganar_masa";
                      // Si cambia a objetivo básico, fijar intensidad a leve
                      const nuevaIntensidad = nuevoEsBasico ? "leve" : user.intensidad;
                      setUser({ ...user, objetivo: nuevoObjetivo, intensidad: nuevaIntensidad });
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    style={{ 
                      backgroundImage: 'none',
                      backgroundColor: 'transparent',
                      color: '#e6f6ff'
                    }}
                  >
                    <optgroup label="Objetivos básicos - Para empezar">
                      <option value="perder_grasa">Perder peso - Reducción simple de peso corporal</option>
                      <option value="mantener">Mantener peso - Conservar tu peso actual</option>
                      <option value="ganar_masa">Aumentar peso - Ganancia simple de peso</option>
                    </optgroup>
                    <optgroup label={isPremium ? "🌟 PREMIUM - Objetivos avanzados (Activos)" : "🌟 PREMIUM - Objetivos avanzados (Desbloquea todo el potencial)"}>
                      <option value="recomposicion" disabled={!isPremium}>🔥 Transformación Total - Quema grasa y construye músculo simultáneamente</option>
                      <option value="definicion" disabled={!isPremium}>💎 Definición Extrema - Logra músculos marcados con bajo % de grasa corporal</option>
                      <option value="volumen" disabled={!isPremium}>💪 Hipertrofia Máxima - Maximiza el crecimiento muscular con periodización avanzada</option>
                      <option value="corte" disabled={!isPremium}>⚡ Corte Avanzado - Reducción de grasa preservando masa muscular (más preciso que perder peso)</option>
                      <option value="mantenimiento_avanzado" disabled={!isPremium}>🎯 Mantenimiento Elite - Optimización avanzada para atletas experimentados</option>
                    </optgroup>
                  </select>
                  <svg className="w-4 h-4 opacity-50 flex-shrink-0 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors w-fit">
                  <span className="text-xs opacity-70 whitespace-nowrap">
                    Intensidad:
                    {!isPremium && !esObjetivoBasico && (
                      <span className="text-[10px] opacity-50 ml-1">(Premium)</span>
                    )}
                  </span>
                  <select
                    value={user.intensidad}
                    onChange={(e) => {
                      const nuevaIntensidad = e.target.value as Intensidad;
                      if (!isPremium && (nuevaIntensidad === "moderada" || nuevaIntensidad === "intensa")) {
                        alert("Las opciones Moderada e Intensa requieren plan Premium.");
                        return;
                      }
                      setUser({ ...user, intensidad: nuevaIntensidad });
                    }}
                    className="text-sm font-medium bg-transparent border-none outline-none capitalize appearance-none w-auto cursor-pointer text-white"
                    style={{ 
                      backgroundColor: 'transparent',
                      color: '#e6f6ff',
                      minWidth: `${getIntensidadTexto(user.intensidad).length * 0.6}ch`
                    }}
                  >
                    <option value="leve">Leve</option>
                    <optgroup label={isPremium ? "🌟 PREMIUM (Activas)" : "🌟 PREMIUM (Desbloquea con suscripción)"}>
                      <option value="moderada" disabled={!isPremium || esObjetivoBasico}>
                        Moderada
                      </option>
                      <option value="intensa" disabled={!isPremium || esObjetivoBasico}>
                        Intensa
                      </option>
                    </optgroup>
                  </select>
                </div>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors w-fit">
                  <span className="text-xs opacity-70 whitespace-nowrap">Dieta:</span>
                  <select
                    value={user.tipoDieta || "estandar"}
                    onChange={(e) => {
                      const nuevaDieta = e.target.value === "estandar" ? undefined : (e.target.value as TipoDieta);
                      setUser({ ...user, tipoDieta: nuevaDieta });
                    }}
                    className="text-sm font-medium bg-transparent border-none outline-none cursor-pointer appearance-none w-auto text-white"
                    style={{ 
                      backgroundColor: 'transparent',
                      color: '#e6f6ff',
                      minWidth: `${getDietaTexto(user.tipoDieta).length * 0.6}ch`
                    }}
                  >
                    <optgroup label="Dietas básicas">
                      <option value="estandar">Estándar</option>
                      <option value="mediterranea">Mediterránea</option>
                      <option value="vegetariana">Vegetariana</option>
                      <option value="vegana">Vegana</option>
                      <option value="low_carb">Low Carb</option>
                    </optgroup>
                    <optgroup label={isPremium ? "🌟 PREMIUM (Activas)" : "🌟 PREMIUM"}>
                      <option value="antiinflamatoria" disabled={!isPremium}>🔥 Antiinflamatoria</option>
                      <option value="atkins" disabled={!isPremium}>⚡ Atkins</option>
                      <option value="clinica_mayo" disabled={!isPremium}>🏥 Clínica Mayo</option>
                      <option value="dash" disabled={!isPremium}>❤️ DASH</option>
                      <option value="flexitariana" disabled={!isPremium}>🌱 Flexitariana</option>
                      <option value="keto" disabled={!isPremium}>💪 Keto</option>
                      <option value="mind" disabled={!isPremium}>🧠 MIND</option>
                      <option value="menopausia" disabled={!isPremium}>🌸 Menopausia</option>
                      <option value="paleo" disabled={!isPremium}>🏃 Paleo</option>
                      <option value="pescatariana" disabled={!isPremium}>🐟 Pescatariana</option>
                      <option value="sin_gluten" disabled={!isPremium}>🌾 Sin Gluten</option>
                      <option value="tlc" disabled={!isPremium}>📊 TLC</option>
                    </optgroup>
                  </select>
                </div>
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
              <p className="text-sm font-medium opacity-70 mb-3">Información personal</p>
              <div className="space-y-3">
                {user?.preferencias && user.preferencias.length > 0 && (
                  <div>
                    <p className="text-xs font-medium opacity-70 mb-1">Preferencias:</p>
                    <div className="flex flex-wrap gap-1">
                      {user.preferencias.map((pref, idx) => (
                        <span key={idx} className="inline-flex items-center rounded-full px-2 py-0.5 text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          {pref}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {user?.restricciones && user.restricciones.length > 0 && (
                  <div>
                    <p className="text-xs font-medium opacity-70 mb-1">Restricciones:</p>
                    <div className="flex flex-wrap gap-1">
                      {user.restricciones.map((restr, idx) => (
                        <span key={idx} className="inline-flex items-center rounded-full px-2 py-0.5 text-xs bg-orange-500/20 text-orange-300 border border-orange-500/30">
                          {restr}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {user?.patologias && user.patologias.length > 0 && (
                  <div>
                    <p className="text-xs font-medium opacity-70 mb-1">Patologías:</p>
                    <div className="flex flex-wrap gap-1">
                      {user.patologias.map((pat, idx) => (
                        <span key={idx} className="inline-flex items-center rounded-full px-2 py-0.5 text-xs bg-red-500/20 text-red-300 border border-red-500/30">
                          {pat}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {(!user?.preferencias || user.preferencias.length === 0) && 
                 (!user?.restricciones || user.restricciones.length === 0) && 
                 (!user?.patologias || user.patologias.length === 0) && (
                  <p className="text-xs opacity-60">No hay preferencias, restricciones ni patologías registradas</p>
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

          <p className="mt-4 text-sm opacity-80">{plan.mensaje_motivacional}</p>

          {/* Sugerencias de entrenamiento */}
          {sugerenciaEntrenamiento && (
            <div className="mt-6 rounded-xl border border-white/10 p-4 bg-gradient-to-r from-white/5 to-white/10">
              <h2 className="text-lg font-semibold mb-3">💪 Recomendaciones de entrenamiento y recuperación</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium opacity-90">Días de gym:</p>
                    {sugerenciaEntrenamiento.diasGym !== diasGymActual && (
                      <span className="text-xs opacity-70">(sugerido: {sugerenciaEntrenamiento.diasGym})</span>
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
                  <p className="text-xs opacity-75 mt-1">Entrenamiento de fuerza con pesas</p>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium opacity-90">Caminata diaria:</p>
                    {sugerenciaEntrenamiento.minutosCaminata !== minutosCaminataActual && (
                      <span className="text-xs opacity-70">(sugerido: {sugerenciaEntrenamiento.minutosCaminata})</span>
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
                    <p className="text-sm font-medium opacity-90">Horas de sueño:</p>
                    {sugerenciaEntrenamiento.horasSueno !== horasSuenoActual && (
                      <span className="text-xs opacity-70">(sugerido: {sugerenciaEntrenamiento.horasSueno})</span>
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
                {sugerenciaEntrenamiento.descripcion}
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
                            <li key={idx} className="text-xs opacity-90 flex items-start gap-2">
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
                            <li key={idx} className="text-xs opacity-90 flex items-start gap-2">
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
              
              {(user?.objetivo === "perder_grasa" || user?.objetivo === "corte") && proyecciones.grasaPerdidaMensual && (
                <div className="mb-4 p-3 rounded-lg bg-white/5 border border-white/10">
                  <p className="text-sm font-medium opacity-90 mb-1">Pérdida de grasa por mes:</p>
                  <p className="text-3xl font-bold text-red-400">{proyecciones.grasaPerdidaMensual}</p>
                  <p className="text-xs opacity-75 mt-1">Reducción de grasa corporal estimada con dieta y entrenamiento constante</p>
                </div>
              )}
              
              <div className="space-y-2 mb-4">
                {proyecciones.proyecciones.map((proyeccion, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-sm opacity-90">
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

          <div className="mt-8">
            <h2 className="text-xl font-semibold mb-3">Plan semanal</h2>
            <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-3">
              {/* Columna izquierda: días */}
              <div className="rounded-xl border border-white/10 p-2 md:col-span-1 self-start">
                <ul className="space-y-1">
              {plan.plan_semanal.map((d) => (
                    <li key={d.dia}>
                      <button
                        className={`w-full rounded-lg px-3 text-left text-sm flex items-center ${selectedDay === d.dia ? "bg-white/10" : "hover:bg-white/5"}`}
                        style={{ height: '2.5rem' }}
                        onClick={() => setSelectedDay(d.dia)}
                      >
                        {d.dia}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
              {/* Columna derecha: detalle del día seleccionado */}
              <div className="rounded-xl border border-white/10 p-4 md:col-span-2">
                {(() => {
                  const day = plan.plan_semanal.find((x) => x.dia === selectedDay) ?? plan.plan_semanal[0];
                  if (!day) return null;
                  
                  // Las comidas ya vienen ordenadas desde el API, pero asegurar el orden por si acaso
                  const ordenComidas = ['Desayuno', 'Almuerzo', 'Snack', 'Merienda', 'Cena'];
                  const comidasOrdenadas = [...day.comidas].sort((a, b) => {
                    const nombreA = (a.nombre || '').trim();
                    const nombreB = (b.nombre || '').trim();
                    const indexA = ordenComidas.findIndex(o => nombreA === o);
                    const indexB = ordenComidas.findIndex(o => nombreB === o);
                    // Si no se encuentra, ordenar por hora
                    if (indexA === -1 && indexB === -1) {
                      return (a.hora || '00:00').localeCompare(b.hora || '00:00');
                    }
                    if (indexA === -1) return 999;
                    if (indexB === -1) return -999;
                    return indexA - indexB;
                  });
                  
                  return (
                    <div>
                      <h3 className="text-lg font-medium mb-3">{day.dia}</h3>
                  <div className="space-y-3">
                        {comidasOrdenadas.map((c, idx) => {
                          const originalIdx = day.comidas.indexOf(c);
                          const k = keyFor(day.dia, originalIdx !== -1 ? originalIdx : idx);
                          const { primary, variants: alt } = buildPrimaryAndVariants(c.opciones, 0);
                          const isOpen = !!expandedKeys[k];
                          const d = details[k];
                          return (
                            <div key={idx} className="rounded-lg bg-white/5 p-3 transition-colors hover:bg-white/10">
                              <button
                                className="w-full cursor-pointer rounded-md text-left"
                                onClick={() => toggleExpanded(k)}
                                aria-expanded={isOpen}
                                aria-controls={`meal-${day.dia}-${idx}`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-medium text-base">{c.nombre}</span>
                                  <span className="opacity-80 text-sm">{c.hora}</span>
                        </div>
                                <p className="mt-2 text-sm opacity-90">{primary[0] || c.opciones[0] || ""}</p>
                                {c.calorias_kcal || c.cantidad_gramos ? (
                                  <p className="mt-1 text-xs opacity-70">
                                    {c.calorias_kcal ? `${c.calorias_kcal} kcal` : null}
                                    {c.calorias_kcal && c.cantidad_gramos ? " · " : null}
                                    {c.cantidad_gramos ? `${c.cantidad_gramos} g` : null}
                                  </p>
                                ) : null}
                              </button>
                              {isOpen ? (
                                <div id={`meal-${day.dia}-${idx}`} className="mt-3 border-t border-white/10 pt-3">
                                  {(!c.ingredientes || !c.pasos_preparacion) && (!d || (!d.ingredientes && !d.pasos_preparacion)) ? (
                                    <FetchDetails k={k} dish={primary[0] ?? c.opciones[0] ?? c.nombre} onLoaded={(payload) => setDetails((s) => ({ ...s, [k]: { ...payload, loading: false } }))} onError={(msg) => setDetails((s) => ({ ...s, [k]: { ...s[k], loading: false, error: msg } }))} />
                                  ) : null}
                                  {(primary.length > 1 || alt.length > 0) && (
                                    <div className="mt-3">
                                      <p className="text-sm font-medium opacity-90 mb-2">Otras opciones:</p>
                                      <div className="space-y-1">
                                        {primary.slice(1).map((o, i) => (
                                          <p key={i} className="text-sm opacity-80">• {o}</p>
                                        ))}
                                        {alt.map((o, i) => (
                                          <p key={`alt-${i}`} className="text-sm opacity-80">• {o}</p>
                                        ))}
                      </div>
                                    </div>
                                  )}
                                  {(c.ingredientes?.length || d?.ingredientes?.length) ? (
                                    <div className="mt-3">
                                      <p className="text-sm font-medium">Ingredientes</p>
                                      <ul className="mt-1 list-disc pl-5 text-sm opacity-90">
                                        {(c.ingredientes ?? d?.ingredientes ?? []).map((ing, i) => (
                                          <li key={i}>{ing}</li>
                                        ))}
                                      </ul>
                  </div>
                                  ) : null}
                                  {(c.pasos_preparacion?.length || d?.pasos_preparacion?.length) ? (
                                    <div className="mt-3">
                                      <p className="text-sm font-medium">Pasos de preparación</p>
                                      <ol className="mt-1 list-decimal pl-5 text-sm opacity-90">
                                        {(c.pasos_preparacion ?? d?.pasos_preparacion ?? []).map((p, i) => (
                                          <li key={i}>{p}</li>
                                        ))}
                                      </ol>
                                    </div>
                                  ) : null}
                                </div>
                              ) : null}
                        </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
                  </div>
            </div>
          </div>

          {plan.lista_compras?.length ? (
            <div className="mt-8">
              <h2 className="text-xl font-semibold mb-3">Lista de compras</h2>
              <div className="rounded-xl border border-white/10 p-4">
                <ul className="list-disc pl-5 text-sm opacity-90 columns-1 md:columns-2">
                  {plan.lista_compras.map((item, i) => (
                    <li key={i}>{item}</li>
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
                  <div key={i} className="rounded-xl border border-white/10 p-4">
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
                  {modalInfoAbierto === 'imc' ? '¿Qué es el IMC?' : '¿Qué son los macronutrientes?'}
                </h3>
                <div className="text-sm opacity-90 leading-relaxed">
                  {modalInfoAbierto === 'imc' ? (
                    <p>El Índice de Masa Corporal (IMC) relaciona peso y altura. Es una guía general y no sustituye evaluación clínica.</p>
                  ) : (
                    <p>Los macronutrientes son proteínas, grasas y carbohidratos. Tu plan reparte las calorías diarias entre ellos para apoyar tu objetivo.</p>
                  )}
          </div>
        </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </AnimatePresence>
      </div>
    </div>
  );
}

function FetchDetails({ k, dish, onLoaded, onError }: { k: string; dish: string; onLoaded: (p: { ingredientes?: string[]; pasos_preparacion?: string[] }) => void; onError: (msg: string) => void }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch('/api/mealDetails', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dish }) });
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
  }, [dish, k, onLoaded, onError]);

  if (loading) return <p className="text-xs opacity-70">Cargando detalles…</p>;
  if (error) return <p className="text-xs text-red-300">{String(error)}</p>;
  return null;
}

