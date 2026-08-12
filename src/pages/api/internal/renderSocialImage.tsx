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
          background: "linear-gradient(160deg, #0b1020 0%, #0f1b33 55%, #0b1020 100%)",
          color: "#e6f6ff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div
            style={{
              width: "20px",
              height: "20px",
              borderRadius: "9999px",
              background: "#2dd4bf",
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
            <span style={{ fontSize: "36px", color: "rgba(230,246,255,0.75)", lineHeight: 1.4, display: "flex" }}>
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
              background: "rgba(45,212,191,0.14)",
              border: "2px solid rgba(45,212,191,0.4)",
              fontSize: "26px",
              color: "#2dd4bf",
              fontWeight: 600,
            }}
          >
            Tu plan, con IA
          </div>
          <span style={{ fontSize: "28px", color: "#2dd4bf", fontWeight: 600 }}>fitplan-ai.com</span>
        </div>
      </div>
    ),
    {
      width,
      height,
    }
  );
}
