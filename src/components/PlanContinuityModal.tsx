import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/router";
import type { UserInput, Goal, PlanAIResponse } from "@/types/plan";

interface PlanContinuityModalProps {
  isOpen: boolean;
  onClose: () => void;
  planData: {
    id: string;
    plan: PlanAIResponse;
    user: UserInput;
    createdAt: Date;
  };
  registrosPeso: Array<{ fecha: string; peso: number }>;
  userId: string;
}

interface AnalysisResult {
  analisis: {
    cumplioObjetivo: boolean;
    progresoGeneral: "excelente" | "bueno" | "moderado" | "bajo";
    puntosPositivos: string[];
    areasMejora: string[];
    resumen: string;
  };
  sugerenciaContinuidad: {
    objetivoRecomendado: Goal;
    razonObjetivo: string;
    ajustesCalorias: string;
    ajustesMacros: {
      proteinas: "aumentar" | "mantener" | "reducir";
      carbohidratos: "aumentar" | "mantener" | "reducir";
      grasas: "aumentar" | "mantener" | "reducir";
    };
    ajustesEntrenamiento: {
      diasGym: "aumentar" | "mantener" | "reducir";
      intensidad: "aumentar" | "mantener" | "reducir";
      recomendacion: string;
    };
    duracionRecomendada: number;
    mensajeMotivacional: string;
  };
  objetivosAlternativos: Array<{
    objetivo: Goal;
    razon: string;
    adecuadoPara: string;
  }>;
}

type Step = "input" | "analyzing" | "suggestion" | "generating" | "complete";

