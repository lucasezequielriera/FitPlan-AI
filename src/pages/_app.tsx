import "@/styles/globals.css";
import type { AppProps } from "next/app";
import Head from "next/head";
import { Poppins } from "next/font/google";
import { useEffect } from "react";
import { AppLocaleProvider } from "@/contexts/AppLocaleContext";
import { useAuthStore } from "@/store/authStore";
import Footer from "@/components/Footer";
import ContactButton from "@/components/ContactButton";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";

const poppins = Poppins({ subsets: ["latin"], weight: ["300","400","500","600","700"], variable: "--font-sans" });

export default function App({ Component, pageProps }: AppProps) {
  const initializeAuth = useAuthStore((state) => state.initializeAuth);

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  // Limpiar Service Workers/caches viejos para evitar versión antigua en web/mobile.
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .getRegistrations()
        .then(async (registrations) => {
          const hadRegistrations = registrations.length > 0;
          await Promise.all(registrations.map((registration) => registration.unregister()));
          if (typeof caches !== "undefined") {
            const cacheNames = await caches.keys();
            await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
          }
          // Si venía controlado por SW antiguo, recargamos una vez para tomar build nuevo.
          if (hadRegistrations && typeof sessionStorage !== "undefined") {
            const key = "fitplan_sw_cleanup_done";
            if (!sessionStorage.getItem(key)) {
              sessionStorage.setItem(key, "1");
              window.location.reload();
            }
          }
        })
        .catch((error) => {
          console.warn("⚠️ No se pudo limpiar cache del navegador:", error?.message || error);
        });
    }
  }, []);

  return (
    <>
      <Head>
        <title>FitPlan AI | Plan de Alimentación y Entrenamiento Inteligente con IA</title>
        <meta name="description" content="Crea tu plan de alimentación y entrenamiento personalizado con inteligencia artificial. Nutrición semanal con ingredientes exactos, rutinas de gym, macros, seguimiento y PDF. Hecho por nutricionistas y entrenadores." />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5" />
        <meta name="theme-color" content="#0b1220" />
        <meta name="color-scheme" content="dark" />
        <meta name="author" content="FitPlan AI" />
        <meta name="application-name" content="FitPlan AI" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="FitPlan AI" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />

        {/* Default OG tags (overridden per page) */}
        <meta property="og:site_name" content="FitPlan AI" />
        <meta property="og:locale" content="es_AR" />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="https://www.fitplan-ai.com/brand/icon-social.png" />
        <meta property="og:image:width" content="1080" />
        <meta property="og:image:height" content="1080" />
        <meta property="og:image:alt" content="FitPlan AI - Plan de Alimentación y Entrenamiento Inteligente" />

        {/* Default Twitter tags */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:image" content="https://www.fitplan-ai.com/brand/icon-social.png" />

        <link rel="manifest" href="/site.webmanifest" />
      </Head>
      <div className={`${poppins.className} min-h-screen flex flex-col`}>
        <AppLocaleProvider>
          <Component {...pageProps} />
          <Footer />
          <ContactButton />
        </AppLocaleProvider>
      </div>
      <Analytics />
      <SpeedInsights />
    </>
  );
}
