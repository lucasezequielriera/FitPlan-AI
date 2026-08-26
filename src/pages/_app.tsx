import "@/styles/globals.css";
// Estilos de la propuesta de rediseño (solo /design-preview). Todas las reglas
// están gateadas detrás de .fp-preview / .fp-ribbon / .fp-display, clases que
// no existen en ninguna otra pantalla — no cambia nada del resto de la app.
import "@/styles/design-preview-2026.css";
import type { AppProps } from "next/app";
import Head from "next/head";
import Script from "next/script";
import { useRouter } from "next/router";
import { Inter, Space_Grotesk } from "next/font/google";
import { useEffect, useState } from "react";
import { AppLocaleProvider } from "@/contexts/AppLocaleContext";
import { useAuthStore } from "@/store/authStore";
import Footer from "@/components/Footer";
import ContactButton from "@/components/ContactButton";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { trackEvent } from "@/lib/analytics";
import { CONSENT_CHANGED_EVENT, readConsent } from "@/lib/consent";
import { persistAttributionFromUrl } from "@/lib/attribution";
import CookieConsentBanner from "@/components/CookieConsentBanner";

// Tipografía del rediseño "FitPlan Volt" (aprobado — ver /design-preview y DESIGN_SYSTEM.md):
// Inter para UI/cuerpo (reemplaza a Poppins), Space Grotesk disponible como font-display
// para que las pantallas vayan adoptando headings/cifras grandes de a poco.
const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-sans" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], weight: ["500", "700"], variable: "--font-display" });

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  // El panel admin (/admin/*) tiene su propio shell de navegación (AdminShell.tsx,
  // DESIGN_SYSTEM.md §7/§9) — el footer legal/marketing (términos, disclaimer) es
  // contenido cara al cliente final, no corresponde ahí. Pedido explícito de Lucas.
  const isAdminRoute = router.pathname.startsWith("/admin");
  const initializeAuth = useAuthStore((state) => state.initializeAuth);
  const ga4Id = process.env.NEXT_PUBLIC_GA4_ID;
  const metaPixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  const tikTokPixelId = process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID;
  const [consent, setConsent] = useState(readConsent);

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

  useEffect(() => {
    const handleConsentChange = () => {
      setConsent(readConsent());
    };
    window.addEventListener(CONSENT_CHANGED_EVENT, handleConsentChange);
    window.addEventListener("storage", handleConsentChange);
    return () => {
      window.removeEventListener(CONSENT_CHANGED_EVENT, handleConsentChange);
      window.removeEventListener("storage", handleConsentChange);
    };
  }, []);

  useEffect(() => {
    const handleRouteChange = (url: string) => {
      persistAttributionFromUrl(url, document.referrer);
      trackEvent("page_view", { page_location: url });
      if (typeof window !== "undefined" && window.ttq?.page) {
        window.ttq.page();
      }
    };
    handleRouteChange(window.location.href);
    router.events.on("routeChangeComplete", handleRouteChange);
    return () => {
      router.events.off("routeChangeComplete", handleRouteChange);
    };
  }, [router.events]);

  return (
    <>
      <Head>
        <title>FitPlan | Plan de Alimentación y Entrenamiento Inteligente con IA</title>
        <meta name="description" content="Crea tu plan de alimentación y entrenamiento personalizado con inteligencia artificial. Nutrición semanal con ingredientes exactos, rutinas de gym, macros, seguimiento y PDF. Hecho por nutricionistas y entrenadores." />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5" />
        <meta name="theme-color" content="#08090c" />
        <meta name="color-scheme" content="dark" />
        <meta name="author" content="FitPlan" />
        <meta name="application-name" content="FitPlan" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="FitPlan" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />

        {/* Default OG tags (overridden per page) */}
        <meta property="og:site_name" content="FitPlan" />
        <meta property="og:locale" content="es_ES" />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="https://www.fitplan-ai.com/brand/icon-social.png" />
        <meta property="og:image:width" content="1080" />
        <meta property="og:image:height" content="1080" />
        <meta property="og:image:alt" content="FitPlan - Plan de Alimentación y Entrenamiento Inteligente" />

        {/* Default Twitter tags */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:image" content="https://www.fitplan-ai.com/brand/icon-social.png" />

        <link rel="manifest" href="/site.webmanifest" />
      </Head>
      {ga4Id ? (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${ga4Id}`} strategy="afterInteractive" />
          <Script id="ga4-init" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              window.gtag = gtag;
              gtag('js', new Date());
              gtag('consent', 'default', {
                analytics_storage: 'denied',
                ad_storage: 'denied',
                ad_user_data: 'denied',
                ad_personalization: 'denied'
              });
              gtag('config', '${ga4Id}', { send_page_view: false, anonymize_ip: true });
            `}
          </Script>
        </>
      ) : null}
      {ga4Id ? (
        <Script id="ga4-consent-update" strategy="afterInteractive">
          {`
            if (window.gtag) {
              window.gtag('consent', 'update', {
                analytics_storage: '${consent.analytics ? "granted" : "denied"}',
                ad_storage: '${consent.ads ? "granted" : "denied"}',
                ad_user_data: '${consent.ads ? "granted" : "denied"}',
                ad_personalization: '${consent.ads ? "granted" : "denied"}'
              });
            }
          `}
        </Script>
      ) : null}
      {metaPixelId && consent.ads ? (
        <>
          <Script id="meta-pixel-init" strategy="afterInteractive">
            {`
              !function(f,b,e,v,n,t,s)
              {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
              n.callMethod.apply(n,arguments):n.queue.push(arguments)};
              if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
              n.queue=[];t=b.createElement(e);t.async=!0;
              t.src=v;s=b.getElementsByTagName(e)[0];
              s.parentNode.insertBefore(t,s)}(window, document,'script',
              'https://connect.facebook.net/en_US/fbevents.js');
              fbq('init', '${metaPixelId}');
            `}
          </Script>
          <noscript>
            <img
              height="1"
              width="1"
              style={{ display: "none" }}
              src={`https://www.facebook.com/tr?id=${metaPixelId}&ev=PageView&noscript=1`}
              alt=""
            />
          </noscript>
        </>
      ) : null}
      {tikTokPixelId && consent.ads ? (
        <Script id="tiktok-pixel-init" strategy="afterInteractive">
          {`
            !function (w, d, t) {
              w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];
              ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"];
              ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};
              for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);
              ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};
              ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js";
              ttq._i=ttq._i||{};ttq._i[e]=[];ttq._i[e]._u=r;ttq._t=ttq._t||{};ttq._t[e]=+new Date;
              ttq._o=ttq._o||{};ttq._o[e]=n||{};var o=document.createElement("script");
              o.type="text/javascript";o.async=!0;o.src=r+"?sdkid="+e+"&lib="+t;
              var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};
              ttq.load('${tikTokPixelId}');
            }(window, document, 'ttq');
          `}
        </Script>
      ) : null}
      {/* min-w-0 w-full: la página (`Component`) es un flex item de este
          contenedor columna. Sin esto, cualquier página cuyo nodo raíz use
          `mx-auto` para centrar un `max-w-*` (patrón muy común, ej.
          legal/*.tsx) pierde el comportamiento normal de bloque ("ocupar el
          ancho disponible y envolver texto") porque, como flex item con
          `width: auto` + márgenes cruzados en auto, el spec de flexbox NO
          aplica `align-items: stretch` — en cambio dimensiona el item a su
          max-content (como si el texto nunca pudiera envolver), y en
          pantallas angostas eso desborda el documento en vez de envolver.
          Mismo mecanismo de fondo que el bug de `.btn`, ver
          DESIGN_SYSTEM.md §12, pero acá a nivel raíz: afecta a CUALQUIER
          pantalla.

          Importante: este wrapper envuelve SOLO `Component`, no a `Footer`/
          `ContactButton`/`CookieConsentBanner`. Aplicar antes `w-full` a
          los 4 (vía `[&>*]:w-full` en el contenedor) rompió `ContactButton`
          en producción: es un `motion.a` con `position: fixed` — al ser
          `fixed`, un `width: 100%` puesto directamente sobre el elemento se
          resuelve contra el viewport, no contra su padre, así que el botón
          circular de 56/64px pasó a ocupar todo el ancho de la pantalla.
          `Footer` y `CookieConsentBanner` no necesitan el wrapper: `Footer`
          ya declara su propio `w-full` en su raíz, y `CookieConsentBanner`
          ya es `fixed inset-x-0` (el ancho lo define `left`/`right`, no
          `width`, así que nunca necesitó esta clase). Ver ContactButton.tsx
          y CookieConsentBanner.tsx. */}
      <div className={`${inter.className} ${spaceGrotesk.variable} min-h-screen flex flex-col`}>
        <AppLocaleProvider>
          <div className="min-w-0 w-full">
            <Component {...pageProps} />
          </div>
          {!isAdminRoute && <Footer />}
          <ContactButton />
          <CookieConsentBanner />
        </AppLocaleProvider>
      </div>
      <Analytics />
      <SpeedInsights />
    </>
  );
}
