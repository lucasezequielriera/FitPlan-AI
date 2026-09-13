import { describe, expect, it } from "@jest/globals";
import { clasificarPlanes, trocear, type PlanRef } from "@/lib/admin/orphanPlans";

/**
 * #5 — qué plan se considera huérfano.
 *
 * Es la única pieza de todo esto que puede causar un daño irreversible: un
 * falso positivo borra el plan de alguien que sí existe, y un plan no se
 * reconstruye. Así que se prueba sobre todo por el lado de NO borrar.
 */

const plan = (id: string, userId: string | null): PlanRef => ({ id, userId });
const conjunto = (...uids: string[]) => new Set(uids);

describe("#5 — clasificar planes huérfanos", () => {
  it("es huérfano si no está ni en usuarios ni en Auth", () => {
    const r = clasificarPlanes([plan("p1", "fantasma")], conjunto(), conjunto(), conjunto("fantasma"));
    expect(r.huerfanos.map((p) => p.id)).toEqual(["p1"]);
  });

  it("basta con existir en UNO de los dos sitios para no tocarlo", () => {
    // Un usuario puede tener documento sin cuenta (creado a mano) o cuenta sin
    // documento (registro a medias). Ninguno de los dos es un huérfano.
    const soloDoc = clasificarPlanes([plan("p1", "u")], conjunto("u"), conjunto(), conjunto("u"));
    const soloAuth = clasificarPlanes([plan("p2", "u")], conjunto(), conjunto("u"), conjunto("u"));

    expect(soloDoc.huerfanos).toEqual([]);
    expect(soloAuth.huerfanos).toEqual([]);
    expect([soloDoc.conDuenyo, soloAuth.conDuenyo]).toEqual([1, 1]);
  });

  it("si la comprobación de Auth no se pudo hacer, NO es huérfano", () => {
    // El caso que borraría datos de gente real. "No aparece en la lista de
    // vivos" y "sé que no existe" no son lo mismo: si el lote de Auth falló,
    // el UID no se llegó a comprobar y no se puede concluir nada.
    const r = clasificarPlanes(
      [plan("p1", "nunca-preguntado")],
      conjunto(),
      conjunto(),
      conjunto() // no se comprobó ninguno
    );

    expect(r.huerfanos).toEqual([]);
    expect(r.conDuenyo).toBe(1);
  });

  it("un lote fallido no arrastra a los UIDs que sí se comprobaron", () => {
    // El fallo debe ser local: que Auth no respondiera por `b` no puede salvar
    // ni condenar a `a`.
    const r = clasificarPlanes(
      [plan("p1", "a"), plan("p2", "b")],
      conjunto(),
      conjunto(),
      conjunto("a") // solo `a` se pudo comprobar
    );

    expect(r.huerfanos.map((p) => p.id)).toEqual(["p1"]);
    expect(r.conDuenyo).toBe(1);
  });

  it("los planes sin userId se cuentan aparte, no como huérfanos", () => {
    // No sirven a nadie tampoco, pero su causa es otra: nunca llegaron a tener
    // dueño. Mezclarlos escondería un bug distinto detrás del recuento de #5.
    const r = clasificarPlanes(
      [plan("p1", null), plan("p2", ""), plan("p3", "   ")],
      conjunto(),
      conjunto(),
      conjunto()
    );

    expect(r.sinDuenyo.map((p) => p.id)).toEqual(["p1", "p2", "p3"]);
    expect(r.huerfanos).toEqual([]);
  });

  it("un userId con espacios alrededor sigue siendo el mismo usuario", () => {
    // Si no se recortara, " u " no coincidiría con "u" y el plan de alguien
    // vivo se declararía huérfano.
    const r = clasificarPlanes([plan("p1", "  u  ")], conjunto("u"), conjunto(), conjunto("u"));
    expect(r.huerfanos).toEqual([]);
    expect(r.conDuenyo).toBe(1);
  });

  it("sin planes no hay nada que hacer", () => {
    expect(clasificarPlanes([], conjunto(), conjunto(), conjunto())).toEqual({
      huerfanos: [],
      sinDuenyo: [],
      conDuenyo: 0,
    });
  });

  it("una mezcla realista sale con las cuentas cuadradas", () => {
    const planes = [
      plan("vivo1", "a"),
      plan("vivo2", "b"),
      plan("huerfano1", "x"),
      plan("huerfano2", "y"),
      plan("sinDuenyo", null),
      plan("dudoso", "z"), // no comprobado en Auth
    ];
    const r = clasificarPlanes(planes, conjunto("a"), conjunto("b"), conjunto("a", "b", "x", "y"));

    expect(r.huerfanos.map((p) => p.id)).toEqual(["huerfano1", "huerfano2"]);
    expect(r.sinDuenyo.map((p) => p.id)).toEqual(["sinDuenyo"]);
    expect(r.conDuenyo).toBe(3); // a, b y el dudoso
    expect(r.huerfanos.length + r.sinDuenyo.length + r.conDuenyo).toBe(planes.length);
  });
});

describe("#5 — trocear", () => {
  it("respeta el tamaño de lote", () => {
    expect(trocear([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("una lista vacía no produce lotes", () => {
    // Un lote vacío haría una llamada a Auth sin identificadores, que es un
    // error de la API, no una consulta sin resultados.
    expect(trocear([], 100)).toEqual([]);
  });

  it("una lista más corta que el lote va entera", () => {
    expect(trocear([1, 2], 100)).toEqual([[1, 2]]);
  });

  it("un tamaño de lote inválido falla en vez de colgarse", () => {
    // Con 0 el bucle no avanzaría nunca.
    expect(() => trocear([1], 0)).toThrow();
  });
});
