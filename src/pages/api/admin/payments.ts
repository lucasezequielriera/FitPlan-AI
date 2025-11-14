import type { NextApiRequest, NextApiResponse } from "next";
import { getAdminDb } from "@/lib/firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

interface Payment {
  userId: string;
  amount: number;
  currency: string;
  date: Date | Timestamp;
  planType: "monthly" | "quarterly" | "annual";
  expiresAt: Date | Timestamp;
  status: "approved" | "pending" | "cancelled";
  paymentId?: string | null;
  mercadopagoPaymentId?: string | null;
  paymentMethod: "mercadopago" | "transferencia" | "efectivo" | "otro";
  isManual: boolean;
  createdBy?: string;
  notes?: string;
  createdAt: Date | Timestamp;
  updatedAt: Date | Timestamp;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    // Obtener pagos de un usuario
    try {
      const db = getAdminDb();
      if (!db) {
        return res.status(500).json({ error: "Firebase Admin SDK no configurado" });
      }

      const { userId, adminUserId } = req.query;

      if (!userId || !adminUserId) {
        return res.status(400).json({ error: "Faltan parámetros: userId y adminUserId" });
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

      // Obtener pagos del usuario desde la colección pagos
      const paymentsRef = db.collection("pagos");
      // Nota: orderBy requiere un índice compuesto si se usa con where
      // Por ahora, obtenemos todos y ordenamos en memoria
      const paymentsQuery = await paymentsRef.where("userId", "==", userId).get();

      const payments = paymentsQuery.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          date: convertTimestamp(data.date),
          expiresAt: data.expiresAt ? convertTimestamp(data.expiresAt) : null,
          createdAt: convertTimestamp(data.createdAt),
          updatedAt: convertTimestamp(data.updatedAt),
        };
      });

      // Ordenar por fecha (más reciente primero)
      payments.sort((a, b) => {
        const dateA = a.date instanceof Date ? a.date.getTime() : new Date(a.date as string).getTime();
        const dateB = b.date instanceof Date ? b.date.getTime() : new Date(b.date as string).getTime();
        return dateB - dateA;
      });

      return res.status(200).json({ payments });
    } catch (error) {
      console.error("Error al obtener pagos:", error);
      return res.status(500).json({ 
        error: "Error al obtener pagos",
        detail: error instanceof Error ? error.message : String(error)
      });
    }
  } else if (req.method === "POST") {
    // Crear un pago manual
    try {
      const db = getAdminDb();
      if (!db) {
        return res.status(500).json({ error: "Firebase Admin SDK no configurado" });
      }

      const { adminUserId, userId, amount, planType, date, paymentMethod, notes } = req.body;

      if (!adminUserId || !userId || !amount || !planType || !date || !paymentMethod) {
        return res.status(400).json({ error: "Faltan parámetros requeridos" });
      }

      // Verificar que el usuario es administrador
      const adminUserRef = db.collection("usuarios").doc(adminUserId);
      const adminUserDoc = await adminUserRef.get();
      
      if (!adminUserDoc.exists) {
        return res.status(403).json({ error: "Admin no encontrado" });
      }

      const adminUserData = adminUserDoc.data();
      const email = adminUserData?.email?.toLowerCase() || "";
      const isAdmin = email === "admin@fitplan-ai.com";

      if (!isAdmin) {
        return res.status(403).json({ error: "Solo administradores pueden crear pagos" });
      }

      // Verificar que el usuario existe
      const userRef = db.collection("usuarios").doc(userId);
      const userDoc = await userRef.get();
      
      if (!userDoc.exists) {
        return res.status(404).json({ error: "Usuario no encontrado" });
      }

      // Calcular fecha de vencimiento según el tipo de plan
      const paymentDate = new Date(date);
      const expiresAt = new Date(paymentDate);
      
      switch (planType) {
        case "monthly":
          expiresAt.setMonth(expiresAt.getMonth() + 1);
          break;
        case "quarterly":
          expiresAt.setMonth(expiresAt.getMonth() + 3);
          break;
        case "annual":
          expiresAt.setFullYear(expiresAt.getFullYear() + 1);
          break;
        default:
          expiresAt.setMonth(expiresAt.getMonth() + 1);
      }

      // Generar ID único para el pago manual
      const paymentId = `manual-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Crear el pago en la colección pagos
      const paymentData: Payment = {
        userId,
        amount: Number(amount),
        currency: "ARS",
        date: Timestamp.fromDate(paymentDate),
        planType,
        expiresAt: Timestamp.fromDate(expiresAt),
        status: "approved",
        paymentId,
        paymentMethod,
        isManual: true,
        createdBy: adminUserId,
        notes: notes || null,
        createdAt: FieldValue.serverTimestamp() as Timestamp,
        updatedAt: FieldValue.serverTimestamp() as Timestamp,
      };

      const paymentsRef = db.collection("pagos");
      const newPaymentRef = await paymentsRef.add(paymentData);

      // Actualizar el usuario con los datos premium
      const wasPremium = userDoc.data()?.premium === true;
      
      const userUpdateData: Record<string, unknown> = {
        premium: true,
        premiumStatus: "active",
        premiumLastPay: Timestamp.fromDate(paymentDate),
        premiumExpiresAt: Timestamp.fromDate(expiresAt),
        premiumPlanType: planType,
        updatedAt: FieldValue.serverTimestamp(),
      };

      if (!wasPremium) {
        userUpdateData.premiumSince = FieldValue.serverTimestamp();
      }

      await userRef.update(userUpdateData);

      // Obtener el pago creado para retornarlo
      const createdPaymentDoc = await newPaymentRef.get();
      const createdPaymentData = createdPaymentDoc.data();
      if (!createdPaymentData) {
        return res.status(500).json({ error: "Error al obtener el pago creado" });
      }
      const createdPayment = {
        id: createdPaymentDoc.id,
        ...createdPaymentData,
        date: convertTimestamp(createdPaymentData.date),
        expiresAt: createdPaymentData.expiresAt ? convertTimestamp(createdPaymentData.expiresAt) : null,
        createdAt: convertTimestamp(createdPaymentData.createdAt),
        updatedAt: convertTimestamp(createdPaymentData.updatedAt),
      };

      return res.status(200).json({ 
        success: true, 
        payment: createdPayment,
        message: "Pago manual creado exitosamente" 
      });
    } catch (error) {
      console.error("Error al crear pago manual:", error);
      return res.status(500).json({ 
        error: "Error al crear pago manual",
        detail: error instanceof Error ? error.message : String(error)
      });
    }
  } else {
    return res.status(405).json({ error: "Method not allowed" });
  }
}

function convertTimestamp(timestamp: unknown): Date {
  if (!timestamp) return new Date();
  
  if (timestamp instanceof Date) {
    return timestamp;
  }
  
  if (typeof timestamp === 'string') {
    return new Date(timestamp);
  }
  
  if (typeof timestamp === 'object' && 'toDate' in timestamp) {
    return (timestamp as { toDate: () => Date }).toDate();
  }
  
  if (typeof timestamp === 'object' && 'seconds' in timestamp) {
    const ts = timestamp as { seconds: number; nanoseconds?: number };
    return new Date(ts.seconds * 1000 + (ts.nanoseconds || 0) / 1000000);
  }
  
  return new Date();
}

