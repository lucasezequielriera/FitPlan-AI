import type { NextApiRequest, NextApiResponse } from "next";
import { getAdminDb } from "@/lib/firebase-admin";

/**
 * API para obtener el historial mensual de un usuario (solo admin)
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

    const { userId, adminUserId } = req.query;

    if (!userId || !adminUserId) {
      return res.status(400).json({ error: "Faltan parámetros: userId y adminUserId" });
    }

    // Verificar que el adminUserId es admin
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

    // Obtener todos los planes del usuario
    const plansSnapshot = await db.collection("planes")
      .where("userId", "==", userId)
      .orderBy("createdAt", "desc")
      .get();

    const plans = plansSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.() ? data.createdAt.toDate().toISOString() : null,
        updatedAt: data.updatedAt?.toDate?.() ? data.updatedAt.toDate().toISOString() : null,
        registrosPeso: data.registrosPeso || [], // Incluir registros de peso de cada plan
      };
    });

    // Consolidar todos los registros de peso de todos los planes
    const allWeightRecords: Array<{ fecha: string; peso: number; planId: string; planCreatedAt?: string }> = [];
    plans.forEach(plan => {
      if (plan.registrosPeso && Array.isArray(plan.registrosPeso)) {
        plan.registrosPeso.forEach((registro: { fecha?: string; peso?: number; timestamp?: unknown }) => {
          if (registro.fecha && registro.peso) {
            // Convertir timestamp a fecha si es necesario
            let fechaStr = registro.fecha;
            if (registro.timestamp) {
              let fecha: Date | null = null;
              if (registro.timestamp instanceof Date) {
                fecha = registro.timestamp;
              } else if (typeof registro.timestamp === 'object' && 'toDate' in registro.timestamp) {
                fecha = (registro.timestamp as { toDate: () => Date }).toDate();
              } else if (typeof registro.timestamp === 'object' && 'seconds' in registro.timestamp) {
                const ts = registro.timestamp as { seconds: number; nanoseconds?: number };
                fecha = new Date(ts.seconds * 1000 + (ts.nanoseconds || 0) / 1000000);
              }
              if (fecha) {
                const año = fecha.getFullYear();
                const mes = String(fecha.getMonth() + 1).padStart(2, '0');
                const dia = String(fecha.getDate()).padStart(2, '0');
                fechaStr = `${año}-${mes}-${dia}`;
              }
            }
            allWeightRecords.push({
              fecha: fechaStr,
              peso: registro.peso,
              planId: plan.id,
              planCreatedAt: plan.createdAt || undefined,
            });
          }
        });
      }
    });

    // Ordenar por fecha (más reciente primero) y eliminar duplicados (mantener el más reciente por fecha)
    const uniqueRecords = new Map<string, { fecha: string; peso: number; planId: string; planCreatedAt?: string }>();
    allWeightRecords
      .sort((a, b) => b.fecha.localeCompare(a.fecha))
      .forEach(record => {
        if (!uniqueRecords.has(record.fecha)) {
          uniqueRecords.set(record.fecha, record);
        }
      });
    
    const consolidatedWeightRecords = Array.from(uniqueRecords.values())
      .sort((a, b) => a.fecha.localeCompare(b.fecha)); // Ordenar cronológicamente para el gráfico

    // Obtener historial mensual del usuario
    const historyRef = db.collection("historial_mensual").doc(userId as string).collection("meses");
    const historySnapshot = await historyRef.orderBy("snapshotMonth", "desc").get();

    const history = historySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        snapshotMonth: data.snapshotMonth,
        ...data,
        createdAt: data.createdAt?.toDate?.() ? data.createdAt.toDate().toISOString() : null,
        planCreatedAt: data.planCreatedAt?.toDate?.() ? data.planCreatedAt.toDate().toISOString() : null,
      };
    });

    // Obtener datos del usuario
    const userRef = db.collection("usuarios").doc(userId as string);
    const userDoc = await userRef.get();
    const userData = userDoc.exists ? {
      id: userDoc.id,
      ...userDoc.data(),
      createdAt: userDoc.data()?.createdAt?.toDate?.() ? userDoc.data()?.createdAt.toDate().toISOString() : null,
      lastLogin: userDoc.data()?.lastLogin?.toDate?.() ? userDoc.data()?.lastLogin.toDate().toISOString() : null,
    } : null;

    return res.status(200).json({
      user: userData,
      plans,
      history,
      weightRecords: consolidatedWeightRecords, // Registros de peso consolidados
    });
  } catch (error) {
    console.error("Error al obtener historial del usuario:", error);
    return res.status(500).json({ 
      error: "Error al obtener historial",
      detail: error instanceof Error ? error.message : String(error)
    });
  }
}

