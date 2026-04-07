import * as XLSX from "xlsx";

export const INTAKE_EXCEL_TEMPLATE_VERSION = "2026.3";
export const SHEET_TRAINING = "Entrenamiento_seguimiento";
export const SHEET_NUTRITION = "Nutricion";
export const SHEET_INFO = "Instrucciones";

function safeStr(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v);
}

function numOrEmpty(v: unknown): string | number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v.replace(",", ".")))) return Number(v.replace(",", "."));
  return "";
}

/** Convierte weeks si vino como objeto numerado (p. ej. desde JSON/Firestore). */
function asWeekArray(raw: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(raw)) return raw as Array<Record<string, unknown>>;
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    const keys = Object.keys(o).filter((k) => /^\d+$/.test(k));
    if (keys.length) {
      return keys.sort((a, b) => Number(a) - Number(b)).map((k) => {
        const v = o[k];
        return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
      });
    }
  }
  return [];
}

export function getWeekDays(week: Record<string, unknown>): Array<Record<string, unknown>> {
  const d = week.days ?? week.dias ?? week.Days;
  if (Array.isArray(d)) return d as Array<Record<string, unknown>>;
  if (d && typeof d === "object" && !Array.isArray(d)) {
    const o = d as Record<string, unknown>;
    const keys = Object.keys(o).filter((k) => /^\d+$/.test(k));
    if (keys.length) {
      return keys.sort((a, b) => Number(a) - Number(b)).map((k) => o[k] as Record<string, unknown>);
    }
  }
  return [];
}

export function getDayExercises(day: Record<string, unknown>): Array<Record<string, unknown>> {
  const e = day.ejercicios ?? day.exercises ?? day.ejercicio;
  if (Array.isArray(e)) return e as Array<Record<string, unknown>>;
  return [];
}

export function exerciseName(ex: Record<string, unknown>): string {
  return safeStr(ex.name ?? ex.nombre ?? ex.ejercicio ?? "Ejercicio");
}

function weekHasAnyExercise(week: Record<string, unknown>): boolean {
  return getWeekDays(week).some((day) => getDayExercises(day).length > 0);
}

function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

/**
 * Asegura 4 semanas exportables: la IA a menudo devuelve solo semana 1 con días;
 * las demás vienen vacías y el Excel quedaba casi sin entreno.
 */
export function normalizeTrainingWeeksForExport(weeksRaw: unknown): Array<Record<string, unknown>> {
  let weeks = asWeekArray(weeksRaw);
  if (weeks.length === 0) return [];

  const templateIdx = weeks.findIndex((w) => weekHasAnyExercise(w));
  if (templateIdx < 0) return weeks;

  const templateDays = deepClone(getWeekDays(weeks[templateIdx]));
  if (templateDays.length === 0) return weeks;

  const filled = weeks.map((w, i) => {
    if (weekHasAnyExercise(w)) return w;
    return {
      ...w,
      week: typeof w.week === "number" ? w.week : i + 1,
      days: deepClone(templateDays),
    };
  });

  const targetWeeks = 4;
  if (filled.length >= targetWeeks) return filled.slice(0, targetWeeks);

  const out = [...filled];
  let nextNum = filled.length;
  while (out.length < targetWeeks) {
    nextNum += 1;
    out.push({
      week: nextNum,
      days: deepClone(templateDays),
    });
  }
  return out;
}

export function resolveTrainingPlan(planRoot: Record<string, unknown>): Record<string, unknown> | null {
  const tp = planRoot.training_plan;
  if (tp && typeof tp === "object") return tp as Record<string, unknown>;
  const alt = (planRoot as Record<string, unknown>).trainingPlan;
  if (alt && typeof alt === "object") return alt as Record<string, unknown>;
  return null;
}

/**
 * Genera un .xlsx con hojas: Instrucciones, Resumen, Nutricion, Entrenamiento_seguimiento (columnas para peso, descanso, RIR).
 */
