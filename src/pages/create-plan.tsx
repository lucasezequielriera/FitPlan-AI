import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import { FaAppleAlt } from "react-icons/fa";
import { usePlanStore } from "@/store/planStore";
import { useAuthStore } from "@/store/authStore";
import { getAuthSafe, getDbSafe } from "@/lib/firebase";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import type { UserInput, Goal, TipoDieta, Intensidad, PlanMultiFase, FaseMultiFase, HistorialMes, Suplemento, PlanAIResponse } from "@/types/plan";
import Navbar from "@/components/Navbar";
import { calculateBMR, calculateTDEE } from "@/utils/calculations";
import PremiumPlanModal from "@/components/PremiumPlanModal";
import Head from "next/head";

const objetivoDescripciones: Record<Goal, string> = {
  perder_grasa: "Reduce tu porcentaje de grasa corporal mediante un déficit calórico controlado. Ideal si buscás perder peso de forma saludable, mejorando tu composición corporal y salud general. El plan incluirá un déficit moderado de calorías mientras mantiene tus músculos.",
  
  mantener: "Mantiene tu peso y composición corporal actuales. Perfecto si ya estás en un peso saludable y querés estabilizar tus hábitos alimenticios. El plan te ayudará a mantener tu condición física sin cambios significativos en tu peso.",
  
  ganar_masa: "Aumenta tu masa muscular mediante un superávit calórico estratégico junto con entrenamiento de fuerza. Ideal si buscás ganar peso principalmente en forma de músculo. El plan te proporcionará las calorías y proteínas necesarias para construir músculo de forma eficiente.",
  
  recomposicion: "Transforma tu cuerpo perdiendo grasa mientras ganás músculo al mismo tiempo. Este es el objetivo más desafiante pero también el más efectivo a largo plazo. Ideal para personas con experiencia en entrenamiento que buscan cambiar su composición corporal sin cambios drásticos en el peso.",
  
  definicion: "Reduce al máximo la grasa corporal manteniendo la mayor cantidad de músculo posible. Típicamente usado después de una fase de volumen para mostrar toda la masa muscular ganada. Requiere precisión en las calorías y macronutrientes para preservar el músculo.",
  
  volumen: "Fase de ganancia de masa muscular con un enfoque en maximizar el crecimiento. Incluye un superávit calórico más generoso para apoyar el entrenamiento intenso y la recuperación. Ideal para etapas de construcción muscular donde el objetivo principal es ganar tamaño y fuerza.",
  
  corte: "Reducción agresiva de grasa corporal para alcanzar un porcentaje muy bajo. Usado típicamente antes de competencias o eventos. Requiere disciplina estricta y monitoreo cuidadoso. No es recomendable mantener por períodos prolongados sin supervisión profesional.",
  
  mantenimiento_avanzado: "Optimiza tu nutrición para mantener tu composición corporal ideal mientras maximizas el rendimiento. Para personas experimentadas que buscan mantener un estado físico avanzado con precisión nutricional. Incluye estrategias avanzadas de timing de nutrientes y distribución.",
  
  // Objetivos para atletas y personas dedicadas al gym
  rendimiento_deportivo: "Optimiza tu rendimiento atlético con nutrición periodizada según tu deporte. Incluye timing estratégico de nutrientes pre/post entrenamiento, carga de carbohidratos para competencias, y recuperación acelerada. Ideal para atletas amateurs y semi-profesionales que buscan mejorar su performance.",
  
  powerlifting: "Maximiza tu fuerza en los tres grandes levantamientos (sentadilla, press de banca, peso muerto). Nutrición enfocada en fuerza máxima con alto consumo proteico, timing de carbohidratos para sesiones pesadas, y periodización según fases de entrenamiento. Ideal para powerlifters y entusiastas de la fuerza.",
  
  resistencia: "Optimiza tu capacidad aeróbica y resistencia para deportes de larga duración (running, ciclismo, triatlón, natación). Incluye estrategias de carga de glucógeno, hidratación avanzada, y nutrición durante el ejercicio prolongado. Alto énfasis en carbohidratos de calidad y recuperación.",
  
  atleta_elite: "El nivel más exigente para atletas de alto rendimiento y competidores. Nutrición de precisión con macros exactos, suplementación estratégica, periodización nutricional avanzada y protocolos de recuperación élite. Requiere compromiso total y es ideal para quienes entrenan 2+ horas diarias.",
  
  // Objetivos de transformación con fases
  bulk_cut: "🔄 BULK + CUT: El método clásico para ganar músculo y quedar definido. FASE 1 (Bulk): Superávit calórico para maximizar ganancia muscular, aceptando algo de grasa. FASE 2 (Cut): Déficit controlado para eliminar la grasa y revelar los músculos. Incluye señales claras de cuándo cambiar de fase y ajustes automáticos. Ideal si querés ganar mucho músculo y luego quedar con abs marcados.",
  
  lean_bulk: "💎 LEAN BULK / Volumen Limpio: Gana músculo minimizando la grasa al máximo. Superávit calórico controlado (+300-400 kcal), cardio estratégico 2-3x/semana, y mini-cuts de 2-3 semanas si acumulás grasa. Proceso más lento que bulk+cut pero evitás la fase de corte agresivo. Ideal si querés progresar sin perder definición."
};

