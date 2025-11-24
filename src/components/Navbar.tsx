import { useRouter } from "next/router";
import { useAuthStore } from "@/store/authStore";
import { motion } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import { FaAppleAlt } from "react-icons/fa";
import LoginModal from "./LoginModal";
import UserMessagesModal from "./UserMessagesModal";
import GymCalendarModal from "./GymCalendarModal";
import { getDbSafe, getAuthSafe } from "@/lib/firebase";
import { collection, query, where, getDocs, limit, doc, getDoc } from "firebase/firestore";
import React from "react";

export default function Navbar() {
  const router = useRouter();
  const { user: authUser, logout, initializeAuth, loading: authLoading } = useAuthStore();
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [hasPlans, setHasPlans] = useState<boolean | null>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [messagesCount, setMessagesCount] = useState(0);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messagesModalOpen, setMessagesModalOpen] = useState(false);
  const [sendMessageModalOpen, setSendMessageModalOpen] = useState(false);
  const [userMessagesCount, setUserMessagesCount] = useState(0);
  const [userMessagesModalOpen, setUserMessagesModalOpen] = useState(false);
  const [gymCalendarModalOpen, setGymCalendarModalOpen] = useState(false);
  const [currentMonthGymDays, setCurrentMonthGymDays] = useState(0);
  const isPlanPage = router.pathname === "/plan";
  const isDashboardPage = router.pathname === "/dashboard";

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
          // Nombre del usuario para mostrar en dashboard
          const nameFromDb: string | undefined = (userData as Record<string, unknown>).nombre as string | undefined;
          const fallbackName = auth.currentUser.displayName || auth.currentUser.email?.split("@")[0] || "Usuario";
          setUserName(nameFromDb && nameFromDb.trim().length > 0 ? nameFromDb : fallbackName);
          
          // Verificar si es admin por email
          const email = userData.email?.toLowerCase() || auth.currentUser.email?.toLowerCase() || "";
          setIsAdmin(email === "admin@fitplan-ai.com");
        } else {
          setIsPremium(false);
          // Verificar admin por email de Auth si el documento no existe
          const email = auth.currentUser.email?.toLowerCase() || "";
          setIsAdmin(email === "admin@fitplan-ai.com");
          const fallbackName = auth.currentUser.displayName || auth.currentUser.email?.split("@")[0] || "Usuario";
          setUserName(fallbackName);
        }
      } catch (error) {
        console.error("Error al verificar planes y premium:", error);
        setHasPlans(false);
        setIsPremium(false);
        setIsAdmin(false);
      }
    };

    checkUserPlans();
    loadGymDaysCount();
  }, [authUser]);

  // Cargar contador de días de gym del mes actual
  const loadGymDaysCount = async () => {
    if (!authUser) {
      setCurrentMonthGymDays(0);
      return;
    }

    try {
      const db = getDbSafe();
      const auth = getAuthSafe();
      if (!db || !auth?.currentUser) {
        return;
      }

      const { doc, getDoc } = await import("firebase/firestore");
      const userRef = doc(db, "usuarios", auth.currentUser.uid);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const savedGymDays = userData.gymDays || [];
        
        // Filtrar solo los días del mes actual
        const now = new Date();
        const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const monthGymDays = savedGymDays.filter((date: string) => date.startsWith(monthKey));
        
        setCurrentMonthGymDays(monthGymDays.length);
      }
    } catch (error) {
      console.error("Error al cargar días de gym:", error);
    }
  };

  // Verificar mensajes nuevos para admin
  useEffect(() => {
    if (!authUser || !isAdmin) {
      setMessagesCount(0);
      return;
    }

    const checkMessages = async () => {
      try {
        const response = await fetch(`/api/admin/messages?adminUserId=${authUser.uid}`);
        
        if (!response.ok) {
          return;
        }

        const data = await response.json();
        const newCount = data.unreadCount || 0;
        // Solo actualizar si el contador cambió para evitar re-renders innecesarios
        setMessagesCount(prev => prev !== newCount ? newCount : prev);
      } catch (error) {
        // Silenciar errores en polling
      }
    };

    checkMessages();
    
    // Verificar cada 30 segundos si es admin (menos frecuente para reducir re-renders)
    const interval = setInterval(checkMessages, 30000);
    return () => clearInterval(interval);
  }, [authUser, isAdmin]);

  // Verificar respuestas nuevas para usuarios
  useEffect(() => {
    if (!authUser || isAdmin) {
      setUserMessagesCount(0);
      return;
    }

    const checkUserMessages = async () => {
      try {
        const response = await fetch(`/api/user/messages?userId=${authUser.uid}`);
        
        if (!response.ok) {
          return;
        }

        const data = await response.json();
        const newCount = data.unreadRepliesCount || 0;
        // Solo actualizar si el contador cambió para evitar re-renders innecesarios
        setUserMessagesCount(prev => prev !== newCount ? newCount : prev);
      } catch (error) {
        // Silenciar errores en polling
      }
    };

    checkUserMessages();
    
    // Verificar cada 30 segundos si es usuario (menos frecuente para reducir re-renders)
    const interval = setInterval(checkUserMessages, 30000);
    return () => clearInterval(interval);
  }, [authUser, isAdmin]);

  return (
    <>
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
                {/* Icono de mensajes para usuarios (no admin) */}
                {!isAdmin && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="relative cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      setUserMessagesModalOpen(true);
                    }}
                    title="Mis mensajes"
                  >
                    <motion.div
                      animate={userMessagesCount > 0 ? {
                        scale: [1, 1.1, 1],
                        rotate: [0, -5, 5, 0]
                      } : {}}
                      transition={{
                        duration: 0.5,
                        repeat: userMessagesCount > 0 ? Infinity : 0,
                        repeatDelay: 2
                      }}
                      className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-5 w-5 text-white/80"
                      >
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      </svg>
                    </motion.div>
                    {userMessagesCount > 0 && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-blue-500 border-2 border-black flex items-center justify-center"
                      >
                        <motion.span
                          animate={{ scale: [1, 1.2, 1] }}
                          transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 1 }}
                          className="text-[10px] font-bold text-white"
                        >
                          {userMessagesCount > 9 ? "9+" : userMessagesCount}
                        </motion.span>
                      </motion.div>
                    )}
                  </motion.div>
                )}

                {/* Icono de calendario de gym para usuarios (no admin) */}
                {!isAdmin && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="relative cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      setGymCalendarModalOpen(true);
                      // Recargar contador cuando se abre el modal
                      setTimeout(() => loadGymDaysCount(), 500);
                    }}
                    title="Días de gym"
                  >
                    <motion.div
                      className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors relative"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-5 w-5 text-white/80"
                      >
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                      {currentMonthGymDays > 0 && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 border-2 border-black flex items-center justify-center"
                        >
                          <span className="text-[10px] font-bold text-white">
                            {currentMonthGymDays > 9 ? "9+" : currentMonthGymDays}
                          </span>
                        </motion.div>
                      )}
                    </motion.div>
                  </motion.div>
                )}

                {/* Icono de notificaciones de mensajes para admin */}
                {isAdmin && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="relative cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMessagesModalOpen(true);
                    }}
                    title="Mensajes"
                  >
                    <motion.div
                      animate={messagesCount > 0 ? {
                        scale: [1, 1.1, 1],
                        rotate: [0, -5, 5, 0]
                      } : {}}
                      transition={{
                        duration: 0.5,
                        repeat: messagesCount > 0 ? Infinity : 0,
                        repeatDelay: 2
                      }}
                      className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-5 w-5 text-white/80"
                      >
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      </svg>
                    </motion.div>
                    {messagesCount > 0 && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 border-2 border-black flex items-center justify-center"
                      >
                        <motion.span
                          animate={{ scale: [1, 1.2, 1] }}
                          transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 1 }}
                          className="text-[10px] font-bold text-white"
                        >
                          {messagesCount > 9 ? "9+" : messagesCount}
                        </motion.span>
                      </motion.div>
                    )}
                    {loadingMessages && messagesCount === 0 && (
                      <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-blue-500 animate-pulse" />
                    )}
                  </motion.div>
                )}

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
                        : isPlanPage
                          ? "Ir a mi dashboard"
                          : isDashboardPage
                            ? (userName || "Mi dashboard")
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
                    // Si es admin, actualizar lastUsersCheck antes de desconectarse
                    if (isAdmin && authUser) {
                      try {
                        const db = getDbSafe();
                        if (db) {
                          const { doc, updateDoc, serverTimestamp } = await import("firebase/firestore");
                          const userRef = doc(db, "usuarios", authUser.uid);
                          await updateDoc(userRef, {
                            lastUsersCheck: serverTimestamp(),
                            updatedAt: serverTimestamp(),
                          });
                          console.log("✅ Última conexión del admin actualizada al desconectarse");
                        }
                      } catch (error) {
                        console.error("Error al actualizar lastUsersCheck en logout:", error);
                        // Continuar con el logout aunque falle la actualización
                      }
                    }
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
    
    {/* Modal para enviar mensaje (usuarios) */}
    {sendMessageModalOpen && (
      <SendMessageModal 
        isOpen={sendMessageModalOpen} 
        onClose={() => setSendMessageModalOpen(false)}
        userName={userName}
        userEmail={authUser?.email || null}
        onMessageSent={() => {
          // NO cerrar el modal, solo actualizar el contador de mensajes
          // Recargar mensajes del usuario
          if (authUser && !isAdmin) {
            fetch(`/api/user/messages?userId=${authUser.uid}`)
              .then(res => res.json())
              .then(data => setUserMessagesCount(data.unreadRepliesCount || 0))
              .catch(err => console.error("Error al actualizar mensajes:", err));
          }
        }}
      />
    )}

    {/* Modal de Mensajes para Usuarios */}
    {!isAdmin && userMessagesModalOpen && (
      <UserMessagesModal 
        isOpen={userMessagesModalOpen} 
        onClose={() => setUserMessagesModalOpen(false)}
        userId={authUser?.uid || ""}
        onMessagesUpdate={async () => {
          // Recargar contador de mensajes inmediatamente
          if (authUser && !isAdmin) {
            try {
              const response = await fetch(`/api/user/messages?userId=${authUser.uid}`);
              if (response.ok) {
                const data = await response.json();
                setUserMessagesCount(data.unreadRepliesCount || 0);
              }
            } catch (err) {
              console.error("Error al actualizar mensajes:", err);
            }
          }
        }}
        onSendMessage={() => {
          setUserMessagesModalOpen(false);
          setSendMessageModalOpen(true);
        }}
      />
    )}

    {/* Modal de Mensajes para Admin */}
    {isAdmin && messagesModalOpen && (
      <MessagesModal 
        isOpen={messagesModalOpen} 
        onClose={() => setMessagesModalOpen(false)}
        adminUserId={authUser?.uid || ""}
        onMessagesUpdate={() => {
          // Recargar contador de mensajes
          if (authUser && isAdmin) {
            fetch(`/api/admin/messages?adminUserId=${authUser.uid}`)
              .then(res => res.json())
              .then(data => setMessagesCount(data.unreadCount || 0))
              .catch(err => console.error("Error al actualizar mensajes:", err));
          }
        }}
      />
    )}

    {/* Modal de Calendario de Gym */}
    {!isAdmin && gymCalendarModalOpen && (
      <GymCalendarModal
        isOpen={gymCalendarModalOpen}
        onClose={() => {
          setGymCalendarModalOpen(false);
          // Recargar contador cuando se cierra el modal
          loadGymDaysCount();
        }}
      />
    )}
  </>
  );
}

