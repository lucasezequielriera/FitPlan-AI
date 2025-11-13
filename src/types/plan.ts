export type ActivityLevel = "sedentario" | "ligero" | "moderado" | "alto" | "atleta"; // Legacy, mantener para compatibilidad

export type Goal = "perder_grasa" | "mantener" | "ganar_masa" | "recomposicion" | "definicion" | "volumen" | "mantenimiento_avanzado" | "corte";

export type Intensidad = "leve" | "moderada" | "intensa";

export type TipoDieta = "estandar" | "mediterranea" | "vegana" | "vegetariana" | "keto" | "paleo" | "low_carb" | "flexitariana" | "dash" | "pescatariana" | "atkins" | "sin_gluten" | "antiinflamatoria" | "mind" | "clinica_mayo" | "tlc" | "menopausia";

export interface UserInput {
  nombre: string;
  edad: number;
  pesoKg: number;
  alturaCm: number;
  sexo: "masculino" | "femenino";
  actividad: ActivityLevel | number; // number = días de actividad física por semana (0-7) - Legacy, mantener para compatibilidad
  diasGym?: number; // días de entrenamiento con pesas por semana (0-7)
  diasCardio?: number; // días de cardio por semana (0-7)
  objetivo: Goal;
  intensidad: Intensidad;
  tipoDieta?: TipoDieta;
  restricciones?: string[];
  preferencias?: string[];
  patologias?: string[]; // Condiciones médicas relevantes para la nutrición
  // Preferencia de variabilidad de comidas
  preferirRutina?: boolean; // true = poca variación entre días (comidas rutinarias)
  duracionDias?: number; // Siempre 30 días (mensual), se establece automáticamente
  // Opcionales para estimaciones más precisas
  cinturaCm?: number;
  cuelloCm?: number;
  caderaCm?: number; // principalmente para femenino
  atletico?: boolean;
}

export interface Macros {
  proteinas: string; // e.g., "150g"
  grasas: string;
  carbohidratos: string;
}

export interface Comida {
  hora: string; // "08:00"
  nombre: string; // "Desayuno", "Almuerzo", "Snack", "Cena"
  opciones: string[];
  // Enriquecido por IA (opcionales)
  calorias_kcal?: number;
  cantidad_gramos?: number;
  ingredientes?: string[];
  pasos_preparacion?: string[];
}

export interface DiaPlan {
  dia: string; // "Lunes" ...
  comidas: Comida[];
}

export interface PlanAIResponse {
  calorias_diarias: number;
  macros: Macros;
  plan_semanal: DiaPlan[];
  duracion_plan_dias: number;
  mensaje_motivacional: string;
  minutos_sesion_gym?: number;
  // Dificultad global del plan
  dificultad?: "facil" | "media" | "dificil";
  dificultad_detalle?: string;
  // Cambios esperados por semana y fisiológicos
  cambios_semanales?: {
    semana1?: string;
    semana2?: string;
    semana3_4?: string;
    post_mes?: string;
    fisiologia?: string[];
  };
  // Plan de entrenamiento generado por IA
  training_plan?: TrainingPlan;
  // Extras (opcionales) generados por IA
  lista_compras?: string[];
  progresion_semanal?: { semana: number; ajuste_calorias_pct: number; motivo?: string }[];
  distribucion_diaria_pct?: { desayuno: number; almuerzo: number; cena: number; snacks: number };
  // Proyecciones y resultados esperados generados por IA
  proyecciones?: {
    musculoGananciaMensual?: string; // e.g., "1.5-2.5 kg" (solo si objetivo es ganar masa/volumen/recomposicion)
    grasaPerdidaMensual?: string; // e.g., "1-2 kg" (solo si objetivo es perder grasa/corte)
    proyecciones: string[]; // Lista de proyecciones específicas y personalizadas
    tiempoEstimado: string; // e.g., "1-3 meses para ver resultados notables"
  };
}

export interface TrainingExercise {
  name: string;
  sets: number;
  reps: string | number;
  muscle_group: string; // Músculo o grupo muscular principal trabajado (OBLIGATORIO)
  url?: string; // URL del video o tutorial (opcional, puede no estar)
}

export interface TrainingDayPlan {
  day: string; // "Lunes" ...
  split?: string; // Tipo de entrenamiento de este día: "Full Body", "Upper", "Lower", "Push", "Pull", "Legs", "Chest & Triceps", etc.
  ejercicios: TrainingExercise[]; // Lista simple de ejercicios (5-8 ejercicios)
}

export interface TrainingWeekPlan {
  week: number; // 1..4
  days: TrainingDayPlan[];
}

export interface TrainingPlan {
  split?: string; // Tipo de división de entrenamiento: "Full Body", "Upper/Lower", "Push/Pull/Legs", "Bro Split", etc.
  weeks: TrainingWeekPlan[];
  progression_rules?: string[];
  equipment_variants?: string[];
  safety_notes?: string[];
  sync_with_nutrition?: string[];
}

