import type { NextApiRequest, NextApiResponse } from "next";

/**
 * API para obtener la ubicación del usuario basada en su IP
 * Usa ip-api.com (gratuito, sin API key requerida)
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Obtener la IP del cliente (Vercel usa x-forwarded-for)
    const forwarded = req.headers["x-forwarded-for"];
    const ip = forwarded 
      ? (typeof forwarded === "string" ? forwarded.split(",")[0].trim() : forwarded[0])
      : req.headers["x-real-ip"] || req.socket.remoteAddress || "";

    // Si no hay IP, usar la IP del request directamente
    const clientIp = typeof ip === "string" ? ip : (Array.isArray(ip) ? ip[0] : String(ip || req.socket.remoteAddress || ""));

    // Si aún no hay IP, intentar obtenerla de otra forma o usar un servicio que detecta automáticamente
    let locationUrl = "http://ip-api.com/json/?fields=status,country,countryCode,city,regionName,query";
    if (clientIp && clientIp !== "unknown" && clientIp !== "::1" && typeof clientIp === "string" && !clientIp.startsWith("127.")) {
      locationUrl = `http://ip-api.com/json/${clientIp}?fields=status,country,countryCode,city,regionName,query`;
    }

    // Usar ip-api.com (gratuito, hasta 45 requests/min)
    const response = await fetch(locationUrl);
    
    if (!response.ok) {
      throw new Error("Error al obtener ubicación");
    }

    const data = await response.json();

    if (data.status === "fail") {
      return res.status(200).json({
        ciudad: null,
        pais: null,
        error: data.message || "No se pudo obtener la ubicación",
      });
    }

    return res.status(200).json({
      ciudad: data.city || null,
      pais: data.country || null,
      region: data.regionName || null,
      countryCode: data.countryCode || null,
    });
  } catch (error) {
    console.error("Error al obtener ubicación:", error);
    // Retornar valores null en caso de error (no bloquear el flujo)
    return res.status(200).json({
      ciudad: null,
      pais: null,
      error: error instanceof Error ? error.message : "Error desconocido",
    });
  }
}

