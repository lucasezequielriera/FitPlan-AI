import Link from "next/link";
import { useAppLocale } from "@/contexts/AppLocaleContext";

export default function Footer() {
  const { locale } = useAppLocale();
  const isEn = locale === "en";

  const disclaimer = isEn ? (
    <>
      <strong>Important:</strong> FitPlan AI provides general information and guidance on nutrition and exercise. It does
      not replace professional medical advice. Before starting any diet or exercise program, consult a physician or qualified
      health professional, especially if you have pre-existing medical conditions.
    </>
  ) : (
    <>
      <strong>Aviso importante:</strong> FitPlan AI proporciona información general y orientación sobre nutrición y
      ejercicio. No reemplaza el consejo médico profesional. Antes de iniciar cualquier programa de dieta o ejercicio,
      consulta con un médico o profesional de salud calificado, especialmente si tienes condiciones médicas preexistentes.
    </>
  );

  return (
    <footer className="w-full bg-black/60 backdrop-blur-sm border-t border-white/10 py-8 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-6">
          <p className="text-white/50 text-xs max-w-3xl mx-auto leading-relaxed" lang={isEn ? "en" : "es"}>
            ⚠️ {disclaimer}
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-4 mb-6 text-sm" lang={isEn ? "en" : "es"}>
          <Link href="/legal/terms" className="text-white/60 hover:text-white transition-colors">
            {isEn ? "Terms & Conditions" : "Términos y Condiciones"}
          </Link>
          <span className="text-white/30">|</span>
          <Link href="/legal/privacy" className="text-white/60 hover:text-white transition-colors">
            {isEn ? "Privacy Policy" : "Política de Privacidad"}
          </Link>
          <span className="text-white/30">|</span>
          <Link href="/legal/disclaimer" className="text-white/60 hover:text-white transition-colors">
            {isEn ? "Medical disclaimer" : "Aviso Médico"}
          </Link>
          <span className="text-white/30">|</span>
          <Link href="/legal/cookies" className="text-white/60 hover:text-white transition-colors">
            {isEn ? "Cookie Policy" : "Política de Cookies"}
          </Link>
          <span className="text-white/30">|</span>
          <Link href="/legal/refund" className="text-white/60 hover:text-white transition-colors">
            {isEn ? "Refunds" : "Reembolsos"}
          </Link>
          <span className="text-white/30">|</span>
          <Link href="/legal/contact" className="text-white/60 hover:text-white transition-colors">
            {isEn ? "Contact" : "Contacto"}
          </Link>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-center text-white/40 text-xs gap-2" lang={isEn ? "en" : "es"}>
          <p>{isEn ? "© 2026 FitPlan AI. All rights reserved." : "© 2026 FitPlan AI. Todos los derechos reservados."}</p>
          <p>
            {isEn ? "Website by" : "Sitio web por"}{" "}
            <a
              href="https://www.lucasriera.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/60 hover:text-white transition-colors underline"
            >
              Lucas Riera
            </a>
            {" "}· Web Development &amp; Design
          </p>
        </div>
      </div>
    </footer>
  );
}
