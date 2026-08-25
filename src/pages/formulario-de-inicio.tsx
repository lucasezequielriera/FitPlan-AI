import Head from "next/head";
import { useRouter } from "next/router";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  getFieldLabels,
  getIntakeFormCopy,
  getIntakeFoodGroupsForUi,
  labelEquipamiento,
  labelPlanLugar,
  labelServicio,
  selectOptions,
  weekdayDisplay,
} from "@/lib/intakeFormI18n";
import {
  INTAKE_DIAS_SEMANA,
  INTAKE_EQUIPAMIENTO,
  INTAKE_FOOD_GROUPS,
  INTAKE_INITIAL_STATE,
  INTAKE_PLAN_LUGAR,
  INTAKE_SERVICIOS,
  type FoodPreference,
  type IntakeFormLocale,
  type IntakeFormState,
  type ObjetivoPrincipal,
  validateIntakeForm,
} from "@/lib/intakeFormSchema";

function toggleValue(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

function cycleFoodPreference(
  current: Record<string, FoodPreference>,
  food: string
): Record<string, FoodPreference> {
  const value = current[food];
  if (value === "gusta") {
    return { ...current, [food]: "no_gusta" };
  }
  if (value === "no_gusta") {
    const next = { ...current };
    delete next[food];
    return next;
  }
  return { ...current, [food]: "gusta" };
}

export default function FormularioDeInicioPage() {
  const router = useRouter();
  const locale: IntakeFormLocale = router.pathname?.startsWith("/en") ? "en" : "es";
  const copy = getIntakeFormCopy(locale);
  const L = getFieldLabels(locale);
  const opt = selectOptions(locale);

  const [form, setForm] = useState<IntakeFormState>(INTAKE_INITIAL_STATE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [motivationalModalOpen, setMotivationalModalOpen] = useState(false);

  const update = <K extends keyof IntakeFormState>(key: K, value: IntakeFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    const validationErrors = validateIntakeForm(form, locale);
    if (validationErrors.length > 0) {
      setError(validationErrors[0]);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/formulario-de-inicio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, formLocale: locale }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || copy.submitErrorGeneric);
      }

      setSuccess(true);
      setForm(INTAKE_INITIAL_STATE);
      setMotivationalModalOpen(true);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : copy.submitErrorGeneric);
    } finally {
      setLoading(false);
    }
  };

  const fieldBase =
    "w-full rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface)] px-3 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--landing-muted)] outline-none transition focus:border-[color-mix(in_oklab,var(--landing-accent)_50%,transparent)] focus:ring-2 focus:ring-[var(--landing-accent)]/25";
  const inputClass = `${fieldBase} min-h-[44px]`;
  const textareaClass = fieldBase;
  const sectionClass =
    "rounded-2xl border border-[var(--landing-border)] bg-[color-mix(in_oklab,var(--landing-surface)_88%,transparent)] p-5 shadow-[0_12px_40px_-18px_rgba(0,0,0,0.35)] space-y-5 md:p-7";
  const detailsClass =
    "rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface)]/60 p-3 md:p-4";
  const chipOff = "rounded-full border border-[var(--landing-border)] bg-[var(--landing-surface)] px-3 py-2 text-sm font-medium text-[var(--landing-muted)] transition hover:border-[color-mix(in_oklab,var(--landing-accent)_35%,transparent)] hover:text-[var(--foreground)]";
  const chipOn = "rounded-full border border-[var(--landing-accent)] bg-[color-mix(in_oklab,var(--landing-accent)_14%,transparent)] px-3 py-2 text-sm font-semibold text-[var(--landing-accent)] shadow-[0_0_20px_-8px_var(--landing-accent)]";
  const chipFoodGusta = "rounded-full border border-success/45 bg-success/15 px-3 py-2 text-sm font-medium text-success";
  const chipFoodNo = "rounded-full border border-danger/45 bg-danger/15 px-3 py-2 text-sm font-medium text-danger";

  return (
    <div className="min-h-screen" lang={locale}>
      {/*
        El título y la descripción ya son distintos por idioma (copy depende de
        `locale`), pero faltaban el canonical y los hreflang: sin ellos las
        versiones /formulario-de-inicio y /en/formulario-de-inicio compiten
        entre sí como contenido duplicado.
      */}
      <Head>
        <title>{copy.metaTitle}</title>
        <meta name="description" content={copy.metaDescription} />
        <meta name="robots" content="index, follow" />
        <link
          rel="canonical"
          href={`https://www.fitplan-ai.com${locale === "en" ? "/en" : ""}/formulario-de-inicio`}
        />
        <link rel="alternate" hrefLang="es" href="https://www.fitplan-ai.com/formulario-de-inicio" />
        <link rel="alternate" hrefLang="en" href="https://www.fitplan-ai.com/en/formulario-de-inicio" />
        <link rel="alternate" hrefLang="x-default" href="https://www.fitplan-ai.com/formulario-de-inicio" />
      </Head>

      <div className="px-4 pb-12 pt-6 md:px-8 md:pb-16 md:pt-10">
        <div className="mx-auto max-w-4xl">
          <motion.div
            initial={{ y: 14 }}
            animate={{ y: 0 }}
            className="overflow-hidden rounded-2xl border border-[var(--landing-border)] bg-[color-mix(in_oklab,var(--background)_94%,#0f172a)] shadow-[0_24px_60px_-28px_rgba(45,212,191,0.18)]"
          >
            <div className="relative border-b border-[var(--landing-border)]/80 bg-gradient-to-br from-[color-mix(in_oklab,var(--landing-accent)_14%,transparent)] via-[var(--landing-surface)] to-[color-mix(in_oklab,#6366f1_10%,transparent)] px-5 py-6 md:px-8 md:py-8">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--landing-accent)]">{copy.heroEyebrow}</p>
              <h1 className="font-display mt-2 text-balance bg-gradient-to-r from-[var(--foreground)] via-[var(--foreground)] to-[var(--landing-accent)] bg-clip-text text-2xl font-bold tracking-tight text-transparent md:text-3xl">
                {copy.heroTitle}
              </h1>
              <p className="mt-3 max-w-2xl text-pretty text-sm font-medium leading-relaxed text-[var(--landing-muted)] md:text-base">
                {copy.heroBody}
              </p>
              <p className="mt-4 inline-flex max-w-full flex-wrap items-center gap-2 rounded-xl border border-[var(--landing-border)] bg-black/25 px-3 py-2 text-xs font-medium leading-snug text-[var(--foreground)]/90">
                <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--landing-accent)] shadow-[0_0_10px_var(--landing-accent)]" aria-hidden />
                <span>
                  {copy.heroTimePrefix}
                  <strong className="text-[var(--foreground)]">{copy.heroTimeBold}</strong>
                  {copy.heroTimeSuffix}
                </span>
              </p>
            </div>

            <div className="p-5 md:p-8">
              <form onSubmit={handleSubmit} className="intake-form space-y-8 md:space-y-10">
              <section className={sectionClass}>
                <div className="flex items-start gap-3 border-b border-[var(--landing-border)]/70 pb-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_oklab,var(--landing-accent)_16%,transparent)] text-sm font-bold text-[var(--landing-accent)] ring-1 ring-[var(--landing-accent)]/35">
                    1
                  </span>
                  <h2 className="font-display pt-0.5 text-lg font-bold tracking-tight text-[var(--foreground)] md:text-xl">{copy.sections.s1}</h2>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <label className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-[var(--landing-muted)]">{L.nombreCompleto}</span>
                    <input className={inputClass} value={form.nombreCompleto} onChange={(e) => update("nombreCompleto", e.target.value)} />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-[var(--landing-muted)]">{L.email}</span>
                    <input type="email" className={inputClass} value={form.email} onChange={(e) => update("email", e.target.value)} />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-[var(--landing-muted)]">{L.whatsapp}</span>
                    <input className={inputClass} placeholder={L.phWhatsapp} value={form.whatsapp} onChange={(e) => update("whatsapp", e.target.value)} />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-[var(--landing-muted)]">{L.instagram}</span>
                    <input
                      className={inputClass}
                      placeholder={L.phInstagram}
                      value={form.instagram}
                      onChange={(e) => update("instagram", e.target.value)}
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-[var(--landing-muted)]">{L.ciudadPais}</span>
                    <input
                      className={inputClass}
                      placeholder={L.phCiudad}
                      value={form.ciudadPais}
                      onChange={(e) => update("ciudadPais", e.target.value)}
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-[var(--landing-muted)]">{L.servicio}</span>
                    <select className={inputClass} value={form.servicioInteres} onChange={(e) => update("servicioInteres", e.target.value)}>
                      <option value="">{copy.selectPlaceholder}</option>
                      {INTAKE_SERVICIOS.map((service) => (
                        <option key={service} value={service}>
                          {labelServicio(service, locale)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-[var(--landing-muted)]">{L.edad}</span>
                    <input type="number" className={inputClass} value={form.edad} onChange={(e) => update("edad", e.target.value)} />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-[var(--landing-muted)]">{L.sexo}</span>
                    <select className={inputClass} value={form.sexo} onChange={(e) => update("sexo", e.target.value)}>
                      {opt.sexo.map(({ v, l }) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-[var(--landing-muted)]">{L.altura}</span>
                    <input type="number" className={inputClass} value={form.alturaCm} onChange={(e) => update("alturaCm", e.target.value)} />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-[var(--landing-muted)]">{L.peso}</span>
                    <input type="number" className={inputClass} value={form.pesoKg} onChange={(e) => update("pesoKg", e.target.value)} />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-[var(--landing-muted)]">{L.pesoObj}</span>
                    <input type="number" className={inputClass} value={form.pesoObjetivoKg} onChange={(e) => update("pesoObjetivoKg", e.target.value)} />
                  </label>
                </div>
              </section>

              <section className={sectionClass}>
                <div className="flex items-start gap-3 border-b border-[var(--landing-border)]/70 pb-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_oklab,var(--landing-accent)_16%,transparent)] text-sm font-bold text-[var(--landing-accent)] ring-1 ring-[var(--landing-accent)]/35">
                    2
                  </span>
                  <h2 className="font-display pt-0.5 text-lg font-bold tracking-tight text-[var(--foreground)] md:text-xl">{copy.sections.s2}</h2>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <label className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-[var(--landing-muted)]">{L.objPrincipal}</span>
                    <select className={inputClass} value={form.objetivoPrincipal} onChange={(e) => update("objetivoPrincipal", e.target.value as ObjetivoPrincipal)}>
                      {opt.objetivo.map(({ v, l }) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-[var(--landing-muted)]">{L.fechaObj}</span>
                    <input type="date" className={inputClass} value={form.fechaObjetivo} onChange={(e) => update("fechaObjetivo", e.target.value)} />
                  </label>
                </div>
                <label className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-[var(--landing-muted)]">{L.objSec}</span>
                  <textarea rows={3} className={textareaClass} placeholder={L.phObjSec} value={form.objetivoSecundario} onChange={(e) => update("objetivoSecundario", e.target.value)} />
                </label>
              </section>

              <section className={sectionClass}>
                <div className="flex items-start gap-3 border-b border-[var(--landing-border)]/70 pb-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_oklab,var(--landing-accent)_16%,transparent)] text-sm font-bold text-[var(--landing-accent)] ring-1 ring-[var(--landing-accent)]/35">
                    3
                  </span>
                  <h2 className="font-display pt-0.5 text-lg font-bold tracking-tight text-[var(--foreground)] md:text-xl">{copy.sections.s3}</h2>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <label className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-[var(--landing-muted)]">{L.diasEntrenaAhora}</span>
                    <input type="number" min={0} max={7} className={inputClass} placeholder={L.phDiasN} value={form.diasEntrenaActualmente} onChange={(e) => update("diasEntrenaActualmente", e.target.value)} />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-[var(--landing-muted)]">{L.diasCompromiso}</span>
                    <input type="number" min={1} max={7} className={inputClass} placeholder={L.phDiasN} value={form.diasCompromisoEntrenamiento} onChange={(e) => update("diasCompromisoEntrenamiento", e.target.value)} />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-[var(--landing-muted)]">{L.horaEntreno}</span>
                    <input className={inputClass} placeholder={L.phHora} value={form.horaEntrenamiento} onChange={(e) => update("horaEntrenamiento", e.target.value)} />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-[var(--landing-muted)]">{L.duracion}</span>
                    <input className={inputClass} placeholder={L.phDuracion} value={form.duracionSesion} onChange={(e) => update("duracionSesion", e.target.value)} />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-[var(--landing-muted)]">{L.planLugar}</span>
                    <select className={inputClass} value={form.planLugar} onChange={(e) => update("planLugar", e.target.value)}>
                      {INTAKE_PLAN_LUGAR.map((option) => (
                        <option key={option} value={option}>
                          {labelPlanLugar(option, locale)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-[var(--landing-muted)]">{L.materialCasa}</span>
                    <input className={inputClass} placeholder={L.phMaterial} value={form.materialCasa} onChange={(e) => update("materialCasa", e.target.value)} />
                  </label>
                </div>

                <div>
                  <p className="mb-2 text-sm font-medium text-[var(--landing-muted)]">{copy.trainingDaysQuestion}</p>
                  <div className="flex flex-wrap gap-2">
                    {INTAKE_DIAS_SEMANA.map((dia) => (
                      <button
                        key={dia}
                        type="button"
                        onClick={() => update("diasDisponibles", toggleValue(form.diasDisponibles, dia))}
                        className={form.diasDisponibles.includes(dia) ? chipOn : chipOff}
                      >
                        {weekdayDisplay(dia, locale)}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-sm font-medium text-[var(--landing-muted)]">{copy.equipmentQuestion}</p>
                  <div className="flex flex-wrap gap-2">
                    {INTAKE_EQUIPAMIENTO.map((equipo) => (
                      <button
                        key={equipo}
                        type="button"
                        onClick={() => update("equipamientoDisponible", toggleValue(form.equipamientoDisponible, equipo))}
                        className={form.equipamientoDisponible.includes(equipo) ? chipOn : chipOff}
                      >
                        {labelEquipamiento(equipo, locale)}
                      </button>
                    ))}
                  </div>
                </div>

                <details className={detailsClass}>
                  <summary className="cursor-pointer text-sm font-semibold text-[var(--landing-accent)] hover:underline">
                    {copy.detailsMoreTraining}
                  </summary>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 mt-4">
                    <label className="flex flex-col gap-1">
                      <span className="text-sm font-medium text-[var(--landing-muted)]">{L.expEntreno}</span>
                      <select className={inputClass} value={form.experienciaEntrenamiento} onChange={(e) => update("experienciaEntrenamiento", e.target.value)}>
                        {opt.experiencia.map(({ v, l }) => (
                          <option key={v} value={v}>
                            {l}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-sm font-medium text-[var(--landing-muted)]">{L.minSesion}</span>
                      <input className={inputClass} placeholder={L.phDiasN} value={form.minutosPorSesion} onChange={(e) => update("minutosPorSesion", e.target.value)} />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-sm font-medium text-[var(--landing-muted)]">{L.horasSentado}</span>
                      <input className={inputClass} placeholder="E.g. 8" value={form.horasSentado} onChange={(e) => update("horasSentado", e.target.value)} />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-sm font-medium text-[var(--landing-muted)]">{L.pasos}</span>
                      <input className={inputClass} placeholder="E.g. 6,000" value={form.pasosDiarios} onChange={(e) => update("pasosDiarios", e.target.value)} />
                    </label>
                  </div>
                </details>
              </section>

              <section className={sectionClass}>
                <div className="flex flex-col gap-2 border-b border-[var(--landing-border)]/70 pb-4 sm:flex-row sm:items-start sm:gap-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_oklab,var(--landing-accent)_16%,transparent)] text-sm font-bold text-[var(--landing-accent)] ring-1 ring-[var(--landing-accent)]/35">
                    4
                  </span>
                  <div>
                    <h2 className="font-display text-lg font-bold tracking-tight text-[var(--foreground)] md:text-xl">{copy.sections.s4}</h2>
                    <p className="mt-1 text-sm text-[var(--landing-muted)]">{copy.sections.s4intro}</p>
                  </div>
                </div>
                <details className={detailsClass} open>
                  <summary className="cursor-pointer text-sm font-semibold text-[var(--landing-accent)] hover:underline">
                    {copy.detailsHealth}
                  </summary>
                  <div className="space-y-4 mt-4">
                    <label className="flex flex-col gap-1">
                      <span className="text-sm font-medium text-[var(--landing-muted)]">{L.enfInfancia}</span>
                      <textarea rows={2} className={textareaClass} value={form.enfermedadInfancia} onChange={(e) => update("enfermedadInfancia", e.target.value)} />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-sm font-medium text-[var(--landing-muted)]">{L.lesiones}</span>
                      <textarea rows={2} className={textareaClass} placeholder={L.phLesiones} value={form.lesionesDolores} onChange={(e) => update("lesionesDolores", e.target.value)} />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-sm font-medium text-[var(--landing-muted)]">{L.cirugias}</span>
                      <textarea rows={2} className={textareaClass} value={form.cirugiasPrevias} onChange={(e) => update("cirugiasPrevias", e.target.value)} />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-sm font-medium text-[var(--landing-muted)]">{L.medicacion}</span>
                      <textarea rows={2} className={textareaClass} value={form.medicacionSuplementos} onChange={(e) => update("medicacionSuplementos", e.target.value)} />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-sm font-medium text-[var(--landing-muted)]">{L.patologias}</span>
                      <textarea rows={2} className={textareaClass} placeholder={L.phPat} value={form.patologias} onChange={(e) => update("patologias", e.target.value)} />
                    </label>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <label className="flex flex-col gap-1">
                        <span className="text-sm font-medium text-[var(--landing-muted)]">{L.diabetes}</span>
                        <select className={inputClass} value={form.diabetesTipo} onChange={(e) => update("diabetesTipo", e.target.value)}>
                          {opt.diabetes.map(({ v, l }) => (
                            <option key={v} value={v}>
                              {l}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-sm font-medium text-[var(--landing-muted)]">{L.hipertension}</span>
                        <select className={inputClass} value={form.hipertensionArterial} onChange={(e) => update("hipertensionArterial", e.target.value)}>
                          {opt.siNo.map(({ v, l }) => (
                            <option key={v} value={v}>
                              {l}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-sm font-medium text-[var(--landing-muted)]">{L.corazon}</span>
                        <input className={inputClass} value={form.enfermedadCorazon} onChange={(e) => update("enfermedadCorazon", e.target.value)} />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-sm font-medium text-[var(--landing-muted)]">{L.hipotiroidismo}</span>
                        <select className={inputClass} value={form.hipotiroidismo} onChange={(e) => update("hipotiroidismo", e.target.value)}>
                          {opt.siNo.map(({ v, l }) => (
                            <option key={v} value={v}>
                              {l}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-sm font-medium text-[var(--landing-muted)]">{L.colesterol}</span>
                        <select className={inputClass} value={form.colesterolTrigliceridos} onChange={(e) => update("colesterolTrigliceridos", e.target.value)}>
                          {opt.colesterol.map(({ v, l }) => (
                            <option key={v} value={v}>
                              {l}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-sm font-medium text-[var(--landing-muted)]">{L.digestivo}</span>
                        <select className={inputClass} value={form.molestiasDigestivasTipo} onChange={(e) => update("molestiasDigestivasTipo", e.target.value)}>
                          {opt.digestivo.map(({ v, l }) => (
                            <option key={v} value={v}>
                              {l}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </div>
                </details>
              </section>

              <section className={sectionClass}>
                <div className="flex items-start gap-3 border-b border-[var(--landing-border)]/70 pb-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_oklab,var(--landing-accent)_16%,transparent)] text-sm font-bold text-[var(--landing-accent)] ring-1 ring-[var(--landing-accent)]/35">
                    5
                  </span>
                  <h2 className="font-display pt-0.5 text-lg font-bold tracking-tight text-[var(--foreground)] md:text-xl">{copy.sections.s5}</h2>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <label className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-[var(--landing-muted)]">{L.descansa}</span>
                    <select className={inputClass} value={form.descansaBien} onChange={(e) => update("descansaBien", e.target.value)}>
                      {opt.descansa.map(({ v, l }) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-[var(--landing-muted)]">{L.estres}</span>
                    <select className={inputClass} value={form.nivelEstres} onChange={(e) => update("nivelEstres", e.target.value)}>
                      {opt.estres.map(({ v, l }) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-[var(--landing-muted)]">{L.suenoCalidad}</span>
                    <select className={inputClass} value={form.calidadSueno} onChange={(e) => update("calidadSueno", e.target.value)}>
                      {opt.calidadSueno.map(({ v, l }) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-[var(--landing-muted)]">{L.horasSueno}</span>
                    <input className={inputClass} placeholder={L.phHs} value={form.horasSueno} onChange={(e) => update("horasSueno", e.target.value)} />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-[var(--landing-muted)]">{L.trabajoHoras}</span>
                    <input className={inputClass} placeholder={L.phTrabajo} value={form.trabajoTurnos} onChange={(e) => update("trabajoTurnos", e.target.value)} />
                  </label>
                </div>

                <div>
                  <p className="mb-2 text-sm font-medium text-[var(--landing-muted)]">{copy.workDaysQuestion}</p>
                  <div className="flex flex-wrap gap-2">
                    {INTAKE_DIAS_SEMANA.map((dia) => (
                      <button
                        key={`trabaja-${dia}`}
                        type="button"
                        onClick={() => update("diasTrabajo", toggleValue(form.diasTrabajo, dia))}
                        className={form.diasTrabajo.includes(dia) ? chipOn : chipOff}
                      >
                        {weekdayDisplay(dia, locale)}
                      </button>
                    ))}
                  </div>
                </div>
              </section>

              <section className={sectionClass}>
                <div className="flex flex-col gap-2 border-b border-[var(--landing-border)]/70 pb-4 sm:flex-row sm:items-start sm:gap-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_oklab,var(--landing-accent)_16%,transparent)] text-sm font-bold text-[var(--landing-accent)] ring-1 ring-[var(--landing-accent)]/35">
                    6
                  </span>
                  <div>
                    <h2 className="font-display text-lg font-bold tracking-tight text-[var(--foreground)] md:text-xl">{copy.sections.s6}</h2>
                    <p className="mt-1 text-sm text-[var(--landing-muted)]">{copy.sections.s6intro}</p>
                  </div>
                </div>
                <label className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-[var(--landing-muted)]">{L.comidasHorarios}</span>
                  <textarea rows={2} className={textareaClass} placeholder={L.phComidas} value={form.comidasPorDiaHorarios} onChange={(e) => update("comidasPorDiaHorarios", e.target.value)} />
                </label>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <label className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-[var(--landing-muted)]">{L.apetito}</span>
                    <select className={inputClass} value={form.apetito} onChange={(e) => update("apetito", e.target.value)}>
                      {opt.apetito.map(({ v, l }) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-[var(--landing-muted)]">{L.masHambre}</span>
                    <input className={inputClass} value={form.momentoMasHambre} onChange={(e) => update("momentoMasHambre", e.target.value)} />
                  </label>
                </div>
                <label className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-[var(--landing-muted)]">{L.snacks}</span>
                  <textarea rows={2} className={textareaClass} value={form.snacksBebidas} onChange={(e) => update("snacksBebidas", e.target.value)} />
                </label>

                <div className="space-y-4 rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface)]/50 p-4 md:p-5">
                  <p className="text-sm font-semibold text-[var(--foreground)]">{copy.foodHelpTitle}</p>
                  <p className="text-xs leading-relaxed text-[var(--landing-muted)]">{copy.foodHelpBody}</p>
                  {getIntakeFoodGroupsForUi(locale).map((group, gi) => (
                    <div key={INTAKE_FOOD_GROUPS[gi].group} className="space-y-2">
                      <p className="text-sm font-medium text-[var(--foreground)]/95">
                        {group.emoji} {group.group}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {group.foods.map(({ key: food, label: foodLabelUi }) => {
                          const value = form.preferenciasAlimentos[food];
                          const className =
                            value === "gusta" ? chipFoodGusta : value === "no_gusta" ? chipFoodNo : chipOff;
                          return (
                            <button
                              key={food}
                              type="button"
                              onClick={() =>
                                update(
                                  "preferenciasAlimentos",
                                  cycleFoodPreference(form.preferenciasAlimentos, food)
                                )
                              }
                              className={className}
                            >
                              {foodLabelUi}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <label className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-[var(--landing-muted)]">{L.alergias}</span>
                    <textarea rows={2} className={textareaClass} value={form.restriccionesAlergias} onChange={(e) => update("restriccionesAlergias", e.target.value)} />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-[var(--landing-muted)]">{L.agua}</span>
                    <input className={inputClass} placeholder={L.phAgua} value={form.aguaPorDia} onChange={(e) => update("aguaPorDia", e.target.value)} />
                  </label>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <label className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-[var(--landing-muted)]">{L.alcohol}</span>
                    <select className={inputClass} value={form.alcoholFrecuencia} onChange={(e) => update("alcoholFrecuencia", e.target.value)}>
                      {opt.alcohol.map(({ v, l }) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-[var(--landing-muted)]">{L.fuma}</span>
                    <select className={inputClass} value={form.fuma} onChange={(e) => update("fuma", e.target.value)}>
                      {opt.fuma.map(({ v, l }) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <label className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-[var(--landing-muted)]">{L.digestion}</span>
                    <textarea rows={2} className={textareaClass} value={form.digestion} onChange={(e) => update("digestion", e.target.value)} />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-[var(--landing-muted)]">{L.presupuesto}</span>
                    <input className={inputClass} placeholder={L.phPres} value={form.presupuestoComida} onChange={(e) => update("presupuestoComida", e.target.value)} />
                  </label>
                </div>

                <label className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-[var(--landing-muted)]">{L.tiempoCocinar}</span>
                  <input className={inputClass} placeholder={L.phCocinar} value={form.tiempoParaCocinar} onChange={(e) => update("tiempoParaCocinar", e.target.value)} />
                </label>

                <label className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-[var(--landing-muted)]">{L.diaTipo}</span>
                  <textarea rows={3} className={textareaClass} value={form.diaTipoComidas} onChange={(e) => update("diaTipoComidas", e.target.value)} />
                </label>

                <label className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-[var(--landing-muted)]">{L.suplementos}</span>
                  <textarea rows={2} className={textareaClass} value={form.suplementosActualesDetalle} onChange={(e) => update("suplementosActualesDetalle", e.target.value)} />
                </label>

                <label className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-[var(--landing-muted)]">{L.quiereSup}</span>
                  <input className={inputClass} value={form.quiereSuplementos} onChange={(e) => update("quiereSuplementos", e.target.value)} />
                </label>

                <label className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-[var(--landing-muted)]">{L.dietaAntes}</span>
                  <select className={inputClass} value={form.haHechoDietaAntes} onChange={(e) => update("haHechoDietaAntes", e.target.value)}>
                    {opt.dietaAntes.map(({ v, l }) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </label>

                {form.haHechoDietaAntes === "si" && (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <label className="flex flex-col gap-1">
                      <span className="text-sm font-medium text-[var(--landing-muted)]">{L.dietaBase}</span>
                      <textarea rows={2} className={textareaClass} value={form.dietaEnQueConsistia} onChange={(e) => update("dietaEnQueConsistia", e.target.value)} />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-sm font-medium text-[var(--landing-muted)]">{L.dietaCuando}</span>
                      <input className={inputClass} value={form.dietaHaceCuanto} onChange={(e) => update("dietaHaceCuanto", e.target.value)} />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-sm font-medium text-[var(--landing-muted)]">{L.dietaCuanto}</span>
                      <input className={inputClass} value={form.dietaCuantoTiempo} onChange={(e) => update("dietaCuantoTiempo", e.target.value)} />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-sm font-medium text-[var(--landing-muted)]">{L.dietaTal}</span>
                      <textarea rows={2} className={textareaClass} value={form.dietaQueTal} onChange={(e) => update("dietaQueTal", e.target.value)} />
                    </label>
                  </div>
                )}
              </section>

              <section className={sectionClass}>
                <div className="flex items-start gap-3 border-b border-[var(--landing-border)]/70 pb-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_oklab,var(--landing-accent)_16%,transparent)] text-sm font-bold text-[var(--landing-accent)] ring-1 ring-[var(--landing-accent)]/35">
                    7
                  </span>
                  <h2 className="font-display pt-0.5 text-lg font-bold tracking-tight text-[var(--foreground)] md:text-xl">{copy.sections.s7}</h2>
                </div>
                <label className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-[var(--landing-muted)]">{L.objRend}</span>
                  <textarea rows={3} className={textareaClass} value={form.objetivoRendimiento} onChange={(e) => update("objetivoRendimiento", e.target.value)} />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-[var(--landing-muted)]">{L.objEst}</span>
                  <textarea rows={3} className={textareaClass} value={form.objetivoEstetico} onChange={(e) => update("objetivoEstetico", e.target.value)} />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-[var(--landing-muted)]">{L.motivacion}</span>
                  <textarea rows={3} className={textareaClass} value={form.motivacionPrincipal} onChange={(e) => update("motivacionPrincipal", e.target.value)} />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-[var(--landing-muted)]">{L.dificultad}</span>
                  <textarea rows={3} className={textareaClass} value={form.dificultadActual} onChange={(e) => update("dificultadActual", e.target.value)} />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-[var(--landing-muted)]">{L.comentarios}</span>
                  <textarea rows={3} className={textareaClass} value={form.comentariosExtra} onChange={(e) => update("comentariosExtra", e.target.value)} />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-[var(--landing-muted)]">{L.textoLibre}</span>
                  <textarea rows={3} className={textareaClass} value={form.textoLibreFinal} onChange={(e) => update("textoLibreFinal", e.target.value)} />
                </label>
              </section>

              <section className={sectionClass}>
                <div className="flex items-start gap-3 border-b border-[var(--landing-border)]/70 pb-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_oklab,var(--landing-accent)_16%,transparent)] text-sm font-bold text-[var(--landing-accent)] ring-1 ring-[var(--landing-accent)]/35">
                    8
                  </span>
                  <h2 className="font-display pt-0.5 text-lg font-bold tracking-tight text-[var(--foreground)] md:text-xl">{copy.sections.s8}</h2>
                </div>
                <label className="flex items-start gap-3 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1 h-[18px] w-[18px] shrink-0 rounded border border-[var(--landing-border)] bg-[var(--landing-surface)] accent-[var(--landing-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--landing-accent)]/35"
                    checked={form.consentimiento}
                    onChange={(e) => update("consentimiento", e.target.checked)}
                  />
                  <span className="text-[var(--landing-muted)] leading-relaxed">{copy.consentText}</span>
                </label>

                {error && (
                  <div className="rounded-xl border border-danger/35 bg-danger/10 px-3 py-2.5 text-sm text-danger">{error}</div>
                )}
                {success && (
                  <div className="rounded-xl border border-success/35 bg-success/10 px-3 py-2.5 text-sm text-success">
                    {copy.successMsg}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !form.consentimiento}
                  className="w-full min-h-[48px] rounded-xl bg-[var(--landing-accent)] px-6 py-3 text-sm font-semibold text-[#0a1628] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] sm:w-auto sm:min-w-[12rem]"
                >
                  {loading ? copy.submitSending : copy.submitCta}
                </button>
              </section>
            </form>
            </div>
          </motion.div>
        </div>
      </div>

      <AnimatePresence>
        {motivationalModalOpen && (
          <div className="fixed inset-0 z-[9999] flex items-end justify-center p-0 sm:items-center sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setMotivationalModalOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 16 }}
              transition={{ duration: 0.22 }}
              className="relative z-10 w-full max-w-lg rounded-t-2xl border border-[var(--landing-border)] border-b-0 bg-[color-mix(in_oklab,var(--background)_95%,#0f172a)] p-6 shadow-2xl sm:rounded-2xl sm:border-b pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:pb-6"
            >
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--landing-accent)]">FitPlan</p>
              <h3 className="font-display mt-2 text-balance bg-gradient-to-r from-[var(--foreground)] to-[var(--landing-accent)] bg-clip-text text-xl font-bold text-transparent">
                {copy.modalTitle}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-[var(--landing-muted)]">{copy.modalLine1}</p>
              <p className="mt-3 text-sm leading-relaxed text-[var(--landing-muted)]">{copy.modalLine2}</p>
              <p className="mt-4 text-sm font-semibold text-[var(--landing-accent)]">{copy.modalLine3}</p>

              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  onClick={() => setMotivationalModalOpen(false)}
                  className="min-h-[44px] rounded-xl bg-[var(--landing-accent)] px-5 py-2.5 text-sm font-semibold text-[#0a1628] transition hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
                >
                  {copy.modalClose}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style jsx global>{`
        .intake-form input:not([type="checkbox"]):not([type="radio"]),
        .intake-form select,
        .intake-form textarea {
          width: 100%;
        }
      `}</style>
    </div>
  );
}
