import { INTAKE_FOOD_GROUPS, type FoodPreference, type IntakeFormState } from "@/lib/intakeFormSchema";

type IntakePayload = Partial<IntakeFormState> & Record<string, unknown>;

function toStringValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}

function getFoodPreferencesBuckets(value: unknown): {
  gusta: string[];
  noGusta: string[];
  neutras: string[];
} {
  const allFoods = INTAKE_FOOD_GROUPS.flatMap((group) => group.foods);
  const preferences =
    value && typeof value === "object"
      ? (value as Record<string, FoodPreference>)
      : {};

  const gusta = allFoods.filter((food) => preferences[food] === "gusta");
  const noGusta = allFoods.filter((food) => preferences[food] === "no_gusta");
  const neutras = allFoods.filter((food) => !preferences[food]);

  return { gusta, noGusta, neutras };
}

function formatList(values: string[]): string {
  return values.length > 0 ? values.join(", ") : "-";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function section(title: string, rows: Array<[string, string]>): string {
  const htmlRows = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:6px 10px; font-weight:600;">${escapeHtml(label)}</td><td style="padding:6px 10px;">${escapeHtml(
          value || "-"
        )}</td></tr>`
    )
    .join("");

  return `
    <h2 style="margin:20px 0 10px; font-size:18px;">${escapeHtml(title)}</h2>
    <table style="width:100%; border-collapse:collapse; background:#f8fafc; border:1px solid #e2e8f0;">
      ${htmlRows}
    </table>
  `;
}

export function buildIntakeEmail(payload: IntakePayload): { subject: string; html: string; text: string } {
  const nombre = toStringValue(payload.nombreCompleto);
  const objetivo = toStringValue(payload.objetivoPrincipal);
  const now = new Date().toLocaleString("es-ES");
  const foodPreferences = getFoodPreferencesBuckets(payload.preferenciasAlimentos);

  const sections = [
    section("Datos básicos", [
      ["Nombre", toStringValue(payload.nombreCompleto)],
      ["Email", toStringValue(payload.email)],
      ["WhatsApp", toStringValue(payload.whatsapp)],
      ["Servicio interesado", toStringValue(payload.servicioInteres)],
      ["Instagram", toStringValue(payload.instagram)],
      ["Ciudad/País", toStringValue(payload.ciudadPais)],
      ["Edad", toStringValue(payload.edad)],
      ["Sexo", toStringValue(payload.sexo)],
      ["Altura (cm)", toStringValue(payload.alturaCm)],
      ["Peso (kg)", toStringValue(payload.pesoKg)],
      ["Peso objetivo (kg)", toStringValue(payload.pesoObjetivoKg)],
    ]),
    section("Objetivo", [
      ["Objetivo principal", toStringValue(payload.objetivoPrincipal)],
      ["Objetivo secundario", toStringValue(payload.objetivoSecundario)],
      ["Fecha objetivo", toStringValue(payload.fechaObjetivo)],
    ]),
    section("Entrenamiento y disponibilidad", [
      ["Experiencia", toStringValue(payload.experienciaEntrenamiento)],
      ["Días que entrena actualmente", toStringValue(payload.diasEntrenaActualmente)],
      ["Detalle días actuales", toStringValue(payload.diasEntrenaActualmenteDetalle)],
      ["Días de compromiso", toStringValue(payload.diasCompromisoEntrenamiento)],
      ["Detalle días compromiso", toStringValue(payload.diasCompromisoDetalle)],
      ["Horas sentado por día", toStringValue(payload.horasSentado)],
      ["Pasos diarios", toStringValue(payload.pasosDiarios)],
      ["Días disponibles", toStringValue(payload.diasDisponibles)],
      ["Minutos por sesión", toStringValue(payload.minutosPorSesion)],
      ["Hora entrenamiento", toStringValue(payload.horaEntrenamiento)],
      ["Duración sesión", toStringValue(payload.duracionSesion)],
      ["Plan para", toStringValue(payload.planLugar)],
      ["Material en casa", toStringValue(payload.materialCasa)],
      ["Dónde entrena", toStringValue(payload.dondeEntrena)],
      ["Equipamiento", toStringValue(payload.equipamientoDisponible)],
    ]),
    section("Salud", [
      ["Enfermedades desde pequeño/a", toStringValue(payload.enfermedadInfancia)],
      ["Lesiones/dolores", toStringValue(payload.lesionesDolores)],
      ["Cirugías", toStringValue(payload.cirugiasPrevias)],
      ["Medicación/suplementos", toStringValue(payload.medicacionSuplementos)],
      ["Diabetes", toStringValue(payload.diabetesTipo)],
      ["Hipertensión arterial", toStringValue(payload.hipertensionArterial)],
      ["Enfermedad del corazón", toStringValue(payload.enfermedadCorazon)],
      ["Hipotiroidismo", toStringValue(payload.hipotiroidismo)],
      ["Colesterol/triglicéridos", toStringValue(payload.colesterolTrigliceridos)],
      ["Molestias digestivas tipo", toStringValue(payload.molestiasDigestivasTipo)],
      ["Patologías", toStringValue(payload.patologias)],
    ]),
    section("Hábitos", [
      ["Descansa bien", toStringValue(payload.descansaBien)],
      ["Nivel de estrés", toStringValue(payload.nivelEstres)],
      ["Calidad del sueño", toStringValue(payload.calidadSueno)],
      ["Horas de sueño", toStringValue(payload.horasSueno)],
      ["Horas de trabajo por día", toStringValue(payload.trabajoTurnos)],
      ["Días de trabajo", toStringValue(payload.diasTrabajo)],
    ]),
    section("Nutrición", [
      ["Desayuno habitual", toStringValue(payload.desayunoHabitual)],
      ["Almuerzo habitual", toStringValue(payload.almuerzoHabitual)],
      ["Cena habitual", toStringValue(payload.cenaHabitual)],
      ["Comidas por día y horarios", toStringValue(payload.comidasPorDiaHorarios)],
      ["Apetito", toStringValue(payload.apetito)],
      ["Momento de más hambre", toStringValue(payload.momentoMasHambre)],
      ["Alimentos que le gustan", formatList(foodPreferences.gusta)],
      ["Alimentos que no le gustan", formatList(foodPreferences.noGusta)],
      ["Alimentos neutros (sin marcar)", formatList(foodPreferences.neutras)],
      ["Día tipo de comidas", toStringValue(payload.diaTipoComidas)],
      ["Snacks y bebidas", toStringValue(payload.snacksBebidas)],
      ["Alergias/restricciones", toStringValue(payload.restriccionesAlergias)],
      ["Alimentos no le gustan", toStringValue(payload.alimentosNoLeGustan)],
      ["Alimentos sí le gustan", toStringValue(payload.alimentosSiLeGustan)],
      ["Agua por día", toStringValue(payload.aguaPorDia)],
      ["Alcohol", toStringValue(payload.alcoholFrecuencia)],
      ["Fuma", toStringValue(payload.fuma)],
      ["Digestión", toStringValue(payload.digestion)],
      ["Suplementos actuales", toStringValue(payload.suplementosActualesDetalle)],
      ["Interés en suplementos", toStringValue(payload.quiereSuplementos)],
      ["Ha hecho dieta antes", toStringValue(payload.haHechoDietaAntes)],
      ["Dieta: en qué consistía", toStringValue(payload.dietaEnQueConsistia)],
      ["Dieta: hace cuánto", toStringValue(payload.dietaHaceCuanto)],
      ["Dieta: cuánto tiempo", toStringValue(payload.dietaCuantoTiempo)],
      ["Dieta: resultado", toStringValue(payload.dietaQueTal)],
      ["Presupuesto comida", toStringValue(payload.presupuestoComida)],
      ["Tiempo para cocinar", toStringValue(payload.tiempoParaCocinar)],
    ]),
    section("Motivación y contexto", [
      ["Objetivo de rendimiento", toStringValue(payload.objetivoRendimiento)],
      ["Objetivo estético", toStringValue(payload.objetivoEstetico)],
      ["Motivación principal", toStringValue(payload.motivacionPrincipal)],
      ["Dificultad actual", toStringValue(payload.dificultadActual)],
      ["Comentarios extra", toStringValue(payload.comentariosExtra)],
      ["Texto libre final", toStringValue(payload.textoLibreFinal)],
    ]),
  ];

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif; line-height:1.45; color:#0f172a;">
      <h1 style="font-size:22px; margin-bottom:6px;">Nuevo formulario de inicio</h1>
      <p style="margin-top:0; color:#475569;">Recibido: ${escapeHtml(now)}</p>
      ${sections.join("\n")}
    </div>
  `;

  const text = [
    ...Object.entries(payload).map(([key, value]) => `${key}: ${toStringValue(value)}`),
    `preferenciasAlimentos_gustan: ${formatList(foodPreferences.gusta)}`,
    `preferenciasAlimentos_noGustan: ${formatList(foodPreferences.noGusta)}`,
    `preferenciasAlimentos_neutras: ${formatList(foodPreferences.neutras)}`,
  ]
    .join("\n");

  return {
    subject: `[FitPlan] Formulario de inicio - ${nombre || "Sin nombre"} - ${objetivo || "Sin objetivo"}`,
    html,
    text,
  };
}
