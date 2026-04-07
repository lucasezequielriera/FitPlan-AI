import ExcelJS from "exceljs";
import sharp from "sharp";
import {
  INTAKE_EXCEL_TEMPLATE_VERSION,
  SHEET_INFO,
  SHEET_NUTRITION,
  SHEET_TRAINING,
  exerciseName,
  getDayExercises,
  getWeekDays,
  normalizeTrainingWeeksForExport,
  resolveTrainingPlan,
} from "@/lib/intakePlanExcel";
import { isAllowedPosterUrl, normalizeExerciseMediaKey, type ExerciseMediaOverride } from "@/lib/exerciseMedia";
import { resolveWgerExerciseMediaBatch, type WgerExerciseMediaResult } from "@/lib/wgerExerciseMedia";

function safeStr(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v);
}

function numOrEmpty(v: unknown): string | number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v.replace(",", ".")))) return Number(v.replace(",", "."));
  return "";
}

type MediaOv = Record<string, ExerciseMediaOverride>;

const UA = "FitPlan-AI/1.0 (plan Excel export; +https://www.fitplan-ai.com)";

async function remoteImageToPngBuffer(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return await sharp(buf).rotate().resize({ width: 480, height: 480, fit: "inside" }).png().toBuffer();
  } catch {
    return null;
  }
}

function resolveStillForRow(
  name: string,
  ex: Record<string, unknown>,
  overrides: MediaOv,
  wgerMap: Record<string, WgerExerciseMediaResult | null>
): { url: string; refLabel: string } | null {
  const posterInline = typeof ex.demo_poster_url === "string" ? ex.demo_poster_url.trim() : "";
  if (isAllowedPosterUrl(posterInline)) {
    return { url: posterInline, refLabel: "Póster (plan)" };
  }
  const k = normalizeExerciseMediaKey(name);
  const p = overrides[k]?.demo_poster_url?.trim() || "";
  if (isAllowedPosterUrl(p)) {
    return { url: p, refLabel: "Póster (coach)" };
  }
  const w = wgerMap[name];
  if (w?.imageUrl) {
    const refLabel =
      w.source === "custom" ? `Catálogo · ${w.matchedName}` : `wger · ${w.matchedName}`;
    return { url: w.imageUrl, refLabel };
  }
  return null;
}

/**
 * Misma estructura que `buildIntakePlanXlsxBuffer` (plantilla 2026.3) más imágenes incrustadas
 * en la hoja de entrenamiento (póster HTTPS o ilustración wger).
 */
