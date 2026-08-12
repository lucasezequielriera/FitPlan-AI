import { useRouter } from "next/router";
import Link from "next/link";
import Image from "next/image";
import { useAuthStore } from "@/store/authStore";
import { motion } from "framer-motion";
import { useState, useEffect, useRef, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import LoginModal from "./LoginModal";
import UserMessagesModal from "./UserMessagesModal";
import GymCalendarModal from "./GymCalendarModal";
import { getDbSafe, getAuthSafe } from "@/lib/firebase";
import { adminFetch } from "@/lib/adminAuthClient";
import { collection, query, where, getDocs, limit, doc, getDoc, updateDoc } from "firebase/firestore";
import React from "react";
import { useAppLocale } from "@/contexts/AppLocaleContext";
import { ui, dash } from "@/lib/i18n/appUi";
import { getPendingWeightOpsTotalCount, WEIGHT_QUEUE_CHANGED_EVENT } from "@/lib/weightSyncQueue";

export default function Navbar() {
  const router = useRouter();
  const { locale, setLocale } = useAppLocale();
  const { user: authUser, logout, initializeAuth, loading: authLoading } = useAuthStore();
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [hasPlans, setHasPlans] = useState<boolean | null>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [messagesCount, setMessagesCount] = useState(0);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [adminNotificationUnread, setAdminNotificationUnread] = useState(0);
  const [adminNewUsersUnread, setAdminNewUsersUnread] = useState(0);
  const [adminLastUsersCheck, setAdminLastUsersCheck] = useState<string | null>(null);
  const [adminNotificationsOpen, setAdminNotificationsOpen] = useState(false);
  const [adminNotificationsMobileTop, setAdminNotificationsMobileTop] = useState<number | null>(null);
  const [adminNotificationFilter, setAdminNotificationFilter] = useState<
    "all" | "payments" | "fatigue" | "risk" | "emails" | "users"
  >("all");
  const [adminNotificationItems, setAdminNotificationItems] = useState<
    Array<{
      id: string;
      userName?: string;
      userEmail?: string;
      amount?: number;
      currency?: string;
      provider?: string;
      type?: string;
      message?: string;
      createdAt?: unknown;
      source?: "system" | "users";
    }>
  >([]);
  const [messagesModalOpen, setMessagesModalOpen] = useState(false);
  const [sendMessageModalOpen, setSendMessageModalOpen] = useState(false);
  const [userMessagesCount, setUserMessagesCount] = useState(0);
  const [userMessagesModalOpen, setUserMessagesModalOpen] = useState(false);
  const [gymCalendarModalOpen, setGymCalendarModalOpen] = useState(false);
  const [currentMonthGymDays, setCurrentMonthGymDays] = useState(0);
  const [pendingWeightOpsCount, setPendingWeightOpsCount] = useState(0);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [userMenuPos, setUserMenuPos] = useState<{ top: number; right: number; width: number } | null>(null);
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const userMenuPanelRef = useRef<HTMLDivElement | null>(null);
  const adminNotificationsRef = useRef<HTMLDivElement | null>(null);
  const adminBellButtonRef = useRef<HTMLButtonElement | null>(null);
  const isPlanPage = router.pathname === "/plan";
  const isDashboardPage = router.pathname === "/dashboard";

  /** Chat / calendario: mismo tamaño que avatar en móvil; un poco más grandes en desktop. */
  const clientNavActionBtn =
    "relative flex h-9 w-9 shrink-0 touch-manipulation items-center justify-center rounded-lg px-0 text-[var(--foreground)] transition-colors hover:bg-[var(--landing-surface-2)] active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent)] sm:h-10 sm:w-10 sm:rounded-xl";

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

        try {
          const token = await auth.currentUser.getIdToken();
          await fetch("/api/premium/checkExpiration", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
        } catch (expireCheckError) {
          console.warn("No se pudo verificar expiración premium desde navbar:", expireCheckError);
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

          const appLocale = (userData as Record<string, unknown>).appLocale as string | undefined;
          if (appLocale === "en" || appLocale === "es") {
            setLocale(appLocale);
          }
          
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
        const response = await adminFetch(`/api/admin/messages?adminUserId=${authUser.uid}`);
        
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

  useEffect(() => {
    if (!authUser) {
      setPendingWeightOpsCount(0);
      return;
    }

    const refreshPendingCount = () => {
      setPendingWeightOpsCount(getPendingWeightOpsTotalCount());
    };

    refreshPendingCount();
    const interval = setInterval(refreshPendingCount, 15000);
    const handleStorage = () => refreshPendingCount();
    window.addEventListener("storage", handleStorage);
    window.addEventListener(WEIGHT_QUEUE_CHANGED_EVENT, handleStorage);

    return () => {
      clearInterval(interval);
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(WEIGHT_QUEUE_CHANGED_EVENT, handleStorage);
    };
  }, [authUser]);

  const toDateSafe = (value: unknown): Date | null => {
    if (!value) return null;
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
    if (typeof value === "string") {
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    if (typeof value === "object") {
      if ("toDate" in value && typeof (value as { toDate?: () => Date }).toDate === "function") {
        const parsed = (value as { toDate: () => Date }).toDate();
        return Number.isNaN(parsed.getTime()) ? null : parsed;
      }
      if ("seconds" in value) {
        const ts = value as { seconds: number; nanoseconds?: number };
        const parsed = new Date(ts.seconds * 1000 + (ts.nanoseconds || 0) / 1000000);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
      }
    }
    return null;
  };

  const refreshAdminNotifications = async () => {
    if (!authUser || !isAdmin) {
      setAdminNotificationUnread(0);
      setAdminNewUsersUnread(0);
      setAdminLastUsersCheck(null);
      setAdminNotificationItems([]);
      return;
    }
    try {
        let systemUnreadCount = 0;
        let systemItems: Array<{
          id: string;
          userName?: string;
          userEmail?: string;
          amount?: number;
          currency?: string;
          provider?: string;
          type?: string;
          message?: string;
          createdAt?: unknown;
          source?: "system" | "users";
        }> = [];

        const response = await adminFetch(`/api/admin/paymentNotifications?adminUserId=${authUser.uid}`);
        if (response.ok) {
          const data = await response.json();
          systemUnreadCount = typeof data?.unreadCount === "number" ? data.unreadCount : 0;
          systemItems = Array.isArray(data?.items)
            ? data.items.map((item: Record<string, unknown>) => ({
                id: String(item.id || ""),
                userName: typeof item.userName === "string" ? item.userName : undefined,
                userEmail: typeof item.userEmail === "string" ? item.userEmail : undefined,
                amount: typeof item.amount === "number" ? item.amount : undefined,
                currency: typeof item.currency === "string" ? item.currency : undefined,
                provider: typeof item.provider === "string" ? item.provider : undefined,
                type: typeof item.type === "string" ? item.type : undefined,
                message: typeof item.message === "string" ? item.message : undefined,
                createdAt: item.createdAt,
                source: "system",
              }))
            : [];
        }

        let mergedItems = [...systemItems].sort((a, b) => {
          const aDate = toDateSafe(a.createdAt)?.getTime() || 0;
          const bDate = toDateSafe(b.createdAt)?.getTime() || 0;
          return bDate - aDate;
        });
        let unreadNewUsers = 0;

        const historyResponse = await adminFetch(`/api/admin/activityHistory?adminUserId=${authUser.uid}`);
        if (historyResponse.ok) {
          const historyData = await historyResponse.json();
          const historyItems = Array.isArray(historyData?.items)
            ? historyData.items.map((item: Record<string, unknown>) => ({
                id: String(item.id || ""),
                userName: typeof item.userName === "string" ? item.userName : undefined,
                userEmail: typeof item.userEmail === "string" ? item.userEmail : undefined,
                amount: typeof item.amount === "number" ? item.amount : undefined,
                currency: typeof item.currency === "string" ? item.currency : undefined,
                provider: typeof item.provider === "string" ? item.provider : undefined,
                type: typeof item.type === "string" ? item.type : undefined,
                message: typeof item.message === "string" ? item.message : undefined,
                createdAt: item.createdAt,
                source: item.source === "users" ? "users" : "system",
              }))
            : [];
          mergedItems = historyItems.length > 0 ? historyItems : mergedItems;

          const lastCheckIso = typeof historyData?.lastUsersCheck === "string" ? historyData.lastUsersCheck : null;
          setAdminLastUsersCheck(lastCheckIso);
          const lastCheckDate = toDateSafe(lastCheckIso);
          unreadNewUsers = mergedItems.filter((item) => {
            if (item.type !== "user_registered") return false;
            const createdAtDate = toDateSafe(item.createdAt);
            if (!createdAtDate) return false;
            if (!lastCheckDate) return true;
            return createdAtDate.getTime() > lastCheckDate.getTime();
          }).length;
        }

        setAdminNewUsersUnread(unreadNewUsers);
        setAdminNotificationUnread(systemUnreadCount + unreadNewUsers);
        setAdminNotificationItems(mergedItems.slice(0, 30));
    } catch {
      // noop
    }
  };

  // Notificaciones del admin (cobros/alertas/riesgo/emails + nuevos usuarios)
  useEffect(() => {
    if (!authUser || !isAdmin) {
      setAdminNotificationUnread(0);
      setAdminNewUsersUnread(0);
      setAdminLastUsersCheck(null);
      setAdminNotificationItems([]);
      return;
    }
    void refreshAdminNotifications();
    const interval = setInterval(() => {
      void refreshAdminNotifications();
    }, 30000);
    return () => clearInterval(interval);
  }, [authUser, isAdmin]);

  useEffect(() => {
    setUserMenuOpen(false);
    setAdminNotificationsOpen(false);
  }, [router.pathname]);

  useLayoutEffect(() => {
    if (!userMenuOpen || typeof window === "undefined") {
      setUserMenuPos(null);
      return;
    }
    const update = () => {
      const wrap = userMenuRef.current;
      if (!wrap) return;
      const rect = wrap.getBoundingClientRect();
      const width = Math.min(280, window.innerWidth - 24);
      setUserMenuPos({
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right,
        width,
      });
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [userMenuOpen, adminNotificationsOpen]);

  useLayoutEffect(() => {
    if (!adminNotificationsOpen || typeof window === "undefined") {
      setAdminNotificationsMobileTop(null);
      return;
    }
    const update = () => {
      const bell = adminBellButtonRef.current;
      if (!bell) return;
      const rect = bell.getBoundingClientRect();
      // Debajo de la campana para que "se sienta" anclado, pero centrado en pantalla.
      setAdminNotificationsMobileTop(rect.bottom + 10);
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, { passive: true });
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update);
    };
  }, [adminNotificationsOpen]);

  useEffect(() => {
    if (!userMenuOpen && !adminNotificationsOpen) return;
    const handleDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (
        userMenuRef.current?.contains(t) ||
        userMenuPanelRef.current?.contains(t) ||
        adminNotificationsRef.current?.contains(t)
      ) {
        return;
      }
      setUserMenuOpen(false);
      setAdminNotificationsOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setUserMenuOpen(false);
        setAdminNotificationsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleDown);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleDown);
      document.removeEventListener("keydown", handleKey);
    };
  }, [userMenuOpen]);

  const handleLogout = async () => {
    setUserMenuOpen(false);
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
      }
    }
    await logout();
    router.push("/");
  };

  const navigateUserHome = () => {
    setUserMenuOpen(false);
    if (isAdmin) {
      router.push("/admin");
    } else if (hasPlans) {
      router.push("/dashboard");
    } else {
      router.push("/create-plan");
    }
  };

  const openAdminNotifications = async () => {
    if (!isAdmin || !authUser) return;
    const nextOpen = !adminNotificationsOpen;
    setAdminNotificationsOpen(nextOpen);
    if (nextOpen) {
      await refreshAdminNotifications();
    }
    if (nextOpen && adminNotificationUnread > 0) {
      try {
        await adminFetch("/api/admin/paymentNotifications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ adminUserId: authUser.uid }),
        });
      } catch {
        // noop
      }
      if (adminNewUsersUnread > 0) {
        try {
          const response = await adminFetch("/api/admin/markUsersSeen", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ adminUserId: authUser.uid }),
          });
          if (response.ok) {
            const data = await response.json();
            const nowIso = typeof data?.lastUsersCheck === "string" ? data.lastUsersCheck : new Date().toISOString();
            setAdminLastUsersCheck(nowIso);
            setAdminNewUsersUnread(0);
          }
        } catch {
          // noop
        }
      }
      setAdminNotificationUnread(0);
    }
  };

  const visibleAdminNotificationItems = adminNotificationItems.filter((item) => {
    if (adminNotificationFilter === "all") return true;
    if (adminNotificationFilter === "users") return item.type === "user_registered";
    if (adminNotificationFilter === "payments") return item.type === "payment_success";
    if (adminNotificationFilter === "fatigue") return item.type === "coach_alert";
    if (adminNotificationFilter === "risk") return item.type === "adherence_risk_weekly";
    return item.type === "weekly_digest_sent" || item.type === "weekly_digest_failed";
  });

  const groupedAdminNotificationItems = visibleAdminNotificationItems.reduce<Record<string, Array<(typeof visibleAdminNotificationItems)[number]>>>((acc, item) => {
    const date = toDateSafe(item.createdAt);
    const dayKey = date
      ? date.toLocaleDateString("es-AR", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" })
      : "Sin fecha";
    if (!acc[dayKey]) acc[dayKey] = [];
    acc[dayKey].push(item);
    return acc;
  }, {});
  const isAllNotificationsFilter = adminNotificationFilter === "all";
  const limitedGroupedAdminNotificationItems = Object.entries(groupedAdminNotificationItems).reduce<
    Array<[string, Array<(typeof visibleAdminNotificationItems)[number]>]>
  >((acc, [dayKey, dayItems]) => {
    if (!isAllNotificationsFilter) {
      acc.push([dayKey, dayItems]);
      return acc;
    }
    const alreadyCounted = acc.reduce((sum, [, items]) => sum + items.length, 0);
    if (alreadyCounted >= 5) return acc;
    const remaining = 5 - alreadyCounted;
    acc.push([dayKey, dayItems.slice(0, remaining)]);
    return acc;
  }, []);
  const visibleNotificationsCount = isAllNotificationsFilter
    ? Math.min(5, visibleAdminNotificationItems.length)
    : visibleAdminNotificationItems.length;
  const canOpenAllNotifications = isAllNotificationsFilter;
  const handleAdminNotificationClick = (item: (typeof visibleAdminNotificationItems)[number]) => {
    setAdminNotificationsOpen(false);
    if (item.type === "user_registered") {
      const queryValue = item.userEmail || item.userName || "";
      if (queryValue) {
        router.push(`/admin/clientes-fitplan?q=${encodeURIComponent(queryValue)}`);
        return;
      }
      router.push("/admin/clientes-fitplan");
      return;
    }
    if (item.type === "payment_success") {
      router.push("/admin/clientes-fitplan");
      return;
    }
    if (item.type === "coach_alert" || item.type === "adherence_risk_weekly") {
      router.push("/admin/clientes-1-1");
      return;
    }
    router.push("/admin/actividad");
  };

  const marketingEsToEn: Record<string, string> = {
    "/": "/en",
    "/formulario-de-inicio": "/en/formulario-de-inicio",
    "/transformacion-fitplan": "/en/transformacion-fitplan",
  };

  const persistAppLocale = (l: "es" | "en") => {
    void (async () => {
      try {
        const db = getDbSafe();
        const auth = getAuthSafe();
        if (!db || !auth?.currentUser) return;
        await updateDoc(doc(db, "usuarios", auth.currentUser.uid), { appLocale: l });
      } catch {
        // ignore
      }
    })();
  };

  const pickLocaleEs = () => {
    setLocale("es");
    persistAppLocale("es");
    if (router.pathname.startsWith("/en")) {
      const raw = router.asPath.replace(/^\/en(\/?)/, "/") || "/";
      router.push(raw === "//" ? "/" : raw);
    }
    setUserMenuOpen(false);
  };

  const pickLocaleEn = () => {
    setLocale("en");
    persistAppLocale("en");
    const path = router.pathname;
    const mapped = marketingEsToEn[path];
    if (mapped) {
      router.push(mapped);
    }
    setUserMenuOpen(false);
  };

  return (
    <>
    <nav className="fixed inset-x-0 top-0 z-50 w-full border-b border-[var(--landing-border)] bg-[color-mix(in_oklab,var(--background)_88%,transparent)] backdrop-blur-md supports-[padding:max(0px)]:pt-[env(safe-area-inset-top)]">
      <div className="flex w-full items-center justify-between gap-1.5 px-2.5 py-2 sm:gap-3 sm:px-6 sm:py-3">
        <Link
          href="/"
          className="flex min-w-0 shrink items-center gap-2 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent)] sm:gap-2.5 sm:shrink-0"
        >
          <span className="relative hidden h-9 w-9 shrink-0 overflow-hidden rounded-xl bg-[var(--landing-surface)] ring-1 ring-[var(--landing-border)] sm:block">
            <Image
              src="/brand/icon-social-transparent.svg"
              alt=""
              width={36}
              height={36}
              className="object-contain p-1"
              priority
            />
          </span>
          <span className="min-w-0 truncate text-sm font-semibold tracking-tight text-[var(--foreground)] sm:text-base">FitPlan</span>
        </Link>

        <div className="flex min-w-0 max-w-[100%] shrink flex-nowrap items-center justify-end gap-1 overflow-visible sm:flex-wrap sm:gap-2 md:gap-3">
          {!authUser && (
            <nav
              className="flex shrink-0 items-center rounded-lg bg-[var(--landing-surface)] p-0.5 text-[10px] ring-1 ring-[var(--landing-border)] sm:text-xs md:text-sm"
              aria-label={ui(locale, "language")}
            >
              {locale === "en" ? (
                <>
                  <button
                    type="button"
                    onClick={pickLocaleEs}
                    className="rounded-md px-2 py-1 text-[var(--landing-muted)] transition-colors hover:text-[var(--foreground)]"
                  >
                    ES
                  </button>
                  <span className="px-1 text-[var(--landing-muted)]" aria-hidden>
                    |
                  </span>
                  <span className="rounded-md bg-[var(--landing-surface-2)] px-2 py-1 font-medium text-[var(--foreground)]">EN</span>
                </>
              ) : (
                <>
                  <span className="rounded-md bg-[var(--landing-surface-2)] px-2 py-1 font-medium text-[var(--foreground)]">ES</span>
                  <span className="px-1 text-[var(--landing-muted)]" aria-hidden>
                    |
                  </span>
                  <button
                    type="button"
                    onClick={pickLocaleEn}
                    className="rounded-md px-2 py-1 text-[var(--landing-muted)] transition-colors hover:text-[var(--foreground)]"
                  >
                    EN
                  </button>
                </>
              )}
            </nav>
          )}

          {authUser && (
            <>
              {!isAdmin && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex w-auto shrink-0 items-stretch rounded-xl border border-[var(--landing-border)] bg-[color-mix(in_oklab,var(--landing-surface)_92%,transparent)] p-0.5 shadow-[0_10px_36px_-18px_rgba(45,212,191,0.35)] ring-1 ring-[color-mix(in_oklab,var(--foreground)_5%,transparent)] sm:rounded-2xl sm:p-1"
                  role="group"
                  aria-label="Mensajes y calendario de gym"
                >
                  <button
                    type="button"
                    className={clientNavActionBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      setUserMessagesModalOpen(true);
                    }}
                  title={locale === "en" ? "Messages" : "Mis mensajes"}
                  aria-label={ui(locale, "messagesAria")}
                  >
                    <span className="relative inline-flex">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className={`h-4 w-4 sm:h-[1.15rem] sm:w-[1.15rem] ${userMessagesCount > 0 ? "text-[var(--landing-accent)]" : "text-[var(--foreground)]/85"}`}
                        aria-hidden
                      >
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      </svg>
                      {userMessagesCount > 0 && (
                        <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--landing-accent)] px-0.5 text-[9px] font-bold leading-none text-[#0a1628] ring-2 ring-[var(--background)] sm:-right-2 sm:-top-2 sm:h-[18px] sm:min-w-[18px] sm:text-[10px]">
                          {userMessagesCount > 9 ? "9+" : userMessagesCount}
                        </span>
                      )}
                    </span>
                  </button>

                  <span className="my-1 w-px shrink-0 bg-[var(--landing-border)] sm:my-1.5" aria-hidden />

                  <button
                    type="button"
                    className={clientNavActionBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      setGymCalendarModalOpen(true);
                      setTimeout(() => loadGymDaysCount(), 500);
                    }}
                    title={locale === "en" ? "Gym days this month" : "Días de gym este mes"}
                    aria-label={
                      locale === "en"
                        ? `${ui(locale, "gymAria")}${currentMonthGymDays > 0 ? `, ${currentMonthGymDays} ${ui(locale, "gymDaysSuffix")}` : ""}`
                        : `Calendario de gym${currentMonthGymDays > 0 ? `, ${currentMonthGymDays} días este mes` : ""}`
                    }
                  >
                    <span className="relative inline-flex">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-4 w-4 text-[var(--foreground)]/85 sm:h-[1.15rem] sm:w-[1.15rem]"
                        aria-hidden
                      >
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                      {currentMonthGymDays > 0 && (
                        <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--landing-accent)] px-0.5 text-[9px] font-bold leading-none text-[#0a1628] ring-2 ring-[var(--background)] sm:-right-2 sm:-top-2 sm:h-[18px] sm:min-w-[18px] sm:text-[10px]">
                          {currentMonthGymDays > 9 ? "9+" : currentMonthGymDays}
                        </span>
                      )}
                    </span>
                  </button>
                </motion.div>
              )}

              {isAdmin && (
                <div className="relative flex items-center gap-2" ref={adminNotificationsRef}>
                  <motion.button
                    ref={adminBellButtonRef}
                    type="button"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      openAdminNotifications();
                    }}
                    title="Notificaciones"
                    className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface)] text-[var(--foreground)]/90 shadow-[0_8px_24px_-16px_rgba(0,0,0,0.5)] transition-colors hover:bg-[var(--landing-surface-2)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent)] sm:h-10 sm:w-10"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 sm:h-[1.1rem] sm:w-[1.1rem]">
                      <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5m6 0a3 3 0 1 1-6 0m6 0H9" />
                    </svg>
                    {adminNotificationUnread > 0 && (
                      <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-[var(--background)] bg-[var(--landing-accent)] px-1 text-[10px] font-bold text-[#0a1628]">
                        {adminNotificationUnread > 9 ? "9+" : adminNotificationUnread}
                      </span>
                    )}
                  </motion.button>

                  {adminNotificationsOpen && (
                    <div
                      style={
                        adminNotificationsMobileTop !== null
                          ? { top: `${adminNotificationsMobileTop}px` }
                          : undefined
                      }
                      className="fixed left-1/2 top-[calc(env(safe-area-inset-top)+70px)] z-[10040] w-[min(92vw,420px)] -translate-x-1/2 rounded-2xl border border-[var(--landing-border)] bg-[color-mix(in_oklab,var(--background)_96%,#0f172a)] p-3 shadow-[0_24px_60px_-26px_rgba(0,0,0,0.65)] ring-1 ring-[color-mix(in_oklab,var(--foreground)_6%,transparent)] sm:absolute sm:right-0 sm:left-auto sm:top-[calc(100%+10px)] sm:translate-x-0"
                    >
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--landing-muted)]">
                        Notificaciones
                      </p>
                      <div className="mb-2 flex flex-wrap gap-1.5">
                        {[
                          ["all", "Todo"],
                          ["users", "Usuarios"],
                          ["payments", "Cobros"],
                          ["fatigue", "Fatiga"],
                          ["risk", "Riesgo"],
                          ["emails", "Emails"],
                        ].map(([id, label]) => (
                          <button
                            key={id}
                            type="button"
                            onClick={() =>
                              setAdminNotificationFilter(id as "all" | "payments" | "fatigue" | "risk" | "emails" | "users")
                            }
                            className={`rounded-lg border px-2 py-1 text-[11px] transition ${
                              adminNotificationFilter === id
                                ? "border-[color-mix(in_oklab,var(--landing-accent)_45%,transparent)] bg-[color-mix(in_oklab,var(--landing-accent)_14%,transparent)] text-[var(--foreground)]"
                                : "border-[var(--landing-border)] bg-[var(--landing-surface)] text-[var(--landing-muted)] hover:text-[var(--foreground)]"
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      {!!adminLastUsersCheck && (
                        <p className="mb-2 text-[10px] uppercase tracking-wide text-[var(--landing-muted)]">
                          Última revisión: {new Date(adminLastUsersCheck).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                        </p>
                      )}
                      {isAllNotificationsFilter && (
                        <p className="mb-2 text-[10px] uppercase tracking-wide text-[var(--landing-muted)]">
                          Mostrando {visibleNotificationsCount} de {visibleAdminNotificationItems.length}
                        </p>
                      )}
                      <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                        {visibleNotificationsCount === 0 ? (
                          <p className="rounded-lg border border-[var(--landing-border)] bg-[var(--landing-surface)] px-3 py-2 text-xs text-[var(--landing-muted)]">
                            Sin notificaciones recientes.
                          </p>
                        ) : (
                          limitedGroupedAdminNotificationItems.map(([dayKey, dayItems]) => (
                            <div key={dayKey} className="space-y-1.5">
                              <p className="px-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--landing-muted)]">{dayKey}</p>
                              {dayItems.map((item) => {
                                const itemDate = toDateSafe(item.createdAt);
                                const hourLabel = itemDate
                                  ? `${String(itemDate.getHours()).padStart(2, "0")}:${String(itemDate.getMinutes()).padStart(2, "0")}`
                                  : "--:--";
                                return (
                                  <button
                                    type="button"
                                    key={item.id}
                                    onClick={() => handleAdminNotificationClick(item)}
                                    className="w-full rounded-lg border border-[var(--landing-border)] bg-[var(--landing-surface)]/80 px-3 py-2 text-left text-xs text-[var(--foreground)] transition hover:border-[var(--info)]/35 hover:bg-[var(--landing-surface)]"
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <p className="text-[10px] uppercase tracking-wide text-[var(--landing-muted)]">
                                        {hourLabel}
                                      </p>
                                      <p className="text-[10px] uppercase tracking-wide text-[var(--landing-muted)]">
                                        {String(item.provider || item.type || "Notificación")}
                                      </p>
                                    </div>
                                    <p className="mt-1">
                                      {item.message
                                        ? `${item.userName || item.userEmail || "Cliente"} · ${String(item.message)}`
                                        : `${item.userName || item.userEmail || "Usuario"} · ${item.amount || 0} ${item.currency || ""}`}
                                    </p>
                                  </button>
                                );
                              })}
                            </div>
                          ))
                        )}
                      </div>
                      {canOpenAllNotifications && (
                        <div className="mt-2 border-t border-[var(--landing-border)] pt-2 sticky bottom-0 bg-[color-mix(in_oklab,var(--background)_96%,#0f172a)]">
                          <button
                            type="button"
                            onClick={() => {
                              setAdminNotificationsOpen(false);
                              router.push("/admin/actividad");
                            }}
                            className="w-full rounded-lg border border-[var(--info)]/30 bg-[var(--info)]/10 px-3 py-2 text-xs font-semibold text-info hover:bg-[var(--info)]/20 transition-colors"
                          >
                            Ver todas
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  <motion.button
                    type="button"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setMessagesModalOpen(true);
                    }}
                    title="Chat admin"
                    className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface)] text-[var(--foreground)]/90 shadow-[0_8px_24px_-16px_rgba(0,0,0,0.5)] transition-colors hover:bg-[var(--landing-surface-2)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent)] sm:h-10 sm:w-10"
                  >
                    <motion.span
                      animate={
                        messagesCount > 0
                          ? {
                              scale: [1, 1.06, 1],
                              rotate: [0, -4, 4, 0],
                            }
                          : {}
                      }
                      transition={{
                        duration: 0.5,
                        repeat: messagesCount > 0 ? Infinity : 0,
                        repeatDelay: 2,
                      }}
                      className="relative inline-flex"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-4 w-4 sm:h-[1.1rem] sm:w-[1.1rem]"
                      >
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      </svg>
                    </motion.span>
                    {messagesCount > 0 && (
                      <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-[var(--background)] bg-[var(--landing-accent)] px-1 text-[10px] font-bold text-[#0a1628]">
                        {messagesCount > 9 ? "9+" : messagesCount}
                      </span>
                    )}
                    {loadingMessages && messagesCount === 0 && (
                      <span className="absolute -right-1 -top-1 h-2.5 w-2.5 animate-pulse rounded-full bg-[var(--landing-accent)]" />
                    )}
                  </motion.button>
                </div>
              )}

              {pendingWeightOpsCount > 0 && (
                <div
                  className="inline-flex h-8 items-center gap-1 rounded-full border border-[var(--warning)]/35 bg-[var(--warning)]/12 px-2.5 text-[11px] font-semibold text-warning sm:h-9 sm:text-xs"
                  title={
                    locale === "en"
                      ? "Pending sync entries from this device"
                      : "Registros pendientes de sincronizacion en este dispositivo"
                  }
                >
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--warning)]" />
                  {locale === "en" ? "Pending sync" : "Pendiente sync"}: {pendingWeightOpsCount > 99 ? "99+" : pendingWeightOpsCount}
                </div>
              )}

              <div className="relative shrink-0" ref={userMenuRef}>
                <motion.button
                  type="button"
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  onClick={() => setUserMenuOpen((o) => !o)}
                  aria-expanded={userMenuOpen}
                  aria-haspopup="menu"
                  id="user-menu-button"
                  title={
                    isAdmin
                      ? ui(locale, "menuAccountAdmin")
                      : userName
                        ? `${ui(locale, "menuAccount")} — ${userName}`
                        : ui(locale, "menuAccount")
                  }
                  aria-label={
                    isAdmin
                      ? ui(locale, "openMenuAdmin")
                      : userName
                        ? `${ui(locale, "openMenuNamed")}, ${userName}`
                        : ui(locale, "openMenuNamed")
                  }
                  className="flex h-9 w-9 shrink-0 touch-manipulation items-center justify-center gap-1.5 rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface)] px-1 transition-colors hover:bg-[var(--landing-surface-2)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent)] sm:h-10 sm:min-h-0 sm:w-auto sm:max-w-[min(260px,32vw)] sm:justify-start sm:gap-2 sm:px-2 sm:py-1.5"
                >
                  <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--landing-accent)_20%,transparent)] text-xs font-semibold text-[var(--foreground)] ring-1 ring-[var(--landing-accent)]/40">
                    {authUser.email?.charAt(0).toUpperCase() || "U"}
                    {isPremium && (
                      <span
                        className="pointer-events-none absolute -right-0.5 -top-0.5 z-[2] flex h-3 w-3 items-center justify-center text-warning drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)] sm:h-3.5 sm:w-3.5"
                        title="Premium"
                        aria-hidden
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          className="h-full w-full"
                        >
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                        </svg>
                      </span>
                    )}
                    <span
                      className="absolute -bottom-0.5 -right-0.5 z-[1] h-2.5 w-2.5 shrink-0 rounded-full bg-success ring-2 ring-[var(--background)]"
                      title={ui(locale, "connected")}
                      aria-hidden
                    />
                  </div>
                  <div className="hidden min-w-0 flex-1 flex-col items-start text-left sm:flex">
                    <p className="flex w-full items-center gap-1 truncate text-xs font-medium text-[var(--foreground)]">
                      {isAdmin
                        ? ui(locale, "admin")
                        : isPlanPage
                          ? `${locale === "en" ? "Hello" : "Hola"}, ${userName || "Usuario"}`
                          : isDashboardPage
                            ? userName || ui(locale, "myDashboard")
                            : hasPlans === null
                              ? "..."
                              : hasPlans
                                ? ui(locale, "dashboard")
                                : ui(locale, "createPlan")}
                    </p>
                    <p className="w-full truncate text-[10px] text-[var(--landing-muted)]">{ui(locale, "connected")}</p>
                  </div>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`hidden h-3.5 w-3.5 shrink-0 text-[var(--landing-muted)] transition-transform sm:block ${userMenuOpen ? "rotate-180" : ""}`}
                    aria-hidden
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </motion.button>

                {userMenuOpen &&
                  userMenuPos &&
                  typeof document !== "undefined" &&
                  createPortal(
                    <div
                      ref={userMenuPanelRef}
                      style={{
                        position: "fixed",
                        top: userMenuPos.top,
                        right: userMenuPos.right,
                        width: userMenuPos.width,
                        zIndex: 10050,
                      }}
                      className="origin-top-right rounded-xl border border-[var(--landing-border)] bg-[color-mix(in_oklab,var(--background)_96%,#0f172a)] py-1 shadow-[0_20px_50px_-24px_rgba(0,0,0,0.65)] ring-1 ring-[color-mix(in_oklab,var(--foreground)_6%,transparent)]"
                      role="menu"
                      aria-labelledby="user-menu-button"
                    >
                      <button
                        type="button"
                        role="menuitem"
                        disabled={hasPlans === null}
                        onClick={navigateUserHome}
                        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-medium text-[var(--foreground)] transition hover:bg-[var(--landing-surface)] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          className="h-4 w-4 shrink-0 text-[var(--landing-accent)]"
                          aria-hidden
                        >
                          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                          <polyline points="9 22 9 12 15 12 15 22" />
                        </svg>
                        <span className="min-w-0 flex-1 truncate">
                          {isAdmin
                            ? ui(locale, "goAdminPanel")
                            : isPlanPage
                              ? ui(locale, "goDashboard")
                              : isDashboardPage
                                ? ui(locale, "myDashboardMenu")
                                : hasPlans === null
                                  ? ui(locale, "loadingShort")
                                  : hasPlans
                                    ? ui(locale, "goDashboardMenu")
                                    : ui(locale, "createPlanMenu")}
                        </span>
                      </button>

                      {isAdmin && (
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setUserMenuOpen(false);
                            router.push("/admin/configuraciones");
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-medium text-[var(--foreground)] transition hover:bg-[var(--landing-surface)]"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 shrink-0 text-[var(--landing-accent)]" aria-hidden>
                            <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
                            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.08a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.08a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.08a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1V15Z" />
                          </svg>
                          <span className="min-w-0 flex-1 truncate">Configuraciones</span>
                        </button>
                      )}

                      <div className="my-1 h-px bg-[var(--landing-border)]" role="separator" />

                      <div className="px-3 py-2">
                        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--landing-muted)]">
                          {ui(locale, "language")}
                        </p>
                        <div className="flex rounded-lg bg-[var(--landing-surface)] p-0.5 ring-1 ring-[var(--landing-border)]">
                          {locale === "en" ? (
                            <>
                              <button
                                type="button"
                                role="menuitem"
                                onClick={pickLocaleEs}
                                className="flex-1 rounded-md px-2 py-1.5 text-center text-xs font-medium text-[var(--landing-muted)] transition hover:text-[var(--foreground)]"
                              >
                                ES
                              </button>
                              <span className="self-stretch w-px bg-[var(--landing-border)]" aria-hidden />
                              <span className="flex-1 rounded-md bg-[var(--landing-surface-2)] px-2 py-1.5 text-center text-xs font-medium text-[var(--foreground)]">
                                EN
                              </span>
                            </>
                          ) : (
                            <>
                              <span className="flex-1 rounded-md bg-[var(--landing-surface-2)] px-2 py-1.5 text-center text-xs font-medium text-[var(--foreground)]">
                                ES
                              </span>
                              <span className="self-stretch w-px bg-[var(--landing-border)]" aria-hidden />
                              <button
                                type="button"
                                role="menuitem"
                                onClick={pickLocaleEn}
                                className="flex-1 rounded-md px-2 py-1.5 text-center text-xs font-medium text-[var(--landing-muted)] transition hover:text-[var(--foreground)]"
                              >
                                EN
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="my-1 h-px bg-[var(--landing-border)]" role="separator" />

                      <button
                        type="button"
                        role="menuitem"
                        onClick={handleLogout}
                        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-medium text-[var(--foreground)] transition hover:bg-[color-mix(in_oklab,#f87171_12%,transparent)]"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="h-4 w-4 shrink-0"
                          aria-hidden
                        >
                          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                          <polyline points="16 17 21 12 16 7" />
                          <line x1="21" y1="12" x2="9" y2="12" />
                        </svg>
                        {ui(locale, "signOut")}
                      </button>
                    </div>,
                    document.body
                  )}
              </div>
            </>
          )}

          {!authUser && !isPlanPage && (
            <span className="hidden max-w-[10rem] truncate text-[10px] text-[var(--landing-muted)] sm:inline sm:max-w-none sm:text-xs">
              {ui(locale, "tagline")}
            </span>
          )}

          {authLoading ? (
            <div className="px-3 py-2 text-xs text-[var(--landing-muted)] sm:text-sm">{ui(locale, "loading")}</div>
          ) : !authUser ? (
            <button
              type="button"
              onClick={() => setLoginModalOpen(true)}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-medium text-[var(--foreground)] ring-1 ring-[var(--landing-border)] bg-[var(--landing-surface)] transition-colors hover:bg-[var(--landing-surface-2)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent)] sm:gap-2 sm:px-3 sm:text-sm"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4 shrink-0"
              >
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                <polyline points="10 17 15 12 10 7" />
                <line x1="15" y1="12" x2="3" y2="12" />
              </svg>
              <span>{ui(locale, "signIn")}</span>
            </button>
          ) : null}
        </div>
      </div>
      <LoginModal
        isOpen={loginModalOpen}
        onClose={() => setLoginModalOpen(false)}
        defaultMode="login"
        locale={locale}
      />
    </nav>
    <div
      aria-hidden
      className="h-[calc(56px+env(safe-area-inset-top))] sm:h-[calc(64px+env(safe-area-inset-top))]"
    />
    
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
            adminFetch(`/api/admin/messages?adminUserId=${authUser.uid}`)
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

// Modal enviar mensaje — misma línea visual que UserMessagesModal
function SendMessageModal({
  isOpen,
  onClose,
  userName,
  userEmail,
  onMessageSent,
}: {
  isOpen: boolean;
  onClose: () => void;
  userName: string | null;
  userEmail: string | null;
  onMessageSent?: () => void;
}) {
  const { locale } = useAppLocale();
  const { user: authUser } = useAuthStore();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authUser || !message.trim()) {
      setError(dash(locale, "composeEmpty"));
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
          subject: subject.trim() || dash(locale, "composeDefaultSubject"),
          message: message.trim(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || dash(locale, "composeError"));
      }

      setSuccess(true);
      setSubject("");
      setMessage("");

      if (onMessageSent) {
        onMessageSent();
      }

      setTimeout(() => {
        setSuccess(false);
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : dash(locale, "composeError"));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/65 p-3 backdrop-blur-md sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 16 }}
        transition={{ type: "spring", damping: 26, stiffness: 320 }}
        className="relative w-full max-w-lg max-h-[min(92vh,720px)] overflow-y-auto rounded-2xl border border-[var(--landing-border)] bg-[color-mix(in_oklab,var(--background)_88%,#0b1020)] shadow-[0_24px_80px_-32px_rgba(0,0,0,0.85)] ring-1 ring-[color-mix(in_oklab,var(--foreground)_5%,transparent)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative border-b border-[var(--landing-border)] bg-[color-mix(in_oklab,var(--landing-surface)_70%,transparent)] px-4 py-4 sm:px-5">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.35]"
            style={{
              background:
                "radial-gradient(120% 80% at 0% 0%, color-mix(in oklab, var(--landing-accent) 28%, transparent), transparent 55%), radial-gradient(90% 60% at 100% 0%, rgba(6,182,212,0.12), transparent 50%)",
            }}
          />
          <div className="relative flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--landing-surface)] ring-1 ring-[var(--landing-border)]">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="h-5 w-5 text-[var(--landing-accent)]"
                >
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-semibold tracking-tight text-[var(--foreground)]">{dash(locale, "composeTitle")}</h2>
                <p className="truncate text-xs text-[var(--landing-muted)]">FitPlan</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[var(--landing-muted)] transition hover:bg-[var(--landing-surface)] hover:text-[var(--foreground)]"
              aria-label={dash(locale, "modalClose")}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-5">
          {success ? (
            <div className="py-4 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-success/15 ring-1 ring-success/30">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-8 w-8 text-success">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              </div>
              <p className="font-semibold text-success">{dash(locale, "composeSuccess")}</p>
              <p className="mt-2 text-sm text-[var(--landing-muted)]">{dash(locale, "composeSuccessSub")}</p>
              <button
                type="button"
                onClick={() => setSuccess(false)}
                className="mt-6 rounded-xl bg-gradient-to-r from-[var(--brand-start,#3b82f6)] via-[var(--brand-mid,#06b6d4)] to-[var(--brand-end,#10b981)] px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-cyan-500/15 transition hover:brightness-110"
              >
                {dash(locale, "composeAnother")}
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-2 block text-xs font-medium text-[var(--landing-muted)] sm:text-sm">
                  {dash(locale, "composeSubjectOptional")}
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder={dash(locale, "composeSubjectPlaceholder")}
                  className="w-full rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface)] px-4 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--landing-muted)]/70 focus:border-[color-mix(in_oklab,var(--landing-accent)_50%,transparent)] focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklab,var(--landing-accent)_25%,transparent)]"
                  maxLength={100}
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium text-[var(--landing-muted)] sm:text-sm">
                  {dash(locale, "composeMessageLabel")} <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={dash(locale, "composeMessagePlaceholder")}
                  rows={6}
                  className="w-full resize-none rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface)] px-4 py-3 text-sm text-[var(--foreground)] placeholder:text-[var(--landing-muted)]/70 focus:border-[color-mix(in_oklab,var(--landing-accent)_50%,transparent)] focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklab,var(--landing-accent)_25%,transparent)]"
                  required
                  maxLength={2000}
                />
                <p className="mt-1 text-right text-[11px] text-[var(--landing-muted)]">{message.length}/2000</p>
              </div>

              {error && (
                <div className="rounded-xl border border-danger/30 bg-danger/10 p-3">
                  <p className="text-sm text-danger">{error}</p>
                </div>
              )}

              <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface)] px-4 py-2.5 text-sm font-medium text-[var(--foreground)] transition hover:bg-[var(--landing-surface-2)]"
                >
                  {dash(locale, "cancel")}
                </button>
                <button
                  type="submit"
                  disabled={loading || !message.trim()}
                  className="flex-1 rounded-xl bg-gradient-to-r from-[var(--brand-start,#3b82f6)] via-[var(--brand-mid,#06b6d4)] to-[var(--brand-end,#10b981)] px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-500/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {loading ? dash(locale, "composeSending") : dash(locale, "composeSend")}
                </button>
              </div>
            </form>
          )}
        </div>
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
      loadMessages(false);
    }
  }, [isOpen, adminUserId]);

  // Recargar mensajes periódicamente cuando el modal está abierto para detectar nuevas respuestas
  useEffect(() => {
    if (!isOpen || !adminUserId) return;
    
    const interval = setInterval(() => {
      loadMessages(true);
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

  const loadMessages = async (silent = false) => {
    try {
      if (!silent) {
        setLoading(true);
      }
      const response = await adminFetch(`/api/admin/messages?adminUserId=${adminUserId}`);
      if (!response.ok) throw new Error("Error al cargar mensajes");
      const data = await response.json();
      const sortedMessages = sortMessagesByDate(data.messages || []);
      setMessages(sortedMessages);
    } catch (error) {
      console.error("Error al cargar mensajes:", error);
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  const handleMarkAsRead = async (messageId: string) => {
    try {
      await adminFetch("/api/admin/markMessageRead", {
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
      const response = await adminFetch("/api/admin/replyMessage", {
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
  const formatShort = (iso: string | null) => {
    if (!iso) return "";
    return new Date(iso).toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };
  const formatLong = (iso: string | null) => {
    if (!iso) return "";
    return new Date(iso).toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };
  const threadStatusLabel = (msg: (typeof messages)[0]) => {
    if (msg.closed) return { text: "Finalizado", className: "text-[var(--landing-muted)]" };
    if (msg.initiatedByAdmin) return { text: "Enviado por admin", className: "text-[var(--landing-accent)]" };
    const replies = msg.replies || [];
    if (replies.length === 0) return { text: "Responder", className: "text-[var(--brand-start)]" };
    const lastReply = replies[replies.length - 1];
    return lastReply?.senderType === "admin"
      ? { text: "Respondido", className: "text-[var(--brand-end)]" }
      : { text: "Cliente respondió", className: "text-[var(--landing-accent)]" };
  };
  const detailStatusBadge = (msg: (typeof messages)[number]) => {
    if (msg.closed) {
      return (
        <span className="rounded-full border border-[var(--landing-border)] bg-[var(--landing-surface)] px-2.5 py-1 text-[11px] font-medium text-[var(--landing-muted)]">
          Chat finalizado
        </span>
      );
    }
    const replies = msg.replies || [];
    if (replies.length === 0) {
      return (
        <span className="rounded-full border border-[color-mix(in_oklab,var(--brand-start)_30%,transparent)] bg-[color-mix(in_oklab,var(--brand-start)_10%,transparent)] px-2.5 py-1 text-[11px] font-medium text-[var(--foreground)]">
          Pendiente de respuesta
        </span>
      );
    }
    const lastReply = replies[replies.length - 1];
    return lastReply?.senderType === "admin" ? (
      <span className="rounded-full border border-[color-mix(in_oklab,var(--brand-end)_30%,transparent)] bg-[color-mix(in_oklab,var(--brand-end)_10%,transparent)] px-2.5 py-1 text-[11px] font-medium text-[var(--foreground)]">
        Respondido
      </span>
    ) : (
      <span className="rounded-full border border-[color-mix(in_oklab,var(--landing-accent)_30%,transparent)] bg-[color-mix(in_oklab,var(--landing-accent)_10%,transparent)] px-2.5 py-1 text-[11px] font-medium text-[var(--foreground)]">
        Cliente respondió
      </span>
    );
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/65 p-2 backdrop-blur-md sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 16 }}
        transition={{ type: "spring", damping: 26, stiffness: 320 }}
        className="relative flex max-h-[min(92vh,880px)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-[var(--landing-border)] bg-[color-mix(in_oklab,var(--background)_88%,#0b1020)] shadow-[0_24px_80px_-32px_rgba(0,0,0,0.85)] ring-1 ring-[color-mix(in_oklab,var(--foreground)_5%,transparent)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative shrink-0 border-b border-[var(--landing-border)] bg-[color-mix(in_oklab,var(--landing-surface)_70%,transparent)] px-3 py-3 sm:px-5 sm:py-4">
          <div className="relative flex items-center justify-between gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
              {selectedMessage && (
                <button
                  type="button"
                  onClick={() => setSelectedMessage(null)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface)] text-[var(--foreground)] transition hover:bg-[var(--landing-surface-2)] md:hidden"
                  aria-label="Volver a la lista"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
                    <path d="M19 12H5M12 19l-7-7 7-7" />
                  </svg>
                </button>
              )}
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--landing-surface)] ring-1 ring-[var(--landing-border)]">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5 text-[var(--landing-accent)]">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate text-base font-semibold tracking-tight text-[var(--foreground)] sm:text-lg">Mensajes (Admin)</h2>
                  {unreadCount > 0 && (
                    <span className="shrink-0 rounded-full bg-[color-mix(in_oklab,var(--landing-accent)_35%,transparent)] px-2 py-0.5 text-[11px] font-semibold text-[var(--foreground)] ring-1 ring-[color-mix(in_oklab,var(--landing-accent)_45%,transparent)]">
                      {unreadCount} sin leer
                    </span>
                  )}
                </div>
                <p className="truncate text-xs text-[var(--landing-muted)]">Chats con clientes</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-[var(--landing-muted)] transition hover:bg-[var(--landing-surface)] hover:text-[var(--foreground)]"
              aria-label="Cerrar"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-1 flex-col gap-3 p-4 sm:p-6">
            <div className="h-4 w-40 animate-pulse rounded-lg bg-white/5" />
            <div className="h-4 w-full animate-pulse rounded-lg bg-white/5" />
            <div className="h-4 w-3/4 animate-pulse rounded-lg bg-white/5" />
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 gap-0 overflow-hidden">
            <div className={`${selectedMessage ? "hidden md:flex" : "flex"} w-full shrink-0 flex-col border-[var(--landing-border)] md:w-[min(100%,320px)] md:border-r lg:w-[340px]`}>
              {messages.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-12 text-center">
                  <p className="text-sm text-[var(--landing-muted)]">No hay mensajes por ahora.</p>
                </div>
              ) : (
                <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-2 sm:p-3">
                  {messages.map((msg) => {
                    const status = threadStatusLabel(msg);
                    const active = selectedMessage === msg.id;
                    return (
                    <button
                      key={msg.id}
                      type="button"
                      onClick={() => {
                        setSelectedMessage(msg.id);
                        if (!msg.read) {
                          handleMarkAsRead(msg.id);
                        }
                      }}
                      className={`w-full rounded-xl border p-3 text-left transition ${
                        active
                          ? "border-[color-mix(in_oklab,var(--landing-accent)_45%,transparent)] bg-[color-mix(in_oklab,var(--landing-accent)_12%,transparent)]"
                          : msg.read
                            ? "border-transparent bg-[var(--landing-surface)]/40 hover:bg-[var(--landing-surface)]"
                            : "border-transparent bg-[color-mix(in_oklab,var(--landing-accent)_8%,transparent)] hover:bg-[color-mix(in_oklab,var(--landing-accent)_14%,transparent)]"
                      }`}
                    >
                      <div className="flex gap-2">
                        <div className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${msg.read ? "bg-transparent" : "bg-[var(--landing-accent)]"}`} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-[var(--foreground)]">{msg.subject}</p>
                          <p className={`mt-0.5 text-[11px] ${status.className}`}>{status.text}</p>
                          <p className="mt-1 text-[10px] text-[var(--landing-muted)]">{msg.userName || msg.userEmail || "Usuario"}</p>
                          {msg.createdAt && <p className="mt-1 text-[10px] text-[var(--landing-muted)]">{formatShort(msg.createdAt)}</p>}
                        </div>
                      </div>
                    </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className={`${selectedMessage ? "flex" : "hidden md:flex"} min-h-0 min-w-0 flex-1 flex-col bg-[color-mix(in_oklab,var(--background)_40%,transparent)]`}>
              {selectedMsg ? (
                <>
                  <div ref={messagesScrollRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-5">
                    <div className="mx-auto max-w-2xl space-y-4">
                      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[var(--landing-border)]/80 pb-3">
                        <div className="min-w-0">
                          <h3 className="text-lg font-semibold leading-tight text-[var(--foreground)]">{selectedMsg.subject}</h3>
                          <p className="mt-1 text-xs text-[var(--landing-muted)]">Iniciado · {formatLong(selectedMsg.createdAt)}</p>
                          <p className="mt-1 text-xs text-[var(--landing-muted)]">{selectedMsg.userName || selectedMsg.userEmail || "Usuario"}</p>
                        </div>
                        {detailStatusBadge(selectedMsg)}
                      </div>

                      <div className="flex justify-start">
                        <div className="max-w-[92%] sm:max-w-[85%]">
                          <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-[var(--landing-muted)]">Cliente</p>
                          <div className="rounded-2xl rounded-tl-md border border-[color-mix(in_oklab,var(--landing-accent)_25%,transparent)] bg-[color-mix(in_oklab,var(--landing-accent)_10%,transparent)] px-4 py-3 text-[var(--foreground)]">
                            <p className="whitespace-pre-wrap text-sm leading-relaxed">{selectedMsg.message}</p>
                          </div>
                        </div>
                      </div>

                      {selectedMsg.replies && selectedMsg.replies.length > 0 && (
                        <div className="space-y-3">
                          <p className="text-center text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--landing-muted)]">Conversación</p>
                          {selectedMsg.replies.map((reply, index) => {
                            const senderName = reply.senderName || (reply.senderType === "admin" ? "Equipo de FitPlan" : "Usuario");
                            const replyDate = reply.createdAt ? new Date(reply.createdAt) : null;
                            const isAdminReply = reply.senderType === "admin";

                            return (
                              <div key={index} className={`flex ${isAdminReply ? "justify-end" : "justify-start"}`}>
                                <div className={`max-w-[92%] sm:max-w-[85%]`}>
                                  <div
                                    className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                                      isAdminReply
                                        ? "rounded-tr-md border border-[color-mix(in_oklab,var(--brand-end)_25%,transparent)] bg-[color-mix(in_oklab,var(--brand-end)_12%,transparent)] text-[var(--foreground)]"
                                        : "rounded-tl-md border border-[color-mix(in_oklab,var(--landing-accent)_25%,transparent)] bg-[color-mix(in_oklab,var(--landing-accent)_10%,transparent)] text-[var(--foreground)]"
                                    }`}
                                  >
                                    <p className="mb-1 text-xs font-semibold text-[var(--foreground)]/90">{senderName}</p>
                                    <p className="whitespace-pre-wrap">{reply.message}</p>
                                  </div>
                                  {replyDate && (
                                    <p className={`mt-1 text-[10px] text-[var(--landing-muted)] ${isAdminReply ? "text-right" : "text-left"}`}>
                                      {replyDate.toLocaleDateString("es-AR", {
                                        day: "2-digit",
                                        month: "2-digit",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })}
                                    </p>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {selectedMsg.closed && selectedMsg.closedAt && (
                        <div className="rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface)]/30 px-4 py-3 text-center">
                          <p className="text-xs text-[var(--landing-muted)]">
                            Chat finalizado el {formatLong(selectedMsg.closedAt)}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0 border-t border-[var(--landing-border)] bg-[color-mix(in_oklab,var(--background)_92%,#0a0f18)] px-3 py-3 sm:px-5 sm:py-4">
                    {selectedMsg.closed ? (
                      <div className="rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface)]/40 px-4 py-4 text-center">
                        <p className="text-sm font-medium text-[var(--landing-muted)]">Este chat ha sido finalizado</p>
                        <p className="mt-1 text-xs text-[var(--landing-muted)]/85">No se pueden enviar más mensajes</p>
                      </div>
                    ) : (
                      <div className="mx-auto max-w-2xl space-y-3">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <label className="text-xs font-medium text-[var(--landing-muted)]">
                            {selectedMsg.replied ? "Agregar otra respuesta" : "Responder"}
                          </label>
                          <button
                            type="button"
                            onClick={async () => {
                              if (!selectedMsg || !confirm("¿Estás seguro de que deseas finalizar este chat? No se podrán enviar más mensajes.")) {
                                return;
                              }
                              
                              try {
                                const response = await adminFetch("/api/admin/closeChat", {
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
                            className="w-full rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface)] px-3 py-2 text-xs text-[var(--foreground)] transition hover:bg-[var(--landing-surface-2)] sm:w-auto"
                          >
                            Finalizar Chat
                          </button>
                        </div>
                        <textarea
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder="Escribe tu respuesta..."
                          rows={3}
                          className="w-full resize-none rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface)] px-4 py-3 text-sm text-[var(--foreground)] placeholder:text-[var(--landing-muted)]/70 focus:border-[color-mix(in_oklab,var(--landing-accent)_50%,transparent)] focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklab,var(--landing-accent)_25%,transparent)]"
                        />
                        <button
                          type="button"
                          onClick={() => handleReply(selectedMsg.id)}
                          disabled={replying || !replyText.trim()}
                          className="w-full rounded-xl border border-[color-mix(in_oklab,var(--brand-end)_45%,transparent)] bg-[color-mix(in_oklab,var(--brand-end)_16%,transparent)] py-3 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[color-mix(in_oklab,var(--brand-end)_24%,transparent)] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {replying ? "Enviando..." : selectedMsg.replied ? "Agregar respuesta" : "Enviar respuesta"}
                        </button>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="my-6 flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--landing-surface)] ring-1 ring-[var(--landing-border)]">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-7 w-7 text-[var(--landing-muted)]">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                  </div>
                  <p className="max-w-xs text-sm text-[var(--landing-muted)]">Seleccioná una conversación para ver el hilo completo.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}

