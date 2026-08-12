import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import { FaAppleAlt } from "react-icons/fa";
import { usePlanStore } from "@/store/planStore";
import { useAuthStore } from "@/store/authStore";
import { getAuthSafe, getDbSafe } from "@/lib/firebase";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import type { UserInput, TipoDieta, Intensidad, PlanMultiFase, FaseMultiFase, HistorialMes, Suplemento, PlanAIResponse } from "@/types/plan";
import Navbar from "@/components/Navbar";
import {
  calculateBMR,
  calculateTDEE,
  calcularCaloriasObjetivoPorMeta,
  calcularMacrosObjetivo,
  clampCaloriesToSafeFloor,
} from "@/utils/calculations";
import PremiumPlanModal from "@/components/PremiumPlanModal";
import Head from "next/head";
import { useAppLocale } from "@/contexts/AppLocaleContext";
import {
  cp,
  cpFmt,
  cpGoalLong,
  cpDietLong,
  cpIntensityLong,
  cpGoalOpt,
  cpDietOpt,
  cpIntensityOpt,
  cpIntensityTag,
} from "@/lib/i18n/createPlanUi";

// Helper para crear estructura de plan multi-fase
function crearPlanMultiFase(
  user: UserInput,
  plan: PlanAIResponse,
  objetivo: "bulk_cut" | "lean_bulk" | "simple"
): PlanMultiFase {
  const pesoInicial = user.pesoKg;
  const pesoObjetivoFinal = user.pesoObjetivoKg || Math.round(pesoInicial * 1.1);
  const intensidad = user.intensidad || "moderada";
  const sexo = user.sexo || "masculino";
  const edad = user.edad || 25;
  const esAtletico = user.atletico || false;
  
  // Factores de ajuste según perfil (SINCRONIZADOS con la proyección del formulario)
  const factorSexo = sexo === "femenino" ? 0.5 : 1;
  const factorEdad = edad > 40 ? 0.85 : edad > 30 ? 0.95 : 1;
  const factorExperiencia = esAtletico ? 0.7 : 1; // Atletas ya avanzados ganan más lento
  
  // Velocidades base según intensidad
  const velocidadBaseGanancia: Record<string, number> = { ultra: 1.5, intensa: 1.2, moderada: 0.9, leve: 0.6 };
  const velocidadBasePerdida: Record<string, number> = { ultra: 2.0, intensa: 1.5, moderada: 1.0, leve: 0.6 };
  
  // Aplicar factores a las velocidades
  const velocidadGanancia = (velocidadBaseGanancia[intensidad] || 0.9) * factorSexo * factorEdad * factorExperiencia;
  const velocidadPerdida = (velocidadBasePerdida[intensidad] || 1.0) * factorEdad;
  
  // Calcular meses según objetivo e intensidad
  const calcularMesesYFases = (): { totalMeses: number; fases: FaseMultiFase[] } => {
    const diferenciaPeso = pesoObjetivoFinal - pesoInicial;
    
    if (objetivo === "bulk_cut") {
      // BULK + CUT: Primero bulk agresivo, luego cut
      // Peso de bulk = peso objetivo + 8-10% (grasa que se ganará)
      const pesoBulk = Math.round(pesoObjetivoFinal * 1.08);
      const pesoAGanarBulk = pesoBulk - pesoInicial;
      const pesoAPerderCut = pesoBulk - pesoObjetivoFinal;
      
      const mesesBulk = Math.ceil(pesoAGanarBulk / velocidadGanancia);
      const mesesCut = Math.ceil(pesoAPerderCut / velocidadPerdida);
      const totalMeses = mesesBulk + mesesCut;
      
      // Crear array de meses para cada fase
      const mesesBulkArray = Array.from({ length: mesesBulk }, (_, i) => i + 1);
      const mesesCutArray = Array.from({ length: mesesCut }, (_, i) => mesesBulk + i + 1);
      
      return {
        totalMeses,
        fases: [
          {
            nombre: "BULK",
            mesesIncluidos: mesesBulkArray,
            pesoMeta: pesoBulk,
            descripcion: `Fase de volumen: Ganar masa muscular hasta ~${pesoBulk}kg con superávit calórico controlado`
          },
          {
            nombre: "CUT",
            mesesIncluidos: mesesCutArray,
            pesoMeta: pesoObjetivoFinal,
            descripcion: `Fase de definición: Perder grasa hasta ${pesoObjetivoFinal}kg manteniendo músculo`
          }
        ]
      };
    } else if (objetivo === "lean_bulk") {
      // LEAN BULK: Ganancia lenta y constante (60% de velocidad del bulk normal)
      const velocidadLeanBulk = velocidadGanancia * 0.6;
      const totalMeses = Math.ceil(diferenciaPeso / velocidadLeanBulk);
      
      return {
        totalMeses,
        fases: [
          {
            nombre: "LEAN_BULK",
            mesesIncluidos: Array.from({ length: totalMeses }, (_, i) => i + 1),
            pesoMeta: pesoObjetivoFinal,
            descripcion: `Volumen limpio: Ganar músculo minimizando grasa hasta ${pesoObjetivoFinal}kg`
          }
        ]
      };
    }
    
    // Plan simple (1 mes)
    return {
      totalMeses: 1,
      fases: [
        {
          nombre: "MANTENIMIENTO",
          mesesIncluidos: [1],
          pesoMeta: pesoObjetivoFinal || pesoInicial,
          descripcion: "Plan mensual estándar"
        }
      ]
    };
  };
  
  const { totalMeses, fases } = calcularMesesYFases();
  
  // Suplementos base recomendados según objetivo
  const suplementosBase: Suplemento[] = [
    {
      nombre: "Proteína Whey",
      dosis: "25-30g",
      momento: "post-entreno",
      motivo: "Optimizar síntesis proteica y recuperación muscular",
      prioridad: "esencial",
      duracion: "todo el plan"
    },
    {
      nombre: "Creatina Monohidrato",
      dosis: "5g",
      momento: "mañana",
      motivo: "Aumentar fuerza, potencia y volumen muscular",
      prioridad: "esencial",
      duracion: "todo el plan"
    },
    {
      nombre: "Vitamina D3",
      dosis: "2000-4000 UI",
      momento: "mañana",
      motivo: "Optimizar testosterona, inmunidad y salud ósea",
      prioridad: "recomendado",
      duracion: "todo el plan"
    },
    {
      nombre: "Omega-3 (EPA/DHA)",
      dosis: "2-3g",
      momento: "mañana",
      motivo: "Antiinflamatorio, salud cardiovascular y recuperación",
      prioridad: "recomendado",
      duracion: "todo el plan"
    }
  ];
  
  // Agregar suplementos específicos según fase
  if (objetivo === "bulk_cut" || objetivo === "lean_bulk") {
    suplementosBase.push({
      nombre: "Zinc + Magnesio (ZMA)",
      dosis: "30mg Zn / 450mg Mg",
      momento: "noche",
      motivo: "Optimizar recuperación, sueño y niveles hormonales",
      prioridad: "recomendado",
      duracion: "todo el plan"
    });
  }
  
  if (intensidad === "ultra" || intensidad === "intensa") {
    suplementosBase.push({
      nombre: "Cafeína",
      dosis: "200-300mg",
      momento: "pre-entreno",
      motivo: "Aumentar energía, foco y rendimiento en entrenamiento",
      prioridad: "opcional",
      duracion: "según necesidad"
    });
  }
  
  // Crear primer mes del historial
  const primerMes: HistorialMes = {
    mesNumero: 1,
    faseEnEsteMes: fases[0].nombre,
    fechaGeneracion: new Date().toISOString(),
    datosAlIniciar: {
      peso: pesoInicial,
      cintura: user.cinturaCm,
      fechaRegistro: new Date().toISOString()
    },
    planAlimentacion: plan.plan_semanal || [],
    caloriasObjetivo: plan.calorias_diarias || 2200,
    macros: plan.macros || { proteinas: "150g", grasas: "70g", carbohidratos: "240g" },
    planEntrenamiento: plan.training_plan,
    suplementos: suplementosBase,
    dificultad: plan.dificultad,
    mensajeMotivacional: plan.mensaje_motivacional
  };
  
  const fechaInicio = new Date();
  const fechaFinEstimada = new Date(fechaInicio);
  fechaFinEstimada.setMonth(fechaFinEstimada.getMonth() + totalMeses);
  
  return {
    tipo: objetivo,
    estado: "activo",
    fechaInicio: fechaInicio.toISOString(),
    fechaFinEstimada: fechaFinEstimada.toISOString(),
    datosIniciales: {
      pesoInicial,
      pesoObjetivoFinal,
      cinturaInicial: user.cinturaCm,
      alturaCm: user.alturaCm,
      edad: user.edad,
      sexo: user.sexo,
      intensidad: user.intensidad,
      objetivo: user.objetivo,
      tipoDieta: user.tipoDieta,
      restricciones: user.restricciones,
      preferencias: user.preferencias,
      patologias: user.patologias,
      doloresLesiones: user.doloresLesiones,
      diasGym: user.diasGym,
      diasCardio: user.diasCardio
    },
    fases,
    totalMeses,
    mesActual: 1,
    faseActual: fases[0].nombre,
    suplementosBase,
    historialMeses: [primerMes]
  };
}


