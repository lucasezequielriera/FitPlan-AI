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

describe("El flujo B2B ignora las reentregas en vez de contarlas como cobros nuevos", () => {
  // El flujo de premium tiene `isNewPayment`; el de intake no tenía nada. Se
  // presentó como coste bajo —una notificación duplicada— y resultó ser mayor:
  // el panel decide "Pagado este mes" comparando `paymentLastPaidAt` con el mes
  // actual, y ese campo lleva la hora del servidor. Una reentrega en otro mes
  // marca como pagado a quien no pagó.
  const casos = [
    { archivo: "src/pages/api/payment/webhook.ts", id: "String(paymentId)", que: "MP" },
    { archivo: "src/pages/api/payment/stripe-webhook.ts", id: "String(session.id)", que: "Stripe" },
  ];

  it("los dos comparan el id del cobro con el último procesado", () => {
    for (const { archivo, id, que } of casos) {
      const src = sinComentarios(read(archivo));
      expect({ que, compara: src.includes(`paymentLastProcessedId === ${id}`) }).toEqual({ que, compara: true });
      expect({ que, loGuarda: new RegExp(`paymentLastProcessedId: ${id.replace(/[.()]/g, "\\$&")}`).test(src) }).toEqual({
        que,
        loGuarda: true,
      });
    }
  });

  it("comprobar y escribir ocurren en la misma transacción", () => {
    // Leer y luego escribir por separado deja una ventana: dos entregas
    // simultáneas leerían ambas "no procesado" y las dos seguirían adelante.
    for (const { archivo, que } of casos) {
      const src = sinComentarios(read(archivo));
      const pos = src.indexOf("runTransaction");
      expect({ que, enTransaccion: pos > -1 }).toEqual({ que, enTransaccion: true });
      const tramo = src.slice(pos, pos + 1200);
      expect({ que, leeDentro: /tx\.get\(/.test(tramo) }).toEqual({ que, leeDentro: true });
      expect({ que, escribeDentro: /tx\.set\(/.test(tramo) }).toEqual({ que, escribeDentro: true });
    }
  });

  it("el corte va ANTES de la notificación, no después", () => {
    // Es lo único que hace útil el guard. Si el `return` por reentrega quedara
    // detrás de la notificación, seguiría duplicándola y el guard solo evitaría
    // reescribir la fecha — la mitad del problema.
    for (const { archivo, que } of casos) {
      const src = sinComentarios(read(archivo));
      const corte = src.indexOf("if (yaProcesado)");
      const notificacion = src.indexOf('flow: "intake_client"');
      expect({ que, hayCorte: corte > -1 }).toEqual({ que, hayCorte: true });
      expect({ que, antes: corte < notificacion }).toEqual({ que, antes: true });
    }
  });

  it("la reentrega responde 200, no 500", () => {
    // Pedir reintento de algo ya aplicado es un bucle: la pasarela lo reenvía,
    // se vuelve a detectar como duplicado, se vuelve a pedir reintento.
    for (const { archivo, que } of casos) {
      const src = sinComentarios(read(archivo));
      const corte = src.indexOf("if (yaProcesado)");
      const tramo = src.slice(corte, src.indexOf("}", src.indexOf("return", corte)));
      expect({ que, cierra: /status\(200\)/.test(tramo) }).toEqual({ que, cierra: true });
    }
  });
});

describe("#13 en la capa de configuración — sin Firebase Admin se pide reintento", () => {
  // Los tres `if (!adminDb) return 200` de la rama de premium. Con Firebase
  // caído, todos los pagos se aceptaban en silencio y ninguna pasarela
  // reintentaba: mismo coste que #13, un escalón más abajo. Ahí fallaba la
  // escritura; aquí no hay dónde escribir.

  it("ningún `!adminDb` de los webhooks se conforma con 200", () => {
    for (const w of ["src/pages/api/payment/webhook.ts", "src/pages/api/payment/stripe-webhook.ts"]) {
      const src = sinComentarios(read(w));
      const bloques = [...src.matchAll(/if\s*\(\s*!adminDb\s*\)\s*\{/g)];
      expect({ webhook: w, encontrados: bloques.length > 0 }).toEqual({ webhook: w, encontrados: true });
      for (const b of bloques) {
        const tramo = src.slice(b.index, b.index + 700);
        expect({ webhook: w, en: b.index, pideReintento: /status\(500\)/.test(tramo) }).toEqual({
          webhook: w,
          en: b.index,
          pideReintento: true,
        });
      }
    }
  });

  it("Stripe solo pide reintento para los eventos que escriben", () => {
    // Un 500 para cualquier evento haría fallar también los que no usamos, y
    // Stripe deshabilita los endpoints que fallan de forma sostenida. Quedarnos
    // sin webhook sería peor que el problema.
    const src = sinComentarios(read("src/pages/api/payment/stripe-webhook.ts"));
    const pos = src.indexOf("if (!adminDb)");
    const tramo = src.slice(pos, pos + 700);
    expect(tramo).toMatch(/EVENTOS_QUE_ESCRIBEN/);
    expect(tramo).toMatch(/status\(200\)/); // la salida para los demás sigue existiendo
  });

  it("la lista de eventos no se desincroniza de los que se manejan", () => {
    // El fallo que este guard previene: alguien añade un `event.type ===` nuevo
    // más abajo y olvida la lista. Ese evento volvería a tragarse en silencio
    // cuando falte la base de datos, sin que nada avise.
    const src = sinComentarios(read("src/pages/api/payment/stripe-webhook.ts"));
    const declarados = [...src.matchAll(/event\.type === "([^"]+)"/g)].map((m) => m[1]).sort();
    // Ojo con el `]` de la anotación `: string[]`: buscar el primer corchete
    // cortaba la declaración antes de los valores y devolvía undefined, que
    // habría pasado por "lista vacía" en un expect menos estricto.
    const decl = src.match(/const EVENTOS_QUE_ESCRIBEN[^=]*=\s*\[([^\]]*)\]/);
    expect(decl).not.toBeNull();
    const lista = (decl![1].match(/"[^"]+"/g) || []).map((s) => s.replaceAll('"', "")).sort();
    expect(lista).toEqual(declarados);
  });

  it("los dos de MercadoPago avisan, y con el usuario que toca", () => {
    // Ahí sí se sabe a quién afecta, así que el aviso puede nombrarlo. El de
    // Stripe ocurre antes de parsear el evento y no puede sin inventárselo.
    const src = sinComentarios(read("src/pages/api/payment/webhook.ts"));
    for (const b of [...src.matchAll(/if\s*\(\s*!adminDb\s*\)\s*\{/g)]) {
      const tramo = src.slice(b.index, b.index + 700);
      expect({ en: b.index, avisa: /alertarActivacionFallida/.test(tramo) }).toEqual({
        en: b.index,
        avisa: true,
      });
    }
  });

  it("el aviso de Stripe no nombra a un usuario que no conoce", () => {
    // El error que acaba de costar una corrección en #42: un aviso que dice
    // algo falso manda a Lucas a buscar al sitio equivocado.
    const src = read("src/lib/payments/activationAlert.ts");
    const fn = src.slice(src.indexOf("alertarWebhookSinBaseDeDatos"));
    const cuerpo = fn.slice(0, fn.indexOf("export async function alertarActivacionFallida"));
    expect(cuerpo).toMatch(/WEBHOOK DE PAGO SIN BASE DE DATOS/);
    expect(cuerpo).not.toMatch(/Usuario:|userId/);
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
