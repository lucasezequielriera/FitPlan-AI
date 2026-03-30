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

  const sectionClass = "rounded-2xl border border-white/10 bg-white/[0.03] p-5 md:p-6 shadow-[0_8px_30px_rgba(0,0,0,0.15)] space-y-4";
  const detailsClass = "rounded-xl border border-white/10 bg-white/[0.02] p-3";

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

      <div className="px-4 py-8 md:px-8">
        <div className="mx-auto max-w-4xl">
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-6 md:p-8">
            <div className="rounded-2xl border border-cyan-400/20 bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-indigo-500/10 p-4 md:p-5">
              <h1 className="text-2xl md:text-3xl font-semibold">Formulario de inicio personalizado</h1>
              <p className="mt-2 text-sm opacity-90">
                Este formulario es para crear tu plan 1:1 de entrenamiento y nutrición. No hace falta saber nada técnico:
                responde con calma y con sinceridad.
              </p>
              <p className="mt-2 text-xs opacity-75">
                Tiempo estimado: 8-12 minutos. Cuanto más detalle des, mejor se podrá adaptar tu plan.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="intake-form mt-8 space-y-8">
              <section className={sectionClass}>
                <h2 className="text-lg font-semibold">1) Cuéntame sobre ti</h2>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <label className="flex flex-col gap-1">
                    <span className="text-sm opacity-80">Nombre completo *</span>
                    <input className="rounded-xl bg-white/5 px-3 py-2 outline-none" value={form.nombreCompleto} onChange={(e) => update("nombreCompleto", e.target.value)} />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-sm opacity-80">Email *</span>
                    <input type="email" className="rounded-xl bg-white/5 px-3 py-2 outline-none" value={form.email} onChange={(e) => update("email", e.target.value)} />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-sm opacity-80">WhatsApp *</span>
                    <input className="rounded-xl bg-white/5 px-3 py-2 outline-none" placeholder="Ej.: +34 6XX XXX XXX" value={form.whatsapp} onChange={(e) => update("whatsapp", e.target.value)} />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-sm opacity-80">Instagram (opcional)</span>
                    <input
                      className="rounded-xl bg-white/5 px-3 py-2 outline-none"
                      placeholder="Ej.: @tuusuario"
                      value={form.instagram}
                      onChange={(e) => update("instagram", e.target.value)}
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-sm opacity-80">Ciudad y país</span>
                    <input className="rounded-xl bg-white/5 px-3 py-2 outline-none" value={form.ciudadPais} onChange={(e) => update("ciudadPais", e.target.value)} />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-sm opacity-80">¿Qué servicio te interesa?</span>
                    <select className="rounded-xl bg-white/5 px-3 py-2 outline-none" value={form.servicioInteres} onChange={(e) => update("servicioInteres", e.target.value)}>
                      <option value="">Seleccionar...</option>
                      {INTAKE_SERVICIOS.map((service) => (
                        <option key={service} value={service}>
                          {service}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-sm opacity-80">Edad *</span>
                    <input type="number" className="rounded-xl bg-white/5 px-3 py-2 outline-none" value={form.edad} onChange={(e) => update("edad", e.target.value)} />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-sm opacity-80">Sexo</span>
                    <select className="rounded-xl bg-white/5 px-3 py-2 outline-none" value={form.sexo} onChange={(e) => update("sexo", e.target.value)}>
                      <option value="masculino">Masculino</option>
                      <option value="femenino">Femenino</option>
                      <option value="prefiero_no_decir">Prefiero no decir</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-sm opacity-80">Altura (cm) *</span>
                    <input type="number" className="rounded-xl bg-white/5 px-3 py-2 outline-none" value={form.alturaCm} onChange={(e) => update("alturaCm", e.target.value)} />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-sm opacity-80">Peso actual (kg) *</span>
                    <input type="number" className="rounded-xl bg-white/5 px-3 py-2 outline-none" value={form.pesoKg} onChange={(e) => update("pesoKg", e.target.value)} />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-sm opacity-80">Peso objetivo (kg)</span>
                    <input type="number" className="rounded-xl bg-white/5 px-3 py-2 outline-none" value={form.pesoObjetivoKg} onChange={(e) => update("pesoObjetivoKg", e.target.value)} />
                  </label>
                </div>
              </section>

              <section className={sectionClass}>
                <h2 className="text-lg font-semibold">2) Objetivo y tiempos</h2>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <label className="flex flex-col gap-1">
                    <span className="text-sm opacity-80">Objetivo principal *</span>
                    <select className="rounded-xl bg-white/5 px-3 py-2 outline-none" value={form.objetivoPrincipal} onChange={(e) => update("objetivoPrincipal", e.target.value as ObjetivoPrincipal)}>
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
                    <span className="text-sm opacity-80">Fecha objetivo (si la tienes)</span>
                    <input type="date" className="rounded-xl bg-white/5 px-3 py-2 outline-none" value={form.fechaObjetivo} onChange={(e) => update("fechaObjetivo", e.target.value)} />
                  </label>
                </div>
                <label className="flex flex-col gap-1">
                  <span className="text-sm opacity-80">Objetivo secundario o detalle</span>
                  <textarea rows={3} className="rounded-xl bg-white/5 px-3 py-2 outline-none" placeholder="Ej.: quiero bajar cintura sin perder fuerza, mejorar postura, tener más energía..." value={form.objetivoSecundario} onChange={(e) => update("objetivoSecundario", e.target.value)} />
                </label>
              </section>

              <section className={sectionClass}>
                <h2 className="text-lg font-semibold">3) Entrenamiento actual y disponibilidad</h2>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <label className="flex flex-col gap-1">
                    <span className="text-sm opacity-80">¿Cuántos días entrenas ahora por semana? *</span>
                    <input type="number" min={0} max={7} className="rounded-xl bg-white/5 px-3 py-2 outline-none" placeholder="Ej.: 3" value={form.diasEntrenaActualmente} onChange={(e) => update("diasEntrenaActualmente", e.target.value)} />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-sm opacity-80">¿Cuántos días te comprometes a entrenar? *</span>
                    <input type="number" min={1} max={7} className="rounded-xl bg-white/5 px-3 py-2 outline-none" placeholder="Ej.: 4" value={form.diasCompromisoEntrenamiento} onChange={(e) => update("diasCompromisoEntrenamiento", e.target.value)} />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-sm opacity-80">¿Sobre qué hora entrenarías?</span>
                    <input className="rounded-xl bg-white/5 px-3 py-2 outline-none" placeholder="Ej.: 7:00, 14:30, 20:00" value={form.horaEntrenamiento} onChange={(e) => update("horaEntrenamiento", e.target.value)} />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-sm opacity-80">¿Cuánto dura una sesión?</span>
                    <input className="rounded-xl bg-white/5 px-3 py-2 outline-none" placeholder="Ej.: 60 minutos" value={form.duracionSesion} onChange={(e) => update("duracionSesion", e.target.value)} />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-sm opacity-80">¿El plan lo quieres para casa, gimnasio o ambos?</span>
                    <select className="rounded-xl bg-white/5 px-3 py-2 outline-none" value={form.planLugar} onChange={(e) => update("planLugar", e.target.value)}>
                      {INTAKE_PLAN_LUGAR.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-sm opacity-80">Si entrenas en casa, ¿qué material tienes?</span>
                    <input className="rounded-xl bg-white/5 px-3 py-2 outline-none" placeholder="Ej.: mancuernas, bandas, banco..." value={form.materialCasa} onChange={(e) => update("materialCasa", e.target.value)} />
                  </label>
                </div>

                <div>
                  <p className="text-sm opacity-80 mb-2">Días concretos en los que te comprometes a entrenar (si puedes)</p>
                  <div className="flex flex-wrap gap-2">
                    {INTAKE_DIAS_SEMANA.map((dia) => (
                      <button
                        key={dia}
                        type="button"
                        onClick={() => update("diasDisponibles", toggleValue(form.diasDisponibles, dia))}
                        className={`rounded-full px-3 py-1.5 text-sm border ${form.diasDisponibles.includes(dia) ? "bg-cyan-500/20 border-cyan-400/50 text-cyan-300" : "bg-white/5 border-white/10 text-white/80"}`}
                      >
                        {dia}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-sm opacity-80 mb-2">Equipamiento disponible (si aplica)</p>
                  <div className="flex flex-wrap gap-2">
                    {INTAKE_EQUIPAMIENTO.map((equipo) => (
                      <button
                        key={equipo}
                        type="button"
                        onClick={() => update("equipamientoDisponible", toggleValue(form.equipamientoDisponible, equipo))}
                        className={`rounded-full px-3 py-1.5 text-sm border ${form.equipamientoDisponible.includes(equipo) ? "bg-emerald-500/20 border-emerald-400/50 text-emerald-300" : "bg-white/5 border-white/10 text-white/80"}`}
                      >
                        {equipo}
                      </button>
                    ))}
                  </div>
                </div>

                <details className={detailsClass}>
                  <summary className="cursor-pointer text-sm font-medium text-cyan-200">
                    Ver más preguntas opcionales de entrenamiento
                  </summary>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 mt-4">
                    <label className="flex flex-col gap-1">
                      <span className="text-sm opacity-80">Experiencia entrenando</span>
                      <select className="rounded-xl bg-white/5 px-3 py-2 outline-none" value={form.experienciaEntrenamiento} onChange={(e) => update("experienciaEntrenamiento", e.target.value)}>
                        <option value="ninguna">Nunca he entrenado</option>
                        <option value="principiante">Principiante (menos de 6 meses)</option>
                        <option value="intermedio">Intermedio (6 meses a 2 años)</option>
                        <option value="avanzado">Avanzado (más de 2 años)</option>
                      </select>
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-sm opacity-80">Minutos por sesión que puedes dedicar</span>
                      <input className="rounded-xl bg-white/5 px-3 py-2 outline-none" placeholder="Ej.: 45, 60 o 75" value={form.minutosPorSesion} onChange={(e) => update("minutosPorSesion", e.target.value)} />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-sm opacity-80">Horas sentado al día (aprox.)</span>
                      <input className="rounded-xl bg-white/5 px-3 py-2 outline-none" placeholder="Ej.: 8" value={form.horasSentado} onChange={(e) => update("horasSentado", e.target.value)} />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-sm opacity-80">Pasos diarios (si lo sabes)</span>
                      <input className="rounded-xl bg-white/5 px-3 py-2 outline-none" placeholder="Ej.: 6.000" value={form.pasosDiarios} onChange={(e) => update("pasosDiarios", e.target.value)} />
                    </label>
                  </div>
                </details>
              </section>

              <section className={sectionClass}>
                <h2 className="text-lg font-semibold">4) Salud y antecedentes</h2>
                <p className="text-sm opacity-70">Esta parte es clave para adaptar el plan de forma segura.</p>
                <details className={detailsClass} open>
                  <summary className="cursor-pointer text-sm font-medium text-cyan-200">
                    Completar preguntas de salud
                  </summary>
                  <div className="space-y-4 mt-4">
                    <label className="flex flex-col gap-1">
                      <span className="text-sm opacity-80">¿Has tenido alguna enfermedad desde pequeño/a? ¿Cuál?</span>
                      <textarea rows={2} className="rounded-xl bg-white/5 px-3 py-2 outline-none" value={form.enfermedadInfancia} onChange={(e) => update("enfermedadInfancia", e.target.value)} />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-sm opacity-80">Dolores o lesiones actuales</span>
                      <textarea rows={2} className="rounded-xl bg-white/5 px-3 py-2 outline-none" placeholder="Ej.: dolor de rodilla, hombro o zona lumbar..." value={form.lesionesDolores} onChange={(e) => update("lesionesDolores", e.target.value)} />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-sm opacity-80">Cirugías previas relevantes</span>
                      <textarea rows={2} className="rounded-xl bg-white/5 px-3 py-2 outline-none" value={form.cirugiasPrevias} onChange={(e) => update("cirugiasPrevias", e.target.value)} />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-sm opacity-80">Medicación y suplementos actuales</span>
                      <textarea rows={2} className="rounded-xl bg-white/5 px-3 py-2 outline-none" value={form.medicacionSuplementos} onChange={(e) => update("medicacionSuplementos", e.target.value)} />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-sm opacity-80">Patologías o diagnósticos médicos</span>
                      <textarea rows={2} className="rounded-xl bg-white/5 px-3 py-2 outline-none" placeholder="Ej.: hipertensión, diabetes, hipotiroidismo..." value={form.patologias} onChange={(e) => update("patologias", e.target.value)} />
                    </label>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <label className="flex flex-col gap-1">
                        <span className="text-sm opacity-80">¿Tienes diabetes?</span>
                        <select className="rounded-xl bg-white/5 px-3 py-2 outline-none" value={form.diabetesTipo} onChange={(e) => update("diabetesTipo", e.target.value)}>
                          <option value="no">No</option>
                          <option value="tipo_i">Diabetes tipo I</option>
                          <option value="tipo_ii">Diabetes tipo II</option>
                        </select>
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-sm opacity-80">¿Tienes hipertensión arterial?</span>
                        <select className="rounded-xl bg-white/5 px-3 py-2 outline-none" value={form.hipertensionArterial} onChange={(e) => update("hipertensionArterial", e.target.value)}>
                          <option value="no">No</option>
                          <option value="si">Sí</option>
                        </select>
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-sm opacity-80">¿Tienes alguna enfermedad del corazón? ¿Cuál?</span>
                        <input className="rounded-xl bg-white/5 px-3 py-2 outline-none" value={form.enfermedadCorazon} onChange={(e) => update("enfermedadCorazon", e.target.value)} />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-sm opacity-80">¿Tienes hipotiroidismo?</span>
                        <select className="rounded-xl bg-white/5 px-3 py-2 outline-none" value={form.hipotiroidismo} onChange={(e) => update("hipotiroidismo", e.target.value)}>
                          <option value="no">No</option>
                          <option value="si">Sí</option>
                        </select>
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-sm opacity-80">¿Colesterol alto y/o triglicéridos?</span>
                        <select className="rounded-xl bg-white/5 px-3 py-2 outline-none" value={form.colesterolTrigliceridos} onChange={(e) => update("colesterolTrigliceridos", e.target.value)}>
                          <option value="no">No</option>
                          <option value="colesterol_alto">Colesterol alto</option>
                          <option value="trigliceridos_altos">Triglicéridos altos</option>
                          <option value="ambos">Ambos</option>
                        </select>
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-sm opacity-80">¿Tienes estreñimiento, colon irritable o dolores digestivos?</span>
                        <select className="rounded-xl bg-white/5 px-3 py-2 outline-none" value={form.molestiasDigestivasTipo} onChange={(e) => update("molestiasDigestivasTipo", e.target.value)}>
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
                <h2 className="text-lg font-semibold">5) Hábitos de vida</h2>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <label className="flex flex-col gap-1">
                    <span className="text-sm opacity-80">¿Descansas bien?</span>
                    <select className="rounded-xl bg-white/5 px-3 py-2 outline-none" value={form.descansaBien} onChange={(e) => update("descansaBien", e.target.value)}>
                      <option value="si">Sí</option>
                      <option value="regular">Regular</option>
                      <option value="no">No</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-sm opacity-80">Nivel de estrés</span>
                    <select className="rounded-xl bg-white/5 px-3 py-2 outline-none" value={form.nivelEstres} onChange={(e) => update("nivelEstres", e.target.value)}>
                      <option value="bajo">Bajo</option>
                      <option value="medio">Medio</option>
                      <option value="alto">Alto</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-sm opacity-80">Calidad del sueño</span>
                    <select className="rounded-xl bg-white/5 px-3 py-2 outline-none" value={form.calidadSueno} onChange={(e) => update("calidadSueno", e.target.value)}>
                      <option value="mala">Mala</option>
                      <option value="regular">Regular</option>
                      <option value="buena">Buena</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-sm opacity-80">Horas de sueño por noche</span>
                    <input className="rounded-xl bg-white/5 px-3 py-2 outline-none" placeholder="Ej.: 6,5" value={form.horasSueno} onChange={(e) => update("horasSueno", e.target.value)} />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-sm opacity-80">¿Cuántas horas por día trabajas? *</span>
                    <input className="rounded-xl bg-white/5 px-3 py-2 outline-none" placeholder="Ej.: 8 horas, 10 horas, media jornada..." value={form.trabajoTurnos} onChange={(e) => update("trabajoTurnos", e.target.value)} />
                  </label>
                </div>

                <div>
                  <p className="text-sm opacity-80 mb-2">¿Qué días de la semana trabaja?</p>
                  <div className="flex flex-wrap gap-2">
                    {INTAKE_DIAS_SEMANA.map((dia) => (
                      <button
                        key={`trabaja-${dia}`}
                        type="button"
                        onClick={() => update("diasTrabajo", toggleValue(form.diasTrabajo, dia))}
                        className={`rounded-full px-3 py-1.5 text-sm border ${form.diasTrabajo.includes(dia) ? "bg-violet-500/20 border-violet-400/50 text-violet-200" : "bg-white/5 border-white/10 text-white/80"}`}
                      >
                        {dia}
                      </button>
                    ))}
                  </div>
                </div>
              </section>

              <section className={sectionClass}>
                <h2 className="text-lg font-semibold">6) Alimentación actual</h2>
                <p className="text-sm opacity-70">No busques responder “perfecto”: cuéntanos cómo comes hoy normalmente.</p>
                <label className="flex flex-col gap-1">
                  <span className="text-sm opacity-80">¿Cuántas comidas haces al día y en qué horarios? *</span>
                  <textarea rows={2} className="rounded-xl bg-white/5 px-3 py-2 outline-none" placeholder="Ej.: 4 comidas - 8:00, 12:30, 17:00, 21:00" value={form.comidasPorDiaHorarios} onChange={(e) => update("comidasPorDiaHorarios", e.target.value)} />
                </label>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <label className="flex flex-col gap-1">
                    <span className="text-sm opacity-80">¿Cómo describirías tu apetito?</span>
                    <select className="rounded-xl bg-white/5 px-3 py-2 outline-none" value={form.apetito} onChange={(e) => update("apetito", e.target.value)}>
                      <option value="bueno">Bueno</option>
                      <option value="regular">Regular</option>
                      <option value="malo">Malo</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-sm opacity-80">¿En qué momento del día tienes más hambre?</span>
                    <input className="rounded-xl bg-white/5 px-3 py-2 outline-none" value={form.momentoMasHambre} onChange={(e) => update("momentoMasHambre", e.target.value)} />
                  </label>
                </div>
                <label className="flex flex-col gap-1">
                  <span className="text-sm opacity-80">Snacks y bebidas frecuentes</span>
                  <textarea rows={2} className="rounded-xl bg-white/5 px-3 py-2 outline-none" value={form.snacksBebidas} onChange={(e) => update("snacksBebidas", e.target.value)} />
                </label>

                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-4">
                  <p className="text-sm opacity-90 font-medium">Tus preferencias de alimentos</p>
                  <p className="text-xs opacity-70">
                    Pulsa una vez = me gusta, pulsa otra vez = no me gusta, y una tercera = sin marcar.
                    Los no marcados se tomarán como neutros.
                  </p>
                  {INTAKE_FOOD_GROUPS.map((group) => (
                    <div key={group.group} className="space-y-2">
                      <p className="text-sm opacity-85">
                        {group.emoji} {group.group}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {group.foods.map((food) => {
                          const value = form.preferenciasAlimentos[food];
                          const className =
                            value === "gusta"
                              ? "bg-emerald-500/20 border-emerald-400/50 text-emerald-200"
                              : value === "no_gusta"
                                ? "bg-rose-500/20 border-rose-400/50 text-rose-200"
                                : "bg-white/5 border-white/10 text-white/80";
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
                              className={`rounded-full px-3 py-1.5 text-sm border ${className}`}
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
                    <span className="text-sm opacity-80">Alergias/restricciones alimentarias</span>
                    <textarea rows={2} className="rounded-xl bg-white/5 px-3 py-2 outline-none" value={form.restriccionesAlergias} onChange={(e) => update("restriccionesAlergias", e.target.value)} />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-sm opacity-80">Agua al día (aprox.)</span>
                    <input className="rounded-xl bg-white/5 px-3 py-2 outline-none" placeholder="Ej.: 2 litros" value={form.aguaPorDia} onChange={(e) => update("aguaPorDia", e.target.value)} />
                  </label>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <label className="flex flex-col gap-1">
                    <span className="text-sm opacity-80">Alcohol</span>
                    <select className="rounded-xl bg-white/5 px-3 py-2 outline-none" value={form.alcoholFrecuencia} onChange={(e) => update("alcoholFrecuencia", e.target.value)}>
                      <option value="nunca">Nunca</option>
                      <option value="ocasional">Ocasional</option>
                      <option value="semanal">Semanal</option>
                      <option value="frecuente">Frecuente</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-sm opacity-80">Fuma</span>
                    <select className="rounded-xl bg-white/5 px-3 py-2 outline-none" value={form.fuma} onChange={(e) => update("fuma", e.target.value)}>
                      <option value="no">No</option>
                      <option value="si">Sí</option>
                      <option value="ocasional">Ocasional</option>
                    </select>
                  </label>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <label className="flex flex-col gap-1">
                    <span className="text-sm opacity-80">Digestión/molestias (hinchazón, acidez, etc.)</span>
                    <textarea rows={2} className="rounded-xl bg-white/5 px-3 py-2 outline-none" value={form.digestion} onChange={(e) => update("digestion", e.target.value)} />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-sm opacity-80">Presupuesto para comida (aprox.)</span>
                    <input className="rounded-xl bg-white/5 px-3 py-2 outline-none" placeholder="Ej.: bajo / medio / alto" value={form.presupuestoComida} onChange={(e) => update("presupuestoComida", e.target.value)} />
                  </label>
                </div>

                <label className="flex flex-col gap-1">
                  <span className="text-sm opacity-80">Tiempo real para cocinar al día</span>
                  <input className="rounded-xl bg-white/5 px-3 py-2 outline-none" placeholder="Ej.: 20 minutos, 1 hora, solo preparación el domingo..." value={form.tiempoParaCocinar} onChange={(e) => update("tiempoParaCocinar", e.target.value)} />
                </label>

                <label className="flex flex-col gap-1">
                  <span className="text-sm opacity-80">Cuéntame un día tipo: ¿qué comes desde que te levantas hasta que te acuestas? *</span>
                  <textarea rows={3} className="rounded-xl bg-white/5 px-3 py-2 outline-none" value={form.diaTipoComidas} onChange={(e) => update("diaTipoComidas", e.target.value)} />
                </label>

                <label className="flex flex-col gap-1">
                  <span className="text-sm opacity-80">¿Tomas suplementos? ¿Cuáles y de qué marca? (si quieres, luego puedes enviar foto por WhatsApp)</span>
                  <textarea rows={2} className="rounded-xl bg-white/5 px-3 py-2 outline-none" value={form.suplementosActualesDetalle} onChange={(e) => update("suplementosActualesDetalle", e.target.value)} />
                </label>

                <label className="flex flex-col gap-1">
                  <span className="text-sm opacity-80">Si no tomas suplementos, ¿te gustaría empezar con alguno?</span>
                  <input className="rounded-xl bg-white/5 px-3 py-2 outline-none" value={form.quiereSuplementos} onChange={(e) => update("quiereSuplementos", e.target.value)} />
                </label>

                <label className="flex flex-col gap-1">
                  <span className="text-sm opacity-80">¿Has hecho alguna dieta antes?</span>
                  <select className="rounded-xl bg-white/5 px-3 py-2 outline-none" value={form.haHechoDietaAntes} onChange={(e) => update("haHechoDietaAntes", e.target.value)}>
                    <option value="no">No</option>
                    <option value="si">Sí</option>
                  </select>
                </label>

                {form.haHechoDietaAntes === "si" && (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <label className="flex flex-col gap-1">
                      <span className="text-sm opacity-80">¿En qué se basaba?</span>
                      <textarea rows={2} className="rounded-xl bg-white/5 px-3 py-2 outline-none" value={form.dietaEnQueConsistia} onChange={(e) => update("dietaEnQueConsistia", e.target.value)} />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-sm opacity-80">¿Hace cuánto la hiciste?</span>
                      <input className="rounded-xl bg-white/5 px-3 py-2 outline-none" value={form.dietaHaceCuanto} onChange={(e) => update("dietaHaceCuanto", e.target.value)} />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-sm opacity-80">¿Durante cuánto tiempo?</span>
                      <input className="rounded-xl bg-white/5 px-3 py-2 outline-none" value={form.dietaCuantoTiempo} onChange={(e) => update("dietaCuantoTiempo", e.target.value)} />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-sm opacity-80">¿Qué tal te fue?</span>
                      <textarea rows={2} className="rounded-xl bg-white/5 px-3 py-2 outline-none" value={form.dietaQueTal} onChange={(e) => update("dietaQueTal", e.target.value)} />
                    </label>
                  </div>
                )}
              </section>

              <section className={sectionClass}>
                <h2 className="text-lg font-semibold">7) Motivación y seguimiento</h2>
                <label className="flex flex-col gap-1">
                  <span className="text-sm opacity-80">A nivel de rendimiento físico, ¿qué te gustaría mejorar? *</span>
                  <textarea rows={3} className="rounded-xl bg-white/5 px-3 py-2 outline-none" value={form.objetivoRendimiento} onChange={(e) => update("objetivoRendimiento", e.target.value)} />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-sm opacity-80">A nivel estético, ¿qué te gustaría cambiar? *</span>
                  <textarea rows={3} className="rounded-xl bg-white/5 px-3 py-2 outline-none" value={form.objetivoEstetico} onChange={(e) => update("objetivoEstetico", e.target.value)} />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-sm opacity-80">¿Por qué quieres empezar ahora?</span>
                  <textarea rows={3} className="rounded-xl bg-white/5 px-3 py-2 outline-none" value={form.motivacionPrincipal} onChange={(e) => update("motivacionPrincipal", e.target.value)} />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-sm opacity-80">¿Qué te está costando hoy para lograrlo?</span>
                  <textarea rows={3} className="rounded-xl bg-white/5 px-3 py-2 outline-none" value={form.dificultadActual} onChange={(e) => update("dificultadActual", e.target.value)} />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-sm opacity-80">Comentarios extra</span>
                  <textarea rows={3} className="rounded-xl bg-white/5 px-3 py-2 outline-none" value={form.comentariosExtra} onChange={(e) => update("comentariosExtra", e.target.value)} />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-sm opacity-80">¿Algo más que quieras contarme? (opcional)</span>
                  <textarea rows={3} className="rounded-xl bg-white/5 px-3 py-2 outline-none" value={form.textoLibreFinal} onChange={(e) => update("textoLibreFinal", e.target.value)} />
                </label>
              </section>

              <section className={sectionClass}>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4"
                    checked={form.consentimiento}
                    onChange={(e) => update("consentimiento", e.target.checked)}
                  />
                  <span className="opacity-80">
                    Confirmo que los datos son reales y autorizo su uso para que Lucas cree mi plan personalizado de entrenamiento y nutrición.
                  </span>
                </label>

                {error && (
                  <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>
                )}
                {success && (
                  <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-300">
                    ¡Perfecto, ya enviaste el formulario! Te hablaré por WhatsApp para iniciar el proceso.
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !form.consentimiento}
                  className="w-full sm:w-auto rounded-full px-6 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? "Enviando..." : "Enviar formulario"}
                </button>
              </section>
            </form>
          </motion.div>
        </div>
      </div>

      <AnimatePresence>
        {motivationalModalOpen && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setMotivationalModalOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 14 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 14 }}
              transition={{ duration: 0.2 }}
              className="relative z-10 w-full max-w-lg rounded-2xl border border-cyan-400/30 bg-gradient-to-br from-slate-900 to-slate-950 p-6 shadow-2xl"
            >
              <h3 className="text-xl font-semibold text-white">¡Buenísimo, este es tu punto de inicio!</h3>
              <p className="mt-3 text-sm leading-relaxed text-white/85">
                Voy a leer tu formulario personalmente y, a partir de ahí, empezamos con tu cambio.
                Lo más importante es que ya diste el primer paso.
              </p>
              <p className="mt-3 text-sm leading-relaxed text-white/80">
                Si aplicas lo que te vaya proponiendo con constancia, vas a notar cambios rápido y,
                sobre todo, te vas a sentir mucho mejor física y mentalmente.
              </p>
              <p className="mt-3 text-sm font-medium text-cyan-300">Vamos a por ello. Estoy contigo en este proceso.</p>

              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setMotivationalModalOpen(false)}
                  className="rounded-full border border-white/20 px-4 py-2 text-sm text-white/90 hover:bg-white/10"
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
