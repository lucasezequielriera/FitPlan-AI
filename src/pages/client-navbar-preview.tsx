import Head from "next/head";
import Image from "next/image";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { motion, useReducedMotion, type TargetAndTransition } from "framer-motion";
import {
  FaHome,
  FaDumbbell,
  FaCommentDots,
  FaUserCircle,
  FaBell,
  FaGlobe,
  FaSignOutAlt,
  FaSyncAlt,
  FaExternalLinkAlt,
  FaTimes,
} from "react-icons/fa";

/**
 * PROPUESTA DE REDISEÑO DEL NAVBAR DE CLIENTE — fase de definición de `diseño`
 * -----------------------------------------------------------------------------
 * NO es una pantalla real: es la demo visual que acompaña la spec de
 * DESIGN_SYSTEM.md §11. Datos y estado hardcodeados/simulados con los toggles
 * de abajo — nada de Firestore/auth real. Usa solo tokens/clases YA
 * existentes en globals.css (--accent, --surface*, --warning, .badge*,
 * font-display) — no hay ninguna categoría de token nueva que aprobar.
 *
 * Qué muestra:
 *  - Desktop (`md:` y arriba): top bar única con links de navegación inline
 *    (Inicio / Mi plan / Mensajes), igual que hoy pero sin la duplicación de
 *    idioma ni el shortcut redundante "ir a mi dashboard" del menú de avatar.
 *  - Mobile (`< md`): top bar mínima (solo logo, + idioma/login si no hay
 *    sesión) + tab bar inferior fija (Inicio / Mi plan / Mensajes / Cuenta) —
 *    es el cambio estructural central de la propuesta, ver razonamiento en
 *    DESIGN_SYSTEM.md §11.2.
 *  - 4 estados simulables con el selector de arriba: logged-out, cliente sin
 *    plan (flujo create-plan), cliente con plan, admin navegando su propio
 *    dashboard/plan personal (caso real: Lucas entrena con su propia cuenta).
 *
 * Pendiente (para `frontend`, no implementado acá):
 *  - Construir el `<ClientNavbar>` real (o dividir el `Navbar.tsx` actual)
 *    siguiendo esta spec, y envolver dashboard.tsx/plan.tsx/create-plan.tsx.
 *  - Ver DESIGN_SYSTEM.md §11.8 para la lista completa (incluye el punto 6,
 *    el mecanismo de coexistencia con el banner de cookies de acá abajo).
 *
 * El toggle "Banner de cookies visible" simula el hallazgo y la solución de
 * DESIGN_SYSTEM.md §11.9: CookieConsentBanner y la tab bar son ambos fixed
 * bottom-0 y compiten por el mismo espacio en mobile. Acá se replica el
 * banner (markup simplificado, no el componente real ni su lógica de
 * localStorage) para mostrar que, con la tab bar visible, el banner se
 * apila arriba de ella en vez de taparla — ver CookieBannerDemo más abajo.
 */

type AuthState = "logged-out" | "client-no-plan" | "client-with-plan" | "admin-as-client";

const AUTH_STATES: Array<{ id: AuthState; label: string }> = [
  { id: "logged-out", label: "Sin sesión" },
  { id: "client-no-plan", label: "Cliente · sin plan" },
  { id: "client-with-plan", label: "Cliente · con plan" },
  { id: "admin-as-client", label: "Admin · su propio plan" },
];

type Route = "inicio" | "plan" | "mensajes" | "cuenta" | "crear-plan";

