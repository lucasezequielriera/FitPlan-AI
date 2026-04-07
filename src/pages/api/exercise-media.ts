import type { NextApiRequest, NextApiResponse } from "next";
import { resolveWgerExerciseMedia, resolveWgerExerciseMediaBatch } from "@/lib/wgerExerciseMedia";

export const maxDuration = 45;

/**
 * Ilustraciones de ejercicios (wger.de, sin YouTube).
 * GET ?q=nombre  |  POST { names: string[] }
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    if (q.length < 2) {
      return res.status(400).json({ error: "Parámetro q requerido (nombre del ejercicio)." });
    }
    if (q.length > 160) {
      return res.status(400).json({ error: "Nombre demasiado largo." });
    }
    try {
      const media = await resolveWgerExerciseMedia(q);
      return res.status(200).json({ media });
    } catch {
      return res.status(200).json({ media: null });
    }
  }

  if (req.method === "POST") {
    const raw = req.body?.names;
    if (!Array.isArray(raw)) {
      return res.status(400).json({ error: "Body debe incluir names: string[]" });
    }
    const names = raw
      .filter((x: unknown): x is string => typeof x === "string")
      .map((x) => x.trim())
      .filter((x) => x.length >= 2 && x.length <= 160)
      .slice(0, 45);
    if (!names.length) {
      return res.status(400).json({ error: "Lista names vacía o inválida." });
    }
    try {
      const results = await resolveWgerExerciseMediaBatch(names);
      return res.status(200).json({ results });
    } catch {
      return res.status(200).json({ results: {} });
    }
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed" });
}
