/**
 * Taxonomía de contenido social de FitPlan.
 *
 * El eje principal NO es "de qué habla" sino PARA QUÉ SIRVE cada pieza
 * (`ContentFunction`), porque son objetivos distintos que se optimizan
 * distinto y no se pueden mezclar en la misma pieza sin perder las dos:
 *
 * Contenido 100% educativo, sin CTA de venta hablado en ningún caso — el
 * cierre de marca es fijo e igual en todos los videos (ver
 * `buildCommercialPrompt.ts`). `ContentFunction` ya no decide si hay CTA o
 * no; decide profundidad y ángulo:
 *
 * - alcance:    que te descubra gente nueva. Hook agresivo, tema amplio y
 *               compartible.
 * - nutricion:  que quien ya te vio confíe. Profundidad, mecanismo, cara
 *               visible del proyecto.
 * - conversion: confianza profunda. Ataca una objeción real de frente con
 *               contenido, no con una oferta — sigue siendo la función de
 *               menos alcance por diseño (tema más específico), pero ya no
 *               "vende": explica.
 *
 * Mezcla objetivo ~60/30/10 (alcance/nutrición/conversión). Hasta 2026-08 se
 * resolvía asignando una función fija por HORA de slot (`functionForSlot`,
 * retirada) — dejó de tener sentido cuando la cadencia bajó a un reel cada 2
 * días en solo dos horarios (20:30/01:30, ambos fuera de la franja de
 * mediodía): cualquier mapeo hora→función dejaba temas enteros sin
 * generarse nunca. Ahora la selección del tema NO depende de la hora del
 * slot sino de la FECHA: `pickNextTopic` rota de forma determinística sobre
 * TODO el registro (`ROTATION_ORDER`), así que la mezcla de funciones queda
 * dada por la composición del registro mismo en vez de una regla explícita
 * por horario — ver el detalle ahí.
 *
 * El segundo eje es `hook`: la familia de gancho con la que abre la pieza.
 * Se rota explícitamente porque el mayor riesgo de una cuenta automatizada es
 * que todos los videos abran igual — el sistema aprende el patrón, la
 * audiencia también, y la retención de los primeros 3 segundos se desploma.
 */

import { madridDateId, dateIdToDayIndex } from "@/lib/socialContent/scheduleStore";

/** Para qué sirve la pieza dentro del embudo. */
export type ContentFunction = "alcance" | "nutricion" | "conversion";

/**
 * Familia de gancho de los primeros 3 segundos. Cada una instala una pregunta
 * abierta distinta en la cabeza de quien mira; rotarlas evita que la cuenta
 * suene siempre igual.
 */
export type HookFamily =
  /** Contradice el consenso: "esto que todos repiten está mal". */
  | "contradiccion"
  /** Coste evitable: "esto te está costando X sin que lo sepas". */
  | "coste"
  /** Curiosidad específica: un dato concreto que no se ve venir. */
  | "curiosidad"
  /** Callout de identidad: "si haces X, esto va por ti". */
  | "identidad"
  /** Confesión / vulnerabilidad: algo que normalmente no se cuenta. */
  | "confesion";

export type SocialTopic =
  // --- alcance ---
  | "mito_polemico"
  | "comparacion_shock"
  | "error_viral"
  | "verdad_industria"
  | "pregunta_incomoda"
  | "coste_oculto"
  | "dato_contraintuitivo"
  | "confesion_fundador"
  | "dato_curioso_fitness"
  | "tecnica_correcta_incorrecta"
  | "mito_suplemento"
  // --- nutrición ---
  | "mecanismo_explicado"
  | "tip_entrenamiento"
  | "tip_nutricion"
  | "caso_practico"
  | "detras_de_escena"
  | "tecnica_grupo_muscular"
  | "comida_por_objetivo"
  | "variantes_ejercicio"
  // --- conversión ---
  | "objecion_tiempo"
  | "objecion_ya_probe"
  | "mecanismo_unico"
  | "prueba_resultado";

type TopicDef = { fn: ContentFunction; hook: HookFamily; label: string };

