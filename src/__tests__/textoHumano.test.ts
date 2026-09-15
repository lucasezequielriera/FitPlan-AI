import fs from "fs";
import path from "path";
import { PROHIBITED_SHOULDER } from "@/lib/trainingPlanGuards";

/**
 * Ningún texto visible de FitPlan puede sonar a generado por una IA.
 *
 * No es una manía estética. La app se vende como "plan hecho con IA": si además
 * el texto suena a IA, quien entra concluye que no hay nadie detrás. Es lo
 * contrario de lo que queremos decir — la IA hace el plan, el texto lo escribe
 * una persona.
 *
 * Las señales salen de `TEXTO_HUMANO.md`, que las toma de la página de
 * Wikipedia sobre escritura generada por IA. Aquí están las que se pueden
 * comprobar por regla: construcciones y tipografía. El resto del documento
 * —importancia inflada, análisis de adorno— necesita criterio y no se puede
 * automatizar sin falsos positivos.
 *
 * Deliberadamente NO se comprueba `TEXTO_HUMANO.md` a sí mismo: es la lista de
 * lo prohibido, así que las contiene todas. Es el mismo error que ya se coló
 * tres veces en otros guards de este repo, donde el comentario que explicaba el
 * arreglo satisfacía la comprobación.
 */

const leer = (p: string) => fs.readFileSync(path.join(process.cwd(), p), "utf8");

/**
 * Archivos de copy que ve un usuario.
 *
 * La lista se mantiene a mano, pero NO es lo que garantiza la cobertura: el
 * último test de este archivo recorre `src` entero y exige que cualquier
 * fichero con formas de registro esté aquí o en `SIN_REGISTRO_RELEVANTE`.
 *
 * Hizo falta porque la lista se quedó corta cuatro veces seguidas, y la cuarta
 * fue la peor: `LoginModal.tsx` tenía "¿Ya tienes cuenta? Iniciá sesión" —
 * tuteo y voseo EN LA MISMA CADENA— en el botón de login de la landing
 * pública, mientras este mismo guard daba el copy por limpio.
 */
const COPY = [
  "src/lib/homeLandingCopy.ts",
  "src/lib/hyrox/landingCopy.ts",
  "src/lib/i18n/createPlanUi.ts",
  "src/lib/i18n/appUi.ts",
  "src/lib/i18n/planUi.ts",
  "src/lib/intakeFormI18n.ts",
  // Cuarta tanda: componentes y libs que también hablan al usuario.
  "src/components/LoginModal.tsx",
  "src/components/ContactButton.tsx",
  "src/lib/intakeFormSchema.ts",
  "src/lib/hyrox/copy.ts",
  "src/lib/hyrox/sessions.ts",
  "src/lib/hyrox/profile.ts",
  "src/pages/transformacion-fitplan.tsx",
  "src/pages/transformacion-design-preview.tsx",
];

/**
 * Ficheros donde aparecen formas de registro que NO son copy de usuario.
 *
 * Declarados con motivo, no ignorados en silencio: si alguno deja de ser una
 * excepción legítima, la lista es lo primero que hay que mirar.
 */
