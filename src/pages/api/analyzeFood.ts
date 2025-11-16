import type { NextApiRequest, NextApiResponse } from "next";
import { getAdminDb } from "@/lib/firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

interface AnalyzeFoodRequest {
  foodDescription: string;
  planCalories: number;
  userObjective?: string;
  planId?: string;
  userId?: string;
  userTimezone?: string; // Zona horaria del usuario (ej: "America/Argentina/Buenos_Aires")
  currentHour?: number; // Hora actual del usuario (0-23)
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { foodDescription, planCalories, userObjective, planId, userId, userTimezone, currentHour }: AnalyzeFoodRequest = req.body;

  // Obtener hora actual si no se proporciona
  let hour = currentHour;
  if (hour === undefined) {
    const now = new Date();
    // Si hay timezone, convertir a esa zona, sino usar hora local del servidor
    if (userTimezone) {
      try {
        // Obtener la hora en la zona horaria del usuario
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

  // Determinar momento del día
  let timeOfDay = "";
  if (hour >= 5 && hour < 12) {
    timeOfDay = "mañana";
  } else if (hour >= 12 && hour < 18) {
    timeOfDay = "tarde";
  } else if (hour >= 18 && hour < 22) {
    timeOfDay = "noche";
  } else {
    timeOfDay = "madrugada";
  }

  console.log("🍔 analyzeFood - Datos recibidos:", {
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

  if (!foodDescription || !planCalories) {
    return res.status(400).json({ error: "foodDescription y planCalories son requeridos" });
  }

  // Obtener comidas previas del día si hay planId
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
          
          // Filtrar comidas del día actual
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          previousFoodsToday = trackedFoods.filter((food: { timestamp: any }) => {
            let foodDate: Date;
            if (food.timestamp?.toDate && typeof food.timestamp.toDate === 'function') {
              foodDate = food.timestamp.toDate();
            } else if (food.timestamp?.seconds) {
              foodDate = new Date(food.timestamp.seconds * 1000);
            } else {
              return false;
            }
            foodDate.setHours(0, 0, 0, 0);
            return foodDate.getTime() === today.getTime();
          });
          
          totalCaloriesToday = previousFoodsToday.reduce((sum: number, food: { calories: number }) => sum + (food.calories || 0), 0);
        }
      }
    } catch (error) {
      console.warn("Error al obtener comidas previas:", error);
      // Continuar sin las comidas previas
    }
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: "OPENAI_API_KEY no configurada" });
  }

  try {
    const objectiveContext = userObjective 
      ? `El usuario tiene como objetivo: ${userObjective}. `
      : "";

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
- Sé ESPECÍFICO en las recomendaciones (ej: "Toma 2-3 vasos de agua en la próxima hora" en lugar de "hidrátate")`;

    const previousFoodsContext = previousFoodsToday.length > 0
      ? ` IMPORTANTE: El usuario ya ha consumido ${previousFoodsToday.length} comida(s) fuera del plan hoy, sumando ${totalCaloriesToday} calorías extras. Las comidas previas fueron: ${previousFoodsToday.map((f: { description: string; calories: number }) => `"${f.description}" (${f.calories} kcal)`).join(", ")}. Considera el impacto ACUMULADO de todas las comidas del día. El análisis debe mencionar explícitamente que esta es una comida adicional y cómo se suma al total del día.`
      : "";

    const timeContext = `Es ${timeOfDay} (${hour}:00 horas aproximadamente). `;
    
    const userPrompt = `${objectiveContext}El usuario comió: "${foodDescription}". Su plan diario es de ${planCalories} calorías. ${timeContext}${previousFoodsContext} 

Analiza esto y dame recomendaciones VARIADAS y ESPECÍFICAS para retomar su plan, considerando:
- El momento del día (${timeOfDay}, ${hour}:00)
- El impacto total del día (${previousFoodsToday.length > 0 ? `ya consumió ${totalCaloriesToday} kcal extras hoy` : 'primera comida fuera del plan hoy'})
- El objetivo del usuario (${userObjective || 'no especificado'})

IMPORTANTE: Las recomendaciones deben ser DIFERENTES y ESPECÍFICAS cada vez. Incluye SIEMPRE hidratación y actividad física ligera apropiada para este momento del día.`;

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
        temperature: 0.9, // Aumentado para más variedad en las respuestas
        max_tokens: 800, // Aumentado para respuestas más detalladas
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${errorText}`);
    }

    const data = await response.json();
    const responseText = data.choices[0]?.message?.content;
    
    if (!responseText) {
      throw new Error("No se recibió respuesta de OpenAI");
    }

    const analysis = JSON.parse(responseText);

    // Validar estructura
    if (!analysis.calories || !analysis.impact || !analysis.recommendations || !analysis.motivation) {
      throw new Error("Respuesta de OpenAI incompleta");
    }

    // Guardar en Firestore si hay planId (usando Admin SDK)
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
            
            // Crear timestamp usando Timestamp.now() (no se puede usar FieldValue.serverTimestamp() dentro de arrays)
            const now = Timestamp.now();
            
            // Agregar nueva comida
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
        // Continuar aunque falle guardar - el usuario debe ver el análisis
      }
    } else {
      console.warn("⚠️ No se puede guardar: planId o userId faltante", { planId, userId });
    }

    return res.status(200).json({
      calories: analysis.calories,
      impact: analysis.impact,
      recommendations: Array.isArray(analysis.recommendations) 
        ? analysis.recommendations 
        : [analysis.recommendations],
      exerciseCompensation: analysis.exerciseCompensation || null,
      motivation: analysis.motivation,
      totalCaloriesToday: totalCaloriesToday + analysis.calories,
      previousFoodsCount: previousFoodsToday.length,
    });
  } catch (error) {
    console.error("Error al analizar comida:", error);
    return res.status(500).json({
      error: "Error al analizar la comida",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}

