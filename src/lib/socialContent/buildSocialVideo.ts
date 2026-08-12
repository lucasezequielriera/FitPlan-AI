import type { SocialCopyScene } from "@/lib/socialContent/generateCopy";
import { generateVoiceoverAudio } from "@/lib/socialContent/generateVoiceover";
import { generateAvatarVideoBuffer } from "@/lib/socialContent/heygenAvatarVideo";
import {
  muxAudioIntoVideo,
  probeDurationSeconds,
  renderMultiSceneVideo,
  sceneDurationForTarget,
  totalVideoDuration,
} from "@/lib/socialContent/renderVideo";

/**
 * Genera el reel con el avatar de HeyGen (foto animada + lip-sync + voz
 * clonada + captions quemados) diciendo la narración. Reemplaza al pipeline
 * viejo de escenas estáticas con zoom (`buildSocialVideoFromScenes` abajo,
 * que se deja sin usar por si hiciera falta volver atrás): un presentador
 * real hablando es contenido de marketing de otro nivel que frames de texto
 * animados.
 */
export async function buildAvatarSocialVideo(narration: string): Promise<Buffer> {
  const script = narration.trim();
  if (!script) {
    throw new Error("Falta la narración para generar el video del avatar.");
  }
  return generateAvatarVideoBuffer(script);
}

/** Buffer de audio de reserva para no dejar el reel mudo si falla la síntesis de voz. */
const AUDIO_TAIL_BUFFER_SECONDS = 1.2;
const FALLBACK_SCENE_DURATION_SECONDS = 2.8;

/**
 * Renderiza el frame de marca de cada escena (vía el endpoint Edge
 * /api/internal/renderSocialImage), genera la narración en voz (TTS) y arma
 * el video final: dimensiona las escenas para que el video dure al menos lo
 * que dura la narración, las combina con crossfade/zoom, y mezcla el audio.
 * Si la narración falla (ej. TTS caído), el video sigue generandose mudo en
 * vez de romper todo el pipeline — mejor un reel sin audio que ninguno.
 *
 * Usado tanto por el cron diario como por el generador manual del panel
 * admin, para no duplicar esta orquestación en los dos lugares.
 */
export async function buildSocialVideoFromScenes(scenes: SocialCopyScene[], origin: string, narration?: string): Promise<Buffer> {
  let audioBuffer: Buffer | null = null;
  let targetDurationSeconds: number | null = null;

  if (narration && narration.trim()) {
    try {
      audioBuffer = await generateVoiceoverAudio(narration.trim());
      const audioDuration = await probeDurationSeconds(audioBuffer, "mp3");
      targetDurationSeconds = audioDuration + AUDIO_TAIL_BUFFER_SECONDS;
    } catch (err) {
      console.warn("⚠️ No se pudo generar/medir la narración, el reel sale mudo:", err);
      audioBuffer = null;
    }
  }

  const sceneSeconds = targetDurationSeconds
    ? sceneDurationForTarget(targetDurationSeconds, scenes.length)
    : FALLBACK_SCENE_DURATION_SECONDS;

  const frameBuffers: Buffer[] = [];
  for (const scene of scenes) {
    const params = new URLSearchParams({
      headline: scene.headline,
      subtext: scene.subtext || "",
      format: "story",
    });
    const resp = await fetch(`${origin}/api/internal/renderSocialImage?${params}`);
    if (!resp.ok) {
      throw new Error(`No se pudo renderizar una escena del video social (HTTP ${resp.status})`);
    }
    frameBuffers.push(Buffer.from(await resp.arrayBuffer()));
  }

  const silentVideo = await renderMultiSceneVideo(frameBuffers, { sceneDurationSeconds: sceneSeconds });

  if (!audioBuffer) {
    return silentVideo;
  }

  const videoDuration = totalVideoDuration(sceneSeconds, scenes.length);
  return muxAudioIntoVideo(silentVideo, audioBuffer, videoDuration);
}