export default function CreatePlan() {
  const router = useRouter();
  const { locale } = useAppLocale();
  const { setUser, setPlan, setPlanId, setPlanMultiFase, setPlanCreatedAt } = usePlanStore();
  const { user: authUser, loading: authLoading } = useAuthStore();

  useEffect(() => {
    if (!authLoading && !authUser) {
      router.push("/");
      return;
    }

    // Verificar si es administrador y redirigir al panel de admin
    const checkAdmin = async () => {
      if (!authUser) return;

      try {
        const auth = getAuthSafe();
        if (!auth?.currentUser) return;

        // Verificar el email de Firebase Auth primero (disponible inmediatamente)
        const authEmail = auth.currentUser.email?.toLowerCase() || "";
        if (authEmail === "admin@fitplan-ai.com") {
          router.push("/admin");
          return;
        }

        // Si no es admin por email de Auth, verificar en Firestore
        const db = getDbSafe();
        if (!db) return;

        const userRef = doc(db, "usuarios", auth.currentUser.uid);
        const userDoc = await getDoc(userRef);
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          const email = userData.email?.toLowerCase() || "";
          const nombreLower = userData.nombre?.toLowerCase() || "";
          const isAdmin = email === "admin@fitplan-ai.com" || nombreLower === "administrador";
          
          if (isAdmin) {
            router.push("/admin");
          }
        }
      } catch (error) {
        console.error("Error al verificar admin:", error);
      }
    };

    if (authUser) {
      checkAdmin();
    }
  }, [authUser, authLoading, router]);

  const [step, setStep] = useState(1);
  const [form, setForm] = useState<UserInput>({
    nombre: "",
    edad: 0,
    pesoKg: 0,
    alturaCm: 0,
    sexo: "masculino",
    actividad: 3, // días de actividad física por semana (0-7)
    diasGym: 3, // nueva: días de gym semanales
    diasCardio: 0,
    nivelExperiencia: "intermedio",
    equipamiento: "gimnasio",
    objetivo: "mantener",
    intensidad: "leve", // Objetivos básicos siempre usan intensidad leve
    restricciones: [],
    preferencias: [],
    patologias: [],
    doloresLesiones: [],
    duracionDias: 30, // Siempre 30 días (plan mensual)
    preferirRutina: false,
    cinturaCm: undefined,
    cuelloCm: undefined,
    caderaCm: undefined,
    atletico: false,
  });
  const [userDataLoaded, setUserDataLoaded] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  // número máximo de pasos - todos los usuarios ven 3 pasos
  const maxStep = 3;
  const field =
    "w-full rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface)] px-3.5 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--landing-muted)] outline-none transition focus:border-[color-mix(in_oklab,var(--landing-accent)_32%,transparent)] focus:ring-2 focus:ring-[color-mix(in_oklab,var(--landing-accent)_38%,transparent)]";
  const fieldErr = "border-danger/50 ring-1 ring-danger/15";
  const lbl = "text-sm font-medium text-[var(--foreground)]";
  const hint = "text-xs text-[var(--landing-muted)] mt-1";
  const card = "rounded-2xl border border-[var(--landing-border)] bg-[color-mix(in_oklab,var(--foreground)_3%,transparent)] p-4 sm:p-5";
  const infoBox =
    "mt-2 rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface)] p-3 sm:p-3.5";
  const [nombreError, setNombreError] = useState<string | null>(null);
  const [premiumModalOpen, setPremiumModalOpen] = useState(false);
  const [edadError, setEdadError] = useState<string | null>(null);
  const [alturaError, setAlturaError] = useState<string | null>(null);
  const [pesoError, setPesoError] = useState<string | null>(null);
  // Estados locales para inputs numéricos (permiten estar vacíos)
  const [edadInput, setEdadInput] = useState<string>("");
  const [alturaInput, setAlturaInput] = useState<string>("");
  const [pesoInput, setPesoInput] = useState<string>("");
  /** Permite vaciar el campo mientras se edita (plan FREE — días de gym) */
  const [diasGymInput, setDiasGymInput] = useState<string>("3");
  // Valores originales para restaurar si el usuario borra el campo
  const [edadOriginal, setEdadOriginal] = useState<number>(0);
  const [alturaOriginal, setAlturaOriginal] = useState<number>(0);
  const [pesoOriginal, setPesoOriginal] = useState<number>(0);
  const [userLocation, setUserLocation] = useState<{ ciudad: string | null; pais: string | null }>({ ciudad: null, pais: null });

  // Obtener ubicación del usuario al cargar el componente
  useEffect(() => {
    const fetchUserLocation = async () => {
      try {
        const response = await fetch("/api/getUserLocation");
        if (response.ok) {
          const data = await response.json();
          setUserLocation({
            ciudad: data.ciudad || null,
            pais: data.pais || null,
          });
        }
      } catch (error) {
        console.error("Error al obtener ubicación:", error);
        // No bloquear el flujo si falla
      }
    };

    fetchUserLocation();
  }, []);

  // Cargar datos del usuario desde Firestore al montar el componente
  useEffect(() => {
    const loadUserData = async () => {
      if (!authUser || userDataLoaded) return;

      try {
        const db = getDbSafe();
        const auth = getAuthSafe();
        if (!db || !auth?.currentUser) return;

        const userRef = doc(db, "usuarios", auth.currentUser.uid);
        const userDoc = await getDoc(userRef);

        let userPremium = false;
        if (userDoc.exists()) {
          const userData = userDoc.data();
          
          setForm((prev) => {
            const edadValue = userData.edad || prev.edad;
            const alturaValue = userData.alturaCm || prev.alturaCm;
            const pesoValue = (typeof userData.peso === 'number' && userData.peso > 0) ? userData.peso : prev.pesoKg;
            
            // Guardar valores originales para restaurar si el usuario borra el campo
            setEdadOriginal(edadValue);
            setAlturaOriginal(alturaValue);
            setPesoOriginal(pesoValue);
            
            // Inicializar estados locales de inputs
            setEdadInput(edadValue ? String(edadValue) : "");
            setAlturaInput(alturaValue ? String(alturaValue) : "");
            setPesoInput(pesoValue ? String(pesoValue) : "");
            
            return {
              ...prev,
              nombre: userData.nombre || prev.nombre,
              edad: edadValue,
              alturaCm: alturaValue,
              sexo: userData.sexo || prev.sexo,
              // Pre-cargar peso del perfil si existe
              pesoKg: pesoValue,
              cinturaCm: userData.cinturaCm ?? prev.cinturaCm,
              cuelloCm: userData.cuelloCm ?? prev.cuelloCm,
              caderaCm: userData.caderaCm ?? prev.caderaCm,
              atletico: userData.atletico ?? prev.atletico,
              preferirRutina: userData.preferirRutina ?? prev.preferirRutina,
              doloresLesiones: Array.isArray(userData.doloresLesiones) ? userData.doloresLesiones : prev.doloresLesiones,
            };
          });
          
          // Verificar estado premium
          userPremium = userData.premium === true;
          setIsPremium(userPremium);
        } else {
          // Si no existe el documento, inicializar estados locales vacíos
          setEdadOriginal(0);
          setAlturaOriginal(0);
          setPesoOriginal(0);
          
          setEdadInput("");
          setAlturaInput("");
          setPesoInput("");
        }

        // Verificar cantidad de planes existentes
        const q = query(
          collection(db, "planes"),
          where("userId", "==", auth.currentUser.uid)
        );
        const querySnapshot = await getDocs(q);
        const planCount = querySnapshot.size;
        setIsFirstPlan(planCount === 0);

        // Todas las opciones están habilitadas, el pago se requiere antes de generar el plan
        // (antes se usaban para mostrar límites, ya no son necesarios)

        setUserDataLoaded(true);
      } catch (error) {
        console.error("Error al cargar datos del usuario:", error);
        setUserDataLoaded(true); // Marcar como cargado incluso si hay error para no intentar infinitamente
      }
    };

    if (authUser && !authLoading) {
      loadUserData();
    }
  }, [authUser, authLoading, userDataLoaded]);

  // Verificar si viene de un pago exitoso y continuar con la generación
  useEffect(() => {
    const checkPaymentSuccess = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const continueAfterPayment = urlParams.get("continue");
      
      if ((continueAfterPayment === "true" || urlParams.get("generate") === "true") && authUser && userDataLoaded) {
        // Verificar si el usuario es premium ahora
        try {
          const auth = getAuthSafe();
          if (!auth?.currentUser) return;
          
          const db = getDbSafe();
          if (!db) return;
          
          const { doc, getDoc } = await import("firebase/firestore");
          const userRef = doc(db, "usuarios", auth.currentUser.uid);
          const userDoc = await getDoc(userRef);
          
          if (userDoc.exists()) {
            const userData = userDoc.data();
            if (userData.premium === true) {
              // Restaurar el formulario guardado si existe
              const pendingForm = localStorage.getItem("pendingPlanForm");
              if (pendingForm) {
                try {
                  const savedData = JSON.parse(pendingForm);
                  setForm(savedData.form);
                  setRestriccionesTexto(savedData.restriccionesTexto || "");
                  setPreferenciasTexto(savedData.preferenciasTexto || "");
                  setPatologiasTexto(savedData.patologiasTexto || "");
                  setDoloresLesionesTexto(savedData.doloresLesionesTexto || "");
                  setStep(savedData.step || 1);
                  localStorage.removeItem("pendingPlanForm");
                } catch (e) {
                  console.error("Error al restaurar formulario:", e);
                }
              }
              
              // Usuario es premium, continuar con la generación del plan
              // Limpiar el parámetro de la URL
              window.history.replaceState({}, "", "/create-plan");
              // Llamar a onSubmit para generar el plan después de un breve delay
              setTimeout(() => {
                onSubmit();
              }, 1000);
            }
          }
        } catch (error) {
          console.error("Error al verificar estado premium:", error);
        }
      }
    };

    if (authUser && !authLoading && userDataLoaded) {
      checkPaymentSuccess();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser, authLoading, userDataLoaded]);

  useEffect(() => {
    setDiasGymInput(String(form.diasGym ?? 3));
  }, [form.diasGym]);

  // Determinar si el objetivo es básico o premium
  const esObjetivoBasico = form.objetivo === "perder_grasa" || form.objetivo === "mantener" || form.objetivo === "ganar_masa";


  function update<K extends keyof UserInput>(key: K, value: UserInput[K]) {
    setForm((p) => {
      const nuevo = { ...p, [key]: value };
      // Si cambia el objetivo, ajustar intensidad automáticamente
      if (key === "objetivo") {
        const nuevoEsBasico = value === "perder_grasa" || value === "mantener" || value === "ganar_masa";
        if (nuevoEsBasico) {
          // Objetivos básicos siempre tienen intensidad leve
          nuevo.intensidad = "leve";
        }
      }
      // Todas las opciones están habilitadas, el pago se requiere antes de generar el plan
      return nuevo;
    });
  }

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState<number | null>(null);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [isFirstPlan, setIsFirstPlan] = useState(true);
  
  // Checklist de progreso
  type StepStatus = 'pending' | 'in_progress' | 'completed' | 'error';
  interface ChecklistStep {
    id: string;
    label: string;
    status: StepStatus;
  }
  const [checklistSteps, setChecklistSteps] = useState<ChecklistStep[]>([
    { id: "preparar", label: cp(locale, "checkPreparar"), status: "pending" },
    { id: "enviar", label: cp(locale, "checkEnviar"), status: "pending" },
    { id: "recibir", label: cp(locale, "checkRecibir"), status: "pending" },
    { id: "validar", label: cp(locale, "checkValidar"), status: "pending" },
    { id: "perfil", label: cp(locale, "checkPerfil"), status: "pending" },
    { id: "plan", label: cp(locale, "checkPlan"), status: "pending" },
    { id: "completo", label: cp(locale, "checkCompleto"), status: "pending" },
  ]);

  useEffect(() => {
    setChecklistSteps((prev) =>
      prev.map((s) => ({
        ...s,
        label:
          s.id === "preparar"
            ? cp(locale, "checkPreparar")
            : s.id === "enviar"
              ? cp(locale, "checkEnviar")
              : s.id === "recibir"
                ? cp(locale, "checkRecibir")
                : s.id === "validar"
                  ? cp(locale, "checkValidar")
                  : s.id === "perfil"
                    ? cp(locale, "checkPerfil")
                    : s.id === "plan"
                      ? cp(locale, "checkPlan")
                      : s.id === "completo"
                        ? cp(locale, "checkCompleto")
                        : s.label,
      }))
    );
  }, [locale]);

  // dummy effect to mark some state variables as used (avoids ts errors with noUnusedLocals)
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _ = { progress, startTime, checklistSteps };
  }, [progress, startTime, checklistSteps]);
  
  const updateChecklistStep = (id: string, status: StepStatus) => {
    setChecklistSteps(prev => prev.map(step => 
      step.id === id ? { ...step, status } : step
    ));
  };
  // Estados temporales para inputs de texto (restricciones/preferencias)
  const [restriccionesTexto, setRestriccionesTexto] = useState(form.restricciones?.join(", ") || "");
  const [preferenciasTexto, setPreferenciasTexto] = useState(form.preferencias?.join(", ") || "");
  const [patologiasTexto, setPatologiasTexto] = useState(form.patologias?.join(", ") || "");
  const [doloresLesionesTexto, setDoloresLesionesTexto] = useState(form.doloresLesiones?.join(", ") || "");
  
  // Sincronizar textos cuando cambian los arrays en el form
  useEffect(() => {
    if (form.restricciones && form.restricciones.length > 0) {
      setRestriccionesTexto(form.restricciones.join(", "));
    } else if (form.restricciones?.length === 0 && restriccionesTexto) {
      // Solo limpiar si el usuario explícitamente borró todo
    }
    if (form.preferencias && form.preferencias.length > 0) {
      setPreferenciasTexto(form.preferencias.join(", "));
    } else if (form.preferencias?.length === 0 && preferenciasTexto) {
      // Solo limpiar si el usuario explícitamente borró todo
    }
    if (form.patologias && form.patologias.length > 0) {
      setPatologiasTexto(form.patologias.join(", "));
    } else if (form.patologias?.length === 0 && patologiasTexto) {
      // Solo limpiar si el usuario explícitamente borró todo
    }
    if (form.doloresLesiones && form.doloresLesiones.length > 0) {
      setDoloresLesionesTexto(form.doloresLesiones.join(", "));
    } else if ((form.doloresLesiones?.length ?? 0) === 0 && doloresLesionesTexto) {
      setDoloresLesionesTexto("");
    }
  }, [form.restricciones?.length, form.preferencias?.length, form.patologias?.length, form.doloresLesiones?.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Función para generar el plan directamente (sin bloquear por pago)
  function handleGeneratePlan() {
    if (!authUser) {
      alert(cp(locale, "alertNeedAccount"));
      return;
    }
    // Antes: se abría el modal de planes premium y se pedía pagar antes de generar.
    // Ahora: el usuario puede generar su plan gratuitamente. El pago se usa luego para
    // acceso Premium y continuidad, no para la generación inicial.
    onSubmit();
  }

  async function onSubmit() {
    // Verificar si hay un formulario pendiente guardado (después del pago)
    const pendingForm = localStorage.getItem("pendingPlanForm");
    if (pendingForm) {
      try {
        const savedData = JSON.parse(pendingForm);
        // Restaurar el estado del formulario
        setForm(savedData.form);
        setRestriccionesTexto(savedData.restriccionesTexto || "");
        setPreferenciasTexto(savedData.preferenciasTexto || "");
        setPatologiasTexto(savedData.patologiasTexto || "");
        setDoloresLesionesTexto(savedData.doloresLesionesTexto || "");
        setStep(savedData.step || 1);
        // Limpiar el formulario guardado
        localStorage.removeItem("pendingPlanForm");
      } catch (e) {
        console.error("Error al restaurar formulario:", e);
      }
    }

    // Resetear checklist
    setChecklistSteps(prev => prev.map(step => ({ ...step, status: 'pending' as StepStatus })));
    
    // Procesar restricciones y preferencias si hay texto pendiente
    updateChecklistStep('preparar', 'in_progress');
    const formFinal = { ...form };
    if (restriccionesTexto) {
      const array = restriccionesTexto.split(",").map((s: string) => s.trim()).filter(Boolean);
      formFinal.restricciones = array;
    }
    if (preferenciasTexto) {
      const array = preferenciasTexto.split(",").map((s: string) => s.trim()).filter(Boolean);
      formFinal.preferencias = array;
    }
    if (patologiasTexto) {
      const array = patologiasTexto.split(",").map((s: string) => s.trim()).filter(Boolean);
      formFinal.patologias = array;
    }
    const doloresLesionesArray = doloresLesionesTexto
      ? doloresLesionesTexto.split(",").map((s: string) => s.trim()).filter(Boolean)
      : [];
    formFinal.doloresLesiones = doloresLesionesArray;
    // Mantener preferencia de comidas rutinarias
    if (typeof form.preferirRutina === 'boolean') {
      formFinal.preferirRutina = form.preferirRutina;
    }
    
    updateChecklistStep('preparar', 'completed');
    setLoading(true);
    setError(null);
    setProgress(0);
    const start = Date.now();
    setStartTime(start);
    setEstimatedTimeRemaining(null);
    
    // Tiempo estimado total: 45-60 segundos (ajustable según experiencia)
    const estimatedTotalTime = 55000; // 55 segundos en milisegundos
    
    // Progreso asintótico: avanza rápido al principio y se frena cerca de 95%
    let p = 0;
    let timer: NodeJS.Timeout | null = null;
    timer = setInterval(() => {
      const elapsed = Date.now() - start;
      const estimatedRemaining = Math.max(0, (estimatedTotalTime - elapsed) / 1000); // en segundos
      setEstimatedTimeRemaining(Math.ceil(estimatedRemaining));
      
      p = p + Math.max(1, Math.round((95 - p) * 0.08));
      p = Math.min(p, 95);
      setProgress(p);
    }, 250);
    // Retry automático para timeouts (máximo 2 intentos)
    let lastError: Error | null = null;
    let attempts = 0;
    const maxAttempts = 2;
    let resp: Response | null = null;
    
    while (attempts < maxAttempts) {
      try {
        attempts++;
        if (attempts > 1) {
          // En el segundo intento, mostrar mensaje
          setError(cp(locale, "retryGenerating"));
          updateChecklistStep('enviar', 'in_progress');
        } else {
          updateChecklistStep('enviar', 'in_progress');
        }
        
        // Calcular TDEE para enviarlo a OpenAI (asegura calorías consistentes con la proyección)
        const pesoActual = formFinal.pesoKg || 70;
        const altura = formFinal.alturaCm || 170;
        const edad = formFinal.edad || 25;
        const sexo = formFinal.sexo || "masculino";
        const actividad = formFinal.actividad || 3;
        const intensidad = formFinal.intensidad || "moderada";
        
        const bmrCalculado = calculateBMR(pesoActual, altura, edad, sexo);
        // PREMIUM: comportamiento original del calculo (sin nuevos campos).
        // FREE: usa los campos nuevos de frecuencia/nivel/equipo para templates.
        const diasGymEstimado = isPremium
          ? (intensidad === "ultra" ? 6 : intensidad === "intensa" ? 5 : intensidad === "moderada" ? 4 : 3)
          : (
            typeof formFinal.diasGym === 'number' && formFinal.diasGym >= 0
              ? formFinal.diasGym
              : (intensidad === "ultra" ? 6 : intensidad === "intensa" ? 5 : intensidad === "moderada" ? 4 : 3)
          );
        const diasCardioEstimado = isPremium
          ? 0
          : (
            typeof formFinal.diasCardio === 'number' && formFinal.diasCardio >= 0
              ? formFinal.diasCardio
              : 0
          );
        const tdeeCalculado = calculateTDEE(bmrCalculado, actividad, diasGymEstimado, diasCardioEstimado);
        
        // Calcular superávit/déficit según objetivo e intensidad (misma
        // tabla que usa la regeneración de mes siguiente en plan.tsx, ver
        // calcularCaloriasObjetivoPorMeta en utils/calculations.ts).
        const objetivo = formFinal.objetivo;
        let caloriasObjetivo = calcularCaloriasObjetivoPorMeta(tdeeCalculado, objetivo, intensidad);

        // Piso de seguridad: nunca por debajo del BMR ni de un mínimo
        // clínico absoluto, sin importar cuán agresivo sea el déficit
        // calculado arriba (ver clampCaloriesToSafeFloor).
        caloriasObjetivo = clampCaloriesToSafeFloor(caloriasObjetivo, bmrCalculado, sexo);

        // Calcular macros basados en objetivo y peso (misma lógica compartida
        // que la regeneración de mes siguiente, ver calcularMacrosObjetivo).
        const macrosCalculados = calcularMacrosObjetivo(caloriasObjetivo, pesoActual, objetivo, intensidad);
        
        const premiumSafeForm = isPremium
          ? (() => {
              const formClone = { ...formFinal } as Record<string, unknown>;
              delete formClone.diasGym;
              delete formClone.diasCardio;
              delete formClone.nivelExperiencia;
              delete formClone.equipamiento;
              return formClone;
            })()
          : formFinal;

        const payload = {
          ...premiumSafeForm,
          firstPlan: isFirstPlan,
          // Datos calculados para que OpenAI/Templates use valores consistentes
          _tdeeCalculado: tdeeCalculado,
          _caloriasObjetivo: caloriasObjetivo,
          _bmrCalculado: bmrCalculado,
          _macrosObjetivo: macrosCalculados,
          // ID del usuario para verificar premium status
          userId: authUser?.uid,
          locale,
        };

        // Usar streaming para mostrar progreso real (temporalmente desactivado)
        resp = await fetch("/api/generatePlan", {
          method: "POST",
          headers: { 
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload),
        });
        updateChecklistStep('enviar', 'completed');
        
        updateChecklistStep('recibir', 'in_progress');
        if (!resp.ok) {
          const data = await resp.json().catch(() => null);
          const combined = data?.error && data?.detail ? `${data.error}: ${data.detail}` : (data?.error || data?.detail);
          const msg = combined || `No se pudo generar el plan (HTTP ${resp.status})`;
          
          // Si es timeout y aún tenemos intentos, reintentar
          const isTimeout = resp.status === 502 && (msg.includes("Timeout") || msg.includes("tardó demasiado"));
          if (isTimeout && attempts < maxAttempts) {
            console.log(`⏱️ Timeout en intento ${attempts}, reintentando...`);
            lastError = new Error(msg);
            // Esperar 2 segundos antes de reintentar
            await new Promise(resolve => setTimeout(resolve, 2000));
            continue; // Reintentar
          }
          
          // Log extendido para diagnóstico
          console.error('generatePlan error', { status: resp.status, data, attempt: attempts });
          updateChecklistStep('recibir', 'error');
          
          // Mensaje más descriptivo para errores 422
          if (resp.status === 422) {
            const errorMsg = data?.error || "Error al generar el plan";
            const detailMsg = data?.detail || "";
            const debugInfo = data?.debug ? `\n\nInformación de debug: ${JSON.stringify(data.debug, null, 2)}` : "";
            throw new Error(`${errorMsg}${detailMsg ? `: ${detailMsg}` : ""}${debugInfo}\n\nPor favor, intenta nuevamente. Si el problema persiste, puede ser un problema temporal con OpenAI.`);
          }
          
          throw new Error(msg);
        }
        
        // Si llegamos aquí, la respuesta fue exitosa
        break; // Salir del loop de retry
      } catch (err: unknown) {
        lastError = err instanceof Error ? err : new Error(String(err));
        const isTimeout = lastError.message.includes("Timeout") || lastError.message.includes("tardó demasiado") || lastError.message.includes("aborted");
        
        // Si es timeout y aún tenemos intentos, reintentar
        if (isTimeout && attempts < maxAttempts) {
          console.log(`⏱️ Error de timeout en intento ${attempts}, reintentando...`);
          // Esperar 2 segundos antes de reintentar
          await new Promise(resolve => setTimeout(resolve, 2000));
          continue; // Reintentar
        }
        
        // Si no es timeout o ya agotamos los intentos, lanzar el error
        throw lastError;
      }
    }
    
    // Si llegamos aquí, tenemos una respuesta exitosa
    if (!resp) {
      throw new Error("No se pudo obtener respuesta del servidor");
    }
    
    // Parsear respuesta
    const plan = await resp.json();
    if (timer) clearInterval(timer);
    setProgress(100);
    updateChecklistStep('recibir', 'completed');
    
    try {
      // Mostrar objeto de debug en consola del navegador
      if (plan._debug_training_plan) {
        console.log("=".repeat(80));
        console.log("📊 DEBUG: DATOS USADOS PARA GENERAR TRAINING_PLAN");
        // 'formFinal' contiene el user input que enviamos al servidor
        console.log("DiasGym enviado:", formFinal.diasGym);
        // También exponerlo globalmente para fácil acceso
        (window as unknown as { __TRAINING_PLAN_DEBUG__?: unknown }).__TRAINING_PLAN_DEBUG__ = plan._debug_training_plan;
        console.log("💡 También disponible en: window.__TRAINING_PLAN_DEBUG__");
      }
      
      updateChecklistStep('validar', 'in_progress');
      // Validar que el plan tenga plan_semanal
      if (!plan || !Array.isArray(plan.plan_semanal) || plan.plan_semanal.length !== 7) {
        console.error('Plan inválido:', { 
          tienePlan: !!plan, 
          tienePlanSemanal: !!plan?.plan_semanal, 
          esArray: Array.isArray(plan?.plan_semanal),
          longitud: plan?.plan_semanal?.length 
        });
        updateChecklistStep('validar', 'error');
        throw new Error("El plan generado no tiene la estructura correcta. Intentá nuevamente.");
      }
      updateChecklistStep('validar', 'completed');
      
      // Guardar perfil del usuario y plan automáticamente desde el cliente
      try {
        updateChecklistStep('perfil', 'in_progress');
        const auth = getAuthSafe();
        const db = await import("@/lib/firebase").then(m => m.getDbSafe());
        
        if (auth?.currentUser && db) {
          const userId = auth.currentUser.uid;
          
          // Guardar perfil del usuario directamente desde el cliente
          try {
            const { collection, doc, setDoc, getDoc, serverTimestamp } = await import("firebase/firestore");
            const userRef = doc(collection(db, "usuarios"), userId);
            const userDoc = await getDoc(userRef);
            
            // Obtener el email del usuario autenticado
            const userEmail = auth.currentUser?.email?.toLowerCase() || "";
            
            // Solo incluir campos que tienen valores válidos
            const userData: Record<string, unknown> = {
              nombre: formFinal.nombre,
              sexo: formFinal.sexo,
              alturaCm: Number(formFinal.alturaCm),
              edad: Number(formFinal.edad),
              peso: Number(formFinal.pesoKg), // Guardar peso del usuario
              objetivo: formFinal.objetivo, // Guardar objetivo
              atletico: Boolean(formFinal.atletico), // Guardar perfil atlético
              preferirRutina: Boolean(formFinal.preferirRutina), // Guardar preferencia de comidas rutinarias
              appLocale: locale,
              updatedAt: serverTimestamp(),
            };
            
            // Agregar tipoDieta solo si tiene valor (no undefined)
            if (formFinal.tipoDieta !== undefined && formFinal.tipoDieta !== null) {
              userData.tipoDieta = formFinal.tipoDieta;
            }
            
            // Asegurar que email y premium estén presentes (si no existen ya)
            if (!userDoc.exists() || !userDoc.data()?.email) {
              userData.email = userEmail;
            }
            if (!userDoc.exists() || userDoc.data()?.premium === undefined) {
              userData.premium = false;
            }
            
            // Agregar medidas opcionales solo si tienen valores
            if (formFinal.cinturaCm !== undefined && formFinal.cinturaCm !== null && formFinal.cinturaCm !== 0) {
              userData.cinturaCm = Number(formFinal.cinturaCm);
            }
            if (formFinal.cuelloCm !== undefined && formFinal.cuelloCm !== null && formFinal.cuelloCm !== 0) {
              userData.cuelloCm = Number(formFinal.cuelloCm);
            }
            if (formFinal.caderaCm !== undefined && formFinal.caderaCm !== null && formFinal.caderaCm !== 0) {
              userData.caderaCm = Number(formFinal.caderaCm);
            }
            
            // Agregar campos del step 3 (preferencias, restricciones, patologías, dolores/lesiones)
            userData.doloresLesiones = Array.isArray(formFinal.doloresLesiones) ? formFinal.doloresLesiones : [];
            userData.restricciones = Array.isArray(formFinal.restricciones) ? formFinal.restricciones : [];
            userData.preferencias = Array.isArray(formFinal.preferencias) ? formFinal.preferencias : [];
            userData.patologias = Array.isArray(formFinal.patologias) ? formFinal.patologias : [];
            
            // Agregar ubicación del usuario (ciudad y país) solo si no existen ya
            // Esto mantiene el país de origen donde creó su primer plan
            if (userLocation.ciudad) {
              // Solo guardar ciudad si no existe ya en el perfil
              if (!userDoc.exists() || !userDoc.data()?.ciudad) {
                userData.ciudad = userLocation.ciudad;
              }
            }
            if (userLocation.pais) {
              // Solo guardar país si no existe ya en el perfil
              if (!userDoc.exists() || !userDoc.data()?.pais) {
                userData.pais = userLocation.pais;
              }
            }
            
            // Limpiar campos undefined antes de guardar
            const cleanUserData = Object.fromEntries(
              Object.entries(userData).filter(([, v]) => v !== undefined && v !== null)
            );
            
            if (!userDoc.exists()) {
              await setDoc(userRef, {
                ...cleanUserData,
                email: userEmail,
                premium: false,
                createdAt: serverTimestamp(),
              });
              console.log("✅ Perfil de usuario creado con todos los campos");
              
              // Enviar notificación a Telegram para nuevo usuario (no bloqueante)
              try {
                // Obtener datos de ubicación si están disponibles
                const userDataForNotification = await getDoc(userRef);
                const userData = userDataForNotification.data();
                
                await fetch("/api/notify/telegram", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    type: "new_user",
                    data: {
                      userId: userId,
                      email: userEmail,
                      nombre: formFinal.nombre || null,
                      ciudad: userData?.ciudad || null,
                      pais: userData?.pais || null,
                    },
                  }),
                }).catch((err) => {
                  console.warn("⚠️ Error al enviar notificación de nuevo usuario a Telegram:", err);
                });
              } catch (telegramError) {
                console.warn("⚠️ Error al enviar notificación de nuevo usuario a Telegram:", telegramError);
              }
            } else {
              await setDoc(userRef, cleanUserData, { merge: true });
              console.log("✅ Perfil de usuario actualizado con datos del plan");
            }
            updateChecklistStep('perfil', 'completed');
          } catch (profileError) {
            console.error("Error al guardar perfil del usuario:", profileError);
            updateChecklistStep('perfil', 'error');
          }
          
          // Guardar plan automáticamente desde el cliente
          try {
            updateChecklistStep('plan', 'in_progress');
            const { collection, addDoc, serverTimestamp } = await import("firebase/firestore");
            
            // Limpiar datos: eliminar campos undefined y null
            const cleanUser = Object.fromEntries(
              Object.entries(formFinal).filter(([, v]) => v !== undefined && v !== null)
            );
            
            const cleanPlan = JSON.parse(JSON.stringify({ plan, user: cleanUser })); // Eliminar undefined recursivamente
            
            // Determinar si es un plan multi-fase
            const esMultiFase = formFinal.objetivo === "bulk_cut" || formFinal.objetivo === "lean_bulk";
            
            // Crear estructura multi-fase si aplica
            let planMultiFase: PlanMultiFase | null = null;
            if (esMultiFase) {
              planMultiFase = crearPlanMultiFase(
                formFinal,
                plan as PlanAIResponse,
                formFinal.objetivo as "bulk_cut" | "lean_bulk"
              );
              console.log("📋 Plan multi-fase creado:", {
                tipo: planMultiFase.tipo,
                totalMeses: planMultiFase.totalMeses,
                fases: planMultiFase.fases.map(f => `${f.nombre} (${f.mesesIncluidos.length} meses)`),
                pesoInicial: planMultiFase.datosIniciales.pesoInicial,
                pesoObjetivo: planMultiFase.datosIniciales.pesoObjetivoFinal
              });
            }
            
            // Guardar en Firebase
            const docRef = await addDoc(collection(db, "planes"), {
              userId,
              plan: cleanPlan,
              ...(planMultiFase && { planMultiFase: JSON.parse(JSON.stringify(planMultiFase)) }),
              createdAt: serverTimestamp(),
            });
            console.log("Plan guardado automáticamente con ID:", docRef.id);
            // Guardar el planId en el store para que se pueda actualizar después
            setPlanId(docRef.id);
            // Si es multi-fase, guardar también en el store
            if (planMultiFase) {
              setPlanMultiFase(planMultiFase);
            }
            updateChecklistStep('plan', 'completed');
          } catch (savePlanError) {
            updateChecklistStep('plan', 'error');
            console.error("Error al guardar plan automáticamente:", savePlanError);
            // No bloqueamos el flujo si falla guardar el plan
          }
        }
      } catch (error) {
        console.error("Error en el proceso de guardado:", error);
        // No bloqueamos el flujo si falla guardar
      }
      
    setUser(formFinal);
    setPlan(plan);
    setIsFirstPlan(false);
        // Timer ya no es necesario con streaming real
      setProgress(100);
      updateChecklistStep('completo', 'completed');

      // Si tenemos createdAt del snapshot de Firestore, guardarlo en el store
      try {
        // Nota: si el plan fue guardado automáticamente arriba, createdAt estará en Firestore.
        // Aquí solo aseguramos que, al menos, la fecha de inicio coincida con "ahora".
        const now = new Date();
        setPlanCreatedAt(now.toISOString());
      } catch {
        // Silenciar errores
      }

      // Esperar un momento para mostrar el checklist completo antes de redirigir
      await new Promise(resolve => setTimeout(resolve, 800));
      router.push("/plan");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : cp(locale, "errGeneric");
      setError(message);
      // Marcar todos los pasos pendientes como error
      setChecklistSteps(prev => prev.map(step => 
        step.status === 'pending' || step.status === 'in_progress' 
          ? { ...step, status: 'error' as StepStatus }
          : step
      ));
    } finally {
      if (timer) clearInterval(timer);
      setTimeout(() => {
        setProgress(0);
        setEstimatedTimeRemaining(null);
        setStartTime(null);
      }, 600);
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <Head>
        <title>{cp(locale, "pageTitle")}</title>
        <meta name="description" content={cp(locale, "pageDesc")} />
        <meta name="robots" content="noindex, nofollow" />
        <meta property="og:title" content={cp(locale, "ogTitle")} />
        <meta property="og:description" content={cp(locale, "ogDesc")} />
        <meta property="og:url" content="https://www.fitplan-ai.com/create-plan" />
      </Head>
      <Navbar />
      <div className="relative z-[1] px-3 py-6 sm:px-5 sm:py-10 md:px-8">
        <div className="mx-auto w-full max-w-3xl">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="relative overflow-hidden rounded-3xl border border-[var(--landing-border)] bg-[color-mix(in_oklab,var(--background)_82%,#0a0f18)] p-6 shadow-[0_24px_80px_-32px_rgba(0,0,0,0.75)] ring-1 ring-[color-mix(in_oklab,var(--foreground)_6%,transparent)] backdrop-blur-xl md:p-8"
          >
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.42]"
              style={{
                background:
                  "radial-gradient(80% 50% at 10% 0%, color-mix(in oklab, var(--landing-accent) 20%, transparent), transparent 55%), radial-gradient(60% 40% at 90% 0%, color-mix(in oklab, var(--brand-start) 14%, transparent), transparent 50%)",
              }}
            />
            <div className="relative">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--landing-muted)]">
                FitPlan
              </p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--foreground)] md:text-3xl">
                {cp(locale, "heroTitle")}
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-[var(--landing-muted)]">
                {cp(locale, "heroSubtitle")}
              </p>

              <div className="mt-8 flex gap-2" role="navigation" aria-label={cp(locale, "formStepsAria")}>
                {[...Array(maxStep)].map((_, i) => {
                  const n = i + 1;
                  const active = step === n;
                  const done = step > n;
                  return (
                    <div key={i} className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <div
                        className={`h-1.5 w-full rounded-full transition-colors ${
                          done || active
                            ? "bg-[color-mix(in_oklab,var(--landing-accent)_65%,transparent)]"
                            : "bg-[color-mix(in_oklab,var(--foreground)_10%,transparent)]"
                        }`}
                      />
                      <span
                        className={`text-[10px] font-semibold uppercase tracking-wider ${
                          active ? "text-[var(--landing-accent)]" : "text-[var(--landing-muted)]"
                        }`}
                      >
                        {n === 1 ? cp(locale, "stepProfile") : n === 2 ? cp(locale, "stepGoal") : cp(locale, "stepHealth")}
                      </span>
                    </div>
                  );
                })}
              </div>

          {step === 1 && (
            <>
              <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2">
                <label className="flex flex-col gap-1.5">
                  <span className={lbl}>
                    {cp(locale, "name")} <span className="text-danger">*</span>
                  </span>
                  <input 
                    className={`${field} ${nombreError ? fieldErr : ""}`} 
                    value={form.nombre} 
                    onChange={(e) => {
                      update("nombre", e.target.value);
                      if (nombreError && e.target.value.trim()) {
                        setNombreError(null);
                      }
                    }} 
                    placeholder={cp(locale, "phName")}
                    required
                  />
                  {nombreError && (
                    <span className="text-xs text-danger mt-1">{nombreError}</span>
                  )}
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className={lbl}>{cp(locale, "sex")}</span>
                  <select className={field} value={form.sexo} onChange={(e) => update("sexo", e.target.value as "masculino" | "femenino")}>
                    <option value="masculino">{cp(locale, "sexMale")}</option>
                    <option value="femenino">{cp(locale, "sexFemale")}</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className={lbl}>
                    {cp(locale, "age")} <span className="text-danger">*</span>
                  </span>
                  <input 
                    type="number" 
                    className={`${field} ${edadError ? fieldErr : ""}`} 
                    value={edadInput} 
                    onChange={(e) => {
                      const val = e.target.value;
                      setEdadInput(val);
                      if (edadError && val.trim() && Number(val) > 0) {
                        setEdadError(null);
                      }
                      if (val === "") {
                        update("edad", 0);
                      } else {
                        const num = Number(val);
                        if (!isNaN(num) && num >= 0) {
                          update("edad", num);
                        }
                      }
                    }}
                    onBlur={(e) => {
                      if (e.target.value === "" || Number(e.target.value) === 0) {
                        if (edadOriginal > 0) {
                          update("edad", edadOriginal);
                          setEdadInput(String(edadOriginal));
                        } else {
                          setEdadInput("");
                        }
                      } else {
                        setEdadInput(e.target.value);
                      }
                    }}
                    placeholder={cp(locale, "phAge")}
                    required
                  />
                  {edadError && (
                    <span className="text-xs text-danger mt-1">{edadError}</span>
                  )}
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className={lbl}>
                    {cp(locale, "height")} <span className="text-danger">*</span>
                  </span>
                  <input 
                    type="number" 
                    step="1"
                    className={`${field} ${alturaError ? fieldErr : ""}`} 
                    value={alturaInput} 
                    onChange={(e) => {
                      let val = e.target.value;
                      // Eliminar puntos y comas para forzar valores enteros en centímetros
                      val = val.replace(/[.,]/g, '');
                      
                      setAlturaInput(val);
                      if (alturaError && val.trim() && Number(val) > 0) {
                        setAlturaError(null);
                      }
                      if (val === "") {
                        update("alturaCm", 0);
                      } else {
                        const num = Number(val);
                        if (!isNaN(num) && num >= 0) {
                          update("alturaCm", num);
                        }
                      }
                    }}
                    onBlur={(e) => {
                      if (e.target.value === "" || Number(e.target.value) === 0) {
                        if (alturaOriginal > 0) {
                          update("alturaCm", alturaOriginal);
                          setAlturaInput(String(alturaOriginal));
                        } else {
                          setAlturaInput("");
                        }
                      } else {
                        setAlturaInput(e.target.value);
                      }
                    }}
                    placeholder={cp(locale, "phHeight")}
                    required
                  />
                  {alturaError && (
                    <span className="text-xs text-danger mt-1">{alturaError}</span>
                  )}
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className={lbl}>
                    {cp(locale, "weight")} <span className="text-danger">*</span>
                  </span>
                  <input 
                    type="number" 
                    className={`${field} ${pesoError ? fieldErr : ""}`} 
                    value={pesoInput} 
                    onChange={(e) => {
                      const val = e.target.value;
                      setPesoInput(val);
                      if (pesoError && val.trim() && Number(val) > 0) {
                        setPesoError(null);
                      }
                      if (val === "") {
                        update("pesoKg", 0);
                      } else {
                        const num = Number(val);
                        if (!isNaN(num) && num >= 0) {
                          update("pesoKg", num);
                        }
                      }
                    }}
                    onBlur={(e) => {
                      if (e.target.value === "" || Number(e.target.value) === 0) {
                        if (pesoOriginal > 0) {
                          update("pesoKg", pesoOriginal);
                          setPesoInput(String(pesoOriginal));
                        } else {
                          setPesoInput("");
                        }
                      } else {
                        setPesoInput(e.target.value);
                      }
                    }}
                    placeholder={cp(locale, "phWeight")}
                    required
                  />
                  {pesoError && (
                    <span className="text-xs text-danger mt-1">{pesoError}</span>
                  )}
                  <p className={hint}>
                    {cp(locale, "weightHint")}
                  </p>
                </label>
              </div>

              {/* Datos opcionales para mayor precisión */}
              {isPremium && (
                <div className={`mt-8 ${card}`}>
                  <p className="text-sm font-semibold text-[var(--foreground)]">{cp(locale, "premiumExtrasTitle")}</p>
                  <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                    <label className="flex flex-col gap-1.5">
                      <span className={lbl}>{cp(locale, "waist")}</span>
                      <input type="number" className={field} value={form.cinturaCm ?? ""} onChange={(e) => update("cinturaCm", e.target.value ? Number(e.target.value) : undefined)} />
                    </label>
                    <label className="flex flex-col gap-1.5">
                      <span className={lbl}>{cp(locale, "neck")}</span>
                      <input type="number" className={field} value={form.cuelloCm ?? ""} onChange={(e) => update("cuelloCm", e.target.value ? Number(e.target.value) : undefined)} />
                    </label>
                    <label className="flex flex-col gap-1.5">
                      <span className={lbl}>{cp(locale, "hip")}</span>
                      <input type="number" className={field} value={form.caderaCm ?? ""} onChange={(e) => update("caderaCm", e.target.value ? Number(e.target.value) : undefined)} />
                    </label>
                  </div>
                  <label className="mt-4 flex flex-col gap-1">
                    <div className="flex items-center gap-2.5 text-sm">
                      <input type="checkbox" className="h-4 w-4 rounded border-[var(--landing-border)]" checked={!!form.atletico} onChange={(e) => update("atletico", e.target.checked)} />
                      <span className="font-medium text-[var(--foreground)]">{cp(locale, "athleticProfile")}</span>
                    </div>
                    <p className={`${hint} ml-7`}>
                      {cp(locale, "athleticHint")}
                    </p>
                  </label>
                </div>
              )}
            </>
          )}

          {step === 2 && (
            <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2">
              <div className="flex flex-col gap-1 md:col-span-2">
              <label className="flex flex-col gap-1.5">
                <span className={lbl}>{cp(locale, "goalLabel")}</span>
                  <select 
                    className={field}
                    value={form.objetivo} 
                    onChange={(e) => update("objetivo", e.target.value as UserInput["objetivo"])}
                  >
                    <optgroup label={cp(locale, "optGroupGoalBasic")}>
                  <option value="perder_grasa">{cpGoalOpt(locale, "perder_grasa")}</option>
                  <option value="mantener">{cpGoalOpt(locale, "mantener")}</option>
                  <option value="ganar_masa">{cpGoalOpt(locale, "ganar_masa")}</option>
                    </optgroup>
                    <optgroup label={cp(locale, "optGroupGoalAdv")}>
                      <option value="recomposicion">{cpGoalOpt(locale, "recomposicion")}</option>
                      <option value="definicion">{cpGoalOpt(locale, "definicion")}</option>
                      <option value="volumen">{cpGoalOpt(locale, "volumen")}</option>
                      <option value="corte">{cpGoalOpt(locale, "corte")}</option>
                      <option value="mantenimiento_avanzado">{cpGoalOpt(locale, "mantenimiento_avanzado")}</option>
                    </optgroup>
                    <optgroup label={cp(locale, "optGroupGoalAthlete")}>
                      <option value="rendimiento_deportivo">{cpGoalOpt(locale, "rendimiento_deportivo")}</option>
                      <option value="powerlifting">{cpGoalOpt(locale, "powerlifting")}</option>
                      <option value="resistencia">{cpGoalOpt(locale, "resistencia")}</option>
                      <option value="atleta_elite">{cpGoalOpt(locale, "atleta_elite")}</option>
                    </optgroup>
                    <optgroup label={cp(locale, "optGroupGoalPhases")}>
                      <option value="bulk_cut">{cpGoalOpt(locale, "bulk_cut")}</option>
                      <option value="lean_bulk">{cpGoalOpt(locale, "lean_bulk")}</option>
                    </optgroup>
                  </select>
                </label>
                {form.objetivo && cpGoalLong(locale, form.objetivo) && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className={`${infoBox} w-full`}
                  >
                    <div className="flex w-full items-start gap-2">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        className="mt-0.5 h-4 w-4 shrink-0 text-[var(--landing-accent)]"
                      >
                        <path d="M12 2a10 10 0 1 0 10 10A10.011 10.011 0 0 0 12 2Zm.75 15h-1.5v-1.5h1.5Zm1.971-6.279-.675.693A3.375 3.375 0 0 0 12.75 14.25h-1.5a4.875 4.875 0 0 1 1.425-3.45l.93-.936a1.875 1.875 0 1 0-3.195-1.326h-1.5a3.375 3.375 0 1 1 6.03 1.283Z" />
                      </svg>
                      <p className="min-w-0 flex-1 break-words text-xs leading-relaxed text-[var(--landing-muted)] overflow-wrap-anywhere">
                        {cpGoalLong(locale, form.objetivo)}
                      </p>
                    </div>
                  </motion.div>
                )}
                
                {/* Peso objetivo - Solo visible para objetivos que requieren peso meta */}
                {(form.objetivo === "bulk_cut" || form.objetivo === "lean_bulk" || form.objetivo === "volumen" || form.objetivo === "ganar_masa") && (
                  <motion.div 
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: 0.1 }}
                    className="mt-3 rounded-2xl border border-warning/35 bg-[color-mix(in_oklab,var(--warning)_12%,transparent)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
                  >
                    <label className="flex flex-col gap-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-warning">🎯 {cp(locale, "weightGoalTitle")}</span>
                        <span className="text-xs text-[var(--landing-muted)]">
                          {(form.objetivo === "bulk_cut" || form.objetivo === "lean_bulk")
                            ? cp(locale, "recommended")
                            : cp(locale, "optional")}
                        </span>
                      </div>
                      <input 
                        type="number" 
                        className={`${field} border-warning/30 focus:border-warning/50 focus:ring-warning/25`}
                        value={form.pesoObjetivoKg ?? ""} 
                        onChange={(e) => update("pesoObjetivoKg", e.target.value ? Number(e.target.value) : undefined)}
                        placeholder={`${cp(locale, "phWeightGoal")} ${form.pesoKg ? Math.round(form.pesoKg * 1.15) : 90} kg`}
                      />
                      <p className="mt-2 text-xs leading-relaxed text-[var(--landing-muted)]">
                        {form.objetivo === "bulk_cut" 
                          ? cp(locale, "weightGoalHintBulk")
                          : form.objetivo === "lean_bulk"
                          ? cp(locale, "weightGoalHintLean")
                          : cp(locale, "weightGoalHintDefault")
                        }
                      </p>
                      
                      {/* Estimación detallada basada en todos los datos */}
                      {form.pesoObjetivoKg && form.pesoKg && form.pesoObjetivoKg > form.pesoKg && form.intensidad && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          className={`mt-3 ${card}`}
                        >
                          <p className="text-warning font-semibold mb-2 flex items-center gap-2">
                            📊 {cp(locale, "projTitle")}
                            <span className="text-xs font-normal opacity-70">{cp(locale, "projBasedOn")}</span>
                          </p>
                          
                          {(() => {
                            const pesoActual = form.pesoKg;
                            const pesoObjetivo = form.pesoObjetivoKg;
                            const diferencia = pesoObjetivo - pesoActual;
                            const intensidad = form.intensidad || "moderada";
                            const sexo = form.sexo || "masculino";
                            const edad = form.edad || 25;
                            const esAtletico = form.atletico || false;
                            const altura = form.alturaCm || 170;
                            const actividad = form.actividad || 3;
                            
                            // Factores de ajuste según perfil
                            const factorSexo = sexo === "femenino" ? 0.5 : 1;
                            const factorEdad = edad > 40 ? 0.85 : edad > 30 ? 0.95 : 1;
                            const factorExperiencia = esAtletico ? 0.7 : 1;
                            
                            // Velocidad base de ganancia muscular (kg/mes)
                            const velocidadBase = { ultra: 1.5, intensa: 1.2, moderada: 0.9, leve: 0.6 };
                            const velocidadCutBase = { ultra: 2.0, intensa: 1.5, moderada: 1.0, leve: 0.6 };
                            
                            const velocidadGanancia = velocidadBase[intensidad] * factorSexo * factorEdad * factorExperiencia;
                            const velocidadPerdida = velocidadCutBase[intensidad] * factorEdad;
                            
                            // Calcular TDEE real basado en datos del usuario (más preciso que peso * 30)
                            const bmr = calculateBMR(pesoActual, altura, edad, sexo);
                            // Ajustar el multiplicador según intensidad del objetivo
                            const diasGymEstimado = intensidad === "ultra" ? 6 : intensidad === "intensa" ? 5 : intensidad === "moderada" ? 4 : 3;
                            const tdeeReal = calculateTDEE(bmr, actividad, diasGymEstimado, 0);
                            
                            if (form.objetivo === "bulk_cut") {
                              const pesoBulk = Math.round(pesoObjetivo * 1.08);
                              const pesoAGanarBulk = pesoBulk - pesoActual;
                              const pesoAPerderCut = pesoBulk - pesoObjetivo;
                              
                              const mesesBulk = Math.ceil(pesoAGanarBulk / velocidadGanancia);
                              const mesesCut = Math.ceil(pesoAPerderCut / velocidadPerdida);
                              const totalMeses = mesesBulk + mesesCut;
                              
                              // Superávit más agresivo para BULK real (500-1000 kcal según intensidad)
                              const superavitBulk = intensidad === "ultra" ? 1000 : intensidad === "intensa" ? 750 : intensidad === "moderada" ? 500 : 350;
                              const caloriasBulk = Math.round(tdeeReal + superavitBulk);
                              
                              // Déficit para CUT (fase posterior - calorías sobre el TDEE del peso de bulk)
                              const bmrBulk = calculateBMR(pesoBulk, altura, edad, sexo);
                              const tdeeBulk = calculateTDEE(bmrBulk, actividad, diasGymEstimado, 2); // Más cardio en cut
                              const deficitCut = intensidad === "ultra" ? 800 : intensidad === "intensa" ? 650 : intensidad === "moderada" ? 500 : 350;
                              const caloriasCut = Math.round(tdeeBulk - deficitCut);
                              
                              return (
                                <div className="space-y-3 text-sm">
                                  <div className="grid grid-cols-2 gap-3">
                                    <div className="p-2 rounded-lg bg-phase-bulk/10 border border-phase-bulk/20">
                                      <p className="text-xs opacity-70">{cp(locale, "projPhaseBulk")}</p>
                                      <p className="font-bold text-phase-bulk">{mesesBulk} {cp(locale, "projMonths")}</p>
                                      <p className="text-xs opacity-70">{pesoActual}kg → {pesoBulk}kg</p>
                                      <p className="text-xs opacity-60">~{caloriasBulk} {cp(locale, "projKcalDay")}</p>
                                    </div>
                                    <div className="p-2 rounded-lg bg-phase-cut/10 border border-phase-cut/20">
                                      <p className="text-xs opacity-70">{cp(locale, "projPhaseCut")}</p>
                                      <p className="font-bold text-phase-cut">{mesesCut} {cp(locale, "projMonths")}</p>
                                      <p className="text-xs opacity-70">{pesoBulk}kg → {pesoObjetivo}kg</p>
                                      <p className="text-xs opacity-60">~{caloriasCut} {cp(locale, "projKcalDay")}</p>
                                    </div>
                                  </div>

                                  <div className="p-2 rounded-lg bg-gradient-to-r from-phase-bulk/20 to-phase-cut/20 border border-white/10">
                                    <div className="flex justify-between items-center">
                                      <div>
                                        <p className="text-xs opacity-70">{cp(locale, "projTimeTotal")}</p>
                                        <p className="font-bold text-lg">{totalMeses} {cp(locale, "projMonths")}</p>
                                      </div>
                                      <div className="text-right">
                                        <p className="text-xs opacity-70">{cp(locale, "projMuscleNet")}</p>
                                        <p className="font-bold text-success">~{Math.round(diferencia * 0.85)} kg</p>
                                      </div>
                                    </div>
                                  </div>
                                  
                                  <div className="text-xs opacity-60 space-y-1">
                                    <p>
                                      📊 {cpFmt(locale, "projTdeeLine", { n: tdeeReal })}
                                      {superavitBulk > 0 ? ` ${cpFmt(locale, "projTdeeBulk", { n: superavitBulk })}` : ""}
                                    </p>
                                    <p>
                                      {sexo === "femenino" && `⚡ ${cp(locale, "projFemale")} `}
                                      {edad > 35 && `⚡ ${cp(locale, "projAge")} `}
                                      {esAtletico && `⚡ ${cp(locale, "projAthlete")} `}
                                      {cp(locale, "projIntensityPrefix")} {cpIntensityTag(locale, intensidad)}
                                    </p>
                                  </div>
                                </div>
                              );
                            } else if (form.objetivo === "lean_bulk") {
                              const velocidadLeanBulk = velocidadGanancia * 0.6;
                              const mesesTotal = Math.ceil(diferencia / velocidadLeanBulk);
                              
                              // Superávit moderado para LEAN BULK (ganancia limpia)
                              const superavitLeanBulk = intensidad === "ultra" ? 500 : intensidad === "intensa" ? 400 : intensidad === "moderada" ? 300 : 200;
                              const caloriasLeanBulk = Math.round(tdeeReal + superavitLeanBulk);
                              
                              return (
                                <div className="space-y-3 text-sm">
                                  <div className="p-2 rounded-lg bg-phase-lean-bulk/10 border border-phase-lean-bulk/20">
                                    <div className="flex justify-between items-center">
                                      <div>
                                        <p className="text-xs opacity-70">{cp(locale, "projPhaseLean")}</p>
                                        <p className="font-bold text-phase-lean-bulk">{mesesTotal} {cp(locale, "projMonths")}</p>
                                      </div>
                                      <div className="text-right">
                                        <p className="text-xs opacity-70">{cp(locale, "projGainPerMonth")}</p>
                                        <p className="font-medium">~{velocidadLeanBulk.toFixed(1)} kg</p>
                                      </div>
                                    </div>
                                    <p className="text-xs opacity-70 mt-1">{pesoActual}kg → {pesoObjetivo}kg</p>
                                    <p className="text-xs opacity-60">~{caloriasLeanBulk} {cp(locale, "projKcalDay")}</p>
                                  </div>
                                  
                                  <div className="rounded-lg border border-[var(--landing-border)] bg-[var(--landing-surface)] p-2">
                                    <div className="flex justify-between items-center">
                                      <div>
                                        <p className="text-xs opacity-70">{cp(locale, "projWeightToGain")}</p>
                                        <p className="font-bold">{diferencia} kg</p>
                                      </div>
                                      <div className="text-right">
                                        <p className="text-xs opacity-70">{cp(locale, "projMuscleEst")}</p>
                                        <p className="font-bold text-success">~{Math.round(diferencia * 0.9)} kg</p>
                                      </div>
                                    </div>
                                  </div>
                                  
                                  <div className="text-xs opacity-60 space-y-1">
                                    <p>
                                      📊 {cpFmt(locale, "projTdeeLine", { n: tdeeReal })}{" "}
                                      {cpFmt(locale, "projTdeeSurplus", { n: superavitLeanBulk })}
                                    </p>
                                    <p>
                                      💎 {cp(locale, "projLeanNote")}
                                      {sexo === "femenino" && ` ${cp(locale, "projFemale")}`}
                                    </p>
                                  </div>
                                </div>
                              );
                            } else {
                              const mesesTotal = Math.ceil(diferencia / velocidadGanancia);
                              
                              return (
                                <div className="space-y-2 text-sm">
                                  <div className="flex justify-between items-center">
                                    <div>
                                      <p className="text-xs opacity-70">{cp(locale, "projTimeEst")}</p>
                                      <p className="font-bold text-lg">{mesesTotal} {cp(locale, "projMonths")}</p>
                                    </div>
                                    <div className="text-right">
                                      <p className="text-xs opacity-70">{cp(locale, "projGainPerMonth")}</p>
                                      <p className="font-medium">~{velocidadGanancia.toFixed(1)} kg</p>
                                    </div>
                                  </div>
                                  <p className="text-xs opacity-60">
                                    {cpFmt(locale, "projWithIntensity", { i: cpIntensityTag(locale, intensidad) })}
                                    {sexo === "femenino" && ` ${cp(locale, "projFemale")}`}
                                  </p>
                                </div>
                              );
                            }
                          })()}
                        </motion.div>
                      )}
                    </label>
                  </motion.div>
                )}
              </div>
              <div className="flex flex-col gap-1 md:col-span-2">
                <label className="flex flex-col gap-1.5">
                  <span className={lbl}>
                    {cp(locale, "dietTypeLabel")}
                  </span>
                  <select 
                    className={field}
                    value={form.tipoDieta || "estandar"} 
                    onChange={(e) => update("tipoDieta", e.target.value === "estandar" ? undefined : (e.target.value as TipoDieta))}
                  >
                    <optgroup label={cp(locale, "optGroupDietBasic")}>
                      <option value="estandar">{cpDietOpt(locale, "estandar")}</option>
                      <option value="mediterranea">{cpDietOpt(locale, "mediterranea")}</option>
                      <option value="vegetariana">{cpDietOpt(locale, "vegetariana")}</option>
                      <option value="vegana">{cpDietOpt(locale, "vegana")}</option>
                      <option value="low_carb">{cpDietOpt(locale, "low_carb")}</option>
                    </optgroup>
                    <optgroup label={cp(locale, "optGroupDietAdv")}>
                      <option value="antiinflamatoria">{cpDietOpt(locale, "antiinflamatoria")}</option>
                      <option value="atkins">{cpDietOpt(locale, "atkins")}</option>
                      <option value="clinica_mayo">{cpDietOpt(locale, "clinica_mayo")}</option>
                      <option value="dash">{cpDietOpt(locale, "dash")}</option>
                      <option value="flexitariana">{cpDietOpt(locale, "flexitariana")}</option>
                      <option value="keto">{cpDietOpt(locale, "keto")}</option>
                      <option value="mind">{cpDietOpt(locale, "mind")}</option>
                      <option value="menopausia">{cpDietOpt(locale, "menopausia")}</option>
                      <option value="paleo">{cpDietOpt(locale, "paleo")}</option>
                      <option value="pescatariana">{cpDietOpt(locale, "pescatariana")}</option>
                      <option value="sin_gluten">{cpDietOpt(locale, "sin_gluten")}</option>
                      <option value="tlc">{cpDietOpt(locale, "tlc")}</option>
                    </optgroup>
                  </select>
              </label>
                {(() => {
                  const dietaSeleccionada = form.tipoDieta || "estandar";
                  return cpDietLong(locale, dietaSeleccionada) && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                      className={`${infoBox} w-full`}
                    >
                      <div className="flex items-start gap-2 w-full">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          className="h-4 w-4 shrink-0 text-[var(--landing-accent)] mt-0.5"
                        >
                          <path d="M12 2a10 10 0 1 0 10 10A10.011 10.011 0 0 0 12 2Zm.75 15h-1.5v-1.5h1.5Zm1.971-6.279-.675.693A3.375 3.375 0 0 0 12.75 14.25h-1.5a4.875 4.875 0 0 1 1.425-3.45l.93-.936a1.875 1.875 0 1 0-3.195-1.326h-1.5a3.375 3.375 0 1 1 6.03 1.283Z" />
                        </svg>
                        <p className="text-xs leading-relaxed text-[var(--landing-muted)] break-words overflow-wrap-anywhere flex-1 min-w-0">
                          {cpDietLong(locale, dietaSeleccionada)}
                        </p>
                      </div>
                    </motion.div>
                  );
                })()}
              </div>
              {/* nuevos campos para plan sin IA (solo FREE) */}
              {!isPremium && (
                <>
                  <div className="grid grid-cols-1 gap-4 sm:gap-5 md:col-span-2 md:grid-cols-2">
                    <label className="flex min-w-0 flex-col gap-1.5">
                      <span className={lbl}>{cp(locale, "gymDaysLabel")}</span>
                      <input
                        type="number"
                        min={1}
                        max={7}
                        className={`${field} w-full max-w-full`}
                        value={diasGymInput}
                        onChange={(e) => {
                          const raw = e.target.value;
                          if (raw === "") {
                            setDiasGymInput("");
                            return;
                          }
                          const n = Number(raw);
                          if (Number.isNaN(n)) return;
                          setDiasGymInput(raw);
                          if (n >= 1 && n <= 7) {
                            update("diasGym", n);
                          }
                        }}
                        onBlur={() => {
                          const raw = diasGymInput.trim();
                          if (raw === "" || Number.isNaN(Number(raw))) {
                            const fallback = 3;
                            setDiasGymInput(String(fallback));
                            update("diasGym", fallback);
                            return;
                          }
                          let n = Math.round(Number(raw));
                          if (n < 1) n = 1;
                          if (n > 7) n = 7;
                          setDiasGymInput(String(n));
                          update("diasGym", n);
                        }}
                      />
                    </label>
                    <label className="flex min-w-0 flex-col gap-1.5">
                      <span className={lbl}>{cp(locale, "expLevelLabel")}</span>
                      <select
                        className={field}
                        value={form.nivelExperiencia || "intermedio"}
                        onChange={(e) => update("nivelExperiencia", e.target.value as UserInput["nivelExperiencia"])}
                      >
                        <option value="principiante">{cp(locale, "expBeginner")}</option>
                        <option value="intermedio">{cp(locale, "expIntermediate")}</option>
                        <option value="avanzado">{cp(locale, "expAdvanced")}</option>
                      </select>
                    </label>
                  </div>
                  <div className="md:col-span-2">
                    <label className="flex flex-col gap-1.5">
                      <span className={lbl}>{cp(locale, "equipmentLabel")}</span>
                      <select
                        className={field}
                        value={form.equipamiento || "gimnasio"}
                        onChange={(e) => update("equipamiento", e.target.value as UserInput["equipamiento"])}
                      >
                        <option value="gimnasio">{cp(locale, "eqGym")}</option>
                        <option value="casa">{cp(locale, "eqHome")}</option>
                        <option value="sin_equipo">{cp(locale, "eqNone")}</option>
                      </select>
                    </label>
                  </div>
                </>
              )}

              <div className="flex w-full min-w-0 flex-col gap-1 md:col-span-2">
                <label className="flex w-full min-w-0 flex-col gap-1.5">
                  <span className={lbl}>
                    {cp(locale, "intensityLabel")}
                    {esObjetivoBasico && (
                      <span className="ml-1 text-xs font-normal text-[var(--landing-muted)]">
                        {cp(locale, "intensityFixedBasic")}
                      </span>
                    )}
                  </span>
                  <select 
                    className={`${field} w-full max-w-full cursor-pointer`}
                    value={form.intensidad} 
                    onChange={(e) => update("intensidad", e.target.value as UserInput["intensidad"])}
                  >
                    <option value="leve">{cpIntensityOpt(locale, "leve")}</option>
                    <optgroup label={cp(locale, "optGroupIntAdv")}>
                      <option value="moderada" >
                        {cpIntensityOpt(locale, "moderada")}
                      </option>
                      <option value="intensa" >
                        {cpIntensityOpt(locale, "intensa")}
                      </option>
                    </optgroup>
                    <optgroup label={cp(locale, "optGroupIntUltra")}>
                      <option value="ultra" >
                        {cpIntensityOpt(locale, "ultra")}
                      </option>
                    </optgroup>
                </select>
              </label>
                {cpIntensityLong(locale, form.intensidad) && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className={`${infoBox} w-full min-w-0 max-w-full py-2.5`}
                  >
                    <div className="flex items-start gap-2 w-full">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--landing-accent)]"
                      >
                        <path d="M12 2a10 10 0 1 0 10 10A10.011 10.011 0 0 0 12 2Zm.75 15h-1.5v-1.5h1.5Zm1.971-6.279-.675.693A3.375 3.375 0 0 0 12.75 14.25h-1.5a4.875 4.875 0 0 1 1.425-3.45l.93-.936a1.875 1.875 0 1 0-3.195-1.326h-1.5a3.375 3.375 0 1 1 6.03 1.283Z" />
                      </svg>
                      <p className="text-xs leading-relaxed text-[var(--landing-muted)] break-words overflow-wrap-anywhere flex-1 min-w-0">
                        {cpIntensityLong(locale, form.intensidad)}
                      </p>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="mt-8 grid grid-cols-1 gap-5">
              {/* 1. Preferencias */}
              <label className="flex flex-col gap-1.5">
                <span className={lbl}>{cp(locale, "prefsLabel")}</span>
                <input 
                  className={field} 
                  value={preferenciasTexto} 
                  onChange={(e) => {
                    setPreferenciasTexto(e.target.value);
                  }}
                  onBlur={(e) => {
                    const array = e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean);
                    update("preferencias", array);
                  }}
                  placeholder={cp(locale, "phPrefs")} 
                />
              </label>
              
              {/* 3. Restricciones */}
              <label className="flex flex-col gap-1.5">
                <span className={lbl}>{cp(locale, "restrLabel")}</span>
                <input 
                  className={field} 
                  value={restriccionesTexto} 
                  onChange={(e) => {
                    setRestriccionesTexto(e.target.value);
                  }}
                  onBlur={(e) => {
                    const array = e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean);
                    update("restricciones", array);
                  }}
                  placeholder={cp(locale, "phRestr")} 
                />
              </label>
              
              {/* 4. Patologías */}
              <label className="flex flex-col gap-1.5">
                <span className={lbl}>{cp(locale, "pathLabel")}</span>
                <input 
                  className={field} 
                  value={patologiasTexto} 
                  onChange={(e) => {
                    setPatologiasTexto(e.target.value);
                  }}
                  onBlur={(e) => {
                    const array = e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean);
                    update("patologias", array);
                  }}
                  placeholder={cp(locale, "phPath")} 
                />
                <p className={hint}>
                  {cp(locale, "pathHint")}
                </p>
              </label>

              {/* 5. Dolores o lesiones */}
              <label className="flex flex-col gap-1.5">
                <span className={`${lbl} flex items-center gap-2`}>
                  {cp(locale, "painLabel")}
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="h-4 w-4 text-[var(--landing-accent)]"
                  >
                    <path d="M12 2a10 10 0 1 0 10 10A10.011 10.011 0 0 0 12 2Zm.75 15h-1.5v-1.5h1.5Zm1.971-6.279-.675.693A3.375 3.375 0 0 0 12.75 14.25h-1.5a4.875 4.875 0 0 1 1.425-3.45l.93-.936a1.875 1.875 0 1 0-3.195-1.326h-1.5a3.375 3.375 0 1 1 6.03 1.283Z" />
                  </svg>
                </span>
                <input
                  className={field}
                  value={doloresLesionesTexto}
                  onChange={(e) => setDoloresLesionesTexto(e.target.value)}
                  onBlur={(e) => {
                    const array = e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean);
                    update("doloresLesiones", array);
                  }}
                  placeholder={cp(locale, "phPain")}
                />
                <p className={hint}>
                  {cp(locale, "painHint")}
                </p>
              </label>

            {/* 5. Preferencia: comidas rutinarias */}
            <label className="mt-2 flex items-start gap-3 rounded-2xl border border-[var(--landing-border)] bg-[color-mix(in_oklab,var(--foreground)_2%,transparent)] p-4">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-[var(--landing-border)]"
                checked={!!form.preferirRutina}
                onChange={(e) => update("preferirRutina", e.target.checked)}
              />
              <span className="text-sm text-[var(--foreground)]">
                {cp(locale, "routineCheck")}
                <span className="mt-1 block text-xs text-[var(--landing-muted)]">
                  {cp(locale, "routineCheckHint")}
                </span>
              </span>
            </label>
            </div>
          )}

          <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-[color-mix(in_oklab,var(--foreground)_8%,transparent)] pt-8">
            <div className="min-w-0">
              {step > 1 && (
                <button
                  type="button"
                  className="rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface)] px-5 py-2.5 text-sm font-medium text-[var(--foreground)] transition hover:border-[color-mix(in_oklab,var(--foreground)_16%,transparent)]"
                  onClick={() => setStep((s) => Math.max(1, s - 1))}
                >
                  {cp(locale, "back")}
                </button>
              )}
            </div>
            {step < maxStep ? (
              <button
                type="button"
                className="rounded-xl bg-gradient-to-r from-[var(--brand-start)] via-[var(--brand-mid)] to-[var(--brand-end)] px-6 py-2.5 text-sm font-semibold text-white shadow-[0_12px_40px_-18px_color-mix(in_oklab,var(--brand-mid)_50%,transparent)] transition hover:brightness-110"
                onClick={() => {
                  // Validar campos requeridos antes de avanzar
                  if (step === 1) {
                    let hasError = false;
                    
                    if (!form.nombre.trim()) {
                      setNombreError(cp(locale, "errName"));
                      hasError = true;
                    } else {
                      setNombreError(null);
                    }
                    
                    if (!form.edad || form.edad === 0) {
                      setEdadError(cp(locale, "errAge"));
                      hasError = true;
                    } else {
                      setEdadError(null);
                    }
                    
                    if (!form.alturaCm || form.alturaCm === 0) {
                      setAlturaError(cp(locale, "errHeight"));
                      hasError = true;
                    } else {
                      setAlturaError(null);
                    }
                    
                    if (!form.pesoKg || form.pesoKg === 0) {
                      setPesoError(cp(locale, "errWeight"));
                      hasError = true;
                    } else {
                      setPesoError(null);
                    }
                    
                    if (hasError) {
                      return;
                    }
                  }
                  setStep((s) => Math.min(maxStep, s + 1));
                }}
              >
                {cp(locale, "next")}
              </button>
            ) : (
              <button
                type="button"
                className="rounded-xl bg-gradient-to-r from-[var(--brand-start)] via-[var(--brand-mid)] to-[var(--brand-end)] px-6 py-2.5 text-sm font-semibold text-white shadow-[0_12px_40px_-18px_color-mix(in_oklab,var(--brand-mid)_50%,transparent)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={handleGeneratePlan}
                disabled={loading}
              >
                {loading ? cp(locale, "generating") : cp(locale, "generateFree")}
              </button>
            )}
          </div>
          {error ? (
            <p className="mt-4 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>
          ) : null}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Overlay oscuro con spinner y tiempo estimado */}
      {loading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[color-mix(in_oklab,#020617_88%,black)] backdrop-blur-md"
        >
          <div className="flex flex-col items-center gap-10 px-4">
            <div className="relative h-32 w-32">
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-[color-mix(in_oklab,var(--landing-accent)_35%,transparent)]"
                animate={{ scale: [1, 1.12, 1], opacity: [0.35, 0.12, 0.35] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              />
              <motion.div
                className="absolute inset-2"
                animate={{ rotate: 360 }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              >
                <svg className="h-full w-full" viewBox="0 0 100 100">
                  <defs>
                    <linearGradient id="createPlanSpinner" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="var(--brand-start)" />
                      <stop offset="50%" stopColor="var(--landing-accent)" />
                      <stop offset="100%" stopColor="var(--brand-end)" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    fill="none"
                    stroke="url(#createPlanSpinner)"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray="200 100"
                  />
                </svg>
              </motion.div>
              <motion.div
                className="absolute inset-0 flex items-center justify-center"
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              >
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--brand-start)] via-[var(--brand-mid)] to-[var(--brand-end)] shadow-[0_12px_40px_-12px_color-mix(in_oklab,var(--brand-mid)_55%,transparent)]">
                  <FaAppleAlt className="text-3xl text-white" />
                </div>
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="space-y-3 text-center"
            >
              <h3 className="text-xl font-semibold tracking-tight text-[var(--foreground)]">
                {cp(locale, "loadingTitle")}
              </h3>
              <p className="mx-auto max-w-md text-sm leading-relaxed text-[var(--landing-muted)]">
                {cpFmt(locale, "loadingBody", { t: cp(locale, "loadingMinute") })}
              </p>
              <motion.div
                className="flex items-center justify-center gap-1.5"
                animate={{ opacity: [0.45, 1, 0.45] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                <span className="h-2 w-2 rounded-full bg-[var(--brand-start)]" />
                <span className="h-2 w-2 rounded-full bg-[var(--landing-accent)]" />
                <span className="h-2 w-2 rounded-full bg-[var(--brand-end)]" />
              </motion.div>
            </motion.div>

            {estimatedTimeRemaining !== null && estimatedTimeRemaining > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="rounded-2xl border border-[var(--landing-border)] bg-[var(--landing-surface)] px-6 py-3"
              >
                <p className="text-sm text-[var(--landing-muted)]">
                  {cp(locale, "timeLeft")}{" "}
                  <span className="font-semibold text-[var(--landing-accent)]">{estimatedTimeRemaining}s</span>
                </p>
              </motion.div>
            )}
          </div>
        </motion.div>
      )}

      {/* Modal de planes premium */}
      {authUser && authUser.uid && authUser.email && (
        <PremiumPlanModal
          isOpen={premiumModalOpen}
          onClose={() => setPremiumModalOpen(false)}
          userId={authUser.uid}
          userEmail={authUser.email}
          returnUrl={`${typeof window !== "undefined" ? window.location.origin : ""}/create-plan?continue=true&generate=true`}
        />
      )}
    </div>
  );
}
