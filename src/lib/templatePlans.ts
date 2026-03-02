/**
 * Sistema de Generación de Planes con Templates
 * Para usuarios gratuitos - Sin costo de API
 * 
 * Genera planes personalizados basados en templates y cálculos automáticos
 */

import type { UserInput, PlanAIResponse, TrainingPlan, Comida, DiaPlan, TrainingExercise } from "@/types/plan";

// ============================================================================
// TEMPLATES DE COMIDAS POR TIPO DE DIETA
// ============================================================================

const templateComidas = {
  estandar: {
    desayuno: [
      { nombre: "Huevos revueltos", opciones: ["3 huevos + 2 tostadas integrales + café con leche", "3 huevos + avena + banana + café"] },
      { nombre: "Tostadas francesas", opciones: ["2 tostadas + huevo + arándanos + miel", "2 tostadas + yogur griego + granola"] },
      { nombre: "Pancakes proteicos", opciones: ["Pancakes (2) + arándanos + syrup", "Pancakes (2) + mantequilla de maní + banana"] },
      { nombre: "Licuado", opciones: ["Proteína + banana + avena + leche", "Proteína + frutas rojas + yogur + granola"] },
    ],
    almuerzo: [
      { nombre: "Pollo con arroz", opciones: ["Pechuga 200g + arroz 150g + brócoli", "Pechuga 200g + arroz integral 150g + zanahoria"] },
      { nombre: "Salmón con batata", opciones: ["Salmón 180g + batata 150g + espinaca", "Salmón 150g + batata 200g + ensalada"] },
      { nombre: "Res con papas", opciones: ["Carne magra 200g + papas 150g + ensalada", "Res 180g + papas integrales 150g + verduras"] },
      { nombre: "Pavo con quinoa", opciones: ["Pavo 200g + quinoa 150g + vegetales", "Pavo 180g + quinoa 100g + salsa tomate"] },
    ],
    merienda: [
      { nombre: "Fruta + proteína", opciones: ["Banana + 30g almendras", "Manzana + 30g nueces", "Naranja + 25g pistachos"] },
      { nombre: "Yogur + granola", opciones: ["Yogur griego 200g + granola 50g + miel", "Yogur natural 200g + granola 40g + frutas"] },
      { nombre: "Licuado light", opciones: ["Proteína + banana + avena + leche", "Proteína + frutas + yogur"] },
      { nombre: "Barra proteica", opciones: ["Barra de proteína + café", "Barra casera + té"] },
    ],
    cena: [
      { nombre: "Pechuga con vegetales", opciones: ["Pechuga 200g + camote 150g + brócoli", "Pechuga 180g + papa 150g + espinaca"] },
      { nombre: "Pescado blanco", opciones: ["Merluza 200g + arroz 100g + verduras", "Lenguado 180g + quinoa 150g + ensalada"] },
      { nombre: "Huevos con vegetales", opciones: ["4 claras + 1 yema + 200g vegetales + 50g arroz", "3 huevos completos + vegetales"] },
      { nombre: "Legumbres", opciones: ["Lentejas 200g + verduras + ajo", "Garbanzos 200g + cebolla + tomate"] },
    ],
  },
  vegana: {
    desayuno: [
      { nombre: "Avena con frutas", opciones: ["Avena 50g + banana + berries + leche de almendra", "Avena 50g + manzana + canela + leche de soja"] },
      { nombre: "Tostadas de tofu", opciones: ["Tofu revuelto + 2 tostadas integrales + aguacate", "Tofu revuelto + pan integral + verduras"] },
      { nombre: "Smoothie vegano", opciones: ["Proteína vegetal + banana + mantequilla de maní + leche de avena", "Proteína + berries + almendras + leche de soja"] },
      { nombre: "Granola casera", opciones: ["Granola 60g + leche de coco + frutas", "Granola 50g + yogur vegano + berries"] },
    ],
    almuerzo: [
      { nombre: "Tofu con arroz", opciones: ["Tofu 200g + arroz 150g + brócoli salteado", "Tofu ahumado 200g + arroz integral + vegetales"] },
      { nombre: "Lentejas con quinoa", opciones: ["Lentejas 200g + quinoa 150g + verduras", "Lentejas 180g + quinoa 100g + salsa tomate"] },
      { nombre: "Garbanzos con batata", opciones: ["Garbanzos 180g + batata 200g + espinaca", "Garbanzos tostados 150g + batata 200g + ensalada"] },
      { nombre: "Pasta integral vegana", opciones: ["Pasta 200g + salsa tomate + vegetales + tofu", "Pasta integral 150g + salsa vegana + brócoli"] },
    ],
    merienda: [
      { nombre: "Fruta + semillas", opciones: ["Banana + 30g semillas de girasol", "Manzana + 20g almendras + dátiles"] },
      { nombre: "Hummus con vegetales", opciones: ["Hummus 100g + zanahoria + pepino + tostadas", "Hummus 80g + pan integral 2 rebanadas"] },
      { nombre: "Barra proteica vegana", opciones: ["Barra de proteína vegetal + té", "Barra casera de nueces + frutas"] },
      { nombre: "Batido proteico", opciones: ["Proteína vegetal + leche de almendra + berries", "Proteína de guisante + plátano + leche de soja"] },
    ],
    cena: [
      { nombre: "Tofu salteado", opciones: ["Tofu 200g + arroz 100g + vegetales salteados", "Tofu 180g + papa 150g + verduras al vapor"] },
      { nombre: "Sopa de lentejas", opciones: ["Lentejas 200g + verduras + caldo de vegetales", "Lentejas 180g + cebolla + ajo + zanahoria"] },
      { nombre: "Hamburguesa vegana", opciones: ["Hamburguesa vegetal + pan integral + ensalada + batatas fritas", "Milanesa de legumbres + pan + verduras"] },
      { nombre: "Tempeh a la parrilla", opciones: ["Tempeh 150g + papas 150g + brócoli", "Tempeh 180g + quinoa + vegetales"] },
    ],
  },
  keto: {
    desayuno: [
      { nombre: "Huevos con aguacate", opciones: ["3 huevos + 1/2 aguacate + jamón", "4 huevos revueltos + queso + tocino"] },
      { nombre: "Cafe con mantequilla", opciones: ["Café + 2 cucharadas mantequilla + crema", "Café + aceite de coco + crema"] },
      { nombre: "Omelette de queso", opciones: ["Omelette 3 huevos + 50g queso + espinaca", "Omelette 4 huevos + champiñones + queso"] },
      { nombre: "Yogur griego", opciones: ["Yogur griego 200g + nueces + semillas de lino", "Yogur griego 200g + almendras + cacao"] },
    ],
    almuerzo: [
      { nombre: "Carne con grasas", opciones: ["Carne de res 250g + aguacate + ensalada con aceite de oliva", "Costillas 250g + mantequilla + vegetales bajos en carbs"] },
      { nombre: "Salmón con mayonesa", opciones: ["Salmón 200g + mayonesa casera + ensalada verde", "Salmón 200g + salsa holandesa + brócoli"] },
      { nombre: "Pollo con salsa", opciones: ["Pollo 250g + salsa bbq keto + ensalada de queso", "Pollo 200g + salsa de crema + champiñones"] },
      { nombre: "Huevos rellenos", opciones: ["4 huevos rellenos de queso + jamón + panceta", "3 huevos rellenos + aguacate + tocineta"] },
    ],
    merienda: [
      { nombre: "Queso y frutos secos", opciones: ["50g queso + 30g almendras + olivas", "100g queso + 20g nueces + carne seca"] },
      { nombre: "Huevos cocidos", opciones: ["3 huevos cocidos + sal + pimienta", "4 huevos + mayonesa"] },
      { nombre: "Snack graso", opciones: ["Panceta crujiente + queso", "Chicharrones + guacamole"] },
      { nombre: "Nata montada", opciones: ["Nata montada 100g + cacao", "Crema batida + fresas"] },
    ],
    cena: [
      { nombre: "Filete con mantequilla", opciones: ["Filete 250g + mantequilla compuesta + espinaca", "Filete 200g + salsa de champiñones + ensalada"] },
      { nombre: "Pescado graso", opciones: ["Caballa 200g + aguacate + ensalada", "Trucha 200g + salsa de queso + coliflor"] },
      { nombre: "Cerdo jugoso", opciones: ["Costillas de cerdo 250g + coliflor asada", "Chuletas 200g + salsa de crema + espinaca"] },
      { nombre: "Huevos con queso", opciones: ["Tortilla 6 huevos + queso + jamón + espinaca", "Revuelto 5 huevos + queso + champiñones"] },
    ],
  },
  mediterranea: {
    desayuno: [
      { nombre: "Pan con tomate", opciones: ["Pan integral + tomate + aceite de oliva + jamón serrano", "Pan integral + ricotta + tomate + orégano"] },
      { nombre: "Granola con miel", opciones: ["Granola 60g + yogur griego + miel + almendras", "Granola 50g + yogur natural + berries"] },
      { nombre: "Huevos a la griega", opciones: ["2 huevos + tomate + queso feta + aceite de oliva", "Omelette + espinaca + tomate + queso"] },
      { nombre: "Smoothie mediterráneo", opciones: ["Yogur + naranja + almendras + miel", "Yogur + berries + granola + miel"] },
    ],
    almuerzo: [
      { nombre: "Pez espada a la parrilla", opciones: ["Pez espada 200g + limón + aceite oliva + ensalada", "Pez espada 180g + papas al horno + vegetales"] },
      { nombre: "Pollo al horno", opciones: ["Pollo 200g + tomate + aceitunas + hierbas", "Pollo 200g + limón + romero + vegetales"] },
      { nombre: "Pasta con tomate", opciones: ["Pasta integral 200g + salsa tomate + verduras + queso parmesano", "Pasta 150g + salsa roja + ajo + albahaca"] },
      { nombre: "Ensalada griega", opciones: ["Ensalada griega + queso feta 100g + olivas + pan integral", "Tomate + pepino + cebolla + queso + aceite de oliva"] },
    ],
    merienda: [
      { nombre: "Fruta + queso", opciones: ["Manzana + 50g queso de cabra", "Uva + 50g queso parmesano"] },
      { nombre: "Pan tostado", opciones: ["Tostada integral + tomate + aceite de oliva + ajo", "Tostada + hummus + verduras"] },
      { nombre: "Olivas y queso", opciones: ["100g olivas variadas + 50g queso", "Aceitunas + almendras + queso"] },
      { nombre: "Yogur con miel", opciones: ["Yogur griego 200g + miel + nueces", "Yogur natural + miel + almendras"] },
    ],
    cena: [
      { nombre: "Lubina al horno", opciones: ["Lubina 200g + limón + aceite oliva + papas al horno", "Lubina 180g + tomate + hierbas + ensalada"] },
      { nombre: "Mejillones al vino", opciones: ["Mejillones 250g + vino blanco + ajo + pan", "Mejillones 200g + tomate + perejil"] },
      { nombre: "Pollo con limón", opciones: ["Pollo 200g + limón + ajo + papas + ensalada", "Pollo 180g + limón + romero + vegetales"] },
      { nombre: "Verduras rellenas", opciones: ["Tomates rellenos + arroz + hierbas", "Berenjenas + ricotta + tomate + queso"] },
    ],
  },
};

