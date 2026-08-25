import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState, type ComponentType } from "react";
import { MessagesModal } from "@/components/Navbar";
import { useAuthStore } from "@/store/authStore";
import { getDbSafe } from "@/lib/firebase";
import { adminFetch } from "@/lib/adminAuthClient";
import {
  FaChartLine,
  FaUserFriends,
  FaVideo,
  FaDumbbell,
  FaColumns,
  FaServer,
  FaBolt,
  FaBell,
  FaComment,
  FaSignOutAlt,
  FaExternalLinkAlt,
} from "react-icons/fa";

/**
 * Shell de navegación persistente del admin — DESIGN_SYSTEM.md §7.3-A / §9.
 * Envuelve las 12 vistas reales de /admin/*. Reemplaza los breadcrumbs
 * sueltos ("← Volver al panel") y la falsa jerarquía de "Configuraciones".
 *
 * Pedido explícito de Lucas (2026-08-25): Notificaciones, Chat admin y
 * Cerrar sesión se movieron acá abajo de HYROX, reusando el modal/endpoints
 * que ya existían en Navbar.tsx (MessagesModal se exporta desde ahí) en vez
 * de duplicar lógica. `<Navbar />` (la barra horizontal) ya NO se monta acá
 * — la duplicación entre ambos navs quedó resuelta.
 *
 * "Ver sitio" (pie del sidebar / final de la tira mobile) preserva el único
 * link a la home pública que ofrecía Navbar.tsx (el logo). Separado del
 * resto de destinos con su propio borde: es una salida del panel, no una
 * sección más. El selector de idioma ES/EN, el badge "Pendiente sync" y el
 * shortcut "Ir al panel admin" del Navbar NO se migraron — ver DESIGN_SYSTEM.md
 * §9 para el fundamento de cada uno.
 *
 * Ancho completo: sin max-w en el shell ni en el contenido (pedido
 * explícito de Lucas) — cada vista decide su propio ancho interno si
 * hace falta.
 */

export type AdminSectionId =
  | "resumen"
  | "clientes"
  | "contenido"
  | "ejercicios"
  | "backlog"
  | "servicios"
  | "hyrox";

type StatusDot = "success" | "warning" | "danger";

export type NavItem = {
  id: AdminSectionId;
  label: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  href: string;
  muted?: boolean;
};

export const NAV_ITEMS: NavItem[] = [
  { id: "resumen", label: "Resumen", icon: FaChartLine, href: "/admin" },
  { id: "clientes", label: "Clientes", icon: FaUserFriends, href: "/admin/clientes-fitplan" },
  { id: "contenido", label: "Contenido", icon: FaVideo, href: "/admin/configuraciones/contenido-social" },
  { id: "ejercicios", label: "Ejercicios", icon: FaDumbbell, href: "/admin/configuraciones/ejercicios" },
  { id: "backlog", label: "Backlog del equipo", icon: FaColumns, href: "/admin/backlog" },
  { id: "servicios", label: "Servicios", icon: FaServer, href: "/admin/servicios" },
  { id: "hyrox", label: "HYROX", icon: FaBolt, href: "/admin/hyrox", muted: true },
];

type ServiceStatusEntry = { configured: boolean; ok: boolean | null };

// AdminShell no es un layout persistente (el pages router no tiene getLayout):
// cada una de las 12 vistas de /admin/* monta su propio <AdminShell>, así que
// este hook se re-ejecuta en cada navegación del sidebar. servicesStatus hace
// 10 llamadas HTTP a servicios externos (incluye Stripe y MercadoPago) por
// request, así que cacheamos el resultado con TTL para no repegarle en cada click.
const SERVICES_STATUS_TTL_MS = 5 * 60 * 1000; // 5 minutos
const SERVICES_STATUS_CACHE_KEY = "fitplan-admin-services-status-dot";

type ServicesStatusCache = { dot: StatusDot; fetchedAt: number };

// Caché en memoria: sobrevive la navegación client-side entre vistas del admin
// (el módulo no se recarga) sin depender de que sessionStorage esté disponible.
let servicesStatusMemoryCache: ServicesStatusCache | null = null;
let servicesStatusInFlight: Promise<StatusDot | null> | null = null;

