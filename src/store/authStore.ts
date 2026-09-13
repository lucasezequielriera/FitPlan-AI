import { create } from "zustand";
import { getAuthSafe } from "@/lib/firebase";
// `@/lib/dates/madrid` no importa firebase-admin, así que se puede usar en el
// cliente. `funnel/store.ts`, donde vive el resto de esta lógica, sí lo hace.
import { madridDateId } from "@/lib/dates/madrid";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  User,
  getIdToken
} from "firebase/auth";

/**
 * Marca hoy como día activo del usuario.
 *
 * Es la base de `funnel.activeDays`, y por tanto de la retención que se ve en
 * `/admin/embudo`. "Activo" significa que la persona entró en la app — mirar el
 * plan cuenta, aunque no registre nada.
 *
 * El guard va por DÍA y en `localStorage`. Antes era por sesión del navegador
 * (`sessionStorage`), que dura lo que dura la pestaña: quien deja la app abierta
 * —lo normal en el móvil, donde el webview de Capacitor sobrevive días— entraba
 * cinco días seguidos y contaba como UNO. La métrica subcontaba justo a los
 * usuarios más fieles, que son los únicos que importan al medir retención.
 *
 * El servidor ya es idempotente por día (`nextActiveDays` devuelve null si hoy
 * ya consta), así que repetir la llamada no corrompe nada: este guard solo
 * ahorra tráfico.
 *
 * Nunca lanza. Es telemetría: perder un día es aceptable, romper el arranque de
 * la sesión no.
 */
async function marcarDiaActivo(user: User): Promise<void> {
  if (typeof window === "undefined") return;
  const hoy = madridDateId(new Date());
  const diaKey = `lastLoginSynced:${user.uid}`;
  if (localStorage.getItem(diaKey) === hoy) return;

  try {
    const idToken = await user.getIdToken();
    const response = await fetch("/api/updateLastLogin", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({}),
    });
    if (!response.ok) {
      console.warn("No se pudo actualizar lastLogin:", await response.json().catch(() => ({})));
      return;
    }
    localStorage.setItem(diaKey, hoy);
  } catch (error) {
    console.warn("Error al actualizar lastLogin:", error);
  }
}

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
      // `user` llega aquí como argumento del callback, no de `auth.currentUser`:
      // dentro de `onAuthStateChanged` no se puede dar por poblado sin hacer una
      // suposición sobre el orden interno del SDK que no podemos comprobar.
      if (user) void marcarDiaActivo(user);
    });

    // `onAuthStateChanged` dispara una vez por carga de página. Sin esto, quien
    // deja la app abierta y vuelve al día siguiente no marca ese día: la app ya
    // estaba montada, nadie vuelve a preguntar. En el móvil es el caso normal.
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState !== "visible") return;
        const actual = getAuthSafe()?.currentUser;
        // Aquí sí vale `currentUser`: estamos fuera del callback y la sesión
        // lleva rato establecida.
        if (actual) void marcarDiaActivo(actual);
      });
    }
  },
}));

