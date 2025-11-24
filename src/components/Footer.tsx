import { useRouter } from "next/router";
import Link from "next/link";
import { FaAppleAlt } from "react-icons/fa";

export default function Footer() {
  const router = useRouter();
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-white/10 bg-black/40 backdrop-blur-sm mt-auto">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Logo y descripción */}
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500">
                <FaAppleAlt className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                FitPlan AI
              </h3>
            </div>
            <p className="text-sm text-white/60 mb-4 max-w-md">
              Plan de alimentación y entrenamiento inteligente con IA. 
              Diseñado por nutricionistas y entrenadores profesionales para ayudarte a alcanzar tus objetivos.
            </p>
            <p className="text-xs text-white/40">
              © {currentYear} FitPlan AI. Todos los derechos reservados.
            </p>
          </div>

          {/* Enlaces legales */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-4">Legal</h4>
            <ul className="space-y-2">
              <li>
                <Link 
                  href="/legal/terms" 
                  className="text-sm text-white/60 hover:text-white/90 transition-colors"
                >
                  Términos de Servicio
                </Link>
              </li>
              <li>
                <Link 
                  href="/legal/privacy" 
                  className="text-sm text-white/60 hover:text-white/90 transition-colors"
                >
                  Política de Privacidad
                </Link>
              </li>
              <li>
                <Link 
                  href="/legal/disclaimer" 
                  className="text-sm text-white/60 hover:text-white/90 transition-colors"
                >
                  Descargo de Responsabilidad Médica
                </Link>
              </li>
              <li>
                <Link 
                  href="/legal/cookies" 
                  className="text-sm text-white/60 hover:text-white/90 transition-colors"
                >
                  Política de Cookies
                </Link>
              </li>
            </ul>
          </div>

          {/* Información adicional */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-4">Información</h4>
            <ul className="space-y-2">
              <li>
                <Link 
                  href="/legal/refund" 
                  className="text-sm text-white/60 hover:text-white/90 transition-colors"
                >
                  Política de Reembolsos
                </Link>
              </li>
              <li>
                <Link 
                  href="/legal/liability" 
                  className="text-sm text-white/60 hover:text-white/90 transition-colors"
                >
                  Limitación de Responsabilidad
                </Link>
              </li>
              <li>
                <Link 
                  href="/legal/contact" 
                  className="text-sm text-white/60 hover:text-white/90 transition-colors"
                >
                  Contacto Legal
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Aviso importante */}
        <div className="border-t border-white/10 pt-6 mt-6">
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-4">
            <p className="text-xs text-yellow-300/90 leading-relaxed">
              <strong className="font-semibold">⚠️ AVISO IMPORTANTE:</strong> Los planes generados por FitPlan AI son herramientas informativas y educativas. 
              No constituyen asesoramiento médico, diagnóstico o tratamiento. Siempre consulta con un profesional de la salud 
              calificado antes de comenzar cualquier plan de alimentación o ejercicio, especialmente si tienes condiciones 
              médicas preexistentes, estás embarazada, amamantando, o tomas medicamentos. El uso de esta aplicación es bajo 
              tu propio riesgo y responsabilidad.
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-white/40">
            <p>
              Esta aplicación cumple con las regulaciones internacionales de protección de datos y privacidad.
            </p>
            <div className="flex items-center gap-4">
              <span>Jurisdicción: Internacional</span>
              <span>•</span>
              <span>Versión Legal: 1.0</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

