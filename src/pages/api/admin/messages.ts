import type { NextApiRequest, NextApiResponse } from "next";
import { getAdminDb } from "@/lib/firebase-admin";

/**
 * API para obtener mensajes (solo admin)
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

    const { adminUserId } = req.query;

    if (!adminUserId) {
      return res.status(400).json({ error: "Falta adminUserId" });
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

    // Obtener todos los mensajes ordenados por fecha (más recientes primero)
    const messagesSnapshot = await db.collection("mensajes")
      .orderBy("createdAt", "desc")
      .limit(100)
      .get();

    const convertTimestamp = (timestamp: unknown): string | null => {
      if (!timestamp) return null;
      try {
        if (timestamp && typeof timestamp === 'object' && 'toDate' in timestamp && typeof timestamp.toDate === 'function') {
          return (timestamp as { toDate: () => Date }).toDate().toISOString();
        }
        if (timestamp && typeof timestamp === 'object' && 'seconds' in timestamp) {
          const ts = timestamp as { seconds: number; nanoseconds?: number };
          return new Date(ts.seconds * 1000 + (ts.nanoseconds || 0) / 1000000).toISOString();
        }
      } catch (error) {
        console.error("Error al convertir timestamp:", error);
      }
      return null;
    };

    const messages = messagesSnapshot.docs.map(doc => {
      const data = doc.data();
      const replies = data.replies || [];
      return {
        id: doc.id,
        userId: data.userId || null,
        userName: data.userName || null,
        userEmail: data.userEmail || null,
        subject: data.subject || "Consulta",
        message: data.message || "",
        read: data.read === true,
        replied: data.replied === true,
        replies: replies.map((reply: { message?: string; senderName?: string; senderType?: string; createdAt?: unknown }) => ({
          message: reply.message || "",
          senderName: reply.senderName || "Equipo de FitPlan",
          senderType: reply.senderType || "admin",
          createdAt: convertTimestamp(reply.createdAt),
        })),
        createdAt: convertTimestamp(data.createdAt),
        lastReplyAt: convertTimestamp(data.lastReplyAt),
      };
    });

    // Contar mensajes no leídos
    const unreadCount = messages.filter(m => !m.read).length;

    return res.status(200).json({
      messages,
      unreadCount,
    });
  } catch (error) {
    console.error("Error al obtener mensajes:", error);
    return res.status(500).json({ 
      error: "Error al obtener mensajes",
      detail: error instanceof Error ? error.message : String(error)
    });
  }
}

