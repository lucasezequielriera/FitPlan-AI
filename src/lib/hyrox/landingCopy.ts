import { getStripeSubscriptionPlans } from "@/lib/stripePlanPrices";

/**
 * Copy de la landing pública de HYROX.
 *
 * Reglas que este archivo NO puede romper (las tres vienen de errores reales
 * que ya costaron una corrección en producción):
 *
 * 1. **Nada que no podamos respaldar.** Sin credenciales inventadas, sin
 *    valoraciones, sin cifras de usuarios, sin testimonios. La landing anterior
 *    afirmaba "nutricionistas certificados" y publicaba un `aggregateRating` de
 *    4,8 sobre 150 valoraciones que no existían. Lo cubre `landingClaims.test.ts`.
 * 2. **El precio se deriva**, nunca se escribe a mano. Lo cubre
 *    `planPricesCoherence.test.ts`.
 * 3. Lo que se promete aquí tiene que ser lo que el producto hace de verdad.
 *    Todo lo de abajo es comprobable contra `src/lib/hyrox/`.
 */

const EUR = getStripeSubscriptionPlans("eur");

export const HYROX_LANDING = {
  canonical: "https://www.fitplan-ai.com/hyrox",

  metaTitle: "Plan de entrenamiento HYROX personalizado | FitPlan",
  metaDescription:
    "Plan HYROX adaptado a las semanas que te quedan, a tus días de entreno y a tu material. Ritmos calculados sobre tu 5 km y estrategia de las 8 estaciones.",

  heroKicker: "Entrenamiento HYROX",
  heroTitleA: "Faltan semanas para tu HYROX.",
  heroTitleB: "No un plan de 16.",
  heroSub:
    "Los planes de HYROX suelen venir en bloques cerrados de 12 o 16 semanas. Pero a una carrera uno se apunta cuando se apunta, y un plan de 16 semanas recortado por la mitad no es un plan de 8: es un plan de 16 mal hecho.",
  heroCta: "Crear mi plan HYROX",
  heroCtaSecondary: "Ver qué incluye",
  heroNote: `Incluido en Premium, desde ${EUR.monthly.price} €/mes. Cancelas cuando quieras.`,

  /**
   * El argumento central. Es lo que de verdad diferencia al producto.
   *
   * OJO con los números de aquí: una versión anterior afirmaba que en dobles la
   * carrera se lleva "el 65% del tiempo frente al 50% en individual". Eso
   * contradecía a nuestro propio modelo (`pacing.ts` da 50-58%, y casi idéntico
   * en las dos divisiones) porque confunde dos cosas distintas: en dobles se
   * reparte el TRABAJO, no el RELOJ — las estaciones tardan lo mismo para el
   * equipo. Lo que cambia es cuánto te pesa a TI. Lo cubre `hyroxLanding.test.ts`.
   */
  thesisTitle: "La carrera es, como mínimo, la mitad de la prueba",
  thesisBody:
    "Se corren 8 km repartidos en ocho tramos de uno. Para un corredor rápido eso es la mitad del tiempo total; cuanto más lento el ritmo, más se lleva: puede pasar del 58%. En dobles pesa todavía más de lo que parece: los dos corréis los 8 km enteros, pero el trabajo de estaciones va repartido: el 100% de la carrera con la mitad de la fuerza. Viniendo del gimnasio, ahí está casi todo el margen, y también el riesgo: porque el volumen de carrera es lo que más fácil se sube demasiado rápido cuando se viene de la fuerza.",

  featuresTitle: "Qué hace tu plan que un PDF no hace",
  features: [
    {
      title: "Se reparte según el tiempo que te queda de verdad",
      body: "Si faltan 18 semanas, hay base aeróbica de sobra. Si faltan 6, se recorta la base y se prioriza lo específico, porque la base es lo que más tarda en dar fruto: sin tiempo para construirla, forzarla solo genera fatiga.",
    },
    {
      title: "Más base sin fondo de carrera, menos con él",
      body: "Quien no corre recibe más semanas de rodaje y menos intensidad. No es por ir suave: los tendones y los huesos tardan más en adaptarse que el sistema cardiovascular, así que el cuerpo aguanta el esfuerzo antes de que las estructuras estén listas. Respetar ese margen es la diferencia entre llegar entrenado y llegar tocado.",
    },
    {
      title: "Los ritmos salen de tu marca de 5 km",
      body: "Con tu marca de 5 km se calcula el ritmo al que tendrás que correr dentro de la prueba, que es bastante más lento que en fresco, y se estima tu tiempo final por tramos: carrera, estaciones y transiciones.",
    },
    {
      title: "Te dice dónde está tu margen",
      body: "No dónde se va más tiempo, sino dónde hay más minutos que recortar. Para alguien que ya corre bien puede estar en las estaciones; para quien viene del gimnasio, casi siempre en la carrera.",
    },
    {
      title: "Se adapta a tus días y a tu material",
      body: "De 3 a 6 días por semana. Con box completo, con un gimnasio normal o entrenando en casa: cambian las sustituciones, no la estructura. Con pocos días lo que se cae es la segunda sesión de fuerza, nunca la específica de HYROX.",
    },
    {
      title: "Las 8 estaciones, con el error que más cuesta",
      body: "Orden, pesos por categoría, cómo repartir cada estación si compites en dobles o relevos, y el fallo que más tiempo hace perder en cada una. La roxzone incluida: son minutos enteros que casi nadie entrena.",
    },
  ],

  honestyTitle: "Lo que este plan no hace",
  honestyBody:
    "Si faltan menos de cuatro semanas, te lo dice: en ese plazo la preparación se gestiona, no se construye, y el plan se centra en llegar sin lesiones y con la estrategia clara. Tampoco sustituye a un médico ni a un fisioterapeuta, y si arrastras una lesión hay que resolverla antes de subir volumen.",

  howTitle: "Cómo funciona",
  steps: [
    { n: "1", title: "Tu carrera y tu punto de partida", body: "Fecha, división, días disponibles para entrenar, nivel de carrera y de fuerza, y qué material hay." },
    { n: "2", title: "Tu plan, semana a semana", body: "Fases repartidas hasta el día de la carrera, con las sesiones de cada semana y qué busca cada una." },
    { n: "3", title: "Ajustar y seguir", body: "Los datos se cambian cuando haga falta y el plan se recalcula entero desde ese momento." },
  ],

  faqTitle: "Preguntas frecuentes",
  faq: [
    {
      q: "¿Sirve si nunca he competido en un HYROX?",
      a: "Sí, y de hecho es donde más cambia el resultado. Si es tu primera carrera se contempla el tiempo extra que se pierde en las transiciones por no conocer el recorrido, y el plan dedica sesiones a ensayar la logística además de a entrenar.",
    },
    {
      q: "¿Vale para individual, dobles y relevos?",
      a: "Para las tres. No es una etiqueta: cambia el reparto del trabajo, el ritmo objetivo de carrera y las sesiones de ensayo. En dobles y relevos se practica el reparto real que vais a usar.",
    },
    {
      q: "¿Cuántos días a la semana necesito?",
      a: "Desde 3. Con 3 días tendrás fuerza, una sesión de carrera y la sesión específica de HYROX. Con 5 o 6 se añade trabajo de calidad y una segunda sesión de fuerza.",
    },
    {
      q: "¿Y si no tengo trineo ni SkiErg?",
      a: "El plan lo contempla y sustituye manteniendo el estímulo: cuestas o prensa a alta repetición en lugar del trineo, remo en lugar del SkiErg. Aun así conviene probar el material real un par de veces antes de competir.",
    },
    {
      q: "¿Cuánto cuesta?",
      a: `El plan HYROX está incluido en FitPlan Premium, desde ${EUR.monthly.price} €/mes, con opción trimestral (${EUR.quarterly.price} €) y anual (${EUR.annual.price} €). Se cancela cuando se quiera, sin permanencia.`,
    },
    {
      q: "¿Puedo cambiar la fecha de mi carrera después?",
      a: "Sí. El plan se genera a partir de tus datos, así que al cambiar la fecha, los días disponibles o tu marca de 5 km, se recalcula entero.",
    },
  ],

  finalTitle: "¿Cuántas semanas te quedan?",
  finalBody: "Responde seis preguntas y tendrás tu plan hasta el día de la carrera.",
  finalCta: "Crear mi plan HYROX",
} as const;