const SIN_REGISTRO_RELEVANTE = new Map<string, string>([
  ["src/lib/socialContent/generateCopy.ts", "instrucciones al modelo, no texto de la app"],
  ["src/lib/socialContent/buildCommercialPrompt.ts", "prompt de vídeo; dice literalmente «nunca vos»"],
  ["src/lib/socialContent/carouselCopy.ts", "guion de piezas de Instagram, no interfaz"],
  ["src/pages/api/generatePlan.ts", "prompt del sistema; lo lee el modelo"],
  ["src/pages/api/mealDetails.ts", "prompt del sistema"],
  ["src/pages/api/analyzeFood.ts", "prompt del sistema"],
  ["src/pages/api/analyzePlanCompletion.ts", "prompt del sistema"],
  ["src/lib/intakeOpenAiPlan.ts", "prompt del sistema"],
  ["src/lib/intakePlanExcel.ts", "hoja de cálculo para el entrenador, no para el cliente"],
  ["src/components/admin/AdminApp.tsx", "panel de admin: lo ve una sola persona"],
  ["src/components/AdminExerciseCatalogPanel.tsx", "panel de admin"],
  ["src/pages/admin/configuraciones/carrusel-ig.tsx", "panel de admin"],
  ["src/pages/admin/configuraciones/contenido-social.tsx", "panel de admin"],
  ["src/pages/api/admin/intakeClientPlanAction.ts", "endpoint de admin"],
  ["src/pages/api/admin/sendIntakeWelcomeEmail.ts", "email 1:1 firmado por Lucas; el tú es deliberado"],
  ["src/utils/calculations.ts", "constantes y comentarios de cálculo"],
  ["src/lib/firebase-admin.ts", "instrucciones de configuración para quien despliega, no para el usuario"],
  ["src/lib/templatePlans.ts", "nombres de ejercicio"],
  ["src/components/PremiumPlanModal.tsx", "pendiente: se revisa con el rediseño del modal"],
  ["src/components/IntakeClientPlanPublicView.tsx", "pendiente: entra con el rediseño de #22"],
  ["src/pages/api/deleteTrackedFood.ts", "mensaje interno de API"],
  ["src/pages/api/getWeeklyStats.ts", "mensaje interno de API"],
  ["src/pages/api/public/intake-trainer-qa.ts", "respuesta del trainer, escrita por Lucas"],
  ["src/pages/api/request-personal-trainer.ts", "aviso interno a Lucas"],
]);

/**
 * Solo el texto entre comillas: los nombres de variables no los lee nadie.
 *
 * Ojo con el `\n` dentro de la clase de caracteres. La primera versión era
 * `/"((?:[^"\\]|\\.){12,})"/g`, sin excluir el salto de línea, y hacía algo
 * peor que fallar: cuando una cadena tenía menos de 12 caracteres, el motor
 * retrocedía y emparejaba la comilla de CIERRE de esa con la de APERTURA de la
 * siguiente, capturando el hueco entre ambas (`",\n  skipToContent: "`).
 *
 * El guard pasaba comprobando basura. Lo descubrió la mutación: devolver a la
 * landing sus frases viejas no hacía fallar nada.
 *
 * Una cadena de JS no puede contener un salto de línea sin escapar, así que
 * excluirlo cierra cada literal donde de verdad termina.
 */
function cadenas(src: string): string[] {
  const sinComentarios = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const dobles = [...sinComentarios.matchAll(/"((?:[^"\\\n]|\\.)*)"/g)].map((m) => m[1]);
  // Backticks. Tercer agujero de este mismo guard, encontrado por la revisión
  // inyectando texto de IA dentro de un template literal y viendo que pasaba:
  // `hyrox/landingCopy.ts` tiene texto visible ahí (heroNote, respuestas de
  // FAQ) y no se miraba ninguno. Se quitan las interpolaciones antes, porque
  // `${SITE}` no es prosa.
  const plantillas = [...sinComentarios.matchAll(/`((?:[^`\\]|\\.)*)`/g)]
    .map((m) => m[1].replace(/\$\{[^}]*\}/g, " "));
  return [...dobles, ...plantillas].filter((t) => t.length >= 12);
}

/**
 * Como `cadenas`, pero sin descartar las cortas.
 *
 * El corte de 12 caracteres existe para que las comprobaciones de prosa no
 * tropiecen con claves de objeto y rutas. Para el registro es justo al revés:
 * `"Vos"` mide 3 y era la etiqueta de los mensajes propios en el chat de la
 * app — voseo puro, vivo en producción, e invisible para el guard por dos
 * motivos a la vez (el bigrama y este filtro).
 *
 * Aquí el riesgo de ruido es bajo porque los patrones son palabras completas y
 * concretas: ninguna clave de objeto se llama "tienes" ni "vos".
 */
function cadenasIncluyendoCortas(src: string): string[] {
  const sinComentarios = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const dobles = [...sinComentarios.matchAll(/"((?:[^"\\\n]|\\.)*)"/g)].map((m) => m[1]);
  const plantillas = [...sinComentarios.matchAll(/`((?:[^`\\]|\\.)*)`/g)]
    .map((m) => m[1].replace(/\$\{[^}]*\}/g, " "));
  return [...dobles, ...plantillas].filter((t) => t.trim().length > 0);
}

