import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(503).json({ error: "OPENAI_API_KEY no configurada" });

  const { dish, tipoDieta, restricciones, preferencias, patologias } = req.body as { 
    dish: string; 
    tipoDieta?: string; 
    restricciones?: string[]; 
    preferencias?: string[]; 
    patologias?: string[]; 
  };
  if (!dish) return res.status(400).json({ error: "Falta 'dish'" });

  try {
    // Construir instrucciones estrictas según tipo de dieta
    let instruccionesDieta = "";
    if (tipoDieta === "vegana") {
      instruccionesDieta = `⚠️ CRÍTICO - DIETA VEGANA (ABSOLUTAMENTE ESTRICTO):
- SOLO alimentos de origen vegetal. CERO productos de origen animal.
- EXCLUIR COMPLETAMENTE en ingredientes: huevos (en CUALQUIER forma: enteros, claras, yemas, revueltos, tortillas con huevo), leche, queso, yogurt, mantequilla, crema, nata, miel, gelatina, carnes (res, pollo, cerdo, pavo, cordero), pescados (atún, salmón, merluza), mariscos (camarones, langostinos).
- EXCLUIR COMPLETAMENTE en métodos de preparación: "agregar huevo", "batir con huevo", "cocinar con mantequilla", "servir con queso", "añadir leche", etc.
- USAR SOLO: legumbres (garbanzos, lentejas, frijoles, soja), cereales (arroz, quinoa, avena), vegetales, frutas, frutos secos, semillas, tofu, tempeh, leches vegetales (almendras, avena, coco), aceites vegetales.
- Si el plato menciona huevos, lácteos, carnes o pescados, DEBES adaptarlo completamente a versión vegana usando alternativas vegetales.`;
    } else if (tipoDieta === "vegetariana") {
      instruccionesDieta = `⚠️ DIETA VEGETARIANA (ESTRICTO):
- EXCLUIR: carnes (res, pollo, cerdo, pavo, cordero) y pescados (atún, salmón, merluza, etc.).
- PERMITIR: huevos y lácteos (leche, queso, yogurt, mantequilla).
- Enfoque en vegetales, frutas, legumbres y granos.`;
    } else if (tipoDieta === "pescatariana") {
      instruccionesDieta = `⚠️ DIETA PESCATARIANA (ESTRICTO):
- EXCLUIR: carnes rojas, aves (pollo, pavo) y otras carnes.
- PERMITIR: pescados, mariscos, huevos y lácteos.
- Enfoque vegetal con omega-3 del pescado.`;
    } else if (tipoDieta === "paleo") {
      instruccionesDieta = `⚠️ DIETA PALEO (ESTRICTO):
- PERMITIR: carnes, pescados, huevos, frutas, verduras, frutos secos, semillas.
- EXCLUIR: granos, legumbres, lácteos, alimentos procesados, azúcares refinados.`;
    } else if (tipoDieta === "keto") {
      instruccionesDieta = `⚠️ DIETA KETO (ESTRICTO):
- Muy alta en grasas (70-80%), moderada en proteínas (20-25%), muy baja en carbohidratos (menos de 20-50g/día).
- EXCLUIR: granos, azúcares, legumbres, frutas dulces.`;
    } else if (tipoDieta === "sin_gluten") {
      instruccionesDieta = `⚠️ DIETA SIN GLUTEN (ESTRICTO):
- EXCLUIR: trigo, cebada, centeno, avena (a menos que sea certificada sin gluten), y todos los derivados.
- NO incluir: pan, pasta, harina de trigo, galletas, etc.`;
    }

    // Construir instrucciones de restricciones
    let instruccionesRestricciones = "";
    if (restricciones && restricciones.length > 0) {
      instruccionesRestricciones = `\n⚠️ RESTRICCIONES DEL USUARIO (EXCLUIR ABSOLUTAMENTE):
${restricciones.map(r => {
  const rLower = String(r).toLowerCase().trim();
  if (rLower.includes('pescado') || rLower.includes('pescados') || rLower.includes('marisco') || rLower.includes('mariscos')) {
    return `- "${r}": EXCLUIR: atún, salmón, merluza, sardinas, caballa, bacalao, trucha, lubina, dorada, langostinos, camarones, calamares, pulpo, mejillones, almejas, y TODOS los pescados y mariscos.`;
  }
  if (rLower.includes('gluten')) {
    return `- "${r}": EXCLUIR: trigo, cebada, centeno, avena (a menos que sea certificada sin gluten), y TODOS los derivados. NO incluir pan, pasta, harina, galletas, etc.`;
  }
  if (rLower.includes('lacteo') || rLower.includes('lácteo')) {
    return `- "${r}": EXCLUIR: leche, queso, yogurt, mantequilla, crema, nata, y TODOS los derivados lácteos.`;
  }
  if (rLower.includes('huevo') || rLower.includes('huevos')) {
    return `- "${r}": EXCLUIR: huevos, claras de huevo, yemas, y TODOS los productos que contengan huevo.`;
  }
  return `- "${r}": EXCLUIR COMPLETAMENTE este alimento o ingrediente y TODOS sus derivados.`;
}).join('\n')}`;
    }

    const prompt = `Devolvé solo JSON (sin texto extra) con ingredientes y pasos para el plato "${dish}".
{
  "ingredientes": string[],
  "pasos_preparacion": string[]
}
Reglas:
- 3 a 5 ingredientes con cantidades ("cantidad unidad - ingrediente").
- 3 a 5 pasos claros y breves (máx 80 caracteres).
${instruccionesDieta ? `\n${instruccionesDieta}` : ''}
${instruccionesRestricciones ? `\n${instruccionesRestricciones}` : ''}
${preferencias && preferencias.length > 0 ? `\nPREFERENCIAS (priorizar): ${preferencias.join(', ')}` : ''}
${patologias && patologias.length > 0 ? `\nPATOLOGÍAS (adaptar plan): ${patologias.join(', ')}` : ''}

⚠️ IMPORTANTE: Los ingredientes y pasos de preparación DEBEN respetar ESTRICTAMENTE el tipo de dieta y las restricciones. Si el plato menciona ingredientes prohibidos, DEBES adaptarlo completamente usando alternativas permitidas.`;

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
          { 
            role: "system", 
            content: `Sos un nutricionista experto. Tu respuesta DEBE ser solo JSON válido según el esquema. 
${tipoDieta === "vegana" ? "⚠️ CRÍTICO: Si el tipo de dieta es VEGANA, NO puedes incluir NINGÚN producto de origen animal (huevos, lácteos, carnes, pescados, mariscos, miel, gelatina) en ingredientes ni métodos de preparación. DEBES adaptar completamente el plato a versión vegana usando alternativas vegetales." : ""}
${tipoDieta === "vegetariana" ? "⚠️ Si el tipo de dieta es VEGETARIANA, NO puedes incluir carnes ni pescados. Solo huevos y lácteos están permitidos." : ""}
${restricciones && restricciones.length > 0 ? `⚠️ DEBES respetar ESTRICTAMENTE las restricciones del usuario: ${restricciones.join(', ')}. NO incluir estos alimentos en ingredientes ni métodos de preparación.` : ""}`
          },
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


