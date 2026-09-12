import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/router";
import type { UserInput, Goal, PlanAIResponse } from "@/types/plan";
import { useAppLocale, type AppLocale } from "@/contexts/AppLocaleContext";
import { dash, dashFmt } from "@/lib/i18n/appUi";
import { MODAL_BACKDROP_CLASS, MODAL_BACKDROP_MOTION, MODAL_PANEL_CLASS, MODAL_PANEL_MOTION } from "@/lib/modalShell";
import { authedFetch } from "@/lib/userAuthClient";

const ENERGY_OPT: Record<string, { es: string; en: string }> = {
  muy_baja: { es: "Muy baja", en: "Very low" },
  baja: { es: "Baja", en: "Low" },
  normal: { es: "Normal", en: "Normal" },
  alta: { es: "Alta", en: "High" },
  muy_alta: { es: "Muy alta", en: "Very high" },
};

const RECOVERY_OPT: Record<string, { es: string; en: string }> = {
  mala: { es: "Mala", en: "Poor" },
  regular: { es: "Regular", en: "Fair" },
  normal: { es: "Normal", en: "Normal" },
  buena: { es: "Buena", en: "Good" },
  excelente: { es: "Excelente", en: "Excellent" },
};

function loc<T extends { es: string; en: string }>(locale: AppLocale, m: T): string {
  return m[locale];
}

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
  const { locale } = useAppLocale();
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
      setError(dash(locale, "continuityErrPeso"));
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
      setError(dash(locale, "continuityErrAnalyze"));
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
      const response = await authedFetch("/api/generatePlan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...nuevoUserInput, userId, locale }),
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
      // authedFetch: el servidor deriva el UID del token, no del cuerpo.
      const saveResponse = await authedFetch("/api/savePlan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: nuevoPlan,
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
      setError(dash(locale, "continuityErrGenerate"));
      setStep("suggestion");
    }
  };

  if (!isOpen) return null;

  const stepTitle =
    step === "input"
      ? dash(locale, "continuityTitleInput")
      : step === "analyzing"
        ? dash(locale, "continuityTitleAnalyzing")
        : step === "suggestion"
          ? dash(locale, "continuityTitleSuggestion")
          : step === "generating"
            ? dash(locale, "continuityTitleGenerating")
            : dash(locale, "continuityTitleDone");

  const inputClass =
    "w-full rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface)] px-3.5 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--landing-muted)] focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklab,var(--landing-accent)_55%,transparent)]";
  const labelClass = "mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--landing-muted)]";

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4">
        <motion.div {...MODAL_BACKDROP_MOTION} onClick={onClose} className={`absolute inset-0 ${MODAL_BACKDROP_CLASS}`} />

        <motion.div
          {...MODAL_PANEL_MOTION}
          onClick={(e) => e.stopPropagation()}
          className={`relative z-10 flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden ${MODAL_PANEL_CLASS}`}
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.45]"
            style={{
              background:
                "radial-gradient(70% 45% at 12% 0%, color-mix(in oklab, var(--landing-accent) 24%, transparent), transparent 52%), radial-gradient(55% 40% at 92% 8%, color-mix(in oklab, var(--brand-mid) 16%, transparent), transparent 48%)",
            }}
          />

          <div className="relative flex items-start justify-between gap-4 border-b border-[color-mix(in_oklab,var(--foreground)_8%,transparent)] px-5 py-4 sm:px-6 sm:py-5">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--landing-muted)]">
                FitPlan
              </p>
              <h2 className="mt-1 text-lg font-bold tracking-tight text-[var(--foreground)] sm:text-xl">
                {stepTitle}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface)] p-2 text-[var(--landing-muted)] transition hover:border-[color-mix(in_oklab,var(--landing-accent)_35%,transparent)] hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-40"
              disabled={step === "analyzing" || step === "generating"}
              aria-label={dash(locale, "modalClose")}
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
          </div>

          <div className="relative max-h-[min(78vh,calc(100vh-8rem))] overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">
            {error && (
              <div className="mb-5 rounded-xl border border-danger/35 bg-danger/10 px-4 py-3 text-sm text-danger">
                {error}
              </div>
            )}

            {step === "input" && (
              <div className="space-y-5">
                <p className="text-sm leading-relaxed text-[var(--landing-muted)]">{dash(locale, "continuityIntro")}</p>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className={labelClass}>{dash(locale, "continuityWeightFinal")}</label>
                    <input
                      type="number"
                      step="0.1"
                      value={pesoFinal}
                      onChange={(e) => setPesoFinal(e.target.value)}
                      className={inputClass}
                      placeholder="75.5"
                    />
                  </div>
                  <div>
                    <label className={labelClass}>{dash(locale, "continuityWaistFinal")}</label>
                    <input
                      type="number"
                      step="0.1"
                      value={cinturaFinal}
                      onChange={(e) => setCinturaFinal(e.target.value)}
                      className={inputClass}
                      placeholder="88"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className={labelClass}>{dash(locale, "continuityMealAdh")}</label>
                    <select
                      value={adherenciaComida}
                      onChange={(e) => setAdherenciaComida(e.target.value)}
                      className={inputClass}
                    >
                      <option value="<50%">&lt;50%</option>
                      <option value="50-70%">50-70%</option>
                      <option value="70-80%">70-80%</option>
                      <option value=">80%">&gt;80%</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>{dash(locale, "continuityTrainAdh")}</label>
                    <select
                      value={adherenciaEntreno}
                      onChange={(e) => setAdherenciaEntreno(e.target.value)}
                      className={inputClass}
                    >
                      <option value="<50%">&lt;50%</option>
                      <option value="50-70%">50-70%</option>
                      <option value="70-80%">70-80%</option>
                      <option value=">80%">&gt;80%</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className={labelClass}>{dash(locale, "continuityEnergy")}</label>
                    <select
                      value={energia}
                      onChange={(e) => setEnergia(e.target.value)}
                      className={inputClass}
                    >
                      {Object.entries(ENERGY_OPT).map(([value, labels]) => (
                        <option key={value} value={value}>
                          {loc(locale, labels)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>{dash(locale, "continuityRecovery")}</label>
                    <select
                      value={recuperacion}
                      onChange={(e) => setRecuperacion(e.target.value)}
                      className={inputClass}
                    >
                      {Object.entries(RECOVERY_OPT).map(([value, labels]) => (
                        <option key={value} value={value}>
                          {loc(locale, labels)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className={labelClass}>{dash(locale, "continuityInjuries")}</label>
                  <input
                    type="text"
                    value={lesionesNuevas}
                    onChange={(e) => setLesionesNuevas(e.target.value)}
                    className={inputClass}
                    placeholder={dash(locale, "continuityInjuriesPh")}
                  />
                </div>

                <div>
                  <label className={labelClass}>{dash(locale, "continuityComments")}</label>
                  <textarea
                    value={comentarios}
                    onChange={(e) => setComentarios(e.target.value)}
                    rows={3}
                    className={`${inputClass} resize-y min-h-[88px]`}
                    placeholder={dash(locale, "continuityCommentsPh")}
                  />
                </div>

                <button type="button" onClick={handleAnalyze} className="btn btn-primary w-full">
                  {dash(locale, "continuityAnalyzeCta")}
                </button>
              </div>
            )}

            {step === "analyzing" && (
              <div className="flex flex-col items-center justify-center py-14">
                <div className="relative mb-5 h-16 w-16">
                  <div className="absolute inset-0 rounded-full bg-[color-mix(in_oklab,var(--landing-accent)_22%,transparent)] blur-xl" />
                  <div className="relative flex h-full w-full items-center justify-center rounded-full border-2 border-[color-mix(in_oklab,var(--landing-accent)_45%,transparent)] border-t-transparent animate-spin" />
                </div>
                <p className="max-w-sm text-center text-sm text-[var(--landing-muted)]">
                  {dash(locale, "continuityAnalyzingSub")}
                </p>
              </div>
            )}

            {step === "suggestion" && analysis && (
              <div className="space-y-5">
                {/* Análisis + alternativas consolidados en un único contenedor con
                    separador interno en vez de una caja nueva por sección — la
                    sugerencia recomendada se mantiene aparte porque su tratamiento
                    destacado sí comunica algo real (es la recomendación principal,
                    no una sección más), DESIGN_SYSTEM.md §13.4-C. */}
                <div className="card-surface p-4 sm:p-5">
                  <h3 className="text-sm font-semibold text-[var(--foreground)]">
                    {dash(locale, "continuityAnalysisBlock")}
                  </h3>
                  <div className="mt-3 space-y-3 text-sm leading-relaxed text-[var(--landing-muted)]">
                    <p>
                      <span className="font-medium text-[var(--foreground)]">
                        {dash(locale, "continuityProgressLabel")}:{" "}
                      </span>
                      <span
                        className={`font-semibold uppercase tracking-wide ${
                          analysis.analisis.progresoGeneral === "excelente"
                            ? "text-success"
                            : analysis.analisis.progresoGeneral === "bueno"
                              ? "text-info"
                              : analysis.analisis.progresoGeneral === "regular"
                                ? "text-warning"
                                : "text-warning"
                        }`}
                      >
                        {analysis.analisis.progresoGeneral}
                      </span>
                    </p>
                    <p className="text-[var(--foreground)]/90">{analysis.analisis.resumen}</p>

                    {analysis.analisis.puntosPositivos.length > 0 && (
                      <div>
                        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-success/95">
                          {dash(locale, "continuityPositive")}
                        </p>
                        <ul className="list-inside list-disc space-y-1 pl-0.5">
                          {analysis.analisis.puntosPositivos.map((punto, i) => (
                            <li key={i}>{punto}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {analysis.analisis.areasMejora.length > 0 && (
                      <div>
                        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-warning/95">
                          {dash(locale, "continuityImprove")}
                        </p>
                        <ul className="list-inside list-disc space-y-1 pl-0.5">
                          {analysis.analisis.areasMejora.map((area, i) => (
                            <li key={i}>{area}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {analysis.objetivosAlternativos.length > 0 && (
                    <div className="mt-5 border-t border-border pt-5">
                      <h3 className="text-sm font-semibold text-[var(--foreground)]">
                        {dash(locale, "continuityOtherOptions")}
                      </h3>
                      <div className="mt-3 space-y-2">
                        {analysis.objetivosAlternativos.map((alt, i) => (
                          <button
                            key={i}
                            type="button"
                            className={`w-full rounded-xl border p-3.5 text-left transition ${
                              objetivoSeleccionado === alt.objetivo && !usarSugerencia
                                ? "border-[color-mix(in_oklab,var(--landing-accent)_55%,transparent)] bg-[color-mix(in_oklab,var(--landing-accent)_12%,transparent)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                                : "border-[var(--landing-border)] bg-[var(--landing-surface)] hover:border-[color-mix(in_oklab,var(--foreground)_14%,transparent)]"
                            }`}
                            onClick={() => {
                              setUsarSugerencia(false);
                              setObjetivoSeleccionado(alt.objetivo);
                            }}
                          >
                            <p className="font-semibold text-[var(--foreground)]">{alt.objetivo}</p>
                            <p className="mt-1 text-sm text-[var(--landing-muted)]">{alt.razon}</p>
                            <p className="mt-1 text-xs text-[var(--landing-muted)]/80">{alt.adecuadoPara}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div
                  className="rounded-2xl border p-4 sm:p-5"
                  style={{
                    borderColor: "color-mix(in oklab, var(--landing-accent) 32%, transparent)",
                    background:
                      "linear-gradient(135deg, color-mix(in oklab, var(--landing-accent) 12%, transparent), color-mix(in oklab, var(--brand-mid) 8%, transparent))",
                  }}
                >
                  <h3 className="text-sm font-semibold text-[var(--foreground)]">
                    {dash(locale, "continuitySugBlock")}
                  </h3>
                  <div className="mt-3 space-y-2 text-sm text-[var(--foreground)]/90">
                    <p>
                      <span className="text-[var(--landing-muted)]">{dash(locale, "continuityObjRecommended")}: </span>
                      <span className="font-semibold text-[var(--landing-accent)]">
                        {analysis.sugerenciaContinuidad.objetivoRecomendado}
                      </span>
                    </p>
                    <p className="text-[var(--landing-muted)]">{analysis.sugerenciaContinuidad.razonObjetivo}</p>
                    <p className="mt-2 border-t border-[color-mix(in_oklab,var(--foreground)_10%,transparent)] pt-3 text-[var(--foreground)]/95">
                      {analysis.sugerenciaContinuidad.mensajeMotivacional}
                    </p>
                  </div>

                  <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-[color-mix(in_oklab,var(--foreground)_10%,transparent)] bg-[color-mix(in_oklab,var(--background)_40%,transparent)] px-3 py-2.5">
                    <input
                      type="checkbox"
                      id="usarSugerencia"
                      checked={usarSugerencia}
                      onChange={(e) => setUsarSugerencia(e.target.checked)}
                      className="h-4 w-4 shrink-0 rounded border-[var(--landing-border)]"
                    />
                    <label htmlFor="usarSugerencia" className="text-sm text-[var(--landing-muted)]">
                      {dash(locale, "continuityUseSuggestion")}
                    </label>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleGenerateNewPlan}
                  disabled={!objetivoSeleccionado}
                  className="w-full rounded-xl bg-success py-3 text-sm font-semibold text-white shadow-[0_14px_36px_-16px_color-mix(in_oklab,var(--success)_55%,transparent)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {usarSugerencia
                    ? dash(locale, "continuityCtaGenerate")
                    : dashFmt(locale, "continuityCtaGenerateWith", { goal: String(objetivoSeleccionado) })}
                </button>
              </div>
            )}

            {step === "generating" && (
              <div className="flex flex-col items-center justify-center py-14">
                <div className="relative mb-5 h-16 w-16">
                  <div className="absolute inset-0 rounded-full bg-success/25 blur-xl" />
                  <div className="relative flex h-full w-full items-center justify-center rounded-full border-2 border-success/50 border-t-transparent animate-spin" />
                </div>
                <p className="max-w-sm text-center text-sm text-[var(--landing-muted)]">
                  {dash(locale, "continuityGeneratingSub")}
                </p>
              </div>
            )}

            {step === "complete" && (
              <div className="flex flex-col items-center justify-center py-14">
                <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-success shadow-[0_12px_40px_-12px_color-mix(in_oklab,var(--success)_65%,transparent)]">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-8 w-8 text-white"
                  >
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                </div>
                <p className="text-lg font-semibold text-[var(--foreground)]">{dash(locale, "continuityDoneTitle")}</p>
                <p className="mt-2 text-sm text-[var(--landing-muted)]">{dash(locale, "continuityDoneSub")}</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}











