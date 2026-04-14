import { useEffect, useMemo, useState } from "react";
import { hasConsentDecision, readConsent, writeConsent } from "@/lib/consent";

export default function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
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
    <div className="fixed inset-x-0 bottom-0 z-[11000] p-3 sm:p-4">
      <div className="mx-auto max-w-4xl rounded-2xl border border-white/15 bg-slate-950/95 backdrop-blur-md p-4 sm:p-5 shadow-2xl">
        <p className="text-sm font-bold text-white">{copy.title}</p>
        <p className="mt-2 text-xs sm:text-sm text-white/80">{copy.body}</p>
        <div className="mt-4 flex flex-col sm:flex-row gap-2 sm:justify-end">
          <button
            type="button"
            onClick={() => {
              writeConsent({ analytics: false, ads: false });
              setVisible(false);
            }}
            className="px-4 py-2 rounded-xl border border-white/20 bg-white/5 text-white/90 text-sm font-medium hover:bg-white/10"
          >
            {copy.reject}
          </button>
          <button
            type="button"
            onClick={() => {
              writeConsent({ analytics: true, ads: true });
              setVisible(false);
            }}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 text-sm font-bold hover:from-emerald-400 hover:to-cyan-400"
          >
            {copy.accept}
          </button>
        </div>
      </div>
    </div>
  );
}

