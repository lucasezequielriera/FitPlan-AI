import type { SocialCopy } from "@/lib/socialContent/generateCopy";

/** Logo oficial de FitPlan AI (public/brand/icon-social-transparent.png), servido por el propio sitio. */
export const FITPLAN_LOGO_URL = "https://www.fitplan-ai.com/brand/icon-social-transparent.png";

/**
 * Arma el prompt en lenguaje natural para HeyGen Video Agent a partir del
 * copy ya generado (mismas 4 escenas/narración que usa el caption) — así el
 * comercial y el texto del post cuentan la misma historia, en vez de
 * generarse por separado y arriesgar que no coincidan.
 *
 * El estilo, el ritmo/acento de voz y la resolución se piden en texto
 * natural porque el schema de POST /v3/video-agents no tiene campos
 * estructurados para eso (a diferencia de POST /v3/videos, que sí permite
 * voice_settings y resolution) — Video Agent interpreta esas instrucciones
 * del prompt. El logo real se adjunta aparte vía `files` (ver
 * heygenVideoAgent.ts) y se referencia acá para que lo use en vez de
 * inventar un wordmark propio.
 */
export function buildCommercialPrompt(copy: SocialCopy): string {
  const [hook, insight, takeaway, cta] = copy.scenes;

  return `Haz un video vertical (9:16) de 28 a 32 segundos, un comercial de altísima producción cinematográfica para FitPlan AI (app de fitness y nutrición con planes generados por IA + acceso a coach real 1 a 1).

IDIOMA Y ACENTO (no negociable): el presentador habla en ESPAÑOL DE ESPAÑA (castellano peninsular), con acento de España — nunca acento latinoamericano, mexicano ni rioplatense/argentino. Todo el texto en pantalla también en español de España (tú/vosotros, nunca "vos").

LOGO DE MARCA (no negociable): te adjunto el logo oficial de FitPlan AI como archivo — es un ícono de manzana en gradiente azul a celeste. USA ESE LOGO REAL (el archivo adjunto) en la pantalla de marca/cierre y donde corresponda, en vez de inventar o dibujar un logo propio o un wordmark distinto.

CALIDAD TÉCNICA (no negociable):
- Renderiza en 1080p (1080x1920), la mejor calidad de avatar disponible (motor más nuevo, animación y lip-sync lo más realista posible).
- Profundidad de campo sutil en las tomas de b-roll, grading de color cinematográfico tipo producción de streaming de alta gama (contrastes marcados, sombras ricas, nada plano), micro-movimientos de cámara (dolly/parallax lento) en vez de tomas estáticas — nivel de agencia de publicidad real, no motion graphics genérico de plantilla.
- TEXTO EN PANTALLA: títulos y frases CORTAS (máximo 5-6 palabras por línea), bien centrados, con interlineado y espaciado entre letras normal/ajustado — nunca texto con letras muy separadas entre sí ni bloques de texto largos que se corten mal. Un mensaje por pantalla, legible de un vistazo.
- El presentador tiene que hablar con ritmo RÁPIDO y enérgico, casi sin pausas largas entre frases — energía alta de principio a fin, no un tono pausado/relajado.

ESTILO: "FitPlan Dark Tech" — fondo oscuro tipo estudio (#0f172a a #111827), acentos en gradiente de marca azul #3b82f6 -> verde esmeralda #10b981 -> cian #06b6d4. Tipografía sans-serif bold, moderna, mayúsculas para títulos de impacto. Transiciones rápidas tipo whip-pan y corte seco al ritmo de la música, nada de fundes lentos. Motion graphics limpios (barras de progreso, checkmarks, mockups de pantalla de móvil, badges/chips flotantes) integrados con las escenas reales. Música de fondo enérgica de principio a fin. Vibe: premium, enérgico, aspiracional — como un comercial de TV de alta gama, no un video casero.

GUION POR ESCENAS (basado en el ángulo de hoy — respeta el mensaje, puedes variar la puesta en escena visual):
[0:00-0:04] HOOK: "${hook.headline}"${hook.subtext ? ` — ${hook.subtext}` : ""}. Abre con una toma que genere fricción/curiosidad relacionada a esto (cortes rápidos, footage realista), texto grande en pantalla con el hook (corto, máximo 5-6 palabras por línea).
[0:04-0:12] Corte al presentador hablando directo a cámara, tono confiado y muy enérgico, acento de España: "${insight.headline}"${insight.subtext ? ` — ${insight.subtext}` : ""}.
[0:12-0:20] Motion graphics + mockup de la app ilustrando: "${takeaway.headline}"${takeaway.subtext ? ` — ${takeaway.subtext}` : ""}. Gráficos de progreso, checkmarks, chips flotantes con beneficios clave, textos cortos y bien compaginados.
[0:20-0:26] Vuelta al presentador, cerrando con más energía todavía: conecta el mensaje con FitPlan AI (IA + coach real, resultados medibles).
[0:26-0:30] Pantalla final de marca: el LOGO REAL adjunto (ícono de manzana en gradiente azul), nombre "FitPlan AI" sobre el gradiente de marca, texto de cierre corto "${cta.subtext || "EMPIEZA GRATIS HOY"}".

Que se sienta como una pieza publicitaria real de televisión/streaming de alta gama, con ritmo de corte de comercial profesional.`;
}
