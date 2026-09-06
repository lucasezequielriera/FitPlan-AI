import type { NextApiRequest } from "next";
import type { DocumentData, DocumentReference } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { isAdminUid } from "@/lib/adminAuthServer";

/**
 * Identidad verificada para endpoints de usuario (no admin).
 *
 * Existe por la misma razón que `adminAuthServer.ts`: un `userId` que llega en
 * el body o la query **no prueba identidad** — cualquiera que conozca (o
 * adivine) el UID de otra persona puede mandarlo. Acá el UID sale siempre de un
 * Firebase ID token verificado criptográficamente
 * (`Authorization: Bearer <idToken>`), nunca de un campo que manda el cliente.
 *
 * Del lado del cliente, `authedFetch` (src/lib/userAuthClient.ts) adjunta ese
 * header automáticamente.
 */

/** Motivo del rechazo, para que cada endpoint lo traduzca a su idioma/UI. */
export type AuthFailureCode = "unauthenticated" | "forbidden" | "not-found" | "unconfigured";

export type UserAuthResult =
  | { ok: true; uid: string }
  | { ok: false; status: number; code: AuthFailureCode };

/**
 * Mensaje genérico para cada motivo de rechazo, en el idioma de la UI.
 *
 * Está acá para que los endpoints no repitan el mismo `switch`; los que
 * necesitan una redacción propia (ej. "no tienes permiso para *modificar este
 * plan*") la escriben en su archivo, que es donde se sabe de qué recurso se
 * habla.
 */
export function authFailureMessage(code: AuthFailureCode, lang: "es" | "en" = "es"): string {
  switch (code) {
    case "unauthenticated":
      return lang === "en" ? "You need to sign in to do this" : "Necesitas iniciar sesión para hacer esto";
    case "forbidden":
      return lang === "en" ? "You don't have permission to do this" : "No tienes permiso para hacer esto";
    case "not-found":
      return lang === "en" ? "Not found" : "No encontrado";
    case "unconfigured":
      return lang === "en" ? "Firebase Admin SDK is not configured" : "Firebase Admin SDK no configurado";
  }
}

export type PlanAccessResult =
  | { ok: true; uid: string; isAdmin: boolean; planRef: DocumentReference; planData: DocumentData }
  | { ok: false; status: number; code: AuthFailureCode };

/**
 * Verifica el ID token del request y devuelve el UID real de quien llama.
 * No consulta Firestore: solo prueba identidad.
 */
export async function requireUser(req: NextApiRequest): Promise<UserAuthResult> {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) {
    return { ok: false, status: 401, code: "unauthenticated" };
  }

  const adminAuth = getAdminAuth();
  if (!adminAuth) {
    return { ok: false, status: 501, code: "unconfigured" };
  }

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    return { ok: true, uid: decoded.uid };
  } catch {
    return { ok: false, status: 401, code: "unauthenticated" };
  }
}

/**
 * Verifica identidad y acceso a un plan de `planes/{planId}` en un solo paso:
 * pasa si quien llama es el dueño del plan o el admin.
 *
 * Devuelve el documento ya leído para que el endpoint no lo vuelva a pedir.
 *
 * Importante: los errores de lectura de Firestore (cuota/latencia) **se
 * propagan** a propósito, para que el endpoint que los sepa manejar (ej. el
 * modo degradado de `getWeeklyStats`) los siga viendo en su propio catch.
 * Solo los fallos de identidad/permiso se devuelven como resultado.
 */
export async function requirePlanAccess(req: NextApiRequest, planId: string): Promise<PlanAccessResult> {
  const auth = await requireUser(req);
  if (!auth.ok) return auth;

  const db = getAdminDb();
  if (!db) {
    return { ok: false, status: 501, code: "unconfigured" };
  }

  const planRef = db.collection("planes").doc(planId);
  const planDoc = await planRef.get();
  if (!planDoc.exists) {
    return { ok: false, status: 404, code: "not-found" };
  }

  const planData = planDoc.data();
  if (!planData) {
    return { ok: false, status: 404, code: "not-found" };
  }

  // Camino común (el dueño abre su propio plan): sin lecturas extra.
  if (planData.userId === auth.uid) {
    return { ok: true, uid: auth.uid, isAdmin: false, planRef, planData };
  }

  // Solo si no es el dueño vale la pena pagar la lectura que resuelve si es admin.
  if (await isAdminUid(db, auth.uid)) {
    return { ok: true, uid: auth.uid, isAdmin: true, planRef, planData };
  }

  return { ok: false, status: 403, code: "forbidden" };
}
