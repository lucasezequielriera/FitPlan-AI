import Head from "next/head";
import Navbar from "@/components/Navbar";
import Link from "next/link";

export default function DisclaimerPage() {
  return (
    <>
      <Head>
        <title>Descargo de Responsabilidad Médica | FitPlan AI</title>
        <meta name="description" content="Descargo de responsabilidad médica de FitPlan AI" />
      </Head>
      <Navbar />
      <div className="flex-1 max-w-4xl mx-auto px-4 py-12">
          <h1 className="text-4xl font-bold mb-8 bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">
            Descargo de Responsabilidad Médica
          </h1>
          <p className="text-sm text-white/60 mb-8">
            Última actualización: {new Date().toLocaleDateString('es-AR', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>

          <div className="bg-red-500/10 border-2 border-red-500/30 rounded-lg p-6 mb-8">
            <p className="text-red-300 font-semibold text-lg mb-2">
              ⚠️ ADVERTENCIA IMPORTANTE
            </p>
            <p className="text-white/90">
              Los planes generados por FitPlan AI son herramientas informativas y educativas únicamente. 
              NO CONSTITUYEN ASESORAMIENTO MÉDICO, DIAGNÓSTICO O TRATAMIENTO.
            </p>
          </div>

          <div className="prose prose-invert max-w-none space-y-6 text-white/80">
            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">1. No es Asesoramiento Médico</h2>
              <p>
                FitPlan AI proporciona información general sobre nutrición y ejercicio. El contenido generado por nuestra 
                plataforma es únicamente para fines informativos y educativos. No debe ser utilizado como sustituto del 
                asesoramiento, diagnóstico o tratamiento médico profesional.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">2. Consulte Siempre con un Profesional</h2>
              <p className="font-semibold text-yellow-300">
                ANTES de comenzar cualquier plan de alimentación o ejercicio generado por FitPlan AI, debe consultar con:
              </p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li>Un médico o profesional de la salud calificado</li>
                <li>Un nutricionista o dietista registrado</li>
                <li>Un entrenador personal certificado</li>
              </ul>
              <p className="mt-4">
                Esto es especialmente importante si usted:
              </p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li>Tiene condiciones médicas preexistentes (diabetes, hipertensión, enfermedades cardíacas, etc.)</li>
                <li>Está embarazada o amamantando</li>
                <li>Está tomando medicamentos</li>
                <li>Tiene alergias o intolerancias alimentarias</li>
                <li>Ha tenido lesiones previas</li>
                <li>Es menor de 18 años o mayor de 65 años</li>
                <li>Tiene un historial de trastornos alimentarios</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">3. Limitaciones del Servicio</h2>
              <p>FitPlan AI no puede:</p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li>Diagnosticar condiciones médicas</li>
                <li>Prescribir tratamientos médicos</li>
                <li>Reemplazar la atención médica profesional</li>
                <li>Considerar todas las circunstancias médicas individuales</li>
                <li>Garantizar resultados específicos</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">4. Uso bajo su Propio Riesgo</h2>
              <p className="text-red-400 font-semibold">
                USTED ACEPTA QUE EL USO DE FITPLAN AI ES BAJO SU PROPIO RIESGO. No garantizamos que los planes generados 
                sean apropiados para su situación individual, ni garantizamos resultados específicos de salud o fitness.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">5. No Somos Responsables</h2>
              <p>
                FitPlan AI, sus empleados, afiliados y proveedores NO seremos responsables de:
              </p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li>Lesiones o daños resultantes del uso de nuestros planes</li>
                <li>Problemas de salud que puedan surgir del seguimiento de nuestros planes</li>
                <li>Interacciones con medicamentos o condiciones médicas</li>
                <li>Resultados no deseados o efectos secundarios</li>
                <li>Decisiones tomadas basándose en la información proporcionada</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">6. Información de Emergencia</h2>
              <p>
                Si experimenta síntomas graves como dolor en el pecho, dificultad para respirar, mareos severos, o cualquier 
                otro síntoma que considere una emergencia médica, busque atención médica inmediata. NO use FitPlan AI como 
                sustituto de atención médica de emergencia.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">7. Precisión de la Información</h2>
              <p>
                Aunque nos esforzamos por proporcionar información precisa y actualizada, no garantizamos la exactitud, 
                completitud o actualidad de la información proporcionada. La información puede cambiar sin previo aviso.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">8. Alergias e Intolerancias</h2>
              <p>
                Es SU responsabilidad informar sobre alergias e intolerancias alimentarias. Aunque intentamos considerar 
                estas restricciones, no podemos garantizar que todos los ingredientes sugeridos sean seguros para usted. 
                Siempre verifique los ingredientes antes de consumirlos.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">9. Ejercicio y Lesiones</h2>
              <p>
                El ejercicio puede causar lesiones. Es importante:
              </p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li>Calentar adecuadamente antes de ejercitarse</li>
                <li>Usar la forma correcta durante los ejercicios</li>
                <li>Detenerse si experimenta dolor o malestar</li>
                <li>Consultar con un entrenador certificado para aprender técnicas adecuadas</li>
                <li>No exceder sus límites físicos</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">10. Aceptación de Riesgos</h2>
              <p>
                Al utilizar FitPlan AI, usted reconoce y acepta que:
              </p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li>Ha leído y entendido este descargo de responsabilidad</li>
                <li>Comprende los riesgos asociados con planes de alimentación y ejercicio</li>
                <li>Asume toda la responsabilidad por su uso del Servicio</li>
                <li>Exime a FitPlan AI de cualquier responsabilidad por daños resultantes</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">11. Contacto</h2>
              <p>
                Si tiene preguntas sobre este descargo de responsabilidad, puede contactarnos a través del sistema de 
                mensajería de la aplicación o visitando nuestra página de{" "}
                <Link href="/legal/contact" className="text-blue-400 hover:underline">Contacto Legal</Link>.
              </p>
            </section>
          </div>
        </div>
    </>
  );
}

