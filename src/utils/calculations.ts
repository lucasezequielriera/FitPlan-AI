import { Goal, UserInput } from "@/types/plan";

const activityMultiplier: Record<string, number> = {
  sedentario: 1.2,
  ligero: 1.375,
  moderado: 1.55,
  alto: 1.725,
  atleta: 1.9,
};

export function calculateBMR(weightKg: number, heightCm: number, age: number, sex: "masculino" | "femenino"): number {
  const s = sex === "masculino" ? 5 : -161;
  return Math.round(10 * weightKg + 6.25 * heightCm - 5 * age + s);
}

export function calculateTDEE(
  bmr: number, 
  actividad: UserInput["actividad"],
  diasGym?: number,
  diasCardio?: number
): number {
  let mult = 1.2; // default sedentario
  
  // Si hay datos de gym y cardio, calcular basándose en eso (más preciso)
  if (diasGym !== undefined || diasCardio !== undefined) {
    const totalDias = (diasGym || 0) + (diasCardio || 0);
    // Cada día de actividad suma aproximadamente 0.1 al multiplicador base
    // Gym tiene más impacto que cardio
    const gymMultiplier = (diasGym || 0) * 0.12;
    const cardioMultiplier = (diasCardio || 0) * 0.08;
    mult = 1.2 + gymMultiplier + cardioMultiplier;
    // Limitar entre 1.2 y 1.9
    mult = Math.max(1.2, Math.min(1.9, mult));
  } else if (typeof actividad === "number") {
    // Convertir días/semana a multiplicador aproximado (legacy)
    // 0 días = 1.2 (sedentario)
    // 1-2 días = 1.375 (ligero)
    // 3-4 días = 1.55 (moderado)
    // 5-6 días = 1.725 (alto)
    // 7 días = 1.9 (atleta)
    if (actividad === 0) mult = 1.2;
    else if (actividad <= 2) mult = 1.375;
    else if (actividad <= 4) mult = 1.55;
    else if (actividad <= 6) mult = 1.725;
    else mult = 1.9;
  } else {
    mult = activityMultiplier[actividad] ?? 1.2;
  }
  return Math.round(bmr * mult);
}

export function applyGoalCalories(tdee: number, objetivo: Goal): number {
  if (objetivo === "perder_grasa") return Math.round(tdee * 0.8);
  if (objetivo === "ganar_masa") return Math.round(tdee * 1.15);
  return tdee;
}

export function splitMacros(calorias: number, weightKg: number, objetivo: Goal) {
  const proteinPerKg = objetivo === "ganar_masa" ? 2.0 : 1.8; // g/kg
  const proteinasG = Math.round(proteinPerKg * weightKg);
  const kcalFromProtein = proteinasG * 4;

  const grasasG = Math.round((0.28 * calorias) / 9);
  const kcalFromFat = grasasG * 9;

  const remainingKcal = Math.max(calorias - (kcalFromProtein + kcalFromFat), 0);
  const carbsG = Math.round(remainingKcal / 4);

  return {
    proteinas: `${proteinasG}g`,
    grasas: `${grasasG}g`,
    carbohidratos: `${carbsG}g`,
  };
}

export function calculateBMI(weightKg: number, heightCm: number): number {
  const h = heightCm / 100;
  if (h <= 0) return 0;
  return Number((weightKg / (h * h)).toFixed(1));
}

export function bmiCategory(bmi: number): "bajo_peso" | "saludable" | "sobrepeso" | "obesidad" {
  if (bmi < 18.5) return "bajo_peso";
  if (bmi < 25) return "saludable";
  if (bmi < 30) return "sobrepeso";
  return "obesidad";
}

export function calculateBodyFatUSNavy(
  sex: "masculino" | "femenino",
  heightCm?: number,
  neckCm?: number,
  waistCm?: number,
  hipCm?: number
): number | null {
  if (!heightCm || !neckCm || !waistCm) return null;
  const heightIn = heightCm / 2.54;
  const neckIn = neckCm / 2.54;
  const waistIn = waistCm / 2.54;
  if (sex === "masculino") {
    const v = 86.010 * Math.log10(waistIn - neckIn) - 70.041 * Math.log10(heightIn) + 36.76;
    if (!isFinite(v)) return null;
    return Number(v.toFixed(1));
  }
  const hipIn = (hipCm ?? 0) / 2.54;
  if (!hipCm) return null;
  const v = 163.205 * Math.log10(waistIn + hipIn - neckIn) - 97.684 * Math.log10(heightIn) - 78.387;
  if (!isFinite(v)) return null;
  return Number(v.toFixed(1));
}

