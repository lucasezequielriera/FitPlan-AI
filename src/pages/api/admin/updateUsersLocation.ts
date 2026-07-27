import type { NextApiRequest, NextApiResponse } from "next";
import { getAdminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireAdmin } from "@/lib/adminAuthServer";

/**
 * API para actualizar la ubicación de usuarios existentes que no tienen país guardado
 * Solo puede ser ejecutado por administradores
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) {
      return res.status(auth.status).json({ error: auth.error });
    }

    const db = getAdminDb();
    if (!db) {
      return res.status(500).json({ error: "Firebase Admin SDK no configurado" });
    }

    const { userId } = req.body;

    // Si se proporciona un userId específico, actualizar solo ese usuario
    if (userId) {
      const userRef = db.collection("usuarios").doc(userId);
      const userDoc = await userRef.get();
      
      if (!userDoc.exists) {
        return res.status(404).json({ error: "Usuario no encontrado" });
      }

      const userData = userDoc.data();
      
      // Si ya tiene país, no hacer nada
      if (userData?.pais) {
        return res.status(200).json({
          message: "Usuario ya tiene país guardado",
          pais: userData.pais,
          ciudad: userData.ciudad || null,
        });
      }

      // Intentar obtener ubicación (nota: esto no funcionará bien sin la IP original)
      // Por ahora, retornar que no se puede actualizar sin IP
      return res.status(200).json({
        message: "No se puede actualizar ubicación sin la IP original del registro. El país solo se captura al momento del registro.",
        warning: "Los usuarios existentes sin país no pueden ser actualizados automáticamente.",
      });
    }

    // Si no se proporciona userId, contar usuarios sin país
    const usersSnapshot = await db.collection("usuarios")
      .where("pais", "==", null)
      .get();

    const usersWithoutCountry = usersSnapshot.size;

    return res.status(200).json({
      message: "Consulta completada",
      usuariosSinPais: usersWithoutCountry,
      nota: "Los usuarios existentes sin país no pueden ser actualizados automáticamente porque no tenemos su IP original. Solo los nuevos registros capturarán el país automáticamente.",
    });
  } catch (error) {
    console.error("Error al actualizar ubicación de usuarios:", error);
    return res.status(500).json({
      error: "Error al actualizar ubicación",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}
