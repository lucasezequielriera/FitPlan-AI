import type { NextApiRequest, NextApiResponse } from "next";
import { FieldValue } from "firebase-admin/firestore";
import { assertIntakePublicToken } from "@/lib/intakePublicTokenServer";

const MAX_FREE_QUESTIONS = 5;

function cleanQuestion(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.trim().slice(0, 500);
}

function toInt(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return Math.max(0, Math.floor(v));
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
  }
  return 0;
}

function buildRuleBasedAnswer(question: string, ctx: {
  calories: number | null;
  macros: { p: string; f: string; c: string } | null;
  firstDayMeal?: string | null;
  firstExercise?: string | null;
  firstExerciseRestSec?: number | null;
}): string {
  const q = question.toLowerCase();
  if (/macro|calori|kcal|prote|grasa|carbo/.test(q)) {
    return `Tus objetivos diarios son ${ctx.calories ?? "N/A"} kcal${
      ctx.macros ? `, con macros aprox: proteínas ${ctx.macros.p}, grasas ${ctx.macros.f}, carbohidratos ${ctx.macros.c}.` : "."
    } Enfocate en cerrar el total diario más que en la perfección de una sola comida.`;
  }
  if (/desayuno|almuerzo|cena|comer|comida|meal|nutri/.test(q)) {
    return `Guía rápida: en cada comida buscá proteína + carbohidrato + grasa + vegetales. ${
      ctx.firstDayMeal ? `Ejemplo de tu plan: ${ctx.firstDayMeal}.` : ""
    } Si un alimento no te gusta, podés reemplazar por uno equivalente en macros.`;
  }
  if (/rir|fallo|intens|hit|series|reps|repet/.test(q)) {
    return `Para progresar sin quemarte: trabajá la mayor parte del tiempo en RIR 1-3 (no al fallo siempre). El fallo muscular usalo puntualmente en la última serie de accesorios. Priorizá técnica limpia antes de subir carga.`;
  }
  if (/descans|rest|pausa/.test(q)) {
    return `Descansos recomendados: ejercicios básicos 90-180s, accesorios 45-90s. ${
      ctx.firstExercise && ctx.firstExerciseRestSec
        ? `En tu plan, por ejemplo "${ctx.firstExercise}" puede manejarse con ~${ctx.firstExerciseRestSec}s entre series.`
        : ""
    }`;
  }
  if (/estanc|progreso|subir|peso/.test(q)) {
    return `Si te estancás, aplicá progresión simple: +1-2 reps por serie o +1-2.5 kg cuando completes el rango con buena técnica. Si llevás 2 semanas igual, mantené carga y mejorá ejecución/descanso/sueño.`;
  }
  return `Buena pregunta. Resumen práctico: seguí tu plan con constancia semanal, cerrá macros diarios, entrená con técnica y progresión gradual, y ajustá según sensaciones reales (fatiga/sueño/rendimiento). Si querés, preguntame algo más específico (RIR, descansos, macros o reemplazos).`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const clientId = typeof req.query.clientId === "string" ? req.query.clientId : "";
  const token = typeof req.query.t === "string" ? req.query.t : "";
  if (!clientId || !token) return res.status(400).json({ error: "Faltan clientId o t" });

  const auth = await assertIntakePublicToken(clientId, token);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const data = auth.intakeData;
  const isPremium = data.paymentStatus === "paid";
  const asked = toInt((data as Record<string, unknown>).trainerQaCount);
  const remaining = isPremium ? 9999 : Math.max(0, MAX_FREE_QUESTIONS - asked);

  if (req.method === "GET") {
    return res.status(200).json({
      isPremium,
      remaining,
      maxFreeQuestions: MAX_FREE_QUESTIONS,
      canAsk: isPremium || remaining > 0,
    });
  }

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!isPremium && remaining <= 0) {
    return res.status(402).json({
      error: "Límite de preguntas alcanzado. Activá premium para seguir usando el chat.",
      requiresPremium: true,
      remaining: 0,
      maxFreeQuestions: MAX_FREE_QUESTIONS,
    });
  }

  const question = cleanQuestion((req.body as Record<string, unknown>)?.question);
  if (!question) return res.status(400).json({ error: "La pregunta está vacía" });

  let calories: number | null = null;
  let macros: { p: string; f: string; c: string } | null = null;
  let firstDayMeal: string | null = null;
  let firstExercise: string | null = null;
  let firstExerciseRestSec: number | null = null;
  try {
    const latestPlanId = typeof data.latestPlanId === "string" ? data.latestPlanId : "";
    if (latestPlanId) {
      const planSnap = await auth.db.collection("intakeClientPlans").doc(latestPlanId).get();
      const planData = (planSnap.data()?.plan || {}) as Record<string, unknown>;
      calories = typeof planData.calorias_diarias === "number" ? planData.calorias_diarias : null;
      const mm = planData.macros && typeof planData.macros === "object" ? (planData.macros as Record<string, unknown>) : null;
      macros = mm
        ? {
            p: String(mm.proteinas || "-"),
            f: String(mm.grasas || "-"),
            c: String(mm.carbohidratos || "-"),
          }
        : null;
      const weekly = Array.isArray(planData.plan_semanal) ? (planData.plan_semanal as Array<Record<string, unknown>>) : [];
      const meals = weekly[0] && Array.isArray(weekly[0].comidas) ? (weekly[0].comidas as Array<Record<string, unknown>>) : [];
      if (meals[0]) {
        const op = Array.isArray(meals[0].opciones) ? String((meals[0].opciones as unknown[])[0] || "") : "";
        firstDayMeal = op || null;
      }
      const training = planData.training_plan && typeof planData.training_plan === "object" ? (planData.training_plan as Record<string, unknown>) : null;
      const weeks = training && Array.isArray(training.weeks) ? (training.weeks as Array<Record<string, unknown>>) : [];
      const days = weeks[0] && Array.isArray(weeks[0].days) ? (weeks[0].days as Array<Record<string, unknown>>) : [];
      const exs = days[0] && Array.isArray(days[0].ejercicios) ? (days[0].ejercicios as Array<Record<string, unknown>>) : [];
      if (exs[0]) {
        firstExercise = typeof exs[0].name === "string" ? exs[0].name : null;
        firstExerciseRestSec = typeof exs[0].rest_seconds === "number" ? exs[0].rest_seconds : null;
      }
    }
  } catch {
    // noop
  }

  const answer = buildRuleBasedAnswer(question, { calories, macros, firstDayMeal, firstExercise, firstExerciseRestSec });

  const nextCount = isPremium ? asked : asked + 1;
  const nextRemaining = isPremium ? 9999 : Math.max(0, MAX_FREE_QUESTIONS - nextCount);
  await auth.db.collection("intakeClients").doc(clientId).set(
    {
      trainerQaCount: nextCount,
      trainerQaLastAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  await auth.db.collection("intakeClients").doc(clientId).collection("trainerQaHistory").add({
    question,
    answer,
    isPremium,
    createdAt: FieldValue.serverTimestamp(),
  });

  return res.status(200).json({
    answer,
    isPremium,
    remaining: nextRemaining,
    maxFreeQuestions: MAX_FREE_QUESTIONS,
    requiresPremium: false,
  });
}