export const TOPIC_REGISTRY: Record<SocialTopic, TopicDef> = {
  // --- alcance (~48% del registro): optimizadas para retención + compartidos ---
  mito_polemico: { fn: "alcance", hook: "contradiccion", label: "Mito polémico" },
  comparacion_shock: { fn: "alcance", hook: "curiosidad", label: "Comparación shock" },
  error_viral: { fn: "alcance", hook: "coste", label: "Error que todos cometen" },
  verdad_industria: { fn: "alcance", hook: "confesion", label: "Verdad incómoda de la industria" },
  pregunta_incomoda: { fn: "alcance", hook: "identidad", label: "Pregunta incómoda" },
  coste_oculto: { fn: "alcance", hook: "coste", label: "Coste oculto" },
  dato_contraintuitivo: { fn: "alcance", hook: "curiosidad", label: "Dato contraintuitivo" },
  confesion_fundador: { fn: "alcance", hook: "confesion", label: "Confesión del fundador" },
  dato_curioso_fitness: { fn: "alcance", hook: "curiosidad", label: "Dato curioso de fitness" },
  tecnica_correcta_incorrecta: { fn: "alcance", hook: "contradiccion", label: "Técnica correcta vs. incorrecta" },
  mito_suplemento: { fn: "alcance", hook: "contradiccion", label: "Mito sobre un suplemento" },

  // --- nutrición (~35% del registro): construyen confianza y relación ---
  mecanismo_explicado: { fn: "nutricion", hook: "curiosidad", label: "Mecanismo explicado" },
  tip_entrenamiento: { fn: "nutricion", hook: "coste", label: "Tip de entrenamiento" },
  tip_nutricion: { fn: "nutricion", hook: "coste", label: "Tip de nutrición" },
  caso_practico: { fn: "nutricion", hook: "identidad", label: "Caso práctico" },
  detras_de_escena: { fn: "nutricion", hook: "confesion", label: "Detrás de escena" },
  tecnica_grupo_muscular: { fn: "nutricion", hook: "curiosidad", label: "Técnica por grupo muscular" },
  comida_por_objetivo: { fn: "nutricion", hook: "coste", label: "Comida según objetivo" },
  variantes_ejercicio: { fn: "nutricion", hook: "identidad", label: "Variantes de un mismo ejercicio" },

  // --- conversión (~17% del registro): confianza profunda, sin CTA — poco alcance por diseño (tema específico) ---
  objecion_tiempo: { fn: "conversion", hook: "identidad", label: "Objeción: no tengo tiempo" },
  objecion_ya_probe: { fn: "conversion", hook: "identidad", label: "Objeción: ya probé y lo dejé" },
  mecanismo_unico: { fn: "conversion", hook: "contradiccion", label: "Mecanismo único de FitPlan" },
  prueba_resultado: { fn: "conversion", hook: "curiosidad", label: "Prueba > promesa" },
};

export const SOCIAL_TOPICS = Object.keys(TOPIC_REGISTRY) as SocialTopic[];

/**
 * Etiquetas de temas viejos que ya no se generan pero siguen existiendo en el
 * historial de Firestore — para que el panel admin no muestre slugs crudos.
 */
const LEGACY_LABELS: Record<string, string> = {
  mito_realidad: "Mito vs. realidad",
  motivacional: "Mensaje motivacional",
  feature_app: "Feature de la app",
  confesion_incomoda: "Confesión incómoda",
};

export function topicLabel(topic: SocialTopic | string): string {
  return TOPIC_REGISTRY[topic as SocialTopic]?.label ?? LEGACY_LABELS[topic] ?? topic;
}

export function topicFunction(topic: SocialTopic): ContentFunction {
  return TOPIC_REGISTRY[topic]?.fn ?? "alcance";
}

export function topicHookFamily(topic: SocialTopic): HookFamily {
  return TOPIC_REGISTRY[topic]?.hook ?? "curiosidad";
}

