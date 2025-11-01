import { useEffect, useCallback, useState } from "react";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import { useAuthStore } from "@/store/authStore";
import { getDbSafe, getAuthSafe } from "@/lib/firebase";
import { collection, query, where, getDocs, limit } from "firebase/firestore";
import Navbar from "@/components/Navbar";
import LoginModal from "@/components/LoginModal";

export default function Home() {
  const router = useRouter();
  const { user: authUser, loading: authLoading } = useAuthStore();
  const [loginModalOpen, setLoginModalOpen] = useState(false);

  const checkUserPlans = useCallback(async () => {
    try {
      const db = getDbSafe();
      const auth = getAuthSafe();
      if (!db || !auth?.currentUser) {
        // Si no hay Firebase configurado o no hay usuario, enviar al form
        router.push("/create-plan");
        return;
      }

      // Verificar si tiene planes guardados
      const q = query(
        collection(db, "planes"),
        where("userId", "==", auth.currentUser.uid),
        limit(1)
      );

      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        // Usuario sin planes, enviar al formulario
        router.push("/create-plan");
      } else {
        // Usuario con planes, enviar al dashboard
        router.push("/dashboard");
      }
    } catch (error) {
      console.error("Error al verificar planes:", error);
      // En caso de error, enviar al form
      router.push("/create-plan");
    }
  }, [router]);

  useEffect(() => {
    if (authLoading) return; // Esperar a que termine la carga

    if (authUser) {
      // Si el usuario está logueado, redirigir inmediatamente sin mostrar la landing
      checkUserPlans();
    }
  }, [authUser, authLoading, checkUserPlans]);

  // Si el usuario está logueado, mostrar loader mientras redirige
  if (authUser && !authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="opacity-70">Redirigiendo...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-4xl w-full text-center"
        >
          {/* Logo y título */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="mb-8"
          >
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 mb-6 shadow-lg shadow-blue-500/30">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-10 h-10 text-white"
              >
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            </div>
            <h1 className="text-5xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent">
              FitPlan AI
            </h1>
            <p className="text-xl md:text-2xl opacity-80 mb-2">
              Plan Nutricional Inteligente
            </p>
            <p className="text-base md:text-lg opacity-60 max-w-2xl mx-auto">
              Crea tu plan de alimentación personalizado con IA. Diseñado específicamente para tus objetivos, preferencias y necesidades.
            </p>
          </motion.div>

          {/* Características */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12"
          >
            {[
              {
                icon: "🤖",
                title: "Potenciado por IA",
                description: "Planes generados con inteligencia artificial para resultados óptimos",
              },
              {
                icon: "📊",
                title: "Totalmente Personalizado",
                description: "Adaptado a tu cuerpo, objetivos y preferencias alimentarias",
              },
              {
                icon: "📱",
                title: "Fácil de Seguir",
                description: "Planes detallados con ingredientes, preparación y listas de compras",
              },
            ].map((feature, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 + idx * 0.1 }}
                className="glass rounded-xl p-6 border border-white/10"
              >
                <div className="text-4xl mb-3">{feature.icon}</div>
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm opacity-70">{feature.description}</p>
              </motion.div>
            ))}
          </motion.div>

          {/* Botones de acción */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            {!authUser ? (
              <>
                <button
                  onClick={() => setLoginModalOpen(true)}
                  className="px-8 py-4 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-semibold text-lg transition-all shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 transform hover:scale-105"
                >
                  Comenzar ahora
              </button>
                <p className="text-sm opacity-60">
                  Inicia sesión para crear y guardar tus planes
                </p>
              </>
            ) : (
              <button
                onClick={() => router.push("/dashboard")}
                className="px-8 py-4 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-semibold text-lg transition-all shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 transform hover:scale-105"
              >
                Ir a mi Dashboard
              </button>
            )}
          </motion.div>

          {/* Información adicional */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="mt-16 pt-8 border-t border-white/10"
          >
            <p className="text-sm opacity-50">
              Diseñado para ayudarte a alcanzar tus objetivos de salud y fitness
            </p>
          </motion.div>
        </motion.div>
      </div>
      <LoginModal 
        isOpen={loginModalOpen} 
        onClose={() => setLoginModalOpen(false)} 
        defaultMode="signup"
      />
    </div>
  );
}
