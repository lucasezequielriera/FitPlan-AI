/**
 * Detección de contexto clínico de rodilla y saneo determinístico del plan de entreno
 * (refuerzo cuando el modelo ignora el prompt).
 */

const KNEE_HINT_RE =
  /rodilla|menisc|meniscus|lca|lc[aá]|ligamento cruzado|ligamento(s)?\s+de\s+la\s+rodilla|rótula|rotula|artroscop|operad(a|o)?\s+(de\s+la\s+)?rodilla|gonalgia|prótesis de rodilla|protesis de rodilla|cirug[aí]a.{0,24}rodilla|acl\b/i;

/** Patrones de ejercicio a sustituir si hay restricción de rodilla / sentadilla. */
const SQUAT_OR_LUNGE_NAME_RE =
  /sentadill|squat|sissy\s*squat|hack\s+squat|zancad|estocad|bulgar|split\s+squat|pistol|box\s*jump|burpee|salto(?:s)?\s+(?:al\s+)?caj|jump\s+squat|smith.{0,20}sentad/i;

export function blobSuggestsKneeCare(blob: string): boolean {
  return KNEE_HINT_RE.test(blob.toLowerCase());
}

export function shouldBlockSquatsAndLunges(opts: { textBlob: string; coachAvoidSquats: boolean }): boolean {
  if (opts.coachAvoidSquats) return true;
  return blobSuggestsKneeCare(opts.textBlob);
}

/** Resumen corto para la tabla admin (lista de clientes). */
export function formatIntakeClinicalHintForList(formData: Record<string, unknown> | null): string | null {
  if (!formData) return null;
  const parts: string[] = [];
  const add = (v: unknown) => {
    if (typeof v === "string" && v.trim()) parts.push(v.trim());
  };
  add(formData.lesionesDolores);
  add(formData.cirugiasPrevias);
  if (Array.isArray(formData.patologias)) {
    (formData.patologias as unknown[]).forEach((x) => add(x));
  }
  add(formData.textoLibreFinal);
  const s = parts.join(" · ").replace(/\s+/g, " ").trim();
  if (!s) return null;
  return s.length > 200 ? `${s.slice(0, 200)}…` : s;
}

export function sanitizeTrainingRepsValue(reps: string): string {
  let s = String(reps).trim();
  s = s.replace(/(\d+(?:[.,]\d+)?)\s*segundos?\s*reps/gi, "$1 s");
  s = s.replace(/(\d+(?:[.,]\d+)?)\s*minutos?\s*reps/gi, "$1 min");
  s = s.replace(/\s+reps\s*$/i, "");
  return s;
}

type ExerciseRow = Record<string, unknown>;

function isSquatLikeName(name: string): boolean {
  return SQUAT_OR_LUNGE_NAME_RE.test(name.trim());
}

/**
 * Recorre training_plan.weeks[].days[].ejercicios y corrige nombres/reps.
 * Devuelve cuántos ejercicios se sustituyeron.
 */
export function applyTrainingPlanPostProcess(
  plan: Record<string, unknown>,
  opts: { blockSquatsLunges: boolean }
): number {
  if (!opts.blockSquatsLunges) {
    sanitizeRepsOnly(plan);
    return 0;
  }

  const tp = plan.training_plan;
  if (!tp || typeof tp !== "object") {
    return 0;
  }
  const trainingPlan = tp as Record<string, unknown>;
  const weeks = trainingPlan.weeks;
  if (!Array.isArray(weeks)) {
    return 0;
  }

  let replaced = 0;
  for (const w of weeks) {
    if (!w || typeof w !== "object") continue;
    const days = (w as Record<string, unknown>).days;
    if (!Array.isArray(days)) continue;
    for (const d of days) {
      if (!d || typeof d !== "object") continue;
      const ejercicios = (d as Record<string, unknown>).ejercicios;
      if (!Array.isArray(ejercicios)) continue;
      for (const raw of ejercicios) {
        if (!raw || typeof raw !== "object") continue;
        const ex = raw as ExerciseRow;
        const name = typeof ex.name === "string" ? ex.name : "";
        if (name && isSquatLikeName(name)) {
          const prevAlt = typeof ex.alternative === "string" ? ex.alternative : "";
          ex.alternative = [
            `Sustitución automática por restricción de rodilla/sentadilla. Ejercicio original propuesto por IA: «${name}» (no realizar sin autorización médica/fisio).`,
            prevAlt,
          ]
            .filter(Boolean)
            .join(" ");
          ex.name = "Extensión de cuádriceps en máquina (ROM corto, controlado)";
          if (typeof ex.technique === "string" && ex.technique.trim()) {
            ex.technique = `Sin dolor en rodilla; no bloquear al final. ${ex.technique}`;
          } else {
            ex.technique = "Rodillo bajo el asiento, subir sin bloquear la rodilla al final; peso moderado.";
          }
          replaced += 1;
        }
        if (typeof ex.reps === "string") {
          ex.reps = sanitizeTrainingRepsValue(ex.reps);
        }
      }
    }
  }

  if (replaced > 0) {
    const prev = Array.isArray(trainingPlan.safety_notes)
      ? (trainingPlan.safety_notes as unknown[]).map((v) => String(v))
      : [];
    const line = `Ajuste automático del sistema: se sustituyeron ${replaced} ejercicio(s) tipo sentadilla/zancada/salto por restricción declarada (rodilla o indicación del coach).`;
    trainingPlan.safety_notes = Array.from(new Set([line, ...prev]));
  } else {
    sanitizeRepsOnly(plan);
  }

  return replaced;
}

