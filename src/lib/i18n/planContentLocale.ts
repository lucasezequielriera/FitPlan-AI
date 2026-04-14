import type { AppLocale } from "@/contexts/AppLocaleContext";

const DIA: Record<string, string> = {
  Lunes: "Monday",
  Martes: "Tuesday",
  Miércoles: "Wednesday",
  Jueves: "Thursday",
  Viernes: "Friday",
  Sábado: "Saturday",
  Domingo: "Sunday",
};

const COMIDA: Record<string, string> = {
  Desayuno: "Breakfast",
  Almuerzo: "Lunch",
  Cena: "Dinner",
  "Merienda 1": "Snack 1",
  "Merienda 2": "Snack 2",
  Snack: "Snack",
};

const MUSCLE: Record<string, string> = {
  Pecho: "Chest",
  Espalda: "Back",
  Piernas: "Legs",
  Hombros: "Shoulders",
  Bíceps: "Biceps",
  Tríceps: "Triceps",
  Abdominales: "Abs",
  Cardio: "Cardio",
  Gemelos: "Calves",
  Cuádriceps: "Quads",
  Isquiotibiales: "Hamstrings",
  Glúteos: "Glutes",
  Trapecio: "Traps",
  General: "General",
};

/** Translate stored plan day label for display when UI is EN */
export function translatePlanDayLabel(dia: string, locale: AppLocale): string {
  if (locale === "es" || !dia) return dia;
  return DIA[dia] || dia.replace(/^Día\s+/i, "Day ");
}

/** Translate meal slot name when UI is EN */
export function translateMealSlotName(nombre: string, locale: AppLocale): string {
  if (locale === "es" || !nombre) return nombre;
  return COMIDA[nombre] || nombre;
}

/** Translate muscle group label for display */
export function translateMuscleGroup(muscle: string, locale: AppLocale): string {
  if (locale === "es" || !muscle) return muscle;
  return MUSCLE[muscle] || muscle;
}
