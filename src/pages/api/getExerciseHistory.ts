import type { NextApiRequest, NextApiResponse } from "next";
import { getAdminDb } from "@/lib/firebase-admin";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { userId, exerciseName, planId } = req.query;

    if (!userId || !exerciseName) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    const db = getAdminDb();
    if (!db) {
      return res.status(500).json({ error: "Firebase Admin no configurado" });
    }

    // Construir query base - solo filtrar por userId y exerciseName
    // Ordenar en memoria para evitar necesidad de índice compuesto
    let query = db
      .collection("exercise_weights")
      .where("userId", "==", userId)
      .where("exerciseName", "==", exerciseName);

    // Obtener todos los documentos (limitamos a 50 para no sobrecargar)
    const snapshot = await query.limit(50).get();

    let history = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Array<{ id: string; planId?: string; date?: string | Date; sets?: Array<{ weight: number; completed: boolean }> }>;

    // Filtrar por planId si se proporciona
    if (planId) {
      history = history.filter((entry) => entry.planId === planId);
    }

    // Ordenar por fecha en memoria (descendente)
    history = history.sort((a, b) => {
      const dateA = a.date ? new Date(a.date).getTime() : 0;
      const dateB = b.date ? new Date(b.date).getTime() : 0;
      return dateB - dateA; // Descendente
    }).slice(0, 10); // Limitar a 10 después de ordenar

    // Calcular estadísticas
    const allWeights = history.flatMap((entry) =>
      entry.sets
        ?.filter((set: { weight: number }) => set.weight > 0)
        .map((set: { weight: number }) => set.weight) || []
    );

    const stats = {
      maxWeight: allWeights.length > 0 ? Math.max(...allWeights) : null,
      avgWeight:
        allWeights.length > 0
          ? allWeights.reduce((a: number, b: number) => a + b, 0) /
            allWeights.length
          : null,
      lastWeight:
        history.length > 0 && history[0].sets?.length > 0
          ? history[0].sets[history[0].sets.length - 1].weight
          : null,
      totalSessions: history.length,
    };

    return res.status(200).json({
      success: true,
      history,
      stats,
    });
  } catch (error) {
    console.error("Error obteniendo historial de ejercicio:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    // Si es un error de índice faltante, dar un mensaje más claro
    if (errorMessage.includes("index") || errorMessage.includes("Index")) {
      console.error("⚠️ Se requiere crear un índice compuesto en Firestore para esta query");
      console.error("📝 Ve a Firebase Console > Firestore > Indexes y crea un índice para:");
      console.error("   - Collection: exercise_weights");
      console.error("   - Fields: userId (Ascending), exerciseName (Ascending), date (Descending)");
    }
    
    return res.status(500).json({
      error: "Error al obtener el historial del ejercicio",
      details: errorMessage,
      stack: process.env.NODE_ENV === "development" ? errorStack : undefined,
    });
  }
}

