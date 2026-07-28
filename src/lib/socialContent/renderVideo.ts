import { execFile } from "child_process";
import { promisify } from "util";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";

const execFileAsync = promisify(execFile);
const ffmpegPath = ffmpegInstaller.path;

const FPS = 30;
const DEFAULT_SCENE_SECONDS = 2.8;
export const DEFAULT_TRANSITION_SECONDS = 0.6;
const FFMPEG_TIMEOUT_MS = 45000;
const FFMPEG_MAX_BUFFER = 1024 * 1024 * 20;

/**
 * Genera un clip individual (MP4, sin transiciones) a partir de una imagen
 * estática, con zoom lento — alternando zoom-in/zoom-out según el índice de
 * escena para que varias escenas seguidas no se sientan repetitivas.
 */
async function renderSceneClip(imagePath: string, outputPath: string, seconds: number, sceneIndex: number): Promise<void> {
  const totalFrames = Math.round(seconds * FPS);
  const zoomExpr =
    sceneIndex % 2 === 0
      ? "min(zoom+0.0015,1.12)" // zoom in
      : "if(eq(on,0),1.12,max(zoom-0.0015,1.0))"; // zoom out

  const filter = [
    "scale=1080:1920",
    `zoompan=z='${zoomExpr}':d=${totalFrames}:s=1080x1920:fps=${FPS}`,
    "format=yuv420p",
  ].join(",");

  await execFileAsync(
    ffmpegPath,
    ["-y", "-loop", "1", "-i", imagePath, "-vf", filter, "-t", String(seconds), "-movflags", "+faststart", "-an", outputPath],
    { timeout: FFMPEG_TIMEOUT_MS, maxBuffer: FFMPEG_MAX_BUFFER }
  );
}

/** Combina dos clips con un crossfade, usando la duración real del primero. */
async function xfadeClips(clipAPath: string, clipBPath: string, outputPath: string, clipADuration: number, transitionSeconds: number): Promise<void> {
  const offset = Math.max(0, clipADuration - transitionSeconds).toFixed(3);
  const filter = `[0:v][1:v]xfade=transition=fade:duration=${transitionSeconds}:offset=${offset},format=yuv420p`;
  await execFileAsync(
    ffmpegPath,
    ["-y", "-i", clipAPath, "-i", clipBPath, "-filter_complex", filter, "-movflags", "+faststart", "-an", outputPath],
    { timeout: FFMPEG_TIMEOUT_MS, maxBuffer: FFMPEG_MAX_BUFFER }
  );
}

/**
 * Renderiza un video multi-escena (formato vertical 9:16) a partir de varios
 * frames de imagen ya diseñados (uno por escena: hook, insight, takeaway,
 * cta — ver renderSocialImage.tsx), encadenados con crossfade y zoom
 * alternado. Corre en una función Node normal (no Edge) usando el binario de
 * ffmpeg empaquetado por @ffmpeg-installer/ffmpeg.
 *
 * Implementación deliberada como N-1 pasos de xfade *por pares* (cada uno un
 * proceso ffmpeg separado y simple) en vez de un único filter_complex gigante
 * con todas las transiciones encadenadas: un intento inicial con todo en un
 * solo grafo de filtros quedaba colgado / no respetaba la duración total de
 * forma confiable. Esta versión es más verbosa pero cada paso es trivial de
 * razonar y quedó validada con pruebas (duración final exacta).
 *
 * No se usa Remotion/un renderer basado en Chromium: no corre de forma
 * confiable en una función serverless por tiempo/tamaño de deploy.
 */
