const HEYGEN_API_BASE = "https://api.heygen.com";

type HeygenVideoDetail = {
  status: "pending" | "processing" | "completed" | "failed";
  video_url?: string | null;
  thumbnail_url?: string | null;
  error?: unknown;
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `HeyGen no está configurado (falta ${name}). El avatar/voz clonada se configuran una vez en HeyGen y se referencian acá vía env vars.`
    );
  }
  return value;
}

/**
 * Crea un video del avatar de HeyGen (foto animada + lip-sync) diciendo el
 * guion con la voz clonada del founder. HeyGen hace la síntesis de voz
 * internamente (motor Starfish) a partir de `voice_id` — no hace falta un
 * paso de TTS aparte como con la narración de OpenAI del pipeline viejo.
 * `fit: "cover"` evita que quede con barras arriba/abajo si el encuadre de
 * la foto del avatar no es exactamente 9:16. Los captions quemados
 * (`caption.style`) reemplazan los frames de texto de marca que generaba
 * `renderSocialImage` en el pipeline viejo.
 */
async function createAvatarVideo(script: string): Promise<string> {
  const apiKey = requireEnv("HEYGEN_API_KEY");
  const avatarId = requireEnv("HEYGEN_AVATAR_ID");
  const voiceId = requireEnv("HEYGEN_VOICE_ID");

  const resp = await fetch(`${HEYGEN_API_BASE}/v3/videos`, {
    method: "POST",
    headers: { "X-Api-Key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "avatar",
      avatar_id: avatarId,
      voice_id: voiceId,
      script,
      aspect_ratio: "9:16",
      resolution: "1080p",
      fit: "cover",
      caption: { style: "default" },
    }),
  });
  const data = await resp.json();
  const videoId = data?.data?.video_id;
  if (!resp.ok || !videoId) {
    throw new Error(`HeyGen (crear video) falló: ${JSON.stringify(data)}`);
  }
  return String(videoId);
}

async function pollAvatarVideo(videoId: string, maxWaitMs: number, pollIntervalMs: number): Promise<{ videoUrl: string; thumbnailUrl: string | null }> {
  const apiKey = requireEnv("HEYGEN_API_KEY");
  const deadline = Date.now() + maxWaitMs;

  while (Date.now() < deadline) {
    const resp = await fetch(`${HEYGEN_API_BASE}/v3/videos/${videoId}`, {
      headers: { "X-Api-Key": apiKey },
    });
    const data = await resp.json();
    const detail: HeygenVideoDetail | undefined = data?.data;

    if (detail?.status === "completed") {
      if (!detail.video_url) throw new Error("HeyGen marcó el video como 'completed' pero no devolvió video_url.");
      return { videoUrl: detail.video_url, thumbnailUrl: detail.thumbnail_url ?? null };
    }
    if (detail?.status === "failed") {
      throw new Error(`HeyGen no pudo generar el video (status failed): ${JSON.stringify(detail)}`);
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error(`HeyGen no terminó de generar el video dentro de ${Math.round(maxWaitMs / 1000)}s (video_id ${videoId}).`);
}

/**
 * Genera el video del avatar hablando `script` y devuelve el buffer del MP4
 * ya descargado (la URL de HeyGen es presignada y expira, así que hay que
 * bajarla acá para re-subirla a Cloudinary como el resto del pipeline).
 * En una prueba real un guion corto tardó ~52s en completarse — entra
 * cómodo dentro del maxDuration de 300s del endpoint que llama a esto.
 */
export async function generateAvatarVideoBuffer(script: string, opts?: { maxWaitMs?: number }): Promise<Buffer> {
  const videoId = await createAvatarVideo(script);
  const { videoUrl } = await pollAvatarVideo(videoId, opts?.maxWaitMs ?? 200000, 4000);

  const videoResp = await fetch(videoUrl);
  if (!videoResp.ok) {
    throw new Error(`No se pudo descargar el video generado por HeyGen (HTTP ${videoResp.status}).`);
  }
  return Buffer.from(await videoResp.arrayBuffer());
}
