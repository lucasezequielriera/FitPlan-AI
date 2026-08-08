import HomeLanding from "@/components/landing/HomeLanding";
import Seo from "@/components/Seo";

export default function Home() {
  return (
    <>
      <Seo
        title="FitPlan AI | Plan de Alimentación y Entrenamiento con IA"
        description="Crea tu plan de alimentación y entrenamiento personalizado con inteligencia artificial: menú semanal con ingredientes exactos, rutinas de gym, macros y seguimiento."
        path="/"
        esPath="/"
        enPath="/en"
        locale="es"
      />
      <HomeLanding locale="es" />
    </>
  );
}
