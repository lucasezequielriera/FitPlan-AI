import type { SocialCopy } from "@/lib/socialContent/generateCopy";
import type { ContentFunction } from "@/lib/socialContent/topics";

/** Logo oficial de FitPlan AI (public/brand/icon-social-transparent.png), servido por el propio sitio. */
export const FITPLAN_LOGO_URL = "https://www.fitplan-ai.com/brand/icon-social-transparent.png";

/**
 * Cierre de marca según la función de la pieza.
 *
 * El principio: cada segundo de pantalla de marca es un segundo que resta
 * retención, y la retención es lo que abre el siguiente lote de distribución.
 * Así que la marca ocupa tiempo proporcional a lo que la pieza intenta
 * conseguir — en alcance casi nada, en conversión lo necesario.
 */
const BRAND_CLOSE: Record<ContentFunction, (closingLine: string) => string> = {
  alcance: () =>
    `[0:22-0:24] CIERRE EN LOOP (máximo 2 segundos, NO es una pantalla de anuncio): remata la idea y vuelve visualmente al mismo tipo de plano con el que abriste, para que volver a ver el video se sienta natural. El LOGO REAL adjunto aparece pequeño, en una esquina, durante ese cierre — nada de pantalla de marca a pantalla completa, nada de texto de llamada a la acción, nada de "descarga la app". Una pieza de alcance que termina en anuncio pierde el último tramo de retención, que es justo el que más pesa.`,
  nutricion: (closingLine) =>
    `[0:21-0:24] CIERRE DE MARCA SUAVE (unos 3 segundos): el LOGO REAL adjunto (ícono de manzana en gradiente azul) con el nombre "FitPlan AI" sobre el gradiente de marca, y debajo una línea corta y sin urgencia: "${closingLine}". Tono de firma, no de anuncio: sin imperativos agresivos ni signos de exclamación.`,
  conversion: (closingLine) =>
    `[0:20-0:24] CIERRE DE CONVERSIÓN (unos 4 segundos): pantalla de marca completa con el LOGO REAL adjunto (ícono de manzana en gradiente azul), el nombre "FitPlan AI" sobre el gradiente de marca y la llamada a la acción bien legible y centrada. Aquí sí es una pantalla de anuncio: tiene que quedar claro qué es y qué hacer. Texto de la llamada a la acción: "${closingLine}".`,
};

/** Quita el punto final para poder interpolar sin que queden ".." en el prompt. */
function trimPeriod(text?: string): string {
  return (text || "").trim().replace(/\.+$/, "");
}

/**
 * Arma el prompt en lenguaje natural para HeyGen Video Agent a partir del
 * copy ya generado — así el comercial y el texto del post cuentan la misma
 * historia, en vez de generarse por separado y arriesgar que no coincidan.
 *
 * Las decisiones de duración, ritmo de corte y peso de la marca no son
 * estéticas: salen de cómo se distribuye el contenido en Reels/TikTok. El
 * video se juzga sobre todo por retención y replays, así que se prioriza
 * duración corta, densidad alta, un corte cada 2-3 segundos y un cierre que
 * invite a volver a verlo antes que un cierre publicitario.
 *
 * El estilo, el acento, el ritmo de voz y la resolución se piden en texto
 * natural porque el schema de POST /v3/video-agents no tiene campos
 * estructurados para eso (a diferencia de POST /v3/videos, que sí permite
 * voice_settings y resolution). El logo real se adjunta aparte vía `files`
 * (ver heygenVideoAgent.ts) y se referencia acá para que lo use en vez de
 * inventar un wordmark propio.
 */
