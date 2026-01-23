import "@/styles/globals.css";
import type { AppProps } from "next/app";
import Head from "next/head";
import { Poppins } from "next/font/google";
import { useEffect } from "react";
import { useAuthStore } from "@/store/authStore";
import Footer from "@/components/Footer";
import ContactButton from "@/components/ContactButton";

const poppins = Poppins({ subsets: ["latin"], weight: ["300","400","500","600","700"], variable: "--font-sans" });

export default function App({ Component, pageProps }: AppProps) {
  const initializeAuth = useAuthStore((state) => state.initializeAuth);

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  // Registrar Service Worker (solo en producción o si está disponible)
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      // Primero, limpiar todos los service workers antiguos
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        return Promise.all(
          registrations.map((registration) => {
            return registration.unregister().then((success) => {
              if (success) {
                console.log('Service Worker antiguo desregistrado:', registration.scope);
              }
              return success;
            });
          })
        );
      }).then(() => {
        // Verificar que el archivo existe antes de intentar registrarlo
        return fetch('/serviceWorker.js', { method: 'HEAD', cache: 'no-cache' });
      }).then((response) => {
        if (response.ok) {
          // Esperar un momento para asegurar que los antiguos se desregistraron
          return new Promise((resolve) => setTimeout(resolve, 500));
        } else {
          throw new Error('Service Worker file not found');
        }
      }).then(() => {
        // Intentar registrar el nuevo service worker
        return navigator.serviceWorker.register('/serviceWorker.js', { scope: '/' });
      }).then((registration) => {
        console.log('✅ Service Worker registrado exitosamente:', registration.scope);
        
        // Forzar actualización
        registration.update();
      }).catch((error) => {
        // Silenciar el error si el archivo no está disponible (normal en desarrollo)
        if (error.message !== 'Service Worker file not found' && !error.message.includes('Not found')) {
          console.warn('⚠️ No se pudo registrar Service Worker:', error.message);
        }
      });
    }
  }, []);

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
      <div className={`${poppins.className} min-h-screen flex flex-col`}>
        <Component {...pageProps} />
        <Footer />
        <ContactButton />
      </div>
    </>
  );
}
