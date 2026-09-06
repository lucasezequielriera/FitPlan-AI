import { describe, expect, it, jest, beforeEach } from "@jest/globals";
import type { NextApiRequest, NextApiResponse } from "next";

/**
 * Regresión del issue #27: ningún endpoint de usuario puede volver a aceptar un
 * `userId` del body/query como prueba de identidad.
 *
 * Se ejercitan los handlers reales (no una copia de su lógica): cada caso manda
 * el UID de una víctima en el body y comprueba que el endpoint escribe sobre
 * quien realmente está autenticado, o rechaza si no hay token.
 */

const VICTIMA = "uid-victima";
const ATACANTE = "uid-atacante";

const mockVerifyIdToken = jest.fn<(t: string) => Promise<{ uid: string }>>();
const mockAdd = jest.fn<(data: Record<string, unknown>) => Promise<{ id: string }>>();
const mockUpdate = jest.fn<(data: Record<string, unknown>) => Promise<void>>();
const mockDocGet = jest.fn<() => Promise<{ exists: boolean; data: () => Record<string, unknown> | undefined }>>();
const mockWhere = jest.fn<(field: string, op: string, value: unknown) => unknown>();

jest.mock("@/lib/firebase-admin", () => ({
  getAdminAuth: () => ({ verifyIdToken: mockVerifyIdToken }),
  getAdminDb: () => ({
    collection: (name: string) => ({
      add: mockAdd,
      where: (f: string, o: string, v: unknown) => {
        mockWhere(f, o, v);
        return { get: async () => ({ docs: [] }) };
      },
      doc: () => ({
        get: mockDocGet,
        update: mockUpdate,
        collection: () => ({ doc: () => ({ get: mockDocGet, update: mockUpdate, set: jest.fn() }) }),
      }),
      _name: name,
    }),
  }),
}));

jest.mock("firebase-admin/firestore", () => ({
  FieldValue: { serverTimestamp: () => "SERVER_TS" },
  Timestamp: { now: () => "NOW" },
}));

// Los `jest.mock` de arriba se elevan por encima de estos imports, así que los
// handlers se cargan ya con Firebase Admin mockeado.
import savePlanHandler from "@/pages/api/savePlan";
import sendMessageHandler from "@/pages/api/sendMessage";
import userMessagesHandler from "@/pages/api/user/messages";
import saveExerciseWeightsHandler from "@/pages/api/saveExerciseWeights";

function mockReq(opts: {
  method?: string;
  body?: Record<string, unknown>;
  query?: Record<string, string>;
  token?: string;
}): NextApiRequest {
  return {
    method: opts.method || "POST",
    body: opts.body || {},
    query: opts.query || {},
    headers: opts.token ? { authorization: `Bearer ${opts.token}` } : {},
  } as unknown as NextApiRequest;
}

/** Captura status y json del handler para poder asertar sobre la respuesta. */
function mockRes() {
  const out: { status: number; body: unknown } = { status: 0, body: undefined };
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
  mockAdd.mockReset();
  mockUpdate.mockReset();
  mockDocGet.mockReset();
  mockWhere.mockReset();
  mockAdd.mockResolvedValue({ id: "doc-nuevo" });
  mockUpdate.mockResolvedValue(undefined);
});

describe("savePlan", () => {
  it("crea el plan a nombre del token, ignorando el userId del body", async () => {
    mockVerifyIdToken.mockResolvedValue({ uid: ATACANTE });
    const { res, out } = mockRes();

    await savePlanHandler(
      mockReq({ token: "t", body: { plan: { a: 1 }, userId: VICTIMA } }),
      res
    );

    expect(out.status).toBe(200);
    expect(mockAdd).toHaveBeenCalledTimes(1);
    const escrito = mockAdd.mock.calls[0][0];
    expect(escrito.userId).toBe(ATACANTE);
    expect(escrito.userId).not.toBe(VICTIMA);
  });

  it("rechaza sin token", async () => {
    const { res, out } = mockRes();
    await savePlanHandler(mockReq({ body: { plan: { a: 1 }, userId: VICTIMA } }), res);

    expect(out.status).toBe(401);
    expect(mockAdd).not.toHaveBeenCalled();
  });
});

describe("sendMessage", () => {
  it("registra el mensaje bajo el UID del token, no el del body", async () => {
    mockVerifyIdToken.mockResolvedValue({ uid: ATACANTE });
    const { res, out } = mockRes();

    await sendMessageHandler(
      mockReq({ token: "t", body: { userId: VICTIMA, message: "hola" } }),
      res
    );

    expect(out.status).toBe(200);
    expect(mockAdd.mock.calls[0][0].userId).toBe(ATACANTE);
  });

  it("rechaza sin token", async () => {
    const { res, out } = mockRes();
    await sendMessageHandler(mockReq({ body: { userId: VICTIMA, message: "hola" } }), res);
    expect(out.status).toBe(401);
    expect(mockAdd).not.toHaveBeenCalled();
  });
});

describe("user/messages", () => {
  it("consulta solo los mensajes del UID del token, ignorando ?userId=", async () => {
    mockVerifyIdToken.mockResolvedValue({ uid: ATACANTE });
    const { res, out } = mockRes();

    await userMessagesHandler(
      mockReq({ method: "GET", token: "t", query: { userId: VICTIMA } }),
      res
    );

    expect(out.status).toBe(200);
    // El filtro de Firestore debe usar el UID autenticado, nunca el de la query.
    expect(mockWhere).toHaveBeenCalledWith("userId", "==", ATACANTE);
    expect(mockWhere).not.toHaveBeenCalledWith("userId", "==", VICTIMA);
  });

  it("rechaza sin token (antes devolvía la conversación completa de cualquiera)", async () => {
    const { res, out } = mockRes();
    await userMessagesHandler(mockReq({ method: "GET", query: { userId: VICTIMA } }), res);

    expect(out.status).toBe(401);
    expect(mockWhere).not.toHaveBeenCalled();
  });
});

describe("saveExerciseWeights", () => {
  it("guarda las series bajo el UID del token", async () => {
    mockVerifyIdToken.mockResolvedValue({ uid: ATACANTE });
    const { res, out } = mockRes();

    await saveExerciseWeightsHandler(
      mockReq({
        token: "t",
        body: {
          userId: VICTIMA,
          planId: "plan-1",
          exerciseName: "Press banca",
          week: 1,
          day: "Lunes",
          sets: [{ setNumber: 1, weight: 60, reps: 8, completed: true, date: "2026-01-01" }],
        },
      }),
      res
    );

    expect(out.status).toBe(200);
    expect(mockAdd.mock.calls[0][0].userId).toBe(ATACANTE);
  });

  it("rechaza sin token", async () => {
    const { res, out } = mockRes();
    await saveExerciseWeightsHandler(
      mockReq({
        body: {
          userId: VICTIMA,
          planId: "plan-1",
          exerciseName: "Press banca",
          week: 1,
          day: "Lunes",
          sets: [{ setNumber: 1, weight: 60, reps: 8, completed: true, date: "2026-01-01" }],
        },
      }),
      res
    );

    expect(out.status).toBe(401);
    expect(mockAdd).not.toHaveBeenCalled();
  });
});
