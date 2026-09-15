import Head from "next/head";
import { useRouter } from "next/router";
import { motion, useReducedMotion } from "framer-motion";
import { FaCheckCircle, FaBolt, FaBrain, FaDumbbell, FaUtensils, FaWhatsapp } from "react-icons/fa";
import { getStripeSubscriptionPlans } from "@/lib/stripePlanPrices";

/** Precio real, para que la preview no muestre uno que ya no existe. */
const PREVIEW_EUR = getStripeSubscriptionPlans("eur");

/**
 * PROPUESTA — techo de 3 colores aplicado a `transformacion-fitplan.tsx` (es/en)
 * -----------------------------------------------------------------------------
 * NO es una pantalla real: es la demo visual que acompaña DESIGN_SYSTEM.md §14.
 * Nada de Firestore/auth/analytics real — botones sin handler real, solo para ver el layout.
 *
 * Por qué existe esta demo (no solo el mapeo en el doc): la página real nunca pasó por el
 * rollout de tokens ("FitPlan Volt", ver §5) — es 100% clases Tailwind crudas, así que no
 * alcanza con "sacar un color", hay que migrar el archivo entero. Se comparó contra una
 * captura real (1440px y 390px, es y en) antes de proponer nada — ver §14 para el conteo.
 *
 * Qué cambia respecto al archivo real:
 *  - 4 hues no-neutros conviviendo a la vez (cian/azul, esmeralda, ámbar/naranja, y el lima
 *    de marca que solo aparecía en el banner de cookies, ajeno a esta página) → 2: neutro y
 *    `--accent` (lima), el mismo criterio ya aplicado en `HomeLanding.tsx` (que sí pasó por
 *    el rollout y hoy usa un solo acento en toda la pantalla).
 *  - El mismo CTA ("Activar FitPlan Premium") cambiaba de color según la sección en la que
 *    apareciera (azul→cian arriba, ámbar→naranja en la oferta) — ahora es siempre
 *    `.btn-primary` (lima sólido), la misma decisión ya aprobada para el dashboard (§13.5,
 *    Opción A) — no es una decisión nueva, es aplicar la que ya está resuelta a nivel sistema.
 *  - "Asesoría 1:1" (el camino secundario) ya no tiene su propio hue permanente (esmeralda)
 *    corriendo en paralelo al lima en 4 secciones distintas — se distingue por estructura
 *    (icono, copy, `.btn-secondary`) en vez de por color, igual que cualquier segunda opción
 *    del resto de la app.
 *  - El plan "recomendado" del pricing (antes con ring ámbar) usa ring `--accent` — el mismo
 *    lima que ya hace de "esto es lo importante" en el resto de la página, no un tercer hue.
 *  - `useReducedMotion()` agregado (la página real no lo tenía en su único bloque animado).
 *
 * No se tocan textos/copy más allá de lo mínimo para que la estructura se lea — el copy real
 * lo define `producto`/marketing, esta demo es solo de color y estructura visual.
 */
