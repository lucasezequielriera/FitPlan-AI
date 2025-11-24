import Head from "next/head";
import Navbar from "@/components/Navbar";
import Link from "next/link";

export default function PrivacyPage() {
  return (
    <>
      <Head>
        <title>Política de Privacidad | FitPlan AI</title>
        <meta name="description" content="Política de privacidad de FitPlan AI" />
      </Head>
      <Navbar />
      <div className="flex-1 max-w-4xl mx-auto px-4 py-12">
          <h1 className="text-4xl font-bold mb-8 bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
            Política de Privacidad
          </h1>
          <p className="text-sm text-white/60 mb-8">
            Última actualización: {new Date().toLocaleDateString('es-AR', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>

          <div className="prose prose-invert max-w-none space-y-6 text-white/80">
            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">1. Introducción</h2>
              <p>
                FitPlan AI ("nosotros", "nuestro", "el Servicio") se compromete a proteger su privacidad. Esta Política de 
                Privacidad explica cómo recopilamos, usamos, divulgamos y protegemos su información personal cuando utiliza 
                nuestro servicio.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">2. Información que Recopilamos</h2>
              <h3 className="text-xl font-semibold text-white/90 mb-2 mt-4">2.1 Información Personal</h3>
              <p>Recopilamos información que usted nos proporciona directamente, incluyendo:</p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li>Nombre y dirección de correo electrónico</li>
                <li>Datos de perfil (edad, peso, altura, objetivos, preferencias alimentarias)</li>
                <li>Información de pago (procesada por terceros seguros)</li>
                <li>Mensajes y comunicaciones con nuestro equipo</li>
              </ul>

              <h3 className="text-xl font-semibold text-white/90 mb-2 mt-4">2.2 Información de Uso</h3>
              <p>Recopilamos automáticamente información sobre cómo utiliza el Servicio:</p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li>Datos de uso y actividad en la aplicación</li>
                <li>Información del dispositivo y navegador</li>
                <li>Dirección IP y ubicación aproximada</li>
                <li>Cookies y tecnologías similares</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">3. Cómo Usamos su Información</h2>
              <p>Utilizamos la información recopilada para:</p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li>Proporcionar, mantener y mejorar el Servicio</li>
                <li>Generar planes personalizados de alimentación y entrenamiento</li>
                <li>Procesar pagos y gestionar suscripciones</li>
                <li>Comunicarnos con usted sobre el Servicio</li>
                <li>Enviar notificaciones y actualizaciones</li>
                <li>Detectar y prevenir fraudes</li>
                <li>Cumplir con obligaciones legales</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">4. Compartir Información</h2>
              <p>No vendemos su información personal. Podemos compartir información en las siguientes circunstancias:</p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li><strong>Proveedores de servicios:</strong> Con terceros que nos ayudan a operar el Servicio (hosting, pagos, análisis)</li>
                <li><strong>Cumplimiento legal:</strong> Cuando sea requerido por ley o para proteger nuestros derechos</li>
                <li><strong>Con su consentimiento:</strong> En cualquier otra situación con su permiso explícito</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">5. Seguridad de Datos</h2>
              <p>
                Implementamos medidas de seguridad técnicas y organizativas apropiadas para proteger su información personal 
                contra acceso no autorizado, alteración, divulgación o destrucción. Sin embargo, ningún método de transmisión 
                por Internet es 100% seguro.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">6. Retención de Datos</h2>
              <p>
                Conservamos su información personal durante el tiempo necesario para cumplir con los propósitos descritos en 
                esta política, a menos que la ley requiera o permita un período de retención más largo.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">7. Sus Derechos</h2>
              <p>Dependiendo de su jurisdicción, usted puede tener los siguientes derechos:</p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li><strong>Acceso:</strong> Solicitar una copia de sus datos personales</li>
                <li><strong>Rectificación:</strong> Corregir información inexacta</li>
                <li><strong>Eliminación:</strong> Solicitar la eliminación de sus datos</li>
                <li><strong>Portabilidad:</strong> Recibir sus datos en formato estructurado</li>
                <li><strong>Oposición:</strong> Oponerse al procesamiento de sus datos</li>
                <li><strong>Retirar consentimiento:</strong> Cuando el procesamiento se base en consentimiento</li>
              </ul>
              <p className="mt-4">
                Para ejercer estos derechos, contáctenos a través del sistema de mensajería de la aplicación.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">8. Cookies y Tecnologías Similares</h2>
              <p>
                Utilizamos cookies y tecnologías similares para mejorar su experiencia. Puede gestionar sus preferencias de 
                cookies a través de la configuración de su navegador. Para más información, consulte nuestra{" "}
                <Link href="/legal/cookies" className="text-blue-400 hover:underline">Política de Cookies</Link>.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">9. Transferencias Internacionales</h2>
              <p>
                Su información puede ser transferida y procesada en países distintos al suyo. Aseguramos que se implementen 
                salvaguardas apropiadas para proteger su información en estas transferencias.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">10. Privacidad de Menores</h2>
              <p>
                El Servicio no está dirigido a menores de 18 años. No recopilamos intencionalmente información personal de 
                menores. Si descubrimos que hemos recopilado información de un menor, la eliminaremos inmediatamente.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">11. Cambios a esta Política</h2>
              <p>
                Podemos actualizar esta Política de Privacidad ocasionalmente. Le notificaremos sobre cambios significativos 
                publicando la nueva política en esta página y actualizando la fecha de "Última actualización".
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">12. Contacto</h2>
              <p>
                Si tiene preguntas sobre esta Política de Privacidad, puede contactarnos a través del sistema de mensajería 
                de la aplicación o visitando nuestra página de <Link href="/legal/contact" className="text-blue-400 hover:underline">Contacto Legal</Link>.
              </p>
            </section>
          </div>
        </div>
    </>
  );
}

