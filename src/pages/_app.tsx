import "@/styles/globals.css";
import type { AppProps } from "next/app";
import Head from "next/head";
import { Poppins } from "next/font/google";
import { useEffect } from "react";
import { useAuthStore } from "@/store/authStore";

const poppins = Poppins({ subsets: ["latin"], weight: ["300","400","500","600","700"], variable: "--font-sans" });

export default function App({ Component, pageProps }: AppProps) {
  const initializeAuth = useAuthStore((state) => state.initializeAuth);

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  return (
    <>
      <Head>
        <title>FitPlan AI | Plan nutricional inteligente con IA</title>
        <meta name="description" content="Crea tu plan nutricional inteligente con IA: comidas semanales con ingredientes exactos, macros por objetivo, entrenamiento y sueño recomendados, seguimiento y PDF." />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5" />
        <meta name="theme-color" content="#0b1220" />
        <meta name="color-scheme" content="dark light" />
        <link rel="manifest" href="/site.webmanifest" />
      </Head>
      <div className={poppins.className}>
        <Component {...pageProps} />
      </div>
    </>
  );
}
