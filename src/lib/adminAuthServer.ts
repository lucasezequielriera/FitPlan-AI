import type { NextApiRequest } from "next";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";

const ADMIN_EMAIL = "admin@fitplan-ai.com";

export type AdminAuthResult =
  | { ok: true; uid: string; email: string }
  | { ok: false; status: number; error: string };

/**
 * Verifica que el request venga de un admin autenticado de verdad.
 *
 * Reemplaza el patrón inseguro de recibir un `adminUserId` en el body/query
 * y confiar en él: acá el UID sale de un Firebase ID token verificado
 * criptográficamente (`Authorization: Bearer <idToken>`), igual que ya
 * hacían correctamente `premium/checkExpiration.ts` y
 * `request-personal-trainer.ts`. Un `adminUserId` sin firmar nunca prueba
 * identidad — cualquiera que lo conozca podía suplantar al admin antes de
 * este cambio.
 */
export async function requireAdmin(req: NextApiRequest): Promise<AdminAuthResult> {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) {
    return { ok: false, status: 401, error: "Token de administrador requerido" };
  }

  const adminAuth = getAdminAuth();
  const db = getAdminDb();
  if (!adminAuth || !db) {
    return { ok: false, status: 500, error: "Firebase Admin SDK no configurado" };
  }

  let uid: string;
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    uid = decoded.uid;
  } catch {
    return { ok: false, status: 401, error: "Token inválido o expirado" };
  }

  const userDoc = await db.collection("usuarios").doc(uid).get();
  if (!userDoc.exists) {
    return { ok: false, status: 403, error: "Acceso denegado: usuario no encontrado" };
  }

  const email = (userDoc.data()?.email as string | undefined)?.toLowerCase() || "";
  if (email !== ADMIN_EMAIL) {
    return { ok: false, status: 403, error: "Solo administradores pueden realizar esta acción" };
  }

  return { ok: true, uid, email };
}