/**
 * Paralelismos negativos: "No es X, es Y" / "No solo X, sino también Y".
 *
 * La señal más reconocible de todas, porque suena a conclusión sin serlo. La
 * landing tenía cuatro, dos por idioma.
 *
 * Definidos una sola vez: el test que los aplica y el que demuestra que
 * funcionan tienen que usar exactamente los mismos, o se desvían y el segundo
 * acaba certificando unos patrones que el primero ya no usa.
 */
const PARALELISMOS_NEGATIVOS = [
  /\bno solo\b[^.]*\bsino\b/i,
  /\bno se trata de\b[^.]*\bsino\b/i,
  /\bmás que\b[^.]*,\s*es\b/i,
  /\bnot only\b[^.]*\bbut\b/i,
  /\bit'?s not\b[^.]*,\s*it'?s\b/i,
  // ", no <algo>" al final de la frase: el remate que niega lo anterior.
  // "…cantidades exactas, no aproximaciones" / "…que se ajusta, no una rutina fija".
  /,\s*no\s+[a-záéíóúüñ][^.]{2,45}$/i,
  /,\s*not\s+[a-z][^.]{2,45}$/i,
];

describe("El copy no usa las construcciones que delatan a una IA", () => {
  it("no hay paralelismos negativos", () => {
    const patrones = PARALELISMOS_NEGATIVOS;
    const ofensores: string[] = [];
    for (const f of COPY) {
      for (const t of cadenas(leer(f))) {
        if (patrones.some((re) => re.test(t))) ofensores.push(`${f}: "${t.slice(0, 60)}…"`);
      }
    }
    expect(ofensores).toEqual([]);
  });

  it("no hay vocabulario de folleto", () => {
    // Palabras que aparecen en textos generados con una frecuencia que no
    // tienen en el habla real. `revolucionario` y `vanguardia` además serían
    // afirmaciones que no podemos sostener.
    const prohibidas = [
      "vibrante", "enclavad", "revolucionari", "de vanguardia", "amplia gama",
      "experiencia única", "sin precedentes", "holístic", "sinergia",
      "en un mundo donde", "no es casualidad", "marca un antes y un después",
      "en última instancia", "cabe destacar", "es importante señalar",
      "vibrant", "nestled", "groundbreaking", "cutting-edge", "seamless",
      "unlock", "elevate your", "in today'?s world", "it'?s worth noting",
      "delve into", "tapestry", "testament to", "game.?chang",
    ];
    const ofensores: string[] = [];
    for (const f of COPY) {
      for (const t of cadenas(leer(f))) {
        for (const w of prohibidas) {
          if (new RegExp(w, "i").test(t)) ofensores.push(`${f}: "${w}" en "${t.slice(0, 45)}…"`);
        }
      }
    }
    expect(ofensores).toEqual([]);
  });

  it("no hay atribuciones sin nombre", () => {
    // "Los expertos coinciden", "estudios demuestran". Aquí no es solo estilo:
    // es la puerta por la que vuelven las afirmaciones sobre credenciales que
    // no tenemos, que ya hubo que retirar una vez (ver landingClaims.test.ts).
    const patrones = [
      /\blos expertos\b/i, /\bestudios (demuestran|indican|muestran)/i,
      /\bestá (científicamente )?comprobado\b/i, /\bse sabe que\b/i,
      /\bexperts (agree|say)\b/i, /\bstudies show\b/i, /\bresearch shows\b/i,
      /\bit'?s well known\b/i,
    ];
    const ofensores: string[] = [];
    for (const f of COPY) {
      for (const t of cadenas(leer(f))) {
        if (patrones.some((re) => re.test(t))) ofensores.push(`${f}: "${t.slice(0, 60)}…"`);
      }
    }
    expect(ofensores).toEqual([]);
  });

  it("no hay rayas largas ni apóstrofos curvos en el texto visible", () => {
    // La raya larga usada como muletilla es de las señales tipográficas más
    // citadas. El inglés tenía tres. Y mezclar `'` con `’` en el mismo archivo
    // delata texto pegado de sitios distintos.
    const ofensores: string[] = [];
    for (const f of COPY) {
      for (const t of cadenas(leer(f))) {
        if (t.includes("—")) ofensores.push(`${f}: raya larga en "${t.slice(0, 45)}…"`);
        if (/[’“”]/.test(t)) ofensores.push(`${f}: comilla curva en "${t.slice(0, 45)}…"`);
      }
    }
    expect(ofensores).toEqual([]);
  });
});

