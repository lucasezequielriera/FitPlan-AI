import fs from "fs";
import path from "path";
import { buildCommercialPrompt } from "@/lib/socialContent/buildCommercialPrompt";
import { DEFAULT_PRICE_LABEL, PRICE_LABEL_SUGGESTION } from "@/lib/socialContent/carouselScheduleStore";
import { getPlanSavingsLabel, getStripeSubscriptionPlans } from "@/lib/stripePlanPrices";
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
  it("por defecto NO se publica precio en el carrusel", () => {
    // Decisión de Lucas (2026-09): las piezas de IG venden el resultado, no el
    // precio. Sigue siendo configurable desde el panel si se quiere volver.
    expect(DEFAULT_PRICE_LABEL).toBe("");
  });

  it("si se decide volver a mostrar precio, la sugerencia deriva del precio real", () => {
    const monthlyEur = getStripeSubscriptionPlans("eur").monthly.price;
    expect(PRICE_LABEL_SUGGESTION).toBe(`Premium desde ${monthlyEur} €/mes`);
  });

  it("el prompt le prohíbe al modelo escribir precios", () => {
    // El prompt vive embebido en carouselCopy.ts; se verifica sobre el fuente.
    const src = fs.readFileSync(path.join(process.cwd(), "src/lib/socialContent/carouselCopy.ts"), "utf8");
    expect(src).toMatch(/NO incluyas precio/);
    // Y que no quede un ejemplo con cifra que el modelo pueda copiar.
    expect(src).not.toMatch(/"price":\s*"Premium desde/);
  });

  it("el ahorro anunciado se deriva del precio, no está escrito a mano", () => {
    // Regresión: durante meses el modal decía "Ahorras 20%/58%" fijo mientras
    // los precios cambiaban, así que el porcentaje mostrado era falso.
    for (const plan of ["quarterly", "annual"] as const) {
      const months = plan === "quarterly" ? 3 : 12;
      const monthly = getStripeSubscriptionPlans("eur").monthly.price;
      const esperado = Math.round((1 - getStripeSubscriptionPlans("eur")[plan].price / (monthly * months)) * 100);
      expect(getPlanSavingsLabel("eur", plan)).toBe(`Ahorras ${esperado}%`);
    }
  });

  it("el plan mensual no anuncia ahorro contra sí mismo", () => {
    expect(getPlanSavingsLabel("eur", "monthly")).toBeUndefined();
  });
});