function sanitizeRepsOnly(plan: Record<string, unknown>) {
  const tp = plan.training_plan;
  if (!tp || typeof tp !== "object") return;
  const weeks = (tp as Record<string, unknown>).weeks;
  if (!Array.isArray(weeks)) return;
  for (const w of weeks) {
    if (!w || typeof w !== "object") continue;
    const days = (w as Record<string, unknown>).days;
    if (!Array.isArray(days)) continue;
    for (const d of days) {
      if (!d || typeof d !== "object") continue;
      const ejercicios = (d as Record<string, unknown>).ejercicios;
      if (!Array.isArray(ejercicios)) continue;
      for (const raw of ejercicios) {
        if (!raw || typeof raw !== "object") continue;
        const ex = raw as ExerciseRow;
        if (typeof ex.reps === "string") {
          ex.reps = sanitizeTrainingRepsValue(ex.reps);
        }
      }
    }
  }
}

const HERNIA_HINT_RE = /hernia.{0,10}disco|hernia discal/i;
const LUMBAR_HINT_RE = /lumbar|espalda baja/i;
const SHOULDER_HINT_RE = /hombro|manguito/i;

const PROHIBITED_HERNIA = [
  "remo con barra", "bent-over row", "barbell row", "t-bar row", "row con barra",
  "peso muerto", "deadlift", "rdl", "peso muerto rumano",
  "sentadilla", "squat", "sentadillas profundas",
  "good morning", "good mornings",
  "hiperextensión", "hiperextension", "back extension", "hiperextensiones",
  "crunch", "russian twist",
  "overhead press", "press militar", "press overhead",
  "sentadilla frontal", "front squat",
  "leg press profundo", "hack squat profundo",
  "burpee", "jumping jack", "saltos",
];
const PROHIBITED_LUMBAR = [
  "peso muerto", "deadlift", "rdl",
  "sentadilla profunda", "squat profundo",
  "good morning",
];
const PROHIBITED_KNEE = [
  "sentadilla", "squat", "sentadilla frontal", "front squat",
  "sissy squat", "hack squat", "smith squat",
  "zancada", "lunge", "estocada", "split squat", "bulgar", "pistol squat",
  "salto al cajón", "salto al cajon", "box jump", "jump squat", "saltos", "burpee",
];
const PROHIBITED_SHOULDER = [
  "press militar", "overhead press", "press overhead", "press tras nuca", "behind the neck",
  "upright row", "remo al mentón", "remo al menton",
  "elevaciones laterales pesadas", "fondos en paralelas", "dips en paralelas",
];

/**
 * Filtra ejercicios inseguros según las lesiones/dolores reportados por el
 * usuario. A diferencia de `applyTrainingPlanPostProcess` (que solo cubre
 * rodilla y opera sobre la estructura completa de un training_plan con
 * semanas/días), esta función trabaja sobre una lista plana de ejercicios
 * `{ name, ... }` y cubre hernia/lumbar/rodilla/hombro — pensada para
 * reutilizarse en cualquier generador de planes (IA o plantillas estáticas)
 * que produzca ese shape.
 */
export function filterUnsafeExercisesByDoloresLesiones<T extends { name?: unknown }>(
  ejercicios: T[],
  doloresLesiones: string[] | undefined
): T[] {
  if (!doloresLesiones || doloresLesiones.length === 0) return ejercicios;
  const blob = doloresLesiones.join(" | ").toLowerCase();
  const tieneHernia = HERNIA_HINT_RE.test(blob);
  const tieneLumbar = LUMBAR_HINT_RE.test(blob);
  const tieneRodilla = blobSuggestsKneeCare(blob);
  const tieneHombro = SHOULDER_HINT_RE.test(blob);

  if (!tieneHernia && !tieneLumbar && !tieneRodilla && !tieneHombro) return ejercicios;

  const prohibidos = new Set<string>();
  if (tieneHernia) PROHIBITED_HERNIA.forEach((p) => prohibidos.add(p));
  if (tieneLumbar) PROHIBITED_LUMBAR.forEach((p) => prohibidos.add(p));
  if (tieneRodilla) PROHIBITED_KNEE.forEach((p) => prohibidos.add(p));
  if (tieneHombro) PROHIBITED_SHOULDER.forEach((p) => prohibidos.add(p));

  return ejercicios.filter((ej) => {
    const nombreLower = String(ej.name || "").toLowerCase();
    return !Array.from(prohibidos).some((p) => nombreLower.includes(p));
  });
}

/** Texto concatenado para decidir bloqueo (formulario + input normalizado + notas coach). */
export function buildTrainingConstraintBlob(
  formData: Record<string, unknown>,
  doloresLesiones: string[] | undefined,
  coachBrief: string
): string {
  const parts: string[] = [];
  const add = (v: unknown) => {
    if (typeof v === "string" && v.trim()) parts.push(v.trim());
    if (Array.isArray(v)) v.forEach((x) => typeof x === "string" && x.trim() && parts.push(x.trim()));
  };
  if (doloresLesiones) parts.push(...doloresLesiones);
  add(formData.lesionesDolores);
  add(formData.cirugiasPrevias);
  add(formData.textoLibreFinal);
  add(formData.patologias);
  if (coachBrief.trim()) parts.push(coachBrief.trim());
  return parts.join(" | ").toLowerCase();
}