// Componente Modal para enviar mensaje
function SendMessageModal({ 
  isOpen, 
  onClose, 
  userName, 
  userEmail,
  onMessageSent
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  userName: string | null;
  userEmail: string | null;
  onMessageSent?: () => void;
}) {
  const { user: authUser } = useAuthStore();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authUser || !message.trim()) {
      setError("El mensaje no puede estar vacío");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/sendMessage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: authUser.uid,
          userName: userName || null,
          userEmail: userEmail || null,
          subject: subject.trim() || "Consulta",
          message: message.trim(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Error al enviar mensaje");
      }

      setSuccess(true);
      setSubject("");
      setMessage("");
      
      if (onMessageSent) {
        onMessageSent();
      }
      
      // Mostrar mensaje de éxito por 2 segundos y luego permitir enviar otro
      setTimeout(() => {
        setSuccess(false);
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al enviar mensaje");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="bg-gray-900 rounded-xl border border-white/10 p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5 text-blue-400"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            Enviar Mensaje
          </h2>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {success ? (
          <div className="text-center py-6">
            <div className="mb-4">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="h-12 w-12 text-green-400 mx-auto"
              >
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <p className="text-green-400 font-semibold">¡Mensaje enviado exitosamente!</p>
            <p className="text-white/60 text-sm mt-2 mb-4">Te responderemos pronto</p>
            <button
              onClick={() => setSuccess(false)}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white text-sm font-medium transition-all"
            >
              Enviar otro mensaje
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white/60 mb-2">
                Asunto (opcional)
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Ej: Error en el plan, Consulta sobre premium..."
                className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500"
                maxLength={100}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white/60 mb-2">
                Mensaje <span className="text-red-400">*</span>
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Escribe tu consulta, error, petición o lo que necesites..."
                rows={6}
                className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                required
                maxLength={2000}
              />
              <p className="text-white/40 text-xs mt-1 text-right">
                {message.length}/2000
              </p>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-white transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading || !message.trim()}
                className="flex-1 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Enviando..." : "Enviar"}
              </button>
            </div>
          </form>
        )}
      </motion.div>
    </div>
  );
}