/**
 * Orden fijo y curado de TODO `SOCIAL_TOPICS` (una sola vez por tema, sin
 * repetir), armado a mano para que la función de embudo y la familia de
 * gancho varíen entre piezas consecutivas en vez de agruparse — recorrer
 * `SOCIAL_TOPICS` en el orden en que está declarado agruparía, por ejemplo,
 * los ~11 temas de alcance seguidos, que es exactamente lo que se quiere
 * evitar (2026-08, reemplaza a `functionForSlot`, retirada: con la cadencia
 * actual de un reel cada 2 días en dos horarios fuera de la franja de
 * mediodía, cualquier mapeo hora→función dejaba categorías muertas — ver
 * `pickNextTopic`).
 *
 * La mezcla de funciones a lo largo de una vuelta completa queda dada por la
 * composición real del registro (11 alcance / 8 nutrición / 4 conversión de
 * 23 ≈ 48/35/17), no por una regla explícita de día de semana como antes.
 *
 * INVARIANTE: tiene que contener cada elemento de `SOCIAL_TOPICS` EXACTAMENTE
 * una vez (cubierto indirectamente por los tests de cobertura de
 * `socialContentTopics.test.ts`: si falta un tema o hay uno de más, esos
 * tests fallan) — si se agrega un tema nuevo al registro sin agregarlo acá,
 * TypeScript no lo detecta solo (es un array, no un `Record`), así que el
 * test es quien lo cubre.
 */
const ROTATION_ORDER: SocialTopic[] = [
  "mecanismo_explicado",
  "coste_oculto",
  "caso_practico",
  "mecanismo_unico",
  "detras_de_escena",
  "comparacion_shock",
  "error_viral",
  "variantes_ejercicio",
  "mito_polemico",
  "tecnica_grupo_muscular",
  "verdad_industria",
  "comida_por_objetivo",
  "objecion_tiempo",
  "dato_contraintuitivo",
  "mito_suplemento",
  "tip_entrenamiento",
  "pregunta_incomoda",
  "prueba_resultado",
  "confesion_fundador",
  "dato_curioso_fitness",
  "tip_nutricion",
  "objecion_ya_probe",
  "tecnica_correcta_incorrecta",
];

/**
 * Día absoluto (días desde epoch UTC), pero del CALENDARIO DE MADRID, no del
 * día crudo de `date.getTime()`.
 *
 * Esto importa porque los horarios reales de disparo (`SocialSchedule.timesLocal`,
 * hoy `["20:30", "01:30"]` hora Madrid) no caen del mismo lado de la
 * medianoche UTC de forma consistente: en horario de verano (CEST), 01:30
 * Madrid es 23:30 UTC del día ANTERIOR. Si se usara el día UTC crudo, dos
 * piezas reales separadas por `intervalDays` en el calendario de Madrid
 * podían caer en el mismo día UTC (o saltar de más), rompiendo el incremento
 * "+1 exacto por pieza" del que depende la garantía de cobertura de
 * `rotationIndex` — se detectó simulando los disparos reales de
 * `dueReelSlotsNow`, no con fechas sintéticas espaciadas a mano.
 *
 * Mismo criterio que usa el propio gate de disparo (`isDueByInterval` /
 * `dateIdToDayIndex` en scheduleStore.ts, sobre `madridDateId`) — una sola
 * fuente de verdad de "a qué día pertenece" un horario, reutilizada acá en
 * vez de reinventada.
 */
function absoluteDayIndex(date: Date): number {
  return dateIdToDayIndex(madridDateId(date));
}

