import type { NextApiRequest, NextApiResponse } from "next";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireUser } from "@/lib/userAuthServer";
import { madridDateId } from "@/lib/dates/madrid";
import { generatePlan } from "@/lib/hyrox/generator";
import { estimatePace, assessGoal } from "@/lib/hyrox/pacing";
import { getHyroxProfile, sanitizeProfile, setHyroxProfile } from "@/lib/hyrox/store";
import { translatePlan } from "@/lib/hyrox/translate";
import { STATIONS } from "@/lib/hyrox/strategy";

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
    // HYROX es una función premium (decisión de Lucas, 2026-09). Se comprueba
    // en el SERVIDOR y no solo en la interfaz: ocultar un botón no protege
    // nada, la API seguiría respondiendo a quien la llamara directamente.
    const userSnap = await db.collection("usuarios").doc(auth.uid).get();
    const isPremium = userSnap.data()?.premium === true;
    if (!isPremium) {
      return res.status(403).json({ error: "premium_required", premiumRequired: true });
    }

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
    const generated = generatePlan(profile, today);
    const pace = estimatePace(profile);

    // El plan se genera SIEMPRE en español (código determinista) y, si el
    // usuario tiene la app en otro idioma, se traduce con OpenAI y se cachea
    // por frase. Así el contenido no depende de un LLM para existir —solo para
    // cambiar de idioma— y a partir del primer usuario en ese idioma es gratis.
    const locale = typeof req.query.locale === "string" ? req.query.locale : "es";
    const translation = await translatePlan(db, generated, locale);
    const plan = translation.plan;

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({
      profile,
      plan,
      pace,
      goalAssessment: assessGoal(profile, pace),
      // `true` si algo quedó sin traducir: la vista lo dice en vez de mostrar
      // dos idiomas mezclados sin explicación.
      translationDegraded: translation.degraded,
      // Las estaciones viajan en la RESPUESTA, no en el bundle del cliente.
      // Importarlas como valor desde la página las metía en un chunk JS público
      // que cualquiera podía descargar sin sesión — y son justo una de las
      // cosas que el muro de pago promete a cambio del Premium.
      stations: STATIONS,
    });
  } catch (error) {
    console.error("No se pudo generar el plan HYROX:", error);
    return res.status(500).json({ error: "No se pudo generar el plan" });
  }
}
