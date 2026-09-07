/**
 * Textos de la landing principal (/) y (/en). Un solo componente, dos idiomas.
 */

export type LandingLocale = "es" | "en";

const SITE = "https://www.fitplan-ai.com";

export interface HomeLandingCopy {
  locale: LandingLocale;
  htmlLang: string;
  skipToContent: string;
  navLangAria: string;
  signIn: string;
  /** CTA para usuario ya logueado (header, hero y cierre) — reemplaza signIn/ctaStart/closingCta cuando hay sesión. */
  goToPanel: string;
  logoHref: string;
  mainId: string;
  heroBadge: string;
  heroTitleBefore: string;
  heroTitleHighlight1: string;
  heroTitleMiddle: string;
  heroTitleHighlight2: string;
  heroSub: string;
  ctaStart: string;
  ctaPremium: string;
  ctaHint: string;
  howItWorksKicker: string;
  howItWorksTitle: string;
  steps: { step: string; title: string; body: string }[];
  chipNutrition: string;
  chipAi: string;
  chipTraining: string;
  expertTitle: string;
  expertSub: string;
  expertBullets: string[];
  featuresTitle: string;
  hyroxKicker: string;
  hyroxTitle: string;
  hyroxBody: string;
  hyroxCta: string;
  features: { title: string; body: string }[];
  intakeQuestion: string;
  intakeLink: string;
  closingText: string;
  closingCta: string;
  head: {
    title: string;
    description: string;
    keywords: string;
    canonical: string;
    ogTitle: string;
    ogDescription: string;
    twitterTitle: string;
    twitterDescription: string;
    ogLocale?: string;
    ogLocaleAlternate?: string;
  };
  jsonLdOrganizationDescription: string;
  jsonLdWebSiteAlt: string;
  jsonLdSoftwareDescription: string;
  jsonLdSoftwareOfferDescription: string;
  jsonLdSoftwareCurrency: string;
  jsonLdFeatureList: string[];
  faq: { q: string; a: string }[];
}

