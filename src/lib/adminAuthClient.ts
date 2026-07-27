import { getAuthSafe, getDbSafe } from "@/lib/firebase";

/** Comprueba si el usuario actual es admin (email Auth o documento usuarios). Solo cliente. */
export async function getIsAdminClient(): Promise<boolean> {
  const auth = getAuthSafe();
  if (!auth?.currentUser) return false;
  const authEmail = auth.currentUser.email?.toLowerCase() || "";
  if (authEmail === "admin@fitplan-ai.com") return true;
  const db = getDbSafe();
  if (!db) return false;
  const { doc, getDoc } = await import("firebase/firestore");
  const snap = await getDoc(doc(db, "usuarios", auth.currentUser.uid));
  if (!snap.exists()) return false;
  const email = (snap.data()?.email as string | undefined)?.toLowerCase() || "";
  return email === "admin@fitplan-ai.com";
}

/**
 * Firebase ID token del admin logueado, para adjuntar en el header
 * `Authorization: Bearer <token>` de cualquier llamada a /api/admin/*.
 * Los endpoints admin ya no confían en un `adminUserId` de body/query sin
 * firmar — necesitan este token para verificar identidad server-side
 * (ver src/lib/adminAuthServer.ts).
 */
export async function getAdminIdToken(): Promise<string | null> {
  const auth = getAuthSafe();
  if (!auth?.currentUser) return null;
  try {
    return await auth.currentUser.getIdToken();
  } catch {
    return null;
  }
}

/**
 * Wrapper de fetch para endpoints /api/admin/*: adjunta automáticamente el
 * Authorization: Bearer <idToken> del admin logueado. Usar en vez de fetch()
 * directo para cualquier llamada a un endpoint bajo /api/admin/.
 */
export async function adminFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const token = await getAdminIdToken();
  const headers = new Headers(init.headers || {});
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return fetch(input, { ...init, headers });
}
