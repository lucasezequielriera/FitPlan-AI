/**
 * Elimina en profundidad las claves con valor `undefined` de un objeto antes
 * de escribirlo en Firestore (Firestore rechaza el documento entero si algún
 * campo llega como `undefined`, en lugar de ignorarlo).
 *
 * Importante: NO reconstruye valores que no sean objetos "planos" (`{}`
 * literales o `Object.create(null)`). Eso incluye sentinels de Firestore
 * como `FieldValue.serverTimestamp()`, `FieldValue.increment()` o
 * `FieldValue.arrayUnion()`, además de `Timestamp`, `GeoPoint`,
 * `DocumentReference` o `Date`: todos son instancias de una clase concreta y
 * reconstruirlas campo por campo con `Object.entries` las convierte en un
 * objeto vacío `{}` (pierden su prototipo, que es lo que Firestore usa para
 * reconocerlas). Se devuelven tal cual.
 */
export function stripUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .map((item) => stripUndefinedDeep(item))
      .filter((item) => item !== undefined) as unknown as T;
  }
  if (value !== null && typeof value === "object") {
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) {
      return value;
    }
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) out[k] = stripUndefinedDeep(v);
    }
    return out as T;
  }
  return value;
}
