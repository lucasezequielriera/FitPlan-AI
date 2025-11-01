import { useRouter } from "next/router";
import { motion } from "framer-motion";
import Navbar from "@/components/Navbar";

export default function PaymentPending() {
  const router = useRouter();

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] px-4 py-12">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full text-center"
        >
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-yellow-500/20 mb-6">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-yellow-400"></div>
          </div>
          <h1 className="text-3xl font-bold mb-4 text-yellow-400">Pago pendiente</h1>
          <p className="text-lg opacity-80 mb-6">
            Tu pago está siendo procesado. Te notificaremos cuando esté confirmado.
          </p>
          <button
            onClick={() => router.push("/dashboard")}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-medium transition-all shadow-lg shadow-blue-500/20"
          >
            Volver al Dashboard
          </button>
        </motion.div>
      </div>
    </div>
  );
}