function readServicesStatusCache(): ServicesStatusCache | null {
  if (servicesStatusMemoryCache) return servicesStatusMemoryCache;
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SERVICES_STATUS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ServicesStatusCache;
    if (!parsed || typeof parsed.fetchedAt !== "number") return null;
    servicesStatusMemoryCache = parsed;
    return parsed;
  } catch {
    return null;
  }
}

function writeServicesStatusCache(dot: StatusDot) {
  const entry: ServicesStatusCache = { dot, fetchedAt: Date.now() };
  servicesStatusMemoryCache = entry;
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(SERVICES_STATUS_CACHE_KEY, JSON.stringify(entry));
  } catch {
    // Silencioso: sessionStorage puede no estar disponible (Safari privado, etc).
  }
}

async function fetchServicesStatusDot(): Promise<StatusDot | null> {
  try {
    const resp = await adminFetch("/api/admin/servicesStatus");
    if (!resp.ok) return null;
    const data = await resp.json();
    const services = (data?.services || []) as ServiceStatusEntry[];
    const configured = services.filter((s) => s.configured);
    let next: StatusDot = "success";
    if (configured.some((s) => s.ok === false)) next = "danger";
    else if (configured.some((s) => s.ok === null)) next = "warning";
    writeServicesStatusCache(next);
    return next;
  } catch {
    // Silencioso: si no se puede chequear, no se muestra punto (no inventamos un estado).
    return null;
  }
}

/** Punto de estado del ítem "Servicios": verde/ámbar/rojo según §7.4. */
function useServicesStatusDot(): StatusDot | null {
  const [dot, setDot] = useState<StatusDot | null>(() => readServicesStatusCache()?.dot ?? null);

  useEffect(() => {
    const cached = readServicesStatusCache();
    const isFresh = !!cached && Date.now() - cached.fetchedAt < SERVICES_STATUS_TTL_MS;
    if (isFresh) return;

    let cancelled = false;
    if (!servicesStatusInFlight) {
      servicesStatusInFlight = fetchServicesStatusDot().finally(() => {
        servicesStatusInFlight = null;
      });
    }
    servicesStatusInFlight.then((next) => {
      if (!cancelled && next !== null) setDot(next);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return dot;
}

/** Mensajes de "Chat admin" sin leer — mismo endpoint que usaba el botón de Navbar.tsx. */
function useAdminUnreadMessages(adminUserId: string | null, refreshKey: number): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!adminUserId) return;
    let cancelled = false;
    adminFetch(`/api/admin/messages?adminUserId=${adminUserId}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setCount(data?.unreadCount || 0);
      })
      .catch(() => {
        // Silencioso: si falla, no se muestra badge (no inventamos un número).
      });
    return () => {
      cancelled = true;
    };
  }, [adminUserId, refreshKey]);

  return count;
}

/**
 * No leídas de "Notificaciones" — usa el mismo total que ya calcula el
 * backend en paymentNotifications (`unreadCount`). No replica acá el merge
 * con altas de usuarios nuevos que hacía el dropdown de Navbar.tsx: ese
 * cálculo vive del lado cliente en Navbar y esta barra solo linkea a
 * /admin/actividad, no reimplementa el dropdown completo.
 */
function useAdminUnreadNotifications(adminUserId: string | null): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!adminUserId) return;
    let cancelled = false;
    adminFetch(`/api/admin/paymentNotifications?adminUserId=${adminUserId}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setCount(data?.unreadCount || 0);
      })
      .catch(() => {
        // Silencioso: si falla, no se muestra badge.
      });
    return () => {
      cancelled = true;
    };
  }, [adminUserId]);

  return count;
}

