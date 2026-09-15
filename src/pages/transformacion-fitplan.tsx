import { useEffect, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { motion, useReducedMotion } from "framer-motion";
import { FaCheckCircle, FaBolt, FaBrain, FaDumbbell, FaUtensils, FaWhatsapp } from "react-icons/fa";
import LoginModal from "@/components/LoginModal";
import LandingLangToggle from "@/components/LandingLangToggle";
import { useAuthStore } from "@/store/authStore";
import { trackEvent } from "@/lib/analytics";
import { getPlanSavingsLabel, getStripeSubscriptionPlans, PLANS_EUR_UI } from "@/lib/stripePlanPrices";

/** Precio publicado en esta landing · siempre el de stripePlanPrices.ts, nunca escrito a mano. */
const EUR_PLANS = getStripeSubscriptionPlans("eur");

export default function TransformacionFitPlanLanding() {
  const router = useRouter();
  const { user: authUser } = useAuthStore();
  const [loginOpen, setLoginOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const reduceMotion = useReducedMotion();
  // NO devolver `initial: { opacity: 0 }` acá — ver HomeLanding.tsx para el motivo
  // (la landing quedó en blanco en producción dos veces por ese patrón).
  const fadeUp = reduceMotion ? { initial: false as const } : { initial: { y: 12 }, animate: { y: 0 } };

  useEffect(() => {
    // isMounted evita mismatches de hidratación en contenido client-only;
    // no hay alternativa sin useSyncExternalStore para este caso puntual.
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
          text: `Hay plan mensual (${EUR_PLANS.monthly.price} EUR), trimestral (${EUR_PLANS.quarterly.price} EUR) o anual (${EUR_PLANS.annual.price} EUR). También hay completar el formulario de asesoría 1:1 para una estrategia totalmente personalizada.`,
        },
      },
    ],
  };

  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "FitPlan Premium",
    applicationCategory: "HealthApplication",
    operatingSystem: "Web",
    url: canonical,
    description:
      "Plan de alimentación y entrenamiento personalizado con IA y opción de asesoría humana 1:1, adaptado por objetivo, lesiones, nivel y preferencias.",
    // Derivado de stripePlanPrices.ts: estos precios los indexa Google, así que
    // si divergen del checkout quedan dos precios publicados a la vez.
    offers: (["monthly", "quarterly", "annual"] as const).map((key) => ({
      "@type": "Offer",
      priceCurrency: "EUR",
      price: String(getStripeSubscriptionPlans("eur")[key].price),
      name: PLANS_EUR_UI[key].name.replace("Plan ", ""),
    })),
  };

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <Head>
        <title>FitPlan Transformación 1:1 | Plan Premium + Asesoría Humana Personalizada</title>
        <meta
          name="description"
          content="Transforma tu físico con FitPlan: plan premium de entrenamiento y nutrición con asesoría humana 1:1, adaptado a tu objetivo, nivel, lesiones y estilo de vida."
        />
        <meta
          name="keywords"
          content="asesoría nutricional online 1 a 1, entrenador personal online, plan de alimentación personalizado, rutina de gimnasio personalizada, bajar grasa corporal, ganar masa muscular, recomposición corporal, asesoría humana fitness, fitplan premium"
        />
        <meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1" />
        {/* Un solo canonical y un solo juego de hreflang por página: antes había
            dos bloques (uno hardcodeado y otro por variable) declarando lo mismo
            con códigos distintos (en / en-US). Se usa `en`, igual que Seo.tsx y
            sitemap.xml, para que las anotaciones coincidan y Google valide la
            reciprocidad entre /transformacion-fitplan y /en/transformacion-fitplan. */}
        <link rel="canonical" href={canonical} />
        <link rel="alternate" hrefLang="es" href={canonical} />
        <link rel="alternate" hrefLang="en" href={canonicalEn} />
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
            {...fadeUp}
            transition={{ duration: 0.5 }}
            className="rounded-3xl border border-[var(--landing-border)] bg-gradient-to-br from-[var(--landing-surface)] to-[color-mix(in_oklab,var(--landing-accent)_8%,transparent)] p-6 md:p-10"
          >
            <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-8 items-center">
              <div>
                <p className="text-[var(--landing-accent)] text-xs md:text-sm mb-3 font-semibold uppercase tracking-wider">
                  Plan de transformación FitPlan · 90 días
                </p>
                <h1 className="text-3xl md:text-5xl font-extrabold leading-tight text-[var(--foreground)]">
                  Transforma tu cuerpo con <span className="text-[var(--landing-accent)]">FitPlan</span> en 90 días, sin improvisar
                </h1>
                <p className="text-[var(--landing-muted)] mt-5 max-w-3xl text-base md:text-lg">
                  Un sistema claro de nutrición + entrenamiento adaptado a tu objetivo, tu tiempo real y tu nivel.
                  Si necesitas precisión máxima, añade asesoría humana 1:1.
                </p>
                <div className="mt-4 flex flex-wrap gap-2 text-xs">
                  {["Nutrición personalizada", "Entrenamiento progresivo", "Seguimiento y continuidad"].map((t) => (
                    <span
                      key={t}
                      className="rounded-full border border-[var(--landing-border)] bg-[var(--landing-surface)] px-3 py-1 text-[var(--landing-muted)] font-medium"
                    >
                      {t}
                    </span>
                  ))}
                </div>
                <div className="mt-7 flex flex-col sm:flex-row gap-3">
                  <button onClick={handlePrimaryCta} className="btn btn-primary px-7 py-3 text-lg">
                    Activar FitPlan Premium
                  </button>
                  <button
                    onClick={() => router.push("/formulario-de-inicio")}
                    className="btn btn-secondary px-7 py-3 text-lg"
                  >
                    Quiero asesoría 1:1
                  </button>
                </div>
                <p className="text-xs text-[var(--landing-muted)] mt-4">
                  Desde {EUR_PLANS.monthly.price} EUR/mes · Sin permanencia · Diseñado para resultados sostenibles
                </p>
              </div>

              <div className="card-surface-2 rounded-2xl p-5">
                <p className="text-sm font-semibold text-[var(--foreground)]">Lo que notarás en tus primeras semanas con FitPlan:</p>
                <div className="mt-4 space-y-3 text-sm text-[var(--landing-muted)]">
                  {[
                    "Qué comer y qué entrenar cada día, sin perder tiempo decidiéndolo.",
                    "Eliminas la sensación de estancamiento por falta de estructura.",
                    "Tu plan se ajusta cuando cambian tus horarios o contexto.",
                  ].map((t) => (
                    <div key={t} className="flex items-start gap-2">
                      <FaCheckCircle className="text-[var(--landing-accent)] mt-0.5 shrink-0" aria-hidden />
                      <span>{t}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-5 rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface)] p-3 text-xs text-[var(--landing-muted)]">
                  En menos de 10 minutos, la hoja de ruta está lista para ejecutar.
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
            <div key={item.title} className="card-surface rounded-2xl p-5">
              <div className="text-[var(--landing-accent)] text-xl">{item.icon}</div>
              <h2 className="font-bold text-lg mt-3 text-[var(--foreground)]">{item.title}</h2>
              <p className="text-[var(--landing-muted)] mt-2 text-sm">{item.text}</p>
            </div>
          ))}
        </section>

        <section className="max-w-6xl mx-auto py-10">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-[var(--foreground)]">
            Esto es lo que compras: claridad + ejecución + seguimiento
          </h2>
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              "Plan semanal de nutrición con distribución de macros por comida.",
              "Rutina estructurada con foco muscular por ejercicio.",
              "Recomendación de cardio y volumen semanal según objetivo.",
              "Ajustes por lesiones, dolor, limitaciones y contexto de vida.",
              "Historial y continuidad para que no vuelvas a empezar de cero.",
              "Exportación y formato claro para consulta rápida desde el móvil.",
            ].map((text) => (
              <div key={text} className="card-surface-2 rounded-xl p-4 flex gap-3 items-start">
                <FaCheckCircle className="text-[var(--landing-accent)] mt-0.5 shrink-0" aria-hidden />
                <p className="text-[var(--foreground)] text-sm">{text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="max-w-6xl mx-auto py-4">
          <div className="card-surface rounded-2xl p-6 md:p-8">
            <h2 className="text-2xl md:text-3xl font-bold text-[var(--foreground)]">Si quieres más precisión: asesoría humana 1:1</h2>
            <p className="text-[var(--landing-muted)] mt-2">
              Para casos con objetivos exigentes, estancamiento, lesiones o necesidad de acompañamiento más cercano.
              Tu caso se revisa en detalle y se ajusta con criterio profesional.
            </p>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                { t: "Evaluación individual", d: "Contexto, salud, hábitos y puntos críticos antes de decidir estrategia." },
                { t: "Plan aplicado a tu realidad", d: "Pasos concretos para nutrición, entreno y adherencia semanal." },
                { t: "Seguimiento y ajuste", d: "Correcciones en función de progreso real, no suposiciones." },
              ].map((item) => (
                <div key={item.t} className="card-surface-2 rounded-xl p-4">
                  <p className="font-semibold text-[var(--foreground)]">{item.t}</p>
                  <p className="text-sm text-[var(--landing-muted)] mt-1">{item.d}</p>
                </div>
              ))}
            </div>
            <button
              onClick={() => router.push("/formulario-de-inicio")}
              className="btn btn-secondary mt-6"
            >
              Solicitar asesoría 1:1
            </button>
          </div>
        </section>

        <section className="max-w-6xl mx-auto py-8">
          <div className="card-surface-2 rounded-2xl p-6 md:p-8 mb-6">
            <h2 className="text-2xl md:text-3xl font-bold text-center text-[var(--foreground)]">FitPlan Premium vs Asesoría 1:1</h2>
            <p className="text-center text-[var(--landing-muted)] mt-2 text-sm">
              Elige el nivel de acompañamiento según tu punto actual y velocidad de avance.
            </p>
            <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="card-surface rounded-xl p-4">
                <p className="text-sm font-semibold text-[var(--foreground)]">FitPlan Premium</p>
                <ul className="mt-2 space-y-1 text-sm text-[var(--landing-muted)]">
                  <li>- Plan completo de nutrición + entrenamiento listo para ejecutar.</li>
                  <li>- Ideal si eres autónomo y necesitas estructura clara.</li>
                  <li>- Mejor relación precio/valor para la mayoría.</li>
                </ul>
              </div>
              <div className="card-surface rounded-xl p-4">
                <p className="text-sm font-semibold text-[var(--foreground)]">Asesoría humana 1:1</p>
                <ul className="mt-2 space-y-1 text-sm text-[var(--landing-muted)]">
                  <li>- Revisión personalizada del caso por una persona del equipo.</li>
                  <li>- Ideal si vienes estancado, con lesiones o objetivo exigente.</li>
                  <li>- Acompañamiento y ajustes más finos en el proceso.</li>
                </ul>
              </div>
            </div>
          </div>
          <div className="card-surface rounded-2xl p-6 md:p-8">
            <h2 className="text-2xl md:text-3xl font-bold text-[var(--foreground)]">Oferta Premium FitPlan</h2>
            <p className="text-[var(--landing-muted)] mt-2">Un plan hoy, con un sistema sostenible en el tiempo.</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-5">
              <div className="card-surface-2 rounded-xl p-4">
                <p className="text-sm text-[var(--landing-muted)]">Mensual</p>
                <p className="text-2xl font-extrabold mt-1 text-[var(--foreground)]">{EUR_PLANS.monthly.price} EUR</p>
              </div>
              <div className="card-surface-2 rounded-xl p-4 ring-1 ring-[var(--landing-accent)]/40">
                <p className="text-sm text-[var(--landing-muted)]">Trimestral</p>
                <p className="text-2xl font-extrabold mt-1 text-[var(--foreground)]">
                  {EUR_PLANS.quarterly.price} EUR
                </p>
                <p className="text-xs text-[var(--landing-accent)] mt-1">
                  {getPlanSavingsLabel("eur", "quarterly")} frente al mensual
                </p>
              </div>
              <div className="card-surface-2 rounded-xl p-4">
                <p className="text-sm text-[var(--landing-muted)]">Anual</p>
                <p className="text-2xl font-extrabold mt-1 text-[var(--foreground)]">{EUR_PLANS.annual.price} EUR</p>
                <p className="text-xs text-[var(--landing-accent)] mt-1">
                  {getPlanSavingsLabel("eur", "annual")} frente al mensual
                </p>
              </div>
            </div>
            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <button
                onClick={handlePrimaryCta}
                className="btn btn-primary inline-flex items-center justify-center gap-2 px-7 py-3"
              >
                <FaBolt aria-hidden />
                Activar FitPlan Premium
              </button>
              <a
                href="https://wa.me/34627043397"
                target="_blank"
                rel="noreferrer"
                className="btn btn-secondary inline-flex items-center justify-center gap-2 px-7 py-3"
              >
                <FaWhatsapp aria-hidden />
                Resolver dudas por WhatsApp
              </a>
            </div>
          </div>
        </section>

        <section className="max-w-6xl mx-auto py-10">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-[var(--foreground)]">Preguntas frecuentes antes de comprar</h2>
          <div className="mt-6 space-y-3">
            {[
              {
                q: "¿Funciona si soy principiante total?",
                a: "Sí. El sistema está pensado para empezar con claridad y progresar sin sobrecarga ni confusión.",
              },
              {
                q: "¿Y si entreno en casa o tengo poco material?",
                a: "Se adapta al contexto disponible. Un plan útil no exige un gimnasio perfecto.",
              },
              {
                q: "¿Premium reemplaza la asesoría 1:1?",
                a: "Premium te da estrategia completa para ejecutar. La asesoría 1:1 suma revisión humana y ajustes más finos.",
              },
            ].map((item) => (
              <details key={item.q} className="card-surface-2 rounded-xl p-4">
                <summary className="cursor-pointer font-semibold text-[var(--foreground)]">{item.q}</summary>
                <p className="text-[var(--landing-muted)] mt-2 text-sm">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="max-w-6xl mx-auto pb-14 text-center">
          <div className="card-surface-2 rounded-2xl p-6">
            <h2 className="text-2xl md:text-3xl font-extrabold text-[var(--foreground)]">Empieza hoy con FitPlan</h2>
            <p className="text-[var(--landing-muted)] mt-2">
              Menos caos, más dirección. Si quieres resultados reales, necesitas un sistema ejecutable.
            </p>
            <div className="mt-5 flex flex-col sm:flex-row gap-3 justify-center">
              <button onClick={handlePrimaryCta} className="btn btn-primary px-7 py-3">
                Quiero empezar hoy
              </button>
              <button
                onClick={() => router.push("/formulario-de-inicio")}
                className="btn btn-secondary px-7 py-3"
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
