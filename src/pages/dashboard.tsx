import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import { useAuthStore } from "@/store/authStore";
import { usePlanStore } from "@/store/planStore";
import { getDbSafe, getAuthSafe } from "@/lib/firebase";
import { collection, query, where, getDocs, limit, Timestamp, doc, deleteDoc, updateDoc, serverTimestamp, getDoc } from "firebase/firestore";
import Navbar from "@/components/Navbar";
import PremiumPlanModal from "@/components/PremiumPlanModal";

interface RegistroPeso {
  fecha: string;
  peso: number;
  timestamp?: Timestamp | Date | { seconds: number; nanoseconds?: number } | number | null;
}

interface PlanMultiFaseData {
  pesoInicial: number;
  pesoObjetivoFinal: number;
  mesActual: number;
  totalMeses: number;
  faseActual: "BULK" | "CUT" | "LEAN_BULK" | "MANTENIMIENTO";
  pesoMetaEsteMes: number;
  fases?: Array<{
    nombre: string;
    meses: number[];
    objetivoFase: string;
    pesoInicio: number;
    pesoFin: number;
  }>;
}

interface SavedPlan {
  id: string;
  userId: string;
  plan: {
    plan: Record<string, unknown>;
    user: Record<string, unknown>;
  };
  planMultiFase?: PlanMultiFaseData; // Al mismo nivel que plan (así se guarda en Firebase)
  createdAt: Timestamp;
  isOldest?: boolean;
}