// ============================================================================
// TEMPLATES DE ENTRENAMIENTOS POR OBJETIVO E INTENSIDAD
// ============================================================================

const templateEntrenamientos = {
  perder_grasa: {
    leve: {
      split: "Full Body 3x/week",
      weeks: [
        {
          week: 1,
          days: [
            {
              day: "Lunes - Full Body",
              ejercicios: [
                { name: "Sentadilla", sets: 3, reps: "10-12", muscle_group: "Piernas", rpe: 6, rest_seconds: 90 },
                { name: "Press de Banca", sets: 3, reps: "10-12", muscle_group: "Pecho", rpe: 6, rest_seconds: 90 },
                { name: "Peso Muerto Rumano", sets: 3, reps: "12-15", muscle_group: "Espalda", rpe: 6, rest_seconds: 90 },
                { name: "Flexión de Brazos Asistida", sets: 3, reps: "8-10", muscle_group: "Tríceps", rpe: 6, rest_seconds: 60 },
              ]
            },
            {
              day: "Miércoles - Full Body",
              ejercicios: [
                { name: "Leg Press", sets: 3, reps: "12-15", muscle_group: "Piernas", rpe: 6, rest_seconds: 90 },
                { name: "Remo Horizontal", sets: 3, reps: "10-12", muscle_group: "Espalda", rpe: 6, rest_seconds: 90 },
                { name: "Press de Hombro", sets: 3, reps: "10-12", muscle_group: "Hombros", rpe: 6, rest_seconds: 90 },
                { name: "Curl de Brazos", sets: 3, reps: "12-15", muscle_group: "Bíceps", rpe: 6, rest_seconds: 60 },
              ]
            },
            {
              day: "Viernes - Full Body",
              ejercicios: [
                { name: "Prensa de Pecho Inclinada", sets: 3, reps: "10-12", muscle_group: "Pecho", rpe: 6, rest_seconds: 90 },
                { name: "Extensión de Piernas", sets: 3, reps: "12-15", muscle_group: "Piernas", rpe: 6, rest_seconds: 90 },
                { name: "Jalón Lateral", sets: 3, reps: "10-12", muscle_group: "Espalda", rpe: 6, rest_seconds: 90 },
                { name: "Elevación Lateral", sets: 3, reps: "12-15", muscle_group: "Hombros", rpe: 6, rest_seconds: 60 },
              ]
            },
          ]
        },
      ],
    },
    moderada: {
      split: "Upper/Lower 4x/week",
      weeks: [
        {
          week: 1,
          days: [
            {
              day: "Lunes - Lower",
              ejercicios: [
                { name: "Sentadilla", sets: 4, reps: "8-10", muscle_group: "Piernas", rpe: 7, rest_seconds: 120 },
                { name: "Peso Muerto", sets: 3, reps: "6-8", muscle_group: "Espalda", rpe: 7, rest_seconds: 120 },
                { name: "Leg Press", sets: 3, reps: "10-12", muscle_group: "Piernas", rpe: 6, rest_seconds: 100 },
                { name: "Curl Femoral", sets: 3, reps: "10-12", muscle_group: "Piernas", rpe: 6, rest_seconds: 90 },
                { name: "Pantorrillas", sets: 3, reps: "15-20", muscle_group: "Piernas", rpe: 5, rest_seconds: 60 },
              ]
            },
            {
              day: "Martes - Upper",
              ejercicios: [
                { name: "Press de Banca", sets: 4, reps: "8-10", muscle_group: "Pecho", rpe: 7, rest_seconds: 120 },
                { name: "Remo Horizontal", sets: 4, reps: "8-10", muscle_group: "Espalda", rpe: 7, rest_seconds: 120 },
                { name: "Press de Hombro", sets: 3, reps: "8-10", muscle_group: "Hombros", rpe: 7, rest_seconds: 100 },
                { name: "Pull Ups", sets: 3, reps: "6-10", muscle_group: "Espalda", rpe: 7, rest_seconds: 100 },
              ]
            },
            {
              day: "Jueves - Lower",
              ejercicios: [
                { name: "Sentadilla Frontal", sets: 4, reps: "8-10", muscle_group: "Piernas", rpe: 7, rest_seconds: 120 },
                { name: "Extensión de Piernas", sets: 3, reps: "12-15", muscle_group: "Piernas", rpe: 6, rest_seconds: 90 },
                { name: "Curl Femoral Acostado", sets: 3, reps: "10-12", muscle_group: "Piernas", rpe: 6, rest_seconds: 90 },
                { name: "Prensa de Piernas", sets: 3, reps: "12-15", muscle_group: "Piernas", rpe: 6, rest_seconds: 90 },
              ]
            },
            {
              day: "Viernes - Upper",
              ejercicios: [
                { name: "Press Inclinado", sets: 4, reps: "8-10", muscle_group: "Pecho", rpe: 7, rest_seconds: 120 },
                { name: "Jalón Lateral", sets: 3, reps: "8-10", muscle_group: "Espalda", rpe: 7, rest_seconds: 100 },
                { name: "Flexión de Brazos", sets: 3, reps: "8-12", muscle_group: "Tríceps", rpe: 6, rest_seconds: 90 },
                { name: "Curl de Brazos", sets: 3, reps: "10-12", muscle_group: "Bíceps", rpe: 6, rest_seconds: 90 },
              ]
            },
          ]
        },
      ],
    },
  },
  ganar_masa: {
    moderada: {
      split: "PPL - Push/Pull/Legs",
      weeks: [
        {
          week: 1,
          days: [
            {
              day: "Lunes - Push",
              ejercicios: [
                { name: "Press de Banca", sets: 4, reps: "6-8", muscle_group: "Pecho", rpe: 8, rest_seconds: 120 },
                { name: "Press Inclinado", sets: 4, reps: "6-8", muscle_group: "Pecho", rpe: 8, rest_seconds: 120 },
                { name: "Press de Hombro", sets: 4, reps: "6-8", muscle_group: "Hombros", rpe: 8, rest_seconds: 120 },
                { name: "Elevación Lateral", sets: 3, reps: "10-12", muscle_group: "Hombros", rpe: 6, rest_seconds: 90 },
                { name: "Flexión de Brazos", sets: 3, reps: "8-10", muscle_group: "Tríceps", rpe: 7, rest_seconds: 90 },
              ]
            },
            {
              day: "Martes - Pull",
              ejercicios: [
                { name: "Peso Muerto", sets: 4, reps: "5-6", muscle_group: "Espalda", rpe: 9, rest_seconds: 150 },
                { name: "Remo Barbell", sets: 4, reps: "6-8", muscle_group: "Espalda", rpe: 8, rest_seconds: 120 },
                { name: "Pull Ups", sets: 4, reps: "6-10", muscle_group: "Espalda", rpe: 8, rest_seconds: 120 },
                { name: "Remo Dumbbell", sets: 3, reps: "8-10", muscle_group: "Espalda", rpe: 7, rest_seconds: 90 },
                { name: "Curl de Brazos", sets: 3, reps: "8-10", muscle_group: "Bíceps", rpe: 7, rest_seconds: 90 },
              ]
            },
            {
              day: "Miércoles - Legs",
              ejercicios: [
                { name: "Sentadilla", sets: 4, reps: "6-8", muscle_group: "Piernas", rpe: 8, rest_seconds: 150 },
                { name: "Peso Muerto Rumano", sets: 4, reps: "6-8", muscle_group: "Isquiotibiales", rpe: 8, rest_seconds: 120 },
                { name: "Leg Press", sets: 4, reps: "8-10", muscle_group: "Piernas", rpe: 7, rest_seconds: 120 },
                { name: "Curl Femoral", sets: 3, reps: "8-10", muscle_group: "Isquiotibiales", rpe: 7, rest_seconds: 90 },
                { name: "Extensión de Piernas", sets: 3, reps: "10-12", muscle_group: "Cuádriceps", rpe: 6, rest_seconds: 90 },
              ]
            },
            {
              day: "Jueves - OFF (Opcionalmente cardio suave 20min)" , ejercicios: []
            },
            {
              day: "Viernes - Push",
              ejercicios: [
                { name: "Press Cerrado", sets: 4, reps: "6-8", muscle_group: "Pecho", rpe: 8, rest_seconds: 120 },
                { name: "Aperturas de Pecho", sets: 3, reps: "8-10", muscle_group: "Pecho", rpe: 7, rest_seconds: 90 },
                { name: "Press Militar", sets: 3, reps: "6-8", muscle_group: "Hombros", rpe: 8, rest_seconds: 120 },
                { name: "Extensión de Tríceps", sets: 3, reps: "10-12", muscle_group: "Tríceps", rpe: 7, rest_seconds: 90 },
              ]
            },
            {
              day: "Sábado - Pull",
              ejercicios: [
                { name: "Remo Horizontal a Máquina", sets: 4, reps: "8-10", muscle_group: "Espalda", rpe: 7, rest_seconds: 100 },
                { name: "Jalón Lateral", sets: 3, reps: "6-8", muscle_group: "Espalda", rpe: 8, rest_seconds: 100 },
                { name: "Remo Invertido", sets: 3, reps: "8-10", muscle_group: "Espalda", rpe: 7, rest_seconds: 90 },
                { name: "Curl Inclinado", sets: 3, reps: "8-10", muscle_group: "Bíceps", rpe: 7, rest_seconds: 90 },
              ]
            },
            {
              day: "Domingo - Descanso", ejercicios: []
            },
          ]
        },
      ],
    },
  },
};

