import type { NextApiRequest, NextApiResponse } from "next";
import { getAdminDb } from "@/lib/firebase-admin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Usar Firebase Admin SDK (bypass las reglas de Firestore)
    const db = getAdminDb();
    if (!db) {
      return res.status(500).json({ 
        error: "Firebase Admin SDK no configurado. Configura FIREBASE_ADMIN_PRIVATE_KEY y FIREBASE_ADMIN_CLIENT_EMAIL en las variables de entorno." 
      });
    }

    // Obtener el adminUserId del body (enviado desde el cliente)
    const { adminUserId, userId, updates, updateData } = req.body;

    if (!adminUserId) {
      return res.status(401).json({ error: "No se proporcionó adminUserId" });
    }

    // Verificar que el usuario es administrador usando Admin SDK
    const adminUserRef = db.collection("usuarios").doc(adminUserId);
    const adminUserDoc = await adminUserRef.get();
    
    if (!adminUserDoc.exists) {
      return res.status(403).json({ error: "Acceso denegado: usuario no encontrado" });
    }

    const adminUserData = adminUserDoc.data();
    const email = adminUserData?.email?.toLowerCase() || "";
    const nombreLower = adminUserData?.nombre?.toLowerCase() || "";
    const isAdmin = email === "admin@fitplan-ai.com" || nombreLower === "administrador";

    if (!isAdmin) {
      return res.status(403).json({ error: "Solo administradores pueden actualizar usuarios" });
    }

    // El parámetro puede venir como "updates" o "updateData"
    const dataToUpdate = updates || updateData;

    if (!userId) {
      return res.status(400).json({ error: "userId es requerido" });
    }

    if (!dataToUpdate) {
      return res.status(400).json({ error: "updateData es requerido" });
    }

    const userRef = db.collection("usuarios").doc(userId);
    
    // Construir objeto de actualización
    const updateFields: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    // Solo actualizar campos que se proporcionan
    if (dataToUpdate.nombre !== undefined) updateFields.nombre = dataToUpdate.nombre;
    if (dataToUpdate.email !== undefined) updateFields.email = dataToUpdate.email;
    if (dataToUpdate.premium !== undefined) {
      updateFields.premium = Boolean(dataToUpdate.premium);
      updateFields.premiumStatus = dataToUpdate.premium ? "active" : "inactive";
      
      // Si se está marcando como premium, establecer premiumSince
      if (dataToUpdate.premium) {
        // Si se proporciona premiumSince, usarlo; de lo contrario usar la fecha actual
        if (dataToUpdate.premiumSince) {
          updateFields.premiumSince = dataToUpdate.premiumSince;
        } else {
          // Verificar si el usuario ya tiene premiumSince antes de establecerlo
          const userDoc = await userRef.get();
          if (!userDoc.exists || !userDoc.data()?.premiumSince) {
            updateFields.premiumSince = new Date().toISOString();
          }
        }
      }
    }
    if (dataToUpdate.sexo !== undefined) updateFields.sexo = dataToUpdate.sexo;
    if (dataToUpdate.alturaCm !== undefined) updateFields.alturaCm = dataToUpdate.alturaCm ? Number(dataToUpdate.alturaCm) : null;
    if (dataToUpdate.edad !== undefined) updateFields.edad = dataToUpdate.edad ? Number(dataToUpdate.edad) : null;
    if (dataToUpdate.peso !== undefined) updateFields.peso = dataToUpdate.peso ? Number(dataToUpdate.peso) : null;
    if (dataToUpdate.pesoObjetivo !== undefined) updateFields.pesoObjetivo = dataToUpdate.pesoObjetivo ? Number(dataToUpdate.pesoObjetivo) : null;
    if (dataToUpdate.cinturaCm !== undefined) updateFields.cinturaCm = dataToUpdate.cinturaCm ? Number(dataToUpdate.cinturaCm) : null;
    if (dataToUpdate.cuelloCm !== undefined) updateFields.cuelloCm = dataToUpdate.cuelloCm ? Number(dataToUpdate.cuelloCm) : null;
    if (dataToUpdate.caderaCm !== undefined) updateFields.caderaCm = dataToUpdate.caderaCm ? Number(dataToUpdate.caderaCm) : null;
    if (dataToUpdate.atletico !== undefined) updateFields.atletico = Boolean(dataToUpdate.atletico);

    await userRef.update(updateFields);

    return res.status(200).json({ 
      success: true, 
      message: "Usuario actualizado correctamente" 
    });
  } catch (error: unknown) {
    console.error("Error al actualizar usuario:", error);
    const message = error instanceof Error ? error.message : "Error desconocido";
    return res.status(500).json({ error: "Error al actualizar usuario", detail: message });
  }
}

