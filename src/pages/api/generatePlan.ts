import type { NextApiRequest, NextApiResponse } from "next";
import type { UserInput } from "@/types/plan";
import { generateTemplateBasedPlan, type PlanGenerationLocale } from "@/lib/templatePlans";
import { ensureMealMacrosAprox } from "@/lib/mealMacros";
import { getAdminDb } from "@/lib/firebase-admin";
import { calculateBMR, clampCaloriesToSafeFloor } from "@/utils/calculations";
import { requireUser } from "@/lib/userAuthServer";
import { PROHIBITED_HERNIA, PROHIBITED_LUMBAR, PROHIBITED_KNEE, PROHIBITED_SHOULDER } from "@/lib/trainingPlanGuards";

// Interface para contexto multi-fase
interface ContextoMultiFase {
  mesActual: number;
  totalMeses: number;
  faseActual: "BULK" | "CUT" | "LEAN_BULK" | "MANTENIMIENTO";
  pesoInicial: number;
  pesoObjetivoFinal: number;
  ajustesRecomendados: string[];
  feedbackUsuario?: string;
  cambiaFase: boolean;
}

function improveAlternativeForExercise(
  exerciseNameRaw: unknown,
  alternativeRaw: unknown,
  locale: PlanGenerationLocale = "es"
): string {
  const exerciseName = typeof exerciseNameRaw === "string" ? exerciseNameRaw.trim() : locale === "en" ? "Exercise" : "Ejercicio";
  const alt = typeof alternativeRaw === "string" ? alternativeRaw.trim() : "";
  const ex = exerciseName.toLowerCase();
  const altLower = alt.toLowerCase();
  const isWeakBandOnly =
    altLower.includes("banda") &&
    (altLower.includes(ex.split(" ")[0] || "") || altLower.includes("mismo") || altLower.includes("igual"));
  const isGeneric =
    !alt ||
    altLower === "n/a" ||
    altLower === "-" ||
    altLower.includes("opcional") ||
    altLower.includes("optional") ||
    altLower.includes("según disponibilidad");
  if (!isGeneric && !isWeakBandOnly) return alt;

  const en = locale === "en";
  if (/sentadilla|squat/.test(ex)) return en ? "Leg press 45° or goblet squat with dumbbell." : "Prensa 45° o sentadilla goblet con mancuerna.";
  if (/peso muerto|deadlift|rumano/.test(ex)) return en ? "Hip hinge with light dumbbell or hip thrust, neutral spine." : "Hip thrust o bisagra con mancuerna ligera, priorizando columna neutra.";
  if (/press banca|bench|press pecho/.test(ex)) return en ? "Dumbbell bench press or incline push-ups." : "Press con mancuernas en banco o flexiones inclinadas.";
  if (/press militar|overhead|hombro/.test(ex)) return en ? "Seated dumbbell press or landmine press." : "Press con mancuernas sentado o landmine press.";
  if (/remo|row/.test(ex)) return en ? "Chest-supported machine row or lat pulldown." : "Remo en máquina con apoyo de pecho o jalón en polea.";
  if (/dominada|pull[- ]?up|jalon|jalón/.test(ex)) return en ? "Lat pulldown with neutral grip." : "Jalón al pecho en polea con agarre neutro.";
  if (/zancada|lunge/.test(ex)) return en ? "Assisted split squat or single-leg press." : "Split squat asistido o prensa unilateral.";
  if (/curl/.test(ex)) return en ? "Low-cable curl or alternating dumbbell curls." : "Curl en polea baja o curl alternado con mancuernas.";
  if (/triceps|tríceps|fondos/.test(ex)) return en ? "Triceps rope pushdown." : "Extensión de tríceps en polea con cuerda.";
  if (/abdominal|core|plancha/.test(ex)) return en ? "Dead bug or knee-supported plank." : "Dead bug o plancha con apoyo de rodillas.";
  return en
    ? "Stable machine or dumbbell version of the same pattern, lighter load, strict technique."
    : "Versión en máquina o mancuerna estable del mismo patrón, con menor carga y control técnico.";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const locale: PlanGenerationLocale = (req.body as { locale?: string }).locale === "en" ? "en" : "es";

  const input = req.body as UserInput & { 
    _contextoMultiFase?: ContextoMultiFase;
    _tdeeCalculado?: number;
    _caloriasObjetivo?: number;
    _bmrCalculado?: number;
    _macrosObjetivo?: {
      proteinas: string;
      grasas: string;
      carbohidratos: string;
      _detalles?: {
        proteinaPorKg: number;
        proteinasKcal: number;
        grasasPct: number;
        grasasKcal: number;
        carbsKcal: number;
      };
    };
  };
  const contextoMultiFase = input._contextoMultiFase;
  
  // Valores precalculados del frontend (para consistencia con proyección)
  const tdeeDelFrontend = input._tdeeCalculado;
  // Defensa en profundidad: create-plan.tsx ya aplica un piso de seguridad de
  // calorías, pero se re-verifica acá server-side por si algún llamador futuro
  // no pasa por ese flujo (ver clampCaloriesToSafeFloor en utils/calculations.ts).
  const bmrParaClampServer =
    input._bmrCalculado ??
    (input.pesoKg && input.alturaCm && input.edad && input.sexo
      ? calculateBMR(input.pesoKg, input.alturaCm, input.edad, input.sexo)
      : undefined);
  const caloriasObjetivoDelFrontend =
    input._caloriasObjetivo && bmrParaClampServer && input.sexo
      ? clampCaloriesToSafeFloor(input._caloriasObjetivo, bmrParaClampServer, input.sexo)
      : input._caloriasObjetivo;
  const macrosDelFrontend = input._macrosObjetivo;
  // Datos nuevos de versión de plantillas
  const diasGymUsuario = input.diasGym;
  const diasCardioUsuario = input.diasCardio;
  const nivelUsuario = input.nivelExperiencia;
  const equipamientoUsuario = input.equipamiento;
  if (diasGymUsuario !== undefined || diasCardioUsuario !== undefined || nivelUsuario || equipamientoUsuario) {
    console.log("📌 [INPUT] diasGym", diasGymUsuario, "diasCardio", diasCardioUsuario, "nivel", nivelUsuario, "equipo", equipamientoUsuario);
  }
  
  // Log de valores precalculados
  if (tdeeDelFrontend || caloriasObjetivoDelFrontend) {
    console.log("📊 [NUTRICIÓN] Valores precalculados del frontend:");
    console.log("📊 [NUTRICIÓN] TDEE:", tdeeDelFrontend, "kcal");
    console.log("📊 [NUTRICIÓN] Calorías objetivo:", caloriasObjetivoDelFrontend, "kcal");
    if (macrosDelFrontend) {
      console.log("📊 [NUTRICIÓN] Macros:", macrosDelFrontend.proteinas, "proteína,", macrosDelFrontend.carbohidratos, "carbos,", macrosDelFrontend.grasas, "grasa");
    }
  }
  
  // Asegurar valores por defecto
  input.duracionDias = 30; // Siempre 30 días (plan mensual)
  input.intensidad = input.intensidad || "moderada";
  
  // Log para planes multi-fase
  if (contextoMultiFase) {
    console.log("📋 [MULTI-FASE] Generando mes", contextoMultiFase.mesActual, "de", contextoMultiFase.totalMeses);
    console.log("📋 [MULTI-FASE] Fase:", contextoMultiFase.faseActual);
    console.log("📋 [MULTI-FASE] Ajustes recomendados:", contextoMultiFase.ajustesRecomendados);
    if (contextoMultiFase.cambiaFase) {
      console.log("📋 [MULTI-FASE] ⚠️ CAMBIO DE FASE DETECTADO");
    }
  }

  // Log detallado para diagnóstico de "definicion"
  const isDefinicion = input.objetivo === "definicion";
  if (isDefinicion) {
    console.log("🔍 [DEFINICIÓN] Iniciando generación de plan para Definición Extrema");
    console.log("🔍 [DEFINICIÓN] Datos recibidos:", {
      objetivo: input.objetivo,
      intensidad: input.intensidad,
      tipoDieta: input.tipoDieta,
      pesoKg: input.pesoKg,
      alturaCm: input.alturaCm,
      edad: input.edad,
      atletico: input.atletico,
      preferirRutina: input.preferirRutina,
      restricciones: input.restricciones,
      preferencias: input.preferencias,
      patologias: input.patologias,
      doloresLesiones: input.doloresLesiones,
    });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  
  // ============================================================================
  // VERIFICAR SI EL USUARIO ES PREMIUM PARA DECIDIR: TEMPLATES VS OPENAI
  // ============================================================================
  // Identidad OPCIONAL: este endpoint sirve también a quien no ha iniciado
  // sesión (cae a plantillas estáticas). Pero el `userId` NO puede venir del
  // cuerpo: con el UID de un usuario premium, cualquiera obtenía generación
  // con IA gratis a su costa (issue #27). Sin token válido se trata como
  // anónimo, que es exactamente el comportamiento de un usuario free.
  const authOpcional = await requireUser(req);
  const userId = authOpcional.ok ? authOpcional.uid : undefined;
  let isPremium = false;
  
  // Obtener estado premium del usuario si está disponible
  if (userId) {
    try {
      const adminDb = getAdminDb();
      if (adminDb) {
        const userDoc = await adminDb.collection("usuarios").doc(userId).get();
        isPremium = Boolean(userDoc.exists ? (userDoc.data()?.premium ?? false) : false);
        console.log(`👤 Estado del usuario (admin): ${isPremium ? "PREMIUM ✨" : "FREE 🆓"}`);
      } else {
        console.warn("⚠️ Firebase Admin no disponible, asumiendo FREE para evitar fallos");
      }
    } catch (error) {
      console.warn("⚠️ No se pudo verificar estado premium, asumiendo FREE:", error instanceof Error ? error.message : String(error));
      isPremium = false;
    }
  }

  // ============================================================================
  // MODO 1: USUARIOS GRATUITOS - TEMPLATES (Sin costo, instantáneo)
  // ============================================================================
  if (!isPremium) {
    console.log("🆓 [TEMPLATES] Generando plan sin IA para usuario FREE...");
    try {
      const plan = await generateTemplateBasedPlan(
        input,
        tdeeDelFrontend || 2000,
        caloriasObjetivoDelFrontend || 2000,
        macrosDelFrontend || { proteinas: "150g", grasas: "70g", carbohidratos: "240g" },
        locale
      );
      console.log("✅ [TEMPLATES] Plan generado con éxito sin IA");
      console.log("📋 [TEMPLATES] Training plan generado:", !!plan.training_plan, "- Semanas:", plan.training_plan?.weeks?.length || 0);
      if (plan.training_plan?.weeks && plan.training_plan.weeks.length > 0) {
        console.log("📋 [TEMPLATES] Primera semana - Días:", plan.training_plan.weeks[0].days?.length || 0);
      }
      return res.status(200).json({
        ...plan,
        _planType: "template", // Indicar que fue generado con templates
        _message: "Plan generado con plantillas inteligentes. Actualiza a Premium para planes personalizados con IA."
      });
    } catch (error) {
      console.error("❌ [TEMPLATES] Error al generar plan con templates:", error instanceof Error ? error.message : String(error));
      return res.status(500).json({
        error: "Error generando plan",
        detail: error instanceof Error ? error.message : "Error desconocido con templates"
      });
    }
  }

  // ============================================================================
  // MODO 2: USUARIOS PREMIUM - OPENAI (Personalización máxima)
  // ============================================================================
  if (!apiKey) {
    console.warn("⚠️ Usuario PREMIUM pero OpenAI no configurada. Fallback a templates...");
    try {
      const plan = await generateTemplateBasedPlan(
        input,
        tdeeDelFrontend || 2000,
        caloriasObjetivoDelFrontend || 2000,
        macrosDelFrontend || { proteinas: "150g", grasas: "70g", carbohidratos: "240g" },
        locale
      );
      console.log("✅ Fallback a templates exitoso");
      return res.status(200).json({
        ...plan,
        _planType: "template_fallback",
        _message: "Plan generado con templates (OpenAI no disponible)"
      });
    } catch (error) {
      return res.status(503).json({ error: "OPENAI_API_KEY no configurada y templates fallaron" });
    }
  }

  console.log("✨ [PREMIUM] Generando plan personalizado con OpenAI para usuario PREMIUM...");

  try {
    // Prompt mejorado: estructura clara y específica
    const localePromptPrefix =
      locale === "en"
        ? `🔴 OUTPUT LANGUAGE: ENGLISH ONLY. The entire JSON response must be in English. Use weekday names: Monday through Sunday. Each day must have exactly 4 meals named: Breakfast, Lunch, Snack, Dinner (in that order). All exercise names, descriptions, shopping list, motivational message, projections, weekly notes, and training_plan fields must be English.\n\n`
        : "";

    const prompt = `${localePromptPrefix}⚠️ PRIORIDAD MÁXIMA: El campo "plan_semanal" es OBLIGATORIO y DEBE generarse primero y completo.

Genera un plan de alimentación semanal completo en JSON válido (sin texto extra, solo JSON).

IMPORTANTE: El campo "plan_semanal" es el más crítico. DEBES generar EXACTAMENTE 7 días (${locale === "en" ? "Monday through Sunday (English names)" : "Lunes, Martes, Miércoles, Jueves, Viernes, Sábado, Domingo"}), cada uno con 4 comidas (${locale === "en" ? "Breakfast, Lunch, Snack, Dinner" : "Desayuno, Almuerzo, Snack, Cena"}), y cada comida con 3 opciones descriptivas y reales. Si no puedes generar "plan_semanal" completo, el JSON será rechazado.

${input.restricciones && input.restricciones.length > 0 
  ? `🚫 CRÍTICO - RESTRICCIONES DEL USUARIO: El usuario tiene estas restricciones que DEBEN ser ABSOLUTAMENTE EXCLUIDAS:
${input.restricciones.map(r => `- ${r}`).join('\n')}
ANTES de generar CUALQUIER opción de comida, VERIFICA que NO contenga NINGUNA de estas restricciones. Si una restricción es "pescados", NO incluir atún, salmón, merluza, ni NINGÚN pescado. Si es "gluten", NO incluir trigo, cebada, ni derivados. Si es "lácteos", NO incluir leche, queso, yogurt, ni derivados.`
  : ''}

${caloriasObjetivoDelFrontend ? `⚠️⚠️⚠️ NUTRICIÓN PRECALCULADA - OBLIGATORIO USAR:
El sistema ha calculado los valores nutricionales basándose en los datos exactos del usuario.

📊 VALORES OBLIGATORIOS:
- TDEE (mantenimiento): ${tdeeDelFrontend} kcal/día
- CALORÍAS OBJETIVO: ${caloriasObjetivoDelFrontend} kcal/día
${macrosDelFrontend ? `- PROTEÍNAS: ${macrosDelFrontend.proteinas} (${macrosDelFrontend._detalles?.proteinaPorKg || 2}g/kg)
- CARBOHIDRATOS: ${macrosDelFrontend.carbohidratos}
- GRASAS: ${macrosDelFrontend.grasas} (${macrosDelFrontend._detalles?.grasasPct || 28}% de calorías)` : ''}

⚠️ DEBES usar EXACTAMENTE estos valores en tu respuesta:
- "calorias_diarias": ${caloriasObjetivoDelFrontend}
${macrosDelFrontend ? `- "macros": { "proteinas": "${macrosDelFrontend.proteinas}", "grasas": "${macrosDelFrontend.grasas}", "carbohidratos": "${macrosDelFrontend.carbohidratos}" }` : ''}

NO calcules las calorías ni macros por tu cuenta. Estos valores ya consideran:
- Peso, altura, edad y sexo del usuario
- Objetivo específico (${input.objetivo})
- Intensidad seleccionada (${input.intensidad})
- Días de actividad física

Las comidas deben distribuirse para alcanzar EXACTAMENTE este total diario y macros.
Cada comida en plan_semanal DEBE incluir "macros_aprox": { "proteinas_g", "grasas_g", "carbohidratos_g" } en gramos (números) que sumen aproximadamente los macros diarios obligatorios.
` : ''}
ESQUEMA OBLIGATORIO (ORDEN IMPORTANTE - GENERAR plan_semanal PRIMERO):
{
  "calorias_diarias": ${caloriasObjetivoDelFrontend || 'number'},
  "macros": { "proteinas": "Ng", "grasas": "Ng", "carbohidratos": "Ng" },
  "distribucion_diaria_pct": { "desayuno": number, "almuerzo": number, "snacks": number, "cena": number },
  "plan_semanal": [
    {
      "dia": "Lunes",
      "comidas": [
        { "hora": "08:00", "nombre": "Desayuno", "opciones": ["Avena con frutos rojos y miel", "Tostadas integrales con aguacate y huevo", "Yogurt griego con granola y frutas"], "calorias_kcal": number, "cantidad_gramos": number, "macros_aprox": { "proteinas_g": number, "grasas_g": number, "carbohidratos_g": number } },
        { "hora": "13:00", "nombre": "Almuerzo", "opciones": ["Pollo a la plancha con arroz integral", "Salmón al horno con quinoa", "Ensalada de garbanzos con vegetales"], "calorias_kcal": number, "cantidad_gramos": number, "macros_aprox": { "proteinas_g": number, "grasas_g": number, "carbohidratos_g": number } },
        { "hora": "17:00", "nombre": "Snack", "opciones": ["Batido de proteína con plátano", "Frutos secos y una manzana", "Huevo duro con palitos de zanahoria"], "calorias_kcal": number, "cantidad_gramos": number, "macros_aprox": { "proteinas_g": number, "grasas_g": number, "carbohidratos_g": number } },
        { "hora": "20:00", "nombre": "Cena", "opciones": ["Pescado al vapor con verduras", "Tortilla de claras con espinacas", "Ensalada mixta con pollo desmenuzado"], "calorias_kcal": number, "cantidad_gramos": number, "macros_aprox": { "proteinas_g": number, "grasas_g": number, "carbohidratos_g": number } }
      ]
    }
  ],
  "minutos_sesion_gym": number,
  "dificultad": "facil" | "media" | "dificil",
  "dificultad_detalle": string,
  "cambios_semanales": {
    "semana1": string,
    "semana2": string,
    "semana3_4": string,
    "post_mes": string,
    "fisiologia": string[]
  },
  "training_plan": {
    "split": string (OBLIGATORIO: tipo de división de entrenamiento según días de gym y objetivo: "Full Body", "Upper/Lower", "Push/Pull/Legs", "Push/Pull", "Bro Split", etc.),
    "week_order_rationale": string (OBLIGATORIO: por qué este orden de días y de ejercicios; descansos; prioridad de grupos),
    "weeks": [
      {
        "week": number (1-4),
        "days": [
          {
            "day": "Lunes" | "Martes" | "Miércoles" | "Jueves" | "Viernes" | "Sábado" | "Domingo",
            "split": string (OBLIGATORIO: tipo de entrenamiento de este día específico según el split general: "Full Body", "Upper", "Lower", "Push", "Pull", "Legs", "Chest & Triceps", "Back & Biceps", etc.),
            "warmup": {
              "duration_minutes": number (tiempo de calentamiento en minutos: 5-10 min si no hay lesiones, 10-15 min si hay lesiones),
              "description": string (descripción detallada del calentamiento específico para este día, incluyendo movilidad para zonas afectadas si hay lesiones)
            } (OBLIGATORIO: calentamiento específico para cada día),
            "ejercicios": [
              {
                "name": string (nombre descriptivo del ejercicio),
                "sets": number (3-4 series típicamente),
                "reps": string | number (ej: "8-12", "10-15"),
                "muscle_group": string (músculo o grupo muscular principal trabajado, OBLIGATORIO: "Pecho", "Espalda", "Piernas", "Hombros", "Bíceps", "Tríceps", "Cuádriceps", "Isquiotibiales", "Glúteos", "Abdominales", "Trapecio", "Gemelos", etc.),
                "rpe": number (OPCIONAL pero RECOMENDADO: RPE 1-10, donde 10 = máximo esfuerzo. Para hipertrofia: 7-9. Para fuerza: 8-10. Para principiantes: 6-8),
                "tempo": string (OPCIONAL pero RECOMENDADO: tempo del movimiento, ej: "2-0-1-0" = 2s excéntrico, 0s pausa, 1s concéntrico, 0s pausa. Para hipertrofia: control excéntrico 2-3s. Para fuerza: explosivo 1-0-1-0),
                "rest_seconds": number (OPCIONAL pero RECOMENDADO: descanso entre series en segundos. Hipertrofia: 60-90s. Fuerza: 2-5min. Principiantes: 60-90s),
                "technique": string (OPCIONAL pero RECOMENDADO: puntos clave de técnica para principiantes Y avanzados, ej: "Principiante: Mantén la espalda recta, baja controlado. Avanzado: Aplica tensión constante, activa glúteos al subir"),
                "progression": string (OPCIONAL pero RECOMENDADO: cómo progresar, ej: "Semana 1-2: 8-10 reps. Semana 3-4: Aumenta peso 2.5-5kg y haz 6-8 reps"),
                "alternative": string (OPCIONAL: ejercicio alternativo si hay lesión o falta de equipo, ej: "Si tienes dolor lumbar: usa prensa 45° en lugar de sentadillas"),
                "cues": string[] (OPCIONAL pero RECOMENDADO: 2-3 pistas mentales para ejecución correcta, ej: ["Mantén el core activo", "Empuja con los talones", "Espalda neutra"])
              }
            ] (MÍNIMO 6-8 ejercicios por día, lista completa. Para usuarios con lesiones, incluir "alternative" y ajustar técnica)
          }
        ] (número de días según recomendaciones calculadas, PERO AJUSTADO SEGÚN LESIONES: ${(() => {
          try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const { sugerirEntrenamiento } = require("@/utils/calculations");
            const bmi = input.alturaCm && input.pesoKg ? (input.pesoKg / Math.pow(input.alturaCm / 100, 2)) : 25;
            const recomendaciones = sugerirEntrenamiento(input.objetivo, input.intensidad || "moderada", input.edad, bmi, input.atletico || false);
            let diasGymSugeridos = (input as unknown as Record<string, unknown>)?.diasGym as number | undefined ?? recomendaciones.diasGym;
            
            // Ajustar días de gym según lesiones reportadas
            if (input.doloresLesiones && input.doloresLesiones.length > 0) {
              const lesionesGraves = input.doloresLesiones.some((d) => 
                d.toLowerCase().includes('hernia') && d.toLowerCase().includes('disco') ||
                d.toLowerCase().includes('hernia discal') ||
                d.toLowerCase().includes('fractura') ||
                d.toLowerCase().includes('desgarro')
              );
              const lesionesModeradas = input.doloresLesiones.some((d) =>
                d.toLowerCase().includes('lumbar') ||
                d.toLowerCase().includes('espalda baja') ||
                d.toLowerCase().includes('rodilla') ||
                d.toLowerCase().includes('hombro') ||
                d.toLowerCase().includes('manguito')
              );
              
              if (lesionesGraves) {
                diasGymSugeridos = Math.min(2, diasGymSugeridos); // Máximo 2 días para lesiones graves
              } else if (lesionesModeradas) {
                diasGymSugeridos = Math.min(3, diasGymSugeridos); // Máximo 3 días para lesiones moderadas
              } else {
                diasGymSugeridos = Math.min(4, diasGymSugeridos); // Máximo 4 días para lesiones leves
              }
            }
            
            return diasGymSugeridos;
          } catch {
            let diasGymDefault = (input as unknown as Record<string, unknown>)?.diasGym as number | undefined ?? 3;
            // Ajustar según lesiones
            if (input.doloresLesiones && input.doloresLesiones.length > 0) {
              const lesionesGraves = input.doloresLesiones.some((d) => 
                d.toLowerCase().includes('hernia') && d.toLowerCase().includes('disco')
              );
              if (lesionesGraves) {
                diasGymDefault = Math.min(2, diasGymDefault);
              } else {
                diasGymDefault = Math.min(3, diasGymDefault);
              }
            }
            return diasGymDefault;
          }
        })()} días exactos, con MÍNIMO 1 día de descanso entre sesiones si hay lesiones reportadas)
      }
    ] (EXACTAMENTE 4 semanas, cada una con ejercicios VARIADOS y diferentes)
  },
  "duracion_plan_dias": 30,
  "progresion_semanal": [ { "semana": number, "ajuste_calorias_pct": number, "motivo": string } ],
  "lista_compras": string[],
  "mensaje_motivacional": string,
  "proyecciones": {
    "musculoGananciaMensual": string (solo si objetivo es ganar_masa, volumen o recomposicion, ej: "1.5-2.5 kg" o "0.5-1 kg"),
    "grasaPerdidaMensual": string (solo si objetivo es perder_grasa o corte, ej: "1-2 kg" o "0.5-1 kg"),
    "proyecciones": string[] (array de 5-8 proyecciones específicas y personalizadas basadas en el perfil del usuario),
    "tiempoEstimado": string (tiempo estimado para ver resultados según intensidad: "1-3 meses" para intensa, "3 meses" para moderada, "3-5 meses" para leve)
  }
}

REGLAS CRÍTICAS:
1. "plan_semanal" DEBE tener EXACTAMENTE 7 días en este orden: ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]
2. Cada día DEBE tener EXACTAMENTE 4 comidas con estos nombres exactos (case-sensitive):
   - "Desayuno" (no "desayuno" ni "Desayuno principal")
   - "Almuerzo" (no "almuerzo" ni "Almuerzo principal")
   - "Snack" (puede ser "Snack" o "Merienda", pero normaliza a "Snack")
   - "Cena" (no "cena" ni "Cena principal")
3. Las comidas DEBEN estar en este orden: Desayuno → Almuerzo → Snack → Cena
4. Cada comida DEBE tener EXACTAMENTE 3 opciones diferentes en el array "opciones"
   - Cada opción debe ser un nombre descriptivo y específico del plato (ej: "Avena con frutos rojos y miel", "Pollo a la plancha con arroz integral", "Ensalada de quinoa con vegetales")
   - PROHIBIDO usar placeholders como "Opción disponible", "Opción 1", "Opción 2", "Opción 3", etc.
   - PROHIBIDO usar textos genéricos o vacíos
   - Las opciones deben ser reales, variadas y adecuadas al objetivo, dieta y restricciones del usuario
5. Las comidas deben variar entre días (no repetir exactamente las mismas opciones en días consecutivos)
6. "distribucion_diaria_pct" DEBE variar según el objetivo e intensidad del usuario:
   - Para objetivos de GANANCIA (ganar_masa, volumen): mayor porcentaje en desayuno y almuerzo (ej: desayuno 25-30%, almuerzo 35-40%, snacks 10-15%, cena 20-25%)
   - Para objetivos de PÉRDIDA (perder_grasa, definicion, corte): distribución más equilibrada o ligeramente más alta en desayuno y almuerzo (ej: desayuno 25-30%, almuerzo 30-35%, snacks 10-15%, cena 25-30%)
   - Para MANTENER o RECOMPOSICIÓN: distribución equilibrada (ej: desayuno 25-28%, almuerzo 30-35%, snacks 10-12%, cena 25-30%)
   - Si intensidad es "intensa": ajustar distribución para optimizar resultados rápidos según el objetivo
   - Si intensidad es "leve": distribución más conservadora y sostenible
   - La suma DEBE ser exactamente 100% 
7. NO incluir "ingredientes" ni "pasos_preparacion" en las comidas (se consultan aparte)
8. "minutos_sesion_gym" DEBE reflejar la duración típica por sesión según objetivo e intensidad:
   - intensa: 75–90 min
   - moderada: 60–75 min
   - leve: 45–60 min
   Ajustar según objetivo (volumen/ganancia tienden al rango alto; pérdida/definición, rango medio).
9. DIFICULTAD (OBLIGATORIO): asignar "dificultad" global del plan como "facil" | "media" | "dificil" y un campo "dificultad_detalle" (1-2 frases) justificando según objetivo, intensidad, edad, IMC y perfil atlético. REGLAS:
   - Si intensidad = "intensa" → dificultad = "dificil" salvo casos MUY excepcionales (atleta avanzado con IMC saludable y objetivo mantenimiento), donde puede ser "media" pero justificar explícitamente.
   - Si intensidad = "moderada" → dificultad = "media" (subir a "dificil" si IMC ≥ 30 con objetivo de pérdida/definición/corte, o si el plan exige alto volumen más días de gym).
   - Si intensidad = "leve" → dificultad = "facil" (subir a "media" si usuario atlético con objetivo de volumen/ganancia y alta frecuencia de gym).
   - La descripción debe hacer NOTAR la intensidad elegida: para "intensa", menciona esfuerzo alto, fatiga inicial y necesidad de recuperación estricta.
10. Agrega "cambios_semanales" con textos concisos y específicos al nivel de dificultad:
    - semana1: qué sentirás la 1ª semana (adaptación, hambre/energía)
    - semana2: qué cambia en la 2ª semana (rendimiento, estabilidad)
    - semana3_4: señales de progreso hacia el final del mes
    - post_mes: qué esperar después del primer mes
    - fisiologia: 4-6 bullets sobre ajustes del cuerpo (insulina, hipertrofia, recuperación, etc.)
11. PROYECCIONES Y RESULTADOS ESPERADOS (OBLIGATORIO - PERSONALIZADAS POR IA):
    - "proyecciones" DEBE ser un objeto con:
      * "musculoGananciaMensual": string (solo si objetivo es ganar_masa, volumen o recomposicion)
        - ⚠️ CRÍTICO: Este campo es OBLIGATORIO y debe ser REALISTA según el perfil del usuario.
        - Calcular según: nivel de experiencia (principiante/intermedio/avanzado), intensidad, sexo, edad, IMC, días de gym, SUPERÁVIT CALÓRICO, y VOLUMEN TOTAL DE ENTRENAMIENTO
        - ⚠️ CÓMO DETERMINAR EL NIVEL:
          * Principiante: usuario NO atlético Y (días de gym = 0 O días de gym < 2)
          * Intermedio: usuario NO atlético Y días de gym >= 2 Y días de gym < 5
          * Avanzado: usuario atlético O días de gym >= 5
        - ⚠️ CRÍTICO: El superávit calórico y el volumen de entrenamiento son FACTORES CLAVE:
          * Si hay superávit calórico (>200 kcal): AUMENTAR la ganancia muscular estimada
          * Si hay déficit calórico (<0 kcal): REDUCIR la ganancia muscular (o incluso pérdida si es muy grande)
          * Volumen alto (≥400 min/semana): puede permitir mayor ganancia si hay superávit adecuado
          * Volumen bajo (<200 min/semana): limita la ganancia muscular incluso con superávit
        - ⚠️ REGLAS ESPECÍFICAS POR COMBINACIÓN:
          * Principiante + intensidad intensa + superávit adecuado (>200 kcal): 1.5-2.5 kg (masculino) o 0.75-1.25 kg (femenino)
          * Intermedio + intensidad moderada/intensa + superávit adecuado (>200 kcal): 0.8-1.5 kg (masculino) o 0.4-0.8 kg (femenino)
          * Avanzado + intensidad intensa + superávit adecuado (>200 kcal) + volumen alto (≥400 min/sem): 0.8-1.5 kg (masculino) o 0.4-0.8 kg (femenino)
          * Avanzado + intensidad intensa + superávit adecuado (>200 kcal) + volumen medio (200-399 min/sem): 0.6-1.2 kg (masculino) o 0.3-0.6 kg (femenino)
          * Avanzado + intensidad intensa + superávit pequeño (100-200 kcal): 0.4-0.8 kg (masculino) o 0.2-0.4 kg (femenino)
          * Avanzado + intensidad intensa + sin superávit o déficit: 0.2-0.5 kg (masculino) o 0.1-0.25 kg (femenino)
          * Avanzado + intensidad leve: 0.2-0.4 kg (masculino) o 0.1-0.25 kg (femenino)
        - ⚠️ IMPORTANTE: Si el objetivo es "volumen" (hipertrofia máxima), las proyecciones deben estar en el RANGO ALTO de las combinaciones arriba, especialmente si hay superávit adecuado y volumen alto.
        - REGLA GENERAL: Superávit de 200-300 kcal permite ~0.3-0.5 kg/mes adicionales. Superávit de 400-600 kcal permite ~0.5-0.8 kg/mes adicionales.
        - Formato: "X-Y kg" (ej: "1.5-2.5 kg", "0.8-1.5 kg", "0.6-1.2 kg")
        - ⚠️ NO uses valores muy conservadores (ej: 0.2-0.4 kg) a menos que el usuario tenga déficit calórico o volumen muy bajo.
      * "grasaPerdidaMensual": string (solo si objetivo es perder_grasa, corte o definicion)
        - Calcular según: intensidad, IMC actual, edad, sexo
        - Para "definicion": pérdida más gradual para preservar músculo (0.5-1.5 kg por mes según intensidad)
        - Para "perder_grasa" o "corte": pérdida más agresiva
        - Intensidad intensa: 1-2 kg por mes (perder_grasa/corte) o 0.8-1.5 kg por mes (definicion)
        - Intensidad moderada: 0.5-1 kg por mes (perder_grasa/corte) o 0.5-1 kg por mes (definicion)
        - Intensidad leve: 0.3-0.7 kg por mes (perder_grasa/corte) o 0.3-0.6 kg por mes (definicion)
        - Formato: "X-Y kg" (ej: "1-2 kg", "0.5-1 kg", "0.8-1.5 kg")
      * "proyecciones": array de 5-8 strings con proyecciones ESPECÍFICAS y PERSONALIZADAS basadas en:
        - Objetivo del usuario (ganar masa, perder grasa, recomposición, definición, mantener)
        - Intensidad elegida (leve, moderada, intensa)
        - Perfil del usuario (edad, sexo, IMC, nivel atlético, días de gym)
        - ⚠️ SUPERÁVIT/DÉFICIT CALÓRICO: TÚ (OpenAI) calcularás el superávit/déficit en "calorias_diarias" según el objetivo e intensidad del usuario. Este superávit/déficit es un FACTOR CRÍTICO que DEBES considerar al calcular las proyecciones de ganancia muscular. Si generaste un superávit alto (>200 kcal) para ganar masa, las proyecciones deben reflejar mayor ganancia muscular. Si generaste un déficit para perder grasa, las proyecciones deben reflejar pérdida de grasa.
        - ⚠️ VOLUMEN TOTAL DE ENTRENAMIENTO: ${(() => {
          const diasGym = (input as unknown as Record<string, unknown>)?.diasGym as number | undefined ?? 3;
          const baseMinutos = diasGym >= 5 ? 75 : diasGym >= 3 ? 60 : 45;
          const minutosSesion = input.intensidad === "ultra" 
            ? Math.min(baseMinutos + 30, 120) 
            : input.intensidad === "intensa" 
            ? Math.min(baseMinutos + 15, 90) 
            : input.intensidad === "leve" 
            ? Math.max(baseMinutos - 15, 30) 
            : baseMinutos;
          const volumen = diasGym * minutosSesion;
          return `${volumen} minutos/semana (${diasGym} días × ${minutosSesion} min)`;
        })()} - Este volumen también afecta las proyecciones de ganancia muscular.
        - Tipo de dieta seleccionada
        - Patologías o condiciones médicas (si aplica)
        - Ejemplos de proyecciones personalizadas:
          * Para ganar masa + principiante + intensa: "Como principiante con alta intensidad, puedes ganar músculo muy rápido (efecto novato maximizado)"
          * Para perder grasa + IMC > 30: "Los primeros meses puedes perder más peso (agua y grasa inicial)"
          * Para recomposición + intermedio: "Pérdida simultánea de grasa mientras ganas músculo"
          * Para definición: "Definición muscular visible: abs y músculos más marcados"
          * Incluir proyecciones sobre: fuerza, composición corporal, circunferencias, energía, recuperación, etc.
      * "tiempoEstimado": string con tiempo estimado para ver resultados según intensidad:
        - Intensidad "intensa": "1-3 meses para ver resultados notables"
        - Intensidad "moderada": "3 meses para ver resultados notables"
        - Intensidad "leve": "3-5 meses para ver resultados notables"
        - Ajustar según objetivo (definición puede tomar más tiempo, ganancia de principiante puede ser más rápida)
    - Las proyecciones DEBEN ser REALISTAS, MOTIVADORAS y ESPECÍFICAS al perfil del usuario
    - NO usar textos genéricos, cada proyección debe reflejar el contexto único del usuario

ENTRENAMIENTO (OBLIGATORIO - PLAN BÁSICO POR SEMANA):
${(() => {
  // Calcular recomendaciones de entrenamiento
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { sugerirEntrenamiento, calculateBMR, calculateTDEE } = require("@/utils/calculations");
    const bmi = input.alturaCm && input.pesoKg ? (input.pesoKg / Math.pow(input.alturaCm / 100, 2)) : 25;
    const recomendaciones = sugerirEntrenamiento(
      input.objetivo,
      input.intensidad || "moderada",
      input.edad,
      bmi,
      input.atletico || false
    );
    const diasGym = (input as unknown as Record<string, unknown>)?.diasGym as number | undefined ?? recomendaciones.diasGym;
    // Minutos por sesión según intensidad Y días de gym
    const baseMinutos = diasGym >= 5 ? 75 : diasGym >= 3 ? 60 : 45;
    const minutosSesion = input.intensidad === "ultra" 
      ? Math.min(baseMinutos + 30, 120) // Ultra: +30 min, máx 120
      : input.intensidad === "intensa"
      ? Math.min(baseMinutos + 15, 90) // Intensa: +15 min, máx 90
      : input.intensidad === "leve"
      ? Math.max(baseMinutos - 15, 30) // Leve: -15 min, mín 30
      : baseMinutos; // Moderada: base
    
    // Calcular superávit/déficit calórico estimado
    let superavitDeficit = 0;
    try {
      const bmr = calculateBMR(input.pesoKg, input.alturaCm, input.edad, input.sexo);
      const tdee = calculateTDEE(bmr, input.actividad, diasGym, (input as unknown as Record<string, unknown>)?.diasCardio as number | undefined);
      // Estimar calorías del plan basándose en el objetivo (esto es aproximado, el valor real vendrá de OpenAI)
      const caloriasEstimadas = input.objetivo === "ganar_masa" || input.objetivo === "volumen" 
        ? Math.round(tdee * 1.15) // ~15% superávit para ganar masa
        : input.objetivo === "perder_grasa" || input.objetivo === "corte" || input.objetivo === "definicion"
        ? Math.round(tdee * 0.8) // ~20% déficit para perder grasa
        : tdee; // Mantener
      superavitDeficit = caloriasEstimadas - tdee;
    } catch {
      // Si falla el cálculo, usar valores por defecto según intensidad
      const esObjetivoGanancia = input.objetivo === "ganar_masa" || input.objetivo === "volumen" || input.objetivo === "powerlifting" || input.objetivo === "atleta_elite";
      const esObjetivoPerdida = input.objetivo === "perder_grasa" || input.objetivo === "definicion" || input.objetivo === "corte";
      const esObjetivoResistencia = input.objetivo === "resistencia" || input.objetivo === "rendimiento_deportivo";
      
      superavitDeficit = input.intensidad === "ultra"
        ? (esObjetivoGanancia ? 1000 : esObjetivoPerdida ? -900 : esObjetivoResistencia ? 400 : 200)
        : input.intensidad === "intensa" 
        ? (esObjetivoGanancia ? 700 : esObjetivoPerdida ? -700 : esObjetivoResistencia ? 300 : 0)
        : input.intensidad === "moderada"
        ? (esObjetivoGanancia ? 450 : esObjetivoPerdida ? -450 : esObjetivoResistencia ? 200 : 0)
        : (esObjetivoGanancia ? 250 : esObjetivoPerdida ? -250 : esObjetivoResistencia ? 100 : 0);
    }
    
    // Calcular volumen total de entrenamiento
    const volumenTotalSemanal = diasGym * minutosSesion;
    
    return `⚠️ RECOMENDACIONES DE ENTRENAMIENTO CALCULADAS PARA ESTE USUARIO:
- Días de gym por semana: ${diasGym} días
- Minutos de caminata diaria: ${recomendaciones.minutosCaminata} minutos
- Horas de sueño recomendadas: ${recomendaciones.horasSueno} horas
- Duración por sesión de gym: ${minutosSesion} minutos
- Volumen total semanal: ${volumenTotalSemanal} minutos (${diasGym} días × ${minutosSesion} min)
- Superávit/Déficit calórico estimado: ${superavitDeficit > 0 ? `+${superavitDeficit} kcal (superávit)` : superavitDeficit < 0 ? `${superavitDeficit} kcal (déficit)` : '0 kcal (mantenimiento)'}
- Descripción: ${recomendaciones.descripcion}

⚠️ DEBES RESPETAR EXACTAMENTE ESTAS RECOMENDACIONES AL GENERAR EL PLAN DE ENTRENAMIENTO.

⚠️ CRÍTICO - ESTRUCTURA DEL PLAN DE ENTRENAMIENTO (DEBES SEGUIR ESTO ESTRICTAMENTE):

1. SPLIT REQUERIDO según ${diasGym} días de gym (prioridad sobre objetivo para la estructura; objetivo ajusta volumen/intensidad):
${(() => {
  if (diasGym >= 1 && diasGym <= 3) {
    return `   - SPLIT OBLIGATORIO: "Full Body" en CADA sesión (1–3 días/semana).
   - Cada día: piernas + empuje + tirón + algo de bíceps/tríceps + 2–3 ejercicios de abdomen/core; al final 5–12 min cardio ligero (un ejercicio con muscle_group "Cardio").
   - training_plan.week_order_rationale (OBLIGATORIO): explica descansos entre días, por qué compuestos primero y cómo variar entre sesiones Full Body.
   - Campo training_plan.split: "Full Body (${diasGym}x/semana)"`;
  }
  if (diasGym === 4) {
    return `   - SPLIT OBLIGATORIO: división tipo "Bro split 4 días" (NO Full Body).
   - Orden de días: (1) Piernas — (2) Pecho + tríceps — (3) Espalda + bíceps — (4) Hombros + abdominales + cardio LISS al final (10–15 min, muscle_group "Cardio").
   - week_order_rationale (OBLIGATORIO): explica por qué piernas primero (cargas mayores frescas), separación empuje/tirón, hombros+abdomen+cardio al final.
   - Cada ejercicio con muscle_group en español (p. ej. "Cuádriceps", "Pecho", "Cardio").`;
  }
  if (diasGym === 5) {
    return `   - SPLIT OBLIGATORIO: "Bro split 5 días" (NO Full Body como base).
   - Días 1–4: igual que en 4 días (Piernas → Pecho+trí → Espalda+bí → Hombros+abd+cardio).
   - Día 5: accesorios (bíceps, tríceps, gemelos, core) y/o HIIT corto (10–12 min, muscle_group "Cardio") según nivel.
   - week_order_rationale obligatorio. PROHIBIDO usar Full Body en los 5 días simultáneos como plan principal.`;
  }
  return `   - ${diasGym} días/semana: usa split de alta frecuencia coherente (p. ej. PPL 2x o upper/lower 3x) con muscle_group y week_order_rationale obligatorios.`;
})()}

2. REGLAS OBLIGATORIAS:
- Debe incluir EXACTAMENTE 4 semanas (weeks[0..3]) representando el mes actual.
- Cada semana debe tener EXACTAMENTE ${diasGym} días de entrenamiento, tomados de ["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo"] en ese orden cronológico.
- ⚠️ CRÍTICO - DÍAS DE DESCANSO: Si el usuario tiene lesiones reportadas, DEBE haber MÍNIMO 1 día de descanso completo entre cada sesión de entrenamiento. Para lesiones graves (hernia de disco, fracturas, desgarros), considerar 2 días de descanso entre sesiones. NO programar días consecutivos de entrenamiento cuando hay lesiones.
- ⚠️ El campo "split" en training_plan DEBE indicar el tipo de división usado (ej: "Full Body", "Upper/Lower", "Push/Pull/Legs", "Bro Split").
- ⚠️ Cada día DEBE tener el campo "split" indicando qué tipo de entrenamiento es ese día específico (ej: "Full Body", "Upper", "Lower", "Push", "Pull", "Legs", "Chest & Triceps", etc.).
- ⚠️ VARIACIÓN OBLIGATORIA: Cada semana debe tener ejercicios DIFERENTES o variaciones (cambiar ejercicios, series, reps, o músculos trabajados). NO repitas exactamente la misma rutina semana tras semana.
- Cada día debe tener MÍNIMO 6-8 ejercicios diferentes para una rutina completa y efectiva.
- Los ejercicios DEBEN estar organizados según el split especificado arriba. Con 1–3 días SÍ es Full Body; con 4–5 días NO uses Full Body como estructura principal.
- Cada ejercicio debe incluir (CAMPOS OBLIGATORIOS Y OPCIONALES):
  - "name": nombre descriptivo del ejercicio (OBLIGATORIO)
  - "sets": número de series (3-4 series típicamente) (OBLIGATORIO)
  - "reps": repeticiones o rango (ej: "8-12", "10-15") (OBLIGATORIO)
  - "muscle_group" (OBLIGATORIO): músculo o grupo muscular principal trabajado (ej: "Pecho", "Espalda", "Piernas", "Hombros", "Bíceps", "Tríceps", "Cuádriceps", "Isquiotibiales", "Glúteos", "Abdominales", etc.)
  - "rpe" (RECOMENDADO): RPE 1-10 (7-9 para hipertrofia, 8-10 para fuerza, 6-8 para principiantes)
  - "tempo" (RECOMENDADO): tempo del movimiento (ej: "2-0-1-0" para hipertrofia con control excéntrico, "1-0-1-0" para fuerza explosiva)
  - "rest_seconds" (RECOMENDADO): descanso entre series (60-90s hipertrofia, 2-5min fuerza, 60-90s principiantes)
  - "technique" (RECOMENDADO): puntos clave de técnica para principiantes Y avanzados (ej: "Principiante: Mantén la espalda recta. Avanzado: Aplica tensión constante, activa glúteos")
  - "progression" (RECOMENDADO): cómo progresar semana a semana (ej: "Semana 1-2: 8-10 reps. Semana 3-4: Aumenta peso 2.5-5kg y haz 6-8 reps")
  - "alternative" (OPCIONAL pero CRÍTICO si hay lesiones): ejercicio alternativo si hay lesión o falta de equipo
  - "cues" (RECOMENDADO): 2-3 pistas mentales para ejecución correcta (ej: ["Mantén el core activo", "Empuja con los talones"])
- VARIACIÓN CRÍTICA: Cada semana debe tener ejercicios DIFERENTES o con variaciones (cambios en series, reps, o ejercicios alternativos). NO repitas exactamente la misma rutina en todas las semanas.
- Cada día debe tener MÍNIMO 6-8 ejercicios diferentes para una rutina completa y efectiva.
- Duración por sesión: ${minutosSesion} minutos (incluyendo calentamiento y estiramiento).
- Calentamiento OBLIGATORIO: Cada día DEBE incluir un objeto "warmup" con:
  * "duration_minutes": número (5-10 min si no hay lesiones, 10-15 min si hay lesiones, 15 min para lesiones graves)
  * "description": string detallada del calentamiento específico para ese día, incluyendo movilidad para zonas afectadas si hay lesiones reportadas
- Estiramiento: 5 min al final de cada sesión (enfocado en músculos trabajados y zonas con lesiones si aplica).
- Finisher (opcional): según objetivo (HIIT para pérdida de grasa, ligero para volumen, movilidad para lesiones).

⚠️ ENFOQUE DE ENTRENAMIENTO SEGÚN OBJETIVO "${input.objetivo}":
${input.objetivo === "perder_grasa" || input.objetivo === "definicion" || input.objetivo === "corte" ? `- PÉRDIDA DE GRASA/DEFINICIÓN/CORTE:
  * Alta densidad de entrenamiento (poco descanso)
  * Circuitos y superseries para mantener frecuencia cardíaca elevada
  * Finishers de cardio: HIIT 10-15 min o circuito metabólico
  * Priorizar ejercicios compuestos que quemen más calorías
  * Split: Push/Pull/Legs para mayor frecuencia y quema calórica
  * RPE: 7-9, Descanso: 45-60s entre series` : ""}
${input.objetivo === "ganar_masa" || input.objetivo === "volumen" ? `- GANAR MASA/VOLUMEN (Hipertrofia Máxima):
  * Alto volumen por grupo muscular (16-20 series/semana)
  * Series pesadas en ejercicios compuestos (6-10 reps)
  * Series de hipertrofia en aislados (10-15 reps)
  * Tempo: Control excéntrico 2-3s para máxima tensión mecánica
  * Técnicas de intensidad: Drop sets, rest-pause en últimas series
  * Split: Bro Split o PPL especializado para mayor volumen por músculo
  * RPE: 7-9, Descanso: 60-90s hipertrofia, 2-3min fuerza` : ""}
${input.objetivo === "recomposicion" ? `- RECOMPOSICIÓN CORPORAL:
  * Balance entre fuerza e hipertrofia
  * Énfasis en ejercicios compuestos para mantener músculo en déficit ligero
  * Cardio moderado para quemar grasa sin afectar recuperación
  * Progresión gradual en fuerza como indicador de preservación muscular
  * Split: Upper/Lower o PPL equilibrado
  * RPE: 7-8, Descanso: 60-90s` : ""}
${input.objetivo === "mantener" ? `- MANTENIMIENTO:
  * Volumen suficiente para mantener adaptaciones (10-14 series/grupo/semana)
  * Mantener intensidad (RPE 7-8) pero sin técnicas avanzadas
  * Balance entre todos los grupos musculares
  * Cardio opcional para salud cardiovascular
  * Split: Flexible según preferencia
  * RPE: 7-8, Descanso: 60-90s` : ""}
${input.objetivo === "bulk_cut" ? `- BULK + CUT (Fase Actual: BULK):
  * Máximo volumen para hipertrofia agresiva
  * Series pesadas en compuestos (4-6 reps) + series de volumen (8-12 reps)
  * Progresión de fuerza como prioridad principal
  * Cardio mínimo (solo para salud cardiovascular)
  * Técnicas de intensidad: Drop sets, rest-pause, series mecánicas
  * Split: Bro Split o PPL de alto volumen
  * RPE: 8-10, Descanso: 90-120s compuestos, 60-90s aislados
  * Objetivo: Ganar fuerza y masa rápidamente (algo de grasa es esperado)` : ""}
${input.objetivo === "lean_bulk" ? `- LEAN BULK (Ganancia Limpia):
  * Volumen moderado-alto para hipertrofia controlada
  * Progresión constante en ejercicios principales
  * Incluir cardio estratégico (2-3x/semana) para mantener definición
  * Evitar exceso de técnicas de intensidad que aumenten apetito
  * Split: Upper/Lower o PPL con frecuencia 2x/semana
  * RPE: 7-9, Descanso: 60-90s
  * Objetivo: Ganar músculo minimizando grasa (progreso más lento pero limpio)` : ""}
${input.objetivo === "powerlifting" ? `- POWERLIFTING/FUERZA MÁXIMA:
  * Enfoque en los 3 levantamientos principales: Sentadilla, Press Banca, Peso Muerto
  * Periodización por bloques: Hipertrofia → Fuerza → Peaking
  * Rangos de repeticiones bajos en principales (1-5 reps)
  * Accesorios para debilidades específicas
  * Descansos largos para recuperación completa (3-5 min en principales)
  * Técnica perfecta sobre todo: posición de pies, agarre, respiración
  * Split: Upper/Lower o Full Body de alta frecuencia
  * RPE: 7-9 en accesorios, 8-10 en principales` : ""}
${input.objetivo === "resistencia" ? `- RESISTENCIA/ENDURANCE:
  * Menor énfasis en hipertrofia, más en resistencia muscular
  * Series de altas repeticiones (15-20+)
  * Circuitos y superseries para mejorar capacidad de trabajo
  * Descansos cortos para simular demanda cardiovascular
  * Incluir ejercicios unilaterales para estabilidad
  * Cardio prioritario: sesiones largas de baja intensidad (LISS)
  * Split: Full Body o Upper/Lower de alta frecuencia
  * RPE: 6-8, Descanso: 30-60s` : ""}
${input.objetivo === "rendimiento_deportivo" ? `- RENDIMIENTO DEPORTIVO:
  * Entrenamiento funcional y específico del deporte
  * Ejercicios de potencia: Cleans, Snatches, saltos, lanzamientos
  * Trabajo pliométrico para explosividad
  * Core funcional: anti-rotación, estabilidad dinámica
  * Periodización según calendario competitivo
  * Evitar fatiga excesiva que afecte práctica deportiva
  * Split: Según demandas del deporte y calendario
  * RPE: Variable según proximidad a competencia` : ""}
${input.objetivo === "atleta_elite" ? `- ATLETA ÉLITE:
  * Periodización avanzada: mesociclos y microciclos planificados
  * Técnicas de intensidad avanzadas: cluster sets, CAT, wave loading
  * Monitoreo de fatiga y recuperación (HRV, percepción de esfuerzo)
  * Trabajo específico de debilidades con análisis biomecánico
  * Sesiones dobles si la recuperación lo permite
  * Incluir trabajo de movilidad, prehab y recuperación activa
  * Split: Altamente individualizado según objetivos específicos
  * RPE: 8-10 con autoregulación según estado del día` : ""}

⚠️⚠️⚠️ INTENSIDAD SELECCIONADA: "${input.intensidad || 'moderada'}" - OBLIGATORIO APLICAR ESTOS PARÁMETROS:
${input.intensidad === "ultra" ? `
🔥🔥🔥 INTENSIDAD ULTRA - PROTOCOLO ATLETA ÉLITE 🔥🔥🔥
- SERIES POR EJERCICIO: 4-5 series (ejercicios compuestos pueden tener 5-6)
- REPS: Según objetivo:
  * Hipertrofia: 8-15 reps con técnicas de intensidad (dropsets, rest-pause, cluster sets)
  * Fuerza: 3-6 reps con peso máximo
  * Mixto: 6-12 reps con progresión dentro de la sesión
- RPE OBLIGATORIO: 9-10 en series principales (al fallo muscular o cerca)
- TEMPO: Variable avanzado:
  * Compuestos: 2-0-1-0 (control excéntrico, explosivo concéntrico)
  * Aislados: 3-1-2-0 (énfasis en tensión y contracción)
- DESCANSO: 
  * Entre series compuestas: 90-180s
  * Entre series aislados: 60-90s
  * Supersets/gigantes: 30-45s entre ejercicios, 120s entre rounds
- TÉCNICAS AVANZADAS OBLIGATORIAS (incluir al menos 2-3 por sesión):
  * Dropsets en último ejercicio de cada grupo muscular
  * Rest-pause en ejercicios compuestos (3-5 respiraciones y continuar)
  * Supersets antagonistas (ej: bíceps + tríceps)
  * Giant sets para grupos grandes (ej: pecho: press + aperturas + cruces)
  * Técnica 21s en bíceps/tríceps
- VOLUMEN TOTAL: 20-25 series por grupo muscular por semana
- DURACIÓN SESIÓN: 75-120 minutos
- CARDIO HIIT: 15-20 min post-entrenamiento o en día separado
- PROGRESIÓN: Aumentar peso 5-10kg cada 2 semanas o añadir técnica de intensidad
` : input.intensidad === "intensa" ? `
💪 INTENSIDAD INTENSA - PROTOCOLO ALTO RENDIMIENTO 💪
- SERIES POR EJERCICIO: 4 series (puede variar 3-5 según ejercicio)
- REPS: Según objetivo:
  * Hipertrofia: 8-12 reps con alta tensión
  * Fuerza: 4-8 reps
  * Mixto: 6-10 reps
- RPE OBLIGATORIO: 8-9 (cerca del fallo, 1-2 reps en reserva)
- TEMPO: 2-0-1-0 o 2-1-2-0 según ejercicio
- DESCANSO:
  * Entre series compuestas: 90-120s
  * Entre series aislados: 60-90s
- TÉCNICAS AVANZADAS (incluir 1-2 por sesión):
  * Dropsets ocasionales
  * Superseries
  * Pausa de 2s en contracción máxima
- VOLUMEN TOTAL: 16-20 series por grupo muscular por semana
- DURACIÓN SESIÓN: 60-75 minutos
- CARDIO: 20-30 min moderado post-entrenamiento
- PROGRESIÓN: Aumentar peso 2.5-5kg cada 1-2 semanas
` : input.intensidad === "moderada" ? `
⚡ INTENSIDAD MODERADA - PROTOCOLO EQUILIBRADO ⚡
- SERIES POR EJERCICIO: 3-4 series
- REPS: Según objetivo:
  * Hipertrofia: 10-15 reps
  * Fuerza: 6-10 reps
  * General: 8-12 reps
- RPE OBLIGATORIO: 7-8 (2-3 reps en reserva)
- TEMPO: 2-1-2-0 (controlado en todas las fases)
- DESCANSO:
  * Entre series: 60-90s
  * Entre ejercicios: 90-120s
- TÉCNICAS: 
  * Foco en conexión mente-músculo
  * Técnica perfecta sobre peso
- VOLUMEN TOTAL: 12-16 series por grupo muscular por semana
- DURACIÓN SESIÓN: 45-60 minutos
- CARDIO: Opcional, 15-20 min caminata rápida
- PROGRESIÓN: Aumentar peso cuando puedas hacer todas las reps con buena forma
` : `
🌱 INTENSIDAD LEVE - PROTOCOLO PROGRESIVO 🌱
- SERIES POR EJERCICIO: 2-3 series
- REPS: 
  * General: 12-15 reps (enfocado en técnica)
  * Nunca cargar al máximo
- RPE OBLIGATORIO: 6-7 (3-4 reps en reserva, NUNCA al fallo)
- TEMPO: 3-1-3-0 (muy controlado, 3s bajar, 1s pausa, 3s subir)
- DESCANSO:
  * Entre series: 90-120s (recuperación completa)
  * Entre ejercicios: 120-150s
- TÉCNICAS:
  * Priorizar aprendizaje de movimientos
  * Evitar ejercicios complejos (no peso muerto, no sentadilla profunda)
  * Usar máquinas antes que peso libre cuando sea posible
- VOLUMEN TOTAL: 8-12 series por grupo muscular por semana
- DURACIÓN SESIÓN: 30-45 minutos (incluido calentamiento)
- CARDIO: Caminata suave 20-30 min
- PROGRESIÓN: Aumentar reps primero, luego peso muy gradual (1-2.5kg)
- ENFOQUE: Sostenibilidad, crear hábito, evitar lesiones
`}

⚠️ DETALLES TÉCNICOS POR NIVEL DE EXPERIENCIA (complementario a la intensidad):
- PRINCIPIANTES (no atlético, <2 días gym/semana): 
  * Ajustar RPE: Restar 1-2 puntos del RPE de la intensidad elegida
  * Técnica: Explicaciones simples, puntos clave básicos
  * Cues: Enfocados en seguridad y forma básica (ej: "Espalda recta", "Core activo")
  * Si intensidad "ultra" o "intensa": Reducir volumen pero mantener calidad
- INTERMEDIOS (2-4 días gym/semana):
  * Usar RPE de la intensidad elegida directamente
  * Técnica: Puntos avanzados, activación muscular, conexión mente-músculo
  * Cues: Enfocados en activación y tensión (ej: "Aprieta glúteos", "Tensión constante")
- AVANZADOS (atlético o ≥5 días gym/semana):
  * Ajustar RPE: Pueden sumar 0.5-1 punto si la recuperación lo permite
  * Técnica: Técnica avanzada, variaciones, técnicas de intensidad adicionales
  * Cues: Enfocados en máxima activación y técnica perfecta (ej: "Máxima tensión", "Contracción pico")

⚠️ ADAPTACIÓN PARA LESIONES (CRÍTICO):
- Si hay lesiones reportadas, CADA ejercicio debe incluir:
  * "alternative": ejercicio alternativo seguro que no agrave la lesión
  * "technique": técnica modificada específica para la lesión (ej: "Si tienes hernia de disco: rango parcial, evita flexión profunda")
  * Ajustar RPE: Reducir a 6-7 para evitar compensaciones
  * Ajustar tempo: Más controlado, evitar movimientos explosivos que puedan agravar
  * Ajustar descanso: Aumentar a 90-120s para mejor recuperación

⚠️ VALIDACIÓN FINAL DEL SPLIT - REGLAS CRÍTICAS:
- Con 1–3 días de gym/semana: "Full Body" es la estructura esperada.
- Con 4–5 días/semana: NO uses "Full Body" como plan principal; usa el bro split descrito arriba (piernas → pecho+trí → espalda+bí → hombros+abd [+ día 5]).
- Con 6+ días: PPL u upper/lower duplicado según nivel; coherente entre semanas.
- Objetivo "${input.objetivo}" ajusta volumen/RPE, pero la estructura prioriza la frecuencia (${diasGym} días).
- ⚠️ Si el split contradice la frecuencia (ej. Full Body con 4–5 días fijos/semana), CORRÍGELO según las reglas superiores.
- Si generaste ejercicios que no corresponden al split del día (ej: ejercicios de piernas en un día "Upper"), ESTÁS EQUIVOCADO.
- El split DEBE ser consistente en todas las semanas: si la semana 1 usa "Push/Pull/Legs", las semanas 2, 3 y 4 también deben usar "Push/Pull/Legs" (pero con ejercicios variados).
- El campo "split" en training_plan DEBE coincidir con el split especificado en las reglas arriba.
`;
  } catch {
    const diasGym = (input as unknown as Record<string, unknown>)?.diasGym as number | undefined ?? 3;
    const baseMinutos = diasGym >= 5 ? 75 : diasGym >= 3 ? 60 : 45;
    const minutosSesion = input.intensidad === "ultra" 
      ? Math.min(baseMinutos + 30, 120) 
      : input.intensidad === "intensa" 
      ? Math.min(baseMinutos + 15, 90) 
      : input.intensidad === "leve" 
      ? Math.max(baseMinutos - 15, 30) 
      : baseMinutos;
    return `⚠️ PLAN DE ENTRENAMIENTO:
- Días de gym por semana: ${diasGym} días
- Duración por sesión: ${minutosSesion} minutos (ajustado por intensidad "${input.intensidad}")
- Debe incluir EXACTAMENTE 4 semanas con ${diasGym} días cada una.
- Cada día debe tener un array "ejercicios" con MÍNIMO 6-8 ejercicios.
- Cada ejercicio: name, sets, reps, muscle_group (OBLIGATORIO - músculo trabajado).
- ⚠️ VARIACIÓN OBLIGATORIA: Cada semana debe tener ejercicios DIFERENTES.`;
  }
})()}
Datos del usuario: ${JSON.stringify({
      nombre: input.nombre,
      sexo: input.sexo,
      edad: input.edad,
      alturaCm: input.alturaCm,
      pesoKg: input.pesoKg,
      IMC: input.alturaCm && input.pesoKg ? Number((input.pesoKg / Math.pow(input.alturaCm / 100, 2)).toFixed(2)) : undefined,
      actividad: typeof input.actividad === "number" 
        ? `${input.actividad} día${input.actividad !== 1 ? "s" : ""} de actividad física por semana`
        : input.actividad,
      objetivo: input.objetivo,
      intensidad: input.intensidad || "moderada",
      tipo_dieta: input.tipoDieta || "estandar",
      duracion_plan_dias: 30, // Plan mensual fijo
      restricciones: input.restricciones,
      preferencias: input.preferencias,
      patologias: input.patologias,
      dolores_lesiones: input.doloresLesiones,
      dias_gym: (input as unknown as Record<string, unknown>)?.diasGym ?? undefined,
      minutos_sesion_gym: (() => {
        const diasGym = (input as unknown as Record<string, unknown>)?.diasGym as number | undefined;
        if (typeof diasGym === 'number') {
          const baseMinutos = diasGym >= 5 ? 75 : diasGym >= 3 ? 60 : 45;
          return input.intensidad === "ultra" 
            ? Math.min(baseMinutos + 30, 120) 
            : input.intensidad === "intensa" 
            ? Math.min(baseMinutos + 15, 90) 
            : input.intensidad === "leve" 
            ? Math.max(baseMinutos - 15, 30) 
            : baseMinutos;
        }
        return 60; // Default
      })(),
      volumen_total_semanal: (() => {
        const diasGym = (input as unknown as Record<string, unknown>)?.diasGym as number | undefined ?? 3;
        const baseMinutos = diasGym >= 5 ? 75 : diasGym >= 3 ? 60 : 45;
        const minutosSesion = input.intensidad === "ultra" 
          ? Math.min(baseMinutos + 30, 120) 
          : input.intensidad === "intensa" 
          ? Math.min(baseMinutos + 15, 90) 
          : input.intensidad === "leve" 
          ? Math.max(baseMinutos - 15, 30) 
          : baseMinutos;
        return diasGym * minutosSesion;
      })(),
      // NOTA: El superávit/déficit lo calculará OpenAI en calorias_diarias según objetivo e intensidad
      // No lo enviamos aquí porque es parte de la RESPUESTA de OpenAI, no del input del usuario
      nivel_atletico: input.atletico || false,
    })}.

INSTRUCCIONES CRÍTICAS:

0. OPCIONES DE COMIDAS (OBLIGATORIO - CRÍTICO):
   - Cada comida DEBE tener EXACTAMENTE 3 opciones en el array "opciones"
   - Cada opción DEBE ser un nombre REAL y DESCRIPTIVO del plato (ej: "Avena con frutos rojos, miel y almendras", "Pollo a la plancha con arroz integral y ensalada mixta", "Salmón al horno con brócoli y quinoa")
   - PROHIBIDO ABSOLUTAMENTE usar placeholders como: "Opción disponible", "Opción 1", "Opción 2", "Opción 3", "Placeholder", "Texto", o cualquier texto genérico
   - PROHIBIDO usar nombres vacíos o con menos de 5 caracteres
   - Las opciones deben ser VARIADAS entre días (no repetir exactamente las mismas opciones en días consecutivos)
   - Las opciones deben ser ESPECÍFICAS al objetivo del usuario, tipo de dieta, restricciones y preferencias
   - Si no puedes generar opciones válidas, el JSON será rechazado y deberás intentar de nuevo

1. RESTRICCIONES ALIMENTARIAS (OBLIGATORIO RESPETAR - CRÍTICO):
${input.restricciones && input.restricciones.length > 0 
  ? `⚠️ RESTRICCIONES DEL USUARIO (EXCLUIR ABSOLUTAMENTE):
${input.restricciones.map(r => `- ${r}`).join('\n')}

REGLAS OBLIGATORIAS PARA CADA RESTRICCIÓN:
${input.restricciones.map(r => {
  const rLower = String(r).toLowerCase().trim();
  if (rLower.includes('pescado') || rLower.includes('pescados') || rLower.includes('marisco') || rLower.includes('mariscos')) {
    return `- "${r}": EXCLUIR COMPLETAMENTE: atún, salmón, merluza, sardinas, caballa, bacalao, trucha, lubina, dorada, langostinos, camarones, calamares, pulpo, mejillones, almejas, y TODOS los pescados y mariscos. NO incluir NINGÚN plato que contenga pescados o mariscos.`;
  }
  if (rLower.includes('gluten')) {
    return `- "${r}": EXCLUIR COMPLETAMENTE: trigo, cebada, centeno, avena (a menos que sea certificada sin gluten), y TODOS los derivados. NO incluir pan, pasta, harina, galletas, etc.`;
  }
  if (rLower.includes('lacteo') || rLower.includes('lácteo')) {
    return `- "${r}": EXCLUIR COMPLETAMENTE: leche, queso, yogurt, mantequilla, crema, nata, y TODOS los derivados lácteos.`;
  }
  if (rLower.includes('cerdo') || rLower.includes('puerco')) {
    return `- "${r}": EXCLUIR COMPLETAMENTE: cerdo, puerco, jamón, tocino, chorizo, salchichas de cerdo, y TODOS los derivados.`;
  }
  if (rLower.includes('carne roja') || rLower.includes('res') || rLower.includes('vaca')) {
    return `- "${r}": EXCLUIR COMPLETAMENTE: res, vaca, ternera, cordero, y TODAS las carnes rojas.`;
  }
  if (rLower.includes('huevo') || rLower.includes('huevos')) {
    return `- "${r}": EXCLUIR COMPLETAMENTE: huevos, claras de huevo, yemas, y TODOS los productos que contengan huevo.`;
  }
  if (rLower.includes('soja') || rLower.includes('soya')) {
    return `- "${r}": EXCLUIR COMPLETAMENTE: soja, soya, tofu, tempeh, leche de soja, y TODOS los derivados de soja.`;
  }
  if (rLower.includes('frutos secos') || rLower.includes('nueces') || rLower.includes('almendras')) {
    return `- "${r}": EXCLUIR COMPLETAMENTE: nueces, almendras, avellanas, pistachos, anacardos, cacahuetes, y TODOS los frutos secos.`;
  }
  if (rLower.includes('azúcar') || rLower.includes('azucar')) {
    return `- "${r}": EXCLUIR COMPLETAMENTE: azúcar, miel, jarabe de arce, edulcorantes artificiales, y TODOS los alimentos con azúcares añadidos.`;
  }
  return `- "${r}": EXCLUIR COMPLETAMENTE este alimento o ingrediente y TODOS sus derivados. NO incluir NINGÚN plato que contenga "${r}".`;
}).join('\n')}

⚠️ VALIDACIÓN FINAL: ANTES de generar cada opción de comida, VERIFICA que NO contenga NINGUNA de las restricciones listadas arriba. Si una restricción es "pescados", ATÚN, SALMÓN, y TODOS los pescados están PROHIBIDOS. Si una restricción es "gluten", TRIGO, CEBADA y derivados están PROHIBIDOS. Buscar SIEMPRE alternativas adecuadas que NO violen las restricciones.`
  : "- No hay restricciones específicas del usuario."
}

2. PREFERENCIAS ALIMENTARIAS (PRIORIZAR):
${input.preferencias && input.preferencias.length > 0 
  ? `El usuario tiene las siguientes PREFERENCIAS que deben ser PRIORIZADAS en el plan:
${input.preferencias.map(p => `- ${p}`).join('\n')}
IMPORTANTE: Incluir estas preferencias frecuentemente en las comidas, variando cómo se preparan. Si la preferencia es "pollo", incluir pollo en varias comidas semanales pero preparado de diferentes formas (a la plancha, al horno, en ensalada, etc.). Si es "avena", incluirla en desayunos y snacks. Si es "salmón", incluirlo en almuerzos y cenas varias veces por semana.`
  : "- No hay preferencias específicas del usuario."
}

3. PATOLOGÍAS Y CONDICIONES MÉDICAS (CRÍTICO - ADAPTAR PLAN COMPLETO):
${input.patologias && input.patologias.length > 0 
  ? `El usuario tiene las siguientes PATOLOGÍAS/CONDICIONES MÉDICAS que REQUIEREN ADAPTACIONES ESPECÍFICAS en el plan:
${input.patologias.map(p => `- ${p}`).join('\n')}

IMPORTANTE: Estas condiciones médicas tienen PRIORIDAD ABSOLUTA sobre otros aspectos del plan. Adaptar TODAS las comidas y recomendaciones nutricionales según cada patología:

${input.patologias.some(p => p.toLowerCase().includes('hígado graso') || p.toLowerCase().includes('higado graso') || p.toLowerCase().includes('esteatosis')) 
  ? `- HÍGADO GRASO: Evitar completamente azúcares refinados, alimentos procesados, grasas trans y alcohol. Priorizar alimentos antiinflamatorios: pescados grasos (salmón, atún), aceite de oliva, frutas y verduras frescas, granos integrales. Reducir carbohidratos simples (pan blanco, pasta blanca, arroz blanco). Limitar frutas muy dulces.`
  : ''}
${input.patologias.some(p => p.toLowerCase().includes('lactosa') || p.toLowerCase().includes('intolerancia lactosa')) 
  ? `- INTOLERANCIA A LA LACTOSA: Excluir completamente leche, queso, yogurt (excepto sin lactosa), mantequilla y derivados lácteos. Usar alternativas: leche de almendras, avena, coco; quesos veganos; productos etiquetados "sin lactosa".`
  : ''}
${input.patologias.some(p => p.toLowerCase().includes('celiac') || p.toLowerCase().includes('celíac') || p.toLowerCase().includes('gluten') && !p.toLowerCase().includes('sin gluten')) 
  ? `- ENFERMEDAD CELÍACA / INTOLERANCIA AL GLUTEN: Excluir completamente trigo, cebada, centeno, avena (a menos que sea certificada sin gluten). Usar solo alimentos naturalmente sin gluten: arroz, maíz, quinoa, amaranto, trigo sarraceno, legumbres, carnes, pescados, frutas, verduras. Revisar etiquetas de productos procesados.`
  : ''}
${input.patologias.some(p => p.toLowerCase().includes('diabetes')) 
  ? `- DIABETES: Control estricto de carbohidratos. Priorizar carbohidratos complejos (granos integrales, legumbres) sobre simples. Evitar azúcares añadidos, jugos de fruta, alimentos procesados con azúcar. Distribuir carbohidratos uniformemente a lo largo del día. Incluir fibra en cada comida para moderar glucosa. Preferir proteínas magras y grasas saludables.`
  : ''}
${input.patologias.some(p => p.toLowerCase().includes('hipertensión') || p.toLowerCase().includes('hipertension') || p.toLowerCase().includes('presión alta') || p.toLowerCase().includes('presion alta')) 
  ? `- HIPERTENSIÓN ARTERIAL: Reducir sodio (sal) al mínimo. Evitar alimentos procesados, enlatados, embutidos, quesos salados. Priorizar alimentos frescos. Incluir potasio: plátanos, aguacate, espinacas, tomates. Limitar alcohol y cafeína.`
  : ''}
${input.patologias.some(p => p.toLowerCase().includes('renal') || p.toLowerCase().includes('riñón') || p.toLowerCase().includes('rinon')) 
  ? `- ENFERMEDAD RENAL CRÓNICA: Controlar proteínas según estadio de la enfermedad. Limitar sodio, fósforo y potasio. Evitar alimentos procesados, legumbres en exceso, frutos secos, lácteos enteros. Consultar con nefrólogo para restricciones específicas.`
  : ''}
${input.patologias.some(p => p.toLowerCase().includes('reflujo') || p.toLowerCase().includes('gerd') || p.toLowerCase().includes('acidez')) 
  ? `- REFLUJO GASTROESOFÁGICO (GERD): Evitar alimentos ácidos (cítricos, tomates), picantes, fritos, grasos, chocolate, cafeína, alcohol, menta. Comer porciones pequeñas y frecuentes. No acostarse inmediatamente después de comer.`
  : ''}
${input.patologias.some(p => p.toLowerCase().includes('intestino irritable') || p.toLowerCase().includes('ibs') || p.toLowerCase().includes('colon irritable')) 
  ? `- SÍNDROME DEL INTESTINO IRRITABLE (IBS): Considerar dieta FODMAP baja. Evitar alimentos fermentables: algunas frutas (manzana, pera, mango), legumbres, edulcorantes (sorbitol, manitol), productos lácteos, trigo. Priorizar alimentos bajos en FODMAP: arroz, avena, plátano, arándanos, carnes magras, pescados, huevos.`
  : ''}
${input.patologias.some(p => p.toLowerCase().includes('crohn') || p.toLowerCase().includes('colitis')) 
  ? `- ENFERMEDAD INFLAMATORIA INTESTINAL (Crohn/Colitis): Durante brotes, dieta blanda baja en fibra. Evitar alimentos irritantes: semillas, frutos secos, alimentos crudos, alimentos muy condimentados. Durante remisión, reintroducir gradualmente alimentos nutritivos.`
  : ''}
${input.patologias.some(p => p.toLowerCase().includes('tiroides') || p.toLowerCase().includes('hipotiroid') || p.toLowerCase().includes('hipertiroid')) 
  ? `- PROBLEMAS DE TIROIDES: Evitar alimentos que interfieran con medicación (soja cruda, crucíferas en exceso sin cocinar). Asegurar yodo adecuado de fuentes naturales (pescados, algas marinas). Mantener alimentación equilibrada con énfasis en selenio y zinc.`
  : ''}
${input.patologias.some(p => p.toLowerCase().includes('anemia')) 
  ? `- ANEMIA: Aumentar hierro: carnes rojas magras, hígado, pescados, legumbres, espinacas. Combinar con vitamina C (cítricos, pimientos) para mejorar absorción. Evitar té y café durante comidas ricas en hierro.`
  : ''}
${input.patologias.some(p => p.toLowerCase().includes('osteoporosis')) 
  ? `- OSTEOPOROSIS: Aumentar calcio: lácteos (si no hay intolerancia), sardinas con espinas, brócoli, almendras, tofu. Asegurar vitamina D (pescados grasos, exposición solar). Reducir sodio y cafeína que pueden aumentar pérdida de calcio.`
  : ''}
${input.patologias.some(p => p.toLowerCase().includes('gota') || p.toLowerCase().includes('ácido úrico') || p.toLowerCase().includes('acido urico') || p.toLowerCase().includes('hiperuricemia')) 
  ? `- GOTA / ÁCIDO ÚRICO ELEVADO: Evitar alimentos altos en purinas: carnes rojas, vísceras, mariscos, anchoas, sardinas. Limitar alcohol (especialmente cerveza). Aumentar ingesta de agua. Priorizar lácteos bajos en grasa, cereales, frutas, verduras. Limitar fructosa y alimentos procesados.`
  : ''}

ADAPTAR TODO EL PLAN (calorías, macros, selección de alimentos, horarios) según estas patologías. Si hay conflictos con otros requisitos (dieta tipo, restricciones), las patologías tienen PRIORIDAD ABSOLUTA.`
  : "- No hay patologías reportadas por el usuario."
}

4. DOLORES / LESIONES (CRÍTICO - CONDICIONA ENTRENAMIENTO):
${input.doloresLesiones && input.doloresLesiones.length > 0
  ? `⚠️⚠️⚠️ LESIONES REPORTADAS: ${input.doloresLesiones.join(', ')}. DEBEN CONDICIONAR COMPLETAMENTE el entrenamiento.

REGLAS CRÍTICAS POR LESIÓN:
${input.doloresLesiones.some((d) => d.toLowerCase().includes('hernia') && (d.toLowerCase().includes('disco') || d.toLowerCase().includes('discal')))
  ? `🚨🚨🚨 HERNIA DE DISCO (LESIÓN GRAVE - PROTOCOLO DE SEGURIDAD MÁXIMA) 🚨🚨🚨

⚠️⚠️⚠️ EJERCICIOS ABSOLUTAMENTE PROHIBIDOS (NUNCA INCLUIR EN EL PLAN):
- Remo con barra (bent-over row, barbell row, T-bar row) - PROHIBIDO
- Peso muerto (deadlift, cualquier variante) - PROHIBIDO
- Sentadillas profundas o con carga pesada - PROHIBIDO
- Peso muerto rumano (RDL) - PROHIBIDO
- Good mornings - PROHIBIDO
- Hiperextensiones de espalda (back extensions profundas) - PROHIBIDO
- Crunch abdominales tradicionales - PROHIBIDO
- Russian twists con peso - PROHIBIDO
- Overhead press pesado (press militar con carga alta) - PROHIBIDO
- Sentadillas frontales con barra sobre hombros - PROHIBIDO
- Leg press con rango completo profundo - PROHIBIDO
- Hack squat profundo - PROHIBIDO
- Cualquier ejercicio de impacto (saltos, burpees, jumping jacks) - PROHIBIDO
- Cualquier ejercicio que requiera flexión/extensión excesiva de columna - PROHIBIDO
- Cualquier ejercicio que genere compresión espinal - PROHIBIDO
- Cualquier ejercicio que requiera cargar peso sobre los hombros - PROHIBIDO

✅ EJERCICIOS SEGUROS Y PERMITIDOS (SOLO ESTOS):
- Remo en máquina sentado (cable row, máquina de remo) - SEGURO
- Jalón al pecho en polea (lat pulldown) - SEGURO
- Remo con mancuernas apoyado en banco (chest supported row) - SEGURO
- Prensa 45° con rango medio (NO profundo) - SEGURO
- Máquina de extensión de piernas (leg extension) - SEGURO
- Máquina de curl de piernas (leg curl) - SEGURO
- Plancha isométrica (plank) - SEGURO
- Dead bug - SEGURO
- Bird dog - SEGURO
- Trabajo de brazos con mancuernas (curl, extensiones, press) - SEGURO
- Cardio bajo impacto (caminata, elíptica, bicicleta estática) - SEGURO
- Ejercicios de movilidad suave (cat-cow, estiramientos de cadera) - SEGURO

REGLAS CRÍTICAS:
- Días: MÁXIMO 2 días/semana, MÍNIMO 48h descanso entre sesiones
- Calentamiento: 15 min obligatorio (movilidad cadera, estiramientos isquios, activación core)
- RPE: Máximo 6-7 (NUNCA al fallo, evitar compensaciones)
- Tempo: Controlado 3-1-2-0 (máximo control, evitar explosivo)
- Descanso: 90-120s (mejor recuperación)
- Alternativas OBLIGATORIAS: Cada ejercicio debe tener "alternative" seguro
- Técnica: "technique" debe incluir "Si tienes hernia de disco: rango parcial, evita flexión profunda, mantén core activo"

⚠️⚠️⚠️ VALIDACIÓN FINAL: ANTES de incluir CUALQUIER ejercicio en el plan, VERIFICA que NO esté en la lista de PROHIBIDOS arriba. Si el ejercicio involucra flexión de columna, carga sobre espalda, o compresión espinal, NO LO INCLUYAS. Usa SOLO los ejercicios de la lista SEGUROS.`
  : ''}
${input.doloresLesiones.some((d) => d.toLowerCase().includes('lumbar') || d.toLowerCase().includes('espalda baja'))
  ? `⚠️ LUMBAR (MODERADA):
- Días: Máximo 3-4 días/semana, 1 día descanso entre sesiones
- EVITAR: peso muerto, sentadillas profundas, impacto, flexión columna con carga
- PRIORIZAR: core isométrico, máquinas guiadas, brazos/piernas carga moderada, trabajo unilateral
- Calentamiento: 10-15 min (movilidad cadera, estiramientos isquios, activación core)
- RPE: 6-8 (evitar compensaciones)
- Tempo: Controlado 2-0-1-0
- Alternativas: Incluir "alternative" para ejercicios que involucren espalda baja`
  : ''}
${input.doloresLesiones.some((d) => d.toLowerCase().includes('rodilla'))
  ? `⚠️ RODILLA (MODERADA):
- Días: Máximo 3-4 días/semana, 1 día descanso entre sesiones
- EVITAR: sentadillas/lunges profundos, impacto, extensión pierna alta carga, saltos
- PRIORIZAR: máquinas (prensa 45° rango medio), brazos/core, glúteos/isquios (curl piernas), trabajo unilateral
- Calentamiento: 10-15 min (movilidad cadera, activación glúteos, estiramientos suaves)
- RPE: 6-8
- Tempo: Controlado, evitar explosivo
- Alternativas: Incluir "alternative" para ejercicios que involucren rodilla`
  : ''}
${input.doloresLesiones.some((d) => d.toLowerCase().includes('hombro') || d.toLowerCase().includes('manguito'))
  ? `⚠️ HOMBRO/MANGUITO (MODERADA):
- Días: Máximo 3-4 días/semana, 1 día descanso entre sesiones
- EVITAR: press militar, press banca ancho, elevaciones laterales alta carga, overhead, movimientos por encima de 90°
- PRIORIZAR: brazos agarre neutro, piernas/core, manguito rotador con bandas (baja resistencia), trabajo unilateral
- Calentamiento: 10-15 min (movilidad hombro, estiramientos pecho, activación manguito)
- RPE: 6-8
- Tempo: Controlado, evitar explosivo
- Alternativas: Incluir "alternative" para ejercicios que involucren hombro`
  : ''}
REGLAS GENERALES LESIONES:
- Lesiones graves (hernia disco, fracturas): máximo 2-3 días/semana, 48h descanso mínimo
- Lesiones moderadas (lumbar, rodilla, hombro): máximo 3-4 días/semana, 24h descanso mínimo
- Calentamiento: 10-15 min (15 min lesiones graves), enfocado en zona afectada
- RPE reducido: 6-7 lesiones graves, 6-8 moderadas (nunca al fallo)
- Tempo controlado: Evitar explosivo, priorizar control excéntrico
- Descanso aumentado: 90-120s para mejor recuperación
- Alternativas OBLIGATORIAS: Cada ejercicio debe incluir "alternative" seguro
- Técnica adaptada: "technique" debe incluir modificaciones específicas para la lesión
- Incluir "safety_notes" en training_plan con precauciones específicas`
  : "- Sin lesiones reportadas. Calentamiento estándar: 5-10 min. RPE: según nivel. Tempo: según objetivo."}

5. TIEMPO OBJETIVO PARA RESULTADOS: El usuario debe ver resultados notables en ${input.intensidad === "ultra" ? "1-2 meses" : input.intensidad === "intensa" ? "1-3 meses" : input.intensidad === "moderada" ? "3 meses" : "3-5 meses"}. 
   TODO el plan (calorías, macros, distribución de comidas) debe estar diseñado para lograr resultados VISIBLES en ese tiempo.
   - Si intensidad es "ultra": el plan debe ser EXTREMO para atletas que buscan resultados muy rápidos (1-2 meses). Requiere compromiso total.
   - Si intensidad es "intensa": el plan debe ser AGRESIVO para resultados rápidos (1-3 meses)
   - Si intensidad es "moderada": el plan debe ser EQUILIBRADO para resultados en 3 meses exactos
   - Si intensidad es "leve": el plan debe ser GRADUAL para resultados sostenibles en 3-5 meses
   
6. La intensidad "${input.intensidad || "moderada"}" debe reflejarse en el déficit/superávit calórico y la distribución de macros:
- Leve: cambios graduales y sostenibles (déficit/superávit pequeño: ~200-300 kcal) - Objetivo: resultados en 3-5 meses
- Moderada: progresión equilibrada (déficit/superávit medio: ~400-500 kcal) - Objetivo: resultados en 3 meses
- Intensa: cambios más agresivos (déficit/superávit alto: ~600-800 kcal) - Objetivo: resultados en 1-3 meses
- Ultra: MÁXIMO RENDIMIENTO para atletas (déficit/superávit extremo: ~800-1200 kcal) - Objetivo: resultados en 1-2 meses. Entrenamiento 5-7 días/semana, posibles dobles sesiones. Macros optimizados para rendimiento élite.

${input.intensidad === "ultra" ? `⚠️ INTENSIDAD ULTRA ACTIVADA - PROTOCOLO ATLETA:
- Entrenamiento: 5-7 días/semana, sesiones de 75-120 min
- Posibilidad de dobles sesiones (AM cardio/movilidad + PM pesas)
- Proteína muy alta: 2.2-2.8g/kg de peso corporal
- Timing nutricional preciso: pre/intra/post entrenamiento
- Suplementación recomendada: proteína, creatina, electrolitos
- Periodización avanzada: semanas de descarga cada 3-4 semanas
- Recuperación estricta: 8-9 horas de sueño, manejo del estrés
- Este nivel es SOLO para personas con experiencia previa en entrenamiento` : ""}

${["rendimiento_deportivo", "powerlifting", "resistencia", "atleta_elite"].includes(input.objetivo) ? `⚠️ OBJETIVO PARA ATLETAS - CONSIDERACIONES ESPECIALES:
${input.objetivo === "rendimiento_deportivo" ? `- RENDIMIENTO DEPORTIVO:
  * Periodización nutricional según calendario competitivo
  * Carga de carbohidratos pre-competencia
  * Énfasis en timing de nutrientes pre/post entrenamiento
  * Hidratación avanzada con electrolitos
  * Proteína: 1.6-2.2g/kg para reparación muscular` : ""}
${input.objetivo === "powerlifting" ? `- POWERLIFTING/FUERZA:
  * Alto consumo calórico para soportar levantamientos pesados
  * Proteína muy alta: 2.0-2.5g/kg
  * Carbohidratos estratégicos pre-sesión para energía máxima
  * Entrenamiento enfocado en sentadilla, press banca, peso muerto
  * Periodización por bloques: hipertrofia → fuerza → peaking` : ""}
${input.objetivo === "resistencia" ? `- RESISTENCIA/ENDURANCE:
  * Alto consumo de carbohidratos (6-10g/kg/día)
  * Carga de glucógeno antes de eventos largos
  * Nutrición durante ejercicio (>90 min): geles, bebidas deportivas
  * Proteína moderada: 1.4-1.8g/kg
  * Énfasis en hierro, electrolitos y antioxidantes` : ""}
${input.objetivo === "atleta_elite" ? `- ATLETA ELITE:
  * Nutrición de precisión: macros exactos al gramo
  * Timing nutricional estricto: ventanas anabólicas
  * Suplementación completa: proteína, creatina, omega-3, vitamina D
  * Periodización nutricional mensual según fase de entrenamiento
  * Monitoreo de composición corporal semanal
  * Protocolo de recuperación élite: sueño, masaje, crioterapia` : ""}` : ""}

${["bulk_cut", "lean_bulk"].includes(input.objetivo) ? `⚠️ OBJETIVO DE TRANSFORMACIÓN CON FASES - ${input.objetivo === "bulk_cut" ? "BULK + CUT" : "LEAN BULK"}:
${(() => {
  const pesoActual = input.pesoKg;
  const pesoObjetivo = (input as unknown as Record<string, unknown>)?.pesoObjetivoKg as number | undefined;
  const diferencia = pesoObjetivo ? pesoObjetivo - pesoActual : 0;
  
  if (input.objetivo === "bulk_cut") {
    const pesoBulk = pesoObjetivo ? Math.round(pesoObjetivo * 1.08) : Math.round(pesoActual * 1.15);
    const pesoFinal = pesoObjetivo || Math.round(pesoActual * 1.1);
    return `
🔄 BULK + CUT - Plan de 2 fases para máxima ganancia muscular + definición:

📊 DATOS DEL USUARIO:
- Peso actual: ${pesoActual} kg
- Peso objetivo final (cortado): ${pesoFinal} kg
- Peso de bulk estimado: ${pesoBulk} kg
- Músculo a ganar: ~${diferencia > 0 ? Math.round(diferencia * 0.85) : Math.round(pesoActual * 0.1)} kg

📅 FASE 1 - BULK (Este mes y siguientes hasta llegar a ${pesoBulk} kg):
- Superávit calórico: +500-700 kcal/día
- Proteína: 2.0-2.2g/kg de peso corporal
- Carbohidratos: 4-6g/kg para energía y recuperación
- Entrenamiento: Alta intensidad, progresión de fuerza, volumen moderado-alto
- Cardio: Mínimo (2x/semana, 20 min) para mantener salud cardiovascular
- Meta: Ganar 0.5-1 kg/semana (músculo + algo de grasa inevitable)

⚠️ SEÑALES PARA PASAR A FASE CUT:
- Llegaste a ${pesoBulk} kg
- Tu cintura aumentó más de 10 cm
- Tu % de grasa supera 18-20%
- Perdiste definición de abs completamente

📅 FASE 2 - CUT (Cuando se cumplan las señales):
- Déficit calórico: -500-700 kcal/día
- Proteína: 2.2-2.5g/kg (más alta para preservar músculo)
- Carbohidratos: Reducidos, timing estratégico pre/post entreno
- Entrenamiento: Mantener intensidad, reducir volumen levemente
- Cardio: Aumentar a 3-4x/semana, 30-45 min
- Meta: Perder 0.5-1 kg/semana hasta llegar a ${pesoFinal} kg definido

⚠️ EL PLAN DE ESTE MES ES FASE BULK - Generar plan de alimentación y entrenamiento para BULK`;
  } else {
    // lean_bulk
    return `
💎 LEAN BULK - Ganancia muscular minimizando grasa:

📊 DATOS DEL USUARIO:
- Peso actual: ${pesoActual} kg
- Peso objetivo: ${pesoObjetivo || Math.round(pesoActual * 1.1)} kg
- Músculo a ganar: ~${diferencia > 0 ? Math.round(diferencia * 0.9) : Math.round(pesoActual * 0.08)} kg

📅 PROTOCOLO LEAN BULK CONTINUO:
- Superávit calórico CONTROLADO: +300-400 kcal/día (NO más)
- Proteína muy alta: 2.2-2.5g/kg de peso corporal
- Carbohidratos: Moderados, concentrados alrededor del entrenamiento
- Grasas: Saludables, 0.8-1g/kg
- Entrenamiento: Alta intensidad, progresión de fuerza, volumen moderado
- Cardio estratégico: 2-3x/semana, 20-30 min para mantener definición
- Meta: Ganar 0.3-0.5 kg/semana (casi todo músculo)

⚠️ MINI-CUTS (Cada 2-3 meses si es necesario):
- Si tu cintura aumenta más de 5 cm
- Si pierdes visibilidad de abs superiores
- Duración: 2-3 semanas de déficit moderado (-400 kcal)
- Luego volver a lean bulk

📊 VENTAJA: Progreso más lento pero sin necesidad de corte agresivo al final
📊 RESULTADO: Llegas a tu peso objetivo ya definido, no "gordo"`;
  }
})()}` : ""}

7. El tipo de dieta "${input.tipoDieta || "estandar"}" debe aplicarse ESTRICTAMENTE en todas las comidas. NO HAY EXCEPCIONES:
${input.tipoDieta === "mediterranea" ? "- Mediterránea: Enfocarse en aceite de oliva, pescados, vegetales, frutas, legumbres y granos integrales. Limitar carnes rojas y procesados." : ""}
${input.tipoDieta === "vegana" ? `- ⚠️ VEGANA (CRÍTICO - ABSOLUTAMENTE ESTRICTO):
  * SOLO alimentos de origen vegetal. CERO productos de origen animal.
  * EXCLUIR COMPLETAMENTE: carnes (res, pollo, cerdo, pavo, cordero, etc.), pescados (atún, salmón, merluza, etc.), mariscos (camarones, langostinos, etc.), huevos (en CUALQUIER forma: huevos enteros, claras, yemas, huevos revueltos, tortillas con huevo, etc.), lácteos (leche, queso, yogurt, mantequilla, crema, nata, etc.), miel, gelatina, y cualquier producto derivado de animales.
  * PROHIBIDO en ingredientes: huevos, leche, queso, yogurt, mantequilla, crema, nata, miel, gelatina, carnes, pescados, mariscos.
  * PROHIBIDO en métodos de preparación: "agregar huevo", "batir con huevo", "cocinar con mantequilla", "servir con queso", etc.
  * USAR SOLO: legumbres (garbanzos, lentejas, frijoles, soja), cereales (arroz, quinoa, avena), vegetales, frutas, frutos secos, semillas, tofu, tempeh, leches vegetales (almendras, avena, coco), aceites vegetales.
  * Asegurar fuentes vegetales de proteínas completas (legumbres combinadas con cereales).` : ""}
${input.tipoDieta === "vegetariana" ? "- Vegetariana: Excluir carnes y pescados. Incluir huevos y lácteos. Enfoque en vegetales, frutas, legumbres y granos." : ""}
${input.tipoDieta === "pescatariana" ? "- Pescatariana: Excluir carnes rojas, aves y otras carnes. Incluir pescados, mariscos, huevos y lácteos. Enfoque vegetal con omega-3 del pescado." : ""}
${input.tipoDieta === "flexitariana" ? "- Flexitariana: Principalmente vegetariana con consumo ocasional de carnes/pescados. Enfoque en plantas pero permitir flexibilidad ocasional." : ""}
${input.tipoDieta === "keto" ? "- Keto: Muy alta en grasas (70-80%), moderada en proteínas (20-25%), muy baja en carbohidratos (menos de 20-50g/día). Eliminar granos, azúcares, legumbres, frutas dulces." : ""}
${input.tipoDieta === "atkins" ? "- Atkins: Muy baja en carbohidratos inicialmente (menos de 20g/día), fases progresivas. Enfoque en proteínas, grasas saludables y vegetales sin almidón." : ""}
${input.tipoDieta === "low_carb" ? "- Low Carb: Reducir carbohidratos a 50-150g/día. Aumentar proteínas y grasas saludables. Limitar granos, azúcares y alimentos ricos en carbohidratos." : ""}
${input.tipoDieta === "paleo" ? "- Paleo: Carnes, pescados, huevos, frutas, verduras, frutos secos, semillas. EXCLUIR granos, legumbres, lácteos, alimentos procesados y azúcares refinados." : ""}
${input.tipoDieta === "dash" ? "- DASH: Rica en frutas, verduras, granos integrales, lácteos bajos en grasa, proteínas magras y frutos secos. Limitar sodio (sal), azúcares añadidos y grasas saturadas." : ""}
${input.tipoDieta === "mind" ? "- MIND: Combinación Mediterránea + DASH para salud cerebral. Priorizar verduras de hoja verde, frutos secos, bayas, legumbres, granos integrales, pescados, aves y aceite de oliva. Limitar carnes rojas, manteca, margarina, queso, dulces y fritos." : ""}
${input.tipoDieta === "antiinflamatoria" ? "- Antiinflamatoria: Rica en omega-3 (pescados grasos), antioxidantes (frutas y verduras coloridas), granos integrales, frutos secos, semillas y especias. Limitar procesados, azúcares refinados y grasas trans." : ""}
${input.tipoDieta === "tlc" ? "- TLC: Baja en grasas saturadas y colesterol. Rica en frutas, verduras, granos integrales y proteínas magras. Limitar carnes rojas, lácteos enteros y procesados. Enfoque en reducir colesterol." : ""}
${input.tipoDieta === "clinica_mayo" ? "- Clínica Mayo: Enfoque en hábitos saludables y control de porciones, no conteo de calorías. Alimentos densos en nutrientes: frutas, verduras, granos integrales y proteínas magras. Cambios sostenibles de estilo de vida." : ""}
${input.tipoDieta === "menopausia" ? "- Menopausia: Rica en calcio (lácteos, vegetales de hoja verde), fitoestrógenos (soja, legumbres), proteínas magras y granos integrales. Limitar azúcares refinados, cafeína y alcohol. Enfocada en densidad ósea y equilibrio hormonal." : ""}
${input.tipoDieta === "sin_gluten" ? "- Sin Gluten: Eliminar completamente trigo, cebada, centeno y sus derivados. Usar arroz, maíz, quinoa, avena certificada sin gluten. Incluir carnes, pescados, huevos, frutas y verduras naturales." : ""}
${!input.tipoDieta || input.tipoDieta === "estandar" ? "- Estándar: Sin restricciones específicas, incluir todos los grupos alimentarios de forma equilibrada." : ""}

${contextoMultiFase ? `
🔄 CONTEXTO PLAN MULTI-FASE (MES ${contextoMultiFase.mesActual} de ${contextoMultiFase.totalMeses}):

📊 PROGRESO DEL PLAN:
- Fase actual: ${contextoMultiFase.faseActual}
- Peso inicial del plan: ${contextoMultiFase.pesoInicial} kg
- Peso objetivo final: ${contextoMultiFase.pesoObjetivoFinal} kg
- Peso actual: ${input.pesoKg} kg
${contextoMultiFase.cambiaFase ? `
⚠️ CAMBIO DE FASE: El usuario está pasando a una nueva fase del plan.
Ajustar calorías, macros y entrenamiento según la nueva fase ${contextoMultiFase.faseActual}.` : ''}

📝 AJUSTES RECOMENDADOS BASADOS EN FEEDBACK DEL MES ANTERIOR:
${contextoMultiFase.ajustesRecomendados.length > 0 
  ? contextoMultiFase.ajustesRecomendados.map(a => `- ${a}`).join('\n')
  : '- Sin ajustes específicos (progreso según lo esperado)'
}

${contextoMultiFase.feedbackUsuario ? `
💬 COMENTARIOS DEL USUARIO:
"${contextoMultiFase.feedbackUsuario}"
Considerar estos comentarios al generar el plan de este mes.` : ''}

⚠️ IMPORTANTE - APLICAR ESTOS AJUSTES:
1. Si hay ajustes de calorías recomendados, aplicarlos al calcular calorias_diarias
2. Si se menciona reducir volumen de entrenamiento, generar menos ejercicios o días
3. Si hay lesiones nuevas, adaptar ejercicios y agregar alternativas seguras
4. Si la adherencia fue baja, simplificar el plan (menos opciones, comidas más simples)
5. Variar las comidas respecto al mes anterior para evitar monotonía
` : ''}

Ajusta las calorías, macros y selección de alimentos según la intensidad y tipo de dieta seleccionados.`;

    // Use fetch to avoid adding deps, with timeout for faster fallback
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 150000); // 150s (2.5 min) - alineado con Vercel maxDuration
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.5, // Más bajo para respuestas más rápidas y determinísticas
        max_tokens: 3500, // Reducido para acelerar generación (sigue siendo suficiente)
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "Sos un experto en nutrición, entrenamiento personal y deportología. Actuá como personal trainer certificado, nutricionista deportivo y deportólogo. Responde SOLO con JSON válido. PRIORIDAD: generar 'plan_semanal' primero (7 días, 4 comidas cada uno). Para 'training_plan', incluir detalles técnicos completos (RPE, tempo, técnica, progresión, alternativas) adaptados al nivel del usuario y lesiones. Sé conciso pero completo." },
          { role: "user", content: prompt },
        ],
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!resp.ok) {
      const detail = await resp.text().catch(() => "");
      return res.status(502).json({ error: "OpenAI no disponible", detail });
    }

    const data = await resp.json();
    const raw = data.choices?.[0]?.message?.content ?? "";
    const content = typeof raw === "string" ? raw.trim() : JSON.stringify(raw ?? {});
    if (!content) return res.status(502).json({ error: "Respuesta vacía de OpenAI" });

    function stripFences(s: string) {
      return s.replace(/^```json\n?|```$/g, "").replace(/^```\n?|```$/g, "");
    }
    function tryParseJson(s: string) {
      try { return JSON.parse(s); } catch {}
      // eliminar comas colgantes
      const noTrailingCommas = s.replace(/,\s*(\}|\])/g, "$1");
      try { return JSON.parse(noTrailingCommas); } catch {}
      // Heurística: cerrar comillas faltantes en items de arrays (líneas que empiezan con " y no cierran antes de salto/],)
      const closeUnterminatedStrings = (txt: string) => {
        // Cerrar antes de salto de línea
        let fixed = txt.replace(/(\n\s*"[^"\n\r]+)(\n)/g, '$1"$2');
        // Cerrar antes de cierre de array
        fixed = fixed.replace(/(\n\s*"[^"\n\r]+)(\s*\])/g, '$1"$2');
        // Cerrar antes de coma
        fixed = fixed.replace(/(\n\s*"[^"\n\r]+)(\s*,)/g, '$1"$2');
        return fixed;
      };
      const sClosed = closeUnterminatedStrings(noTrailingCommas);
      // Si aún hay comillas impares, cerrar al final
      const quoteCount2 = (sClosed.match(/"/g) || []).length;
      const sClosedBalanced = quoteCount2 % 2 !== 0 ? (sClosed + '"') : sClosed;
      try { return JSON.parse(sClosedBalanced); } catch {}
      // Intentar reparar JSON truncado: encontrar el objeto más grande válido
      let best: Record<string, unknown> | null = null;
      let bestLen = 0;
      for (let end = s.length; end > 0; end--) {
        const slice = s.slice(0, end);
        // Cerrar objetos/arrays abiertos
        let fixed = slice;
        const openBraces = (fixed.match(/\{/g) || []).length;
        const closeBraces = (fixed.match(/\}/g) || []).length;
        const openBrackets = (fixed.match(/\[/g) || []).length;
        const closeBrackets = (fixed.match(/\]/g) || []).length;
        // Cerrar arrays dentro de objetos
        for (let i = openBrackets - closeBrackets; i > 0; i--) fixed += "]";
        // Cerrar strings abiertas
        const quoteCount = (fixed.match(/"/g) || []).length;
        if (quoteCount % 2 !== 0) fixed += '"';
        // Cerrar objetos
        for (let i = openBraces - closeBraces; i > 0; i--) fixed += "}";
        // Eliminar comas finales antes de cerrar
        fixed = fixed.replace(/,\s*(\}|\])/g, "$1");
        try {
          const parsed = JSON.parse(fixed);
          if (end > bestLen) {
            best = parsed;
            bestLen = end;
          }
        } catch {}
      }
      return best;
    }
    const jsonString = stripFences(content);
    const parsedRaw = tryParseJson(jsonString);
    
    // Logging para diagnóstico
    console.log("🔍 OpenAI response length:", content.length);
    console.log("🔍 Parsed raw type:", typeof parsedRaw);
    if (parsedRaw && typeof parsedRaw === "object") {
      const keys = Object.keys(parsedRaw as Record<string, unknown>);
      console.log("🔍 Keys en parsed:", keys);
      console.log("🔍 plan_semanal existe?", "plan_semanal" in (parsedRaw as Record<string, unknown>));
      console.log("🔍 plan_semanal es array?", Array.isArray((parsedRaw as Record<string, unknown>).plan_semanal));
      if ((parsedRaw as Record<string, unknown>).plan_semanal) {
        console.log("🔍 plan_semanal tipo:", typeof (parsedRaw as Record<string, unknown>).plan_semanal);
        const planSemStr = JSON.stringify((parsedRaw as Record<string, unknown>).plan_semanal);
        console.log("🔍 plan_semanal valor (primeros 200 chars):", planSemStr ? planSemStr.substring(0, 200) : "undefined");
      }
    }
    
    // Logs específicos para "definicion"
    if (isDefinicion) {
      console.log("🔍 [DEFINICIÓN] Respuesta recibida de OpenAI");
      console.log("🔍 [DEFINICIÓN] Longitud de respuesta:", content.length);
      if (parsedRaw && typeof parsedRaw === "object") {
        const parsed = parsedRaw as Record<string, unknown>;
        console.log("🔍 [DEFINICIÓN] Keys en respuesta:", Object.keys(parsed));
        console.log("🔍 [DEFINICIÓN] plan_semanal presente:", "plan_semanal" in parsed);
        if ("plan_semanal" in parsed) {
          const planSem = parsed.plan_semanal;
          console.log("🔍 [DEFINICIÓN] plan_semanal es array:", Array.isArray(planSem));
          if (Array.isArray(planSem)) {
            console.log("🔍 [DEFINICIÓN] Número de días en plan_semanal:", planSem.length);
            planSem.forEach((dia, idx) => {
              if (typeof dia === 'object' && dia !== null) {
                const d = dia as Record<string, unknown>;
                console.log(`🔍 [DEFINICIÓN] Día ${idx + 1}: nombre="${d.dia}", comidas=${Array.isArray(d.comidas) ? d.comidas.length : 0}`);
              }
            });
          } else {
            console.error("❌ [DEFINICIÓN] plan_semanal NO es array, tipo:", typeof planSem);
            const planSemStr = JSON.stringify(planSem);
            console.error("❌ [DEFINICIÓN] Valor de plan_semanal:", planSemStr ? planSemStr.substring(0, 500) : "undefined");
          }
        } else {
          console.error("❌ [DEFINICIÓN] plan_semanal NO está presente en la respuesta");
        }
      }
    }
    
    // Normalizar y validar el plan semanal
    if (parsedRaw && typeof parsedRaw === "object" && parsedRaw !== null) {
      const parsed = parsedRaw as Record<string, unknown>;
      
      // Intentar buscar plan_semanal en diferentes ubicaciones
      let planSemanal: unknown = parsed.plan_semanal;
      if (!Array.isArray(planSemanal) && parsed.data && typeof parsed.data === 'object') {
        planSemanal = (parsed.data as Record<string, unknown>).plan_semanal;
      }
      if (!Array.isArray(planSemanal) && parsed.response && typeof parsed.response === 'object') {
        planSemanal = (parsed.response as Record<string, unknown>).plan_semanal;
      }
      
      if (Array.isArray(planSemanal)) {
        parsed.plan_semanal = planSemanal;
        // Función para normalizar el nombre de la comida
        const normalizarNombreComida = (nombre: string): string => {
          const nombreLower = nombre.toLowerCase().trim();
          if (nombreLower.includes("desayuno")) return "Desayuno";
          if (nombreLower.includes("almuerzo")) return "Almuerzo";
          if (nombreLower.includes("snack") || nombreLower.includes("merienda")) return "Snack";
          if (nombreLower.includes("cena")) return "Cena";
          return nombre; // Mantener si no coincide
        };
        
        // Función para obtener hora por defecto según tipo de comida
        const obtenerHoraPorDefecto = (nombre: string): string => {
          const nombreLower = nombre.toLowerCase();
          if (nombreLower.includes("desayuno")) return "08:00";
          if (nombreLower.includes("almuerzo")) return "13:00";
          if (nombreLower.includes("snack") || nombreLower.includes("merienda")) return "17:00";
          if (nombreLower.includes("cena")) return "20:00";
          return "12:00";
        };
        
        // Validar que las opciones sean válidas (no placeholders)
        const esOpcionValida = (opcion: string): boolean => {
          if (!opcion || typeof opcion !== 'string') return false;
          const lower = opcion.toLowerCase().trim();
          // Rechazar placeholders genéricos
          const placeholders = ['opción disponible', 'opcion disponible', 'opción 1', 'opcion 1', 'opción 2', 'opcion 2', 'opción 3', 'opcion 3', 'placeholder', 'texto', ''];
          return !placeholders.includes(lower) && lower.length > 5; // Mínimo 5 caracteres para ser descriptivo
        };

        // Validar y normalizar días existentes
        const erroresValidacion: string[] = [];
        
        parsed.plan_semanal = (parsed.plan_semanal as Array<Record<string, unknown>>).map((day: Record<string, unknown>) => {
          const d = day as Record<string, unknown>;
          const comidasRaw = (d.comidas as unknown[]) || [];
          const nombreDia = typeof d.dia === "string" ? d.dia : "Día desconocido";
          
          // Normalizar cada comida
          const comidasNormalizadas = comidasRaw.map((meal) => {
            const m = meal as Record<string, unknown>;
            const nombreRaw = typeof m.nombre === "string" ? m.nombre : "Comida";
            const nombreNormalizado = normalizarNombreComida(nombreRaw);
            
            const opcionesRaw = Array.isArray(m.opciones) ? m.opciones : [];
            const opcionesValidas = opcionesRaw
              .filter((o): o is string => typeof o === "string" && o.trim().length > 0)
              .filter(esOpcionValida);
            
            // Si no hay al menos 3 opciones válidas, registrar error pero continuar
            if (opcionesValidas.length < 3) {
              const opcionesTexto = opcionesRaw.slice(0, 3).map(o => {
                const oStr = String(o || '');
                return `"${oStr.length > 50 ? oStr.substring(0, 50) : oStr}"`;
              }).join(', ');
              erroresValidacion.push(`Día "${nombreDia}", comida "${nombreNormalizado}": solo ${opcionesValidas.length} opciones válidas de ${opcionesRaw.length} recibidas. Opciones: ${opcionesTexto}`);
              
              // Intentar usar las opciones que sí tenemos (aunque sean menos de 3)
              // Si hay al menos 1 opción válida, la usamos; si no, usamos las primeras 3 no válidas como último recurso
              if (opcionesValidas.length > 0) {
                // Usar las opciones válidas que tenemos
                const opcionesFinales = opcionesValidas.slice(0, 3);
                // Si tenemos menos de 3, rellenar con las primeras opciones que no son placeholders obvios
                while (opcionesFinales.length < 3 && opcionesRaw.length > opcionesFinales.length) {
                  const siguiente = opcionesRaw.find((o) => 
                    typeof o === "string" && 
                    o.trim().length > 5 && 
                    !opcionesFinales.includes(o) &&
                    !esOpcionValida(o) // No es válida pero tampoco es placeholder obvio
                  );
                  if (siguiente && typeof siguiente === "string") {
                    opcionesFinales.push(siguiente);
                  } else {
                    break;
                  }
                }
                // Si aún no tenemos 3, usar las primeras opciones recibidas (aunque no pasen validación estricta)
                while (opcionesFinales.length < 3 && opcionesRaw.length > 0) {
                  const siguiente = opcionesRaw.find(o => typeof o === "string" && !opcionesFinales.includes(o));
                  if (siguiente && typeof siguiente === "string" && siguiente.trim().length > 0) {
                    opcionesFinales.push(siguiente);
                  } else {
                    break;
                  }
                }
                
                const macrosAprox =
                  m.macros_aprox && typeof m.macros_aprox === "object" ? (m.macros_aprox as Record<string, unknown>) : null;
                return {
                  hora: typeof m.hora === "string" ? m.hora : obtenerHoraPorDefecto(nombreNormalizado),
                  nombre: nombreNormalizado,
                  opciones: opcionesFinales.slice(0, 3),
                  calorias_kcal: typeof m.calorias_kcal === "number" ? m.calorias_kcal : 0,
                  cantidad_gramos: typeof m.cantidad_gramos === "number" ? m.cantidad_gramos : 0,
                  ...(macrosAprox ? { macros_aprox: macrosAprox } : {}),
                };
              }
            }
            
            const macrosAprox =
              m.macros_aprox && typeof m.macros_aprox === "object" ? (m.macros_aprox as Record<string, unknown>) : null;
            return {
              hora: typeof m.hora === "string" ? m.hora : obtenerHoraPorDefecto(nombreNormalizado),
              nombre: nombreNormalizado,
              opciones: opcionesValidas.slice(0, 3), // Asegurar exactamente 3 opciones válidas
              calorias_kcal: typeof m.calorias_kcal === "number" ? m.calorias_kcal : 0,
              cantidad_gramos: typeof m.cantidad_gramos === "number" ? m.cantidad_gramos : 0,
              ...(macrosAprox ? { macros_aprox: macrosAprox } : {}),
            };
          });
          
          // Asegurar que hay al menos 4 comidas por día
          const tiposEsperados = ["Desayuno", "Almuerzo", "Snack", "Cena"];
          const comidasFinales = [...comidasNormalizadas];
          
          // Validar que todas las comidas necesarias existen
          for (const tipo of tiposEsperados) {
            const existe = comidasFinales.some(c => c.nombre === tipo);
            if (!existe) {
              erroresValidacion.push(`Día "${nombreDia}": falta la comida "${tipo}"`);
            }
          }
          
          // Ordenar comidas según orden esperado
          const comidasOrdenadas = tiposEsperados
            .map(tipo => comidasFinales.find(c => c.nombre === tipo))
            .filter((c): c is typeof comidasFinales[0] => c !== undefined);
          
          // Agregar cualquier comida extra al final
          const comidasExtras = comidasFinales.filter(c => !tiposEsperados.includes(c.nombre));
          comidasOrdenadas.push(...comidasExtras);
          
          return {
            ...d,
            dia: typeof d.dia === "string" ? d.dia : "Día",
            comidas: comidasOrdenadas,
          };
        });
        
        // Si hay errores críticos, retornar error
        if (erroresValidacion.length > 0) {
          console.error("⚠️ Errores de validación en plan_semanal:", erroresValidacion);
          // Si hay muchos errores o errores críticos, fallar
          const erroresCriticos = erroresValidacion.filter(e => e.includes("falta la comida"));
          if (erroresCriticos.length > 0) {
            return res.status(422).json({ 
              error: "OpenAI no devolvió todas las comidas requeridas", 
              detail: erroresCriticos.join("; ") + ". Errores adicionales: " + erroresValidacion.filter(e => !e.includes("falta la comida")).slice(0, 3).join("; ")
            });
          }
          // Si solo son advertencias de opciones, continuar pero registrar
          console.warn("⚠️ Continuando con advertencias:", erroresValidacion.slice(0, 5).join("; "));
        }
        
        // Completar hasta 7 días si faltan, normalizando nombres y variando opciones
        const diasEsperados = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
        const planSemanalArray = parsed.plan_semanal as Array<Record<string, unknown>>;
        const normalizarDia = (name: unknown): string => {
          if (typeof name !== 'string') return '';
          const n = name.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
          const map: Record<string,string> = {
            lunes: 'Lunes',
            martes: 'Martes',
            miercoles: 'Miércoles',
            miércoles: 'Miércoles',
            jueves: 'Jueves',
            viernes: 'Viernes',
            sabado: 'Sábado',
            sábado: 'Sábado',
            domingo: 'Domingo'
          };
          return map[n] || '';
        };
        
        // Crear un mapa de días existentes
        const diasMap = new Map<string, Record<string, unknown>>();
        for (const day of planSemanalArray) {
          const diaNombre = normalizarDia((day as Record<string, unknown>).dia);
          diasMap.set(diaNombre, day);
        }
        
        // Crear el plan completo con los 7 días, completando automáticamente los faltantes
        const planCompleto: Array<Record<string, unknown>> = [];
        const diasDisponibles = Array.from(diasMap.values());
        
        // Función auxiliar para crear un día basado en otro día, rotando opciones
        const crearDiaBasadoEn = (diaBase: Record<string, unknown>, nombreDia: string, offset: number): Record<string, unknown> => {
          const comidasBase = (diaBase.comidas as Array<Record<string, unknown>>) || [];
          const tiposEsperados = ["Desayuno", "Almuerzo", "Snack", "Cena"];
          const horasEsperadas = ["08:00", "13:00", "17:00", "20:00"];
          
          const comidasNuevas = tiposEsperados.map((tipo, idxComida) => {
            // Buscar comida del mismo tipo en el día base
            const comidaBase = comidasBase.find(c => {
              const nombreComida = String(c.nombre || '').toLowerCase();
              return nombreComida.includes(tipo.toLowerCase());
            });
            
            if (comidaBase && Array.isArray(comidaBase.opciones)) {
              const opcionesBase = comidaBase.opciones.filter((o): o is string => typeof o === "string" && esOpcionValida(o));
              if (opcionesBase.length >= 3) {
                // Rotar opciones para variar (usar offset para seleccionar diferentes opciones)
                const opcionesRotadas = opcionesBase.map((_, idx) => {
                  const newIdx = (idx + offset) % opcionesBase.length;
                  return opcionesBase[newIdx];
                });
                return {
                  nombre: tipo,
                  hora: horasEsperadas[idxComida],
                  opciones: opcionesRotadas.slice(0, 3)
                };
              }
            }
            
            // Fallback: usar opciones de otro día si no hay comida base
            const otroDia = diasDisponibles[offset % diasDisponibles.length];
            const comidasOtroDia = (otroDia?.comidas as Array<Record<string, unknown>>) || [];
            const comidaOtroDia = comidasOtroDia.find(c => {
              const nombreComida = String(c.nombre || '').toLowerCase();
              return nombreComida.includes(tipo.toLowerCase());
            });
            if (comidaOtroDia && Array.isArray(comidaOtroDia.opciones)) {
              const opcionesOtro = comidaOtroDia.opciones.filter((o): o is string => typeof o === "string" && esOpcionValida(o));
              if (opcionesOtro.length >= 3) {
                return {
                  nombre: tipo,
                  hora: horasEsperadas[idxComida],
                  opciones: opcionesOtro.slice(0, 3)
                };
              }
            }
            
            // Último fallback: opciones genéricas
            return {
              nombre: tipo,
              hora: horasEsperadas[idxComida],
              opciones: [`${tipo} saludable opción 1`, `${tipo} saludable opción 2`, `${tipo} saludable opción 3`]
            };
          });
          
          return {
            dia: nombreDia,
            comidas: comidasNuevas
          };
        };
        
        for (let i = 0; i < 7; i++) {
          const nombreDia = diasEsperados[i];
          let diaActual = diasMap.get(nombreDia);
          
          // Si el día no existe, crearlo automáticamente basándose en otro día
          if (!diaActual) {
            console.log(`⚠️ Día "${nombreDia}" faltante, creando automáticamente...`);
            // Usar el día anterior o el siguiente disponible como base
            const diaAnteriorIdx = (i - 1 + 7) % 7;
            const diaSiguienteIdx = (i + 1) % 7;
            const diaAnterior = diasMap.get(diasEsperados[diaAnteriorIdx]);
            const diaSiguiente = diasMap.get(diasEsperados[diaSiguienteIdx]);
            const diaBase = diaAnterior || diaSiguiente || diasDisponibles[0];
            
            if (diaBase) {
              diaActual = crearDiaBasadoEn(diaBase, nombreDia, i);
              console.log(`✅ Día "${nombreDia}" creado automáticamente`);
            } else {
              // Si no hay ningún día base, esto es un error crítico
              return res.status(422).json({ 
                error: "OpenAI no devolvió ningún día válido", 
                detail: `No se pudo crear el día "${nombreDia}" porque no hay días base disponibles. Días recibidos: ${planSemanalArray.length}` 
              });
            }
          }
          
          // Validar que el día tenga todas las comidas con opciones válidas
          const comidasDelDia = (diaActual.comidas as Array<Record<string, unknown>>) || [];
          const tiposEsperados = ["Desayuno", "Almuerzo", "Snack", "Cena"];
          
          // Verificar que tenga todas las comidas
          for (const tipo of tiposEsperados) {
            const tieneComida = comidasDelDia.some(c => {
              const nombreComida = String(c.nombre || '').toLowerCase();
              return nombreComida.includes(tipo.toLowerCase());
            });
            
            if (!tieneComida) {
              console.log(`⚠️ Día "${nombreDia}" falta comida "${tipo}", creando automáticamente...`);
              // Crear comida faltante basándose en otras comidas del mismo tipo de otros días
              const otroDia = diasDisponibles.find(d => {
                const comidas = (d.comidas as Array<Record<string, unknown>>) || [];
                return comidas.some(c => {
                  const nombreComida = String(c.nombre || '').toLowerCase();
                  return nombreComida.includes(tipo.toLowerCase());
                });
              });
              
              if (otroDia) {
                const comidasOtroDia = (otroDia.comidas as Array<Record<string, unknown>>) || [];
                const comidaOtroDia = comidasOtroDia.find(c => {
                  const nombreComida = String(c.nombre || '').toLowerCase();
                  return nombreComida.includes(tipo.toLowerCase());
                });
                
                if (comidaOtroDia && Array.isArray(comidaOtroDia.opciones)) {
                  const opciones = comidaOtroDia.opciones.filter((o): o is string => typeof o === "string" && esOpcionValida(o));
                  if (opciones.length >= 3) {
                    const horasEsperadas: Record<string, string> = {
                      "Desayuno": "08:00",
                      "Almuerzo": "13:00",
                      "Snack": "17:00",
                      "Cena": "20:00"
                    };
                    comidasDelDia.push({
                      nombre: tipo,
                      hora: horasEsperadas[tipo],
                      opciones: opciones.slice(0, 3)
                    });
                    console.log(`✅ Comida "${tipo}" creada automáticamente para "${nombreDia}"`);
                  }
                }
              }
            }
          }
          
          // Validar opciones de cada comida
          for (const comida of comidasDelDia) {
            const opciones = Array.isArray(comida.opciones) ? comida.opciones : [];
            const opcionesValidas = opciones.filter((o): o is string => typeof o === "string" && esOpcionValida(o));
            if (opcionesValidas.length < 3) {
              console.log(`⚠️ Día "${nombreDia}", comida "${comida.nombre}" tiene solo ${opcionesValidas.length} opciones válidas, completando...`);
              // Buscar opciones válidas de otras comidas del mismo tipo
              const tipoComida = String(comida.nombre || '').toLowerCase();
              const otroDia = diasDisponibles.find(d => {
                const comidas = (d.comidas as Array<Record<string, unknown>>) || [];
                return comidas.some(c => {
                  const nombreComida = String(c.nombre || '').toLowerCase();
                  return nombreComida.includes(tipoComida) && Array.isArray(c.opciones) && c.opciones.length >= 3;
                });
              });
              
              if (otroDia) {
                const comidasOtroDia = (otroDia.comidas as Array<Record<string, unknown>>) || [];
                const comidaOtroDia = comidasOtroDia.find(c => {
                  const nombreComida = String(c.nombre || '').toLowerCase();
                  return nombreComida.includes(tipoComida);
                });
                
                if (comidaOtroDia && Array.isArray(comidaOtroDia.opciones)) {
                  const opcionesOtro = comidaOtroDia.opciones.filter((o): o is string => typeof o === "string" && esOpcionValida(o));
                  if (opcionesOtro.length >= 3) {
                    comida.opciones = opcionesOtro.slice(0, 3);
                    console.log(`✅ Opciones completadas para "${comida.nombre}" en "${nombreDia}"`);
                  }
                }
              }
              
              // Si aún no hay 3 opciones válidas, es un error
              const opcionesFinales = Array.isArray(comida.opciones) ? comida.opciones.filter((o): o is string => typeof o === "string" && esOpcionValida(o)) : [];
              if (opcionesFinales.length < 3) {
                return res.status(422).json({ 
                  error: "No se pudieron completar las opciones válidas para todas las comidas", 
                  detail: `El día "${nombreDia}" tiene la comida "${comida.nombre}" con solo ${opcionesFinales.length} opciones válidas después de intentar completar (se requieren 3).` 
                });
              }
            }
          }
          
          planCompleto.push(diaActual);
        }
        
        console.log(`✅ Plan completo generado con ${planCompleto.length} días`);
        
        parsed.plan_semanal = planCompleto;
      }
    }
    
    const parsedFinal = parsedRaw as Record<string, unknown> | null;
    
    // Intenta auto-corregir estructura mínima faltante antes de devolver 422
    if (parsedFinal && typeof parsedFinal === 'object') {
      const out = parsedFinal as Record<string, unknown>;
      // Fallback calorías - usar valor precalculado del frontend si está disponible
      if (typeof out.calorias_diarias !== 'number' || !isFinite(out.calorias_diarias as number)) {
        out.calorias_diarias = caloriasObjetivoDelFrontend || 2200;
        console.log(`⚠️ Calorías no válidas de OpenAI, usando fallback: ${out.calorias_diarias}`);
      } else if (caloriasObjetivoDelFrontend) {
        // Si tenemos calorías del frontend y OpenAI generó algo muy diferente (>15% diferencia), preferir el frontend
        const diferencia = Math.abs((out.calorias_diarias as number) - caloriasObjetivoDelFrontend);
        const porcentajeDiferencia = (diferencia / caloriasObjetivoDelFrontend) * 100;
        if (porcentajeDiferencia > 15) {
          console.log(`⚠️ Calorías de OpenAI (${out.calorias_diarias}) difieren mucho del objetivo (${caloriasObjetivoDelFrontend}). Usando valor del frontend.`);
          out.calorias_diarias = caloriasObjetivoDelFrontend;
        }
      }
      // Fallback macros - usar valores precalculados del frontend si están disponibles
      if (!out.macros || typeof out.macros !== 'object') {
        out.macros = macrosDelFrontend 
          ? { proteinas: macrosDelFrontend.proteinas, grasas: macrosDelFrontend.grasas, carbohidratos: macrosDelFrontend.carbohidratos }
          : { proteinas: '150g', grasas: '70g', carbohidratos: '240g' };
        console.log(`⚠️ Macros no válidos de OpenAI, usando fallback:`, out.macros);
      } else if (macrosDelFrontend) {
        // Verificar si los macros de OpenAI son muy diferentes a los calculados
        const proteinasOpenAI = parseInt(String((out.macros as Record<string, string>).proteinas || '0'));
        const proteinasCalculadas = parseInt(macrosDelFrontend.proteinas);
        const diferenciaProteinas = Math.abs(proteinasOpenAI - proteinasCalculadas);
        
        // Si la diferencia en proteínas es mayor a 30g, usar los valores calculados
        if (diferenciaProteinas > 30) {
          console.log(`⚠️ Macros de OpenAI (${proteinasOpenAI}g prot) difieren mucho de los calculados (${proteinasCalculadas}g prot). Usando valores del frontend.`);
          out.macros = { 
            proteinas: macrosDelFrontend.proteinas, 
            grasas: macrosDelFrontend.grasas, 
            carbohidratos: macrosDelFrontend.carbohidratos 
          };
        }
      }
      if (Array.isArray(out.plan_semanal) && out.macros && typeof out.macros === "object") {
        const mm = out.macros as Record<string, string>;
        ensureMealMacrosAprox(out.plan_semanal as Array<Record<string, unknown>>, {
          proteinas: mm.proteinas ?? "0g",
          grasas: mm.grasas ?? "0g",
          carbohidratos: mm.carbohidratos ?? "0g",
        });
      }
      // Fallback distribución diaria
      if (!out.distribucion_diaria_pct || typeof out.distribucion_diaria_pct !== 'object') {
        out.distribucion_diaria_pct = { desayuno: 28, almuerzo: 34, snacks: 12, cena: 26 };
      }
      // Si falta plan_semanal, intentar reparación automática con una segunda llamada a OpenAI
      if (!Array.isArray(out.plan_semanal)) {
        console.log("⚠️ plan_semanal no es array, intentando reparación automática...");
        if (isDefinicion) {
          console.error("❌ [DEFINICIÓN] plan_semanal faltante antes de reparación");
          console.error("❌ [DEFINICIÓN] Tipo de plan_semanal:", typeof out.plan_semanal);
          const planSemStr = JSON.stringify(out.plan_semanal);
          console.error("❌ [DEFINICIÓN] Valor de plan_semanal:", planSemStr ? planSemStr.substring(0, 300) : "undefined");
        }
        try {
          const repairController = new AbortController();
          const repairTimeout = setTimeout(() => repairController.abort(), 120000); // 120s para reparación
          const input = req.body as UserInput;
          const repairPrompt = `Genera SOLO un objeto JSON con un campo "plan_semanal" que sea un array de 7 días (Lunes, Martes, Miércoles, Jueves, Viernes, Sábado, Domingo). Cada día debe tener:
- "dia": uno de los días de la semana
- "comidas": array con 4 comidas:
  * Desayuno (hora: "08:00") con 3 opciones descriptivas
  * Almuerzo (hora: "13:00") con 3 opciones descriptivas
  * Snack (hora: "17:00") con 3 opciones descriptivas
  * Cena (hora: "20:00") con 3 opciones descriptivas

Cada comida debe tener: "hora", "nombre", "opciones" (array de 3 strings descriptivos y reales), "calorias_kcal" (number), "cantidad_gramos" (number).

IMPORTANTE: 
- Las opciones deben ser nombres REALES de platos (ej: "Avena con frutos rojos y miel", "Pollo a la plancha con arroz integral")
- PROHIBIDO usar placeholders como "Opción disponible", "Opción 1", etc.
- Variar las opciones entre días
- Adaptar a: objetivo="${input.objetivo}", intensidad="${input.intensidad}", dieta="${input.tipoDieta}"
- ⚠️ RESTRICCIONES (EXCLUIR ABSOLUTAMENTE): ${input.restricciones && input.restricciones.length > 0 
  ? input.restricciones.map(r => {
      const rLower = String(r).toLowerCase().trim();
      if (rLower.includes('pescado') || rLower.includes('pescados') || rLower.includes('marisco') || rLower.includes('mariscos')) {
        return `"${r}" → EXCLUIR: atún, salmón, merluza, sardinas, caballa, bacalao, trucha, lubina, dorada, langostinos, camarones, calamares, pulpo, mejillones, almejas, y TODOS los pescados/mariscos`;
      }
      if (rLower.includes('gluten')) {
        return `"${r}" → EXCLUIR: trigo, cebada, centeno, avena, pan, pasta, harina`;
      }
      if (rLower.includes('lacteo') || rLower.includes('lácteo')) {
        return `"${r}" → EXCLUIR: leche, queso, yogurt, mantequilla, crema`;
      }
      if (rLower.includes('cerdo') || rLower.includes('puerco')) {
        return `"${r}" → EXCLUIR: cerdo, puerco, jamón, tocino, chorizo`;
      }
      return `"${r}" → EXCLUIR completamente este alimento y derivados`;
    }).join('; ')
  : 'Ninguna'}
- Preferencias: ${JSON.stringify(input.preferencias || [])}

Ejemplo de estructura:
{
  "plan_semanal": [
    {
      "dia": "Lunes",
      "comidas": [
        {
          "hora": "08:00",
          "nombre": "Desayuno",
          "opciones": ["Avena con frutos rojos y miel", "Tostadas integrales con palta y huevo", "Yogur griego con granola"],
          "calorias_kcal": 450,
          "cantidad_gramos": 300
        },
        ...
      ]
    },
    ...
  ]
}`;
          const repairResp = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: "gpt-4o-mini",
              temperature: 0.5,
              max_tokens: 3000, // Reducido para reparación rápida (solo plan_semanal)
              response_format: { type: "json_object" },
              messages: [
                { role: "system", content: "Respondé SOLO con JSON válido. El objeto debe tener un campo 'plan_semanal' que sea un array de EXACTAMENTE 7 días (Lunes a Domingo), cada uno con 4 comidas y 3 opciones descriptivas cada una." },
                { role: "user", content: repairPrompt }
              ]
            }),
            signal: repairController.signal,
          });
          clearTimeout(repairTimeout);
          if (repairResp.ok) {
            const repairData = await repairResp.json();
            const repairContent = repairData.choices?.[0]?.message?.content?.trim();
            console.log("🔧 Repair response length:", repairContent?.length || 0);
            if (repairContent) {
              try {
                const repairJson = stripFences(repairContent);
                const repairParsed = tryParseJson(repairJson);
                console.log("🔧 Repair parsed type:", typeof repairParsed);
                if (repairParsed && typeof repairParsed === "object") {
                  const repairKeys = Object.keys(repairParsed as Record<string, unknown>);
                  console.log("🔧 Repair keys:", repairKeys);
                  if (Array.isArray((repairParsed as Record<string, unknown>).plan_semanal)) {
                    out.plan_semanal = (repairParsed as Record<string, unknown>).plan_semanal;
                    console.log("✅ Repair exitoso: plan_semanal tiene", (out.plan_semanal as unknown[]).length, "días");
                    if (isDefinicion) {
                      console.log("✅ [DEFINICIÓN] Reparación exitosa, días restaurados:", (out.plan_semanal as unknown[]).length);
                    }
                  } else {
                    console.log("❌ Repair falló: plan_semanal no es array");
                    if (isDefinicion) {
                      console.error("❌ [DEFINICIÓN] Reparación falló: plan_semanal aún no es array");
                    }
                  }
                }
              } catch (e) {
                console.error("❌ Error parsing repair response:", e);
              }
            }
          } else {
            console.error("❌ Repair request failed:", repairResp.status);
          }
        } catch (e) {
          console.error("❌ Error en reparación automática:", e);
        }
        if (!Array.isArray(out.plan_semanal)) {
          console.error("❌ Final: plan_semanal aún no es array después de reparación");
          if (isDefinicion) {
            console.error("❌ [DEFINICIÓN] ERROR CRÍTICO: plan_semanal no disponible después de reparación");
            console.error("❌ [DEFINICIÓN] Objetivo:", input.objetivo);
            console.error("❌ [DEFINICIÓN] Intensidad:", input.intensidad);
          }
          return res.status(422).json({ 
            error: "OpenAI no devolvió plan_semanal", 
            detail: "El campo 'plan_semanal' es obligatorio y debe ser un array con 7 días (Lunes a Domingo), cada uno con 4 comidas (Desayuno, Almuerzo, Snack, Cena) y cada comida con 3 opciones descriptivas. Revisa los logs del servidor para más detalles." 
          });
        } else if (isDefinicion) {
          console.log("✅ [DEFINICIÓN] plan_semanal validado correctamente después de reparación");
          console.log("✅ [DEFINICIÓN] Número de días:", (out.plan_semanal as unknown[]).length);
        }
      }
    }
    
    if (!parsedFinal || !Array.isArray((parsedFinal as Record<string, unknown>).plan_semanal)) {
      const detailContent = typeof content === 'string' && content.length > 0 
        ? content.slice(0, 1000) 
        : "Respuesta inválida o vacía de OpenAI";
      return res.status(422).json({ error: "JSON inválido devuelto por OpenAI", detail: detailContent });
    }
    
    // Función para calcular distribución recomendada según objetivo e intensidad
    const calcularDistribucionRecomendada = (objetivo: string, intensidad: string) => {
      const obj = objetivo.toLowerCase();
      const int = (intensidad || "moderada").toLowerCase();
      
      // Objetivos de ganancia (necesitan más calorías temprano)
      if (obj === "ganar_masa" || obj === "volumen") {
        if (int === "intensa") {
          return { desayuno: 28, almuerzo: 38, snacks: 12, cena: 22 };
        } else if (int === "leve") {
          return { desayuno: 26, almuerzo: 36, snacks: 14, cena: 24 };
        } else {
          return { desayuno: 27, almuerzo: 37, snacks: 13, cena: 23 };
        }
      }
      
      // Objetivos de pérdida (distribución más equilibrada)
      if (obj === "perder_grasa" || obj === "definicion" || obj === "corte") {
        if (int === "intensa") {
          return { desayuno: 28, almuerzo: 32, snacks: 12, cena: 28 };
        } else if (int === "leve") {
          return { desayuno: 26, almuerzo: 30, snacks: 14, cena: 30 };
        } else {
          return { desayuno: 27, almuerzo: 31, snacks: 13, cena: 29 };
        }
      }
      
      // Mantener o recomposición (distribución equilibrada)
      if (obj === "mantener" || obj === "recomposicion" || obj === "mantenimiento_avanzado") {
        if (int === "intensa") {
          return { desayuno: 26, almuerzo: 33, snacks: 11, cena: 30 };
        } else if (int === "leve") {
          return { desayuno: 25, almuerzo: 32, snacks: 13, cena: 30 };
        } else {
          return { desayuno: 26, almuerzo: 33, snacks: 12, cena: 29 };
        }
      }
      
      // Distribución por defecto (equilibrada)
      return { desayuno: 26, almuerzo: 33, snacks: 12, cena: 29 };
    };
    
    // Validar y ajustar distribución diaria si es necesario
    const distribucionActual = parsedFinal.distribucion_diaria_pct as Record<string, number> | undefined;
    const distribucionRecomendada = calcularDistribucionRecomendada(input.objetivo, input.intensidad || "moderada");
    
    if (distribucionActual) {
      // Calcular diferencia entre distribución actual y recomendada
      const diferencia = Math.abs((distribucionActual.desayuno || 0) - distribucionRecomendada.desayuno) +
                       Math.abs((distribucionActual.almuerzo || 0) - distribucionRecomendada.almuerzo) +
                       Math.abs((distribucionActual.cena || 0) - distribucionRecomendada.cena) +
                       Math.abs((distribucionActual.snacks || distribucionActual.snack || 0) - distribucionRecomendada.snacks);
      
      // Si la diferencia es mayor a 20 puntos porcentuales totales, usar la distribución recomendada
      // (esto significa que OpenAI no siguió bien las instrucciones)
      if (diferencia > 20) {
        parsedFinal.distribucion_diaria_pct = {
          desayuno: distribucionRecomendada.desayuno,
          almuerzo: distribucionRecomendada.almuerzo,
          snacks: distribucionRecomendada.snacks,
          cena: distribucionRecomendada.cena,
        };
      } else {
        // Asegurar que la suma sea 100 (normalizar si es necesario)
        const suma = (distribucionActual.desayuno || 0) +
                    (distribucionActual.almuerzo || 0) +
                    (distribucionActual.cena || 0) +
                    (distribucionActual.snacks || distribucionActual.snack || 0);
        
        if (Math.abs(suma - 100) > 1) {
          // Normalizar a 100
          const factor = 100 / suma;
          parsedFinal.distribucion_diaria_pct = {
            desayuno: Math.round((distribucionActual.desayuno || 0) * factor),
            almuerzo: Math.round((distribucionActual.almuerzo || 0) * factor),
            snacks: Math.round((distribucionActual.snacks || distribucionActual.snack || 0) * factor),
            cena: Math.round((distribucionActual.cena || 0) * factor),
          };
          
          // Ajustar para que sume exactamente 100 (ajustar la diferencia en el snack)
          const nuevaSuma = (parsedFinal.distribucion_diaria_pct as Record<string, number>).desayuno +
                           (parsedFinal.distribucion_diaria_pct as Record<string, number>).almuerzo +
                           (parsedFinal.distribucion_diaria_pct as Record<string, number>).snacks +
                           (parsedFinal.distribucion_diaria_pct as Record<string, number>).cena;
          const diferencia = 100 - nuevaSuma;
          if (diferencia !== 0) {
            (parsedFinal.distribucion_diaria_pct as Record<string, number>).snacks += diferencia;
          }
        }
      }
    } else {
      // Si no hay distribución, usar la recomendada
      parsedFinal.distribucion_diaria_pct = distribucionRecomendada;
    }
    
    // Fallback/Corrección de dificultad si falta o es inconsistente
    if (parsedFinal && typeof parsedFinal === "object") {
      const out = parsedFinal as Record<string, unknown>;
      const dificultad = (out.dificultad as string | undefined)?.toLowerCase();
      const int = (input.intensidad || "moderada").toLowerCase();
      const objetivo = String(input.objetivo || "").toLowerCase();
      const bmi = input.alturaCm && input.pesoKg ? (input.pesoKg / Math.pow(input.alturaCm / 100, 2)) : undefined;
      const atletico = Boolean(input.atletico);

      const inferidaPorIntensidad = int === "intensa" ? "dificil" : int === "leve" ? "facil" : "media";

      // Regla base por intensidad
      let finalDiff = dificultad || inferidaPorIntensidad;

      // Escalar por contexto
      if (int === "intensa") {
        finalDiff = "dificil";
      } else if (int === "moderada") {
        if (bmi && bmi >= 30 && (objetivo.includes("perder") || objetivo.includes("defin") || objetivo.includes("corte"))) {
          finalDiff = "dificil";
        } else {
          finalDiff = "media";
        }
      } else if (int === "leve") {
        // leve por defecto fácil; subir a media si atleta con volumen/ganancia
        if (atletico && (objetivo.includes("ganar") || objetivo.includes("volumen"))) {
          finalDiff = "media";
        } else {
          finalDiff = "facil";
        }
      }

      out.dificultad = finalDiff;
      if (typeof out.dificultad_detalle !== "string" || !out.dificultad_detalle) {
        out.dificultad_detalle = finalDiff === "dificil"
          ? "Plan exigente: alta carga de entrenamiento y disciplina nutricional."
          : finalDiff === "media"
          ? "Esfuerzo moderado con progresión sostenida."
          : "Enfoque accesible y sostenible para construir hábitos.";
      }

      // Normalización mínima de training_plan: asegurar 4 semanas y días alineados a diasGym y minutos
      // Usar el mismo cálculo que en el prompt para asegurar consistencia
      let diasGym: number;
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { sugerirEntrenamiento } = require("@/utils/calculations");
        const bmi = input.alturaCm && input.pesoKg ? (input.pesoKg / Math.pow(input.alturaCm / 100, 2)) : 25;
        const recomendaciones = sugerirEntrenamiento(
          input.objetivo,
          input.intensidad || "moderada",
          input.edad,
          bmi,
          input.atletico || false
        );
        diasGym = (input as unknown as Record<string, unknown>)?.diasGym as number | undefined ?? recomendaciones.diasGym;
      } catch {
        diasGym = (input as unknown as Record<string, unknown>)?.diasGym as number | undefined ?? 3;
      }
      
      // Ajustar días de gym según lesiones reportadas
      if (input.doloresLesiones && input.doloresLesiones.length > 0) {
        const lesionesGraves = input.doloresLesiones.some((d) => 
          d.toLowerCase().includes('hernia') && d.toLowerCase().includes('disco') ||
          d.toLowerCase().includes('hernia discal') ||
          d.toLowerCase().includes('fractura') ||
          d.toLowerCase().includes('desgarro')
        );
        const lesionesModeradas = input.doloresLesiones.some((d) =>
          d.toLowerCase().includes('lumbar') ||
          d.toLowerCase().includes('espalda baja') ||
          d.toLowerCase().includes('rodilla') ||
          d.toLowerCase().includes('hombro') ||
          d.toLowerCase().includes('manguito')
        );
        
        if (lesionesGraves) {
          diasGym = Math.min(2, diasGym); // Máximo 2 días para lesiones graves
        } else if (lesionesModeradas) {
          diasGym = Math.min(3, diasGym); // Máximo 3 días para lesiones moderadas
        } else {
          diasGym = Math.min(4, diasGym); // Máximo 4 días para lesiones leves
        }
      }
      
      const diasSemana = ["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo"];
      const targetDays = Math.min(7, Math.max(1, diasGym));
      
      // Función para distribuir días con descanso entre sesiones cuando hay lesiones
      const distribuirDiasConDescanso = (numDias: number, tieneLesiones: boolean): string[] => {
        if (!tieneLesiones || numDias >= 4) {
          // Sin lesiones o muchos días: usar días consecutivos al inicio de la semana
          return diasSemana.slice(0, numDias);
        }
        
        // Con lesiones y pocos días: distribuir con descanso
        if (numDias === 2) {
          // 2 días: Lunes y Jueves (3 días de descanso entre ellos)
          return ["Lunes", "Jueves"];
        } else if (numDias === 3) {
          // 3 días: Lunes, Miércoles, Viernes (1 día de descanso entre cada uno)
          return ["Lunes", "Miércoles", "Viernes"];
        }
        // Para 1 día, solo Lunes
        return ["Lunes"];
      };
      
      const diasDistribuidos = distribuirDiasConDescanso(targetDays, Boolean(input.doloresLesiones && input.doloresLesiones.length > 0));
      
      // Función para filtrar ejercicios peligrosos según lesiones (VALIDACIÓN CRÍTICA DE SEGURIDAD)
      const filtrarEjerciciosPeligrosos = (
        ejercicios: Array<{ name: string; [key: string]: unknown }>,
        tieneHerniaDisco: boolean,
        tieneDolorLumbar: boolean,
        tieneDolorRodilla: boolean = false,
        tieneDolorHombro: boolean = false
      ): Array<{ name: string; [key: string]: unknown }> => {
        if (!tieneHerniaDisco && !tieneDolorLumbar && !tieneDolorRodilla && !tieneDolorHombro) return ejercicios;

        // Las listas viven en `trainingPlanGuards.ts`, no aquí.
        //
        // Había dos copias mantenidas a mano "con el mismo criterio", y se
        // desviaron: la de hombro no incluía "press de hombros" —el nombre más
        // común en español— ni "shoulder press". Alguien que declarara el
        // hombro tocado recibía justo eso. Dos listas que hay que acordarse de
        // sincronizar acaban desincronizadas siempre; el arreglo no es
        // copiarlas mejor, es que haya una.

        const prohibidos = new Set<string>();
        if (tieneHerniaDisco) PROHIBITED_HERNIA.forEach((p) => prohibidos.add(p));
        if (tieneDolorLumbar) PROHIBITED_LUMBAR.forEach((p) => prohibidos.add(p));
        if (tieneDolorRodilla) PROHIBITED_KNEE.forEach((p) => prohibidos.add(p));
        if (tieneDolorHombro) PROHIBITED_SHOULDER.forEach((p) => prohibidos.add(p));

        return ejercicios.filter(ej => {
          const nombreLower = String(ej.name || '').toLowerCase();
          const esProhibido = Array.from(prohibidos).some(prohibido => nombreLower.includes(prohibido));

          if (esProhibido) {
            console.warn(`⚠️ Ejercicio peligroso filtrado: "${ej.name}" para lesión reportada`);
            return false;
          }
          return true;
        });
      };
      
      // Determinar ejercicios seguros según lesiones
      const tieneHerniaDisco = input.doloresLesiones?.some((d) => 
        d.toLowerCase().includes('hernia') && d.toLowerCase().includes('disco') ||
        d.toLowerCase().includes('hernia discal')
      ) || false;
      const tieneDolorLumbar = input.doloresLesiones?.some((d) =>
        d.toLowerCase().includes('lumbar') ||
        d.toLowerCase().includes('espalda baja')
      ) || false;
      const tieneDolorRodilla = input.doloresLesiones?.some((d) =>
        d.toLowerCase().includes('rodilla')
      ) || false;
      const tieneDolorHombro = input.doloresLesiones?.some((d) =>
        d.toLowerCase().includes('hombro') ||
        d.toLowerCase().includes('manguito')
      ) || false;
      
      const ensureWeek = (weekIndex: number) => {
        // Parámetros según INTENSIDAD
        const intensidadActual = input.intensidad || "moderada";
        const objetivoActual = input.objetivo || "mantener";
        
        // Clasificar objetivo
        const esObjetivoPerdida = ["perder_grasa", "definicion", "corte"].includes(objetivoActual);
        const esObjetivoVolumen = ["ganar_masa", "volumen", "bulk_cut"].includes(objetivoActual);
        const esObjetivoFuerza = ["powerlifting", "atleta_elite"].includes(objetivoActual);
        const esObjetivoResistencia = ["resistencia", "rendimiento_deportivo"].includes(objetivoActual);
        const esLeanBulk = objetivoActual === "lean_bulk";
        // esRecomposicion usa parámetros similares a mantenimiento
        
        // SERIES según intensidad + objetivo
        let seriesBase: number;
        if (intensidadActual === "ultra") {
          seriesBase = esObjetivoVolumen || esObjetivoFuerza ? 5 : esObjetivoPerdida ? 4 : 5;
        } else if (intensidadActual === "intensa") {
          seriesBase = esObjetivoVolumen ? 4 : esObjetivoPerdida ? 4 : 4;
        } else if (intensidadActual === "leve") {
          seriesBase = 2;
        } else {
          seriesBase = 3;
        }
        
        // RPE según intensidad + objetivo
        let rpeBase: string;
        if (intensidadActual === "ultra") {
          rpeBase = esObjetivoFuerza ? "9-10" : esObjetivoPerdida ? "8-9" : "9-10";
        } else if (intensidadActual === "intensa") {
          rpeBase = "8-9";
        } else if (intensidadActual === "leve") {
          rpeBase = "6-7";
        } else {
          rpeBase = "7-8";
        }
        
        // DESCANSO según intensidad + objetivo (pérdida = menos descanso, fuerza = más descanso)
        let descansoBase: number;
        if (esObjetivoPerdida) {
          descansoBase = intensidadActual === "ultra" ? 45 : intensidadActual === "intensa" ? 45 : intensidadActual === "leve" ? 60 : 45;
        } else if (esObjetivoFuerza) {
          descansoBase = intensidadActual === "ultra" ? 180 : intensidadActual === "intensa" ? 150 : intensidadActual === "leve" ? 120 : 120;
        } else if (esObjetivoResistencia) {
          descansoBase = intensidadActual === "ultra" ? 30 : intensidadActual === "intensa" ? 45 : 45;
        } else {
          descansoBase = intensidadActual === "ultra" ? 90 : intensidadActual === "intensa" ? 75 : intensidadActual === "leve" ? 90 : 60;
        }
        
        // REPS según objetivo
        const getReps = (tipoEjercicio: "compuesto" | "aislado" | "core"): string => {
          if (esObjetivoFuerza) {
            return tipoEjercicio === "compuesto" ? (intensidadActual === "ultra" ? "3-5" : "4-6") : "6-10";
          } else if (esObjetivoPerdida) {
            return tipoEjercicio === "compuesto" ? "10-15" : "12-20";
          } else if (esObjetivoResistencia) {
            return tipoEjercicio === "compuesto" ? "15-20" : "15-25";
          } else if (esObjetivoVolumen || esLeanBulk) {
            return tipoEjercicio === "compuesto" ? (intensidadActual === "ultra" ? "6-8" : "8-10") : "10-12";
          } else {
            return tipoEjercicio === "compuesto" ? "8-12" : "10-15";
          }
        };
        
        // TEMPO según objetivo
        const getTempo = (tipoEjercicio: "compuesto" | "aislado"): string => {
          if (esObjetivoFuerza) {
            return "1-0-X-0"; // Explosivo
          } else if (esObjetivoPerdida) {
            return "2-0-1-0"; // Rápido
          } else if (esObjetivoVolumen || esLeanBulk) {
            return tipoEjercicio === "compuesto" ? "2-1-1-0" : "3-1-2-0"; // Control excéntrico
          } else {
            return "2-0-1-0";
          }
        };
        
        // Ejercicios completos según INTENSIDAD + OBJETIVO
        const generarEjerciciosCompletos = () => {
          const ejercicios: Array<{ name: string; sets: number; reps: string; muscle_group: string; rpe?: string; rest_seconds?: number; tempo?: string; technique?: string; superset_with?: string }> = [];
          
          // === PECHO ===
          ejercicios.push({ 
            name: esObjetivoFuerza ? "Press de banca con barra (fuerza)" : "Press de banca con barra", 
            sets: esObjetivoFuerza ? seriesBase + 1 : seriesBase, 
            reps: getReps("compuesto"), 
            muscle_group: "Pecho", 
            rpe: rpeBase, 
            rest_seconds: descansoBase, 
            tempo: getTempo("compuesto"), 
            technique: esObjetivoFuerza ? "Pausa en pecho 1s, empuje explosivo, leg drive" : "Retrae escápulas, pies firmes, arco natural" 
          });
          ejercicios.push({ name: "Press inclinado con mancuernas", sets: seriesBase, reps: getReps("aislado"), muscle_group: "Pecho", rpe: rpeBase, rest_seconds: descansoBase - 15, tempo: getTempo("aislado") });
          if (intensidadActual === "ultra" || intensidadActual === "intensa") {
            ejercicios.push({ name: "Aperturas en banco plano", sets: seriesBase - 1, reps: esObjetivoPerdida ? "15-20" : "10-15", muscle_group: "Pecho", rpe: "7-8", rest_seconds: esObjetivoPerdida ? 30 : 60, tempo: "3-1-1-0", superset_with: esObjetivoPerdida ? "Flexiones" : undefined });
            ejercicios.push({ name: "Cruces en polea (cable crossover)", sets: seriesBase - 1, reps: esObjetivoPerdida ? "15-20" : "12-15", muscle_group: "Pecho", rpe: "8", rest_seconds: esObjetivoPerdida ? 30 : 45, tempo: "2-1-2-0", technique: "Squeeze al final, control total" });
            if (esObjetivoVolumen) {
              ejercicios.push({ name: "Press declinado o Dips de pecho", sets: seriesBase, reps: "8-12", muscle_group: "Pecho", rpe: "8-9", rest_seconds: 75, technique: "Énfasis en pecho bajo" });
            }
          }
          if (esObjetivoPerdida && intensidadActual !== "leve") {
            ejercicios.push({ name: "Flexiones (al fallo)", sets: 3, reps: "Max", muscle_group: "Pecho", rpe: "9", rest_seconds: 30, technique: "Finisher metabólico" });
          }
          
          // === ESPALDA ===
          if (tieneHerniaDisco || tieneDolorLumbar) {
            ejercicios.push({ name: "Remo en máquina sentado", sets: seriesBase, reps: getReps("compuesto"), muscle_group: "Espalda", rpe: rpeBase, rest_seconds: descansoBase });
            ejercicios.push({ name: "Jalón al pecho en polea", sets: seriesBase, reps: getReps("compuesto"), muscle_group: "Espalda", rpe: rpeBase, rest_seconds: descansoBase - 15 });
            ejercicios.push({ name: "Remo con mancuerna a 1 brazo (apoyado)", sets: seriesBase, reps: getReps("aislado"), muscle_group: "Espalda", rpe: "7-8", rest_seconds: 60 });
          } else {
            if (esObjetivoFuerza) {
              ejercicios.push({ name: "Peso muerto convencional", sets: seriesBase + 1, reps: getReps("compuesto"), muscle_group: "Espalda/Piernas", rpe: rpeBase, rest_seconds: descansoBase + 60, tempo: "1-1-X-0", technique: "Pilar de fuerza: setup perfecto, tracción vertical" });
            }
            ejercicios.push({ name: "Remo con barra", sets: seriesBase, reps: getReps("compuesto"), muscle_group: "Espalda", rpe: rpeBase, rest_seconds: descansoBase, tempo: getTempo("compuesto"), technique: "Espalda neutra, tire con codos" });
            ejercicios.push({ name: "Dominadas o Jalón al pecho", sets: seriesBase, reps: esObjetivoResistencia ? "12-15" : getReps("compuesto"), muscle_group: "Espalda", rpe: rpeBase, rest_seconds: descansoBase });
            if (intensidadActual === "ultra" || intensidadActual === "intensa") {
              ejercicios.push({ name: "Remo con mancuerna a 1 brazo", sets: seriesBase - 1, reps: getReps("aislado"), muscle_group: "Espalda", rpe: "8", rest_seconds: 60 });
              ejercicios.push({ name: "Face pulls", sets: 3, reps: "15-20", muscle_group: "Espalda/Hombros", rpe: "7", rest_seconds: 45, technique: "Rotación externa al final" });
              if (esObjetivoVolumen) {
                ejercicios.push({ name: "Pullover con mancuerna", sets: seriesBase, reps: "10-12", muscle_group: "Espalda", rpe: "7-8", rest_seconds: 60, tempo: "3-1-2-0" });
              }
            }
          }
          
          // === PIERNAS ===
          if (!tieneHerniaDisco && !tieneDolorLumbar && !tieneDolorRodilla) {
            ejercicios.push({ 
              name: esObjetivoFuerza ? "Sentadilla con barra (fuerza)" : "Sentadilla con barra", 
              sets: esObjetivoFuerza ? seriesBase + 1 : seriesBase, 
              reps: getReps("compuesto"), 
              muscle_group: "Cuádriceps", 
              rpe: rpeBase, 
              rest_seconds: esObjetivoFuerza ? descansoBase + 60 : descansoBase + 30, 
              tempo: esObjetivoFuerza ? "2-1-X-0" : getTempo("compuesto"), 
              technique: esObjetivoFuerza ? "Barra baja, profundidad competitiva, drive de cadera" : "Profundidad paralela, rodillas hacia afuera" 
            });
            if (!tieneHerniaDisco && !tieneDolorLumbar) {
              ejercicios.push({ name: esObjetivoFuerza ? "Peso muerto rumano" : "Peso muerto rumano", sets: seriesBase, reps: getReps("compuesto"), muscle_group: "Isquiotibiales", rpe: rpeBase, rest_seconds: descansoBase + 15, technique: "Bisagra de cadera, espalda neutra" });
            }
            if (esObjetivoVolumen || intensidadActual === "ultra") {
              ejercicios.push({ name: "Sentadilla frontal o Hack squat", sets: seriesBase, reps: "8-12", muscle_group: "Cuádriceps", rpe: "8", rest_seconds: 90, technique: "Énfasis en cuádriceps" });
            }
          } else {
            ejercicios.push({ name: "Prensa 45° (rango controlado)", sets: seriesBase, reps: getReps("compuesto"), muscle_group: "Cuádriceps", rpe: "7-8", rest_seconds: descansoBase });
          }
          ejercicios.push({ name: "Extensión de cuádriceps en máquina", sets: seriesBase, reps: getReps("aislado"), muscle_group: "Cuádriceps", rpe: "8", rest_seconds: esObjetivoPerdida ? 30 : 60, superset_with: esObjetivoPerdida ? "Curl femoral" : undefined });
          ejercicios.push({ name: "Curl femoral acostado", sets: seriesBase, reps: getReps("aislado"), muscle_group: "Isquiotibiales", rpe: "8", rest_seconds: esObjetivoPerdida ? 30 : 60 });
          if (intensidadActual === "ultra" || intensidadActual === "intensa") {
            ejercicios.push({ name: "Elevación de gemelos de pie", sets: 4, reps: esObjetivoResistencia ? "20-30" : "12-20", muscle_group: "Gemelos", rpe: "8-9", rest_seconds: 45, tempo: "2-2-1-0", technique: "Rango completo, squeeze arriba" });
            ejercicios.push({ name: "Hip thrust con barra", sets: seriesBase, reps: getReps("aislado"), muscle_group: "Glúteos", rpe: "8", rest_seconds: 60 });
            if (esObjetivoVolumen) {
              ejercicios.push({ name: "Zancadas caminando", sets: 3, reps: "12-16 por pierna", muscle_group: "Piernas", rpe: "8", rest_seconds: 60 });
            }
          }
          
          // === HOMBROS ===
          if (!tieneDolorHombro) {
            ejercicios.push({ 
              name: esObjetivoFuerza ? "Press militar con barra (fuerza)" : "Press militar con barra", 
              sets: esObjetivoFuerza ? seriesBase + 1 : seriesBase, 
              reps: getReps("compuesto"), 
              muscle_group: "Hombros", 
              rpe: rpeBase, 
              rest_seconds: descansoBase, 
              technique: esObjetivoFuerza ? "Strict press, core braced, sin impulso" : "Core apretado, sin arquear espalda" 
            });
            ejercicios.push({ name: "Elevaciones laterales", sets: seriesBase, reps: esObjetivoPerdida ? "15-20" : "12-15", muscle_group: "Hombros", rpe: "8", rest_seconds: esObjetivoPerdida ? 30 : 45, tempo: getTempo("aislado") });
            if (intensidadActual === "ultra" || intensidadActual === "intensa") {
              ejercicios.push({ name: "Elevaciones frontales", sets: seriesBase - 1, reps: getReps("aislado"), muscle_group: "Hombros", rpe: "7-8", rest_seconds: 45 });
              ejercicios.push({ name: "Pájaros (rear delt flies)", sets: seriesBase - 1, reps: "15-20", muscle_group: "Hombros", rpe: "7", rest_seconds: 45 });
              if (esObjetivoVolumen) {
                ejercicios.push({ name: "Press Arnold", sets: seriesBase, reps: "10-12", muscle_group: "Hombros", rpe: "8", rest_seconds: 60 });
              }
            }
          } else {
            ejercicios.push({ name: "Elevaciones laterales (carga ligera)", sets: 3, reps: "15-20", muscle_group: "Hombros", rpe: "6-7", rest_seconds: 60 });
          }
          
          // === BRAZOS ===
          // Para pérdida de grasa: superseries antagonistas
          if (esObjetivoPerdida) {
            ejercicios.push({ name: "Curl con barra Z + Extensión triceps (Superserie)", sets: seriesBase, reps: "12-15 cada uno", muscle_group: "Bíceps/Tríceps", rpe: "8", rest_seconds: 30, technique: "Sin descanso entre ejercicios" });
            ejercicios.push({ name: "Curl martillo + Press francés (Superserie)", sets: seriesBase, reps: "12-15 cada uno", muscle_group: "Bíceps/Tríceps", rpe: "8", rest_seconds: 30 });
          } else {
            ejercicios.push({ name: "Curl con barra Z", sets: seriesBase, reps: getReps("aislado"), muscle_group: "Bíceps", rpe: rpeBase, rest_seconds: 60, technique: "Codos fijos, sin balanceo" });
            ejercicios.push({ name: "Curl martillo", sets: seriesBase, reps: getReps("aislado"), muscle_group: "Bíceps", rpe: "8", rest_seconds: 45 });
            ejercicios.push({ name: "Press francés (extensión triceps)", sets: seriesBase, reps: getReps("aislado"), muscle_group: "Tríceps", rpe: rpeBase, rest_seconds: 60 });
            ejercicios.push({ name: "Extensión de tríceps en polea", sets: seriesBase, reps: getReps("aislado"), muscle_group: "Tríceps", rpe: "8", rest_seconds: 45 });
          }
          if ((intensidadActual === "ultra" || intensidadActual === "intensa") && !esObjetivoPerdida) {
            ejercicios.push({ name: "Curl concentrado", sets: 3, reps: "10-12", muscle_group: "Bíceps", rpe: "8-9", rest_seconds: 45, technique: "Contracción máxima arriba" });
            ejercicios.push({ name: "Fondos en paralelas (triceps)", sets: seriesBase, reps: getReps("aislado"), muscle_group: "Tríceps", rpe: "8-9", rest_seconds: 60 });
            if (esObjetivoVolumen) {
              ejercicios.push({ name: "Curl predicador", sets: seriesBase, reps: "10-12", muscle_group: "Bíceps", rpe: "8", rest_seconds: 60 });
              ejercicios.push({ name: "Extensión overhead con mancuerna", sets: seriesBase, reps: "10-12", muscle_group: "Tríceps", rpe: "8", rest_seconds: 60 });
            }
          }
          
          // === CORE ===
          ejercicios.push({ name: "Plancha frontal", sets: 3, reps: esObjetivoResistencia ? "60-90s" : "30-60s", muscle_group: "Abdominales", rpe: "7-8", rest_seconds: 45 });
          if (intensidadActual === "ultra" || intensidadActual === "intensa") {
            ejercicios.push({ name: "Crunch en polea alta", sets: 3, reps: esObjetivoPerdida ? "20-25" : "15-20", muscle_group: "Abdominales", rpe: "8", rest_seconds: esObjetivoPerdida ? 30 : 45 });
            ejercicios.push({ name: "Elevación de piernas colgado", sets: 3, reps: esObjetivoPerdida ? "15-20" : "10-15", muscle_group: "Abdominales", rpe: "8-9", rest_seconds: 60 });
            if (esObjetivoPerdida) {
              ejercicios.push({ name: "Mountain climbers", sets: 3, reps: "30-45s", muscle_group: "Core/Cardio", rpe: "9", rest_seconds: 30, technique: "Finisher metabólico" });
            }
          }
          
          // === CARDIO/FINISHER según objetivo ===
          if (esObjetivoPerdida && intensidadActual !== "leve") {
            ejercicios.push({ name: "HIIT en bici/remo (Finisher)", sets: 1, reps: "10-15 min", muscle_group: "Cardio", rpe: "9", rest_seconds: 0, technique: "30s sprint / 30s recovery" });
          } else if (esObjetivoResistencia) {
            ejercicios.push({ name: "Circuito metabólico", sets: 3, reps: "5 ejercicios x 45s", muscle_group: "Full Body", rpe: "8-9", rest_seconds: 60, technique: "Burpees, box jumps, battle ropes, etc." });
          }
          
          return ejercicios;
        };
        
        const todosLosEjercicios = generarEjerciciosCompletos();
        
        // Filtrar ejercicios peligrosos y seleccionar según el día
        const ejerciciosFiltrados = filtrarEjerciciosPeligrosos(todosLosEjercicios as Array<{ name: string; [key: string]: unknown }>, tieneHerniaDisco, tieneDolorLumbar, tieneDolorRodilla, tieneDolorHombro);
        
        // Cantidad de ejercicios por día según intensidad
        const ejerciciosPorDia = intensidadActual === "ultra" ? 12 : intensidadActual === "intensa" ? 10 : intensidadActual === "leve" ? 6 : 8;
        
        // Rotar ejercicios según la semana para variación
        const offset = (weekIndex * 3) % ejerciciosFiltrados.length;
        const ejerciciosRotados = [...ejerciciosFiltrados.slice(offset), ...ejerciciosFiltrados.slice(0, offset)];
        
        return {
          week: weekIndex + 1,
          days: diasDistribuidos.map((d, dayIdx) => {
            // Seleccionar ejercicios diferentes para cada día
            const startIdx = (dayIdx * ejerciciosPorDia) % ejerciciosRotados.length;
            const ejerciciosDelDia = [];
            for (let i = 0; i < ejerciciosPorDia; i++) {
              ejerciciosDelDia.push(ejerciciosRotados[(startIdx + i) % ejerciciosRotados.length]);
            }
            
            return {
              day: d,
              split: targetDays <= 2 ? "Full Body" : targetDays <= 4 ? "Upper/Lower" : "Push/Pull/Legs",
              warmup: {
                duration_minutes: tieneHerniaDisco ? 15 : (input.doloresLesiones && input.doloresLesiones.length > 0 ? 12 : intensidadActual === "ultra" ? 10 : 8),
                description: tieneHerniaDisco 
                  ? "Calentamiento específico para hernia de disco: 5 min caminata suave, 5 min movilidad de cadera (cat-cow, estiramientos de isquiotibiales), 5 min activación de core (plancha isométrica, dead bug). Evitar flexión/extensión excesiva de columna."
                  : (input.doloresLesiones && input.doloresLesiones.length > 0
                    ? `Calentamiento adaptado para lesiones: movilidad de zonas afectadas, activación de músculos estabilizadores, estiramientos suaves y progresivos.`
                    : intensidadActual === "ultra" 
                    ? "Calentamiento completo: 5 min cardio ligero, 3 min movilidad articular dinámica, 2 min activación muscular específica con bandas. Incluir series de aproximación ligeras antes de ejercicios pesados."
                    : "Calentamiento general: 3-5 min cardio ligero, movilidad articular, activación muscular específica para los ejercicios del día.")
              },
              ejercicios: ejerciciosDelDia
            };
          })
        };
      };

      const tp = (out as Record<string, unknown>).training_plan as Record<string, unknown> | undefined;
      if (!tp || !Array.isArray(tp.weeks) || tp.weeks.length === 0) {
        (out as Record<string, unknown>).training_plan = { weeks: [0,1,2,3].map(ensureWeek) };
      } else if (tp.weeks.length < 4) {
        // Completar hasta 4 semanas clonando y variando mínimo
        const current = (tp.weeks as unknown[]).slice(0);
        for (let i = current.length; i < 4; i++) {
          current.push(ensureWeek(i));
        }
        ((out as Record<string, unknown>).training_plan as Record<string, unknown>).weeks = current;
      }

      // Ajustar duración y cantidad de días por semana si desalineado
      const weeks = ((out as Record<string, unknown>).training_plan as Record<string, unknown>)?.weeks as Array<Record<string, unknown>> || [];
      const expectedDays = ["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo"];
      const normalizeDayName = (name: unknown): string => {
        if (typeof name !== 'string') return '';
        const n = name.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
        const map: Record<string,string> = {
          lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles', miércoles: 'Miércoles', jueves: 'Jueves', viernes: 'Viernes', sabado: 'Sábado', sábado: 'Sábado', domingo: 'Domingo'
        };
        return map[n] || '';
      };
      (out as Record<string, unknown>).training_plan = {
        ...(out as Record<string, unknown>).training_plan as Record<string, unknown>,
        weeks: weeks.map((w, wi) => {
          const originalDays = Array.isArray(w.days) ? w.days : [];
          // Normalizar nombres y quitar duplicados
          const normalized = originalDays
            .map((d: unknown) => {
              const day = d as Record<string, unknown>;
              return { 
                ...day, 
                day: normalizeDayName(day?.day),
                // Asegurar que tenga ejercicios (nueva estructura) o convertir blocks a ejercicios
                ejercicios: (() => {
                  const ejerciciosRaw = day.ejercicios || (day.blocks ? (day.blocks as Array<Record<string, unknown>>).flatMap((block: Record<string, unknown>) => ((block.exercises as Array<Record<string, unknown>>) || []).map((e: Record<string, unknown>) => ({
                    name: e.name,
                    sets: e.sets || 3,
                    reps: e.reps || "8-12",
                    muscle_group: e.muscle_group || (block.name as string || "General")
                  }))) : []);
                  // FILTRAR EJERCICIOS PELIGROSOS (VALIDACIÓN CRÍTICA DE SEGURIDAD)
                  return filtrarEjerciciosPeligrosos(ejerciciosRaw as Array<{ name: string; [key: string]: unknown }>, tieneHerniaDisco, tieneDolorLumbar, tieneDolorRodilla, tieneDolorHombro);
                })()
              };
            })
            .filter((d: Record<string, unknown>) => expectedDays.includes(d.day as string));
          const uniqueByDay = Array.from(new Map(normalized.map((d: Record<string, unknown>) => [d.day, d])).values());
          
          // Si hay días generados por OpenAI, usarlos pero ordenarlos cronológicamente
          let days: Array<Record<string, unknown>> = [];
          if (uniqueByDay.length > 0) {
            // Orden cronológico de los días que OpenAI generó
            const ordered = (uniqueByDay as Array<Record<string, unknown>>).sort((a, b) => 
              expectedDays.indexOf(a.day as string) - expectedDays.indexOf(b.day as string)
            );
            // Si hay lesiones, filtrar para respetar días de descanso
            if (input.doloresLesiones && input.doloresLesiones.length > 0 && targetDays <= 3) {
              // Asegurar que los días seleccionados tengan descanso entre ellos
              const diasConDescanso: Array<Record<string, unknown>> = [];
              for (const day of ordered) {
                if (diasConDescanso.length === 0) {
                  diasConDescanso.push(day);
                } else {
                  const ultimoDia = diasConDescanso[diasConDescanso.length - 1];
                  const ultimoIndex = expectedDays.indexOf(ultimoDia.day as string);
                  const currentIndex = expectedDays.indexOf(day.day as string);
                  // Solo agregar si hay al menos 1 día de diferencia
                  if (currentIndex - ultimoIndex >= 2 || (currentIndex === 0 && ultimoIndex >= 5)) {
                    diasConDescanso.push(day);
                    if (diasConDescanso.length >= targetDays) break;
                  }
                }
              }
              days = diasConDescanso.slice(0, targetDays);
            } else {
              // Sin lesiones: tomar los primeros targetDays días
              days = ordered.slice(0, targetDays);
            }
          }
          
          // Si faltan días, completar con días distribuidos según lesiones
          while (days.length < targetDays) {
            const diasDisponibles = diasDistribuidos.filter(d => !days.some(day => day.day === d));
            if (diasDisponibles.length === 0) break;
            
            const nextDay = diasDisponibles[0];
            const fallbackDay = ensureWeek(wi).days.find((d: Record<string, unknown>) => d.day === nextDay) || ensureWeek(wi).days[0];
            // Determinar split correcto según días y objetivo
            let splitCorrecto = (fallbackDay as Record<string, unknown>)?.split as string || "";
            if (!splitCorrecto) {
              if (targetDays <= 2) {
                splitCorrecto = "Full Body";
              } else if (targetDays >= 5 && (objetivo === "volumen" || objetivo === "ganar_masa")) {
                // Para hipertrofia máxima con 5+ días, usar Bro Split o PPL, NO Full Body
                splitCorrecto = "Bro Split";
              } else if (targetDays === 3) {
                splitCorrecto = "Push/Pull/Legs";
              } else {
                splitCorrecto = "Upper/Lower";
              }
            }
            // Asegurar que tenga warmup si no lo tiene
            const warmupExistente = (fallbackDay as Record<string, unknown>)?.warmup;
            const warmupDefault = (ensureWeek(wi).days[0] as Record<string, unknown>)?.warmup || {
              duration_minutes: tieneHerniaDisco ? 15 : (input.doloresLesiones && input.doloresLesiones.length > 0 ? 12 : 8),
              description: tieneHerniaDisco 
                ? "Calentamiento específico para hernia de disco: 5 min caminata suave, 5 min movilidad de cadera, 5 min activación de core."
                : (input.doloresLesiones && input.doloresLesiones.length > 0
                  ? "Calentamiento adaptado para lesiones: movilidad de zonas afectadas, activación de músculos estabilizadores."
                  : "Calentamiento general: cardio ligero, movilidad articular, activación muscular.")
            };
            
            const ejerciciosFallback = (fallbackDay as Record<string, unknown>)?.ejercicios || [];
            days.push({
              day: nextDay,
              split: splitCorrecto,
              warmup: warmupExistente || warmupDefault,
              ejercicios: filtrarEjerciciosPeligrosos(
                Array.isArray(ejerciciosFallback) ? ejerciciosFallback as Array<{ name: string; [key: string]: unknown }> : [],
                tieneHerniaDisco,
                tieneDolorLumbar,
                tieneDolorRodilla,
                tieneDolorHombro
              )
            });
          }
          
          // Asegurar que los días estén en orden cronológico estricto
          days = days.sort((a: Record<string, unknown>, b: Record<string, unknown>) => 
            expectedDays.indexOf(a.day as string) - expectedDays.indexOf(b.day as string)
          );
          
          // Asegurar que cada día tenga warmup si no lo tiene
          days = days.map((d: Record<string, unknown>) => {
            if (!d.warmup) {
              d.warmup = {
                duration_minutes: tieneHerniaDisco ? 15 : (input.doloresLesiones && input.doloresLesiones.length > 0 ? 12 : 8),
                description: tieneHerniaDisco 
                  ? "Calentamiento específico para hernia de disco: 5 min caminata suave, 5 min movilidad de cadera (cat-cow, estiramientos de isquiotibiales), 5 min activación de core (plancha isométrica, dead bug). Evitar flexión/extensión excesiva de columna."
                  : (input.doloresLesiones && input.doloresLesiones.length > 0
                    ? `Calentamiento adaptado para lesiones: movilidad de zonas afectadas, activación de músculos estabilizadores, estiramientos suaves y progresivos.`
                    : "Calentamiento general: 3-5 min cardio ligero, movilidad articular, activación muscular específica para los ejercicios del día.")
              };
            }
            return d;
          });
          
          // Si aún hay más días de los necesarios, tomar solo los primeros targetDays
          days = days.slice(0, targetDays);
          
          return {
            week: w.week ?? (wi + 1),
            days: days.map((d: Record<string, unknown>) => ({
              day: d.day,
              split: d.split,
              warmup: d.warmup || {
                duration_minutes: tieneHerniaDisco ? 15 : (input.doloresLesiones && input.doloresLesiones.length > 0 ? 12 : 8),
                description: tieneHerniaDisco 
                  ? "Calentamiento específico para hernia de disco: 5 min caminata suave, 5 min movilidad de cadera, 5 min activación de core."
                  : (input.doloresLesiones && input.doloresLesiones.length > 0
                    ? "Calentamiento adaptado para lesiones: movilidad de zonas afectadas, activación de músculos estabilizadores."
                    : "Calentamiento general: cardio ligero, movilidad articular, activación muscular.")
              },
              ejercicios: (() => {
                const ejerciciosRaw = Array.isArray(d.ejercicios) ? (d.ejercicios as Array<Record<string, unknown>>).slice(0, 8).map((e: Record<string, unknown>) => ({
                  name: String(e.name || "Ejercicio"),
                  sets: e.sets || 3,
                  reps: e.reps || "8-12",
                  muscle_group: String(e.muscle_group || "General"),
                  rpe: typeof e.rpe === "number" ? e.rpe : undefined,
                  tempo: typeof e.tempo === "string" ? e.tempo : undefined,
                  rest_seconds: typeof e.rest_seconds === "number" ? e.rest_seconds : undefined,
                  technique: typeof e.technique === "string" ? e.technique : undefined,
                  progression: typeof e.progression === "string" ? e.progression : undefined,
                  alternative: improveAlternativeForExercise(e.name, e.alternative, locale),
                  cues: Array.isArray(e.cues) ? (e.cues as unknown[]).filter((c): c is string => typeof c === "string").slice(0, 4) : undefined,
                })) : [];
                // FILTRAR EJERCICIOS PELIGROSOS (VALIDACIÓN CRÍTICA DE SEGURIDAD)
                return filtrarEjerciciosPeligrosos(ejerciciosRaw as unknown as Array<{ name: string; [key: string]: unknown }>, tieneHerniaDisco, tieneDolorLumbar, tieneDolorRodilla, tieneDolorHombro);
              })() // Mínimo 6-8 ejercicios, asegurar muscle_group
            })),
          };
        })
      };
    }

    // Crear objeto de debug con todos los datos usados para generar el training_plan
    const trainingPlanDebugData = {
      datos_usuario: {
        nombre: input.nombre,
        edad: input.edad,
        sexo: input.sexo,
        pesoKg: input.pesoKg,
        alturaCm: input.alturaCm,
        bmi: input.alturaCm && input.pesoKg ? Number((input.pesoKg / Math.pow(input.alturaCm / 100, 2)).toFixed(2)) : undefined,
        objetivo: input.objetivo,
        intensidad: input.intensidad || "moderada",
        tipo_dieta: input.tipoDieta || "estandar",
        atletico: input.atletico || false,
        actividad: typeof input.actividad === "number" 
          ? `${input.actividad} día${input.actividad !== 1 ? "s" : ""} de actividad física por semana`
          : input.actividad,
      },
      parametros_entrenamiento: {
        diasGym: (input as unknown as Record<string, unknown>)?.diasGym ?? undefined,
        diasGym_usado: (() => {
          const diasGym = (input as unknown as Record<string, unknown>)?.diasGym ?? undefined;
          return (typeof diasGym === 'number' && diasGym > 0) ? Math.min(7, Math.max(1, diasGym)) : 3;
        })(),
        minutos_sesion_gym: Number((parsedFinal as Record<string, unknown>)?.minutos_sesion_gym) || 75,
        minutos_sesion_gym_calculado: (() => {
          const intensidad = input.intensidad || "moderada";
          const objetivo = input.objetivo;
          // Calcular según intensidad y objetivo
          if (intensidad === "intensa") {
            if (objetivo === "volumen" || objetivo === "ganar_masa") {
              return "75-90 min (rango alto para volumen)";
            }
            return "75-90 min";
          } else if (intensidad === "moderada") {
            if (objetivo === "volumen" || objetivo === "ganar_masa") {
              return "60-75 min (rango medio-alto)";
            }
            return "60-75 min";
          } else {
            return "45-60 min";
          }
        })(),
      },
      restricciones_y_preferencias: {
        restricciones: input.restricciones || [],
        preferencias: input.preferencias || [],
        patologias: input.patologias || [],
        patologias_afectan_entrenamiento: (() => {
          const patologias = input.patologias || [];
          return patologias.filter(p => {
            const pLower = String(p).toLowerCase();
            return pLower.includes('lumbar') || 
                   pLower.includes('rodilla') || 
                   pLower.includes('hombro') || 
                   pLower.includes('lesión') || 
                   pLower.includes('lesion') ||
                   pLower.includes('fractura') ||
                   pLower.includes('artritis') ||
                   pLower.includes('osteoporosis');
          });
        })(),
      },
      calculos_deducidos: {
        dificultad_calculada: (() => {
          const int = (input.intensidad || "moderada").toLowerCase();
          const objetivo = String(input.objetivo || "").toLowerCase();
          const bmi = input.alturaCm && input.pesoKg ? (input.pesoKg / Math.pow(input.alturaCm / 100, 2)) : undefined;
          const atletico = Boolean(input.atletico);
          
          if (int === "intensa") {
            return "dificil (intensidad alta → dificultad alta)";
          } else if (int === "moderada") {
            if (bmi && bmi >= 30 && (objetivo.includes("perder") || objetivo.includes("definicion") || objetivo.includes("corte"))) {
              return "dificil (IMC alto + objetivo pérdida)";
            }
            return "media";
          } else {
            if (atletico && (objetivo.includes("volumen") || objetivo.includes("ganar"))) {
              return "media (atlético + volumen)";
            }
            return "facil";
          }
        })(),
        split_recomendado: (() => {
          const diasGym = (input as unknown as Record<string, unknown>)?.diasGym ?? undefined;
          const targetDays = (typeof diasGym === 'number' && diasGym > 0) ? Math.min(7, Math.max(1, diasGym)) : 3;
          const objetivo = input.objetivo;
          
          if (targetDays <= 2) return "Full Body (2 días o menos)";
          if (targetDays === 3) return "Upper/Lower o Push/Pull/Legs";
          if (targetDays === 4) return "Upper/Lower (2x por semana cada uno)";
          if (targetDays >= 5) {
            if (objetivo === "definicion" || objetivo === "corte") {
              return "Push/Pull/Legs o Split específico (alta frecuencia)";
            }
            return "Push/Pull/Legs con días adicionales";
          }
          return "Full Body";
        })(),
        volumen_estimado: (() => {
          const diasGym = (input as unknown as Record<string, unknown>)?.diasGym ?? undefined;
          const targetDays = (typeof diasGym === 'number' && diasGym > 0) ? Math.min(7, Math.max(1, diasGym)) : 3;
          const minutosSesion = Number((parsedFinal as Record<string, unknown>)?.minutos_sesion_gym) || 75;
          const intensidad = input.intensidad || "moderada";
          
          return {
            dias_semana: targetDays,
            minutos_por_sesion: minutosSesion,
            minutos_totales_semana: targetDays * minutosSesion,
            intensidad: intensidad,
            volumen_estimado: intensidad === "intensa" ? "Alto volumen" : intensidad === "moderada" ? "Volumen medio" : "Volumen bajo",
          };
        })(),
      },
      prompt_entrenamiento_enviado: {
        instrucciones_principales: [
          "Mínimo 3 ejercicios por grupo muscular",
          "Organizado por músculos (cada bloque = un músculo)",
          `Split según ${(() => {
            const diasGym = (input as unknown as Record<string, unknown>)?.diasGym ?? undefined;
            const targetDays = (typeof diasGym === 'number' && diasGym > 0) ? Math.min(7, Math.max(1, diasGym)) : 3;
            return targetDays <= 2 ? "Full Body" : targetDays === 3 ? "Upper/Lower o PPL" : "Push/Pull/Legs";
          })()} días`,
          `Duración: ${Number((parsedFinal as Record<string, unknown>)?.minutos_sesion_gym) || 75} min por sesión`,
          `Objetivo: ${input.objetivo} - Intensidad: ${input.intensidad || "moderada"}`,
          "Cada ejercicio debe incluir URL de tutorial",
        ],
      },
    };

    // Log del objeto de debug en consola del servidor
    console.log("=".repeat(80));
    console.log("📊 DEBUG: DATOS USADOS PARA GENERAR TRAINING_PLAN");
    console.log("=".repeat(80));
    console.log(JSON.stringify(trainingPlanDebugData, null, 2));
    console.log("=".repeat(80));

    // Fallback para proyecciones si OpenAI no las generó o ajustar con superávit real
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { calcularProyeccionesMotivacionales, calculateBMR, calculateTDEE } = require("@/utils/calculations");
      const bmi = input.alturaCm && input.pesoKg ? (input.pesoKg / Math.pow(input.alturaCm / 100, 2)) : 25;
      const diasGym = (input as unknown as Record<string, unknown>)?.diasGym as number | undefined ?? 3;
      
      // Calcular superávit/déficit REAL del plan generado
      let superavitReal: number = 0;
      let volumenTotal: number = 0;
      try {
        const bmr = calculateBMR(input.pesoKg, input.alturaCm, input.edad, input.sexo);
        const tdee = calculateTDEE(bmr, input.actividad, diasGym, (input as unknown as Record<string, unknown>)?.diasCardio as number | undefined);
        const caloriasPlan = typeof parsedFinal.calorias_diarias === 'number' ? parsedFinal.calorias_diarias : 0;
        superavitReal = caloriasPlan - tdee;
        
        const minutosSesion = Number((parsedFinal as Record<string, unknown>)?.minutos_sesion_gym) || (diasGym >= 5 ? 75 : diasGym >= 3 ? 60 : 45);
        volumenTotal = diasGym * minutosSesion;
      } catch {
        console.warn("⚠️ No se pudo calcular superávit real, usando estimado");
      }
      
      // Si OpenAI no generó proyecciones, usar fallback
      if (!parsedFinal.proyecciones || typeof parsedFinal.proyecciones !== 'object') {
        const proyeccionesFallback = calcularProyeccionesMotivacionales(
          input.objetivo,
          input.intensidad || "moderada",
          input.edad,
          input.sexo,
          bmi,
          input.atletico || false,
          diasGym
        );
        parsedFinal.proyecciones = proyeccionesFallback;
        console.log("⚠️ OpenAI no generó proyecciones, usando fallback calculado localmente");
      }
      
      // Ajustar proyecciones con el superávit REAL que OpenAI generó en calorias_diarias
      // Este es el superávit/déficit que la IA calculó, no un estimado nuestro
      if (parsedFinal.proyecciones && typeof parsedFinal.proyecciones === 'object' && typeof superavitReal === 'number' && superavitReal !== 0) {
        const proyecciones = parsedFinal.proyecciones as Record<string, unknown>;
        const musculoGanancia = proyecciones.musculoGananciaMensual as string | undefined;
        
        if (musculoGanancia && (input.objetivo === "ganar_masa" || input.objetivo === "volumen" || input.objetivo === "recomposicion")) {
          // Ajustar ganancia muscular según el superávit REAL que OpenAI generó
          const match = musculoGanancia.match(/(\d+\.?\d*)\s*-\s*(\d+\.?\d*)\s*kg/);
          if (match) {
            let min = parseFloat(match[1]);
            let max = parseFloat(match[2]);
            
            // Ajustar según el superávit REAL que OpenAI calculó en calorias_diarias
            // Determinar nivel aproximado para ajustar mejor
            const diasGym = (input as unknown as Record<string, unknown>)?.diasGym as number | undefined ?? 3;
            const esAvanzado = (input.atletico || false) || (typeof diasGym === 'number' && diasGym >= 5);
            const esPrincipiante = !(input.atletico || false) && (typeof diasGym === 'undefined' || diasGym === 0 || diasGym < 2);
            const esIntermedio = !esPrincipiante && !esAvanzado;
            
            if (typeof superavitReal === 'number' && typeof volumenTotal === 'number' && superavitReal > 200 && volumenTotal >= 400) {
              // Superávit alto (generado por OpenAI) + volumen alto: aumentar proyección significativamente
              if (esPrincipiante) {
                min = Math.min(min + 0.3, 2.5);
                max = Math.min(max + 0.5, 2.5);
              } else if (esIntermedio) {
                min = Math.min(min + 0.2, 1.5);
                max = Math.min(max + 0.4, 1.5);
              } else {
                // Avanzado
                min = Math.min(min + 0.2, 1.5);
                max = Math.min(max + 0.3, 1.5);
              }
            } else if (superavitReal > 200) {
              // Superávit alto (generado por OpenAI) pero volumen bajo: ajuste moderado
              if (esPrincipiante) {
                min = Math.min(min + 0.2, 2.0);
                max = Math.min(max + 0.3, 2.0);
              } else if (esIntermedio) {
                min = Math.min(min + 0.15, 1.2);
                max = Math.min(max + 0.25, 1.2);
              } else {
                // Avanzado
                min = Math.min(min + 0.1, 1.2);
                max = Math.min(max + 0.2, 1.2);
              }
            } else if (superavitReal >= 100 && superavitReal <= 200) {
              // Superávit moderado: ajuste pequeño
              if (esPrincipiante) {
                min = Math.min(min + 0.1, 1.5);
                max = Math.min(max + 0.2, 1.5);
              } else if (esIntermedio) {
                min = Math.min(min + 0.05, 1.0);
                max = Math.min(max + 0.15, 1.0);
              }
              // Avanzado: mantener valores
            } else if (superavitReal < 100 && superavitReal > 0) {
              // Superávit bajo (generado por OpenAI): reducir proyección
              min = Math.max(min - 0.1, 0.2);
              max = Math.max(max - 0.2, min + 0.1);
            } else if (superavitReal <= 0) {
              // Sin superávit o déficit (generado por OpenAI): reducir significativamente
              min = Math.max(min - 0.2, 0.1);
              max = Math.max(max - 0.3, min + 0.1);
            }
            
            // Ajuste adicional si el objetivo es "volumen" (hipertrofia máxima)
            if (input.objetivo === "volumen" && superavitReal > 200) {
              min = Math.min(min + 0.1, max);
              max = Math.min(max + 0.2, esAvanzado ? 1.5 : 2.0);
            }
            
            proyecciones.musculoGananciaMensual = `${min.toFixed(1)}-${max.toFixed(1)} kg`;
            console.log(`✅ Proyecciones ajustadas con superávit REAL de OpenAI: ${superavitReal} kcal (calculado desde calorias_diarias), volumen: ${volumenTotal} min/sem → ${proyecciones.musculoGananciaMensual}`);
          }
        }
      }
    } catch (e) {
      console.error("❌ Error calculando/ajustando proyecciones:", e);
      // Proyecciones mínimas como último recurso
      if (!parsedFinal.proyecciones || typeof parsedFinal.proyecciones !== 'object') {
        parsedFinal.proyecciones = {
          proyecciones: ["Progreso constante con adherencia al plan", "Mejora en composición corporal", "Aumento de energía y bienestar"],
          tiempoEstimado: input.intensidad === "intensa" ? "1-3 meses para ver resultados notables" : input.intensidad === "moderada" ? "3 meses para ver resultados notables" : "3-5 meses para ver resultados notables"
        };
      }
    }

    // Agregar el objeto de debug a la respuesta (solo en desarrollo o si se solicita)
    const responseWithDebug = {
      ...parsedFinal,
      _debug_training_plan: trainingPlanDebugData,
    };

    return res.status(200).json(responseWithDebug);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e || "Error desconocido");
    const isTimeout = typeof message === 'string' && (message.includes("aborted") || message.includes("timeout") || message.includes("Abort"));
    const detail = typeof message === 'string' && message.length > 0 ? message : "Error desconocido al generar el plan";
    return res.status(502).json({ 
      error: isTimeout ? "Timeout: OpenAI tardó demasiado (intenta de nuevo)" : "Fallo al generar con OpenAI", 
      detail: detail 
    });
  }
}


