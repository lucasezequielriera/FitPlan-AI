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
const DEFAULT_TRANSITION_SECONDS = 0.6;
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