export function buildCommercialPrompt(copy: SocialCopy): string {
  const [hook, insight, takeaway, cierre] = copy.scenes;
  const fn: ContentFunction = copy.contentFunction ?? "alcance";

  const closingLine = trimPeriod(cierre?.subtext) || trimPeriod(cierre?.headline) || "Empieza gratis en FitPlan AI";
  const brandClose = BRAND_CLOSE[fn](closingLine);

  return `Haz un video vertical (9:16) de 23 a 26 segundos para Instagram Reels y TikTok, de FitPlan AI (app de entrenamiento y nutrición personalizados con IA, con opción de coach real 1 a 1).

OBJETIVO REAL DE ESTE VIDEO (léelo antes de decidir nada): no es "quedar bonito", es RETENER. El video se distribuye por lotes: si la gente lo ve entero, se muestra a más gente; si abandona en el primer segundo, muere. Cada decisión de montaje se toma para que nadie abandone. Prioriza densidad y ritmo por encima de elegancia.

ARRANQUE (lo más importante de todo): el primer fotograma tiene que romper el patrón visual del feed — movimiento, una cara con emoción marcada, o un plano con algo llamativo o fuera de lugar. PROHIBIDO abrir con logo, con pantalla de marca, con fundido desde negro o con un plano lento y contemplativo: si el primer segundo parece un anuncio, la gente hace scroll antes de procesarlo conscientemente y el video no llega a ninguna parte.

IDIOMA Y ACENTO (no negociable): el presentador habla en ESPAÑOL DE ESPAÑA (castellano peninsular), con acento de España — nunca acento latinoamericano, mexicano ni rioplatense/argentino. Todo el texto en pantalla también en español de España (tú/vosotros, nunca "vos").

LOGO DE MARCA (no negociable): te adjunto el logo oficial de FitPlan AI como archivo — es un ícono de manzana en gradiente azul a celeste. USA ESE LOGO REAL (el archivo adjunto) donde corresponda, en vez de inventar o dibujar un logo propio o un wordmark distinto.

RITMO Y MONTAJE (no negociable):
- UN CORTE O CAMBIO VISUAL CADA 2-3 SEGUNDOS COMO MÁXIMO. Cambio de plano, de encuadre, de fondo, zoom, aparición de texto o cambio de ritmo musical. Un plano que dura más de 3 segundos sin que cambie nada pierde gente.
- Nada de fundidos lentos ni transiciones suaves: corte seco o whip-pan al ritmo de la música.
- El presentador habla RÁPIDO y con energía alta, casi sin pausas entre frases. Nunca tono pausado ni relajado.
- Alterna presentador y material de apoyo (b-roll real, gráficos, mockups de la app). No dejes al presentador hablando a cámara más de 4-5 segundos seguidos sin cortar a otra cosa.

TEXTO EN PANTALLA (no negociable):
- Frases MUY cortas: máximo 5-6 palabras por línea, un mensaje por pantalla, legible de un vistazo.
- Bien centrado, con interlineado y espaciado entre letras normal o ajustado. Nunca letras muy separadas entre sí, nunca bloques largos, nunca texto que se corte por los bordes.
- Tipografía sans-serif bold en mayúsculas para los titulares.

CALIDAD TÉCNICA:
- Renderiza en 1080p (1080x1920), con la mejor calidad de avatar disponible (motor más nuevo, animación y lip-sync lo más realista posible).
- Grading cinematográfico de gama alta: contraste marcado, sombras ricas, nada plano. Profundidad de campo sutil en el b-roll y micro-movimientos de cámara (dolly o parallax lento) en vez de planos totalmente estáticos.
- Música enérgica de principio a fin, con los cortes cuadrados al ritmo.

ESTILO: "FitPlan Dark Tech" — fondo oscuro tipo estudio (#0f172a a #111827), acentos en gradiente de marca azul #3b82f6 -> verde esmeralda #10b981 -> cian #06b6d4. Motion graphics limpios (barras de progreso, checkmarks, mockups de pantalla de móvil, chips flotantes) integrados con las escenas reales. Vibe: premium y enérgico, pero que parezca contenido, no publicidad.

GUION POR ESCENAS (respeta el mensaje; la puesta en escena visual la decides tú):
[0:00-0:03] GANCHO: "${trimPeriod(hook.headline)}"${hook.subtext ? ` — ${trimPeriod(hook.subtext)}` : ""}. Plano de apertura con fricción o curiosidad, cortes rápidos, texto grande y corto en pantalla. Este es el tramo que decide si el video vive o muere.
[0:03-0:11] Corte al presentador a cámara, tono confiado y muy enérgico, acento de España: "${trimPeriod(insight.headline)}"${insight.subtext ? ` — ${trimPeriod(insight.subtext)}` : ""}. Intercala al menos un plano de apoyo aquí, no lo dejes hablando fijo todo el tramo.
[0:11-0:19] Motion graphics + mockup de la app ilustrando: "${trimPeriod(takeaway.headline)}"${takeaway.subtext ? ` — ${trimPeriod(takeaway.subtext)}` : ""}. Gráficos de progreso, checkmarks, chips con los puntos clave, textos cortos y bien compaginados.
${brandClose}

Que se sienta como una pieza de creador con producción alta, no como un anuncio de televisión: el objetivo es que alguien lo vea entero sin darse cuenta de que le estaban vendiendo algo.`;
}