export function bodyFatCategory(
  sex: "masculino" | "femenino",
  bf?: number | null,
  athletic?: boolean
): "muy_bajo" | "atletico" | "fitness" | "promedio" | "alto" | null {
  if (bf == null) return null;
  // Rangos aproximados
  const ranges =
    sex === "masculino"
      ? [
          { max: 6, label: "muy_bajo" },
          { max: 13, label: "atletico" },
          { max: 17, label: "fitness" },
          { max: 24, label: "promedio" },
          { max: 100, label: "alto" },
        ]
      : [
          { max: 14, label: "muy_bajo" },
          { max: 20, label: "atletico" },
          { max: 24, label: "fitness" },
          { max: 31, label: "promedio" },
          { max: 100, label: "alto" },
        ];
  const hit = ranges.find((r) => bf <= r.max)!.label as any;
  if (athletic && hit === "promedio" && bf <= (sex === "masculino" ? 20 : 27)) return "fitness";
  return hit;
}

export function waistToHeightRatio(waistCm?: number, heightCm?: number): number | null {
  if (!waistCm || !heightCm) return null;
  return Number((waistCm / heightCm).toFixed(2));
}

export function whtrCategory(value?: number | null): "saludable" | "precaucion" | "alto_riesgo" | null {
  if (value == null) return null;
  if (value < 0.5) return "saludable";
  if (value < 0.6) return "precaucion";
  return "alto_riesgo";
}

// Obtener tiempo objetivo según intensidad
export function getTiempoObjetivo(intensidad: "leve" | "moderada" | "intensa" | "ultra"): string {
  if (intensidad === "ultra") return "1-2 meses";
  if (intensidad === "intensa") return "1-3 meses";
  if (intensidad === "moderada") return "3 meses";
  return "3-5 meses";
}

