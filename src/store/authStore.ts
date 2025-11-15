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
    const auth = getAuthSafe();
    if (!auth) {
      set({ loading: false });
      return;
    }
    
    onAuthStateChanged(auth, (user) => {
      set({ user, loading: false });
    });
  },
}));