/**
 * Formas de voseo que aparecen en copy de producto.
 *
 * Es una enumeración y no una regla a propósito. La regla evidente —"verbo
 * acabado en -ás/-és/-ís"— marcaría también el futuro de tuteo (`podrás`,
 * `tendrás`) y `estás`, que es idéntico en los dos registros. Preferimos una
 * lista que se queda corta a un guard que da falsos positivos, porque un guard
 * ruidoso se acaba desactivando.
 *
 * Si aparece una forma nueva, se añade aquí.
 *
 * Los límites NO son `\b`. En JavaScript `\w` es solo ASCII, así que después de
 * una vocal acentuada no hay frontera de palabra y `\bmirá\b` no coincide
 * nunca. La primera versión usaba `\b` y por eso no detectaba ni una sola de
 * las formas terminadas en tilde, que son casi todos los imperativos del
 * voseo. Lo encontró el test de aquí abajo, no la mutación.
 */
const LETRA = "A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9_";
const FORMAS_VOSEO = new RegExp(
  `(?<![${LETRA}])(` +
    "mirá|entrá|probá|empezá|creá|hacé|poné|elegí|seguí|dejá|anotá|descargá|pedí|escribí|" +
    "contá|mandá|llevá|tomá|buscá|iniciá|marcá|completá|registrate|sumate|" +
    "tenés|podés|querés|sabés|hacés|vivís|preferís|necesitás|buscás|entrenás|respondés|" +
    "vos" +
    `)(?![${LETRA}])`,
  "gi"
);

/**
 * Formas de TUTEO que tampoco valen.
 *
 * Decisión de Lucas (2026-09-15): ni tú ni vos. El público es Madrid, España y
 * Argentina; elegir un registro deja fuera a una parte, y mezclarlos —que era
 * lo que había— es peor que cualquiera de los dos.
 *
 * Solo entran aquí las formas que DIVERGEN entre los dos registros: verbos
 * conjugados en segunda persona, imperativos, y "a ti"/"contigo". NO entran
 * `tu`, `tus` ni `te`, que son idénticos en tuteo y voseo ("vos tenés TU plan")
 * y son lo único que impide que el texto suene a folleto de seguros.
 *
 * Los infinitivos tampoco: "Empezar gratis" no tiene registro.
 */
