import { useEffect, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import { FaCheckCircle, FaBolt, FaBrain, FaDumbbell, FaUtensils, FaWhatsapp } from "react-icons/fa";
import LoginModal from "@/components/LoginModal";
import LandingLangToggle from "@/components/LandingLangToggle";
import { useAuthStore } from "@/store/authStore";
import { trackEvent } from "@/lib/analytics";

const SITE = "https://www.fitplan-ai.com";
const CANONICAL = `${SITE}/en/transformacion-fitplan`;
const ES_URL = `${SITE}/transformacion-fitplan`;

export default function TransformacionFitPlanLandingEn() {
  const router = useRouter();
  const { user: authUser } = useAuthStore();
  const [loginOpen, setLoginOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    // isMounted evita mismatches de hidratación en contenido client-only;
    // no hay alternativa sin useSyncExternalStore para este caso puntual.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMounted(true);
    trackEvent("view_content", {
      content_name: "transformacion-fitplan",
      content_language: "en",
      content_category: "landing",
    });
  }, []);

  const handlePrimaryCta = () => {
    trackEvent("begin_checkout", {
      source: "transformacion-fitplan-en",
      plan_type: "premium",
      currency: "USD",
    });
    if (isMounted && authUser) {
      router.push("/dashboard?openPremium=1");
      return;
    }
    setLoginOpen(true);
  };

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "Does FitPlan work if I’m a beginner?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes. FitPlan adapts training and nutrition to your current level, explains each part clearly, and suggests weekly progression.",
        },
      },
      {
        "@type": "Question",
        name: "Is the 1:1 coaching form with a real human?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes. The intake is reviewed by a real coach for personalized follow-up via in-app chat and WhatsApp when applicable.",
        },
      },
      {
        "@type": "Question",
        name: "What if I have injuries, medical conditions, or very little time?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "FitPlan adapts training, cardio, and meals to your real constraints. The goal is sustainable progress—not impossible plans.",
        },
      },
      {
        "@type": "Question",
        name: "How much does Premium cost?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Plans start around $5.99/month (USD), with quarterly and annual options for better value. Optional 1:1 human coaching is available via the intake form.",
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
    browserRequirements: "Requires JavaScript. Works in modern mobile and desktop browsers.",
    url: CANONICAL,
    inLanguage: "en-US",
    description:
      "AI-powered personalized meal and training plans with optional human coaching—adapted to your goal, schedule, equipment, and experience.",
    offers: [
      { "@type": "Offer", priceCurrency: "USD", price: "5.99", name: "Monthly" },
      { "@type": "Offer", priceCurrency: "USD", price: "13.99", name: "Quarterly" },
      { "@type": "Offer", priceCurrency: "USD", price: "26.99", name: "Annual" },
    ],
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
      { "@type": "ListItem", position: 2, name: "FitPlan transformation (US)", item: CANONICAL },
    ],
  };

  const webPageJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "FitPlan — AI training & nutrition (web app)",
    url: CANONICAL,
    inLanguage: "en-US",
    isPartOf: { "@type": "WebSite", name: "FitPlan AI", url: SITE },
    description:
      "Stop guessing. Get a clear weekly training and nutrition system you can follow on your phone—no app store install required.",
  };

  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "FitPlan AI",
    url: SITE,
    logo: `${SITE}/favicon.svg`,
    description: "AI-powered personalized training and nutrition plans in your browser.",
    contactPoint: {
      "@type": "ContactPoint",
      email: "fitplanai.oficial@gmail.com",
      contactType: "customer service",
      availableLanguage: ["English", "Spanish"],
    },
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white" lang="en">
      <Head>
        <link rel="canonical" href="https://www.fitplan-ai.com/en/transformacion-fitplan" />
        <link rel="alternate" hrefLang="es" href="https://www.fitplan-ai.com/transformacion-fitplan" />
        <link rel="alternate" hrefLang="en" href="https://www.fitplan-ai.com/en/transformacion-fitplan" />
        <link rel="alternate" hrefLang="x-default" href="https://www.fitplan-ai.com/transformacion-fitplan" />
        <title>FitPlan — AI Training & Nutrition Plans (Web) | Start Premium</title>
        <meta
          name="description"
          content="Personalized gym and nutrition plans powered by AI—runs in your browser on any phone. Optional human coaching. Built for busy people who want clarity, not chaos. From $5.99/mo USD."
        />
        <meta
          name="keywords"
          content="AI workout plan, personalized meal plan, online fitness coach, gym routine app web, fat loss plan, muscle gain plan, FitPlan premium, training and nutrition USA"
        />
        <meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1" />
        <meta name="googlebot" content="index,follow" />
        <link rel="canonical" href={CANONICAL} />
        <link rel="alternate" hrefLang="en-US" href={CANONICAL} />
        <link rel="alternate" hrefLang="es" href={ES_URL} />
        <link rel="alternate" hrefLang="x-default" href={ES_URL} />

        <meta property="og:type" content="website" />
        <meta property="og:locale" content="en_US" />
        <meta property="og:locale:alternate" content="es_ES" />
        <meta property="og:url" content={CANONICAL} />
        <meta property="og:title" content="FitPlan — AI Training & Nutrition (Web App)" />
        <meta
          property="og:description"
          content="A weekly system for training + nutrition you can actually follow. Premium from $5.99/mo USD. No install required—works in your mobile browser."
        />
        <meta property="og:site_name" content="FitPlan AI" />

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="FitPlan — AI Training & Nutrition" />
        <meta
          name="twitter:description"
          content="Personalized plans + optional human coaching. Web-first. Built for real life."
        />

        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageJsonLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }} />
      </Head>

      <LandingLangToggle locale="en" />

      <main className="px-4 md:px-6">
        <section className="max-w-6xl mx-auto pt-14 pb-8">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="rounded-3xl border border-cyan-400/25 bg-gradient-to-br from-cyan-500/12 via-blue-500/10 to-purple-500/12 p-7 md:p-12"
          >
            <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-8 items-center">
              <div>
                <p className="text-cyan-200 text-xs md:text-sm mb-3 tracking-wide">PREMIUM SYSTEM FOR REAL TRANSFORMATION</p>
                <h1 className="text-3xl md:text-5xl font-extrabold leading-tight">
                  With <span className="text-cyan-300">FitPlan</span>, your nutrition + training roadmap so you stop restarting every Monday
                </h1>
                <p className="text-white/80 mt-5 max-w-3xl text-base md:text-lg">
                  FitPlan gives you a clear strategy tailored to your goal, schedule, injuries, and current level.
                  Need higher precision? Add optional 1:1 human coaching.
                </p>
                <div className="mt-7 flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={handlePrimaryCta}
                    className="px-7 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 font-bold text-lg shadow-xl shadow-cyan-500/30"
                  >
                    Activate FitPlan Premium
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push("/en/formulario-de-inicio")}
                    className="px-7 py-3 rounded-xl border border-white/25 bg-white/5 hover:bg-white/10 font-semibold text-lg"
                  >
                    Request 1:1 coaching
                  </button>
                </div>
                <p className="text-xs text-white/65 mt-4">
                  From <strong>$5.99/mo USD</strong> · No long-term contract · Built for real adherence
                </p>
              </div>

              <div className="rounded-2xl border border-white/15 bg-black/25 p-5">
                <p className="text-sm font-semibold text-white/90">What changes when you stop improvising?</p>
                <div className="mt-4 space-y-3 text-sm text-white/80">
                  <div className="flex items-start gap-2">
                    <FaCheckCircle className="text-emerald-300 mt-0.5" />
                    <span>You know exactly what to eat and train each day.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <FaCheckCircle className="text-emerald-300 mt-0.5" />
                    <span>You avoid losing weeks to indecision and inconsistent execution.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <FaCheckCircle className="text-emerald-300 mt-0.5" />
                    <span>Your plan adapts when your real life changes.</span>
                  </div>
                </div>
                <div className="mt-5 rounded-xl border border-cyan-400/25 bg-cyan-500/10 p-3 text-xs text-cyan-100">
                  In about 10 minutes, your next week can already be mapped out.
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        <section className="max-w-6xl mx-auto py-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { icon: <FaBrain />, title: "Context-first intake", text: "Goal, injuries, schedule, and adherence level before planning anything." },
            { icon: <FaDumbbell />, title: "Actionable training", text: "Clear sessions, muscle focus, progression, and cardio guidance." },
            { icon: <FaUtensils />, title: "Practical nutrition", text: "Macro-guided structure you can follow in real life, not just on paper." },
          ].map((item) => (
            <div key={item.title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="text-cyan-300 text-xl">{item.icon}</div>
              <h2 className="font-bold text-lg mt-3">{item.title}</h2>
              <p className="text-white/75 mt-2 text-sm">{item.text}</p>
            </div>
          ))}
        </section>

        <section className="max-w-6xl mx-auto py-10">
          <h2 className="text-2xl md:text-3xl font-bold text-center">What you are actually buying: clarity + execution + support</h2>
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              "Weekly nutrition structure with macro targets per meal.",
              "Structured training days with muscle focus by exercise.",
              "Cardio recommendations and weekly volume guidance.",
              "Adjustments for injuries, pain, and real constraints.",
              "History and continuity so you do not restart from zero.",
              "Clear mobile-friendly format for daily use.",
            ].map((text) => (
              <div key={text} className="rounded-xl border border-white/10 bg-white/[0.03] p-4 flex gap-3 items-start">
                <FaCheckCircle className="text-emerald-300 mt-0.5 flex-shrink-0" />
                <p className="text-white/85 text-sm">{text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="max-w-6xl mx-auto py-4">
          <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-6 md:p-8">
            <h2 className="text-2xl md:text-3xl font-bold">Need more precision? Add 1:1 human coaching</h2>
            <p className="text-white/85 mt-2">
              Best for demanding goals, plateaus, injury history, or when you want direct human follow-up.
              Your case gets reviewed in depth and adjusted with professional criteria.
            </p>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-xl border border-white/15 bg-black/20 p-4">
                <p className="font-semibold">Individual assessment</p>
                <p className="text-sm text-white/75 mt-1">Context, health background, habits, and real goal.</p>
              </div>
              <div className="rounded-xl border border-white/15 bg-black/20 p-4">
                <p className="font-semibold">Applied strategy</p>
                <p className="text-sm text-white/75 mt-1">Concrete steps for nutrition, training, and adherence.</p>
              </div>
              <div className="rounded-xl border border-white/15 bg-black/20 p-4">
                <p className="font-semibold">Follow-up & adjustment</p>
                <p className="text-sm text-white/75 mt-1">Changes based on your real progress, not assumptions.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => router.push("/en/formulario-de-inicio")}
              className="mt-6 px-7 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold hover:from-emerald-400 hover:to-teal-400 shadow-lg shadow-emerald-500/30"
            >
              Request 1:1 coaching
            </button>
          </div>
        </section>

        <section className="max-w-6xl mx-auto py-8">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 md:p-8 mb-6">
            <h2 className="text-2xl md:text-3xl font-bold text-center">FitPlan Premium vs 1:1 Coaching</h2>
            <p className="text-center text-white/75 mt-2 text-sm">
              Choose your support level based on your current situation and desired speed.
            </p>
            <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-cyan-400/25 bg-cyan-500/10 p-4">
                <p className="text-sm font-semibold text-cyan-200">FitPlan Premium</p>
                <ul className="mt-2 space-y-1 text-sm text-white/85">
                  <li>- Full nutrition + training system, ready to execute.</li>
                  <li>- Best for self-driven users who need structure and clarity.</li>
                  <li>- Strongest price-to-value option for most users.</li>
                </ul>
              </div>
              <div className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 p-4">
                <p className="text-sm font-semibold text-emerald-200">1:1 Human Coaching</p>
                <ul className="mt-2 space-y-1 text-sm text-white/85">
                  <li>- Personalized case review by a real coach.</li>
                  <li>- Best for plateaus, injuries, or high-demand goals.</li>
                  <li>- Closer follow-up and tighter adjustments.</li>
                </ul>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-amber-400/30 bg-gradient-to-r from-amber-500/15 to-orange-500/15 p-6 md:p-8">
            <h2 className="text-2xl md:text-3xl font-bold">FitPlan Premium (USD)</h2>
            <p className="text-white/85 mt-2">Choose your plan and start today with a system you can sustain.</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-5">
              <div className="rounded-xl bg-black/25 border border-white/15 p-4">
                <p className="text-sm text-white/70">Monthly</p>
                <p className="text-2xl font-extrabold mt-1">$5.99</p>
              </div>
              <div className="rounded-xl bg-black/25 border border-white/15 p-4 ring-1 ring-amber-400/40">
                <p className="text-sm text-white/70">Quarterly</p>
                <p className="text-2xl font-extrabold mt-1">$13.99</p>
                <p className="text-xs text-white/55 mt-1">Best value for consistency</p>
              </div>
              <div className="rounded-xl bg-black/25 border border-white/15 p-4">
                <p className="text-sm text-white/70">Annual</p>
                <p className="text-2xl font-extrabold mt-1">$26.99</p>
              </div>
            </div>
            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={handlePrimaryCta}
                className="px-7 py-3 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 font-bold hover:from-amber-300 hover:to-orange-400 inline-flex items-center justify-center gap-2 shadow-lg shadow-orange-500/30"
              >
                <FaBolt />
                Activate FitPlan Premium
              </button>
              <a
                href="https://wa.me/34627043397"
                target="_blank"
                rel="noreferrer"
                className="px-7 py-3 rounded-xl border border-white/25 bg-white/5 hover:bg-white/10 font-semibold inline-flex items-center justify-center gap-2"
              >
                <FaWhatsapp />
                Ask on WhatsApp
              </a>
            </div>
            <p className="text-xs text-white/55 mt-4">
              US visitors usually see USD checkout. Some regions may show localized currency.
            </p>
          </div>
        </section>

        <section className="max-w-6xl mx-auto py-10">
          <h2 className="text-2xl md:text-3xl font-bold text-center">FAQ before you buy</h2>
          <div className="mt-6 space-y-3">
            {[
              {
                q: "Can this work if I am a complete beginner?",
                a: "Yes. It is structured to be clear, progressive, and realistic from day one.",
              },
              {
                q: "What if I train at home with limited equipment?",
                a: "Your plan adapts to your setup. You do not need a perfect gym to make progress.",
              },
              {
                q: "Premium vs 1:1 coaching: what is the difference?",
                a: "Premium gives you a complete execution system. 1:1 adds human review and tighter adjustments.",
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
            <h2 className="text-2xl md:text-3xl font-extrabold">Start today with FitPlan</h2>
            <p className="text-white/80 mt-2">
              Less chaos, more direction. If you want measurable results, you need a system you can execute.
            </p>
            <div className="mt-5 flex flex-col sm:flex-row gap-3 justify-center">
              <button
                type="button"
                onClick={handlePrimaryCta}
                className="px-7 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 font-bold"
              >
                Start now
              </button>
              <button
                type="button"
                onClick={() => router.push("/en/formulario-de-inicio")}
                className="px-7 py-3 rounded-xl border border-white/25 bg-white/5 hover:bg-white/10 font-semibold"
              >
                Go to 1:1 intake
              </button>
            </div>
          </div>
        </section>
      </main>

      <LoginModal isOpen={loginOpen} onClose={() => setLoginOpen(false)} defaultMode="signup" locale="en" />
    </div>
  );
}
