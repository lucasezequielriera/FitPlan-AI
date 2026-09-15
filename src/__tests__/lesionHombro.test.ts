import { filterUnsafeExercisesByDoloresLesiones, PROHIBITED_SHOULDER } from "@/lib/trainingPlanGuards";
import fs from "fs";
import path from "path";

/**
 * El filtro de hombro dejaba pasar el ejercicio más común de todos.
 *
 * `PROHIBITED_SHOULDER` no incluía "press de hombros" —así se llama en español
 * la mayoría de las veces— ni "shoulder press". Alguien que declaraba el hombro
 * tocado podía recibir "Press de hombros con mancuernas" y nada lo paraba.
 *
 * El inglés estaba peor: para locale `en` el generador EXIGE que los nombres de
 * ejercicio vengan en inglés, y la lista era casi toda española. "military
 * press" ni siquiera estaba.
 *
 * Esto no es un detalle de copy. Es lo que llega al plan de una persona que ha
 * dicho que le duele el hombro.
 */

const ej = (name: string) => ({ name });
const conHombro = (nombres: string[]) =>
  filterUnsafeExercisesByDoloresLesiones(nombres.map(ej), ["dolor de hombro derecho"]).map((e) => e.name);

describe("Se descartan los ejercicios de hombro que antes pasaban", () => {
  it.each([
    "Press de hombros con mancuernas",
    "Press de hombro en máquina",
    "Shoulder Press (Dumbbell)",
    "Military Press",
    "Push Press",
    "Thruster con barra",
    "Arnold Press",
    "Parallel Bar Dips",
    "Chest Dips",
    "Handstand Push-ups",
    "Flexiones pike",
  ])("descarta «%s»", (nombre) => {
    expect(conHombro([nombre])).toEqual([]);
  });

  it("los que ya se descartaban siguen descartándose", () => {
    expect(conHombro(["Press militar con barra", "Press tras nuca", "Upright row", "Remo al mentón"])).toEqual([]);
  });
});

describe("No se descarta lo que no toca", () => {
  it("deja pasar ejercicios que no cargan el hombro por encima de la cabeza", () => {
    const seguros = [
      "Curl de bíceps con mancuernas",
      "Prensa de piernas",
      "Extensión de cuádriceps",
      "Remo en polea baja",
      "Face pull",
      "Elevaciones laterales",
    ];
    expect(conHombro(seguros)).toEqual(seguros);
  });

  it("«carrera de fondo» sobrevive: el singular no entra en la lista", () => {
    // El motivo por el que la lista lleva "fondos" pero NUNCA "fondo": en
    // español "carrera de fondo" es correr largo, y filtrarla a alguien con el
    // hombro tocado le quitaría trabajo aeróbico sin ninguna razón.
    //
    // La primera versión del comentario decía que el riesgo era el plural. Era
    // falso, y la mutación lo demostró: añadir "fondos" no rompía nada. El
    // riesgo real es el singular.
    expect(conHombro(["Carrera de fondo 40 min", "Rodaje de fondo"])).toEqual([
      "Carrera de fondo 40 min",
      "Rodaje de fondo",
    ]);
  });

  it("sin lesión declarada no se filtra nada", () => {
    const todos = ["Press de hombros", "Military Press", "Sentadilla"];
    expect(filterUnsafeExercisesByDoloresLesiones(todos.map(ej), []).map((e) => e.name)).toEqual(todos);
    expect(filterUnsafeExercisesByDoloresLesiones(todos.map(ej), undefined).map((e) => e.name)).toEqual(todos);
  });

  it("una lesión de otra zona no activa el filtro de hombro", () => {
    const r = filterUnsafeExercisesByDoloresLesiones([ej("Press de hombros")], ["molestia en el tobillo"]);
    expect(r.map((e) => e.name)).toEqual(["Press de hombros"]);
  });
});

describe("Hay una sola lista, no dos copias", () => {
  it("generatePlan importa las listas en vez de tener las suyas", () => {
    // La causa raíz. Había dos listas mantenidas a mano "con el mismo
    // criterio", y precisamente por eso se desviaron: la de `generatePlan.ts`
    // —el flujo que usa la app de verdad— era la que no tenía "press de
    // hombros". Copiarlas mejor no arregla nada; que haya una, sí.
    const src = fs.readFileSync(path.join(process.cwd(), "src/pages/api/generatePlan.ts"), "utf8");
    const sinComentarios = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

    expect(sinComentarios).toMatch(/import \{[^}]*PROHIBITED_SHOULDER[^}]*\} from "@\/lib\/trainingPlanGuards"/);
    // Y que no haya vuelto a nacer una copia local.
    expect(sinComentarios).not.toMatch(/ejerciciosProhibidos\w*\s*=\s*\[/);
  });

  it("cubre los dos idiomas", () => {
    // Para locale `en` el generador exige nombres en inglés, así que una lista
    // solo en español deja al usuario inglés sin protección.
    const ingleses = ["shoulder press", "military press", "overhead press", "push press", "thruster", "dips"];
    const faltan = ingleses.filter((t) => !PROHIBITED_SHOULDER.includes(t));
    expect(faltan).toEqual([]);
  });

  it("los términos están en minúscula y sin espacios sobrantes", () => {
    // El filtro compara contra `name.toLowerCase()`: una entrada con mayúscula
    // no coincidiría nunca y no lo notaría nadie.
    const malos = PROHIBITED_SHOULDER.filter((t) => t !== t.toLowerCase().trim());
    expect(malos).toEqual([]);
  });
});