// ============================================================================
// FUNCIÓN PRINCIPAL DE GENERACIÓN DE PLANES CON TEMPLATES
// ============================================================================

export async function generateTemplateBasedPlan(
  user: UserInput,
  tdeeCalculado: number,
  caloriasObjetivo: number,
  macrosObjetivo: { proteinas: string; grasas: string; carbohidratos: string }
): Promise<PlanAIResponse> {
  const tipoDieta = user.tipoDieta || "estandar";
  const objetivo = user.objetivo;
  const intensidad = user.intensidad || "moderada";
  const dias = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

  // 1. Seleccionar templates de comidas
  const comidasTemplate = (templateComidas as any)[tipoDieta] || templateComidas.estandar;

  // 2. Generar plan semanal con comidas variadas
  const planSemanal: DiaPlan[] = dias.map((dia, index) => {
    const desayunoOpc = comidasTemplate.desayuno[index % comidasTemplate.desayuno.length];
    const almuerzoOpc = comidasTemplate.almuerzo[index % comidasTemplate.almuerzo.length];
    const meriendasOpc = comidasTemplate.merienda[index % comidasTemplate.merienda.length];
    const cenaOpc = comidasTemplate.cena[index % comidasTemplate.cena.length];

    return {
      dia,
      comidas: [
        { hora: "07:00", nombre: "Desayuno", opciones: desayunoOpc.opciones },
        { hora: "10:00", nombre: "Merienda 1", opciones: meriendasOpc.opciones },
        { hora: "13:00", nombre: "Almuerzo", opciones: almuerzoOpc.opciones },
        { hora: "16:00", nombre: "Merienda 2", opciones: [meriendasOpc.opciones[0]] },
        { hora: "19:30", nombre: "Cena", opciones: cenaOpc.opciones },
      ],
    };
  });

  // 3. Seleccionar plan de entrenamiento
  const trainingPlan = generarPlanEntrenamiento(objetivo, intensidad);

  // 4. Generar proyecciones motivacionales
  const proyecciones = generarProyecciones(user, objetivo, caloriasObjetivo);

  // 5. Mensaje motivacional
  const mensajeMotivacional = generarMensajMotivacional(user, objetivo);

  // 6. Minutos de sesión gym
  const minutosSesion = calcularMinutosSesion(intensidad);

  return {
    calorias_diarias: caloriasObjetivo,
    macros: macrosObjetivo,
    plan_semanal: planSemanal,
    duracion_plan_dias: 30,
    mensaje_motivacional: mensajeMotivacional,
    minutos_sesion_gym: minutosSesion,
    dificultad: getDificultad(intensidad),
    dificultad_detalle: getDificultadDetalle(intensidad),
    training_plan: trainingPlan,
    lista_compras: generarListaCompras(tipoDieta),
    distribucion_diaria_pct: {
      desayuno: 25,
      almuerzo: 35,
      cena: 25,
      snacks: 15,
    },
  };
}

