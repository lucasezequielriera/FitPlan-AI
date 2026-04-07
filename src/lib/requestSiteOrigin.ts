import type { IncomingHttpHeaders } from "http";

/**
 * Origen público para armar URLs absolutas (catálogo, etc.).
 * En request normal usa Host + X-Forwarded-Proto; si no hay host, NEXT_PUBLIC_SITE_URL / SITE_URL o dominio de producción.
 */
export function getSiteOriginFromRequest(headers: IncomingHttpHeaders): string {
  const host = headers.host;
  const envRaw = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL;
  const fromEnv = typeof envRaw === "string" ? envRaw.replace(/\/$/, "").trim() : "";

  if (!host) {
    return fromEnv || "https://www.fitplan-ai.com";
  }

  const xf = headers["x-forwarded-proto"];
  const proto = (Array.isArray(xf) ? xf[0] : xf) === "https" ? "https" : "http";
  return `${proto}://${host}`;
}
