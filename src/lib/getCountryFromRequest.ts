import type { NextApiRequest } from "next";

/**
 * Código ISO del país del request (IP), para precios Stripe y validación.
 * Misma lógica que /api/getUserLocation.
 */
export async function getCountryCodeFromRequest(req: NextApiRequest): Promise<string | null> {
  try {
    const forwarded = req.headers["x-forwarded-for"];
    const ip = forwarded
      ? typeof forwarded === "string"
        ? forwarded.split(",")[0].trim()
        : forwarded[0]
      : req.headers["x-real-ip"] || req.socket?.remoteAddress || "";

    let locationUrl = "http://ip-api.com/json/?fields=status,countryCode";
    if (ip && typeof ip === "string" && ip !== "unknown" && ip !== "::1" && !ip.startsWith("127.")) {
      locationUrl = `http://ip-api.com/json/${ip}?fields=status,countryCode`;
    }

    const response = await fetch(locationUrl);
    if (!response.ok) return null;
    const data = (await response.json()) as { status?: string; countryCode?: string };
    if (data.status === "fail") return null;
    return data.countryCode || null;
  } catch {
    return null;
  }
}
