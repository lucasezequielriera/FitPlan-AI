import { describe, expect, it, jest, beforeEach } from "@jest/globals";
import type { NextApiRequest, NextApiResponse } from "next";

/**
 * #5 — el endpoint que borra planes huérfanos.
 *
 * `clasificarPlanes` ya se prueba aparte. Lo que se comprueba aquí es lo otro
 * que puede salir muy caro: que un id que llegue en el cuerpo de la petición
 * NO se borre por el hecho de venir escrito ahí. La lista que manda es la que
 * calcula el propio servidor en esa misma petición — una lista vieja en una
 * pestaña abierta desde ayer no puede borrar el plan de alguien que se registró
 * esta mañana.
 */

const mockRequireAdmin = jest.fn<() => Promise<{ ok: boolean; uid?: string; status?: number; error?: string }>>();
const mockGetUsers = jest.fn<(ids: { uid: string }[]) => Promise<{ users: { uid: string }[] }>>();
const mockArchivar = jest.fn<(datos: unknown) => Promise<void>>();
const mockBorrarPlan = jest.fn<() => Promise<void>>();

/** `planes` de mentira: id -> userId. */
let planesEnBd: Record<string, string | null> = {};
/** UIDs con documento en `usuarios`. */
let usuariosEnBd: string[] = [];

jest.mock("@/lib/firebase-admin", () => ({
  getAdminAuth: () => ({ getUsers: mockGetUsers }),
  getAdminDb: () => ({
    collection: (nombre: string) => ({
      doc: (id: string) => ({
        id,
        // Se usa en la ruta de borrado para releer el plan antes de archivarlo.
        get: async () => ({
          exists: nombre === "planes" ? id in planesEnBd : usuariosEnBd.includes(id),
          id,
          data: () => ({ userId: planesEnBd[id] ?? null }),
        }),
        set: mockArchivar,
        delete: mockBorrarPlan,
      }),
      get: async () => ({
        docs: Object.entries(planesEnBd).map(([id, userId]) => ({ id, data: () => ({ userId }) })),
      }),
    }),
    getAll: async (...refs: { id: string }[]) =>
      refs.map((r) => ({ id: r.id, exists: usuariosEnBd.includes(r.id) })),
  }),
}));

jest.mock("@/lib/adminAuthServer", () => ({
  requireAdmin: () => mockRequireAdmin(),
}));

import handler from "@/pages/api/admin/orphanPlans";

type Res = { statusCode: number; body: Record<string, unknown> | null; status: (c: number) => Res; json: (b: unknown) => Res; setHeader: () => void };

const nuevaRes = (): Res => {
  const r = { statusCode: 0, body: null } as unknown as Res;
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (b) => { r.body = b as Record<string, unknown>; return r; };
  r.setHeader = () => {};
  return r;
};

const correr = async (req: Partial<NextApiRequest>) => {
  const res = nuevaRes();
  await handler({ headers: {}, query: {}, ...req } as NextApiRequest, res as unknown as NextApiResponse);
  return res;
};

const listar = () => correr({ method: "GET" });
const borrar = (planIds: unknown[]) => correr({ method: "POST", body: { planIds } });

beforeEach(() => {
  mockRequireAdmin.mockReset().mockResolvedValue({ ok: true, uid: "admin" });
  mockGetUsers.mockReset().mockResolvedValue({ users: [] });
  mockArchivar.mockReset().mockResolvedValue(undefined);
  mockBorrarPlan.mockReset().mockResolvedValue(undefined);
  planesEnBd = {};
  usuariosEnBd = [];
});

describe("#5 — listar (GET no toca nada)", () => {
  it("encuentra el plan cuyo usuario ya no existe", async () => {
    planesEnBd = { vivo: "u-vivo", muerto: "u-borrado" };
    usuariosEnBd = ["u-vivo"];

    const res = await listar();

    expect(res.statusCode).toBe(200);
    expect((res.body?.huerfanos as { id: string }[]).map((p) => p.id)).toEqual(["muerto"]);
    expect(res.body?.conDuenyo).toBe(1);
    expect(mockBorrarPlan).not.toHaveBeenCalled();
  });

  it("si Auth falla, avisa de que la lista está incompleta", async () => {
    // No basta con no borrarlos: hay que decir que la lista no es de fiar.
    planesEnBd = { p1: "quien-sabe" };
    mockGetUsers.mockRejectedValue(new Error("Auth caído"));

    const res = await listar();

    expect(res.body).toMatchObject({ comprobacionIncompleta: true, uidsSinComprobar: 1 });
    expect(res.body?.huerfanos).toEqual([]);
  });
});

