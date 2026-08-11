import type { NextApiRequest, NextApiResponse } from "next";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/adminAuthServer";
import { generateCarouselCopy } from "@/lib/socialContent/carouselCopy";
import { renderSlide, type SlideSpec } from "@/lib/socialContent/renderCarouselSlide";
import { uploadBufferToCloudinary } from "@/lib/socialContent/cloudinaryUpload";
import { suggestSocialTopic } from "@/lib/socialContent/generateCopy";

export const MIN_SLIDES = 3;
export const MAX_SLIDES = 10;

/**
 * Elimina las claves con valor `undefined` en profundidad.
 *
 * Las diapositivas tienen varios campos opcionales (`delta`, `note`,
 * `emphasis`, `caption`…) y Firestore rechaza el documento entero si alguno
 * llega como `undefined`, en lugar de ignorarlo.
 */
function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((v) => stripUndefined(v)) as unknown as T;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) out[k] = stripUndefined(v);
    }
    return out as T;
  }
  return value;
}

/**
 * Genera (pero NO publica) un carrusel de Instagram: copy + imágenes.
 *
 * Guarda un borrador en `socialContentCarousel` con las URLs ya subidas a
 * Cloudinary, para que publicar después no tenga que volver a renderizar. Las
 * imágenes deben estar accesibles por URL pública porque Instagram las
 * descarga él mismo al crear el carrusel.
 *
 * Sin `topic` en el cuerpo, lo elige la IA.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const auth = await requireAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const db = getAdminDb();
  if (!db) return res.status(500).json({ error: "Firebase Admin SDK no configurado" });

  const requested = Number(req.body?.slideCount);
  const slideCount = Number.isFinite(requested)
    ? Math.min(MAX_SLIDES, Math.max(MIN_SLIDES, Math.round(requested)))
    : 5;

  const bodyTopic = typeof req.body?.topic === "string" ? req.body.topic.trim() : "";

  try {
    const topic = bodyTopic || (await suggestSocialTopic());
    const copy = await generateCarouselCopy(topic, slideCount);

    const draftRef = db.collection("socialContentCarousel").doc();

    // Las diapositivas se numeran aquí y no en el modelo: el índice depende de
    // cuántas hayan sobrevivido a la validación, no de lo que pidiéramos.
    const total = copy.slides.length;
    const specs: SlideSpec[] = copy.slides.map((s, i) => ({ ...s, index: i + 1, total }) as SlideSpec);

    const imageUrls: string[] = [];
    for (let i = 0; i < specs.length; i++) {
      const png = await renderSlide(specs[i]);
      const url = await uploadBufferToCloudinary(png, {
        folder: "fitplan-carousel",
        publicId: `${draftRef.id}-${String(i + 1).padStart(2, "0")}`,
        resourceType: "image",
      });
      imageUrls.push(url);
    }

    const hashtagsLine = copy.hashtags.map((h) => `#${h}`).join(" ");
    const caption = `${copy.instagramCaption}\n\n${hashtagsLine}`.trim();

    await draftRef.set({
      topic,
      slideCount: total,
      specs: stripUndefined(specs),
      imageUrls,
      caption,
      copy: stripUndefined(copy),
      status: "draft",
      createdBy: auth.uid,
      createdAt: FieldValue.serverTimestamp(),
    });

    return res.status(200).json({ ok: true, draftId: draftRef.id, topic, imageUrls, caption, slideCount: total });
  } catch (error) {
    console.error("Error generando carrusel:", error);
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: "No se pudo generar el carrusel", detail: message });
  }
}
