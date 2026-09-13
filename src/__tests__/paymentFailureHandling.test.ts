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

  it("las siete escrituras que cambian el acceso están protegidas", () => {
    // Inventario explícito, no un recuento por regex. Las escrituras tienen
    // formas distintas —una pasa el objeto por variable (`set(premiumData,…)`)
    // y las otras lo llevan en línea— así que contarlas automáticamente daba
    // números que cuadraban por coincidencia, no por corrección.
    //
    // Si se añade una sexta, hay que sumarla aquí a mano. Es una lista que
    // envejece, y se prefiere eso a un recuento que miente.
    //
    // Aviso de lo frágil que es: la primera versión de esta lista decía cuatro
    // cuando ya había cinco — se olvidó la renovación por factura de Stripe, y
    // la suite entera pasaba con esa escritura sin proteger. Lo encontró la
    // revisión quitándole la protección y viendo que nada fallaba.
    const inventario = [
      { archivo: "src/pages/api/payment/webhook.ts", ancla: "premium: subscriptionStatus !== ", que: "MP · alta/baja de suscripción" },
      { archivo: "src/pages/api/payment/webhook.ts", ancla: "userRef.set(premiumData", que: "MP · pago aprobado" },
      { archivo: "src/pages/api/payment/stripe-webhook.ts", ancla: "premiumStatus: subscription.status ===", que: "Stripe · checkout completado" },
      { archivo: "src/pages/api/payment/stripe-webhook.ts", ancla: "premiumLastPay:", que: "Stripe · renovación por factura" },
      { archivo: "src/pages/api/payment/stripe-webhook.ts", ancla: 'premiumStatus: "past_due"', que: "Stripe · cobro fallido" },
      // #42: el flujo B2B no toca `premium`, pero `paymentStatus: "paid"` es lo
      // que hace constar que ese cliente pagó. Perderlo cuesta lo mismo.
      { archivo: "src/pages/api/payment/webhook.ts", ancla: 'paymentProvider: "mercadopago"', que: "MP · cobro de cliente B2B" },
      { archivo: "src/pages/api/payment/stripe-webhook.ts", ancla: 'paymentProvider: "stripe"', que: "Stripe · cobro de cliente B2B" },
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

describe("#42 — el flujo B2B (intakeClients) falla igual de ruidoso que el de premium", () => {
  /** La rama de intake de MercadoPago, desde su guard hasta que devuelve 200. */
  const ramaIntakeMP = () => {
    const src = sinComentarios(read("src/pages/api/payment/webhook.ts"));
    const ini = src.indexOf('externalRef.startsWith("intake:")');
    expect(ini).toBeGreaterThan(-1);
    // La rama termina en el `const [userId, planType]` del flujo normal.
    const fin = src.indexOf("const [userId, planType]", ini);
    expect(fin).toBeGreaterThan(ini);
    return src.slice(ini, fin);
  };

  it("sin Firebase Admin pide reintento en vez de saltarse la escritura", () => {
    // El bug que el issue no mencionaba y estaba en la misma rama: era
    // `if (adminDb) { …escribir… }`, sin else. Sin base de datos no escribía
    // nada y devolvía 200 igual, así que MercadoPago daba el cobro por
    // procesado y no reintentaba nunca. Silencioso y garantizado, no
    // dependiente de que algo lanzara.
    const rama = ramaIntakeMP();
    expect({ compruebaAusencia: /if\s*\(\s*!adminDb\s*\)/.test(rama) }).toEqual({ compruebaAusencia: true });
    expect({ pideReintento: /status\(500\)/.test(rama) }).toEqual({ pideReintento: true });
    // La forma vieja no puede volver: envolver la escritura en `if (adminDb)`
    // la vuelve a hacer opcional.
    expect(rama).not.toMatch(/if\s*\(\s*adminDb\s*\)/);
  });

  it("una referencia sin id se registra, no se descarta callando", () => {
    // Aquí el 200 sí es correcto —reintentar no arregla un external_reference
    // malformado— pero hay un cobro real sin ficha a la que asociarlo, y eso
    // tiene que quedar escrito en algún sitio.
    //
    // La primera versión de este test buscaba `console.error` en toda la rama,
    // y pasaba igual quitándoselo a este camino: lo satisfacían los dos
    // `console.error` de los catch críticos. Ahora se mira solo el bloque del
    // id vacío, que es el que puede quedarse mudo.
    const rama = ramaIntakeMP();
    const ini = rama.indexOf("if (!intakeClientId)");
    expect(ini).toBeGreaterThan(-1);
    const bloque = rama.slice(ini, rama.indexOf("}", rama.indexOf("return", ini)));
    expect(bloque).toMatch(/console\.error/);
  });

  it("la notificación admin NO puede tumbar el webhook en ninguno de los dos", () => {
    // Es el error simétrico al de #13: si se protege de más, un fallo al avisar
    // provoca un reintento que reescribe un cobro ya registrado y duplica la
    // notificación. Lo crítico es la escritura, no el aviso.
    const casos = [
      { archivo: "src/pages/api/payment/webhook.ts", que: "MP" },
      { archivo: "src/pages/api/payment/stripe-webhook.ts", que: "Stripe" },
    ];
    for (const { archivo, que } of casos) {
      const src = sinComentarios(read(archivo));
      const pos = src.indexOf('flow: "intake_client"');
      expect({ que, encontrada: pos > -1 }).toEqual({ que, encontrada: true });
      const tramo = src.slice(pos, src.indexOf("catch", pos) + 300);
      expect({ que, degradado: /console\.warn/.test(tramo) }).toEqual({ que, degradado: true });
      expect({ que, noReintenta: !/status\(500\)/.test(tramo) }).toEqual({ que, noReintenta: true });
    }
  });

  it("el aviso B2B no habla de premium ni llama Usuario al cliente", () => {
    // Un aviso que dice "PAGO COBRADO SIN PREMIUM ACTIVADO" con un id de
    // `intakeClients` manda a Lucas a buscar a un usuario que no existe, a las
    // 3 de la mañana y con dinero de por medio.
    const src = read("src/lib/payments/activationAlert.ts");
    expect(src).toMatch(/registrar-cobro-b2b/);
    expect(src).toMatch(/COBRO DE CLIENTE B2B SIN REGISTRAR/);
    expect(src).toMatch(/esB2B \? "Cliente" : "Usuario"/);
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
