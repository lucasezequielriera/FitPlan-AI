import Head from "next/head";
import Navbar from "@/components/Navbar";

export default function LiabilityPage() {
  return (
    <>
      <Head>
        <title>Limitación de Responsabilidad | FitPlan AI</title>
        <meta name="description" content="Limitación de responsabilidad de FitPlan AI" />
      </Head>
      <Navbar />
      <div className="flex-1 max-w-4xl mx-auto px-4 py-12">
          <h1 className="text-4xl font-bold mb-8 bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
            Limitación de Responsabilidad
          </h1>
          <p className="text-sm text-white/60 mb-8">
            Última actualización: {new Date().toLocaleDateString('es-AR', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>

          <div className="prose prose-invert max-w-none space-y-6 text-white/80">
            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">1. Limitación General</h2>
              <p className="text-red-400 font-semibold">
                EN LA MÁXIMA MEDIDA PERMITIDA POR LA LEY APLICABLE, FITPLAN AI Y SUS AFILIADOS NO SERÁN RESPONSABLES 
                POR DAÑOS DIRECTOS, INDIRECTOS, INCIDENTALES, ESPECIALES, CONSECUENTES O PUNITIVOS RESULTANTES DEL USO 
                O IMPOSIBILIDAD DE USAR EL SERVICIO.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">2. Sin Garantías</h2>
              <p>
                El Servicio se proporciona "TAL CUAL" y "SEGÚN DISPONIBILIDAD" sin garantías de ningún tipo, expresas o 
                implícitas, incluyendo pero no limitado a garantías de comerciabilidad, idoneidad para un propósito 
                particular o no infracción.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">3. Resultados No Garantizados</h2>
              <p>
                No garantizamos resultados específicos de salud, fitness o pérdida de peso. Los resultados individuales 
                pueden variar significativamente.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">4. Limitación de Daños</h2>
              <p>
                En ningún caso nuestra responsabilidad total excederá el monto que usted haya pagado por el Servicio en 
                los 12 meses anteriores al evento que dio lugar a la reclamación.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">5. Exclusión de Daños</h2>
              <p>
                No seremos responsables por pérdida de datos, pérdida de beneficios, pérdida de oportunidades comerciales, 
                o cualquier otro daño indirecto o consecuente.
              </p>
            </section>
          </div>
        </div>
    </>
  );
}