// ============================================================================
// FUNCIONES AUXILIARES
// ============================================================================

function generarPlanEntrenamiento(objetivo: string, intensidad: string): TrainingPlan {
  // Seleccionar training template según objetivo e intensidad
  const templates = (templateEntrenamientos as any)[objetivo];

  if (templates && templates[intensidad]) {
    return templates[intensidad];
  }

  // Fallback a full body si no existe combinación
  return {
    split: "Full Body 3x/week",
    weeks: [
      {
        week: 1,
        days: [
          {
            day: "Lunes - Full Body",
            ejercicios: [
              { name: "Sentadilla", sets: 3, reps: "8-10", muscle_group: "Piernas", rpe: 7 },
              { name: "Press de Banca", sets: 3, reps: "8-10", muscle_group: "Pecho", rpe: 7 },
              { name: "Remo", sets: 3, reps: "8-10", muscle_group: "Espalda", rpe: 7 },
            ],
          },
        ],
      },
    ],
  };
}

function generarProyecciones(
  user: UserInput,
  objetivo: string,
  caloriasDiarias: number
): { musculoGananciaMensual?: string; grasaPerdidaMensual?: string; proyecciones: string[], tiempoEstimado: string } {
  const proyecciones: string[] = [];
  const tdee = 2000; // Aproximado, el cálculo real viene del frontend

  if (objetivo.includes("ganar_masa") || objetivo.includes("volumen") || objetivo.includes("bulk")) {
    const superavit = caloriasDiarias - tdee;
    const gananciaMensual = Math.round((superavit * 30) / 7700);
    proyecciones.push(`Ganancia esperada: ${gananciaMensual}kg de peso (mayormente músculo + algo de grasa)`);
    proyecciones.push("Mantén consistencia en el entrenamiento de fuerza");
    proyecciones.push("Come en superávit de 300-500 kcal/día");
    return {
      musculoGananciaMensual: `${Math.max(0.5, gananciaMensual * 0.7)}-${gananciaMensual}kg`,
      proyecciones,
      tiempoEstimado: "3-4 meses para cambios visibles",
    };
  } else if (objetivo.includes("perder_grasa") || objetivo.includes("definicion") || objetivo.includes("corte")) {
    const deficit = tdee - caloriasDiarias;
    const perdidaMensual = Math.round((deficit * 30) / 7700);
    proyecciones.push(`Pérdida esperada: ${perdidaMensual}kg de grasa por mes`);
    proyecciones.push("Mantén proteína alta para preservar músculo");
    proyecciones.push("Camina 30-60 min diarios si es posible");
    return {
      grasaPerdidaMensual: `${Math.max(0.5, perdidaMensual * 0.8)}-${perdidaMensual}kg`,
      proyecciones,
      tiempoEstimado: "2-3 meses para ver definición clara",
    };
  } else {
    proyecciones.push("Mantén la consistencia con tu plan");
    proyecciones.push("Registra tu progreso semanalmente");
    proyecciones.push("Ajusta según cómo te sientas");
    return { proyecciones, tiempoEstimado: "Resultados visibles en 4-6 semanas" };
  }
}

