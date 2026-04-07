import type { NextApiRequest, NextApiResponse } from "next";
import { getAdminDb } from "@/lib/firebase-admin";
import { searchWgerExerciseCandidates } from "@/lib/wgerExerciseMedia";

async function assertAdmin(userId: string): Promise<boolean> {
  const db = getAdminDb();
  if (!db) return false;
  const doc = await db.collection("usuarios").doc(userId).get();
  const email = (doc.data()?.email as string | undefined)?.toLowerCase() || "";
  return doc.exists && email === "admin@fitplan-ai.com";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const userId = typeof req.query.userId === "string" ? req.query.userId.trim() : "";
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const limitRaw = typeof req.query.limit === "string" ? Number(req.query.limit) : 12;

  if (!userId) {
    return res.status(400).json({ error: "Falta userId" });
  }
  if (!(await assertAdmin(userId))) {
    return res.status(403).json({ error: "Solo administradores" });
  }
  if (q.length < 2) {
    return res.status(400).json({ error: "Escribe al menos 2 caracteres" });
  }

  try {
    const results = await searchWgerExerciseCandidates(q, {
      limit: Number.isFinite(limitRaw) ? limitRaw : 12,
      signal: AbortSignal.timeout(20000),
    });
    return res.status(200).json({ results });
  } catch (e) {
    console.error("wgerExerciseSearch:", e);
    return res.status(500).json({ error: "Búsqueda wger falló" });
  }
}
