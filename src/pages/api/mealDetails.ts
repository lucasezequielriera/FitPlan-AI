import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(503).json({ error: "OPENAI_API_KEY no configurada" });

  const { dish, contexto } = req.body as { dish: string; contexto?: any };
  if (!dish) return res.status(400).json({ error: "Falta 'dish'" });

  try {
    const prompt = `Devolvé solo JSON (sin texto extra) con ingredientes y pasos para el plato "${dish}".
{
  "ingredientes": string[],
  "pasos_preparacion": string[]
}
Reglas:
- 3 a 5 ingredientes con cantidades ("cantidad unidad - ingrediente").
- 3 a 5 pasos claros y breves (máx 80 caracteres).
Contexto opcional: ${JSON.stringify(contexto ?? {})}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.6,
        max_tokens: 400,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "Respondé solo con JSON válido según el esquema" },
          { role: "user", content: prompt },
        ],
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!resp.ok) {
      const detail = await resp.text().catch(() => "");
      return res.status(502).json({ error: "OpenAI no disponible", detail });
    }

    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) return res.status(502).json({ error: "Respuesta vacía de OpenAI" });
    let parsed: any;
    try { parsed = JSON.parse(content); } catch { parsed = null; }
    if (!parsed) return res.status(422).json({ error: "JSON inválido devuelto por OpenAI" });
    return res.status(200).json(parsed);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return res.status(502).json({ error: "Fallo al generar detalles", detail: message });
  }
}