const FORMAS_TUTEO = new RegExp(
  `(?<![${LETRA}])(` +
    // Presente de indicativo que SOLO existe en tuteo. Fuera quedan "estás",
    // "vas" y "das": el voseo los conjuga igual ("vos estás"), así que no
    // distinguen registro y marcarlos sería ruido.
    "tienes|puedes|quieres|necesitas|sabes|haces|vives|prefieres|buscas|entrenas|" +
    "contestas|abres|recibes|eres|debes|sientes|eliges|empiezas|" +
    // Añadidas tras un barrido ancho: la revisión encontró once formas que la
    // lista no tenía, repartidas por el formulario de salud y la landing de
    // HYROX. Una enumeración siempre se queda corta; lo que la mantiene útil
    // es ampliarla cada vez que aparece una, no fingir que está completa.
    // Podadas las que tienen homógrafo: `completas` es adjetivo ("las 8
    // estaciones completas"), `ganas` y `bajas` y `notas` y `sales` y `tomas`
    // son sustantivos, y `comes` es una palabra inglesa corriente. Marcarlas
    // daba falsos positivos en el plan de HYROX y en el filtro de alérgenos.
    "descansas|levantas|trabajas|corres|sigues|cambias|ajustas|apuntas|" +
    "dices|vienes|duermes|pierdes|subes|mides|llegas|" +
    // Imperativos con pronombre pegado: no hay sustantivo que se les parezca.
    "dinos|cuéntanos|cuentanos|apúntalo|apuntalo|míralo|miralo|pruébalo|pruebalo|" +
    // Imperativos sin homógrafo posible.
    "haz|pon|ponte|elige|hazlo|" +
    // Pronombres tónicos que sí divergen ("a vos", "con vos" en voseo).
    //
    // `ti` va suelto, no como bigrama. La primera versión listaba "a ti",
    // "para ti" y "contigo", y se le escapó "Cuéntame sobre ti" —el título de
    // la primera sección del formulario— porque la preposición era otra.
    // Enumerar preposiciones es perder por definición; la palabra es la señal.
    "ti|contigo|" +
    // Imperativo con `me` pegado, hermano de `cuéntanos`.
    "cuéntame|cuentame|dime|escríbeme|escribeme" +
    `)(?![${LETRA}])`,
  "gi"
);

/**
 * Busca formas de registro en todo el copy. Una sola función para que un test
 * pueda comprobar que DE VERDAD se aplica: si alguien vacía el bucle del
 * escaneo, el copy limpio hace que el test siga verde y la cobertura se pierde
 * en silencio. Ya pasó con el guard del manifest.
 */
function buscarRegistro(re: RegExp, textos: { archivo: string; texto: string }[]): string[] {
  const out: string[] = [];
  for (const { archivo, texto } of textos) {
    for (const m of texto.matchAll(re)) out.push(`${archivo}: ${m[0]} — "${texto.slice(0, 40)}…"`);
  }
  return out;
}

/** Todo el copy, aplanado. */
function todoElCopy(): { archivo: string; texto: string }[] {
  return COPY.flatMap((archivo) =>
    cadenasIncluyendoCortas(leer(archivo)).map((texto) => ({ archivo, texto }))
  );
}

