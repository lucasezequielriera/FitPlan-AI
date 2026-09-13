import { describe, expect, it, jest, beforeEach } from "@jest/globals";
import type { NextApiRequest, NextApiResponse } from "next";

/**
 * #12 — borrar un usuario no puede informar éxito si no lo fue.
 *
 * El borrado de planes se tragaba el fallo, seguía adelante y respondía
 * `success: true`. Los planes quedaban con un `userId` que ya no existía en
 * ningún sitio: son los huérfanos del #5, creados por el propio borrado.
 *
 * Aquí sí se monta el handler con mocks en vez de comprobar el texto del
 * archivo, porque lo que importa es la secuencia —qué se borra, en qué orden y
 * qué se responde— y eso un guard de regex no lo ve.
 */

const mockRequireAdmin = jest.fn<() => Promise<{ ok: boolean; uid?: string; status?: number; error?: string }>>();
const mockAuthDeleteUser = jest.fn<(uid: string) => Promise<void>>();
const mockUserDocDelete = jest.fn<() => Promise<void>>();

let planDocs: Array<{ ref: { delete: () => Promise<void> } }> = [];
let usuarioExiste = true;
/** Que falle la CONSULTA es un camino distinto de que falle un borrado. */
let consultaPlanesFalla = false;

jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: () => ({
    collection: (nombre: string) => {
      if (nombre === "planes") {
        return {
          where: () => ({
            get: async () => {
              if (consultaPlanesFalla) throw new Error("no se pudo consultar la colección");
              return { docs: planDocs };
            },
          }),
        };
      }
      return {
        doc: () => ({
          get: async () => ({ exists: usuarioExiste, data: () => ({ email: "alguien@ejemplo.com" }) }),
          delete: mockUserDocDelete,
        }),
      };
    },
  }),
  getAdminAuth: () => ({ deleteUser: mockAuthDeleteUser }),
}));

jest.mock("@/lib/adminAuthServer", () => ({
  requireAdmin: () => mockRequireAdmin(),
}));

// Import después de los mocks, que jest eleva por encima.
import handler from "@/pages/api/admin/deleteUser";

type RespuestaFalsa = {
  statusCode: number;
  body: Record<string, unknown> | null;
  status: (c: number) => RespuestaFalsa;
  json: (b: unknown) => RespuestaFalsa;
};

const nuevaRes = (): RespuestaFalsa => {
  const r = { statusCode: 0, body: null } as RespuestaFalsa;
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (b) => { r.body = b as Record<string, unknown>; return r; };
  return r;
};

const req = { method: "POST", body: { userId: "victima" }, headers: {} } as unknown as NextApiRequest;

/** Un plan que se borra sin problema. */
const planOk = () => ({ ref: { delete: jest.fn<() => Promise<void>>(async () => {}) } });
/** Un plan cuyo borrado falla. */
const planRoto = () => ({ ref: { delete: jest.fn<() => Promise<void>>(async () => { throw new Error("permiso denegado"); }) } });

const correr = async () => {
  const res = nuevaRes();
  await handler(req, res as unknown as NextApiResponse);
  return res;
};

beforeEach(() => {
  mockRequireAdmin.mockReset().mockResolvedValue({ ok: true, uid: "admin" });
  mockAuthDeleteUser.mockReset().mockResolvedValue(undefined);
  mockUserDocDelete.mockReset().mockResolvedValue(undefined);
  usuarioExiste = true;
  consultaPlanesFalla = false;
  planDocs = [];
});

