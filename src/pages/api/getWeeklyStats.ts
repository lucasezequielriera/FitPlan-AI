import type { NextApiRequest, NextApiResponse } from "next";
import { getAdminDb } from "@/lib/firebase-admin";

interface WeeklyStatsRequest {
  planId: string;
  userId?: string;
}

interface DayStats {
  date: string;
  dayName: string;
  calories: number;
  foodsCount: number;
  foods: Array<{
    description: string;
    calories: number;
    timestamp: any;
    hour: string;
    foodIndex: number; // Índice en el array original para poder eliminar
  }>;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { planId, userId }: WeeklyStatsRequest = req.body;

  if (!planId) {
    return res.status(400).json({ error: "planId es requerido" });
  }

  try {
    // Usar Firebase Admin SDK para leer sin restricciones de permisos
    const db = getAdminDb();
    if (!db) {
      return res.status(501).json({ error: "Firebase Admin SDK no configurado" });
    }

    const planRef = db.collection("planes").doc(planId);
    const planDoc = await planRef.get();

    if (!planDoc.exists) {
      return res.status(404).json({ error: "Plan no encontrado" });
    }

    const planData = planDoc.data();
    
    if (!planData) {
      return res.status(404).json({ error: "Plan sin datos" });
    }
    
    // Verificar que el usuario es el dueño del plan (si se proporciona userId)
    // Si no hay userId, asumimos que es admin (se valida en el componente)
    if (userId && planData.userId !== userId) {
      return res.status(403).json({ error: "No tienes permiso para ver este plan" });
    }

    const trackedFoods = planData.trackedFoods || [];
    
    console.log("📊 Plan ID:", planId);
    console.log("📊 Tracked foods count:", Array.isArray(trackedFoods) ? trackedFoods.length : "No es array");
    console.log("📊 Tracked foods type:", typeof trackedFoods);
    if (Array.isArray(trackedFoods) && trackedFoods.length > 0) {
      console.log("📊 First food sample:", JSON.stringify({
        description: trackedFoods[0]?.description,
        calories: trackedFoods[0]?.calories,
        timestamp: trackedFoods[0]?.timestamp,
        timestampType: typeof trackedFoods[0]?.timestamp,
        hasToDate: typeof trackedFoods[0]?.timestamp?.toDate === 'function',
        hasSeconds: !!trackedFoods[0]?.timestamp?.seconds,
      }, null, 2));
    }

    // Calcular estadísticas de la última semana
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - 6); // Últimos 7 días (incluyendo hoy)
    weekStart.setHours(0, 0, 0, 0);

    // Agrupar comidas por día
    const daysStats: Record<string, DayStats> = {};
    
