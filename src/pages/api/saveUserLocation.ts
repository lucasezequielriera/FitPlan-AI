import type { NextApiRequest, NextApiResponse } from "next";
import { getDbSafe } from "@/lib/firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";

/**
 * API para guardar la ubicación del usuario (ciudad y país) basada en su IP
 * Se llama después del registro para capturar la ubicación inmediatamente
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: "userId es requerido" });
  }

  try {
    const db = getDbSafe();
    if (!db) {
      return res.status(500).json({ error: "Firestore no configurado" });
    }

    const userRef = doc(db, "usuarios", userId);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    // Verificar si ya tiene ubicación guardada
    const userData = userDoc.data();
    if (userData.ciudad && userData.pais) {
      return res.status(200).json({ 
        message: "Ubicación ya guardada",
        ciudad: userData.ciudad,
        pais: userData.pais
      });
    }

    // Obtener la IP del cliente
    const forwarded = req.headers["x-forwarded-for"];
    const ip = forwarded 
      ? (typeof forwarded === "string" ? forwarded.split(",")[0].trim() : forwarded[0])
      : req.headers["x-real-ip"] || req.socket.remoteAddress || "";

    const clientIp = typeof ip === "string" ? ip : (Array.isArray(ip) ? ip[0] : String(ip || req.socket.remoteAddress || ""));

    // Obtener ubicación usando ip-api.com
    let locationUrl = "http://ip-api.com/json/?fields=status,country,countryCode,city,regionName";
    if (clientIp && clientIp !== "unknown" && clientIp !== "::1" && typeof clientIp === "string" && !clientIp.startsWith("127.")) {
      locationUrl = `http://ip-api.com/json/${clientIp}?fields=status,country,countryCode,city,regionName`;
    }

    const locationResponse = await fetch(locationUrl);

    if (locationResponse.ok) {
      const locationData = await locationResponse.json();
      if (locationData.status === "success") {
        const updateData: Record<string, unknown> = {
          updatedAt: serverTimestamp(),
        };

        // Solo actualizar si no existe ya
        if (locationData.city && !userData.ciudad) {
          updateData.ciudad = locationData.city;
        }
        if (locationData.country && !userData.pais) {
          updateData.pais = locationData.country;
        }

        // Actualizar el documento
        await setDoc(userRef, updateData, { merge: true });

        console.log("✅ Ubicación del usuario guardada al registrarse:", { 
          userId, 
          ciudad: locationData.city, 
          pais: locationData.country 
        });

        return res.status(200).json({
          message: "Ubicación guardada exitosamente",
          ciudad: locationData.city || userData.ciudad,
          pais: locationData.country || userData.pais,
        });
      }
    }

    return res.status(200).json({
      message: "No se pudo obtener ubicación",
      ciudad: userData.ciudad || null,
      pais: userData.pais || null,
    });
  } catch (error) {
    console.error("Error al guardar ubicación del usuario:", error);
    return res.status(500).json({
      error: "Error al guardar ubicación",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}
