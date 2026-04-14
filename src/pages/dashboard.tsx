import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import { useAuthStore } from "@/store/authStore";
import { usePlanStore } from "@/store/planStore";
import { getDbSafe, getAuthSafe } from "@/lib/firebase";
import { collection, query, where, getDocs, limit, Timestamp, doc, deleteDoc, updateDoc, serverTimestamp, getDoc } from "firebase/firestore";
import Navbar from "@/components/Navbar";
import { useAppLocale, type AppLocale } from "@/contexts/AppLocaleContext";
import { dash, dashFmt, goalLabel } from "@/lib/i18n/appUi";
import type { RegistroPeso, SavedPlan } from "@/types/savedPlan";
import { DashboardPlanCard } from "@/components/dashboard/DashboardPlanCard";
import { loadCachedDashboardPlans, saveCachedDashboardPlans } from "@/lib/planLocalCache";
import { applyPendingWeightOps, clearPendingWeightOps, enqueueWeightOp, loadPendingWeightOps } from "@/lib/weightSyncQueue";

const PremiumPlanModal = dynamic(() => import("@/components/PremiumPlanModal"), { ssr: false });
const PlanContinuityModal = dynamic(() => import("@/components/PlanContinuityModal"), { ssr: false });

export default function Dashboard() {
  const router = useRouter();
  const { locale } = useAppLocale();
  const { user: authUser, loading: authLoading } = useAuthStore();
  const { setPlan, setUser, setPlanId, setPlanMultiFase, setPlanCreatedAt } = usePlanStore();
  const [plans, setPlans] = useState<SavedPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [planToDelete, setPlanToDelete] = useState<SavedPlan | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [progressModalOpen, setProgressModalOpen] = useState(false);
  const [planForProgress, setPlanForProgress] = useState<SavedPlan | null>(null);
  const [processingPayment] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [premiumModalOpen, setPremiumModalOpen] = useState(false);
  const [freeExpiredModalOpen, setFreeExpiredModalOpen] = useState(false);
  const [continuityModalOpen, setContinuityModalOpen] = useState(false);
  const [planForContinuity, setPlanForContinuity] = useState<SavedPlan | null>(null);
  const [personalTrainerModalOpen, setPersonalTrainerModalOpen] = useState(false);
  const [personalTrainerLoading, setPersonalTrainerLoading] = useState(false);
  const [personalTrainerAssigned, setPersonalTrainerAssigned] = useState(false);
  const [personalTrainerNotice, setPersonalTrainerNotice] = useState<string | null>(null);
  const [personalTrainerReason, setPersonalTrainerReason] = useState("");
  const [trainerPreference, setTrainerPreference] = useState<"hombre" | "mujer" | null>(null);
  const [cacheNotice, setCacheNotice] = useState<string | null>(null);

  const trainerWhatsappUrl = "https://wa.me/34627043397";

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
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser, authLoading, router]);

  const handleRequestPersonalTrainer = async () => {
    try {
      const auth = getAuthSafe();
      if (!auth?.currentUser) return;
      setPersonalTrainerLoading(true);
      setPersonalTrainerNotice(null);

      const token = await auth.currentUser.getIdToken();
      const response = await fetch("/api/request-personal-trainer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          requestNote: personalTrainerReason.trim() || null,
          trainerPreference,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || dash(locale, "trainerRequestError"));
      }

      setPersonalTrainerAssigned(true);
      setPersonalTrainerModalOpen(false);
      setPersonalTrainerReason("");
      setTrainerPreference(null);
      if (data?.alreadyAssigned) {
        setPersonalTrainerNotice(dash(locale, "trainerAssignedAlready"));
      } else {
        const name = data?.trainer?.name || dash(locale, "trainerNameFallback");
        setPersonalTrainerNotice(dash(locale, "trainerAssignedOk").replace("{name}", name));
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : dash(locale, "trainerRequestError");
      setPersonalTrainerNotice(message);
    } finally {
      setPersonalTrainerLoading(false);
    }
  };

  const loadPlans = async () => {
    try {
      const db = getDbSafe();
      const auth = getAuthSafe();
      if (!auth?.currentUser) {
        setError(dash(locale, "errFirebase"));
        setLoading(false);
        return;
      }
      if (!db) {
        const cachedPlans = loadCachedDashboardPlans(auth.currentUser.uid);
        if (cachedPlans && cachedPlans.length > 0) {
          setPlans(cachedPlans);
          setCacheNotice(
            locale === "en"
              ? "Showing your latest saved plans while the server is temporarily unavailable."
              : "Mostrando tus últimos planes guardados mientras el servidor no está disponible."
          );
          setError(null);
        } else {
          setError(dash(locale, "errFirebase"));
        }
        setLoading(false);
        return;
      }

      // Cargar estado premium/trainer en la misma rutina para evitar lecturas duplicadas.
      try {
        const userRef = doc(db, "usuarios", auth.currentUser.uid);
        const userDoc = await getDoc(userRef);
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setIsPremium(userData.premium === true);
          setPersonalTrainerAssigned(userData.personalTrainerAssigned === true);
        }
      } catch (userStatusErr) {
        console.warn("No se pudo leer estado premium/trainer en dashboard:", userStatusErr);
      }

      // Primero obtener todos los planes del usuario sin ordenar
      const q = query(
        collection(db, "planes"),
        where("userId", "==", auth.currentUser.uid),
        limit(50) // Aumentamos el límite y ordenamos en memoria si es necesario
      );

      const querySnapshot = await getDocs(q);
      const plansData: SavedPlan[] = [];
      
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
      const normalizedPlans = limitedPlans.map(p => ({ ...p, isOldest: p.id === oldestPlanId }));
      setPlans(normalizedPlans);
      saveCachedDashboardPlans(auth.currentUser.uid, normalizedPlans);
      setCacheNotice(null);

      // Optimizacion: evita revisar snapshot de todos los planes en cada carga.
      // Solo intenta con el plan mas reciente y no mas de una vez por dia.
      const mostRecentPlan = limitedPlans[0];
      if (mostRecentPlan?.id) {
        const createdAtMs =
          mostRecentPlan.createdAt?.toMillis?.() ||
          (mostRecentPlan.createdAt?.seconds ? mostRecentPlan.createdAt.seconds * 1000 : 0);
        if (createdAtMs > 0) {
          const createdDate = new Date(createdAtMs);
          const diffDays = (Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24);
          if (diffDays >= 30) {
            const monthYear = `${createdDate.getFullYear()}-${String(createdDate.getMonth() + 1).padStart(2, "0")}`;
            const todayKey = new Date().toISOString().slice(0, 10);
            const throttleKey = `fitplan:snapshot-check:${auth.currentUser.uid}:${mostRecentPlan.id}:${monthYear}`;
            const checkedToday = typeof window !== "undefined" ? localStorage.getItem(throttleKey) === todayKey : false;

            if (!checkedToday) {
              if (typeof window !== "undefined") localStorage.setItem(throttleKey, todayKey);
              void fetch("/api/saveMonthlySnapshot", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  userId: auth.currentUser.uid,
                  planId: mostRecentPlan.id,
                  planData: mostRecentPlan.plan?.plan || {},
                  userData: mostRecentPlan.plan?.user || {},
                }),
              }).catch((snapshotErr) => {
                console.warn("Error al guardar snapshot mensual (no bloqueante):", snapshotErr);
              });
            }
          }
        }
      }
      setError(null);
    } catch (err: unknown) {
      console.error("Error al cargar planes:", err);
      const auth = getAuthSafe();
      const fallbackUid = auth?.currentUser?.uid;
      if (fallbackUid) {
        const cachedPlans = loadCachedDashboardPlans(fallbackUid);
        if (cachedPlans && cachedPlans.length > 0) {
          setPlans(cachedPlans);
          setCacheNotice(
            locale === "en"
              ? "Connection issues detected. Showing your latest saved plans."
              : "Detectamos problemas de conexión. Mostramos tus últimos planes guardados."
          );
          setError(null);
        } else {
          setError(dash(locale, "errLoadPlans"));
        }
      } else {
        setError(dash(locale, "errLoadPlans"));
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePlanClick = (plan: SavedPlan) => {
    // Si no es premium y el plan tiene más de 30 días, bloquear acceso
    try {
      const createdDate =
        plan.createdAt?.toDate?.() ||
        (plan.createdAt?.seconds ? new Date(plan.createdAt.seconds * 1000) : undefined);

      if (!isPremium && createdDate) {
        const now = new Date();
        const diffTime = now.getTime() - createdDate.getTime();
        const diffHours = diffTime / (1000 * 60 * 60);
        const diffDays = diffHours / 24;

        if (diffDays >= 30) {
          setFreeExpiredModalOpen(true);
          return;
        }
      }
    } catch (e) {
      console.warn("No se pudo calcular la antigüedad del plan:", e);
    }

    // Cargar el plan en el store y navegar a la vista del plan
    setUser(plan.plan.user as unknown as Parameters<typeof setUser>[0]);
    setPlan(plan.plan.plan as unknown as Parameters<typeof setPlan>[0]);
    setPlanId(plan.id); // Guardar el ID del plan para poder actualizarlo después
    // Guardar fecha de creación del plan para usarla dentro de /plan
    try {
      const createdDate = plan.createdAt?.toDate?.() || (plan.createdAt?.seconds ? new Date(plan.createdAt.seconds * 1000) : undefined);
      setPlanCreatedAt(createdDate ? createdDate.toISOString() : undefined);
    } catch {
      setPlanCreatedAt(undefined);
    }
    // Cargar planMultiFase si existe (para planes bulk_cut y lean_bulk)
    if (plan.planMultiFase) {
      setPlanMultiFase(plan.planMultiFase as unknown as Parameters<typeof setPlanMultiFase>[0]);
    } else {
      setPlanMultiFase(undefined); // Limpiar si es un plan simple
    }
    router.push("/plan");
  };

  const handleCreateNew = () => {
    router.push("/create-plan");
  };

  const handleDeleteClick = (e: React.MouseEvent, plan: SavedPlan) => {
    e.stopPropagation(); // Evitar que se active el onClick del card
    
    // Prevenir eliminar el Plan Base solo si NO es premium
    if (plan.isOldest && !isPremium) {
      alert(dash(locale, "alertCannotDeleteBase"));
      return;
    }
    
    setPlanToDelete(plan);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!planToDelete) return;

    // Validación de seguridad: no permitir eliminar el Plan Base solo si NO es premium
    if (planToDelete.isOldest && !isPremium) {
      alert(dash(locale, "alertCannotDeleteBase"));
      setDeleteModalOpen(false);
      setPlanToDelete(null);
      return;
    }

    setDeleting(true);
    try {
      const db = getDbSafe();
      const auth = getAuthSafe();
      
      if (!db || !auth?.currentUser) {
        throw new Error(dash(locale, "errFirebase"));
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
      setError(dash(locale, "errDeletePlan"));
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
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-[var(--landing-border)] border-t-[var(--landing-accent)]" />
          <p className="text-sm text-[var(--landing-muted)]">{dash(locale, "loading")}</p>
        </div>
      </div>
    );
  }

  if (!authUser) {
    return null; // Será redirigido
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden max-w-full">
      <Head>
        <title>{dash(locale, "pageTitle")}</title>
        <meta name="description" content={dash(locale, "pageDesc")} />
        <meta name="robots" content="noindex, nofollow" />
        <meta property="og:title" content={dash(locale, "ogTitle")} />
        <meta property="og:url" content="https://www.fitplan-ai.com/dashboard" />
      </Head>
      <Navbar />
      <div className="relative z-[1] px-3 py-6 sm:px-5 sm:py-10 md:px-8 max-w-full overflow-x-hidden">
        <div className="mx-auto max-w-6xl w-full">
          {cacheNotice ? (
            <div className="mb-4 rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
              {cacheNotice}
            </div>
          ) : null}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="relative"
          >
            <div className="relative w-full overflow-x-hidden">
            <header className="mb-8 sm:mb-10">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 max-w-2xl">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--landing-muted)]">FitPlan AI</p>
                  <h1 className="mt-1 text-3xl font-bold tracking-tight text-[var(--foreground)] sm:text-4xl">
                    {dash(locale, "heading")}
                  </h1>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--landing-muted)] sm:text-base">
                    {dash(locale, "subtitle")}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
                  {personalTrainerAssigned ? (
                    <button
                      type="button"
                      onClick={() => window.open(trainerWhatsappUrl, "_blank", "noopener,noreferrer")}
                      aria-label={dash(locale, "contactTrainer")}
                      title={dash(locale, "contactTrainer")}
                      className="group inline-flex max-w-full items-center justify-center gap-2 rounded-xl border border-[color-mix(in_oklab,var(--brand-end)_40%,transparent)] bg-[color-mix(in_oklab,var(--brand-end)_14%,transparent)] px-4 py-2.5 text-sm font-medium text-[var(--foreground)] shadow-[0_8px_28px_-12px_color-mix(in_oklab,var(--brand-end)_50%,transparent)] transition-all hover:bg-[color-mix(in_oklab,var(--brand-end)_20%,transparent)] sm:gap-0 sm:px-3 sm:py-2.5 sm:hover:gap-2 sm:hover:px-4"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        className="h-4 w-4 shrink-0 opacity-90"
                        aria-hidden
                      >
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                      </svg>
                      <span className="whitespace-nowrap max-sm:inline sm:inline-block sm:max-w-0 sm:overflow-hidden sm:opacity-0 sm:transition-[max-width,opacity] sm:duration-200 sm:ease-out sm:group-hover:max-w-[min(18rem,calc(100vw-6rem))] sm:group-hover:opacity-100 sm:group-focus-within:max-w-[min(18rem,calc(100vw-6rem))] sm:group-focus-within:opacity-100">
                        {dash(locale, "contactTrainer")}
                      </span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setPersonalTrainerModalOpen(true)}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-[color-mix(in_oklab,var(--landing-accent)_45%,transparent)] bg-[color-mix(in_oklab,var(--landing-accent)_16%,transparent)] px-4 py-2.5 text-sm font-medium text-[var(--foreground)] transition hover:bg-[color-mix(in_oklab,var(--landing-accent)_24%,transparent)]"
                    >
                      {dash(locale, "requestTrainer")}
                    </button>
                  )}
                </div>
              </div>

              {personalTrainerNotice && (
                <div className="mt-6 rounded-2xl border border-[color-mix(in_oklab,var(--brand-end)_30%,transparent)] bg-[color-mix(in_oklab,var(--brand-end)_10%,transparent)] px-4 py-3 text-sm leading-relaxed text-[var(--foreground)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                  <span className="mr-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--brand-end)] shadow-[0_0_10px_color-mix(in_oklab,var(--brand-end)_80%,transparent)]" aria-hidden />
                  {personalTrainerNotice}
                </div>
              )}

              <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                {!isPremium && (
                  <button
                    type="button"
                    onClick={() => {
                      if (!authUser) {
                        alert(dash(locale, "registerPremium"));
                        return;
                      }
                      setPremiumModalOpen(true);
                    }}
                    disabled={processingPayment}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_12px_36px_-16px_rgba(251,146,60,0.55)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="h-4 w-4 shrink-0 opacity-95"
                    >
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                    {dash(locale, "premium")}
                  </button>
                )}
                {!isPremium && plans.length >= 1 ? (
                  <div className="group relative flex-1 sm:flex-none">
                    <button
                      type="button"
                      disabled
                      className="w-full rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface)] px-5 py-2.5 text-sm font-medium text-[var(--landing-muted)] opacity-60 sm:w-auto"
                    >
                      {dash(locale, "newPlan")}
                    </button>
                    <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 -translate-x-1/2 rounded-lg border border-amber-500/25 bg-[color-mix(in_oklab,#0f172a_95%,black)] px-3 py-2 text-xs text-amber-100/95 opacity-0 shadow-xl transition-opacity group-hover:opacity-100">
                      {dash(locale, "newPlanLocked")}
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleCreateNew}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--brand-start)] via-[var(--brand-mid)] to-[var(--brand-end)] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_12px_40px_-18px_color-mix(in_oklab,var(--brand-mid)_50%,transparent)] transition hover:brightness-110 sm:flex-none"
                  >
                    {dash(locale, "newPlan")}
                  </button>
                )}
              </div>
            </header>

            {error && (
              <div className="mb-8 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            )}

            {plans.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--landing-border)] bg-[color-mix(in_oklab,var(--foreground)_3%,transparent)] px-6 py-14 text-center">
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--landing-surface)] ring-1 ring-[var(--landing-border)]">
                  <span className="text-4xl" aria-hidden>
                    📋
                  </span>
                </div>
                <h2 className="text-xl font-semibold text-[var(--foreground)]">{dash(locale, "noPlansTitle")}</h2>
                <p className="mx-auto mt-2 max-w-md text-sm text-[var(--landing-muted)]">{dash(locale, "noPlansBody")}</p>
                <button
                  type="button"
                  onClick={handleCreateNew}
                  className="mt-8 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--brand-start)] via-[var(--brand-mid)] to-[var(--brand-end)] px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:brightness-110"
                >
                  {dash(locale, "createFirst")}
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 lg:gap-6">
                {plans.map((plan) => {
                  const phase = plan.planMultiFase?.faseActual;
                  const accentBar =
                    plan.isOldest
                      ? "bg-gradient-to-r from-slate-500 via-slate-400/70 to-cyan-500/80"
                      : phase === "BULK"
                        ? "bg-gradient-to-r from-amber-400 to-orange-500"
                        : phase === "CUT"
                          ? "bg-gradient-to-r from-cyan-400 to-blue-600"
                          : phase === "LEAN_BULK"
                            ? "bg-gradient-to-r from-emerald-400 to-teal-600"
                            : phase === "MANTENIMIENTO"
                              ? "bg-gradient-to-r from-violet-400 to-fuchsia-600"
                              : "bg-gradient-to-r from-[var(--brand-start)] via-[var(--brand-mid)] to-[var(--brand-end)]";

                  return (
                    <DashboardPlanCard
                      key={plan.id}
                      plan={plan}
                      locale={locale}
                      isPremium={isPremium}
                      accentBar={accentBar}
                      onCardClick={() => handlePlanClick(plan)}
                      onProgressClick={(e) => {
                        e.stopPropagation();
                        setPlanForProgress(plan);
                        setProgressModalOpen(true);
                      }}
                      onDeleteClick={(e) => handleDeleteClick(e, plan)}
                      calculateProgress={calculateProgress}
                      calculateDaysRemaining={calculateDaysRemaining}
                      onContinuityClick={(e) => {
                        e.stopPropagation();
                        setPlanForContinuity(plan);
                        setContinuityModalOpen(true);
                      }}
                    />
                  );
                })}
              </div>
            )}
            </div>
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
                      {dash(locale, "deleteModalTitle")}
                    </h2>
                    <p className="text-sm opacity-70 text-center">
                      {dash(locale, "deleteModalBody")}
                    </p>
                  </div>

                  <div className="flex gap-3 mt-6">
                    <button
                      onClick={handleCancelDelete}
                      disabled={deleting}
                      className="flex-1 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {dash(locale, "cancel")}
                    </button>
                    <button
                      onClick={handleConfirmDelete}
                      disabled={deleting}
                      className="flex-1 px-4 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 hover:text-red-300 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {deleting ? dash(locale, "deleting") : dash(locale, "deleteVerb")}
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
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setProgressModalOpen(false)}
                className="fixed inset-0 z-[9999] bg-black/75 backdrop-blur-md"
              />
              <div className="pointer-events-none fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-4">
                <motion.div
                  initial={{ scale: 0.96, opacity: 0, y: 14 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.96, opacity: 0, y: 14 }}
                  transition={{ type: "spring", damping: 26, stiffness: 320 }}
                  onClick={(e) => e.stopPropagation()}
                  className="pointer-events-auto flex max-h-[min(92vh,calc(100vh-2rem))] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-[var(--landing-border)] bg-[color-mix(in_oklab,var(--background)_86%,#0a0f18)] shadow-[0_40px_100px_-36px_rgba(0,0,0,0.9)] ring-1 ring-[color-mix(in_oklab,var(--foreground)_5%,transparent)]"
                >
                  <div
                    className="pointer-events-none absolute inset-0 opacity-[0.4]"
                    style={{
                      background:
                        "radial-gradient(65% 42% at 12% 0%, color-mix(in oklab, var(--landing-accent) 22%, transparent), transparent 52%), radial-gradient(50% 38% at 88% 6%, color-mix(in oklab, var(--brand-mid) 14%, transparent), transparent 48%)",
                    }}
                  />
                  <div className="relative max-h-full min-h-0 flex-1 overflow-y-auto">
                    <ProgressModalContent
                      plan={planForProgress}
                      onClose={() => setProgressModalOpen(false)}
                      locale={locale}
                    />
                  </div>
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

      {mounted && createPortal(
        <AnimatePresence>
          {freeExpiredModalOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[10001] bg-black/75 backdrop-blur-md"
                onClick={() => setFreeExpiredModalOpen(false)}
              />
              <div className="pointer-events-none fixed inset-0 z-[10002] flex items-center justify-center p-3 sm:p-4">
                <motion.div
                  initial={{ opacity: 0, scale: 0.96, y: 16 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: 16 }}
                  transition={{ type: "spring", damping: 26, stiffness: 320 }}
                  onClick={(e) => e.stopPropagation()}
                  className="pointer-events-auto relative w-full max-w-lg overflow-hidden rounded-2xl border border-[var(--landing-border)] bg-[color-mix(in_oklab,var(--background)_88%,#0a0f18)] shadow-[0_40px_100px_-40px_rgba(0,0,0,0.92)] ring-1 ring-[color-mix(in_oklab,var(--foreground)_6%,transparent)]"
                >
                  <div
                    className="pointer-events-none absolute inset-0 opacity-[0.5]"
                    style={{
                      background:
                        "radial-gradient(80% 50% at 10% 0%, color-mix(in oklab, var(--landing-accent) 26%, transparent), transparent 55%), radial-gradient(55% 40% at 95% 0%, color-mix(in oklab, #f59e0b 18%, transparent), transparent 50%)",
                    }}
                  />
                  <div className="relative p-6 sm:p-8">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-amber-500/35 bg-[color-mix(in_oklab,#f59e0b_14%,transparent)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.75"
                          className="h-7 w-7 text-amber-200"
                          aria-hidden
                        >
                          <circle cx="12" cy="12" r="9" />
                          <path d="M12 7v5l3 2" strokeLinecap="round" />
                        </svg>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--landing-muted)]">
                          FitPlan AI
                        </p>
                        <h3 className="mt-1 text-xl font-bold tracking-tight text-[var(--foreground)] sm:text-2xl">
                          {dash(locale, "freeExpiredTitle")}
                        </h3>
                        <p className="mt-3 text-sm leading-relaxed text-[var(--landing-muted)]">
                          {dash(locale, "freeExpiredBody")}
                        </p>
                      </div>
                    </div>
                    <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-end">
                      <button
                        type="button"
                        onClick={() => setFreeExpiredModalOpen(false)}
                        className="order-2 rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface)] px-5 py-2.5 text-sm font-medium text-[var(--foreground)] transition hover:border-[color-mix(in_oklab,var(--foreground)_16%,transparent)] sm:order-1 sm:min-w-[9rem]"
                      >
                        {dash(locale, "understood")}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setFreeExpiredModalOpen(false);
                          setPremiumModalOpen(true);
                        }}
                        className="order-1 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_14px_40px_-18px_rgba(251,146,60,0.55)] transition hover:brightness-110 sm:order-2"
                      >
                        {dash(locale, "viewPremiumPlans")}
                      </button>
                    </div>
                  </div>
                </motion.div>
              </div>
            </>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Modal de continuidad de plan */}
      {mounted && createPortal(
        <AnimatePresence>
          {continuityModalOpen && planForContinuity && authUser && (
            <PlanContinuityModal
              isOpen={continuityModalOpen}
              onClose={() => {
                setContinuityModalOpen(false);
                setPlanForContinuity(null);
              }}
              planData={{
                id: planForContinuity.id,
                plan: planForContinuity.plan.plan as never,
                user: planForContinuity.plan.user as never,
                createdAt: planForContinuity.createdAt.toDate?.() || new Date(planForContinuity.createdAt.seconds * 1000),
              }}
              registrosPeso={planForContinuity.registrosPeso || []}
              userId={authUser.uid}
            />
          )}
        </AnimatePresence>,
        document.body
      )}

      <AnimatePresence>
        {personalTrainerModalOpen && (
          <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => setPersonalTrainerModalOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              className="relative z-10 w-full max-w-3xl rounded-2xl border border-[var(--landing-border)] bg-[var(--background)] p-4 shadow-[0_24px_80px_-32px_rgba(0,0,0,0.85)] ring-1 ring-[color-mix(in_oklab,var(--foreground)_6%,transparent)] sm:p-6"
            >
              <div className="mb-4 flex items-start justify-between gap-3 border-b border-[var(--landing-border)] pb-4">
                <div>
                  <span className="inline-flex rounded-full border border-[color-mix(in_oklab,var(--brand-end)_45%,transparent)] bg-[color-mix(in_oklab,var(--brand-end)_15%,transparent)] px-2.5 py-1 text-[11px] font-medium text-[var(--foreground)]">
                    Soporte humano
                  </span>
                  <h2 className="mt-2 text-lg font-semibold text-[var(--foreground)] sm:text-xl">{dash(locale, "ptModalTitle")}</h2>
                  <p className="mt-2 text-sm text-[var(--landing-muted)]">{dash(locale, "ptModalBody")}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setPersonalTrainerModalOpen(false)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[var(--landing-muted)] transition hover:bg-[var(--landing-surface)] hover:text-[var(--foreground)]"
                  aria-label="Cerrar modal"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <p className="text-xs text-[var(--landing-muted)]">{dash(locale, "ptModalFootnote")}</p>
              <div className="mt-5">
                <p className="text-sm font-medium text-[var(--foreground)]">{dash(locale, "ptChooseTrainer")}</p>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setTrainerPreference("hombre")}
                    className={`rounded-xl border p-4 text-left transition-all ${
                      trainerPreference === "hombre"
                        ? "border-[color-mix(in_oklab,var(--brand-end)_50%,transparent)] bg-[color-mix(in_oklab,var(--brand-end)_15%,transparent)] shadow-[0_10px_28px_-16px_rgba(16,185,129,0.45)]"
                        : "border-[var(--landing-border)] bg-[var(--landing-surface)] hover:bg-[var(--landing-surface-2)]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-[var(--foreground)]">{dash(locale, "ptMaleTitle")}</p>
                      <span className="rounded-full border border-[color-mix(in_oklab,var(--brand-end)_45%,transparent)] bg-[color-mix(in_oklab,var(--brand-end)_15%,transparent)] px-2 py-0.5 text-[11px] text-[var(--foreground)]">
                        {dash(locale, "ptMaleBadge")}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-[var(--landing-muted)]">{dash(locale, "ptMaleDesc")}</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTrainerPreference("mujer")}
                    className={`rounded-xl border p-4 text-left transition-all ${
                      trainerPreference === "mujer"
                        ? "border-[color-mix(in_oklab,var(--landing-accent)_50%,transparent)] bg-[color-mix(in_oklab,var(--landing-accent)_16%,transparent)] shadow-[0_10px_28px_-16px_color-mix(in_oklab,var(--landing-accent)_50%,transparent)]"
                        : "border-[var(--landing-border)] bg-[var(--landing-surface)] hover:bg-[var(--landing-surface-2)]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-[var(--foreground)]">{dash(locale, "ptFemaleTitle")}</p>
                      <span className="rounded-full border border-[color-mix(in_oklab,var(--landing-accent)_45%,transparent)] bg-[color-mix(in_oklab,var(--landing-accent)_15%,transparent)] px-2 py-0.5 text-[11px] text-[var(--foreground)]">
                        {dash(locale, "ptFemaleBadge")}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-[var(--landing-muted)]">{dash(locale, "ptFemaleDesc")}</p>
                  </button>
                </div>
              </div>
              <label className="mt-4 block text-xs text-[var(--landing-muted)]">{dash(locale, "ptOptionalGoal")}</label>
              <textarea
                value={personalTrainerReason}
                onChange={(e) => setPersonalTrainerReason(e.target.value)}
                maxLength={500}
                rows={3}
                className="mt-2 w-full rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--landing-muted)]/70 focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklab,var(--landing-accent)_28%,transparent)]"
                placeholder={dash(locale, "ptGoalPlaceholder")}
              />
              <p className="mt-1 text-[11px] text-[var(--landing-muted)]">{personalTrainerReason.length}/500</p>

              <div className="mt-6 flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setPersonalTrainerModalOpen(false);
                    setPersonalTrainerReason("");
                    setTrainerPreference(null);
                  }}
                  className="flex-1 rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface)] px-4 py-2 text-sm text-[var(--foreground)] transition-colors hover:bg-[var(--landing-surface-2)]"
                >
                  {dash(locale, "ptNoThanks")}
                </button>
                <button
                  type="button"
                  onClick={handleRequestPersonalTrainer}
                  disabled={personalTrainerLoading || !trainerPreference}
                  className="flex-1 rounded-xl bg-gradient-to-r from-[var(--brand-start,#3b82f6)] to-[var(--brand-end,#10b981)] px-4 py-2 text-sm font-medium text-white transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {personalTrainerLoading ? dash(locale, "ptProcessing") : dash(locale, "ptYesWant")}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
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

function ProgressModalContent({ plan, onClose, locale }: { plan: SavedPlan; onClose: () => void; locale: AppLocale }) {
  const user = plan.plan?.user;
  const planData = plan.plan?.plan;
  const planId = plan.id;
  const dateLoc = locale === "en" ? "en-US" : "es-ES";
  
  const [registrosPeso, setRegistrosPeso] = useState<RegistroPeso[]>([]);
  const [nuevoPeso, setNuevoPeso] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mostrarConfirmacion, setMostrarConfirmacion] = useState(false);
  const [registroAEliminar, setRegistroAEliminar] = useState<RegistroPeso | null>(null);
  const [eliminando, setEliminando] = useState(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  
  const persistWeightCache = useCallback((records: RegistroPeso[]) => {
    if (typeof window === "undefined" || !planId) return;
    localStorage.setItem(`peso_${planId}`, JSON.stringify(records.map((r) => ({ fecha: r.fecha, peso: r.peso }))));
  }, [planId]);

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
            
            const pendingOps = loadPendingWeightOps(planId);
            const merged = applyPendingWeightOps(registrosLimpios, pendingOps);
            setRegistrosPeso(merged);
            persistWeightCache(merged);
            if (pendingOps.length > 0) {
              try {
                await updateDoc(planRef, {
                  registrosPeso: merged.map((r) => ({
                    fecha: r.fecha,
                    peso: r.peso,
                    timestamp: new Date(r.fecha),
                  })),
                  updatedAt: serverTimestamp(),
                });
                clearPendingWeightOps(planId);
                setSyncNotice(
                  locale === "en"
                    ? "Pending weight entries synced successfully."
                    : "Los registros de peso pendientes se sincronizaron correctamente."
                );
              } catch (syncError) {
                console.warn("No se pudieron sincronizar registros pendientes:", syncError);
                setSyncNotice(
                  locale === "en"
                    ? "Weights saved on this device. They will sync when connection is stable."
                    : "Los pesos quedaron guardados en este dispositivo y se sincronizaran cuando vuelva la conexion."
                );
              }
            } else {
              setSyncNotice(null);
            }
          } else {
            // Si no hay en Firestore, intentar cargar desde localStorage (migración)
            const stored = localStorage.getItem(`peso_${planId}`);
            if (stored) {
              try {
                const localRegistros = JSON.parse(stored);
                const registrosLimpios = limpiarDuplicados(localRegistros);
                const pendingOps = loadPendingWeightOps(planId);
                const merged = applyPendingWeightOps(registrosLimpios, pendingOps);
                setRegistrosPeso(merged);
                // Migrar a Firestore (solo si hay registros)
                if (merged.length > 0) {
                  await updateDoc(planRef, {
                    registrosPeso: merged.map((r: { fecha: string; peso: number }) => ({
                      fecha: r.fecha,
                      peso: r.peso,
                      timestamp: new Date(r.fecha) // Usar Date object en lugar de serverTimestamp()
                    })),
                    updatedAt: serverTimestamp()
                  });
                  clearPendingWeightOps(planId);
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
            const merged = applyPendingWeightOps(registrosLimpios, loadPendingWeightOps(planId));
            setRegistrosPeso(merged);
            setSyncNotice(
              locale === "en"
                ? "Showing locally saved weight entries while reconnecting."
                : "Mostrando registros de peso guardados localmente mientras se restablece la conexion."
            );
          } catch {
            setRegistrosPeso([]);
          }
        }
      } finally {
        setLoading(false);
      }
    };
    
    loadRegistrosPeso();
  }, [locale, persistWeightCache, planId]);
  
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
          
          persistWeightCache(nuevosRegistros);
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
        persistWeightCache(nuevosRegistros);
        enqueueWeightOp({
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          planId,
          type: "upsert",
          fecha: fechaISO,
          peso,
          createdAt: new Date().toISOString(),
        });
        setSyncNotice(
          locale === "en"
            ? "Weight saved locally. It will sync automatically."
            : "Peso guardado localmente. Se sincronizara automaticamente."
        );
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
      persistWeightCache(nuevosRegistros);
      enqueueWeightOp({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        planId,
        type: "upsert",
        fecha: fechaISO,
        peso,
        createdAt: new Date().toISOString(),
      });
      setSyncNotice(
        locale === "en"
          ? "Weight saved locally. It will sync automatically."
          : "Peso guardado localmente. Se sincronizara automaticamente."
      );
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
          persistWeightCache(nuevosRegistros);
        }
      } else {
        // Si no hay Firebase, eliminar solo del estado local
        const nuevosRegistros = registrosPeso.filter(r => 
          !(r.fecha === registroAEliminar.fecha && Math.abs(r.peso - registroAEliminar.peso) < 0.01)
        );
        setRegistrosPeso(nuevosRegistros);
        persistWeightCache(nuevosRegistros);
        enqueueWeightOp({
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          planId,
          type: "delete",
          fecha: registroAEliminar.fecha,
          createdAt: new Date().toISOString(),
        });
        setSyncNotice(
          locale === "en"
            ? "Deletion saved locally. It will sync automatically."
            : "Eliminacion guardada localmente. Se sincronizara automaticamente."
        );
      }
      
      // Cerrar modal y resetear
      setMostrarConfirmacion(false);
      setRegistroAEliminar(null);
    } catch (error) {
      console.error("Error al eliminar peso de Firestore:", error);
      const nuevosRegistros = registrosPeso.filter(r => 
        !(r.fecha === registroAEliminar.fecha && Math.abs(r.peso - registroAEliminar.peso) < 0.01)
      );
      setRegistrosPeso(nuevosRegistros);
      persistWeightCache(nuevosRegistros);
      enqueueWeightOp({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        planId,
        type: "delete",
        fecha: registroAEliminar.fecha,
        createdAt: new Date().toISOString(),
      });
      setSyncNotice(
        locale === "en"
          ? "Deletion saved locally. It will sync automatically."
          : "Eliminacion guardada localmente. Se sincronizara automaticamente."
      );
      setMostrarConfirmacion(false);
      setRegistroAEliminar(null);
    } finally {
      setEliminando(false);
    }
  };

  const duracionPlan =
    typeof planData?.duracion_plan_dias === "number"
      ? planData.duracion_plan_dias
      : Number(planData?.duracion_plan_dias) || 30;
  const pct = Math.min(100, Math.max(0, progresoPlan.porcentaje));

  return (
    <div className="relative px-5 pb-6 pt-5 sm:px-7 sm:pb-8 sm:pt-6">
      {syncNotice ? (
        <div className="mb-3 rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          {syncNotice}
        </div>
      ) : null}
      <div className="flex items-start justify-between gap-4 border-b border-[color-mix(in_oklab,var(--foreground)_8%,transparent)] pb-5">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--landing-muted)]">
            FitPlan AI
          </p>
          <h2 className="mt-1 text-xl font-bold tracking-tight text-[var(--foreground)] sm:text-2xl">
            {dash(locale, "progressModalTitle")}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface)] p-2 text-[var(--landing-muted)] transition hover:border-[color-mix(in_oklab,var(--landing-accent)_35%,transparent)] hover:text-[var(--foreground)]"
          aria-label={dash(locale, "modalClose")}
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
      </div>

      <div className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-5">
          <div
            className="relative h-[5.25rem] w-[5.25rem] shrink-0 rounded-full p-[3px]"
            style={{
              background: `conic-gradient(from -90deg, color-mix(in oklab, var(--landing-accent) 88%, white) 0%, color-mix(in oklab, var(--landing-accent) 88%, white) ${pct}%, color-mix(in oklab, var(--foreground) 12%, transparent) ${pct}%, color-mix(in oklab, var(--foreground) 12%, transparent) 100%)`,
            }}
          >
            <div className="flex h-full w-full items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--background)_92%,#0c1018)] text-center ring-1 ring-[color-mix(in_oklab,var(--foreground)_8%,transparent)]">
              <div>
                <p className="text-2xl font-bold tabular-nums text-[var(--foreground)]">{pct.toFixed(0)}%</p>
                <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--landing-muted)]">
                  {dash(locale, "simplePlanProgress")}
                </p>
              </div>
            </div>
          </div>
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-semibold text-[var(--foreground)]">
              {plan.isOldest ? dash(locale, "planBase") : goalLabel(locale, user?.objetivo as string | undefined)}
            </p>
            <p className="text-sm text-[var(--landing-muted)]">
              {dash(locale, "progressDaysElapsed")}{" "}
              <span className="font-medium text-[var(--foreground)]/90">
                {progresoPlan.diasTranscurridos} / {duracionPlan}
              </span>
            </p>
          </div>
        </div>
        <div className="grid flex-1 grid-cols-2 gap-3 sm:max-w-md">
          <div className="rounded-xl border border-[var(--landing-border)] bg-[color-mix(in_oklab,var(--foreground)_4%,transparent)] px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--landing-muted)]">
              {dash(locale, "progressInitialWeight")}
            </p>
            <p className="mt-0.5 text-sm font-semibold text-[var(--foreground)]">
              {typeof user?.pesoKg === "number" ? user.pesoKg : Number(user?.pesoKg) || 0} kg
            </p>
          </div>
          <div className="rounded-xl border border-[var(--landing-border)] bg-[color-mix(in_oklab,var(--foreground)_4%,transparent)] px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--landing-muted)]">
              {dash(locale, "progressPlanPercent")}
            </p>
            <p className="mt-0.5 text-sm font-semibold text-[var(--foreground)]">{pct.toFixed(0)}%</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="mt-8 flex items-center justify-center gap-3 py-12">
          <div className="relative h-10 w-10">
            <div className="absolute inset-0 rounded-full bg-[color-mix(in_oklab,var(--landing-accent)_25%,transparent)] blur-md" />
            <div className="relative h-full w-full animate-spin rounded-full border-2 border-[color-mix(in_oklab,var(--landing-accent)_55%,transparent)] border-t-transparent" />
          </div>
          <span className="text-sm text-[var(--landing-muted)]">{dash(locale, "progressLoadingRecords")}</span>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-[var(--landing-border)] bg-[color-mix(in_oklab,var(--foreground)_3%,transparent)] p-4 sm:p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--landing-muted)]">
              {dash(locale, "progressRegisterMonthly")}
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <input
                type="number"
                value={nuevoPeso}
                onChange={(e) => setNuevoPeso(e.target.value)}
                placeholder={dashFmt(locale, "progressWeightPlaceholder", {
                  n: typeof user?.pesoKg === "number" ? user.pesoKg : Number(user?.pesoKg) || 0,
                })}
                step="0.1"
                className="min-w-0 flex-1 rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface)] px-3.5 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--landing-muted)] focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklab,var(--landing-accent)_50%,transparent)]"
                onKeyPress={(e) => {
                  if (e.key === "Enter") {
                    handleGuardarPeso();
                  }
                }}
              />
              <button
                type="button"
                onClick={handleGuardarPeso}
                disabled={guardando}
                className="shrink-0 rounded-xl bg-gradient-to-r from-[var(--brand-start)] via-[var(--brand-mid)] to-[var(--brand-end)] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_10px_32px_-16px_color-mix(in_oklab,var(--brand-mid)_45%,transparent)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {guardando ? dash(locale, "progressSaving") : dash(locale, "progressSave")}
              </button>
            </div>
          
            {registrosPeso.length > 0 && (
              <div className="mt-5 space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--landing-muted)]">
                  {dash(locale, "progressHistory")}
                </p>
                <div className="max-h-44 space-y-1.5 overflow-y-auto pr-0.5">
                  {registrosPeso
                    .sort((a, b) => b.fecha.localeCompare(a.fecha))
                    .map((registro, idx) => {
                      const [año, mes, dia] = registro.fecha.split("-").map(Number);
                      const fecha = new Date(año, mes - 1, dia);
                      const pesoInicial = typeof user?.pesoKg === "number" ? user.pesoKg : Number(user?.pesoKg) || 0;
                      const diferencia = pesoInicial ? registro.peso - pesoInicial : 0;
                      const objetivo = user?.objetivo || "mantener";
                      const esPositivo =
                        objetivo === "ganar_masa" || objetivo === "volumen"
                          ? diferencia > 0
                          : objetivo === "perder_grasa" || objetivo === "corte"
                            ? diferencia < 0
                            : Math.abs(diferencia) < 1;

                      return (
                        <div
                          key={idx}
                          className="group flex items-center justify-between gap-2 rounded-xl border border-[color-mix(in_oklab,var(--foreground)_6%,transparent)] bg-[var(--landing-surface)] px-3 py-2 text-xs transition hover:border-[color-mix(in_oklab,var(--landing-accent)_28%,transparent)]"
                        >
                          <span className="text-[var(--landing-muted)]">
                            {fecha.toLocaleDateString(dateLoc, { day: "numeric", month: "short", year: "numeric" })}
                          </span>
                          <span className="font-semibold text-[var(--foreground)]">{registro.peso} kg</span>
                          {(() => {
                            const peso = user?.pesoKg;
                            return Boolean(peso && typeof peso === "number");
                          })() ? (
                            <span className={`text-xs font-medium ${esPositivo ? "text-emerald-400" : "text-amber-400"}`}>
                              {diferencia > 0 ? "+" : ""}
                              {diferencia.toFixed(1)} kg
                            </span>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => {
                              setRegistroAEliminar(registro);
                              setMostrarConfirmacion(true);
                            }}
                            className="rounded-lg p-1.5 text-red-400/90 opacity-80 transition hover:bg-red-500/15 hover:opacity-100"
                            title={dash(locale, "deleteWeightRecord")}
                            aria-label={dash(locale, "deleteWeightRecord")}
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

          <div className="rounded-2xl border border-[var(--landing-border)] bg-[color-mix(in_oklab,var(--foreground)_3%,transparent)] p-4 sm:p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--landing-muted)]">
              {dash(locale, "progressWeightChart")}
            </p>
            {registrosPeso.length > 0 && user?.pesoKg && typeof user.pesoKg === "number" ? (
              <div className="mt-4 space-y-3">
                <div className="flex h-36 items-end justify-between gap-1.5 rounded-xl border border-[color-mix(in_oklab,var(--foreground)_8%,transparent)] bg-[color-mix(in_oklab,var(--background)_55%,transparent)] px-2 pb-1 pt-3">
                  {registrosPeso
                    .sort((a, b) => a.fecha.localeCompare(b.fecha))
                    .slice(-6)
                    .map((registro, idx) => {
                      const pesoInicialNum = typeof user.pesoKg === "number" ? user.pesoKg : Number(user.pesoKg) || 0;
                      const pesos = registrosPeso
                        .sort((a, b) => a.fecha.localeCompare(b.fecha))
                        .slice(-6)
                        .map((r) => r.peso);
                      const maxPeso = Math.max(...pesos, pesoInicialNum);
                      const minPeso = Math.min(...pesos, pesoInicialNum);
                      const rango = maxPeso - minPeso || 1;
                      const altura = ((registro.peso - minPeso) / rango) * 100;
                      const diferencia = registro.peso - pesoInicialNum;

                      return (
                        <div key={idx} className="flex flex-1 flex-col items-center gap-1.5">
                          <div className="flex h-full w-full items-end justify-center">
                            <div
                              className={`w-full max-w-[2.75rem] rounded-t-md shadow-sm transition-all ${
                                diferencia > 0
                                  ? "bg-emerald-500/90"
                                  : diferencia < 0
                                    ? "bg-rose-500/85"
                                    : "bg-[color-mix(in_oklab,var(--landing-accent)_70%,white)]"
                              }`}
                              style={{ height: `${Math.max(12, altura)}%` }}
                              title={`${registro.peso} kg (${diferencia > 0 ? "+" : ""}${diferencia.toFixed(1)} kg)`}
                            />
                          </div>
                          <span className="text-[10px] text-[var(--landing-muted)]">
                            {(() => {
                              const [año, mes, dia] = registro.fecha.split("-").map(Number);
                              const fechaLocal = new Date(año, mes - 1, dia);
                              return fechaLocal.toLocaleDateString(dateLoc, { day: "numeric", month: "short" });
                            })()}
                          </span>
                        </div>
                      );
                    })}
                </div>
                <div className="flex items-center justify-between border-t border-[color-mix(in_oklab,var(--foreground)_10%,transparent)] pt-3 text-xs text-[var(--landing-muted)]">
                  <span>{dashFmt(locale, "progressChartInitial", { n: user.pesoKg })}</span>
                  {registrosPeso.length > 0 && (
                    <span>
                      {dashFmt(locale, "progressChartLast", {
                        n: registrosPeso.sort((a, b) => b.fecha.localeCompare(a.fecha))[0].peso,
                      })}
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="mt-4 flex h-36 items-center justify-center rounded-xl border border-dashed border-[var(--landing-border)] bg-[var(--landing-surface)] text-center text-xs text-[var(--landing-muted)]">
                {dash(locale, "progressChartEmpty")}
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
              className="fixed inset-0 z-[10001] bg-black/75 backdrop-blur-md"
            />
            <div className="pointer-events-none fixed inset-0 z-[10002] flex items-center justify-center p-3 sm:p-4">
              <motion.div
                initial={{ scale: 0.96, opacity: 0, y: 10 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.96, opacity: 0, y: 10 }}
                transition={{ type: "spring", damping: 26, stiffness: 360 }}
                onClick={(e) => e.stopPropagation()}
                className="pointer-events-auto w-full max-w-md overflow-hidden rounded-2xl border border-[var(--landing-border)] bg-[color-mix(in_oklab,var(--background)_90%,#0a0f18)] p-6 shadow-[0_32px_80px_-36px_rgba(0,0,0,0.9)] ring-1 ring-[color-mix(in_oklab,var(--foreground)_6%,transparent)]"
              >
                <div className="mb-4">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-red-500/35 bg-red-500/10">
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
                  <h2 className="mb-2 text-center text-lg font-semibold text-[var(--foreground)]">
                    {dash(locale, "deleteWeightTitle")}
                  </h2>
                  <p className="mb-3 text-center text-sm text-[var(--landing-muted)]">
                    {dashFmt(locale, "deleteWeightBody", {
                      date: (() => {
                        const [año, mes, dia] = registroAEliminar.fecha.split("-").map(Number);
                        const fecha = new Date(año, mes - 1, dia);
                        return fecha.toLocaleDateString(dateLoc, { day: "numeric", month: "short", year: "numeric" });
                      })(),
                      kg: registroAEliminar.peso,
                    })}
                  </p>
                  <p className="text-center text-xs text-[var(--landing-muted)]/85">{dash(locale, "deleteWeightUndo")}</p>
                </div>

                <div className="mt-6 flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setMostrarConfirmacion(false);
                      setRegistroAEliminar(null);
                    }}
                    disabled={eliminando}
                    className="flex-1 rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface)] px-4 py-2.5 text-sm font-medium text-[var(--foreground)] transition hover:border-[color-mix(in_oklab,var(--foreground)_14%,transparent)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {dash(locale, "cancel")}
                  </button>
                  <button
                    type="button"
                    onClick={handleEliminarPeso}
                    disabled={eliminando}
                    className="flex-1 rounded-xl border border-red-500/40 bg-red-500/15 px-4 py-2.5 text-sm font-medium text-red-300 transition hover:bg-red-500/25 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {eliminando ? dash(locale, "deleting") : dash(locale, "deleteVerb")}
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