/**
 * Punto de partida determinístico dentro de `ROTATION_ORDER` para una fecha
 * dada, dada la cadencia real (`intervalDays` — mismo campo que
 * `SocialSchedule.intervalDays` en scheduleStore.ts).
 *
 * El paso clave es NO indexar directo por día calendario: con la cadencia
 * actual (un reel cada 2 días) el día calendario avanza de a 2 en cada pieza
 * real, así que `día % N` visita solo una fracción de los residuos y deja
 * temas sin usar para siempre (se probó a mano, falla incluso con `N`
 * primo). La forma robusta es contar OCURRENCIAS reales (`k`), no días: `k`
 * crece de a 1 exacto en cada pieza que efectivamente se genera
 * (`Math.floor(día / intervalDays)`), y es esa cuenta la que se indexa
 * directo (`k % N`) — sin repetir y sin huecos en NINGÚN tramo de `N`
 * piezas consecutivas, arranque desde donde arranque, sea cual sea
 * `intervalDays` o el tamaño del registro (no hace falta que sea primo).
 *
 * DESCARTADO A PROPÓSITO: sumarle a `k` un offset que creciera con la
 * "vuelta" completada (para que la vuelta N y la N+1 no empezaran en el
 * mismo tema) — se probó y rompe la garantía de arriba en cuanto la ventana
 * de `N` piezas no arranca justo en un múltiplo de `N` (que es el caso
 * SIEMPRE en producción, porque se arranca desde "hoy", no desde un punto
 * alineado): la vuelta se corta a la mitad, el offset cambia a mitad de
 * camino, y dos piezas de la MISMA ventana de `N` pueden coincidir en el
 * mismo tema — exactamente lo que esto tiene que evitar. La garantía dura
 * (cobertura sin huecos en cualquier ventana) importa más que evitar que el
 * orden se repita idéntico cada ~mes y medio (que además se diluye solo en
 * cuanto `pickWeighted` empieza a pesar por rendimiento real, ver abajo).
 *
 * Sigue siendo puro y sin estado: se recalcula entero desde `date` +
 * `intervalDays` en cada llamada, no depende de leer Firestore ni de
 * recordar la vuelta anterior — sobrevive un reinicio sin desincronizarse.
 */
function rotationIndex(date: Date, intervalDays: number): number {
  const n = ROTATION_ORDER.length;
  const step = Math.max(1, Math.round(intervalDays) || 1);
  const day = absoluteDayIndex(date);
  const occurrence = Math.floor(day / step);
  return ((occurrence % n) + n) % n;
}

/** Puntaje medio histórico y tamaño de muestra de un tema — ver `performanceInsights.ts`. */
export type TopicStats = { avgScore: number; sampleSize: number };
export type TopicPerformanceMap = Partial<Record<SocialTopic, TopicStats>>;

/**
 * Por debajo de esta cantidad de piezas medidas, un tema se trata como "sin
 * datos todavía" en vez de confiar en su promedio. Exportado porque
 * `socialContentPerformance.ts` lo usa para mostrar en el admin cuántos
 * temas ya "se ganaron" el pesado por rendimiento — un solo umbral, no dos
 * copias que se puedan desincronizar.
 */
export const MIN_SAMPLES_TO_TRUST = 2;

/**
 * Resultado de `pickNextTopic`, con el "por qué" además del tema —
 * para poder auditar en cada pieza generada si el sistema pesó por
 * rendimiento real o si todavía no había datos suficientes y usó la
 * rotación de siempre. Sin esto, el aprendizaje por métricas es una caja
 * negra imposible de verificar desde afuera (ver `generateDailyContent.ts`,
 * que guarda esto en el doc de cada pieza).
 */
export type TopicSelection = {
  topic: SocialTopic;
  mode: "weighted" | "rotation";
  poolSize: number;
  /** Cuántos temas del pool final tenían datos confiables al momento de elegir. */
  topicsWithData: number;
};

/**
 * Elige un tema del pool ponderando por rendimiento histórico cuando hay
 * señal suficiente (roulette-wheel: más puntaje medio = más probabilidad,
 * no garantía — así un mal día no descarta un tema para siempre). Los temas
 * sin datos (o con menos de `MIN_SAMPLES_TO_TRUST` piezas medidas) reciben un
 * 15% de bonus sobre el promedio del pool para que se sigan probando en vez
 * de quedar enterrados apenas otros temas acumulan buenos resultados —
 * si no, un tema nuevo nunca junta datos porque nunca se elige.
 *
 * Si menos de 2 temas del pool tienen datos confiables todavía, no hay señal
 * real para ponderar: se mantiene la rotación determinística sobre TODO el
 * registro (`ROTATION_ORDER`, no solo el pool) arrancando en
 * `rotationIndex(date)` y devolviendo el primer candidato de esa vuelta que
 * siga estando en el pool ya filtrado (recientes y gancho evitados) —
 * predecible y con cobertura pareja mientras se junta historial real.
 */
