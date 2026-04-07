import React, { useEffect, useState } from "react";
import ExerciseDemoMedia from "@/components/ExerciseDemoMedia";
import IntakeWorkoutDayLog from "@/components/IntakeWorkoutDayLog";
import { normalizeExerciseMediaKey } from "@/lib/exerciseMedia";
import type { IntakeWorkoutSession } from "@/types/intakeWorkoutLog";

export type PublicIntakePlanDetail = {
  id: string;
  includeNutrition: boolean;
  includeTraining: boolean;
  input: Record<string, unknown> | null;
  plan: Record<string, unknown> | null;
};

type Props = {
  clientName: string | null;
  plan: PublicIntakePlanDetail;
  /** Si vienen, el cliente puede guardar kg/descanso por serie (mismo token que la URL). */
  clientId?: string | null;
  viewToken?: string | null;
};

export default function IntakeClientPlanPublicView({ clientName, plan, clientId, viewToken }: Props) {
  const [nutritionOpen, setNutritionOpen] = useState(false);
  const [trainingOpen, setTrainingOpen] = useState(false);
  const [openNutritionDays, setOpenNutritionDays] = useState<Record<string, boolean>>({});
  const [openTrainingDays, setOpenTrainingDays] = useState<Record<string, boolean>>({});
  const [workoutSessions, setWorkoutSessions] = useState<IntakeWorkoutSession[]>([]);
  const [workoutSessionsLoading, setWorkoutSessionsLoading] = useState(false);

  const toggleNutritionDay = (key: string) => {
    setOpenNutritionDays((prev) => ({ ...prev, [key]: !prev[key] }));
  };
  const toggleTrainingDay = (key: string) => {
    setOpenTrainingDays((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const mergeSession = (s: IntakeWorkoutSession) => {
    setWorkoutSessions((prev) => {
      const next = prev.filter((p) => p.id !== s.id);
      next.push(s);
      return next.sort((a, b) => {
        const c = b.completedOn.localeCompare(a.completedOn);
        if (c !== 0) return c;
        return b.weekIndex - a.weekIndex;
      });
    });
  };

  useEffect(() => {
    if (!clientId || !viewToken || !plan.id) return;
    let cancelled = false;
    (async () => {
      setWorkoutSessionsLoading(true);
      try {
        const res = await fetch(
          `/api/public/intake-workout-log?clientId=${encodeURIComponent(clientId)}&t=${encodeURIComponent(viewToken)}&planId=${encodeURIComponent(plan.id)}`
        );
        const data = (await res.json().catch(() => ({}))) as { sessions?: IntakeWorkoutSession[] };
        if (!cancelled && Array.isArray(data.sessions)) setWorkoutSessions(data.sessions);
      } finally {
        if (!cancelled) setWorkoutSessionsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId, viewToken, plan.id]);

  const root = plan.plan;
  if (!root || typeof root !== "object") {
    return (
      <p className="text-white/70 text-sm rounded-lg border border-white/10 bg-white/5 px-4 py-3">
        No hay datos de plan disponibles.
      </p>
    );
  }

  const macros =
    root.macros && typeof root.macros === "object" ? (root.macros as Record<string, unknown>) : null;
  const weeklyPlan = Array.isArray(root.plan_semanal) ? (root.plan_semanal as Array<Record<string, unknown>>) : [];
  const trainingPlan =
    root.training_plan && typeof root.training_plan === "object"
      ? (root.training_plan as Record<string, unknown>)
      : null;
  const cardioPlan =
    root.cardio_recomendado && typeof root.cardio_recomendado === "object"
      ? (root.cardio_recomendado as Record<string, unknown>)
      : null;
  const suplementacionPlan = Array.isArray(root.suplementacion_recomendada)
    ? (root.suplementacion_recomendada as Array<Record<string, unknown>>)
    : [];

  const planMediaOverridesMerged: Record<string, { demo_video_url?: string; demo_poster_url?: string }> =
    trainingPlan &&
    typeof trainingPlan.exercise_media_overrides === "object" &&
    !Array.isArray(trainingPlan.exercise_media_overrides)
      ? (trainingPlan.exercise_media_overrides as Record<string, { demo_video_url?: string; demo_poster_url?: string }>)
      : {};

  const weeks =
    trainingPlan && Array.isArray(trainingPlan.weeks)
      ? (trainingPlan.weeks as Array<Record<string, unknown>>)
      : [];

  const firstWeekDays =
    weeks[0] && Array.isArray(weeks[0].days) ? (weeks[0].days as Array<Record<string, unknown>>) : [];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-lg border border-sky-400/20 bg-sky-500/10 px-3 py-2">
          <p className="text-xs text-sky-100/80">Datos</p>
          <p className="text-sm text-sky-100">
            Edad: {String(plan.input?.edad ?? "N/A")} · Altura: {String(plan.input?.alturaCm ?? "N/A")} cm · Peso:{" "}
            {String(plan.input?.pesoKg ?? "N/A")} kg
          </p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
          <p className="text-xs text-white/60">Tu plan</p>
          <p className="text-sm text-white">
            {plan.includeNutrition ? "Nutrición" : ""}
            {plan.includeNutrition && plan.includeTraining ? " · " : ""}
            {plan.includeTraining ? "Entrenamiento" : ""}
            {!plan.includeNutrition && !plan.includeTraining ? "—" : ""}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-lg border border-emerald-400/20 bg-emerald-500/10 px-3 py-2">
          <p className="text-xs text-emerald-100/80">Calorías objetivo</p>
          <p className="text-base font-semibold text-emerald-100">
            {typeof root.calorias_diarias === "number"
              ? `${root.calorias_diarias} kcal${
                  typeof root.calorias_mantenimiento === "number"
                    ? ` / ${root.calorias_mantenimiento} kcal mant.`
                    : ""
                }`
              : "N/A"}
          </p>
        </div>
        <div className="rounded-lg border border-cyan-400/20 bg-cyan-500/10 px-3 py-2">
          <p className="text-xs text-cyan-100/80">Macros</p>
          <p className="text-sm text-cyan-100">
            {macros
              ? `Proteínas ${String(macros.proteinas || "-")} · Grasas ${String(macros.grasas || "-")} · Carbohidratos ${String(macros.carbohidratos || "-")}`
              : "N/A"}
          </p>
        </div>
        <div className="rounded-lg border border-violet-400/20 bg-violet-500/10 px-3 py-2">
          <p className="text-xs text-violet-100/80">Split entrenamiento</p>
          <p className="text-sm text-violet-100">{String(trainingPlan?.split || "N/A")}</p>
        </div>
      </div>

      {trainingPlan?.week_order_rationale ? (
        <div className="rounded-lg border border-violet-400/25 bg-violet-500/5 px-3 py-2">
          <p className="text-xs text-violet-100/80">Por qué este orden de días</p>
          <p className="text-sm text-violet-50/95 whitespace-pre-wrap">{String(trainingPlan.week_order_rationale)}</p>
        </div>
      ) : null}

      {Boolean(root.evaluacion_inicial) && typeof root.evaluacion_inicial === "object" && (
        <div className="rounded-lg border border-fuchsia-400/20 bg-fuchsia-500/10 px-3 py-2">
          <p className="text-xs text-fuchsia-100/80">Evaluación inicial</p>
          <p className="text-sm text-fuchsia-100">
            IMC: {String((root.evaluacion_inicial as Record<string, unknown>).imc || "N/A")} · Estado:{" "}
            {String((root.evaluacion_inicial as Record<string, unknown>).estado || "N/A")}
          </p>
        </div>
      )}

      {Boolean(root.mensaje_ajuste_objetivo) && (
        <div className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2">
          <p className="text-xs text-amber-100/80">Mensaje importante</p>
          <p className="text-sm text-amber-100 mt-1">{String(root.mensaje_ajuste_objetivo)}</p>
        </div>
      )}

      {cardioPlan && (
        <div className="rounded-lg border border-sky-400/20 bg-sky-500/10 px-3 py-2">
          <p className="text-xs text-sky-100/80">Cardio recomendado</p>
          <p className="text-sm text-sky-100">
            Pasos diarios: {String(cardioPlan.objetivo_pasos_diarios || "N/A")} · Sesiones:{" "}
            {String(cardioPlan.sesiones_por_semana || "N/A")}
          </p>
          <p className="text-xs text-sky-100/80 mt-1">{String(cardioPlan.detalle || "")}</p>
        </div>
      )}

      {suplementacionPlan.length > 0 && (
        <div className="rounded-lg border border-amber-400/20 bg-amber-500/10 px-3 py-2">
          <p className="text-xs text-amber-100/80 mb-2">Suplementación sugerida</p>
          <div className="space-y-2">
            {suplementacionPlan.map((supp, idx) => (
              <div key={`supp-${idx}`} className="rounded-md border border-white/10 bg-black/20 px-3 py-2">
                <p className="text-sm font-medium text-amber-100">{String(supp.nombre || "Suplemento")}</p>
                <p className="text-xs text-white/80 mt-1">
                  Dosis: {String(supp.dosis || "N/A")} · Momento: {String(supp.momento || "N/A")}
                </p>
                <p className="text-xs text-white/70 mt-1">Motivo: {String(supp.motivo || "N/A")}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {plan.includeNutrition && weeklyPlan.length > 0 && (
        <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
          <button
            type="button"
            onClick={() => setNutritionOpen((prev) => !prev)}
            className="w-full inline-flex items-center justify-between gap-2 text-left"
          >
            <p className="text-xs text-white/60">Plan de alimentación semanal</p>
            <span className="text-[11px] text-cyan-200">{nutritionOpen ? "Ocultar" : "Ver nutrición"}</span>
          </button>
          {nutritionOpen ? (
            <div className="space-y-3 mt-2">
              {weeklyPlan.map((day, dayIndex) => {
                const dayName = String(day.dia || `Día ${dayIndex + 1}`);
                const meals = Array.isArray(day.comidas) ? (day.comidas as Array<Record<string, unknown>>) : [];
                const dayKey = `nutrition-${dayIndex}-${dayName}`;
                const dayOpen = Boolean(openNutritionDays[dayKey]);
                return (
                  <div key={`${dayName}-${dayIndex}`} className="rounded-md border border-white/10 bg-black/20 px-3 py-3">
                    <button
                      type="button"
                      onClick={() => toggleNutritionDay(dayKey)}
                      className="w-full inline-flex items-center justify-between gap-2 text-left"
                    >
                      <p className="text-sm font-semibold text-cyan-200">{dayName}</p>
                      <span className="text-[11px] text-cyan-200">{dayOpen ? "Ocultar día" : "Ver día"}</span>
                    </button>
                    {dayOpen ? (
                      <div className="mt-2 space-y-2">
                        {meals.map((meal, mealIndex) => {
                          const mealName = String(meal.nombre || `Comida ${mealIndex + 1}`);
                          const mealTime = String(meal.hora || "--:--");
                          const mealMacros =
                            meal.macros_aprox && typeof meal.macros_aprox === "object"
                              ? (meal.macros_aprox as Record<string, unknown>)
                              : null;
                          const mealOption = Array.isArray(meal.opciones)
                            ? String((meal.opciones as unknown[])[0] || "")
                            : "";
                          return (
                            <div
                              key={`${dayName}-${mealName}-${mealIndex}`}
                              className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-2"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-sm text-white font-medium">{mealName}</p>
                                <p className="text-xs text-white/60">{mealTime}</p>
                              </div>
                              <p className="text-xs text-white/80 mt-1">{mealOption || "Opción personalizada"}</p>
                              <p className="text-xs text-emerald-200 mt-1">
                                Proteínas {String(mealMacros?.proteinas_g ?? "-")}g · Grasas{" "}
                                {String(mealMacros?.grasas_g ?? "-")}g · Carbohidratos{" "}
                                {String(mealMacros?.carbohidratos_g ?? "-")}g
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      )}

      {plan.includeTraining && weeks.length > 0 && (
        <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
          <button
            type="button"
            onClick={() => setTrainingOpen((prev) => !prev)}
            className="w-full inline-flex items-center justify-between gap-2 text-left"
          >
            <p className="text-xs text-white/60">Plan de entrenamiento</p>
            <span className="text-[11px] text-violet-200">{trainingOpen ? "Ocultar" : "Ver entrenamiento"}</span>
          </button>
          {trainingOpen ? (
            <div className="space-y-6 mt-2">
              {weeks.map((week, weekIndex) => {
                const days = Array.isArray(week.days) ? (week.days as Array<Record<string, unknown>>) : [];
                return (
                  <div key={`week-${weekIndex}`}>
                    <p className="text-sm font-semibold text-violet-200 mb-2">Semana {weekIndex + 1}</p>
                    <div className="space-y-3">
                      {days.map((day, dayIndex) => {
                        const dayName = String(day.day || "Día");
                        const split = String(day.split || "Entrenamiento");
                        const exercises = Array.isArray(day.ejercicios)
                          ? (day.ejercicios as Array<Record<string, unknown>>)
                          : [];
                        const dayKey = `training-${weekIndex}-${dayIndex}-${dayName}`;
                        const dayOpen = Boolean(openTrainingDays[dayKey]);
                        return (
                          <div
                            key={`${weekIndex}-${dayName}-${dayIndex}`}
                            className="rounded-md border border-white/10 bg-black/20 px-3 py-3"
                          >
                            <button
                              type="button"
                              onClick={() => toggleTrainingDay(dayKey)}
                              className="w-full inline-flex items-start justify-between gap-2 text-left"
                            >
                              <div>
                                <p className="text-sm font-semibold text-violet-200">{dayName}</p>
                                <p className="text-xs text-white/70 mt-1">
                                  {split} · {exercises.length} ejercicios
                                </p>
                              </div>
                              <span className="text-[11px] text-violet-200">{dayOpen ? "Ocultar día" : "Ver día"}</span>
                            </button>
                            {dayOpen ? (
                              <div className="mt-2 space-y-3">
                                {exercises.map((exercise, exIndex) => {
                                  const exName = String(exercise.name || "Ejercicio");
                                  const ovKey = normalizeExerciseMediaKey(exName);
                                  const ov = planMediaOverridesMerged[ovKey];
                                  const demoVideo =
                                    (typeof exercise.demo_video_url === "string" ? exercise.demo_video_url : null) ||
                                    (typeof ov?.demo_video_url === "string" ? ov.demo_video_url : null);
                                  const demoPoster =
                                    (typeof exercise.demo_poster_url === "string"
                                      ? exercise.demo_poster_url
                                      : null) || (typeof ov?.demo_poster_url === "string" ? ov.demo_poster_url : null);
                                  return (
                                    <div
                                      key={`${weekIndex}-${dayIndex}-ex-${exIndex}`}
                                      className="text-xs text-white/85 border-b border-white/5 pb-2 last:border-0 last:pb-0"
                                    >
                                      <p>
                                        {exIndex + 1}. {exName} · {String(exercise.sets || "-")} series ·{" "}
                                        {String(exercise.reps || "-")} reps
                                      </p>
                                      {exName.length >= 2 ? (
                                        <ExerciseDemoMedia
                                          exerciseName={exName}
                                          demoVideoUrl={demoVideo}
                                          demoPosterUrl={demoPoster}
                                          planMediaOverrides={planMediaOverridesMerged}
                                        />
                                      ) : null}
                                    </div>
                                  );
                                })}
                                {clientId && viewToken && plan.id ? (
                                  <>
                                    {workoutSessionsLoading ? (
                                      <p className="text-[11px] text-white/40">Cargando tus registros…</p>
                                    ) : null}
                                    <IntakeWorkoutDayLog
                                      clientId={clientId}
                                      viewToken={viewToken}
                                      planId={plan.id}
                                      weekIndex={weekIndex}
                                      dayIndex={dayIndex}
                                      dayLabel={dayName}
                                      exercises={exercises.map((ex) => ({
                                        name: String(ex.name || "Ejercicio"),
                                        setsRaw: ex.sets,
                                        repsRaw: ex.reps,
                                      }))}
                                      sessions={workoutSessions}
                                      onSessionSaved={mergeSession}
                                    />
                                  </>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      )}

      {plan.includeTraining && weeks.length === 0 && firstWeekDays.length > 0 && (
        <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
          <button
            type="button"
            onClick={() => setTrainingOpen((prev) => !prev)}
            className="w-full inline-flex items-center justify-between gap-2 text-left"
          >
            <p className="text-xs text-white/60">Plan de entrenamiento (semana 1)</p>
            <span className="text-[11px] text-violet-200">{trainingOpen ? "Ocultar" : "Ver entrenamiento"}</span>
          </button>
          {trainingOpen ? (
            <div className="space-y-3 mt-2">
              {firstWeekDays.map((day, dayIndex) => {
                const dayName = String(day.day || "Día");
                const split = String(day.split || "Entrenamiento");
                const exercises = Array.isArray(day.ejercicios) ? (day.ejercicios as Array<Record<string, unknown>>) : [];
                const dayKey = `training-fallback-${dayIndex}-${dayName}`;
                const dayOpen = Boolean(openTrainingDays[dayKey]);
                return (
                  <div key={`${dayName}-${dayIndex}`} className="rounded-md border border-white/10 bg-black/20 px-3 py-3">
                    <button
                      type="button"
                      onClick={() => toggleTrainingDay(dayKey)}
                      className="w-full inline-flex items-start justify-between gap-2 text-left"
                    >
                      <div>
                        <p className="text-sm font-semibold text-violet-200">{dayName}</p>
                        <p className="text-xs text-white/70 mt-1">
                          {split} · {exercises.length} ejercicios
                        </p>
                      </div>
                      <span className="text-[11px] text-violet-200">{dayOpen ? "Ocultar día" : "Ver día"}</span>
                    </button>
                    {dayOpen ? (
                      <div className="mt-2 space-y-3">
                        {exercises.map((exercise, exIndex) => {
                          const exName = String(exercise.name || "Ejercicio");
                          return (
                            <div
                              key={`${dayName}-ex-${exIndex}`}
                              className="text-xs text-white/85 border-b border-white/5 pb-2 last:border-0 last:pb-0"
                            >
                              <p>
                                {exIndex + 1}. {exName} · {String(exercise.sets || "-")} series ·{" "}
                                {String(exercise.reps || "-")} reps
                              </p>
                              {exName.length >= 2 ? (
                                <ExerciseDemoMedia
                                  exerciseName={exName}
                                  demoVideoUrl={typeof exercise.demo_video_url === "string" ? exercise.demo_video_url : null}
                                  demoPosterUrl={typeof exercise.demo_poster_url === "string" ? exercise.demo_poster_url : null}
                                  planMediaOverrides={planMediaOverridesMerged}
                                />
                              ) : null}
                            </div>
                          );
                        })}
                        {clientId && viewToken && plan.id ? (
                          <>
                            {workoutSessionsLoading ? (
                              <p className="text-[11px] text-white/40">Cargando tus registros…</p>
                            ) : null}
                            <IntakeWorkoutDayLog
                              clientId={clientId}
                              viewToken={viewToken}
                              planId={plan.id}
                              weekIndex={0}
                              dayIndex={dayIndex}
                              dayLabel={dayName}
                              exercises={exercises.map((ex) => ({
                                name: String(ex.name || "Ejercicio"),
                                setsRaw: ex.sets,
                                repsRaw: ex.reps,
                              }))}
                              sessions={workoutSessions}
                              onSessionSaved={mergeSession}
                            />
                          </>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      )}

      <p className="text-[11px] text-white/45 text-center pt-2">
        {clientName ? `Plan personalizado para ${clientName}.` : "Tu plan personalizado."} Guarda este enlace para consultarlo cuando quieras.
      </p>
    </div>
  );
}