export default function ClientNavbarPreview() {
  const [authState, setAuthState] = useState<AuthState>("client-with-plan");
  const [route, setRoute] = useState<Route>("inicio");
  const [unreadMessages, setUnreadMessages] = useState(2);
  const [pendingSync, setPendingSync] = useState(1);
  const [premium, setPremium] = useState(true);
  const [accountSheetOpen, setAccountSheetOpen] = useState(false);
  const [locale, setLocale] = useState<"es" | "en">("es");
  const [cookieBannerVisible, setCookieBannerVisible] = useState(true);
  const reduceMotion = useReducedMotion();

  const isAuthed = authState !== "logged-out";
  const isAdmin = authState === "admin-as-client";
  const hasPlan = authState === "client-with-plan" || authState === "admin-as-client";

  // En logged-out o sin plan, no hay tab bar — mismo criterio que hoy:
  // no forzar navegación de producto sobre un flujo lineal de una sola tarea
  // (crear-plan) ni sobre alguien que todavía no tiene cuenta.
  const showTabBar = isAuthed && hasPlan;

  const primaryLabel = hasPlan ? "Mi plan" : "Crear plan";
  const primaryIcon = FaDumbbell;

  const badgeWiggle = unreadMessages > 0 && !reduceMotion
    ? { scale: [1, 1.08, 1], rotate: [0, -4, 4, 0] }
    : {};

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <Head>
        <title>Propuesta de rediseño — Navbar de cliente — FitPlan</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <div className="border-b border-border bg-[color-mix(in_oklab,var(--warning)_10%,var(--surface))] px-4 py-2.5 text-center text-xs text-[var(--warning)] sm:text-sm">
        Propuesta de rediseño del navbar de cliente — no es una pantalla real, estado simulado con los controles de abajo.{" "}
        <Link href="/dashboard" className="underline underline-offset-2 hover:no-underline">
          Ver el dashboard real
        </Link>
      </div>

      {/* ============= CONTROLES DE LA DEMO (no forman parte de la propuesta) ============= */}
      <div className="border-b border-border bg-surface px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-text-subtle">Estado:</span>
            {AUTH_STATES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setAuthState(s.id);
                  setRoute("inicio");
                  setAccountSheetOpen(false);
                }}
                className={`rounded-lg border px-2.5 py-1 font-medium transition-colors ${
                  authState === s.id
                    ? "border-accent/40 bg-accent/12 text-accent"
                    : "border-border bg-surface-2 text-text-muted hover:text-foreground"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-1.5 text-text-muted">
            <input type="checkbox" checked={unreadMessages > 0} onChange={(e) => setUnreadMessages(e.target.checked ? 2 : 0)} />
            Mensajes sin leer
          </label>
          <label className="flex items-center gap-1.5 text-text-muted">
            <input type="checkbox" checked={pendingSync > 0} onChange={(e) => setPendingSync(e.target.checked ? 1 : 0)} />
            Pendiente sync
          </label>
          <label className="flex items-center gap-1.5 text-text-muted">
            <input type="checkbox" checked={premium} onChange={(e) => setPremium(e.target.checked)} />
            Premium
          </label>
          <label className="flex items-center gap-1.5 text-text-muted">
            <input type="checkbox" checked={cookieBannerVisible} onChange={(e) => setCookieBannerVisible(e.target.checked)} />
            Banner de cookies visible
          </label>
        </div>
      </div>

      {/* ============================================================
          TOP BAR — desktop: nav completo. Mobile: mínima (solo logo,
          o logo + idioma/login si no hay sesión).
          fixed, no sticky (ver DESIGN_SYSTEM.md — el `overflow-x:hidden`
          global que rompía `position:sticky` ya se eliminó, pero se
          mantiene `fixed` por consistencia con el resto de la app).
         ============================================================ */}
      <nav className="fixed inset-x-0 top-0 z-40 w-full border-b border-border bg-[color-mix(in_oklab,var(--background)_88%,transparent)] backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-3 py-2.5 sm:px-6">
          {/* Logo: SIEMPRE va al home real del usuario, no a la landing pública */}
          <Link
            href={isAdmin ? "/admin" : hasPlan ? "/dashboard" : isAuthed ? "/create-plan" : "/"}
            className="flex min-w-0 shrink-0 items-center gap-2 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-lg bg-surface ring-1 ring-border sm:h-9 sm:w-9">
              <Image src="/brand/icon-social-transparent.svg" alt="" width={36} height={36} className="object-contain p-1" />
            </span>
            <span className="hidden truncate text-sm font-semibold tracking-tight sm:inline">FitPlan</span>
          </Link>

          {/* Nav inline — SOLO desktop, mismo tratamiento de estado activo que AdminShell (bg-accent/12 text-accent) */}
          {isAuthed && hasPlan && (
            <div className="hidden items-center gap-1 md:flex">
              <TopNavLink label="Inicio" icon={FaHome} active={route === "inicio"} onClick={() => setRoute("inicio")} />
              <TopNavLink label={primaryLabel} icon={primaryIcon} active={route === "plan"} onClick={() => setRoute("plan")} />
              <TopNavLink
                label="Mensajes"
                icon={FaCommentDots}
                active={route === "mensajes"}
                onClick={() => setRoute("mensajes")}
                badge={!isAdmin && unreadMessages > 0 ? unreadMessages : undefined}
              />
            </div>
          )}
          {isAuthed && !hasPlan && (
            <div className="hidden items-center gap-1 md:flex">
              <TopNavLink label="Crear plan" icon={FaDumbbell} active onClick={() => {}} />
            </div>
          )}

          {/* Cluster derecho — desktop: idioma en un solo lugar (ya no duplicado logged-in/logged-out) */}
          <div className="flex shrink-0 items-center gap-2">
            <div
              className={`items-center rounded-lg bg-surface-2 p-0.5 text-xs ring-1 ring-border md:flex ${!isAuthed ? "flex" : "hidden"}`}
              aria-label="Idioma"
            >
              <button
                type="button"
                onClick={() => setLocale("es")}
                className={`rounded-md px-2 py-1 font-medium transition-colors ${locale === "es" ? "bg-surface-3 text-foreground" : "text-text-muted hover:text-foreground"}`}
              >
                ES
              </button>
              <button
                type="button"
                onClick={() => setLocale("en")}
                className={`rounded-md px-2 py-1 font-medium transition-colors ${locale === "en" ? "bg-surface-3 text-foreground" : "text-text-muted hover:text-foreground"}`}
              >
                EN
              </button>
            </div>

            {isAuthed && isAdmin && (
              <>
                <IconButton icon={FaBell} label="Notificaciones" className="hidden md:inline-flex" />
                <IconButton icon={FaCommentDots} label="Chat admin" className="hidden md:inline-flex" />
              </>
            )}

            {isAuthed && pendingSync > 0 && (
              <div
                className="hidden h-9 items-center gap-1.5 rounded-full border border-warning/35 bg-warning/12 px-3 text-xs font-semibold text-warning md:inline-flex"
                title="Registros pendientes de sincronización en este dispositivo"
              >
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-warning" />
                Pendiente sync · {pendingSync}
              </div>
            )}

            {isAuthed ? (
              <button
                type="button"
                onClick={() => setAccountSheetOpen(true)}
                className={`h-9 w-9 shrink-0 items-center justify-center gap-2 rounded-xl border border-border bg-surface px-1 transition-colors hover:bg-surface-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent md:flex md:h-10 md:w-auto md:px-2 ${
                  showTabBar ? "hidden md:flex" : "flex"
                }`}
                aria-haspopup="menu"
              >
                <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/20 text-xs font-semibold ring-1 ring-accent/40">
                  {isAdmin ? "A" : "S"}
                  {premium && !isAdmin && (
                    <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-warning ring-2 ring-background" title="Premium" />
                  )}
                </span>
                <span className="hidden truncate text-xs font-medium md:inline">{isAdmin ? "Admin" : "Sofía"}</span>
              </button>
            ) : (
              <button type="button" className="btn btn-secondary h-9 px-3 text-xs sm:h-10 sm:text-sm">
                Iniciar sesión
              </button>
            )}
          </div>
        </div>
      </nav>
      {/* Spacer del top bar fijo */}
      <div aria-hidden className="h-[52px] sm:h-[60px]" />

      {/* ============================================================
          CONTENIDO DE MUESTRA (para ver el padding inferior real
          que necesita cada pantalla cuando hay tab bar)
         ============================================================ */}
      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 md:py-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
          {isAdmin ? "Cuenta admin, vista personal" : hasPlan ? "Tu progreso" : "Empecemos"}
        </p>
        <h1 className="font-display mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
          {route === "inicio" && (hasPlan ? "Hola, Sofía" : "Creemos tu plan")}
          {route === "plan" && "Mi plan de hoy"}
          {route === "mensajes" && "Mensajes"}
        </h1>
        <p className="mt-2 max-w-xl text-sm text-text-muted">
          Contenido de muestra — sirve solo para verificar que el padding inferior de la página deja lugar a la tab bar
          fija en mobile y no tapa el último elemento al hacer scroll.
        </p>
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="card-surface p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-text-muted">Racha</p>
            <p className="font-display mt-1 text-2xl font-bold">12 días</p>
          </div>
          <div className="card-surface p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-text-muted">Peso</p>
            <p className="font-display mt-1 text-2xl font-bold">78,4 kg</p>
          </div>
          <div className="card-surface p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-text-muted">Adherencia</p>
            <p className="font-display mt-1 text-2xl font-bold text-success">91%</p>
          </div>
        </div>
        <div className="card-surface-2 mt-6 p-4">
          <p className="text-sm text-text-muted">
            Último elemento de la página — en mobile, con la tab bar fija, este bloque debe quedar completamente
            visible por encima de la barra, no tapado por ella.
          </p>
        </div>
      </main>

      {/* ============================================================
          TAB BAR INFERIOR — SOLO mobile (< md), solo con sesión + plan.
          fixed (no sticky), respeta safe-area-inset-bottom.
         ============================================================ */}
      {showTabBar && (
        <nav
          className="fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-around border-t border-border bg-[color-mix(in_oklab,var(--background)_88%,transparent)] px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
          aria-label="Navegación principal"
        >
          <TabBarItem label="Inicio" icon={FaHome} active={route === "inicio"} onClick={() => setRoute("inicio")} />
          <TabBarItem
            label={primaryLabel}
            icon={primaryIcon}
            active={route === "plan"}
            onClick={() => setRoute("plan")}
            dotWarning={!isAdmin && pendingSync > 0}
          />
          <TabBarItem
            label="Mensajes"
            icon={FaCommentDots}
            active={route === "mensajes"}
            onClick={() => setRoute("mensajes")}
            count={!isAdmin && unreadMessages > 0 ? unreadMessages : undefined}
            wiggle={badgeWiggle}
          />
          <TabBarItem label="Cuenta" icon={FaUserCircle} active={accountSheetOpen} onClick={() => setAccountSheetOpen(true)} />
        </nav>
      )}
      {/* Spacer de la tab bar fija — evita que el último bloque de contenido quede tapado en mobile */}
      {showTabBar && <div aria-hidden className="h-[calc(60px+env(safe-area-inset-bottom))] md:hidden" />}

      {/* ============================================================
          BANNER DE COOKIES (réplica visual, NO el CookieConsentBanner
          real ni su lógica de localStorage) — demuestra la solución de
          DESIGN_SYSTEM.md §11.9: se apila arriba de la tab bar en vez
          de taparla. En el componente real esto se resuelve con la
          clase `has-bottom-nav` en <body> + una regla en globals.css;
          acá, al ser una sola página autocontenida, se resuelve leyendo
          directamente `showTabBar`.
         ============================================================ */}
      {cookieBannerVisible && (
        <div
          className={`fixed inset-x-0 z-[11000] p-3 sm:p-4 transition-[bottom] duration-200 ${
            showTabBar ? "bottom-[calc(60px+env(safe-area-inset-bottom))] md:bottom-0" : "bottom-0"
          }`}
        >
          <div className="mx-auto max-w-4xl rounded-2xl border border-border bg-[color-mix(in_oklab,var(--background)_95%,#0f172a)] p-4 shadow-2xl backdrop-blur-md sm:p-5">
            <p className="text-sm font-bold text-foreground">Privacidad y cookies</p>
            <p className="mt-2 text-xs text-text-muted sm:text-sm">
              Usamos cookies de analítica y anuncios para medir campañas y mejorar conversiones. Puedes aceptar todo o
              dejar solo las esenciales.
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setCookieBannerVisible(false)} className="btn btn-secondary text-sm">
                Solo esenciales
              </button>
              <button type="button" onClick={() => setCookieBannerVisible(false)} className="btn btn-primary text-sm font-bold">
                Aceptar todo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          HOJA DE CUENTA — reemplaza el dropdown flotante en mobile
          (ancla natural: la propia tab bar). En desktop, el botón de
          avatar de arriba podría abrir el mismo contenido en un panel
          flotante angosto — no se duplica el patrón acá, la spec lo
          describe en DESIGN_SYSTEM.md §11.4.
         ============================================================ */}
      {accountSheetOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm md:hidden" onClick={() => setAccountSheetOpen(false)}>
          <motion.div
            initial={reduceMotion ? undefined : { y: 24 }}
            animate={{ y: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            className="w-full max-w-md rounded-t-2xl border border-border bg-surface p-4 pb-[calc(env(safe-area-inset-bottom)+16px)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold">{isAdmin ? "Admin" : "Sofía Martínez"}</p>
              <button type="button" onClick={() => setAccountSheetOpen(false)} aria-label="Cerrar" className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted hover:bg-surface-2">
                <FaTimes className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-1">
              {isAdmin && (
                <SheetRow icon={FaBell} label="Notificaciones" trailing={<span className="badge badge-info">3</span>} />
              )}
              {isAdmin && <SheetRow icon={FaCommentDots} label="Chat admin" />}
              {!isAdmin && pendingSync > 0 && (
                <SheetRow icon={FaSyncAlt} label={`Pendiente sync · ${pendingSync}`} tone="warning" />
              )}
              <SheetRow icon={FaGlobe} label={`Idioma: ${locale === "es" ? "Español" : "English"}`} onClick={() => setLocale(locale === "es" ? "en" : "es")} />
              <SheetRow icon={FaExternalLinkAlt} label="Ver sitio" href="/" muted />
              <div className="my-2 h-px bg-border" />
              <SheetRow icon={FaSignOutAlt} label="Cerrar sesión" tone="danger" />
            </div>
          </motion.div>
        </div>
      )}
    </div>
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

function IconButton({ icon: Icon, label, className = "" }: { icon: typeof FaHome; label: string; className?: string }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-surface text-foreground/90 transition-colors hover:bg-surface-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent md:h-10 md:w-10 ${className}`}
    >
      <Icon className="h-4 w-4" aria-hidden />
    </button>
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
  onClick,
}: {
  icon: typeof FaHome;
  label: string;
  trailing?: ReactNode;
  tone?: "warning" | "danger";
  muted?: boolean;
  href?: string;
  onClick?: () => void;
}) {
  const toneClass = tone === "warning" ? "text-warning" : tone === "danger" ? "text-danger" : muted ? "text-text-subtle" : "text-foreground";
  const content = (
    <div className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-sm font-medium transition-colors hover:bg-surface-2">
      <Icon className={`h-4 w-4 shrink-0 ${toneClass}`} aria-hidden />
      <span className={`min-w-0 flex-1 truncate text-left ${toneClass}`}>{label}</span>
      {trailing}
    </div>
  );
  if (href) {
    return (
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
