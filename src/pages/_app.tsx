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
        <title>FitPlan AI | Plan de Alimentación y Entrenamiento Inteligente con IA</title>
        <meta name="description" content="Crea tu plan de alimentación y entrenamiento inteligente con IA: planes nutricionales semanales con ingredientes exactos, rutinas de entrenamiento personalizadas, macros por objetivo, seguimiento y PDF. Desarrollado por nutricionistas y entrenadores profesionales." />
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
