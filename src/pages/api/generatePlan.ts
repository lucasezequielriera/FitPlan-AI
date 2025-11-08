import type { NextApiRequest, NextApiResponse } from "next";
import type { UserInput } from "@/types/plan";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const input = req.body as UserInput;
  
  // Asegurar valores por defecto
  input.duracionDias = 30; // Siempre 30 días (plan mensual)
  input.intensidad = input.intensidad || "moderada";

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
      patologias: input.patologias
    });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(503).json({ error: "OPENAI_API_KEY no configurada" });

  try {
    // Prompt mejorado: estructura clara y específica
    const prompt = `⚠️ PRIORIDAD MÁXIMA: El campo "plan_semanal" es OBLIGATORIO y DEBE generarse primero y completo.

Genera un plan de alimentación semanal completo en JSON válido (sin texto extra, solo JSON).

IMPORTANTE: El campo "plan_semanal" es el más crítico. DEBES generar EXACTAMENTE 7 días (Lunes, Martes, Miércoles, Jueves, Viernes, Sábado, Domingo), cada uno con 4 comidas (Desayuno, Almuerzo, Snack, Cena), y cada comida con 3 opciones descriptivas y reales. Si no puedes generar "plan_semanal" completo, el JSON será rechazado.

${input.restricciones && input.restricciones.length > 0 
  ? `🚫 CRÍTICO - RESTRICCIONES DEL USUARIO: El usuario tiene estas restricciones que DEBEN ser ABSOLUTAMENTE EXCLUIDAS:
${input.restricciones.map(r => `- ${r}`).join('\n')}
ANTES de generar CUALQUIER opción de comida, VERIFICA que NO contenga NINGUNA de estas restricciones. Si una restricción es "pescados", NO incluir atún, salmón, merluza, ni NINGÚN pescado. Si es "gluten", NO incluir trigo, cebada, ni derivados. Si es "lácteos", NO incluir leche, queso, yogurt, ni derivados.`
  : ''}

ESQUEMA OBLIGATORIO (ORDEN IMPORTANTE - GENERAR plan_semanal PRIMERO):
{
  "calorias_diarias": number,
  "macros": { "proteinas": "Ng", "grasas": "Ng", "carbohidratos": "Ng" },
  "distribucion_diaria_pct": { "desayuno": number, "almuerzo": number, "snacks": number, "cena": number },
  "plan_semanal": [
    {
      "dia": "Lunes",
      "comidas": [
        { "hora": "08:00", "nombre": "Desayuno", "opciones": ["Avena con frutos rojos y miel", "Tostadas integrales con aguacate y huevo", "Yogurt griego con granola y frutas"], "calorias_kcal": number, "cantidad_gramos": number },
        { "hora": "13:00", "nombre": "Almuerzo", "opciones": ["Pollo a la plancha con arroz integral", "Salmón al horno con quinoa", "Ensalada de garbanzos con vegetales"], "calorias_kcal": number, "cantidad_gramos": number },
        { "hora": "17:00", "nombre": "Snack", "opciones": ["Batido de proteína con plátano", "Frutos secos y una manzana", "Huevo duro con palitos de zanahoria"], "calorias_kcal": number, "cantidad_gramos": number },
        { "hora": "20:00", "nombre": "Cena", "opciones": ["Pescado al vapor con verduras", "Tortilla de claras con espinacas", "Ensalada mixta con pollo desmenuzado"], "calorias_kcal": number, "cantidad_gramos": number }
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
    "weeks": [
      {
        "week": number (1-4),
        "days": [
          {
            "day": "Lunes" | "Martes" | "Miércoles" | "Jueves" | "Viernes" | "Sábado" | "Domingo",
            "ejercicios": [
              {
                "name": string (nombre descriptivo del ejercicio),
                "sets": number (3-4 series típicamente),
                "reps": string | number (ej: "8-12", "10-15"),
                "muscle_group": string (músculo o grupo muscular principal trabajado, OBLIGATORIO: "Pecho", "Espalda", "Piernas", "Hombros", "Bíceps", "Tríceps", "Cuádriceps", "Isquiotibiales", "Glúteos", "Abdominales", "Trapecio", "Gemelos", etc.)
              }
            ] (MÍNIMO 6-8 ejercicios por día, lista completa)
          }
        ] (número de días según recomendaciones calculadas: ${(() => {
          try {
            const { sugerirEntrenamiento } = require("@/utils/calculations");
            const bmi = input.alturaCm && input.pesoKg ? (input.pesoKg / Math.pow(input.alturaCm / 100, 2)) : 25;
            const recomendaciones = sugerirEntrenamiento(input.objetivo, input.intensidad || "moderada", input.edad, bmi, input.atletico || false);
            return (input as unknown as Record<string, unknown>)?.diasGym as number | undefined ?? recomendaciones.diasGym;
          } catch {
            return (input as unknown as Record<string, unknown>)?.diasGym as number | undefined ?? 3;
          }
        })()} días exactos)
      }
    ] (EXACTAMENTE 4 semanas, cada una con ejercicios VARIADOS y diferentes)
  },
  "duracion_plan_dias": 30,
  "progresion_semanal": [ { "semana": number, "ajuste_calorias_pct": number, "motivo": string } ],
  "lista_compras": string[],
  "mensaje_motivacional": string
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

ENTRENAMIENTO (OBLIGATORIO - PLAN BÁSICO POR SEMANA):
${(() => {
  // Calcular recomendaciones de entrenamiento
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
    const diasGym = (input as unknown as Record<string, unknown>)?.diasGym as number | undefined ?? recomendaciones.diasGym;
    const minutosSesion = diasGym >= 5 ? 75 : diasGym >= 3 ? 60 : 45;
    
    return `⚠️ RECOMENDACIONES DE ENTRENAMIENTO CALCULADAS PARA ESTE USUARIO:
- Días de gym por semana: ${diasGym} días
- Minutos de caminata diaria: ${recomendaciones.minutosCaminata} minutos
- Horas de sueño recomendadas: ${recomendaciones.horasSueno} horas
- Duración por sesión de gym: ${minutosSesion} minutos
- Descripción: ${recomendaciones.descripcion}

⚠️ DEBES RESPETAR EXACTAMENTE ESTAS RECOMENDACIONES AL GENERAR EL PLAN DE ENTRENAMIENTO.

ESTRUCTURA DEL PLAN DE ENTRENAMIENTO:
- Debe incluir EXACTAMENTE 4 semanas (weeks[0..3]) representando el mes actual.
- Cada semana debe tener EXACTAMENTE ${diasGym} días de entrenamiento, tomados de ["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo"] en ese orden cronológico.
- ⚠️ VARIACIÓN OBLIGATORIA: Cada semana debe tener ejercicios DIFERENTES o variaciones (cambiar ejercicios, series, reps, o músculos trabajados). NO repitas exactamente la misma rutina semana tras semana.
- Cada día debe tener MÍNIMO 6-8 ejercicios diferentes para una rutina completa y efectiva.
- Formato simplificado: cada día debe tener un array "ejercicios" con ejercicios descriptivos y el músculo trabajado.
- Los ejercicios deben estar organizados según el split apropiado para ${diasGym} días:
  ${diasGym <= 2 ? "- Full Body: todos los grupos musculares en cada sesión (Pecho, Espalda, Piernas, Hombros, Bíceps, Tríceps, Abdominales)" : ""}
  ${diasGym === 3 ? "- Push/Pull/Legs o Upper/Lower: dividir grupos musculares en 3 días específicos (cada día enfocado en músculos específicos)" : ""}
  ${diasGym === 4 ? "- Upper/Lower: 2 días tren superior (Pecho, Espalda, Hombros, Bíceps, Tríceps), 2 días tren inferior (Piernas, Glúteos, Cuádriceps, Isquiotibiales, Gemelos)" : ""}
  ${diasGym >= 5 ? "- Push/Pull/Legs o Split específico: alta frecuencia, más especialización por músculo (cada día trabaja músculos muy específicos)" : ""}
- Cada ejercicio debe incluir:
  - "name": nombre descriptivo del ejercicio
  - "sets": número de series (3-4 series típicamente)
  - "reps": repeticiones o rango (ej: "8-12", "10-15")
  - "muscle_group" (OBLIGATORIO): músculo o grupo muscular principal trabajado (ej: "Pecho", "Espalda", "Piernas", "Hombros", "Bíceps", "Tríceps", "Cuádriceps", "Isquiotibiales", "Glúteos", "Abdominales", etc.)
- VARIACIÓN CRÍTICA: Cada semana debe tener ejercicios DIFERENTES o con variaciones (cambios en series, reps, o ejercicios alternativos). NO repitas exactamente la misma rutina en todas las semanas.
- Cada día debe tener MÍNIMO 6-8 ejercicios diferentes para una rutina completa y efectiva.
- Duración por sesión: ${minutosSesion} minutos (incluyendo calentamiento y estiramiento).
- Calentamiento: 5-10 min al inicio de cada sesión.
- Estiramiento: 5 min al final de cada sesión.
- Finisher (opcional): según objetivo (HIIT para pérdida de grasa, ligero para volumen).
- ${input.objetivo === "perder_grasa" || input.objetivo === "definicion" || input.objetivo === "corte" ? "ENFOQUE: Más densidad, circuitos, finishers de cardio. Priorizar quema de calorías." : ""}
- ${input.objetivo === "ganar_masa" || input.objetivo === "volumen" ? "ENFOQUE: Más volumen, series pesadas, ejercicios compuestos. Priorizar hipertrofia." : ""}
- ${input.objetivo === "recomposicion" || input.objetivo === "mantener" ? "ENFOQUE: Balance entre fuerza e hipertrofia. Progresión gradual." : ""}
`;
  } catch {
    const diasGym = (input as unknown as Record<string, unknown>)?.diasGym as number | undefined ?? 3;
    const minutosSesion = diasGym >= 5 ? 75 : diasGym >= 3 ? 60 : 45;
    return `⚠️ PLAN DE ENTRENAMIENTO:
- Días de gym por semana: ${diasGym} días
- Duración por sesión: ${minutosSesion} minutos
- Debe incluir EXACTAMENTE 4 semanas con ${diasGym} días cada una.
- Cada día debe tener un array "ejercicios" con MÍNIMO 6-8 ejercicios.
- Cada ejercicio: name, sets, reps, muscle_group (OBLIGATORIO - músculo trabajado).
- ⚠️ VARIACIÓN OBLIGATORIA: Cada semana debe tener ejercicios DIFERENTES.`;
  }
})()}
Datos: ${JSON.stringify({
      nombre: input.nombre,
      sexo: input.sexo,
      edad: input.edad,
      alturaCm: input.alturaCm,
      pesoKg: input.pesoKg,
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

4. TIEMPO OBJETIVO PARA RESULTADOS: El usuario debe ver resultados notables en ${input.intensidad === "intensa" ? "1-3 meses" : input.intensidad === "moderada" ? "3 meses" : "3-5 meses"}. 
   TODO el plan (calorías, macros, distribución de comidas) debe estar diseñado para lograr resultados VISIBLES en ese tiempo.
   - Si intensidad es "intensa": el plan debe ser AGRESIVO para resultados rápidos (1-3 meses)
   - Si intensidad es "moderada": el plan debe ser EQUILIBRADO para resultados en 3 meses exactos
   - Si intensidad es "leve": el plan debe ser GRADUAL para resultados sostenibles en 3-5 meses
   
5. La intensidad "${input.intensidad || "moderada"}" debe reflejarse en el déficit/superávit calórico y la distribución de macros:
- Leve: cambios graduales y sostenibles (déficit/superávit pequeño: ~200-300 kcal) - Objetivo: resultados en 3-5 meses
- Moderada: progresión equilibrada (déficit/superávit medio: ~400-500 kcal) - Objetivo: resultados en 3 meses
- Intensa: cambios más agresivos (déficit/superávit alto: ~600-800 kcal) - Objetivo: resultados en 1-3 meses

6. El tipo de dieta "${input.tipoDieta || "estandar"}" debe aplicarse estrictamente en todas las comidas:
${input.tipoDieta === "mediterranea" ? "- Mediterránea: Enfocarse en aceite de oliva, pescados, vegetales, frutas, legumbres y granos integrales. Limitar carnes rojas y procesados." : ""}
${input.tipoDieta === "vegana" ? "- Vegana: SOLO alimentos de origen vegetal. Excluir completamente carnes, pescados, huevos, lácteos y miel. Asegurar fuentes vegetales de proteínas completas (legumbres combinadas con cereales)." : ""}
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

Ajusta las calorías, macros y selección de alimentos según la intensidad y tipo de dieta seleccionados.`;

    // Use fetch to avoid adding deps, with timeout for faster fallback
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000); // 120s (2 min) - suficiente con max_tokens: 4000
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.6, // un poco más bajo para reducir divagues y acelerar
        max_tokens: 4000, // Balanceado: suficiente para plan completo pero más rápido que 5000
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "Sos un nutricionista experto. Tu respuesta DEBE ser solo JSON válido. El campo 'plan_semanal' es OBLIGATORIO y debe contener exactamente 7 días con 4 comidas cada uno. Prioriza completar 'plan_semanal' antes que cualquier otro campo." },
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
                  const siguiente = opcionesRaw.find((o, idx) => 
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
                
                const obj: any = {
                  hora: typeof m.hora === "string" ? m.hora : obtenerHoraPorDefecto(nombreNormalizado),
                  nombre: nombreNormalizado,
                  opciones: opcionesFinales.slice(0, 3),
                  calorias_kcal: typeof m.calorias_kcal === "number" ? m.calorias_kcal : 0,
                  cantidad_gramos: typeof m.cantidad_gramos === "number" ? m.cantidad_gramos : 0,
                };
                return obj;
              }
            }
            
            const obj: any = {
              hora: typeof m.hora === "string" ? m.hora : obtenerHoraPorDefecto(nombreNormalizado),
              nombre: nombreNormalizado,
              opciones: opcionesValidas.slice(0, 3), // Asegurar exactamente 3 opciones válidas
              calorias_kcal: typeof m.calorias_kcal === "number" ? m.calorias_kcal : 0,
              cantidad_gramos: typeof m.cantidad_gramos === "number" ? m.cantidad_gramos : 0,
            };
            return obj;
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
          const diaNombre = normalizarDia((day as any).dia);
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
      // Fallback calorías
      if (typeof out.calorias_diarias !== 'number' || !isFinite(out.calorias_diarias as number)) {
        out.calorias_diarias = 2200;
      }
      // Fallback macros
      if (!out.macros || typeof out.macros !== 'object') {
        out.macros = { proteinas: '150g', grasas: '70g', carbohidratos: '240g' };
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
          const repairTimeout = setTimeout(() => repairController.abort(), 90000); // 90s para reparación con max_tokens: 4000
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
              max_tokens: 4000, // Balanceado: suficiente para plan completo pero más rápido
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
    
    if (!parsedFinal || !Array.isArray((parsedFinal as any).plan_semanal)) {
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
      const diasGym = (input as any)?.diasGym ?? undefined;
      const minutosSesion = Number((out as any)?.minutos_sesion_gym) || 75;
      const diasSemana = ["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo"];
      const targetDays = (typeof diasGym === 'number' && diasGym > 0) ? Math.min(7, Math.max(1, diasGym)) : 3;
      const ensureWeek = (weekIndex: number) => {
        // Variar ejercicios según la semana para evitar repetición
        const ejerciciosBase = [
          { name: "Sentadilla goblet", sets: 3, reps: "8-10", muscle_group: "Cuádriceps" },
          { name: "Press de banca", sets: 3, reps: "8-12", muscle_group: "Pecho" },
          { name: "Remo con barra", sets: 3, reps: "8-12", muscle_group: "Espalda" },
          { name: "Peso muerto", sets: 3, reps: "6-10", muscle_group: "Isquiotibiales" },
          { name: "Press militar", sets: 3, reps: "8-12", muscle_group: "Hombros" },
          { name: "Curl de bíceps", sets: 3, reps: "10-12", muscle_group: "Bíceps" },
          { name: "Fondos en paralelas", sets: 3, reps: "8-10", muscle_group: "Tríceps" },
          { name: "Plancha", sets: 3, reps: "30-45s", muscle_group: "Abdominales" }
        ];
        // Rotar ejercicios según la semana
        const offset = weekIndex % ejerciciosBase.length;
        const ejerciciosRotados = [...ejerciciosBase.slice(offset), ...ejerciciosBase.slice(0, offset)];
        
        return {
          week: weekIndex + 1,
          days: diasSemana.slice(0, targetDays).map((d, di) => ({
            day: d,
            ejercicios: ejerciciosRotados.slice(0, 8) // Mínimo 6-8 ejercicios
          }))
        };
      };

      const tp: any = (out as any).training_plan;
      if (!tp || !Array.isArray(tp.weeks) || tp.weeks.length === 0) {
        (out as any).training_plan = { weeks: [0,1,2,3].map(ensureWeek) };
      } else if (tp.weeks.length < 4) {
        // Completar hasta 4 semanas clonando y variando mínimo
        const current = tp.weeks.slice(0);
        for (let i = current.length; i < 4; i++) {
          current.push(ensureWeek(i));
        }
        (out as any).training_plan.weeks = current;
      }

      // Ajustar duración y cantidad de días por semana si desalineado
      const weeks: any[] = (out as any).training_plan.weeks || [];
      const expectedDays = ["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo"];
      const normalizeDayName = (name: unknown): string => {
        if (typeof name !== 'string') return '';
        const n = name.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
        const map: Record<string,string> = {
          lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles', miércoles: 'Miércoles', jueves: 'Jueves', viernes: 'Viernes', sabado: 'Sábado', sábado: 'Sábado', domingo: 'Domingo'
        };
        return map[n] || '';
      };
      (out as any).training_plan.weeks = weeks.map((w, wi) => {
        const originalDays = Array.isArray(w.days) ? w.days : [];
        // Normalizar nombres y quitar duplicados
        const normalized = originalDays
          .map((d: any) => ({ 
            ...d, 
            day: normalizeDayName(d?.day),
            // Asegurar que tenga ejercicios (nueva estructura) o convertir blocks a ejercicios
            ejercicios: d.ejercicios || (d.blocks ? d.blocks.flatMap((block: any) => (block.exercises || []).map((e: any) => ({
              name: e.name,
              sets: e.sets || 3,
              reps: e.reps || "8-12",
              muscle_group: e.muscle_group || (block.name || "General")
            }))) : [])
          }))
          .filter((d: any) => expectedDays.includes(d.day));
        const uniqueByDay = Array.from(new Map(normalized.map((d: any) => [d.day, d])).values());
        // Orden cronológico
        const ordered = uniqueByDay.sort((a: any, b: any) => expectedDays.indexOf(a.day) - expectedDays.indexOf(b.day));
        const days = ordered.slice(0, targetDays);
        while (days.length < targetDays) {
          const idx = days.length % diasSemana.length;
          const fallbackDay = ensureWeek(wi).days[idx];
          days.push({
            day: fallbackDay.day,
            ejercicios: fallbackDay.ejercicios || []
          });
        }
        return {
          week: w.week ?? (wi + 1),
          days: days.map((d: any) => ({
            day: d.day,
            ejercicios: Array.isArray(d.ejercicios) ? d.ejercicios.slice(0, 8).map((e: any) => ({
              name: e.name || "Ejercicio",
              sets: e.sets || 3,
              reps: e.reps || "8-12",
              muscle_group: e.muscle_group || "General"
            })) : [] // Mínimo 6-8 ejercicios, asegurar muscle_group
          })),
        };
      });
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
      error: isTimeout ? "Timeout: OpenAI tardó demasiado (intentá de nuevo)" : "Fallo al generar con OpenAI", 
      detail: detail 
    });
  }
}


