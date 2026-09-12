import type { NextApiRequest, NextApiResponse } from "next";
import { getAdminDb } from "@/lib/firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { requireUser } from "@/lib/userAuthServer";

type UiLang = "es" | "en";

interface AnalyzeFoodRequest {
  foodDescription: string;
  planCalories: number;
  userObjective?: string;
  planId?: string;
  userId?: string;
  userTimezone?: string;
  currentHour?: number;
  /** Client UI locale — drives prompt language and model output language */
  locale?: string;
}

function uiLangFromBody(body: unknown): UiLang {
  const l = (body as AnalyzeFoodRequest)?.locale;
  return l === "en" ? "en" : "es";
}

function apiMsg(lang: UiLang, key: "foodRequired" | "caloriesRequired" | "openaiKey" | "analyzeFailed"): string {
  const m = {
    es: {
      foodRequired: "foodDescription es requerido y debe ser un texto válido",
      caloriesRequired: "planCalories es requerido y debe ser un número positivo",
      openaiKey: "OPENAI_API_KEY no configurada",
      analyzeFailed: "Error al analizar la comida",
    },
    en: {
      foodRequired: "foodDescription is required and must be non-empty text",
      caloriesRequired: "planCalories is required and must be a positive number",
      openaiKey: "OPENAI_API_KEY is not configured",
      analyzeFailed: "Could not analyze the meal",
    },
  };
  return m[lang][key];
}

function timeOfDayLabel(hour: number, lang: UiLang): string {
  if (hour >= 5 && hour < 12) return lang === "en" ? "morning" : "mañana";
  if (hour >= 12 && hour < 18) return lang === "en" ? "afternoon" : "tarde";
  if (hour >= 18 && hour < 22) return lang === "en" ? "evening" : "noche";
  return lang === "en" ? "late night" : "madrugada";
}

