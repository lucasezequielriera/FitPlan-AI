import type { Firestore } from "firebase-admin/firestore";

/**
 * Un usuario es elegible para el trial gratuito de 30 días solo la primera
 * vez. `premiumSince` se setea una única vez, la primera vez que un usuario
 * se vuelve premium (ver payment/webhook.ts y payment/stripe-webhook.ts) y
 * nunca se borra al cancelar — así que su presencia es la señal de "ya usó
 * su trial alguna vez". Sin este chequeo, cancelar antes del primer cobro y
 * volver a suscribirse daba un trial nuevo indefinidamente.
 */
export async function isEligibleForFreeTrial(db: Firestore, userId: string): Promise<boolean> {
  try {
    const userDoc = await db.collection("usuarios").doc(userId).get();
    if (!userDoc.exists) return true;
    return userDoc.data()?.premiumSince === undefined;
  } catch {
    // Ante cualquier error de lectura, ser conservador: no otorgar trial no
    // verificado antes que arriesgar a dárselo dos veces al mismo usuario.
    return false;
  }
}
