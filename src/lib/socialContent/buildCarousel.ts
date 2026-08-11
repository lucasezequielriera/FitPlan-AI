import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { generateCarouselCopy } from "@/lib/socialContent/carouselCopy";
import { renderSlide, type SlideSpec } from "@/lib/socialContent/renderCarouselSlide";
import { uploadBufferToCloudinary } from "@/lib/socialContent/cloudinaryUpload";
import { suggestSocialTopic } from "@/lib/socialContent/generateCopy";
import { DEFAULT_PRICE_LABEL } from "@/lib/socialContent/carouselScheduleStore";

export const MIN_SLIDES = 3;
export const MAX_SLIDES = 10;

/**
 * Elimina en profundidad las claves con valor `undefined`.
 *
 * Las diapositivas tienen varios campos opcionales (`delta`, `note`,
 * `emphasis`, `caption`…) y Firestore rechaza el documento entero si alguno
 * llega como `undefined`, en lugar de ignorarlo.
 */
export function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) return value.map((v) => stripUndefined(v)) as unknown as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) out[k] = stripUndefined(v);
    }
    return out as T;
  }
  return value;
}

export type BuiltCarousel = {
  draftId: string;
  topic: string;
  imageUrls: string[];
  caption: string;
  slideCount: number;
};

/**
 * Genera un carrusel completo (copy + imágenes en Cloudinary) y lo deja como
 * borrador en `socialContentCarousel`.
 *
 * Lo comparten el botón del panel y el cron de carruseles automáticos, para
 * que ambos produzcan exactamente la misma pieza.
 *
 * `docId` fija el identificador del borrador: los automáticos lo usan para ser
 * idempotentes (un doc por franja y día, de modo que dos ticks seguidos no
 * generen dos carruseles).
 */
export async function buildCarousel(
  db: Firestore,
  opts: { topic?: string; slideCount: number; priceLabel?: string; createdBy: string; docId?: string; slotLocal?: string }
): Promise<BuiltCarousel> {
  const slideCount = Math.min(MAX_SLIDES, Math.max(MIN_SLIDES, Math.round(opts.slideCount)));
  const topic = opts.topic?.trim() || (await suggestSocialTopic());
  const copy = await generateCarouselCopy(topic, slideCount);

  const draftRef = opts.docId
    ? db.collection("socialContentCarousel").doc(opts.docId)
    : db.collection("socialContentCarousel").doc();

  const total = copy.slides.length;
  const priceLabel = opts.priceLabel?.trim() || DEFAULT_PRICE_LABEL;

  // El precio se impone aquí y no se deja al modelo: es un dato de negocio que
  // tiene que coincidir con el checkout, así que no puede depender de que la
  // IA lo repita bien.
  const specs: SlideSpec[] = copy.slides.map((s, i) => {
    const base = { ...s, index: i + 1, total } as SlideSpec;
    return base.kind === "cta" ? { ...base, price: priceLabel } : base;
  });

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

  await draftRef.set(
    stripUndefined({
      topic,
      slideCount: total,
      specs,
      imageUrls,
      caption,
      copy,
      priceLabel,
      ...(opts.slotLocal ? { slotLocal: opts.slotLocal, source: "automatico" } : { source: "manual" }),
      status: "draft",
      createdBy: opts.createdBy,
      createdAt: FieldValue.serverTimestamp(),
    })
  );

  return { draftId: draftRef.id, topic, imageUrls, caption, slideCount: total };
}
