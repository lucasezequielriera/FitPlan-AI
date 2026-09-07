import { useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { motion, useReducedMotion } from "framer-motion";
import { FaBolt, FaCheckCircle } from "react-icons/fa";
import LoginModal from "@/components/LoginModal";
import { useAuthStore } from "@/store/authStore";
import { trackEvent } from "@/lib/analytics";
import { HYROX_LANDING as C } from "@/lib/hyrox/landingCopy";
import { getStripeSubscriptionPlans } from "@/lib/stripePlanPrices";

/**
 * Landing pública de HYROX.
 *
 * Vive en `/hyrox` (la app está en `/hyrox/plan`) porque "hyrox" es el término
 * que la gente busca y es la URL con más valor de la sección.
 *
 * NOTA de motion, no negociable: nada de `initial: { opacity: 0 }`. En build de
 * producción framer-motion serializa ese estado en el HTML del servidor y, si
 * la hidratación no dispara, el contenido queda invisible para siempre. Dejó la
 * landing principal en blanco dos veces. Aquí solo se anima la posición.
 *
 * Colorimetría: neutros + `--accent`. Ningún tercer color.
 */
export default function HyroxLanding() {
  const router = useRouter();
  const authUser = useAuthStore((s) => s.user);
  const reduceMotion = useReducedMotion();
  const [loginOpen, setLoginOpen] = useState(false);

  const fadeUp = reduceMotion ? { initial: false as const } : { initial: { y: 14 }, animate: { y: 0 } };
  const eur = getStripeSubscriptionPlans("eur");

  const goToPlan = (origen: string) => {
    trackEvent("view_content", { source: `hyrox-landing-${origen}` });
    if (authUser) void router.push("/hyrox/plan");
    else setLoginOpen(true);
  };

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: C.faq.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "FitPlan", item: "https://www.fitplan-ai.com/" },
      { "@type": "ListItem", position: 2, name: "Plan HYROX", item: C.canonical },
    ],
  };

  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "FitPlan — Plan HYROX",
    applicationCategory: "HealthApplication",
    operatingSystem: "Web",
    url: C.canonical,
    inLanguage: "es-ES",
    description: C.metaDescription,
    // SIN `aggregateRating`: no hay sistema de reseñas, así que cualquier
    // valoración aquí sería inventada. Ya se publicó una y hubo que retirarla.
    offers: (["monthly", "quarterly", "annual"] as const).map((k) => ({
      "@type": "Offer",
      priceCurrency: "EUR",
      price: String(eur[k].price),
      name: k === "monthly" ? "Mensual" : k === "quarterly" ? "Trimestral" : "Anual",
    })),
  };

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <Head>
        <title>{C.metaTitle}</title>
        <meta name="description" content={C.metaDescription} />
        <meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1" />
        <link rel="canonical" href={C.canonical} />
        <meta property="og:type" content="website" />
        <meta property="og:locale" content="es_ES" />
        <meta property="og:url" content={C.canonical} />
        <meta property="og:title" content={C.metaTitle} />
        <meta property="og:description" content={C.metaDescription} />
        <meta property="og:site_name" content="FitPlan" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={C.metaTitle} />
        <meta name="twitter:description" content={C.metaDescription} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      </Head>

      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-5 sm:px-6">
        <Link href="/" className="text-sm font-bold tracking-tight">
          FitPlan
        </Link>
        <button type="button" onClick={() => goToPlan("nav")} className="btn btn-secondary text-sm">
          {authUser ? "Ir a mi plan" : "Entrar"}
        </button>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 pb-24 sm:px-6">
        {/* Hero */}
        <motion.section {...fadeUp} className="pt-6 sm:pt-12">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--accent)]">{C.heroKicker}</p>
          <h1 className="mt-3 max-w-3xl text-3xl font-extrabold leading-tight sm:text-5xl">
            {C.heroTitleA} <span className="text-[var(--accent)]">{C.heroTitleB}</span>
          </h1>
          <p className="mt-5 max-w-2xl text-base text-[var(--text-muted)] sm:text-lg">{C.heroSub}</p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => goToPlan("hero")} className="btn btn-primary px-7 py-3 text-base">
              {C.heroCta}
            </button>
            <a href="#incluye" className="btn btn-secondary px-6 py-3 text-base">
              {C.heroCtaSecondary}
            </a>
          </div>
          <p className="mt-3 text-sm text-[var(--text-muted)]">{C.heroNote}</p>
        </motion.section>

        {/* La tesis: el argumento que diferencia al producto */}
        <motion.section {...fadeUp} className="mt-16 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 sm:p-8">
          <h2 className="text-xl font-bold sm:text-2xl">{C.thesisTitle}</h2>
          <p className="mt-3 max-w-3xl text-[var(--text-muted)]">{C.thesisBody}</p>
        </motion.section>

        {/* Qué incluye */}
        <motion.section {...fadeUp} id="incluye" className="mt-16 scroll-mt-6">
          <h2 className="text-2xl font-bold sm:text-3xl">{C.featuresTitle}</h2>
          <div className="mt-7 grid gap-4 sm:grid-cols-2">
            {C.features.map((f) => (
              <div key={f.title} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
                <div className="flex items-start gap-3">
                  <FaBolt className="mt-1 shrink-0 text-[var(--accent)]" aria-hidden />
                  <div>
                    <h3 className="font-semibold">{f.title}</h3>
                    <p className="mt-1.5 text-sm text-[var(--text-muted)]">{f.body}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.section>

        {/* Cómo funciona */}
        <motion.section {...fadeUp} className="mt-16">
          <h2 className="text-2xl font-bold sm:text-3xl">{C.howTitle}</h2>
          <ol className="mt-7 grid gap-4 sm:grid-cols-3">
            {C.steps.map((s) => (
              <li key={s.n} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
                <span className="text-sm font-bold text-[var(--accent)]">{s.n}</span>
                <h3 className="mt-2 font-semibold">{s.title}</h3>
                <p className="mt-1.5 text-sm text-[var(--text-muted)]">{s.body}</p>
              </li>
            ))}
          </ol>
        </motion.section>

        {/* Honestidad: decir qué NO hace es lo que hace creíble lo que sí hace */}
        <motion.section {...fadeUp} className="mt-16 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-6 sm:p-8">
          <h2 className="text-xl font-bold">{C.honestyTitle}</h2>
          <p className="mt-3 max-w-3xl text-[var(--text-muted)]">{C.honestyBody}</p>
        </motion.section>

        {/* FAQ */}
        <motion.section {...fadeUp} className="mt-16">
          <h2 className="text-2xl font-bold sm:text-3xl">{C.faqTitle}</h2>
          <div className="mt-6 space-y-3">
            {C.faq.map((f) => (
              <details key={f.q} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
                <summary className="cursor-pointer list-none font-semibold">{f.q}</summary>
                <p className="mt-3 text-sm text-[var(--text-muted)]">{f.a}</p>
              </details>
            ))}
          </div>
        </motion.section>

        {/* Cierre */}
        <motion.section {...fadeUp} className="mt-16 rounded-2xl border border-[var(--accent)]/30 bg-[var(--surface)] p-7 text-center sm:p-10">
          <h2 className="text-2xl font-extrabold sm:text-3xl">{C.finalTitle}</h2>
          <p className="mx-auto mt-3 max-w-xl text-[var(--text-muted)]">{C.finalBody}</p>
          <button type="button" onClick={() => goToPlan("cierre")} className="btn btn-primary mt-6 px-7 py-3 text-base">
            {C.finalCta}
          </button>
          <p className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-[var(--text-muted)]">
            <span className="inline-flex items-center gap-1.5">
              <FaCheckCircle className="text-[var(--accent)]" aria-hidden /> Sin permanencia
            </span>
            <span className="inline-flex items-center gap-1.5">
              <FaCheckCircle className="text-[var(--accent)]" aria-hidden /> Individual, dobles y relevos
            </span>
            <span className="inline-flex items-center gap-1.5">
              <FaCheckCircle className="text-[var(--accent)]" aria-hidden /> De 3 a 6 días por semana
            </span>
          </p>
        </motion.section>
      </main>

      <LoginModal isOpen={loginOpen} onClose={() => setLoginOpen(false)} />
    </div>
  );
}
