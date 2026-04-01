import { useEffect, useCallback, useState } from "react";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import { FaAppleAlt, FaRocket } from "react-icons/fa";
import { useAuthStore } from "@/store/authStore";
import { getDbSafe, getAuthSafe } from "@/lib/firebase";
import { collection, query, where, getDocs, limit } from "firebase/firestore";
import Navbar from "@/components/Navbar";
import LoginModal from "@/components/LoginModal";
import Head from "next/head";

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

      // Primero verificar si es administrador
      // Verificar el email de Firebase Auth primero (disponible inmediatamente)
      const authEmail = auth.currentUser.email?.toLowerCase() || "";
      if (authEmail === "admin@fitplan-ai.com") {
        router.push("/admin");
        return;
      }

      // Si no es admin por email de Auth, verificar en Firestore
      const { doc, getDoc } = await import("firebase/firestore");
      const userRef = doc(db, "usuarios", auth.currentUser.uid);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const email = userData.email?.toLowerCase() || "";
        const nombreLower = userData.nombre?.toLowerCase() || "";
        const isAdmin = email === "admin@fitplan-ai.com" || nombreLower === "administrador";
        
        if (isAdmin) {
          router.push("/admin");
          return;
        }
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
      <Head>
        <title>FitPlan AI | Plan de Alimentación y Entrenamiento Personalizado con IA</title>
        <meta name="description" content="Creá tu plan de alimentación y entrenamiento personalizado con inteligencia artificial. Menús semanales con ingredientes exactos, rutinas de gym adaptadas a tu nivel, cálculo de macros, seguimiento de progreso y descarga en PDF. Diseñado por nutricionistas y entrenadores profesionales." />
        <meta name="keywords" content="plan nutricional personalizado, plan de entrenamiento con IA, dieta personalizada, rutina de gym, macros, calorías, entrenamiento personalizado, bajar de peso, ganar masa muscular, perder grasa, recomposición corporal, alimentación saludable, nutricionista online, entrenador personal, plan alimenticio, dieta saludable, fitness, nutrición deportiva, plan de comidas semanal" />
        <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
        <link rel="canonical" href="https://www.fitplan-ai.com/" />
        <link rel="alternate" hrefLang="es" href="https://www.fitplan-ai.com/" />
        <link rel="alternate" hrefLang="en-US" href="https://www.fitplan-ai.com/en/transformacion-fitplan" />

        {/* Open Graph */}
        <meta property="og:title" content="FitPlan AI | Alimentación y Entrenamiento Personalizado con IA" />
        <meta property="og:description" content="Planes de alimentación y entrenamiento personalizados por nutricionistas y entrenadores profesionales, potenciados con inteligencia artificial. Empezá gratis." />
        <meta property="og:url" content="https://www.fitplan-ai.com/" />

        {/* Twitter Card */}
        <meta name="twitter:title" content="FitPlan AI | Alimentación y Entrenamiento Personalizado con IA" />
        <meta name="twitter:description" content="Alimentación + entrenamiento personalizados por expertos y potenciados con IA. Empezá gratis." />

        {/* JSON-LD: Organization */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "FitPlan AI",
              url: "https://www.fitplan-ai.com",
              logo: "https://www.fitplan-ai.com/brand/icon-social.png",
              description: "Plataforma de planes de alimentación y entrenamiento personalizados con inteligencia artificial.",
              founder: {
                "@type": "Person",
                name: "Lucas Riera",
                url: "https://www.lucasriera.com",
                jobTitle: "Web Developer & Designer",
              },
              contactPoint: {
                "@type": "ContactPoint",
                email: "fitplanai.oficial@gmail.com",
                contactType: "customer service",
                availableLanguage: ["Spanish", "English"],
              },
              sameAs: [],
            })
          }}
        />
        {/* JSON-LD: WebSite with SearchAction */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: "FitPlan AI",
              alternateName: "FitPlan AI - Plan Nutricional y Entrenamiento Inteligente",
              url: "https://www.fitplan-ai.com/",
            })
          }}
        />
        {/* JSON-LD: SoftwareApplication */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              name: "FitPlan AI",
              applicationCategory: "HealthApplication",
              operatingSystem: "Web",
              description: "Creá tu plan de alimentación y entrenamiento personalizado con inteligencia artificial. Diseñado por nutricionistas certificados y entrenadores profesionales.",
              offers: {
                "@type": "Offer",
                price: "0",
                priceCurrency: "ARS",
                description: "Plan gratuito por 30 días",
              },
              aggregateRating: {
                "@type": "AggregateRating",
                ratingValue: "4.8",
                ratingCount: "150",
                bestRating: "5",
                worstRating: "1",
              },
              featureList: [
                "Plan de alimentación semanal personalizado",
                "Rutinas de entrenamiento adaptadas a tu nivel",
                "Cálculo automático de macronutrientes",
                "Seguimiento de progreso",
                "Descarga en PDF",
                "Lista de compras automática",
              ],
            })
          }}
        />
        {/* JSON-LD: FAQPage */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "FAQPage",
              mainEntity: [
                {
                  "@type": "Question",
                  name: "¿Qué es FitPlan AI?",
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: "FitPlan AI es una plataforma que crea planes de alimentación y entrenamiento personalizados usando inteligencia artificial. Los planes están diseñados por nutricionistas certificados y entrenadores profesionales.",
                  },
                },
                {
                  "@type": "Question",
                  name: "¿Es gratis usar FitPlan AI?",
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: "Sí, podés crear tu primer plan de forma gratuita y acceder a él durante 30 días. Después de ese período, necesitás una suscripción premium para seguir accediendo a tu plan.",
                  },
                },
                {
                  "@type": "Question",
                  name: "¿Cómo funciona el plan de alimentación?",
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: "Completás un formulario con tus datos personales, objetivos y preferencias alimentarias. La IA genera un plan semanal detallado con recetas, ingredientes exactos, calorías y macronutrientes adaptados a vos.",
                  },
                },
                {
                  "@type": "Question",
                  name: "¿El plan incluye rutina de entrenamiento?",
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: "Sí, FitPlan AI genera una rutina de entrenamiento personalizada según tu nivel de experiencia, objetivos y días disponibles para entrenar.",
                  },
                },
              ],
            })
          }}
        />
      </Head>
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
              <FaAppleAlt className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-5xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent">
              FitPlan AI
            </h1>
            <p className="text-xl md:text-2xl opacity-80 mb-2">
              Plan de Alimentación y Entrenamiento Inteligente
            </p>
            <p className="text-base md:text-lg opacity-60 max-w-2xl mx-auto">
              Crea tu plan de alimentación y entrenamiento personalizado con IA. Diseñado específicamente para tus objetivos, preferencias y necesidades por nutricionistas y entrenadores profesionales.
            </p>
          </motion.div>

          {/* Botones de acción */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12"
          >
            {!authUser ? (
              <>
                <button
                  onClick={() => setLoginModalOpen(true)}
                  className="px-8 py-4 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-semibold text-lg transition-all shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 transform hover:scale-105"
                >
                  Comenzar ahora
                </button>
                <button
                  onClick={() => setLoginModalOpen(true)}
                  className="group px-8 py-4 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 hover:from-amber-400 hover:via-orange-400 hover:to-red-400 text-white font-bold text-lg transition-all shadow-lg shadow-orange-500/40 hover:shadow-xl hover:shadow-orange-500/60 transform hover:scale-105 border border-white/20"
                >
                  <span className="inline-flex items-center gap-2">
                    <FaRocket className="group-hover:translate-x-0.5 transition-transform" />
                    Activar Premium y transformar mi cuerpo
                  </span>
                </button>
                <p className="text-sm opacity-60">
                  Inicia sesión para crear, guardar tu plan y activar Premium
                </p>
              </>
            ) : (
              <>
                <button
                  onClick={() => router.push("/dashboard")}
                  className="px-8 py-4 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-semibold text-lg transition-all shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 transform hover:scale-105"
                >
                  Ir a mi Dashboard
                </button>
                <button
                  onClick={() => router.push("/dashboard?openPremium=1")}
                  className="group px-8 py-4 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 hover:from-amber-400 hover:via-orange-400 hover:to-red-400 text-white font-bold text-lg transition-all shadow-lg shadow-orange-500/40 hover:shadow-xl hover:shadow-orange-500/60 transform hover:scale-105 border border-white/20"
                >
                  <span className="inline-flex items-center gap-2">
                    <FaRocket className="group-hover:translate-x-0.5 transition-transform" />
                    Empezar mi transformación Premium
                  </span>
                </button>
              </>
            )}
          </motion.div>

          {/* Sección destacada: Expertos + IA */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.6 }}
            className="mb-12 w-full"
          >
            <div className="relative rounded-2xl p-8 md:p-10 bg-gradient-to-br from-emerald-500/20 via-cyan-500/20 to-blue-500/20 border-2 border-emerald-400/30 shadow-xl shadow-emerald-500/10 overflow-hidden">
              {/* Efecto de brillo animado */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent shimmer-animation"></div>
              
              <div className="relative z-10 text-center">
                <div className="flex items-center justify-center gap-4 mb-4">
                  <div className="text-5xl">👨‍⚕️</div>
                  <div className="text-5xl">🤖</div>
                  <div className="text-5xl">💪</div>
                </div>
                <h2 className="text-2xl md:text-3xl font-bold mb-3 bg-gradient-to-r from-emerald-300 via-cyan-300 to-blue-300 bg-clip-text text-transparent">
                  Creado por Expertos, Potenciado por IA
                </h2>
                <p className="text-base md:text-lg opacity-90 max-w-2xl mx-auto leading-relaxed">
                  Nuestros planes de <strong className="text-emerald-300">alimentación</strong> y <strong className="text-cyan-300">entrenamiento</strong> están desarrollados por <strong className="text-white">nutricionistas certificados</strong> y <strong className="text-white">entrenadores profesionales</strong>, y potenciados con <strong className="text-blue-300">inteligencia artificial</strong> para darte el plan más preciso y efectivo.
                </p>
                <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-sm md:text-base">
                  <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/20 border border-emerald-400/30">
                    <span className="text-emerald-300">✓</span>
                    <span className="opacity-90">Nutricionistas Certificados</span>
                  </div>
                  <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500/20 border border-cyan-400/30">
                    <span className="text-cyan-300">✓</span>
                    <span className="opacity-90">Entrenadores Profesionales</span>
                  </div>
                  <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500/20 border border-blue-400/30">
                    <span className="text-blue-300">✓</span>
                    <span className="opacity-90">Potenciado con IA</span>
                  </div>
                </div>
            </div>
            </div>
          </motion.div>

          {/* Características */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8"
          >
            {[
              {
                icon: "💬",
                title: "Asistencia 24/7",
                description: "Chat de ayuda disponible con asistente humano y asistencia de IA para resolver todas tus dudas",
              },
              {
                icon: "📊",
                title: "Totalmente Personalizado",
                description: "Adaptado a tu cuerpo, objetivos, preferencias alimentarias y nivel de entrenamiento",
              },
              {
                icon: "📱",
                title: "Fácil de Seguir",
                description: "Planes detallados con ingredientes, preparación, rutinas de entrenamiento y listas de compras",
              },
            ].map((feature, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9 + idx * 0.1 }}
                className="glass rounded-xl p-6 border border-white/10"
              >
                <div className="text-4xl mb-3">{feature.icon}</div>
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm opacity-70">{feature.description}</p>
              </motion.div>
            ))}
          </motion.div>

          {/* Información adicional */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="mt-16 pt-8 border-t border-white/10"
          >
            <p className="text-sm opacity-50">
              Diseñado por expertos para ayudarte a alcanzar tus objetivos de salud y fitness con planes de alimentación y entrenamiento personalizados
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
