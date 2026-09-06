import type { NextApiRequest, NextApiResponse } from "next";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireUser, authFailureMessage } from "@/lib/userAuthServer";

interface SavePlanBody {
  plan?: unknown;
  planAnteriorId?: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // El plan se crea siempre a nombre de quien llama: el UID sale del ID token
  // verificado, no del body (antes se podía crear un plan en la cuenta ajena
  // que se quisiera con solo conocer su UID).
  const auth = await requireUser(req);
  if (!auth.ok) {
    return res.status(auth.status).json({ error: authFailureMessage(auth.code) });
  }
  const userId = auth.uid;

  const { plan, planAnteriorId } = (req.body || {}) as SavePlanBody;

  if (!plan) {
    return res.status(400).json({ error: "plan es requerido" });
  }

  try {
    const db = getAdminDb();
    if (!db) {
      return res.status(501).json({ error: "Firebase Admin SDK no configurado" });
    }

    const docRef = await db.collection("planes").add({
      userId,
      plan,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      ...(planAnteriorId ? { planAnteriorId } : {}),
      source: "plan_continuity",
    });

    return res.status(200).json({ id: docRef.id });
  } catch (error) {
    console.error("❌ Error al guardar plan:", error);
    return res.status(500).json({
      error: "No se pudo guardar el plan",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}
