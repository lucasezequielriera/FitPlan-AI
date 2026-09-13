import type { NextApiRequest, NextApiResponse } from "next";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireUser } from "@/lib/userAuthServer";

function isQuotaError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error || "");
  const normalized = msg.toUpperCase();
  return normalized.includes("RESOURCE_EXHAUSTED") || normalized.includes("QUOTA EXCEEDED");
}

/**
 * API para que usuarios obtengan sus mensajes
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

    // La identidad sale del ID token verificado, NUNCA de la URL. Antes bastaba
    // con poner el UID de otra persona en `?userId=` para leer sus mensajes
    // completos con el admin, incluidas las respuestas: privacidad, no solo
    // integridad (issue #27-ter). Es la tercera forma del mismo patrón, después
    // de #27 y #27-bis — esta, en lectura.
    const auth = await requireUser(req);
    if (!auth.ok) return res.status(auth.status).json({ error: "Identidad no verificada" });
    const userId = auth.uid;

    // Obtener todos los mensajes del usuario
    // Nota: No usamos orderBy aquí porque requiere un índice compuesto con where
    // En su lugar, ordenamos en memoria después
    const messagesSnapshot = await db.collection("mensajes")
      .where("userId", "==", userId)
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
        subject: data.subject || "Consulta",
        message: data.message || "",
        userName: data.userName || null, // Nombre del usuario que envió el mensaje
        replied: data.replied === true,
        closed: data.closed === true,
        closedAt: convertTimestamp(data.closedAt),
        replies: replies.map((reply: { message?: string; senderName?: string; senderType?: string; createdAt?: unknown }) => ({
          message: reply.message || "",
          senderName: reply.senderName || (reply.senderType === "admin" ? "Equipo de FitPlan" : "Usuario"),
          senderType: reply.senderType || "user",
          createdAt: convertTimestamp(reply.createdAt),
        })),
        createdAt: convertTimestamp(data.createdAt),
        lastReplyAt: convertTimestamp(data.lastReplyAt),
        userRead: data.userRead !== false, // Si no existe, asumir que está leído
      };
    });

    // Ordenar por fecha de creación (más recientes primero) en memoria
    messages.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA; // Orden descendente
    });

    // Contar mensajes con respuestas no leídas sobre todos los mensajes
    // (no solo los 50 visibles) para que el icono del navbar sea confiable.
    const unreadRepliesCount = messages.filter(m => m.replied && !m.userRead).length;

    // Limitar a 50 mensajes más recientes para la lista visible
    const limitedMessages = messages.slice(0, 50);

    return res.status(200).json({
      messages: limitedMessages,
      unreadRepliesCount,
    });
  } catch (error) {
    if (isQuotaError(error)) {
      return res.status(200).json({
        messages: [],
        unreadRepliesCount: 0,
        degraded: true,
        warning: "No se pudieron cargar mensajes temporalmente por límite de cuota.",
      });
    }
    console.error("Error al obtener mensajes del usuario:", error);
    return res.status(500).json({ 
      error: "Error al obtener mensajes",
      detail: error instanceof Error ? error.message : String(error)
    });
  }
}

