import { useRouter } from "next/router";
import { motion } from "framer-motion";
import Navbar from "@/components/Navbar";
import Seo from "@/components/Seo";

export default function PaymentPending() {
  const router = useRouter();

  return (
    <>
      <Seo
        title="Pago pendiente"
        description="Tu pago en FitPlan está pendiente de confirmación. En cuanto se acredite, tu plan personalizado de alimentación y entrenamiento se activará automáticamente."
        path="/payment/pending"
        noindex
      />
    <div className="min-h-screen">
      <Navbar />
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] px-4 py-12">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full text-center"
        >
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-warning/20 mb-6">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-warning"></div>
          </div>
          <h1 className="font-display text-3xl font-bold mb-4 text-warning">Pago pendiente</h1>
          <p className="text-lg opacity-80 mb-6">
            Tu pago está siendo procesado. Te notificaremos cuando esté confirmado.
          </p>
          <button
            onClick={() => router.push("/dashboard")}
            className="btn btn-primary"
          >
            Volver al Dashboard
          </button>
        </motion.div>
      </div>
    </div>
    </>
  );
}

