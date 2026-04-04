import type { UserInput } from "@/types/plan";
import { ensureMealMacrosAprox } from "@/lib/mealMacros";
import { blobSuggestsKneeCare } from "@/lib/trainingPlanGuards";

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
      `Cada día debe incluir: tren inferior (cuádriceps/glúteos/isquios), empuje (pecho/hombros), tirón (espalda), bíceps/tríceps en menor volumen, y 2–3 ejercicios de abdomen/core. Mínimo 6–9 ejercicios por sesión Full Body (no 3–4).`,
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
      `VOLUMEN MÍNIMO (no listas de solo 3 ejercicios): piernas ≥6 ejercicios; pecho+trí y espalda+bí ≥6; día hombros ≥5 incluyendo ≥2 de core/abdomen Y ≥1 ejercicio explícito de cardio LISS (muscle_group "Cardio"), no solo plancha.`,
      `MOTIVO del orden: piernas primero para máxima energía en tren inferior pesado; separar empuje y tirón; hombros con core para no fatigar del empuje antes de pecho; cardio en el día más corto en volumen de grandes cargas.`,
      `training_plan.split: "Bro_split_4_días". week_order_rationale: texto obligatorio desarrollando lo anterior.`,
      `Cada ejercicio con "muscle_group" en español. Incluye abdominales en día 4 y cardio como bloque final (muscle_group "Cardio").`,
    ].join(" ");
  }
  if (d === 5) {
    return [
      `FRECUENCIA 5 días/semana: NO uses Full Body como base. Usa los mismos 4 bloques que en 4 días MÁS un quinto día.`,
      `ORDEN: Día1 Piernas; Día2 Pecho+tríceps; Día3 Espalda+bíceps; Día4 Hombros+abdominales+cardio ligero; Día5 "accesorios" (bíceps/tríceps/gemelos/core) o repeticiones ligeras de piernas + HIIT corto (10–15 min) según nivel y lesiones.`,
      `VOLUMEN MÍNIMO: día piernas ≥6 ejercicios; pecho+trí ≥6; espalda+bí ≥6; hombros+abd+cardio ≥5 (≥2 core distintos + 1 cardio LISS real con muscle_group "Cardio", no solo isométricos); día 5 accesorios+HIIT ≥5 incluyendo bloque HIIT o bicicleta/elíptica con muscle_group "Cardio".`,
      `week_order_rationale obligatorio. muscle_group en español en todos los ejercicios. Cardio en día 4 (y HIIT o circuito en día 5).`,
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
    /** Notas del coach solo para entreno; van primero en el resumen clínico. */
    trainingCoachBrief?: string;
    /** El coach confirma explícitamente: sin sentadilla, zancadas ni saltos de pierna. */
    avoidSquatsAndLunges?: boolean;
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

/** Texto corto para que el modelo no ignore rodilla/cirugías enterradas en el formulario. */
function buildClinicalTrainingSummary(ctx: IntakeOpenAiContext): string {
  const coachBrief = typeof ctx.actionContext?.trainingCoachBrief === "string" ? ctx.actionContext.trainingCoachBrief.trim() : "";
  const coachNoSquat = ctx.actionContext?.avoidSquatsAndLunges === true;

  const parts: string[] = [];
  const add = (v: unknown) => {
    if (typeof v === "string" && v.trim()) parts.push(v.trim());
    if (Array.isArray(v)) {
      v.forEach((x) => {
        if (typeof x === "string" && x.trim()) parts.push(x.trim());
      });
    }
  };
  if (Array.isArray(ctx.userInput.doloresLesiones)) {
    parts.push(...ctx.userInput.doloresLesiones.filter((s) => typeof s === "string" && s.trim()));
  }
  add(ctx.formData.lesionesDolores);
  add(ctx.formData.cirugiasPrevias);
  add(ctx.formData.textoLibreFinal);
  add(ctx.formData.patologias);

  const dedup = Array.from(new Set(parts.map((p) => p.replace(/\s+/g, " ").trim()))).filter(Boolean);
  const blobForm = dedup.join(" | ").toLowerCase();
  const blobWithCoach = `${blobForm} ${coachBrief.toLowerCase()}`;
  const kneeBlock = coachNoSquat || blobSuggestsKneeCare(blobWithCoach);

  const head = dedup.length ? dedup.join(" | ").slice(0, 1400) : "";
  const kneeParagraph =
    kneeBlock
      ? `>>> PRIORIDAD ABSOLUTA ENTRENO: restricción de rodilla o indicación explícita del coach (sin sentadilla/zancadas). NO incluir sentadilla (ni goblet, hack, frontal), zancadas profundas, saltos al cajón, burpees. Evitar prensa con ROM máximo al pecho si molesta rodilla; preferir extensión de cuádriceps, curl femoral tumbado/sentado, empuje de cadera (puente/hip thrust con apoyo estable), abducciones, patada de glúteo en polea. Cada básico de pierna con "alternative" seguro y "safety_notes". Confirmar con médico/fisio si no hay alta deportiva.`
      : "";

  const chunks: string[] = [];
  if (coachBrief) {
    chunks.push(
      `>>> INSTRUCCIÓN DEL COACH (ENTRENO — PRIORIDAD MÁXIMA SOBRE CUALQUIER PLANTILLA):\n${coachBrief.slice(0, 1200)}`
    );
  }
  if (head) chunks.push(head);
  if (kneeParagraph) chunks.push(kneeParagraph);

  return chunks.join("\n\n");
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

  const system = `Eres nutricionista deportivo y preparador físico senior (nivel prescripción profesional: clientes te confían como a un entrenador titulado). Generas un plan COMPLETO en un solo JSON válido.
REGLAS GENERALES:
- Responde SOLO con JSON (sin markdown, sin texto fuera del JSON).
- Idioma: español claro (vocabulario de alimentos según España o Latinoamérica según indique el formulario: ciudad/país, ingredientes típicos).
- Debes usar TODOS los campos del objeto "formulario_completo" que sean relevantes: salud, lesiones, hábitos, horarios, gustos de alimentos, lugar de entreno, material, días disponibles, objetivos, etc. Si algo contradice, prioriza seguridad y realismo.
- No inventes diagnósticos médicos. Si hay patología o medicación, adapta el plan y, si hace falta, indica en "mensaje_motivacional" o en "training_plan.safety_notes" que debe consultar a su médico para el alta deportiva o ajustes clínicos.
- Respeta estrictamente los números obligatorios que envía el backend: calorias_diarias, calorias_mantenimiento (TDEE), macros.
- OBLIGATORIO: aplica las "reglas_split_entrenamiento" del payload del usuario (frecuencia semanal). No las ignores.
- Lee el objeto "prioridad_coach_entreno" del JSON de usuario: si "sin_sentadilla_ni_zancadas_confirmado_por_coach" es true o "notas" no está vacío, obedece esas instrucciones antes que cualquier rutina genérica.
- Si el payload incluye "resumen_clinico_entrenamiento" con texto no vacío, es PRIORIDAD ABSOLUTA sobre cualquier plantilla de ejercicios “típicos”. Nunca contradigas una contraindicación explícita (ej. rodilla operada → sin sentadilla).

LESIONES, CIRUGÍAS Y DOLOR (includeTraining = true):
- Lee "resumen_clinico_entrenamiento", formulario_completo (lesionesDolores, cirugiasPrevias, textoLibreFinal, patologías) y user_input_normalizado.doloresLesiones.
- Rodilla operada, menisco, LCA, artroscopía, gonalgia severa o nota del coach: NO prescribas sentadilla, sentadilla búlgara, zancadas profundas, saltos ni profundidad máxima en prensa si es contraindicado. Sustituye por trabajo de cadera/isquios/cuádriceps con vectores tolerados (extensión de rodilla, curl femoral, puente/hip thrust con control, patada glútea, abducción, sled ligero si aplica).
- En "training_plan.safety_notes" enumera 2–4 líneas concretas sobre la limitación (ej. “sin flexión profunda de rodilla cargada hasta valoración médica”).
- Cada ejercicio de riesgo para esa zona DEBE tener "alternative" y "technique" que reduzcan carga articular.

CALIDAD ENTRENAMIENTO (includeTraining = true) — NO rutinas “de tres ejercicios” para 4–5 días/semana salvo que el formulario indique sesiones muy cortas (<35 min):
- Orden dentro de cada día: 1–2 multiarticulares pesados → accesorios → core (si toca) → cardio nominal al final (si toca ese día).
- Cada ejercicio debe incluir "rest_seconds" realista (compuestos 90–180 s; accesorios 60–90 s; isométricos cortos según protocolo).
- Añade "rpe" (1–10) en al menos los 3–4 primeros ejercicios del día como guía de esfuerzo.
- "technique": 1–2 frases útiles (alineación, rango, respiración); "progression": regla concreta (ej. “+2,5 kg cuando completes todas las series en el tope del rango”).
- "alternative" obligatorio en dominadas, remos pesados y press banca si el usuario es principiante o hay lesiones; si no hay lesión, alternativa por equipamiento (máquina, polea, mancuerna).
- Campo "reps" (string): NUNCA añadas la palabra "reps" después de segundos o minutos. Para isométricos: solo "35 s" o "30-40 s". Para cardio: sets=1 y reps="15 min (RPE 5-6/10, caminata inclinada)" — sin "minutos reps". Para HIIT: sets=1 y reps="10 min (30 s rápido / 60 s suave)". Ejemplos PROHIBIDOS: "30 segundos reps", "15 minutos reps", "10 minutos reps".
- Objetivo "perder_grasa" / "definicion" / "corte" (ver user_input_normalizado.objetivo): prioriza mantener fuerza en básicos (RPE 7–9); accesorios con volumen moderado; no prometas resultados milagrosos; en "sync_with_nutrition" enlaza adherencia, proteína del plan y sueño.
- "warmup" en CADA día: 8–12 min, específico (movilidad de tobillos/cadera en piernas, movilidad escapular en empuje, etc.).
- Genera EXACTAMENTE 4 semanas en "weeks", todas con los mismos días de entreno y ejercicios completos; varía series, reps, variantes o densidad entre semanas 1–2 vs 3–4. NO dejes weeks[1], weeks[2] o weeks[3] vacías ni con días sin ejercicios.
- "week_order_rationale": 4–10 frases, tono profesional, citando lógica de recuperación y prioridad de estímulos (no relleno genérico).
- "minutos_sesion_gym": estimación realista según volumen (típ. 50–85 min con calentamiento si hay 5–7 ejercicios + core + cardio breve).

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
                "rpe": number,
                "rest_seconds": number,
                "tempo": string,
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
ENTRENO: si includeTraining es true, cumple reglas_split_entrenamiento Y el bloque CALIDAD ENTRENAMIENTO de arriba. "mensaje_motivacional": tono cercano pero profesional, sin exagerar resultados.
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
    resumen_clinico_entrenamiento: buildClinicalTrainingSummary(ctx),
    prioridad_coach_entreno: {
      notas: typeof ctx.actionContext?.trainingCoachBrief === "string" ? ctx.actionContext.trainingCoachBrief.trim() : "",
      sin_sentadilla_ni_zancadas_confirmado_por_coach: ctx.actionContext?.avoidSquatsAndLunges === true,
    },
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
        temperature: 0.22,
        max_tokens: 14000,
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