describe("#12 — deleteUser no informa éxito cuando falla", () => {
  it("si falla borrar un plan, responde 500 y NO borra al usuario", async () => {
    // El corazón del bug: antes seguía adelante. Al borrar el usuario y su
    // cuenta, el plan que quedó vivo se convertía en huérfano permanente.
    planDocs = [planOk(), planRoto(), planOk()];
    const res = await correr();

    expect(res.statusCode).toBe(500);
    expect(mockUserDocDelete).not.toHaveBeenCalled();
    expect(mockAuthDeleteUser).not.toHaveBeenCalled();
  });

  it("dice cuántos planes se borraron y cuántos no", async () => {
    // Con `Promise.all`, el primer fallo ocultaba el resto: no se podía saber
    // si había quedado uno suelto o veinte.
    planDocs = [planOk(), planRoto(), planRoto()];
    const res = await correr();

    expect(res.body).toMatchObject({ planesBorrados: 1, planesFallidos: 2 });
  });

  it("abortar deja el borrado reintentable, no a medias", async () => {
    // Si el usuario sigue existiendo, el admin puede volver a darle a borrar.
    // Es la propiedad que hace que fallar sea barato.
    planDocs = [planRoto()];
    const res = await correr();

    expect(String(res.body?.detail)).toMatch(/se puede reintentar/i);
  });

  it("cuando todo va bien, borra usuario y cuenta, y responde éxito", async () => {
    planDocs = [planOk(), planOk()];
    const res = await correr();

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ success: true, planesBorrados: 2 });
    expect(mockUserDocDelete).toHaveBeenCalled();
    expect(mockAuthDeleteUser).toHaveBeenCalledWith("victima");
  });

  it("si no se pueden ni consultar los planes, tampoco se borra al usuario", async () => {
    // Camino distinto del anterior, y lo descubrió la mutación: los tests solo
    // hacían fallar borrados individuales, así que el catch que envuelve la
    // consulta podía volver a tragarse el error sin que nada se enterara.
    //
    // Importa más que el otro: si la consulta falla no sabemos siquiera cuántos
    // planes hay, así que borrar al usuario sería a ciegas.
    consultaPlanesFalla = true;
    const res = await correr();

    expect(res.statusCode).toBe(500);
    expect(mockUserDocDelete).not.toHaveBeenCalled();
    expect(mockAuthDeleteUser).not.toHaveBeenCalled();
  });

  it("un usuario sin planes se borra igual", async () => {
    planDocs = [];
    const res = await correr();

    expect(res.statusCode).toBe(200);
    expect(mockUserDocDelete).toHaveBeenCalled();
  });
});

describe("#12 — el error simétrico: informar fallo habiendo funcionado", () => {
  /** El error real de firebase-admin cuando la cuenta ya no está. */
  const errorCuentaInexistente = () => {
    const e = new Error("There is no user record corresponding to the provided identifier.");
    (e as unknown as { code: string }).code = "auth/user-not-found";
    return e;
  };

  it("si la cuenta ya no existe en Auth, el borrado se da por bueno", async () => {
    // Se comprobaba con `errorMessage.includes("not found")`, y ese texto NO
    // aparece en el mensaje real. Así que el caso más común al reintentar un
    // borrado a medias devolvía 500 después de haber borrado los planes y el
    // documento: un fallo informado sobre algo que sí funcionó.
    planDocs = [planOk()];
    mockAuthDeleteUser.mockRejectedValue(errorCuentaInexistente());
    const res = await correr();

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ success: true });
  });

  it("cualquier otro fallo de Auth sí es un 500", async () => {
    // No vale dar por buena cualquier excepción: solo la que significa "ya no
    // está". Un fallo de red tiene que verse.
    planDocs = [planOk()];
    const e = new Error("backend unavailable");
    (e as unknown as { code: string }).code = "auth/internal-error";
    mockAuthDeleteUser.mockRejectedValue(e);
    const res = await correr();

    expect(res.statusCode).toBe(500);
  });
});

describe("#12 — las protecciones que ya había siguen ahí", () => {
  it("sin ser admin no se borra nada", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: false, status: 403, error: "No autorizado" });
    planDocs = [planOk()];
    const res = await correr();

    expect(res.statusCode).toBe(403);
    expect(mockUserDocDelete).not.toHaveBeenCalled();
  });

  it("un usuario que no existe da 404 sin borrar planes", async () => {
    usuarioExiste = false;
    const plan = planOk();
    planDocs = [plan];
    const res = await correr();

    expect(res.statusCode).toBe(404);
    expect(plan.ref.delete).not.toHaveBeenCalled();
  });
});
