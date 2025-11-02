import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthStore } from "@/store/authStore";
import { getDbSafe, getAuthSafe } from "@/lib/firebase";
import { collection, query, where, getDocs, limit } from "firebase/firestore";

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMode?: "login" | "signup";
}

export default function LoginModal({ isOpen, onClose, defaultMode = "login" }: LoginModalProps) {
  const [isSignUp, setIsSignUp] = useState(defaultMode === "signup");
  
  // Resetear al modo por defecto cuando se abre el modal
  useEffect(() => {
    if (isOpen) {
      setIsSignUp(defaultMode === "signup");
      setEmail("");
      setPassword("");
      setError(null);
    }
  }, [isOpen, defaultMode]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { signIn, signUp } = useAuthStore();

  useEffect(() => {
    setMounted(true);
  }, []);

  const checkUserPlansAndRedirect = async () => {
    try {
      const db = getDbSafe();
      const auth = getAuthSafe();
      if (!db || !auth?.currentUser) {
        window.location.href = "/create-plan";
        return;
      }

      // Primero verificar si es administrador
      const { doc, getDoc } = await import("firebase/firestore");
      const userRef = doc(db, "usuarios", auth.currentUser.uid);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const email = userData.email?.toLowerCase() || "";
        const nombreLower = userData.nombre?.toLowerCase() || "";
        const isAdmin = email === "admin@fitplan-ai.com" || nombreLower === "administrador";
        
        if (isAdmin) {
          window.location.href = "/admin";
          return;
        }
      }

      // Verificar si tiene planes guardados
      const q = query(
        collection(db, "planes"),
        where("userId", "==", auth.currentUser.uid),
        limit(1)
      );

      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        // Usuario sin planes, enviar al formulario
        window.location.href = "/create-plan";
      } else {
        // Usuario con planes, enviar al dashboard
        window.location.href = "/dashboard";
      }
    } catch (error) {
      console.error("Error al verificar planes:", error);
      window.location.href = "/create-plan";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isSignUp) {
        await signUp(email, password);
      } else {
        await signIn(email, password);
      }
      onClose();
      setEmail("");
      setPassword("");
      
      // Verificar si es administrador y redirigir
      const auth = getAuthSafe();
      if (auth?.currentUser) {
        // Primero verificar el email de Firebase Auth (disponible inmediatamente)
        const authEmail = auth.currentUser.email?.toLowerCase() || "";
        if (authEmail === "admin@fitplan-ai.com") {
          window.location.href = "/admin";
          return;
        }

        // Si no es admin por email de Auth, verificar en Firestore
        const db = getDbSafe();
        if (db) {
          const { doc, getDoc } = await import("firebase/firestore");
          const userRef = doc(db, "usuarios", auth.currentUser.uid);
          const userDoc = await getDoc(userRef);
          
          if (userDoc.exists()) {
            const userData = userDoc.data();
            const email = userData.email?.toLowerCase() || "";
            const nombreLower = userData.nombre?.toLowerCase() || "";
            const isAdmin = email === "admin@fitplan-ai.com" || nombreLower === "administrador";
            
            if (isAdmin) {
              window.location.href = "/admin";
              return;
            }
          }
        }
      }

      // Si es registro nuevo, redirigir directo al form
      if (isSignUp) {
        window.location.href = "/create-plan";
      } else {
        // Si es login, verificar si tiene planes y redirigir
        checkUserPlansAndRedirect();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error al iniciar sesión";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) return null;

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
            style={{ 
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 10000,
            }}
          />
          
          {/* Modal */}
          <div 
            className="pointer-events-none"
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 10001,
              width: '100%',
              maxWidth: '28rem',
              padding: '1rem',
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full rounded-xl border border-white/10 bg-black/95 p-6 shadow-2xl pointer-events-auto relative"
              style={{ maxHeight: '90vh', overflowY: 'auto' }}
            >
              <button
                onClick={onClose}
                className="absolute right-4 top-4 text-white/70 hover:text-white transition-colors z-10"
                aria-label="Cerrar"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5"
                >
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>

              <h2 className="text-2xl font-semibold mb-2">
                {isSignUp ? "Crear cuenta" : "Iniciar sesión"}
              </h2>
              <p className="text-sm opacity-70 mb-6">
                {isSignUp 
                  ? "Crea una cuenta para guardar tus planes de alimentación" 
                  : "Ingresa tus credenciales para acceder a tu cuenta"}
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2 opacity-80">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="tu@email.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 opacity-80">
                    Contraseña
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="••••••••"
                  />
                  {isSignUp && (
                    <p className="mt-1 text-xs opacity-60">
                      Mínimo 6 caracteres
                    </p>
                  )}
                </div>

                {error && (
                  <div className="p-3 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300 text-sm">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-medium transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? "Cargando..." : isSignUp ? "Crear cuenta" : "Iniciar sesión"}
                </button>
              </form>

              <div className="mt-4 text-center">
                <button
                  onClick={() => {
                    setIsSignUp(!isSignUp);
                    setError(null);
                  }}
                  className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
                >
                  {isSignUp 
                    ? "¿Ya tienes cuenta? Inicia sesión" 
                    : "¿No tienes cuenta? Regístrate"}
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );

  return createPortal(modalContent, document.body);
}