// Sugerencias inteligentes de entrenamiento basadas en datos del usuario
export function sugerirEntrenamiento(
  objetivo: Goal,
  intensidad: "leve" | "moderada" | "intensa" | "ultra",
  edad: number,
  bmi: number,
  atletico?: boolean
): { diasGym: number; minutosCaminata: number; horasSueno: number; descripcion: string } {
  // Base según objetivo
  let baseGym = getSugerenciasEntrenamiento(objetivo).gym;
  let baseCardio = getSugerenciasEntrenamiento(objetivo).cardio;
  
  // Ajustar según intensidad para lograr tiempo objetivo
  // Ultra (1-2 meses): máximo rendimiento para atletas comprometidos
  // Intensa (1-3 meses): más entrenamiento para resultados rápidos
  // Moderada (3 meses): entrenamiento equilibrado
  // Leve (3-5 meses): entrenamiento más conservador pero sostenible
  if (intensidad === "ultra") {
    // ULTRA: Máximo rendimiento para atletas
    baseGym = Math.min(7, baseGym + 2); // Hasta 7 días posibles
    baseCardio = Math.min(6, baseCardio + 2);
  } else if (intensidad === "intensa") {
    baseGym = Math.min(6, baseGym + 1);
    baseCardio = Math.min(5, baseCardio + 1);
  } else if (intensidad === "leve") {
    baseGym = Math.max(2, baseGym - 1);
    baseCardio = Math.max(2, baseCardio - 1);
  }
  // Moderada se mantiene en los valores base
  
  // Ajustar según edad (principiantes o avanzados)
  if (edad < 25 && !atletico) {
    // Joven pero no atlético, empezar más suave
    baseGym = Math.max(2, baseGym - 1);
  } else if (atletico) {
    // Atlético, puede hacer más
    baseGym = Math.min(6, baseGym + 1);
  }
  
  // Ajustar según BMI
  if (bmi > 30) {
    // Obesidad, más cardio para pérdida de peso
    baseCardio = Math.min(5, baseCardio + 1);
    baseGym = Math.max(2, baseGym); // Mantener gym para preservar músculo
  } else if (bmi < 20 && objetivo === "ganar_masa") {
    // Bajo peso y quiere ganar, más gym
    baseGym = Math.min(6, baseGym + 1);
    baseCardio = Math.max(1, baseCardio - 1);
  }
  
  // Convertir días de cardio a minutos diarios de caminata sugeridos
  // Ajustar según intensidad para lograr tiempo objetivo
  let minutosCaminata = baseCardio <= 2 ? 30 : baseCardio <= 4 ? 45 : 60;
  
  // Ajustar según intensidad para resultados en el tiempo objetivo
  if (intensidad === "ultra") {
    // ULTRA: Máxima actividad para atletas
    minutosCaminata = Math.min(90, minutosCaminata + 30);
  } else if (intensidad === "intensa") {
    // Más caminata para resultados rápidos
    minutosCaminata = Math.min(60, minutosCaminata + 15);
  } else if (intensidad === "leve") {
    // Menos caminata para progresión gradual
    minutosCaminata = Math.max(20, minutosCaminata - 10);
  }
  
  // Si objetivo es perder grasa, aumentar caminata adicional
  if (objetivo === "perder_grasa" || objetivo === "corte") {
    minutosCaminata = Math.min(60, minutosCaminata + (intensidad === "intensa" ? 10 : 5));
  }
  
  // Calcular horas de sueño recomendadas
  let horasSueno = 7; // Base para adulto promedio
  
  // Ajustar según edad (jóvenes necesitan más)
  if (edad < 25) {
    horasSueno = 8;
  } else if (edad < 30) {
    horasSueno = 7.5;
  } else {
    horasSueno = 7;
  }
  
  // Ajustar según intensidad de entrenamiento (intensa necesita más recuperación)
  if (intensidad === "intensa") {
    horasSueno += 0.5; // Más recuperación necesaria para resultados rápidos
  } else if (intensidad === "leve") {
    horasSueno = Math.max(7, horasSueno - 0.5); // Menos recuperación necesaria
  }
  // Moderada se mantiene en valores estándar
  
  // Ajustar según objetivo (ganar masa necesita más recuperación)
  if (objetivo === "ganar_masa" || objetivo === "volumen" || objetivo === "recomposicion") {
    horasSueno += 0.5; // Más tiempo para síntesis de proteínas y crecimiento
  }
  
  // Atletas necesitan más sueño para recuperación óptima
  if (atletico || baseGym >= 5) {
    horasSueno += 0.5;
  }
  
  // Limitar entre 7 y 10 horas
  horasSueno = Math.max(7, Math.min(10, horasSueno));
  // Redondear a 0.5
  horasSueno = Math.round(horasSueno * 2) / 2;
  
  let descripcion = "";
  if (objetivo === "perder_grasa" || objetivo === "corte") {
    descripcion = "Enfoque en quema de grasa: entrenamiento de fuerza para mantener músculo y caminata para acelerar el déficit calórico.";
  } else if (objetivo === "ganar_masa" || objetivo === "volumen") {
    descripcion = "Priorizar crecimiento muscular con entrenamiento de fuerza. Cardio mínimo para no interferir con la recuperación y ganancia.";
  } else if (objetivo === "recomposicion") {
    descripcion = "Balance entre construcción muscular y quema de grasa. Entrenamiento de fuerza regular con cardio moderado.";
  } else {
    descripcion = "Mantenimiento de condición física y salud general con entrenamiento equilibrado.";
  }
  
  return {
    diasGym: baseGym,
    minutosCaminata,
    horasSueno,
    descripcion
  };
}

function getSugerenciasEntrenamiento(objetivo: Goal): { gym: number; cardio: number } {
  switch (objetivo) {
    case "perder_grasa":
      return { gym: 3, cardio: 3 };
    case "ganar_masa":
      return { gym: 4, cardio: 1 };
    case "mantener":
      return { gym: 3, cardio: 2 };
    case "recomposicion":
      return { gym: 4, cardio: 2 };
    case "definicion":
      return { gym: 5, cardio: 3 };
    case "volumen":
      return { gym: 5, cardio: 1 };
    case "corte":
      return { gym: 4, cardio: 4 };
    case "mantenimiento_avanzado":
      return { gym: 4, cardio: 2 };
    default:
      return { gym: 3, cardio: 2 };
  }
}

