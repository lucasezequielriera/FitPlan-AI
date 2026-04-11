/**
 * Textos de la landing principal (/) y (/en). Un solo componente, dos idiomas.
 */

export type LandingLocale = "es" | "en";

const SITE = "https://www.fitplan-ai.com";

export interface HomeLandingCopy {
  locale: LandingLocale;
  htmlLang: string;
  redirecting: string;
  skipToContent: string;
  navLangAria: string;
  signIn: string;
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
  redirecting: "Redirigiendo…",
  skipToContent: "Ir al contenido",
  navLangAria: "Idioma",
  signIn: "Entrar",
  logoHref: "/",
  mainId: "contenido-principal",
  heroBadge: "Nutrición + entrenamiento con IA",
  heroTitleBefore: "Un solo plan para comer",
  heroTitleHighlight1: "bien",
  heroTitleMiddle: "y entrenar",
  heroTitleHighlight2: "bien",
  heroSub:
    "Respondés unas preguntas y obtenés menús semanales con ingredientes claros, rutina de gym acorde a tu nivel y seguimiento en un solo lugar.",
  ctaStart: "Empezar gratis",
  ctaPremium: "Ver planes Premium",
  ctaHint: "Iniciá sesión para crear tu plan, guardarlo y activar Premium cuando quieras.",
  howItWorksKicker: "Cómo funciona",
  howItWorksTitle: "Tres pasos, sin vueltas",
  steps: [
    {
      step: "1",
      title: "Contanos tu objetivo",
      body: "Objetivo, preferencias y días disponibles. Sin tecnicismos innecesarios.",
    },
    {
      step: "2",
      title: "Recibí tu plan",
      body: "Comidas con macros, lista de compras y rutina de entrenamiento alineada.",
    },
    {
      step: "3",
      title: "Seguí y ajustá",
      body: "Marcá el progreso y refiná el plan cuando tu cuerpo o tu agenda cambien.",
    },
  ],
  chipNutrition: "Nutrición",
  chipAi: "IA",
  chipTraining: "Entrenamiento",
  expertTitle: "Hecho por expertos, potenciado por IA",
  expertSub:
    "Los lineamientos los pensamos con criterio profesional; la IA te ayuda a llevarlos a un plan concreto, semana a semana, adaptado a vos.",
  expertBullets: ["Nutricionistas certificados", "Entrenadores profesionales", "IA para precisión y velocidad"],
  featuresTitle: "Todo lo que necesitás en la app",
  features: [
    {
      title: "Acompañamiento cuando lo necesitás",
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
  intakeLink: "Completá el formulario de inicio",
  closingText:
    "FitPlan AI une nutrición y entrenamiento en un flujo simple para que sepas qué comer, cómo entrenar y cómo medir el avance.",
  closingCta: "Crear mi cuenta",
  head: {
    title: "FitPlan AI | Plan de Alimentación y Entrenamiento Personalizado con IA",
    description:
      "Creá tu plan de alimentación y entrenamiento personalizado con inteligencia artificial. Menús semanales con ingredientes exactos, rutinas de gym adaptadas a tu nivel, cálculo de macros, seguimiento de progreso y descarga en PDF. Diseñado por nutricionistas y entrenadores profesionales.",
    keywords:
      "plan nutricional personalizado, plan de entrenamiento con IA, dieta personalizada, rutina de gym, macros, calorías, entrenamiento personalizado, bajar de peso, ganar masa muscular, perder grasa, recomposición corporal, alimentación saludable, nutricionista online, entrenador personal, plan alimenticio, dieta saludable, fitness, nutrición deportiva, plan de comidas semanal",
    canonical: `${SITE}/`,
    ogTitle: "FitPlan AI | Alimentación y Entrenamiento Personalizado con IA",
    ogDescription:
      "Planes de alimentación y entrenamiento personalizados por nutricionistas y entrenadores profesionales, potenciados con inteligencia artificial. Empezá gratis.",
    twitterTitle: "FitPlan AI | Alimentación y Entrenamiento Personalizado con IA",
    twitterDescription: "Alimentación + entrenamiento personalizados por expertos y potenciados con IA. Empezá gratis.",
  },
  jsonLdOrganizationDescription:
    "Plataforma de planes de alimentación y entrenamiento personalizados con inteligencia artificial.",
  jsonLdWebSiteAlt: "FitPlan AI - Plan Nutricional y Entrenamiento Inteligente",
  jsonLdSoftwareDescription:
    "Creá tu plan de alimentación y entrenamiento personalizado con inteligencia artificial. Diseñado por nutricionistas certificados y entrenadores profesionales.",
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
      q: "¿Qué es FitPlan AI?",
      a: "FitPlan AI es una plataforma que crea planes de alimentación y entrenamiento personalizados usando inteligencia artificial. Los planes están diseñados por nutricionistas certificados y entrenadores profesionales.",
    },
    {
      q: "¿Es gratis usar FitPlan AI?",
      a: "Sí, podés crear tu primer plan de forma gratuita y acceder a él durante 30 días. Después de ese período, necesitás una suscripción premium para seguir accediendo a tu plan.",
    },
    {
      q: "¿Cómo funciona el plan de alimentación?",
      a: "Completás un formulario con tus datos personales, objetivos y preferencias alimentarias. La IA genera un plan semanal detallado con recetas, ingredientes exactos, calorías y macronutrientes adaptados a vos.",
    },
    {
      q: "¿El plan incluye rutina de entrenamiento?",
      a: "Sí, FitPlan AI genera una rutina de entrenamiento personalizada según tu nivel de experiencia, objetivos y días disponibles para entrenar.",
    },
  ],
};

