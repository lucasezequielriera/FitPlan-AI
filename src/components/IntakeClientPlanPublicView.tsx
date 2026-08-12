import React, { useEffect, useState } from "react";
import ExerciseDemoMedia from "@/components/ExerciseDemoMedia";
import IntakeWorkoutDayLog from "@/components/IntakeWorkoutDayLog";
import { getIntakeExerciseName, normalizeExerciseMediaKey } from "@/lib/exerciseMedia";
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
  const [usefulOpen, setUsefulOpen] = useState(false);
  const [usefulTab, setUsefulTab] = useState<"training" | "nutrition">("training");
  const [openNutritionDays, setOpenNutritionDays] = useState<Record<string, boolean>>({});
  const [openTrainingDays, setOpenTrainingDays] = useState<Record<string, boolean>>({});
  const [workoutSessions, setWorkoutSessions] = useState<IntakeWorkoutSession[]>([]);
  const [workoutSessionsLoading, setWorkoutSessionsLoading] = useState(false);
  const [openTechniqueByExercise, setOpenTechniqueByExercise] = useState<Record<string, boolean>>({});
  const [trainerQaQuestion, setTrainerQaQuestion] = useState("");
  const [trainerQaAnswer, setTrainerQaAnswer] = useState<string | null>(null);
  const [trainerQaLoading, setTrainerQaLoading] = useState(false);
  const [trainerQaError, setTrainerQaError] = useState<string | null>(null);
  const [trainerQaRemaining, setTrainerQaRemaining] = useState<number | null>(null);
  const [trainerQaMaxFree, setTrainerQaMaxFree] = useState<number>(5);
  const [trainerQaIsPremium, setTrainerQaIsPremium] = useState(false);

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

  useEffect(() => {
    if (!clientId || !viewToken) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/public/intake-trainer-qa?clientId=${encodeURIComponent(clientId)}&t=${encodeURIComponent(viewToken)}`
        );
        const json = (await res.json().catch(() => ({}))) as {
          remaining?: number;
          maxFreeQuestions?: number;
          isPremium?: boolean;
        };
        if (!res.ok || cancelled) return;
        setTrainerQaRemaining(typeof json.remaining === "number" ? json.remaining : null);
        setTrainerQaMaxFree(typeof json.maxFreeQuestions === "number" ? json.maxFreeQuestions : 5);
        setTrainerQaIsPremium(json.isPremium === true);
      } catch {
        // noop
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId, viewToken]);

  const askTrainer = async () => {
    if (!clientId || !viewToken) return;
    if (!trainerQaQuestion.trim()) return;
    setTrainerQaLoading(true);
    setTrainerQaError(null);
    setTrainerQaAnswer(null);
    try {
      const res = await fetch(
        `/api/public/intake-trainer-qa?clientId=${encodeURIComponent(clientId)}&t=${encodeURIComponent(viewToken)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: trainerQaQuestion.trim() }),
        }
      );
      const json = (await res.json().catch(() => ({}))) as {
        answer?: string;
        error?: string;
        remaining?: number;
        maxFreeQuestions?: number;
        isPremium?: boolean;
        requiresPremium?: boolean;
      };
      if (!res.ok) {
        setTrainerQaError(
          json.requiresPremium
            ? "Alcanzaste tu límite gratuito. Para seguir consultando, activa premium."
            : (json.error || `Error ${res.status}`)
        );
        if (typeof json.remaining === "number") setTrainerQaRemaining(json.remaining);
        if (json.isPremium === true) setTrainerQaIsPremium(true);
        return;
      }
      setTrainerQaAnswer(typeof json.answer === "string" ? json.answer : "Sin respuesta.");
      setTrainerQaRemaining(typeof json.remaining === "number" ? json.remaining : trainerQaRemaining);
      setTrainerQaMaxFree(typeof json.maxFreeQuestions === "number" ? json.maxFreeQuestions : trainerQaMaxFree);
      setTrainerQaIsPremium(json.isPremium === true);
      setTrainerQaQuestion("");
    } catch {
      setTrainerQaError("No se pudo procesar la consulta.");
    } finally {
      setTrainerQaLoading(false);
    }
  };

  const toggleTechnique = (key: string) => {
    setOpenTechniqueByExercise((prev) => (prev[key] ? {} : { [key]: true }));
  };

  const techniqueSteps = (technique: string): string[] => {
    const raw = technique
      .split(/\n|\. |; |• |\u2022 /g)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    if (raw.length >= 2) return raw.slice(0, 8);
    return [
      "Posición inicial estable: pies firmes, core activo y postura neutra.",
      "Iniciá el movimiento de forma controlada, sin impulso.",
      "Mantené alineación articular durante todo el recorrido.",
      "Terminá cada repetición con control y respiración constante.",
    ];
  };

  const isGenericTechnique = (technique: string): boolean => {
    const t = technique.toLowerCase();
    return (
      !t ||
      t.includes("postura neutra") ||
      t.includes("movimiento controlado") ||
      t.includes("sin impulso") ||
      t.includes("respiración constante")
    );
  };

  const exerciseSpecificTechniqueSteps = (exerciseName: string): string[] => {
    const ex = exerciseName.toLowerCase();
    const hash = Array.from(ex).reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    const pick = <T,>(arr: T[]): T => arr[hash % arr.length];

    const withName = (steps: string[]) => [
      `Para ${exerciseName}: ${steps[0]}`,
      ...steps.slice(1),
    ];

    if (/prensa/.test(ex)) {
      return withName([
        "sentate con espalda completamente apoyada y pies al ancho de hombros en la plataforma.",
        "baja controlado hasta un rango cómodo sin despegar cadera del respaldo.",
        "empuja con todo el pie (talón + medio pie), evitando colapsar rodillas hacia adentro.",
        "extiende sin bloquear agresivamente las rodillas al final.",
      ]);
    }
    if (/hip thrust|empuje de cadera|puente de gluteo|puente de glúteo/.test(ex)) {
      return withName([
        "apoya escápulas en banco y pies firmes al ancho de cadera.",
        "mantén mentón levemente recogido y costillas controladas.",
        "eleva cadera contrayendo glúteos hasta alinear hombros-cadera-rodillas.",
        "baja lento sin perder tensión en glúteos.",
      ]);
    }
    if (/sentadilla|squat|goblet/.test(ex)) {
      const opts = [
        [
          "coloca pies al ancho de hombros y puntas ligeramente abiertas.",
          "bracea abdomen y baja llevando cadera atrás y rodillas alineadas con puntas.",
          "llega a profundidad útil sin perder columna neutra.",
          "sube empujando el piso con todo el pie, manteniendo tronco firme.",
        ],
        [
          "armá base estable con peso repartido en talón y mediopié.",
          "desciende controlado manteniendo pecho abierto y core activo.",
          "evita que las rodillas colapsen hacia adentro.",
          "asciende en bloque, cadera y torso suben juntos.",
        ],
      ];
      return withName(pick(opts));
    }
    if (/peso muerto|deadlift|rumano|hip hinge/.test(ex)) {
      return withName([
        "pies al ancho de cadera y carga cerca del cuerpo.",
        "inicia con bisagra de cadera y espalda neutra, no con flexión lumbar.",
        "baja sintiendo tensión en isquios, manteniendo barra/mancuernas pegadas.",
        "sube extendiendo cadera y contrayendo glúteos, sin hiperextender la espalda.",
      ]);
    }
    if (/press banca|bench|press pecho|press inclinado/.test(ex)) {
      return withName([
        "apoya escápulas y glúteos en banco, con pies firmes en el suelo.",
        "baja la carga con control hacia zona media-baja del pecho.",
        "mantén codos en ángulo moderado, evitando abrirlos en exceso.",
        "empuja en línea estable sin perder tensión escapular.",
      ]);
    }
    if (/remo|row/.test(ex)) {
      return withName([
        "inicia con pecho abierto y columna neutra.",
        "tirá llevando codos hacia atrás, no hacia arriba.",
        "evita balancear tronco o usar impulso de cadera.",
        "regresa controlado, manteniendo tensión en espalda.",
      ]);
    }
    if (/jalon|jalón|dominada|pull/.test(ex)) {
      return withName([
        "tomá agarre firme y deprimí escápulas antes de traccionar.",
        "lleva codos hacia costillas sin encoger hombros.",
        "acerca barra/pecho con torso estable y controlado.",
        "sube lento hasta casi extender brazos, sin perder postura.",
      ]);
    }
    if (/press militar|overhead|hombro/.test(ex)) {
      return withName([
        "estabiliza pies, glúteos y abdomen antes de iniciar.",
        "parte desde hombros con muñecas neutras y antebrazos verticales.",
        "empuja en línea vertical controlando costillas y zona lumbar.",
        "desciende lento al punto inicial manteniendo escápulas activas.",
      ]);
    }
    if (/zancada|lunge|split squat/.test(ex)) {
      return withName([
        "elige una zancada cómoda y mantén cadera estable.",
        "desciende vertical con control, evitando colapso de rodilla.",
        "mantén talón delantero apoyado durante todo el gesto.",
        "asciende empujando con la pierna delantera sin perder equilibrio.",
      ]);
    }
    if (/curl/.test(ex)) {
      return withName([
        "fijá codos cerca del torso y hombros estables.",
        "flexiona codo sin usar impulso de espalda.",
        "hacé una pausa corta arriba para máxima contracción.",
        "baja lento controlando la fase excéntrica.",
      ]);
    }
    if (/triceps|tríceps|extension/.test(ex)) {
      return withName([
        "mantén codos fijos y hombros quietos.",
        "extiende codo completo sin bloqueo brusco.",
        "sostén muñeca neutra para no cargar antebrazo.",
        "regresa controlado manteniendo tensión constante.",
      ]);
    }
    if (/abduccion|abducción|glute kick|patada de gluteo|patada de glúteo/.test(ex)) {
      return withName([
        "alinea pelvis y activa abdomen para evitar compensaciones.",
        "mové la pierna desde cadera, no desde zona lumbar.",
        "alcanza rango útil sin rotar tronco.",
        "vuelve lento para mantener tensión en glúteo medio.",
      ]);
    }
    if (/gemelo|pantorrilla|calf/.test(ex)) {
      return withName([
        "apoya metatarsos firmes y mantén rodillas estables.",
        "sube talones al máximo con pausa breve arriba.",
        "evita rebotes; el movimiento debe ser controlado.",
        "baja completo para aprovechar todo el rango de tobillo.",
      ]);
    }
    return withName([
      `ajusta una postura inicial estable específica para ${exerciseName}.`,
      "ejecuta el recorrido completo con control, sin impulso.",
      "mantén alineación articular y respiración fluida en cada repetición.",
      "finaliza con técnica limpia antes de aumentar carga o reps.",
    ]);
  };

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
        <div className="rounded-lg border border-info/20 bg-info/10 px-3 py-2">
          <p className="text-xs text-info/80">Macros</p>
          <p className="text-sm text-info">
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
        <div className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2">
          <p className="text-xs text-warning/80">Mensaje importante</p>
          <p className="text-sm text-warning mt-1">{String(root.mensaje_ajuste_objetivo)}</p>
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

      <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
        <button
          type="button"
          onClick={() => setUsefulOpen((prev) => !prev)}
          className="w-full inline-flex items-center justify-between gap-2 text-left"
        >
          <p className="text-xs text-white/60">Guía útil (referencia rápida)</p>
          <span className="text-[11px] text-emerald-200">{usefulOpen ? "Ocultar guía" : "Ver guía"}</span>
        </button>
        {usefulOpen ? (
          <div className="mt-2">
            <div className="flex gap-2 mb-2">
              <button
                type="button"
                onClick={() => setUsefulTab("training")}
                className={`px-2 py-1 rounded text-xs border ${
                  usefulTab === "training"
                    ? "bg-violet-500/25 border-violet-300/40 text-violet-100"
                    : "bg-white/5 border-white/10 text-white/70"
                }`}
              >
                Entrenamiento
              </button>
              <button
                type="button"
                onClick={() => setUsefulTab("nutrition")}
                className={`px-2 py-1 rounded text-xs border ${
                  usefulTab === "nutrition"
                    ? "bg-info/25 border-info/40 text-info"
                    : "bg-white/5 border-white/10 text-white/70"
                }`}
              >
                Alimentación
              </button>
            </div>
            {usefulTab === "training" ? (
              <div className="rounded-md border border-violet-400/20 bg-violet-500/10 px-3 py-2 text-xs text-violet-50 space-y-3">
                <div className="space-y-1">
                  <p>• Prioriza técnica correcta antes de subir peso.</p>
                  <p>• Deja 1-3 repeticiones en recámara la mayor parte del tiempo (RIR).</p>
                  <p>• Si una molestia supera 4/10, baja carga o cambia el ejercicio.</p>
                  <p>• Descansos: básicos 90-180s, accesorios 45-90s.</p>
                  <p>• Progresá poco a poco: +1-2 reps o +1-2.5 kg por semana cuando salga limpio.</p>
                </div>
                <div className="rounded border border-violet-300/20 bg-black/20 px-2 py-2 space-y-1">
                  <p className="text-violet-200 font-semibold">Palabras clave (entrenamiento)</p>
                  <p><strong>RIR:</strong> repeticiones que te quedan antes del fallo.</p>
                  <p><strong>HIT:</strong> alta intensidad en poco volumen; útil en bloques puntuales.</p>
                  <p><strong>Fallo muscular:</strong> no poder completar otra repetición con técnica correcta.</p>
                  <p><strong>Volumen:</strong> series efectivas totales por músculo y semana.</p>
                  <p><strong>Sobrecarga progresiva:</strong> aumentar gradualmente carga, reps o calidad.</p>
                  <p><strong>Deload:</strong> semana de descarga para reducir fatiga acumulada.</p>
                </div>
              </div>
            ) : (
              <div className="rounded-md border border-info/20 bg-info/10 px-3 py-2 text-xs text-info space-y-3">
                <div className="space-y-1">
                  <p>• Cumplí macros diarios: la constancia semanal manda.</p>
                  <p>• Pesá alimentos clave (proteínas, carbos base y grasas añadidas).</p>
                  <p>• Hidratación base: 30-40 ml por kg de peso al día.</p>
                  <p>• Armá el plato con proteína + carbohidrato + grasa + vegetales.</p>
                  <p>• Si tienes hambre alta: sube volumen de verduras sin tocar macros objetivo.</p>
                </div>
                <div className="rounded border border-info/20 bg-black/20 px-2 py-2 space-y-1">
                  <p className="text-info font-semibold">Palabras clave (nutrición)</p>
                  <p><strong>Macros:</strong> proteínas, carbohidratos y grasas del día.</p>
                  <p><strong>Déficit calórico:</strong> comer menos kcal que tu gasto para perder grasa.</p>
                  <p><strong>Superávit calórico:</strong> comer más kcal que tu gasto para ganar masa.</p>
                  <p><strong>Mantenimiento:</strong> kcal para sostener tu peso actual.</p>
                  <p><strong>Fibra:</strong> mejora saciedad, digestión y control glucémico.</p>
                  <p><strong>Timing:</strong> distribuir comidas alrededor del entrenamiento para rendir mejor.</p>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>

      <div className="rounded-lg border border-emerald-400/25 bg-emerald-500/10 px-3 py-2">
        <p className="text-xs text-emerald-100/80">Preguntar a mi Trainer</p>
        <p className="text-[11px] text-emerald-100/80 mt-1">
          {trainerQaIsPremium
            ? "Premium activo: consultas habilitadas."
            : `Plan gratis: ${trainerQaRemaining ?? 0}/${trainerQaMaxFree} preguntas restantes.`}
        </p>
        <textarea
          value={trainerQaQuestion}
          onChange={(e) => setTrainerQaQuestion(e.target.value)}
          rows={3}
          placeholder="Ej: ¿Cómo manejo RIR en mis básicos esta semana?"
          className="mt-2 w-full rounded-lg bg-black/20 border border-white/10 px-3 py-2 text-sm text-white placeholder-white/40"
          disabled={!trainerQaIsPremium && (trainerQaRemaining ?? 0) <= 0}
        />
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={() => void askTrainer()}
            disabled={trainerQaLoading || !trainerQaQuestion.trim() || (!trainerQaIsPremium && (trainerQaRemaining ?? 0) <= 0)}
            className="px-3 py-1.5 rounded-lg bg-emerald-500/25 border border-emerald-300/40 text-emerald-50 text-xs hover:bg-emerald-500/35 disabled:opacity-60"
          >
            {trainerQaLoading ? "Respondiendo..." : "Enviar pregunta"}
          </button>
          {!trainerQaIsPremium && (trainerQaRemaining ?? 0) <= 0 ? (
            <span className="text-[11px] text-warning">Límite alcanzado. Activá premium para continuar.</span>
          ) : null}
        </div>
        {trainerQaError ? <p className="text-xs text-danger mt-2">{trainerQaError}</p> : null}
        {trainerQaAnswer ? (
          <div className="mt-2 rounded-md border border-white/10 bg-black/20 px-3 py-2">
            <p className="text-[11px] text-emerald-200 mb-1">Respuesta del trainer</p>
            <p className="text-sm text-white/90">{trainerQaAnswer}</p>
          </div>
        ) : null}
      </div>

      {plan.includeNutrition && weeklyPlan.length > 0 && (
        <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
          <button
            type="button"
            onClick={() => setNutritionOpen((prev) => !prev)}
            className="w-full inline-flex items-center justify-between gap-2 text-left"
          >
            <p className="text-xs text-white/60">Plan de alimentación semanal</p>
            <span className="text-[11px] text-info">{nutritionOpen ? "Ocultar" : "Ver nutrición"}</span>
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
                      <p className="text-sm font-semibold text-info">{dayName}</p>
                      <span className="text-[11px] text-info">{dayOpen ? "Ocultar día" : "Ver día"}</span>
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
                          const mealPortions =
                            meal.porciones_aprox && typeof meal.porciones_aprox === "object"
                              ? (meal.porciones_aprox as Record<string, unknown>)
                              : null;
                          const mealOptionSpecific = Array.isArray(meal.porciones_opcion_aprox)
                            ? (meal.porciones_opcion_aprox as unknown[]).filter((x): x is string => typeof x === "string")
                            : [];
                          const mealPortionGuide = Array.isArray(mealPortions?.guia)
                            ? (mealPortions?.guia as unknown[]).filter((x): x is string => typeof x === "string")
                            : [];
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
                              {mealPortionGuide.length > 0 ? (
                                <p className="text-[11px] text-info/90 mt-1">
                                  Porciones aprox: {mealPortionGuide.slice(0, 3).join(" · ")}
                                </p>
                              ) : null}
                              {mealOptionSpecific.length > 0 ? (
                                <p className="text-[11px] text-violet-100/90 mt-1">
                                  Según esta opción: {mealOptionSpecific.join(" · ")}
                                </p>
                              ) : null}
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
                                  const exName = getIntakeExerciseName(exercise as Record<string, unknown>);
                                  const exTechnique = typeof exercise.technique === "string" ? exercise.technique.trim() : "";
                                  const exTechniqueSteps =
                                    exTechnique.length > 0 && !isGenericTechnique(exTechnique)
                                      ? techniqueSteps(exTechnique)
                                      : exerciseSpecificTechniqueSteps(exName);
                                  const hasTechniqueInfo = exTechniqueSteps.length > 0;
                                  const exTechKey = `wk-${weekIndex}-dy-${dayIndex}-ex-${exIndex}`;
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
                                      {hasTechniqueInfo ? (
                                        <div className="mt-1 relative inline-block">
                                          <button
                                            type="button"
                                            onClick={() => toggleTechnique(exTechKey)}
                                            title="Info técnica del ejercicio"
                                            className={`h-6 w-6 inline-flex items-center justify-center rounded-full border text-[12px] transition-all duration-200 ${
                                              openTechniqueByExercise[exTechKey]
                                                ? "border-info/70 bg-info/25 text-info shadow-[0_0_0_3px_rgba(34,211,238,0.15)] scale-105"
                                                : "border-info/35 bg-info/10 text-info hover:bg-info/20 hover:scale-105"
                                            }`}
                                          >
                                            i
                                          </button>
                                          <div
                                            className={`absolute left-8 top-0 z-20 w-[min(22rem,80vw)] rounded-lg border border-info/30 bg-slate-950/95 backdrop-blur px-2.5 py-2 space-y-1 text-[11px] text-info shadow-xl transition-all duration-200 ${
                                              openTechniqueByExercise[exTechKey]
                                                ? "opacity-100 translate-y-0 pointer-events-auto"
                                                : "opacity-0 -translate-y-1 pointer-events-none"
                                            }`}
                                          >
                                            <p className="text-[10px] uppercase tracking-wide text-info/80">Guía técnica</p>
                                              {exTechniqueSteps.map((step, idx) => (
                                                <p key={`${exTechKey}-step-${idx}`}>
                                                  <strong>Paso {idx + 1}:</strong> {step}
                                                </p>
                                              ))}
                                          </div>
                                        </div>
                                      ) : null}
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
                                        name: getIntakeExerciseName(ex as Record<string, unknown>),
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
                          const exName = getIntakeExerciseName(exercise as Record<string, unknown>);
                          const exTechnique = typeof exercise.technique === "string" ? exercise.technique.trim() : "";
                          const exTechniqueSteps =
                            exTechnique.length > 0 && !isGenericTechnique(exTechnique)
                              ? techniqueSteps(exTechnique)
                              : exerciseSpecificTechniqueSteps(exName);
                          const hasTechniqueInfo = exTechniqueSteps.length > 0;
                          const exTechKey = `fb-dy-${dayIndex}-ex-${exIndex}`;
                          const ovKeyFb = normalizeExerciseMediaKey(exName);
                          const ovFb = planMediaOverridesMerged[ovKeyFb];
                          const demoVideoFb =
                            (typeof exercise.demo_video_url === "string" ? exercise.demo_video_url : null) ||
                            (typeof ovFb?.demo_video_url === "string" ? ovFb.demo_video_url : null);
                          const demoPosterFb =
                            (typeof exercise.demo_poster_url === "string" ? exercise.demo_poster_url : null) ||
                            (typeof ovFb?.demo_poster_url === "string" ? ovFb.demo_poster_url : null);
                          return (
                            <div
                              key={`${dayName}-ex-${exIndex}`}
                              className="text-xs text-white/85 border-b border-white/5 pb-2 last:border-0 last:pb-0"
                            >
                              <p>
                                {exIndex + 1}. {exName} · {String(exercise.sets || "-")} series ·{" "}
                                {String(exercise.reps || "-")} reps
                              </p>
                              {hasTechniqueInfo ? (
                                <div className="mt-1 relative inline-block">
                                  <button
                                    type="button"
                                    onClick={() => toggleTechnique(exTechKey)}
                                    title="Info técnica del ejercicio"
                                    className={`h-6 w-6 inline-flex items-center justify-center rounded-full border text-[12px] transition-all duration-200 ${
                                      openTechniqueByExercise[exTechKey]
                                        ? "border-info/70 bg-info/25 text-info shadow-[0_0_0_3px_rgba(34,211,238,0.15)] scale-105"
                                        : "border-info/35 bg-info/10 text-info hover:bg-info/20 hover:scale-105"
                                    }`}
                                  >
                                    i
                                  </button>
                                  <div
                                    className={`absolute left-8 top-0 z-20 w-[min(22rem,80vw)] rounded-lg border border-info/30 bg-slate-950/95 backdrop-blur px-2.5 py-2 space-y-1 text-[11px] text-info shadow-xl transition-all duration-200 ${
                                      openTechniqueByExercise[exTechKey]
                                        ? "opacity-100 translate-y-0 pointer-events-auto"
                                        : "opacity-0 -translate-y-1 pointer-events-none"
                                    }`}
                                  >
                                    <p className="text-[10px] uppercase tracking-wide text-info/80">Guía técnica</p>
                                      {exTechniqueSteps.map((step, idx) => (
                                        <p key={`${exTechKey}-step-${idx}`}>
                                          <strong>Paso {idx + 1}:</strong> {step}
                                        </p>
                                      ))}
                                  </div>
                                </div>
                              ) : null}
                              {exName.length >= 2 ? (
                                <ExerciseDemoMedia
                                  exerciseName={exName}
                                  demoVideoUrl={demoVideoFb}
                                  demoPosterUrl={demoPosterFb}
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
                                name: getIntakeExerciseName(ex as Record<string, unknown>),
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
