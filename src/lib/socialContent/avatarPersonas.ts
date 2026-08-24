/**
 * Reparto de entrenadores sintéticos (avatares HeyGen 100% generados por IA,
 * sin fotos de personas reales) para variar quién presenta el contenido.
 *
 * Por qué existe: un único avatar fijo repetido a diario es lo primero que
 * la audiencia reconoce como sintético, y eso hunde la retención. Un reparto
 * rotativo de "entrenadores" reduce esa fatiga y permite además segmentar
 * contenido por audiencia (ver `targetAudience`).
 */

export type AvatarGender = "male" | "female";

export type AvatarPersona = {
  id: string;
  name: string;
  avatarId: string;
  voiceId: string;
  gender: AvatarGender;
  /** A qué audiencia se dirige el contenido narrado por esta persona. */
  targetAudience: AvatarGender;
  description: string;
};

export const AVATAR_PERSONAS: AvatarPersona[] = [
  {
    id: "marcos",
    name: "Marcos",
    // Look "Marcos in the gym" (grupo b73fa895...) — el logo de este look lo
    // agregó el propio usuario en HeyGen con el archivo real (los intentos
    // por prompt/texto nunca reconstruyeron bien la forma exacta, ver nota
    // en buildWardrobeInstruction). Logo blanco sobre camiseta azul marino.
    avatarId: "03263e7ba7b14ab59b51cde19cc005c0",
    // "Fernando Sanz" (plain, sin etiqueta) y luego "Rafael Cruz - Excited"
    // sonaron a persona mayor. Voz elegida directamente por el usuario tras
    // escuchar los clips de prueba.
    voiceId: "db19b5f2b78e46cd9ec397dc4ab638f3",
    gender: "male",
    targetAudience: "male",
    description: "Entrenador, ~32 años, complexión atlética musculosa, barba corta, manos en la cintura, camiseta azul marino con logo FitPlan blanco en el pecho.",
  },
  {
    id: "elena",
    name: "Elena",
    // Look "Entrenadora FitPlan - Elena v2 in gym" (grupo 145045f6...) —
    // mismo origen que el de Marcos: logo agregado a mano en HeyGen con el
    // archivo real. Logo blanco sobre top negro.
    avatarId: "c1df60fd4a60471d944522f24d1652c7",
    // Voz elegida directamente por el usuario tras escuchar los clips de prueba.
    voiceId: "c593e249943b4c8d8e6d4cadcc04e000",
    gender: "female",
    targetAudience: "female",
    description: "Entrenadora, ~29 años, complexión atlética, coleta alta, top deportivo negro con logo FitPlan blanco en el pecho.",
  },
];

/**
 * Color de camiseta para las prendas de los avatares que se generen a partir
 * de ahora — rota para que el reparto no vista siempre igual. El color de
 * logo correspondiente (blanco sobre oscuro, negro sobre blanco, gradiente de
 * marca sobre azul) se decide a mano al agregar el logo real después, no acá.
 */
// Nota (rediseño "FitPlan Volt"): la marca ya no es azul, es lima/negro (ver
// DESIGN_SYSTEM.md) — el azul oscuro de esta lista quedó como color de
// vestuario neutro, no como referencia al color de marca. No se cambia a
// lima porque esta función no está en uso hoy (los looks reales de Marcos y
// Elena se armaron a mano en HeyGen, ver AVATAR_PERSONAS arriba) y vestir a
// un avatar entero de lima es una decisión de estilismo, no una migración de
// paleta automática — a definir con `diseno`/Lucas si se retoma esta función.
const SHIRT_LOGO_RULES: { shirt: string; shirtHex: string }[] = [
  { shirt: "camiseta azul oscuro", shirtHex: "#1E3A8A" },
  { shirt: "camiseta negra", shirtHex: "#0A0A0A" },
  { shirt: "camiseta blanca", shirtHex: "#FFFFFF" },
];

/**
 * Construye el bloque de instrucción de vestuario para el prompt de creación
 * de un avatar nuevo (`POST /v3/avatars`, type "prompt"). Rota el color de
 * camiseta según el índice del avatar, para que el reparto no vista siempre
 * igual.
 *
 * ADVERTENCIA sobre el logo: la generación de avatar por prompt no admite
 * adjuntar el archivo real (a diferencia del Video Agent, que sí puede
 * referenciar `files`), así que esta función solo puede DESCRIBIR la marca en
 * texto — y en la práctica esa descripción nunca reconstruyó la forma exacta
 * del logo (probado varias veces: salían barras rectas o una figura
 * fusionada, no las dos cuchillas asimétricas reales). Los looks actuales de
 * Marcos y Elena tienen el logo bien puesto porque el usuario lo agregó a
 * mano en HeyGen usando el archivo real. Para avatares nuevos: generar el
 * look sin logo (esta función sirve para eso, la parte de color de prenda),
 * y agregar el logo real a mano después — no confiar en que el texto lo
 * reconstruya bien.
 */
export function buildWardrobeInstruction(index: number): string {
  const rule = SHIRT_LOGO_RULES[index % SHIRT_LOGO_RULES.length];
  return `Vistiendo ${rule.shirt}, completamente lisa, sin ningún logotipo, estampado ni texto (el logo de FitPlan se agrega después a mano, con el archivo real, sobre este look — no lo dibujes tú).`;
}
