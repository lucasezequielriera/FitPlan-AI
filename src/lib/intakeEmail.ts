import type { IntakeFormState } from "@/lib/intakeFormSchema";

type IntakePayload = Partial<IntakeFormState> & Record<string, unknown>;

function toStringValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
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

  const sections = [
    section("Datos básicos", [
      ["Nombre", toStringValue(payload.nombreCompleto)],
      ["Email", toStringValue(payload.email)],
      ["WhatsApp", toStringValue(payload.whatsapp)],
      ["Instagram", toStringValue(payload.instagram)],
      ["Ciudad/País", toStringValue(payload.ciudadPais)],
      ["Edad", toStringValue(payload.edad)],
      ["Sexo", toStringValue(payload.sexo)],
      ["Altura (cm)", toStringValue(payload.alturaCm)],
      ["Peso (kg)", toStringValue(payload.pesoKg)],
    ]),
    section("Objetivo", [
      ["Objetivo principal", toStringValue(payload.objetivoPrincipal)],
      ["Objetivo secundario", toStringValue(payload.objetivoSecundario)],
      ["Fecha objetivo", toStringValue(payload.fechaObjetivo)],
    ]),
    section("Entrenamiento y disponibilidad", [
      ["Experiencia", toStringValue(payload.experienciaEntrenamiento)],
      ["Horas sentado por día", toStringValue(payload.horasSentado)],
      ["Pasos diarios", toStringValue(payload.pasosDiarios)],
      ["Días disponibles", toStringValue(payload.diasDisponibles)],
      ["Minutos por sesión", toStringValue(payload.minutosPorSesion)],
      ["Dónde entrena", toStringValue(payload.dondeEntrena)],
      ["Equipamiento", toStringValue(payload.equipamientoDisponible)],
    ]),
    section("Salud", [
      ["Lesiones/dolores", toStringValue(payload.lesionesDolores)],
      ["Cirugías", toStringValue(payload.cirugiasPrevias)],
      ["Medicación/suplementos", toStringValue(payload.medicacionSuplementos)],
      ["Patologías", toStringValue(payload.patologias)],
    ]),
    section("Hábitos", [
      ["Nivel de estrés", toStringValue(payload.nivelEstres)],
      ["Calidad del sueño", toStringValue(payload.calidadSueno)],
      ["Horas de sueño", toStringValue(payload.horasSueno)],
      ["Trabajo por turnos", toStringValue(payload.trabajoTurnos)],
    ]),
    section("Nutrición", [
      ["Desayuno habitual", toStringValue(payload.desayunoHabitual)],
      ["Almuerzo habitual", toStringValue(payload.almuerzoHabitual)],
      ["Cena habitual", toStringValue(payload.cenaHabitual)],
      ["Snacks y bebidas", toStringValue(payload.snacksBebidas)],
      ["Alergias/restricciones", toStringValue(payload.restriccionesAlergias)],
      ["Alimentos no le gustan", toStringValue(payload.alimentosNoLeGustan)],
      ["Alimentos sí le gustan", toStringValue(payload.alimentosSiLeGustan)],
      ["Agua por día", toStringValue(payload.aguaPorDia)],
      ["Alcohol", toStringValue(payload.alcoholFrecuencia)],
      ["Fuma", toStringValue(payload.fuma)],
      ["Digestión", toStringValue(payload.digestion)],
      ["Presupuesto comida", toStringValue(payload.presupuestoComida)],
      ["Tiempo para cocinar", toStringValue(payload.tiempoParaCocinar)],
    ]),
    section("Motivación y contexto", [
      ["Motivación principal", toStringValue(payload.motivacionPrincipal)],
      ["Dificultad actual", toStringValue(payload.dificultadActual)],
      ["Comentarios extra", toStringValue(payload.comentariosExtra)],
    ]),
  ];

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif; line-height:1.45; color:#0f172a;">
      <h1 style="font-size:22px; margin-bottom:6px;">Nuevo formulario de inicio</h1>
      <p style="margin-top:0; color:#475569;">Recibido: ${escapeHtml(now)}</p>
      ${sections.join("\n")}
    </div>
  `;

  const text = Object.entries(payload)
    .map(([key, value]) => `${key}: ${toStringValue(value)}`)
    .join("\n");

  return {
    subject: `[FitPlan] Formulario de inicio - ${nombre || "Sin nombre"} - ${objetivo || "Sin objetivo"}`,
    html,
    text,
  };
}
