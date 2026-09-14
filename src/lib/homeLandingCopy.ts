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
  /** CTA para usuario ya logueado (header, hero y cierre) · reemplaza signIn/ctaStart/closingCta cuando hay sesión. */
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
    "Contestas unas preguntas y tienes el menú de la semana con las cantidades, la rutina para los días que puedas entrenar, y dónde apuntar lo que levantas.",
  ctaStart: "Empezar gratis",
  ctaPremium: "Ver planes Premium",
  ctaHint: "Necesitas una cuenta para guardar el plan. Se crea en el momento.",
  howItWorksKicker: "Cómo funciona",
  howItWorksTitle: "Tres pasos, sin vueltas",
  steps: [
    {
      step: "1",
      title: "Dinos qué quieres",
      body: "Qué objetivo tienes, qué no comes y cuántos días puedes entrenar.",
    },
    {
      step: "2",
      title: "Recibe el plan",
      body: "Las comidas de la semana con sus cantidades, la lista de la compra hecha y la rutina de esos días.",
    },
    {
      step: "3",
      title: "Apunta lo que haces",
      body: "Cuando cambie tu peso o tus horarios, el plan se rehace con lo nuevo.",
    },
  ],
  chipNutrition: "Nutrición",
  chipAi: "IA",
  chipTraining: "Entrenamiento",
  expertTitle: "El plan cambia cuando cambias tú",
  expertSub:
    "Si has declarado que tienes el hombro tocado, el plan descarta el press militar, el press tras nuca y los fondos en paralelas. Y cada mes se rehace con el peso que has movido de verdad.",
  expertBullets: [
    "Quita los ejercicios que chocan con las lesiones que declares",
    "Los gramos de cada comida, no «una porción»",
    "Se rehace cada mes con lo que has levantado",
  ],
  hyroxKicker: "¿Compites en HYROX?",
  hyroxTitle: "Plan HYROX adaptado a las semanas que te quedan",
  hyroxBody:
    "Fases repartidas según el tiempo real hasta tu carrera, ritmos calculados sobre tu marca de 5 km y estrategia de las 8 estaciones. Individual, dobles y relevos.",
  hyroxCta: "Ver el plan HYROX",
  featuresTitle: "Lo que hay dentro",
  features: [
    {
      title: "Si te atascas, escribes",
      body: "Hay un chat dentro de la app. Lo leo yo y contesto yo, así que no esperes respuesta en diez segundos, pero la vas a tener.",
    },
    {
      title: "Tu cuerpo y tus horarios",
      body: "Lo que pesas, lo que te gusta comer y los días que de verdad puedes ir. Con eso se arma.",
    },
    {
      title: "Sabes qué toca hoy",
      body: "Abres la app y ves la comida de hoy con sus cantidades y los ejercicios de la sesión.",
    },
  ],
  intakeQuestion: "¿Prefieres dejar tus datos y que te escriba yo?",
  intakeLink: "Completa el formulario de inicio",
  closingText:
    "Comer y entrenar en el mismo sitio, sin llevar dos apps y un cuaderno.",
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
    "Planes de alimentación y entrenamiento hechos con IA a partir de los datos de cada persona.",
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
      a: "Una app que te hace el plan de comidas y el de gimnasio con IA. Parte de tu objetivo, tu nivel, tus lesiones y lo que tengas para entrenar, y cada mes lo rehace con lo que hayas hecho.",
    },
    {
      q: "¿Es gratis usar FitPlan?",
      a: "Sí, puedes crear tu primer plan de forma gratuita y acceder a él durante 30 días. Después de ese período, necesitas una suscripción premium para seguir accediendo a tu plan.",
    },
    {
      q: "¿Cómo funciona el plan de alimentación?",
      a: "Completas un formulario con tus datos personales, objetivos y preferencias alimentarias. La IA genera un plan semanal detallado con recetas, ingredientes exactos, calorías y macronutrientes adaptados a ti.",
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
    "Answer a few questions and you get the week's meals with the amounts, the routine for the days you can actually train, and somewhere to log what you lift.",
  ctaStart: "Start for free",
  ctaPremium: "View Premium plans",
  ctaHint: "You need an account to save the plan. Takes a minute.",
  howItWorksKicker: "How it works",
  howItWorksTitle: "Three steps, that is it",
  steps: [
    {
      step: "1",
      title: "Tell us what you want",
      body: "Your goal, what you will not eat, and how many days you can train.",
    },
    {
      step: "2",
      title: "Get the plan",
      body: "The week's meals with amounts, the shopping list already written, and the routine for those days.",
    },
    {
      step: "3",
      title: "Log what you do",
      body: "When your weight or your schedule changes, the plan gets rebuilt around the new one.",
    },
  ],
  chipNutrition: "Nutrition",
  chipAi: "AI",
  chipTraining: "Training",
  expertTitle: "The plan changes when you do",
  expertSub:
    "Told us your shoulder is bad? The plan drops overhead press and upright rows. And every month it gets rebuilt around the weight you actually moved.",
  expertBullets: [
    "Drops the exercises that clash with the injuries you declare",
    "Grams per meal, not \"a serving\"",
    "Rebuilt every month around what you lifted",
  ],
  hyroxKicker: "Racing HYROX?",
  hyroxTitle: "A HYROX plan built around the weeks you actually have left",
  hyroxBody:
    "Phases split by the real time until race day, paces calculated from your 5k, and a strategy for all 8 stations. Individual, doubles and relay.",
  hyroxCta: "See the HYROX plan",
  featuresTitle: "What is inside",
  features: [
    {
      title: "Stuck? Just write",
      body: "There is a chat inside the app. I read it and I answer it, so do not expect a reply in ten seconds, but you will get one.",
    },
    {
      title: "Your body, your schedule",
      body: "What you weigh, what you like to eat, and the days you can really make it. That is what it builds on.",
    },
    {
      title: "You know what today is",
      body: "Open the app and you see today's food with its amounts and the exercises for the session.",
    },
  ],
  intakeQuestion: "Rather leave your details and have me write to you?",
  intakeLink: "Complete the intake form",
  closingText:
    "Eating and training in the same place, without carrying two apps and a notebook.",
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
  jsonLdWebSiteAlt: "FitPlan - Smart Nutrition and Training",
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
      a: "Yes. The first plan is free and yours for 30 days. After that you need a premium subscription to keep it.",
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
