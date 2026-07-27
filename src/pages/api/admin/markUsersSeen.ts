import type { NextApiRequest, NextApiResponse } from "next";
import { getAdminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireAdmin } from "@/lib/adminAuthServer";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) {
      return res.status(auth.status).json({ error: auth.error });
    }

    const db = getAdminDb();
    if (!db) {
      return res.status(500).json({ error: "Firebase Admin SDK no configurado" });
    }

    const adminRef = db.collection("usuarios").doc(auth.uid);

    await adminRef.update({
      lastUsersCheck: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    const refreshedDoc = await adminRef.get();
    const refreshedData = refreshedDoc.data();
    let lastUsersCheck: string | null = null;

    const rawTimestamp = refreshedData?.lastUsersCheck;
    if (rawTimestamp) {
      try {
        if (typeof rawTimestamp === "string") {
          const parsed = new Date(rawTimestamp);
          lastUsersCheck = isNaN(parsed.getTime()) ? null : parsed.toISOString();
        } else if (rawTimestamp instanceof Date) {
          lastUsersCheck = rawTimestamp.toISOString();
        } else if (typeof rawTimestamp === "object" && "toDate" in rawTimestamp && typeof rawTimestamp.toDate === "function") {
          lastUsersCheck = (rawTimestamp as { toDate: () => Date }).toDate().toISOString();
        } else if (typeof rawTimestamp === "object" && "seconds" in rawTimestamp) {
          const { seconds, nanoseconds = 0 } = rawTimestamp as { seconds: number; nanoseconds?: number };
          lastUsersCheck = new Date(seconds * 1000 + nanoseconds / 1_000_000).toISOString();
        }
      } catch (error) {
        console.error("Error al convertir lastUsersCheck:", error);
      }
    }

    if (!lastUsersCheck) {
      lastUsersCheck = new Date().toISOString();
    }

    return res.status(200).json({ message: "Last users check actualizado", lastUsersCheck });
  } catch (error) {
    console.error("Error al marcar usuarios como revisados:", error);
    const message = error instanceof Error ? error.message : "Error desconocido";
    return res.status(500).json({ error: "No se pudo actualizar lastUsersCheck", detail: message });
  }
}
