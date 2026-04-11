import { useEffect, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import { FaCheckCircle, FaBolt, FaBrain, FaDumbbell, FaUtensils, FaWhatsapp } from "react-icons/fa";
import LoginModal from "@/components/LoginModal";
import LandingLangToggle from "@/components/LandingLangToggle";
import { useAuthStore } from "@/store/authStore";

export default function TransformacionFitPlanLanding() {
  const router = useRouter();
  const { user: authUser } = useAuthStore();
  const [loginOpen, setLoginOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handlePrimaryCta = () => {
    if (isMounted && authUser) {
      router.push("/dashboard?openPremium=1");
      return;
    }
    setLoginOpen(true);
  };

  const canonical = "https://www.fitplan-ai.com/transformacion-fitplan";
  const canonicalEn = "https://www.fitplan-ai.com/en/transformacion-fitplan";

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "¿FitPlan sirve si soy principiante?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Sí. FitPlan adapta tu entrenamiento y tu alimentación a tu nivel actual, explica cada parte de forma clara y propone progresión semanal.",
        },
      },
      {
        "@type": "Question",
        name: "¿La asesoría del formulario es con una persona real?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Sí. La asesoría es humana 1:1. Tu caso lo revisa una persona del equipo para darte seguimiento personalizado por chat y WhatsApp.",
        },
      },
      {
        "@type": "Question",
        name: "¿Qué pasa si tengo lesiones, patologías o poco tiempo?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "FitPlan adapta entrenamiento, cardio y alimentación a tus limitaciones reales. El objetivo es progreso sostenible, no planes imposibles de seguir.",
        },
      },
      {
        "@type": "Question",
        name: "¿Cuánto cuesta Premium?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Puedes elegir plan mensual (5 EUR), trimestral (12 EUR) o anual (25 EUR). También puedes completar el formulario de asesoría 1:1 para una estrategia totalmente personalizada.",
        },
      },
    ],
  };

  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "FitPlan AI Premium",
    applicationCategory: "HealthApplication",
    operatingSystem: "Web",
    url: canonical,
    description:
      "Plan de alimentación y entrenamiento personalizado con IA y opción de asesoría humana 1:1, adaptado por objetivo, lesiones, nivel y preferencias.",
    offers: [
      { "@type": "Offer", priceCurrency: "EUR", price: "5", name: "Mensual" },
      { "@type": "Offer", priceCurrency: "EUR", price: "12", name: "Trimestral" },
      { "@type": "Offer", priceCurrency: "EUR", price: "25", name: "Anual" },
    ],
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Head>
        <title>FitPlan Transformación 1:1 | Plan Premium + Asesoría Humana Personalizada</title>
        <meta
          name="description"
          content="Transforma tu físico con FitPlan: plan premium de entrenamiento y nutrición + asesoría humana 1:1. Personalizado por objetivo, lesiones, nivel, país y estilo de vida."
        />
        <meta
          name="keywords"
          content="asesoría nutricional online 1 a 1, entrenador personal online, plan de alimentación personalizado, rutina de gimnasio personalizada, bajar grasa corporal, ganar masa muscular, recomposición corporal, asesoría humana fitness, fitplan premium"
        />
        <meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1" />
        <link rel="canonical" href={canonical} />
        <link rel="alternate" hrefLang="es" href={canonical} />
        <link rel="alternate" hrefLang="en-US" href={canonicalEn} />
        <link rel="alternate" hrefLang="x-default" href={canonical} />

        <meta property="og:type" content="website" />
        <meta property="og:locale" content="es_ES" />
        <meta property="og:locale:alternate" content="en_US" />
        <meta property="og:url" content={canonical} />
        <meta property="og:title" content="FitPlan Transformación 1:1 | Premium + Asesoría Humana" />
        <meta
          property="og:description"
          content="Vende resultados: nutrición + entrenamiento personalizados y opción de asesoría humana 1:1 con seguimiento real."
        />

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="FitPlan Transformación 1:1" />
        <meta
          name="twitter:description"
          content="Plan premium y asesoría humana 1:1 para bajar grasa, ganar músculo y sostener resultados."
        />

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
        />
      </Head>

      <LandingLangToggle locale="es" />

      <main className="px-4 md:px-6">
        <section className="max-w-6xl mx-auto pt-14 pb-10">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="rounded-3xl border border-cyan-400/25 bg-gradient-to-br from-cyan-500/10 via-blue-500/10 to-purple-500/10 p-7 md:p-12 text-center"
          >
            <p className="text-cyan-200 text-sm md:text-base mb-3">ESTRATEGIA PREMIUM DE ALTO IMPACTO</p>
            <h1 className="text-3xl md:text-5xl font-extrabold leading-tight">
              Deja de improvisar: consigue un <span className="text-cyan-300">plan que sí puedas sostener</span>
            </h1>
            <p className="text-white/80 mt-5 max-w-3xl mx-auto text-base md:text-lg">
              FitPlan une tecnología + criterio profesional para diseñar tu estrategia exacta de nutrición y entrenamiento.
              Si buscas máxima personalización, también tienes asesoría <strong>humana 1:1</strong> para seguimiento real.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row justify-center gap-3">
              <button
                onClick={handlePrimaryCta}
                className="px-7 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 font-bold text-lg shadow-xl shadow-cyan-500/30"
              >
                Quiero resultados con Premium
              </button>
              <button
                onClick={() => router.push("/formulario-de-inicio")}
                className="px-7 py-3 rounded-xl border border-white/25 bg-white/5 hover:bg-white/10 font-semibold text-lg"
              >
                Solicitar asesoría humana 1:1
              </button>
            </div>
            <p className="text-xs text-white/65 mt-4">
              Planes desde 5 EUR/mes · Estrategia por objetivo real · Asesoría humana opcional
            </p>
          </motion.div>
        </section>

        <section className="max-w-6xl mx-auto py-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { icon: <FaBrain />, title: "Diagnóstico inteligente", text: "Analiza objetivo, dolores, nivel, país, horarios y adherencia antes de planificar." },
            { icon: <FaDumbbell />, title: "Entreno accionable", text: "Cada sesión dice qué músculo trabajas, cómo progresar y qué cardio hacer." },
            { icon: <FaUtensils />, title: "Nutrición realista", text: "Comidas con macros, alternativas locales (España/Argentina) y enfoque sostenible." },
          ].map((item) => (
            <div key={item.title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="text-cyan-300 text-xl">{item.icon}</div>
              <h2 className="font-bold text-lg mt-3">{item.title}</h2>
              <p className="text-white/75 mt-2 text-sm">{item.text}</p>
            </div>
          ))}
        </section>

        <section className="max-w-6xl mx-auto py-10">
          <h2 className="text-2xl md:text-3xl font-bold text-center">Qué recibes al activar Premium</h2>
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              "Plan semanal de comidas con macros orientativos por comida.",
              "Rutina estructurada por días con músculo trabajado por ejercicio.",
              "Cardio recomendado (caminar/correr) con volumen semanal.",
              "Ajustes por dolor, lesiones y antecedentes relevantes.",
              "Sugerencias de suplementación cuando aplica.",
              "Formato claro para compartir con tu cliente (PDF, Word y Excel).",
            ].map((text) => (
              <div key={text} className="rounded-xl border border-white/10 bg-white/[0.03] p-4 flex gap-3 items-start">
                <FaCheckCircle className="text-emerald-300 mt-0.5" />
                <p className="text-white/85 text-sm">{text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="max-w-6xl mx-auto py-4">
          <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-6 md:p-8">
            <h2 className="text-2xl md:text-3xl font-bold">¿Quieres que lo lleve una persona contigo?</h2>
            <p className="text-white/85 mt-2">
              Completa el formulario de inicio y accede a <strong>asesoría humana 1:1</strong>. Tu caso se revisa en detalle
              para acompañarte con seguimiento y ajustes personalizados.
            </p>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-xl border border-white/15 bg-black/20 p-4">
                <p className="font-semibold">Evaluación individual</p>
                <p className="text-sm text-white/75 mt-1">Se analiza contexto, salud, hábitos y objetivo real.</p>
              </div>
              <div className="rounded-xl border border-white/15 bg-black/20 p-4">
                <p className="font-semibold">Estrategia 100% aplicada</p>
                <p className="text-sm text-white/75 mt-1">No teoría: pasos concretos de nutrición, entrenamiento y cardio.</p>
              </div>
              <div className="rounded-xl border border-white/15 bg-black/20 p-4">
                <p className="font-semibold">Seguimiento continuo</p>
                <p className="text-sm text-white/75 mt-1">Ajustes según progreso, adherencia y respuesta real del cuerpo.</p>
              </div>
            </div>
            <button
              onClick={() => router.push("/formulario-de-inicio")}
              className="mt-6 px-7 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold hover:from-emerald-400 hover:to-teal-400 shadow-lg shadow-emerald-500/30"
            >
              Quiero asesoría humana 1:1
            </button>
          </div>
        </section>

        <section className="max-w-6xl mx-auto py-8">
          <div className="rounded-2xl border border-amber-400/30 bg-gradient-to-r from-amber-500/15 to-orange-500/15 p-6 md:p-8">
            <h2 className="text-2xl md:text-3xl font-bold">Oferta Premium FitPlan</h2>
            <p className="text-white/85 mt-2">
              Elige tu plan y empieza hoy con sistema, no con motivación momentánea.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-5">
              <div className="rounded-xl bg-black/25 border border-white/15 p-4">
                <p className="text-sm text-white/70">Mensual</p>
                <p className="text-2xl font-extrabold mt-1">5 EUR</p>
              </div>
              <div className="rounded-xl bg-black/25 border border-white/15 p-4">
                <p className="text-sm text-white/70">Trimestral</p>
                <p className="text-2xl font-extrabold mt-1">12 EUR</p>
              </div>
              <div className="rounded-xl bg-black/25 border border-white/15 p-4">
                <p className="text-sm text-white/70">Anual</p>
                <p className="text-2xl font-extrabold mt-1">25 EUR</p>
              </div>
            </div>
            <button
              onClick={handlePrimaryCta}
              className="mt-6 px-7 py-3 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 font-bold hover:from-amber-300 hover:to-orange-400 inline-flex items-center gap-2 shadow-lg shadow-orange-500/30"
            >
              <FaBolt />
              Activar Premium ahora
            </button>
          </div>
        </section>

        <section className="max-w-6xl mx-auto py-10">
          <h2 className="text-2xl md:text-3xl font-bold text-center">Preguntas frecuentes</h2>
          <div className="mt-6 space-y-3">
            {[
              {
                q: "¿Esto me sirve si estoy empezando desde cero?",
                a: "Sí. El plan está diseñado para ser claro, progresivo y comprensible, incluso sin experiencia previa.",
              },
              {
                q: "¿Se adapta si entreno en casa o no tengo máquinas?",
                a: "Sí. Se adapta por lugar de entrenamiento, material en casa y equipamiento disponible real.",
              },
              {
                q: "¿Qué diferencia hay entre Premium y asesoría 1:1?",
                a: "Premium te da tu sistema completo listo para ejecutar. La asesoría 1:1 añade revisión humana, seguimiento y ajustes personalizados.",
              },
            ].map((item) => (
              <details key={item.q} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <summary className="cursor-pointer font-semibold">{item.q}</summary>
                <p className="text-white/75 mt-2 text-sm">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="max-w-6xl mx-auto pb-14 text-center">
          <div className="rounded-2xl border border-cyan-400/25 bg-cyan-500/10 p-6">
            <h2 className="text-2xl md:text-3xl font-extrabold">Haz que FitPlan venda por ti</h2>
            <p className="text-white/80 mt-2">
              Convierte tráfico frío en clientes premium con una propuesta clara: resultados medibles + acompañamiento real.
            </p>
            <div className="mt-5 flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={handlePrimaryCta}
                className="px-7 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 font-bold"
              >
                Quiero empezar hoy
              </button>
              <a
                href="https://wa.me/34627043397"
                target="_blank"
                rel="noreferrer"
                className="px-7 py-3 rounded-xl border border-white/25 bg-white/5 hover:bg-white/10 font-semibold inline-flex items-center justify-center gap-2"
              >
                <FaWhatsapp />
                Hablar por WhatsApp
              </a>
            </div>
          </div>
        </section>
      </main>

      <LoginModal isOpen={loginOpen} onClose={() => setLoginOpen(false)} locale="es" />
    </div>
  );
}