export default function Dashboard() {
  const router = useRouter();
  const { user: authUser, loading: authLoading } = useAuthStore();
  const { setPlan, setUser, setPlanId } = usePlanStore();
  const [plans, setPlans] = useState<SavedPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [planToDelete, setPlanToDelete] = useState<SavedPlan | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [progressModalOpen, setProgressModalOpen] = useState(false);
  const [planForProgress, setPlanForProgress] = useState<SavedPlan | null>(null);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [premiumModalOpen, setPremiumModalOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!authLoading && !authUser) {
      router.push("/");
      return;
    }

    if (authUser) {
      loadPlans();
      checkPremiumStatus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser, authLoading, router]);

  const checkPremiumStatus = async () => {
    if (!authUser) return;
    
    try {
      const db = getDbSafe();
      const auth = getAuthSafe();
      if (!db || !auth?.currentUser) return;

      const userRef = doc(db, "usuarios", auth.currentUser.uid);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setIsPremium(userData.premium === true);
      }
    } catch (error) {
      console.error("Error al verificar estado premium:", error);
    }
  };

  const loadPlans = async () => {
    try {
      const db = getDbSafe();
      const auth = getAuthSafe();
      if (!db || !auth?.currentUser) {
        setError("Firebase no configurado");
        setLoading(false);
        return;
      }

      // Primero obtener todos los planes del usuario sin ordenar
      const q = query(
        collection(db, "planes"),
        where("userId", "==", auth.currentUser.uid),
        limit(50) // Aumentamos el límite y ordenamos en memoria si es necesario
      );

      const querySnapshot = await getDocs(q);
      const plansData: SavedPlan[] = [];
      
      // Verificar y guardar snapshots mensuales para planes que cumplieron 30 días
      const now = new Date();
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const createdAt = data.createdAt;
        
        if (createdAt) {
          let createdDate: Date;
          if (createdAt.toDate) {
            createdDate = createdAt.toDate();
          } else if (createdAt.seconds) {
            createdDate = new Date(createdAt.seconds * 1000);
          } else {
            createdDate = new Date(createdAt);
          }
          
          const diffTime = now.getTime() - createdDate.getTime();
          const diffDays = diffTime / (1000 * 60 * 60 * 24);
          
          // Si el plan tiene 30 días o más, guardar snapshot mensual (solo una vez)
          if (diffDays >= 30) {
            const monthYear = `${createdDate.getFullYear()}-${String(createdDate.getMonth() + 1).padStart(2, '0')}`;
            
            // Verificar si ya existe snapshot para este mes
            if (auth.currentUser) {
              const historyRef = collection(db, "historial_mensual", auth.currentUser.uid, "meses");
              const historyQuery = query(historyRef, where("snapshotMonth", "==", monthYear), limit(1));
              
              getDocs(historyQuery).then((historySnapshot) => {
                if (historySnapshot.empty) {
                  // No existe snapshot, guardarlo
                  fetch("/api/saveMonthlySnapshot", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      userId: auth.currentUser?.uid,
                      planId: doc.id,
                      planData: data.plan?.plan || {},
                      userData: data.plan?.user || {},
                    }),
                  }).catch((err) => {
                    console.error("Error al guardar snapshot mensual:", err);
                  });
                }
              }).catch((err) => {
                console.error("Error al verificar snapshot existente:", err);
              });
            }
          }
        }
      });
      
      querySnapshot.forEach((doc) => {
        plansData.push({
          id: doc.id,
          ...doc.data(),
        } as SavedPlan);
      });

      // Ordenar por fecha de creación en memoria (más reciente primero)
      plansData.sort((a, b) => {
        const aTime = a.createdAt?.toMillis?.() || a.createdAt?.seconds || 0;
        const bTime = b.createdAt?.toMillis?.() || b.createdAt?.seconds || 0;
        return bTime - aTime; // Orden descendente
      });

      // Limitar a 20 después de ordenar
      const limitedPlans = plansData.slice(0, 20);
      
      // Identificar el plan más antiguo (último en el array ordenado descendentemente)
      const oldestPlanId = limitedPlans.length > 0 ? limitedPlans[limitedPlans.length - 1].id : null;
      
      // Guardar el ID del plan más antiguo para usarlo en el render
      setPlans(limitedPlans.map(p => ({ ...p, isOldest: p.id === oldestPlanId })));
      setError(null);
    } catch (err: unknown) {
      console.error("Error al cargar planes:", err);
      setError("Error al cargar tus planes guardados");
    } finally {
      setLoading(false);
    }
  };

  const handlePlanClick = (plan: SavedPlan) => {
    // Cargar el plan en el store y navegar a la vista del plan
    setUser(plan.plan.user as unknown as Parameters<typeof setUser>[0]);
    setPlan(plan.plan.plan as unknown as Parameters<typeof setPlan>[0]);
    setPlanId(plan.id); // Guardar el ID del plan para poder actualizarlo después
    router.push("/plan");
  };

  const handleCreateNew = () => {
    router.push("/create-plan");
  };

  const handleDeleteClick = (e: React.MouseEvent, plan: SavedPlan) => {
    e.stopPropagation(); // Evitar que se active el onClick del card
    
    // Prevenir eliminar el Plan Base solo si NO es premium
    if (plan.isOldest && !isPremium) {
      alert("El Plan Base no se puede eliminar. Es tu plan principal y debe permanecer en tu cuenta. Actualiza a Premium para tener control total sobre todos tus planes.");
      return;
    }
    
    setPlanToDelete(plan);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!planToDelete) return;

    // Validación de seguridad: no permitir eliminar el Plan Base solo si NO es premium
    if (planToDelete.isOldest && !isPremium) {
      alert("El Plan Base no se puede eliminar. Es tu plan principal y debe permanecer en tu cuenta. Actualiza a Premium para tener control total sobre todos tus planes.");
      setDeleteModalOpen(false);
      setPlanToDelete(null);
      return;
    }

    setDeleting(true);
    try {
      const db = getDbSafe();
      const auth = getAuthSafe();
      
      if (!db || !auth?.currentUser) {
        throw new Error("Firebase no configurado");
      }

      // Eliminar el plan de Firestore
      const planRef = doc(db, "planes", planToDelete.id);
      await deleteDoc(planRef);

      // Actualizar la lista de planes
      setPlans(plans.filter((p) => p.id !== planToDelete.id));
      
      // Cerrar el modal
      setDeleteModalOpen(false);
      setPlanToDelete(null);
      setError(null);
    } catch (err: unknown) {
      console.error("Error al eliminar plan:", err);
      setError("No se pudo eliminar el plan. Por favor intenta de nuevo.");
    } finally {
      setDeleting(false);
    }
  };

  const handleCancelDelete = () => {
    setDeleteModalOpen(false);
    setPlanToDelete(null);
  };

  // Calcular progreso del plan (0-100%) basado en días desde creación hasta 30 días
  // Usa horas en lugar de días completos para mayor precisión
  const calculateProgress = (createdAt: Timestamp | undefined): number => {
    if (!createdAt) return 0;
    
    const createdDate = createdAt.toDate?.() || new Date(createdAt.seconds * 1000);
    const now = new Date();
    const diffTime = now.getTime() - createdDate.getTime();
    
    // Calcular en horas para mayor precisión (evitar que el primer día muestre 0%)
    const diffHours = diffTime / (1000 * 60 * 60);
    const diffDays = diffHours / 24; // Días con decimales para precisión
    
    // El plan dura 30 días (1 mes)
    const totalDays = 30;
    const progress = Math.min(100, Math.max(0, (diffDays / totalDays) * 100));
    
    return Math.round(progress * 10) / 10; // Redondear a 1 decimal para mostrar progreso incluso el primer día
  };

  // Calcular días restantes del plan
  const calculateDaysRemaining = (createdAt: Timestamp | undefined): number => {
    if (!createdAt) return 30;
    
    const createdDate = createdAt.toDate?.() || new Date(createdAt.seconds * 1000);
    const now = new Date();
    const diffTime = now.getTime() - createdDate.getTime();
    
    // Calcular en horas para mayor precisión
    const diffHours = diffTime / (1000 * 60 * 60);
    const diffDays = diffHours / 24; // Días con decimales
    
    const remaining = 30 - diffDays;
    return Math.max(0, Math.ceil(remaining)); // Redondear hacia arriba para mostrar días completos restantes
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="opacity-70">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!authUser) {
    return null; // Será redirigido
  }

  return (
    <div className="min-h-screen overflow-x-hidden max-w-full">
      <Navbar />
      <div className="px-3 py-4 sm:px-4 sm:py-8 md:px-8 max-w-full overflow-x-hidden">
        <div className="mx-auto max-w-6xl w-full">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass rounded-xl sm:rounded-2xl p-4 sm:p-6 md:p-8 w-full overflow-x-hidden"
          >
            <div className="mb-4 sm:mb-6">
              <div className="mb-4 sm:mb-6">
                <h1 className="text-2xl sm:text-3xl font-bold mb-1 sm:mb-2">Mi Dashboard</h1>
                <p className="text-sm sm:text-base opacity-70">Gestiona tus planes nutricionales guardados</p>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
                {!isPremium && (
                  <button
                    onClick={() => {
                      if (!authUser) {
                        alert("Debes estar registrado para acceder al plan Premium");
                        return;
                      }
                      setPremiumModalOpen(true);
                    }}
                    disabled={processingPayment}
                    className="flex-1 sm:flex-none px-4 py-2.5 sm:px-6 sm:py-3 rounded-lg sm:rounded-xl bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white text-sm sm:text-base font-medium transition-all shadow-lg shadow-yellow-500/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0"
                    >
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                    <span className="truncate">Ser Premium</span>
                  </button>
                )}
                {(!isPremium && plans.length >= 1) ? (
                  <div className="relative group flex-1 sm:flex-none">
                    <button
                      disabled
                      className="w-full sm:w-auto px-4 py-2.5 sm:px-6 sm:py-3 rounded-lg sm:rounded-xl bg-white/5 border border-white/10 text-white/50 text-sm sm:text-base font-medium cursor-not-allowed opacity-50"
                    >
                      + Nuevo Plan
                    </button>
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1.5 sm:px-3 sm:py-2 rounded-lg bg-yellow-500/20 border border-yellow-500/30 text-yellow-300 text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                      Ya tienes 1 plan. Actualiza a Premium para crear planes ilimitados
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={handleCreateNew}
                    className="flex-1 sm:flex-none px-4 py-2.5 sm:px-6 sm:py-3 rounded-lg sm:rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white text-sm sm:text-base font-medium transition-all shadow-lg shadow-blue-500/20"
                  >
                    + Nuevo Plan
                  </button>
                )}
              </div>
            </div>

            {error && (
              <div className="mb-6 p-4 rounded-xl bg-red-500/20 border border-red-500/30 text-red-300">
                {error}
              </div>
            )}

            {plans.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">📋</div>
                <h2 className="text-xl font-semibold mb-2">No tienes planes guardados</h2>
                <p className="opacity-70 mb-6">Crea tu primer plan nutricional personalizado</p>
                <button
                  onClick={handleCreateNew}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-medium transition-all shadow-lg shadow-blue-500/20"
                >
                  Crear mi primer plan
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {plans.map((plan) => (
                  <motion.div
                    key={plan.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileHover={{ scale: 1.02 }}
                    onClick={() => handlePlanClick(plan)}
                    className="relative cursor-pointer rounded-lg sm:rounded-xl border border-white/10 bg-white/5 p-4 sm:p-6 hover:bg-white/10 transition-all shadow-lg hover:shadow-xl"
                  >
                    <div className="absolute top-3 right-3 sm:top-4 sm:right-4 flex items-center gap-1.5 sm:gap-2 z-10">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setPlanForProgress(plan);
                          setProgressModalOpen(true);
                        }}
                        className="p-1.5 sm:p-2 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 text-blue-400 hover:text-blue-300 transition-colors"
                        title="Ver progreso"
                        aria-label="Ver progreso"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="h-4 w-4 sm:h-5 sm:w-5"
                        >
                          <line x1="18" y1="20" x2="18" y2="10" />
                          <line x1="12" y1="20" x2="12" y2="4" />
                          <line x1="6" y1="20" x2="6" y2="14" />
                        </svg>
                      </button>
                      {isPremium && (
                        <button
                          onClick={(e) => handleDeleteClick(e, plan)}
                          className="p-1.5 sm:p-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 hover:text-red-300 transition-colors"
                          title="Eliminar plan"
                          aria-label="Eliminar plan"
                        >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="h-4 w-4 sm:h-5 sm:w-5"
                        >
                          <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          <line x1="10" y1="11" x2="10" y2="17" />
                          <line x1="14" y1="11" x2="14" y2="17" />
                        </svg>
                      </button>
                      )}
                    </div>
                    <div className="mb-3 sm:mb-4 pr-16 sm:pr-20">
                      <h3 className="font-semibold text-base sm:text-lg mb-1 sm:mb-2">
                        {plan.isOldest 
                          ? "Plan Base"
                          : plan.plan?.user?.objetivo === "perder_grasa"
                          ? "Plan: Perder Grasa"
                          : plan.plan?.user?.objetivo === "mantener"
                          ? "Plan: Mantener Peso"
                          : plan.plan?.user?.objetivo === "ganar_masa"
                          ? "Plan: Ganar Masa"
                          : plan.plan?.user?.objetivo === "recomposicion"
                          ? "Plan: Recomposición"
                          : plan.plan?.user?.objetivo === "definicion"
                          ? "Plan: Definición"
                          : plan.plan?.user?.objetivo === "volumen"
                          ? "Plan: Volumen"
                          : plan.plan?.user?.objetivo === "corte"
                          ? "Plan: Corte"
                          : plan.plan?.user?.objetivo === "mantenimiento_avanzado"
                          ? "Plan: Mantenimiento Avanzado"
                          : plan.plan?.user?.objetivo === "bulk_cut"
                          ? "Plan: Bulk + Cut"
                          : plan.plan?.user?.objetivo === "lean_bulk"
                          ? "Plan: Lean Bulk"
                          : plan.plan?.user?.objetivo === "rendimiento_deportivo"
                          ? "Plan: Rendimiento Deportivo"
                          : plan.plan?.user?.objetivo === "powerlifting"
                          ? "Plan: Powerlifting"
                          : plan.plan?.user?.objetivo === "resistencia"
                          ? "Plan: Resistencia"
                          : plan.plan?.user?.objetivo === "atleta_elite"
                          ? "Plan: Atleta Elite"
                          : String(plan.plan?.user?.nombre || "Plan sin nombre")}
                      </h3>
                      <div className="flex flex-wrap gap-2 items-center">
                        {/* Badge de fase para planes multi-fase */}
                        {plan.planMultiFase && (
                          <div
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border"
                            style={{
                              backgroundColor: plan.planMultiFase.faseActual === 'BULK' 
                                ? 'rgba(245,158,11,0.15)' 
                                : plan.planMultiFase.faseActual === 'CUT' 
                                ? 'rgba(6,182,212,0.15)' 
                                : plan.planMultiFase.faseActual === 'LEAN_BULK'
                                ? 'rgba(16,185,129,0.15)'
                                : 'rgba(139,92,246,0.15)',
                              borderColor: plan.planMultiFase.faseActual === 'BULK' 
                                ? 'rgba(245,158,11,0.4)' 
                                : plan.planMultiFase.faseActual === 'CUT' 
                                ? 'rgba(6,182,212,0.4)' 
                                : plan.planMultiFase.faseActual === 'LEAN_BULK'
                                ? 'rgba(16,185,129,0.4)'
                                : 'rgba(139,92,246,0.4)'
                            }}
                          >
                            <span 
                              className="text-xs font-semibold"
                              style={{
                                color: plan.planMultiFase.faseActual === 'BULK' 
                                  ? '#fcd34d' 
                                  : plan.planMultiFase.faseActual === 'CUT' 
                                  ? '#67e8f9' 
                                  : plan.planMultiFase.faseActual === 'LEAN_BULK'
                                  ? '#6ee7b7'
                                  : '#c4b5fd'
                              }}
                            >
                              {plan.planMultiFase.faseActual === 'BULK' && '🏋️'}
                              {plan.planMultiFase.faseActual === 'CUT' && '✂️'}
                              {plan.planMultiFase.faseActual === 'LEAN_BULK' && '💎'}
                              {plan.planMultiFase.faseActual === 'MANTENIMIENTO' && '⚖️'}
                              {' '}Mes {plan.planMultiFase.mesActual || 1}/{plan.planMultiFase.totalMeses || 1}
                            </span>
                          </div>
                        )}
                        
                        {/* Badge de dificultad */}
                        {(() => {
                          const dificultad = plan.plan?.plan?.dificultad;
                          return dificultad && String(dificultad) ? true : false;
                        })() && (
                          <div
                            className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md border"
                            style={{
                              backgroundColor: 'rgba(255,255,255,0.05)',
                              borderColor: plan.plan.plan.dificultad === 'dificil' ? 'rgba(248,113,113,0.4)' : plan.plan.plan.dificultad === 'media' ? 'rgba(250,204,21,0.4)' : 'rgba(52,211,153,0.4)'
                            }}
                          >
                            <span className="text-[11px] opacity-70">Dificultad</span>
                            <span
                              className="text-xs font-medium capitalize"
                              style={{
                                color: plan.plan.plan.dificultad === 'dificil' ? '#fecaca' : plan.plan.plan.dificultad === 'media' ? '#fde68a' : '#a7f3d0'
                              }}
                            >
                              {String(plan.plan.plan.dificultad || "")}
                            </span>
                          </div>
                        )}
                      </div>
                      <p className="text-xs sm:text-sm opacity-70 mt-3 font-small">
                        Creación: {(() => {
                          const d = plan.createdAt?.toDate?.() || (plan.createdAt?.seconds ? new Date(plan.createdAt.seconds * 1000) : null);
                          if (!d || isNaN(d.getTime())) return "Fecha no disponible";
                          const dd = String(d.getDate()).padStart(2, '0');
                          const mm = String(d.getMonth() + 1).padStart(2, '0');
                          const yyyy = d.getFullYear();
                          return `${dd}/${mm}/${yyyy}`;
                        })()}
                      </p>
                    </div>
                    <div className="space-y-2 sm:space-y-2.5 mb-3 sm:mb-4">
                      <div className="flex items-center gap-2 text-xs sm:text-sm">
                        <span className="opacity-60 min-w-[55px] sm:min-w-[70px] flex-shrink-0">Objetivo:</span>
                        <span className="font-medium">
                          {(() => {
                            const obj = plan.plan?.user?.objetivo as string | undefined;
                            if (!obj) return "N/A";
                            // Mapeos conocidos con capitalización adecuada
                            const map: Record<string, string> = {
                              perder_grasa: "Perder grasa",
                              mantener: "Mantener peso",
                              ganar_masa: "Ganar masa",
                              recomposicion: "Recomposición",
                              definicion: "Definición",
                              volumen: "Volumen",
                              corte: "Corte",
                              mantenimiento_avanzado: "Mantenimiento avanzado",
                              bulk_cut: "Bulk + Cut",
                              lean_bulk: "Lean Bulk",
                              rendimiento_deportivo: "Rendimiento Deportivo",
                              powerlifting: "Powerlifting",
                              resistencia: "Resistencia",
                              atleta_elite: "Atleta Elite",
                            };
                            if (map[obj]) return map[obj];
                            // Fallback: reemplazar guiones bajos y capitalizar primera letra
                            const pretty = obj.replace(/_/g, " ");
                            return pretty.charAt(0).toUpperCase() + pretty.slice(1);
                          })()}
                        </span>
                      </div>
                      {(() => {
                        const lesiones = (plan.plan?.user?.doloresLesiones as string[] | undefined)?.filter(
                          (s) => typeof s === "string" && s.trim().length > 0
                        );
                        return lesiones && lesiones.length > 0
                          ? (
                            <div className="flex items-center gap-2 text-xs sm:text-sm text-cyan-100">
                              <div className="relative group flex-shrink-0">
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  viewBox="0 0 24 24"
                                  fill="currentColor"
                                  className="h-4 w-4 opacity-80 text-cyan-200"
                                >
                                  <path d="M12 2a10 10 0 1 0 10 10A10.011 10.011 0 0 0 12 2Zm.75 15h-1.5v-1.5h1.5Zm1.971-6.279-.675.693A3.375 3.375 0 0 0 12.75 14.25h-1.5a4.875 4.875 0 0 1 1.425-3.45l.93-.936a1.875 1.875 0 1 0-3.195-1.326h-1.5a3.375 3.375 0 1 1 6.03 1.283Z" />
                                </svg>
                                <div className="pointer-events-none absolute left-1/2 top-full z-40 mt-2 w-60 -translate-x-1/2 rounded-lg border border-cyan-500/40 bg-black/90 px-3 py-2 text-[10px] sm:text-xs text-cyan-50 opacity-0 shadow-lg transition-opacity duration-200 group-hover:opacity-100">
                                  Plan adaptado para:{" "}
                                  <span className="font-medium">
                                    {lesiones.join(", ")}
                                  </span>
                                </div>
                              </div>
                              <span className="opacity-80">
                                Adaptado para:{" "}
                                <span className="font-medium text-cyan-100">
                                  {lesiones.join(", ")}
                                </span>
                              </span>
                            </div>
                          )
                          : null;
                      })()}
                      {(() => {
                        const peso = plan.plan?.user?.pesoKg;
                        return peso !== undefined && peso !== null && peso !== 0;
                      })() && (
                        <div className="flex items-center gap-2 text-xs sm:text-sm">
                          <span className="opacity-60 min-w-[55px] sm:min-w-[70px] flex-shrink-0">Peso:</span>
                          <span className="font-medium">
                            {String(plan.plan.user.pesoKg)} kg
                            {(() => {
                              const objetivo = plan.plan?.user?.objetivo;
                              return Boolean(objetivo && String(objetivo) !== "mantener" && String(objetivo) !== "mantenimiento_avanzado");
                            })() ? (
                              <span className="ml-2 opacity-70">
                                → {
                                  (() => {
                                    const pesoKg = typeof plan.plan.user.pesoKg === 'number' ? plan.plan.user.pesoKg : Number(plan.plan.user.pesoKg) || 0;
                                    const objetivo = String(plan.plan.user.objetivo || "");
                                    
                                    // Para planes multi-fase, usar el peso objetivo del planMultiFase
                                    if (objetivo === "bulk_cut" || objetivo === "lean_bulk") {
                                      const pesoObjetivo = plan.planMultiFase?.pesoObjetivoFinal 
                                        || (plan.plan?.user as Record<string, unknown>)?.pesoObjetivoKg;
                                      if (pesoObjetivo) return `${pesoObjetivo} kg`;
                                      // Fallback si no hay pesoObjetivo guardado
                                      return objetivo === "bulk_cut" 
                                        ? `${Math.round(pesoKg * 1.1)} kg` 
                                        : `${Math.round(pesoKg * 1.08)} kg`;
                                    }
                                    
                                    // Objetivos de pérdida
                                    if (objetivo === "perder_grasa") return `${Math.max(1, Math.round(pesoKg * 0.95))} kg`;
                                    if (objetivo === "definicion") return `${Math.max(1, Math.round(pesoKg * 0.92))} kg`;
                                    if (objetivo === "corte") return `${Math.max(1, Math.round(pesoKg * 0.90))} kg`;
                                    
                                    // Objetivos de ganancia
                                    if (objetivo === "ganar_masa") return `${Math.round(pesoKg * 1.05)} kg`;
                                    if (objetivo === "volumen") return `${Math.round(pesoKg * 1.08)} kg`;
                                    if (objetivo === "powerlifting") return `${Math.round(pesoKg * 1.1)} kg`;
                                    
                                    // Objetivos atléticos (mantienen peso similar)
                                    if (objetivo === "rendimiento_deportivo") return `${pesoKg} kg`;
                                    if (objetivo === "atleta_elite") return `${pesoKg} kg`;
                                    if (objetivo === "resistencia") return `${Math.round(pesoKg * 0.98)} kg`;
                                    
                                    // Recomposición (peso similar)
                                    if (objetivo === "recomposicion") return `${pesoKg} kg`;
                                    
                                    return `${pesoKg} kg`;
                                  })()
                                }
                              </span>
                            ) : null}
                          </span>
                        </div>
                      )}
                      {(() => {
                        const calorias = plan.plan?.plan?.calorias_diarias;
                        return calorias && String(calorias) ? true : false;
                      })() && (
                        <div className="flex items-center gap-2 text-xs sm:text-sm">
                          <span className="opacity-60 min-w-[55px] sm:min-w-[70px] flex-shrink-0">Calorías:</span>
                          <span className="font-medium">{String(plan.plan.plan.calorias_diarias)} kcal</span>
                        </div>
                      )}
                    </div>
                    
                    {/* Sección de Fases para planes multi-fase (bulk_cut, lean_bulk) */}
                    {plan.planMultiFase && (
                      <div className="mt-4 pt-4 border-t border-white/10">
                        {(() => {
                          const pmf = plan.planMultiFase;
                          const faseActual = pmf.faseActual;
                          const mesActual = pmf.mesActual || 1;
                          const totalMeses = pmf.totalMeses || 1;
                          const progresoTotal = Math.round((mesActual / totalMeses) * 100);
                          
                          // Colores según fase
                          const faseColors: Record<string, { bg: string; text: string; border: string; gradient: string }> = {
                            BULK: { bg: "bg-amber-500/20", text: "text-amber-300", border: "border-amber-500/40", gradient: "linear-gradient(90deg, #f59e0b, #fbbf24)" },
                            CUT: { bg: "bg-cyan-500/20", text: "text-cyan-300", border: "border-cyan-500/40", gradient: "linear-gradient(90deg, #06b6d4, #22d3ee)" },
                            LEAN_BULK: { bg: "bg-emerald-500/20", text: "text-emerald-300", border: "border-emerald-500/40", gradient: "linear-gradient(90deg, #10b981, #34d399)" },
                            MANTENIMIENTO: { bg: "bg-purple-500/20", text: "text-purple-300", border: "border-purple-500/40", gradient: "linear-gradient(90deg, #8b5cf6, #a78bfa)" },
                          };
                          const colors = faseColors[faseActual] || faseColors.MANTENIMIENTO;
                          
                          // Texto de fase
                          const faseTexto: Record<string, string> = {
                            BULK: "🏋️ Fase BULK",
                            CUT: "✂️ Fase CUT",
                            LEAN_BULK: "💎 Lean Bulk",
                            MANTENIMIENTO: "⚖️ Mantenimiento",
                          };
                          
                          return (
                            <div className="space-y-3">
                              {/* Badge de fase actual */}
                              <div className="flex items-center justify-between">
                                <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg ${colors.bg} border ${colors.border}`}>
                                  <span className={`text-sm font-semibold ${colors.text}`}>
                                    {faseTexto[faseActual] || faseActual}
                                  </span>
                                </div>
                                <div className="text-right">
                                  <span className="text-xs opacity-60">Mes </span>
                                  <span className="text-sm font-bold">{mesActual}</span>
                                  <span className="text-xs opacity-60"> de </span>
                                  <span className="text-sm font-bold">{totalMeses}</span>
                                </div>
                              </div>
                              
                            </div>
                          );
                        })()}
                      </div>
                    )}
                    
                    {/* Barra de progreso del mes (días restantes) */}
                    <div className="mt-4 pt-4 border-t border-white/10">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs opacity-60">Progreso del plan</span>
                        <span className="text-xs font-medium">{calculateProgress(plan.createdAt).toFixed(1)}%</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${calculateProgress(plan.createdAt)}%`,
                            background: "linear-gradient(90deg, var(--brand-start), var(--brand-mid), var(--brand-end))",
                          }}
                        />
                      </div>
                      <p className="text-xs opacity-50 mt-1">
                        {calculateProgress(plan.createdAt) >= 100 
                          ? "Plan completado" 
                          : `${calculateDaysRemaining(plan.createdAt)} día${calculateDaysRemaining(plan.createdAt) !== 1 ? 's' : ''} restante${calculateDaysRemaining(plan.createdAt) !== 1 ? 's' : ''}`}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      </div>

      {/* Modal de confirmación para eliminar */}
      {mounted && createPortal(
        <AnimatePresence>
          {deleteModalOpen && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={handleCancelDelete}
                className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999]"
              />
              
              {/* Modal */}
              <div 
                className="pointer-events-none fixed inset-0 z-[10000] flex items-center justify-center p-4"
              >
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  onClick={(e) => e.stopPropagation()}
                  className="pointer-events-auto w-full max-w-md rounded-xl border border-white/10 bg-black/95 p-6 shadow-2xl"
                >
                  <div className="mb-4">
                    <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-500/20 mb-4 mx-auto">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-6 w-6 text-red-400"
                      >
                        <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </div>
                    <h2 className="text-xl font-semibold mb-2 text-center">
                      ¿Eliminar plan?
                    </h2>
                    <p className="text-sm opacity-70 text-center">
                      Esta acción no se puede deshacer. El plan será eliminado permanentemente.
                    </p>
                  </div>

                  <div className="flex gap-3 mt-6">
                    <button
                      onClick={handleCancelDelete}
                      disabled={deleting}
                      className="flex-1 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleConfirmDelete}
                      disabled={deleting}
                      className="flex-1 px-4 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 hover:text-red-300 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {deleting ? "Eliminando..." : "Eliminar"}
                    </button>
                  </div>
                </motion.div>
              </div>
            </>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Modal de seguimiento de progreso */}
      {mounted && createPortal(
        <AnimatePresence>
          {progressModalOpen && planForProgress && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setProgressModalOpen(false)}
                className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999]"
              />
              
              {/* Modal */}
              <div 
                className="pointer-events-none fixed inset-0 z-[10000] flex items-center justify-center p-4"
              >
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  onClick={(e) => e.stopPropagation()}
                  className="pointer-events-auto w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-xl border border-white/10 bg-black/95 p-6 shadow-2xl"
                >
                  <ProgressModalContent 
                    plan={planForProgress}
                    onClose={() => setProgressModalOpen(false)}
                  />
                </motion.div>
              </div>
            </>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Modal de selección de plan premium */}
      {premiumModalOpen && authUser && (
        <PremiumPlanModal
          isOpen={premiumModalOpen}
          onClose={() => setPremiumModalOpen(false)}
          userId={authUser.uid}
          userEmail={authUser.email || ""}
        />
      )}
    </div>
  );
}

// Componente para el contenido del modal de progreso
// Helper global para convertir timestamp a Date
const getTimestampDateHelper = (ts: RegistroPeso['timestamp']): Date | null => {
  if (!ts) return null;
  if (ts instanceof Date) return ts;
  if (typeof ts === 'number') return new Date(ts);
  if (typeof ts === 'object' && 'toDate' in ts && typeof ts.toDate === 'function') {
    return ts.toDate();
  }
  if (typeof ts === 'object' && 'seconds' in ts && typeof ts.seconds === 'number') {
    return new Date(ts.seconds * 1000);
  }
  return null;
};

function ProgressModalContent({ plan, onClose }: { plan: SavedPlan; onClose: () => void }) {
  const user = plan.plan?.user;
  const planData = plan.plan?.plan;
  const planId = plan.id;
  
  const [registrosPeso, setRegistrosPeso] = useState<RegistroPeso[]>([]);
  const [nuevoPeso, setNuevoPeso] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mostrarConfirmacion, setMostrarConfirmacion] = useState(false);
  const [registroAEliminar, setRegistroAEliminar] = useState<RegistroPeso | null>(null);
  const [eliminando, setEliminando] = useState(false);
  
  // Cargar registros de peso desde Firestore
  useEffect(() => {
    const loadRegistrosPeso = async () => {
      if (!planId) {
        setLoading(false);
        return;
      }
      
      // Función auxiliar para obtener fecha local en formato YYYY-MM-DD
      const obtenerFechaLocal = (date: Date): string => {
        const año = date.getFullYear();
        const mes = String(date.getMonth() + 1).padStart(2, '0');
        const dia = String(date.getDate()).padStart(2, '0');
        return `${año}-${mes}-${dia}`;
      };

      // Función para limpiar duplicados, manteniendo el más reciente por fecha
      const limpiarDuplicados = (registros: RegistroPeso[]): RegistroPeso[] => {
        const registrosUnicos = new Map<string, RegistroPeso>();
        
        registros.forEach((r) => {
          if (!registrosUnicos.has(r.fecha)) {
            registrosUnicos.set(r.fecha, r);
          } else {
            // Si ya existe, mantener el que tenga el timestamp más reciente
            const existente = registrosUnicos.get(r.fecha)!;
            const timestampExistente = getTimestampDateHelper(existente.timestamp);
            const timestampNuevo = getTimestampDateHelper(r.timestamp);
            
            if (timestampNuevo && (!timestampExistente || timestampNuevo > timestampExistente)) {
              registrosUnicos.set(r.fecha, r);
            }
          }
        });
        
        return Array.from(registrosUnicos.values());
      };
      
      try {
        const db = getDbSafe();
        if (!db) {
          // Fallback a localStorage si no hay Firebase
          const stored = localStorage.getItem(`peso_${planId}`);
          if (stored) {
            try {
              const registros = JSON.parse(stored);
              const registrosLimpios = limpiarDuplicados(registros);
              setRegistrosPeso(registrosLimpios);
            } catch {
              setRegistrosPeso([]);
            }
          }
          setLoading(false);
          return;
        }
        
        const planRef = doc(db, "planes", planId);
        const planDoc = await getDoc(planRef);
        
        if (planDoc.exists()) {
          const data = planDoc.data();
          if (data.registrosPeso && Array.isArray(data.registrosPeso)) {
            // Convertir timestamps de Firestore a fechas ISO si es necesario
            const registros = (data.registrosPeso as RegistroPeso[]).map((r) => {
              // Manejar diferentes formatos de timestamp
              let fechaStr = r.fecha;
              
              // Si hay timestamp, usar la fecha local del timestamp
              const timestampDate = getTimestampDateHelper(r.timestamp);
              if (timestampDate) {
                fechaStr = obtenerFechaLocal(timestampDate);
              } else if (!fechaStr) {
                // Si no hay fecha, usar fecha actual local
                fechaStr = obtenerFechaLocal(new Date());
              } else if (fechaStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
                // Si ya es formato ISO string, mantenerlo (ya debería estar en formato local)
                // No hacer nada, ya es el formato correcto
              }
              
              return {
                fecha: fechaStr,
                peso: r.peso,
                timestamp: r.timestamp
              };
            });
            
            // Limpiar duplicados antes de establecer el estado
            const registrosLimpios = limpiarDuplicados(registros);
            
            // Si se encontraron duplicados y se limpiaron, actualizar Firestore
            if (registrosLimpios.length !== registros.length) {
              try {
                const registrosParaFirestore = registrosLimpios.map((r) => {
                  const tsDate = getTimestampDateHelper(r.timestamp);
                  return {
                    fecha: r.fecha,
                    peso: r.peso,
                    timestamp: tsDate || new Date(r.fecha)
                  };
                });
                await updateDoc(planRef, {
                  registrosPeso: registrosParaFirestore,
                  updatedAt: serverTimestamp()
                });
              } catch (updateError) {
                console.error("Error al limpiar duplicados en Firestore:", updateError);
              }
            }
            
            setRegistrosPeso(registrosLimpios);
            // Sincronizar con localStorage como cache
            localStorage.setItem(`peso_${planId}`, JSON.stringify(registrosLimpios.map(r => ({ fecha: r.fecha, peso: r.peso }))));
          } else {
            // Si no hay en Firestore, intentar cargar desde localStorage (migración)
            const stored = localStorage.getItem(`peso_${planId}`);
            if (stored) {
              try {
                const localRegistros = JSON.parse(stored);
                const registrosLimpios = limpiarDuplicados(localRegistros);
                setRegistrosPeso(registrosLimpios);
                // Migrar a Firestore (solo si hay registros)
                if (registrosLimpios.length > 0) {
                  await updateDoc(planRef, {
                    registrosPeso: registrosLimpios.map((r: { fecha: string; peso: number }) => ({
                      fecha: r.fecha,
                      peso: r.peso,
                      timestamp: new Date(r.fecha) // Usar Date object en lugar de serverTimestamp()
                    })),
                    updatedAt: serverTimestamp()
                  });
                }
              } catch {
                setRegistrosPeso([]);
              }
            }
          }
        }
      } catch (error) {
        console.error("Error al cargar registros de peso:", error);
        // Fallback a localStorage
        const stored = localStorage.getItem(`peso_${planId}`);
        if (stored) {
          try {
            const registros = JSON.parse(stored);
            const registrosLimpios = limpiarDuplicados(registros);
            setRegistrosPeso(registrosLimpios);
          } catch {
            setRegistrosPeso([]);
          }
        }
      } finally {
        setLoading(false);
      }
    };
    
    loadRegistrosPeso();
  }, [planId]);
  
  // Helper para convertir timestamp a Date (fuera del useEffect)
  const getTimestampDateFromPlan = (ts: Timestamp | Date | { seconds: number } | number | undefined): Date => {
    if (!ts) return new Date();
    if (ts instanceof Date) return ts;
    if (typeof ts === 'number') return new Date(ts);
    if (typeof ts === 'object' && 'toDate' in ts && typeof ts.toDate === 'function') {
      return ts.toDate();
    }
    if (typeof ts === 'object' && 'seconds' in ts && typeof ts.seconds === 'number') {
      return new Date(ts.seconds * 1000);
    }
    return new Date();
  };
  
  // Obtener fecha de inicio del plan
  const fechaInicioPlan = getTimestampDateFromPlan(plan.createdAt);
  
    // Calcular progreso del plan
  const progresoPlan = (() => {
    const duracion = typeof planData?.duracion_plan_dias === 'number' ? planData.duracion_plan_dias : Number(planData?.duracion_plan_dias) || 30;
    if (!duracion) return { diasTranscurridos: 0, porcentaje: 0 };
    const ahora = new Date();
    const diasTranscurridos = Math.floor((ahora.getTime() - fechaInicioPlan.getTime()) / (1000 * 60 * 60 * 24));
    const porcentaje = Math.min(100, Math.max(0, (diasTranscurridos / duracion) * 100));
    return { diasTranscurridos: Math.min(duracion, Math.max(0, diasTranscurridos)), porcentaje };
  })();

  const handleGuardarPeso = async () => {
    const peso = parseFloat(nuevoPeso);
    if (isNaN(peso) || peso <= 0 || !planId) return;
    
    setGuardando(true);
    const fechaActual = new Date();
    // Usar fecha local en lugar de UTC para evitar problemas de zona horaria
    const año = fechaActual.getFullYear();
    const mes = String(fechaActual.getMonth() + 1).padStart(2, '0');
    const dia = String(fechaActual.getDate()).padStart(2, '0');
    const fechaISO = `${año}-${mes}-${dia}`;
    const timestamp = fechaActual.getTime(); // Timestamp del cliente (en milisegundos)
    
    // Crear el nuevo registro para el estado local
    const nuevoRegistroLocal = {
      fecha: fechaISO,
      peso: peso,
      timestamp: timestamp
    };
    
    // Crear el registro para Firestore (sin serverTimestamp dentro del arrayUnion)
    const nuevoRegistroFirestore = {
      fecha: fechaISO,
      peso: peso,
      timestamp: fechaActual // Usar Date object directamente, Firestore lo convertirá
    };
    
    try {
      const db = getDbSafe();
      if (db) {
        const planRef = doc(db, "planes", planId);
        
        // Leer el documento actual para obtener el array completo
        const planDoc = await getDoc(planRef);
        if (planDoc.exists()) {
          const data = planDoc.data();
          const registrosActuales = data.registrosPeso || [];
          
          // Verificar si ya existe un registro para esta fecha
          // Normalizar fechas para comparación
          const obtenerFechaNormalizada = (registro: RegistroPeso | Record<string, unknown>): string => {
            if (registro.fecha && typeof registro.fecha === 'string') {
              return registro.fecha;
            }
            // Si no hay fecha string, intentar obtenerla del timestamp
            const ts = 'timestamp' in registro ? registro.timestamp : undefined;
            const tsDate = getTimestampDateHelper(ts as RegistroPeso['timestamp']);
            if (tsDate) {
              const año = tsDate.getFullYear();
              const mes = String(tsDate.getMonth() + 1).padStart(2, '0');
              const dia = String(tsDate.getDate()).padStart(2, '0');
              return `${año}-${mes}-${dia}`;
            }
            return ''; // No se puede determinar la fecha
          };
          
          // Buscar si ya existe un registro para esta fecha
          const indiceExistente = registrosActuales.findIndex((r: RegistroPeso | Record<string, unknown>) => {
            const fechaR = obtenerFechaNormalizada(r);
            return fechaR === fechaISO;
          });
          
          let registrosActualizados: RegistroPeso[];
          
          if (indiceExistente >= 0) {
            // Si existe, reemplazarlo
            registrosActualizados = [...registrosActuales];
            registrosActualizados[indiceExistente] = nuevoRegistroFirestore;
          } else {
            // Si no existe, agregarlo
            registrosActualizados = [...registrosActuales, nuevoRegistroFirestore];
          }
          
          // Actualizar el documento completo con el array actualizado
          await updateDoc(planRef, {
            registrosPeso: registrosActualizados,
            updatedAt: serverTimestamp()
          });
          
          // Actualizar estado local también, verificando duplicados
          const indiceExistenteLocal = registrosPeso.findIndex(r => r.fecha === fechaISO);
          let nuevosRegistros: RegistroPeso[];
          
          if (indiceExistenteLocal >= 0) {
            // Si existe localmente, reemplazarlo
            nuevosRegistros = [...registrosPeso];
            nuevosRegistros[indiceExistenteLocal] = nuevoRegistroLocal;
          } else {
            // Si no existe, agregarlo
            nuevosRegistros = [...registrosPeso, nuevoRegistroLocal];
          }
          
          setRegistrosPeso(nuevosRegistros);
          
          // También guardar en localStorage como cache
          if (typeof window !== 'undefined') {
            localStorage.setItem(`peso_${planId}`, JSON.stringify(nuevosRegistros.map(r => ({ fecha: r.fecha, peso: r.peso }))));
          }
        } else {
          // Si el documento no existe, crear el array con el primer registro
          await updateDoc(planRef, {
            registrosPeso: [nuevoRegistroFirestore],
            updatedAt: serverTimestamp()
          });
          
          const nuevosRegistros = [nuevoRegistroLocal];
          setRegistrosPeso(nuevosRegistros);
          
          if (typeof window !== 'undefined') {
            localStorage.setItem(`peso_${planId}`, JSON.stringify(nuevosRegistros.map(r => ({ fecha: r.fecha, peso: r.peso }))));
          }
        }
        
        setNuevoPeso('');
      } else {
        // Fallback a localStorage si no hay Firebase
        // Verificar si ya existe un registro para esta fecha
        const indiceExistente = registrosPeso.findIndex(r => r.fecha === fechaISO);
        let nuevosRegistros: RegistroPeso[];
        
        if (indiceExistente >= 0) {
          nuevosRegistros = [...registrosPeso];
          nuevosRegistros[indiceExistente] = nuevoRegistroLocal;
        } else {
          nuevosRegistros = [...registrosPeso, nuevoRegistroLocal];
        }
        
        setRegistrosPeso(nuevosRegistros);
        setNuevoPeso('');
        if (typeof window !== 'undefined') {
          localStorage.setItem(`peso_${planId}`, JSON.stringify(nuevosRegistros.map(r => ({ fecha: r.fecha, peso: r.peso }))));
        }
      }
    } catch (error) {
      console.error("Error al guardar peso:", error);
      // Aún así guardar en localStorage como fallback, verificando duplicados
      const indiceExistente = registrosPeso.findIndex(r => r.fecha === fechaISO);
      let nuevosRegistros: RegistroPeso[];
      
      if (indiceExistente >= 0) {
        nuevosRegistros = [...registrosPeso];
        nuevosRegistros[indiceExistente] = nuevoRegistroLocal;
      } else {
        nuevosRegistros = [...registrosPeso, nuevoRegistroLocal];
      }
      
      setRegistrosPeso(nuevosRegistros);
      setNuevoPeso('');
      if (typeof window !== 'undefined') {
        localStorage.setItem(`peso_${planId}`, JSON.stringify(nuevosRegistros.map(r => ({ fecha: r.fecha, peso: r.peso }))));
      }
    } finally {
      setGuardando(false);
    }
  };

  const handleEliminarPeso = async () => {
    if (!planId || !registroAEliminar) return;
    
    setEliminando(true);
    
    try {
      const db = getDbSafe();
      if (db) {
        const planRef = doc(db, "planes", planId);
        
        // Leer el documento actual para obtener el array completo
        const planDoc = await getDoc(planRef);
        if (planDoc.exists()) {
          const data = planDoc.data();
          const registrosActuales = data.registrosPeso || [];
          
          // Filtrar el registro a eliminar del array
          // Buscar por fecha y peso ya que el timestamp puede variar en formato
          const registrosActualizados = registrosActuales.filter((r: RegistroPeso) => {
            // Normalizar la fecha para comparación
            let fechaR = r.fecha;
            const timestampDate = getTimestampDateHelper(r.timestamp);
            if (timestampDate) {
              const año = timestampDate.getFullYear();
              const mes = String(timestampDate.getMonth() + 1).padStart(2, '0');
              const dia = String(timestampDate.getDate()).padStart(2, '0');
              fechaR = `${año}-${mes}-${dia}`;
            } else if (!fechaR && r.timestamp) {
              // Si no hay fecha string pero hay timestamp, intentar convertir
              const tsDate = getTimestampDateHelper(r.timestamp);
              if (tsDate) {
                const año = tsDate.getFullYear();
                const mes = String(tsDate.getMonth() + 1).padStart(2, '0');
                const dia = String(tsDate.getDate()).padStart(2, '0');
                fechaR = `${año}-${mes}-${dia}`;
              }
            }
            
            // Eliminar si coincide fecha y peso
            return !(fechaR === registroAEliminar.fecha && Math.abs(r.peso - registroAEliminar.peso) < 0.01);
          });
          
          // Actualizar todo el array en Firestore
          await updateDoc(planRef, {
            registrosPeso: registrosActualizados,
            updatedAt: serverTimestamp()
          });
          
          // Actualizar estado local después de confirmar eliminación en DB
          const nuevosRegistros = registrosPeso.filter(r => 
            !(r.fecha === registroAEliminar.fecha && Math.abs(r.peso - registroAEliminar.peso) < 0.01)
          );
          setRegistrosPeso(nuevosRegistros);
          
          // Actualizar localStorage
          if (typeof window !== 'undefined') {
            localStorage.setItem(`peso_${planId}`, JSON.stringify(nuevosRegistros.map(r => ({ fecha: r.fecha, peso: r.peso }))));
          }
        }
      } else {
        // Si no hay Firebase, eliminar solo del estado local
        const nuevosRegistros = registrosPeso.filter(r => 
          !(r.fecha === registroAEliminar.fecha && Math.abs(r.peso - registroAEliminar.peso) < 0.01)
        );
        setRegistrosPeso(nuevosRegistros);
        
        if (typeof window !== 'undefined') {
          localStorage.setItem(`peso_${planId}`, JSON.stringify(nuevosRegistros.map(r => ({ fecha: r.fecha, peso: r.peso }))));
        }
      }
      
      // Cerrar modal y resetear
      setMostrarConfirmacion(false);
      setRegistroAEliminar(null);
    } catch (error) {
      console.error("Error al eliminar peso de Firestore:", error);
      // Mostrar error pero no cerrar el modal para que pueda intentar de nuevo
      alert("Error al eliminar el registro. Por favor intenta de nuevo.");
    } finally {
      setEliminando(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold">Seguimiento de progreso</h2>
        <button
          onClick={onClose}
          className="text-white/70 hover:text-white transition-colors"
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
            className="h-6 w-6"
          >
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Información del plan */}
      <div className="mb-6 p-4 rounded-lg bg-white/5 border border-white/10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="opacity-60">Plan:</span>
            <p className="font-medium mt-1">
              {plan.isOldest 
                ? "Plan Base"
                : user?.objetivo === "perder_grasa"
                ? "Perder Grasa"
                : user?.objetivo === "mantener"
                ? "Mantener Peso"
                : user?.objetivo === "ganar_masa"
                ? "Ganar Masa"
                : String(user?.objetivo || "N/A")}
            </p>
          </div>
          <div>
            <span className="opacity-60">Peso inicial:</span>
            <p className="font-medium mt-1">{typeof user?.pesoKg === 'number' ? user.pesoKg : Number(user?.pesoKg) || 0} kg</p>
          </div>
          <div>
            <span className="opacity-60">Progreso del plan:</span>
            <p className="font-medium mt-1">{progresoPlan.porcentaje.toFixed(0)}%</p>
          </div>
          <div>
            <span className="opacity-60">Días transcurridos:</span>
            <p className="font-medium mt-1">{progresoPlan.diasTranscurridos} / {typeof planData?.duracion_plan_dias === 'number' ? planData.duracion_plan_dias : Number(planData?.duracion_plan_dias) || 30}</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <span className="ml-3 opacity-70">Cargando registros...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Registro de peso mensual */}
          <div>
            <p className="text-sm font-medium opacity-70 mb-3">Registrar peso mensual</p>
          <div className="flex gap-2">
            <input
              type="number"
              value={nuevoPeso}
              onChange={(e) => setNuevoPeso(e.target.value)}
              placeholder={`Peso actual: ${user?.pesoKg || 0} kg`}
              step="0.1"
              className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleGuardarPeso();
                }
              }}
            />
            <button
              onClick={handleGuardarPeso}
              disabled={guardando}
              className="px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {guardando ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
          
          {/* Lista de registros */}
          {registrosPeso.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-xs opacity-70 mb-2">Historial de pesos:</p>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {registrosPeso
                  .sort((a, b) => {
                    // Comparar strings directamente ya que están en formato YYYY-MM-DD
                    return b.fecha.localeCompare(a.fecha);
                  })
                        .map((registro, idx) => {
                          // Parsear fecha como local, no UTC
                          const [año, mes, dia] = registro.fecha.split('-').map(Number);
                          const fecha = new Date(año, mes - 1, dia);
                          const pesoInicial = typeof user?.pesoKg === 'number' ? user.pesoKg : Number(user?.pesoKg) || 0;
                          const diferencia = pesoInicial ? registro.peso - pesoInicial : 0;
                    const objetivo = user?.objetivo || 'mantener';
                    const esPositivo = objetivo === 'ganar_masa' || objetivo === 'volumen' 
                      ? diferencia > 0 
                      : objetivo === 'perder_grasa' || objetivo === 'corte'
                      ? diferencia < 0
                      : Math.abs(diferencia) < 1;
                    
                    return (
                      <div key={idx} className="flex items-center justify-between gap-2 p-2 rounded bg-white/5 text-xs group hover:bg-white/10 transition-colors">
                        <span className="opacity-80">
                          {fecha.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                        <span className="font-medium">{registro.peso} kg</span>
                        {(() => {
                          const peso = user?.pesoKg;
                          return Boolean(peso && typeof peso === 'number');
                        })() ? (
                          <span className={`text-xs ${esPositivo ? 'text-green-400' : 'text-orange-400'}`}>
                            {diferencia > 0 ? '+' : ''}{diferencia.toFixed(1)} kg
                          </span>
                        ) : null}
                        <button
                          onClick={() => {
                            setRegistroAEliminar(registro);
                            setMostrarConfirmacion(true);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-all"
                          title="Eliminar registro"
                          aria-label="Eliminar registro"
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
                            <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
        
        {/* Gráfica de evolución */}
        <div>
          <p className="text-sm font-medium opacity-70 mb-3">Evolución del peso</p>
          {registrosPeso.length > 0 && user?.pesoKg && typeof user.pesoKg === 'number' ? (
            <div className="space-y-2">
              <div className="h-32 flex items-end justify-between gap-1">
                {registrosPeso
                  .sort((a, b) => a.fecha.localeCompare(b.fecha))
                  .slice(-6) // Últimos 6 registros
                  .map((registro, idx) => {
                    const pesoInicialNum = typeof user.pesoKg === 'number' ? user.pesoKg : Number(user.pesoKg) || 0;
                    const pesos = registrosPeso
                      .sort((a, b) => a.fecha.localeCompare(b.fecha))
                      .slice(-6)
                      .map(r => r.peso);
                    const maxPeso = Math.max(...pesos, pesoInicialNum);
                    const minPeso = Math.min(...pesos, pesoInicialNum);
                    const rango = maxPeso - minPeso || 1;
                    const altura = ((registro.peso - minPeso) / rango) * 100;
                    const diferencia = registro.peso - pesoInicialNum;
                    
                    return (
                      <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                        <div className="w-full flex items-end justify-center h-full">
                          <div
                            className={`w-full rounded-t transition-all ${
                              diferencia > 0 ? 'bg-green-500' : diferencia < 0 ? 'bg-red-500' : 'bg-blue-500'
                            }`}
                            style={{ height: `${Math.max(10, altura)}%` }}
                            title={`${registro.peso} kg (${diferencia > 0 ? '+' : ''}${diferencia.toFixed(1)} kg)`}
                          />
                        </div>
                        <span className="text-[10px] opacity-60">
                          {(() => {
                            // Parsear fecha como local, no UTC
                            const [año, mes, dia] = registro.fecha.split('-').map(Number);
                            const fechaLocal = new Date(año, mes - 1, dia);
                            return fechaLocal.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
                          })()}
                        </span>
                      </div>
                    );
                  })}
              </div>
              <div className="flex items-center justify-between text-xs opacity-70 pt-2 border-t border-white/10">
                <span>Peso inicial: {user.pesoKg} kg</span>
                {registrosPeso.length > 0 && (
                  <span>
                    Último: {registrosPeso.sort((a, b) => b.fecha.localeCompare(a.fecha))[0].peso} kg
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="h-32 flex items-center justify-center text-xs opacity-60 border border-white/10 rounded-lg">
              Registra tu peso para ver la evolución
            </div>
          )}
        </div>
        </div>
      )}

      {/* Modal de confirmación para eliminar registro de peso */}
      <AnimatePresence>
        {mostrarConfirmacion && registroAEliminar && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setMostrarConfirmacion(false);
                setRegistroAEliminar(null);
              }}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[10001]"
            />
            
            {/* Modal */}
            <div 
              className="pointer-events-none fixed inset-0 z-[10002] flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="pointer-events-auto w-full max-w-md rounded-xl border border-white/10 bg-black/95 p-6 shadow-2xl"
              >
                <div className="mb-4">
                  <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-500/20 mb-4 mx-auto">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-6 w-6 text-red-400"
                    >
                      <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </div>
                  <h2 className="text-xl font-semibold mb-2 text-center">
                    ¿Eliminar registro de peso?
                  </h2>
                  <p className="text-sm opacity-70 text-center mb-4">
                    Se eliminará el registro del {(() => {
                      const [año, mes, dia] = registroAEliminar.fecha.split('-').map(Number);
                      const fecha = new Date(año, mes - 1, dia);
                      return fecha.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
                    })()} ({registroAEliminar.peso} kg) de la base de datos.
                  </p>
                  <p className="text-xs opacity-60 text-center">
                    Esta acción no se puede deshacer.
                  </p>
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => {
                      setMostrarConfirmacion(false);
                      setRegistroAEliminar(null);
                    }}
                    disabled={eliminando}
                    className="flex-1 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleEliminarPeso}
                    disabled={eliminando}
                    className="flex-1 px-4 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 hover:text-red-300 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {eliminando ? "Eliminando..." : "Eliminar"}
                  </button>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