export async function renderMultiSceneVideo(
  sceneImages: Buffer[],
  opts?: { sceneDurationSeconds?: number; transitionSeconds?: number }
): Promise<Buffer> {
  if (sceneImages.length === 0) {
    throw new Error("renderMultiSceneVideo necesita al menos una imagen de escena.");
  }

  const sceneSeconds = opts?.sceneDurationSeconds ?? DEFAULT_SCENE_SECONDS;
  const transitionSeconds = opts?.transitionSeconds ?? DEFAULT_TRANSITION_SECONDS;

  const workDir = await mkdtemp(path.join(tmpdir(), "fitplan-social-"));
  try {
    const clipPaths: string[] = [];
    for (let i = 0; i < sceneImages.length; i++) {
      const imagePath = path.join(workDir, `scene${i}.png`);
      await writeFile(imagePath, sceneImages[i]);
      const clipPath = path.join(workDir, `clip${i}.mp4`);
      await renderSceneClip(imagePath, clipPath, sceneSeconds, i);
      clipPaths.push(clipPath);
    }

    if (clipPaths.length === 1) {
      return await readFile(clipPaths[0]);
    }

    let currentPath = clipPaths[0];
    let currentDuration = sceneSeconds;
    for (let i = 1; i < clipPaths.length; i++) {
      const mergedPath = path.join(workDir, `merged${i}.mp4`);
      await xfadeClips(currentPath, clipPaths[i], mergedPath, currentDuration, transitionSeconds);
      currentPath = mergedPath;
      currentDuration = currentDuration + sceneSeconds - transitionSeconds;
    }

    return await readFile(currentPath);
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

/** Video de una sola escena (usado por el flujo automático diario, más liviano). */
export async function renderZoomVideoFromImage(imageBuffer: Buffer): Promise<Buffer> {
  return renderMultiSceneVideo([imageBuffer], { sceneDurationSeconds: 6 });
}

/**
 * Duración de un archivo de audio/video en segundos, parseada de la salida
 * de `ffmpeg -i` (no hace falta ffprobe aparte: ffmpeg imprime "Duration:
 * HH:MM:SS.cc" en stderr al inspeccionar el archivo, incluso cuando el
 * comando "falla" por no tener un output — que es justamente el truco que
 * se usa acá, capturando el stderr del error esperado).
 */
export async function probeDurationSeconds(buffer: Buffer, extension: "mp3" | "mp4"): Promise<number> {
  const workDir = await mkdtemp(path.join(tmpdir(), "fitplan-probe-"));
  const inputPath = path.join(workDir, `input.${extension}`);
  try {
    await writeFile(inputPath, buffer);
    let stderr = "";
    try {
      await execFileAsync(ffmpegPath, ["-i", inputPath], { timeout: 15000, maxBuffer: FFMPEG_MAX_BUFFER });
    } catch (err) {
      stderr = (err as { stderr?: string }).stderr || "";
    }
    const match = stderr.match(/Duration:\s*(\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
    if (!match) {
      throw new Error("No se pudo determinar la duración del archivo de audio.");
    }
    const [, hh, mm, ss, cc] = match;
    return parseInt(hh, 10) * 3600 + parseInt(mm, 10) * 60 + parseInt(ss, 10) + parseInt(cc, 10) / 100;
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * Calcula la duración de escena necesaria para que un video de `numScenes`
 * escenas (con transiciones de `transitionSeconds`) dure al menos
 * `targetTotalSeconds` en total — usado para que el video dure lo mismo (o
 * un poco más) que la narración en audio que se le va a mezclar.
 */
export function sceneDurationForTarget(targetTotalSeconds: number, numScenes: number, transitionSeconds = DEFAULT_TRANSITION_SECONDS): number {
  if (numScenes <= 1) return Math.max(targetTotalSeconds, 3);
  const raw = (targetTotalSeconds + (numScenes - 1) * transitionSeconds) / numScenes;
  return Math.max(raw, 1.8); // piso para que ninguna escena sea imperceptible
}

/** Duración total resultante de un video de `numScenes` escenas de `sceneSeconds` c/u con crossfades. */
export function totalVideoDuration(sceneSeconds: number, numScenes: number, transitionSeconds = DEFAULT_TRANSITION_SECONDS): number {
  if (numScenes <= 1) return sceneSeconds;
  return numScenes * sceneSeconds - (numScenes - 1) * transitionSeconds;
}

/**
 * Mezcla una pista de audio (narración) en un video mudo ya renderizado. El
 * video SIEMPRE manda en duración (se fuerza `-t videoDurationSeconds`
 * explícito): si el audio es más corto, el resto queda en silencio; si por
 * algún motivo es más largo (no debería, ver `sceneDurationForTarget`), se
 * corta al terminar el video en vez de alargar la salida.
 */
export async function muxAudioIntoVideo(videoBuffer: Buffer, audioBuffer: Buffer, videoDurationSeconds: number): Promise<Buffer> {
  const workDir = await mkdtemp(path.join(tmpdir(), "fitplan-mux-"));
  const videoPath = path.join(workDir, "video.mp4");
  const audioPath = path.join(workDir, "audio.mp3");
  const outputPath = path.join(workDir, "output.mp4");
  try {
    await writeFile(videoPath, videoBuffer);
    await writeFile(audioPath, audioBuffer);

    await execFileAsync(
      ffmpegPath,
      [
        "-y",
        "-i", videoPath,
        "-i", audioPath,
        "-map", "0:v:0",
        "-map", "1:a:0",
        "-c:v", "copy",
        "-c:a", "aac",
        "-b:a", "128k",
        "-t", String(videoDurationSeconds),
        "-movflags", "+faststart",
        outputPath,
      ],
      { timeout: FFMPEG_TIMEOUT_MS, maxBuffer: FFMPEG_MAX_BUFFER }
    );

    return await readFile(outputPath);
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}
