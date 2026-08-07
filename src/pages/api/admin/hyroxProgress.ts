import type { NextApiRequest, NextApiResponse } from "next";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/adminAuthServer";

const DOC_COLLECTION = "config";
const DOC_ID = "hyroxProgress";

/**
 * Progreso del reto HYROX: qué sesiones se han completado y los resultados de
 * los tests de referencia.
 *
 * Va todo en un único doc en vez de una colección por sesión: son 15 semanas
 * × 7 días como mucho, cabe de sobra en un documento y se lee de una sola vez
 * sin necesitar índices ni paginación.
 *
 * Forma del doc:
 * {
 *   done: { "3-Lunes": true, ... },              // sesiones completadas
 *   benchmarks: { "run5k": { "1": "28:40" } },   // test -> semana -> resultado
 *   notes: { "3": "..." }                        // notas por semana
 * }
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const db = getAdminDb();
  if (!db) return res.status(500).json({ error: "Firebase Admin SDK no configurado" });

  const ref = db.collection(DOC_COLLECTION).doc(DOC_ID);

  if (req.method === "GET") {
    try {
      const snap = await ref.get();
      const data = snap.exists ? snap.data() || {} : {};
      return res.status(200).json({
        ok: true,
        done: data.done || {},
        benchmarks: data.benchmarks || {},
        notes: data.notes || {},
      });
    } catch (error) {
      console.error("Error leyendo progreso HYROX:", error);
      return res.status(500).json({ error: "No se pudo leer el progreso" });
    }
  }

  if (req.method === "POST") {
    const { sessionKey, done, benchmarkKey, week, value, note } = req.body || {};

    try {
      if (typeof sessionKey === "string") {
        await ref.set({ done: { [sessionKey]: done === true } }, { merge: true });
        return res.status(200).json({ ok: true });
      }

      if (typeof benchmarkKey === "string" && (typeof week === "number" || typeof week === "string")) {
        if (typeof value !== "string") {
          return res.status(400).json({ error: "value debe ser un string" });
        }
        // Cadena vacía = borrar el registro, para poder corregir un error.
        const update = value.trim()
          ? { benchmarks: { [benchmarkKey]: { [String(week)]: value.trim() } } }
          : { benchmarks: { [benchmarkKey]: { [String(week)]: FieldValue.delete() } } };
        await ref.set(update, { merge: true });
        return res.status(200).json({ ok: true });
      }

      if (typeof note === "string" && (typeof week === "number" || typeof week === "string")) {
        await ref.set({ notes: { [String(week)]: note } }, { merge: true });
        return res.status(200).json({ ok: true });
      }

      return res.status(400).json({ error: "Petición sin datos reconocibles" });
    } catch (error) {
      console.error("Error guardando progreso HYROX:", error);
      return res.status(500).json({ error: "No se pudo guardar el progreso" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
