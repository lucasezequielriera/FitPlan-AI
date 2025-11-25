export type ActivityLevel = "sedentario" | "ligero" | "moderado" | "alto" | "atleta"; // Legacy, mantener para compatibilidad

export type Goal = "perder_grasa" | "mantener" | "ganar_masa" | "recomposicion" | "definicion" | "volumen" | "mantenimiento_avanzado" | "corte" | "rendimiento_deportivo" | "powerlifting" | "resistencia" | "atleta_elite" | "bulk_cut" | "lean_bulk";

export type Intensidad = "leve" | "moderada" | "intensa" | "ultra";

export type TipoDieta = "estandar" | "mediterranea" | "vegana" | "vegetariana" | "keto" | "paleo" | "low_carb" | "flexitariana" | "dash" | "pescatariana" | "atkins" | "sin_gluten" | "antiinflamatoria" | "mind" | "clinica_mayo" | "tlc" | "menopausia";

export interface UserInput {
  nombre: string;
  edad: number;
  pesoKg: number;
  pesoObjetivoKg?: number; // Peso objetivo para objetivos como bulk_cut o lean_bulk
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
  doloresLesiones?: string[]; // Molestias, dolores o lesiones que deben considerarse (especialmente para entrenamiento)
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
  rpe?: number; // RPE (Rate of Perceived Exertion) 1-10, opcional
  tempo?: string; // Tempo del movimiento (ej: "2-0-1-0" = 2s excéntrico, 0s pausa, 1s concéntrico, 0s pausa), opcional
  rest_seconds?: number; // Descanso entre series en segundos, opcional
  technique?: string; // Puntos clave de técnica para principiantes y avanzados, opcional
  progression?: string; // Cómo progresar este ejercicio (aumentar peso, reps, etc.), opcional
  alternative?: string; // Ejercicio alternativo si no se puede hacer este (por lesión o falta de equipo), opcional
  cues?: string[]; // Pistas mentales para ejecución correcta (ej: ["Mantén el core activo", "Empuja con los talones"]), opcional
}

export interface TrainingDayPlan {
  day: string; // "Lunes" ...
  split?: string; // Tipo de entrenamiento de este día: "Full Body", "Upper", "Lower", "Push", "Pull", "Legs", "Chest & Triceps", etc.
  warmup?: {
    duration_minutes: number; // Tiempo de calentamiento en minutos
    description: string; // Descripción detallada del calentamiento
  };
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

// ============================================
// SISTEMA DE PLAN MULTI-FASE (Bulk+Cut, etc.)
// ============================================

export interface Suplemento {
  nombre: string;
  dosis: string;
  momento: string; // "mañana", "pre-entreno", "post-entreno", "noche"
  motivo: string;
  prioridad: "esencial" | "recomendado" | "opcional";
  duracion?: string; // "todo el plan", "solo fase bulk", "primeros 2 meses"
}

export interface DatosInicioMes {
  peso: number;
  cintura?: number;
  fechaRegistro: string;
}

export interface DatosFinMes {
  peso: number;
  cintura?: number;
  energia: "muy_baja" | "baja" | "normal" | "alta" | "muy_alta";
  recuperacion: "mala" | "regular" | "normal" | "buena" | "excelente";
  adherenciaComida: "<50%" | "50-70%" | "70-80%" | ">80%";
  adherenciaEntreno: "<50%" | "50-70%" | "70-80%" | ">80%";
  lesionesNuevas?: string;
  comentarios?: string;
  fechaRegistro: string;
}

export interface HistorialMes {
  mesNumero: number;
  faseEnEsteMes: "BULK" | "CUT" | "LEAN_BULK" | "MANTENIMIENTO";
  fechaGeneracion: string;
  fechaFin?: string;
  
  datosAlIniciar: DatosInicioMes;
  datosAlFinalizar?: DatosFinMes;
  
  // Plan generado para este mes
  planAlimentacion: DiaPlan[];
  caloriasObjetivo: number;
  macros: Macros;
  planEntrenamiento?: TrainingPlan;
  suplementos: Suplemento[];
  
  // Ajustes que se aplicaron basados en el mes anterior
  ajustesAplicados?: string[];
  
  // Datos adicionales del plan
  dificultad?: "facil" | "media" | "dificil";
  mensajeMotivacional?: string;
}

export interface FaseMultiFase {
  nombre: "BULK" | "CUT" | "LEAN_BULK" | "MANTENIMIENTO";
  mesesIncluidos: number[]; // [1, 2, 3, 4, 5, 6] para BULK, [7, 8] para CUT
  pesoMeta: number;
  descripcion: string;
}

export interface PlanMultiFase {
  // Identificador único del plan
  id?: string;
  
