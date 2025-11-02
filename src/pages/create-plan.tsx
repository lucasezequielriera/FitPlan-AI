import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import { usePlanStore } from "@/store/planStore";
import { useAuthStore } from "@/store/authStore";
import { getAuthSafe, getDbSafe } from "@/lib/firebase";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import type { UserInput, Goal, TipoDieta, Intensidad } from "@/types/plan";
import Navbar from "@/components/Navbar";

const objetivoDescripciones: Record<Goal, string> = {
  perder_grasa: "Reduce tu porcentaje de grasa corporal mediante un déficit calórico controlado. Ideal si buscás perder peso de forma saludable, mejorando tu composición corporal y salud general. El plan incluirá un déficit moderado de calorías mientras mantiene tus músculos.",
  
  mantener: "Mantiene tu peso y composición corporal actuales. Perfecto si ya estás en un peso saludable y querés estabilizar tus hábitos alimenticios. El plan te ayudará a mantener tu condición física sin cambios significativos en tu peso.",
  
  ganar_masa: "Aumenta tu masa muscular mediante un superávit calórico estratégico junto con entrenamiento de fuerza. Ideal si buscás ganar peso principalmente en forma de músculo. El plan te proporcionará las calorías y proteínas necesarias para construir músculo de forma eficiente.",
  
  recomposicion: "Transforma tu cuerpo perdiendo grasa mientras ganás músculo al mismo tiempo. Este es el objetivo más desafiante pero también el más efectivo a largo plazo. Ideal para personas con experiencia en entrenamiento que buscan cambiar su composición corporal sin cambios drásticos en el peso.",
  
  definicion: "Reduce al máximo la grasa corporal manteniendo la mayor cantidad de músculo posible. Típicamente usado después de una fase de volumen para mostrar toda la masa muscular ganada. Requiere precisión en las calorías y macronutrientes para preservar el músculo.",
  
  volumen: "Fase de ganancia de masa muscular con un enfoque en maximizar el crecimiento. Incluye un superávit calórico más generoso para apoyar el entrenamiento intenso y la recuperación. Ideal para etapas de construcción muscular donde el objetivo principal es ganar tamaño y fuerza.",
  
  corte: "Reducción agresiva de grasa corporal para alcanzar un porcentaje muy bajo. Usado típicamente antes de competencias o eventos. Requiere disciplina estricta y monitoreo cuidadoso. No es recomendable mantener por períodos prolongados sin supervisión profesional.",
  
  mantenimiento_avanzado: "Optimiza tu nutrición para mantener tu composición corporal ideal mientras maximizas el rendimiento. Para personas experimentadas que buscan mantener un estado físico avanzado con precisión nutricional. Incluye estrategias avanzadas de timing de nutrientes y distribución."
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
  intensa: "Cambios más agresivos para resultados más rápidos. Déficit o superávit calórico alto (600-800 kcal/día). Requiere mayor disciplina y puede ser más difícil de mantener a largo plazo."
};