describe("El copy en español no tutea ni vosea", () => {
  it("no usa formas de tuteo", () => {
    // El error simétrico del voseo. Un imperativo o un verbo conjugado eligen
    // registro aunque no se quiera: "Dinos qué quieres" es tuteo, "Decinos qué
    // querés" es voseo, y "El objetivo, en una frase" no es ninguno.
    expect(buscarRegistro(FORMAS_TUTEO, todoElCopy())).toEqual([]);
  });

  it("no marca `tu`, `tus` ni `te`, que valen en los dos registros", () => {
    // Si el guard los marcara, el copy quedaría sin ninguna forma de dirigirse
    // a nadie y sonaría a manual. "vos tenés tu plan" y "tú tienes tu plan"
    // usan el mismo posesivo.
    const legitimas = ["ajustado a tu nivel", "tus lesiones", "te contesto yo", "tu objetivo"];
    const falsos = legitimas.filter((f) => new RegExp(FORMAS_TUTEO.source, "i").test(f));
    expect(falsos).toEqual([]);
  });

  it("no marca infinitivos ni sustantivos que se parecen", () => {
    // El motivo de que el guard NO cubra los imperativos ambiguos: en español
    // casi todos son homógrafos de un sustantivo o de la tercera persona.
    // "Descarga en PDF" es un sustantivo, "se crea en el momento" es tercera
    // persona, "tu marca de 5 km" es un sustantivo. Marcarlos convertiría el
    // guard en ruido, y un guard ruidoso se desactiva.
    //
    // Esos casos quedan como comprobación humana, escrita en TEXTO_HUMANO.md.
    const legitimas = [
      "Ver planes Premium", "Crear mi cuenta", "Entrar",
      "tu marca de 5 km", "Descarga en PDF", "Se crea en el momento",
      "el plan se lleva la mitad", "la prueba dura 90 minutos",
    ];
    const falsos = legitimas.filter((f) => new RegExp(FORMAS_TUTEO.source, "i").test(f));
    expect(falsos).toEqual([]);
  });

  it("el buscador se aplica de verdad sobre el copy", () => {
    // Que el copy esté limpio no prueba que se esté mirando. Se mete texto
    // sucio por el MISMO camino que usa el escaneo: si alguien lo vacía, esto
    // cae aunque el copy real siga impecable.
    const sucio = [
      { archivo: "inventado.ts", texto: "Necesitas una cuenta para empezar" },
      { archivo: "inventado.ts", texto: "Tenés que crear una cuenta" },
    ];
    expect(buscarRegistro(FORMAS_TUTEO, sucio).length).toBe(1);
    expect(buscarRegistro(FORMAS_VOSEO, sucio).length).toBe(1);
    // Y que recorre todos los archivos declarados, no solo el primero.
    expect(new Set(todoElCopy().map((x) => x.archivo)).size).toBe(COPY.length);

    // Y que las etiquetas cortas entran. `"Vos"` mide 3 caracteres: el filtro
    // de prosa (12 mínimo) lo descartaba antes de que ningún patrón lo viera,
    // así que el guard era ciego a cualquier etiqueta corta de la interfaz.
    expect(cadenasIncluyendoCortas('msgYou: { es: "Vos", en: "You" },')).toContain("Vos");
    expect(todoElCopy().some((x) => x.texto.length < 12)).toBe(true);
  });

  it("reconoce el tuteo de verdad", () => {
    // Mismo meta-test que para el voseo: una lista que solo contiene lo que ya
    // arreglaste no protege de nada.
    const deberianSaltar = [
      "Contestas unas preguntas", "Dinos qué quieres", "Necesitas una cuenta",
      "Abres la app", "adaptados a ti", "Haz clic", "Elige tu objetivo",
      "Empiezas cuando quieras", "Cuéntanos tu caso",
      // Preposiciones distintas de "a"/"para": la lista las enumeraba y se le
      // escapó el título de la primera sección del formulario de inicio.
      "Cuéntame sobre ti", "hecho por ti", "pensado según ti",
    ];
    const noDetectadas = deberianSaltar.filter((f) => !new RegExp(FORMAS_TUTEO.source, "i").test(f));
    expect(noDetectadas).toEqual([]);
  });
});

describe("El copy en español no mezcla voseo con tuteo", () => {
  it("elige un registro y lo mantiene", () => {
    // La landing tenía las dos: "Respondés… obtienes", "Marcá… puedes",
    // "adaptados a vos". Ninguna persona escribe así; solo pasa cuando el texto
    // se ensambla de trozos.
    //
    // Se eligió tuteo porque era mayoría y porque Lucas vive en Madrid. Es
    // reversible: si se prefiere voseo, hay que cambiarlo ENTERO, y este test
    // es lo que obliga a ello.
    // Mira TODO el copy, no solo la home: el registro mezclado estaba también
    // en `createPlanUi.ts`, servido en los meta tags de /create-plan.
    expect(buscarRegistro(FORMAS_VOSEO, todoElCopy())).toEqual([]);
  });

  it("la lista de formas reconoce el voseo de verdad", () => {
    // La primera versión enumeraba solo las cuatro formas que había en la
    // landing, así que una quinta cualquiera pasaba: la mutación metió "Mirá
    // los planes Premium" y el test siguió verde. Una lista que solo contiene
    // lo que ya arreglaste no protege de nada.
    const deberianSaltar = [
      "Mirá los planes", "Entrá y probá", "Empezá gratis", "Creá tu cuenta",
      "Hacé clic", "Poné tus datos", "Seguí el plan", "Sumate",
      "tenés", "podés", "querés", "necesitás", "preferís", "escribí",
      // `vos` suelto y en preposiciones distintas de las tres que la lista
      // enumeraba. "Vos" a secas era la etiqueta del chat, vivo en producción.
      "Vos", "hecho para vos", "pensado sobre vos", "de vos depende",
    ];
    const noDetectadas = deberianSaltar.filter((f) => !new RegExp(FORMAS_VOSEO.source, "i").test(f));
    expect(noDetectadas).toEqual([]);
  });

  it("no confunde el futuro ni 'estás' con voseo", () => {
    // El motivo por el que esto es una lista y no una regla: en tuteo, el
    // futuro también lleva tilde final (`podrás`, `tendrás`) y `estás` es
    // idéntico en los dos registros. Una regla de "verbo acabado en -ás" los
    // marcaría todos.
    const legitimas = ["podrás guardarlo", "tendrás tu plan", "cuando estás a tope", "así es"];
    const falsos = legitimas.filter((f) => new RegExp(FORMAS_VOSEO.source, "i").test(f));
    expect(falsos).toEqual([]);
  });
});