// Proyecciones motivacionales basadas en datos del usuario
export function calcularProyeccionesMotivacionales(
  objetivo: Goal,
  intensidad: "leve" | "moderada" | "intensa" | "ultra",
  edad: number,
  sexo: "masculino" | "femenino",
  bmi: number,
  atletico?: boolean,
  diasGym?: number
): { 
  musculoGananciaMensual?: string; 
  grasaPerdidaMensual?: string;
  proyecciones: string[];
  tiempoEstimado: string;
} {
  const proyecciones: string[] = [];
  let musculoGanancia: string | undefined = "0.5-1 kg";
  let grasaPerdida: string | undefined;
  let tiempoEstimado = "3-6 meses";
  
  // Determinar nivel de experiencia (aproximado)
  const esPrincipiante = !atletico && (typeof diasGym === "undefined" || diasGym === 0);
  const esIntermedio = !esPrincipiante && !atletico;
  const esAvanzado = atletico || (diasGym !== undefined && diasGym >= 5);
  
  // Tiempos objetivo según intensidad (aplicable a todos los objetivos)
  const tiempoObjetivo = getTiempoObjetivo(intensidad);
  
  if (objetivo === "ganar_masa" || objetivo === "volumen" || objetivo === "powerlifting") {
    // Ganancia de músculo - primero según nivel, luego ajustar por intensidad
    if (esPrincipiante) {
      if (intensidad === "ultra") {
        musculoGanancia = sexo === "masculino" ? "2-3 kg" : "1-1.5 kg";
        proyecciones.push("🔥 ULTRA: Como principiante con máxima intensidad, podés ganar músculo extremadamente rápido (efecto novato + protocolo élite)");
      } else if (intensidad === "intensa") {
        musculoGanancia = sexo === "masculino" ? "1.5-2.5 kg" : "0.75-1.25 kg";
        proyecciones.push("Como principiante con alta intensidad, podés ganar músculo muy rápido (efecto novato maximizado)");
      } else if (intensidad === "moderada") {
        musculoGanancia = sexo === "masculino" ? "1-2 kg" : "0.5-1 kg";
        proyecciones.push("Como principiante, podés ganar músculo más rápido (efecto novato)");
      } else {
        musculoGanancia = sexo === "masculino" ? "0.75-1.5 kg" : "0.4-0.75 kg";
        proyecciones.push("Como principiante con progresión gradual, ganancia sostenible a largo plazo");
      }
    } else if (esIntermedio) {
      if (intensidad === "ultra") {
        musculoGanancia = sexo === "masculino" ? "1-1.5 kg" : "0.5-0.8 kg";
        proyecciones.push("🔥 ULTRA: Máximo protocolo de hipertrofia con entrenamiento de élite");
      } else if (intensidad === "intensa") {
        musculoGanancia = sexo === "masculino" ? "0.75-1.25 kg" : "0.4-0.7 kg";
        proyecciones.push("Con alta intensidad y disciplina, maximizás tu potencial de crecimiento");
      } else if (intensidad === "moderada") {
        musculoGanancia = sexo === "masculino" ? "0.5-1 kg" : "0.25-0.5 kg";
        proyecciones.push("Ganancia de músculo constante y sostenible");
      } else {
        musculoGanancia = sexo === "masculino" ? "0.4-0.8 kg" : "0.2-0.4 kg";
        proyecciones.push("Progresión gradual y sostenible, ideal para mantener a largo plazo");
      }
    } else {
      if (intensidad === "ultra") {
        musculoGanancia = sexo === "masculino" ? "0.6-1 kg" : "0.3-0.5 kg";
        proyecciones.push("🔥 ULTRA: Protocolo de atleta élite, cada décima de músculo optimizada");
      } else if (intensidad === "intensa") {
        musculoGanancia = sexo === "masculino" ? "0.4-0.7 kg" : "0.2-0.4 kg";
        proyecciones.push("Ganancia refinada con alta intensidad, cada gramo cuenta");
      } else if (intensidad === "moderada") {
        musculoGanancia = sexo === "masculino" ? "0.25-0.5 kg" : "0.15-0.3 kg";
        proyecciones.push("Ganancia refinada, cada gramo de músculo es valioso");
      } else {
        musculoGanancia = sexo === "masculino" ? "0.2-0.4 kg" : "0.1-0.25 kg";
        proyecciones.push("Progresión muy gradual, enfocada en sostenibilidad y salud");
      }
    }
    tiempoEstimado = `${tiempoObjetivo} para ver resultados notables`;
    proyecciones.push(intensidad === "ultra" ? "Aumento de fuerza: +10-15% en levantamientos principales por mes" : "Aumento de fuerza: +5-10% en levantamientos principales por mes");
    proyecciones.push("Mejora en composición corporal: reducción de % de grasa mientras ganás masa");
    
  } else if (objetivo === "perder_grasa" || objetivo === "corte") {
    // Pérdida de grasa
    musculoGanancia = undefined; // No mostrar ganancia de músculo para este objetivo
    grasaPerdida = intensidad === "ultra" ? "2-3 kg" : intensidad === "intensa" ? "1-2 kg" : intensidad === "moderada" ? "0.5-1 kg" : "0.3-0.7 kg";
    proyecciones.push("Preservación de masa muscular gracias al entrenamiento de fuerza");
    
    if (bmi > 30) {
      proyecciones.push("Los primeros meses podés perder más peso (agua y grasa)");
      tiempoEstimado = `${tiempoObjetivo} para alcanzar peso saludable`;
    } else if (bmi > 25) {
      tiempoEstimado = `${tiempoObjetivo} para cambios visibles`;
      proyecciones.push("Mejora notable en definición muscular y energía");
    } else {
      tiempoEstimado = `${tiempoObjetivo} para definición visible`;
      proyecciones.push("Enfoque en definición y preservación de músculo ganado");
    }
    
    proyecciones.push("Reducción de circunferencia de cintura: ~2-4 cm por mes");
    
  } else if (objetivo === "recomposicion") {
    if (intensidad === "ultra") {
      musculoGanancia = sexo === "masculino" ? "0.6-1 kg" : "0.35-0.6 kg";
      proyecciones.push(`Ganancia de músculo: ${musculoGanancia} por mes`);
      proyecciones.push("🔥 ULTRA: Transformación acelerada con protocolo élite");
    } else if (intensidad === "intensa") {
      musculoGanancia = sexo === "masculino" ? "0.4-0.8 kg" : "0.25-0.5 kg";
      proyecciones.push(`Ganancia de músculo: ${musculoGanancia} por mes`);
      proyecciones.push("Con alta intensidad, transformación más rápida");
    } else if (intensidad === "moderada") {
      musculoGanancia = sexo === "masculino" ? "0.3-0.7 kg" : "0.2-0.4 kg";
      proyecciones.push(`Ganancia de músculo: ${musculoGanancia} por mes`);
    } else {
      musculoGanancia = sexo === "masculino" ? "0.2-0.5 kg" : "0.15-0.3 kg";
      proyecciones.push(`Ganancia de músculo: ${musculoGanancia} por mes`);
      proyecciones.push("Progresión gradual, ideal para mantener a largo plazo");
    }
    tiempoEstimado = `${tiempoObjetivo} para transformación completa`;
    proyecciones.push("Pérdida simultánea de grasa mientras ganás músculo");
    proyecciones.push("Mejora en composición corporal sin cambios drásticos de peso");
    
  } else if (objetivo === "definicion") {
    // Pérdida de grasa para definición (más gradual que perder_grasa para preservar músculo)
    musculoGanancia = undefined; // No mostrar ganancia de músculo para este objetivo
    grasaPerdida = intensidad === "ultra" ? "1.5-2 kg" : intensidad === "intensa" ? "0.8-1.5 kg" : intensidad === "moderada" ? "0.5-1 kg" : "0.3-0.6 kg";
    proyecciones.push("Mantenimiento de masa muscular mientras reducís grasa");
    proyecciones.push("Definición muscular visible: abs y músculos más marcados");
    proyecciones.push("Reducción de % de grasa corporal: 1-2% por mes");
    
    if (bmi > 25) {
      tiempoEstimado = `${tiempoObjetivo} para definición visible`;
      proyecciones.push("Mejora notable en definición muscular y energía");
    } else {
      tiempoEstimado = `${tiempoObjetivo} para definición óptima`;
      proyecciones.push("Enfoque en definición extrema preservando músculo ganado");
    }
    
    proyecciones.push("Reducción de circunferencia de cintura: ~1-3 cm por mes");
    
  } else {
    // Mantener
    proyecciones.push("Mantenimiento de masa muscular y fuerza actual");
    proyecciones.push("Prevención de pérdida de músculo relacionada con la edad");
    proyecciones.push("Mejora continua en técnica y rendimiento");
    tiempoEstimado = "Mantenimiento constante";
  }
  
  // Proyecciones adicionales según edad
  if (edad < 30) {
    proyecciones.push("Recuperación rápida: aprovechá tu juventud para mejores resultados");
  } else if (edad >= 40) {
    proyecciones.push("Enfoque en mantenimiento muscular y salud a largo plazo");
  }
  
  // Proyecciones según sexo
  if (sexo === "femenino") {
    proyecciones.push("Mejora en fuerza y tonificación sin volumen excesivo");
  }
  
  return {
    ...(musculoGanancia && { musculoGananciaMensual: musculoGanancia }),
    ...(grasaPerdida && { grasaPerdidaMensual: grasaPerdida }),
    proyecciones,
    tiempoEstimado
  };
}

