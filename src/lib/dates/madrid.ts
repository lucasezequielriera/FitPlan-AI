/**
 * Utilidades de calendario en hora de Madrid, sin dependencias de servidor.
 *
 * Viven aparte de `socialContent/scheduleStore.ts` porque ese módulo importa
 * `firebase-admin` y, en cuanto un componente lo toca, se filtra al bundle del
 * cliente y rompe el build (ver `clientBundleSafety.test.ts`). Este archivo es
 * seguro de importar desde cualquier sitio.
 *
 * Madrid y no UTC a propósito: Lucas opera desde Madrid y el resto del sistema
 * agrupa por ese calendario. Un ID de día en UTC se desfasa una hora en cada
 * cambio de horario de verano y agrupa mal los eventos de la noche.
 */

export const MADRID_TZ = "Europe/Madrid";

// `hourCycle: "h23"` y no `hour12: false`: garantiza el rango 00-23 y evita el
// "24" de medianoche que devuelven algunos entornos. Es la misma configuración
// que ya usaba `scheduleStore.ts` en producción, conservada tal cual.
const partsFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: MADRID_TZ,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

export type MadridParts = {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
  second: string;
};

export function madridParts(at: Date): MadridParts {
  const out = {} as Record<string, string>;
  for (const part of partsFormatter.formatToParts(at)) {
    if (part.type !== "literal") out[part.type] = part.value;
  }
  return out as MadridParts;
}

/** Fecha "YYYY-MM-DD" según el calendario de Madrid. */
export function madridDateId(at: Date): string {
  const p = madridParts(at);
  return `${p.year}-${p.month}-${p.day}`;
}

/**
 * Índice de día absoluto a partir de un "YYYY-MM-DD". Sirve para restar fechas
 * sin que el horario de verano meta errores de ±1 hora: se comparan días de
 * calendario, no instantes.
 */
export function dateIdToDayIndex(dateId: string): number {
  const [y, mo, d] = dateId.split("-").map((n) => parseInt(n, 10));
  return Math.floor(Date.UTC(y, mo - 1, d) / 86400000);
}

/** Días de calendario entre dos IDs (`to - from`). Negativo si `to` es anterior. */
export function daysBetween(fromDateId: string, toDateId: string): number {
  return dateIdToDayIndex(toDateId) - dateIdToDayIndex(fromDateId);
}

/** Valida el formato "YYYY-MM-DD" (no valida que la fecha exista). */
export function isDateId(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}
