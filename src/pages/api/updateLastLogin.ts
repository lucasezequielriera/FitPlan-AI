import type { NextApiRequest, NextApiResponse } from "next";
import { getAdminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireUser, authFailureMessage } from "@/lib/userAuthServer";

function isQuotaError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error || "");
  const normalized = msg.toUpperCase();
  return normalized.includes("RESOURCE_EXHAUSTED") || normalized.includes("QUOTA EXCEEDED");
}

/**
 * API para actualizar la última vez que el usuario se conectó
 * Se llama automáticamente cuando el usuario accede a la app
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Marca la última conexión de quien llama, resuelta desde el ID token: antes
  // se podía falsear la actividad de cualquier cuenta mandando su UID.
  const auth = await requireUser(req);
  if (!auth.ok) {
    return res.status(auth.status).json({ error: authFailureMessage(auth.code) });
  }
  const userId = auth.uid;

  try {
    const db = getAdminDb();
    if (!db) {
      return res.status(500).json({ error: "Firebase Admin SDK no configurado" });
    }

    const userRef = db.collection("usuarios").doc(userId);

    // Verificar que el documento existe
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const userData = userDoc.data();
    if (!userData) {
      return res.status(404).json({ error: "Datos del usuario no encontrados" });
    }

    const updateData: Record<string, unknown> = {
      lastLogin: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    // Si el usuario no tiene país guardado, intentar obtenerlo ahora
    if (!userData.pais) {
      try {
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
            if (locationData.city && !userData.ciudad) {
              updateData.ciudad = locationData.city;
            }
            if (locationData.country) {
              updateData.pais = locationData.country;
            }
            console.log(`✅ Ubicación capturada para usuario existente ${userId}:`, { 
              ciudad: locationData.city, 
              pais: locationData.country 
            });
          }
        }
      } catch (locationError) {
        console.warn(`⚠️ No se pudo obtener ubicación para usuario ${userId}:`, locationError);
        // No bloquear la actualización de lastLogin si falla obtener la ubicación
      }
    }

    // Actualizar lastLogin (y ubicación si se obtuvo)
    await userRef.update(updateData);

    console.log(`✅ lastLogin actualizado para usuario ${userId}`);
    return res.status(200).json({ success: true });
  } catch (error) {
    if (isQuotaError(error)) {
      return res.status(200).json({
        success: false,
        degraded: true,
        warning: "No se pudo actualizar lastLogin temporalmente por límite de cuota.",
      });
    }
    console.error("Error al actualizar lastLogin:", error);
    return res.status(500).json({ 
      error: "Error al actualizar última conexión",
      detail: error instanceof Error ? error.message : String(error)
    });
  }
}

