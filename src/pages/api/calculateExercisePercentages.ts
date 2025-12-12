import type { NextApiRequest, NextApiResponse } from "next";

interface CalculatePercentagesRequest {
  rm: number;
  sets: number;
  reps: string | number;
  rpe: number;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { rm, sets, reps, rpe } = req.body as CalculatePercentagesRequest;

    if (!rm || rm <= 0 || !sets || sets <= 0) {
      return res.status(400).json({ error: "RM y sets son requeridos" });
    }

    // Calcular porcentajes basados en RPE y número de series
    // RPE más alto = porcentaje más alto
    // Más series = ligera reducción en las primeras series
    
    const basePercentage = rpe >= 9 ? 90 : rpe >= 8 ? 85 : rpe >= 7 ? 80 : rpe >= 6 ? 75 : 70;
    
    const percentages: number[] = [];
    
    for (let i = 0; i < sets; i++) {
      let percentage = basePercentage;
      
      // Primera serie puede ser 3-5% menos para calentamiento
      if (i === 0 && sets > 1) {
        percentage = basePercentage - 5;
      }
      // Última serie puede ser 2-3% más si hay fatiga acumulada
      else if (i === sets - 1 && sets > 2) {
        percentage = basePercentage - 2;
      }
      // Series intermedias mantienen el porcentaje base
      else {
        percentage = basePercentage;
      }
      
      percentages.push(Math.max(70, Math.min(95, percentage))); // Limitar entre 70% y 95%
    }

    return res.status(200).json({
      success: true,
      percentages,
      suggestedWeights: percentages.map(p => Math.round((rm * p) / 100)),
    });
  } catch (error) {
    console.error("Error calculando porcentajes:", error);
    return res.status(500).json({
      error: "Error al calcular porcentajes",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
