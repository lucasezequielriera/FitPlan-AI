import { describe, expect, it, jest, beforeEach, afterEach } from "@jest/globals";
import type { NextApiRequest, NextApiResponse } from "next";

/**
 * #6 — `supportTriage.ts` pierde mensajes en silencio si sus dos queries
 * (`mensajes` y `intakeClients`) tocan su `.limit(N)`. El issue pide solo la
 * alarma, no paginar: que cuando una query devuelva exactamente su tope, se
 * avise por Telegram — sin tumbar el cron si el aviso falla, y sin mandar el
 * mismo mensaje todos los días mientras el volumen se mantenga alto.
 *
 * Se prueba comportamiento real (se invoca el handler con Firestore y
 * Telegram simulados), no el texto del código: lo que importa es que
 * "exactamente el límite" dispare el aviso y "uno menos" no.
 */

type DocFake = { data: () => Record<string, unknown> };

const RECENT_MESSAGES_LIMIT = 500;
const INTAKE_CLIENTS_LIMIT = 1000;

const estado: { intakeDocs: DocFake[]; messageDocs: DocFake[] } = {
  intakeDocs: [],
  messageDocs: [],
};

/** Documento vacío: no importa su contenido para esta alarma, solo la cantidad. */
const doc = (): DocFake => ({ data: () => ({}) });
const docs = (n: number): DocFake[] => Array.from({ length: n }, doc);

jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: () => ({
    collection: (nombre: string) => {
      const lista = nombre === "intakeClients" ? estado.intakeDocs : nombre === "mensajes" ? estado.messageDocs : [];
      // Firestore real: `.orderBy().limit(N).get()` (mensajes) y `.limit(N).get()`
      // (intakeClients) son ambos encadenables sobre el mismo objeto de query.
      const query = {
        orderBy: () => query,
        limit: () => query,
        get: async () => ({ docs: lista }),
      };
      return query;
    },
  }),
}));

const mockSendTelegram = jest.fn<(mensaje: string) => Promise<boolean>>();
jest.mock("@/lib/telegram", () => ({
  sendTelegramMessage: (mensaje: string) => mockSendTelegram(mensaje),
}));

import handler from "@/pages/api/cron/supportTriage";

type Res = { statusCode: number; body: Record<string, unknown> | null; status: (c: number) => Res; json: (b: unknown) => Res };

const nuevaRes = (): Res => {
  const r = { statusCode: 0, body: null } as unknown as Res;
  r.status = (c) => {
    r.statusCode = c;
    return r;
  };
  r.json = (b) => {
    r.body = b as Record<string, unknown>;
    return r;
  };
  return r;
};

const correr = async () => {
  const res = nuevaRes();
  await handler(
    { method: "GET", headers: { "x-vercel-cron": "1" }, query: {} } as unknown as NextApiRequest,
    res as unknown as NextApiResponse
  );
  return res;
};

/** Lunes UTC: el único día en que el cron manda la alarma de límite. */
const LUNES = "2026-01-05T07:00:00Z";
/** Martes UTC: mismo escenario de datos, para probar el throttle semanal. */
const MARTES = "2026-01-06T07:00:00Z";

beforeEach(() => {
  mockSendTelegram.mockReset().mockResolvedValue(true);
  estado.intakeDocs = docs(1);
  estado.messageDocs = docs(1);
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe("#6 — alarma cuando `mensajes` toca su límite", () => {
  it("con exactamente el límite, avisa por Telegram", async () => {
    jest.setSystemTime(new Date(LUNES));
    estado.messageDocs = docs(RECENT_MESSAGES_LIMIT);

    await correr();

    expect(mockSendTelegram).toHaveBeenCalledTimes(1);
    expect(mockSendTelegram.mock.calls[0][0]).toMatch(/mensajes/);
    expect(mockSendTelegram.mock.calls[0][0]).toMatch(/límite/);
  });

  it("un documento por debajo del límite, NO avisa", async () => {
    jest.setSystemTime(new Date(LUNES));
    estado.messageDocs = docs(RECENT_MESSAGES_LIMIT - 1);

    await correr();

    expect(mockSendTelegram).not.toHaveBeenCalled();
  });
});

describe("#6 — alarma cuando `intakeClients` toca su límite", () => {
  it("con exactamente el límite, avisa por Telegram", async () => {
    jest.setSystemTime(new Date(LUNES));
    estado.intakeDocs = docs(INTAKE_CLIENTS_LIMIT);

    await correr();

    expect(mockSendTelegram).toHaveBeenCalledTimes(1);
    expect(mockSendTelegram.mock.calls[0][0]).toMatch(/intakeClients/);
  });

  it("un documento por debajo del límite, NO avisa", async () => {
    jest.setSystemTime(new Date(LUNES));
    estado.intakeDocs = docs(INTAKE_CLIENTS_LIMIT - 1);

    await correr();

    expect(mockSendTelegram).not.toHaveBeenCalled();
  });
});

describe("#6 — el aviso no es diario aunque el límite se mantenga tocado", () => {
  it("fuera del día de aviso, no manda nada aunque el límite siga tocado", async () => {
    jest.setSystemTime(new Date(MARTES));
    estado.messageDocs = docs(RECENT_MESSAGES_LIMIT);

    await correr();

    expect(mockSendTelegram).not.toHaveBeenCalled();
  });
});

describe("#6 — el aviso nunca tumba el cron", () => {
  it("si Telegram falla al avisar del límite, el cron sigue y responde 200", async () => {
    jest.setSystemTime(new Date(LUNES));
    estado.messageDocs = docs(RECENT_MESSAGES_LIMIT);
    mockSendTelegram.mockRejectedValue(new Error("Telegram caído"));

    const res = await correr();

    expect(mockSendTelegram).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(200);
  });
});
