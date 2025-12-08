import type { NextApiRequest, NextApiResponse } from "next";

interface AnalysisData {
  pesoInicial: number;
  pesoFinal: number;
  cinturaInicial?: number;
  cinturaFinal?: number;
  objetivo: string;
  duracionDias: number;
  adherenciaComida: string;
  adherenciaEntreno: string;
  energia: string;
  recuperacion: string;
  lesionesNuevas?: string;
  comentarios?: string;
  caloriasObjetivo: number;
  macros: {
    proteinas: string;
    carbohidratos: string;
    grasas: string;
  };
  diasGym?: number;
  diasCardio?: number;
  intensidad: string;
  edad: number;
  sexo: string;
  alturaCm: number;
  tipoDieta?: string;
  restricciones?: string[];
  preferencias?: string[];
  patologias?: string[];
  doloresLesiones?: string[];
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const data = req.body as AnalysisData;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(503).json({ error: "OPENAI_API_KEY no configurada" });

  try {
    const cambioPeso = data.pesoFinal - data.pesoInicial;
    const cambioPesoPorcentaje = (cambioPeso / data.pesoInicial) * 100;
    const cambioCintura = data.cinturaInicial && data.cinturaFinal ? data.cinturaFinal - data.cinturaInicial : null;

    const objetivoMap: Record<string, string> = {
      perder_grasa: "Perder grasa",
      mantener: "Mantener peso",
      ganar_masa: "Ganar masa muscular",
      recomposicion: "Recomposición corporal",
      definicion: "Definición extrema",
      volumen: "Volumen/Hipertrofia",
      corte: "Corte (pérdida grasa preservando músculo)",
      mantenimiento_avanzado: "Mantenimiento avanzado",
      rendimiento_deportivo: "Rendimiento deportivo",
      powerlifting: "Powerlifting/Fuerza",
      resistencia: "Resistencia",
      atleta_elite: "Atleta elite",
    };

    const objetivoDescripcion = objetivoMap[data.objetivo] || data.objetivo;

    const prompt = `Eres un experto en nutrición y entrenamiento. Analiza los resultados de un plan completado y genera una sugerencia de continuidad inteligente.\n\n**DATOS DEL PLAN COMPLETADO:**\n\n**Objetivo original:** ${objetivoDescripcion}\n**Duración:** ${data.duracionDias} días\n\n**RESULTADOS FÍSICOS:**\n- Peso inicial: ${data.pesoInicial} kg\n- Peso final: ${data.pesoFinal} kg\n- Cambio: ${cambioPeso > 0 ? '+' : ''}${cambioPeso.toFixed(1)} kg (${cambioPesoPorcentaje > 0 ? '+' : ''}${cambioPesoPorcentaje.toFixed(1)}%)\n${cambioCintura !== null ? `- Cintura inicial: ${data.cinturaInicial} cm\n- Cintura final: ${data.cinturaFinal} cm\n- Cambio cintura: ${cambioCintura > 0 ? '+' : ''}${cambioCintura.toFixed(1)} cm` : ''}\n\n**ADHERENCIA Y BIENESTAR:**\n${data.adherenciaComida ? `- Adherencia a comidas: ${data.adherenciaComida}` : ''}\n${data.adherenciaEntreno ? `- Adherencia a entrenamiento: ${data.adherenciaEntreno}` : ''}\n${data.energia ? `- Nivel de energía: ${data.energia}` : ''}\n${data.recuperacion ? `- Recuperación: ${data.recuperacion}` : ''}\n${data.lesionesNuevas ? `- Lesiones nuevas: ${data.lesionesNuevas}` : ''}\n${data.comentarios ? `- Comentarios del usuario: ${data.comentarios}` : ''}\n\n**CARACTERÍSTICAS DEL PLAN:**\n- Calorías objetivo: ${data.caloriasObjetivo} kcal/día\n- Macros: ${data.macros.proteinas} proteína, ${data.macros.carbohidratos} carbos, ${data.macros.grasas} grasa\n- Días de gym: ${data.diasGym || 'No especificado'}\n- Días de cardio: ${data.diasCardio || 'No especificado'}\n- Intensidad: ${data.intensidad}\n\n**PERFIL DEL USUARIO:**\n- Edad: ${data.edad} años\n- Sexo: ${data.sexo}\n- Altura: ${data.alturaCm} cm\n- Peso actual: ${data.pesoFinal} kg\n${data.tipoDieta ? `- Tipo de dieta: ${data.tipoDieta}` : ''}\n${data.restricciones && data.restricciones.length > 0 ? `- Restricciones: ${data.restricciones.join(', ')}` : ''}\n${data.patologias && data.patologias.length > 0 ? `- Patologías: ${data.patologias.join(', ')}` : ''}\n${data.doloresLesiones && data.doloresLesiones.length > 0 ? `- Dolores/Lesiones: ${data.doloresLesiones.join(', ')}` : ''}\n\n---\n\n**INSTRUCCIONES:**\n\n1. **Analiza los resultados** comparando el objetivo con lo logrado\n2. **Evalúa el progreso** considerando adherencia, energía y recuperación\n3. **Genera una sugerencia inteligente** de continuidad que incluya:\n   - Si debe continuar con el mismo objetivo o cambiar\n   - Ajustes recomendados (calorías, macros, entrenamiento)\n   - Nuevo objetivo sugerido\n   - Razones claras de por qué recomiendas esa continuidad\n\n**Responde SOLO con JSON válido en este formato exacto:**\n\n{\n  "analisis": {\n    "cumplioObjetivo": boolean,\n    "progresoGeneral": "excelente" | "bueno" | "regular" | "insuficiente",\n    "puntosPositivos": [string],\n    "areasMejora": [string],\n    "resumen": string\n  },\n  "sugerenciaContinuidad": {\n    "objetivoRecomendado": string (objetivo válido),\n    "razonObjetivo": string,\n    "ajustesCalorias": string (ej: "+100", "-100", "mantener"),\n    "ajustesMacros": {\n      "proteinas": "aumentar" | "mantener" | "reducir",\n      "carbohidratos": "aumentar" | "mantener" | "reducir",\n      "grasas": "aumentar" | "mantener" | "reducir"\n    },\n    "ajustesEntrenamiento": {\n      "diasGym": "aumentar" | "mantener" | "reducir",\n      "intensidad": "aumentar" | "mantener" | "reducir",\n      "recomendacion": string\n    },\n    "mensajeMotivacional": string\n  },\n  "objetivosAlternativos": [\n    {\n      "objetivo": string,\n      "razon": string,\n      "adecuadoPara": string\n    }\n  ]\n}`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "Eres un experto en nutrición y entrenamiento. Respondes SOLO con JSON válido." },
          { role: "user", content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Error de OpenAI:", errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const completion = await response.json();
    const content = completion.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("No se recibió respuesta de OpenAI");
    }

    let analysis;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      analysis = JSON.parse(jsonMatch ? jsonMatch[0] : content);
    } catch (parseError) {
      console.error("Error al parsear respuesta de OpenAI:", parseError);
      console.error("Contenido recibido:", content);
      throw new Error("No se pudo parsear la respuesta de OpenAI");
    }

    if (!analysis.analisis || !analysis.sugerenciaContinuidad || !analysis.objetivosAlternativos) {
      console.error("Estructura de análisis inválida:", analysis);
      throw new Error("Estructura de análisis incompleta");
    }

    res.status(200).json(analysis);
  } catch (error: unknown) {
    console.error("Error en analyzePlanCompletion:", error);
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    res.status(500).json({ error: `Error al analizar plan: ${errorMessage}` });
  }
}



