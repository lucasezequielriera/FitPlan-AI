import type { UserInput } from "@/types/plan";
import { ensureMealMacrosAprox } from "@/lib/mealMacros";

/** Reglas de split según frecuencia semanal (intake / admin). */
export function buildTrainingSplitRules(diasGym: number, trainingStructure?: string): string {
  const d = Math.min(7, Math.max(1, Number.isFinite(diasGym) ? diasGym : 3));
  const ts = (trainingStructure || "auto").toLowerCase();
  if (ts !== "auto") {
    return `Preferencia explícita del coach: estructura "${trainingStructure}". Intégrala si encaja con ${d} día(s)/semana; si no, explica en week_order_rationale y adapta sin romper seguridad.`;
  }
  if (d >= 1 && d <= 3) {
    return [
      `FRECUENCIA ${d} día(s)/semana (regla 1–3): USA split "Full Body" en CADA sesión.`,
      `Cada día debe incluir: tren inferior (cuádriceps/glúteos/isquios), empuje (pecho/hombros), tirón (espalda), bíceps/tríceps en menor volumen, y 2–3 ejercicios de abdomen/core.`,
      `Al final de cada sesión añade 5–12 min de cardio ligero (caminata inclinada, bici o elíptica) en zona moderada, salvo contraindicación.`,
      `En training_plan.split usa "Full Body". En week_order_rationale explica: poca frecuencia → más estímulo por sesión; orden de ejercicios (compuestos primero); días de descanso entre sesiones si hay 2–3 días.`,
      `Cada ejercicio DEBE tener "muscle_group" en español (ej. "Pecho", "Cuádriceps", "Abdominales", "Cardio").`,
    ].join(" ");
  }
  if (d === 4) {
    return [
      `FRECUENCIA 4 días/semana: NO uses Full Body. Usa división por grupos (bro split clásico).`,
      `ORDEN DE DÍAS (asigna a Lunes–Domingo según calendario real, sin dos días consecutivos si es posible):`,
      `1) Piernas (cuádriceps, isquiotibiales, glúteos, gemelos) — priorizar movimientos compuestos.`,
      `2) Pecho + tríceps`,
      `3) Espalda + bíceps`,
      `4) Hombros + abdominales + 8–15 min cardio moderado al final (LISS).`,
      `MOTIVO del orden: piernas primero para máxima energía en tren inferior pesado; separar empuje y tirón; hombros con core para no fatigar del empuje antes de pecho; cardio en el día más corto en volumen de grandes cargas.`,
      `training_plan.split: "Bro_split_4_días". week_order_rationale: texto obligatorio desarrollando lo anterior.`,
      `Cada ejercicio con "muscle_group" en español. Incluye abdominales en día 4 y cardio como bloque final (muscle_group "Cardio").`,
    ].join(" ");
  }
  if (d === 5) {
    return [
      `FRECUENCIA 5 días/semana: NO uses Full Body como base. Usa los mismos 4 bloques que en 4 días MÁS un quinto día.`,
      `ORDEN: Día1 Piernas; Día2 Pecho+tríceps; Día3 Espalda+bíceps; Día4 Hombros+abdominales+cardio ligero; Día5 "accesorios" (bíceps/tríceps/gemelos/core) o repeticiones ligeras de piernas + HIIT corto (10–15 min) según nivel y lesiones.`,
      `week_order_rationale obligatorio. muscle_group en español en todos los ejercicios. Cardio en día 4 (y opcional HIIT día 5).`,
    ].join(" ");
  }
  return [
    `FRECUENCIA ${d} días/semana: usa un split de alta frecuencia coherente (p. ej. PPL duplicado o upper/lower) con muscle_group en cada ejercicio y week_order_rationale explicando descansos.`,
    `Incluye core 2–3 veces/semana y cardio según objetivo.`,
  ].join(" ");
}

export type IntakeOpenAiContext = {
  formData: Record<string, unknown>;
  actionContext?: {
    objectiveOverride?: string;
    additionalNotes?: string;
    trainingStructure?: string;
  } | null;
  updateContext?: {
    mainNeed?: string;
    nutritionFeedback?: string;
    trainingFeedback?: string;
    currentWeightKg?: string;
    energyLevel?: string;
    clientTrackingLog?: string;
  } | null;
  includeNutrition: boolean;
  includeTraining: boolean;
  tdee: number;
  targetCalories: number;
  macros: { proteinas: string; grasas: string; carbohidratos: string };
  userInput: UserInput;
  imc: { imc: number; estado: string };
};

const MODEL = "gpt-4o";

function stripFences(s: string) {
  return s.replace(/^```json\n?|```$/gim, "").replace(/^```\n?|```$/gim, "");
}

/**
 * Genera el plan completo de intake solo con IA (sin plantilla previa).
 * Si falla, el caller debe usar plantilla/fallback.
 */
