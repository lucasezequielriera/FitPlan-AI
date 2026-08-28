import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import dynamic from "next/dynamic";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { createPortal } from "react-dom";
import { FaCrown, FaUserFriends, FaWeight } from "react-icons/fa";
import { useAuthStore } from "@/store/authStore";
import { usePlanStore } from "@/store/planStore";
import { getDbSafe, getAuthSafe } from "@/lib/firebase";
import { collection, query, where, getDocs, limit, Timestamp, doc, deleteDoc, updateDoc, serverTimestamp, getDoc } from "firebase/firestore";
import Navbar from "@/components/Navbar";
import { useAppLocale, type AppLocale } from "@/contexts/AppLocaleContext";
import { dash, dashFmt, goalLabel } from "@/lib/i18n/appUi";
import type { RegistroPeso, SavedPlan } from "@/types/savedPlan";
import { DashboardPlanHero } from "@/components/dashboard/DashboardPlanHero";
import { DashboardPlanRow } from "@/components/dashboard/DashboardPlanRow";
import { loadCachedDashboardPlans, saveCachedDashboardPlans } from "@/lib/planLocalCache";
import { applyPendingWeightOps, clearPendingWeightOps, enqueueWeightOp, loadPendingWeightOps } from "@/lib/weightSyncQueue";
import { MODAL_BACKDROP_CLASS, MODAL_BACKDROP_MOTION, MODAL_PANEL_CLASS, MODAL_PANEL_MOTION } from "@/lib/modalShell";

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
  const [quickWeightValue, setQuickWeightValue] = useState("");
  const [quickWeightSaving, setQuickWeightSaving] = useState(false);
  const [quickWeightNotice, setQuickWeightNotice] = useState<string | null>(null);
  // Disclosure de "Registrar peso" en mobile (DESIGN_SYSTEM.md §13.10.8/§13.10.9) — antes
  // el botón abría el mismo modal que "Progreso" sin registrar nada. Estado separado del
  // de la sidebar de desktop para no compartir foco/notice entre las dos superficies.
  const [mobileWeightOpen, setMobileWeightOpen] = useState(false);
  const reduceMotion = useReducedMotion();

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

  // Carga rápida de peso desde la sidebar de desktop (DESIGN_SYSTEM.md §13.3)
  // — mismo criterio de "upsert por fecha" que usa el formulario completo del
  // modal de progreso, pero sin abrir el modal ni depender de su estado local.
  const handleQuickSaveWeight = async (planId: string) => {
    const peso = parseFloat(quickWeightValue);
    if (isNaN(peso) || peso <= 0) {
      setQuickWeightNotice(dash(locale, "sidebarWeightError"));
      return;
    }
    setQuickWeightSaving(true);
    setQuickWeightNotice(null);
    try {
      const db = getDbSafe();
      if (!db) throw new Error("no-db");
      const fechaActual = new Date();
      const año = fechaActual.getFullYear();
      const mes = String(fechaActual.getMonth() + 1).padStart(2, "0");
      const dia = String(fechaActual.getDate()).padStart(2, "0");
      const fechaISO = `${año}-${mes}-${dia}`;

      const planRef = doc(db, "planes", planId);
      const planDoc = await getDoc(planRef);
      const registrosActuales: RegistroPeso[] = planDoc.exists() ? planDoc.data().registrosPeso || [] : [];
      const nuevoRegistro = { fecha: fechaISO, peso, timestamp: fechaActual };
      const idx = registrosActuales.findIndex((r) => r.fecha === fechaISO);
      const registrosActualizados =
        idx >= 0
          ? registrosActuales.map((r, i) => (i === idx ? nuevoRegistro : r))
          : [...registrosActuales, nuevoRegistro];

      await updateDoc(planRef, { registrosPeso: registrosActualizados, updatedAt: serverTimestamp() });
      setQuickWeightValue("");
      setQuickWeightNotice(dash(locale, "sidebarWeightSaved"));
    } catch (err) {
      console.error("Error al guardar peso rápido:", err);
      setQuickWeightNotice(dash(locale, "sidebarWeightError"));
    } finally {
      setQuickWeightSaving(false);
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

  // Jerarquía de la reestructuración (DESIGN_SYSTEM.md §13.2): el plan activo
  // es el más reciente no completado (o el único, para la mayoría de usuarios)
  // — el resto es historial de referencia, no la tarea principal.
  const activePlan = plans.find((p) => !p.completado) ?? plans[0] ?? null;
  const otherPlans = activePlan ? plans.filter((p) => p.id !== activePlan.id) : [];
  const hasOtherPlans = otherPlans.length > 0;

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
      {/* Padding inferior reservado para la tab bar de cliente de DESIGN_SYSTEM.md
          §11.4-B (implementada en Navbar.tsx) — mismo mecanismo de variable CSS
          medida que usa AdminShell.tsx para `--admin-bottom-nav-h` (ver
          globals.css). `Navbar` publica `--client-bottom-nav-h` con
          ResizeObserver mientras la tab bar está montada; el fallback de 4rem
          cubre el instante antes de que ese efecto corra. Solo aplica en
          mobile (`< md`), que es donde vive esa barra fija (`md:hidden`). */}
      <div className="relative z-[1] px-3 py-6 pb-[calc(var(--client-bottom-nav-h,4rem)+env(safe-area-inset-bottom))] sm:px-5 sm:py-10 md:px-8 md:pb-10 max-w-full overflow-x-hidden">
        <div className="mx-auto max-w-6xl w-full">
          {cacheNotice ? (
            <div className="mb-4 rounded-xl border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
              {cacheNotice}
            </div>
          ) : null}
          {/* Nunca `initial: { opacity: 0 }` (DESIGN_SYSTEM.md §12) — anima solo posición. */}
          <motion.div initial={{ y: 16 }} animate={{ y: 0 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }} className="relative">
            <div className="relative w-full overflow-x-hidden">
              {/* Header mínimo — sin CTAs compitiendo (DESIGN_SYSTEM.md §13.2-A) */}
              <header className="mb-6 sm:mb-8">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-text-subtle">FitPlan</p>
                <h1 className="font-display mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                  {dash(locale, "heading")}
                </h1>
                <p className="mt-1 text-sm text-text-muted sm:text-base">{dash(locale, "subtitle")}</p>
              </header>

              {personalTrainerNotice && (
                <div className="mb-6 rounded-2xl border border-success/30 bg-success/10 px-4 py-3 text-sm leading-relaxed text-foreground">
                  {personalTrainerNotice}
                </div>
              )}

              {error && (
                <div className="mb-6 rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
                  {error}
                </div>
              )}

              {plans.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border bg-surface px-6 py-14 text-center">
                  <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-2 ring-1 ring-border">
                    <span className="text-4xl" aria-hidden>
                      📋
                    </span>
                  </div>
                  <h2 className="font-display text-xl font-semibold text-foreground">{dash(locale, "noPlansTitle")}</h2>
                  <p className="mx-auto mt-2 max-w-md text-sm text-text-muted">{dash(locale, "noPlansBody")}</p>
                  <button type="button" onClick={handleCreateNew} className="btn btn-primary mx-auto mt-8">
                    {dash(locale, "createFirst")}
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px] lg:gap-6">
                  {/* Columna principal (DESIGN_SYSTEM.md §13.3) */}
                  <div className="flex flex-col gap-5">
                    {activePlan && (
                      <DashboardPlanHero
                        plan={activePlan}
                        locale={locale}
                        onOpenPlan={() => handlePlanClick(activePlan)}
                        onProgressClick={(e) => {
                          e.stopPropagation();
                          setPlanForProgress(activePlan);
                          setProgressModalOpen(true);
                        }}
                        onContinuityClick={(e) => {
                          e.stopPropagation();
                          setPlanForContinuity(activePlan);
                          setContinuityModalOpen(true);
                        }}
                        calculateProgress={calculateProgress}
                        calculateDaysRemaining={calculateDaysRemaining}
                      />
                    )}

                    {/* Acciones rápidas — visibles siempre, con más presencia en mobile (§13.3).
                        "Registrar peso" ya no abre el mismo modal que "Progreso" (DESIGN_SYSTEM.md
                        §13.10.8): despliega una carga inline, mismo patrón/handler que ya usa la
                        sidebar de desktop (`handleQuickSaveWeight`), sin ser un botón que promete
                        algo que no cumple. */}
                    {activePlan && (
                      <div className="lg:hidden">
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              setPlanForProgress(activePlan);
                              setProgressModalOpen(true);
                            }}
                            className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-border bg-surface px-4 py-3 text-sm font-medium text-foreground transition hover:border-accent/30"
                          >
                            {dash(locale, "cardOpenProgress")}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setQuickWeightNotice(null);
                              setMobileWeightOpen((v) => !v);
                            }}
                            aria-expanded={mobileWeightOpen}
                            className={`flex min-h-[44px] items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition ${
                              mobileWeightOpen
                                ? "border-accent/40 bg-accent/12 text-accent"
                                : "border-border bg-surface text-foreground hover:border-accent/30"
                            }`}
                          >
                            {dash(locale, "quickActionWeight")}
                          </button>
                        </div>

                        {/* Contenido montado recién al tocar el botón (no está en el HTML
                            inicial): no es el patrón prohibido de `initial: { opacity: 0 }`
                            sobre contenido que pinta sin interacción — mismo criterio que
                            ExerciseSetTracker.tsx/plan.tsx para disclosures gatilladas por
                            el usuario. */}
                        <AnimatePresence initial={false}>
                          {mobileWeightOpen && (
                            <motion.div
                              initial={reduceMotion ? undefined : { height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={reduceMotion ? undefined : { height: 0, opacity: 0 }}
                              transition={{ duration: reduceMotion ? 0 : 0.2 }}
                              className="overflow-hidden"
                            >
                              <div className="mt-3 rounded-xl border border-border bg-surface p-3">
                                <div className="flex gap-2">
                                  <input
                                    type="number"
                                    step="0.1"
                                    value={quickWeightValue}
                                    onChange={(e) => setQuickWeightValue(e.target.value)}
                                    placeholder="kg"
                                    autoFocus
                                    className="min-w-0 flex-1 rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-foreground placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-accent/40"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleQuickSaveWeight(activePlan.id)}
                                    disabled={quickWeightSaving}
                                    className="btn btn-secondary shrink-0 px-3"
                                  >
                                    {quickWeightSaving ? dash(locale, "progressSaving") : dash(locale, "progressSave")}
                                  </button>
                                </div>
                                {quickWeightNotice && <p className="mt-2 text-xs text-text-muted">{quickWeightNotice}</p>}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}

                    {(hasOtherPlans || isPremium) && (
                      <section className="card-surface p-4 sm:p-5">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-text-subtle">
                            {dash(locale, "otherPlansTitle")}
                          </p>
                          {isPremium && (
                            <button type="button" onClick={handleCreateNew} className="btn btn-secondary px-3 py-1.5 text-xs">
                              {dash(locale, "newPlanShort")}
                            </button>
                          )}
                        </div>
                        {hasOtherPlans ? (
                          <div className="divide-y divide-border">
                            {otherPlans.map((plan) => (
                              <DashboardPlanRow
                                key={plan.id}
                                plan={plan}
                                locale={locale}
                                isPremium={isPremium}
                                onRowClick={() => handlePlanClick(plan)}
                                onDeleteClick={(e) => handleDeleteClick(e, plan)}
                                calculateProgress={calculateProgress}
                              />
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-text-muted">{dash(locale, "otherPlansEmpty")}</p>
                        )}
                      </section>
                    )}

                    {/* Franja de upsell — al final, no compite con el contenido principal (§13.2-D) */}
                    {!isPremium && (
                      <section className="card-surface flex flex-col items-start justify-between gap-3 p-4 sm:flex-row sm:items-center sm:p-5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/12 text-accent">
                            <FaCrown className="h-4 w-4" aria-hidden />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-foreground">{dash(locale, "upsellPremiumTitle")}</p>
                            <p className="text-xs text-text-muted">{dash(locale, "upsellPremiumBody")}</p>
                          </div>
                        </div>
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
                          className="btn btn-primary w-full sm:w-auto"
                        >
                          {dash(locale, "viewPremiumPlans")}
                        </button>
                      </section>
                    )}

                    {/* Enlace secundario a entrenador personal — no compite con el hero (§13.3) */}
                    <div className="lg:hidden">
                      {personalTrainerAssigned ? (
                        <button
                          type="button"
                          onClick={() => window.open(trainerWhatsappUrl, "_blank", "noopener,noreferrer")}
                          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-surface px-4 py-3 text-xs font-medium text-text-muted transition hover:border-accent/30 hover:text-foreground"
                        >
                          <FaUserFriends className="h-3.5 w-3.5" aria-hidden />
                          {dash(locale, "contactTrainer")}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setPersonalTrainerModalOpen(true)}
                          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-surface px-4 py-3 text-xs font-medium text-text-muted transition hover:border-accent/30 hover:text-foreground"
                        >
                          <FaUserFriends className="h-3.5 w-3.5" aria-hidden />
                          {dash(locale, "requestTrainer")}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Sidebar — solo desktop, usa el ancho que mobile no tiene (§13.3) */}
                  <aside className="hidden flex-col gap-4 lg:flex">
                    {!isPremium && (
                      <SidebarCard icon={<FaCrown className="h-4 w-4" aria-hidden />} title={dash(locale, "upsellPremiumTitle")} body={dash(locale, "upsellPremiumBody")}>
                        <button
                          type="button"
                          onClick={() => {
                            if (!authUser) {
                              alert(dash(locale, "registerPremium"));
                              return;
                            }
                            setPremiumModalOpen(true);
                          }}
                          className="btn btn-primary mt-3 w-full"
                        >
                          {dash(locale, "viewPremiumPlans")}
                        </button>
                      </SidebarCard>
                    )}
                    {activePlan && (
                      <SidebarCard icon={<FaWeight className="h-4 w-4" aria-hidden />} title={dash(locale, "sidebarWeightTitle")} body={dash(locale, "sidebarWeightBody")}>
                        <div className="mt-3 flex gap-2">
                          <input
                            type="number"
                            step="0.1"
                            value={quickWeightValue}
                            onChange={(e) => setQuickWeightValue(e.target.value)}
                            placeholder="kg"
                            className="min-w-0 flex-1 rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-foreground placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-accent/40"
                          />
                          <button
                            type="button"
                            onClick={() => handleQuickSaveWeight(activePlan.id)}
                            disabled={quickWeightSaving}
                            className="btn btn-secondary shrink-0 px-3"
                          >
                            {quickWeightSaving ? dash(locale, "progressSaving") : dash(locale, "progressSave")}
                          </button>
                        </div>
                        {quickWeightNotice && <p className="mt-2 text-xs text-text-muted">{quickWeightNotice}</p>}
                      </SidebarCard>
                    )}
                    <SidebarCard icon={<FaUserFriends className="h-4 w-4" aria-hidden />} title={dash(locale, "sidebarTrainerTitle")} body={dash(locale, "sidebarTrainerBody")}>
                      {personalTrainerAssigned ? (
                        <button
                          type="button"
                          onClick={() => window.open(trainerWhatsappUrl, "_blank", "noopener,noreferrer")}
                          className="btn btn-secondary mt-3 w-full"
                        >
                          {dash(locale, "sidebarTrainerContact")}
                        </button>
                      ) : (
                        <button type="button" onClick={() => setPersonalTrainerModalOpen(true)} className="btn btn-secondary mt-3 w-full">
                          {dash(locale, "sidebarTrainerRequest")}
                        </button>
                      )}
                    </SidebarCard>
                  </aside>
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
                {...MODAL_BACKDROP_MOTION}
                onClick={handleCancelDelete}
                className={`${MODAL_BACKDROP_CLASS} z-[9999]`}
              />

              {/* Modal */}
              <div
                className="pointer-events-none fixed inset-0 z-[10000] flex items-center justify-center p-4"
              >
                <motion.div
                  {...MODAL_PANEL_MOTION}
                  onClick={(e) => e.stopPropagation()}
                  className={`pointer-events-auto w-full max-w-md p-6 ${MODAL_PANEL_CLASS}`}
                >
                  <div className="mb-4">
                    <div className="flex items-center justify-center w-12 h-12 rounded-full bg-danger/20 mb-4 mx-auto">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-6 w-6 text-danger"
                      >
                        <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </div>
                    <h2 className="font-display text-xl font-semibold mb-2 text-center">
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
                      className="flex-1 px-4 py-2 rounded-lg bg-danger/20 hover:bg-danger/30 border border-danger/30 text-danger hover:text-[var(--danger-strong)] text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                {...MODAL_BACKDROP_MOTION}
                onClick={() => setProgressModalOpen(false)}
                className={`${MODAL_BACKDROP_CLASS} z-[9999]`}
              />
              <div className="pointer-events-none fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-4">
                <motion.div
                  {...MODAL_PANEL_MOTION}
                  onClick={(e) => e.stopPropagation()}
                  className={`pointer-events-auto flex max-h-[min(92vh,calc(100vh-2rem))] w-full max-w-4xl flex-col overflow-hidden ${MODAL_PANEL_CLASS}`}
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
                {...MODAL_BACKDROP_MOTION}
                className={`${MODAL_BACKDROP_CLASS} z-[10001]`}
                onClick={() => setFreeExpiredModalOpen(false)}
              />
              <div className="pointer-events-none fixed inset-0 z-[10002] flex items-center justify-center p-3 sm:p-4">
                <motion.div
                  {...MODAL_PANEL_MOTION}
                  onClick={(e) => e.stopPropagation()}
                  className={`pointer-events-auto relative w-full max-w-lg overflow-hidden ${MODAL_PANEL_CLASS}`}
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
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-warning/35 bg-[color-mix(in_oklab,var(--warning)_14%,transparent)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.75"
                          className="h-7 w-7 text-warning"
                          aria-hidden
                        >
                          <circle cx="12" cy="12" r="9" />
                          <path d="M12 7v5l3 2" strokeLinecap="round" />
                        </svg>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--landing-muted)]">
                          FitPlan
                        </p>
                        <h3 className="font-display mt-1 text-xl font-bold tracking-tight text-[var(--foreground)] sm:text-2xl">
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
                        className="btn btn-primary order-1 sm:order-2"
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
              {...MODAL_BACKDROP_MOTION}
              className={MODAL_BACKDROP_CLASS}
              onClick={() => setPersonalTrainerModalOpen(false)}
            />
            <motion.div
              {...MODAL_PANEL_MOTION}
              className={`relative z-10 w-full max-w-3xl p-4 sm:p-6 ${MODAL_PANEL_CLASS}`}
            >
              <div className="mb-4 flex items-start justify-between gap-3 border-b border-[var(--landing-border)] pb-4">
                <div>
                  <span className="badge badge-info">Soporte humano</span>
                  <h2 className="font-display mt-2 text-lg font-semibold text-[var(--foreground)] sm:text-xl">{dash(locale, "ptModalTitle")}</h2>
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
                        ? "border-accent/50 bg-accent/15 shadow-[0_10px_28px_-16px_color-mix(in_oklab,var(--accent)_50%,transparent)]"
                        : "border-[var(--landing-border)] bg-[var(--landing-surface)] hover:bg-[var(--landing-surface-2)]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-[var(--foreground)]">{dash(locale, "ptMaleTitle")}</p>
                      <span className="badge badge-neutral">{dash(locale, "ptMaleBadge")}</span>
                    </div>
                    <p className="mt-2 text-xs text-[var(--landing-muted)]">{dash(locale, "ptMaleDesc")}</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTrainerPreference("mujer")}
                    className={`rounded-xl border p-4 text-left transition-all ${
                      trainerPreference === "mujer"
                        ? "border-accent/50 bg-accent/15 shadow-[0_10px_28px_-16px_color-mix(in_oklab,var(--accent)_50%,transparent)]"
                        : "border-[var(--landing-border)] bg-[var(--landing-surface)] hover:bg-[var(--landing-surface-2)]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-[var(--foreground)]">{dash(locale, "ptFemaleTitle")}</p>
                      <span className="badge badge-neutral">{dash(locale, "ptFemaleBadge")}</span>
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
                  className="btn btn-primary flex-1"
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

/** Tarjeta corta de la sidebar de desktop (DESIGN_SYSTEM.md §13.3) — premium / registrar peso / entrenador. */
function SidebarCard({
  icon,
  title,
  body,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card-surface p-4">
      <div className="flex items-center gap-2 text-accent">
        {icon}
        <p className="text-sm font-semibold text-foreground">{title}</p>
      </div>
      <p className="mt-1.5 text-xs text-text-muted">{body}</p>
      {children}
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

  // Consolidación del modal de progreso (DESIGN_SYSTEM.md §13.4-A): antes había
  // una segunda caja "% del plan" que repetía el mismo número que ya muestra el
  // centro del anillo — se elimina y se deja una sola caja de estado con el
  // dato que el anillo no cubre (peso inicial → actual).
  const pesoInicial = typeof user?.pesoKg === "number" ? user.pesoKg : Number(user?.pesoKg) || 0;
  const ultimoRegistro =
    registrosPeso.length > 0 ? [...registrosPeso].sort((a, b) => b.fecha.localeCompare(a.fecha))[0] : null;
  const pesoActual = ultimoRegistro ? ultimoRegistro.peso : pesoInicial;
  const deltaPeso = pesoActual - pesoInicial;
  const objetivoPlan = user?.objetivo || "mantener";
  const deltaEsPositivo =
    objetivoPlan === "ganar_masa" || objetivoPlan === "volumen"
      ? deltaPeso > 0
      : objetivoPlan === "perder_grasa" || objetivoPlan === "corte"
        ? deltaPeso < 0
        : Math.abs(deltaPeso) < 1;

  return (
    <div className="relative px-5 pb-6 pt-5 sm:px-7 sm:pb-8 sm:pt-6">
      {syncNotice ? (
        <div className="mb-3 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
          {syncNotice}
        </div>
      ) : null}
      <div className="flex items-start justify-between gap-4 border-b border-[color-mix(in_oklab,var(--foreground)_8%,transparent)] pb-5">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--landing-muted)]">
            FitPlan
          </p>
          <h2 className="font-display mt-1 text-xl font-bold tracking-tight text-[var(--foreground)] sm:text-2xl">
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
                <p className="font-display text-2xl font-bold tabular-nums text-[var(--foreground)]">{pct.toFixed(0)}%</p>
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
        <div className="flex-1 rounded-xl border border-border bg-surface-2 px-4 py-3 sm:max-w-md">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-text-subtle">
            {dash(locale, "progressWeightInitialToCurrent")}
          </p>
          <p className="font-display mt-0.5 text-sm font-semibold text-foreground">
            {pesoInicial} kg{" "}
            {registrosPeso.length > 0 && (
              <span className={deltaEsPositivo ? "text-success" : "text-warning"}>
                → {pesoActual} kg ({deltaPeso > 0 ? "+" : ""}
                {deltaPeso.toFixed(1)} kg)
              </span>
            )}
          </p>
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
              <button type="button" onClick={handleGuardarPeso} disabled={guardando} className="btn btn-primary shrink-0">
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
                          <span className="font-display font-semibold text-[var(--foreground)]">{registro.peso} kg</span>
                          {(() => {
                            const peso = user?.pesoKg;
                            return Boolean(peso && typeof peso === "number");
                          })() ? (
                            <span className={`font-display text-xs font-medium ${esPositivo ? "text-success" : "text-warning"}`}>
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
                            className="rounded-lg p-1.5 text-danger/90 opacity-80 transition hover:bg-danger/15 hover:opacity-100"
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
                                  ? "bg-success/90"
                                  : diferencia < 0
                                    ? "bg-danger/85"
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
              {...MODAL_BACKDROP_MOTION}
              onClick={() => {
                setMostrarConfirmacion(false);
                setRegistroAEliminar(null);
              }}
              className={`${MODAL_BACKDROP_CLASS} z-[10001]`}
            />
            <div className="pointer-events-none fixed inset-0 z-[10002] flex items-center justify-center p-3 sm:p-4">
              <motion.div
                {...MODAL_PANEL_MOTION}
                onClick={(e) => e.stopPropagation()}
                className={`pointer-events-auto w-full max-w-md overflow-hidden p-6 ${MODAL_PANEL_CLASS}`}
              >
                <div className="mb-4">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-danger/35 bg-danger/10">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-6 w-6 text-danger"
                    >
                      <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </div>
                  <h2 className="font-display mb-2 text-center text-lg font-semibold text-[var(--foreground)]">
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
                    className="flex-1 rounded-xl border border-danger/40 bg-danger/15 px-4 py-2.5 text-sm font-medium text-danger transition hover:bg-danger/25 disabled:cursor-not-allowed disabled:opacity-50"
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

