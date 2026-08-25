import { FieldValue } from "firebase-admin/firestore";
import { stripUndefinedDeep } from "@/lib/firestoreSanitize";

describe("stripUndefinedDeep", () => {
  test("elimina claves con valor undefined en objetos anidados", () => {
    const input = {
      a: 1,
      b: undefined,
      nested: { c: "x", d: undefined },
    };
    expect(stripUndefinedDeep(input)).toEqual({ a: 1, nested: { c: "x" } });
  });

  test("elimina undefined dentro de arrays", () => {
    const input = { list: [1, undefined, { e: undefined, f: 2 }] };
    expect(stripUndefinedDeep(input)).toEqual({ list: [1, { f: 2 }] });
  });

  test("no destruye un sentinel FieldValue.serverTimestamp()", () => {
    const sentinel = FieldValue.serverTimestamp();
    const result = stripUndefinedDeep({ createdAt: sentinel, name: "x" });
    // Bug original: stripUndefined reconstruía el sentinel campo por campo y
    // lo dejaba como `{}`, perdiendo su prototipo (Firestore lo detecta por
    // `instanceof`, no por sus propiedades enumerables).
    expect(result.createdAt).toBe(sentinel);
    expect(result.createdAt).toBeInstanceOf(FieldValue.serverTimestamp().constructor);
  });

  test("no destruye FieldValue.arrayUnion() ni FieldValue.increment()", () => {
    const arrayUnion = FieldValue.arrayUnion({ x: 1 });
    const increment = FieldValue.increment(1);
    const result = stripUndefinedDeep({ history: arrayUnion, count: increment });
    expect(result.history).toBe(arrayUnion);
    expect(result.count).toBe(increment);
  });

  test("preserva instancias de Date en lugar de reconstruirlas como objeto plano", () => {
    const date = new Date("2024-01-01T00:00:00.000Z");
    const result = stripUndefinedDeep({ when: date });
    expect(result.when).toBe(date);
  });
});
