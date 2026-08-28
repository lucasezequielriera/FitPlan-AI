import { useRouter } from "next/router";
import { motion } from "framer-motion";
import Navbar from "@/components/Navbar";
import Seo from "@/components/Seo";

export default function PaymentFailure() {
  const router = useRouter();

  return (
    <>
      <Seo
        title="Pago no completado"
        description="No se pudo completar el pago en FitPlan. Puedes reintentarlo o usar otro método para acceder a tu plan personalizado de alimentación y entrenamiento."
        path="/payment/failure"
        noindex
      />
    <div className="min-h-screen">
      <Navbar minimal />
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] px-4 py-12">
        <motion.div
          initial={{ y: 12, scale: 0.9 }}
          animate={{ y: 0, scale: 1 }}
          className="max-w-md w-full text-center"
        >
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-danger/20 mb-6">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-10 w-10 text-danger"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
          <h1 className="font-display text-3xl font-bold mb-4 text-danger">Pago rechazado</h1>
          <p className="text-lg opacity-80 mb-6">
            No se pudo procesar tu pago. Por favor intenta de nuevo.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => router.push("/dashboard")}
              className="btn btn-secondary text-sm"
            >
              Volver al Dashboard
            </button>
            <button
              onClick={() => router.back()}
              className="btn btn-primary text-sm"
            >
              Intentar de nuevo
            </button>
          </div>
        </motion.div>
      </div>
    </div>
    </>
  );
}

