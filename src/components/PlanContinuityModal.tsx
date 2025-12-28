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
    progresoGeneral: "excelente" | "bueno" | "regular" | "insuficiente";
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
    if (!objetivoSeleccionado || !analysis) return;

    setStep("generating");
    setError(null);

    try {
      // Construir nuevo UserInput con ajustes aplicados
      const nuevoUserInput: UserInput = {
        ...planData.user,
        objetivo: objetivoSeleccionado,
        pesoKg: parseFloat(pesoFinal),
        cinturaCm: cinturaFinal ? parseFloat(cinturaFinal) : planData.user.cinturaCm,
      };

      // Aplicar ajustes de entrenamiento si se usa la sugerencia
      if (usarSugerencia) {
        const ajustes = analysis.sugerenciaContinuidad.ajustesEntrenamiento;
        
        if (ajustes.diasGym === "aumentar" && nuevoUserInput.diasGym) {
          nuevoUserInput.diasGym = Math.min(7, nuevoUserInput.diasGym + 1);
        } else if (ajustes.diasGym === "reducir" && nuevoUserInput.diasGym) {
          nuevoUserInput.diasGym = Math.max(3, nuevoUserInput.diasGym - 1);
        }

        if (ajustes.intensidad === "aumentar") {
          if (nuevoUserInput.intensidad === "leve") nuevoUserInput.intensidad = "moderada";
          else if (nuevoUserInput.intensidad === "moderada") nuevoUserInput.intensidad = "intensa";
          else if (nuevoUserInput.intensidad === "intensa") nuevoUserInput.intensidad = "ultra";
        } else if (ajustes.intensidad === "reducir") {
          if (nuevoUserInput.intensidad === "ultra") nuevoUserInput.intensidad = "intensa";
          else if (nuevoUserInput.intensidad === "intensa") nuevoUserInput.intensidad = "moderada";
          else if (nuevoUserInput.intensidad === "moderada") nuevoUserInput.intensidad = "leve";
        }
      }

      // Generar nuevo plan
      const response = await fetch("/api/generatePlan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nuevoUserInput),
      });

      if (!response.ok) {
        throw new Error("Error al generar el plan");
      }

      const nuevoPlan = await response.json();

      // Actualizar plan anterior con datos de finalización
      try {
        const { getDbSafe } = await import("@/lib/firebase");
        const { doc, updateDoc, serverTimestamp } = await import("firebase/firestore");
        
        const db = getDbSafe();
        if (db) {
          const planRef = doc(db, "planes", planData.id);
          await updateDoc(planRef, {
            datosFinalizacion: {
              pesoFinal: parseFloat(pesoFinal),
              cinturaFinal: cinturaFinal ? parseFloat(cinturaFinal) : undefined,
              adherenciaComida,
              adherenciaEntreno,
              energia,
              recuperacion,
              lesionesNuevas: lesionesNuevas || undefined,
              comentarios: comentarios || undefined,
              fechaFinalizacion: new Date().toISOString(),
            },
            analisis: analysis.analisis,
            completado: true,
            updatedAt: serverTimestamp(),
          });
        }
      } catch (err) {
        console.error("Error al actualizar plan anterior:", err);
        // No bloqueamos el flujo si falla actualizar el plan anterior
      }

      // Guardar nuevo plan
      const saveResponse = await fetch("/api/savePlan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: nuevoPlan,
          userId,
          planAnteriorId: planData.id,
        }),
      });

      if (!saveResponse.ok) {
        throw new Error("Error al guardar el nuevo plan");
      }

      const { id: nuevoPlanId } = await saveResponse.json();
      setStep("complete");

      // Redirigir al nuevo plan después de 1 segundo
      setTimeout(() => {
        router.push(`/plan?id=${nuevoPlanId}`);
      }, 1000);
    } catch (err) {
      console.error("Error al generar plan:", err);
      setError("No se pudo generar el nuevo plan. Por favor intenta de nuevo.");
      setStep("suggestion");
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
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
            <h2 className="text-2xl font-bold text-white">
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
              <p className="text-white/70 text-sm mb-4">
                Completa los datos finales de tu plan para recibir una sugerencia personalizada de continuidad.
              </p>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white/90 mb-2">
                    Peso final (kg) *
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={pesoFinal}
                    onChange={(e) => setPesoFinal(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="75.5"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/90 mb-2">
                    Cintura final (cm)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={cinturaFinal}
                    onChange={(e) => setCinturaFinal(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="88"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white/90 mb-2">
                    Adherencia a comidas
                  </label>
                  <select
                    value={adherenciaComida}
                    onChange={(e) => setAdherenciaComida(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="<50%">&lt;50%</option>
                    <option value="50-70%">50-70%</option>
                    <option value="70-80%">70-80%</option>
                    <option value=">80%">&gt;80%</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/90 mb-2">
                    Adherencia a entrenamiento
                  </label>
                  <select
                    value={adherenciaEntreno}
                    onChange={(e) => setAdherenciaEntreno(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="<50%">&lt;50%</option>
                    <option value="50-70%">50-70%</option>
                    <option value="70-80%">70-80%</option>
                    <option value=">80%">&gt;80%</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white/90 mb-2">
                    Nivel de energía
                  </label>
                  <select
                    value={energia}
                    onChange={(e) => setEnergia(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="muy_baja">Muy baja</option>
                    <option value="baja">Baja</option>
                    <option value="normal">Normal</option>
                    <option value="alta">Alta</option>
                    <option value="muy_alta">Muy alta</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/90 mb-2">
                    Recuperación
                  </label>
                  <select
                    value={recuperacion}
                    onChange={(e) => setRecuperacion(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="mala">Mala</option>
                    <option value="regular">Regular</option>
                    <option value="normal">Normal</option>
                    <option value="buena">Buena</option>
                    <option value="excelente">Excelente</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">
                  Lesiones nuevas (opcional)
                </label>
                <input
                  type="text"
                  value={lesionesNuevas}
                  onChange={(e) => setLesionesNuevas(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ej: Dolor de rodilla leve"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">
                  Comentarios adicionales (opcional)
                </label>
                <textarea
                  value={comentarios}
                  onChange={(e) => setComentarios(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Comparte cómo te sentiste durante el plan..."
                />
              </div>

              <button
                onClick={handleAnalyze}
                className="w-full py-3 rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 text-white font-semibold hover:from-blue-600 hover:to-purple-600 transition-all"
              >
                Analizar y obtener sugerencia
              </button>
            </div>
          )}

          {/* Step 2: Analyzing */}
          {step === "analyzing" && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-400 mb-4"></div>
              <p className="text-white/70 text-center">
                Analizando tus resultados con inteligencia artificial...
              </p>
            </div>
          )}

          {/* Step 3: Suggestion */}
          {step === "suggestion" && analysis && (
            <div className="space-y-6">
              {/* Análisis */}
              <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                <h3 className="text-lg font-semibold text-white mb-3">Análisis de resultados</h3>
                <div className="space-y-2 text-sm text-white/80">
                  <p className="font-medium">
                    Progreso: <span className={`${
                      analysis.analisis.progresoGeneral === "excelente" ? "text-green-400" :
                      analysis.analisis.progresoGeneral === "bueno" ? "text-blue-400" :
                      analysis.analisis.progresoGeneral === "regular" ? "text-yellow-400" :
                      "text-orange-400"
                    }`}>
                      {analysis.analisis.progresoGeneral.toUpperCase()}
                    </span>
                  </p>
                  <p>{analysis.analisis.resumen}</p>
                  
                  {analysis.analisis.puntosPositivos.length > 0 && (
                    <div className="mt-3">
                      <p className="font-medium text-green-400 mb-1">Puntos positivos:</p>
                      <ul className="list-disc list-inside space-y-1">
                        {analysis.analisis.puntosPositivos.map((punto, i) => (
                          <li key={i}>{punto}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {analysis.analisis.areasMejora.length > 0 && (
                    <div className="mt-3">
                      <p className="font-medium text-yellow-400 mb-1">Áreas de mejora:</p>
                      <ul className="list-disc list-inside space-y-1">
                        {analysis.analisis.areasMejora.map((area, i) => (
                          <li key={i}>{area}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>

              {/* Sugerencia principal */}
              <div className="p-4 rounded-lg bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-400/30">
                <h3 className="text-lg font-semibold text-white mb-3">Sugerencia de continuidad</h3>
                <div className="space-y-2 text-sm text-white/90">
                  <p className="font-medium">
                    Objetivo recomendado: <span className="text-blue-300">{analysis.sugerenciaContinuidad.objetivoRecomendado}</span>
                  </p>
                  <p>{analysis.sugerenciaContinuidad.razonObjetivo}</p>
                  <p className="mt-3 text-blue-200">{analysis.sugerenciaContinuidad.mensajeMotivacional}</p>
                </div>

                <div className="mt-4 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="usarSugerencia"
                    checked={usarSugerencia}
                    onChange={(e) => setUsarSugerencia(e.target.checked)}
                    className="w-4 h-4 rounded"
                  />
                  <label htmlFor="usarSugerencia" className="text-sm text-white/80">
                    Usar esta sugerencia
                  </label>
                </div>
              </div>

              {/* Objetivos alternativos */}
              {analysis.objetivosAlternativos.length > 0 && (
                <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                  <h3 className="text-lg font-semibold text-white mb-3">Otras opciones</h3>
                  <div className="space-y-3">
                    {analysis.objetivosAlternativos.map((alt, i) => (
                      <div
                        key={i}
                        className={`p-3 rounded-lg border cursor-pointer transition-all ${
                          objetivoSeleccionado === alt.objetivo && !usarSugerencia
                            ? "border-blue-400 bg-blue-500/20"
                            : "border-white/20 bg-white/5 hover:bg-white/10"
                        }`}
                        onClick={() => {
                          setUsarSugerencia(false);
                          setObjetivoSeleccionado(alt.objetivo);
                        }}
                      >
                        <p className="font-semibold text-white">{alt.objetivo}</p>
                        <p className="text-sm text-white/70 mt-1">{alt.razon}</p>
                        <p className="text-xs text-white/50 mt-1">{alt.adecuadoPara}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={handleGenerateNewPlan}
                disabled={!objetivoSeleccionado}
                className="w-full py-3 rounded-lg bg-gradient-to-r from-green-500 to-emerald-500 text-white font-semibold hover:from-green-600 hover:to-emerald-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {usarSugerencia ? "Aceptar y generar plan" : `Generar plan con ${objetivoSeleccionado}`}
              </button>
            </div>
          )}

          {/* Step 4: Generating */}
          {step === "generating" && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-green-400 mb-4"></div>
              <p className="text-white/70 text-center">
                Generando tu nuevo plan personalizado...
              </p>
            </div>
          )}

          {/* Step 5: Complete */}
          {step === "complete" && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center mb-4">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-8 w-8 text-white"
                >
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </div>
              <p className="text-white text-lg font-semibold mb-2">¡Plan generado exitosamente!</p>
              <p className="text-white/70 text-sm">Redirigiendo a tu nuevo plan...</p>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}











