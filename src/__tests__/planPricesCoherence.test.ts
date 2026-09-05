import fs from "fs";
import path from "path";
import { getPlanSavingsPercent, getStripeSubscriptionPlans, PLAN_MONTHS } from "@/lib/stripePlanPrices";

/**
 * Estos tests existen porque el precio ya se desincronizó una vez entre los
 * doce sitios que lo declaraban: el usuario veía un importe y se le cobraba
 * otro. Cubren los dos acoplamientos que el compilador NO puede verificar.
 */

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), "utf8");

describe("Coherencia de precios en todo el repo", () => {
  it("el fallback de ARS del modal sigue al del backend", () => {
    // No se pueden importar entre sí: exchangeRate.ts arrastra firebase-admin
    // al bundle del cliente y rompe el build. Se verifica por texto.
    const backend = read("src/lib/exchangeRate.ts").match(/FALLBACK_EUR_ARS_RATE\s*=\s*(\d+)/);
    const modal = read("src/components/PremiumPlanModal.tsx").match(/ARS_FALLBACK_RATE\s*=\s*(\d+)/);
    expect(backend?.[1]).toBeDefined();
    expect(modal?.[1]).toBeDefined();
    expect(modal?.[1]).toBe(backend?.[1]);

    // El admin estima ingresos con la misma cotización de reserva.
    const admin = read("src/components/admin/AdminApp.tsx").match(/ARS_ESTIMATE_RATE\s*=\s*(\d+)/);
    expect(admin?.[1]).toBe(backend?.[1]);
  });

  it("ninguna landing escribe un precio a mano", () => {
    for (const file of ["src/pages/transformacion-fitplan.tsx", "src/pages/en/transformacion-fitplan.tsx"]) {
      const src = read(file);
      // Importes con moneda escritos literalmente ("5 EUR", "$5.99", "12 €").
      const hardcoded = src.match(/\b\d+(?:[.,]\d{2})?\s*(?:EUR|€)\b|\$\d+(?:\.\d{2})?/g) ?? [];
      expect({ file, hardcoded }).toEqual({ file, hardcoded: [] });
    }
  });

  it("ningún archivo del repo declara una tabla de precios propia", () => {
    // Red de seguridad de todo el repo: dos barridos manuales con grep se
    // comieron precios reales (uno cobraba 10.000 ARS cuando correspondían
    // ~25.500), porque buscaban "10.000" y en el código estaba "10000", o
    // buscaban "5 €" y estaba escrito "5 EUR". El test no depende del formato.
    const VIEJOS = [10000, 24000, 50000];
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(path.join(process.cwd(), dir), { withFileTypes: true })) {
        const rel = `${dir}/${entry.name}`;
        if (entry.isDirectory()) walk(rel);
        else if (/\.tsx?$/.test(entry.name) && !rel.includes("__tests__")) files.push(rel);
      }
    };
    walk("src");

    const ofensores = files.filter((f) => {
      const src = read(f);
      // Un importe viejo de ARS junto a una clave de plan = tabla de precios.
      return VIEJOS.some((n) => new RegExp(`\\b(monthly|quarterly|annual)\\b[^\\n]{0,40}\\b${n}\\b`).test(src));
    });
    expect(ofensores).toEqual([]);
  });

  it("el ahorro anunciado nunca supera el 100% ni baja de 0", () => {
    for (const currency of ["eur", "usd"] as const) {
      for (const plan of ["monthly", "quarterly", "annual"] as const) {
        const pct = getPlanSavingsPercent(currency, plan);
        expect(pct).toBeGreaterThanOrEqual(0);
        expect(pct).toBeLessThan(100);
      }
    }
  });

  it("un plan largo nunca cuesta más por mes que el mensual", () => {
    for (const currency of ["eur", "usd"] as const) {
      const plans = getStripeSubscriptionPlans(currency);
      const perMonthMensual = plans.monthly.price;
      for (const plan of ["quarterly", "annual"] as const) {
        expect(plans[plan].price / PLAN_MONTHS[plan]).toBeLessThanOrEqual(perMonthMensual);
      }
    }
  });
});
