/**
 * Sistema de Generación de Planes con Templates
 * Para usuarios gratuitos - Sin costo de API
 * 
 * Genera planes personalizados basados en templates y cálculos automáticos
 */

import type { UserInput, PlanAIResponse, TrainingPlan, Comida, DiaPlan, TrainingExercise, TrainingDayPlan } from "@/types/plan";
import { ensureMealMacrosAprox } from "@/lib/mealMacros";
import { templateComidasEn } from "@/lib/templateComidasEn";
import { filterUnsafeExercisesByDoloresLesiones } from "@/lib/trainingPlanGuards";
import { filterMealOptionsByRestrictions } from "@/lib/mealAllergenFilter";

/** Locale for template-based plan generation (API + templates). */
export type PlanGenerationLocale = "es" | "en";

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
  macrosObjetivo: { proteinas: string; grasas: string; carbohidratos: string },
  locale: PlanGenerationLocale = "es"
): Promise<PlanAIResponse> {
  const tipoDieta = user.tipoDieta || "estandar";
  const objetivo = user.objetivo;
  const intensidad = user.intensidad || "moderada";
  const dias =
    locale === "en"
      ? ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
      : ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

  // 1. Seleccionar templates de comidas
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- diet templates share shape; keys differ by language
  const comidasTemplate =
    locale === "en"
      ? ((templateComidasEn as any)[tipoDieta] || templateComidasEn.estandar)
      : ((templateComidas as any)[tipoDieta] || templateComidas.estandar);

  const mealSlots =
    locale === "en"
      ? [
          { hora: "07:00", nombre: "Breakfast" },
          { hora: "10:00", nombre: "Snack 1" },
          { hora: "13:00", nombre: "Lunch" },
          { hora: "16:00", nombre: "Snack 2" },
          { hora: "19:30", nombre: "Dinner" },
        ]
      : [
          { hora: "07:00", nombre: "Desayuno" },
          { hora: "10:00", nombre: "Merienda 1" },
          { hora: "13:00", nombre: "Almuerzo" },
          { hora: "16:00", nombre: "Merienda 2" },
          { hora: "19:30", nombre: "Cena" },
        ];

  // 2. Generar plan semanal con comidas variadas
  const planSemanal: DiaPlan[] = dias.map((dia, index) => {
    const desayunoOpc = comidasTemplate.desayuno[index % comidasTemplate.desayuno.length];
    const almuerzoOpc = comidasTemplate.almuerzo[index % comidasTemplate.almuerzo.length];
    const meriendasOpc = comidasTemplate.merienda[index % comidasTemplate.merienda.length];
    const cenaOpc = comidasTemplate.cena[index % comidasTemplate.cena.length];

    // Las plantillas estáticas son fijas por tipoDieta y no sabían nada de
    // restricciones/alergias declaradas por el usuario — a diferencia del
    // flujo Premium (generatePlan.ts), que se lo pide a la IA en el prompt.
    // Filtrar acá evita servir, por ejemplo, salmón a alguien con alergia a
    // pescados solo porque eligió dieta "estándar".
    const filtrar = (opciones: string[]) => filterMealOptionsByRestrictions(opciones, user.restricciones, locale);

    return {
      dia,
      comidas: [
        { hora: mealSlots[0].hora, nombre: mealSlots[0].nombre, opciones: filtrar(desayunoOpc.opciones) },
        { hora: mealSlots[1].hora, nombre: mealSlots[1].nombre, opciones: filtrar(meriendasOpc.opciones) },
        { hora: mealSlots[2].hora, nombre: mealSlots[2].nombre, opciones: filtrar(almuerzoOpc.opciones) },
        { hora: mealSlots[3].hora, nombre: mealSlots[3].nombre, opciones: filtrar([meriendasOpc.opciones[0]]) },
        { hora: mealSlots[4].hora, nombre: mealSlots[4].nombre, opciones: filtrar(cenaOpc.opciones) },
      ],
    };
  });

  ensureMealMacrosAprox(planSemanal as unknown as Array<Record<string, unknown>>, {
    proteinas: macrosObjetivo.proteinas,
    grasas: macrosObjetivo.grasas,
    carbohidratos: macrosObjetivo.carbohidratos,
  });

  // 3. Seleccionar plan de entrenamiento
  const diasGym = typeof user.diasGym === 'number' && user.diasGym > 0 ? user.diasGym : 3;
  const nivel = user.nivelExperiencia || "intermedio";
  const equip = user.equipamiento || "gimnasio";
  let trainingPlan = generarPlanEntrenamiento(objetivo, intensidad, nivel, equip);
  console.log(`📐 [TEMPLATES] Plan seleccionado tiene ${trainingPlan.weeks?.[0]?.days?.length || 0} días; usuario pide ${diasGym} días/semana (nivel=${nivel}, equipo=${equip})`);
  trainingPlan = ajustarDiasEntrenamiento(trainingPlan, diasGym, locale);

  // reorganizar según distribución muscular ideal para el número de días
  trainingPlan = distribuirGruposMusculares(trainingPlan, diasGym, objetivo, intensidad, equip, locale);

  // después de la distribución y regeneración, aplicar variación para mezclar
  trainingPlan = aplicarVariacionEjercicios(trainingPlan);

  // aplicar modificaciones según equipamiento
  if (equip === "sin_equipo") {
    trainingPlan = aplicarFiltroSinEquipo(trainingPlan);
  }

  // Igual que en el flujo Premium: sacar ejercicios inseguros para las
  // lesiones/dolores reportados (hernia de disco, lumbar, rodilla, hombro).
  // Las plantillas estáticas nunca leían doloresLesiones — un usuario free
  // con hernia de disco podía recibir peso muerto/sentadillas sin adaptar.
  if (user.doloresLesiones && user.doloresLesiones.length > 0) {
    for (const week of trainingPlan.weeks || []) {
      for (const day of week.days || []) {
        day.ejercicios = filterUnsafeExercisesByDoloresLesiones(day.ejercicios || [], user.doloresLesiones);
      }
    }
  }

  console.log(`📐 [TEMPLATES] Después de ajuste, el plan tendrá ${trainingPlan.weeks?.[0]?.days?.length || 0} días`);
  // mark for debugging
  (trainingPlan as any)._debug = true;

  // 4. Generar proyecciones motivacionales
  const proyecciones = generarProyecciones(user, objetivo, caloriasObjetivo, locale);

  // 5. Mensaje motivacional
  const mensajeMotivacional = generarMensajMotivacional(user, objetivo, locale);

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
    dificultad_detalle: getDificultadDetalle(intensidad, locale),
    training_plan: trainingPlan,
    // include debug copy so frontend can log full structure
    _debug_training_plan: trainingPlan,
    lista_compras: generarListaCompras(tipoDieta, locale),
    proyecciones,
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

function generarPlanEntrenamiento(objetivo: string, intensidad: string, nivel: string = "intermedio", equipamiento: string = "gimnasio"): TrainingPlan {
  // Seleccionar training template según objetivo e intensidad
  // Mapear objetivos similares a los templates disponibles
  console.log(`📋 [TEMPLATES] Generando entrenamiento: objetivo="${objetivo}" intensidad="${intensidad}" nivel="${nivel}" equipo="${equipamiento}"`);
  
  let objetivoNormalizado = objetivo.toLowerCase();
  
  // Mapear definicion, corte, lean_bulk → perder_grasa
  if (objetivoNormalizado.includes("definicion") || objetivoNormalizado.includes("corte") || objetivoNormalizado.includes("lean_bulk")) {
    objetivoNormalizado = "perder_grasa";
    console.log(`📋 [TEMPLATES] Objetivo mapeado a perder_grasa`);
  }
  // Mapear volumen, bulk, ganar_musculo → ganar_masa
  else if (objetivoNormalizado.includes("volumen") || objetivoNormalizado.includes("bulk") || objetivoNormalizado.includes("ganar_musculo")) {
    objetivoNormalizado = "ganar_masa";
    console.log(`📋 [TEMPLATES] Objetivo mapeado a ganar_masa`);
  }
  // Mapear mantenimiento a moderada de perder_grasa (puedo personalizar si necesitas)
  else if (objetivoNormalizado.includes("mantenimiento")) {
    objetivoNormalizado = "perder_grasa";
    intensidad = "moderada";
    console.log(`📋 [TEMPLATES] Objetivo mapeado a perder_grasa con intensidad moderada`);
  }
  
  // Normalizar intensidad
  let intensidadNormalizada = intensidad.toLowerCase();
  if (intensidadNormalizada.includes("alta") || intensidadNormalizada.includes("intensa")) {
    intensidadNormalizada = "moderada";
    console.log(`📋 [TEMPLATES] Intensidad normalizada a moderada (era intensa)`);
  } else if (intensidadNormalizada.includes("baja") || intensidadNormalizada.includes("light")) {
    intensidadNormalizada = "leve";
    console.log(`📋 [TEMPLATES] Intensidad normalizada a leve (era baja)`);
  } else {
    intensidadNormalizada = "moderada";
  }
  
  const templates = (templateEntrenamientos as any)[objetivoNormalizado];
  console.log(`📋 [TEMPLATES] Buscando template: ${objetivoNormalizado}/${intensidadNormalizada}`);

  if (templates && templates[intensidadNormalizada]) {
    const selectedTemplate = templates[intensidadNormalizada];
    console.log(`✅ [TEMPLATES] Template encontrado: ${objetivoNormalizado}/${intensidadNormalizada} - ${selectedTemplate.weeks?.[0]?.days?.length || 0} días`);
    return selectedTemplate;
  }

  // Fallback: si no existe, usar el primero disponible
  if (templates) {
    const primeraIntensidad = Object.keys(templates)[0];
    console.log(`⚠️ [TEMPLATES] Fallback: usando ${objetivoNormalizado}/${primeraIntensidad}`);
    return templates[primeraIntensidad];
  }

  // Último fallback a full body si no existe objetivo
  console.warn(`⚠️ [TEMPLATES] No se encontró objetivo "${objetivo}", fallback a Full Body básico`);
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

// Ajusta un plan de entrenamiento para que tenga exactamente `diasGym` días a la
// semana. Si el template original tiene más días, se recorta. Si tiene menos,
// se rellenan con copias de los ejercicios existentes pero se distribuyen en otros
// días de la semana evitando nombres duplicados para que el calendario pueda
// mapearlos correctamente.
function ajustarDiasEntrenamiento(plan: TrainingPlan, diasGym: number, locale: PlanGenerationLocale = "es"): TrainingPlan {
  if (!plan.weeks) return plan;

  const weekdays = [
    "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo",
  ];
  const dayPrefix = locale === "en" ? "Day" : "Día";

const nuevasWeeks = plan.weeks.map((week, weekIdx) => {
    const originalDays = week.days || [];
    // filtramos sólo los días con ejercicios
    const ejerciciosDays = originalDays.filter(d => d.ejercicios && d.ejercicios.length > 0);

    const resultDays: TrainingDayPlan[] = [];
    // clonamos lista para poder sacar elementos usados en fallback
    const unused = [...ejerciciosDays];

    for (const wd of weekdays) {
      if (resultDays.length >= diasGym) break;
      // buscar día que coincida con el weekday y que no hayamos incluido ya
      const foundIndex = ejerciciosDays.findIndex(
        (d) => d.day.startsWith(wd) && !resultDays.includes(d)
      );
      if (foundIndex !== -1) {
        const found = ejerciciosDays[foundIndex];
        const suffix = found.day.includes("-") ? found.day.substring(found.day.indexOf("-")) : "";
        resultDays.push({ ...found, day: `${wd} ${suffix}`.trim() });
        // marcar como usado también en unused
        const ui = unused.indexOf(found);
        if (ui !== -1) unused.splice(ui, 1);
      } else if (unused.length > 0) {
        // usar el siguiente sin usar
        const source = unused.shift()!;
        const suffix = source.day.includes("-") ? source.day.substring(source.day.indexOf("-")) : "";
        resultDays.push({ ...source, day: `${wd} ${suffix}`.trim() });
      } else if (ejerciciosDays.length > 0) {
        // si ya se acabaron los sin usar, rotar entre los originales
        const source = ejerciciosDays[resultDays.length % ejerciciosDays.length];
        const suffix = source.day.includes("-") ? source.day.substring(source.day.indexOf("-")) : "";
        resultDays.push({ ...source, day: `${wd} ${suffix}`.trim() });
      }
    }

    while (resultDays.length < diasGym) {
      const last = resultDays[resultDays.length - 1] || { day: weekdays[resultDays.length] || dayPrefix, ejercicios: [] };
      const wd = weekdays[resultDays.length % weekdays.length];
      resultDays.push({ ...last, day: wd });
    }

    // renombrar días de la semana a "Día 1", "Día 2", etc. por semana
    // y asignar un weekday numérico para facilitar el mapeo en el calendario
    const renombrados = resultDays.map((d, idx) => {
      // calcular día de la semana básico (lunes=1 por defecto)
      const spacing = Math.floor(7 / diasGym) || 1;
      const weekday = (1 + idx * spacing) % 7; // 0=domingo
      return { ...d, day: `${dayPrefix} ${idx + 1}`, weekday } as any;
    });

    return { ...week, days: renombrados };
  });

  let newSplit = plan.split;
  if (newSplit) {
    newSplit = newSplit.replace(/\d+x\/week/, `${diasGym}x/week`);
  }

  return { ...plan, weeks: nuevasWeeks, split: newSplit };
}

// Reemplaza algunos ejercicios por alternativas sin equipo si el usuario no dispone de
// gimnasio. Simple y minimalista, solo cubre algunos movimientos comunes.
function aplicarFiltroSinEquipo(plan: TrainingPlan): TrainingPlan {
  const reemplazos: Record<string, string> = {
    "Press de Banca": "Flexiones de suelo",
    "Press Inclinado": "Flexiones inclinadas",
    "Press de Hombro": "Pike push-ups",
    "Remo": "Remo invertido",
    "Jalón Lateral": "Pull-ups asistidas o remo invertido",
    "Sentadilla": "Sentadilla sin peso (air squat)",
    "Peso Muerto": "Peso muerto a una pierna (pistol squat asist"+"ido)",
  };

  const newWeeks = plan.weeks.map(week => ({
    ...week,
    days: week.days?.map(day => ({
      ...day,
      ejercicios: day.ejercicios?.map(ex => {
        const reemplazo = reemplazos[ex.name];
        if (reemplazo) {
          return { ...ex, name: `${reemplazo} (sin equipo)` };
        }
        return ex;
      })
    }))
  }));

  return { ...plan, weeks: newWeeks };
}

function generarProyecciones(
  user: UserInput,
  objetivo: string,
  caloriasDiarias: number,
  locale: PlanGenerationLocale = "es"
): { musculoGananciaMensual?: string; grasaPerdidaMensual?: string; proyecciones: string[], tiempoEstimado: string } {
  const proyecciones: string[] = [];
  const tdee = 2000; // Aproximado, el cálculo real viene del frontend
  const en = locale === "en";

  if (objetivo.includes("ganar_masa") || objetivo.includes("volumen") || objetivo.includes("bulk")) {
    const superavit = caloriasDiarias - tdee;
    const gananciaMensual = Math.round((superavit * 30) / 7700);
    proyecciones.push(
      en
        ? `Expected gain: ${gananciaMensual} kg/month (mostly muscle + some fat)`
        : `Ganancia esperada: ${gananciaMensual}kg de peso (mayormente músculo + algo de grasa)`
    );
    proyecciones.push(en ? "Stay consistent with strength training" : "Mantén consistencia en el entrenamiento de fuerza");
    proyecciones.push(en ? "Eat in a 300–500 kcal/day surplus" : "Come en superávit de 300-500 kcal/día");
    return {
      musculoGananciaMensual: `${Math.max(0.5, gananciaMensual * 0.7)}-${gananciaMensual}kg`,
      proyecciones,
      tiempoEstimado: en ? "3–4 months for visible changes" : "3-4 meses para cambios visibles",
    };
  } else if (objetivo.includes("perder_grasa") || objetivo.includes("definicion") || objetivo.includes("corte")) {
    const deficit = tdee - caloriasDiarias;
    const perdidaMensual = Math.round((deficit * 30) / 7700);
    proyecciones.push(
      en
        ? `Expected fat loss: ~${perdidaMensual} kg/month`
        : `Pérdida esperada: ${perdidaMensual}kg de grasa por mes`
    );
    proyecciones.push(en ? "Keep protein high to preserve muscle" : "Mantén proteína alta para preservar músculo");
    proyecciones.push(en ? "Walk 30–60 minutes daily if possible" : "Camina 30-60 min diarios si es posible");
    return {
      grasaPerdidaMensual: `${Math.max(0.5, perdidaMensual * 0.8)}-${perdidaMensual}kg`,
      proyecciones,
      tiempoEstimado: en ? "2–3 months for clear definition" : "2-3 meses para ver definición clara",
    };
  } else {
    proyecciones.push(en ? "Stay consistent with your plan" : "Mantén la consistencia con tu plan");
    proyecciones.push(en ? "Log your progress weekly" : "Registra tu progreso semanalmente");
    proyecciones.push(en ? "Adjust based on how you feel" : "Ajusta según cómo te sientas");
    return { proyecciones, tiempoEstimado: en ? "Visible results in 4–6 weeks" : "Resultados visibles en 4-6 semanas" };
  }
}

function generarMensajMotivacional(user: UserInput, objetivo: string, locale: PlanGenerationLocale = "es"): string {
  const n = user.nombre || "";
  if (locale === "en") {
    const mensajesEn: Record<string, string> = {
      perder_grasa: `Hi ${n}! Your plan is built for sustainable fat loss. Consistency is key—every small step counts.`,
      ganar_masa: `Hi ${n}! This plan is tuned for muscle gain. Eat with intent, train hard, and recover well.`,
      mantener: `Hi ${n}! This plan helps you maintain weight and body composition. Keep enjoying a healthy lifestyle.`,
      recomposicion: `Hi ${n}! Your plan supports gradual body recomposition. Patience and consistency win.`,
      definicion: `Hi ${n}! This is your definition phase—you’ll work hard to show the muscle you’ve built.`,
      volumen: `Hi ${n}! Your goal is maximum hypertrophy. Fuel well, train hard, sleep enough.`,
      lean_bulk: `Hi ${n}! Lean bulk: gain muscle while limiting fat gain—a smart path.`,
      bulk_cut: `Hi ${n}! We start with a volume phase. Get ready to train hard and eat with purpose.`,
    };
    return (
      mensajesEn[objetivo] ||
      `Hi ${n}! Your personalized plan is ready—let’s go.`
    );
  }

  const mensajes = {
    perder_grasa: `¡Hola ${n}! Tu plan está diseñado para ayudarte a perder grasa de forma sostenible. Recuerda que la consistencia es clave. Cada pequeño paso te acerca a tu objetivo.`,
    ganar_masa: `¡Hola ${n}! Este plan está optimizado para ayudarte a ganar masa muscular. Come con propósito, entrena con intensidad y descansa adecuadamente.`,
    mantener: `¡Hola ${n}! Este es tu plan para mantener tu peso y composición corporal. ¡Sigue disfrutando de una vida saludable!`,
    recomposicion: `¡Hola ${n}! Tu plan te ayudará a transformar tu cuerpo gradualmente. Paciencia y consistencia serán tus mejores aliados.`,
    definicion: `¡Hola ${n}! Este es tu plan de definición. Estarás trabajando duro para mostrar la musculatura que has construido. ¡Vamos!`,
    volumen: `¡Hola ${n}! Tu objetivo es maximizar la ganancia muscular. Come bien, entrena duro y duerme suficiente.`,
    lean_bulk: `¡Hola ${n}! Este plan te permitirá ganar músculo minimizando grasa. Es el camino más inteligente para transformarte.`,
    bulk_cut: `¡Hola ${n}! Comenzamos con la fase de volumen. Prepárate para trabajar duro y comer con propósito.`,
  };

  return (
    mensajes[objetivo as keyof typeof mensajes] ||
    `¡Hola ${n}! Tu plan personalizado está listo. ¡Vamos a lograrlo juntos!`
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


// pool de ejercicios alternativos por grupo muscular (usado para completar días pequeños)
const ejercicioPool: Record<string, string[]> = {
  Piernas: [
    "Sentadilla frontal",
    "Leg Press",
    "Curl Femoral",
    "Extensiones de Piernas",
    "Prensa de Piernas",
    "Pantorrillas"
  ],
  Pecho: [
    "Press de Banca",
    "Press Inclinado",
    "Fondos en paralelas",
    "Aperturas con mancuernas",
    "Prensa de Pecho"
  ],
  Espalda: [
    "Remo con barra",
    "Jalón Lateral",
    "Peso Muerto",
    "Pull Ups",
    "Remo con mancuerna"
  ],
  Hombros: [
    "Press Militar",
    "Elevación Lateral",
    "Elevación Frontal",
    "Face Pull",
    "Remo al cuello"
  ],
  Bíceps: [
    "Curl con barra",
    "Curl con mancuernas",
    "Curl martillo",
    "Curl concentrado"
  ],
  Tríceps: [
    "Press francés",
    "Extensión de tríceps detrás de la cabeza",
    "Fondos en paralelas",
    "Patada de tríceps"
  ],
  Abdominales: [
    "Crunch",
    "Plank",
    "Elevación de piernas",
    "Bicicleta"
  ],
};

function applyMuscleVariation(day: any) {
  if (!day.ejercicios) return;
  // agrupar por muscle_group
  const byMuscle: Record<string, any[]> = {};
  day.ejercicios.forEach((ex: any) => {
    const mu = ex.muscle_group || "General";
    if (!byMuscle[mu]) byMuscle[mu] = [];
    byMuscle[mu].push(ex);
  });

  Object.entries(byMuscle).forEach(([muscle, list]) => {
    while (list.length < 3) {
      // buscar en pool un nombre no usado
      const pool = ejercicioPool[muscle] || [];
      const disponibles = pool.filter(n => !list.some(e => e.name === n));
      let nombre: string;
      if (disponibles.length > 0) {
        nombre = disponibles[Math.floor(Math.random() * disponibles.length)];
      } else if (list.length > 0) {
        nombre = list[0].name + " (variante)";
      } else {
        nombre = "Ejercicio adicional";
      }
      const nuevo = { name: nombre, sets: 3, reps: "10-12", muscle_group: muscle, rpe: 6 };
      day.ejercicios.push(nuevo);
      list.push(nuevo);
    }
  });

  // mezclar orden
  day.ejercicios = day.ejercicios.sort(() => Math.random() - 0.5);
}

function aplicarVariacionEjercicios(plan: TrainingPlan): TrainingPlan {
  // recorrer todas las semanas y días y enriquecer con variación
  const newWeeks = plan.weeks.map(week => {
    const seen = new Set<string>();
    const days = week.days?.map(day => {
      applyMuscleVariation(day);
      // asegurar que este día no tenga el mismo conjunto de nombres que otro día
      let key = (day.ejercicios || []).map(e => e.name).join(",");
      // si ya existe, intentar rotar la lista para crear una orden distinta
      if (seen.has(key) && day.ejercicios) {
        const exs = day.ejercicios;
        for (let r = 1; r < exs.length && seen.has(key); r++) {
          day.ejercicios = [...exs.slice(r), ...exs.slice(0, r)];
          key = day.ejercicios.map(e => e.name).join(",");
        }
      }
      // Si aún coincide, añadir sufijo al primer ejercicio
      if (seen.has(key) && day.ejercicios && day.ejercicios.length > 0) {
        day.ejercicios[0].name += " (extra)";
        key = (day.ejercicios || []).map(e => e.name).join(",");
      }
      // última medida: agregar un ejercicio dummy único
      if (seen.has(key)) {
        const uniqueName = `Ejercicio único ${Math.random().toString(36).substring(2, 8)}`;
        day.ejercicios = day.ejercicios || [];
        day.ejercicios.push({ name: uniqueName, sets: 1, reps: "10", muscle_group: "General" });
        key = (day.ejercicios || []).map(e => e.name).join(",");
      }
      seen.add(key);
      return day;
    });
    return { ...week, days };
  });
  return { ...plan, weeks: newWeeks };
}


/** 1–3 días: full body cada sesión. 4–5: piernas → pecho/trí → espalda/bí → hombros+abd (+ quinto día accesorios). */
function getDayAssignments(diasGym: number): string[][] {
  const fullBody = ["Pecho", "Espalda", "Piernas", "Hombros", "Bíceps", "Tríceps", "Abdominales"];
  switch (diasGym) {
    case 1:
      return [fullBody];
    case 2:
      return [fullBody, fullBody];
    case 3:
      return [fullBody, fullBody, fullBody];
    case 4:
      return [["Piernas"], ["Pecho", "Tríceps"], ["Espalda", "Bíceps"], ["Hombros", "Abdominales"]];
    case 5:
      return [
        ["Piernas"],
        ["Pecho", "Tríceps"],
        ["Espalda", "Bíceps"],
        ["Hombros", "Abdominales"],
        ["Bíceps", "Tríceps", "Gemelos", "Abdominales"],
      ];
    case 6:
      return [["Pecho", "Tríceps"], ["Espalda", "Bíceps"], ["Piernas"], ["Hombros"], ["Abdominales"], ["Pecho", "Espalda"]];
    default: {
      const groups = ["Pecho", "Espalda", "Piernas", "Hombros", "Bíceps", "Tríceps", "Abdominales"];
      const res: string[][] = [];
      for (let i = 0; i < diasGym; i++) {
        res.push([groups[i % groups.length]]);
      }
      return res;
    }
  }
}

function getDaySplitLabel(diasGym: number, dayIndex: number, locale: PlanGenerationLocale = "es"): string {
  const dayWord = locale === "en" ? "Day" : "Día";
  if (diasGym >= 1 && diasGym <= 3) return "Full Body";
  if (diasGym === 4) {
    const labels =
      locale === "en"
        ? ["Legs", "Chest & triceps", "Back & biceps", "Shoulders & abs (+ cardio)"]
        : ["Piernas", "Pecho y tríceps", "Espalda y bíceps", "Hombros y abdomen (+ cardio)"];
    return labels[dayIndex] ?? `${dayWord} ${dayIndex + 1}`;
  }
  if (diasGym === 5) {
    const labels =
      locale === "en"
        ? [
            "Legs",
            "Chest & triceps",
            "Back & biceps",
            "Shoulders & abs (+ cardio)",
            "Arms, calves & core (+ optional HIIT)",
          ]
        : [
            "Piernas",
            "Pecho y tríceps",
            "Espalda y bíceps",
            "Hombros y abdomen (+ cardio)",
            "Brazos, gemelos y core (+ HIIT opcional)",
          ];
    return labels[dayIndex] ?? `${dayWord} ${dayIndex + 1}`;
  }
  return `${dayWord} ${dayIndex + 1}`;
}

function getWeekOrderRationale(diasGym: number, locale: PlanGenerationLocale = "es"): string {
  if (locale === "en") {
    if (diasGym >= 1 && diasGym <= 3) {
      return [
        "With 1–3 sessions/week, Full Body hits the whole body each session.",
        "Compounds first (legs/back/chest) when energy is highest; core last.",
        "Lower frequency means more volume per session; light cardio at the end for adherence without excess neural fatigue.",
      ].join(" ");
    }
    if (diasGym === 4) {
      return [
        "Order: legs → chest/triceps → back/biceps → shoulders/abs.",
        "Legs early in the microcycle for freshness on heavy loads; push and pull split for recovery.",
        "Shoulders + abs last to avoid interfering with chest press; LISS cardio after shoulders day when heavy volume is lower.",
      ].join(" ");
    }
    if (diasGym === 5) {
      return [
        "Same logic as 4 days plus a fifth accessories day (arms, calves, core) or short HIIT by level.",
        "Adds volume without over-duplicating big-muscle work on consecutive days.",
      ].join(" ");
    }
    return "Weekly layout adapted to frequency and goal.";
  }
  if (diasGym >= 1 && diasGym <= 3) {
    return [
      "Con 1–3 sesiones semanales se usa Full Body para estimular todo el cuerpo en cada entreno.",
      "Compuestos primero (piernas/espalda/pecho) cuando la energía es mayor; core al final.",
      "Poca frecuencia implica más volumen por sesión; se añade cardio ligero al cierre para adherencia sin sumar fatiga neural alta.",
    ].join(" ");
  }
  if (diasGym === 4) {
    return [
      "Orden: piernas → pecho/tríceps → espalda/bíceps → hombros/abdominales.",
      "Las piernas van al inicio de la microciclo para aprovechar frescura en cargas grandes; empuje y tirón van separados para recuperación.",
      "Hombros con abdomen al final para no interferir con el press de pecho; cardio LISS al cierre del día de hombros cuando el volumen de grandes cargas es menor.",
    ].join(" ");
  }
  if (diasGym === 5) {
    return [
      "Misma lógica que 4 días con un quinto día de accesorios (brazos, gemelos, core) o HIIT corto según nivel.",
      "Esto suma volumen sin duplicar demasiado el trabajo de grandes grupos en días consecutivos.",
    ].join(" ");
  }
  return "Distribución semanal adaptada a la frecuencia y al objetivo.";
}

function muscleGroupDisplay(mus: string, locale: PlanGenerationLocale): string {
  if (locale === "es") return mus;
  const m: Record<string, string> = {
    Piernas: "Legs",
    Pecho: "Chest",
    Espalda: "Back",
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
  return m[mus] || mus;
}

// Construye un pool de ejercicios por músculo basado en la plantilla actual
function buildExercisePool(objetivo: string, intensidad: string): Record<string, string[]> {
  const pool: Record<string, string[]> = { ...ejercicioPool };
  try {
    const template = (templateEntrenamientos as any)[objetivo]?.[intensidad];
    if (template && template.weeks && template.weeks.length > 0) {
      template.weeks[0].days?.forEach((day: any) => {
        day.ejercicios?.forEach((ex: any) => {
          if (ex.muscle_group) {
            pool[ex.muscle_group] = pool[ex.muscle_group] || [];
            if (!pool[ex.muscle_group].includes(ex.name)) {
              pool[ex.muscle_group].push(ex.name);
            }
          }
        });
      });
    }
  } catch {
    // ignoramos si falla la lectura
  }
  return pool;
}

// genera un plan de entrenamiento redistribuido por grupos musculares
function distribuirGruposMusculares(
  plan: TrainingPlan,
  diasGym: number,
  objetivo: string,
  intensidad: string,
  equipamiento: string,
  locale: PlanGenerationLocale = "es"
): TrainingPlan {
  const assignments = getDayAssignments(diasGym);
  const pool = buildExercisePool(objetivo, intensidad);
  const maxExPerMuscle = diasGym <= 3 ? 1 : 2;
  const en = locale === "en";
  const dayLabel = (idx: number) => (en ? `Day ${idx + 1}` : `Día ${idx + 1}`);
  // aplicar filtro de equipo si corresponde
  if (equipamiento === "sin_equipo") {
    // quitar ejercicios que mencionen "Press" o barras etc.
    Object.keys(pool).forEach(m => {
      pool[m] = pool[m].filter(n => !/Press|Barra|Dumbbell|Peso|Deadlift|Pull/.test(n));
    });
  }

  const splitTitle = en
    ? diasGym <= 3
      ? `Full Body (${diasGym}x/week)`
      : diasGym === 4
        ? "Bro split 4 days (legs / push / pull / shoulders+abs)"
        : diasGym === 5
          ? "Bro split 5 days (+ arms/calves/core)"
          : plan.split || "Custom"
    : diasGym <= 3
      ? `Full Body (${diasGym}x/semana)`
      : diasGym === 4
        ? "Bro split 4 días (piernas / pecho-trí / espalda-bí / hombros-abd)"
        : diasGym === 5
          ? "Bro split 5 días (+ brazos/gemelos/core)"
          : plan.split || "Personalizado";

  const newWeeks = plan.weeks.map(week => {
    const days = assignments.map((grupos, idx) => {
      const ejercicios: TrainingExercise[] = [];
      grupos.forEach(mus => {
        const list = pool[mus] ? [...pool[mus]] : [];
        const used: Set<string> = new Set();
        for (let i = 0; i < maxExPerMuscle && list.length > 0; i++) {
          const choice = list.splice(Math.floor(Math.random() * list.length), 1)[0];
          if (choice && !used.has(choice)) {
            ejercicios.push({ name: choice, sets: 3, reps: "10-12", muscle_group: mus, rpe: 7 });
            used.add(choice);
          }
        }
        if (!used.size) {
          ejercicios.push({
            name: en ? `${muscleGroupDisplay(mus, locale)} basics` : `${mus} básico`,
            sets: 3,
            reps: "10-12",
            muscle_group: mus,
            rpe: 6,
          });
        }
      });

      if (diasGym <= 3) {
        ejercicios.push({
          name: en
            ? "Easy cardio (bike, elliptical, or incline walk)"
            : "Cardio suave (bici, elíptica o caminata inclinada)",
          sets: 1,
          reps: "10-15 min",
          muscle_group: "Cardio",
          rest_seconds: 0,
          technique: en
            ? "Moderate intensity—you should be able to talk with mild effort"
            : "Intensidad moderada; debes poder hablar con algo de esfuerzo",
        });
      } else if (diasGym === 4 && idx === 3) {
        ejercicios.push({
          name: en ? "LISS cardio (bike or incline walk)" : "Cardio LISS (bici o caminata inclinada)",
          sets: 1,
          reps: "10-15 min",
          muscle_group: "Cardio",
          rest_seconds: 0,
        });
      } else if (diasGym === 5 && idx === 3) {
        ejercicios.push({
          name: en ? "Moderate LISS cardio" : "Cardio LISS moderado",
          sets: 1,
          reps: "8-14 min",
          muscle_group: "Cardio",
          rest_seconds: 0,
        });
      } else if (diasGym === 5 && idx === 4) {
        ejercicios.push({
          name: en ? "Optional HIIT (rope or bike)" : "HIIT opcional (cuerda o bicicleta)",
          sets: 1,
          reps: "10-12 min",
          muscle_group: "Cardio",
          rest_seconds: 0,
          technique: en
            ? "Alternate 30s hard / 60s easy only if your joints and level allow it"
            : "Alterna 30s fuerte / 60s suave solo si tu nivel y articulaciones lo permiten",
        });
      }

      return {
        day: dayLabel(idx),
        split: getDaySplitLabel(diasGym, idx, locale),
        warmup: undefined,
        ejercicios,
      } as TrainingDayPlan;
    });
    return { ...week, days };
  });
  return {
    ...plan,
    split: splitTitle,
    week_order_rationale: getWeekOrderRationale(diasGym, locale),
    weeks: newWeeks,
  };
}


function getDificultadDetalle(intensidad: string, locale: PlanGenerationLocale = "es"): string {
  if (locale === "en") {
    const detalles: Record<string, string> = {
      leve: "Gentle, sustainable plan—great to start or for gradual change.",
      moderada: "Balanced plan—solid mix of results and sustainability.",
      intensa: "Aggressive plan—requires discipline and delivers faster results.",
      ultra: "Extreme plan—for committed athletes with prior experience.",
    };
    return detalles[intensidad] || "Balanced plan";
  }
  const detalles: Record<string, string> = {
    leve: "Plan suave y sostenible. Ideal para comenzar o si buscas cambios graduales.",
    moderada: "Plan equilibrado. Balance perfecto entre resultados y sostenibilidad.",
    intensa: "Plan agresivo. Requiere disciplina pero ofrece resultados rápidos.",
    ultra: "Plan extremo. Solo para atletas comprometidos. Requiere experiencia previa.",
  };
  return detalles[intensidad] || "Plan balanceado";
}

function generarListaCompras(tipoDieta: string, locale: PlanGenerationLocale = "es"): string[] {
  const listasEn: Record<string, string[]> = {
    estandar: [
      "Eggs (2 dozen)",
      "Chicken breast (1kg)",
      "Lean beef (500g)",
      "Salmon (400g)",
      "White rice (2kg)",
      "Brown rice (1kg)",
      "Potatoes (2kg)",
      "Sweet potato (1kg)",
      "Broccoli (2 heads)",
      "Spinach (500g)",
      "Tomatoes (1kg)",
      "Onion (500g)",
      "Garlic (100g)",
      "Olive oil (1L)",
      "Cheese (500g)",
      "Yogurt (1L)",
      "Whole-wheat bread (1 loaf)",
      "Oats (500g)",
      "Almonds (200g)",
      "Mixed nuts (300g)",
    ],
    vegana: [
      "Firm tofu (2 blocks)",
      "Dry lentils (500g)",
      "Chickpeas (500g)",
      "Brown rice (2kg)",
      "Quinoa (500g)",
      "Potatoes (2kg)",
      "Sweet potato (1kg)",
      "Broccoli (2 heads)",
      "Spinach (500g)",
      "Mushrooms (500g)",
      "Onion (500g)",
      "Garlic (100g)",
      "Olive oil (1L)",
      "Whole-wheat bread (1 loaf)",
      "Soy milk (1L)",
      "Almond milk (1L)",
      "Almonds (300g)",
      "Sunflower seeds (200g)",
      "Flax seeds (100g)",
      "Mixed fruit (2kg)",
    ],
    keto: [
      "Eggs (3 dozen)",
      "Beef (1.5kg)",
      "Pork ribs (1kg)",
      "Salmon (500g)",
      "Assorted cheese (800g)",
      "Butter (500g)",
      "Avocado (6)",
      "Spinach (500g)",
      "Broccoli (1 kg)",
      "Cauliflower (1kg)",
      "Mushrooms (500g)",
      "Bacon (300g)",
      "Serrano ham (200g)",
      "Olive oil (1L)",
      "Coconut oil (200ml)",
      "Mayonnaise (200g)",
      "Heavy cream (500ml)",
      "Zero-calorie drinks",
      "Mixed nuts (300g)",
      "Olives (200g)",
    ],
    mediterranea: [
      "Swordfish (400g)",
      "Salmon (400g)",
      "Mussels (500g)",
      "Chicken (800g)",
      "Whole-wheat pasta (500g)",
      "Brown rice (1kg)",
      "Potatoes (1kg)",
      "Tomatoes (2kg)",
      "Onion (500g)",
      "Garlic (150g)",
      "Olive oil (1L)",
      "Feta cheese (200g)",
      "Parmesan (300g)",
      "Greek yogurt (800g)",
      "Whole-wheat bread (2 loaves)",
      "Olives (300g)",
      "Herbs (oregano, rosemary, basil)",
      "Lemons (6)",
      "Spinach (500g)",
      "Eggplants (500g)",
    ],
  };

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

  const picked = locale === "en" ? listasEn : listas;
  return picked[tipoDieta] || picked.estandar;
}
