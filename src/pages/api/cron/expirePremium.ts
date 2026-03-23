import type { NextApiRequest, NextApiResponse } from "next";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";

function isAuthorized(req: NextApiRequest): boolean {
  const cronHeader = req.headers["x-vercel-cron"];
  if (cronHeader === "1") return true;

  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const authHeader = req.headers.authorization || "";
  return authHeader === `Bearer ${secret}`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!isAuthorized(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const db = getAdminDb();
    if (!db) {
      return res.status(500).json({ error: "Firebase Admin SDK no configurado" });
    }

    const now = new Date();
    const snapshot = await db
      .collection("usuarios")
      .where("premium", "==", true)
      .where("premiumExpiresAt", "<=", now)
      .get();

    if (snapshot.empty) {
      return res.status(200).json({ ok: true, checked: 0, expired: 0 });
    }

    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      batch.set(
        doc.ref,
        {
          premium: false,
          premiumStatus: "expired",
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    });

    await batch.commit();

    return res.status(200).json({
      ok: true,
      checked: snapshot.size,
      expired: snapshot.size,
    });
  } catch (error) {
    console.error("Error expirando premium en cron:", error);
    return res.status(500).json({ error: "No se pudo expirar premium" });
  }
}