function NavButton({ item, active, dot }: { item: NavItem; active: boolean; dot?: StatusDot | null }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={`group flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
        active
          ? "bg-accent/12 text-accent"
          : item.muted
            ? "text-text-subtle hover:bg-surface-2 hover:text-text-muted"
            : "text-text-muted hover:bg-surface-2 hover:text-foreground"
      }`}
    >
      <Icon className={`h-4 w-4 shrink-0 ${active ? "text-accent" : ""}`} aria-hidden />
      <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
      {item.id === "servicios" && dot && (
        <span
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${
            dot === "success" ? "bg-success" : dot === "warning" ? "bg-warning" : "bg-danger"
          }`}
          aria-hidden
        />
      )}
    </Link>
  );
}

export function AdminShell({ active, children }: { active: AdminSectionId; children: React.ReactNode }) {
  const router = useRouter();
  const servicesDot = useServicesStatusDot();
  const authUser = useAuthStore((s) => s.user);
  const [messagesModalOpen, setMessagesModalOpen] = useState(false);
  const [messagesRefreshKey, setMessagesRefreshKey] = useState(0);
  const unreadMessages = useAdminUnreadMessages(authUser?.uid ?? null, messagesRefreshKey);
  const unreadNotifications = useAdminUnreadNotifications(authUser?.uid ?? null);

  // La tira de pills de abajo (mobile) es fixed/bottom-0, igual que
  // CookieConsentBanner — sin esto, el banner de cookies tapa por completo
  // la navegación de admin en mobile hasta que el usuario decide sobre
  // cookies (DESIGN_SYSTEM.md §11.9). `has-bottom-nav` en <body> activa la
  // regla en globals.css que sube el banner por encima de esta tira.
  useEffect(() => {
    document.body.classList.add("has-bottom-nav");
    return () => {
      document.body.classList.remove("has-bottom-nav");
    };
  }, []);

  const handleAdminLogout = async () => {
    if (authUser) {
      try {
        const db = getDbSafe();
        if (db) {
          const { doc, updateDoc, serverTimestamp } = await import("firebase/firestore");
          await updateDoc(doc(db, "usuarios", authUser.uid), {
            lastUsersCheck: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      } catch (error) {
        console.error("Error al actualizar lastUsersCheck en logout:", error);
      }
    }
    await useAuthStore.getState().logout();
    router.push("/");
  };

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <div className="flex w-full">
        {/* Reserva el ancho del sidebar en el layout flex — el sidebar real (abajo) usa
            position:fixed y sale del flujo normal, ver nota ahí. */}
        <div className="hidden h-[100dvh] w-[248px] shrink-0 lg:block" aria-hidden="true" />

        {/* ============= SIDEBAR (desktop) =============
            position: fixed, no sticky. Históricamente `html`/`body` tenían
            `overflow-x: hidden` como parche global (ya eliminado, ver
            DESIGN_SYSTEM.md) que convertía a `html` en scroll container y
            rompía `position: sticky` (se posicionaba contra ese contenedor
            en vez del viewport). Ya no aplica esa restricción, pero se deja
            `fixed` de todas formas: funciona bien y no hay motivo para
            migrar a `sticky` solo porque ahora es viable. */}
        <aside className="fixed left-0 top-0 z-30 hidden h-[100dvh] w-[248px] flex-col border-r border-border bg-surface px-3 py-5 lg:flex">
          <Link href="/admin" className="mb-6 flex items-center gap-2.5 px-2">
            <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-lg bg-surface-2 ring-1 ring-border">
              <Image src="/brand/icon-social-transparent.svg" alt="" width={32} height={32} className="object-contain p-1" />
            </span>
            <span className="font-display text-sm font-bold tracking-tight">FitPlan · Admin</span>
          </Link>

          <nav className="flex flex-1 flex-col gap-1">
            {NAV_ITEMS.map((item) => (
              <NavButton key={item.id} item={item} active={item.id === active} dot={servicesDot} />
            ))}

            <div className="my-2 border-t border-border" role="separator" />

            <button
              type="button"
              onClick={() => router.push("/admin/actividad")}
              className="group flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
            >
              <FaBell className="h-4 w-4 shrink-0" aria-hidden />
              <span className="min-w-0 flex-1 truncate text-left">Notificaciones</span>
              {unreadNotifications > 0 && (
                <span className="shrink-0 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-accent-ink">
                  {unreadNotifications > 9 ? "9+" : unreadNotifications}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setMessagesModalOpen(true)}
              className="group flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
            >
              <FaComment className="h-4 w-4 shrink-0" aria-hidden />
              <span className="min-w-0 flex-1 truncate text-left">Chat admin</span>
              {unreadMessages > 0 && (
                <span className="shrink-0 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-accent-ink">
                  {unreadMessages > 9 ? "9+" : unreadMessages}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => void handleAdminLogout()}
              className="group flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-text-muted transition-colors hover:bg-danger/10 hover:text-danger"
            >
              <FaSignOutAlt className="h-4 w-4 shrink-0" aria-hidden />
              <span className="min-w-0 flex-1 truncate text-left">Cerrar sesión</span>
            </button>
          </nav>

          {/* "Ver sitio": salida del panel (home pública), no una sección de admin más — separada al pie. */}
          <div className="mt-2 border-t border-border pt-2">
            <Link
              href="/"
              className="group flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-text-subtle transition-colors hover:bg-surface-2 hover:text-text-muted"
            >
              <FaExternalLinkAlt className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="min-w-0 flex-1 truncate text-left">Ver sitio</span>
            </Link>
          </div>
        </aside>

        {/* ============= MOBILE NAV: tira horizontal ============= */}
        <div className="fixed inset-x-0 bottom-0 z-40 flex gap-1.5 overflow-x-auto border-t border-border bg-[color-mix(in_oklab,var(--background)_92%,transparent)] px-3 py-2 backdrop-blur-md lg:hidden">
          {NAV_ITEMS.map((item) => {
            const isActive = item.id === active;
            const Icon = item.icon;
            return (
              <Link
                key={item.id}
                href={item.href}
                className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  isActive ? "bg-accent/15 text-accent" : "text-text-muted"
                }`}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden />
                {item.label}
                {item.id === "servicios" && servicesDot && (
                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                      servicesDot === "success" ? "bg-success" : servicesDot === "warning" ? "bg-warning" : "bg-danger"
                    }`}
                    aria-hidden
                  />
                )}
              </Link>
            );
          })}

          <span className="my-1 w-px shrink-0 bg-border" aria-hidden />

          <button
            type="button"
            onClick={() => router.push("/admin/actividad")}
            className="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-text-muted"
          >
            <FaBell className="h-3.5 w-3.5" aria-hidden />
            Notificaciones
            {unreadNotifications > 0 && (
              <span className="shrink-0 rounded-full bg-accent px-1.5 py-0.5 text-[9px] font-semibold text-accent-ink">
                {unreadNotifications > 9 ? "9+" : unreadNotifications}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setMessagesModalOpen(true)}
            className="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-text-muted"
          >
            <FaComment className="h-3.5 w-3.5" aria-hidden />
            Chat admin
            {unreadMessages > 0 && (
              <span className="shrink-0 rounded-full bg-accent px-1.5 py-0.5 text-[9px] font-semibold text-accent-ink">
                {unreadMessages > 9 ? "9+" : unreadMessages}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => void handleAdminLogout()}
            className="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-text-muted"
          >
            <FaSignOutAlt className="h-3.5 w-3.5" aria-hidden />
            Cerrar sesión
          </button>

          <span className="my-1 w-px shrink-0 bg-border" aria-hidden />

          <Link
            href="/"
            className="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-text-subtle"
          >
            <FaExternalLinkAlt className="h-3 w-3" aria-hidden />
            Ver sitio
          </Link>
        </div>

        {/* ============= CONTENIDO ============= */}
        <main className="min-w-0 flex-1 px-4 pb-24 pt-6 sm:px-6 lg:px-8 lg:pb-8 lg:pt-8">{children}</main>
      </div>

      {messagesModalOpen && authUser && (
        <MessagesModal
          isOpen={messagesModalOpen}
          onClose={() => setMessagesModalOpen(false)}
          adminUserId={authUser.uid}
          onMessagesUpdate={() => setMessagesRefreshKey((k) => k + 1)}
        />
      )}
    </div>
  );
}
