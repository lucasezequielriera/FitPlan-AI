import type { NextApiRequest, NextApiResponse } from "next";
import { requireAdmin } from "@/lib/adminAuthServer";
import {
  BENCHMARKS,
  FIRST_MONDAY,
  PARTNER_ADJUSTMENTS,
  PHASES,
  RACE_DATE,
  WEEKS,
} from "@/lib/hyrox/plan";
import {
  CONTENT_ANGLES,
  DOUBLES_PRINCIPLES,
  NUTRITION,
  PACE_TARGETS,
  STATIONS,
} from "@/lib/hyrox/strategy";

/**
 * Contenido HYROX del panel de admin.
 *
 * Existe por un motivo de seguridad, no de arquitectura: cuando la página lo
 * importaba como valor, todas estas constantes acababan en un chunk JS
 * público. Y el guard de admin es solo de cliente, así que `curl /admin/hyrox`
 * devolvía 200 con la etiqueta `<script src="...">` del chunk, y un segundo
 * `curl` a esa URL entregaba el contenido íntegro — sin ninguna credencial.
 *
 * Ese contenido es justo parte de lo que el muro de pago de `/hyrox` vende, así
 * que ahora se sirve desde aquí, detrás de `requireAdmin`.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const auth = await requireAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  // `no-store` y no `private, max-age=300`. Es contenido que solo debe ver un
  // admin, y con la caché puesta se comprobó en producción que un `fetch` sin
  // ningún token devolvía 200 con los datos completos: el navegador servía la
  // respuesta guardada de una petición anterior que sí iba autenticada. Que las
  // constantes no cambien no es motivo para cachearlas cuando quién puede verlas
  // sí depende de la petición.
  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json({
    raceDate: RACE_DATE,
    firstMonday: FIRST_MONDAY,
    phases: PHASES,
    weeks: WEEKS,
    benchmarks: BENCHMARKS,
    partnerAdjustments: PARTNER_ADJUSTMENTS,
    stations: STATIONS,
    paceTargets: PACE_TARGETS,
    doublesPrinciples: DOUBLES_PRINCIPLES,
    nutrition: NUTRITION,
    contentAngles: CONTENT_ANGLES,
  });
}