const es: HomeLandingCopy = {
  locale: "es",
  htmlLang: "es",
  skipToContent: "Ir al contenido",
  navLangAria: "Idioma",
  signIn: "Entrar",
  goToPanel: "Ir a mi panel",
  logoHref: "/",
  mainId: "contenido-principal",
  heroBadge: "Nutrición + entrenamiento con IA",
  heroTitleBefore: "Un solo plan para comer",
  heroTitleHighlight1: "bien",
  heroTitleMiddle: "y entrenar",
  heroTitleHighlight2: "bien",
  heroSub:
    "Respondés unas preguntas y obtienes menús semanales con ingredientes claros, rutina de gym acorde a tu nivel y seguimiento en un solo lugar.",
  ctaStart: "Empezar gratis",
  ctaPremium: "Ver planes Premium",
  ctaHint: "Iniciá sesión para crear tu plan, guardarlo y activar Premium cuando quieras.",
  howItWorksKicker: "Cómo funciona",
  howItWorksTitle: "Tres pasos, sin vueltas",
  steps: [
    {
      step: "1",
      title: "Cuéntanos tu objetivo",
      body: "Objetivo, preferencias y días disponibles. Sin tecnicismos innecesarios.",
    },
    {
      step: "2",
      title: "Recibe tu plan",
      body: "Comidas con macros, lista de compras y rutina de entrenamiento alineada.",
    },
    {
      step: "3",
      title: "Sigue y ajusta",
      body: "Marcá el progreso y refina el plan cuando tu cuerpo o tu agenda cambien.",
    },
  ],
  chipNutrition: "Nutrición",
  chipAi: "IA",
  chipTraining: "Entrenamiento",
  expertTitle: "Un plan que se ajusta, no una rutina fija",
  expertSub:
    "Cada plan se arma sobre tus datos: objetivo, nivel, lesiones, material disponible y días que puedes entrenar. Y se recalcula con tu progreso real en vez de quedarse igual todo el año.",
  expertBullets: [
    "Se adapta a tus lesiones y a tu material",
    "Macros y cantidades exactas, no aproximaciones",
    "Se recalcula cada mes con tu progreso",
  ],
  hyroxKicker: "¿Compites en HYROX?",
  hyroxTitle: "Plan HYROX adaptado a las semanas que te quedan",
  hyroxBody:
    "Fases repartidas según el tiempo real hasta tu carrera, ritmos calculados sobre tu marca de 5 km y estrategia de las 8 estaciones. Individual, dobles y relevos.",
  hyroxCta: "Ver el plan HYROX",
  featuresTitle: "Todo lo que necesitas en la app",
  features: [
    {
      title: "Acompañamiento cuando lo necesitas",
      body: "Canal de ayuda con asistencia humana y respuestas con IA para sacarte dudas rápido.",
    },
    {
      title: "Personalizado de verdad",
      body: "Cuerpo, objetivos, gustos y nivel de entrenamiento: el plan se arma alrededor tuyo.",
    },
    {
      title: "Fácil de seguir cada día",
      body: "Recetas con ingredientes, rutina clara y listas de compras para no improvisar.",
    },
  ],
  intakeQuestion: "¿Preferís dejar tus datos y que el equipo te contacte?",
  intakeLink: "Completa el formulario de inicio",
  closingText:
    "FitPlan une nutrición y entrenamiento en un flujo simple para que sepas qué comer, cómo entrenar y cómo medir el avance.",
  closingCta: "Crear mi cuenta",
  head: {
    title: "FitPlan | Plan de Alimentación y Entrenamiento Personalizado con IA",
    description:
      "Crea tu plan de alimentación y entrenamiento con IA: menús semanales con ingredientes exactos, rutinas de gym según tu nivel, macros y seguimiento en PDF.",
    keywords:
      "plan nutricional personalizado, plan de entrenamiento con IA, dieta personalizada, rutina de gym, macros, calorías, entrenamiento personalizado, bajar de peso, ganar masa muscular, perder grasa, recomposición corporal, alimentación saludable, nutricionista online, entrenador personal, plan alimenticio, dieta saludable, fitness, nutrición deportiva, plan de comidas semanal",
    canonical: `${SITE}/`,
    ogTitle: "FitPlan | Alimentación y Entrenamiento Personalizado con IA",
    ogDescription:
      "Planes de alimentación y entrenamiento que se arman sobre tus datos y se recalculan con tu progreso. Menús con cantidades exactas y rutina acorde a tu nivel. Empieza gratis.",
    twitterTitle: "FitPlan | Alimentación y Entrenamiento Personalizado con IA",
    twitterDescription: "Alimentación + entrenamiento en un solo plan, ajustado a tu nivel, tus lesiones y tu material. Empieza gratis.",
  },
  jsonLdOrganizationDescription:
    "Plataforma de planes de alimentación y entrenamiento personalizados con inteligencia artificial.",
  jsonLdWebSiteAlt: "FitPlan - Plan Nutricional y Entrenamiento Inteligente",
  jsonLdSoftwareDescription:
    "Crea tu plan de alimentación y entrenamiento personalizado con inteligencia artificial, ajustado a tu objetivo, nivel, lesiones y material disponible.",
  jsonLdSoftwareOfferDescription: "Plan gratuito por 30 días",
  jsonLdSoftwareCurrency: "ARS",
  jsonLdFeatureList: [
    "Plan de alimentación semanal personalizado",
    "Rutinas de entrenamiento adaptadas a tu nivel",
    "Cálculo automático de macronutrientes",
    "Seguimiento de progreso",
    "Descarga en PDF",
    "Lista de compras automática",
  ],
  faq: [
    {
      q: "¿Qué es FitPlan?",
      a: "FitPlan es una plataforma que crea planes de alimentación y entrenamiento personalizados usando inteligencia artificial. El plan se arma a partir de tu objetivo, tu nivel, tus lesiones y el material del que dispongas, y se recalcula con tu progreso real.",
    },
    {
      q: "¿Es gratis usar FitPlan?",
      a: "Sí, puedes crear tu primer plan de forma gratuita y acceder a él durante 30 días. Después de ese período, necesitas una suscripción premium para seguir accediendo a tu plan.",
    },
    {
      q: "¿Cómo funciona el plan de alimentación?",
      a: "Completas un formulario con tus datos personales, objetivos y preferencias alimentarias. La IA genera un plan semanal detallado con recetas, ingredientes exactos, calorías y macronutrientes adaptados a vos.",
    },
    {
      q: "¿El plan incluye rutina de entrenamiento?",
      a: "Sí, FitPlan genera una rutina de entrenamiento personalizada según tu nivel de experiencia, objetivos y días disponibles para entrenar.",
    },
  ],
};