  // Tipo de plan
  tipo: "bulk_cut" | "lean_bulk" | "simple"; // simple = plan normal de 1 mes
  
  // Estado del plan
  estado: "activo" | "completado" | "pausado" | "abandonado";
  
  // Fechas
  fechaInicio: string;
  fechaFinEstimada?: string;
  fechaFinReal?: string;
  
  // Datos iniciales del usuario
  datosIniciales: {
    pesoInicial: number;
    pesoObjetivoFinal: number;
    cinturaInicial?: number;
    alturaCm: number;
    edad: number;
    sexo: "masculino" | "femenino";
    intensidad: Intensidad;
    objetivo: Goal;
    tipoDieta?: TipoDieta;
    restricciones?: string[];
    preferencias?: string[];
    patologias?: string[];
    doloresLesiones?: string[];
    diasGym?: number;
    diasCardio?: number;
  };
  
  // Estructura de fases
  fases: FaseMultiFase[];
  totalMeses: number;
  
  // Progreso actual
  mesActual: number;
  faseActual: "BULK" | "CUT" | "LEAN_BULK" | "MANTENIMIENTO";
  
  // Suplementos recomendados para todo el plan
  suplementosBase: Suplemento[];
  
  // Historial de todos los meses generados
  historialMeses: HistorialMes[];
}

// Helper para obtener info de fase actual
export function obtenerInfoFaseActual(plan: PlanMultiFase): {
  fase: FaseMultiFase | undefined;
  mesEnFase: number;
  mesesRestantesFase: number;
  esPrimerMesFase: boolean;
  esUltimoMesFase: boolean;
} {
  const faseActual = plan.fases.find(f => f.mesesIncluidos.includes(plan.mesActual));
  if (!faseActual) {
    return {
      fase: undefined,
      mesEnFase: 0,
      mesesRestantesFase: 0,
      esPrimerMesFase: false,
      esUltimoMesFase: false,
    };
  }
  
  const indexEnFase = faseActual.mesesIncluidos.indexOf(plan.mesActual);
  return {
    fase: faseActual,
    mesEnFase: indexEnFase + 1,
    mesesRestantesFase: faseActual.mesesIncluidos.length - indexEnFase - 1,
    esPrimerMesFase: indexEnFase === 0,
    esUltimoMesFase: indexEnFase === faseActual.mesesIncluidos.length - 1,
  };
}

// Helper para calcular progreso total
export function calcularProgresoTotal(plan: PlanMultiFase): {
  porcentajeCompletado: number;
  pesoGanado: number;
  pesoPerdido: number;
  cambioNeto: number;
  mesesCompletados: number;
  adherenciaPromedio: number;
} {
  const mesesCompletados = plan.historialMeses.filter(m => m.datosAlFinalizar).length;
  const porcentajeCompletado = (mesesCompletados / plan.totalMeses) * 100;
  
  let pesoGanado = 0;
  let pesoPerdido = 0;
  
  plan.historialMeses.forEach((mes, idx) => {
    if (mes.datosAlFinalizar && mes.datosAlIniciar) {
      const cambio = mes.datosAlFinalizar.peso - mes.datosAlIniciar.peso;
      if (cambio > 0) pesoGanado += cambio;
      else pesoPerdido += Math.abs(cambio);
    }
  });
  
  const pesoActual = plan.historialMeses.length > 0 
    ? (plan.historialMeses[plan.historialMeses.length - 1].datosAlFinalizar?.peso 
       || plan.historialMeses[plan.historialMeses.length - 1].datosAlIniciar.peso)
    : plan.datosIniciales.pesoInicial;
  
  const cambioNeto = pesoActual - plan.datosIniciales.pesoInicial;
  
  // Calcular adherencia promedio
  const adherencias = plan.historialMeses
    .filter(m => m.datosAlFinalizar)
    .map(m => {
      const comida = m.datosAlFinalizar!.adherenciaComida;
      const entreno = m.datosAlFinalizar!.adherenciaEntreno;
      const mapAdherencia = (s: string) => {
        if (s === ">80%") return 85;
        if (s === "70-80%") return 75;
        if (s === "50-70%") return 60;
        return 40;
      };
      return (mapAdherencia(comida) + mapAdherencia(entreno)) / 2;
    });
  
  const adherenciaPromedio = adherencias.length > 0 
    ? adherencias.reduce((a, b) => a + b, 0) / adherencias.length 
    : 0;
  
  return {
    porcentajeCompletado,
    pesoGanado,
    pesoPerdido,
    cambioNeto,
    mesesCompletados,
    adherenciaPromedio,
  };
}

