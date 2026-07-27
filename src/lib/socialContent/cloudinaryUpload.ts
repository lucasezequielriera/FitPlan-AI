import { createHash } from "crypto";

/**
 * Sube un archivo a Cloudinary usando su API de upload firmado directamente
 * por fetch (sin agregar el SDK `cloudinary` como dependencia nueva —
 * consistente con el resto del proyecto, que ya usa fetch crudo para
 * OpenAI/MercadoPago en vez de SDKs pesados).
 */
export async function uploadBufferToCloudinary(
  buffer: Buffer,
  opts: { folder: string; publicId: string; resourceType?: "image" | "video" }
): Promise<string> {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error(
      "Cloudinary no está configurado (faltan NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME / NEXT_PUBLIC_CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET)."
    );
  }

  const resourceType = opts.resourceType || "image";
  const timestamp = Math.floor(Date.now() / 1000);

  // Cloudinary firma los parámetros (excepto file/api_key/signature) ordenados
  // alfabéticamente como "key=value&key2=value2..." + el api secret.
  const paramsToSign: Record<string, string | number> = {
    folder: opts.folder,
    public_id: opts.publicId,
    timestamp,
  };
  const toSign = Object.keys(paramsToSign)
    .sort()
    .map((k) => `${k}=${paramsToSign[k]}`)
    .join("&");
  const signature = createHash("sha1").update(`${toSign}${apiSecret}`).digest("hex");

  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(buffer)]), `${opts.publicId}`);
  form.append("api_key", apiKey);
  form.append("timestamp", String(timestamp));
  form.append("signature", signature);
  form.append("folder", opts.folder);
  form.append("public_id", opts.publicId);

  const resp = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`, {
    method: "POST",
    body: form,
  });

  if (!resp.ok) {
    const detail = await resp.text().catch(() => "");
    throw new Error(`Cloudinary respondió ${resp.status} al subir ${resourceType}: ${detail}`);
  }

  const data = await resp.json();
  if (typeof data.secure_url !== "string") {
    throw new Error("Cloudinary no devolvió secure_url tras la subida.");
  }
  return data.secure_url as string;
}
