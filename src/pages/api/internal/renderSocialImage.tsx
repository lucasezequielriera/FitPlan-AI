import { ImageResponse } from "@vercel/og";
import type { NextRequest } from "next/server";

export const config = {
  runtime: "edge",
};

/**
 * Renderiza la imagen de marca para un post social (1080x1080, formato feed).
 * Corre en Edge Runtime (requisito de @vercel/og) — por eso es un endpoint
 * aparte del cron orquestador, que necesita Node.js runtime para Firestore
 * Admin SDK. El cron le pega a este endpoint por HTTP y sube el resultado a
 * Cloudinary. Colores hardcodeados a los mismos hex que
 * src/styles/globals.css (Satori no soporta CSS custom properties).
 */
export default function handler(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const headline = searchParams.get("headline") || "FitPlan AI";
  const subtext = searchParams.get("subtext") || "";

  return new ImageResponse(
    (
      <div
        style={{
          width: "1080px",
          height: "1080px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "80px",
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
          <span style={{ fontSize: "36px", fontWeight: 700, letterSpacing: "-0.02em" }}>FitPlan AI</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
          <span
            style={{
              fontSize: "72px",
              fontWeight: 800,
              lineHeight: 1.15,
              letterSpacing: "-0.02em",
            }}
          >
            {headline}
          </span>
          {subtext ? (
            <span style={{ fontSize: "34px", color: "rgba(230,246,255,0.75)", lineHeight: 1.4, display: "flex" }}>
              {subtext}
            </span>
          ) : null}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: "28px", color: "#2dd4bf", fontWeight: 600 }}>fitplan-ai.com</span>
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
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1080,
    }
  );
}
