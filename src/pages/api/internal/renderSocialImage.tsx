import { ImageResponse } from "@vercel/og";
import type { NextRequest } from "next/server";

export const config = {
  runtime: "edge",
};

/**
 * Renderiza el frame de marca para un post social. Corre en Edge Runtime
 * (requisito de @vercel/og) — por eso es un endpoint aparte del cron
 * orquestador, que necesita Node.js runtime para Firestore Admin SDK/ffmpeg.
 * El cron le pega a este endpoint por HTTP y usa el PNG resultante (para
 * subir directo, o como frame base del video). Colores hardcodeados a los
 * mismos hex que src/styles/globals.css (Satori no soporta CSS custom
 * properties).
 *
 * `format=story` (default, usado para el video de Reels/TikTok, 9:16) vs.
 * `format=feed` (1:1, por si en el futuro se vuelve a publicar como imagen).
 *
 * Paleta actualizada a "FitPlan Volt" (ver DESIGN_SYSTEM.md): acento lima
 * `#cbff3d` en vez del teal `#2dd4bf` anterior, fondo negro neutro en vez de
 * navy. Este endpoint ya no es el pipeline de video en vivo (lo reemplazó
 * HeyGen, ver heygenAvatarVideo.ts), pero sigue accesible desde el preview
 * manual del admin — se actualiza igual para no dejar un remanente
 * visualmente inconsistente con el resto de la marca.
 */
export default function handler(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const headline = searchParams.get("headline") || "FitPlan";
  const subtext = searchParams.get("subtext") || "";
  const format = searchParams.get("format") === "feed" ? "feed" : "story";
  const width = 1080;
  const height = format === "feed" ? 1080 : 1920;

  return new ImageResponse(
    (
      <div
        style={{
          width: `${width}px`,
          height: `${height}px`,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: format === "feed" ? "80px" : "100px 80px",
          background: "linear-gradient(160deg, #08090c 0%, #111315 55%, #08090c 100%)",
          color: "#f5f7f2",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div
            style={{
              width: "20px",
              height: "20px",
              borderRadius: "9999px",
              background: "#cbff3d",
              display: "flex",
            }}
          />
          <span style={{ fontSize: "36px", fontWeight: 700, letterSpacing: "-0.02em" }}>FitPlan</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
          <span
            style={{
              fontSize: format === "feed" ? "72px" : "84px",
              fontWeight: 800,
              lineHeight: 1.15,
              letterSpacing: "-0.02em",
            }}
          >
            {headline}
          </span>
          {subtext ? (
            <span style={{ fontSize: "36px", color: "rgba(245,247,242,0.75)", lineHeight: 1.4, display: "flex" }}>
              {subtext}
            </span>
          ) : null}
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "20px" }}>
          <div
            style={{
              display: "flex",
              padding: "14px 28px",
              borderRadius: "9999px",
              background: "rgba(203,255,61,0.14)",
              border: "2px solid rgba(203,255,61,0.4)",
              fontSize: "26px",
              color: "#cbff3d",
              fontWeight: 600,
            }}
          >
            Tu plan, con IA
          </div>
          <span style={{ fontSize: "28px", color: "#cbff3d", fontWeight: 600 }}>fitplan-ai.com</span>
        </div>
      </div>
    ),
    {
      width,
      height,
    }
  );
}
