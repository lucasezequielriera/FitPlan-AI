const HEYGEN_API_BASE = "https://api.heygen.com";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`HeyGen no está configurado (falta ${name}).`);
  }
  return value;
}

export type VideoAgentSessionStatus = {
  status: "thinking" | "waiting_for_input" | "reviewing" | "generating" | "completed" | "failed";
  videoId: string | null;
  progress: number;
};

export type HeygenVideoStatus = {
  status: "pending" | "processing" | "completed" | "failed";
  videoUrl: string | null;
};

/**
 * Arranca una sesión de HeyGen Video Agent (modo "generate", fire-and-forget)
 * para un comercial multi-escena. A diferencia del avatar simple
 * (heygenAvatarVideo.ts), esto puede tardar varios minutos en terminar —
 * por eso NO se espera acá adentro (sin polling bloqueante): quien llama
 * guarda el session_id/video_id devuelto y chequea el estado en un tick
 * posterior (ver generateDailyContent.ts).
 */
export async function createCommercialSession(prompt: string, opts?: { fileUrls?: string[] }): Promise<{ sessionId: string; videoId: string | null }> {
  const apiKey = requireEnv("HEYGEN_API_KEY");
  const avatarId = requireEnv("HEYGEN_AVATAR_ID");
  const voiceId = requireEnv("HEYGEN_VOICE_ID");

  const files = opts?.fileUrls?.length ? opts.fileUrls.map((url) => ({ type: "url", url })) : undefined;

  const resp = await fetch(`${HEYGEN_API_BASE}/v3/video-agents`, {
    method: "POST",
    headers: { "X-Api-Key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt,
      mode: "generate",
      avatar_id: avatarId,
      voice_id: voiceId,
      orientation: "portrait",
      ...(files ? { files } : {}),
    }),
  });
  const data = await resp.json();
  const sessionId = data?.data?.session_id;
  if (!resp.ok || !sessionId) {
    throw new Error(`HeyGen (crear video-agent session) falló: ${JSON.stringify(data)}`);
  }
  return { sessionId: String(sessionId), videoId: data.data.video_id ? String(data.data.video_id) : null };
}

/** Chequeo puntual (no bloqueante) del estado de una sesión de Video Agent. */
export async function getSessionStatus(sessionId: string): Promise<VideoAgentSessionStatus> {
  const apiKey = requireEnv("HEYGEN_API_KEY");
  const resp = await fetch(`${HEYGEN_API_BASE}/v3/video-agents/${sessionId}`, {
    headers: { "X-Api-Key": apiKey },
  });
  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(`HeyGen (chequear video-agent session) falló: ${JSON.stringify(data)}`);
  }
  return {
    status: data.data?.status,
    videoId: data.data?.video_id ? String(data.data.video_id) : null,
    progress: typeof data.data?.progress === "number" ? data.data.progress : 0,
  };
}

/** Chequeo puntual (no bloqueante) del estado de render del video final. */
export async function getVideoStatus(videoId: string): Promise<HeygenVideoStatus> {
  const apiKey = requireEnv("HEYGEN_API_KEY");
  const resp = await fetch(`${HEYGEN_API_BASE}/v3/videos/${videoId}`, {
    headers: { "X-Api-Key": apiKey },
  });
  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(`HeyGen (chequear video) falló: ${JSON.stringify(data)}`);
  }
  return { status: data.data?.status, videoUrl: data.data?.video_url ?? null };
}
