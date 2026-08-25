import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, type ComponentType } from "react";
import Navbar from "@/components/Navbar";
import { adminFetch } from "@/lib/adminAuthClient";
import {
  FaChartLine,
  FaUserFriends,
  FaVideo,
  FaDumbbell,
  FaColumns,
  FaServer,
  FaBolt,
} from "react-icons/fa";

/**
 * Shell de navegación persistente del admin — DESIGN_SYSTEM.md §7.3-A.
 * Envuelve las 12 vistas reales de /admin/*. Reemplaza los breadcrumbs
 * sueltos ("← Volver al panel") y la falsa jerarquía de "Configuraciones".
 *
 * No duplica cuenta/idioma/logout/notificaciones — eso se queda en
 * Navbar.tsx tal cual, es correcto que sea compartido con la vista cliente.
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
  const servicesDot = useServicesStatusDot();

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <Navbar />
      <div className="flex w-full">
        {/* ============= SIDEBAR (desktop) ============= */}
        <aside className="sticky top-0 hidden h-[100dvh] w-[248px] shrink-0 flex-col border-r border-border bg-surface px-3 py-5 lg:flex">
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
          </nav>

          <p className="px-2 text-[10px] leading-relaxed text-text-subtle">
            Cuenta, idioma y notificaciones siguen en el menú del avatar (arriba) — no se duplican acá.
          </p>
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
        </div>

        {/* ============= CONTENIDO ============= */}
        <main className="min-w-0 flex-1 px-4 pb-24 pt-6 sm:px-6 lg:px-8 lg:pb-8 lg:pt-8">{children}</main>
      </div>
    </div>
  );
}