function pickWeighted(
  pool: SocialTopic[],
  performance: TopicPerformanceMap,
  date: Date,
  intervalDays: number
): TopicSelection {
  const withEnoughData = pool.filter((t) => (performance[t]?.sampleSize ?? 0) >= MIN_SAMPLES_TO_TRUST);
  if (withEnoughData.length < 2) {
    const n = ROTATION_ORDER.length;
    const start = rotationIndex(date, intervalDays);
    let picked: SocialTopic | undefined;
    for (let i = 0; i < n; i++) {
      const candidate = ROTATION_ORDER[(start + i) % n];
      if (pool.includes(candidate)) {
        picked = candidate;
        break;
      }
    }
    return {
      topic: picked ?? pool[0],
      mode: "rotation",
      poolSize: pool.length,
      topicsWithData: withEnoughData.length,
    };
  }

  const poolAvg = withEnoughData.reduce((sum, t) => sum + performance[t]!.avgScore, 0) / withEnoughData.length;
  const weights = pool.map((t) => {
    const stats = performance[t];
    const score = stats && stats.sampleSize >= MIN_SAMPLES_TO_TRUST ? stats.avgScore : poolAvg * 1.15;
    return Math.max(score, 0.01); // el peso de la ruleta no puede ser 0 ni negativo
  });

  const total = weights.reduce((a, b) => a + b, 0);
  let roll = Math.random() * total;
  for (let i = 0; i < pool.length; i++) {
    roll -= weights[i];
    if (roll <= 0) {
      return { topic: pool[i], mode: "weighted", poolSize: pool.length, topicsWithData: withEnoughData.length };
    }
  }
  return { topic: pool[pool.length - 1], mode: "weighted", poolSize: pool.length, topicsWithData: withEnoughData.length };
}

/**
 * Elige el próximo tema para un reel automático de TODO el registro (ya no
 * de un pool acotado por función de embudo — ver `ROTATION_ORDER`), evitando
 * los usados recientemente y rotando además la familia de gancho: si el
 * gancho de la última pieza publicada se repite en el candidato, se busca
 * otro. Así no salen dos videos seguidos que abren igual, que es el patrón
 * que más rápido quema una cuenta automatizada.
 *
 * La función de embudo (`alcance`/`nutricion`/`conversion`) de la pieza
 * elegida ya NO se decide antes de elegir el tema (eso era `functionForSlot`,
 * retirada): se deriva DESPUÉS con `topicFunction(topic)`, porque es el tema
 * quien la determina, no al revés — ver `startCommercialGeneration` en
 * generateDailyContent.ts.
 *
 * Con `performance` (rendimiento real medido en Instagram, ver
 * `performanceInsights.ts`) la elección final dentro del pool ya filtrado se
 * pondera hacia lo que mejor viene funcionando en vez de rotar a ciegas —
 * ver `pickWeighted`. Sin ese dato (o sin señal suficiente todavía) rota
 * determinísticamente por fecha sobre el registro completo.
 *
 * `intervalDays` tiene que ser el mismo valor que `SocialSchedule.intervalDays`
 * (scheduleStore.ts) — es la cadencia real la que hace que la rotación cubra
 * el registro completo sin huecos ni repeticiones (ver `rotationIndex`). El
 * default (2) es solo para no romper el tipado de callers que no lo pasan
 * (tests, principalmente); en `generateDailyContent.ts` siempre se pasa el
 * valor leído de Firestore.
 */
export function pickNextTopic(
  recentTopics: SocialTopic[],
  date: Date = new Date(),
  performance: TopicPerformanceMap = {},
  intervalDays: number = 2
): TopicSelection {
  const notRecent = SOCIAL_TOPICS.filter((t) => !recentTopics.includes(t));
  const pool = notRecent.length > 0 ? notRecent : SOCIAL_TOPICS;

  const lastHook = recentTopics[0] ? TOPIC_REGISTRY[recentTopics[0]]?.hook : undefined;
  const differentHook = pool.filter((t) => TOPIC_REGISTRY[t].hook !== lastHook);
  const finalPool = differentHook.length > 0 ? differentHook : pool;

  return pickWeighted(finalPool, performance, date, intervalDays);
}
