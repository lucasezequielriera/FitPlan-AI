import { describe, expect, it, jest, beforeEach } from "@jest/globals";
import type { NextApiRequest, NextApiResponse } from "next";

/**
 * Regresión de la mitad de pagos del issue #27.
 *
 * Lo que se protege acá no es solo privacidad: el UID que recibe el checkout es
 * el que decide **qué cuenta queda premium** cuando el webhook confirma el
 * cobro, y el que determina si corresponde el trial gratis. Si alguna vez vuelve
 * a salir del body, se puede pagar una suscripción que activa la cuenta de otra
 * persona (o gastar el trial de un tercero).
 */

const VICTIMA = "uid-victima";
const PAGADOR = "uid-pagador";

const mockVerifyIdToken = jest.fn<(t: string) => Promise<{ uid: string; email?: string }>>();
const mockUserGet = jest.fn<() => Promise<{ data: () => Record<string, unknown> | undefined }>>();
const mockSessionsCreate = jest.fn<(args: Record<string, any>) => Promise<Record<string, unknown>>>();
const mockSessionsRetrieve = jest.fn<(id: string, opts?: unknown) => Promise<Record<string, any>>>();

jest.mock("@/lib/firebase-admin", () => ({
  getAdminAuth: () => ({ verifyIdToken: mockVerifyIdToken }),
  getAdminDb: () => ({
    collection: () => ({ doc: () => ({ get: mockUserGet }) }),
  }),
}));

jest.mock("stripe", () => {
  return {
    __esModule: true,
    default: class {
      checkout = { sessions: { create: mockSessionsCreate, retrieve: mockSessionsRetrieve } };
    },
  };
});

// El trial se resuelve contra Firestore; acá solo importa que no se consulte
// para una cuenta ajena, así que se fija un valor estable.
jest.mock("@/lib/premiumTrialEligibility", () => ({
  isEligibleForFreeTrial: jest.fn(async () => false),
}));

jest.mock("@/lib/getCountryFromRequest", () => ({
  getCountryCodeFromRequest: jest.fn(async () => "ES"),
}));

import createStripePaymentHandler from "@/pages/api/createStripePayment";
import checkStripePaymentHandler from "@/pages/api/checkStripePayment";

function mockReq(opts: { method?: string; body?: Record<string, unknown>; query?: Record<string, string>; token?: string }): NextApiRequest {
  return {
    method: opts.method || "POST",
    body: opts.body || {},
    query: opts.query || {},
    headers: opts.token ? { authorization: `Bearer ${opts.token}` } : {},
    socket: {},
  } as unknown as NextApiRequest;
}

function mockRes() {
  const out: { status: number; body: any } = { status: 0, body: undefined };
  const res = {
    status(code: number) {
      out.status = code;
      return this;
    },
    json(payload: unknown) {
      out.body = payload;
      return this;
    },
  };
  return { res: res as unknown as NextApiResponse, out };
}

beforeEach(() => {
  mockVerifyIdToken.mockReset();
  mockUserGet.mockReset();
  mockSessionsCreate.mockReset();
  mockSessionsRetrieve.mockReset();
  process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
  process.env.NEXT_PUBLIC_BASE_URL = "https://www.fitplan-ai.com";
  mockUserGet.mockResolvedValue({ data: () => ({ email: "pagador@example.com" }) });
  mockSessionsCreate.mockResolvedValue({ id: "cs_test_1", url: "https://checkout.stripe.com/x" });
});

describe("createStripePayment", () => {
  it("abre el checkout a nombre del token, no del userId del body", async () => {
    mockVerifyIdToken.mockResolvedValue({ uid: PAGADOR, email: "pagador@example.com" });
    const { res, out } = mockRes();

    await createStripePaymentHandler(
      mockReq({
        token: "t",
        body: { userId: VICTIMA, userEmail: "victima@example.com", planType: "monthly" },
      }),
      res
    );

    expect(out.status).toBe(200);
    const args = mockSessionsCreate.mock.calls[0][0];
    // Estos dos metadatos son los que lee el webhook para activar premium.
    expect(args.metadata.userId).toBe(PAGADOR);
    expect(args.subscription_data.metadata.userId).toBe(PAGADOR);
    expect(JSON.stringify(args)).not.toContain(VICTIMA);
    // El email del cobro también sale del token, no del body.
    expect(args.customer_email).toBe("pagador@example.com");
    expect(args.customer_email).not.toBe("victima@example.com");
  });

  it("rechaza sin token, sin llegar a crear nada en Stripe", async () => {
    const { res, out } = mockRes();

    await createStripePaymentHandler(
      mockReq({ body: { userId: VICTIMA, userEmail: "victima@example.com", planType: "monthly" } }),
      res
    );

    expect(out.status).toBe(401);
    expect(mockSessionsCreate).not.toHaveBeenCalled();
  });
});

describe("checkStripePayment", () => {
  it("devuelve la sesión si es de quien pregunta", async () => {
    mockVerifyIdToken.mockResolvedValue({ uid: PAGADOR });
    mockSessionsRetrieve.mockResolvedValue({
      id: "cs_1",
      metadata: { userId: PAGADOR },
      payment_status: "paid",
      amount_total: 1499,
      currency: "eur",
      mode: "subscription",
      status: "complete",
    });
    const { res, out } = mockRes();

    await checkStripePaymentHandler(mockReq({ method: "GET", token: "t", query: { session_id: "cs_1" } }), res);

    expect(out.status).toBe(200);
    expect(out.body.status).toBe("succeeded");
  });

  it("no filtra el cobro de otra persona aunque se conozca el session_id", async () => {
    mockVerifyIdToken.mockResolvedValue({ uid: PAGADOR });
    mockSessionsRetrieve.mockResolvedValue({
      id: "cs_ajena",
      metadata: { userId: VICTIMA },
      payment_status: "paid",
      amount_total: 9900,
      currency: "eur",
    });
    const { res, out } = mockRes();

    await checkStripePaymentHandler(mockReq({ method: "GET", token: "t", query: { session_id: "cs_ajena" } }), res);

    expect(out.status).toBe(403);
    expect(JSON.stringify(out.body)).not.toContain("9900");
    expect(JSON.stringify(out.body)).not.toContain(VICTIMA);
  });

  it("acepta la sesión cuando el UID solo está en la metadata de la suscripción", async () => {
    mockVerifyIdToken.mockResolvedValue({ uid: PAGADOR });
    mockSessionsRetrieve.mockResolvedValue({
      id: "cs_2",
      metadata: {},
      subscription: { id: "sub_1", metadata: { userId: PAGADOR }, status: "active" },
      payment_status: "paid",
      amount_total: 1499,
      currency: "eur",
    });
    const { res, out } = mockRes();

    await checkStripePaymentHandler(mockReq({ method: "GET", token: "t", query: { session_id: "cs_2" } }), res);

    expect(out.status).toBe(200);
  });

  it("rechaza sin token, sin consultar a Stripe", async () => {
    const { res, out } = mockRes();

    await checkStripePaymentHandler(mockReq({ method: "GET", query: { session_id: "cs_1" } }), res);

    expect(out.status).toBe(401);
    expect(mockSessionsRetrieve).not.toHaveBeenCalled();
  });
});
