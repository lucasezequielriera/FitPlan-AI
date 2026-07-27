import type { NextApiRequest, NextApiResponse } from "next";
import { getAdminDb, getAdminAuth } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/adminAuthServer";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const authResult = await requireAdmin(req);
    if (!authResult.ok) {
      return res.status(authResult.status).json({ error: authResult.error });
    }

    // Usar Firebase Admin SDK (bypass las reglas de Firestore)
    const db = getAdminDb();
    const auth = getAdminAuth();

    if (!db || !auth) {
      return res.status(500).json({
        error: "Firebase Admin SDK no configurado. Configura FIREBASE_ADMIN_PRIVATE_KEY y FIREBASE_ADMIN_CLIENT_EMAIL en las variables de entorno."
      });
    }

    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "userId es requerido" });
    }

    // Verificar que no se está intentando eliminar al admin
    if (userId === authResult.uid) {
      return res.status(400).json({ error: "No puedes eliminar tu propio usuario" });
    }

    // Obtener datos del usuario antes de eliminarlo (para verificar email)
    const userRef = db.collection("usuarios").doc(userId);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ error: "Usuario no encontrado en la base de datos" });
    }

    const userData = userDoc.data();
    const userEmail = userData?.email?.toLowerCase();
    
    // Verificar que no se elimine al admin
    if (userEmail === "admin@fitplan-ai.com") {
      return res.status(400).json({ error: "No se puede eliminar al usuario administrador" });
    }

    // 1. Eliminar todos los planes asociados al usuario
    try {
      const plansSnapshot = await db.collection("planes")
        .where("userId", "==", userId)
        .get();
      
      const deletePlanPromises = plansSnapshot.docs.map(doc => doc.ref.delete());
      await Promise.all(deletePlanPromises);
      console.log(`✅ ${plansSnapshot.docs.length} plan(es) eliminado(s)`);
    } catch (error) {
      console.error("Error al eliminar planes:", error);
      // Continuar aunque falle, para intentar eliminar el resto
    }

    // 2. Eliminar el documento del usuario en Firestore
    try {
      await userRef.delete();
      console.log("✅ Documento de usuario eliminado de Firestore");
    } catch (error) {
      console.error("Error al eliminar documento de usuario:", error);
      return res.status(500).json({ error: "Error al eliminar documento de usuario", detail: error instanceof Error ? error.message : "Error desconocido" });
    }

    // 3. Eliminar el usuario de Firebase Auth
    try {
      await auth.deleteUser(userId);
      console.log("✅ Usuario eliminado de Firebase Auth");
    } catch (error: unknown) {
      console.error("Error al eliminar usuario de Auth:", error);
      // Si el usuario no existe en Auth, no es un error crítico
      const errorMessage = error instanceof Error ? error.message : "Error desconocido";
      if (!errorMessage.includes("not found")) {
        return res.status(500).json({ error: "Error al eliminar usuario de Auth", detail: errorMessage });
      }
    }

    return res.status(200).json({ 
      success: true, 
      message: "Usuario eliminado correctamente" 
    });
  } catch (error: unknown) {
    console.error("Error al eliminar usuario:", error);
    const message = error instanceof Error ? error.message : "Error desconocido";
    return res.status(500).json({ error: "Error al eliminar usuario", detail: message });
  }
}

