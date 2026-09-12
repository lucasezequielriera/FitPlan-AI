import { describe, expect, it, jest, beforeEach } from "@jest/globals";
import type { NextApiRequest } from "next";

/**
 * `requireSelfOrAdmin` es código de autorización NUEVO, escrito para que el
 * admin pueda actuar sobre otros usuarios sin reabrir el agujero de #27.
 *
 * La revisión señaló que no tenía ni un test de comportamiento: el guard de
 * `endpointIdentity` solo comprobaba que el string apareciera en el archivo,
 * no que la lógica fuese correcta. Un fallo aquí abre justo lo contrario de lo
 * que intenta cerrar, así que se prueba como el hermano `requirePlanAccess`.
 */

const mockVerifyIdToken = jest.fn<(token: string) => Promise<{ uid: string }>>();
const mockIsAdminUid = jest.fn<(db: unknown, uid: string) => Promise<boolean>>();
let mockDbDisponible = true;

jest.mock("@/lib/firebase-admin", () => ({
  getAdminAuth: () => ({ verifyIdToken: mockVerifyIdToken }),
  getAdminDb: () => (mockDbDisponible ? {} : null),
}));

jest.mock("@/lib/adminAuthServer", () => ({
  isAdminUid: (db: unknown, uid: string) => mockIsAdminUid(db, uid),
}));

// Import después de los mocks, que jest eleva por encima.
import { requireSelfOrAdmin } from "@/lib/userAuthServer";

const req = (token?: string) =>
  ({ headers: token ? { authorization: `Bearer ${token}` } : {} }) as unknown as NextApiRequest;

beforeEach(() => {
  mockVerifyIdToken.mockReset();
  mockIsAdminUid.mockReset();
  mockDbDisponible = true;
});

describe("requireSelfOrAdmin", () => {
  it("sin token, rechaza antes de mirar nada más", () => {
    return requireSelfOrAdmin(req(), "quien-sea").then((r) => {
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.status).toBe(401);
      // No debe ni consultar si es admin: sin identidad no hay nada que decidir.
      expect(mockIsAdminUid).not.toHaveBeenCalled();
    });
  });

  it("con token inválido, rechaza", async () => {
    mockVerifyIdToken.mockRejectedValue(new Error("token falso"));
    const r = await requireSelfOrAdmin(req("basura"), "quien-sea");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(401);
  });

  it("actuando sobre uno mismo, pasa sin consultar si es admin", async () => {
    mockVerifyIdToken.mockResolvedValue({ uid: "yo" });
    const r = await requireSelfOrAdmin(req("t"), "yo");
    expect(r).toEqual({ ok: true, uid: "yo", isAdmin: false });
    expect(mockIsAdminUid).not.toHaveBeenCalled();
  });

  it("sin objetivo explícito, actúa sobre uno mismo", async () => {
    // El caso que más fácil se vuelve fail-open: si `targetUserId` llega
    // undefined, NO puede interpretarse como "vale cualquiera".
    mockVerifyIdToken.mockResolvedValue({ uid: "yo" });
    const r = await requireSelfOrAdmin(req("t"), undefined);
    expect(r).toEqual({ ok: true, uid: "yo", isAdmin: false });
  });

  it("un usuario normal NO puede actuar sobre otro", async () => {
    // Es el agujero de #27 exacto: actuar en nombre ajeno.
    mockVerifyIdToken.mockResolvedValue({ uid: "yo" });
    mockIsAdminUid.mockResolvedValue(false);
    const r = await requireSelfOrAdmin(req("t"), "victima");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(403);
  });

  it("el admin SÍ puede, y devuelve el UID del objetivo", async () => {
    // Si devolviera el del admin, el panel escribiría los datos en la cuenta
    // equivocada — un fallo silencioso y difícil de rastrear.
    mockVerifyIdToken.mockResolvedValue({ uid: "admin" });
    mockIsAdminUid.mockResolvedValue(true);
    const r = await requireSelfOrAdmin(req("t"), "otro-usuario");
    expect(r).toEqual({ ok: true, uid: "otro-usuario", isAdmin: true });
  });

  it("sin base de datos disponible, falla cerrado", async () => {
    // Si no se puede comprobar quién es admin, la respuesta segura es NO.
    mockVerifyIdToken.mockResolvedValue({ uid: "yo" });
    mockDbDisponible = false;
    const r = await requireSelfOrAdmin(req("t"), "otro");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(501);
  });

  it("si la comprobación de admin lanza, no concede acceso", async () => {
    mockVerifyIdToken.mockResolvedValue({ uid: "yo" });
    mockIsAdminUid.mockRejectedValue(new Error("firestore caído"));
    await expect(requireSelfOrAdmin(req("t"), "otro")).rejects.toThrow();
  });
});