function generarMensajMotivacional(user: UserInput, objetivo: string): string {
  const mensajes = {
    perder_grasa: `¡Hola ${user.nombre}! Tu plan está diseñado para ayudarte a perder grasa de forma sostenible. Recuerda que la consistencia es clave. Cada pequeño paso te acerca a tu objetivo.`,
    ganar_masa: `¡Hola ${user.nombre}! Este plan está optimizado para ayudarte a ganar masa muscular. Come con propósito, entrena con intensidad y descansa adecuadamente.`,
    mantener: `¡Hola ${user.nombre}! Este es tu plan para mantener tu peso y composición corporal. ¡Sigue disfrutando de una vida saludable!`,
    recomposicion: `¡Hola ${user.nombre}! Tu plan te ayudará a transformar tu cuerpo gradualmente. Paciencia y consistencia serán tus mejores aliados.`,
    definicion: `¡Hola ${user.nombre}! Este es tu plan de definición. Estarás trabajando duro para mostrar la musculatura que has construido. ¡Vamos!`,
    volumen: `¡Hola ${user.nombre}! Tu objetivo es maximizar la ganancia muscular. Come bien, entrena duro y duerme suficiente.`,
    lean_bulk: `¡Hola ${user.nombre}! Este plan te permitirá ganar músculo minimizando grasa. Es el camino más inteligente para transformarte.`,
    bulk_cut: `¡Hola ${user.nombre}! Comenzamos con la fase de volumen. Prepárate para trabajar duro y comer con propósito.`,
  };

  return (
    mensajes[objetivo as keyof typeof mensajes] ||
    `¡Hola ${user.nombre}! Tu plan personalizado está listo. ¡Vamos a lograrlo juntos!`
  );
}