// Analizar pros y contras de cambiar valores de entrenamiento
export function analizarCambiosEntrenamiento(
  objetivo: Goal,
  diasGymSugerido: number,
  diasGymEditado: number,
  minutosCaminataSugerido: number,
  minutosCaminataEditado: number,
  horasSuenoSugerido: number,
  horasSuenoEditado: number,
  minutosSesionGymSugerido?: number,
  minutosSesionGymEditado?: number
): { pros: string[]; contras: string[] } {
  const pros: string[] = [];
  const contras: string[] = [];
  
  // Análisis de días de gym
  if (diasGymEditado !== diasGymSugerido) {
    const diferencia = diasGymEditado - diasGymSugerido;
    if (diferencia > 0) {
      // Más días de gym
      if (objetivo === "ganar_masa" || objetivo === "volumen") {
        pros.push("Mayor frecuencia de entrenamiento puede acelerar la ganancia de músculo");
        pros.push("Más estimulo para el crecimiento muscular");
      } else if (objetivo === "perder_grasa") {
        pros.push("Más quema de calorías adicionales durante el entrenamiento");
        pros.push("Mejor preservación de masa muscular");
      }
      if (diasGymEditado >= 6) {
        contras.push("Riesgo de sobreentrenamiento si no hay suficiente recuperación");
        contras.push("Mayor fatiga puede afectar la intensidad de cada sesión");
        contras.push("Aumento del riesgo de lesiones por falta de descanso");
      } else if (diasGymEditado === 5) {
        contras.push("Necesitarás optimizar tu recuperación y nutrición");
      }
    } else {
      // Menos días de gym
      if (objetivo === "ganar_masa" || objetivo === "volumen") {
        contras.push("Menos estímulo para el crecimiento muscular");
        contras.push("Ganancia de músculo potencialmente más lenta");
      } else if (objetivo === "perder_grasa") {
        contras.push("Menos quema de calorías durante entrenamientos");
        contras.push("Riesgo de perder más músculo durante el déficit");
      }
      if (diasGymEditado >= 3) {
        pros.push("Más tiempo de recuperación entre sesiones puede mejorar la calidad del entrenamiento");
        pros.push("Menor riesgo de sobreentrenamiento");
      } else {
        pros.push("Más tiempo para otras actividades y descanso");
        contras.push("Muy poco entrenamiento puede no ser suficiente para tu objetivo");
      }
    }
  }
  
  // Análisis de caminata
  if (minutosCaminataEditado !== minutosCaminataSugerido) {
    const diferencia = minutosCaminataEditado - minutosCaminataSugerido;
    if (diferencia > 0) {
      // Más caminata
      if (objetivo === "perder_grasa" || objetivo === "corte") {
        pros.push("Mayor déficit calórico y quema de grasa acelerada");
        pros.push("Mejora de salud cardiovascular");
      } else {
        pros.push("Mayor quema de calorías diarias");
        if (objetivo === "ganar_masa" || objetivo === "volumen") {
          contras.push("Puede interferir con la recuperación y ganancia de masa");
          contras.push("Mayor gasto calórico requiere más calorías para mantener superávit");
        }
      }
      if (minutosCaminataEditado >= 60) {
        contras.push("Alto volumen de cardio puede afectar la recuperación muscular");
        contras.push("Riesgo de fatiga acumulada");
      }
    } else {
      // Menos caminata
      if (objetivo === "ganar_masa" || objetivo === "volumen") {
        pros.push("Menos interferencia con la recuperación y ganancia muscular");
        pros.push("Menor gasto calórico facilita el superávit");
      } else if (objetivo === "perder_grasa") {
        contras.push("Menor quema de calorías diarias");
        contras.push("Progreso de pérdida de grasa más lento");
      }
      if (minutosCaminataEditado < 20) {
        contras.push("Muy poca actividad puede afectar la salud cardiovascular general");
      } else {
        pros.push("Más energía para el entrenamiento de fuerza");
      }
    }
  }
  
  // Análisis de sueño
  if (horasSuenoEditado !== horasSuenoSugerido) {
    const diferencia = horasSuenoEditado - horasSuenoSugerido;
    if (diferencia > 0) {
      // Más sueño
      pros.push("Mejor recuperación muscular y síntesis de proteínas");
      pros.push("Mejor producción de hormonas de crecimiento (HGH)");
      pros.push("Menor riesgo de sobreentrenamiento");
      pros.push("Mejor función cognitiva y energía durante el día");
      if (horasSuenoEditado >= 9) {
        pros.push("Recuperación óptima para entrenamiento intenso");
      }
    } else {
      // Menos sueño
      contras.push("Recuperación subóptima puede limitar el crecimiento muscular");
      contras.push("Aumento del cortisol (hormona del estrés) que puede dificultar la pérdida de grasa");
      contras.push("Menor producción de testosterona y HGH");
      contras.push("Mayor riesgo de fatiga crónica y sobreentrenamiento");
      if (horasSuenoEditado < 6) {
        contras.push("Sueño insuficiente afecta gravemente la recuperación y el rendimiento");
      }
    }
  }

  // Análisis de minutos por sesión de gym
  if (
    typeof minutosSesionGymSugerido === 'number' &&
    typeof minutosSesionGymEditado === 'number' &&
    isFinite(minutosSesionGymSugerido) &&
    isFinite(minutosSesionGymEditado) &&
    minutosSesionGymEditado !== minutosSesionGymSugerido
  ) {
    const diff = minutosSesionGymEditado - minutosSesionGymSugerido;
    if (diff > 0) {
      pros.push("Sesiones más largas aumentan el estímulo de entrenamiento");
      if (objetivo === "ganar_masa" || objetivo === "volumen") {
        pros.push("Más volumen puede favorecer la hipertrofia si hay recuperación suficiente");
      } else if (objetivo === "perder_grasa" || objetivo === "corte") {
        pros.push("Mayor gasto calórico por sesión");
      }
      if (minutosSesionGymEditado >= 120) {
        contras.push("Sesiones muy largas pueden reducir la intensidad efectiva");
        contras.push("Mayor riesgo de fatiga y sobreentrenamiento");
      }
    } else {
      // menor duración
      pros.push("Sesiones más cortas facilitan mantener alta intensidad y adherencia");
      if (objetivo === "ganar_masa" || objetivo === "volumen") {
        contras.push("Menos volumen puede limitar la ganancia muscular");
      } else if (objetivo === "perder_grasa" || objetivo === "corte") {
        contras.push("Menor gasto calórico por sesión");
      }
      if (minutosSesionGymEditado < 45) {
        contras.push("Duración muy baja puede ser insuficiente para tu objetivo");
      }
    }
  }
  
  return { pros, contras };
}

