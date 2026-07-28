/**
 * Sintetiza el guion de narración en audio (MP3) vía la API de
 * texto-a-voz de OpenAI — mismo proveedor que ya se usa para todo lo demás
 * en el proyecto, sin agregar una cuenta/servicio nuevo.
 */
export async function generateVoiceoverAudio(text: string): Promise<Buffer> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY no configurada — no se puede generar la narración.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  let resp: Response;
  try {
    resp = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "tts-1",
        voice: "onyx",
        input: text,
        response_format: "mp3",
        speed: 1.03,
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!resp.ok) {
    const detail = await resp.text().catch(() => "");
    throw new Error(`OpenAI TTS respondió ${resp.status}: ${detail}`);
  }

  return Buffer.from(await resp.arrayBuffer());
}
