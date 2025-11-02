import type { NextApiRequest, NextApiResponse } from "next";
import { getDbSafe, getAuthSafe } from "@/lib/firebase";
import { collection, getDocs, query, limit, doc, getDoc } from "firebase/firestore";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
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
      return res.status(403).json({ error: "Solo administradores pueden acceder" });
    }

    // Obtener todos los usuarios
    const usersQuery = query(collection(db, "usuarios"), limit(500));
    const usersSnapshot = await getDocs(usersQuery);

    const users = usersSnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        email: data.email || null,
        nombre: data.nombre || null,
        premium: data.premium === true,
        premiumStatus: data.premiumStatus || null,
        premiumSince: data.premiumSince || null,
        createdAt: data.createdAt || null,
        updatedAt: data.updatedAt || null,
        sexo: data.sexo || null,
        alturaCm: data.alturaCm || null,
        edad: data.edad || null,
        peso: data.peso || null,
        pesoObjetivo: data.pesoObjetivo || null,
        cinturaCm: data.cinturaCm || null,
        cuelloCm: data.cuelloCm || null,
        caderaCm: data.caderaCm || null,
        atletico: data.atletico || false,
        premiumPayment: data.premiumPayment || null,
      };
    });

    return res.status(200).json({ users });
  } catch (error: unknown) {
    console.error("Error al obtener usuarios:", error);
    const message = error instanceof Error ? error.message : "Error desconocido";
    return res.status(500).json({ error: "Error al obtener usuarios", detail: message });
  }
}

