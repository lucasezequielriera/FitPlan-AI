import { useRouter } from "next/router";
import { useAuthStore } from "@/store/authStore";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { FaAppleAlt } from "react-icons/fa";
import LoginModal from "./LoginModal";
import { getDbSafe, getAuthSafe } from "@/lib/firebase";
import { collection, query, where, getDocs, limit, doc, getDoc } from "firebase/firestore";

export default function Navbar() {
  const router = useRouter();
  const { user: authUser, logout, initializeAuth, loading: authLoading } = useAuthStore();
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [hasPlans, setHasPlans] = useState<boolean | null>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const isPlanPage = router.pathname === "/plan";

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  useEffect(() => {
    const checkUserPlans = async () => {
      if (!authUser) {
        setHasPlans(null);
        setIsPremium(false);
        setIsAdmin(false);
        return;
      }

      try {
        const db = getDbSafe();
        const auth = getAuthSafe();
        if (!db || !auth?.currentUser) {
          setHasPlans(false);
          setIsPremium(false);
          return;
        }

        // Verificar planes
        const q = query(
          collection(db, "planes"),
          where("userId", "==", auth.currentUser.uid),
          limit(1)
        );

        const querySnapshot = await getDocs(q);
        setHasPlans(!querySnapshot.empty);

        // Verificar estado premium y admin
        const userRef = doc(db, "usuarios", auth.currentUser.uid);
        const userDoc = await getDoc(userRef);
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setIsPremium(userData.premium === true);
          
          // Verificar si es admin por email
          const email = userData.email?.toLowerCase() || auth.currentUser.email?.toLowerCase() || "";
          setIsAdmin(email === "admin@fitplan-ai.com");
        } else {
          setIsPremium(false);
          // Verificar admin por email de Auth si el documento no existe
          const email = auth.currentUser.email?.toLowerCase() || "";
          setIsAdmin(email === "admin@fitplan-ai.com");
        }
      } catch (error) {
        console.error("Error al verificar planes y premium:", error);
        setHasPlans(false);
        setIsPremium(false);
        setIsAdmin(false);
      }
    };

    checkUserPlans();
  }, [authUser]);

  return (
    <nav className="sticky top-0 z-40 w-full border-b border-white/10 bg-black/30 backdrop-blur-md overflow-x-hidden">
      <div className="mx-auto max-w-7xl px-3 sm:px-4 md:px-6 lg:px-8 w-full overflow-x-hidden">
        <div className="flex h-16 items-center justify-between">
          {/* Logo y título */}
          <div 
            className="flex items-center gap-2 sm:gap-3 cursor-pointer flex-shrink-0 min-w-0"
            onClick={() => router.push("/")}
          >
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500">
              <FaAppleAlt className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-semibold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent truncate">
                FitPlan AI
              </h1>
              <p className="text-[10px] opacity-60 hidden sm:block">Plan nutricional inteligente</p>
            </div>
          </div>

          {/* Información del usuario y acciones */}
          <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">

            {authUser && (
              <>
                <motion.div
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 cursor-pointer hover:bg-white/10 transition-colors"
                  onClick={() => {
                    if (isAdmin) {
                      router.push("/admin");
                    } else if (hasPlans) {
                      router.push("/dashboard");
                    } else {
                      router.push("/create-plan");
                    }
                  }}
                >
                  <div className="relative h-8 w-8 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center text-xs font-semibold text-white">
                    {authUser.email?.charAt(0).toUpperCase() || "U"}
                    {isPremium && (
                      <div className="absolute -top-1 -right-1">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          className="h-4 w-4 text-yellow-400"
                        >
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="hidden md:block">
                    <p className="text-xs font-medium flex items-center gap-1">
                      {isAdmin 
                        ? "Administrador"
                        : hasPlans === null 
                          ? "..." 
                          : hasPlans 
                            ? "Dashboard" 
                            : "Crear mi plan"}
                      {isPremium && (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          className="h-3 w-3 text-yellow-400"
                        >
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                        </svg>
                      )}
                    </p>
                    <p className="text-[10px] opacity-60">Conectado</p>
                  </div>
                </motion.div>
              </>
            )}

            <div className="flex items-center gap-2">
              {!authUser && !isPlanPage && (
                <div className="flex items-center gap-2 text-xs opacity-70">
                  <span className="hidden sm:inline">Crea tu plan personalizado</span>
                </div>
              )}
              
              {/* Botón de iniciar sesión o cerrar sesión */}
              {authLoading ? (
                <div className="flex items-center gap-2 px-4 py-2 text-sm opacity-70">
                  Cargando...
                </div>
              ) : authUser ? (
                <button
                  onClick={async () => {
                    await logout();
                    router.push("/");
                  }}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-sm transition-colors"
                  title="Cerrar sesión"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4 w-4"
                  >
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  <span className="hidden md:inline">Cerrar sesión</span>
                </button>
              ) : (
                <button
                  onClick={() => setLoginModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white text-sm font-medium transition-all shadow-lg shadow-blue-500/20"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4 w-4"
                  >
                    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                    <polyline points="10 17 15 12 10 7" />
                    <line x1="15" y1="12" x2="3" y2="12" />
                  </svg>
                  <span>Iniciar sesión</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      <LoginModal isOpen={loginModalOpen} onClose={() => setLoginModalOpen(false)} />
    </nav>
  );
}