const en: HomeLandingCopy = {
  locale: "en",
  htmlLang: "en",
  redirecting: "Redirecting…",
  skipToContent: "Skip to content",
  navLangAria: "Language",
  signIn: "Sign in",
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
  expertTitle: "Built by experts, powered by AI",
  expertSub:
    "Guidelines come from professional judgment; AI helps turn them into a concrete weekly plan tailored to you.",
  expertBullets: ["Certified nutritionists", "Professional trainers", "AI for speed and precision"],
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
    "FitPlan AI brings nutrition and training together in one simple flow so you always know what to eat, how to train, and how to measure progress.",
  closingCta: "Create my account",
  head: {
    title: "FitPlan AI | Personalized Meal & Training Plans with AI",
    description:
      "Build a personalized meal and training plan with AI. Weekly menus with clear ingredients, gym routines matched to your level, macro tracking, progress, and PDF export—crafted by nutrition and fitness professionals.",
    keywords:
      "personalized meal plan, AI workout plan, custom diet, gym routine, macros, calories, personalized training, weight loss, muscle gain, fat loss, body recomposition, healthy eating, online nutritionist, personal trainer, meal plan, fitness, sports nutrition",
    canonical: `${SITE}/en`,
    ogTitle: "FitPlan AI | Personalized Nutrition & Training with AI",
    ogDescription: "Meal and training plans tailored by professionals and scaled with AI. Start free.",
    twitterTitle: "FitPlan AI | Personalized Nutrition & Training with AI",
    twitterDescription: "Nutrition + training tailored by experts and powered by AI. Start free.",
    ogLocale: "en_US",
    ogLocaleAlternate: "es_AR",
  },
  jsonLdOrganizationDescription:
    "Platform for personalized meal and training plans powered by artificial intelligence.",
  jsonLdWebSiteAlt: "FitPlan AI — Smart Nutrition & Training",
  jsonLdSoftwareDescription:
    "Create a personalized meal and training plan with AI. Designed by certified nutritionists and professional trainers.",
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
      q: "What is FitPlan AI?",
      a: "FitPlan AI creates personalized meal and training plans using artificial intelligence. Plans are designed by certified nutritionists and professional trainers.",
    },
    {
      q: "Is FitPlan AI free?",
      a: "Yes—you can create your first plan for free and access it for 30 days. After that, a premium subscription is required to keep full access.",
    },
    {
      q: "How does the meal plan work?",
      a: "You complete a form with your goals, preferences, and context. The AI generates a detailed weekly plan with recipes, exact ingredients, calories, and macros tailored to you.",
    },
    {
      q: "Does the plan include training?",
      a: "Yes. FitPlan AI generates a gym routine based on your experience level, goals, and available training days.",
    },
  ],
};

export function getHomeLandingCopy(locale: LandingLocale): HomeLandingCopy {
  return locale === "en" ? en : es;
}

export { SITE };