function buildAnalyzeFoodPrompts(params: {
  lang: UiLang;
  foodDescription: string;
  planCalories: number;
  userObjective?: string;
  hour: number;
  timeOfDay: string;
  previousFoodsToday: Array<{ description: string; calories: number }>;
  totalCaloriesToday: number;
}): { systemPrompt: string; userPrompt: string } {
  const {
    lang,
    foodDescription,
    planCalories,
    userObjective,
    hour,
    timeOfDay,
    previousFoodsToday,
    totalCaloriesToday,
  } = params;

  if (lang === "en") {
    const objectiveContext = userObjective ? `The user's goal is: ${userObjective}. ` : "";

    const systemPrompt = `You are an expert, motivational nutrition coach. Analyze off-plan meals and give practical, varied, personalized recommendations (never punitive).

Analyze the described meal and respond in JSON with:
- calories: estimated calories (be realistic and precise)
- impact: brief description of impact on the plan (1–2 sentences, motivational and specific)
- recommendations: array of 4–5 VARIED, SPECIFIC recommendations to get back on plan. You MUST include:
  * Hydration (water, tea, etc.)
  * Light physical activity (walking, stretching, etc.)
  * Adjustments for upcoming meals
  * Control techniques (breathing, mindfulness, etc.)
  * Other specifics for the time of day
- exerciseCompensation: SPECIFIC exercise or activity suggestion to offset (e.g. X-minute walk, stretching, yoga). Must vary and fit the time of day.
- motivation: short, personalized motivational message (1 sentence, varied)

CRITICAL RULES:
- Be POSITIVE and MOTIVATIONAL, never punitive
- Recommendations must be VARIED each time (do not repeat the same ones)
- Consider time of day (morning, afternoon, evening, late night) for appropriate suggestions
- ALWAYS include hydration and light activity
- If evening/late night, suggest gentler activities (light walk, stretching; no intense exercise)
- If morning/afternoon, you may suggest more active options
- Personalize to the user's goal
- Help the user, never shame them
- Be SPECIFIC (e.g. "Drink 2–3 glasses of water in the next hour" instead of "stay hydrated")

LANGUAGE: All string values you output (impact, every item in recommendations, motivation, exerciseCompensation) MUST be written entirely in English.`;

    const previousFoodsContext =
      previousFoodsToday.length > 0
        ? ` IMPORTANT: The user already logged ${previousFoodsToday.length} off-plan meal(s) today, totaling ${totalCaloriesToday} extra calories. Previous meals: ${previousFoodsToday.map((f) => `"${f.description}" (${f.calories} kcal)`).join(", ")}. Consider the ACCUMULATED impact of all meals today. The analysis should explicitly mention that this is an additional meal and how it adds to the daily total.`
        : "";

    const timeContext = `It is ${timeOfDay} (around ${hour}:00). `;

    const dayImpact =
      previousFoodsToday.length > 0
        ? `already consumed ${totalCaloriesToday} kcal extra today`
        : "first off-plan meal today";

    const userPrompt = `${objectiveContext}The user ate: "${foodDescription}". Their daily plan is ${planCalories} calories. ${timeContext}${previousFoodsContext}

Analyze this and give VARIED, SPECIFIC recommendations to get back on track, considering:
- Time of day (${timeOfDay}, ${hour}:00)
- Total day impact (${dayImpact})
- User goal (${userObjective || "not specified"})

IMPORTANT: Recommendations must be DIFFERENT and SPECIFIC each time. ALWAYS include hydration and light activity appropriate for this time of day.`;

    return { systemPrompt, userPrompt };
  }

  const objectiveContext = userObjective ? `El usuario tiene como objetivo: ${userObjective}. ` : "";

  const systemPrompt = `Eres un nutricionista experto y motivacional. Tu tarea es analizar comidas fuera del plan y dar recomendaciones prácticas, variadas y personalizadas (NO punitivas).

Analiza la comida descrita y responde en formato JSON con:
- calories: número estimado de calorías (sé realista y preciso)
- impact: descripción breve del impacto en el plan (1-2 oraciones, motivacional y específica)
- recommendations: array de 4-5 recomendaciones VARIADAS y ESPECÍFICAS para retomar el plan. DEBES incluir:
  * Hidratación (tomar agua, té, etc.)
  * Actividad física ligera (caminar, estiramientos, etc.)
  * Ajustes en las próximas comidas
  * Técnicas de control (respiración, mindfulness, etc.)
  * Otras recomendaciones específicas según el momento del día
- exerciseCompensation: sugerencia ESPECÍFICA de ejercicio o actividad física para compensar (caminata de X minutos, estiramientos, yoga, etc.). DEBE ser diferente cada vez y adaptada al momento del día.
- motivation: mensaje motivacional corto y personalizado (1 oración, variado)

REGLAS CRÍTICAS:
- Sé POSITIVO y MOTIVACIONAL, nunca punitivo
- Las recomendaciones DEBEN ser VARIADAS cada vez (no repetir las mismas)
- Considera el momento del día (mañana, tarde, noche, madrugada) para dar recomendaciones apropiadas
- Incluye SIEMPRE hidratación y actividad física ligera
- Si es noche/madrugada, sugiere actividades más suaves (caminata ligera, estiramientos, no ejercicio intenso)
- Si es mañana/tarde, puedes sugerir actividades más activas
- Personaliza según el objetivo del usuario
- El mensaje debe ayudar, no hacer sentir mal al usuario
- Sé ESPECÍFICO en las recomendaciones (ej: "Toma 2-3 vasos de agua en la próxima hora" en lugar de "hidrátate")

IDIOMA: Todo el texto que devuelvas (impact, cada ítem de recommendations, motivation, exerciseCompensation) debe estar íntegramente en español.`;

  const previousFoodsContext =
    previousFoodsToday.length > 0
      ? ` IMPORTANTE: El usuario ya ha consumido ${previousFoodsToday.length} comida(s) fuera del plan hoy, sumando ${totalCaloriesToday} calorías extras. Las comidas previas fueron: ${previousFoodsToday.map((f) => `"${f.description}" (${f.calories} kcal)`).join(", ")}. Considera el impacto ACUMULADO de todas las comidas del día. El análisis debe mencionar explícitamente que esta es una comida adicional y cómo se suma al total del día.`
      : "";

  const timeContext = `Es ${timeOfDay} (${hour}:00 horas aproximadamente). `;

  const userPrompt = `${objectiveContext}El usuario comió: "${foodDescription}". Su plan diario es de ${planCalories} calorías. ${timeContext}${previousFoodsContext} 

Analiza esto y dame recomendaciones VARIADAS y ESPECÍFICAS para retomar su plan, considerando:
- El momento del día (${timeOfDay}, ${hour}:00)
- El impacto total del día (${previousFoodsToday.length > 0 ? `ya consumió ${totalCaloriesToday} kcal extras hoy` : "primera comida fuera del plan hoy"})
- El objetivo del usuario (${userObjective || "no especificado"})

IMPORTANTE: Las recomendaciones deben ser DIFERENTES y ESPECÍFICAS cada vez. Incluye SIEMPRE hidratación y actividad física ligera apropiada para este momento del día.`;

  return { systemPrompt, userPrompt };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const lang = uiLangFromBody(req.body);
  // La identidad sale del ID token verificado, NUNCA del cuerpo (issue #27).
  const auth = await requireUser(req);
  if (!auth.ok) return res.status(auth.status).json({ error: "Identidad no verificada" });
  const userId = auth.uid;

  const { foodDescription, planCalories, userObjective, planId, userTimezone, currentHour }: AnalyzeFoodRequest = req.body;

  if (!foodDescription || typeof foodDescription !== "string" || foodDescription.trim().length === 0) {
    return res.status(400).json({ error: apiMsg(lang, "foodRequired") });
  }

  if (!planCalories || typeof planCalories !== "number" || planCalories <= 0) {
    return res.status(400).json({ error: apiMsg(lang, "caloriesRequired") });
  }

  let hour = currentHour;
  if (hour === undefined || hour === null || isNaN(hour)) {
    const now = new Date();
    if (userTimezone && typeof userTimezone === "string") {
      try {
        const formatter = new Intl.DateTimeFormat("en-US", {
          timeZone: userTimezone,
          hour: "numeric",
          hour12: false,
        });
        const parts = formatter.formatToParts(now);
        const hourPart = parts.find((part) => part.type === "hour");
        hour = hourPart ? parseInt(hourPart.value, 10) : now.getHours();
      } catch (e) {
        console.warn("Error al obtener hora con timezone:", e);
        hour = now.getHours();
      }
    } else {
      hour = now.getHours();
    }
  }

  if (hour < 0 || hour > 23) {
    hour = new Date().getHours();
  }

  const timeOfDay = timeOfDayLabel(hour, lang);

  console.log("🍔 analyzeFood - Datos recibidos:", {
    lang,
    hasFoodDescription: !!foodDescription,
    planCalories,
    hasPlanId: !!planId,
    hasUserId: !!userId,
    planId,
    userId,
    hour,
    timeOfDay,
    userTimezone,
  });

  let previousFoodsToday: Array<{ description: string; calories: number; timestamp: any }> = [];
  let totalCaloriesToday = 0;

  if (planId && userId) {
    try {
      const db = getAdminDb();
      if (db) {
        const planRef = db.collection("planes").doc(planId);
        const planDoc = await planRef.get();

        if (planDoc.exists) {
          const planData = planDoc.data();
          const trackedFoods = planData?.trackedFoods || [];

          const today = new Date();
          today.setHours(0, 0, 0, 0);

          previousFoodsToday = trackedFoods.filter((food: { timestamp: any }) => {
            let foodDate: Date;
            if (food.timestamp?.toDate && typeof food.timestamp.toDate === "function") {
              foodDate = food.timestamp.toDate();
            } else if (food.timestamp?.seconds) {
              foodDate = new Date(food.timestamp.seconds * 1000);
            } else {
              return false;
            }
            foodDate.setHours(0, 0, 0, 0);
            return foodDate.getTime() === today.getTime();
          });

          totalCaloriesToday = previousFoodsToday.reduce(
            (sum: number, food: { calories: number }) => sum + (food.calories || 0),
            0
          );
        }
      }
    } catch (error) {
      console.warn("Error al obtener comidas previas:", error);
    }
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: apiMsg(lang, "openaiKey") });
  }

  const errIncomplete = lang === "en" ? "Incomplete response from the model" : "Respuesta de OpenAI incompleta";
  const errNoContent = lang === "en" ? "No response from the model" : "No se recibió respuesta de OpenAI";

  try {
    const { systemPrompt, userPrompt } = buildAnalyzeFoodPrompts({
      lang,
      foodDescription,
      planCalories,
      userObjective,
      hour,
      timeOfDay,
      previousFoodsToday,
      totalCaloriesToday,
    });

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.9,
        max_tokens: 800,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${errorText}`);
    }

    const data = await response.json();
    const responseText = data.choices[0]?.message?.content;

    if (!responseText) {
      throw new Error(errNoContent);
    }

    const analysis = JSON.parse(responseText);

    if (!analysis.calories || !analysis.impact || !analysis.recommendations || !analysis.motivation) {
      throw new Error(errIncomplete);
    }

    if (planId && userId) {
      console.log("💾 Intentando guardar comida en Firestore...", { planId, userId });
      try {
        const db = getAdminDb();
        if (!db) {
          console.error("❌ Admin DB no disponible");
        } else {
          const planRef = db.collection("planes").doc(planId);
          const planDoc = await planRef.get();

          if (!planDoc.exists) {
            console.error("❌ Plan no encontrado:", planId);
          } else {
            const planData = planDoc.data();
            const trackedFoods = planData?.trackedFoods || [];

            console.log("📝 Comidas existentes antes de agregar:", trackedFoods.length);

            const now = Timestamp.now();

            const newFood = {
              description: foodDescription,
              calories: analysis.calories,
              timestamp: now,
              impact: analysis.impact,
              recommendations: analysis.recommendations,
              exerciseCompensation: analysis.exerciseCompensation || null,
              motivation: analysis.motivation,
            };

            trackedFoods.push(newFood);

            console.log("💾 Guardando", trackedFoods.length, "comidas en Firestore...");

            await planRef.update({
              trackedFoods,
              updatedAt: FieldValue.serverTimestamp(),
            });

            console.log("✅ Comida guardada correctamente en plan:", planId, "- Total comidas:", trackedFoods.length);
          }
        }
      } catch (error) {
        console.error("❌ Error al guardar comida en Firestore:", error);
        console.error("Stack:", error instanceof Error ? error.stack : "No stack");
      }
    } else {
      console.warn("⚠️ No se puede guardar: planId o userId faltante", { planId, userId });
    }

    return res.status(200).json({
      calories: analysis.calories,
      impact: analysis.impact,
      recommendations: Array.isArray(analysis.recommendations) ? analysis.recommendations : [analysis.recommendations],
      exerciseCompensation: analysis.exerciseCompensation || null,
      motivation: analysis.motivation,
      totalCaloriesToday: totalCaloriesToday + analysis.calories,
      previousFoodsCount: previousFoodsToday.length,
    });
  } catch (error) {
    console.error("Error al analizar comida:", error);
    return res.status(500).json({
      error: apiMsg(lang, "analyzeFailed"),
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}
