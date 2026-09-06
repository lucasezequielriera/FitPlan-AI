import type { NextApiRequest, NextApiResponse } from "next";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireUser, authFailureMessage } from "@/lib/userAuthServer";

interface ExerciseWeightData {
  userId: string;
  planId: string;
  exerciseName: string;
  week: number;
  day: string;
  sets: Array<{
    setNumber: number;
    weight: number;
    reps: string | number;
    completed: boolean;
    date: string;
  }>;
  date: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // El registro queda a nombre de quien llama (UID del ID token verificado):
  // antes se podían inyectar series de entrenamiento en el historial ajeno.
  const auth = await requireUser(req);
  if (!auth.ok) {
    return res.status(auth.status).json({ error: authFailureMessage(auth.code) });
  }
  const userId = auth.uid;

  try {
    const {
      planId,
      exerciseName,
      week,
      day,
      sets,
    } = req.body as Omit<ExerciseWeightData, "date" | "userId">;

    if (!planId || !exerciseName || !sets || sets.length === 0) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const db = getAdminDb();
    if (!db) {
      return res.status(500).json({ error: "Firebase Admin no configurado" });
    }

    const exerciseWeightData: ExerciseWeightData = {
      userId,
      planId,
      exerciseName,
      week,
      day,
      sets,
      date: new Date().toISOString(),
    };

    // Guardar en la colección exercise_weights
    const docRef = await db.collection("exercise_weights").add({
      ...exerciseWeightData,
      createdAt: new Date(),
    });

    return res.status(200).json({
      success: true,
      id: docRef.id,
      data: exerciseWeightData,
    });
  } catch (error) {
    console.error("Error guardando pesos de ejercicio:", error);
    return res.status(500).json({
      error: "Error al guardar los pesos del ejercicio",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