export default function TransformacionDesignPreview() {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const fadeUp = reduceMotion ? { initial: false as const } : { initial: { y: 12 }, animate: { y: 0 } };

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <Head>
        <title>Propuesta · transformacion-fitplan (techo de 3 colores)</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <header className="border-b border-[var(--landing-border)] px-4 py-3 text-center text-xs text-[var(--landing-muted)]">
        Demo de diseño · no es la página real. Ver DESIGN_SYSTEM.md §14.
      </header>

      <main className="px-4 md:px-6">
        {/* Hero */}
        <section className="max-w-6xl mx-auto pt-10 pb-6">
          <motion.div
            {...fadeUp}
            transition={{ duration: 0.35 }}
            className="rounded-3xl border border-[var(--landing-border)] bg-gradient-to-br from-[var(--landing-surface)] to-[color-mix(in_oklab,var(--landing-accent)_8%,transparent)] p-6 md:p-10"
          >
            <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-8 items-center">
              <div>
                <p className="text-[var(--landing-accent)] text-xs md:text-sm mb-3 font-semibold uppercase tracking-wider">
                  Plan de transformación FitPlan · 90 días
                </p>
                <h1 className="text-3xl md:text-5xl font-extrabold leading-tight text-[var(--foreground)]">
                  Transforma tu cuerpo con{" "}
                  <span className="text-[var(--landing-accent)]">FitPlan</span> en 90 días, sin improvisar
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
                  <button type="button" className="btn btn-primary px-7 py-3 text-lg">
                    Activar FitPlan Premium
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push("/formulario-de-inicio")}
                    className="btn btn-secondary px-7 py-3 text-lg"
                  >
                    Quiero asesoría 1:1
                  </button>
                </div>
                <p className="text-xs text-[var(--landing-muted)] mt-4">
                  Desde {PREVIEW_EUR.monthly.price} EUR/mes · Sin permanencia · Diseñado para resultados sostenibles
                </p>
              </div>

              <div className="card-surface-2 rounded-2xl p-5">
                <p className="text-sm font-semibold text-[var(--foreground)]">
                  Lo que notarás en tus primeras semanas con FitPlan:
                </p>
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

        {/* 3 features */}
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

        {/* Lo que compras */}
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

        {/* Asesoría 1:1 · camino secundario, sin hue propio */}
        <section className="max-w-6xl mx-auto py-4">
          <div className="card-surface rounded-2xl p-6 md:p-8">
            <h2 className="text-2xl md:text-3xl font-bold text-[var(--foreground)]">
              Si quieres más precisión: asesoría humana 1:1
            </h2>
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
              type="button"
              onClick={() => router.push("/formulario-de-inicio")}
              className="btn btn-secondary mt-6"
            >
              Solicitar asesoría 1:1
            </button>
          </div>
        </section>

        {/* Comparación · se distingue por copy/estructura, no por 2 hues */}
        <section className="max-w-6xl mx-auto py-8">
          <div className="card-surface-2 rounded-2xl p-6 md:p-8 mb-6">
            <h2 className="text-2xl md:text-3xl font-bold text-center text-[var(--foreground)]">
              FitPlan Premium vs Asesoría 1:1
            </h2>
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

          {/* Oferta / pricing · un solo acento hace de "recomendado", no un tercer hue */}
          <div className="card-surface rounded-2xl p-6 md:p-8">
            <h2 className="text-2xl md:text-3xl font-bold text-[var(--foreground)]">Oferta Premium FitPlan</h2>
            <p className="text-[var(--landing-muted)] mt-2">
              Un plan hoy, con un sistema sostenible en el tiempo.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-5">
              <div className="card-surface-2 rounded-xl p-4">
                <p className="text-sm text-[var(--landing-muted)]">Mensual</p>
                <p className="text-2xl font-extrabold mt-1 text-[var(--foreground)]">{PREVIEW_EUR.monthly.price} EUR</p>
              </div>
              <div className="card-surface-2 rounded-xl p-4 ring-1 ring-[var(--landing-accent)]/40">
                <p className="text-sm text-[var(--landing-muted)]">Trimestral</p>
                <p className="text-2xl font-extrabold mt-1 text-[var(--foreground)]">{PREVIEW_EUR.quarterly.price} EUR</p>
                <p className="text-xs text-[var(--landing-accent)] mt-1">Mejor relación precio / resultado</p>
              </div>
              <div className="card-surface-2 rounded-xl p-4">
                <p className="text-sm text-[var(--landing-muted)]">Anual</p>
                <p className="text-2xl font-extrabold mt-1 text-[var(--foreground)]">{PREVIEW_EUR.annual.price} EUR</p>
              </div>
            </div>
            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <button type="button" className="btn btn-primary inline-flex items-center justify-center gap-2 px-7 py-3">
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

        {/* FAQ */}
        <section className="max-w-6xl mx-auto py-10">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-[var(--foreground)]">
            Preguntas frecuentes antes de comprar
          </h2>
          <div className="mt-6 space-y-3">
            {[
              { q: "¿Funciona si soy principiante total?", a: "Sí. El sistema está pensado para empezar con claridad y progresar sin sobrecarga ni confusión." },
              { q: "¿Y si entreno en casa o tengo poco material?", a: "Se adapta al contexto disponible. Un plan útil no exige un gimnasio perfecto." },
              { q: "¿Premium reemplaza la asesoría 1:1?", a: "Premium te da estrategia completa para ejecutar. La asesoría 1:1 suma revisión humana y ajustes más finos." },
            ].map((item) => (
              <details key={item.q} className="card-surface-2 rounded-xl p-4">
                <summary className="cursor-pointer font-semibold text-[var(--foreground)]">{item.q}</summary>
                <p className="text-[var(--landing-muted)] mt-2 text-sm">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Cierre · un solo CTA, mismo acento de toda la página */}
        <section className="max-w-6xl mx-auto pb-14 text-center">
          <div className="card-surface-2 rounded-2xl p-6">
            <h2 className="text-2xl md:text-3xl font-extrabold text-[var(--foreground)]">Empieza hoy con FitPlan</h2>
            <p className="text-[var(--landing-muted)] mt-2">
              Menos caos, más dirección. Si quieres resultados reales, necesitas un sistema ejecutable.
            </p>
            <div className="mt-5 flex flex-col sm:flex-row gap-3 justify-center">
              <button type="button" className="btn btn-primary px-7 py-3">
                Quiero empezar hoy
              </button>
              <button
                type="button"
                onClick={() => router.push("/formulario-de-inicio")}
                className="btn btn-secondary px-7 py-3"
              >
                Ir a asesoría 1:1
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
