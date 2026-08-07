/**
 * Formato de carrera, estrategia de reparto en Doubles y objetivos de ritmo.
 *
 * Los pesos son los de la división Open. HYROX ajusta detalles de reglamento y
 * material entre temporadas, así que conviene contrastar con el reglamento
 * oficial del evento concreto antes de cerrar la estrategia — sobre todo si
 * los dos podéis trabajar a la vez en los trineos, que es la regla que más
 * cambia el reparto.
 */

export type Station = {
  order: number;
  name: string;
  spec: string;
  weightsMen: string;
  weightsWomen: string;
  /** Cómo repartirlo entre los dos y por qué así. */
  doublesSplit: string;
  /** El error que más tiempo cuesta en esta estación. */
  commonMistake: string;
  /** Tiempo objetivo combinado en dobles para un total de ~85 min. */
  targetTime: string;
};

export const STATIONS: Station[] = [
  {
    order: 1,
    name: "SkiErg",
    spec: "1000 m",
    weightsMen: "—",
    weightsWomen: "—",
    doublesSplit: "4 relevos de 250 m. El cambio en el SkiErg es rapidísimo (se suelta y se coge), así que compensa partirlo mucho: mantiene las pulsaciones bajas al principio de carrera.",
    commonMistake: "Salir demasiado fuerte. Es la primera estación, vais frescos y es facilísimo fundirse aquí y pagarlo en el km 2.",
    targetTime: "3:45",
  },
  {
    order: 2,
    name: "Sled Push",
    spec: "50 m (4 tramos de 12,5 m)",
    weightsMen: "152 kg (trineo incluido)",
    weightsWomen: "102 kg (trineo incluido)",
    doublesSplit: "Se empuja de uno en uno: un tramo de 12,5 m cada uno, alternando. El que espera se coloca ya en el otro extremo para que el relevo sea instantáneo — el trineo no debe quedarse quieto ni un segundo entre cambios.",
    commonMistake: "Brazos flexionados y torso alto. Brazos estirados, cuerpo bajo y diagonal, pasos cortos y continuos. Parar y rearrancar el trineo cuesta carísimo: cuesta mucho más romper la inercia que mantenerla.",
    targetTime: "2:50",
  },
  {
    order: 3,
    name: "Sled Pull",
    spec: "50 m (4 tramos de 12,5 m)",
    weightsMen: "103 kg (trineo incluido)",
    weightsWomen: "78 kg (trineo incluido)",
    doublesSplit: "De uno en uno, alternando por tramo. Mientras uno tira, el otro recoge y ordena la cuerda: el tiempo muerto de la cuerda enredada es donde se pierden más segundos de toda la estación.",
    commonMistake: "Tirar solo con brazos y de pie. Hay que sentarse atrás, usar el peso corporal y tirar mano sobre mano con ritmo constante.",
    targetTime: "3:15",
  },
  {
    order: 4,
    name: "Burpee Broad Jump",
    spec: "80 m",
    weightsMen: "Peso corporal",
    weightsWomen: "Peso corporal",
    doublesSplit: "Relevos cortos, cada 10 m. Es la estación que más dispara las pulsaciones y la que peor se recupera: cambios frecuentes evitan que ninguno entre en rojo.",
    commonMistake: "Saltos largos buscando acabar antes. Salen más caros de lo que ahorran. Mejor salto corto, ritmo constante y respiración controlada.",
    targetTime: "4:30",
  },
  {
    order: 5,
    name: "Remo (Row)",
    spec: "1000 m",
    weightsMen: "—",
    weightsWomen: "—",
    doublesSplit: "2 relevos de 500 m. Aquí, al revés que el SkiErg: atarse los pies cuesta tiempo, así que menos cambios es más rápido.",
    commonMistake: "Cadencia alta y poca potencia por palada. Mejor 24-26 spm con tirón fuerte que 32 spm flojo.",
    targetTime: "3:45",
  },
  {
    order: 6,
    name: "Farmers Carry",
    spec: "200 m",
    weightsMen: "2 × 24 kg",
    weightsWomen: "2 × 16 kg",
    doublesSplit: "2 relevos de 100 m, o 4 de 50 m si el agarre es vuestro punto débil. Es de las pocas estaciones donde se puede recuperar algo de pulso.",
    commonMistake: "Soltar por agarre a mitad de tramo. Soltar y recoger cuesta más que aguantar: elegid tramos que sepáis que aguantáis seguro.",
    targetTime: "2:00",
  },
  {
    order: 7,
    name: "Sandbag Lunges",
    spec: "100 m",
    weightsMen: "20 kg",
    weightsWomen: "10 kg",
    doublesSplit: "Relevos de 25 m. Las zancadas con saco acumulan muchísimo en cuádriceps justo antes de los wall balls: no dejéis que ninguno llegue al fallo.",
    commonMistake: "Zancada demasiado corta, que obliga a más repeticiones. Y perder el saco de sitio: colocadlo alto en la espalda y bien sujeto.",
    targetTime: "4:30",
  },
  {
    order: 8,
    name: "Wall Balls",
    spec: "100 repeticiones",
    weightsMen: "6 kg a 3,0 m",
    weightsWomen: "4 kg a 2,7 m",
    doublesSplit: "Series de 10-15 alternando. NUNCA al fallo: si uno se funde, el otro tiene que hacer el resto solo y ahí es donde se van 3-4 minutos.",
    commonMistake: "Hacer series largas al principio porque 'aún se puede'. Con 100 repeticiones y todo el cansancio acumulado, la regla es ir por debajo de vuestro límite desde la primera serie.",
    targetTime: "5:00",
  },
];

