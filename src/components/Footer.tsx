import Link from "next/link";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full bg-black/60 backdrop-blur-sm border-t border-white/10 py-8 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Disclaimer médico */}
        <div className="text-center mb-6">
          <p className="text-white/50 text-xs max-w-3xl mx-auto">
            ⚠️ <strong>Aviso importante:</strong> FitPlan AI proporciona información general y orientación sobre nutrición y ejercicio. 
            No reemplaza el consejo médico profesional. Antes de iniciar cualquier programa de dieta o ejercicio, 
            consulta con un médico o profesional de salud calificado, especialmente si tienes condiciones médicas preexistentes.
          </p>
        </div>

        {/* Enlaces legales */}
        <div className="flex flex-wrap justify-center gap-4 mb-6 text-sm">
          <Link href="/legal/terms" className="text-white/60 hover:text-white transition-colors">
            Términos y Condiciones
          </Link>
          <span className="text-white/30">|</span>
          <Link href="/legal/privacy" className="text-white/60 hover:text-white transition-colors">
            Política de Privacidad
          </Link>
          <span className="text-white/30">|</span>
          <Link href="/legal/disclaimer" className="text-white/60 hover:text-white transition-colors">
            Aviso Médico
          </Link>
          <span className="text-white/30">|</span>
          <Link href="/legal/cookies" className="text-white/60 hover:text-white transition-colors">
            Política de Cookies
          </Link>
          <span className="text-white/30">|</span>
          <Link href="/legal/refund" className="text-white/60 hover:text-white transition-colors">
            Reembolsos
          </Link>
          <span className="text-white/30">|</span>
          <Link href="/legal/contact" className="text-white/60 hover:text-white transition-colors">
            Contacto
          </Link>
        </div>

        {/* Copyright */}
        <div className="text-center text-white/40 text-xs">
          <p>© {currentYear} FitPlan AI. Todos los derechos reservados.</p>
          <p className="mt-1">
            Hecho con ❤️ para ayudarte a alcanzar tus metas de salud y fitness.
          </p>
        </div>
      </div>
    </footer>
  );
}