    // Nombres de días (para evitar problemas con toLocaleDateString en servidor)
    const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      const dayIndex = date.getDay();
      const dayName = dayNames[dayIndex] || 'Día';
      daysStats[dateStr] = {
        date: dateStr,
        dayName: dayName,
        calories: 0,
        foodsCount: 0,
        foods: [],
      };
    }

    // Procesar comidas registradas
    if (Array.isArray(trackedFoods)) {
      console.log("📊 Procesando", trackedFoods.length, "comidas registradas");
      let processedCount = 0;
      let skippedCount = 0;
      
      // Usar for loop para tener acceso al índice original
      for (let index = 0; index < trackedFoods.length; index++) {
        const food = trackedFoods[index];
        if (!food || typeof food !== 'object') {
          console.warn(`⚠️ Comida ${index} no es un objeto válido:`, food);
          skippedCount++;
          continue;
        }
        
        let foodDate: Date | null = null;
        
        try {
          // Firebase Admin SDK Timestamp tiene toDate()
          if (food.timestamp && typeof food.timestamp === 'object') {
            if ('toDate' in food.timestamp && typeof food.timestamp.toDate === 'function') {
              foodDate = food.timestamp.toDate();
            } else if ('seconds' in food.timestamp) {
              const ts = food.timestamp as { seconds: number; nanoseconds?: number };
              foodDate = new Date(ts.seconds * 1000 + (ts.nanoseconds || 0) / 1000000);
            } else if ('toMillis' in food.timestamp && typeof food.timestamp.toMillis === 'function') {
              foodDate = new Date(food.timestamp.toMillis());
            }
          } else if (food.timestamp instanceof Date) {
            foodDate = food.timestamp;
          } else if (typeof food.timestamp === 'string') {
            foodDate = new Date(food.timestamp);
          }

          if (!foodDate || isNaN(foodDate.getTime())) {
            console.warn(`⚠️ Comida ${index} tiene timestamp inválido:`, food.timestamp);
            skippedCount++;
            continue;
          }

          foodDate.setHours(0, 0, 0, 0);
          const dateStr = foodDate.toISOString().split('T')[0];

          // Solo incluir si está en la última semana
          if (foodDate >= weekStart && foodDate <= today) {
            if (!daysStats[dateStr]) {
              const dayIndex = foodDate.getDay();
              const dayName = dayNames[dayIndex] || 'Día';
              daysStats[dateStr] = {
                date: dateStr,
                dayName: dayName,
                calories: 0,
                foodsCount: 0,
                foods: [],
              };
            }

            const calories = typeof food.calories === 'number' ? food.calories : 0;
            daysStats[dateStr].calories += calories;
            daysStats[dateStr].foodsCount += 1;
            
            // Convertir timestamp a hora legible
            let hourStr = '';
            try {
              let foodTimestamp: Date;
              if (food.timestamp?.toDate && typeof food.timestamp.toDate === 'function') {
                foodTimestamp = food.timestamp.toDate();
              } else if (food.timestamp?.seconds) {
                const ts = food.timestamp as { seconds: number; nanoseconds?: number };
                foodTimestamp = new Date(ts.seconds * 1000 + (ts.nanoseconds || 0) / 1000000);
              } else {
                foodTimestamp = new Date();
              }
              hourStr = foodTimestamp.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
            } catch (e) {
              hourStr = '';
            }
            
            daysStats[dateStr].foods.push({
              description: food.description || 'Sin descripción',
              calories: calories,
              timestamp: food.timestamp,
              hour: hourStr,
              foodIndex: index, // Índice original en el array trackedFoods
            });
            processedCount++;
            console.log(`✅ Comida ${index} procesada: ${food.description} (${calories} kcal) - ${dateStr}`);
          } else {
            console.log(`⏭️ Comida ${index} fuera del rango de la semana: ${dateStr} (rango: ${weekStart.toISOString().split('T')[0]} - ${today.toISOString().split('T')[0]})`);
            skippedCount++;
          }
        } catch (error) {
          console.error(`❌ Error al procesar comida ${index}:`, error, food);
          skippedCount++;
        }
      }
      
      console.log(`📊 Resumen: ${processedCount} procesadas, ${skippedCount} omitidas`);
    } else {
      console.warn("⚠️ trackedFoods no es un array:", typeof trackedFoods, trackedFoods);
    }

    // Convertir a array y ordenar por fecha
    const weekStats = Object.values(daysStats).sort((a, b) => 
      a.date.localeCompare(b.date)
    );

    // Calcular estadísticas generales
    const totalCalories = weekStats.reduce((sum, day) => sum + day.calories, 0);
    const totalFoods = weekStats.reduce((sum, day) => sum + day.foodsCount, 0);
    const averageCalories = weekStats.length > 0 ? totalCalories / weekStats.length : 0;
    const daysWithFoods = weekStats.filter(day => day.foodsCount > 0).length;
    
    // Día con más calorías
    const maxDay = weekStats.length > 0 
      ? weekStats.reduce((max, day) => 
          day.calories > max.calories ? day : max, 
          weekStats[0]
        )
      : { calories: 0, date: '', dayName: '' };

    // Plan diario (del plan original)
    // La estructura puede ser: planData.plan?.plan?.calorias_diarias o planData.calorias_diarias
    let planCalories = 2000; // Valor por defecto
    try {
      if (planData.plan?.plan?.calorias_diarias) {
        planCalories = Number(planData.plan.plan.calorias_diarias) || 2000;
      } else if (planData.plan?.calorias_diarias) {
        planCalories = Number(planData.plan.calorias_diarias) || 2000;
      } else if (planData.calorias_diarias) {
        planCalories = Number(planData.calorias_diarias) || 2000;
      }
    } catch (e) {
      console.warn("Error al obtener calorías del plan:", e);
    }

    return res.status(200).json({
      weekStats,
      summary: {
        totalCalories,
        totalFoods,
        averageCalories: Math.round(averageCalories),
        daysWithFoods,
        daysWithoutFoods: 7 - daysWithFoods,
        maxDay: maxDay.calories > 0 ? {
          date: maxDay.date,
          dayName: maxDay.dayName,
          calories: maxDay.calories,
        } : null,
        planCalories,
        totalExtras: totalCalories,
        averageExtras: Math.round(averageCalories),
      },
    });
  } catch (error) {
    console.error("❌ Error al obtener estadísticas semanales:", error);
    console.error("Stack trace:", error instanceof Error ? error.stack : "No stack trace");
    return res.status(500).json({
      error: "Error al obtener estadísticas",
      detail: error instanceof Error ? error.message : String(error),
      stack: process.env.NODE_ENV === 'development' && error instanceof Error ? error.stack : undefined,
    });
  }
}