export type PaceTarget = {
  totalTime: string;
  level: string;
  runPace: string;
  runTotal: string;
  stationsTotal: string;
  roxzone: string;
  feasibility: string;
};

/**
 * Desglose de dónde se va el tiempo según objetivo. Lo importante no es el
 * número final sino ver que en dobles la carrera se lleva ~55-60% del total:
 * es donde está casi todo el margen de mejora para quien viene del gimnasio.
 */
export const PACE_TARGETS: PaceTarget[] = [
  {
    totalTime: "~95 min",
    level: "Terminar con solvencia",
    runPace: "6:45 /km",
    runTotal: "54 min",
    stationsTotal: "33 min",
    roxzone: "8 min",
    feasibility: "Objetivo mínimo con vuestro perfil. Deberíais superarlo si cumplís el plan sin lesiones.",
  },
  {
    totalTime: "~85 min",
    level: "Objetivo realista",
    runPace: "6:00 /km",
    runTotal: "48 min",
    stationsTotal: "30 min",
    roxzone: "7 min",
    feasibility: "El objetivo sobre el que está construido el plan. Exige llegar a 5 km en ~25 min a la semana 14.",
  },
  {
    totalTime: "~75 min",
    level: "Objetivo ambicioso",
    runPace: "5:15 /km",
    runTotal: "42 min",
    stationsTotal: "27 min",
    roxzone: "6 min",
    feasibility: "Alcanzable solo si la carrera progresa muy bien (5 km por debajo de 23 min) y las transiciones son limpias.",
  },
];

export const DOUBLES_PRINCIPLES = [
  {
    title: "El mejor corredor debe hacer MÁS trabajo de estaciones",
    detail:
      "Suena al revés, pero es la decisión que más tiempo os va a ahorrar. Corréis juntos los 8 km, así que el ritmo lo marca el más lento; en cambio las estaciones se reparten. Como en el gimnasio estáis igualados, cargar al que corre mejor con más trabajo de estación (60/40 en vez de 50/50) llega gratis para el equipo y deja al más lento con las piernas más frescas para lo único que no se puede repartir: correr. Se gana más ahí que en cualquier estación.",
  },
  {
    title: "Cambiad antes de fundiros, no cuando ya no podéis",
    detail:
      "Es la regla número uno del formato. Si esperáis al fallo, el que releva entra ya en rojo y los dos os hundís. Relevos cortos y frecuentes mantienen a los dos en zona aeróbica y el conjunto va más rápido.",
  },
  {
    title: "El ritmo de carrera lo marca el más lento",
    detail:
      "El tiempo del equipo depende del que menos corre, así que la prioridad del plan es subir su nivel, no el del más rápido. En la práctica: el que corre peor debería añadir una salida suave extra a la semana (30-40' muy tranquilos) en lugar de más gimnasio, porque de fuerza vais sobrados y de carrera no.",
  },
  {
    title: "Los trineos se empujan de uno en uno: el relevo es la clave",
    detail:
      "Como no podéis empujar a la vez, todo el tiempo que se gana está en las transiciones. El que no empuja tiene que estar ya colocado en el extremo opuesto para relevar al instante. El trineo parado es lo más caro de la prueba: romper la inercia cuesta muchísimo más que mantenerla.",
  },
  {
    title: "La roxzone es tiempo de carrera",
    detail:
      "El tránsito entre estación y carrera cuenta en el crono. 8 transiciones × 15 segundos perdidos son 2 minutos regalados. Ensayadlas: dónde dejáis el material, por dónde entráis, quién empieza cada estación.",
  },
  {
    title: "Decidid los relevos ANTES de la carrera",
    detail:
      "Discutir el reparto en mitad de la prueba, sin aire, es la peor forma de perder tiempo. Llegad con el plan cerrado y ensayado en las simulaciones de las semanas 11 y 13.",
  },
];

