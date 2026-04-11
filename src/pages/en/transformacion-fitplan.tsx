import { useEffect, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import { FaCheckCircle, FaBolt, FaBrain, FaDumbbell, FaUtensils, FaWhatsapp } from "react-icons/fa";
import LoginModal from "@/components/LoginModal";
import LandingLangToggle from "@/components/LandingLangToggle";
import { useAuthStore } from "@/store/authStore";

const SITE = "https://www.fitplan-ai.com";
const CANONICAL = `${SITE}/en/transformacion-fitplan`;
const ES_URL = `${SITE}/transformacion-fitplan`;

export default function TransformacionFitPlanLandingEn() {
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
        <section className="max-w-6xl mx-auto pt-10 pb-10">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="rounded-3xl border border-cyan-400/25 bg-gradient-to-br from-cyan-500/10 via-blue-500/10 to-purple-500/10 p-7 md:p-12 text-center"
          >
            <p className="text-cyan-200 text-sm md:text-base mb-3">HIGH-IMPACT PREMIUM SYSTEM</p>
            <h1 className="text-3xl md:text-5xl font-extrabold leading-tight">
              Stop guessing: get a <span className="text-cyan-300">plan you can actually stick to</span>
            </h1>
            <p className="text-white/80 mt-5 max-w-3xl mx-auto text-base md:text-lg">
              FitPlan combines AI + professional training logic to build your exact weekly nutrition and training strategy.
              Want maximum personalization? Add optional <strong>human 1:1 coaching</strong> for real follow-up.
            </p>
            <p className="text-white/65 mt-3 max-w-2xl mx-auto text-sm">
              <strong>Web-first:</strong> use it on iPhone or Android from your browser—no App Store download required.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row justify-center gap-3">
              <button
                type="button"
                onClick={handlePrimaryCta}
                className="px-7 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 font-bold text-lg shadow-xl shadow-cyan-500/30"
              >
                Get Premium results
              </button>
              <button
                type="button"
                onClick={() => router.push("/formulario-de-inicio")}
                className="px-7 py-3 rounded-xl border border-white/25 bg-white/5 hover:bg-white/10 font-semibold text-lg"
              >
                Request 1:1 human coaching
              </button>
            </div>
            <p className="text-xs text-white/65 mt-4">
              Plans from <strong>$5.99/mo USD</strong> · Goal-first strategy · Optional human support
            </p>
          </motion.div>
        </section>

        <section className="max-w-6xl mx-auto py-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              icon: <FaBrain />,
              title: "Smart intake",
              text: "Uses goal, pain points, experience, schedule, and adherence—before generating your week.",
            },
            {
              icon: <FaDumbbell />,
              title: "Actionable training",
              text: "Each session states muscle focus, progression, and cardio guidance (walk/run) when relevant.",
            },
            {
              icon: <FaUtensils />,
              title: "Realistic nutrition",
              text: "Meals with macro guidance and practical swaps—built for consistency, not perfectionism.",
            },
          ].map((item) => (
            <div key={item.title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="text-cyan-300 text-xl">{item.icon}</div>
              <h2 className="font-bold text-lg mt-3">{item.title}</h2>
              <p className="text-white/75 mt-2 text-sm">{item.text}</p>
            </div>
          ))}
        </section>

        <section className="max-w-6xl mx-auto py-10">
          <h2 className="text-2xl md:text-3xl font-bold text-center">What you get with Premium</h2>
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              "Weekly meal structure with macro guidance per meal.",
              "Structured training days with muscle focus per exercise.",
              "Cardio recommendations (walk/run) with weekly volume guidance.",
              "Adjustments for pain, injuries, and relevant limitations.",
              "Supplement suggestions when appropriate.",
              "Export-friendly formats (PDF, Word, Excel) for your records.",
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
            <h2 className="text-2xl md:text-3xl font-bold">Want a human in your corner?</h2>
            <p className="text-white/85 mt-2">
              Complete the intake form for <strong>1:1 human coaching</strong>. The form is in Spanish today, but you can write in
              English—our team can respond in English.
            </p>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-xl border border-white/15 bg-black/20 p-4">
                <p className="font-semibold">Individual assessment</p>
                <p className="text-sm text-white/75 mt-1">Context, health background, habits, and your real goal.</p>
              </div>
              <div className="rounded-xl border border-white/15 bg-black/20 p-4">
                <p className="font-semibold">Applied strategy</p>
                <p className="text-sm text-white/75 mt-1">Concrete steps—not generic advice.</p>
              </div>
              <div className="rounded-xl border border-white/15 bg-black/20 p-4">
                <p className="font-semibold">Ongoing support</p>
                <p className="text-sm text-white/75 mt-1">Adjustments based on adherence and feedback.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => router.push("/formulario-de-inicio")}
              className="mt-6 px-7 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold hover:from-emerald-400 hover:to-teal-400 shadow-lg shadow-emerald-500/30"
            >
              Start 1:1 coaching intake
            </button>
          </div>
        </section>

        <section className="max-w-6xl mx-auto py-8">
          <div className="rounded-2xl border border-amber-400/30 bg-gradient-to-r from-amber-500/15 to-orange-500/15 p-6 md:p-8">
            <h2 className="text-2xl md:text-3xl font-bold">FitPlan Premium (USD)</h2>
            <p className="text-white/85 mt-2">Pick a plan and start today with a system—not motivation spikes.</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-5">
              <div className="rounded-xl bg-black/25 border border-white/15 p-4">
                <p className="text-sm text-white/70">Monthly</p>
                <p className="text-2xl font-extrabold mt-1">$5.99</p>
                <p className="text-xs text-white/50 mt-1">per month</p>
              </div>
              <div className="rounded-xl bg-black/25 border border-white/15 p-4 ring-1 ring-amber-400/40">
                <p className="text-sm text-white/70">Quarterly</p>
                <p className="text-2xl font-extrabold mt-1">$13.99</p>
                <p className="text-xs text-white/50 mt-1">billed every 3 months</p>
              </div>
              <div className="rounded-xl bg-black/25 border border-white/15 p-4">
                <p className="text-sm text-white/70">Annual</p>
                <p className="text-2xl font-extrabold mt-1">$26.99</p>
                <p className="text-xs text-white/50 mt-1">billed yearly</p>
              </div>
            </div>
            <p className="text-xs text-white/55 mt-4">
              Prices shown for United States / Stripe USD checkout. European visitors may see EUR pricing based on location.
            </p>
            <button
              type="button"
              onClick={handlePrimaryCta}
              className="mt-6 px-7 py-3 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 font-bold hover:from-amber-300 hover:to-orange-400 inline-flex items-center gap-2 shadow-lg shadow-orange-500/30"
            >
              <FaBolt />
              Activate Premium
            </button>
          </div>
        </section>

        <section className="max-w-6xl mx-auto py-10">
          <h2 className="text-2xl md:text-3xl font-bold text-center">FAQ</h2>
          <div className="mt-6 space-y-3">
            {[
              {
                q: "Is this for beginners?",
                a: "Yes. The plan is written to be understandable and progressive—even if you’re starting from zero.",
              },
              {
                q: "What if I train at home?",
                a: "Your plan adapts to your equipment and environment (home vs gym) based on what you tell us.",
              },
              {
                q: "Premium vs 1:1 coaching—what’s the difference?",
                a: "Premium gives you a complete system to execute. 1:1 coaching adds human review, accountability, and tailored adjustments.",
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
            <h2 className="text-2xl md:text-3xl font-extrabold">Ready to make this easy?</h2>
            <p className="text-white/80 mt-2">
              If you want a clear weekly plan instead of random workouts and random meals, FitPlan is built for you.
            </p>
            <div className="mt-5 flex flex-col sm:flex-row gap-3 justify-center">
              <button
                type="button"
                onClick={handlePrimaryCta}
                className="px-7 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 font-bold"
              >
                Start today
              </button>
              <a
                href="https://wa.me/34627043397"
                target="_blank"
                rel="noreferrer"
                className="px-7 py-3 rounded-xl border border-white/25 bg-white/5 hover:bg-white/10 font-semibold inline-flex items-center justify-center gap-2"
              >
                <FaWhatsapp />
                WhatsApp
              </a>
            </div>
          </div>
        </section>
      </main>

      <LoginModal isOpen={loginOpen} onClose={() => setLoginOpen(false)} locale="en" />
    </div>
  );
}