// Componente Modal para ver mensajes (admin)
function MessagesModal({ 
  isOpen, 
  onClose, 
  adminUserId,
  onMessagesUpdate
}: { 
  isOpen: boolean; 
  onClose: () => void;
  adminUserId: string;
  onMessagesUpdate: () => void;
}) {
  const [messages, setMessages] = useState<Array<{
    id: string;
    userId: string;
    userName: string | null;
    userEmail: string | null;
    subject: string;
    message: string;
    read: boolean;
    replied: boolean;
    closed: boolean;
    closedAt: string | null;
    initiatedByAdmin?: boolean;
    replies: Array<{ message: string; senderName: string; senderType: string; createdAt: string | null }>;
    createdAt: string | null;
    lastReplyAt: string | null;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMessage, setSelectedMessage] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replying, setReplying] = useState(false);
  const messagesScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && adminUserId) {
      loadMessages();
    }
  }, [isOpen, adminUserId]);

  // Recargar mensajes periódicamente cuando el modal está abierto para detectar nuevas respuestas
  useEffect(() => {
    if (!isOpen || !adminUserId) return;
    
    const interval = setInterval(() => {
      loadMessages();
      onMessagesUpdate(); // Actualizar contador también
    }, 15000); // Cada 15 segundos (menos frecuente para reducir re-renders)
    
    return () => clearInterval(interval);
  }, [isOpen, adminUserId, onMessagesUpdate]);

  // Reordenar mensajes cuando cambian
  useEffect(() => {
    if (messages.length > 0) {
      const sorted = sortMessagesByDate(messages);
      // Solo actualizar si el orden cambió
      const currentIds = messages.map(m => m.id).join(',');
      const sortedIds = sorted.map(m => m.id).join(',');
      if (currentIds !== sortedIds) {
        setMessages(sorted);
      }
    }
  }, [messages.length]); // Solo cuando cambia la cantidad de mensajes

  // Hacer scroll al final cuando se selecciona un mensaje o cambian las respuestas
  useEffect(() => {
    if (selectedMessage && messagesScrollRef.current) {
      // Pequeño delay para asegurar que el DOM se haya actualizado
      setTimeout(() => {
        if (messagesScrollRef.current) {
          messagesScrollRef.current.scrollTop = messagesScrollRef.current.scrollHeight;
        }
      }, 100);
    }
  }, [selectedMessage, messages]);

  // Función para ordenar mensajes: primero no leídos, luego leídos, finalmente finalizados
  const sortMessagesByDate = (msgs: Array<{
    id: string;
    userId: string;
    userName: string | null;
    userEmail: string | null;
    subject: string;
    message: string;
    read: boolean;
    replied: boolean;
    closed: boolean;
    closedAt: string | null;
    initiatedByAdmin?: boolean;
    replies: Array<{ message: string; senderName: string; senderType: string; createdAt: string | null }>;
    createdAt: string | null;
    lastReplyAt: string | null;
  }>) => {
    return [...msgs].sort((a, b) => {
      // Primero: separar finalizados (van al final)
      if (a.closed && !b.closed) return 1;  // a va después
      if (!a.closed && b.closed) return -1; // a va primero
      
      // Si ambos están finalizados o ambos no están finalizados
      if (a.closed && b.closed) {
        // Ambos finalizados: ordenar por fecha de cierre (más reciente primero)
        const dateA = a.closedAt ? new Date(a.closedAt).getTime() : (a.lastReplyAt ? new Date(a.lastReplyAt).getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0));
        const dateB = b.closedAt ? new Date(b.closedAt).getTime() : (b.lastReplyAt ? new Date(b.lastReplyAt).getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0));
        return dateB - dateA; // Más reciente primero
      }
      
      // Si ninguno está finalizado: ordenar por no leídos primero
      const aIsUnread = !a.read;
      const bIsUnread = !b.read;
      
      if (aIsUnread && !bIsUnread) return -1; // a va primero
      if (!aIsUnread && bIsUnread) return 1;  // b va primero
      
      // Si ambos tienen el mismo estado de lectura, ordenar por fecha
      // Usar lastReplyAt si existe, sino createdAt
      const dateA = a.lastReplyAt ? new Date(a.lastReplyAt).getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
      const dateB = b.lastReplyAt ? new Date(b.lastReplyAt).getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
      // Ordenar descendente (más reciente primero)
      return dateB - dateA;
    });
  };

  const loadMessages = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/messages?adminUserId=${adminUserId}`);
      if (!response.ok) throw new Error("Error al cargar mensajes");
      const data = await response.json();
      const sortedMessages = sortMessagesByDate(data.messages || []);
      setMessages(sortedMessages);
    } catch (error) {
      console.error("Error al cargar mensajes:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (messageId: string) => {
    try {
      await fetch("/api/admin/markMessageRead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminUserId, messageId }),
      });
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, read: true } : m));
      onMessagesUpdate();
    } catch (error) {
      console.error("Error al marcar como leído:", error);
    }
  };

  // Función para hacer scroll al final después de enviar respuesta
  const scrollToBottom = () => {
    if (messagesScrollRef.current) {
      setTimeout(() => {
        if (messagesScrollRef.current) {
          messagesScrollRef.current.scrollTop = messagesScrollRef.current.scrollHeight;
        }
      }, 100);
    }
  };

  const handleReply = async (messageId: string) => {
    if (!replyText.trim()) return;

    setReplying(true);
    try {
      const response = await fetch("/api/admin/replyMessage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminUserId, messageId, reply: replyText.trim() }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Error desconocido" }));
        throw new Error(errorData.error || errorData.detail || `Error ${response.status}`);
      }

      // Actualizar el mensaje localmente primero para feedback inmediato
      setMessages(prev => {
        const updated = prev.map(m => 
          m.id === messageId 
            ? { 
                ...m, 
                replies: [...(m.replies || []), {
                  message: replyText.trim(),
                  senderName: "Equipo de FitPlan",
                  senderType: "admin",
                  createdAt: new Date().toISOString(),
                }],
                lastReplyAt: new Date().toISOString(),
                replied: true,
                read: true,
              }
            : m
        );
        return sortMessagesByDate(updated);
      });
      
      // Recargar mensajes para obtener las respuestas actualizadas del servidor
      await loadMessages();
      setReplyText("");
      onMessagesUpdate();
      // Hacer scroll al final para ver la nueva respuesta
      scrollToBottom();
    } catch (error) {
      console.error("Error al responder:", error);
      const errorMessage = error instanceof Error ? error.message : "Error al enviar respuesta";
      alert(`Error al enviar respuesta: ${errorMessage}`);
    } finally {
      setReplying(false);
    }
  };

  if (!isOpen) return null;

  const selectedMsg = selectedMessage ? messages.find(m => m.id === selectedMessage) : null;
  const unreadCount = messages.filter(m => !m.read).length;

  return (
    <div 
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="bg-gray-900 rounded-xl border border-white/10 p-3 sm:p-4 md:p-6 max-w-4xl w-full h-[90vh] sm:h-[85vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Botón atrás en móvil cuando hay mensaje seleccionado */}
            {selectedMessage && (
              <button
                onClick={() => setSelectedMessage(null)}
                className="md:hidden text-white/70 hover:text-white transition-colors mr-1"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
                  <path d="M19 12H5M12 19l-7-7 7-7"/>
                </svg>
              </button>
            )}
            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5 text-blue-400"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              Mensajes
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 text-xs rounded-full bg-red-500 text-white">
                  {unreadCount}
                </span>
              )}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white transition-colors flex-shrink-0"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5 sm:h-6 sm:w-6">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
          </div>
        ) : (
          <div className="flex-1 flex gap-2 sm:gap-4 overflow-hidden">
            {/* Lista de mensajes */}
            <div className={`${selectedMessage ? 'hidden md:block' : 'block'} w-full md:w-1/3 lg:w-1/3 border-r border-white/10 pr-2 sm:pr-4 overflow-y-auto flex-shrink-0`}>
              {messages.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-white/60">No hay mensajes</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      onClick={() => {
                        setSelectedMessage(msg.id);
                        if (!msg.read) {
                          handleMarkAsRead(msg.id);
                        }
                      }}
                      className={`p-2 sm:p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedMessage === msg.id
                          ? "bg-blue-500/20 border-blue-500/50"
                          : msg.read
                          ? "bg-white/5 border-white/10 hover:bg-white/10"
                          : "bg-blue-500/10 border-blue-500/30 hover:bg-blue-500/20"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <p className={`text-sm font-medium truncate ${msg.read ? "text-white/80" : "text-white"}`}>
                              {msg.subject}
                            </p>
                            {(() => {
                              if (msg.closed) {
                                return (
                                  <span className="px-2 py-0.5 text-xs rounded-full bg-gray-500/20 text-gray-400 border border-gray-500/30 whitespace-nowrap flex-shrink-0">
                                    Finalizado
                                  </span>
                                );
                              }
                              // Verificar si el mensaje fue iniciado por el admin
                              if (msg.initiatedByAdmin) {
                                return (
                                  <span className="px-2 py-0.5 text-xs rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 whitespace-nowrap flex-shrink-0">
                                    Enviado
                                  </span>
                                );
                              }
                              // Verificar si hay respuestas y si la última es del admin
                              const replies = msg.replies || [];
                              if (replies.length === 0) {
                                return (
                                  <span className="px-2 py-0.5 text-xs rounded-full bg-red-500/20 text-red-400 border border-red-500/30 whitespace-nowrap flex-shrink-0">
                                    Responder
                                  </span>
                                );
                              }
                              // Verificar si la última respuesta es del admin
                              const lastReply = replies[replies.length - 1];
                              const lastReplyIsAdmin = lastReply?.senderType === "admin";
                              return lastReplyIsAdmin ? (
                                <span className="px-2 py-0.5 text-xs rounded-full bg-green-500/20 text-green-400 border border-green-500/30 whitespace-nowrap flex-shrink-0">
                                  Respondido
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 text-xs rounded-full bg-red-500/20 text-red-400 border border-red-500/30 whitespace-nowrap flex-shrink-0">
                                  Responder
                                </span>
                              );
                            })()}
                          </div>
                          <p className="text-xs text-white/60 truncate mt-1">
                            {msg.userName || msg.userEmail || "Usuario"}
                          </p>
                          {msg.createdAt && (
                            <p className="text-xs text-white/40 mt-1">
                              {new Date(msg.createdAt).toLocaleDateString('es-AR', {
                                day: '2-digit',
                                month: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                          )}
                        </div>
                        {!msg.read && (
                          <div className="h-2 w-2 rounded-full bg-blue-400 flex-shrink-0 mt-1" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Detalle del mensaje */}
            <div className={`${selectedMessage ? 'block' : 'hidden md:block'} flex-1 flex flex-col min-h-0 overflow-hidden`}>
              {selectedMsg ? (
                <>
                  {/* Área de mensajes con scroll */}
                  <div ref={messagesScrollRef} className="flex-1 overflow-y-auto min-h-0 pr-2">
                    <div className="space-y-4 pb-4">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-lg font-semibold text-white">{selectedMsg.subject}</h3>
                          <div className="flex items-center gap-2">
                            {selectedMsg.closed ? (
                              <span className="px-2 py-1 text-xs rounded-full bg-gray-500/20 text-gray-400 border border-gray-500/30">
                                Chat Finalizado
                              </span>
                            ) : (
                              (() => {
                                // Verificar si hay respuestas y si la última es del admin
                                const replies = selectedMsg.replies || [];
                                if (replies.length === 0) return null;
                                const lastReply = replies[replies.length - 1];
                                const lastReplyIsAdmin = lastReply?.senderType === "admin";
                                return lastReplyIsAdmin ? (
                                  <span className="px-2 py-1 text-xs rounded-full bg-green-500/20 text-green-400 border border-green-500/30">
                                    Respondido
                                  </span>
                                ) : null;
                              })()
                            )}
                          </div>
                        </div>
                        <div className="text-sm text-white/60 space-y-1">
                          {selectedMsg.userName && (
                            <p><span className="text-white/80">De:</span> {selectedMsg.userName.charAt(0).toUpperCase() + selectedMsg.userName.slice(1).toLowerCase()}</p>
                          )}
                          {selectedMsg.userEmail && (
                            <p><span className="text-white/80">Email:</span> {selectedMsg.userEmail}</p>
                          )}
                          {selectedMsg.createdAt && (
                            <p><span className="text-white/80">Fecha:</span> {new Date(selectedMsg.createdAt).toLocaleDateString('es-AR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}</p>
                          )}
                        </div>
                      </div>

                      <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                        <div className="flex items-start gap-3">
                          {selectedMsg.userName && (
                            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-sm font-semibold text-white flex-shrink-0">
                              {selectedMsg.userName.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              {selectedMsg.userName && (
                                <p className="text-sm font-medium text-white">
                                  {selectedMsg.userName.charAt(0).toUpperCase() + selectedMsg.userName.slice(1).toLowerCase()}
                                </p>
                              )}
                            </div>
                            <p className="text-white whitespace-pre-wrap">{selectedMsg.message}</p>
                          </div>
                        </div>
                      </div>

                      {selectedMsg.replies && selectedMsg.replies.length > 0 && (
                        <div className="space-y-3">
                          <h4 className="text-sm font-semibold text-white/80">Conversación:</h4>
                          {selectedMsg.replies.map((reply, index) => {
                            const senderName = reply.senderName || (reply.senderType === "admin" ? "Equipo de FitPlan" : "Usuario");
                            const senderInitial = senderName.charAt(0).toUpperCase();
                            const replyDate = reply.createdAt ? new Date(reply.createdAt) : null;
                            const isAdminReply = reply.senderType === "admin";
                            
                            return (
                              <div key={index} className={`p-4 rounded-lg border ${
                                isAdminReply 
                                  ? "bg-green-500/10 border-green-500/30" 
                                  : "bg-blue-500/10 border-blue-500/30"
                              }`}>
                                <div className="flex items-start gap-3 mb-3">
                                  <div className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-semibold text-white flex-shrink-0 ${
                                    isAdminReply
                                      ? "bg-gradient-to-br from-emerald-500 to-cyan-500"
                                      : "bg-gradient-to-br from-blue-500 to-cyan-500"
                                  }`}>
                                    {senderInitial}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <p className={`text-sm font-medium ${isAdminReply ? "text-green-400" : "text-blue-400"}`}>
                                        {senderName}
                                      </p>
                                      {replyDate && (
                                        <span className="text-xs text-white/60">
                                          {replyDate.toLocaleDateString('es-AR', {
                                            day: '2-digit',
                                            month: '2-digit',
                                            year: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                          })}
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-white/90 whitespace-pre-wrap">{reply.message}</p>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Mensaje de finalización */}
                      {selectedMsg.closed && selectedMsg.closedAt && (
                        <div className="mt-4 p-3 rounded-lg bg-gray-500/10 border border-gray-500/30 text-center">
                          <p className="text-xs text-gray-400">
                            Chat finalizado el {new Date(selectedMsg.closedAt).toLocaleDateString('es-AR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Área de respuesta fija (footer) */}
                  <div className="border-t border-white/10 pt-4 mt-4 flex-shrink-0 bg-gray-900">
                    {selectedMsg.closed ? (
                      <div className="p-4 rounded-lg bg-gray-500/10 border border-gray-500/30 text-center">
                        <p className="text-gray-400 text-sm">Este chat ha sido finalizado</p>
                        <p className="text-gray-500 text-xs mt-1">No se pueden enviar más mensajes</p>
                      </div>
                    ) : (
                      <div className="space-y-2 sm:space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                          <label className="block text-xs sm:text-sm font-medium text-white/60">
                            {selectedMsg.replied ? "Agregar otra respuesta" : "Responder"}
                          </label>
                          <button
                            onClick={async () => {
                              if (!selectedMsg || !confirm("¿Estás seguro de que deseas finalizar este chat? No se podrán enviar más mensajes.")) {
                                return;
                              }
                              
                              try {
                                const response = await fetch("/api/admin/closeChat", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({
                                    adminUserId,
                                    messageId: selectedMsg.id,
                                  }),
                                });

                                if (!response.ok) {
                                  const errorData = await response.json();
                                  throw new Error(errorData.error || "Error al finalizar chat");
                                }

                                // Recargar mensajes para ver el estado actualizado
                                await loadMessages();
                                onMessagesUpdate();
                              } catch (error) {
                                console.error("Error al finalizar chat:", error);
                                alert(error instanceof Error ? error.message : "Error al finalizar chat");
                              }
                            }}
                            className="px-3 py-1.5 text-xs rounded-lg bg-gray-500/20 hover:bg-gray-500/30 text-gray-300 border border-gray-500/30 transition-all w-full sm:w-auto"
                          >
                            Finalizar Chat
                          </button>
                        </div>
                        <textarea
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder="Escribe tu respuesta..."
                          rows={3}
                          className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                        />
                        <button
                          onClick={() => handleReply(selectedMsg.id)}
                          disabled={replying || !replyText.trim()}
                          className="w-full px-4 py-2.5 sm:py-2 text-sm sm:text-base rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {replying ? "Enviando..." : selectedMsg.replied ? "Agregar Respuesta" : "Enviar Respuesta"}
                        </button>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-white/60">Selecciona un mensaje para ver los detalles</p>
                </div>
              )}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}

