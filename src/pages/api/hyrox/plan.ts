import type { NextApiRequest, NextApiResponse } from "next";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireUser } from "@/lib/userAuthServer";
import { madridDateId } from "@/lib/dates/madrid";
import { generatePlan } from "@/lib/hyrox/generator";
import { estimatePace, assessGoal } from "@/lib/hyrox/pacing";
import { getHyroxProfile, sanitizeProfile, setHyroxProfile } from "@/lib/hyrox/store";

/**
 * Plan HYROX del usuario autenticado.
 *
 * - `GET`  devuelve el plan generado a partir de su perfil guardado.
 * - `POST` guarda un perfil nuevo y devuelve el plan resultante.
 *
 * El plan se genera al vuelo en cada petición, no se guarda. Es determinista y
 * barato de calcular, y así una mejora del generador llega a todo el mundo sin
 * migrar nada.
 *
 * La identidad sale siempre del token verificado, nunca del cuerpo.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const auth = await requireUser(req);
  if (!auth.ok) return res.status(auth.status).json({ error: "Identidad no verificada" });

  const db = getAdminDb();
  if (!db) return res.status(500).json({ error: "Firebase Admin SDK no configurado" });

  try {
    let profile = null;

    if (req.method === "POST") {
      profile = sanitizeProfile(req.body?.profile);
      if (!profile) {
        return res.status(400).json({ error: "Falta la fecha de carrera o el perfil no es válido." });
      }
      await setHyroxProfile(db, auth.uid, profile);
    } else {
      profile = await getHyroxProfile(db, auth.uid);
    }

    if (!profile) return res.status(200).json({ profile: null, plan: null });

    const today = madridDateId(new Date());
    const plan = generatePlan(profile, today);
    const pace = estimatePace(profile);

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({
      profile,
      plan,
      pace,
      goalAssessment: assessGoal(profile, pace),
    });
  } catch (error) {
    console.error("No se pudo generar el plan HYROX:", error);
    return res.status(500).json({ error: "No se pudo generar el plan" });
  }
}