export default function PlanContinuityModal({ isOpen, onClose, planData, registrosPeso, userId }: PlanContinuityModalProps) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("input");
  const [error, setError] = useState<string | null>(null);
  
  // Datos de finalización del plan
  const [pesoFinal, setPesoFinal] = useState<string>("");
  const [cinturaFinal, setCinturaFinal] = useState<string>("");
  const [adherenciaComida, setAdherenciaComida] = useState<string>(">80%");
  const [adherenciaEntreno, setAdherenciaEntreno] = useState<string>(">80%");
  const [energia, setEnergia] = useState<string>("normal");
  const [recuperacion, setRecuperacion] = useState<string>("normal");
  const [lesionesNuevas, setLesionesNuevas] = useState<string>("");
  const [comentarios, setComentarios] = useState<string>("");
  
  // Análisis y sugerencia
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [objetivoSeleccionado, setObjetivoSeleccionado] = useState<Goal | null>(null);
  const [usarSugerencia, setUsarSugerencia] = useState<boolean>(true);

  // Resetear al abrir
  useEffect(() => {
    if (isOpen) {
      setStep("input");
      setError(null);
      setAnalysis(null);
      setObjetivoSeleccionado(null);
      setUsarSugerencia(true);
      
      // Pre-rellenar peso final si hay registros recientes
      if (registrosPeso && registrosPeso.length > 0) {
        const ultimoPeso = registrosPeso.sort((a, b) => b.fecha.localeCompare(a.fecha))[0];
        setPesoFinal(ultimoPeso.peso.toString());
      } else {
        setPesoFinal(planData.user.pesoKg.toString());
      }
      
      setCinturaFinal(planData.user.cinturaCm?.toString() || "");
    }
  }, [isOpen, registrosPeso, planData.user]);

  const handleAnalyze = async () => {
    if (!pesoFinal || isNaN(parseFloat(pesoFinal))) {
      setError("Por favor ingresa tu peso final");
      return;
    }

    setStep("analyzing");
    setError(null);

    try {
      const analysisData = {
        pesoInicial: planData.user.pesoKg,
        pesoFinal: parseFloat(pesoFinal),
        cinturaInicial: planData.user.cinturaCm,
        cinturaFinal: cinturaFinal ? parseFloat(cinturaFinal) : undefined,
        objetivo: planData.user.objetivo,
        duracionDias: 30,
        adherenciaComida,
        adherenciaEntreno,
        energia,
        recuperacion,
        lesionesNuevas: lesionesNuevas || undefined,
        comentarios: comentarios || undefined,
        caloriasObjetivo: planData.plan.calorias_diarias,
        macros: planData.plan.macros,
        diasGym: planData.user.diasGym,
        diasCardio: planData.user.diasCardio,
        intensidad: planData.user.intensidad,
        edad: planData.user.edad,
        sexo: planData.user.sexo,
        alturaCm: planData.user.alturaCm,
        tipoDieta: planData.user.tipoDieta,
        restricciones: planData.user.restricciones,
        preferencias: planData.user.preferencias,
        patologias: planData.user.patologias,
        doloresLesiones: planData.user.doloresLesiones,
      };

      const response = await fetch("/api/analyzePlanCompletion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(analysisData),
      });

      if (!response.ok) {
        throw new Error("Error al analizar el plan");
      }

      const result: AnalysisResult = await response.json();
      setAnalysis(result);
      setObjetivoSeleccionado(result.sugerenciaContinuidad.objetivoRecomendado);
      setStep("suggestion");
    } catch (err) {
      console.error("Error al analizar:", err);
      setError("No se pudo analizar el plan. Por favor intenta de nuevo.");
      setStep("input");
    }
  };

  const handleGenerateNewPlan = async () => {
    if (!analysis || !objetivoSeleccionado) return;

    setStep("generating");
    setError(null);

    try {
      // Actualizar el plan anterior con los datos finales
      const { getDbSafe } = await import("@/lib/firebase");
      const { doc, updateDoc, serverTimestamp } = await import("firebase/firestore");
      
      const db = getDbSafe();
      if (db) {
        const planRef = doc(db, "planes", planData.id);
        await updateDoc(planRef, {
          datosFinalizacion: {
            pesoFinal: parseFloat(pesoFinal),
            cinturaFinal: cinturaFinal ? parseFloat(cinturaFinal) : null,
            adherenciaComida,
            adherenciaEntreno,
            energia,
            recuperacion,
            lesionesNuevas: lesionesNuevas || null,
            comentarios: comentarios || null,
            fechaFinalizacion: new Date().toISOString(),
          },
          analisis: analysis.analisis,
          completado: true,
          updatedAt: serverTimestamp(),
        });
      }

      // Preparar datos para el nuevo plan
      const nuevoUserInput: UserInput = {
        ...planData.user,
        pesoKg: parseFloat(pesoFinal),
        cinturaCm: cinturaFinal ? parseFloat(cinturaFinal) : planData.user.cinturaCm,
        objetivo: objetivoSeleccionado,
        // Actualizar lesiones si hay nuevas
        doloresLesiones: lesionesNuevas 
          ? [...(planData.user.doloresLesiones || []), lesionesNuevas]
          : planData.user.doloresLesiones,
      };

      // Aplicar ajustes recomendados si se usa la sugerencia
      if (usarSugerencia) {
        // Los ajustes se aplicarán en generatePlan.ts basados en el análisis previo
        // Por ahora solo ajustamos días de gym si es necesario
        const ajusteGym = analysis.sugerenciaContinuidad.ajustesEntrenamiento.diasGym;
        if (ajusteGym === "aumentar" && nuevoUserInput.diasGym) {
          nuevoUserInput.diasGym = Math.min(7, nuevoUserInput.diasGym + 1);
        } else if (ajusteGym === "reducir" && nuevoUserInput.diasGym) {
          nuevoUserInput.diasGym = Math.max(2, nuevoUserInput.diasGym - 1);
        }
      }

      // Generar el nuevo plan
      const planResponse = await fetch("/api/generatePlan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nuevoUserInput),
      });

      if (!planResponse.ok) {
        throw new Error("Error al generar el nuevo plan");
      }

      const nuevoPlan: PlanAIResponse = await planResponse.json();

      // Guardar el nuevo plan
      const saveResponse = await fetch("/api/savePlan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          plan: {
            plan: nuevoPlan,
            user: nuevoUserInput,
          },
          planAnteriorId: planData.id, // Referencia al plan anterior
        }),
      });

      if (!saveResponse.ok) {
        throw new Error("Error al guardar el nuevo plan");
      }

      const { id: nuevoPlanId } = await saveResponse.json();

      setStep("complete");

      // Redirigir al nuevo plan después de 2 segundos
      setTimeout(() => {
        router.push(`/plan?id=${nuevoPlanId}`);
      }, 2000);
    } catch (err) {
      console.error("Error al generar nuevo plan:", err);
      setError("No se pudo generar el nuevo plan. Por favor intenta de nuevo.");
      setStep("suggestion");
    }
  };

  if (!isOpen) return null;

  const objetivoLabels: Record<Goal, string> = {
    perder_grasa: "Perder grasa",
    mantener: "Mantener peso",
    ganar_masa: "Ganar masa muscular",
    recomposicion: "Recomposición corporal",
    definicion: "Definición extrema",
    volumen: "Volumen/Hipertrofia",
    corte: "Corte (preservar músculo)",
    mantenimiento_avanzado: "Mantenimiento avanzado",
    rendimiento_deportivo: "Rendimiento deportivo",
    powerlifting: "Powerlifting/Fuerza",
    resistencia: "Resistencia",
    atleta_elite: "Atleta elite",
    bulk_cut: "Bulk + Cut",
    lean_bulk: "Lean Bulk",
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
      />

      {/* Modal */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-white/10 bg-black/95 p-6 shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">
            {step === "input" && "Finalizar Plan Actual"}
            {step === "analyzing" && "Analizando resultados..."}
            {step === "suggestion" && "Sugerencia de Continuidad"}
            {step === "generating" && "Generando nuevo plan..."}
            {step === "complete" && "¡Plan generado!"}
          </h2>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white transition-colors"
            disabled={step === "analyzing" || step === "generating"}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-6 w-6"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="mb-4 p-4 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* Step 1: Input de datos finales */}
        {step === "input" && (
          <div className="space-y-4">
            <p className="text-sm opacity-70">
              Para generar tu siguiente plan personalizado, necesitamos conocer los resultados de tu plan actual.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Peso final */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Peso final (kg) <span className="text-red-400">*</span>
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={pesoFinal}
                  onChange={(e) => setPesoFinal(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ej: 75.5"
                />
                <p className="text-xs opacity-60 mt-1">
                  Peso inicial: {planData.user.pesoKg} kg
                </p>
              </div>

              {/* Cintura final (opcional) */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Cintura final (cm) <span className="opacity-50">(opcional)</span>
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={cinturaFinal}
                  onChange={(e) => setCinturaFinal(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ej: 85"
                />
              </div>
            </div>

            {/* Adherencia */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Adherencia a comidas
                </label>
                <select
                  value={adherenciaComida}
                  onChange={(e) => setAdherenciaComida(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value=">80%">Muy buena (&gt;80%)</option>
                  <option value="70-80%">Buena (70-80%)</option>
                  <option value="50-70%">Regular (50-70%)</option>
                  <option value="<50%">Baja (&lt;50%)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Adherencia a entrenamiento
                </label>
                <select
                  value={adherenciaEntreno}
                  onChange={(e) => setAdherenciaEntreno(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value=">80%">Muy buena (&gt;80%)</option>
                  <option value="70-80%">Buena (70-80%)</option>
                  <option value="50-70%">Regular (50-70%)</option>
                  <option value="<50%">Baja (&lt;50%)</option>
                </select>
              </div>
            </div>

            {/* Energía y recuperación */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Nivel de energía
                </label>
                <select
                  value={energia}
                  onChange={(e) => setEnergia(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="muy_alta">Muy alta</option>
                  <option value="alta">Alta</option>
                  <option value="normal">Normal</option>
                  <option value="baja">Baja</option>
                  <option value="muy_baja">Muy baja</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Recuperación
                </label>
                <select
                  value={recuperacion}
                  onChange={(e) => setRecuperacion(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="excelente">Excelente</option>
                  <option value="buena">Buena</option>
                  <option value="normal">Normal</option>
                  <option value="regular">Regular</option>
                  <option value="mala">Mala</option>
                </select>
              </div>
            </div>

            {/* Lesiones nuevas */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Lesiones o molestias nuevas <span className="opacity-50">(opcional)</span>
              </label>
              <input
                type="text"
                value={lesionesNuevas}
                onChange={(e) => setLesionesNuevas(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ej: Dolor de rodilla leve"
              />
            </div>

            {/* Comentarios */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Comentarios adicionales <span className="opacity-50">(opcional)</span>
              </label>
              <textarea
                value={comentarios}
                onChange={(e) => setComentarios(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Comparte tu experiencia con este plan..."
              />
            </div>

            {/* Botón analizar */}
            <button
              onClick={handleAnalyze}
              className="w-full px-6 py-3 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-medium transition-all shadow-lg"
            >
              Analizar resultados y sugerir continuidad
            </button>
          </div>
        )}

        {/* Step 2: Analyzing */}
        {step === "analyzing" && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mb-4"></div>
            <p className="text-lg font-medium mb-2">Analizando tus resultados...</p>
            <p className="text-sm opacity-70">Esto puede tomar unos segundos</p>
          </div>
        )}

        {/* Step 3: Suggestion */}
        {step === "suggestion" && analysis && (
          <div className="space-y-6">
            {/* Análisis de resultados */}
            <div className="p-4 rounded-lg bg-white/5 border border-white/10">
              <h3 className="text-lg font-semibold mb-3">📊 Análisis de Resultados</h3>
              
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm opacity-70">Progreso general:</span>
                  <span className={`font-semibold ${
                    analysis.analisis.progresoGeneral === "excelente" ? "text-green-400" :
                    analysis.analisis.progresoGeneral === "bueno" ? "text-blue-400" :
                    analysis.analisis.progresoGeneral === "moderado" ? "text-yellow-400" :
                    "text-orange-400"
                  }`}>
                    {analysis.analisis.progresoGeneral.toUpperCase()}
                  </span>
                  {analysis.analisis.cumplioObjetivo && (
                    <span className="ml-2 text-green-400">✓ Objetivo cumplido</span>
                  )}
                </div>

                <p className="text-sm opacity-90">{analysis.analisis.resumen}</p>

                {analysis.analisis.puntosPositivos.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-green-400 mb-1">✓ Puntos positivos:</p>
                    <ul className="text-sm opacity-80 space-y-1 ml-4">
                      {analysis.analisis.puntosPositivos.map((punto, idx) => (
                        <li key={idx}>• {punto}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {analysis.analisis.areasMejora.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-orange-400 mb-1">⚠ Áreas de mejora:</p>
                    <ul className="text-sm opacity-80 space-y-1 ml-4">
                      {analysis.analisis.areasMejora.map((area, idx) => (
                        <li key={idx}>• {area}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {/* Sugerencia de continuidad */}
            <div className="p-4 rounded-lg bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/30">
              <h3 className="text-lg font-semibold mb-3">🎯 Sugerencia de Continuidad</h3>
              
              <div className="space-y-3">
                <div>
                  <p className="text-sm opacity-70 mb-1">Objetivo recomendado:</p>
                  <p className="font-semibold text-lg text-blue-300">
                    {objetivoLabels[analysis.sugerenciaContinuidad.objetivoRecomendado]}
                  </p>
                  <p className="text-sm opacity-80 mt-1">
                    {analysis.sugerenciaContinuidad.razonObjetivo}
                  </p>
                </div>

                <div>
                  <p className="text-sm font-medium mb-2">Ajustes recomendados:</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="p-2 rounded bg-white/5">
                      <span className="opacity-70">Calorías: </span>
                      <span className="font-medium">{analysis.sugerenciaContinuidad.ajustesCalorias}</span>
                    </div>
                    <div className="p-2 rounded bg-white/5">
                      <span className="opacity-70">Intensidad: </span>
                      <span className="font-medium">{analysis.sugerenciaContinuidad.ajustesEntrenamiento.intensidad}</span>
                    </div>
                  </div>
                </div>

                <p className="text-sm italic opacity-90 bg-white/5 p-3 rounded">
                  "{analysis.sugerenciaContinuidad.mensajeMotivacional}"
                </p>
              </div>

              {/* Botón aceptar sugerencia */}
              <button
                onClick={() => {
                  setUsarSugerencia(true);
                  handleGenerateNewPlan();
                }}
                className="w-full mt-4 px-6 py-3 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-medium transition-all shadow-lg"
              >
                Aceptar y generar nuevo plan
              </button>
            </div>

            {/* Objetivos alternativos */}
            {analysis.objetivosAlternativos && analysis.objetivosAlternativos.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-3 opacity-70">
                  O elige otro objetivo:
                </h3>
                <div className="space-y-2">
                  {analysis.objetivosAlternativos.map((alt, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setObjetivoSeleccionado(alt.objetivo);
                        setUsarSugerencia(false);
                      }}
                      className={`w-full p-3 rounded-lg border text-left transition-all ${
                        objetivoSeleccionado === alt.objetivo && !usarSugerencia
                          ? "border-cyan-500 bg-cyan-500/10"
                          : "border-white/10 bg-white/5 hover:bg-white/10"
                      }`}
                    >
                      <p className="font-medium text-sm">{objetivoLabels[alt.objetivo]}</p>
                      <p className="text-xs opacity-70 mt-1">{alt.razon}</p>
                      <p className="text-xs opacity-60 mt-1 italic">{alt.adecuadoPara}</p>
                    </button>
                  ))}
                </div>

                {!usarSugerencia && objetivoSeleccionado && (
                  <button
                    onClick={handleGenerateNewPlan}
                    className="w-full mt-4 px-6 py-3 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600 text-white font-medium transition-all shadow-lg"
                  >
                    Generar plan con {objetivoLabels[objetivoSeleccionado]}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Step 4: Generating */}
        {step === "generating" && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-cyan-500 mb-4"></div>
            <p className="text-lg font-medium mb-2">Generando tu nuevo plan...</p>
            <p className="text-sm opacity-70">Creando plan personalizado según tus resultados</p>
          </div>
        )}

        {/* Step 5: Complete */}
        {step === "complete" && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="text-6xl mb-4">✅</div>
            <p className="text-2xl font-bold mb-2">¡Plan generado exitosamente!</p>
            <p className="text-sm opacity-70">Redirigiendo a tu nuevo plan...</p>
          </div>
        )}
      </motion.div>
    </div>
  );
}


