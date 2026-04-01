/**
 * Barra fija ES | EN para landings de marketing (href a la versión hermana).
 */
export default function LandingLangToggle({ locale }: { locale: "es" | "en" }) {
  return (
    <div className="text-center py-2.5 text-sm bg-black/60 border-b border-white/10 text-white/85 backdrop-blur-sm">
      <span className="text-white/45 mr-2 hidden sm:inline">Language / Idioma:</span>
      <a
        href="/transformacion-fitplan"
        className={`inline-block px-2 py-0.5 rounded ${locale === "es" ? "font-bold text-white bg-white/10" : "hover:text-white"}`}
        hrefLang="es"
      >
        Español
      </a>
      <span className="mx-2 text-white/35">|</span>
      <a
        href="/en/transformacion-fitplan"
        className={`inline-block px-2 py-0.5 rounded ${locale === "en" ? "font-bold text-white bg-white/10" : "hover:text-white"}`}
        hrefLang="en-US"
      >
        English (US)
      </a>
    </div>
  );
}