describe("#5 — borrar solo lo que el propio servidor clasificó", () => {
  it("rechaza un id de un plan con dueño aunque venga en la petición", async () => {
    // El escenario que borraría datos de un usuario real: alguien manda el id
    // de un plan vivo. Que esté en el cuerpo no lo convierte en borrable.
    planesEnBd = { vivo: "u-vivo", muerto: "u-borrado" };
    usuariosEnBd = ["u-vivo"];

    const res = await borrar(["vivo"]);

    expect(res.body).toMatchObject({ borrados: 0, rechazados: ["vivo"] });
    expect(mockBorrarPlan).not.toHaveBeenCalled();
    expect(mockArchivar).not.toHaveBeenCalled();
  });

  it("borra los que sí son huérfanos, y solo esos", async () => {
    planesEnBd = { vivo: "u-vivo", muerto: "u-borrado" };
    usuariosEnBd = ["u-vivo"];

    const res = await borrar(["muerto", "vivo"]);

    expect(res.body).toMatchObject({ borrados: 1, rechazados: ["vivo"] });
    expect(mockBorrarPlan).toHaveBeenCalledTimes(1);
  });

  it("archiva ANTES de borrar", async () => {
    // Si se borrara primero y el archivado fallase, el plan desaparecería sin
    // copia. El orden es lo que hace la operación reversible.
    planesEnBd = { muerto: "u-borrado" };
    const orden: string[] = [];
    mockArchivar.mockImplementation(async () => { orden.push("archivar"); });
    mockBorrarPlan.mockImplementation(async () => { orden.push("borrar"); });

    await borrar(["muerto"]);

    expect(orden).toEqual(["archivar", "borrar"]);
  });

  it("si el archivado falla, el plan NO se borra", async () => {
    planesEnBd = { muerto: "u-borrado" };
    mockArchivar.mockRejectedValue(new Error("sin espacio"));

    const res = await borrar(["muerto"]);

    expect(mockBorrarPlan).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(207);
    expect((res.body?.fallidos as unknown[]).length).toBe(1);
  });

  it("si Auth no respondió, no se borra nada aunque se pida", async () => {
    // La duda se propaga hasta el borrado: no vale detectar con precaución y
    // luego borrar igual porque el id venía en la lista.
    planesEnBd = { p1: "quien-sabe" };
    mockGetUsers.mockRejectedValue(new Error("Auth caído"));

    const res = await borrar(["p1"]);

    expect(res.body).toMatchObject({ borrados: 0, rechazados: ["p1"] });
    expect(mockBorrarPlan).not.toHaveBeenCalled();
  });

  it("una petición sin ids no borra 'todo lo huérfano'", async () => {
    // El fallo clásico de estos endpoints: interpretar la lista vacía como
    // "todos". Tiene que ser un error, no una barrida.
    planesEnBd = { muerto: "u-borrado" };

    const res = await borrar([]);

    expect(res.statusCode).toBe(400);
    expect(mockBorrarPlan).not.toHaveBeenCalled();
  });
});

describe("#5 — sigue siendo un endpoint de admin", () => {
  it("sin ser admin no lista ni borra", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: false, status: 403, error: "No autorizado" });
    planesEnBd = { muerto: "u-borrado" };

    expect((await listar()).statusCode).toBe(403);
    expect((await borrar(["muerto"])).statusCode).toBe(403);
    expect(mockBorrarPlan).not.toHaveBeenCalled();
  });

  it("no acepta otros métodos", async () => {
    expect((await correr({ method: "DELETE" })).statusCode).toBe(405);
  });
});