function calcularMinutosSesion(intensidad: string): number {
  const minutos: Record<string, number> = {
    leve: 45,
    moderada: 60,
    intensa: 75,
    ultra: 90,
  };
  return minutos[intensidad] || 60;
}

function getDificultad(intensidad: string): "facil" | "media" | "dificil" {
  if (intensidad === "ultra" || intensidad === "intensa") return "dificil";
  if (intensidad === "moderada") return "media";
  return "facil";
}

function getDificultadDetalle(intensidad: string): string {
  const detalles: Record<string, string> = {
    leve: "Plan suave y sostenible. Ideal para comenzar o si buscas cambios graduales.",
    moderada: "Plan equilibrado. Balance perfecto entre resultados y sostenibilidad.",
    intensa: "Plan agresivo. Requiere disciplina pero ofrece resultados rápidos.",
    ultra: "Plan extremo. Solo para atletas comprometidos. Requiere experiencia previa.",
  };
  return detalles[intensidad] || "Plan balanceado";
}

function generarListaCompras(tipoDieta: string): string[] {
  const listas: Record<string, string[]> = {
    estandar: [
      "Huevos (2 docenas)",
      "Pechuga de pollo (1kg)",
      "Carne magra (500g)",
      "Salmón (400g)",
      "Arroz blanco (2kg)",
      "Arroz integral (1kg)",
      "Papa (2kg)",
      "Batata (1kg)",
      "Brócoli (2 ramilletes)",
      "Espinaca (500g)",
      "Tomates (1kg)",
      "Cebolla (500g)",
      "Ajo (100g)",
      "Aceite de oliva (1L)",
      "Queso (500g)",
      "Yogur (1L)",
      "Pan integral (1 barra)",
      "Avena (500g)",
      "Almendras (200g)",
      "Frutos secos variados (300g)",
    ],
    vegana: [
      "Tofu firme (2 bloques)",
      "Lentejas secas (500g)",
      "Garbanzos (500g)",
      "Arroz integral (2kg)",
      "Quinoa (500g)",
      "Papa (2kg)",
      "Batata (1kg)",
      "Brócoli (2 ramilletes)",
      "Espinaca (500g)",
      "Champiñones (500g)",
      "Cebolla (500g)",
      "Ajo (100g)",
      "Aceite de oliva (1L)",
      "Pan integral (1 barra)",
      "Leche de soja (1L)",
      "Leche de almendra (1L)",
      "Almendras (300g)",
      "Semillas de girasol (200g)",
      "Semillas de lino (100g)",
      "Frutas variadas (2kg)",
    ],
    keto: [
      "Huevos (3 docenas)",
      "Carne de res (1.5kg)",
      "Costillas (1kg)",
      "Salmón (500g)",
      "Queso variado (800g)",
      "Mantequilla (500g)",
      "Aguacate (6)",
      "Espinaca (500g)",
      "Brócoli (1 kg)",
      "Coliflor (1kg)",
      "Champiñones (500g)",
      "Tocino (300g)",
      "Jamón serrano (200g)",
      "Aceite de oliva (1L)",
      "Aceite de coco (200ml)",
      "Mayonesa (200g)",
      "Crema de leche (500ml)",
      "Bebidas zero calor.",
      "Nueces varias (300g)",
      "Olivas (200g)",
    ],
    mediterranea: [
      "Pez espada (400g)",
      "Salmón (400g)",
      "Mejillones (500g)",
      "Pollo (800g)",
      "Pasta integral (500g)",
      "Arroz integral (1kg)",
      "Papa (1kg)",
      "Tomate (2kg)",
      "Cebolla (500g)",
      "Ajo (150g)",
      "Aceite de oliva (1L)",
      "Queso feta (200g)",
      "Queso parmesano (300g)",
      "Yogur griego (800g)",
      "Pan integral (2 barras)",
      "Olivas (300g)",
      "Hierbas (orégano, romero, albahaca)",
      "Limones (6)",
      "Espinaca (500g)",
      "Berenjenas (500g)",
    ],
  };

  return listas[tipoDieta] || listas.estandar;
}
