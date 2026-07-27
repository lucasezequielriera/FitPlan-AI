import type { NextApiRequest, NextApiResponse } from "next";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/adminAuthServer";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const db = getAdminDb();
  if (!db) return res.status(500).json({ error: "Firebase Admin SDK no configurado" });

  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.error });
  }

  if (req.method === "GET") {
    const unreadPaymentSnap = await db
      .collection("adminNotifications")
      .where("type", "==", "payment_success")
      .where("read", "==", false)
      .limit(50)
      .get();
    const unreadCoachSnap = await db
      .collection("adminNotifications")
      .where("type", "==", "coach_alert")
      .where("read", "==", false)
      .limit(50)
      .get();
    const unreadDigestSnap = await db
      .collection("adminNotifications")
      .where("type", "==", "weekly_digest_sent")
      .where("read", "==", false)
      .limit(50)
      .get();
    const unreadDigestFailedSnap = await db
      .collection("adminNotifications")
      .where("type", "==", "weekly_digest_failed")
      .where("read", "==", false)
      .limit(50)
      .get();
    const unreadRiskSnap = await db
      .collection("adminNotifications")
      .where("type", "==", "adherence_risk_weekly")
      .where("read", "==", false)
      .limit(50)
      .get();
    const recentSnap = await db
      .collection("adminNotifications")
      .where("type", "in", [
        "payment_success",
        "coach_alert",
        "weekly_digest_sent",
        "weekly_digest_failed",
        "adherence_risk_weekly",
      ])
      .orderBy("createdAt", "desc")
      .limit(12)
      .get();
    return res.status(200).json({
      unreadCount:
        unreadPaymentSnap.size +
        unreadCoachSnap.size +
        unreadDigestSnap.size +
        unreadDigestFailedSnap.size +
        unreadRiskSnap.size,
      items: recentSnap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Record<string, unknown>) })),
    });
  }

  if (req.method === "POST") {
    const unreadPaymentSnap = await db
      .collection("adminNotifications")
      .where("type", "==", "payment_success")
      .where("read", "==", false)
      .limit(100)
      .get();
    const unreadCoachSnap = await db
      .collection("adminNotifications")
      .where("type", "==", "coach_alert")
      .where("read", "==", false)
      .limit(100)
      .get();
    const unreadDigestSnap = await db
      .collection("adminNotifications")
      .where("type", "==", "weekly_digest_sent")
      .where("read", "==", false)
      .limit(100)
      .get();
    const unreadDigestFailedSnap = await db
      .collection("adminNotifications")
      .where("type", "==", "weekly_digest_failed")
      .where("read", "==", false)
      .limit(100)
      .get();
    const unreadRiskSnap = await db
      .collection("adminNotifications")
      .where("type", "==", "adherence_risk_weekly")
      .where("read", "==", false)
      .limit(100)
      .get();
    const allUnread = [
      ...unreadPaymentSnap.docs,
      ...unreadCoachSnap.docs,
      ...unreadDigestSnap.docs,
      ...unreadDigestFailedSnap.docs,
      ...unreadRiskSnap.docs,
    ];
    if (allUnread.length > 0) {
      const batch = db.batch();
      allUnread.forEach((doc) => {
        batch.set(doc.ref, { read: true, readAt: FieldValue.serverTimestamp() }, { merge: true });
      });
      await batch.commit();
    }
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}

