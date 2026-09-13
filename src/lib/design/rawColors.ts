/**
 * Contador de clases Tailwind de color crudas — la deuda que `DESIGN_SYSTEM.md`
 * §0 dice que no debería existir (`red-500`, `emerald-400`… en vez de los
 * tokens semánticos).
 *
 * Existe como módulo, y no como un grep suelto dentro del test, porque el
 * problema del issue #11 es precisamente que cada recuento se hizo con un
 * patrón distinto y ninguno coincidía. El del reporte original, el del
 * comentario que lo "corregía" y el de la tabla del documento daban tres
 * cifras diferentes para el mismo archivo sin que nadie lo notara.
 *
 * Con una única función, el documento y el guard cuentan igual por
 * construcción, no por coincidencia.
 */

const COLORES = [
  "red", "orange", "amber", "yellow", "lime", "green", "emerald", "teal",
  "cyan", "sky", "blue", "indigo", "violet", "purple", "fuchsia", "pink",
  "rose", "slate", "gray", "zinc", "neutral", "stone",
].join("|");

const TONOS = "50|100|200|300|400|500|600|700|800|900|950";

/**
 * Prefijos de utilidad que pintan. Deliberadamente amplio: el recuento del
 * comentario del issue usaba solo seis y por eso se le escapaban usos reales.
 */
const PREFIJOS = [
  "bg", "text", "border", "from", "via", "to", "ring", "fill", "stroke",
  "divide", "outline", "decoration", "accent", "caret", "placeholder", "shadow",
].join("|");

export const PATRON_COLOR_CRUDO = new RegExp(
  `\\b(${PREFIJOS})-(${COLORES})-(${TONOS})\\b`,
  "g"
);

/**
 * Quita comentarios antes de contar.
 *
 * `globals.css` anota cada token con su equivalente Tailwind
 * (`--success: #10b981; /* emerald-500 *\/`). Contar eso como deuda haría que
 * documentar los tokens penalizara en el mismo guard que los defiende — el
 * mismo error que ya se coló tres veces en otros guards de este repo, donde el
 * comentario que explicaba el arreglo satisfacía la comprobación.
 */
export function sinComentarios(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

/** Cuántas clases de color crudas hay en un archivo. */
export function contarColoresCrudos(src: string): number {
  const limpio = sinComentarios(src);
  return [...limpio.matchAll(PATRON_COLOR_CRUDO)].length;
}
