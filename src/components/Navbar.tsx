import { useRouter } from "next/router";
import Link from "next/link";
import Image from "next/image";
import { useAuthStore } from "@/store/authStore";
import { motion, useReducedMotion, type TargetAndTransition } from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";
import LoginModal from "./LoginModal";
import UserMessagesModal from "./UserMessagesModal";
import GymCalendarModal from "./GymCalendarModal";
import { SendMessageModal, MessagesModal } from "./nav/NavbarModals";
import { CONTACT_FORM_URL } from "./ContactButton";
import { getDbSafe, getAuthSafe } from "@/lib/firebase";
import { adminFetch } from "@/lib/adminAuthClient";
import { collection, query, where, getDocs, limit, doc, getDoc, updateDoc } from "firebase/firestore";
import { useAppLocale } from "@/contexts/AppLocaleContext";
import { ui } from "@/lib/i18n/appUi";
import { getPendingWeightOpsTotalCount, WEIGHT_QUEUE_CHANGED_EVENT } from "@/lib/weightSyncQueue";
import {
  FaHome,
  FaDumbbell,
  FaCommentDots,
  FaUserCircle,
  FaBell,
  FaGlobe,
  FaSignOutAlt,
  FaExternalLinkAlt,
  FaEnvelope,
  FaCalendarAlt,
  FaSyncAlt,
  FaTimes,
  FaChevronDown,
} from "react-icons/fa";

/**
 * Nav de cliente — DESIGN_SYSTEM.md §11, opción A ("chrome persistente"),
 * decisión y aprobación de Lucas. Demo de referencia: /client-navbar-preview.
 *
 * - Mobile (`< md`): top bar mínima (solo logo) + tab bar inferior fija con
 *   Inicio/Mi plan/Mensajes/Cuenta (§11.4-A/B), solo con sesión + plan.
 * - Desktop (`md:` y superior): top bar única con navegación real inline,
 *   mismo criterio de "activo" que `AdminShell.tsx` (§11.4-C).
 * - `minimal`: legal/*, payment/* (§11.4-D) y `create-plan` (flujo lineal de
 *   una sola tarea, mismo criterio ya aplicado a `formulario-de-inicio`) —
 *   sin links de producto ni tab bar, solo logo + idioma/cuenta.
 *
 * Sin animación de entrada en ningún elemento de este chrome (§11.6): el
 * único motion admitido es el "wiggle" (scale/rotate en loop) del ícono de
 * mensajes cuando hay no leídos, envuelto en `useReducedMotion()`.
 */
