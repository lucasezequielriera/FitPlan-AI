import { execFile } from "child_process";
import { promisify } from "util";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";

const execFileAsync = promisify(execFile);
const ffmpegPath = ffmpegInstaller.path;

const VIDEO_DURATION_SECONDS = 6;
const FPS = 30;

/**
 * Convierte un frame de imagen estático (PNG) en un video corto (MP4, formato
 * vertical 9:16) con un efecto de zoom lento — ffmpeg corre en una función
 * Node normal (no Edge), usando el binario empaquetado por
 * @ffmpeg-installer/ffmpeg (instala el binario correcto por plataforma en
 * `npm install`, incluido en Vercel al buildear).
 *
 * Deliberadamente NO se usa Remotion/un renderer basado en Chromium acá: no
 * corre de forma confiable en una función serverless por tiempo/tamaño. Este
 * approach (imagen + zoompan de ffmpeg) sí corre en segundos y sin
 * infraestructura adicional — el tradeoff es que es un video de una sola
 * escena con movimiento sutil, no una animación multi-escena con gráficos de
 * datos.
 */
export async function renderZoomVideoFromImage(imageBuffer: Buffer): Promise<Buffer> {
  const workDir = await mkdtemp(path.join(tmpdir(), "fitplan-social-"));
  const inputPath = path.join(workDir, "frame.png");
  const outputPath = path.join(workDir, "output.mp4");

  try {
    await writeFile(inputPath, imageBuffer);

    const totalFrames = VIDEO_DURATION_SECONDS * FPS;
    // zoompan: zoom lento de 1.0 a ~1.12 a lo largo del video, centrado.
    // scale primero a un tamaño mayor para que el zoom no pixele el resultado.
    const filter = [
      "scale=1080:1920",
      `zoompan=z='min(zoom+0.0015,1.12)':d=${totalFrames}:s=1080x1920:fps=${FPS}`,
      "format=yuv420p",
    ].join(",");

    await execFileAsync(
      ffmpegPath,
      [
        "-y",
        "-loop", "1",
        "-i", inputPath,
        "-vf", filter,
        "-t", String(VIDEO_DURATION_SECONDS),
        "-movflags", "+faststart",
        "-an",
        outputPath,
      ],
      { timeout: 60000, maxBuffer: 1024 * 1024 * 20 }
    );

    return await readFile(outputPath);
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}
