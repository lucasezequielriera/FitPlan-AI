import type { NextApiRequest, NextApiResponse } from "next";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const db = getAdminDb();
  if (!db) return res.status(500).json({ error: "Firebase Admin SDK no configurado" });

  if (req.method === "GET") {
    const adminUserId = req.query.adminUserId as string | undefined;
    if (!adminUserId) return res.status(400).json({ error: "Falta adminUserId" });
    const adminDoc = await db.collection("usuarios").doc(adminUserId).get();
    const email = adminDoc.data()?.email?.toLowerCase() || "";
    if (!adminDoc.exists || email !== "admin@fitplan-ai.com") {
      return res.status(403).json({ error: "Solo administradores" });
    }
    const unreadSnap = await db
      .collection("adminNotifications")
      .where("type", "==", "payment_success")
      .where("read", "==", false)
      .limit(50)
      .get();
    const recentSnap = await db
      .collection("adminNotifications")
      .where("type", "==", "payment_success")
      .orderBy("createdAt", "desc")
      .limit(6)
      .get();
    return res.status(200).json({
      unreadCount: unreadSnap.size,
      items: recentSnap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Record<string, unknown>) })),
    });
  }

  if (req.method === "POST") {
    const { adminUserId } = req.body as { adminUserId?: string };
    if (!adminUserId) return res.status(400).json({ error: "Falta adminUserId" });
    const adminDoc = await db.collection("usuarios").doc(adminUserId).get();
    const email = adminDoc.data()?.email?.toLowerCase() || "";
    if (!adminDoc.exists || email !== "admin@fitplan-ai.com") {
      return res.status(403).json({ error: "Solo administradores" });
    }
    const unreadSnap = await db
      .collection("adminNotifications")
      .where("type", "==", "payment_success")
      .where("read", "==", false)
      .limit(100)
      .get();
    if (!unreadSnap.empty) {
      const batch = db.batch();
      unreadSnap.docs.forEach((doc) => {
        batch.set(doc.ref, { read: true, readAt: FieldValue.serverTimestamp() }, { merge: true });
      });
      await batch.commit();
    }
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}

