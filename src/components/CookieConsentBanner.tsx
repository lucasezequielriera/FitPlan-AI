import { useEffect, useMemo, useRef, useState } from "react";
import { hasConsentDecision, readConsent, writeConsent } from "@/lib/consent";

export default function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);
  const cardRef = useRef<HTMLDivElement | null>(null);

  /**
   * Mientras el banner está visible, publica su alto real en `--cookie-banner-h`
   * y marca el body. Los elementos fijos del borde inferior (hoy el botón
   * flotante de contacto) se corren esa distancia hacia arriba: si no, la
   * tarjeta los tapa físicamente y quedan inaccesibles hasta que el usuario
   * decide sobre las cookies. Se mide en vez de hardcodear un alto porque
   * cambia con el idioma y el ancho de pantalla.
   */
  useEffect(() => {
    const body = document.body;
    if (!visible) {
      body.classList.remove("has-cookie-banner");
      body.style.removeProperty("--cookie-banner-h");
      return;
    }
    body.classList.add("has-cookie-banner");
    const publicarAlto = () => {
      const alto = cardRef.current?.getBoundingClientRect().height ?? 0;
      body.style.setProperty("--cookie-banner-h", `${Math.ceil(alto)}px`);
    };
    publicarAlto();
    const ro = new ResizeObserver(publicarAlto);
    if (cardRef.current) ro.observe(cardRef.current);
    return () => {
      ro.disconnect();
      body.classList.remove("has-cookie-banner");
      body.style.removeProperty("--cookie-banner-h");
    };
  }, [visible]);

  useEffect(() => {
    // Lee la decisión de consentimiento guardada en localStorage (sistema externo,
    // no disponible en SSR) — no hay alternativa sin introducir un
    // useSyncExternalStore para un caso de un solo uso al montar.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVisible(!hasConsentDecision());
  }, []);

  const locale = useMemo<"es" | "en">(() => {
    if (typeof window === "undefined") return "es";
    return window.location.pathname.startsWith("/en") ? "en" : "es";
  }, []);

  if (!visible) return null;

  const copy =
    locale === "en"
      ? {
          title: "Privacy settings",
          body:
            "We use analytics and ad cookies to measure campaigns and improve conversions. You can accept all or keep only essential cookies.",
          accept: "Accept all",
          reject: "Only essential",
        }
      : {
          title: "Privacidad y cookies",
          body:
            "Usamos cookies de analítica y anuncios para medir campañas y mejorar conversiones. Puedes aceptar todo o dejar solo las esenciales.",
          accept: "Aceptar todo",
          reject: "Solo esenciales",
        };

  return (
    // El wrapper ocupa toda la franja inferior pero es visualmente transparente
    // fuera de la tarjeta: sin `pointer-events-none` capturaba los clicks de esa
    // zona y dejaba inaccesible al botón flotante de contacto (abajo a la derecha)
    // mientras el banner estuviera visible. Los clicks los recibe solo la tarjeta,
    // que es lo único que se ve.
    <div className="cookie-consent-banner pointer-events-none fixed inset-x-0 bottom-0 z-[11000] p-3 sm:p-4 transition-[bottom] duration-200">
      <div ref={cardRef} className="pointer-events-auto mx-auto max-w-4xl rounded-2xl border border-[var(--border)] bg-[color-mix(in_oklab,var(--background)_95%,#0f172a)] backdrop-blur-md p-4 sm:p-5 shadow-2xl">
        <p className="text-sm font-bold text-[var(--foreground)]">{copy.title}</p>
        <p className="mt-2 text-xs sm:text-sm text-[var(--text-muted)]">{copy.body}</p>
        <div className="mt-4 flex flex-col sm:flex-row gap-2 sm:justify-end">
          <button
            type="button"
            onClick={() => {
              writeConsent({ analytics: false, ads: false });
              setVisible(false);
            }}
            className="btn btn-secondary text-sm"
          >
            {copy.reject}
          </button>
          <button
            type="button"
            onClick={() => {
              writeConsent({ analytics: true, ads: true });
              setVisible(false);
            }}
            className="btn btn-primary text-sm font-bold"
          >
            {copy.accept}
          </button>
        </div>
      </div>
    </div>
  );
}

