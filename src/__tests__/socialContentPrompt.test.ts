import { buildCommercialPrompt } from "@/lib/socialContent/buildCommercialPrompt";
import { DEFAULT_PRICE_LABEL } from "@/lib/socialContent/carouselScheduleStore";
import { getStripeSubscriptionPlans } from "@/lib/stripePlanPrices";
import type { SocialCopy } from "@/lib/socialContent/generateCopy";

/**
 * Datos de ejemplo para el dry-run: mismo shape que devuelve
 * `generateSocialCopy`, pero sin llamar a OpenAI (esto no cuesta nada y no
 * publica nada — solo arma el prompt en texto que se le mandaría a HeyGen).
 */
const sampleCopy: SocialCopy = {
  scenes: [
    { headline: "¿Entrenas en ayunas para quemar más grasa?" },
    { headline: "Eso ralentiza tu metabolismo", subtext: "El cuerpo entra en modo ahorro de energía" },
    { headline: "Come algo ligero antes", subtext: "Y entrena con más intensidad real" },
    { headline: "El mito muere aquí" },
  ],
  instagramCaption: "Caption de ejemplo",
  tiktokCaption: "Caption corto",
  hashtags: ["fitplanai", "entrenamiento"],
  narration:
    "Entrenar en ayunas para quemar más grasa es uno de los mitos más repetidos del fitness. La realidad es que sin glucógeno disponible, el cuerpo entra en modo ahorro y baja la intensidad real del entreno, así que quemas menos, no más. Come algo ligero antes, aunque sea poco, y vas a poder entrenar más fuerte. El mito muere aquí.",
  altText: "Vídeo explicando por qué entrenar en ayunas no quema más grasa.",
};

describe("buildCommercialPrompt (dry-run, sin llamadas externas)", () => {
  const prompt = buildCommercialPrompt(sampleCopy);

  it('nunca menciona "Volt" — es el nombre interno del rediseño, no de la marca', () => {
    expect(prompt.toLowerCase()).not.toContain("volt");
  });

  it('el nombre de marca aparece como "FitPlan" a secas, nunca "FitPlan Volt" ni "FitPlan AI"', () => {
    expect(prompt).toContain("FitPlan");
    expect(prompt).not.toMatch(/FitPlan\s+Volt/i);
    expect(prompt).not.toMatch(/FitPlan\s+AI\b/i);
  });

  it("la instrucción de paleta sigue presente (el modelo tiene que seguir sabiendo qué colores usar)", () => {
    expect(prompt).toContain("#cbff3d");
    expect(prompt.toLowerCase()).toContain("lima");
  });
});

describe("Precio del carrusel — una sola fuente de verdad", () => {
  it("DEFAULT_PRICE_LABEL usa el mismo precio mensual EUR que Stripe, no un número aparte", () => {
    const monthlyEur = getStripeSubscriptionPlans("eur").monthly.price;
    expect(DEFAULT_PRICE_LABEL).toBe(`Premium desde ${monthlyEur} €/mes`);
  });

  it("coincide con el precio publicado en la landing (5 EUR/mes)", () => {
    expect(DEFAULT_PRICE_LABEL).toBe("Premium desde 5 €/mes");
  });
});
