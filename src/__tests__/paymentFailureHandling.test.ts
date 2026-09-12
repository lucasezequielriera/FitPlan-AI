import fs from "fs";
import path from "path";

/**
 * Los dos fallos de pago más caros que tenía el sistema, convertidos en guards.
 *
 * No se monta el webhook entero —exigiría simular Stripe, MercadoPago y
 * Firestore, y el resultado sería frágil— pero sí se fija la propiedad que
 * importa y que se perdió por descuido: que un fallo al activar premium NO se
 * responda con 200.
 */

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), "utf8");

/** Quita comentarios: si no, la explicación del arreglo satisface al guard. */
function sinComentarios(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

describe("#13 — un pago cobrado que no activa premium tiene que reintentarse", () => {
  const webhooks = ["src/pages/api/payment/webhook.ts", "src/pages/api/payment/stripe-webhook.ts"];

  it("los dos webhooks devuelven 500 cuando falla la activación", () => {
    // Con 200 la pasarela da el evento por entregado y NO reintenta: el usuario
    // paga y no recibe nada. El 500 es lo único que dispara el reintento.
    for (const w of webhooks) {
      const src = sinComentarios(read(w));
      expect({ webhook: w, devuelve500: /status\(500\)/.test(src) }).toEqual({ webhook: w, devuelve500: true });
      expect({ webhook: w, pideReintento: /retry:\s*true/.test(src) }).toEqual({ webhook: w, pideReintento: true });
    }
  });

  it("los dos avisan a Lucas cuando pasa", () => {
    // El log de Vercel no lo mira nadie. Si alguien pagó y no tiene premium,
    // hay que enterarse el mismo día.
    for (const w of webhooks) {
      expect({ webhook: w, avisa: /alertarActivacionFallida/.test(read(w)) }).toEqual({ webhook: w, avisa: true });
    }
  });

  it("la escritura de premium no comparte try con los efectos posteriores", () => {
    // Ese era el origen del bug: un solo try envolvía la escritura crítica y
    // las notificaciones, así que el catch no podía distinguir "no se activó"
    // de "no se pudo avisar", y trataba ambos como recuperables.
    const src = sinComentarios(read("src/pages/api/payment/webhook.ts"));
    const escritura = src.indexOf("await userRef.set(premiumData");
    expect(escritura).toBeGreaterThan(-1);
    // Entre la escritura y su catch no puede haber notificaciones.
    const hastaCatch = src.slice(escritura, src.indexOf("catch", escritura));
    expect(hastaCatch).not.toMatch(/createAdminPaymentNotification|sendTelegramMessage/);
  });

  it("las cuatro escrituras que cambian el acceso están protegidas", () => {
    // Inventario explícito, no un recuento por regex. Las escrituras tienen
    // formas distintas —una pasa el objeto por variable (`set(premiumData,…)`)
    // y las otras lo llevan en línea— así que contarlas automáticamente daba
    // números que cuadraban por coincidencia, no por corrección.
    //
    // Si se añade una quinta, hay que sumarla aquí a mano. Es una lista que
    // envejece, y se prefiere eso a un recuento que miente.
    const inventario = [
      { archivo: "src/pages/api/payment/webhook.ts", ancla: "premium: subscriptionStatus !== ", que: "MP · alta/baja de suscripción" },
      { archivo: "src/pages/api/payment/webhook.ts", ancla: "userRef.set(premiumData", que: "MP · pago aprobado" },
      { archivo: "src/pages/api/payment/stripe-webhook.ts", ancla: "premiumStatus: subscription.status ===", que: "Stripe · checkout completado" },
      { archivo: "src/pages/api/payment/stripe-webhook.ts", ancla: 'premiumStatus: "past_due"', que: "Stripe · cobro fallido" },
    ];

    for (const { archivo, ancla, que } of inventario) {
      const src = sinComentarios(read(archivo));
      const pos = src.indexOf(ancla);
      expect({ que, encontrada: pos > -1 }).toEqual({ que, encontrada: true });

      // Desde la escritura hasta el siguiente `catch` tiene que haber una
      // protección: aviso y 500. Si el catch más cercano es el exterior del
      // handler, no habrá ninguno de los dos en ese tramo.
      const tramo = src.slice(pos, src.indexOf("catch", pos) + 600);
      expect({ que, avisa: /alertarActivacionFallida/.test(tramo) }).toEqual({ que, avisa: true });
      expect({ que, reintenta: /status\(500\)/.test(tramo) }).toEqual({ que, reintenta: true });
    }
  });

  it("el aviso nunca tumba la respuesta del webhook", () => {
    // Si Telegram falla, el webhook tiene que seguir respondiendo: lo que
    // garantiza el reintento es el código de estado, no el mensaje.
    const src = read("src/lib/payments/activationAlert.ts");
    expect(src).toMatch(/try\s*\{[\s\S]*sendTelegramMessage[\s\S]*\}\s*catch/);
  });
});

describe("#25 — fixPremiumUser no concede premium sin verificar el pago", () => {
  const src = sinComentarios(read("src/pages/api/fixPremiumUser.ts"));

  it("un payment_id que no verifica corta antes de conceder nada", () => {
    // Antes se calculaba `paymentVerified` y solo se informaba en la respuesta:
    // un payment_id inventado bastaba para llevarse premium gratis.
    const guard = src.indexOf("payment_id && !paymentVerified");
    expect(guard).toBeGreaterThan(-1);

    const concesion = src.indexOf("premium: true");
    expect(concesion).toBeGreaterThan(-1);
    expect({ elGuardVaAntes: guard < concesion }).toEqual({ elGuardVaAntes: true });
  });

  it("responde con un error, no con éxito silencioso", () => {
    expect(src).toMatch(/status\(4\d\d\)/);
  });

  it("paymentVerified se usa para decidir, no solo para informar", () => {
    // El bug exacto: la variable existía y solo aparecía en el cuerpo de la
    // respuesta. Tiene que aparecer además en una condición.
    const usos = [...src.matchAll(/paymentVerified/g)].length;
    expect(usos).toBeGreaterThanOrEqual(3);
    expect(src).toMatch(/!paymentVerified/);
  });
});
