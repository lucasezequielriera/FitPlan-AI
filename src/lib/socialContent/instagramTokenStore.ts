import { FieldValue, Timestamp, type Firestore } from "firebase-admin/firestore";

/**
 * Caché en Firestore del token de acceso de Instagram, para que el cron de
 * renovación (refreshInstagramToken.ts) pueda actualizarlo en runtime sin
 * necesitar un redeploy — las env vars de Vercel no se pueden reescribir
 * desde código en ejecución. Mismo patrón que src/lib/exchangeRate.ts.
 */
const DOC_COLLECTION = "config";
const DOC_ID = "instagramToken";

export type StoredInstagramToken = {
  accessToken: string;
  expiresAt: Date | null;
};

/**
 * Token efectivo a usar: el cacheado en Firestore si existe (más fresco,
 * actualizado por el cron de renovación), si no el de la env var
 * INSTAGRAM_ACCESS_TOKEN (bootstrap inicial, antes de la primera renovación).
 */
export async function getInstagramAccessToken(db: Firestore): Promise<string | null> {
  try {
    const snap = await db.collection(DOC_COLLECTION).doc(DOC_ID).get();
    if (snap.exists) {
      const data = snap.data() || {};
      if (typeof data.accessToken === "string" && data.accessToken) {
        return data.accessToken;
      }
    }
  } catch (err) {
    console.warn("⚠️ No se pudo leer el token de Instagram cacheado, se usa el de env var:", err);
  }
  return process.env.INSTAGRAM_ACCESS_TOKEN || null;
}

/** Info del token cacheado (para decidir si hace falta renovar). */
export async function getStoredInstagramToken(db: Firestore): Promise<StoredInstagramToken | null> {
  const snap = await db.collection(DOC_COLLECTION).doc(DOC_ID).get();
  if (!snap.exists) return null;
  const data = snap.data() || {};
  if (typeof data.accessToken !== "string" || !data.accessToken) return null;
  const ts = data.expiresAt;
  const expiresAt = ts && typeof ts.toDate === "function" ? ts.toDate() : null;
  return { accessToken: data.accessToken, expiresAt };
}

export async function storeInstagramAccessToken(
  db: Firestore,
  accessToken: string,
  expiresInSeconds: number
): Promise<void> {
  const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);
  await db.collection(DOC_COLLECTION).doc(DOC_ID).set(
    {
      accessToken,
      expiresAt: Timestamp.fromDate(expiresAt),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}