const dietaDescripciones: Record<TipoDieta, string> = {
  estandar: "Una alimentación equilibrada sin restricciones específicas. Incluye todos los grupos de alimentos: carnes, pescados, vegetales, frutas, cereales, legumbres y lácteos. Flexible y adaptable a diferentes objetivos nutricionales.",
  
  mediterranea: "Basada en la alimentación tradicional de países mediterráneos. Rica en aceite de oliva, pescados, frutas, verduras, legumbres y granos integrales. Baja en carnes rojas y alimentos procesados. Asociada con beneficios para la salud cardiovascular y longevidad.",
  
  vegana: "Elimina todos los productos de origen animal. Basada en plantas: frutas, verduras, legumbres, granos, frutos secos y semillas. Requiere atención especial a nutrientes como B12, hierro y proteínas para asegurar una nutrición completa.",
  
  vegetariana: "Elimina carnes y pescados pero incluye huevos y lácteos. Rica en vegetales, frutas, legumbres y granos. Más flexible que la vegana y puede ser más fácil alcanzar todos los nutrientes necesarios.",
  
  keto: "Alta en grasas y muy baja en carbohidratos (típicamente menos de 20-50g por día). Induce cetosis, donde el cuerpo quema grasa como combustible principal. Efectiva para pérdida de peso rápida, pero requiere disciplina estricta.",
  
  paleo: "Imita la alimentación de nuestros ancestros pre-agrícolas. Incluye carnes, pescados, huevos, frutas, verduras, frutos secos y semillas. Elimina granos, legumbres, lácteos y alimentos procesados. Enfocada en alimentos naturales y sin procesar.",
  
  low_carb: "Reducción moderada de carbohidratos (típicamente 50-150g por día). Permite más flexibilidad que la keto mientras aún limita carbohidratos. Puede ayudar con pérdida de peso y control de azúcar en sangre.",
  
  flexitariana: "Principalmente vegetariana pero permite consumo ocasional de carne o pescado. Combina los beneficios de una dieta basada en plantas con la flexibilidad de incluir proteínas animales cuando se desee. Ideal para transición hacia alimentación más vegetal.",
  
  dash: "Diseñada para reducir la presión arterial. Rica en frutas, verduras, granos integrales, lácteos bajos en grasa, proteínas magras y frutos secos. Limita sodio, azúcares añadidos y grasas saturadas. Recomendada por profesionales de salud para salud cardiovascular.",
  
  pescatariana: "Vegetariana que incluye pescados y mariscos. Elimina carnes rojas, aves y otras carnes, pero permite pescados por su contenido de omega-3. Incluye huevos y lácteos. Combinación de beneficios vegetales con ácidos grasos esenciales del pescado.",
  
  atkins: "Dieta baja en carbohidratos con fases progresivas. Comienza muy restrictiva (menos de 20g de carbohidratos) y gradualmente aumenta. Enfoque en proteínas, grasas saludables y vegetales sin almidón. Popular para pérdida de peso rápida inicial.",
  
  sin_gluten: "Elimina completamente el gluten (proteína en trigo, cebada, centeno). Esencial para personas con celiaquía o sensibilidad al gluten. Incluye arroz, maíz, quinoa, carnes, pescados, huevos, frutas y verduras. Requiere atención a etiquetas de alimentos procesados.",
  
  antiinflamatoria: "Enfocada en reducir la inflamación crónica. Rica en omega-3, antioxidantes y alimentos integrales. Incluye pescados grasos, frutas, verduras, granos integrales, frutos secos, semillas y especias antiinflamatorias. Limita alimentos procesados, azúcares refinados y grasas trans.",
  
  mind: "Combinación de dietas Mediterránea y DASH enfocada en salud cerebral. Prioriza verduras de hoja verde, frutos secos, bayas, legumbres, granos integrales, pescados, aves y aceite de oliva. Limita carnes rojas, manteca, margarina, queso, dulces y alimentos fritos. Asociada con reducción de riesgo de demencia y Alzheimer.",
  
  clinica_mayo: "Programa de 12 semanas enfocado en hábitos saludables y control de porciones. No cuenta calorías sino que enseña a elegir alimentos densos en nutrientes. Incluye todos los grupos alimentarios con énfasis en frutas, verduras, granos integrales y proteínas magras. Promueve pérdida de peso sostenible mediante cambios de estilo de vida.",
  
  tlc: "Cambios Terapéuticos en el Estilo de Vida para reducir colesterol. Baja en grasas saturadas y colesterol. Rica en frutas, verduras, granos integrales y proteínas magras. Limita carnes rojas, lácteos enteros y alimentos procesados. Combinada con ejercicio regular. Recomendada por el Programa Nacional de Educación sobre el Colesterol.",
  
  menopausia: "Adaptada específicamente para mujeres en menopausia. Enfocada en manejar síntomas y prevenir aumento de peso. Rica en calcio (lácteos, vegetales de hoja verde), fitoestrógenos (soja, legumbres), proteínas magras y granos integrales. Limita azúcares refinados, cafeína y alcohol. Ayuda a mantener densidad ósea y equilibrio hormonal."
};

