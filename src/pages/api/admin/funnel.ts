import type { NextApiRequest, NextApiResponse } from "next";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/adminAuthServer";
import { buildFunnelReport } from "@/lib/funnel/report";
import { toFunnelUser } from "@/lib/funnel/store";

/**
 * Informe del embudo de conversión (solo admin).
 *
 * Una sola query a `usuarios` y todo el cálculo en memoria con una función
 * pura. Con el volumen actual (cientos de documentos) esto es más barato y
 * mucho más simple que mantener contadores agregados, que además se
 * desincronizan en cuanto una escritura falla.
 */

/** Correo del admin: se excluye para que las pruebas no ensucien las métricas. */
const ADMIN_EMAIL = "admin@fitplan-ai.com";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

    const db = getAdminDb();
    if (!db) return res.status(500).json({ error: "Firebase Admin SDK no configurado" });

    const rawWindow = Number(req.query.windowDays);
    const windowDays = Number.isFinite(rawWindow) && rawWindow > 0 ? Math.round(rawWindow) : null;

    const snap = await db.collection("usuarios").get();
    const users = snap.docs
      .filter((d) => String(d.data()?.email || "").toLowerCase() !== ADMIN_EMAIL)
      .map((d) => toFunnelUser(d.id, d.data() || {}));

    const report = buildFunnelReport(users, new Date(), windowDays);

    // Sin caché: es un panel interno que se mira para decidir, y un número
    // viejo aquí es peor que esperar un segundo.
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json(report);
  } catch (error) {
    console.error("No se pudo calcular el embudo:", error);
    return res.status(500).json({ error: "No se pudo calcular el embudo" });
  }
}
