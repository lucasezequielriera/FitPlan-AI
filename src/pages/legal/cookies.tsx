import Head from "next/head";
import Navbar from "@/components/Navbar";

export default function CookiesPage() {
  return (
    <>
      <Head>
        <title>Política de Cookies | FitPlan AI</title>
        <meta name="description" content="Política de cookies de FitPlan AI" />
      </Head>
      <Navbar />
      <div className="flex-1 max-w-4xl mx-auto px-4 py-12">
          <h1 className="text-4xl font-bold mb-8 bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
            Política de Cookies
          </h1>
          <p className="text-sm text-white/60 mb-8">
            Última actualización: {new Date().toLocaleDateString('es-AR', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>

          <div className="prose prose-invert max-w-none space-y-6 text-white/80">
            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">1. ¿Qué son las Cookies?</h2>
              <p>
                Las cookies son pequeños archivos de texto que se almacenan en su dispositivo cuando visita un sitio web. 
                Nos ayudan a proporcionar, proteger y mejorar nuestros servicios.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">2. Cómo Usamos las Cookies</h2>
              <p>Utilizamos cookies para:</p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li>Mantener su sesión activa</li>
                <li>Recordar sus preferencias</li>
                <li>Analizar el uso del sitio</li>
                <li>Mejorar la funcionalidad del Servicio</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">3. Tipos de Cookies que Utilizamos</h2>
              <h3 className="text-xl font-semibold text-white/90 mb-2 mt-4">Cookies Esenciales</h3>
              <p>
                Necesarias para el funcionamiento básico del Servicio, incluyendo autenticación y seguridad.
              </p>

              <h3 className="text-xl font-semibold text-white/90 mb-2 mt-4">Cookies de Funcionalidad</h3>
              <p>
                Nos permiten recordar sus preferencias y personalizar su experiencia.
              </p>

              <h3 className="text-xl font-semibold text-white/90 mb-2 mt-4">Cookies Analíticas</h3>
              <p>
                Nos ayudan a entender cómo los usuarios interactúan con el Servicio para mejorarlo.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">4. Gestión de Cookies</h2>
              <p>
                Puede gestionar sus preferencias de cookies a través de la configuración de su navegador. Tenga en cuenta 
                que deshabilitar ciertas cookies puede afectar la funcionalidad del Servicio.
              </p>
            </section>
          </div>
        </div>
    </>
  );
}

