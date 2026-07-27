import type { NextApiRequest, NextApiResponse } from "next";
import { requireAdmin } from "@/lib/adminAuthServer";
import { suggestSocialTopic } from "@/lib/socialContent/generateCopy";

/** Sugiere un tema puntual para el generador manual de contenido social. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.error });
  }

  try {
    const topic = await suggestSocialTopic();
    return res.status(200).json({ topic });
  } catch (error) {
    console.error("Error sugiriendo tema social:", error);
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: "No se pudo sugerir un tema", detail: message });
  }
}