export async function buildIntakePlanXlsxWithExerciseImages(
  planRoot: Record<string, unknown>,
  options: { clientLabel: string }
): Promise<Buffer> {
  const clientName = options.clientLabel || "Cliente";
  const wb = new ExcelJS.Workbook();
  wb.creator = "FitPlan-AI";

  const instr: (string | number)[][] = [
    ["Lucas Riera — Plan de seguimiento"],
    [`Plantilla v${INTAKE_EXCEL_TEMPLATE_VERSION}`],
    [""],
    ["Cómo usar este archivo"],
    ["1) La hoja «Entrenamiento_seguimiento» lista cada ejercicio (hasta 4 semanas; si el plan solo traía 1 semana detallada, se repite la misma rutina para seguimiento mensual)."],
    ["2) La columna «Ilustracion_ref» y la imagen junto a cada ejercicio son orientativas (catálogo wger o póster HTTPS del coach)."],
    ["3) Completa SOLO las columnas que terminan en _CLIENTE (peso usado, descanso real, RIR percibido, notas)."],
    ["4) No renombres hojas ni encabezados: así podremos importar tus datos al actualizar el plan con IA."],
    ["5) Devuelve este archivo (o un CSV exportado desde Excel) cuando tu entrenador te pida actualizar."],
    [""],
    ["Nota: RIR = repeticiones en reserva (0 = fallo técnico, 1–3 = cerca del fallo)."],
  ];
  const wsInstr = wb.addWorksheet(SHEET_INFO);
  instr.forEach((row) => wsInstr.addRow(row));
  wsInstr.getColumn(1).width = 92;

  const kcal = numOrEmpty(planRoot.calorias_diarias);
  const kcalMant = numOrEmpty(planRoot.calorias_mantenimiento);
  const macros =
    planRoot.macros && typeof planRoot.macros === "object" ? (planRoot.macros as Record<string, unknown>) : null;
  const wsRes = wb.addWorksheet("Resumen");
  wsRes.addRow(["Cliente", clientName]);
  wsRes.addRow(["Calorías objetivo (kcal/día)", kcal]);
  wsRes.addRow(["Calorías mantenimiento TDEE (kcal/día)", kcalMant]);
  wsRes.addRow(["Proteínas", macros ? safeStr(macros.proteinas) : ""]);
  wsRes.addRow(["Grasas", macros ? safeStr(macros.grasas) : ""]);
  wsRes.addRow(["Carbohidratos", macros ? safeStr(macros.carbohidratos) : ""]);
  wsRes.getColumn(1).width = 28;
  wsRes.getColumn(2).width = 40;

  const weeklyPlan = Array.isArray(planRoot.plan_semanal) ? (planRoot.plan_semanal as Array<Record<string, unknown>>) : [];
  const wsNut = wb.addWorksheet(SHEET_NUTRITION);
  wsNut.addRow([
    "Dia",
    "Comida",
    "Hora",
    "Opcion_principal",
    "P_g_aprox",
    "G_g_aprox",
    "CHO_g_aprox",
    "Cumplimiento_CLIENTE",
    "Notas_CLIENTE",
  ]);
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
      wsNut.addRow([
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
  wsNut.getColumn(1).width = 12;
  wsNut.getColumn(2).width = 14;
  wsNut.getColumn(3).width = 8;
  wsNut.getColumn(4).width = 48;
  wsNut.getColumn(5).width = 10;
  wsNut.getColumn(6).width = 10;
  wsNut.getColumn(7).width = 12;
  wsNut.getColumn(8).width = 22;
  wsNut.getColumn(9).width = 28;

  const trainingPlan = resolveTrainingPlan(planRoot);
  const overrides: MediaOv =
    trainingPlan &&
    typeof trainingPlan.exercise_media_overrides === "object" &&
    !Array.isArray(trainingPlan.exercise_media_overrides)
      ? (trainingPlan.exercise_media_overrides as MediaOv)
      : {};

  const weeks = normalizeTrainingWeeksForExport(trainingPlan?.weeks);
  const uniqueNames = new Set<string>();
  weeks.forEach((week) => {
    getWeekDays(week).forEach((day) => {
      getDayExercises(day).forEach((ex) => {
        const n = exerciseName(ex).trim();
        if (n.length >= 2) uniqueNames.add(n);
      });
    });
  });

  const wgerMap = await resolveWgerExerciseMediaBatch([...uniqueNames], AbortSignal.timeout(45000));

  const fetchCache = new Map<string, Promise<Buffer | null>>();
  const getCachedPng = (url: string) => {
    let p = fetchCache.get(url);
    if (!p) {
      p = remoteImageToPngBuffer(url);
      fetchCache.set(url, p);
    }
    return p;
  };

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
  const wsTrain = wb.addWorksheet(SHEET_TRAINING);
  wsTrain.addRow(trainHeader);
  const headerRow = wsTrain.getRow(1);
  headerRow.font = { bold: true };

  let excelRow = 2;
  for (let wi = 0; wi < weeks.length; wi++) {
    const week = weeks[wi];
    const weekNum = typeof week.week === "number" && Number.isFinite(week.week) ? week.week : wi + 1;
    const days = getWeekDays(week);
    for (const day of days) {
      const dayName = safeStr(day.day ?? day.dia ?? day.name ?? "Día");
      const exercises = getDayExercises(day);
      for (let ei = 0; ei < exercises.length; ei++) {
        const ex = exercises[ei];
        const rpe = ex.rpe;
        const rpeNote =
          typeof rpe === "number"
            ? `RPE ${rpe}`
            : safeStr(ex.rpe || "") || (typeof ex.rpe === "number" ? String(ex.rpe) : "");
        const rest = ex.rest_seconds != null ? numOrEmpty(ex.rest_seconds) : "";
        const muscle = safeStr(ex.muscle_group ?? ex.musculo ?? ex.grupo_muscular ?? "");
        const nm = exerciseName(ex);
        const still = resolveStillForRow(nm, ex, overrides, wgerMap);
        const refText = still ? still.refLabel.slice(0, 200) : "";

        const png = still ? await getCachedPng(still.url) : null;

        wsTrain.addRow([
          weekNum,
          dayName,
          ei + 1,
          nm,
          refText,
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

        const row = wsTrain.getRow(excelRow);
        if (png) {
          try {
            row.height = 96;
            const imageId = wb.addImage({
              base64: png.toString("base64"),
              extension: "png",
            });
            wsTrain.addImage(imageId, {
              tl: { col: 4, row: excelRow - 1 + 0.12 },
              ext: { width: 128, height: 96 },
            });
          } catch {
            /* ignore bad embed */
          }
        }
        excelRow += 1;
      }
    }
  }

  const colWidths = [7, 12, 5, 36, 34, 11, 12, 14, 14, 22, 16, 18, 12, 36];
  colWidths.forEach((w, i) => {
    wsTrain.getColumn(i + 1).width = w;
  });

  const sups = Array.isArray(planRoot.suplementacion_recomendada)
    ? (planRoot.suplementacion_recomendada as Array<Record<string, unknown>>)
    : [];
  if (sups.length > 0) {
    const wsSup = wb.addWorksheet("Suplementacion");
    wsSup.addRow(["Nombre", "Dosis", "Momento", "Motivo", "Prioridad", "Notas_CLIENTE"]);
    sups.forEach((s) => {
      wsSup.addRow([safeStr(s.nombre), safeStr(s.dosis), safeStr(s.momento), safeStr(s.motivo), safeStr(s.prioridad), ""]);
    });
    wsSup.getColumn(1).width = 22;
    wsSup.getColumn(2).width = 14;
    wsSup.getColumn(3).width = 14;
    wsSup.getColumn(4).width = 36;
    wsSup.getColumn(5).width = 12;
    wsSup.getColumn(6).width = 24;
  }

  const cardio =
    planRoot.cardio_recomendado && typeof planRoot.cardio_recomendado === "object"
      ? (planRoot.cardio_recomendado as Record<string, unknown>)
      : null;
  if (cardio && Object.keys(cardio).length > 0) {
    const wsCardio = wb.addWorksheet("Cardio");
    wsCardio.addRow(["Campo", "Valor"]);
    wsCardio.addRow(["Detalle", safeStr(cardio.detalle)]);
    wsCardio.addRow(["Pasos diarios objetivo", safeStr(cardio.objetivo_pasos_diarios)]);
    wsCardio.addRow(["Sesiones/semana", safeStr(cardio.sesiones_por_semana)]);
    wsCardio.addRow(["Notas_CLIENTE", ""]);
    wsCardio.getColumn(1).width = 22;
    wsCardio.getColumn(2).width = 50;
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