export async function generateIntakePlanWithOpenAI(ctx: IntakeOpenAiContext): Promise<{
  plan: Record<string, unknown> | null;
  detail?: string;
  usedAi: boolean;
}> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { plan: null, detail: "OPENAI_API_KEY no configurada.", usedAi: false };
  }

  const system = `Eres nutricionista deportivo y entrenador personal senior. Tu tarea es generar un plan COMPLETO desde cero en un solo JSON válido.
REGLAS:
- Responde SOLO con JSON (sin markdown, sin texto fuera del JSON).
- Idioma: español claro (vocabulario de alimentos según España o Latinoamérica según indique el formulario: ciudad/país, ingredientes típicos).
- Debes usar TODOS los campos del objeto "formulario_completo" que sean relevantes: salud, lesiones, hábitos, horarios, gustos de alimentos, lugar de entreno, material, días disponibles, objetivos, etc. Si algo contradice, prioriza seguridad y realismo.
- No inventes diagnósticos médicos. Si hay patología o medicación, adapta el plan y, si hace falta, indica en "mensaje_motivacional" o en "training_plan.safety_notes" que debe consultar a su médico para el alta deportiva o ajustes clínicos.
- Respeta estrictamente los números obligatorios que envía el backend: calorias_diarias, calorias_mantenimiento (TDEE), macros.
- OBLIGATORIO: aplica las "reglas_split_entrenamiento" del payload del usuario (frecuencia semanal). No las ignores.

ESTRUCTURA ESPERADA (ajusta omitiendo bloques si se indica includeNutrition/includeTraining):
{
  "calorias_diarias": number,
  "calorias_mantenimiento": number,
  "macros": { "proteinas": string, "grasas": string, "carbohidratos": string },
  "plan_semanal": [ { "dia": string, "comidas": [ { "hora": string, "nombre": string, "opciones": string[], "macros_aprox": { "proteinas_g": number, "grasas_g": number, "carbohidratos_g": number } } ] } ],
  "duracion_plan_dias": 30,
  "mensaje_motivacional": string,
  "minutos_sesion_gym": number,
  "dificultad": "facil" | "media" | "dificil",
  "training_plan": {
    "split": string,
    "week_order_rationale": string,
    "weeks": [
      {
        "week": 1,
        "days": [
          {
            "day": string,
            "split": string,
            "warmup": { "duration_minutes": number, "description": string },
            "ejercicios": [
              {
                "name": string,
                "sets": number,
                "reps": string,
                "muscle_group": string,
                "rest_seconds": number,
                "technique": string,
                "progression": string,
                "alternative": string
              }
            ]
          }
        ]
      }
    ],
    "progression_rules": string[],
    "safety_notes": string[],
    "sync_with_nutrition": string[]
  },
  "lista_compras": string[],
  "cambios_semanales": { "semana1": string, "semana2": string, "semana3_4": string }
}

NUTRICIÓN: si includeNutrition es true, "plan_semanal" debe tener 7 días (Lunes…Domingo), 4-5 comidas por día. CADA comida DEBE incluir "macros_aprox" con gramos aproximados de proteínas, grasas y carbohidratos que sumen coherente con los macros diarios obligatorios del backend.
ENTRENO: si includeTraining es true, genera "training_plan" siguiendo reglas_split_entrenamiento. "week_order_rationale" debe explicar en 3-8 frases por qué ese orden de días y de ejercicios. Cada ejercicio DEBE tener "muscle_group" en español. Incluye abdominales y cardio según las reglas (cardio puede ser un bloque final con muscle_group "Cardio"). Incluye cardio/pasos en texto si el formulario lo pide.
Si includeNutrition es false, NO incluyas plan_semanal ni macros/calorías (o puedes omitir esas claves).
Si includeTraining es false, NO incluyas training_plan ni minutos_sesion_gym.
`;

  const diasGym = typeof ctx.userInput.diasGym === "number" && ctx.userInput.diasGym > 0 ? ctx.userInput.diasGym : 3;
  const userPayload = {
    inclusion: {
      includeNutrition: ctx.includeNutrition,
      includeTraining: ctx.includeTraining,
    },
    reglas_split_entrenamiento: buildTrainingSplitRules(diasGym, ctx.actionContext?.trainingStructure),
    numericos_obligatorios_backend: {
      calorias_diarias: ctx.targetCalories,
      calorias_mantenimiento: ctx.tdee,
      macros: ctx.macros,
    },
    imc_resumen: ctx.imc,
    user_input_normalizado: ctx.userInput,
    contexto_admin: ctx.actionContext ?? null,
    contexto_actualizacion: ctx.updateContext ?? null,
    formulario_completo: ctx.formData,
  };

  const userPrompt = JSON.stringify(userPayload);

  const controller = new AbortController();
  const timeoutMs = 150000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.35,
        max_tokens: 12000,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: userPrompt },
        ],
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!resp.ok) {
      const detail = await resp.text().catch(() => "");
      return { plan: null, detail: `OpenAI HTTP ${resp.status}: ${detail.slice(0, 500)}`, usedAi: false };
    }

    const data = await resp.json();
    const raw = data.choices?.[0]?.message?.content ?? "";
    const content = typeof raw === "string" ? raw.trim() : JSON.stringify(raw ?? {});
    if (!content) {
      return { plan: null, detail: "Respuesta vacía de OpenAI", usedAi: false };
    }

    const cleaned = stripFences(content);
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(cleaned) as Record<string, unknown>;
    } catch {
      return { plan: null, detail: "JSON inválido devuelto por OpenAI", usedAi: false };
    }

    if (ctx.includeNutrition) {
      parsed.calorias_diarias = ctx.targetCalories;
      parsed.calorias_mantenimiento = ctx.tdee;
      parsed.macros = ctx.macros;
      const ps = parsed.plan_semanal;
      if (Array.isArray(ps)) {
        ensureMealMacrosAprox(ps as Array<Record<string, unknown>>, ctx.macros);
      }
    }

    parsed._planType = "openai_intake";
    parsed._aiModel = MODEL;

    return { plan: parsed, usedAi: true };
  } catch (e) {
    clearTimeout(timeout);
    const msg = e instanceof Error ? e.message : String(e);
    return { plan: null, detail: `OpenAI error: ${msg}`, usedAi: false };
  }
}