export function buildIntakePlanXlsxBuffer(
  planRoot: Record<string, unknown>,
  options: { clientLabel: string }
): ArrayBuffer {
  const wb = XLSX.utils.book_new();
  const clientName = options.clientLabel || "Cliente";

  const instr: (string | number)[][] = [
    ["Lucas Riera — Plan de seguimiento"],
    [`Plantilla v${INTAKE_EXCEL_TEMPLATE_VERSION}`],
    [""],
    ["Cómo usar este archivo"],
    ["1) La hoja «Entrenamiento_seguimiento» lista cada ejercicio (hasta 4 semanas; si el plan solo traía 1 semana detallada, se repite la misma rutina para seguimiento mensual)."],
    ["2) La columna «Ilustracion_ref» y la imagen junto a cada ejercicio son orientativas (catálogo wger o póster HTTPS del coach). No sustituyen la supervisión presencial."],
    ["3) Completa SOLO las columnas que terminan en _CLIENTE (peso usado, descanso real, RIR percibido, notas)."],
    ["4) No renombres hojas ni encabezados: así podremos importar tus datos al actualizar el plan con IA."],
    ["5) Devuelve este archivo (o un CSV exportado desde Excel) cuando tu entrenador te pida actualizar."],
    [""],
    ["Nota: RIR = repeticiones en reserva (0 = fallo técnico, 1–3 = cerca del fallo)."],
  ];
  const wsInstr = XLSX.utils.aoa_to_sheet(instr);
  wsInstr["!cols"] = [{ wch: 92 }];
  XLSX.utils.book_append_sheet(wb, wsInstr, SHEET_INFO);

  const kcal = numOrEmpty(planRoot.calorias_diarias);
  const kcalMant = numOrEmpty(planRoot.calorias_mantenimiento);
  const macros =
    planRoot.macros && typeof planRoot.macros === "object" ? (planRoot.macros as Record<string, unknown>) : null;
  const resumen: (string | number)[][] = [
    ["Cliente", clientName],
    ["Calorías objetivo (kcal/día)", kcal],
    ["Calorías mantenimiento TDEE (kcal/día)", kcalMant],
    ["Proteínas", macros ? safeStr(macros.proteinas) : ""],
    ["Grasas", macros ? safeStr(macros.grasas) : ""],
    ["Carbohidratos", macros ? safeStr(macros.carbohidratos) : ""],
  ];
  const wsRes = XLSX.utils.aoa_to_sheet(resumen);
  wsRes["!cols"] = [{ wch: 28 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, wsRes, "Resumen");

  const weeklyPlan = Array.isArray(planRoot.plan_semanal)
    ? (planRoot.plan_semanal as Array<Record<string, unknown>>)
    : [];

  const nutHeader = [
    "Dia",
    "Comida",
    "Hora",
    "Opcion_principal",
    "P_g_aprox",
    "G_g_aprox",
    "CHO_g_aprox",
    "Cumplimiento_CLIENTE",
    "Notas_CLIENTE",
  ];
  const nutRows: (string | number)[][] = [nutHeader];
  weeklyPlan.forEach((day) => {
    const dayName = safeStr(day.dia || "Día");
    const meals = Array.isArray(day.comidas) ? (day.comidas as Array<Record<string, unknown>>) : [];
    meals.forEach((meal) => {
      const mealName = safeStr(meal.nombre || "Comida");
      const mealTime = safeStr(meal.hora || "--:--");
      const mealOption = Array.isArray(meal.opciones) ? safeStr((meal.opciones as unknown[])[0] || "") : "";
      const mm =
        meal.macros_aprox && typeof meal.macros_aprox === "object"
          ? (meal.macros_aprox as Record<string, unknown>)
          : null;
      nutRows.push([
        dayName,
        mealName,
        mealTime,
        mealOption,
        mm ? numOrEmpty(mm.proteinas_g) : "",
        mm ? numOrEmpty(mm.grasas_g) : "",
        mm ? numOrEmpty(mm.carbohidratos_g) : "",
        "",
        "",
      ]);
    });
  });
  const wsNut = XLSX.utils.aoa_to_sheet(nutRows);
  wsNut["!cols"] = [{ wch: 12 }, { wch: 14 }, { wch: 8 }, { wch: 48 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 22 }, { wch: 28 }];
  XLSX.utils.book_append_sheet(wb, wsNut, SHEET_NUTRITION);

  const trainHeader = [
    "Semana",
    "Dia",
    "Orden",
    "Ejercicio",
    "Ilustracion_ref",
    "Series_plan",
    "Reps_plan",
    "Musculo",
    "Descanso_s_plan",
    "RPE_o_notas_plan",
    "Peso_kg_CLIENTE",
    "Descanso_s_CLIENTE",
    "RIR_CLIENTE",
    "Notas_CLIENTE",
  ];
  const trainRows: (string | number)[][] = [trainHeader];

  const trainingPlan = resolveTrainingPlan(planRoot);
  const weeks = normalizeTrainingWeeksForExport(trainingPlan?.weeks);

  weeks.forEach((week, wi) => {
    const weekNum = typeof week.week === "number" && Number.isFinite(week.week) ? week.week : wi + 1;
    const days = getWeekDays(week);
    days.forEach((day) => {
      const dayName = safeStr(day.day ?? day.dia ?? day.name ?? "Día");
      const exercises = getDayExercises(day);
      exercises.forEach((ex, ei) => {
        const rpe = ex.rpe;
        const rpeNote =
          typeof rpe === "number"
            ? `RPE ${rpe}`
            : safeStr(ex.rpe || "") || (typeof ex.rpe === "number" ? String(ex.rpe) : "");
        const rest = ex.rest_seconds != null ? numOrEmpty(ex.rest_seconds) : "";
        const muscle = safeStr(ex.muscle_group ?? ex.musculo ?? ex.grupo_muscular ?? "");
        trainRows.push([
          weekNum,
          dayName,
          ei + 1,
          exerciseName(ex),
          "",
          numOrEmpty(ex.sets ?? ex.series),
          safeStr(ex.reps ?? ex.repeticiones ?? ""),
          muscle,
          rest,
          rpeNote || safeStr(ex.technique ?? ex.technique_notes ?? "").slice(0, 120),
          "",
          "",
          "",
          "",
        ]);
      });
    });
  });

  const wsTrain = XLSX.utils.aoa_to_sheet(trainRows);
  const lastRow = Math.max(0, trainRows.length - 1);
  const lastCol = trainHeader.length - 1;
  wsTrain["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: lastRow, c: lastCol } });
  wsTrain["!cols"] = [
    { wch: 7 },
    { wch: 12 },
    { wch: 5 },
    { wch: 36 },
    { wch: 34 },
    { wch: 11 },
    { wch: 12 },
    { wch: 14 },
    { wch: 14 },
    { wch: 22 },
    { wch: 16 },
    { wch: 18 },
    { wch: 12 },
    { wch: 36 },
  ];
  XLSX.utils.book_append_sheet(wb, wsTrain, SHEET_TRAINING);

  const sups = Array.isArray(planRoot.suplementacion_recomendada)
    ? (planRoot.suplementacion_recomendada as Array<Record<string, unknown>>)
    : [];
  if (sups.length > 0) {
    const supHeader = ["Nombre", "Dosis", "Momento", "Motivo", "Prioridad", "Notas_CLIENTE"];
    const supRows: (string | number)[][] = [supHeader];
    sups.forEach((s) => {
      supRows.push([
        safeStr(s.nombre),
        safeStr(s.dosis),
        safeStr(s.momento),
        safeStr(s.motivo),
        safeStr(s.prioridad),
        "",
      ]);
    });
    const wsSup = XLSX.utils.aoa_to_sheet(supRows);
    wsSup["!cols"] = [{ wch: 22 }, { wch: 14 }, { wch: 14 }, { wch: 36 }, { wch: 12 }, { wch: 24 }];
    XLSX.utils.book_append_sheet(wb, wsSup, "Suplementacion");
  }

  const cardio =
    planRoot.cardio_recomendado && typeof planRoot.cardio_recomendado === "object"
      ? (planRoot.cardio_recomendado as Record<string, unknown>)
      : null;
  if (cardio && Object.keys(cardio).length > 0) {
    const cardioRows: (string | number)[][] = [
      ["Campo", "Valor"],
      ["Detalle", safeStr(cardio.detalle)],
      ["Pasos diarios objetivo", safeStr(cardio.objetivo_pasos_diarios)],
      ["Sesiones/semana", safeStr(cardio.sesiones_por_semana)],
      ["Notas_CLIENTE", ""],
    ];
    const wsCardio = XLSX.utils.aoa_to_sheet(cardioRows);
    wsCardio["!cols"] = [{ wch: 22 }, { wch: 50 }];
    XLSX.utils.book_append_sheet(wb, wsCardio, "Cardio");
  }

  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return out as ArrayBuffer;
}

/** Normaliza nombre de columna para comparar con la plantilla exportada. */
function normHeader(k: string): string {
  return k.trim().toLowerCase().replace(/\s+/g, "_");
}

function getCell(row: Record<string, unknown>, ...candidates: string[]): string {
  const targets = candidates.map((c) => normHeader(c));
  for (const key of Object.keys(row)) {
    if (targets.includes(normHeader(key))) {
      const v = row[key];
      if (v === null || v === undefined) return "";
      const s = String(v).trim();
      return s;
    }
  }
  return "";
}

function hasText(v: string): boolean {
  return v.length > 0;
}

const TRAINING_CLIENT_COLS = ["Peso_kg_CLIENTE", "Descanso_s_CLIENTE", "RIR_CLIENTE", "Notas_CLIENTE"] as const;
const NUTRITION_CLIENT_COLS = ["Cumplimiento_CLIENTE", "Notas_CLIENTE"] as const;

function trainingRowHasClientData(row: Record<string, unknown>): boolean {
  return TRAINING_CLIENT_COLS.some((c) => hasText(getCell(row, c)));
}

function nutritionRowHasClientData(row: Record<string, unknown>): boolean {
  return NUTRITION_CLIENT_COLS.some((c) => hasText(getCell(row, c)));
}

function findSheetName(names: string[], predicate: (n: string) => boolean): string | undefined {
  return names.find(predicate);
}

/**
 * Lee el Excel devuelto por el cliente y produce un texto para el prompt de actualización.
 * Solo incluye filas donde el cliente rellenó columnas _CLIENTE; el resto se omite para no ruido.
 */
export function parseClientTrackingExcel(data: ArrayBuffer): {
  ok: boolean;
  summary: string;
  error?: string;
  /** true si el archivo se leyó pero no había celdas _CLIENTE rellenas */
  emptyClientFields?: boolean;
} {
  try {
    const wb = XLSX.read(data, { type: "array" });
    const names = wb.SheetNames;
    if (!names.length) return { ok: false, summary: "", error: "El archivo no contiene hojas." };

    const trainingName =
      findSheetName(names, (n) => normHeader(n) === normHeader(SHEET_TRAINING)) ||
      findSheetName(names, (n) => n.toLowerCase().includes("entrenamiento")) ||
      names[0];

    const lines: string[] = [
      "--- Seguimiento devuelto por el cliente (Excel) — solo filas con datos en columnas _CLIENTE ---",
      `Plantilla esperada v${INTAKE_EXCEL_TEMPLATE_VERSION} · hoja entrenamiento: «${trainingName}»`,
    ];

    const trainingWs = wb.Sheets[trainingName];
    if (!trainingWs) return { ok: false, summary: "", error: "No se encontró la hoja de entrenamiento." };

    const trainRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(trainingWs, { defval: "", raw: false });
    const trainingLines: string[] = [];

    trainRows.forEach((row) => {
      if (!trainingRowHasClientData(row)) return;
      const semana = getCell(row, "Semana");
      const dia = getCell(row, "Dia", "Día");
      const orden = getCell(row, "Orden");
      const ejercicio = getCell(row, "Ejercicio");
      const series = getCell(row, "Series_plan");
      const reps = getCell(row, "Reps_plan");
      const descPlan = getCell(row, "Descanso_s_plan");
      const peso = getCell(row, "Peso_kg_CLIENTE");
      const descCli = getCell(row, "Descanso_s_CLIENTE");
      const rir = getCell(row, "RIR_CLIENTE");
      const notas = getCell(row, "Notas_CLIENTE");

      const ctx = [
        semana && `sem. ${semana}`,
        dia && String(dia),
        orden && `#${orden}`,
        ejercicio && String(ejercicio),
      ]
        .filter(Boolean)
        .join(" · ");

      const planBit = [series && `series plan ${series}`, reps && `reps ${reps}`, descPlan && `descanso plan ${descPlan}s`]
        .filter(Boolean)
        .join(", ");

      const cliBits = [
        hasText(peso) ? `peso real ${peso} kg` : null,
        hasText(descCli) ? `descanso real ${descCli} s` : null,
        hasText(rir) ? `RIR ${rir}` : null,
        hasText(notas) ? `notas: ${notas}` : null,
      ].filter(Boolean);

      const line = ctx
        ? `• ${ctx}${planBit ? ` (${planBit})` : ""} → ${cliBits.join("; ")}`
        : `• (fila) → ${cliBits.join("; ")}`;
      trainingLines.push(line);
    });

    const nutritionName = findSheetName(names, (n) => normHeader(n) === normHeader(SHEET_NUTRITION));
    const nutritionLines: string[] = [];
    if (nutritionName) {
      const nutWs = wb.Sheets[nutritionName];
      if (nutWs) {
        const nutRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(nutWs, { defval: "", raw: false });
        nutRows.forEach((row) => {
          if (!nutritionRowHasClientData(row)) return;
          const d = getCell(row, "Dia", "Día");
          const comida = getCell(row, "Comida");
          const opc = getCell(row, "Opcion_principal", "Opción_principal");
          const cumpl = getCell(row, "Cumplimiento_CLIENTE");
          const notas = getCell(row, "Notas_CLIENTE");
          const head = [d, comida, opc].filter(hasText).join(" · ");
          const bits = [
            hasText(cumpl) ? `cumplimiento: ${cumpl}` : null,
            hasText(notas) ? `notas: ${notas}` : null,
          ].filter(Boolean);
          nutritionLines.push(`• ${head || "Comida"} → ${bits.join("; ")}`);
        });
      }
    }

    const supLines: string[] = [];
    const supName = findSheetName(names, (n) => normHeader(n) === "suplementacion");
    if (supName) {
      const supWs = wb.Sheets[supName];
      if (supWs) {
        const supRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(supWs, { defval: "", raw: false });
        supRows.forEach((row) => {
          const n = getCell(row, "Notas_CLIENTE");
          if (!hasText(n)) return;
          const nombre = getCell(row, "Nombre");
          supLines.push(`• ${nombre || "Suplemento"} → notas: ${n}`);
        });
      }
    }

    const cardioLines: string[] = [];
    const cardName = findSheetName(names, (n) => n.toLowerCase() === "cardio");
    if (cardName) {
      const cardWs = wb.Sheets[cardName];
      if (cardWs) {
        const cardRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(cardWs, { defval: "", raw: false });
        cardRows.forEach((row) => {
          const campo = getCell(row, "Campo");
          const val = getCell(row, "Valor");
          if (normHeader(String(campo)) === normHeader("Notas_CLIENTE") && hasText(val)) {
            cardioLines.push(`• Cardio — notas cliente: ${val}`);
          }
        });
      }
    }

    const anyData =
      trainingLines.length > 0 || nutritionLines.length > 0 || supLines.length > 0 || cardioLines.length > 0;

    if (!anyData) {
      const emptyMsg =
        "Archivo leído correctamente, pero no hay celdas rellenas en columnas _CLIENTE " +
        "(entrenamiento: peso, descanso, RIR, notas; nutrición: cumplimiento y notas; suplementación/cardio: notas). " +
        "Pide al cliente que complete solo esas columnas y vuelva a enviar el Excel.";
      lines.push("");
      lines.push(emptyMsg);
      return { ok: true, summary: lines.join("\n"), emptyClientFields: true };
    }

    lines.push("");
    lines.push("=== ENTRENAMIENTO (datos del cliente) ===");
    lines.push(...trainingLines);

    if (nutritionLines.length) {
      lines.push("");
      lines.push("=== NUTRICIÓN (datos del cliente) ===");
      lines.push(...nutritionLines);
    }
    if (supLines.length) {
      lines.push("");
      lines.push("=== SUPLEMENTACIÓN (notas del cliente) ===");
      lines.push(...supLines);
    }
    if (cardioLines.length) {
      lines.push("");
      lines.push("=== CARDIO (notas del cliente) ===");
      lines.push(...cardioLines);
    }

    return { ok: true, summary: lines.join("\n"), emptyClientFields: false };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, summary: "", error: msg };
  }
}
