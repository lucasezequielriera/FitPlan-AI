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
