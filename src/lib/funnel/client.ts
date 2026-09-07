import { authedFetch } from "@/lib/userAuthClient";
import type { TrackableMilestone } from "@/lib/funnel/types";

/**
 * Helper de cliente para reportar un hito del embudo.
 *
 * Seguro de importar desde cualquier componente: no toca `firebase-admin`.
 *
 * Usa `authedFetch` (adjunta el ID token) porque el servidor toma el UID del
 * token, no del cuerpo: sin identidad probada, cualquiera podría escribirle
 * hitos falsos a otro usuario, y los hitos son permanentes por diseño.
 *
 * Nunca lanza ni bloquea. Es telemetría: perder un dato es infinitamente
 * preferible a que un error de red impida generar un plan o llegar al checkout.
 */
export function trackFunnel(userId: string | undefined | null, milestone: TrackableMilestone): void {
  if (typeof window === "undefined" || !userId) return;

  // Una sola vez por sesión y por hito: los hitos marcan la PRIMERA vez que
  // algo ocurre, así que repetir la llamada en cada render solo gastaría
  // lecturas de Firestore sin cambiar el dato. El `userId` se usa aquí solo
  // como clave de deduplicación y para no llamar si no hay sesión — quién
  // escribe lo decide el servidor a partir del token.
  const key = `funnel:${milestone}:${userId}`;
  try {
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
  } catch {
    // Modo incógnito o storage bloqueado: se reporta igual, sin deduplicar.
  }

  void authedFetch("/api/funnel/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ milestone }),
  }).catch(() => {
    // Silencio deliberado.
  });
}