const en: HomeLandingCopy = {
  locale: "en",
  htmlLang: "en",
  skipToContent: "Skip to content",
  navLangAria: "Language",
  signIn: "Sign in",
  goToPanel: "Go to my panel",
  logoHref: "/en",
  mainId: "main-content",
  heroBadge: "Nutrition + training with AI",
  heroTitleBefore: "One plan to eat",
  heroTitleHighlight1: "well",
  heroTitleMiddle: "and train",
  heroTitleHighlight2: "well",
  heroSub:
    "Answer a few questions and get weekly meals with clear ingredients, a gym routine matched to your level, and progress tracking in one place.",
  ctaStart: "Start for free",
  ctaPremium: "View Premium plans",
  ctaHint: "Sign in to create your plan, save it, and upgrade to Premium whenever you want.",
  howItWorksKicker: "How it works",
  howItWorksTitle: "Three steps—no fluff",
  steps: [
    {
      step: "1",
      title: "Share your goal",
      body: "Goals, preferences, and days you can train—without unnecessary jargon.",
    },
    {
      step: "2",
      title: "Get your plan",
      body: "Meals with macros, a shopping list, and a training routine that fits.",
    },
    {
      step: "3",
      title: "Track and adjust",
      body: "Log progress and refine the plan when your body or schedule changes.",
    },
  ],
  chipNutrition: "Nutrition",
  chipAi: "AI",
  chipTraining: "Training",
  expertTitle: "A plan that adapts, not a fixed routine",
  expertSub:
    "Every plan is built from your own data: goal, experience, injuries, available equipment and how many days you can train. And it gets recalculated with your real progress instead of staying the same all year.",
  expertBullets: [
    "Adapts to your injuries and your equipment",
    "Exact macros and portions, not rough estimates",
    "Recalculated every month with your progress",
  ],
  hyroxKicker: "Racing HYROX?",
  hyroxTitle: "A HYROX plan built around the weeks you actually have left",
  hyroxBody:
    "Phases split by the real time until race day, paces calculated from your 5k, and a strategy for all 8 stations. Individual, doubles and relay.",
  hyroxCta: "See the HYROX plan",
  featuresTitle: "Everything you need in the app",
  features: [
    {
      title: "Support when you need it",
      body: "Help channel with human assistance and AI answers so you can get unstuck fast.",
    },
    {
      title: "Truly personalized",
      body: "Your body, goals, tastes, and training level—the plan is built around you.",
    },
    {
      title: "Easy to follow daily",
      body: "Recipes with ingredients, a clear routine, and shopping lists so you don’t wing it.",
    },
  ],
  intakeQuestion: "Prefer to leave your details and have our team reach out?",
  intakeLink: "Complete the intake form",
  closingText:
    "FitPlan brings nutrition and training together in one simple flow so you always know what to eat, how to train, and how to measure progress.",
  closingCta: "Create my account",
  head: {
    title: "FitPlan | Personalized Meal & Training Plans with AI",
    description:
      "Build your personalised meal and training plan with AI: weekly menus with exact ingredients, gym routines matched to your level, macros and PDF export.",
    keywords:
      "personalized meal plan, AI workout plan, custom diet, gym routine, macros, calories, personalized training, weight loss, muscle gain, fat loss, body recomposition, healthy eating, online nutritionist, personal trainer, meal plan, fitness, sports nutrition",
    canonical: `${SITE}/en`,
    ogTitle: "FitPlan | Personalized Nutrition & Training with AI",
    ogDescription: "Meal and training plans tailored by professionals and scaled with AI. Start free.",
    twitterTitle: "FitPlan | Personalized Nutrition & Training with AI",
    twitterDescription: "Nutrition + training tailored by experts and powered by AI. Start free.",
    ogLocale: "en_US",
    ogLocaleAlternate: "es_AR",
  },
  jsonLdOrganizationDescription:
    "Platform for personalized meal and training plans powered by artificial intelligence.",
  jsonLdWebSiteAlt: "FitPlan — Smart Nutrition & Training",
  jsonLdSoftwareDescription:
    "Create a personalized meal and training plan with AI, matched to your goal, experience, injuries and available equipment.",
  jsonLdSoftwareOfferDescription: "Free plan for 30 days",
  jsonLdSoftwareCurrency: "USD",
  jsonLdFeatureList: [
    "Personalized weekly meal plan",
    "Training routines adapted to your level",
    "Automatic macronutrient calculation",
    "Progress tracking",
    "PDF download",
    "Automatic shopping lists",
  ],
  faq: [
    {
      q: "What is FitPlan?",
      a: "FitPlan creates personalized meal and training plans using artificial intelligence. Your plan is built from your goal, experience, injuries and available equipment, and it is recalculated with your real progress.",
    },
    {
      q: "Is FitPlan free?",
      a: "Yes—you can create your first plan for free and access it for 30 days. After that, a premium subscription is required to keep full access.",
    },
    {
      q: "How does the meal plan work?",
      a: "You complete a form with your goals, preferences, and context. The AI generates a detailed weekly plan with recipes, exact ingredients, calories, and macros tailored to you.",
    },
    {
      q: "Does the plan include training?",
      a: "Yes. FitPlan generates a gym routine based on your experience level, goals, and available training days.",
    },
  ],
};

export function getHomeLandingCopy(locale: LandingLocale): HomeLandingCopy {
  return locale === "en" ? en : es;
}

export { SITE };
