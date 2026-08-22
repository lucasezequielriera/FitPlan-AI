import type { SocialCopy } from "@/lib/socialContent/generateCopy";

/** Logo oficial de FitPlan (public/brand/icon-social-transparent.png), servido por el propio sitio. Fuente en brand&designs/. */
export const FITPLAN_LOGO_URL = "https://www.fitplan-ai.com/brand/icon-social-transparent.png";

/**
 * Cierre de marca FIJO, igual en todos los vídeos.
 *
 * Desde el pivote a contenido 100% educativo (dejar de vender FitPlan
 * escena a escena y en cambio enseñar algo real, con FitPlan apareciendo
 * solo como firma al final) ya no tiene sentido variar el cierre según la
 * función de la pieza: todas las piezas son la misma clase de contenido, así
 * que todas cierran igual. Validado con un vídeo de prueba real antes de
 * fijarlo acá como comportamiento permanente.
 */
const BRAND_CLOSE = `[0:21-0:24] CIERRE DE MARCA FIJO (unos 3 segundos, igual en todos los vídeos): el LOGO REAL adjunto (dos trazos afilados en diagonal, en gradiente azul a verde) centrado, con el nombre "FitPlan" debajo en texto limpio. Sin llamada a la acción, sin URL, sin oferta, sin imperativos — es una firma de marca al final de un vídeo educativo, no un anuncio. Tono de cierre de autor/creador de contenido.`;

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
  const [hook, insight, takeaway] = copy.scenes;

  return `Haz un video vertical (9:16) de 23 a 26 segundos para Instagram Reels y TikTok, de FitPlan (app de entrenamiento y nutrición personalizados con IA, con opción de coach real 1 a 1).

OBJETIVO REAL DE ESTE VIDEO (léelo antes de decidir nada): no es "quedar bonito", es RETENER. El video se distribuye por lotes: si la gente lo ve entero, se muestra a más gente; si abandona en el primer segundo, muere. Cada decisión de montaje se toma para que nadie abandone. Prioriza densidad y ritmo por encima de elegancia.

ARRANQUE (lo más importante de todo): el primer fotograma tiene que romper el patrón visual del feed — movimiento, una cara con emoción marcada, o un plano con algo llamativo o fuera de lugar. PROHIBIDO abrir con logo, con pantalla de marca, con fundido desde negro o con un plano lento y contemplativo: si el primer segundo parece un anuncio, la gente hace scroll antes de procesarlo conscientemente y el video no llega a ninguna parte.

IDIOMA Y ACENTO (no negociable): el presentador habla en ESPAÑOL DE ESPAÑA (castellano peninsular), con acento de España — nunca acento latinoamericano, mexicano ni rioplatense/argentino. Todo el texto en pantalla también en español de España (tú/vosotros, nunca "vos").

LOGO DE MARCA (no negociable): te adjunto el logo oficial de FitPlan como archivo — son dos trazos afilados en diagonal, en gradiente de azul a verde, que sugieren una zancada. USA ESE LOGO REAL (el archivo adjunto) donde corresponda, en vez de inventar o dibujar un logo propio o un wordmark distinto. El nombre de marca es "FitPlan", sin "AI" detrás.

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
${BRAND_CLOSE}

Que se sienta como una pieza de creador con producción alta, no como un anuncio de televisión: el objetivo es que alguien lo vea entero sin darse cuenta de que le estaban vendiendo algo.`;
}
