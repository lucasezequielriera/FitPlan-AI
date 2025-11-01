import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let app: ReturnType<typeof initializeApp> | null = null;

function getApp() {
  if (!app) {
    const allPresent = Object.values(firebaseConfig).every(Boolean);
    if (!allPresent) {
      console.warn("⚠️ Firebase no configurado completamente. Verifica las variables de entorno:");
      console.warn("Variables faltantes:", Object.entries(firebaseConfig)
        .filter(([, value]) => !value)
        .map(([key]) => key)
      );
      return null;
    }
    try {
      app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
    } catch (error) {
      console.error("❌ Error al inicializar Firebase:", error);
      return null;
    }
  }
  return app;
}

export function getDbSafe() {
  const appInstance = getApp();
  if (!appInstance) return null;
  return getFirestore(appInstance);
}

export function getAuthSafe() {
  const appInstance = getApp();
  if (!appInstance) return null;
  return getAuth(appInstance);
}

