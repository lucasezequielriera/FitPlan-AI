import type { NextApiRequest, NextApiResponse } from "next";
import { searchWgerExerciseCandidates } from "@/lib/wgerExerciseMedia";
import { requireAdmin } from "@/lib/adminAuthServer";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.error });
  }

  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const limitRaw = typeof req.query.limit === "string" ? Number(req.query.limit) : 12;

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
