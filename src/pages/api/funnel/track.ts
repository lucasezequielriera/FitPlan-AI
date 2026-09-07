import type { NextApiRequest, NextApiResponse } from "next";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireUser } from "@/lib/userAuthServer";
import { markMilestone } from "@/lib/funnel/store";
import { TRACKABLE_MILESTONES, type TrackableMilestone } from "@/lib/funnel/types";

/**
 * Registra un hito del embudo del usuario autenticado.
 *
 * El UID se toma del token verificado, NUNCA del cuerpo del request. La primera
 * versión aceptaba `userId` del body sin comprobar nada: cualquiera con el UID
 * de otra persona podía marcarle hitos falsos. Y como los hitos se escriben
 * "solo la primera vez y no se pisan", ese dato falso sería permanente —
 * corrompiendo justo la métrica que esta función existe para producir.
 *
 * Devuelve 200 aunque la escritura falle: es telemetría, y un fallo aquí no
 * debe convertirse en un error visible ni en un reintento del cliente. Lo que
 * sí se rechaza es un llamante sin identidad probada.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { milestone } = req.body ?? {};
  if (!TRACKABLE_MILESTONES.includes(milestone as TrackableMilestone)) {
    return res.status(400).json({ error: "milestone no válido" });
  }

  const auth = await requireUser(req);
  if (!auth.ok) return res.status(auth.status).json({ error: "Identidad no verificada" });

  const db = getAdminDb();
  if (!db) return res.status(200).json({ ok: false });

  await markMilestone(db, auth.uid, milestone as TrackableMilestone);
  return res.status(200).json({ ok: true });
}
