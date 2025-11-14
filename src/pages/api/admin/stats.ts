import type { NextApiRequest, NextApiResponse } from "next";
import { getAdminDb } from "@/lib/firebase-admin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Obtener el userId del query parameter
    const userId = req.query.userId as string;
    
    if (!userId) {
      return res.status(401).json({ error: "No se proporcionó userId" });
    }

    // Usar Firebase Admin SDK (bypass las reglas de Firestore)
    const db = getAdminDb();
    if (!db) {
      console.error("❌ Firebase Admin SDK no configurado. Variables faltantes:", {
        hasPrivateKey: !!process.env.FIREBASE_ADMIN_PRIVATE_KEY,
        hasClientEmail: !!process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        hasProjectId: !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      });
      return res.status(500).json({ 
        error: "Firebase Admin SDK no configurado",
        detail: "Configura las siguientes variables de entorno en Vercel: FIREBASE_ADMIN_PRIVATE_KEY, FIREBASE_ADMIN_CLIENT_EMAIL, y NEXT_PUBLIC_FIREBASE_PROJECT_ID. Obtén estas credenciales desde Firebase Console > Project Settings > Service Accounts."
      });
    }

    // Verificar que el usuario es administrador usando Admin SDK
    const adminUserRef = db.collection("usuarios").doc(userId);
    const adminUserDoc = await adminUserRef.get();
    
    if (!adminUserDoc.exists) {
      return res.status(403).json({ error: "Usuario no encontrado" });
    }

    const adminUserData = adminUserDoc.data();
    const email = adminUserData?.email?.toLowerCase() || "";
    const isAdmin = email === "admin@fitplan-ai.com";

    if (!isAdmin) {
      return res.status(403).json({ error: "Solo administradores pueden acceder" });
    }

    // Obtener todos los usuarios usando Admin SDK (sin restricciones de reglas)
    const usersSnapshot = await db.collection("usuarios").limit(1000).get();

    // Función auxiliar para convertir timestamps de Firestore Admin a formato serializable
    const convertTimestamp = (timestamp: unknown): unknown => {
      if (!timestamp) return null;
      
      // Firebase Admin SDK Timestamp tiene métodos toDate() y toMillis()
      if (timestamp && typeof timestamp === 'object') {
        if ('toDate' in timestamp && typeof timestamp.toDate === 'function') {
          return (timestamp as { toDate: () => Date }).toDate().toISOString();
        }
        if ('toMillis' in timestamp && typeof timestamp.toMillis === 'function') {
          return new Date((timestamp as { toMillis: () => number }).toMillis()).toISOString();
        }
        // Si tiene seconds y nanoseconds (formato Timestamp)
        if ('seconds' in timestamp) {
          const ts = timestamp as { seconds: number; nanoseconds?: number };
          return new Date(ts.seconds * 1000 + (ts.nanoseconds || 0) / 1000000).toISOString();
        }
      }
      
      return timestamp;
    };

    // Obtener todos los pagos de una vez para optimizar
    const paymentsSnapshot = await db.collection("pagos").get();
    const paymentsByUserId = new Map<string, Array<{
      id: string;
      amount: number;
      currency: string;
      date: unknown;
      planType: string;
      expiresAt: unknown;
      status: string;
      paymentMethod: string;
      isManual: boolean;
    }>>();
    
    paymentsSnapshot.docs.forEach((doc) => {
      const paymentData = doc.data();
      const userId = paymentData.userId;
      if (userId) {
        if (!paymentsByUserId.has(userId)) {
          paymentsByUserId.set(userId, []);
        }
        paymentsByUserId.get(userId)!.push({
          id: doc.id,
          amount: paymentData.amount || 0,
          currency: paymentData.currency || "ARS",
          date: paymentData.date,
          planType: paymentData.planType || "monthly",
          expiresAt: paymentData.expiresAt,
          status: paymentData.status || "approved",
          paymentMethod: paymentData.paymentMethod || "mercadopago",
          isManual: paymentData.isManual || false,
        });
      }
    });
    
    // Ordenar pagos por fecha (más reciente primero) para cada usuario
    paymentsByUserId.forEach((payments) => {
      payments.sort((a, b) => {
        const dateA = convertTimestamp(a.date);
        const dateB = convertTimestamp(b.date);
        const timeA = dateA instanceof Date ? dateA.getTime() : (typeof dateA === 'string' ? new Date(dateA).getTime() : 0);
        const timeB = dateB instanceof Date ? dateB.getTime() : (typeof dateB === 'string' ? new Date(dateB).getTime() : 0);
        return timeB - timeA;
      });
    });

    const users = usersSnapshot.docs.map((docSnapshot) => {
      const data = docSnapshot.data();
      const userId = docSnapshot.id;
      
      // Obtener el último pago desde la colección pagos
      const userPayments = paymentsByUserId.get(userId) || [];
      const lastPayment = userPayments.length > 0 ? userPayments[0] : null;
      
      // Si hay un último pago, usar esos datos; si no, usar los datos del usuario como fallback
      const premiumLastPay = lastPayment ? convertTimestamp(lastPayment.date) : convertTimestamp(data.premiumLastPay);
      const premiumExpiresAt = lastPayment ? convertTimestamp(lastPayment.expiresAt) : convertTimestamp(data.premiumExpiresAt);
      const premiumPlanType = lastPayment ? lastPayment.planType : (data.premiumPlanType || null);
      const premiumPayment = lastPayment ? {
        paymentId: lastPayment.id,
        amount: lastPayment.amount,
        currency: lastPayment.currency,
        date: premiumLastPay,
        method: lastPayment.paymentMethod,
        status: lastPayment.status,
        planType: lastPayment.planType,
      } : (data.premiumPayment || null);
      
      return {
        id: userId,
        email: data.email || null,
        nombre: data.nombre || null,
        premium: data.premium === true,
        premiumStatus: data.premiumStatus || null,
        premiumSince: convertTimestamp(data.premiumSince),
        premiumLastPay,
        createdAt: convertTimestamp(data.createdAt),
        updatedAt: convertTimestamp(data.updatedAt),
        sexo: data.sexo || null,
        alturaCm: data.alturaCm || null,
        edad: data.edad || null,
        peso: data.peso || null,
        pesoObjetivo: data.pesoObjetivo || null,
        cinturaCm: data.cinturaCm || null,
        cuelloCm: data.cuelloCm || null,
        caderaCm: data.caderaCm || null,
        atletico: data.atletico || false,
        premiumPayment,
        premiumExpiresAt,
        premiumPlanType,
        ciudad: data.ciudad || null,
        pais: data.pais || null,
      };
    });

    // Calcular estadísticas (excluyendo al admin)
    let total = 0;
    let premium = 0;
    let regular = 0;
    let athletic = 0;

    users.forEach((user) => {
      // Excluir al admin del conteo
      const email = user.email?.toLowerCase() || "";
      if (email === "admin@fitplan-ai.com") {
        return; // Saltar el admin
      }
      
      total++; // Contar solo usuarios que no son admin
      
      if (user.premium) {
        premium++;
      } else {
        regular++;
      }
      if (user.atletico) athletic++;
    });

    return res.status(200).json({ 
      stats: {
        total,
        premium,
        regular,
        athletic,
      },
      users 
    });
  } catch (error: unknown) {
    console.error("Error al obtener estadísticas:", error);
    const message = error instanceof Error ? error.message : "Error desconocido";
    return res.status(500).json({ error: "Error al obtener estadísticas", detail: message });
  }
}

