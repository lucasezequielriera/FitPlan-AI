import { FieldValue, Timestamp, type Firestore } from "firebase-admin/firestore";

/**
 * Caché en Firestore de los tokens de TikTok (equivalente a
 * instagramTokenStore.ts). El access_token de TikTok dura solo 24hs — mucho
 * menos que el de Instagram (~60 días) — así que el cron de renovación
 * (refreshTikTokToken.ts) tiene que correr con más frecuencia (diario alcanza
 * porque siempre se renueva bastante antes de las 24hs).
 */
const DOC_COLLECTION = "config";
const DOC_ID = "tiktokToken";

export type StoredTikTokTokens = {
  accessToken: string;
  refreshToken: string;
  openId: string;
  accessTokenExpiresAt: Date | null;
};

export async function getStoredTikTokTokens(db: Firestore): Promise<StoredTikTokTokens | null> {
  const snap = await db.collection(DOC_COLLECTION).doc(DOC_ID).get();
  if (!snap.exists) return null;
  const data = snap.data() || {};
  if (typeof data.accessToken !== "string" || typeof data.refreshToken !== "string" || typeof data.openId !== "string") {
    return null;
  }
  const ts = data.accessTokenExpiresAt;
  const accessTokenExpiresAt = ts && typeof ts.toDate === "function" ? ts.toDate() : null;
  return { accessToken: data.accessToken, refreshToken: data.refreshToken, openId: data.openId, accessTokenExpiresAt };
}

export async function storeTikTokTokens(
  db: Firestore,
  params: { accessToken: string; refreshToken: string; openId: string; expiresInSeconds: number }
): Promise<void> {
  const accessTokenExpiresAt = new Date(Date.now() + params.expiresInSeconds * 1000);
  await db.collection(DOC_COLLECTION).doc(DOC_ID).set(
    {
      accessToken: params.accessToken,
      refreshToken: params.refreshToken,
      openId: params.openId,
      accessTokenExpiresAt: Timestamp.fromDate(accessTokenExpiresAt),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}