const intensidadDescripciones: Record<Intensidad, string> = {
  leve: "Cambios graduales y sostenibles. Déficit o superávit calórico pequeño (200-300 kcal/día). Ideal para principiantes o quienes buscan cambios a largo plazo sin sacrificios extremos.",
  moderada: "Progresión equilibrada. Déficit o superávit calórico medio (400-500 kcal/día). Balance entre resultados y sostenibilidad. Recomendada para la mayoría de personas.",
  intensa: "Cambios más agresivos para resultados más rápidos. Déficit o superávit calórico alto (600-800 kcal/día). Requiere mayor disciplina y puede ser más difícil de mantener a largo plazo.",
  ultra: "🔥 MÁXIMO RENDIMIENTO: Para atletas y personas comprometidas al 100%. Déficit o superávit extremo (800-1200 kcal/día). Entrenamiento de alta frecuencia (5-7 días/semana), dobles sesiones permitidas. Requiere experiencia previa, excelente recuperación y compromiso total. NO recomendado para principiantes."
};

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
  const [canCreatePlan, setCanCreatePlan] = useState(true);
  const [planLimitMessage, setPlanLimitMessage] = useState<string | null>(null);
  const [nombreError, setNombreError] = useState<string | null>(null);
  const [premiumModalOpen, setPremiumModalOpen] = useState(false);
  const [edadError, setEdadError] = useState<string | null>(null);
  const [alturaError, setAlturaError] = useState<string | null>(null);
  const [pesoError, setPesoError] = useState<string | null>(null);
  // Estados locales para inputs numéricos (permiten estar vacíos)
  const [edadInput, setEdadInput] = useState<string>("");
  const [alturaInput, setAlturaInput] = useState<string>("");
  const [pesoInput, setPesoInput] = useState<string>("");
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
        setCanCreatePlan(true);
        setPlanLimitMessage(null);

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
  }, [authUser, authLoading, userDataLoaded]);

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
    { id: 'preparar', label: 'Chequeando datos', status: 'pending' },
    { id: 'enviar', label: 'Revisando por nuestros profesionales', status: 'pending' },
    { id: 'recibir', label: 'Generando planes personalizados', status: 'pending' },
    { id: 'validar', label: 'Validando calidad del plan', status: 'pending' },
    { id: 'perfil', label: 'Guardando tu perfil', status: 'pending' },
    { id: 'plan', label: 'Finalizando tu plan', status: 'pending' },
    { id: 'completo', label: '¡Plan generado exitosamente!', status: 'pending' },
  ]);
  
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
      alert("Debes estar registrado para generar un plan");
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
          setError("Reintentando generación del plan...");
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
        const diasGymEstimado = intensidad === "ultra" ? 6 : intensidad === "intensa" ? 5 : intensidad === "moderada" ? 4 : 3;
        const tdeeCalculado = calculateTDEE(bmrCalculado, actividad, diasGymEstimado, 0);
        
        // Calcular superávit/déficit según objetivo e intensidad
        let caloriasObjetivo = tdeeCalculado;
        const objetivo = formFinal.objetivo;
        
        // Objetivos de GANANCIA (superávit calórico)
        if (objetivo === "bulk_cut" || objetivo === "volumen" || objetivo === "powerlifting") {
          // Superávit alto para máxima ganancia/fuerza
          const superavit = intensidad === "ultra" ? 1000 : intensidad === "intensa" ? 750 : intensidad === "moderada" ? 500 : 350;
          caloriasObjetivo = tdeeCalculado + superavit;
        } else if (objetivo === "lean_bulk" || objetivo === "ganar_masa") {
          // Superávit moderado para ganancia controlada
          const superavit = intensidad === "ultra" ? 500 : intensidad === "intensa" ? 400 : intensidad === "moderada" ? 300 : 200;
          caloriasObjetivo = tdeeCalculado + superavit;
        } 
        // Objetivos de PÉRDIDA (déficit calórico)
        else if (objetivo === "perder_grasa" || objetivo === "corte") {
          // Déficit alto para pérdida rápida
          const deficit = intensidad === "ultra" ? 800 : intensidad === "intensa" ? 650 : intensidad === "moderada" ? 500 : 350;
          caloriasObjetivo = tdeeCalculado - deficit;
        } else if (objetivo === "definicion") {
          // Déficit moderado para preservar músculo
          const deficit = intensidad === "ultra" ? 600 : intensidad === "intensa" ? 500 : intensidad === "moderada" ? 400 : 250;
          caloriasObjetivo = tdeeCalculado - deficit;
        }
        // Objetivos de RECOMPOSICIÓN (cercano a mantenimiento)
        else if (objetivo === "recomposicion") {
          // Pequeño déficit o mantenimiento para recomp
          const ajuste = intensidad === "ultra" ? -100 : intensidad === "intensa" ? -50 : 0;
          caloriasObjetivo = tdeeCalculado + ajuste;
        }
        // Objetivos ATLÉTICOS (superávit moderado para rendimiento)
        else if (objetivo === "rendimiento_deportivo" || objetivo === "atleta_elite") {
          // Superávit para soportar entrenamiento intenso
          const superavit = intensidad === "ultra" ? 600 : intensidad === "intensa" ? 450 : intensidad === "moderada" ? 300 : 150;
          caloriasObjetivo = tdeeCalculado + superavit;
        } else if (objetivo === "resistencia") {
          // Alto en carbohidratos pero superávit moderado
          const superavit = intensidad === "ultra" ? 500 : intensidad === "intensa" ? 400 : intensidad === "moderada" ? 250 : 150;
          caloriasObjetivo = tdeeCalculado + superavit;
        }
        // MANTENIMIENTO (TDEE exacto)
        else if (objetivo === "mantener" || objetivo === "mantenimiento_avanzado") {
          caloriasObjetivo = tdeeCalculado; // Sin ajuste
        }
        // Default: mantenimiento
        else {
          caloriasObjetivo = tdeeCalculado;
        }
        
        // Calcular macros basados en objetivo y peso
        const calcularMacros = () => {
          // Proteína según objetivo (g por kg de peso corporal)
          let proteinaPorKg = 1.8; // Default
          if (objetivo === "bulk_cut" || objetivo === "volumen" || objetivo === "powerlifting" || objetivo === "lean_bulk" || objetivo === "ganar_masa") {
            proteinaPorKg = intensidad === "ultra" ? 2.5 : intensidad === "intensa" ? 2.2 : 2.0;
          } else if (objetivo === "perder_grasa" || objetivo === "definicion" || objetivo === "corte") {
            proteinaPorKg = intensidad === "ultra" ? 2.8 : intensidad === "intensa" ? 2.5 : 2.2; // Más alta para preservar músculo
          } else if (objetivo === "resistencia") {
            proteinaPorKg = 1.6; // Resistencia necesita menos proteína
          } else if (objetivo === "recomposicion") {
            proteinaPorKg = 2.2;
          }
          
          const proteinasG = Math.round(proteinaPorKg * pesoActual);
          const kcalFromProtein = proteinasG * 4;
          
          // Grasas: 25-30% de las calorías según objetivo
          let grasasPct = 0.28; // Default 28%
          if (objetivo === "resistencia") {
            grasasPct = 0.22; // Menos grasa para más carbos
          } else if (objetivo === "perder_grasa" || objetivo === "definicion" || objetivo === "corte") {
            grasasPct = 0.30; // Más grasa para saciedad
          } else if (objetivo === "bulk_cut" || objetivo === "volumen") {
            grasasPct = 0.25; // Menos grasa para más carbos
          }
          
          const grasasG = Math.round((grasasPct * caloriasObjetivo) / 9);
          const kcalFromFat = grasasG * 9;
          
          // Carbohidratos: el resto de las calorías
          const remainingKcal = Math.max(caloriasObjetivo - (kcalFromProtein + kcalFromFat), 0);
          const carbsG = Math.round(remainingKcal / 4);
          
          return {
            proteinas: `${proteinasG}g`,
            grasas: `${grasasG}g`,
            carbohidratos: `${carbsG}g`,
            _detalles: {
              proteinaPorKg,
              proteinasKcal: kcalFromProtein,
              grasasPct: Math.round(grasasPct * 100),
              grasasKcal: kcalFromFat,
              carbsKcal: remainingKcal
            }
          };
        };
        
        const macrosCalculados = calcularMacros();
        
        const payload = { 
          ...formFinal, 
          firstPlan: isFirstPlan,
          // Datos calculados para que OpenAI/Templates use valores consistentes
          _tdeeCalculado: tdeeCalculado,
          _caloriasObjetivo: caloriasObjetivo,
          _bmrCalculado: bmrCalculado,
          _macrosObjetivo: macrosCalculados,
          // ID del usuario para verificar premium status
          userId: authUser?.uid,
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
        console.log("=".repeat(80));
        console.log(plan._debug_training_plan);
        console.log("=".repeat(80));
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
            userData.doloresLesiones = Array.isArray(formFinal.doloresLesiones) ? formFinal.doloresLesiones : [];
            
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
      const message = err instanceof Error ? err.message : "Ocurrió un error";
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
    <div className="min-h-screen">
      <Head>
        <title>Crear Plan Personalizado | FitPlan AI</title>
        <meta name="description" content="Creá tu plan de alimentación y entrenamiento personalizado con inteligencia artificial. Completá el formulario y recibí tu plan en minutos." />
        <meta name="robots" content="noindex, nofollow" />
        <meta property="og:title" content="Crear Plan Personalizado | FitPlan AI" />
        <meta property="og:description" content="Diseñá tu plan de alimentación y entrenamiento personalizado en minutos con IA." />
        <meta property="og:url" content="https://www.fitplan-ai.com/create-plan" />
      </Head>
      <Navbar />
      <div className="px-4 py-8 md:px-8">
        <div className="mx-auto max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl p-6 md:p-8"
        >
          <h1 className="text-2xl md:text-3xl font-semibold">FitPlan AI</h1>
          <p className="mt-1 text-sm opacity-80">Generá tu plan de alimentación personalizado.</p>

          <div className="mt-6 flex items-center gap-2 text-xs opacity-80">
            <span className={`h-2 w-2 rounded-full ${step >= 1 ? "bg-white" : "bg-white/30"}`} />
            <span className={`h-2 w-2 rounded-full ${step >= 2 ? "bg-white" : "bg-white/30"}`} />
            <span className={`h-2 w-2 rounded-full ${step >= 3 ? "bg-white" : "bg-white/30"}`} />
          </div>

          {step === 1 && (
            <>
              <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="flex flex-col gap-1">
                  <span className="text-sm opacity-80">Nombre <span className="text-red-400">*</span></span>
                  <input 
                    className={`rounded-xl bg-white/5 px-3 py-2 outline-none ${nombreError ? "border border-red-500/50" : ""}`} 
                    value={form.nombre} 
                    onChange={(e) => {
                      update("nombre", e.target.value);
                      if (nombreError && e.target.value.trim()) {
                        setNombreError(null);
                      }
                    }} 
                    placeholder="Tu nombre"
                    required
                  />
                  {nombreError && (
                    <span className="text-xs text-red-400 mt-1">{nombreError}</span>
                  )}
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-sm opacity-80">Sexo</span>
                  <select className="rounded-xl bg-white/5 px-3 py-2" value={form.sexo} onChange={(e) => update("sexo", e.target.value as "masculino" | "femenino")}>
                    <option value="masculino">Masculino</option>
                    <option value="femenino">Femenino</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-sm opacity-80">Edad <span className="text-red-400">*</span></span>
                  <input 
                    type="number" 
                    className={`rounded-xl bg-white/5 px-3 py-2 outline-none ${edadError ? "border border-red-500/50" : ""}`} 
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
                    placeholder="Tu edad"
                    required
                  />
                  {edadError && (
                    <span className="text-xs text-red-400 mt-1">{edadError}</span>
                  )}
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-sm opacity-80">Altura (cm) <span className="text-red-400">*</span></span>
                  <input 
                    type="number" 
                    step="1"
                    className={`rounded-xl bg-white/5 px-3 py-2 outline-none ${alturaError ? "border border-red-500/50" : ""}`} 
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
                    placeholder="Tu altura en centímetros"
                    required
                  />
                  {alturaError && (
                    <span className="text-xs text-red-400 mt-1">{alturaError}</span>
                  )}
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-sm opacity-80">Peso (kg) <span className="text-red-400">*</span></span>
                  <input 
                    type="number" 
                    className={`rounded-xl bg-white/5 px-3 py-2 outline-none ${pesoError ? "border border-red-500/50" : ""}`} 
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
                    placeholder="Tu peso en kilogramos"
                    required
                  />
                  {pesoError && (
                    <span className="text-xs text-red-400 mt-1">{pesoError}</span>
                  )}
                  <p className="text-xs opacity-60 mt-1">
                    Puede ser un valor estimativo. Es importante para calcular el IMC. Podés editarlo después si es necesario.
                  </p>
                </label>
              </div>
              
              {/* Datos opcionales para mayor precisión */}
              <div className="mt-6 rounded-xl border border-white/10 p-4">
                <p className="text-sm font-medium opacity-80">Datos opcionales para mayor precisión</p>
                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                  <label className="flex flex-col gap-1">
                    <span className="text-sm opacity-80">Cintura (cm)</span>
                    <input type="number" className="rounded-xl bg-white/5 px-3 py-2 outline-none" value={form.cinturaCm ?? ""} onChange={(e) => update("cinturaCm", e.target.value ? Number(e.target.value) : undefined)} />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-sm opacity-80">Cuello (cm)</span>
                    <input type="number" className="rounded-xl bg-white/5 px-3 py-2 outline-none" value={form.cuelloCm ?? ""} onChange={(e) => update("cuelloCm", e.target.value ? Number(e.target.value) : undefined)} />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-sm opacity-80">Cadera (cm)</span>
                    <input type="number" className="rounded-xl bg-white/5 px-3 py-2 outline-none" value={form.caderaCm ?? ""} onChange={(e) => update("caderaCm", e.target.value ? Number(e.target.value) : undefined)} />
                  </label>
                </div>
                <label className="mt-3 flex flex-col gap-1">
                  <div className="flex items-center gap-2 text-sm">
                    <input type="checkbox" className="h-4 w-4" checked={!!form.atletico} onChange={(e) => update("atletico", e.target.checked)} />
                    <span className="opacity-80">Perfil atlético / mayor masa muscular</span>
                  </div>
                  <p className="text-xs opacity-60 ml-6">
                    Marca esta opción si ya sos deportista, fit o tenés un nivel de actividad física avanzado.
                  </p>
                </label>
              </div>
            </>
          )}

          {step === 2 && (
            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-1 md:col-span-2">
              <label className="flex flex-col gap-1">
                <span className="text-sm opacity-80">Objetivo</span>
                  <select 
                    className="rounded-xl bg-white/5 px-3 py-2 text-white" 
                    style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)', color: '#e6f6ff' }}
                    value={form.objetivo} 
                    onChange={(e) => update("objetivo", e.target.value as UserInput["objetivo"])}
                  >
                    <optgroup label="Objetivos básicos - Para empezar">
                  <option value="perder_grasa">Perder peso - Reducción simple de peso corporal</option>
                  <option value="mantener">Mantener peso - Conservar tu peso actual</option>
                  <option value="ganar_masa">Aumentar peso - Ganancia simple de peso</option>
                    </optgroup>
                    <optgroup label="🌟 Objetivos avanzados">
                      <option value="recomposicion">🔥 Transformación Total - Quema grasa y construye músculo simultáneamente</option>
                      <option value="definicion">💎 Definición Extrema - Logra músculos marcados con bajo % de grasa corporal</option>
                      <option value="volumen">💪 Hipertrofia Máxima - Maximiza el crecimiento muscular con periodización avanzada</option>
                      <option value="corte">⚡ Corte Avanzado - Reducción de grasa preservando masa muscular (más preciso que perder peso)</option>
                      <option value="mantenimiento_avanzado">🎯 Mantenimiento Elite - Optimización avanzada para atletas experimentados</option>
                    </optgroup>
                    <optgroup label="🏆 Para Atletas y Deportistas">
                      <option value="rendimiento_deportivo">🏃 Rendimiento Deportivo - Nutrición periodizada para tu deporte específico</option>
                      <option value="powerlifting">🏋️ Powerlifting/Fuerza - Maximiza tu fuerza en los levantamientos principales</option>
                      <option value="resistencia">🚴 Resistencia/Endurance - Running, ciclismo, triatlón y deportes de larga duración</option>
                      <option value="atleta_elite">👑 Atleta Elite - El nivel más exigente para competidores de alto rendimiento</option>
                    </optgroup>
                    <optgroup label="🔄 Transformación con Fases">
                      <option value="bulk_cut">🔄 Bulk + Cut - Gana músculo máximo, luego corta para quedar definido con abs</option>
                      <option value="lean_bulk">💎 Lean Bulk - Gana músculo limpio minimizando grasa (más lento pero sin corte)</option>
                    </optgroup>
                  </select>
                </label>
                {form.objetivo && objetivoDescripciones[form.objetivo] && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className="mt-2 rounded-lg bg-white/5 border border-white/10 p-3 w-full"
                  >
                    <div className="flex items-start gap-2 w-full">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        className="h-4 w-4 opacity-70 mt-0.5 flex-shrink-0"
                      >
                        <path d="M12 2a10 10 0 1 0 10 10A10.011 10.011 0 0 0 12 2Zm.75 15h-1.5v-1.5h1.5Zm1.971-6.279-.675.693A3.375 3.375 0 0 0 12.75 14.25h-1.5a4.875 4.875 0 0 1 1.425-3.45l.93-.936a1.875 1.875 0 1 0-3.195-1.326h-1.5a3.375 3.375 0 1 1 6.03 1.283Z" />
                      </svg>
                      <p className="text-xs leading-relaxed opacity-90 break-words overflow-wrap-anywhere flex-1 min-w-0">
                        {objetivoDescripciones[form.objetivo]}
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
                    className="mt-3 p-4 rounded-xl border border-amber-500/30 bg-amber-500/10"
                  >
                    <label className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-amber-300">🎯 Peso Objetivo Final (kg)</span>
                        <span className="text-xs opacity-60">{(form.objetivo === "bulk_cut" || form.objetivo === "lean_bulk") ? "(Recomendado)" : "(Opcional)"}</span>
                      </div>
                      <input 
                        type="number" 
                        className="rounded-xl bg-white/5 px-3 py-2 outline-none border border-amber-500/20 focus:border-amber-500/50"
                        value={form.pesoObjetivoKg ?? ""} 
                        onChange={(e) => update("pesoObjetivoKg", e.target.value ? Number(e.target.value) : undefined)}
                        placeholder={`Ej: ${form.pesoKg ? Math.round(form.pesoKg * 1.15) : 90} kg`}
                      />
                      <p className="text-xs opacity-70 mt-1">
                        {form.objetivo === "bulk_cut" 
                          ? "¿A qué peso querés llegar DEFINIDO (con abs marcados)? El plan calculará el peso de bulk necesario y las fases."
                          : form.objetivo === "lean_bulk"
                          ? "¿A qué peso querés llegar manteniendo definición? El plan ajustará el superávit para minimizar grasa."
                          : "¿A qué peso querés llegar? Esto ayuda a calcular mejor tu plan."
                        }
                      </p>
                      
                      {/* Estimación detallada basada en todos los datos */}
                      {form.pesoObjetivoKg && form.pesoKg && form.pesoObjetivoKg > form.pesoKg && form.intensidad && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          className="mt-3 p-3 rounded-xl bg-gradient-to-r from-white/5 to-white/10 border border-white/10"
                        >
                          <p className="text-amber-300 font-semibold mb-2 flex items-center gap-2">
                            📊 Proyección Personalizada
                            <span className="text-xs font-normal opacity-70">basada en tus datos</span>
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
                                    <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                                      <p className="text-xs opacity-70">Fase BULK</p>
                                      <p className="font-bold text-amber-300">{mesesBulk} meses</p>
                                      <p className="text-xs opacity-70">{pesoActual}kg → {pesoBulk}kg</p>
                                      <p className="text-xs opacity-60">~{caloriasBulk} kcal/día</p>
                                    </div>
                                    <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                                      <p className="text-xs opacity-70">Fase CUT</p>
                                      <p className="font-bold text-cyan-300">{mesesCut} meses</p>
                                      <p className="text-xs opacity-70">{pesoBulk}kg → {pesoObjetivo}kg</p>
                                      <p className="text-xs opacity-60">~{caloriasCut} kcal/día</p>
                                    </div>
                                  </div>
                                  
                                  <div className="p-2 rounded-lg bg-gradient-to-r from-amber-500/20 to-cyan-500/20 border border-white/10">
                                    <div className="flex justify-between items-center">
                                      <div>
                                        <p className="text-xs opacity-70">Tiempo total estimado</p>
                                        <p className="font-bold text-lg">{totalMeses} meses</p>
                                      </div>
                                      <div className="text-right">
                                        <p className="text-xs opacity-70">Músculo neto a ganar</p>
                                        <p className="font-bold text-emerald-400">~{Math.round(diferencia * 0.85)} kg</p>
                                      </div>
                                    </div>
                                  </div>
                                  
                                  <div className="text-xs opacity-60 space-y-1">
                                    <p>
                                      📊 Tu TDEE (mantenimiento): ~{tdeeReal} kcal/día
                                      {superavitBulk > 0 && ` (+${superavitBulk} en bulk)`}
                                    </p>
                                    <p>
                                      {sexo === "femenino" && "⚡ Ajustado para metabolismo femenino. "}
                                      {edad > 35 && "⚡ Ajustado para tu edad. "}
                                      {esAtletico && "⚡ Progresión de avanzado. "}
                                      Intensidad: {intensidad.toUpperCase()}
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
                                  <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                                    <div className="flex justify-between items-center">
                                      <div>
                                        <p className="text-xs opacity-70">Fase LEAN BULK continua</p>
                                        <p className="font-bold text-emerald-300">{mesesTotal} meses</p>
                                      </div>
                                      <div className="text-right">
                                        <p className="text-xs opacity-70">Ganancia/mes</p>
                                        <p className="font-medium">~{velocidadLeanBulk.toFixed(1)} kg</p>
                                      </div>
                                    </div>
                                    <p className="text-xs opacity-70 mt-1">{pesoActual}kg → {pesoObjetivo}kg</p>
                                    <p className="text-xs opacity-60">~{caloriasLeanBulk} kcal/día</p>
                                  </div>
                                  
                                  <div className="p-2 rounded-lg bg-white/5">
                                    <div className="flex justify-between items-center">
                                      <div>
                                        <p className="text-xs opacity-70">Peso a ganar</p>
                                        <p className="font-bold">{diferencia} kg</p>
                                      </div>
                                      <div className="text-right">
                                        <p className="text-xs opacity-70">Músculo estimado</p>
                                        <p className="font-bold text-emerald-400">~{Math.round(diferencia * 0.9)} kg</p>
                                      </div>
                                    </div>
                                  </div>
                                  
                                  <div className="text-xs opacity-60 space-y-1">
                                    <p>
                                      📊 Tu TDEE (mantenimiento): ~{tdeeReal} kcal/día (+{superavitLeanBulk} superávit controlado)
                                    </p>
                                    <p>
                                      💎 Lean bulk minimiza grasa (~10% vs ~20% en bulk tradicional).
                                      {sexo === "femenino" && " Ajustado para metabolismo femenino."}
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
                                      <p className="text-xs opacity-70">Tiempo estimado</p>
                                      <p className="font-bold text-lg">{mesesTotal} meses</p>
                                    </div>
                                    <div className="text-right">
                                      <p className="text-xs opacity-70">Ganancia/mes</p>
                                      <p className="font-medium">~{velocidadGanancia.toFixed(1)} kg</p>
                                    </div>
                                  </div>
                                  <p className="text-xs opacity-60">
                                    Con intensidad {intensidad.toUpperCase()}.
                                    {sexo === "femenino" && " Ajustado para metabolismo femenino."}
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
                <label className="flex flex-col gap-1">
                  <span className="text-sm opacity-80">
                    Tipo de dieta (opcional)
                  </span>
                  <select 
                    className="rounded-xl bg-white/5 px-3 py-2 text-white" 
                    style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)', color: '#e6f6ff' }}
                    value={form.tipoDieta || "estandar"} 
                    onChange={(e) => update("tipoDieta", e.target.value === "estandar" ? undefined : (e.target.value as TipoDieta))}
                  >
                    <optgroup label="Dietas básicas">
                      <option value="estandar">Estándar (sin restricciones)</option>
                      <option value="mediterranea">Mediterránea (Rica en aceite de oliva y pescados)</option>
                      <option value="vegetariana">Vegetariana (Sin carnes ni pescados)</option>
                      <option value="vegana">Vegana (Solo alimentos de origen vegetal)</option>
                      <option value="low_carb">Low Carb (Reducción moderada de carbohidratos)</option>
                    </optgroup>
                    <optgroup label="🌟 Dietas avanzadas">
                      <option value="antiinflamatoria">🔥 Antiinflamatoria - Reduce inflamación crónica y optimiza recuperación</option>
                      <option value="atkins">⚡ Atkins - Baja en carbohidratos con fases progresivas avanzadas</option>
                      <option value="clinica_mayo">🏥 Clínica Mayo - Programa de hábitos saludables con control de porciones</option>
                      <option value="dash">❤️ DASH - Diseñada para reducir presión arterial y salud cardiovascular</option>
                      <option value="flexitariana">🌱 Flexitariana - Principalmente vegetal con flexibilidad estratégica</option>
                      <option value="keto">💪 Keto - Alta en grasas, muy baja en carbohidratos, optimización avanzada</option>
                      <option value="mind">🧠 MIND - Mediterránea + DASH enfocada en salud cerebral y prevención</option>
                      <option value="menopausia">🌸 Menopausia - Adaptada específicamente para mujeres en transición hormonal</option>
                      <option value="paleo">🏃 Paleo - Alimentos naturales sin procesar, enfoque ancestral</option>
                      <option value="pescatariana">🐟 Pescatariana - Vegetariana con pescados y mariscos estratégicos</option>
                      <option value="sin_gluten">🌾 Sin Gluten - Planificación avanzada para celíacos y sensibilidad</option>
                      <option value="tlc">📊 TLC - Cambios terapéuticos para reducir colesterol de manera precisa</option>
                    </optgroup>
                  </select>
              </label>
                {(() => {
                  const dietaSeleccionada = form.tipoDieta || "estandar";
                  return dietaDescripciones[dietaSeleccionada] && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                      className="mt-2 rounded-lg bg-white/5 border border-white/10 p-3 w-full"
                    >
                      <div className="flex items-start gap-2 w-full">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          className="h-4 w-4 opacity-70 mt-0.5 flex-shrink-0"
                        >
                          <path d="M12 2a10 10 0 1 0 10 10A10.011 10.011 0 0 0 12 2Zm.75 15h-1.5v-1.5h1.5Zm1.971-6.279-.675.693A3.375 3.375 0 0 0 12.75 14.25h-1.5a4.875 4.875 0 0 1 1.425-3.45l.93-.936a1.875 1.875 0 1 0-3.195-1.326h-1.5a3.375 3.375 0 1 1 6.03 1.283Z" />
                        </svg>
                        <p className="text-xs leading-relaxed opacity-90 break-words overflow-wrap-anywhere flex-1 min-w-0">
                          {dietaDescripciones[dietaSeleccionada]}
                        </p>
                      </div>
                    </motion.div>
                  );
                })()}
              </div>
              <div className="flex flex-col gap-1">
                <label className="flex flex-col gap-1">
                  <span className="text-sm opacity-80">
                    Intensidad
                    {esObjetivoBasico && (
                      <span className="text-xs opacity-60 ml-1">(Fija en Leve para objetivos básicos)</span>
                    )}
                  </span>
                  <select 
                    className="rounded-xl bg-white/5 px-3 py-2 cursor-pointer text-white"
                    style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)', color: '#e6f6ff' }}
                    value={form.intensidad} 
                    onChange={(e) => update("intensidad", e.target.value as UserInput["intensidad"])}
                  >
                    <option value="leve">Leve - Cambios graduales y sostenibles</option>
                    <optgroup label="🌟 Intensidades avanzadas">
                      <option value="moderada" >
                        Moderada - Balance entre resultados y sostenibilidad
                      </option>
                      <option value="intensa" >
                        Intensa - Resultados más rápidos, mayor disciplina
                      </option>
                    </optgroup>
                    <optgroup label="🔥 ULTRA - Para Atletas">
                      <option value="ultra" >
                        🔥 Ultra - Máximo rendimiento, solo atletas comprometidos
                      </option>
                    </optgroup>
                </select>
              </label>
                {intensidadDescripciones[form.intensidad] && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className="mt-2 rounded-lg bg-white/5 border border-white/10 p-2.5 w-full"
                  >
                    <div className="flex items-start gap-2 w-full">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        className="h-3.5 w-3.5 opacity-70 mt-0.5 flex-shrink-0"
                      >
                        <path d="M12 2a10 10 0 1 0 10 10A10.011 10.011 0 0 0 12 2Zm.75 15h-1.5v-1.5h1.5Zm1.971-6.279-.675.693A3.375 3.375 0 0 0 12.75 14.25h-1.5a4.875 4.875 0 0 1 1.425-3.45l.93-.936a1.875 1.875 0 1 0-3.195-1.326h-1.5a3.375 3.375 0 1 1 6.03 1.283Z" />
                      </svg>
                      <p className="text-xs leading-relaxed opacity-90 break-words overflow-wrap-anywhere flex-1 min-w-0">
                        {intensidadDescripciones[form.intensidad]}
                      </p>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="mt-6 grid grid-cols-1 gap-4">
              {/* 1. Preferencias */}
              <label className="flex flex-col gap-1">
                <span className="text-sm opacity-80">Preferencias (coma separadas)</span>
                <input 
                  className="rounded-xl bg-white/5 px-3 py-2" 
                  value={preferenciasTexto} 
                  onChange={(e) => {
                    setPreferenciasTexto(e.target.value);
                  }}
                  onBlur={(e) => {
                    const array = e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean);
                    update("preferencias", array);
                  }}
                  placeholder="ej: pollo, avena, salmón" 
                />
              </label>
              
              {/* 3. Restricciones */}
              <label className="flex flex-col gap-1">
                <span className="text-sm opacity-80">Restricciones (coma separadas)</span>
                <input 
                  className="rounded-xl bg-white/5 px-3 py-2" 
                  value={restriccionesTexto} 
                  onChange={(e) => {
                    setRestriccionesTexto(e.target.value);
                  }}
                  onBlur={(e) => {
                    const array = e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean);
                    update("restricciones", array);
                  }}
                  placeholder="ej: gluten, lácteos, cerdo" 
                />
              </label>
              
              {/* 4. Patologías */}
              <label className="flex flex-col gap-1">
                <span className="text-sm opacity-80">Patologías (coma separadas)</span>
                <input 
                  className="rounded-xl bg-white/5 px-3 py-2" 
                  value={patologiasTexto} 
                  onChange={(e) => {
                    setPatologiasTexto(e.target.value);
                  }}
                  onBlur={(e) => {
                    const array = e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean);
                    update("patologias", array);
                  }}
                  placeholder="ej: hígado graso, intolerancia a la lactosa, diabetes tipo 2" 
                />
                <p className="text-xs opacity-60 mt-1">
                  Indica condiciones médicas relevantes para ajustar el plan nutricional
                </p>
              </label>

              {/* 5. Dolores o lesiones */}
              <label className="flex flex-col gap-1">
                <span className="text-sm opacity-80 flex items-center gap-2">
                  Dolores, lesiones o molestias (coma separadas)
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
                  className="rounded-xl bg-white/5 px-3 py-2"
                  value={doloresLesionesTexto}
                  onChange={(e) => setDoloresLesionesTexto(e.target.value)}
                  onBlur={(e) => {
                    const array = e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean);
                    update("doloresLesiones", array);
                  }}
                  placeholder="ej: rodilla derecha, zona lumbar, hombro izquierdo"
                />
                <p className="text-xs opacity-60 mt-1">
                  Usamos esta información para adaptar el plan de entrenamiento y las recomendaciones de recuperación.
                </p>
              </label>

            {/* 5. Preferencia: comidas rutinarias */}
            <label className="flex items-start gap-3 mt-2">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4"
                checked={!!form.preferirRutina}
                onChange={(e) => update("preferirRutina", e.target.checked)}
              />
              <span className="text-sm opacity-80">
                Mantener comidas rutinarias (poca variación entre días)
                <span className="block text-xs opacity-60 mt-0.5">
                  Ideal si preferís repetir comidas (p.ej., papa en déficit o pasta en volumen) para no pensar qué toca cada día. Lo podés editar luego.
                </span>
              </span>
            </label>
            </div>
          )}

          <div className="mt-8 flex items-center justify-between">
            {step > 1 && (
              <button
                className="rounded-full border border-white/15 px-5 py-2 text-sm opacity-90 hover:opacity-100"
                onClick={() => setStep((s) => Math.max(1, s - 1))}
              >
                Atrás
              </button>
            )}
            {step === 1 && <div />}
            {step < 3 ? (
              <button
                className="rounded-full px-5 py-2 text-sm font-medium text-white"
                style={{
                  background:
                    "linear-gradient(90deg, var(--brand-start), var(--brand-mid), var(--brand-end))",
                }}
                onClick={() => {
                  // Validar campos requeridos antes de avanzar
                  if (step === 1) {
                    let hasError = false;
                    
                    if (!form.nombre.trim()) {
                      setNombreError("El nombre es requerido");
                      hasError = true;
                    } else {
                      setNombreError(null);
                    }
                    
                    if (!form.edad || form.edad === 0) {
                      setEdadError("La edad es requerida");
                      hasError = true;
                    } else {
                      setEdadError(null);
                    }
                    
                    if (!form.alturaCm || form.alturaCm === 0) {
                      setAlturaError("La altura es requerida");
                      hasError = true;
                    } else {
                      setAlturaError(null);
                    }
                    
                    if (!form.pesoKg || form.pesoKg === 0) {
                      setPesoError("El peso es requerido");
                      hasError = true;
                    } else {
                      setPesoError(null);
                    }
                    
                    if (hasError) {
                      return;
                    }
                  }
                  setStep((s) => Math.min(3, s + 1));
                }}
              >
                Siguiente
              </button>
            ) : (
              <>
                <button
                  className="rounded-full px-5 py-2 text-sm font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: "linear-gradient(90deg, var(--brand-start), var(--brand-mid), var(--brand-end))",
                  }}
                  onClick={handleGeneratePlan}
                  disabled={loading}
                >
                  {loading ? "Generando..." : "Generar mi plan gratis"}
                </button>
              </>
            )}
          </div>
          {error ? (
            <p className="mt-3 text-sm text-red-300">{error}</p>
          ) : null}
        </motion.div>
                </div>
              </div>
              
      {/* Overlay oscuro con spinner y tiempo estimado */}
      {loading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="fixed inset-0 bg-gradient-to-br from-black/95 via-blue-950/90 to-black/95 backdrop-blur-md z-[9999] flex flex-col items-center justify-center"
        >
          <div className="flex flex-col items-center gap-10">
            {/* Logo animado con estilo fitness */}
            <div className="relative w-32 h-32">
              {/* Anillo exterior pulsante */}
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-blue-500/30"
                animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0.1, 0.3] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              />
              
              {/* Anillo de progreso giratorio */}
              <motion.div
                className="absolute inset-2"
                animate={{ rotate: 360 }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              >
                <svg className="w-full h-full" viewBox="0 0 100 100">
                  <defs>
                    <linearGradient id="spinnerGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#3B82F6" />
                      <stop offset="50%" stopColor="#06B6D4" />
                      <stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    fill="none"
                    stroke="url(#spinnerGradient)"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray="200 100"
                  />
                          </svg>
              </motion.div>
              
              {/* Icono central - Manzana de FitPlan */}
              <motion.div
                className="absolute inset-0 flex items-center justify-center"
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              >
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/30">
                  <FaAppleAlt className="text-white text-3xl" />
                      </div>
              </motion.div>
                </div>
            
            {/* Texto de generación */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-center space-y-3"
            >
              <h3 className="text-white text-xl font-semibold tracking-wide">
                Generando tu plan personalizado
              </h3>
              <p className="text-sm text-white/80 max-w-md mx-auto">
                Este proceso puede tardar hasta <span className="font-semibold text-blue-300">1 minuto</span>. 
                No cierres esta ventana ni recargues la página mientras preparamos tu plan.
              </p>
              <motion.div 
                className="flex items-center justify-center gap-1"
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                <span className="w-2 h-2 rounded-full bg-blue-400"></span>
              </motion.div>
            </motion.div>
            
            {/* Tiempo estimado */}
            {estimatedTimeRemaining !== null && estimatedTimeRemaining > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="px-6 py-3 rounded-full bg-white/5 border border-white/10"
              >
                <p className="text-white/70 text-sm">
                  Tiempo restante: <span className="text-blue-400 font-semibold ml-1">{estimatedTimeRemaining}s</span>
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
