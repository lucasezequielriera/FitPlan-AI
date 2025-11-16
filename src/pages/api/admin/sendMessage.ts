import type { NextApiRequest, NextApiResponse } from "next";
import { getAdminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

/**
 * API para que el admin envíe mensajes directamente a usuarios
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

    const { adminUserId, targetUserId, subject, message } = req.body;

    if (!adminUserId || !targetUserId || !message) {
      return res.status(400).json({ error: "Faltan datos requeridos: adminUserId, targetUserId y message" });
    }

    // Verificar que el adminUserId es realmente un admin
    const adminUserRef = db.collection("usuarios").doc(adminUserId);
    const adminUserDoc = await adminUserRef.get();
    
    if (!adminUserDoc.exists) {
      return res.status(403).json({ error: "Admin no encontrado" });
    }

    const adminUserData = adminUserDoc.data();
    const email = adminUserData?.email?.toLowerCase() || "";
    const isAdmin = email === "admin@fitplan-ai.com";

    if (!isAdmin) {
      return res.status(403).json({ error: "Solo administradores pueden enviar mensajes" });
    }

    // Obtener datos del usuario destino
    const targetUserRef = db.collection("usuarios").doc(targetUserId);
    const targetUserDoc = await targetUserRef.get();
    
    if (!targetUserDoc.exists) {
      return res.status(404).json({ error: "Usuario destino no encontrado" });
    }

    const targetUserData = targetUserDoc.data();
    const targetUserName = targetUserData?.nombre || null;
    const targetUserEmail = targetUserData?.email || null;

    // Crear mensaje donde el admin inicia la conversación
    // El mensaje se crea como si el usuario lo hubiera enviado, pero con una respuesta inicial del admin
    const messageData = {
      userId: targetUserId,
      userName: targetUserName,
      userEmail: targetUserEmail,
      subject: subject || "Mensaje del equipo",
      message: "Iniciado por el administrador", // Mensaje placeholder
      read: true, // El admin ya lo leyó (él lo creó)
      replied: true, // Ya tiene una respuesta (la del admin)
      closed: false,
      initiatedByAdmin: true, // Marcar que fue iniciado por el admin
      replies: [{
        message: message.trim(),
        senderName: "Equipo de FitPlan",
        senderType: "admin",
        createdAt: new Date(),
      }],
      userRead: false, // El usuario aún no ha leído
      createdAt: FieldValue.serverTimestamp(),
      lastReplyAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    const messageRef = await db.collection("mensajes").add(messageData);

    return res.status(200).json({ 
      message: "Mensaje enviado exitosamente",
      id: messageRef.id
    });
  } catch (error) {
    console.error("Error al enviar mensaje:", error);
    return res.status(500).json({ 
      error: "Error al enviar mensaje",
      detail: error instanceof Error ? error.message : String(error)
    });
  }
}

