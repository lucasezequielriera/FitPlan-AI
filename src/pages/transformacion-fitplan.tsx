import { useEffect, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import { FaCheckCircle, FaBolt, FaBrain, FaDumbbell, FaUtensils, FaWhatsapp } from "react-icons/fa";
import LoginModal from "@/components/LoginModal";
import LandingLangToggle from "@/components/LandingLangToggle";
import { useAuthStore } from "@/store/authStore";
import { trackEvent } from "@/lib/analytics";

export default function TransformacionFitPlanLanding() {
  const router = useRouter();
  const { user: authUser } = useAuthStore();
  const [loginOpen, setLoginOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    trackEvent("view_content", {
      content_name: "transformacion-fitplan",
      content_language: "es",
      content_category: "landing",
    });
  }, []);

  const handlePrimaryCta = () => {
    trackEvent("begin_checkout", {
      source: "transformacion-fitplan-es",
      plan_type: "premium",
      currency: "EUR",
    });
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
        <section className="max-w-6xl mx-auto pt-10 pb-6">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="rounded-3xl border border-cyan-400/25 bg-gradient-to-br from-blue-500/14 via-cyan-500/10 to-emerald-500/12 p-6 md:p-10"
          >
            <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-8 items-center">
              <div>
                <p className="text-cyan-200 text-xs md:text-sm mb-3 tracking-wide">PLAN DE TRANSFORMACIÓN FITPLAN · 90 DÍAS</p>
                <h1 className="text-3xl md:text-5xl font-extrabold leading-tight">
                  Transforma tu cuerpo con <span className="text-cyan-300">FitPlan</span> en 90 días, sin improvisar
                </h1>
                <p className="text-white/80 mt-5 max-w-3xl text-base md:text-lg">
                  Un sistema claro de nutrición + entrenamiento adaptado a tu objetivo, tu tiempo real y tu nivel.
                  Si necesitas precisión máxima, añade asesoría humana 1:1.
                </p>
                <div className="mt-4 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full border border-cyan-300/35 bg-cyan-500/15 px-3 py-1 text-cyan-100">Nutrición personalizada</span>
                  <span className="rounded-full border border-emerald-300/35 bg-emerald-500/15 px-3 py-1 text-emerald-100">Entrenamiento progresivo</span>
                  <span className="rounded-full border border-white/25 bg-white/10 px-3 py-1 text-white/90">Seguimiento y continuidad</span>
                </div>
                <div className="mt-7 flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={handlePrimaryCta}
                    className="px-7 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-400 hover:to-cyan-400 font-bold text-lg shadow-xl shadow-cyan-500/30"
                  >
                    Activar FitPlan Premium
                  </button>
                  <button
                    onClick={() => router.push("/formulario-de-inicio")}
                    className="px-7 py-3 rounded-xl border border-white/25 bg-white/5 hover:bg-white/10 font-semibold text-lg"
                  >
                    Quiero asesoría 1:1
                  </button>
                </div>
                <p className="text-xs text-white/65 mt-4">
                  Desde 5 EUR/mes · Sin permanencia · Diseñado para resultados sostenibles
                </p>
              </div>

              <div className="rounded-2xl border border-white/15 bg-black/25 p-5">
                <p className="text-sm font-semibold text-white/90">Lo que notarás en tus primeras semanas con FitPlan:</p>
                <div className="mt-4 space-y-3 text-sm text-white/80">
                  <div className="flex items-start gap-2">
                    <FaCheckCircle className="text-emerald-300 mt-0.5" />
                    <span>Sabes qué comer y qué entrenar cada día sin perder tiempo.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <FaCheckCircle className="text-emerald-300 mt-0.5" />
                    <span>Eliminas la sensación de estancamiento por falta de estructura.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <FaCheckCircle className="text-emerald-300 mt-0.5" />
                    <span>Tu plan se ajusta cuando cambian tus horarios o contexto.</span>
                  </div>
                </div>
                <div className="mt-5 rounded-xl border border-cyan-400/25 bg-cyan-500/10 p-3 text-xs text-cyan-100">
                  En menos de 10 minutos puedes tener tu hoja de ruta lista para ejecutar.
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        <section className="max-w-6xl mx-auto py-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { icon: <FaBrain />, title: "Diagnóstico de contexto", text: "Objetivo, nivel, lesiones, tiempo y adherencia: planifica según tu vida real, no según un ideal." },
            { icon: <FaDumbbell />, title: "Entreno accionable", text: "Sesiones claras, músculo trabajado, progreso y cardio recomendado para generar resultados sostenibles." },
            { icon: <FaUtensils />, title: "Nutrición aplicable", text: "Comidas con macros orientativos y estructura flexible para cumplir sin vivir en modo dieta extrema." },
          ].map((item) => (
            <div key={item.title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="text-cyan-300 text-xl">{item.icon}</div>
              <h2 className="font-bold text-lg mt-3">{item.title}</h2>
              <p className="text-white/75 mt-2 text-sm">{item.text}</p>
            </div>
          ))}
        </section>

        <section className="max-w-6xl mx-auto py-10">
          <h2 className="text-2xl md:text-3xl font-bold text-center">Esto es lo que compras: claridad + ejecución + seguimiento</h2>
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              "Plan semanal de nutrición con distribución de macros por comida.",
              "Rutina estructurada con foco muscular por ejercicio.",
              "Recomendación de cardio y volumen semanal según objetivo.",
              "Ajustes por lesiones, dolor, limitaciones y contexto de vida.",
              "Historial y continuidad para que no vuelvas a empezar de cero.",
              "Exportación y formato claro para consulta rápida desde el móvil.",
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
            <h2 className="text-2xl md:text-3xl font-bold">Si quieres más precisión: asesoría humana 1:1</h2>
            <p className="text-white/85 mt-2">
              Para casos con objetivos exigentes, estancamiento, lesiones o necesidad de acompañamiento más cercano.
              Tu caso se revisa en detalle y se ajusta con criterio profesional.
            </p>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-xl border border-white/15 bg-black/20 p-4">
                <p className="font-semibold">Evaluación individual</p>
                <p className="text-sm text-white/75 mt-1">Contexto, salud, hábitos y puntos críticos antes de decidir estrategia.</p>
              </div>
              <div className="rounded-xl border border-white/15 bg-black/20 p-4">
                <p className="font-semibold">Plan aplicado a tu realidad</p>
                <p className="text-sm text-white/75 mt-1">Pasos concretos para nutrición, entreno y adherencia semanal.</p>
              </div>
              <div className="rounded-xl border border-white/15 bg-black/20 p-4">
                <p className="font-semibold">Seguimiento y ajuste</p>
                <p className="text-sm text-white/75 mt-1">Correcciones en función de progreso real, no suposiciones.</p>
              </div>
            </div>
            <button
              onClick={() => router.push("/formulario-de-inicio")}
              className="mt-6 px-7 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold hover:from-emerald-400 hover:to-teal-400 shadow-lg shadow-emerald-500/30"
            >
              Solicitar asesoría 1:1
            </button>
          </div>
        </section>

        <section className="max-w-6xl mx-auto py-8">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 md:p-8 mb-6">
            <h2 className="text-2xl md:text-3xl font-bold text-center">FitPlan Premium vs Asesoría 1:1</h2>
            <p className="text-center text-white/75 mt-2 text-sm">
              Elige el nivel de acompañamiento según tu punto actual y velocidad de avance.
            </p>
            <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-cyan-400/25 bg-cyan-500/10 p-4">
                <p className="text-sm font-semibold text-cyan-200">FitPlan Premium</p>
                <ul className="mt-2 space-y-1 text-sm text-white/85">
                  <li>- Plan completo de nutrición + entrenamiento listo para ejecutar.</li>
                  <li>- Ideal si eres autónomo y necesitas estructura clara.</li>
                  <li>- Mejor relación precio/valor para la mayoría.</li>
                </ul>
              </div>
              <div className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 p-4">
                <p className="text-sm font-semibold text-emerald-200">Asesoría humana 1:1</p>
                <ul className="mt-2 space-y-1 text-sm text-white/85">
                  <li>- Revisión personalizada del caso por una persona del equipo.</li>
                  <li>- Ideal si vienes estancado, con lesiones o objetivo exigente.</li>
                  <li>- Acompañamiento y ajustes más finos en el proceso.</li>
                </ul>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-amber-400/30 bg-gradient-to-r from-amber-500/15 to-orange-500/15 p-6 md:p-8">
            <h2 className="text-2xl md:text-3xl font-bold">Oferta Premium FitPlan</h2>
            <p className="text-white/85 mt-2">Elige plan y empieza hoy con un sistema que puedes mantener en el tiempo.</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-5">
              <div className="rounded-xl bg-black/25 border border-white/15 p-4">
                <p className="text-sm text-white/70">Mensual</p>
                <p className="text-2xl font-extrabold mt-1">5 EUR</p>
              </div>
              <div className="rounded-xl bg-black/25 border border-white/15 p-4 ring-1 ring-amber-400/40">
                <p className="text-sm text-white/70">Trimestral</p>
                <p className="text-2xl font-extrabold mt-1">12 EUR</p>
                <p className="text-xs text-white/55 mt-1">Mejor relación precio / resultado</p>
              </div>
              <div className="rounded-xl bg-black/25 border border-white/15 p-4">
                <p className="text-sm text-white/70">Anual</p>
                <p className="text-2xl font-extrabold mt-1">25 EUR</p>
              </div>
            </div>
            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <button
                onClick={handlePrimaryCta}
                className="px-7 py-3 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 font-bold hover:from-amber-300 hover:to-orange-400 inline-flex items-center justify-center gap-2 shadow-lg shadow-orange-500/30"
              >
                <FaBolt />
                Activar FitPlan Premium
              </button>
              <a
                href="https://wa.me/34627043397"
                target="_blank"
                rel="noreferrer"
                className="px-7 py-3 rounded-xl border border-white/25 bg-white/5 hover:bg-white/10 font-semibold inline-flex items-center justify-center gap-2"
              >
                <FaWhatsapp />
                Resolver dudas por WhatsApp
              </a>
            </div>
          </div>
        </section>

        <section className="max-w-6xl mx-auto py-10">
          <h2 className="text-2xl md:text-3xl font-bold text-center">Preguntas frecuentes antes de comprar</h2>
          <div className="mt-6 space-y-3">
            {[
              {
                q: "¿Funciona si soy principiante total?",
                a: "Sí. El sistema está pensado para empezar con claridad y progresar sin sobrecarga ni confusión.",
              },
              {
                q: "¿Y si entreno en casa o tengo poco material?",
                a: "Se adapta al contexto disponible. No necesitas un gimnasio perfecto para tener un plan útil.",
              },
              {
                q: "¿Premium reemplaza la asesoría 1:1?",
                a: "Premium te da estrategia completa para ejecutar. La asesoría 1:1 suma revisión humana y ajustes más finos.",
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
            <h2 className="text-2xl md:text-3xl font-extrabold">Empieza hoy con FitPlan</h2>
            <p className="text-white/80 mt-2">
              Menos caos, más dirección. Si quieres resultados reales, necesitas un sistema ejecutable.
            </p>
            <div className="mt-5 flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={handlePrimaryCta}
                className="px-7 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 font-bold"
              >
                Quiero empezar hoy
              </button>
              <button
                onClick={() => router.push("/formulario-de-inicio")}
                className="px-7 py-3 rounded-xl border border-white/25 bg-white/5 hover:bg-white/10 font-semibold"
              >
                Ir a asesoría 1:1
              </button>
            </div>
          </div>
        </section>
      </main>

      <LoginModal isOpen={loginOpen} onClose={() => setLoginOpen(false)} defaultMode="signup" locale="es" />
    </div>
  );
}
