import type { NextApiRequest, NextApiResponse } from "next";
import { getDbSafe } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  
  const db = getDbSafe();
  if (!db) return res.status(501).json({ error: "Firestore no configurado" });
  
  const { plan, userId } = req.body;
  
  if (!userId) {
    return res.status(401).json({ error: "Usuario no autenticado" });
  }
  
  if (!plan) {
    return res.status(400).json({ error: "Plan no proporcionado" });
  }
  
  try {
    const docRef = await addDoc(collection(db, "planes"), {
      userId,
      plan,
      createdAt: serverTimestamp(),
    });
    res.status(200).json({ id: docRef.id });
  } catch (e) {
    console.error("Error al guardar plan:", e);
    res.status(500).json({ error: "No se pudo guardar" });
  }
}

