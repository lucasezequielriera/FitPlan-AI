import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getAuth, type Auth } from "firebase-admin/auth";

let adminApp: App | null = null;
let adminDb: Firestore | null = null;

export function getAdminApp(): App | null {
  if (adminApp) {
    return adminApp;
  }

  // Verificar si ya existe una app inicializada
  const existingApps = getApps();
  if (existingApps.length > 0) {
    adminApp = existingApps[0];
    return adminApp;
  }

  // Intentar inicializar con variables de entorno
  try {
    const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
    const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

    if (privateKey && clientEmail && projectId) {
      adminApp = initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey: privateKey.replace(/\\n/g, '\n'),
        }),
      });
      return adminApp;
    } else {
      const missing = [];
      if (!privateKey) missing.push("FIREBASE_ADMIN_PRIVATE_KEY");
      if (!clientEmail) missing.push("FIREBASE_ADMIN_CLIENT_EMAIL");
      if (!projectId) missing.push("NEXT_PUBLIC_FIREBASE_PROJECT_ID");
      
      console.error("❌ Firebase Admin SDK no configurado. Variables faltantes:", missing);
      console.error("📝 Para configurar:");
      console.error("1. Ve a Firebase Console > Project Settings > Service Accounts");
      console.error("2. Haz clic en 'Generate new private key'");
      console.error("3. Configura estas variables en Vercel:");
      console.error(`   - FIREBASE_ADMIN_PRIVATE_KEY: (el campo 'private_key' del JSON)`);
      console.error(`   - FIREBASE_ADMIN_CLIENT_EMAIL: (el campo 'client_email' del JSON)`);
      console.error(`   - NEXT_PUBLIC_FIREBASE_PROJECT_ID: (ya debería estar configurado)`);
      return null;
    }
  } catch (error) {
    console.error("❌ Error al inicializar Firebase Admin SDK:", error);
    return null;
  }
}

export function getAdminDb(): Firestore | null {
  if (adminDb) {
    return adminDb;
  }

  const app = getAdminApp();
  if (!app) {
    return null;
  }

  try {
    adminDb = getFirestore(app);
    return adminDb;
  } catch (error) {
    console.error("❌ Error al obtener Firestore Admin:", error);
    return null;
  }
}

let adminAuth: Auth | null = null;

export function getAdminAuth(): Auth | null {
  if (adminAuth) {
    return adminAuth;
  }

  const app = getAdminApp();
  if (!app) {
    return null;
  }

  try {
    adminAuth = getAuth(app);
    return adminAuth;
  } catch (error) {
    console.error("❌ Error al obtener Auth Admin:", error);
    return null;
  }
}

