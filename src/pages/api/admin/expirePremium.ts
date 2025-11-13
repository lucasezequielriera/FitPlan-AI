import type { NextApiRequest, NextApiResponse } from "next";
import { getAdminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

/**
 * API para desactivar automáticamente el premium de usuarios vencidos
 * Se llama desde el admin panel para mantener la integridad de los datos
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const db = getAdminDb();
    if (!db) {
      return res.status(500).json({ error: "Firebase Admin SDK no configurado" });
    }

    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "userId es requerido" });
    }

    const userRef = db.collection("usuarios").doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const userData = userDoc.data();
    
    // Verificar si el usuario es premium
    if (!userData?.premium) {
      return res.status(200).json({ 
        message: "Usuario no es premium",
        expired: false
      });
    }

    // Obtener fecha de vencimiento
    let expiresAt: Date | null = null;
    if (userData.premiumExpiresAt) {
      if (userData.premiumExpiresAt instanceof Date) {
        expiresAt = userData.premiumExpiresAt;
      } else if (userData.premiumExpiresAt && typeof userData.premiumExpiresAt === 'object' && 'toDate' in userData.premiumExpiresAt) {
        expiresAt = (userData.premiumExpiresAt as { toDate: () => Date }).toDate();
      } else if (userData.premiumExpiresAt && typeof userData.premiumExpiresAt === 'object' && 'seconds' in userData.premiumExpiresAt) {
        const ts = userData.premiumExpiresAt as { seconds: number; nanoseconds?: number };
        expiresAt = new Date(ts.seconds * 1000 + (ts.nanoseconds || 0) / 1000000);
      } else if (typeof userData.premiumExpiresAt === 'string') {
        expiresAt = new Date(userData.premiumExpiresAt);
      }
    }

    const now = new Date();

    // Si no hay fecha de vencimiento o ya venció, desactivar premium
    if (!expiresAt || expiresAt.getTime() < now.getTime()) {
      await userRef.update({
        premium: false,
        premiumStatus: "expired",
        updatedAt: FieldValue.serverTimestamp(),
      });

      console.log(`✅ Premium desactivado para usuario ${userId} - Plan vencido`);
      
      return res.status(200).json({ 
        message: "Premium desactivado - Plan vencido",
        expired: true,
        expiresAt: expiresAt ? expiresAt.toISOString() : null
      });
    }

    return res.status(200).json({ 
      message: "Premium aún vigente",
      expired: false,
      expiresAt: expiresAt.toISOString()
    });
  } catch (error) {
    console.error("Error al verificar/desactivar premium vencido:", error);
    return res.status(500).json({ 
      error: "Error al verificar premium vencido",
      detail: error instanceof Error ? error.message : String(error)
    });
  }
}

