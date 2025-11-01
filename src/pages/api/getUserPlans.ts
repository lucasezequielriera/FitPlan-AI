import type { NextApiRequest, NextApiResponse } from "next";
import { getDbSafe } from "@/lib/firebase";
import { collection, query, where, getDocs, orderBy, limit } from "firebase/firestore";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  
  const db = getDbSafe();
  if (!db) return res.status(501).json({ error: "Firestore no configurado" });
  
  const { userId } = req.query;
  
  if (!userId || typeof userId !== "string") {
    return res.status(400).json({ error: "userId requerido" });
  }
  
  try {
    // Sin orderBy para evitar necesidad de índice compuesto
    const q = query(
      collection(db, "planes"),
      where("userId", "==", userId),
      limit(50)
    );

    const querySnapshot = await getDocs(q);
    const plans: any[] = [];
    querySnapshot.forEach((doc) => {
      plans.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    // Ordenar por fecha de creación en memoria (más reciente primero)
    plans.sort((a, b) => {
      const aTime = a.createdAt?.toMillis?.() || a.createdAt?.seconds || 0;
      const bTime = b.createdAt?.toMillis?.() || b.createdAt?.seconds || 0;
      return bTime - aTime; // Orden descendente
    });

    // Limitar a 20 después de ordenar
    const limitedPlans = plans.slice(0, 20);

    res.status(200).json({ plans: limitedPlans });
  } catch (e) {
    console.error("Error al obtener planes:", e);
    res.status(500).json({ error: "No se pudieron obtener los planes" });
  }
}

