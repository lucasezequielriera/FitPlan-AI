import type { NextApiRequest, NextApiResponse } from "next";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/adminAuthServer";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "DELETE") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.error });
  }

  const { clientId } = req.body as { clientId?: string };
  if (!clientId) {
    return res.status(400).json({ error: "Faltan datos requeridos: clientId" });
  }

  try {
    const db = getAdminDb();
    if (!db) {
      return res.status(500).json({ error: "Firebase Admin SDK no configurado" });
    }

    const targetRef = db.collection("intakeClients").doc(clientId);
    const targetDoc = await targetRef.get();
    if (!targetDoc.exists) {
      return res.status(404).json({ error: "Cliente no encontrado" });
    }

    const intakePlansSnap = await db
      .collection("intakeClientPlans")
      .where("intakeClientId", "==", clientId)
      .get();

    const latestPlanId = (targetDoc.data()?.latestPlanId as string | undefined) || null;
    const planIds = new Set<string>(intakePlansSnap.docs.map((doc) => doc.id));
    if (latestPlanId) {
      planIds.add(latestPlanId);
    }

    const allDeletes = [targetRef, ...Array.from(planIds).map((planId) => db.collection("intakeClientPlans").doc(planId))];

    while (allDeletes.length > 0) {
      const batch = db.batch();
      allDeletes.splice(0, 450).forEach((ref) => batch.delete(ref));
      await batch.commit();
    }

    await db.collection("admin").doc("intake_cleanup_logs").set(
      {
        updatedAt: FieldValue.serverTimestamp(),
        lastClientId: clientId,
      },
      { merge: true }
    );

    return res.status(200).json({ ok: true, deletedPlans: planIds.size });
  } catch (error) {
    console.error("Error eliminando cliente de intake:", error);
    return res.status(500).json({ error: "No se pudo eliminar el cliente" });
  }
}