export const NUTRITION = {
  daily: [
    "Proteína: 1,8-2,2 g por kg de peso corporal al día. Con dos sesiones de fuerza semanales, es lo que protege la masa muscular mientras sube el volumen de carrera.",
    "Carbohidratos: entre 4 y 6 g/kg en días normales, subiendo a 6-8 g/kg los días de sesión específica y tirada larga. Correr en fatiga sin glucógeno solo genera fatiga, no adaptación.",
    "No hagáis déficit calórico agresivo durante el bloque. Perder peso rápido con este volumen se paga en lesiones y en rendimiento.",
    "Hidratación: 35 ml por kg al día como base, más lo que se sude en sesión. Con calor de agosto y septiembre, añadid electrolitos en las tiradas largas.",
    "Dormir 7-9 h. Es la variable que más correlaciona con no lesionarse cuando se pasa de no correr a correr 3 veces por semana.",
  ],
  raceWeek: [
    "Lunes a miércoles: comida normal, bajando volumen de entreno. Nada de experimentos.",
    "Jueves y viernes: subid carbohidratos a 7-8 g/kg y bajad fibra y grasa. El objetivo es llenar el depósito de glucógeno, no comer más calorías porque sí.",
    "Reducid fibra las últimas 24 h para evitar problemas digestivos durante la prueba.",
    "Sal y líquidos: aumentad ligeramente la sal el día previo para retener bien el agua.",
    "Nada nuevo la semana de carrera: ni suplemento, ni comida, ni zapatillas, ni calcetines.",
  ],
  raceDay: [
    "Desayuno 3 h antes: 1-1,5 g/kg de carbohidratos de digestión fácil, poca fibra y poca grasa. Lo que hayáis probado en las simulaciones.",
    "Cafeína: 3-6 mg/kg unos 45-60 min antes, SOLO si ya la habéis probado en entreno. El día de la carrera no es el momento de descubrir cómo os sienta.",
    "60-90 min antes: pequeño snack de carbohidratos si tenéis hambre (plátano, gel, barrita conocida).",
    "Durante la prueba: si estáis por encima de 75-80 min, un gel hacia la estación 4-5 ayuda. Agua o bebida con electrolitos a sorbos en la roxzone.",
    "Calentamiento: 10-15 min de trote progresivo, movilidad y 3-4 aceleraciones cortas. Terminad 10-15 min antes de salir, no justo antes.",
  ],
};

/** Cómo convertir el reto en contenido, aprovechando el sistema de reels ya montado. */
export const CONTENT_ANGLES = [
  {
    phase: "Semanas 1-4",
    angle: "El punto de partida honesto",
    detail:
      "Grabad el test de 5 km de la semana 1 tal cual, con el tiempo real por malo que sea. El contenido de 'empiezo desde aquí' retiene muchísimo porque la gente se identifica, y además crea el arco narrativo: sin punto de partida no hay progreso que enseñar después.",
  },
  {
    phase: "Semanas 5-9",
    angle: "El proceso feo",
    detail:
      "Sesiones duras, la primera vez que corréis con las piernas cargadas, lo que duele. Es el contenido que más confianza construye porque nadie lo publica: todo el mundo enseña el resultado, casi nadie el proceso.",
  },
  {
    phase: "Semanas 10-13",
    angle: "Las simulaciones",
    detail:
      "La simulación completa de la semana 11 es la mejor pieza de todo el bloque: es larga, es dura y tiene tensión narrativa real. Sacad de ahí varios reels cortos.",
  },
  {
    phase: "Semanas 14-15",
    angle: "La carrera",
    detail:
      "Cuenta atrás, nervios, logística y el resultado. Cerrad el arco comparando con el test de la semana 1: ese antes/después es la pieza con más potencial de todo el reto.",
  },
  {
    phase: "Transversal",
    angle: "Por qué esto importa para FitPlan",
    detail:
      "Es la respuesta al problema de fondo del contenido actual: sale una persona real haciendo algo difícil, no un avatar. Es exactamente el tipo de pieza que las métricas dicen que falta, y de paso demuestra el producto en vez de explicarlo.",
  },
];
