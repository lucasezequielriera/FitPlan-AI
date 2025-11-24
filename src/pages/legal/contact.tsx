import Head from "next/head";
import Navbar from "@/components/Navbar";

export default function ContactLegalPage() {
  return (
    <>
      <Head>
        <title>Contacto Legal | FitPlan AI</title>
        <meta name="description" content="Información de contacto legal de FitPlan AI" />
      </Head>
      <Navbar />
      <div className="flex-1 max-w-4xl mx-auto px-4 py-12">
          <h1 className="text-4xl font-bold mb-8 bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
            Contacto Legal
          </h1>

          <div className="prose prose-invert max-w-none space-y-6 text-white/80">
            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">Información de Contacto</h2>
              <p>
                Para consultas legales, solicitudes de privacidad, o cualquier asunto relacionado con nuestros términos 
                y políticas, puede contactarnos a través de:
              </p>
              <ul className="list-disc pl-6 space-y-2 mt-4">
                <li><strong>Sistema de Mensajería:</strong> Utilice el sistema de mensajería integrado en la aplicación</li>
                <li><strong>Asuntos Legales:</strong> Todas las consultas legales serán atendidas a través del sistema de mensajería</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">Tiempo de Respuesta</h2>
              <p>
                Nos esforzamos por responder a todas las consultas legales dentro de 5-10 días hábiles. 
                Las solicitudes urgentes serán priorizadas según corresponda.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">Tipos de Consultas</h2>
              <p>Puede contactarnos para:</p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li>Ejercer sus derechos de privacidad (acceso, rectificación, eliminación de datos)</li>
                <li>Consultas sobre términos y condiciones</li>
                <li>Solicitudes de reembolso</li>
                <li>Reportar violaciones de términos</li>
                <li>Cualquier otra consulta legal</li>
              </ul>
            </section>
          </div>
        </div>
    </>
  );
}

