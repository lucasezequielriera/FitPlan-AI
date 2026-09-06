import { getAuthSafe } from "@/lib/firebase";

/**
 * Firebase ID token del usuario logueado, para adjuntar en el header
 * `Authorization: Bearer <token>` de las llamadas a endpoints de usuario que
 * verifican identidad server-side (ver src/lib/userAuthServer.ts).
 *
 * Equivalente a `getAdminIdToken` de adminAuthClient.ts, pero para cualquier
 * usuario logueado (incluido el admin, que también es un usuario).
 */
export async function getUserIdToken(): Promise<string | null> {
  const auth = getAuthSafe();
  if (!auth?.currentUser) return null;
  try {
    return await auth.currentUser.getIdToken();
  } catch {
    return null;
  }
}

/**
 * Wrapper de fetch que adjunta automáticamente el Authorization: Bearer
 * <idToken> del usuario logueado. Usar en vez de fetch() directo para
 * cualquier endpoint que necesite saber quién llama.
 *
 * El endpoint deriva el UID del token — el cliente ya no manda `userId` en el
 * body, porque un UID sin firmar no prueba identidad.
 */
export async function authedFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers || {});
  // Si quien llama ya trae su propio Authorization, se respeta: en los flujos de
  // alta y de login el token sale del `User` recién devuelto por Firebase, que
  // es más fiable que `auth.currentUser` (todavía puede no estar asentado).
  if (!headers.has("Authorization")) {
    const token = await getUserIdToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }
  return fetch(input, { ...init, headers });
}
