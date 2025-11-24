import Head from "next/head";
import Navbar from "@/components/Navbar";
import Link from "next/link";

export default function TermsPage() {
  return (
    <>
      <Head>
        <title>Términos de Servicio | FitPlan AI</title>
        <meta name="description" content="Términos y condiciones de uso de FitPlan AI" />
      </Head>
      <Navbar />
      <div className="flex-1 max-w-4xl mx-auto px-4 py-12">
          <h1 className="text-4xl font-bold mb-8 bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
            Términos de Servicio
          </h1>
          <p className="text-sm text-white/60 mb-8">
            Última actualización: {new Date().toLocaleDateString('es-AR', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>

          <div className="prose prose-invert max-w-none space-y-6 text-white/80">
            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">1. Aceptación de los Términos</h2>
              <p>
                Al acceder y utilizar FitPlan AI ("el Servicio"), usted acepta estar sujeto a estos Términos de Servicio 
                ("Términos"). Si no está de acuerdo con alguna parte de estos términos, no debe utilizar el Servicio.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">2. Descripción del Servicio</h2>
              <p>
                FitPlan AI es una plataforma digital que utiliza inteligencia artificial para generar planes de alimentación 
                y entrenamiento personalizados. El Servicio proporciona información educativa e informativa basada en los datos 
                proporcionados por el usuario.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">3. No es Asesoramiento Médico</h2>
              <p className="text-red-400 font-semibold">
                EL SERVICIO NO CONSTITUYE ASESORAMIENTO MÉDICO, DIAGNÓSTICO O TRATAMIENTO. Los planes generados son herramientas 
                informativas y educativas únicamente. Siempre debe consultar con un profesional de la salud calificado antes 
                de comenzar cualquier plan de alimentación o ejercicio.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">4. Uso del Servicio</h2>
              <p>Usted se compromete a:</p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li>Proporcionar información precisa y completa al utilizar el Servicio</li>
                <li>No utilizar el Servicio para fines ilegales o no autorizados</li>
                <li>No intentar acceder a áreas restringidas del Servicio</li>
                <li>No interferir con el funcionamiento del Servicio</li>
                <li>Mantener la confidencialidad de su cuenta y contraseña</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">5. Cuentas de Usuario</h2>
              <p>
                Usted es responsable de mantener la confidencialidad de su cuenta y contraseña. Usted acepta la responsabilidad 
                de todas las actividades que ocurran bajo su cuenta. Nos reservamos el derecho de suspender o terminar cuentas 
                que violen estos Términos.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">6. Propiedad Intelectual</h2>
              <p>
                Todo el contenido del Servicio, incluyendo pero no limitado a texto, gráficos, logos, iconos, imágenes, y 
                software, es propiedad de FitPlan AI o sus proveedores de contenido y está protegido por leyes de propiedad 
                intelectual internacionales.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">7. Pagos y Suscripciones</h2>
              <p>
                Al suscribirse a nuestro servicio Premium, usted acepta pagar las tarifas aplicables. Los pagos son procesados 
                por terceros (Stripe, MercadoPago) y están sujetos a sus propios términos y condiciones. Las suscripciones se 
                renuevan automáticamente a menos que se cancelen.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">8. Limitación de Responsabilidad</h2>
              <p>
                EN LA MÁXIMA MEDIDA PERMITIDA POR LA LEY, FITPLAN AI NO SERÁ RESPONSABLE POR DAÑOS DIRECTOS, INDIRECTOS, 
                INCIDENTALES, ESPECIALES O CONSECUENTES RESULTANTES DEL USO O IMPOSIBILIDAD DE USAR EL SERVICIO.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">9. Indemnización</h2>
              <p>
                Usted acepta indemnizar y eximir de responsabilidad a FitPlan AI, sus afiliados, y sus empleados de cualquier 
                reclamo, daño, obligación, pérdida, responsabilidad, costo o deuda, y gastos (incluyendo honorarios de abogados) 
                que surjan de su uso del Servicio o violación de estos Términos.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">10. Modificaciones del Servicio</h2>
              <p>
                Nos reservamos el derecho de modificar, suspender o discontinuar el Servicio en cualquier momento, con o sin 
                previo aviso. No seremos responsables ante usted ni ante ningún tercero por cualquier modificación, suspensión 
                o discontinuación del Servicio.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">11. Ley Aplicable</h2>
              <p>
                Estos Términos se regirán e interpretarán de acuerdo con las leyes aplicables, sin tener en cuenta sus 
                disposiciones sobre conflictos de leyes. Cualquier disputa será resuelta en los tribunales competentes.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">12. Cambios en los Términos</h2>
              <p>
                Nos reservamos el derecho de modificar estos Términos en cualquier momento. Los cambios entrarán en vigor 
                inmediatamente después de su publicación. Su uso continuado del Servicio después de los cambios constituye 
                su aceptación de los nuevos Términos.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">13. Contacto</h2>
              <p>
                Si tiene preguntas sobre estos Términos, puede contactarnos a través del sistema de mensajería de la aplicación 
                o visitando nuestra página de <Link href="/legal/contact" className="text-blue-400 hover:underline">Contacto Legal</Link>.
              </p>
            </section>
          </div>
        </div>
    </>
  );
}

