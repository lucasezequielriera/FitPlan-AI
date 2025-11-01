import type { NextApiRequest, NextApiResponse } from "next";
import type { UserInput } from "@/types/plan";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const input = req.body as UserInput;
  
  // Asegurar valores por defecto
  input.duracionDias = 30; // Siempre 30 días (plan mensual)
  input.intensidad = input.intensidad || "moderada";

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(503).json({ error: "OPENAI_API_KEY no configurada" });

  try {
    // Prompt mejorado: estructura clara y específica
    const prompt = `Genera un plan de alimentación semanal completo en JSON válido (sin texto extra, solo JSON).

ESQUEMA OBLIGATORIO:
{
  "calorias_diarias": number,
  "macros": { "proteinas": "Ng", "grasas": "Ng", "carbohidratos": "Ng" },
  "distribucion_diaria_pct": { "desayuno": number, "almuerzo": number, "snacks": number, "cena": number },
  "plan_semanal": [
    {
      "dia": "Lunes",
      "comidas": [
        { "hora": "08:00", "nombre": "Desayuno", "opciones": ["Opción 1", "Opción 2", "Opción 3"], "calorias_kcal": number, "cantidad_gramos": number },
        { "hora": "13:00", "nombre": "Almuerzo", "opciones": ["Opción 1", "Opción 2", "Opción 3"], "calorias_kcal": number, "cantidad_gramos": number },
        { "hora": "17:00", "nombre": "Snack", "opciones": ["Opción 1", "Opción 2", "Opción 3"], "calorias_kcal": number, "cantidad_gramos": number },
        { "hora": "20:00", "nombre": "Cena", "opciones": ["Opción 1", "Opción 2", "Opción 3"], "calorias_kcal": number, "cantidad_gramos": number }
      ]
    }
  ],
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
4. Cada comida DEBE tener al menos 3 opciones diferentes en el array "opciones"
5. Las comidas deben variar entre días (no repetir exactamente las mismas opciones en días consecutivos)
6. "distribucion_diaria_pct" DEBE variar según el objetivo e intensidad del usuario:
   - Para objetivos de GANANCIA (ganar_masa, volumen): mayor porcentaje en desayuno y almuerzo (ej: desayuno 25-30%, almuerzo 35-40%, snacks 10-15%, cena 20-25%)
   - Para objetivos de PÉRDIDA (perder_grasa, definicion, corte): distribución más equilibrada o ligeramente más alta en desayuno y almuerzo (ej: desayuno 25-30%, almuerzo 30-35%, snacks 10-15%, cena 25-30%)
   - Para MANTENER o RECOMPOSICIÓN: distribución equilibrada (ej: desayuno 25-28%, almuerzo 30-35%, snacks 10-12%, cena 25-30%)
   - Si intensidad es "intensa": ajustar distribución para optimizar resultados rápidos según el objetivo
   - Si intensidad es "leve": distribución más conservadora y sostenible
   - La suma DEBE ser exactamente 100% 
7. NO incluir "ingredientes" ni "pasos_preparacion" en las comidas (se consultan aparte)
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

1. RESTRICCIONES ALIMENTARIAS (OBLIGATORIO RESPETAR):
${input.restricciones && input.restricciones.length > 0 
  ? `El usuario tiene las siguientes RESTRICCIONES que DEBEN ser ABSOLUTAMENTE EXCLUIDAS del plan:
${input.restricciones.map(r => `- ${r}`).join('\n')}
IMPORTANTE: Ninguna comida, opción ni ingrediente puede contener estos elementos. Si una restricción es "gluten", ningún plato puede tener trigo, cebada, centeno. Si es "lácteos", excluir leche, queso, yogurt, mantequilla, etc. Si es "cerdo", ningún plato puede contener cerdo ni derivados. Buscar siempre alternativas adecuadas.`
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
    const timeout = setTimeout(() => controller.abort(), 60000); // 60s para dar tiempo suficiente
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.7, // Aumentado para más variedad
        max_tokens: 2000, // Aumentado para asegurar los 7 días completos
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "Sos un nutricionista que responde solo en JSON válido según el esquema" },
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
    
    // Normalizar y validar el plan semanal
    if (parsedRaw && typeof parsedRaw === "object" && parsedRaw !== null) {
      const parsed = parsedRaw as Record<string, unknown>;
      
      if (Array.isArray(parsed.plan_semanal)) {
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
        
        // Normalizar días existentes
        parsed.plan_semanal = parsed.plan_semanal.map((day) => {
          const d = day as Record<string, unknown>;
          const comidasRaw = (d.comidas as unknown[]) || [];
          
          // Normalizar cada comida
          const comidasNormalizadas = comidasRaw.map((meal) => {
            const m = meal as Record<string, unknown>;
            const nombreRaw = typeof m.nombre === "string" ? m.nombre : "Comida";
            const nombreNormalizado = normalizarNombreComida(nombreRaw);
            
            return {
              hora: typeof m.hora === "string" ? m.hora : obtenerHoraPorDefecto(nombreNormalizado),
              nombre: nombreNormalizado,
              opciones: Array.isArray(m.opciones) && m.opciones.length > 0 
                ? m.opciones.filter((o): o is string => typeof o === "string" && o.trim().length > 0)
                : ["Opción disponible"],
              calorias_kcal: typeof m.calorias_kcal === "number" ? m.calorias_kcal : 0,
              cantidad_gramos: typeof m.cantidad_gramos === "number" ? m.cantidad_gramos : 0,
            };
          });
          
          // Asegurar que hay al menos 4 comidas por día
          const tiposEsperados = ["Desayuno", "Almuerzo", "Snack", "Cena"];
          const comidasFinales = [...comidasNormalizadas];
          
          // Agregar comidas faltantes
          for (const tipo of tiposEsperados) {
            const existe = comidasFinales.some(c => c.nombre === tipo);
            if (!existe) {
              comidasFinales.push({
                hora: obtenerHoraPorDefecto(tipo),
                nombre: tipo,
                opciones: ["Opción disponible"],
                calorias_kcal: 0,
                cantidad_gramos: 0,
              });
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
        
        // Completar hasta 7 días si faltan
        const diasEsperados = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
        const planSemanal = parsed.plan_semanal as Array<Record<string, unknown>>;
        
        // Crear un mapa de días existentes
        const diasMap = new Map<string, Record<string, unknown>>();
        for (const day of planSemanal) {
          const diaNombre = typeof day.dia === "string" ? day.dia : "";
          diasMap.set(diaNombre, day);
        }
        
        // Crear el plan completo con los 7 días
        const planCompleto: Array<Record<string, unknown>> = [];
        for (let i = 0; i < 7; i++) {
          const nombreDia = diasEsperados[i];
          let diaActual = diasMap.get(nombreDia);
          
          // Si el día no existe, crear uno nuevo basado en un día anterior (rotando)
          if (!diaActual && planSemanal.length > 0) {
            const diaTemplateIndex = i > 0 ? (i - 1) % planSemanal.length : 0;
            const diaTemplate = planSemanal[diaTemplateIndex];
            
            // Copiar estructura pero rotar opciones para variedad
            const comidasTemplate = (diaTemplate?.comidas as Array<Record<string, unknown>>) || [];
            const comidasRotadas = comidasTemplate.map((meal) => {
              const opciones = Array.isArray(meal.opciones) ? [...meal.opciones] : [];
              // Rotar opciones: mover la primera al final
              if (opciones.length > 1) {
                opciones.push(opciones.shift()!);
              }
              
              return {
                ...meal,
                opciones: opciones.length > 0 ? opciones : ["Opción disponible"],
              };
            });
            
            diaActual = {
              dia: nombreDia,
              comidas: comidasRotadas,
            };
          }
          
          if (diaActual) {
            planCompleto.push(diaActual);
          }
        }
        
        parsed.plan_semanal = planCompleto;
      }
    }
    
    const parsedFinal = parsedRaw as Record<string, unknown> | null;
    
    if (!parsedFinal || !parsedFinal.plan_semanal) {
      return res.status(422).json({ error: "JSON inválido devuelto por OpenAI", detail: content.slice(0, 1000) });
    }
    
    // Validación mínima
    if (
      typeof parsedFinal?.calorias_diarias !== "number" ||
      !parsedFinal?.macros ||
      !Array.isArray(parsedFinal?.plan_semanal)
    ) {
      return res.status(422).json({ error: "Formato inválido de OpenAI" });
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
    
    return res.status(200).json(parsedFinal);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const isTimeout = message.includes("aborted") || message.includes("timeout") || message.includes("Abort");
    return res.status(502).json({ 
      error: isTimeout ? "Timeout: OpenAI tardó demasiado (intentá de nuevo)" : "Fallo al generar con OpenAI", 
      detail: message 
    });
  }
}


