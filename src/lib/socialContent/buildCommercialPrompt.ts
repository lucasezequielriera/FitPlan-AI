import type { SocialCopy } from "@/lib/socialContent/generateCopy";

/**
 * Arma el prompt en lenguaje natural para HeyGen Video Agent a partir del
 * copy ya generado (mismas 4 escenas/narración que usa el caption) — así el
 * comercial y el texto del post cuentan la misma historia, en vez de
 * generarse por separado y arriesgar que no coincidan.
 *
 * El estilo, el ritmo de voz y la resolución se piden en texto natural
 * porque el schema de POST /v3/video-agents no tiene campos estructurados
 * para eso (a diferencia de POST /v3/videos, que sí permite voice_settings
 * y resolution) — Video Agent interpreta esas instrucciones del prompt.
 */
export function buildCommercialPrompt(copy: SocialCopy): string {
  const [hook, insight, takeaway, cta] = copy.scenes;

  return `Hacé un video vertical (9:16) de 28 a 32 segundos, un comercial de altísima producción cinematográfica para FitPlan AI (app de fitness y nutrición con planes generados por IA + acceso a coach real 1 a 1).

CALIDAD TÉCNICA (no negociable): renderizá en 1080p (1080x1920), la mejor calidad de avatar disponible (motor más nuevo, animación y lip-sync lo más realista posible), profundidad de campo sutil en las tomas de b-roll, grading de color cinematográfico tipo producción de streaming (contrastes marcados, sombras ricas, nada plano), micro-movimientos de cámara (dolly/parallax lento) en vez de tomas estáticas. El presentador tiene que hablar con ritmo RÁPIDO y enérgico, casi sin pausas largas entre frases — energía alta de principio a fin, no un tono pausado/relajado.

ESTILO: "FitPlan Dark Tech" — fondo oscuro tipo estudio (#0f172a a #111827), acentos en gradiente de marca azul #3b82f6 -> verde esmeralda #10b981 -> cian #06b6d4. Tipografía sans-serif bold, moderna, mayúsculas para títulos de impacto. Transiciones rápidas tipo whip-pan y corte seco al ritmo de la música, nada de fundes lentos. Motion graphics limpios (barras de progreso, checkmarks, mockups de pantalla de celular, badges/chips flotantes) integrados con las escenas reales. Música de fondo enérgica de principio a fin. Vibe: premium, enérgico, aspiracional — como un comercial de TV de alta gama, no un video casero.

GUION POR ESCENAS (basado en el ángulo de hoy — respetá el mensaje, podés variar la puesta en escena visual):
[0:00-0:04] HOOK: "${hook.headline}"${hook.subtext ? ` — ${hook.subtext}` : ""}. Abrí con una toma que genere fricción/curiosidad relacionada a esto (cortes rápidos, footage realista), texto grande en pantalla con el hook.
[0:04-0:12] Corte al presentador hablando directo a cámara, tono confiado y muy enérgico: "${insight.headline}"${insight.subtext ? ` — ${insight.subtext}` : ""}.
[0:12-0:20] Motion graphics + mockup de la app ilustrando: "${takeaway.headline}"${takeaway.subtext ? ` — ${takeaway.subtext}` : ""}. Gráficos de progreso, checkmarks, chips flotantes con beneficios clave.
[0:20-0:26] Vuelta al presentador, cerrando con más energía todavía: conectá el mensaje con FitPlan AI (IA + coach real, resultados medibles).
[0:26-0:30] Pantalla final de marca: nombre "FitPlan AI" grande sobre el gradiente de marca, texto de cierre "${cta.subtext || "EMPEZÁ GRATIS HOY"}".

Que se sienta como una pieza publicitaria real de televisión/streaming de alta gama, con ritmo de corte de comercial profesional.`;
}
