import { useCallback, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import {
  FaArrowRight,
  FaCheck,
  FaComments,
  FaDumbbell,
  FaLeaf,
  FaRobot,
  FaSignInAlt,
  FaUtensils,
} from "react-icons/fa";
import type { IconType } from "react-icons";
import { useAuthStore } from "@/store/authStore";
import { getDbSafe, getAuthSafe } from "@/lib/firebase";
import { collection, query, where, getDocs, limit } from "firebase/firestore";
import LoginModal from "@/components/LoginModal";
import PremiumPlanModal from "@/components/PremiumPlanModal";
import Head from "next/head";
import { getHomeLandingCopy, SITE, type LandingLocale } from "@/lib/homeLandingCopy";

const featureIcons: IconType[] = [FaComments, FaLeaf, FaUtensils];

interface HomeLandingProps {
  locale: LandingLocale;
}

export default function HomeLanding({ locale }: HomeLandingProps) {
  const c = getHomeLandingCopy(locale);
  const router = useRouter();
  // Accesibilidad: si el usuario tiene prefers-reduced-motion, no animamos
  // (DESIGN_SYSTEM.md §7.3-D — deuda detectada de paso en la auditoría del admin).
  const reduceMotion = useReducedMotion();
  // NO devolver `initial: { opacity: 0 }` acá. En build de producción
  // framer-motion serializa ese estado inicial en el HTML del servidor y la
  // hidratación no llegaba a disparar la animación: el hero, los CTAs y las
  // tarjetas quedaban invisibles para siempre (la landing salió en blanco en
  // producción, dos veces). Solo animamos `y`, que como mucho deja el
  // contenido unos píxeles corrido — nunca oculto.
  //
  // Regla para esta pantalla: la visibilidad del contenido no puede depender
  // de que el JS hidrate. Si se quiere recuperar el fade de entrada, hacerlo
  // con CSS (@keyframes + prefers-reduced-motion), no con JS.
  const fadeUp = reduceMotion ? { initial: false as const } : { initial: { y: 16 }, animate: { y: 0 } };
  const reveal = () => (reduceMotion ? {} : { initial: { y: 12 }, animate: { y: 0 } });
  const { user: authUser } = useAuthStore();
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  /** "Entrar" abre login; CTAs de alta abren registro. */
  const [loginModalMode, setLoginModalMode] = useState<"login" | "signup">("login");
  const [premiumModalOpen, setPremiumModalOpen] = useState(false);

  const openLoginModal = (mode: "login" | "signup") => {
    setLoginModalMode(mode);
    setLoginModalOpen(true);
  };

  const checkUserPlans = useCallback(async () => {
    try {
      const db = getDbSafe();
      const auth = getAuthSafe();
      if (!db || !auth?.currentUser) {
        router.push("/create-plan");
        return;
      }

      const authEmail = auth.currentUser.email?.toLowerCase() || "";
      if (authEmail === "admin@fitplan-ai.com") {
        router.push("/admin");
        return;
      }

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

      const q = query(collection(db, "planes"), where("userId", "==", auth.currentUser.uid), limit(1));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        router.push("/create-plan");
      } else {
        router.push("/dashboard");
      }
    } catch (error) {
      console.error(locale === "en" ? "Error checking plans:" : "Error al verificar planes:", error);
      router.push("/create-plan");
    }
  }, [router, locale]);

  // Decisión de Lucas (2026-08-25): la landing YA NO redirige automáticamente a
  // usuarios logueados a /admin, /dashboard o /create-plan — se muestra siempre,
  // igual que a un visitante anónimo. `checkUserPlans` se conserva tal cual (no se
  // toca su lógica de a dónde mandar a cada tipo de usuario), pero ahora corre solo
  // como destino del CTA "Ir a mi panel" (click explícito), no como efecto al montar.
  const goToMyPanel = () => {
    // Sin gate por authLoading: si todavía no resolvió, checkUserPlans cae en su
    // propio fallback (create-plan) en vez de dejar el botón muerto.
    checkUserPlans();
  };

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: c.faq.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };

  const websiteJsonLd =
    locale === "en"
      ? {
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "FitPlan",
          alternateName: c.jsonLdWebSiteAlt,
          url: c.head.canonical,
          inLanguage: "en-US",
        }
      : {
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "FitPlan",
          alternateName: c.jsonLdWebSiteAlt,
          url: c.head.canonical,
        };

  return (
    <div className="min-h-[100dvh] flex flex-col overflow-x-hidden" lang={c.htmlLang}>
      <Head>
        <title>{c.head.title}</title>
        <meta name="description" content={c.head.description} />
        <meta name="keywords" content={c.head.keywords} />
        <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
        <link rel="canonical" href={c.head.canonical} />
        {/* `en` (no `en-US`) para que coincida con lo que declara sitemap.xml
            para este mismo par de URLs — si las anotaciones no coinciden, Google
            no valida la reciprocidad. `x-default` faltaba: sin él no hay página
            declarada para idiomas que no son ni es ni en. */}
        <link rel="alternate" hrefLang="es" href={`${SITE}/`} />
        <link rel="alternate" hrefLang="en" href={`${SITE}/en`} />
        <link rel="alternate" hrefLang="x-default" href={`${SITE}/`} />
        {c.head.ogLocale && <meta property="og:locale" content={c.head.ogLocale} />}
        {c.head.ogLocaleAlternate && <meta property="og:locale:alternate" content={c.head.ogLocaleAlternate} />}

        <meta property="og:title" content={c.head.ogTitle} />
        <meta property="og:description" content={c.head.ogDescription} />
        <meta property="og:url" content={c.head.canonical} />

        <meta name="twitter:title" content={c.head.twitterTitle} />
        <meta name="twitter:description" content={c.head.twitterDescription} />

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "FitPlan",
              url: SITE,
              logo: `${SITE}/brand/icon-social.png`,
              description: c.jsonLdOrganizationDescription,
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
            }),
          }}
        />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              name: "FitPlan",
              applicationCategory: "HealthApplication",
              operatingSystem: "Web",
              ...(locale === "en" ? { inLanguage: "en-US" } : {}),
              description: c.jsonLdSoftwareDescription,
              offers: {
                "@type": "Offer",
                price: "0",
                priceCurrency: c.jsonLdSoftwareCurrency,
                description: c.jsonLdSoftwareOfferDescription,
              },
              // SIN `aggregateRating`. Había uno fijo (4.8 sobre 150 valoraciones)
              // que era inventado: la app no tiene sistema de reseñas, así que no
              // existe ninguna valoración real que lo respalde. Google lo publicaba
              // como estrellas en los resultados de búsqueda — datos estructurados
              // falsos, sancionables con acción manual, además de engañoso.
              // No volver a añadirlo hasta que haya reseñas reales de las que salga
              // el número. Lo cubre landingClaims.test.ts.
              featureList: c.jsonLdFeatureList,
            }),
          }}
        />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      </Head>

      <a
        href={`#${c.mainId}`}
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-[var(--landing-surface-2)] focus:px-3 focus:py-2 focus:text-sm focus:outline-none focus:ring-2 focus:ring-[var(--landing-accent)]"
      >
        {c.skipToContent}
      </a>

      <header className="sticky top-0 z-50 border-b border-[var(--landing-border)] bg-[color-mix(in_oklab,var(--background)_88%,transparent)] backdrop-blur-md supports-[padding:max(0px)]:pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 sm:gap-3 px-3 py-2.5 sm:px-6 sm:py-3">
          <Link
            href={c.logoHref}
            className="flex items-center gap-2.5 min-w-0 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent)]"
          >
            <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-xl bg-[var(--landing-surface)] ring-1 ring-[var(--landing-border)]">
              <Image
                src="/brand/icon-social-transparent.svg"
                alt=""
                width={36}
                height={36}
                className="object-contain p-1"
                priority
              />
            </span>
            <span className="truncate font-semibold tracking-tight text-[var(--foreground)]">FitPlan</span>
          </Link>

          <div className="flex flex-shrink-0 flex-wrap items-center justify-end gap-1.5 sm:gap-3">
            <nav
              className="flex items-center rounded-lg bg-[var(--landing-surface)] ring-1 ring-[var(--landing-border)] p-0.5 text-xs sm:text-sm"
              aria-label={c.navLangAria}
            >
              {locale === "es" ? (
                <>
                  <span className="px-2 py-1 rounded-md font-medium text-[var(--foreground)] bg-[var(--landing-surface-2)]">ES</span>
                  <span className="text-[var(--landing-muted)] px-1" aria-hidden>
                    |
                  </span>
                  <a href="/en" hrefLang="en-US" className="px-2 py-1 rounded-md text-[var(--landing-muted)] hover:text-[var(--foreground)] transition-colors">
                    EN
                  </a>
                </>
              ) : (
                <>
                  <a href="/" hrefLang="es" className="px-2 py-1 rounded-md text-[var(--landing-muted)] hover:text-[var(--foreground)] transition-colors">
                    ES
                  </a>
                  <span className="text-[var(--landing-muted)] px-1" aria-hidden>
                    |
                  </span>
                  <span className="px-2 py-1 rounded-md font-medium text-[var(--foreground)] bg-[var(--landing-surface-2)]">EN</span>
                </>
              )}
            </nav>
            <button
              type="button"
              onClick={authUser ? goToMyPanel : () => openLoginModal("login")}
              className="inline-flex items-center gap-1.5 sm:gap-2 rounded-xl px-2.5 py-2 sm:px-3 text-xs sm:text-sm font-medium text-[var(--foreground)] ring-1 ring-[var(--landing-border)] bg-[var(--landing-surface)] hover:bg-[var(--landing-surface-2)] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent)] touch-manipulation disabled:cursor-default disabled:opacity-70"
            >
              <FaSignInAlt className="h-3.5 w-3.5 opacity-80" aria-hidden />
              {authUser ? (
                c.goToPanel
              ) : (
                c.signIn
              )}
            </button>
          </div>
        </div>
      </header>

      <main id={c.mainId} className="flex-1 w-full min-w-0">
        <section className="mx-auto max-w-5xl px-3 pt-8 pb-12 sm:px-6 sm:pt-14 sm:pb-20">
          <motion.div {...fadeUp} transition={{ duration: 0.35 }} className="max-w-2xl">
            <p className="mb-3 sm:mb-4 inline-flex max-w-full items-center gap-2 rounded-full border border-[var(--landing-border)] bg-[var(--landing-surface)] px-2.5 py-1 text-[11px] sm:text-xs font-medium text-[var(--landing-muted)]">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--landing-accent)]" aria-hidden />
              <span className="text-balance">{c.heroBadge}</span>
            </p>
            <h1 className="text-[clamp(1.65rem,5.5vw+0.6rem,3.65rem)] sm:text-5xl md:text-6xl font-bold tracking-tight text-[var(--foreground)] leading-[1.12] text-balance">
              {c.heroTitleBefore}{" "}
              <span className="text-[var(--landing-accent)]">{c.heroTitleHighlight1}</span> {c.heroTitleMiddle}{" "}
              <span className="text-[var(--landing-accent)]">{c.heroTitleHighlight2}</span>.
            </h1>
            <p className="mt-4 sm:mt-5 text-base sm:text-lg md:text-xl text-[var(--landing-muted)] leading-relaxed max-w-xl text-pretty">
              {c.heroSub}
            </p>
          </motion.div>

          <motion.div
            className="mt-8 sm:mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center"
            {...fadeUp}
            transition={{ duration: 0.35, delay: 0.05 }}
          >
            <button
              type="button"
              onClick={authUser ? goToMyPanel : () => openLoginModal("signup")}
              className="inline-flex w-full sm:w-auto min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-[var(--landing-accent)] px-6 py-3.5 sm:px-7 sm:py-4 text-base font-semibold text-[var(--accent-ink)] shadow-lg shadow-black/20 hover:brightness-110 active:scale-[0.99] transition outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] touch-manipulation disabled:cursor-default disabled:opacity-70"
            >
              {authUser ? (
                c.goToPanel
              ) : (
                c.ctaStart
              )}
              <FaArrowRight className="h-4 w-4 shrink-0" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => setPremiumModalOpen(true)}
              className="inline-flex w-full sm:w-auto min-h-[48px] items-center justify-center gap-2 rounded-2xl border border-[var(--landing-border)] bg-[var(--landing-surface)] px-6 py-3.5 sm:px-7 sm:py-4 text-base font-semibold text-[var(--foreground)] hover:bg-[var(--landing-surface-2)] transition outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent)] touch-manipulation"
            >
              <FaLeaf className="h-4 w-4 shrink-0 text-[var(--landing-accent)]" aria-hidden />
              {c.ctaPremium}
            </button>
            {/* "Iniciá sesión para..." solo aplica a un visitante sin sesión — no tiene sentido
                mostrárselo a un usuario ya logueado (decisión de Lucas, ver goToMyPanel). */}
            {!authUser && (
              <p className="text-sm text-[var(--landing-muted)] text-pretty sm:w-full sm:pl-0 pt-0.5">{c.ctaHint}</p>
            )}
          </motion.div>
        </section>

        <section className="border-t border-[var(--landing-border)] bg-[color-mix(in_oklab,var(--foreground)_2.5%,transparent)]">
          <div className="mx-auto max-w-5xl px-3 py-10 sm:px-6 sm:py-16">
            <motion.h2
              {...fadeUp}
              transition={{ duration: 0.3 }}
              className="text-sm font-semibold uppercase tracking-wider text-[var(--landing-accent)]"
            >
              {c.howItWorksKicker}
            </motion.h2>
            <p className="mt-2 text-xl sm:text-2xl md:text-3xl font-semibold text-[var(--foreground)] tracking-tight text-balance">
              {c.howItWorksTitle}
            </p>
            <ol className="mt-8 sm:mt-10 grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {c.steps.map((item, i) => (
                <motion.li
                  key={item.step}
                  {...reveal()}
                  transition={{ duration: 0.3, delay: i * 0.06 }}
                  className="relative rounded-2xl border border-[var(--landing-border)] bg-[var(--landing-surface)] p-5 sm:p-6"
                >
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--landing-surface-2)] text-sm font-bold text-[var(--landing-accent)] ring-1 ring-[var(--landing-border)]">
                    {item.step}
                  </span>
                  <h3 className="mt-4 text-lg font-semibold text-[var(--foreground)]">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--landing-muted)]">{item.body}</p>
                </motion.li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-3 py-10 sm:px-6 sm:py-16">
          <motion.div
            {...reveal()}
            transition={{ duration: 0.35 }}
            className="rounded-2xl sm:rounded-3xl border border-[var(--landing-border)] bg-gradient-to-br from-[var(--landing-surface)] to-[color-mix(in_oklab,var(--landing-accent)_8%,transparent)] p-5 sm:p-8 md:p-10"
          >
            <div className="flex flex-wrap gap-3 text-[var(--landing-muted)]">
              <span className="inline-flex items-center gap-2 rounded-full border border-[var(--landing-border)] bg-[var(--landing-surface)] px-3 py-1 text-xs font-medium">
                <FaUtensils className="h-3.5 w-3.5 text-[var(--landing-accent)]" aria-hidden />
                {c.chipNutrition}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-[var(--landing-border)] bg-[var(--landing-surface)] px-3 py-1 text-xs font-medium">
                <FaRobot className="h-3.5 w-3.5 text-[var(--landing-accent)]" aria-hidden />
                {c.chipAi}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-[var(--landing-border)] bg-[var(--landing-surface)] px-3 py-1 text-xs font-medium">
                <FaDumbbell className="h-3.5 w-3.5 text-[var(--landing-accent)]" aria-hidden />
                {c.chipTraining}
              </span>
            </div>
            <h2 className="mt-5 sm:mt-6 text-xl sm:text-2xl md:text-3xl font-bold text-[var(--foreground)] tracking-tight text-balance">
              {c.expertTitle}
            </h2>
            <p className="mt-3 sm:mt-4 max-w-2xl text-sm sm:text-base text-[var(--landing-muted)] leading-relaxed text-pretty">
              {c.expertSub}
            </p>
            <ul className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              {c.expertBullets.map((t) => (
                <li
                  key={t}
                  className="inline-flex items-center gap-2 rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface)] px-4 py-2.5 text-sm text-[var(--foreground)]"
                >
                  <FaCheck className="h-3.5 w-3.5 shrink-0 text-[var(--landing-accent)]" aria-hidden />
                  {t}
                </li>
              ))}
            </ul>
          </motion.div>
        </section>

        <section className="border-t border-[var(--landing-border)] bg-[color-mix(in_oklab,var(--foreground)_2.5%,transparent)]">
          <div className="mx-auto max-w-5xl px-3 py-10 sm:px-6 sm:py-16">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-semibold text-[var(--foreground)] tracking-tight text-balance">
              {c.featuresTitle}
            </h2>
            <div className="mt-8 sm:mt-10 grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {c.features.map((feature, idx) => {
                const Icon = featureIcons[idx] ?? FaUtensils;
                return (
                  <motion.div
                    key={feature.title}
                    {...reveal()}
                    transition={{ duration: 0.3, delay: idx * 0.05 }}
                    className="rounded-2xl border border-[var(--landing-border)] bg-[var(--landing-surface)] p-5 sm:p-6"
                  >
                    <Icon className="h-6 w-6 shrink-0 text-[var(--landing-accent)]" aria-hidden />
                    <h3 className="mt-4 text-lg font-semibold text-[var(--foreground)]">{feature.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-[var(--landing-muted)]">{feature.body}</p>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="mx-auto flex max-w-5xl justify-center px-4 pb-16 sm:px-6">
          <div className="flex w-full max-w-4xl min-h-[5.5rem] items-center justify-center rounded-2xl border border-dashed border-[var(--landing-border)] bg-transparent px-6 py-8 text-center sm:min-h-[4.75rem] sm:px-10">
            <p className="text-[var(--landing-muted)] text-sm sm:text-base">
              {c.intakeQuestion}{" "}
              <Link
                href={locale === "en" ? "/en/formulario-de-inicio" : "/formulario-de-inicio"}
                className="font-semibold text-[var(--landing-accent)] underline underline-offset-2 hover:brightness-110 outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent)] rounded"
              >
                {c.intakeLink}
              </Link>
              .
            </p>
          </div>
        </section>

        <section className="border-t border-[var(--landing-border)] bg-[var(--landing-surface)] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <div className="mx-auto max-w-5xl px-3 py-10 sm:px-6 sm:py-12 text-center">
            <p className="text-sm text-[var(--landing-muted)] max-w-lg mx-auto text-pretty">{c.closingText}</p>
            <button
              type="button"
              onClick={authUser ? goToMyPanel : () => openLoginModal("signup")}
              className="mt-6 inline-flex w-full sm:w-auto min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-[var(--landing-accent)] px-6 py-3.5 text-sm font-semibold text-[var(--accent-ink)] hover:brightness-110 transition outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] touch-manipulation max-w-md mx-auto disabled:cursor-default disabled:opacity-70"
            >
              {authUser ? (
                c.goToPanel
              ) : (
                c.closingCta
              )}
              <FaArrowRight className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </section>
      </main>

      <LoginModal
        isOpen={loginModalOpen}
        onClose={() => setLoginModalOpen(false)}
        defaultMode={loginModalMode}
        locale={locale}
      />

      <PremiumPlanModal
        isOpen={premiumModalOpen}
        onClose={() => setPremiumModalOpen(false)}
        locale={locale}
        onRequireAuth={() => {
          setPremiumModalOpen(false);
          openLoginModal("signup");
        }}
      />
    </div>
  );
}
