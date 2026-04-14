import { Goal, UserInput } from "@/types/plan";
import type { AppLocale } from "@/contexts/AppLocaleContext";

function ui(loc: AppLocale | undefined, es: string, en: string): string {
  return loc === "en" ? en : es;
}

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
export function getTiempoObjetivo(
  intensidad: "leve" | "moderada" | "intensa" | "ultra",
  locale?: AppLocale
): string {
  if (locale === "en") {
    if (intensidad === "ultra") return "1-2 months";
    if (intensidad === "intensa") return "1-3 months";
    if (intensidad === "moderada") return "3 months";
    return "3-5 months";
  }
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
  atletico?: boolean,
  locale?: AppLocale
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
  if (objetivo === "ganar_masa" || objetivo === "volumen" || objetivo === "recomposicion" || objetivo === "bulk_cut" || objetivo === "lean_bulk") {
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
    descripcion = ui(
      locale,
      "Enfoque en quema de grasa: entrenamiento de fuerza para mantener músculo y caminata para acelerar el déficit calórico.",
      "Fat-loss focus: strength training to preserve muscle and walking to support your calorie deficit."
    );
  } else if (objetivo === "ganar_masa" || objetivo === "volumen" || objetivo === "bulk_cut") {
    descripcion = ui(
      locale,
      "Priorizar crecimiento muscular con entrenamiento de fuerza. Cardio mínimo para no interferir con la recuperación y ganancia.",
      "Prioritize muscle growth with strength training. Minimal cardio so it doesn’t interfere with recovery and gains."
    );
  } else if (objetivo === "lean_bulk") {
    descripcion = ui(
      locale,
      "Ganancia muscular controlada con cardio estratégico para mantener definición. Superávit moderado y progresión constante.",
      "Controlled muscle gain with strategic cardio to stay lean. Moderate surplus and steady progression."
    );
  } else if (objetivo === "recomposicion") {
    descripcion = ui(
      locale,
      "Balance entre construcción muscular y quema de grasa. Entrenamiento de fuerza regular con cardio moderado.",
      "Balance muscle building and fat loss. Regular strength training with moderate cardio."
    );
  } else {
    descripcion = ui(
      locale,
      "Mantenimiento de condición física y salud general con entrenamiento equilibrado.",
      "Maintain fitness and general health with balanced training."
    );
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
  diasGym?: number,
  locale?: AppLocale
): { 
  musculoGananciaMensual?: string; 
  grasaPerdidaMensual?: string;
  proyecciones: string[];
  tiempoEstimado: string;
} {
  const proyecciones: string[] = [];
  const t = (es: string, en: string) => ui(locale, es, en);
  let musculoGanancia: string | undefined = "0.5-1 kg";
  let grasaPerdida: string | undefined;
  let tiempoEstimado = t("3-6 meses", "3-6 months");

  // Determinar nivel de experiencia (aproximado)
  const esPrincipiante = !atletico && (typeof diasGym === "undefined" || diasGym === 0);
  const esIntermedio = !esPrincipiante && !atletico;
  const esAvanzado = atletico || (diasGym !== undefined && diasGym >= 5);

  // Tiempos objetivo según intensidad (aplicable a todos los objetivos)
  const tiempoObjetivo = getTiempoObjetivo(intensidad, locale);
  
  if (objetivo === "ganar_masa" || objetivo === "volumen" || objetivo === "powerlifting" || objetivo === "bulk_cut" || objetivo === "lean_bulk") {
    // Ganancia de músculo - primero según nivel, luego ajustar por intensidad
    if (esPrincipiante) {
      if (intensidad === "ultra") {
        musculoGanancia = sexo === "masculino" ? "2-3 kg" : "1-1.5 kg";
        proyecciones.push(
          t(
            "🔥 ULTRA: Como principiante con máxima intensidad, podés ganar músculo extremadamente rápido (efecto novato + protocolo élite)",
            "🔥 ULTRA: As a beginner at max intensity, you can gain muscle extremely fast (newbie gains + elite protocol)"
          )
        );
      } else if (intensidad === "intensa") {
        musculoGanancia = sexo === "masculino" ? "1.5-2.5 kg" : "0.75-1.25 kg";
        proyecciones.push(
          t(
            "Como principiante con alta intensidad, podés ganar músculo muy rápido (efecto novato maximizado)",
            "As a beginner with high intensity, you can gain muscle very quickly (maximized newbie gains)"
          )
        );
      } else if (intensidad === "moderada") {
        musculoGanancia = sexo === "masculino" ? "1-2 kg" : "0.5-1 kg";
        proyecciones.push(
          t("Como principiante, podés ganar músculo más rápido (efecto novato)", "As a beginner, you can gain muscle faster (newbie effect)")
        );
      } else {
        musculoGanancia = sexo === "masculino" ? "0.75-1.5 kg" : "0.4-0.75 kg";
        proyecciones.push(
          t(
            "Como principiante con progresión gradual, ganancia sostenible a largo plazo",
            "As a beginner with gradual progression, sustainable long-term gain"
          )
        );
      }
    } else if (esIntermedio) {
      if (intensidad === "ultra") {
        musculoGanancia = sexo === "masculino" ? "1-1.5 kg" : "0.5-0.8 kg";
        proyecciones.push(
          t("🔥 ULTRA: Máximo protocolo de hipertrofia con entrenamiento de élite", "🔥 ULTRA: Maximum hypertrophy protocol with elite-level training")
        );
      } else if (intensidad === "intensa") {
        musculoGanancia = sexo === "masculino" ? "0.75-1.25 kg" : "0.4-0.7 kg";
        proyecciones.push(
          t(
            "Con alta intensidad y disciplina, maximizás tu potencial de crecimiento",
            "With high intensity and discipline, you maximize your growth potential"
          )
        );
      } else if (intensidad === "moderada") {
        musculoGanancia = sexo === "masculino" ? "0.5-1 kg" : "0.25-0.5 kg";
        proyecciones.push(t("Ganancia de músculo constante y sostenible", "Steady, sustainable muscle gain"));
      } else {
        musculoGanancia = sexo === "masculino" ? "0.4-0.8 kg" : "0.2-0.4 kg";
        proyecciones.push(
          t(
            "Progresión gradual y sostenible, ideal para mantener a largo plazo",
            "Gradual, sustainable progression—ideal for the long run"
          )
        );
      }
    } else {
      if (intensidad === "ultra") {
        musculoGanancia = sexo === "masculino" ? "0.6-1 kg" : "0.3-0.5 kg";
        proyecciones.push(
          t(
            "🔥 ULTRA: Protocolo de atleta élite, cada décima de músculo optimizada",
            "🔥 ULTRA: Elite-athlete protocol—every bit of muscle optimized"
          )
        );
      } else if (intensidad === "intensa") {
        musculoGanancia = sexo === "masculino" ? "0.4-0.7 kg" : "0.2-0.4 kg";
        proyecciones.push(
          t("Ganancia refinada con alta intensidad, cada gramo cuenta", "Refined gains at high intensity—every gram counts")
        );
      } else if (intensidad === "moderada") {
        musculoGanancia = sexo === "masculino" ? "0.25-0.5 kg" : "0.15-0.3 kg";
        proyecciones.push(t("Ganancia refinada, cada gramo de músculo es valioso", "Refined gains—every gram of muscle matters"));
      } else {
        musculoGanancia = sexo === "masculino" ? "0.2-0.4 kg" : "0.1-0.25 kg";
        proyecciones.push(
          t(
            "Progresión muy gradual, enfocada en sostenibilidad y salud",
            "Very gradual progression focused on sustainability and health"
          )
        );
      }
    }
    tiempoEstimado = `${tiempoObjetivo} ${t("para ver resultados notables", "to see noticeable results")}`;
    proyecciones.push(
      intensidad === "ultra"
        ? t(
            "Aumento de fuerza: +10-15% en levantamientos principales por mes",
            "Strength gain: +10-15% on main lifts per month"
          )
        : t(
            "Aumento de fuerza: +5-10% en levantamientos principales por mes",
            "Strength gain: +5-10% on main lifts per month"
          )
    );
    proyecciones.push(
      t(
        "Mejora en composición corporal: reducción de % de grasa mientras ganás masa",
        "Better body composition: lower body-fat % while gaining mass"
      )
    );
    
  } else if (objetivo === "perder_grasa" || objetivo === "corte") {
    // Pérdida de grasa
    musculoGanancia = undefined; // No mostrar ganancia de músculo para este objetivo
    grasaPerdida = intensidad === "ultra" ? "2-3 kg" : intensidad === "intensa" ? "1-2 kg" : intensidad === "moderada" ? "0.5-1 kg" : "0.3-0.7 kg";
    proyecciones.push(
      t(
        "Preservación de masa muscular gracias al entrenamiento de fuerza",
        "Muscle preservation thanks to strength training"
      )
    );

    if (bmi > 30) {
      proyecciones.push(
        t(
          "Los primeros meses podés perder más peso (agua y grasa)",
          "In the first months you may lose more weight (water and fat)"
        )
      );
      tiempoEstimado = `${tiempoObjetivo} ${t("para alcanzar peso saludable", "to reach a healthy weight")}`;
    } else if (bmi > 25) {
      tiempoEstimado = `${tiempoObjetivo} ${t("para cambios visibles", "for visible changes")}`;
      proyecciones.push(
        t("Mejora notable en definición muscular y energía", "Clearer definition and better energy")
      );
    } else {
      tiempoEstimado = `${tiempoObjetivo} ${t("para definición visible", "for visible definition")}`;
      proyecciones.push(
        t("Enfoque en definición y preservación de músculo ganado", "Focus on definition while keeping muscle you’ve built")
      );
    }

    proyecciones.push(
      t(
        "Reducción de circunferencia de cintura: ~2-4 cm por mes",
        "Waist circumference: ~2-4 cm per month"
      )
    );
    
  } else if (objetivo === "recomposicion") {
    if (intensidad === "ultra") {
      musculoGanancia = sexo === "masculino" ? "0.6-1 kg" : "0.35-0.6 kg";
      proyecciones.push(
        t(`Ganancia de músculo: ${musculoGanancia} por mes`, `Muscle gain: ${musculoGanancia} per month`)
      );
      proyecciones.push(
        t("🔥 ULTRA: Transformación acelerada con protocolo élite", "🔥 ULTRA: Faster transformation with an elite protocol")
      );
    } else if (intensidad === "intensa") {
      musculoGanancia = sexo === "masculino" ? "0.4-0.8 kg" : "0.25-0.5 kg";
      proyecciones.push(
        t(`Ganancia de músculo: ${musculoGanancia} por mes`, `Muscle gain: ${musculoGanancia} per month`)
      );
      proyecciones.push(
        t("Con alta intensidad, transformación más rápida", "At high intensity, faster body recomposition")
      );
    } else if (intensidad === "moderada") {
      musculoGanancia = sexo === "masculino" ? "0.3-0.7 kg" : "0.2-0.4 kg";
      proyecciones.push(
        t(`Ganancia de músculo: ${musculoGanancia} por mes`, `Muscle gain: ${musculoGanancia} per month`)
      );
    } else {
      musculoGanancia = sexo === "masculino" ? "0.2-0.5 kg" : "0.15-0.3 kg";
      proyecciones.push(
        t(`Ganancia de músculo: ${musculoGanancia} por mes`, `Muscle gain: ${musculoGanancia} per month`)
      );
      proyecciones.push(
        t("Progresión gradual, ideal para mantener a largo plazo", "Gradual progression—ideal for the long run")
      );
    }
    tiempoEstimado = `${tiempoObjetivo} ${t("para transformación completa", "for full recomposition")}`;
    proyecciones.push(
      t("Pérdida simultánea de grasa mientras ganás músculo", "Fat loss while gaining muscle at the same time")
    );
    proyecciones.push(
      t(
        "Mejora en composición corporal sin cambios drásticos de peso",
        "Better body composition without drastic scale changes"
      )
    );
    
  } else if (objetivo === "definicion") {
    // Pérdida de grasa para definición (más gradual que perder_grasa para preservar músculo)
    musculoGanancia = undefined; // No mostrar ganancia de músculo para este objetivo
    grasaPerdida = intensidad === "ultra" ? "1.5-2 kg" : intensidad === "intensa" ? "0.8-1.5 kg" : intensidad === "moderada" ? "0.5-1 kg" : "0.3-0.6 kg";
    proyecciones.push(
      t("Mantenimiento de masa muscular mientras reducís grasa", "Keep muscle while losing fat")
    );
    proyecciones.push(
      t(
        "Definición muscular visible: abs y músculos más marcados",
        "Visible definition: abs and sharper muscle lines"
      )
    );
    proyecciones.push(
      t("Reducción de % de grasa corporal: 1-2% por mes", "Body fat % down: about 1-2% per month")
    );

    if (bmi > 25) {
      tiempoEstimado = `${tiempoObjetivo} ${t("para definición visible", "for visible definition")}`;
      proyecciones.push(
        t("Mejora notable en definición muscular y energía", "Clearer definition and better energy")
      );
    } else {
      tiempoEstimado = `${tiempoObjetivo} ${t("para definición óptima", "for peak definition")}`;
      proyecciones.push(
        t(
          "Enfoque en definición extrema preservando músculo ganado",
          "Extreme definition focus while keeping muscle"
        )
      );
    }

    proyecciones.push(
      t(
        "Reducción de circunferencia de cintura: ~1-3 cm por mes",
        "Waist circumference: ~1-3 cm per month"
      )
    );
    
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
  minutosSesionGymEditado?: number,
  locale?: AppLocale
): { pros: string[]; contras: string[] } {
  const t = (es: string, en: string) => ui(locale, es, en);
  const pros: string[] = [];
  const contras: string[] = [];
  
  // Análisis de días de gym
  if (diasGymEditado !== diasGymSugerido) {
    const diferencia = diasGymEditado - diasGymSugerido;
    if (diferencia > 0) {
      // Más días de gym
      if (objetivo === "ganar_masa" || objetivo === "volumen") {
        pros.push(
          t(
            "Mayor frecuencia de entrenamiento puede acelerar la ganancia de músculo",
            "More training days can speed up muscle gain"
          )
        );
        pros.push(t("Más estimulo para el crecimiento muscular", "More stimulus for muscle growth"));
      } else if (objetivo === "perder_grasa") {
        pros.push(
          t(
            "Más quema de calorías adicionales durante el entrenamiento",
            "More calories burned during workouts"
          )
        );
        pros.push(
          t("Mejor preservación de masa muscular", "Better muscle preservation")
        );
      }
      if (diasGymEditado >= 6) {
        contras.push(
          t(
            "Riesgo de sobreentrenamiento si no hay suficiente recuperación",
            "Overtraining risk if recovery is insufficient"
          )
        );
        contras.push(
          t(
            "Mayor fatiga puede afectar la intensidad de cada sesión",
            "More fatigue can lower each session’s intensity"
          )
        );
        contras.push(
          t(
            "Aumento del riesgo de lesiones por falta de descanso",
            "Higher injury risk without enough rest"
          )
        );
      } else if (diasGymEditado === 5) {
        contras.push(
          t(
            "Necesitarás optimizar tu recuperación y nutrición",
            "You’ll need to optimize recovery and nutrition"
          )
        );
      }
    } else {
      // Menos días de gym
      if (objetivo === "ganar_masa" || objetivo === "volumen") {
        contras.push(
          t("Menos estímulo para el crecimiento muscular", "Less stimulus for muscle growth")
        );
        contras.push(
          t(
            "Ganancia de músculo potencialmente más lenta",
            "Potentially slower muscle gain"
          )
        );
      } else if (objetivo === "perder_grasa") {
        contras.push(
          t("Menos quema de calorías durante entrenamientos", "Fewer calories burned from training")
        );
        contras.push(
          t(
            "Riesgo de perder más músculo durante el déficit",
            "Higher risk of muscle loss in a deficit"
          )
        );
      }
      if (diasGymEditado >= 3) {
        pros.push(
          t(
            "Más tiempo de recuperación entre sesiones puede mejorar la calidad del entrenamiento",
            "More recovery between sessions can improve workout quality"
          )
        );
        pros.push(t("Menor riesgo de sobreentrenamiento", "Lower overtraining risk"));
      } else {
        pros.push(
          t("Más tiempo para otras actividades y descanso", "More time for other activities and rest")
        );
        contras.push(
          t(
            "Muy poco entrenamiento puede no ser suficiente para tu objetivo",
            "Very little training may not match your goal"
          )
        );
      }
    }
  }
  
  // Análisis de caminata
  if (minutosCaminataEditado !== minutosCaminataSugerido) {
    const diferencia = minutosCaminataEditado - minutosCaminataSugerido;
    if (diferencia > 0) {
      // Más caminata
      if (objetivo === "perder_grasa" || objetivo === "corte") {
        pros.push(
          t("Mayor déficit calórico y quema de grasa acelerada", "Larger deficit and faster fat loss")
        );
        pros.push(t("Mejora de salud cardiovascular", "Better cardiovascular health"));
      } else {
        pros.push(t("Mayor quema de calorías diarias", "Higher daily calorie burn"));
        if (objetivo === "ganar_masa" || objetivo === "volumen") {
          contras.push(
            t(
              "Puede interferir con la recuperación y ganancia de masa",
              "Can interfere with recovery and mass gain"
            )
          );
          contras.push(
            t(
              "Mayor gasto calórico requiere más calorías para mantener superávit",
              "Higher burn needs more food to stay in a surplus"
            )
          );
        }
      }
      if (minutosCaminataEditado >= 60) {
        contras.push(
          t(
            "Alto volumen de cardio puede afectar la recuperación muscular",
            "High cardio volume can hurt muscle recovery"
          )
        );
        contras.push(t("Riesgo de fatiga acumulada", "Risk of accumulated fatigue"));
      }
    } else {
      // Menos caminata
      if (objetivo === "ganar_masa" || objetivo === "volumen") {
        pros.push(
          t(
            "Menos interferencia con la recuperación y ganancia muscular",
            "Less interference with recovery and muscle gain"
          )
        );
        pros.push(
          t("Menor gasto calórico facilita el superávit", "Lower burn makes a surplus easier")
        );
      } else if (objetivo === "perder_grasa") {
        contras.push(t("Menor quema de calorías diarias", "Lower daily calorie burn"));
        contras.push(
          t("Progreso de pérdida de grasa más lento", "Slower fat-loss progress")
        );
      }
      if (minutosCaminataEditado < 20) {
        contras.push(
          t(
            "Muy poca actividad puede afectar la salud cardiovascular general",
            "Very low activity can affect general cardiovascular health"
          )
        );
      } else {
        pros.push(
          t("Más energía para el entrenamiento de fuerza", "More energy for strength training")
        );
      }
    }
  }
  
  // Análisis de sueño
  if (horasSuenoEditado !== horasSuenoSugerido) {
    const diferencia = horasSuenoEditado - horasSuenoSugerido;
    if (diferencia > 0) {
      // Más sueño
      pros.push(
        t(
          "Mejor recuperación muscular y síntesis de proteínas",
          "Better muscle recovery and protein synthesis"
        )
      );
      pros.push(
        t(
          "Mejor producción de hormonas de crecimiento (HGH)",
          "Better growth-hormone (GH) output"
        )
      );
      pros.push(t("Menor riesgo de sobreentrenamiento", "Lower overtraining risk"));
      pros.push(
        t(
          "Mejor función cognitiva y energía durante el día",
          "Better focus and daytime energy"
        )
      );
      if (horasSuenoEditado >= 9) {
        pros.push(
          t(
            "Recuperación óptima para entrenamiento intenso",
            "Optimal recovery for hard training"
          )
        );
      }
    } else {
      // Menos sueño
      contras.push(
        t(
          "Recuperación subóptima puede limitar el crecimiento muscular",
          "Subpar recovery can limit muscle growth"
        )
      );
      contras.push(
        t(
          "Aumento del cortisol (hormona del estrés) que puede dificultar la pérdida de grasa",
          "Higher cortisol (stress) can make fat loss harder"
        )
      );
      contras.push(
        t(
          "Menor producción de testosterona y HGH",
          "Lower testosterone and GH production"
        )
      );
      contras.push(
        t(
          "Mayor riesgo de fatiga crónica y sobreentrenamiento",
          "Higher risk of chronic fatigue and overtraining"
        )
      );
      if (horasSuenoEditado < 6) {
        contras.push(
          t(
            "Sueño insuficiente afecta gravemente la recuperación y el rendimiento",
            "Too little sleep seriously hurts recovery and performance"
          )
        );
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
      pros.push(
        t(
          "Sesiones más largas aumentan el estímulo de entrenamiento",
          "Longer sessions increase training stimulus"
        )
      );
      if (objetivo === "ganar_masa" || objetivo === "volumen") {
        pros.push(
          t(
            "Más volumen puede favorecer la hipertrofia si hay recuperación suficiente",
            "More volume can help hypertrophy if recovery is on point"
          )
        );
      } else if (objetivo === "perder_grasa" || objetivo === "corte") {
        pros.push(t("Mayor gasto calórico por sesión", "Higher calorie burn per session"));
      }
      if (minutosSesionGymEditado >= 120) {
        contras.push(
          t(
            "Sesiones muy largas pueden reducir la intensidad efectiva",
            "Very long sessions can reduce effective intensity"
          )
        );
        contras.push(
          t("Mayor riesgo de fatiga y sobreentrenamiento", "Higher fatigue and overtraining risk")
        );
      }
    } else {
      // menor duración
      pros.push(
        t(
          "Sesiones más cortas facilitan mantener alta intensidad y adherencia",
          "Shorter sessions make it easier to keep intensity and consistency"
        )
      );
      if (objetivo === "ganar_masa" || objetivo === "volumen") {
        contras.push(
          t("Menos volumen puede limitar la ganancia muscular", "Less volume may limit muscle gain")
        );
      } else if (objetivo === "perder_grasa" || objetivo === "corte") {
        contras.push(t("Menor gasto calórico por sesión", "Lower calorie burn per session"));
      }
      if (minutosSesionGymEditado < 45) {
        contras.push(
          t(
            "Duración muy baja puede ser insuficiente para tu objetivo",
            "Very short sessions may be insufficient for your goal"
          )
        );
      }
    }
  }
  
  return { pros, contras };
}

