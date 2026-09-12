import { create } from "zustand";
import { getAuthSafe } from "@/lib/firebase";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  User,
  getIdToken
} from "firebase/auth";

let authInitialized = false;

interface AuthState {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<import("firebase/auth").UserCredential>;
  logout: () => Promise<void>;
  initializeAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  
  signIn: async (email: string, password: string) => {
    const auth = getAuthSafe();
    if (!auth) {
      throw new Error("Firebase Auth no configurado. Verifica que todas las variables de entorno de Firebase estén configuradas en .env.local y que Authentication esté habilitado en Firebase Console.");
    }
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error: any) {
      if (error.code === 'auth/configuration-not-found') {
        throw new Error("Firebase Auth no está configurado. Verifica: 1) Variables de entorno en .env.local 2) Authentication habilitado en Firebase Console 3) Método Email/Password activado");
      }
      throw error;
    }
  },
  
  signUp: async (email: string, password: string) => {
    const auth = getAuthSafe();
    if (!auth) {
      throw new Error("Firebase Auth no configurado. Verifica que todas las variables de entorno de Firebase estén configuradas en .env.local y que Authentication esté habilitado en Firebase Console.");
    }
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      // Crear documento en Firestore con datos iniciales
      const db = await import("@/lib/firebase").then(m => m.getDbSafe());
      if (db && userCredential.user) {
        const { doc, setDoc, serverTimestamp } = await import("firebase/firestore");
        const userRef = doc(db, "usuarios", userCredential.user.uid);
        
        try {
          await setDoc(userRef, {
            email: email.toLowerCase(),
            premium: false,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          console.log("✅ Documento de usuario creado en Firestore");
          
          // Guardar ubicación del usuario inmediatamente después del registro (no bloqueante)
          // El token se pide al propio `userCredential.user`, no a
          // `auth.currentUser`: estamos justo después de crear la cuenta y no
          // conviene depender de que el SDK ya lo haya poblado. El servidor
          // deriva el UID del token, así que ya no viaja en el cuerpo.
          userCredential.user
            .getIdToken()
            .then((idToken) =>
              fetch("/api/saveUserLocation", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
                body: JSON.stringify({}),
              })
            )
            .catch((err) => {
            console.warn("⚠️ No se pudo guardar ubicación del usuario:", err);
            // No bloquear el registro si falla guardar la ubicación
          });
          
          // Nota: La notificación de Telegram se enviará cuando se cree el perfil completo en saveUserProfile.ts
        } catch (firestoreError) {
          console.error("Error al crear documento en Firestore:", firestoreError);
          // No lanzamos error aquí para no bloquear el registro si falla Firestore
        }
      }
      
      return userCredential;
    } catch (error: any) {
      if (error.code === 'auth/configuration-not-found') {
        throw new Error("Firebase Auth no está configurado. Verifica: 1) Variables de entorno en .env.local 2) Authentication habilitado en Firebase Console 3) Método Email/Password activado");
      }
      throw error;
    }
  },
  
  logout: async () => {
    const auth = getAuthSafe();
    if (!auth) return;
    await signOut(auth);
    set({ user: null });
  },
  
  initializeAuth: () => {
    if (authInitialized) return;

    const auth = getAuthSafe();
    if (!auth) {
      set({ loading: false });
      return;
    }

    authInitialized = true;
    onAuthStateChanged(auth, async (user) => {
      set({ user, loading: false });
      
      // Actualizar lastLogin cuando el usuario se conecta
      if (user) {
        const sessionKey = `lastLoginSynced:${user.uid}`;
        const syncedInSession = typeof window !== "undefined" ? sessionStorage.getItem(sessionKey) : null;
        if (syncedInSession === "1") {
          return;
        }
        try {
          // El servidor toma el UID del token, no del cuerpo.
          //
          // El token se pide directamente a `user`, el objeto que este propio
          // callback recibe, en vez de a `authedFetch` (que lo busca en
          // `auth.currentUser`). Aquí estamos DENTRO de `onAuthStateChanged`, y
          // depender de que `auth.currentUser` ya esté poblado en ese instante
          // es una suposición sobre el orden interno del SDK que no podemos
          // comprobar; si fallara, dejaríamos de registrar `lastLogin` y los
          // días activos de todos los usuarios sin que nada fallara a la vista.
          const idToken = await user.getIdToken();
          const response = await fetch("/api/updateLastLogin", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${idToken}`,
            },
            body: JSON.stringify({}),
          });
          
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.warn("No se pudo actualizar lastLogin:", errorData);
          } else {
            if (typeof window !== "undefined") {
              sessionStorage.setItem(sessionKey, "1");
            }
          }
        } catch (error) {
          // Silenciar errores de lastLogin para no bloquear el flujo
          console.warn("Error al actualizar lastLogin:", error);
        }
      }
    });
  },
}));