export default function CreatePlan() {
  const router = useRouter();
  const { setUser, setPlan, setPlanId } = usePlanStore();
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
    edad: 25,
    pesoKg: 70,
    alturaCm: 175,
    sexo: "masculino",
    actividad: 3, // días de actividad física por semana (0-7)
    objetivo: "mantener",
    intensidad: "leve", // Objetivos básicos siempre usan intensidad leve
    restricciones: [],
    preferencias: [],
    patologias: [],
    duracionDias: 30, // Siempre 30 días (plan mensual)
    cinturaCm: undefined,
    cuelloCm: undefined,
    caderaCm: undefined,
    atletico: false,
  });
  const [userDataLoaded, setUserDataLoaded] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [canCreatePlan, setCanCreatePlan] = useState(true);
  const [planLimitMessage, setPlanLimitMessage] = useState<string | null>(null);

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
          setForm((prev) => ({
            ...prev,
            nombre: userData.nombre || prev.nombre,
            edad: userData.edad || prev.edad,
            alturaCm: userData.alturaCm || prev.alturaCm,
            sexo: userData.sexo || prev.sexo,
            cinturaCm: userData.cinturaCm ?? prev.cinturaCm,
            cuelloCm: userData.cuelloCm ?? prev.cuelloCm,
            caderaCm: userData.caderaCm ?? prev.caderaCm,
            atletico: userData.atletico ?? prev.atletico,
          }));
          
          // Verificar estado premium
          userPremium = userData.premium === true;
          setIsPremium(userPremium);
        }

        // Verificar cantidad de planes existentes
        const q = query(
          collection(db, "planes"),
          where("userId", "==", auth.currentUser.uid)
        );
        const querySnapshot = await getDocs(q);
        const planCount = querySnapshot.size;

        // Si no es premium y ya tiene 1 plan, no puede crear más
        if (!userPremium && planCount >= 1) {
          setCanCreatePlan(false);
          setPlanLimitMessage("Ya tienes un plan creado. Los usuarios gratuitos solo pueden crear 1 plan. ¡Actualiza a Premium para crear planes ilimitados!");
        } else {
          setCanCreatePlan(true);
          setPlanLimitMessage(null);
        }

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

  // Determinar si el objetivo es básico o premium
  const esObjetivoBasico = form.objetivo === "perder_grasa" || form.objetivo === "mantener" || form.objetivo === "ganar_masa";

  // Asegurar que si no es premium, la intensidad sea leve
  useEffect(() => {
    if (userDataLoaded && !isPremium && form.intensidad !== "leve" && !esObjetivoBasico) {
      setForm((prev) => ({ ...prev, intensidad: "leve" }));
    }
  }, [isPremium, userDataLoaded, esObjetivoBasico, form.intensidad]);

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
      // Si el usuario no es premium y selecciona moderada o intensa, resetear a leve
      if (key === "intensidad" && !isPremium && (value === "moderada" || value === "intensa")) {
        nuevo.intensidad = "leve";
        alert("Las opciones Moderada e Intensa requieren plan Premium. Se ha configurado en Leve.");
      }
      return nuevo;
    });
  }

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  // Estados temporales para inputs de texto (restricciones/preferencias)
  const [restriccionesTexto, setRestriccionesTexto] = useState(form.restricciones?.join(", ") || "");
  const [preferenciasTexto, setPreferenciasTexto] = useState(form.preferencias?.join(", ") || "");
  const [patologiasTexto, setPatologiasTexto] = useState(form.patologias?.join(", ") || "");
  
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
  }, [form.restricciones?.length, form.preferencias?.length, form.patologias?.length]); // eslint-disable-line react-hooks/exhaustive-deps

  async function onSubmit() {
    // Verificar si puede crear plan antes de continuar
    if (!canCreatePlan) {
      alert("Ya tienes un plan creado. Los usuarios gratuitos solo pueden crear 1 plan. ¡Actualiza a Premium para crear planes ilimitados!");
      router.push("/dashboard");
      return;
    }

    // Procesar restricciones y preferencias si hay texto pendiente
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
    
    setLoading(true);
    setError(null);
    setProgress(0);
    // Progreso asintótico: avanza rápido al principio y se frena cerca de 95%
    let p = 0;
    const timer = setInterval(() => {
      p = p + Math.max(1, Math.round((95 - p) * 0.08));
      p = Math.min(p, 95);
      setProgress(p);
    }, 250);
    try {
      const resp = await fetch("/api/generatePlan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formFinal),
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => null);
        const combined = data?.error && data?.detail ? `${data.error}: ${data.detail}` : (data?.error || data?.detail);
        const msg = combined || `No se pudo generar el plan (HTTP ${resp.status})`;
        // Log extendido para diagnóstico
        console.error('generatePlan error', { status: resp.status, data });
        throw new Error(msg);
      }
      const plan = await resp.json();
      
      // Guardar perfil del usuario y plan automáticamente desde el cliente
      try {
        const auth = getAuthSafe();
        const db = await import("@/lib/firebase").then(m => m.getDbSafe());
        
        if (auth?.currentUser && db) {
          const userId = auth.currentUser.uid;
          
          // Guardar perfil del usuario directamente desde el cliente
          try {
            const { collection, doc, setDoc, getDoc, serverTimestamp } = await import("firebase/firestore");
            const userRef = doc(collection(db, "usuarios"), userId);
            const userDoc = await getDoc(userRef);
            
            // Solo incluir campos que tienen valores válidos
            const userData: any = {
              nombre: formFinal.nombre,
              sexo: formFinal.sexo,
              alturaCm: Number(formFinal.alturaCm),
              edad: Number(formFinal.edad),
              updatedAt: serverTimestamp(),
            };
            
            // Agregar campos opcionales solo si tienen valores
            if (formFinal.cinturaCm !== undefined && formFinal.cinturaCm !== null) {
              userData.cinturaCm = Number(formFinal.cinturaCm);
            }
            if (formFinal.cuelloCm !== undefined && formFinal.cuelloCm !== null) {
              userData.cuelloCm = Number(formFinal.cuelloCm);
            }
            if (formFinal.caderaCm !== undefined && formFinal.caderaCm !== null) {
              userData.caderaCm = Number(formFinal.caderaCm);
            }
            if (formFinal.atletico !== undefined) {
              userData.atletico = Boolean(formFinal.atletico);
            }
            
            if (!userDoc.exists()) {
              await setDoc(userRef, {
                ...userData,
                createdAt: serverTimestamp(),
              });
            } else {
              await setDoc(userRef, userData, { merge: true });
            }
            console.log("Perfil guardado exitosamente");
          } catch (profileError) {
            console.error("Error al guardar perfil del usuario:", profileError);
          }
          
          // Guardar plan automáticamente desde el cliente
          try {
            const { collection, addDoc, serverTimestamp } = await import("firebase/firestore");
            
            // Limpiar datos: eliminar campos undefined y null
            const cleanUser = Object.fromEntries(
              Object.entries(formFinal).filter(([_, v]) => v !== undefined && v !== null)
            );
            
            const cleanPlan = JSON.parse(JSON.stringify({ plan, user: cleanUser })); // Eliminar undefined recursivamente
            
            const docRef = await addDoc(collection(db, "planes"), {
              userId,
              plan: cleanPlan,
              createdAt: serverTimestamp(),
            });
            console.log("Plan guardado automáticamente con ID:", docRef.id);
            // Guardar el planId en el store para que se pueda actualizar después
            setPlanId(docRef.id);
          } catch (savePlanError) {
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
      clearInterval(timer);
      setProgress(100);
    router.push("/plan");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Ocurrió un error";
      setError(message);
    } finally {
      setTimeout(() => setProgress(0), 600);
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen">
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
                  <span className="text-sm opacity-80">Nombre</span>
                  <input className="rounded-xl bg-white/5 px-3 py-2 outline-none" value={form.nombre} onChange={(e) => update("nombre", e.target.value)} placeholder="Tu nombre" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-sm opacity-80">Sexo</span>
                  <select className="rounded-xl bg-white/5 px-3 py-2" value={form.sexo} onChange={(e) => update("sexo", e.target.value as "masculino" | "femenino")}>
                    <option value="masculino">Masculino</option>
                    <option value="femenino">Femenino</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-sm opacity-80">Edad</span>
                  <input type="number" className="rounded-xl bg-white/5 px-3 py-2 outline-none" value={form.edad} onChange={(e) => update("edad", Number(e.target.value))} />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-sm opacity-80">Altura (cm)</span>
                  <input type="number" className="rounded-xl bg-white/5 px-3 py-2 outline-none" value={form.alturaCm} onChange={(e) => update("alturaCm", Number(e.target.value))} />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-sm opacity-80">Peso (kg)</span>
                  <input type="number" className="rounded-xl bg-white/5 px-3 py-2 outline-none" value={form.pesoKg} onChange={(e) => update("pesoKg", Number(e.target.value))} />
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
                <label className="mt-3 flex items-center gap-2 text-sm">
                  <input type="checkbox" className="h-4 w-4" checked={!!form.atletico} onChange={(e) => update("atletico", e.target.checked)} />
                  <span className="opacity-80">Perfil atlético / mayor masa muscular</span>
                </label>
              </div>
            </>
          )}

          {step === 2 && (
            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-1 md:col-span-2">
              <label className="flex flex-col gap-1">
                <span className="text-sm opacity-80">Objetivo</span>
                  <select className="rounded-xl bg-white/5 px-3 py-2" value={form.objetivo} onChange={(e) => update("objetivo", e.target.value as UserInput["objetivo"])}>
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
              </div>
              <div className="flex flex-col gap-1 md:col-span-2">
                <label className="flex flex-col gap-1">
                  <span className="text-sm opacity-80">
                    Tipo de dieta (opcional)
                    {!isPremium && <span className="text-xs opacity-60 ml-1 block mt-0.5">Las dietas premium requieren suscripción</span>}
                  </span>
                  <select 
                    className="rounded-xl bg-white/5 px-3 py-2" 
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
                    <optgroup label={isPremium ? "🌟 PREMIUM - Dietas avanzadas (Activas)" : "🌟 PREMIUM - Dietas avanzadas (Desbloquea con suscripción)"}>
                      <option value="antiinflamatoria" disabled={!isPremium}>🔥 Antiinflamatoria - Reduce inflamación crónica y optimiza recuperación</option>
                      <option value="atkins" disabled={!isPremium}>⚡ Atkins - Baja en carbohidratos con fases progresivas avanzadas</option>
                      <option value="clinica_mayo" disabled={!isPremium}>🏥 Clínica Mayo - Programa de hábitos saludables con control de porciones</option>
                      <option value="dash" disabled={!isPremium}>❤️ DASH - Diseñada para reducir presión arterial y salud cardiovascular</option>
                      <option value="flexitariana" disabled={!isPremium}>🌱 Flexitariana - Principalmente vegetal con flexibilidad estratégica</option>
                      <option value="keto" disabled={!isPremium}>💪 Keto - Alta en grasas, muy baja en carbohidratos, optimización avanzada</option>
                      <option value="mind" disabled={!isPremium}>🧠 MIND - Mediterránea + DASH enfocada en salud cerebral y prevención</option>
                      <option value="menopausia" disabled={!isPremium}>🌸 Menopausia - Adaptada específicamente para mujeres en transición hormonal</option>
                      <option value="paleo" disabled={!isPremium}>🏃 Paleo - Alimentos naturales sin procesar, enfoque ancestral</option>
                      <option value="pescatariana" disabled={!isPremium}>🐟 Pescatariana - Vegetariana con pescados y mariscos estratégicos</option>
                      <option value="sin_gluten" disabled={!isPremium}>🌾 Sin Gluten - Planificación avanzada para celíacos y sensibilidad</option>
                      <option value="tlc" disabled={!isPremium}>📊 TLC - Cambios terapéuticos para reducir colesterol de manera precisa</option>
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
                    {!isPremium && !esObjetivoBasico && (
                      <span className="text-xs opacity-60 ml-1">(Leve disponible. Actualiza a Premium para Moderada e Intensa)</span>
                    )}
                  </span>
                  <select 
                    className="rounded-xl bg-white/5 px-3 py-2 cursor-pointer"
                    value={form.intensidad} 
                    onChange={(e) => update("intensidad", e.target.value as UserInput["intensidad"])}
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
                onClick={() => setStep((s) => Math.min(3, s + 1))}
              >
                Siguiente
              </button>
            ) : (
              <>
                {!canCreatePlan && planLimitMessage && (
                  <div className="mb-4 p-4 rounded-xl bg-yellow-500/20 border border-yellow-500/30 text-yellow-300 text-sm">
                    <p className="mb-3">{planLimitMessage}</p>
                    <button
                      onClick={() => router.push("/dashboard")}
                      className="px-4 py-2 rounded-lg bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-medium transition-all"
                    >
                      Ver Plan Premium
                    </button>
                  </div>
                )}
                <button
                  className="rounded-full px-5 py-2 text-sm font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: canCreatePlan
                      ? "linear-gradient(90deg, var(--brand-start), var(--brand-mid), var(--brand-end))"
                      : "linear-gradient(90deg, #666, #666)",
                  }}
                  onClick={onSubmit}
                  disabled={loading || !canCreatePlan}
                >
                  {loading ? "Generando..." : "Generar mi plan"}
                </button>
              </>
            )}
          </div>
          {loading ? (
            <div className="mt-3">
              <div className="h-2 w-full rounded-full bg-white/10">
                <div
                  className="h-2 rounded-full"
                  style={{
                    width: `${progress}%`,
                    background: "linear-gradient(90deg, var(--brand-start), var(--brand-mid), var(--brand-end))",
                    transition: "width 200ms ease",
                  }}
                />
              </div>
              <p className="mt-1 text-xs opacity-80">Generando plan: {progress}%</p>
            </div>
          ) : null}
          {error ? (
            <p className="mt-3 text-sm text-red-300">{error}</p>
          ) : null}
        </motion.div>
        </div>
      </div>
    </div>
  );
}
