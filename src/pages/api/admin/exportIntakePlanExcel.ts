import type { NextApiRequest, NextApiResponse } from "next";
import { getAdminDb } from "@/lib/firebase-admin";
import { buildIntakePlanXlsxWithExerciseImages } from "@/lib/intakePlanExcelWorkbook";
import { requireAdmin } from "@/lib/adminAuthServer";

export const maxDuration = 60;

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "6mb",
    },
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.error });
  }

  const { clientLabel, plan } = req.body as {
    clientLabel?: string;
    plan?: unknown;
  };

  if (!plan || typeof plan !== "object" || Array.isArray(plan)) {
    return res.status(400).json({ error: "Falta plan (objeto)" });
  }

  try {
    const db = getAdminDb();
    if (!db) {
      return res.status(500).json({ error: "Firebase Admin SDK no configurado" });
    }

    const buf = await buildIntakePlanXlsxWithExerciseImages(plan as Record<string, unknown>, {
      clientLabel: typeof clientLabel === "string" && clientLabel.trim() ? clientLabel.trim() : "Cliente",
    });

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", 'attachment; filename="plan-lucas-riera.xlsx"');
    return res.status(200).send(buf);
  } catch (e) {
    console.error("exportIntakePlanExcel:", e);
    return res.status(500).json({ error: "No se pudo generar el Excel con imágenes" });
  }
}
