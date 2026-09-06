import { describe, expect, it, jest, beforeEach } from "@jest/globals";
import type { NextApiRequest } from "next";

/**
 * Protege el arreglo de los issues #26 y #31: los endpoints que tocan un plan
 * ya no aceptan un `userId` del body/query como prueba de identidad, y omitir
 * ese campo ya no saltea el chequeo de dueño (ese era exactamente el bypass:
 * `if (userId && planData.userId !== userId)` no corría si no llegaba userId).
 *
 * Sin este test, una futura refactorización podría reintroducir el agujero sin
 * que nada falle.
 */

type SnapshotResult = Promise<{ exists: boolean; data: () => Record<string, unknown> | undefined }>;

// Prefijo `mock` obligatorio: jest.mock se eleva por encima de estas
// declaraciones y solo deja referenciar variables con ese prefijo.
const mockVerifyIdToken = jest.fn<(token: string) => Promise<{ uid: string }>>();
const mockPlanGet = jest.fn<() => SnapshotResult>();
const mockUserGet = jest.fn<() => SnapshotResult>();

jest.mock("@/lib/firebase-admin", () => ({
  getAdminAuth: () => ({ verifyIdToken: mockVerifyIdToken }),
  getAdminDb: () => ({
    collection: (name: string) => ({
      doc: () => ({ get: name === "planes" ? mockPlanGet : mockUserGet }),
    }),
  }),
}));

const verifyIdToken = mockVerifyIdToken;
const planGet = mockPlanGet;
const userGet = mockUserGet;

import { requirePlanAccess } from "@/lib/userAuthServer";

/** Request mínimo: solo el header importa para la identidad. */
function reqWith(authorization?: string): NextApiRequest {
  return { headers: authorization ? { authorization } : {} } as unknown as NextApiRequest;
}

const OWNER_UID = "uid-dueño";
const OTHER_UID = "uid-de-otro";

beforeEach(() => {
  verifyIdToken.mockReset();
  planGet.mockReset();
  userGet.mockReset();

  planGet.mockResolvedValue({ exists: true, data: () => ({ userId: OWNER_UID, trackedFoods: [] }) });
  // Por defecto, quien consulta no es admin.
  userGet.mockResolvedValue({ exists: true, data: () => ({ email: "alguien@example.com" }) });
});

describe("requirePlanAccess", () => {
  it("rechaza sin token, aunque el plan exista", async () => {
    const result = await requirePlanAccess(reqWith(), "plan-1");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(401);
      expect(result.code).toBe("unauthenticated");
    }
    // No debe ni mirar el plan si no hay identidad.
    expect(planGet).not.toHaveBeenCalled();
  });

  it("rechaza un token inválido o expirado", async () => {
    verifyIdToken.mockRejectedValue(new Error("token expirado"));

    const result = await requirePlanAccess(reqWith("Bearer token-falso"), "plan-1");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(401);
  });

  it("deja pasar al dueño del plan sin leer nada más", async () => {
    verifyIdToken.mockResolvedValue({ uid: OWNER_UID });

    const result = await requirePlanAccess(reqWith("Bearer token-del-dueño"), "plan-1");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.uid).toBe(OWNER_UID);
      expect(result.isAdmin).toBe(false);
      expect(result.planData.userId).toBe(OWNER_UID);
    }
    // Camino común: no paga la lectura extra que resuelve si es admin.
    expect(userGet).not.toHaveBeenCalled();
  });

  it("rechaza a un usuario autenticado que no es dueño ni admin", async () => {
    verifyIdToken.mockResolvedValue({ uid: OTHER_UID });

    const result = await requirePlanAccess(reqWith("Bearer token-de-otro"), "plan-1");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(403);
      expect(result.code).toBe("forbidden");
    }
  });

  it("deja pasar al admin sobre el plan de cualquier usuario", async () => {
    verifyIdToken.mockResolvedValue({ uid: "uid-admin" });
    userGet.mockResolvedValue({ exists: true, data: () => ({ email: "admin@fitplan-ai.com" }) });

    const result = await requirePlanAccess(reqWith("Bearer token-admin"), "plan-1");

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.isAdmin).toBe(true);
  });

  it("no confunde mayúsculas del email admin", async () => {
    verifyIdToken.mockResolvedValue({ uid: "uid-admin" });
    userGet.mockResolvedValue({ exists: true, data: () => ({ email: "Admin@FitPlan-AI.com" }) });

    const result = await requirePlanAccess(reqWith("Bearer token-admin"), "plan-1");

    expect(result.ok).toBe(true);
  });

  it("devuelve 404 si el plan no existe, sin filtrar si existe para otro", async () => {
    verifyIdToken.mockResolvedValue({ uid: OTHER_UID });
    planGet.mockResolvedValue({ exists: false, data: () => undefined });

    const result = await requirePlanAccess(reqWith("Bearer token-de-otro"), "plan-inexistente");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(404);
  });

  it("propaga los errores de lectura de Firestore (modo degradado por cuota)", async () => {
    verifyIdToken.mockResolvedValue({ uid: OWNER_UID });
    planGet.mockRejectedValue(new Error("RESOURCE_EXHAUSTED: quota exceeded"));

    // No los convierte en un resultado de permiso: el endpoint los maneja en su
    // propio catch (getWeeklyStats responde con estadísticas vacías).
    await expect(requirePlanAccess(reqWith("Bearer token-del-dueño"), "plan-1")).rejects.toThrow(
      "RESOURCE_EXHAUSTED"
    );
  });
});
