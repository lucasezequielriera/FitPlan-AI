import type { NextApiRequest, NextApiResponse } from "next";
import { getAdminDb } from "@/lib/firebase-admin";

/**
 * API para obtener las ganancias mensuales reales desde Firestore (solo admin)
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const db = getAdminDb();
    if (!db) {
      return res.status(500).json({ error: "Firebase Admin SDK no configurado" });
    }

    const { monthId, adminUserId } = req.query;

    if (!monthId || !adminUserId) {
      return res.status(400).json({ error: "Faltan parámetros: monthId y adminUserId" });
    }

    // Verificar que el usuario es administrador
    const adminUserRef = db.collection("usuarios").doc(adminUserId as string);
    const adminUserDoc = await adminUserRef.get();
    
    if (!adminUserDoc.exists) {
      return res.status(403).json({ error: "Admin no encontrado" });
    }

    const adminUserData = adminUserDoc.data();
    const email = adminUserData?.email?.toLowerCase() || "";
    const isAdmin = email === "admin@fitplan-ai.com";

    if (!isAdmin) {
      return res.status(403).json({ error: "Solo administradores pueden acceder" });
    }

    // Obtener las ganancias del mes desde la colección admin
    const adminMonthRef = db.collection("admin").doc(monthId as string);
    const adminMonthDoc = await adminMonthRef.get();

    if (!adminMonthDoc.exists) {
      // Si no existe el documento, retornar 0
      return res.status(200).json({
        monthId: monthId as string,
        totalEarnings: 0,
        paymentCount: 0,
      });
    }

    const data = adminMonthDoc.data();
    const totalEarnings = data?.totalEarnings || 0;
    const paymentCount = data?.paymentCount || 0;

    return res.status(200).json({
      monthId: monthId as string,
      totalEarnings,
      paymentCount,
    });
  } catch (error) {
    console.error("Error al obtener ganancias mensuales:", error);
    return res.status(500).json({ 
      error: "Error al obtener ganancias mensuales",
      detail: error instanceof Error ? error.message : String(error)
    });
  }
}

