import type { NextApiRequest, NextApiResponse } from "next";
import { getDbSafe, getAuthSafe } from "@/lib/firebase";
import { doc, updateDoc, serverTimestamp, getDoc } from "firebase/firestore";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Verificar que el usuario esté autenticado y sea administrador
    const auth = getAuthSafe();
    if (!auth?.currentUser) {
      return res.status(401).json({ error: "No autenticado" });
    }

    const db = getDbSafe();
    if (!db) {
      return res.status(500).json({ error: "Firestore no configurado" });
    }

    // Verificar que el usuario es administrador
    const adminUserRef = doc(db, "usuarios", auth.currentUser.uid);
    const adminUserDoc = await getDoc(adminUserRef);
    
    if (!adminUserDoc.exists()) {
      return res.status(403).json({ error: "Acceso denegado" });
    }

    const adminUserData = adminUserDoc.data();
    const email = adminUserData.email?.toLowerCase() || "";
    const nombreLower = adminUserData.nombre?.toLowerCase() || "";
    const isAdmin = email === "admin@fitplan-ai.com" || nombreLower === "administrador";

    if (!isAdmin) {
      return res.status(403).json({ error: "Solo administradores pueden actualizar usuarios" });
    }

    const { userId, updates } = req.body;

    if (!userId || !updates) {
      return res.status(400).json({ error: "userId y updates son requeridos" });
    }

    const userRef = doc(db, "usuarios", userId);
    
    // Construir objeto de actualización
    const updateData: any = {
      updatedAt: serverTimestamp(),
    };

    // Solo actualizar campos que se proporcionan
    if (updates.nombre !== undefined) updateData.nombre = updates.nombre;
    if (updates.email !== undefined) updateData.email = updates.email;
    if (updates.premium !== undefined) {
      updateData.premium = Boolean(updates.premium);
      updateData.premiumStatus = updates.premium ? "active" : "inactive";
    }
    if (updates.sexo !== undefined) updateData.sexo = updates.sexo;
    if (updates.alturaCm !== undefined) updateData.alturaCm = Number(updates.alturaCm);
    if (updates.edad !== undefined) updateData.edad = Number(updates.edad);
    if (updates.peso !== undefined) updateData.peso = updates.peso ? Number(updates.peso) : null;
    if (updates.pesoObjetivo !== undefined) updateData.pesoObjetivo = updates.pesoObjetivo ? Number(updates.pesoObjetivo) : null;
    if (updates.cinturaCm !== undefined) updateData.cinturaCm = updates.cinturaCm ? Number(updates.cinturaCm) : null;
    if (updates.cuelloCm !== undefined) updateData.cuelloCm = updates.cuelloCm ? Number(updates.cuelloCm) : null;
    if (updates.caderaCm !== undefined) updateData.caderaCm = updates.caderaCm ? Number(updates.caderaCm) : null;
    if (updates.atletico !== undefined) updateData.atletico = Boolean(updates.atletico);

    await updateDoc(userRef, updateData);

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

