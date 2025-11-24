import Head from "next/head";
import Navbar from "@/components/Navbar";

export default function RefundPage() {
  return (
    <>
      <Head>
        <title>Política de Reembolsos | FitPlan AI</title>
        <meta name="description" content="Política de reembolsos de FitPlan AI" />
      </Head>
      <Navbar />
      <div className="flex-1 max-w-4xl mx-auto px-4 py-12">
          <h1 className="text-4xl font-bold mb-8 bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
            Política de Reembolsos
          </h1>
          <p className="text-sm text-white/60 mb-8">
            Última actualización: {new Date().toLocaleDateString('es-AR', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>

          <div className="prose prose-invert max-w-none space-y-6 text-white/80">
            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">1. Política General</h2>
              <p>
                FitPlan AI ofrece planes de suscripción Premium. Entendemos que las circunstancias pueden cambiar, y 
                evaluamos las solicitudes de reembolso caso por caso.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">2. Período de Reembolso</h2>
              <p>
                Las solicitudes de reembolso deben realizarse dentro de los 7 días posteriores a la compra inicial. 
                Después de este período, los reembolsos se evaluarán según las circunstancias individuales.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">3. Proceso de Reembolso</h2>
              <p>
                Para solicitar un reembolso, contáctenos a través del sistema de mensajería de la aplicación. 
                Procesaremos su solicitud dentro de 5-10 días hábiles.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">4. Reembolsos Parciales</h2>
              <p>
                En algunos casos, podemos ofrecer reembolsos parciales basados en el tiempo de uso del servicio 
                antes de la solicitud.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">5. Método de Reembolso</h2>
              <p>
                Los reembolsos se procesarán utilizando el mismo método de pago utilizado para la compra original. 
                El tiempo de procesamiento puede variar según el proveedor de pagos.
              </p>
            </section>
          </div>
        </div>
    </>
  );
}