export default function Navbar({ minimal = false }: { minimal?: boolean }) {
  const router = useRouter();
  const { locale, setLocale } = useAppLocale();
  const { user: authUser, logout, initializeAuth, loading: authLoading } = useAuthStore();
  const reduceMotion = useReducedMotion();

  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [hasPlans, setHasPlans] = useState<boolean | null>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const [messagesCount, setMessagesCount] = useState(0);
  const [adminNotificationUnread, setAdminNotificationUnread] = useState(0);
  const [adminNewUsersUnread, setAdminNewUsersUnread] = useState(0);
  const [adminLastUsersCheck, setAdminLastUsersCheck] = useState<string | null>(null);
  const [adminNotificationsOpen, setAdminNotificationsOpen] = useState(false);
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

  // Un solo estado controla el sheet inferior (mobile) y el dropdown (desktop)
  // del botón de cuenta — mutuamente excluyentes por breakpoint vía CSS, así
  // que no hace falta trackearlos por separado.
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const desktopAccountRef = useRef<HTMLDivElement | null>(null);
  const adminNotificationsRef = useRef<HTMLDivElement | null>(null);
  const tabBarRef = useRef<HTMLDivElement | null>(null);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        setMessagesCount(prev => prev !== newCount ? newCount : prev);
      } catch (error) {
        // Silenciar errores en polling
      }
    };

    checkMessages();
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
        setUserMessagesCount(prev => prev !== newCount ? newCount : prev);
      } catch (error) {
        // Silenciar errores en polling
      }
    };

    checkUserMessages();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser, isAdmin]);

  useEffect(() => {
    setAccountMenuOpen(false);
    setAdminNotificationsOpen(false);
  }, [router.pathname]);

  useEffect(() => {
    if (!accountMenuOpen && !adminNotificationsOpen) return;
    const handleDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (desktopAccountRef.current?.contains(t) || adminNotificationsRef.current?.contains(t)) {
        return;
      }
      setAccountMenuOpen(false);
      setAdminNotificationsOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setAccountMenuOpen(false);
        setAdminNotificationsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleDown);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleDown);
      document.removeEventListener("keydown", handleKey);
    };
  }, [accountMenuOpen, adminNotificationsOpen]);

  // Coexistencia con CookieConsentBanner (DESIGN_SYSTEM.md §11.9): mientras la
  // tab bar está montada, marca <body> y publica su alto real (medido, no
  // hardcodeado) — mismo mecanismo que ya usa AdminShell.tsx para
  // `--admin-bottom-nav-h`. `dashboard.tsx`/`plan.tsx` ya leen
  // `--client-bottom-nav-h` con un fallback propio para su padding inferior.
  const showProductNavForBottomNav = !!authUser && hasPlans === true && !minimal;
  useEffect(() => {
    if (!showProductNavForBottomNav || typeof document === "undefined") return;
    const body = document.body;
    body.classList.add("has-bottom-nav");
    const publicarAlto = () => {
      const alto = tabBarRef.current?.getBoundingClientRect().height ?? 0;
      body.style.setProperty("--client-bottom-nav-h", `${Math.ceil(alto)}px`);
    };
    publicarAlto();
    const ro = new ResizeObserver(publicarAlto);
    if (tabBarRef.current) ro.observe(tabBarRef.current);
    return () => {
      ro.disconnect();
      body.classList.remove("has-bottom-nav");
      body.style.removeProperty("--client-bottom-nav-h");
    };
  }, [showProductNavForBottomNav]);

  const handleLogout = async () => {
    setAccountMenuOpen(false);
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
        }
      } catch (error) {
        console.error("Error al actualizar lastUsersCheck en logout:", error);
      }
    }
    await logout();
    router.push("/");
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
    setAccountMenuOpen(false);
  };

  const pickLocaleEn = () => {
    setLocale("en");
    persistAppLocale("en");
    const mapped = marketingEsToEn[router.pathname];
    if (mapped) {
      router.push(mapped);
    }
    setAccountMenuOpen(false);
  };

  const hasPlan = hasPlans === true;
  // La navegación de producto (links de escritorio + tab bar) solo aplica con
  // sesión + plan, y nunca en flujos "minimal" (create-plan/legal/payment,
  // DESIGN_SYSTEM.md §11.4-D) — mismo criterio ya usado para no montar este
  // nav en `formulario-de-inicio.tsx`.
  const showProductNav = !!authUser && hasPlan && !minimal;
  // Corrige el bug de 11.1.1: el logo va a la home REAL del usuario, nunca a
  // la landing pública si hay sesión.
  const homeHref = isAdmin ? "/admin" : hasPlan ? "/dashboard" : authUser ? "/create-plan" : "/";
  const openMessages = () => {
    if (isAdmin) setMessagesModalOpen(true);
    else setUserMessagesModalOpen(true);
  };
  const isMessagesActive = isAdmin ? messagesModalOpen : userMessagesModalOpen;
  const badgeWiggle: TargetAndTransition | undefined =
    !reduceMotion && !isAdmin && userMessagesCount > 0 ? { scale: [1, 1.08, 1], rotate: [0, -4, 4, 0] } : undefined;
  const adminChatWiggle: TargetAndTransition | undefined =
    !reduceMotion && messagesCount > 0 ? { scale: [1, 1.06, 1], rotate: [0, -4, 4, 0] } : undefined;

  const accountLabel = isAdmin ? ui(locale, "menuAccountAdmin") : userName ? `${ui(locale, "menuAccount")} — ${userName}` : ui(locale, "menuAccount");
  const accountAriaLabel = isAdmin
    ? ui(locale, "openMenuAdmin")
    : userName
      ? `${ui(locale, "openMenuNamed")}, ${userName}`
      : ui(locale, "openMenuNamed");

  return (
    <>
      <nav className="fixed inset-x-0 top-0 z-50 w-full border-b border-border bg-[color-mix(in_oklab,var(--background)_88%,transparent)] backdrop-blur-md supports-[padding:max(0px)]:pt-[env(safe-area-inset-top)]">
        <div className="flex w-full items-center justify-between gap-2 px-3 py-2.5 sm:px-6 sm:py-3">
          <Link
            href={homeHref}
            className="flex min-w-0 shrink-0 items-center gap-2 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-xl bg-surface ring-1 ring-border sm:h-9 sm:w-9">
              <Image src="/brand/icon-social-transparent.svg" alt="" width={36} height={36} className="object-contain p-1" priority />
            </span>
            <span className="hidden truncate text-sm font-semibold tracking-tight text-foreground sm:inline sm:text-base">FitPlan</span>
          </Link>

          {/* Desktop: navegación de producto real (§11.4-C) — no aplica en minimal */}
          {!minimal && authUser && (
            <div className="hidden items-center gap-1 md:flex">
              {hasPlan ? (
                <>
                  <TopNavLink label={ui(locale, "navHome")} icon={FaHome} active={isDashboardPage} onClick={() => router.push("/dashboard")} />
                  <TopNavLink label={ui(locale, "navMyPlan")} icon={FaDumbbell} active={isPlanPage} onClick={() => router.push("/plan")} />
                  <TopNavLink
                    label={ui(locale, "navMessages")}
                    icon={FaCommentDots}
                    active={isMessagesActive}
                    onClick={openMessages}
                    badge={!isAdmin && userMessagesCount > 0 ? userMessagesCount : undefined}
                  />
                </>
              ) : hasPlans === false ? (
                <TopNavLink label={ui(locale, "navCreatePlan")} icon={FaDumbbell} active onClick={() => router.push("/create-plan")} />
              ) : null}
            </div>
          )}

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            {/* Idioma: una sola ubicación (corrige 11.1.2) — visible siempre sin
                sesión; con sesión, se muda a esta fila solo en desktop, y en
                mobile vive dentro del sheet/menú de Cuenta. */}
            <LangToggle locale={locale} onEs={pickLocaleEs} onEn={pickLocaleEn} className={authUser ? "hidden md:flex" : "flex"} />

            {!minimal && authUser && isAdmin && (
              <div className="relative hidden md:block" ref={adminNotificationsRef}>
                <IconButton
                  icon={FaBell}
                  label={ui(locale, "navNotifications")}
                  badge={adminNotificationUnread}
                  onClick={() => void openAdminNotifications()}
                />
                {adminNotificationsOpen && (
                  <div className="absolute right-0 top-[calc(100%+10px)] z-[10040] w-[min(92vw,380px)] rounded-2xl border border-border bg-[color-mix(in_oklab,var(--background)_96%,#0f172a)] p-3 shadow-[0_24px_60px_-26px_rgba(0,0,0,0.65)] ring-1 ring-[color-mix(in_oklab,var(--foreground)_6%,transparent)]">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">{ui(locale, "navNotifications")}</p>
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
                          onClick={() => setAdminNotificationFilter(id as "all" | "payments" | "fatigue" | "risk" | "emails" | "users")}
                          className={`rounded-lg border px-2 py-1 text-[11px] transition ${
                            adminNotificationFilter === id
                              ? "border-accent/40 bg-accent/12 text-accent"
                              : "border-border bg-surface text-text-muted hover:text-foreground"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    {!!adminLastUsersCheck && (
                      <p className="mb-2 text-[10px] uppercase tracking-wide text-text-muted">
                        Última revisión: {new Date(adminLastUsersCheck).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    )}
                    {isAllNotificationsFilter && (
                      <p className="mb-2 text-[10px] uppercase tracking-wide text-text-muted">
                        Mostrando {visibleNotificationsCount} de {visibleAdminNotificationItems.length}
                      </p>
                    )}
                    <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                      {visibleNotificationsCount === 0 ? (
                        <p className="rounded-lg border border-border bg-surface px-3 py-2 text-xs text-text-muted">Sin notificaciones recientes.</p>
                      ) : (
                        limitedGroupedAdminNotificationItems.map(([dayKey, dayItems]) => (
                          <div key={dayKey} className="space-y-1.5">
                            <p className="px-1 text-[10px] font-semibold uppercase tracking-wide text-text-muted">{dayKey}</p>
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
                                  className="w-full rounded-lg border border-border bg-surface/80 px-3 py-2 text-left text-xs text-foreground transition hover:border-info/35 hover:bg-surface"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="text-[10px] uppercase tracking-wide text-text-muted">{hourLabel}</p>
                                    <p className="text-[10px] uppercase tracking-wide text-text-muted">{String(item.provider || item.type || "Notificación")}</p>
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
                    {isAllNotificationsFilter && (
                      <div className="mt-2 border-t border-border pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            setAdminNotificationsOpen(false);
                            router.push("/admin/actividad");
                          }}
                          className="w-full rounded-lg border border-info/30 bg-info/10 px-3 py-2 text-xs font-semibold text-info transition-colors hover:bg-info/20"
                        >
                          Ver todas
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {!minimal && authUser && isAdmin && (
              <IconButton
                icon={FaCommentDots}
                label={ui(locale, "navAdminChat")}
                badge={messagesCount}
                wiggle={adminChatWiggle}
                onClick={() => setMessagesModalOpen(true)}
                className="hidden md:inline-flex"
              />
            )}

            {!minimal && authUser && !isAdmin && pendingWeightOpsCount > 0 && (
              <div
                className="hidden h-9 items-center gap-1.5 rounded-full border border-warning/35 bg-warning/12 px-3 text-xs font-semibold text-warning md:inline-flex"
                title={locale === "en" ? "Pending sync entries from this device" : "Registros pendientes de sincronizacion en este dispositivo"}
              >
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-warning" />
                {ui(locale, "navPendingSync")} · {pendingWeightOpsCount > 99 ? "99+" : pendingWeightOpsCount}
              </div>
            )}

            {authUser ? (
              <div className="relative" ref={desktopAccountRef}>
                <button
                  type="button"
                  onClick={() => setAccountMenuOpen((o) => !o)}
                  aria-expanded={accountMenuOpen}
                  aria-haspopup="menu"
                  title={accountLabel}
                  aria-label={accountAriaLabel}
                  className={`flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center gap-1.5 rounded-xl border border-border bg-surface px-1 transition-colors hover:bg-surface-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:h-10 sm:w-auto sm:px-2 ${
                    showProductNav ? "hidden md:flex" : "flex"
                  }`}
                >
                  <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/20 text-xs font-semibold text-foreground ring-1 ring-accent/40">
                    {authUser.email?.charAt(0).toUpperCase() || "U"}
                    {isPremium && !isAdmin && (
                      <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-warning ring-2 ring-background" title="Premium" />
                    )}
                    <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-success ring-2 ring-background" title={ui(locale, "connected")} aria-hidden />
                  </span>
                  <span className="hidden min-w-0 max-w-[9rem] truncate text-xs font-medium text-foreground md:inline">
                    {isAdmin ? ui(locale, "admin") : userName || ui(locale, "connected")}
                  </span>
                  <FaChevronDown className={`hidden h-3 w-3 shrink-0 text-text-muted transition-transform md:block ${accountMenuOpen ? "rotate-180" : ""}`} aria-hidden />
                </button>

                {/* Dropdown recortado — desktop (§11.4-C): sin idioma (ya está en
                    la fila) y sin shortcut "ir a mi dashboard" (redundante con
                    el logo y los links inline). Solo estado + cerrar sesión. */}
                {accountMenuOpen && (
                  <div className="absolute right-0 top-[calc(100%+8px)] z-[60] hidden w-60 rounded-xl border border-border bg-[color-mix(in_oklab,var(--background)_96%,#0f172a)] py-1 shadow-[0_20px_50px_-24px_rgba(0,0,0,0.65)] ring-1 ring-[color-mix(in_oklab,var(--foreground)_6%,transparent)] md:block">
                    <div className="px-3 py-2.5">
                      <p className="truncate text-sm font-semibold text-foreground">{isAdmin ? ui(locale, "admin") : userName || ui(locale, "connected")}</p>
                      <p className="mt-0.5 text-xs text-text-muted">{ui(locale, "connected")}{isPremium && !isAdmin ? " · Premium" : ""}</p>
                    </div>
                    <div className="my-1 h-px bg-border" role="separator" />
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-medium text-foreground transition hover:bg-danger/10 hover:text-danger"
                    >
                      <FaSignOutAlt className="h-4 w-4 shrink-0" aria-hidden />
                      {ui(locale, "signOut")}
                    </button>
                  </div>
                )}
              </div>
            ) : authLoading ? (
              <span className="px-3 py-2 text-xs text-text-muted sm:text-sm">{ui(locale, "loading")}</span>
            ) : (
              <button
                type="button"
                onClick={() => setLoginModalOpen(true)}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-medium text-foreground ring-1 ring-border bg-surface transition-colors hover:bg-surface-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:gap-2 sm:px-3 sm:text-sm"
              >
                {ui(locale, "signIn")}
              </button>
            )}
          </div>
        </div>
      </nav>
      {/* Spacer del top bar fijo */}
      <div aria-hidden className="h-[calc(56px+env(safe-area-inset-top))] sm:h-[calc(64px+env(safe-area-inset-top))]" />

      {/* Tab bar inferior — mobile, solo con sesión + plan (§11.4-B) */}
      {showProductNav && (
        <nav
          ref={tabBarRef}
          aria-label={ui(locale, "navMainAria")}
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          className="fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-around border-t border-border bg-[color-mix(in_oklab,var(--background)_88%,transparent)] backdrop-blur-md md:hidden"
        >
          <TabBarItem label={ui(locale, "navHome")} icon={FaHome} active={isDashboardPage} onClick={() => router.push("/dashboard")} />
          <TabBarItem
            label={ui(locale, "navMyPlan")}
            icon={FaDumbbell}
            active={isPlanPage}
            onClick={() => router.push("/plan")}
            dotWarning={!isAdmin && pendingWeightOpsCount > 0}
          />
          <TabBarItem
            label={ui(locale, "navMessages")}
            icon={FaCommentDots}
            active={isMessagesActive}
            onClick={openMessages}
            count={!isAdmin && userMessagesCount > 0 ? userMessagesCount : undefined}
            wiggle={badgeWiggle}
          />
          <TabBarItem label={ui(locale, "navAccount")} icon={FaUserCircle} active={accountMenuOpen} onClick={() => setAccountMenuOpen(true)} />
        </nav>
      )}

      {/* Sheet de Cuenta — mobile (§11.4-B punto 4): idioma, sync, gym,
          notificaciones/chat admin si es admin, contacto (pedido de Lucas:
          el FAB de contacto se oculta <768px, así que su acceso se muda
          acá), ver sitio, cerrar sesión. */}
      {accountMenuOpen && authUser && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm md:hidden" onClick={() => setAccountMenuOpen(false)}>
          <motion.div
            initial={reduceMotion ? undefined : { y: 24 }}
            animate={{ y: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-border bg-surface p-4 pb-[calc(env(safe-area-inset-bottom)+16px)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">{isAdmin ? ui(locale, "admin") : userName || ui(locale, "connected")}</p>
              <button
                type="button"
                onClick={() => setAccountMenuOpen(false)}
                aria-label={ui(locale, "navClose")}
                className="flex h-11 w-11 items-center justify-center rounded-lg text-text-muted hover:bg-surface-2"
              >
                <FaTimes className="h-4 w-4" aria-hidden />
              </button>
            </div>

            <div className="space-y-1">
              {isAdmin && (
                <SheetRow
                  icon={FaBell}
                  label={ui(locale, "navNotifications")}
                  trailing={adminNotificationUnread > 0 ? <span className="badge badge-info">{adminNotificationUnread > 9 ? "9+" : adminNotificationUnread}</span> : undefined}
                  onClick={() => {
                    setAccountMenuOpen(false);
                    router.push("/admin/actividad");
                  }}
                />
              )}
              {isAdmin && (
                <SheetRow
                  icon={FaCommentDots}
                  label={ui(locale, "navAdminChat")}
                  trailing={messagesCount > 0 ? <span className="badge badge-info">{messagesCount > 9 ? "9+" : messagesCount}</span> : undefined}
                  onClick={() => {
                    setAccountMenuOpen(false);
                    setMessagesModalOpen(true);
                  }}
                />
              )}
              {!isAdmin && pendingWeightOpsCount > 0 && (
                <SheetRow icon={FaSyncAlt} label={`${ui(locale, "navPendingSync")} · ${pendingWeightOpsCount > 99 ? "99+" : pendingWeightOpsCount}`} tone="warning" />
              )}
              {!isAdmin && (
                <SheetRow
                  icon={FaCalendarAlt}
                  label={currentMonthGymDays > 0 ? `${ui(locale, "navGymDays")} · ${currentMonthGymDays}` : ui(locale, "navGymDays")}
                  onClick={() => {
                    setAccountMenuOpen(false);
                    setGymCalendarModalOpen(true);
                  }}
                />
              )}

              <div className="my-2 h-px bg-border" role="separator" />

              <SheetRow
                icon={FaGlobe}
                label={`${ui(locale, "language")}: ${locale === "es" ? "Español" : "English"}`}
                onClick={locale === "es" ? pickLocaleEn : pickLocaleEs}
              />

              <SheetRow icon={FaEnvelope} label={ui(locale, "navContact")} href={CONTACT_FORM_URL} external />
              <SheetRow icon={FaExternalLinkAlt} label={ui(locale, "navViewSite")} href="/" muted />

              <div className="my-2 h-px bg-border" role="separator" />

              <SheetRow icon={FaSignOutAlt} label={ui(locale, "signOut")} tone="danger" onClick={handleLogout} />
            </div>
          </motion.div>
        </div>
      )}

      <LoginModal isOpen={loginModalOpen} onClose={() => setLoginModalOpen(false)} defaultMode="login" locale={locale} />

      {sendMessageModalOpen && (
        <SendMessageModal
          isOpen={sendMessageModalOpen}
          onClose={() => setSendMessageModalOpen(false)}
          userName={userName}
          userEmail={authUser?.email || null}
          onMessageSent={() => {
            if (authUser && !isAdmin) {
              fetch(`/api/user/messages?userId=${authUser.uid}`)
                .then(res => res.json())
                .then(data => setUserMessagesCount(data.unreadRepliesCount || 0))
                .catch(err => console.error("Error al actualizar mensajes:", err));
            }
          }}
        />
      )}

      {!isAdmin && userMessagesModalOpen && (
        <UserMessagesModal
          isOpen={userMessagesModalOpen}
          onClose={() => setUserMessagesModalOpen(false)}
          userId={authUser?.uid || ""}
          onMessagesUpdate={async () => {
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

      {isAdmin && messagesModalOpen && (
        <MessagesModal
          isOpen={messagesModalOpen}
          onClose={() => setMessagesModalOpen(false)}
          adminUserId={authUser?.uid || ""}
          onMessagesUpdate={() => {
            if (authUser && isAdmin) {
              adminFetch(`/api/admin/messages?adminUserId=${authUser.uid}`)
                .then(res => res.json())
                .then(data => setMessagesCount(data.unreadCount || 0))
                .catch(err => console.error("Error al actualizar mensajes:", err));
            }
          }}
        />
      )}

      {!isAdmin && gymCalendarModalOpen && (
        <GymCalendarModal
          isOpen={gymCalendarModalOpen}
          onClose={() => {
            setGymCalendarModalOpen(false);
            loadGymDaysCount();
          }}
        />
      )}
    </>
  );
}

function TopNavLink({
  label,
  icon: Icon,
  active,
  onClick,
  badge,
}: {
  label: string;
  icon: typeof FaHome;
  active: boolean;
  onClick: () => void;
  badge?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-current={active ? "page" : undefined}
      className={`relative flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
        active ? "bg-accent/12 text-accent" : "text-text-muted hover:bg-surface-2 hover:text-foreground"
      }`}
    >
      <Icon className="h-4 w-4" aria-hidden />
      {label}
      {badge !== undefined && (
        <span className="ml-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold leading-none text-accent-ink">
          {badge > 9 ? "9+" : badge}
        </span>
      )}
    </button>
  );
}

function IconButton({
  icon: Icon,
  label,
  badge,
  wiggle,
  onClick,
  className = "",
}: {
  icon: typeof FaHome;
  label: string;
  badge?: number;
  wiggle?: TargetAndTransition;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={`relative inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-surface text-foreground/90 transition-colors hover:bg-surface-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:h-10 sm:w-10 ${className}`}
    >
      <motion.span animate={wiggle} transition={{ duration: 0.5, repeat: wiggle ? Infinity : 0, repeatDelay: 2 }} className="inline-flex">
        <Icon className="h-4 w-4" aria-hidden />
      </motion.span>
      {!!badge && badge > 0 && (
        <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-background bg-accent px-1 text-[10px] font-bold text-accent-ink">
          {badge > 9 ? "9+" : badge}
        </span>
      )}
    </button>
  );
}

function LangToggle({
  locale,
  onEs,
  onEn,
  className = "",
}: {
  locale: "es" | "en";
  onEs: () => void;
  onEn: () => void;
  className?: string;
}) {
  return (
    <div className={`items-center rounded-lg bg-surface-2 p-0.5 text-xs ring-1 ring-border ${className}`} aria-label={ui(locale, "language")}>
      <button type="button" onClick={onEs} className={`rounded-md px-2 py-1 font-medium transition-colors ${locale === "es" ? "bg-surface-3 text-foreground" : "text-text-muted hover:text-foreground"}`}>
        ES
      </button>
      <button type="button" onClick={onEn} className={`rounded-md px-2 py-1 font-medium transition-colors ${locale === "en" ? "bg-surface-3 text-foreground" : "text-text-muted hover:text-foreground"}`}>
        EN
      </button>
    </div>
  );
}

function TabBarItem({
  label,
  icon: Icon,
  active,
  onClick,
  count,
  dotWarning,
  wiggle,
}: {
  label: string;
  icon: typeof FaHome;
  active: boolean;
  onClick: () => void;
  count?: number;
  dotWarning?: boolean;
  wiggle?: TargetAndTransition;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      aria-label={label}
      className="flex min-h-[52px] min-w-[64px] flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] font-medium"
    >
      <motion.span
        animate={wiggle}
        transition={{ duration: 0.5, repeat: wiggle ? Infinity : 0, repeatDelay: 2 }}
        className={`relative inline-flex h-6 w-6 items-center justify-center ${active ? "text-accent" : "text-text-muted"}`}
      >
        <Icon className="h-[1.15rem] w-[1.15rem]" aria-hidden />
        {count !== undefined && (
          <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-0.5 text-[9px] font-bold leading-none text-accent-ink ring-2 ring-background">
            {count > 9 ? "9+" : count}
          </span>
        )}
        {dotWarning && <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-warning ring-2 ring-background" />}
      </motion.span>
      <span className={active ? "text-accent" : "text-text-muted"}>{label}</span>
    </button>
  );
}

function SheetRow({
  icon: Icon,
  label,
  trailing,
  tone,
  muted,
  href,
  external,
  onClick,
}: {
  icon: typeof FaHome;
  label: string;
  trailing?: ReactNode;
  tone?: "warning" | "danger";
  muted?: boolean;
  href?: string;
  external?: boolean;
  onClick?: () => void;
}) {
  const toneClass = tone === "warning" ? "text-warning" : tone === "danger" ? "text-danger" : muted ? "text-text-subtle" : "text-foreground";
  const content = (
    <div className="flex min-h-[44px] w-full items-center gap-3 rounded-xl px-2 py-2.5 text-sm font-medium transition-colors hover:bg-surface-2">
      <Icon className={`h-4 w-4 shrink-0 ${toneClass}`} aria-hidden />
      <span className={`min-w-0 flex-1 truncate text-left ${toneClass}`}>{label}</span>
      {trailing}
    </div>
  );
  if (href) {
    return external ? (
      <a href={href} target="_blank" rel="noopener noreferrer" className="block">
        {content}
      </a>
    ) : (
      <Link href={href} className="block">
        {content}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className="block w-full">
      {content}
    </button>
  );
}
