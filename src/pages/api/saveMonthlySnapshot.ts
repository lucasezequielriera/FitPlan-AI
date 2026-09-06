import type { NextApiRequest, NextApiResponse } from "next";
import { getAdminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { requirePlanAccess, authFailureMessage } from "@/lib/userAuthServer";

/**
 * API para guardar un snapshot mensual del plan de un usuario
 * Se llama automáticamente cuando un plan cumple 30 días o manualmente desde el admin
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { planId, planData, userData } = req.body;

  if (!planId || !planData) {
    return res.status(400).json({ error: "Faltan datos requeridos: planId, planData" });
  }

  // Pasa el dueño del plan o el admin (el admin dispara snapshots desde su
  // panel). El UID ya no llega del body: el snapshot se archiva bajo el dueño
  // real del plan, así que un tercero no puede escribir en el historial ajeno
  // ni desviar el suyo a la carpeta de otro.
  const access = await requirePlanAccess(req, planId);
  if (!access.ok) {
    if (access.code === "unconfigured") {
      // Se mantiene el éxito silencioso de antes: esta funcionalidad es
      // opcional y no debe romper el flujo del usuario en un entorno sin
      // Firebase Admin configurado.
      console.warn("⚠️ Firebase Admin SDK no configurado, snapshot mensual no se guardará");
      return res.status(200).json({
        message: "Snapshot mensual omitido (Firebase Admin no configurado)",
        skipped: true,
      });
    }
    return res.status(access.status).json({ error: authFailureMessage(access.code) });
  }

  const planOriginal = access.planData;
  const userId = planOriginal.userId as string;

  try {
    const db = getAdminDb();
    if (!db) {
      console.warn("⚠️ Firebase Admin SDK no configurado, snapshot mensual no se guardará");
      return res.status(200).json({
        message: "Snapshot mensual omitido (Firebase Admin no configurado)",
        skipped: true,
      });
    }

    const createdAt = planOriginal?.createdAt;
    
    // Calcular mes-año del snapshot (basado en cuando se creó el plan)
    let snapshotMonth: string;
    let planCreatedDate: Date;
    
    if (createdAt) {
      if (createdAt && typeof createdAt === 'object' && 'toDate' in createdAt) {
        planCreatedDate = (createdAt as { toDate: () => Date }).toDate();
      } else if (createdAt && typeof createdAt === 'object' && 'seconds' in createdAt) {
        const ts = createdAt as { seconds: number; nanoseconds?: number };
        planCreatedDate = new Date(ts.seconds * 1000 + (ts.nanoseconds || 0) / 1000000);
      } else if (typeof createdAt === 'string') {
        planCreatedDate = new Date(createdAt);
      } else {
        planCreatedDate = new Date();
      }
      snapshotMonth = `${planCreatedDate.getFullYear()}-${String(planCreatedDate.getMonth() + 1).padStart(2, '0')}`;
    } else {
      // Si no hay fecha, usar el mes actual
      const now = new Date();
      planCreatedDate = now;
      snapshotMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }

    // Función helper para limpiar valores undefined
    const cleanObject = (obj: Record<string, any>): Record<string, any> => {
      const cleaned: Record<string, any> = {};
      for (const [key, value] of Object.entries(obj)) {
        if (value !== undefined) {
          if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
            cleaned[key] = cleanObject(value);
          } else {
            cleaned[key] = value;
          }
        }
      }
      return cleaned;
    };

    // Datos del snapshot mensual (filtrar undefined)
    const snapshotDataRaw = {
      userId,
      planId,
      snapshotMonth,
      plan: planData,
      user: userData || planOriginal?.plan?.user || {},
      // Datos del plan al momento del snapshot
      calorias_diarias: planData?.calorias_diarias || planOriginal?.plan?.plan?.calorias_diarias,
      macros: planData?.macros || planOriginal?.plan?.plan?.macros,
      objetivo: userData?.objetivo || planOriginal?.plan?.user?.objetivo,
      intensidad: userData?.intensidad || planOriginal?.plan?.user?.intensidad,
      tipoDieta: userData?.tipoDieta || planOriginal?.plan?.user?.tipoDieta,
      pesoInicial: userData?.peso || planOriginal?.plan?.user?.pesoKg,
      pesoObjetivo: userData?.pesoObjetivo || planOriginal?.plan?.user?.pesoObjetivo,
      diasGym: planData?.training_plan?.weeks?.[0]?.days?.length || 0,
      minutosSesion: planData?.minutos_sesion_gym || planOriginal?.plan?.plan?.minutos_sesion_gym,
      // Timestamps
      createdAt: FieldValue.serverTimestamp(),
      planCreatedAt: planCreatedDate,
    };

    // Limpiar valores undefined antes de guardar
    const snapshotData = cleanObject(snapshotDataRaw);

    // Guardar en historial_mensual/{userId}/{mes-año}
    const historyRef = db.collection("historial_mensual").doc(userId).collection("meses").doc(snapshotMonth);
    
    // Verificar si ya existe un snapshot para este mes
    const existingSnapshot = await historyRef.get();
    if (existingSnapshot.exists) {
      // Actualizar el snapshot existente
      await historyRef.update(snapshotData);
      return res.status(200).json({ 
        message: "Snapshot mensual actualizado",
        snapshotMonth,
        id: historyRef.id
      });
    } else {
      // Crear nuevo snapshot
      await historyRef.set(snapshotData);
      return res.status(200).json({ 
        message: "Snapshot mensual guardado",
        snapshotMonth,
        id: historyRef.id
      });
    }
  } catch (error) {
    console.error("Error al guardar snapshot mensual:", error);
    return res.status(500).json({ 
      error: "Error al guardar snapshot mensual",
      detail: error instanceof Error ? error.message : String(error)
    });
  }
}

