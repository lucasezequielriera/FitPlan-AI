/**
 * Filtra opciones de comida que contradicen restricciones/alergias
 * declaradas por el usuario. Usado por el generador de plantillas (tier
 * free) — el flujo Premium (generatePlan.ts) ya le pide esto a la IA
 * directamente en el prompt, pero las plantillas estáticas no tenían
 * ningún filtrado: un usuario free con alergia a mariscos podía recibir
 * "Salmón al horno" sin que nada lo evitara.
 *
 * Las claves deben calzar con las restricciones que ofrece el formulario
 * (ver intakeFormSchema.ts / create-plan.tsx) — mismos nombres de
 * restricción usados en el prompt de generatePlan.ts para consistencia.
 */
const RESTRICTION_KEYWORDS: Record<string, string[]> = {
  pescados: [
    "pescado", "salmón", "salmon", "atún", "atun", "merluza", "trucha",
    "bacalao", "tilapia", "caballa", "sardina", "anchoa",
  ],
  mariscos: [
    "marisco", "camarón", "camaron", "gamba", "langostino", "langosta",
    "mejillón", "mejillon", "calamar", "pulpo", "cangrejo",
  ],
  gluten: [
    "trigo", "cebada", "centeno", "pan", "pasta", "fideos", "tostada",
    "avena", "harina", "cuscús", "cuscus", "galleta",
  ],
  lácteos: [
    "leche", "queso", "yogur", "yogurt", "manteca", "mantequilla",
    "crema", "ricota", "requesón", "requeson",
  ],
  lacteos: [
    "leche", "queso", "yogur", "yogurt", "manteca", "mantequilla",
    "crema", "ricota", "requesón", "requeson",
  ],
  huevo: ["huevo", "tortilla", "omelette", "omelet"],
  cerdo: ["cerdo", "jamón", "jamon", "panceta", "bacon", "tocino", "chorizo"],
  soja: ["soja", "soya", "tofu", "edamame", "tempeh"],
  "frutos secos": [
    "almendra", "nuez", "nueces", "maní", "mani", "cacahuate",
    "avellana", "pistacho", "anacardo",
  ],
};

function keywordsForRestriction(restriccion: string): string[] {
  const key = restriccion.trim().toLowerCase();
  if (RESTRICTION_KEYWORDS[key]) return RESTRICTION_KEYWORDS[key];
  // Fallback: buscar coincidencia parcial (ej. "alergia a mariscos" -> "mariscos")
  const match = Object.keys(RESTRICTION_KEYWORDS).find((k) => key.includes(k));
  return match ? RESTRICTION_KEYWORDS[match] : [];
}

/**
 * Filtra un array de opciones de comida (strings descriptivos) removiendo
 * las que contengan un ingrediente excluido. Si TODAS las opciones de una
 * comida quedarían excluidas, mantiene un fallback genérico en vez de
 * dejar la comida vacía.
 */
export function filterMealOptionsByRestrictions(
  opciones: string[],
  restricciones: string[] | undefined,
  locale: "es" | "en" = "es"
): string[] {
  if (!restricciones || restricciones.length === 0) return opciones;

  const allKeywords = restricciones.flatMap((r) => keywordsForRestriction(r));
  if (allKeywords.length === 0) return opciones;

  const filtered = opciones.filter((opcion) => {
    const lower = opcion.toLowerCase();
    return !allKeywords.some((kw) => lower.includes(kw));
  });

  if (filtered.length > 0) return filtered;

  // Ninguna opción sobrevivió: no dejar la comida vacía, avisar que se
  // adapte manualmente en vez de arriesgar mostrar un ingrediente excluido.
  return [
    locale === "en"
      ? "Custom option needed (all default options conflict with your reported restrictions) — swap for a protein + carb + veg combo you know is safe."
      : "Opción a definir (todas las opciones por defecto contienen algo de tus restricciones declaradas) — reemplazar por una combinación de proteína + carbohidrato + vegetales que sepas que es segura para vos.",
  ];
}