describe("Los ejercicios que promete la landing están de verdad prohibidos", () => {
  // Cuatro veces en la misma revisión metí una afirmación que el código no
  // cumple, y la última fue por verificar el español y dar por hecho el
  // inglés: "parallel-bar dips" no existe en ninguna lista, y para locale `en`
  // el generador EXIGE nombres en inglés. Alguien con el hombro declarado
  // habría recibido justo lo que la landing promete que no recibirá.
  //
  // Este test comprobaba que el término estuviera en DOS archivos, porque
  // había dos listas copiadas a mano. Ya no: la copia de `generatePlan.ts` se
  // eliminó y ahora importa la única. Se comprueba contra la lista de verdad,
  // importándola, en vez de buscar texto en dos ficheros.

  const nombrados = () => {
    const copy = leer("src/lib/homeLandingCopy.ts");
    const es = copy.match(/el plan descarta ([^."]+)/)?.[1] ?? "";
    const en = copy.match(/The plan drops ([^."]+)/)?.[1] ?? "";
    return { es, en };
  };

  it("la landing sigue nombrando ejercicios concretos", () => {
    // Si alguien vuelve a una promesa genérica ("nada por encima de la
    // cabeza"), estas anclas dejan de encontrar nada y el test cae.
    const { es, en } = nombrados();
    expect(es.length).toBeGreaterThan(10);
    expect(en.length).toBeGreaterThan(10);
  });

  it("cada ejercicio nombrado está en la lista de prohibición", () => {
    const { es, en } = nombrados();
    const texto = `${es} ${en}`.toLowerCase();

    const prometidos = PROHIBITED_SHOULDER.filter((t) => texto.includes(t));
    expect(prometidos.length).toBeGreaterThan(0);

    // Y al revés: cada cosa que la landing nombra tiene que estar cubierta.
    const terminos = ["press militar", "press tras nuca", "fondos en paralelas", "overhead press", "upright row"];
    const nombradosEnCopy = terminos.filter((t) => texto.includes(t));
    const sinRespaldo = nombradosEnCopy.filter((t) => !PROHIBITED_SHOULDER.includes(t));
    expect(sinRespaldo).toEqual([]);
  });

  it("la landing no nombra ningún ejercicio que el filtro no cubra", () => {
    // El fallo exacto de la cuarta pasada. Cualquier palabra suelta que suene
    // a ejercicio y no esté respaldada es una promesa vacía.
    const { es, en } = nombrados();
    const respaldado = (frag: string) => PROHIBITED_SHOULDER.some((t) => t.includes(frag) || frag.includes(t));

    const sospechosos = ["parallel", "handstand pushup", "muscle up", "kipping"];
    const prometidosSinRespaldo = sospechosos.filter(
      (t) => `${es} ${en}`.toLowerCase().includes(t) && !respaldado(t)
    );
    expect(prometidosSinRespaldo).toEqual([]);
  });
});

describe("El guard mira algo de verdad", () => {
  it("los archivos de copy existen y tienen texto", () => {
    // Renombrar un archivo dejaría la lista apuntando a nada y el test verde
    // sin haber mirado una sola frase.
    for (const f of COPY) {
      expect({ f, existe: fs.existsSync(path.join(process.cwd(), f)) }).toEqual({ f, existe: true });
      expect(cadenas(leer(f)).length).toBeGreaterThan(10);
    }
  });

  it("detecta las frases que se quitaron de la landing", () => {
    // Prueba de que los patrones sirven: son las frases reales que había antes
    // de esta pasada. Si el guard no las reconoce, no protege de nada.
    const antes = [
      "Un plan que se ajusta, no una rutina fija",
      "Macros y cantidades exactas, no aproximaciones",
      "A plan that adapts, not a fixed routine",
      "Exact macros and portions, not rough estimates",
    ];
    for (const frase of antes) {
      expect({ frase, detectada: PARALELISMOS_NEGATIVOS.some((re) => re.test(frase)) }).toEqual({
        frase,
        detectada: true,
      });
    }
  });

  it("no marca frases normales", () => {
    // Un guard que salta con cualquier cosa se desactiva en una semana. Estas
    // son frases legítimas que contienen "no" y no son paralelismos.
    const legitimas = [
      "Si tienes el hombro tocado, no te manda press militar.",
      "Cuando cambie tu peso o tus horarios, el plan se rehace con lo nuevo.",
      "Bad shoulder? It will not give you overhead press.",
      "Necesitas una cuenta para guardar el plan. Se crea en el momento.",
    ];
    const falsos = legitimas.filter((f) => PARALELISMOS_NEGATIVOS.some((re) => re.test(f)));
    expect(falsos).toEqual([]);
  });
});

describe("El inventario de copy no puede quedarse corto", () => {
  it("todo fichero de `src` con formas de registro está declarado", () => {
    // LA causa de fondo, y la cuarta vez que este guard falló por lo mismo.
    //
    // `COPY` era una lista que escribí a mano, así que cubría lo que yo había
    // mirado. Mientras daba el copy por limpio, `LoginModal.tsx` tenía "¿Ya
    // tienes cuenta? Iniciá sesión" —tuteo y voseo EN LA MISMA CADENA— en el
    // botón de login de la landing pública.
    //
    // Este test invierte la carga: recorre `src` entero, y cualquier fichero
    // con formas de registro tiene que estar en `COPY` (y por tanto limpio) o
    // en `SIN_REGISTRO_RELEVANTE` con su motivo escrito. Añadir un archivo
    // nuevo con tuteo obliga a decidir cuál de las dos cosas es.
    const sinDeclarar: string[] = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(path.join(process.cwd(), dir), { withFileTypes: true })) {
        const rel = `${dir}/${e.name}`;
        if (e.isDirectory()) {
          if (!rel.includes("__tests__")) walk(rel);
          continue;
        }
        if (!/\.tsx?$/.test(e.name)) continue;
        if (COPY.includes(rel) || SIN_REGISTRO_RELEVANTE.has(rel)) continue;
        const textos = cadenasIncluyendoCortas(leer(rel));
        const tiene =
          textos.some((t) => FORMAS_TUTEO.test(t)) || textos.some((t) => FORMAS_VOSEO.test(t));
        if (tiene) sinDeclarar.push(rel);
      }
    };
    walk("src");
    expect(sinDeclarar).toEqual([]);
  });

  it("las exclusiones siguen existiendo y siguen teniendo motivo", () => {
    // Una exclusión que apunta a un archivo borrado se queda dando permiso a
    // nada. Y una sin motivo es un `ignore` disfrazado.
    for (const [f, motivo] of SIN_REGISTRO_RELEVANTE) {
      expect({ f, existe: fs.existsSync(path.join(process.cwd(), f)) }).toEqual({ f, existe: true });
      expect({ f, motivo: motivo.length > 12 }).toEqual({ f, motivo: true });
    }
  });
});
