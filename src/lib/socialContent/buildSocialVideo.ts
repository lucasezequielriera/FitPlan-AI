import type { SocialCopyScene } from "@/lib/socialContent/generateCopy";
import { renderMultiSceneVideo } from "@/lib/socialContent/renderVideo";

/**
 * Renderiza el frame de marca de cada escena (vía el endpoint Edge
 * /api/internal/renderSocialImage) y los combina en un único video
 * multi-escena. Usado tanto por el cron diario como por el generador manual
 * del panel admin, para no duplicar esta orquestación en los dos lugares.
 */
export async function buildSocialVideoFromScenes(scenes: SocialCopyScene[], origin: string): Promise<Buffer> {
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

  return renderMultiSceneVideo(frameBuffers);
}
