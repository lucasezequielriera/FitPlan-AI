import Head from "next/head";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  INTAKE_DIAS_SEMANA,
  INTAKE_EQUIPAMIENTO,
  INTAKE_FOOD_GROUPS,
  INTAKE_INITIAL_STATE,
  INTAKE_LUGARES_ENTRENO,
  INTAKE_PLAN_LUGAR,
  INTAKE_SERVICIOS,
  type FoodPreference,
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
    const validationErrors = validateIntakeForm(form);
    if (validationErrors.length > 0) {
      setError(validationErrors[0]);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/formulario-de-inicio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || "No se pudo enviar el formulario.");
      }

      setSuccess(true);
      setForm(INTAKE_INITIAL_STATE);
      setMotivationalModalOpen(true);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No se pudo enviar el formulario.");
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
  const chipFoodGusta = "rounded-full border border-emerald-400/45 bg-emerald-500/15 px-3 py-2 text-sm font-medium text-emerald-100";
  const chipFoodNo = "rounded-full border border-rose-400/45 bg-rose-500/15 px-3 py-2 text-sm font-medium text-rose-100";

  return (
    <div className="min-h-screen">
      <Head>
        <title>Formulario de Inicio | FitPlan AI</title>
        <meta
          name="description"
          content="Formulario inicial para clientes de entrenamiento y nutrición personalizada con FitPlan."
        />
        <meta name="robots" content="index, follow" />
      </Head>

      <div className="px-4 pb-12 pt-6 md:px-8 md:pb-16 md:pt-10">
        <div className="mx-auto max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            className="overflow-hidden rounded-2xl border border-[var(--landing-border)] bg-[color-mix(in_oklab,var(--background)_94%,#0f172a)] shadow-[0_24px_60px_-28px_rgba(45,212,191,0.18)]"
          >
            <div className="relative border-b border-[var(--landing-border)]/80 bg-gradient-to-br from-[color-mix(in_oklab,var(--landing-accent)_14%,transparent)] via-[var(--landing-surface)] to-[color-mix(in_oklab,#6366f1_10%,transparent)] px-5 py-6 md:px-8 md:py-8">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--landing-accent)]">FitPlan · Seguimiento 1:1</p>
              <h1 className="mt-2 text-balance bg-gradient-to-r from-[var(--foreground)] via-[var(--foreground)] to-[var(--landing-accent)] bg-clip-text text-2xl font-bold tracking-tight text-transparent md:text-3xl">
                Formulario de inicio personalizado
              </h1>
              <p className="mt-3 max-w-2xl text-pretty text-sm font-medium leading-relaxed text-[var(--landing-muted)] md:text-base">
                Este formulario es para crear tu plan 1:1 de entrenamiento y nutrición. No hace falta saber nada técnico: respondé
                con calma y con sinceridad.
              </p>
              <p className="mt-4 inline-flex max-w-full flex-wrap items-center gap-2 rounded-xl border border-[var(--landing-border)] bg-black/25 px-3 py-2 text-xs font-medium leading-snug text-[var(--foreground)]/90">
                <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--landing-accent)] shadow-[0_0_10px_var(--landing-accent)]" aria-hidden />
                <span>
                  Tiempo estimado: <strong className="text-[var(--foreground)]">8-12 min</strong> · cuanto más detalle des, mejor se adaptará tu plan
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
                  <h2 className="pt-0.5 text-lg font-bold tracking-tight text-[var(--foreground)] md:text-xl">Cuéntame sobre ti</h2>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <label className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-[var(--landing-muted)]">Nombre completo *</span>
                    <input className={inputClass} value={form.nombreCompleto} onChange={(e) => update("nombreCompleto", e.target.value)} />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-[var(--landing-muted)]">Email *</span>
                    <input type="email" className={inputClass} value={form.email} onChange={(e) => update("email", e.target.value)} />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-[var(--landing-muted)]">WhatsApp *</span>
                    <input className={inputClass} placeholder="Ej.: +34 6XX XXX XXX" value={form.whatsapp} onChange={(e) => update("whatsapp", e.target.value)} />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-[var(--landing-muted)]">Instagram (opcional)</span>
                    <input
                      className={inputClass}
                      placeholder="Ej.: @tuusuario"
                      value={form.instagram}
                      onChange={(e) => update("instagram", e.target.value)}
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-[var(--landing-muted)]">¿De qué ciudad y país eres? *</span>
                    <input
                      className={inputClass}
                      placeholder="Ej.: Madrid, España / Córdoba, Argentina"
                      value={form.ciudadPais}
                      onChange={(e) => update("ciudadPais", e.target.value)}
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-[var(--landing-muted)]">¿Qué servicio te interesa?</span>
                    <select className={inputClass} value={form.servicioInteres} onChange={(e) => update("servicioInteres", e.target.value)}>
                      <option value="">Seleccionar...</option>
                      {INTAKE_SERVICIOS.map((service) => (
                        <option key={service} value={service}>
                          {service}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-[var(--landing-muted)]">Edad *</span>
                    <input type="number" className={inputClass} value={form.edad} onChange={(e) => update("edad", e.target.value)} />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-[var(--landing-muted)]">Sexo</span>
                    <select className={inputClass} value={form.sexo} onChange={(e) => update("sexo", e.target.value)}>
                      <option value="masculino">Masculino</option>
                      <option value="femenino">Femenino</option>
                      <option value="prefiero_no_decir">Prefiero no decir</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-[var(--landing-muted)]">Altura (cm) *</span>
                    <input type="number" className={inputClass} value={form.alturaCm} onChange={(e) => update("alturaCm", e.target.value)} />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-[var(--landing-muted)]">Peso actual (kg) *</span>
                    <input type="number" className={inputClass} value={form.pesoKg} onChange={(e) => update("pesoKg", e.target.value)} />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-[var(--landing-muted)]">Peso objetivo (kg)</span>
                    <input type="number" className={inputClass} value={form.pesoObjetivoKg} onChange={(e) => update("pesoObjetivoKg", e.target.value)} />
                  </label>
                </div>
              </section>

              <section className={sectionClass}>
                <div className="flex items-start gap-3 border-b border-[var(--landing-border)]/70 pb-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_oklab,var(--landing-accent)_16%,transparent)] text-sm font-bold text-[var(--landing-accent)] ring-1 ring-[var(--landing-accent)]/35">
                    2
                  </span>
                  <h2 className="pt-0.5 text-lg font-bold tracking-tight text-[var(--foreground)] md:text-xl">Objetivo y tiempos</h2>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <label className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-[var(--landing-muted)]">Objetivo principal *</span>
                    <select className={inputClass} value={form.objetivoPrincipal} onChange={(e) => update("objetivoPrincipal", e.target.value as ObjetivoPrincipal)}>
                      <option value="perder_grasa">Perder grasa</option>
                      <option value="ganar_musculo">Ganar músculo</option>
                      <option value="recomposicion">Perder grasa y ganar músculo</option>
                      <option value="rendimiento">Rendir mejor en deporte</option>
                      <option value="salud_general">Sentirme mejor y estar saludable</option>
                      <option value="post_parto">Recuperación posparto</option>
                      <option value="otro">Otro</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-[var(--landing-muted)]">Fecha objetivo (si la tienes)</span>
                    <input type="date" className={inputClass} value={form.fechaObjetivo} onChange={(e) => update("fechaObjetivo", e.target.value)} />
                  </label>
                </div>
                <label className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-[var(--landing-muted)]">Objetivo secundario o detalle</span>
                  <textarea rows={3} className={textareaClass} placeholder="Ej.: quiero bajar cintura sin perder fuerza, mejorar postura, tener más energía..." value={form.objetivoSecundario} onChange={(e) => update("objetivoSecundario", e.target.value)} />
                </label>
              </section>

              <section className={sectionClass}>
                <div className="flex items-start gap-3 border-b border-[var(--landing-border)]/70 pb-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_oklab,var(--landing-accent)_16%,transparent)] text-sm font-bold text-[var(--landing-accent)] ring-1 ring-[var(--landing-accent)]/35">
                    3
                  </span>
                  <h2 className="pt-0.5 text-lg font-bold tracking-tight text-[var(--foreground)] md:text-xl">Entrenamiento actual y disponibilidad</h2>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <label className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-[var(--landing-muted)]">¿Cuántos días entrenas ahora por semana? *</span>
                    <input type="number" min={0} max={7} className={inputClass} placeholder="Ej.: 3" value={form.diasEntrenaActualmente} onChange={(e) => update("diasEntrenaActualmente", e.target.value)} />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-[var(--landing-muted)]">¿Cuántos días te comprometes a entrenar? *</span>
                    <input type="number" min={1} max={7} className={inputClass} placeholder="Ej.: 4" value={form.diasCompromisoEntrenamiento} onChange={(e) => update("diasCompromisoEntrenamiento", e.target.value)} />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-[var(--landing-muted)]">¿Sobre qué hora entrenarías?</span>
                    <input className={inputClass} placeholder="Ej.: 7:00, 14:30, 20:00" value={form.horaEntrenamiento} onChange={(e) => update("horaEntrenamiento", e.target.value)} />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-[var(--landing-muted)]">¿Cuánto dura una sesión?</span>
                    <input className={inputClass} placeholder="Ej.: 60 minutos" value={form.duracionSesion} onChange={(e) => update("duracionSesion", e.target.value)} />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-[var(--landing-muted)]">¿El plan lo quieres para casa, gimnasio o ambos?</span>
                    <select className={inputClass} value={form.planLugar} onChange={(e) => update("planLugar", e.target.value)}>
                      {INTAKE_PLAN_LUGAR.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-[var(--landing-muted)]">Si entrenas en casa, ¿qué material tienes?</span>
                    <input className={inputClass} placeholder="Ej.: mancuernas, bandas, banco..." value={form.materialCasa} onChange={(e) => update("materialCasa", e.target.value)} />
                  </label>
                </div>

                <div>
                  <p className="mb-2 text-sm font-medium text-[var(--landing-muted)]">Días concretos en los que te comprometes a entrenar (si puedes)</p>
                  <div className="flex flex-wrap gap-2">
                    {INTAKE_DIAS_SEMANA.map((dia) => (
                      <button
                        key={dia}
                        type="button"
                        onClick={() => update("diasDisponibles", toggleValue(form.diasDisponibles, dia))}
                        className={form.diasDisponibles.includes(dia) ? chipOn : chipOff}
                      >
                        {dia}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-sm font-medium text-[var(--landing-muted)]">Equipamiento disponible (si aplica)</p>
                  <div className="flex flex-wrap gap-2">
                    {INTAKE_EQUIPAMIENTO.map((equipo) => (
                      <button
                        key={equipo}
                        type="button"
                        onClick={() => update("equipamientoDisponible", toggleValue(form.equipamientoDisponible, equipo))}
                        className={form.equipamientoDisponible.includes(equipo) ? chipOn : chipOff}
                      >
                        {equipo}
                      </button>
                    ))}
                  </div>
                </div>

                <details className={detailsClass}>
                  <summary className="cursor-pointer text-sm font-semibold text-[var(--landing-accent)] hover:underline">
                    Ver más preguntas opcionales de entrenamiento
                  </summary>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 mt-4">
                    <label className="flex flex-col gap-1">
                      <span className="text-sm font-medium text-[var(--landing-muted)]">Experiencia entrenando</span>
                      <select className={inputClass} value={form.experienciaEntrenamiento} onChange={(e) => update("experienciaEntrenamiento", e.target.value)}>
                        <option value="ninguna">Nunca he entrenado</option>
                        <option value="principiante">Principiante (menos de 6 meses)</option>
                        <option value="intermedio">Intermedio (6 meses a 2 años)</option>
                        <option value="avanzado">Avanzado (más de 2 años)</option>
                      </select>
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-sm font-medium text-[var(--landing-muted)]">Minutos por sesión que puedes dedicar</span>
                      <input className={inputClass} placeholder="Ej.: 45, 60 o 75" value={form.minutosPorSesion} onChange={(e) => update("minutosPorSesion", e.target.value)} />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-sm font-medium text-[var(--landing-muted)]">Horas sentado al día (aprox.)</span>
                      <input className={inputClass} placeholder="Ej.: 8" value={form.horasSentado} onChange={(e) => update("horasSentado", e.target.value)} />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-sm font-medium text-[var(--landing-muted)]">Pasos diarios (si lo sabes)</span>
                      <input className={inputClass} placeholder="Ej.: 6.000" value={form.pasosDiarios} onChange={(e) => update("pasosDiarios", e.target.value)} />
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
                    <h2 className="text-lg font-bold tracking-tight text-[var(--foreground)] md:text-xl">Salud y antecedentes</h2>
                    <p className="mt-1 text-sm text-[var(--landing-muted)]">Esta parte es clave para adaptar el plan de forma segura.</p>
                  </div>
                </div>
                <details className={detailsClass} open>
                  <summary className="cursor-pointer text-sm font-semibold text-[var(--landing-accent)] hover:underline">
                    Completar preguntas de salud
                  </summary>
                  <div className="space-y-4 mt-4">
                    <label className="flex flex-col gap-1">
                      <span className="text-sm font-medium text-[var(--landing-muted)]">¿Has tenido alguna enfermedad desde pequeño/a? ¿Cuál?</span>
                      <textarea rows={2} className={textareaClass} value={form.enfermedadInfancia} onChange={(e) => update("enfermedadInfancia", e.target.value)} />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-sm font-medium text-[var(--landing-muted)]">Dolores o lesiones actuales</span>
                      <textarea rows={2} className={textareaClass} placeholder="Ej.: dolor de rodilla, hombro o zona lumbar..." value={form.lesionesDolores} onChange={(e) => update("lesionesDolores", e.target.value)} />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-sm font-medium text-[var(--landing-muted)]">Cirugías previas relevantes</span>
                      <textarea rows={2} className={textareaClass} value={form.cirugiasPrevias} onChange={(e) => update("cirugiasPrevias", e.target.value)} />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-sm font-medium text-[var(--landing-muted)]">Medicación y suplementos actuales</span>
                      <textarea rows={2} className={textareaClass} value={form.medicacionSuplementos} onChange={(e) => update("medicacionSuplementos", e.target.value)} />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-sm font-medium text-[var(--landing-muted)]">Patologías o diagnósticos médicos</span>
                      <textarea rows={2} className={textareaClass} placeholder="Ej.: hipertensión, diabetes, hipotiroidismo..." value={form.patologias} onChange={(e) => update("patologias", e.target.value)} />
                    </label>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <label className="flex flex-col gap-1">
                        <span className="text-sm font-medium text-[var(--landing-muted)]">¿Tienes diabetes?</span>
                        <select className={inputClass} value={form.diabetesTipo} onChange={(e) => update("diabetesTipo", e.target.value)}>
                          <option value="no">No</option>
                          <option value="tipo_i">Diabetes tipo I</option>
                          <option value="tipo_ii">Diabetes tipo II</option>
                        </select>
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-sm font-medium text-[var(--landing-muted)]">¿Tienes hipertensión arterial?</span>
                        <select className={inputClass} value={form.hipertensionArterial} onChange={(e) => update("hipertensionArterial", e.target.value)}>
                          <option value="no">No</option>
                          <option value="si">Sí</option>
                        </select>
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-sm font-medium text-[var(--landing-muted)]">¿Tienes alguna enfermedad del corazón? ¿Cuál?</span>
                        <input className={inputClass} value={form.enfermedadCorazon} onChange={(e) => update("enfermedadCorazon", e.target.value)} />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-sm font-medium text-[var(--landing-muted)]">¿Tienes hipotiroidismo?</span>
                        <select className={inputClass} value={form.hipotiroidismo} onChange={(e) => update("hipotiroidismo", e.target.value)}>
                          <option value="no">No</option>
                          <option value="si">Sí</option>
                        </select>
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-sm font-medium text-[var(--landing-muted)]">¿Colesterol alto y/o triglicéridos?</span>
                        <select className={inputClass} value={form.colesterolTrigliceridos} onChange={(e) => update("colesterolTrigliceridos", e.target.value)}>
                          <option value="no">No</option>
                          <option value="colesterol_alto">Colesterol alto</option>
                          <option value="trigliceridos_altos">Triglicéridos altos</option>
                          <option value="ambos">Ambos</option>
                        </select>
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-sm font-medium text-[var(--landing-muted)]">¿Tienes estreñimiento, colon irritable o dolores digestivos?</span>
                        <select className={inputClass} value={form.molestiasDigestivasTipo} onChange={(e) => update("molestiasDigestivasTipo", e.target.value)}>
                          <option value="no">No</option>
                          <option value="estrenimiento">Estreñimiento</option>
                          <option value="colon_irritable">Colon irritable</option>
                          <option value="dolores_digestivos">Dolores digestivos</option>
                          <option value="varios">Varios de estos</option>
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
                  <h2 className="pt-0.5 text-lg font-bold tracking-tight text-[var(--foreground)] md:text-xl">Hábitos de vida</h2>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <label className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-[var(--landing-muted)]">¿Descansas bien?</span>
                    <select className={inputClass} value={form.descansaBien} onChange={(e) => update("descansaBien", e.target.value)}>
                      <option value="si">Sí</option>
                      <option value="regular">Regular</option>
                      <option value="no">No</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-[var(--landing-muted)]">Nivel de estrés</span>
                    <select className={inputClass} value={form.nivelEstres} onChange={(e) => update("nivelEstres", e.target.value)}>
                      <option value="bajo">Bajo</option>
                      <option value="medio">Medio</option>
                      <option value="alto">Alto</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-[var(--landing-muted)]">Calidad del sueño</span>
                    <select className={inputClass} value={form.calidadSueno} onChange={(e) => update("calidadSueno", e.target.value)}>
                      <option value="mala">Mala</option>
                      <option value="regular">Regular</option>
                      <option value="buena">Buena</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-[var(--landing-muted)]">Horas de sueño por noche</span>
                    <input className={inputClass} placeholder="Ej.: 6,5" value={form.horasSueno} onChange={(e) => update("horasSueno", e.target.value)} />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-[var(--landing-muted)]">¿Cuántas horas por día trabajas? *</span>
                    <input className={inputClass} placeholder="Ej.: 8 horas, 10 horas, media jornada..." value={form.trabajoTurnos} onChange={(e) => update("trabajoTurnos", e.target.value)} />
                  </label>
                </div>

                <div>
                  <p className="mb-2 text-sm font-medium text-[var(--landing-muted)]">¿Qué días de la semana trabaja?</p>
                  <div className="flex flex-wrap gap-2">
                    {INTAKE_DIAS_SEMANA.map((dia) => (
                      <button
                        key={`trabaja-${dia}`}
                        type="button"
                        onClick={() => update("diasTrabajo", toggleValue(form.diasTrabajo, dia))}
                        className={form.diasTrabajo.includes(dia) ? chipOn : chipOff}
                      >
                        {dia}
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
                    <h2 className="text-lg font-bold tracking-tight text-[var(--foreground)] md:text-xl">Alimentación actual</h2>
                    <p className="mt-1 text-sm text-[var(--landing-muted)]">
                      No busques responder “perfecto”: contanos cómo comés hoy normalmente.
                    </p>
                  </div>
                </div>
                <label className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-[var(--landing-muted)]">¿Cuántas comidas haces al día y en qué horarios? *</span>
                  <textarea rows={2} className={textareaClass} placeholder="Ej.: 4 comidas - 8:00, 12:30, 17:00, 21:00" value={form.comidasPorDiaHorarios} onChange={(e) => update("comidasPorDiaHorarios", e.target.value)} />
                </label>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <label className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-[var(--landing-muted)]">¿Cómo describirías tu apetito?</span>
                    <select className={inputClass} value={form.apetito} onChange={(e) => update("apetito", e.target.value)}>
                      <option value="bueno">Bueno</option>
                      <option value="regular">Regular</option>
                      <option value="malo">Malo</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-[var(--landing-muted)]">¿En qué momento del día tienes más hambre?</span>
                    <input className={inputClass} value={form.momentoMasHambre} onChange={(e) => update("momentoMasHambre", e.target.value)} />
                  </label>
                </div>
                <label className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-[var(--landing-muted)]">Snacks y bebidas frecuentes</span>
                  <textarea rows={2} className={textareaClass} value={form.snacksBebidas} onChange={(e) => update("snacksBebidas", e.target.value)} />
                </label>

                <div className="space-y-4 rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface)]/50 p-4 md:p-5">
                  <p className="text-sm font-semibold text-[var(--foreground)]">Tus preferencias de alimentos</p>
                  <p className="text-xs leading-relaxed text-[var(--landing-muted)]">
                    Pulsa una vez = me gusta, pulsa otra vez = no me gusta, y una tercera = sin marcar.
                    Los no marcados se tomarán como neutros.
                  </p>
                  {INTAKE_FOOD_GROUPS.map((group) => (
                    <div key={group.group} className="space-y-2">
                      <p className="text-sm font-medium text-[var(--foreground)]/95">
                        {group.emoji} {group.group}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {group.foods.map((food) => {
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
                              {food}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <label className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-[var(--landing-muted)]">Alergias/restricciones alimentarias</span>
                    <textarea rows={2} className={textareaClass} value={form.restriccionesAlergias} onChange={(e) => update("restriccionesAlergias", e.target.value)} />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-[var(--landing-muted)]">Agua al día (aprox.)</span>
                    <input className={inputClass} placeholder="Ej.: 2 litros" value={form.aguaPorDia} onChange={(e) => update("aguaPorDia", e.target.value)} />
                  </label>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <label className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-[var(--landing-muted)]">Alcohol</span>
                    <select className={inputClass} value={form.alcoholFrecuencia} onChange={(e) => update("alcoholFrecuencia", e.target.value)}>
                      <option value="nunca">Nunca</option>
                      <option value="ocasional">Ocasional</option>
                      <option value="semanal">Semanal</option>
                      <option value="frecuente">Frecuente</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-[var(--landing-muted)]">Fuma</span>
                    <select className={inputClass} value={form.fuma} onChange={(e) => update("fuma", e.target.value)}>
                      <option value="no">No</option>
                      <option value="si">Sí</option>
                      <option value="ocasional">Ocasional</option>
                    </select>
                  </label>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <label className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-[var(--landing-muted)]">Digestión/molestias (hinchazón, acidez, etc.)</span>
                    <textarea rows={2} className={textareaClass} value={form.digestion} onChange={(e) => update("digestion", e.target.value)} />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-[var(--landing-muted)]">Presupuesto para comida (aprox.)</span>
                    <input className={inputClass} placeholder="Ej.: bajo / medio / alto" value={form.presupuestoComida} onChange={(e) => update("presupuestoComida", e.target.value)} />
                  </label>
                </div>

                <label className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-[var(--landing-muted)]">Tiempo real para cocinar al día</span>
                  <input className={inputClass} placeholder="Ej.: 20 minutos, 1 hora, solo preparación el domingo..." value={form.tiempoParaCocinar} onChange={(e) => update("tiempoParaCocinar", e.target.value)} />
                </label>

                <label className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-[var(--landing-muted)]">Cuéntame un día tipo: ¿qué comes desde que te levantas hasta que te acuestas? *</span>
                  <textarea rows={3} className={textareaClass} value={form.diaTipoComidas} onChange={(e) => update("diaTipoComidas", e.target.value)} />
                </label>

                <label className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-[var(--landing-muted)]">¿Tomas suplementos? ¿Cuáles y de qué marca? (si quieres, luego puedes enviar foto por WhatsApp)</span>
                  <textarea rows={2} className={textareaClass} value={form.suplementosActualesDetalle} onChange={(e) => update("suplementosActualesDetalle", e.target.value)} />
                </label>

                <label className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-[var(--landing-muted)]">Si no tomas suplementos, ¿te gustaría empezar con alguno?</span>
                  <input className={inputClass} value={form.quiereSuplementos} onChange={(e) => update("quiereSuplementos", e.target.value)} />
                </label>

                <label className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-[var(--landing-muted)]">¿Has hecho alguna dieta antes?</span>
                  <select className={inputClass} value={form.haHechoDietaAntes} onChange={(e) => update("haHechoDietaAntes", e.target.value)}>
                    <option value="no">No</option>
                    <option value="si">Sí</option>
                  </select>
                </label>

                {form.haHechoDietaAntes === "si" && (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <label className="flex flex-col gap-1">
                      <span className="text-sm font-medium text-[var(--landing-muted)]">¿En qué se basaba?</span>
                      <textarea rows={2} className={textareaClass} value={form.dietaEnQueConsistia} onChange={(e) => update("dietaEnQueConsistia", e.target.value)} />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-sm font-medium text-[var(--landing-muted)]">¿Hace cuánto la hiciste?</span>
                      <input className={inputClass} value={form.dietaHaceCuanto} onChange={(e) => update("dietaHaceCuanto", e.target.value)} />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-sm font-medium text-[var(--landing-muted)]">¿Durante cuánto tiempo?</span>
                      <input className={inputClass} value={form.dietaCuantoTiempo} onChange={(e) => update("dietaCuantoTiempo", e.target.value)} />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-sm font-medium text-[var(--landing-muted)]">¿Qué tal te fue?</span>
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
                  <h2 className="pt-0.5 text-lg font-bold tracking-tight text-[var(--foreground)] md:text-xl">Motivación y seguimiento</h2>
                </div>
                <label className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-[var(--landing-muted)]">A nivel de rendimiento físico, ¿qué te gustaría mejorar? *</span>
                  <textarea rows={3} className={textareaClass} value={form.objetivoRendimiento} onChange={(e) => update("objetivoRendimiento", e.target.value)} />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-[var(--landing-muted)]">A nivel estético, ¿qué te gustaría cambiar? *</span>
                  <textarea rows={3} className={textareaClass} value={form.objetivoEstetico} onChange={(e) => update("objetivoEstetico", e.target.value)} />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-[var(--landing-muted)]">¿Por qué quieres empezar ahora?</span>
                  <textarea rows={3} className={textareaClass} value={form.motivacionPrincipal} onChange={(e) => update("motivacionPrincipal", e.target.value)} />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-[var(--landing-muted)]">¿Qué te está costando hoy para lograrlo?</span>
                  <textarea rows={3} className={textareaClass} value={form.dificultadActual} onChange={(e) => update("dificultadActual", e.target.value)} />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-[var(--landing-muted)]">Comentarios extra</span>
                  <textarea rows={3} className={textareaClass} value={form.comentariosExtra} onChange={(e) => update("comentariosExtra", e.target.value)} />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-[var(--landing-muted)]">¿Algo más que quieras contarme? (opcional)</span>
                  <textarea rows={3} className={textareaClass} value={form.textoLibreFinal} onChange={(e) => update("textoLibreFinal", e.target.value)} />
                </label>
              </section>

              <section className={sectionClass}>
                <div className="flex items-start gap-3 border-b border-[var(--landing-border)]/70 pb-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_oklab,var(--landing-accent)_16%,transparent)] text-sm font-bold text-[var(--landing-accent)] ring-1 ring-[var(--landing-accent)]/35">
                    8
                  </span>
                  <h2 className="pt-0.5 text-lg font-bold tracking-tight text-[var(--foreground)] md:text-xl">Confirmación y envío</h2>
                </div>
                <label className="flex items-start gap-3 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1 h-[18px] w-[18px] shrink-0 rounded border border-[var(--landing-border)] bg-[var(--landing-surface)] accent-[var(--landing-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--landing-accent)]/35"
                    checked={form.consentimiento}
                    onChange={(e) => update("consentimiento", e.target.checked)}
                  />
                  <span className="text-[var(--landing-muted)] leading-relaxed">
                    Confirmo que los datos son reales y autorizo su uso para que Lucas cree mi plan personalizado de entrenamiento y nutrición.
                  </span>
                </label>

                {error && (
                  <div className="rounded-xl border border-red-400/35 bg-red-500/10 px-3 py-2.5 text-sm text-red-200">{error}</div>
                )}
                {success && (
                  <div className="rounded-xl border border-emerald-400/35 bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-100">
                    ¡Perfecto, ya enviaste el formulario! Te hablaré por WhatsApp para iniciar el proceso.
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !form.consentimiento}
                  className="w-full min-h-[48px] rounded-xl bg-[var(--landing-accent)] px-6 py-3 text-sm font-semibold text-[#0a1628] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] sm:w-auto sm:min-w-[12rem]"
                >
                  {loading ? "Enviando..." : "Enviar formulario"}
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
              <h3 className="mt-2 text-balance bg-gradient-to-r from-[var(--foreground)] to-[var(--landing-accent)] bg-clip-text text-xl font-bold text-transparent">
                ¡Buenísimo, este es tu punto de inicio!
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-[var(--landing-muted)]">
                Voy a leer tu formulario personalmente y, a partir de ahí, empezamos con tu cambio. Lo más importante es que ya diste el primer paso.
              </p>
              <p className="mt-3 text-sm leading-relaxed text-[var(--landing-muted)]">
                Si aplicas lo que te vaya proponiendo con constancia, vas a notar cambios rápido y, sobre todo, te vas a sentir mucho mejor física y mentalmente.
              </p>
              <p className="mt-4 text-sm font-semibold text-[var(--landing-accent)]">Vamos a por ello. Estoy contigo en este proceso.</p>

              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  onClick={() => setMotivationalModalOpen(false)}
                  className="min-h-[44px] rounded-xl bg-[var(--landing-accent)] px-5 py-2.5 text-sm font-semibold text-[#0a1628] transition hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
                >
                  Cerrar
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
