import Head from "next/head";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState, type ReactNode } from "react";
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
  FaBars,
  FaArrowLeft,
  FaChevronRight,
} from "react-icons/fa";

/**
 * PROPUESTA DE REDISEÑO DEL NAVBAR DE CLIENTE — 3 OPCIONES COMPARABLES
 * -----------------------------------------------------------------------------
 * NO es una pantalla real: es la demo visual que acompaña la spec de
 * DESIGN_SYSTEM.md §11 / §11.10. Datos y estado hardcodeados/simulados con los
 * toggles de abajo — nada de Firestore/auth real. Usa solo tokens/clases YA
 * existentes en globals.css (--accent, --surface*, --warning, .badge*,
 * font-display) — no hay ninguna categoría de token nueva que aprobar.
 * Techo de color respetado en las 3 opciones: fondo/neutros + --accent como
 * únicos colores permanentes; --warning/--danger solo aparecen cuando hay
 * algo real que comunicar (sync pendiente, cerrar sesión).
 *
 * Selector "Opción" (arriba de todo) alterna entre 3 enfoques DISTINTOS de
 * navegación, no variaciones cosméticas del mismo patrón — ver razonamiento
 * completo en DESIGN_SYSTEM.md §11.10:
 *
 *  A — Chrome persistente por breakpoint (propuesta original de §11.3):
 *      top bar con links inline en desktop, top bar mínima + tab bar inferior
 *      fija en mobile. Navegación siempre visible, 1 tap a cualquier destino.
 *
 *  B — FAB de navegación, contenido primero: sin barra ni links persistentes
 *      en ningún breakpoint. Un único botón flotante (esquina inferior
 *      derecha, zona más cómoda para el pulgar en agarre a una mano) abre
 *      una hoja/panel con los 4 destinos + cuenta. Maximiza espacio de
 *      pantalla para el contenido a costa de un tap extra.
 *
 *  C — Navegación embebida en el contenido, sin chrome de navegación global:
 *      el top bar nunca lleva links de producto (solo logo + cuenta). Inicio
 *      se vuelve el hub real: tarjetas grandes con preview real (próxima
 *      sesión, último mensaje) en vez de íconos genéricos. Dentro de Mi plan
 *      / Mensajes, un breadcrumb "Inicio" + un chip contextual hacia la otra
 *      pantalla reemplazan la barra global.
 *
 * Las 4 combinaciones de estado (sin sesión / cliente sin plan / cliente con
 * plan / admin con plan propio) y los toggles de mensajes/sync/premium/cookie
 * banner se comparten entre las 3 opciones para que la comparación sea
 * pareja: mismo contenido, mismo estado, solo cambia el chrome de navegación.
 *
 * Pendiente (para `frontend`, no implementado acá): construir la opción que
 * Lucas elija. Ver DESIGN_SYSTEM.md §11.10 para el detalle de cada una y
 * §11.8 para la lista de implementación de la opción A (aplica igual, ajustada
 * al patrón elegido, si se elige B o C en su lugar).
 */

type AuthState = "logged-out" | "client-no-plan" | "client-with-plan" | "admin-as-client";
type NavOption = "A" | "B" | "C";
type Route = "inicio" | "plan" | "mensajes";

const AUTH_STATES: Array<{ id: AuthState; label: string }> = [
  { id: "logged-out", label: "Sin sesión" },
  { id: "client-no-plan", label: "Cliente · sin plan" },
  { id: "client-with-plan", label: "Cliente · con plan" },
  { id: "admin-as-client", label: "Admin · su propio plan" },
];

const NAV_OPTIONS: Array<{ id: NavOption; label: string; sub: string }> = [
  { id: "A", label: "A — Chrome persistente", sub: "Top bar + tab bar fija" },
  { id: "B", label: "B — FAB, contenido primero", sub: "Sin barra fija" },
  { id: "C", label: "C — Nav embebida", sub: "Sin chrome de nav global" },
];

// Alturas de referencia para la demo — en producción NO se hardcodean así:
// se publican como variable CSS medida en runtime (ver nota en §11.9 y en
// el mecanismo del banner de cookies más abajo).
const TABBAR_HEIGHT = 60; // Opción A
const FAB_RESERVE = 84; // Opción B — botón (56px) + margen, no una barra completa

export default function ClientNavbarPreview() {
  const [option, setOption] = useState<NavOption>("A");
  const [authState, setAuthState] = useState<AuthState>("client-with-plan");
  const [route, setRoute] = useState<Route>("inicio");
  const [unreadMessages, setUnreadMessages] = useState(2);
  const [pendingSync, setPendingSync] = useState(1);
  const [premium, setPremium] = useState(true);
  const [accountSheetOpen, setAccountSheetOpen] = useState(false);
  const [navSheetOpen, setNavSheetOpen] = useState(false); // solo opción B (FAB)
  const [locale, setLocale] = useState<"es" | "en">("es");
  const [cookieBannerVisible, setCookieBannerVisible] = useState(true);
  const reduceMotion = useReducedMotion();
  const router = useRouter();

  // Solo para verificación con capturas (Chrome headless) — permite fijar el
  // estado inicial vía query string (?option=B&state=client-with-plan&route=plan&cookies=0)
  // sin tener que simular clicks. No forma parte de la propuesta ni se documenta como feature.
  useEffect(() => {
    if (!router.isReady) return;
    const q = router.query;
    if (typeof q.option === "string" && ["A", "B", "C"].includes(q.option)) setOption(q.option as NavOption);
    if (typeof q.state === "string" && AUTH_STATES.some((s) => s.id === q.state)) setAuthState(q.state as AuthState);
    if (typeof q.route === "string" && ["inicio", "plan", "mensajes"].includes(q.route)) setRoute(q.route as Route);
    if (q.cookies === "0") setCookieBannerVisible(false);
    if (q.unread === "0") setUnreadMessages(0);
    if (q.sync === "0") setPendingSync(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady]);

  const isAuthed = authState !== "logged-out";
  const isAdmin = authState === "admin-as-client";
  const hasPlan = authState === "client-with-plan" || authState === "admin-as-client";

  // En logged-out o sin plan, no hay navegación de producto (tab bar / FAB /
  // hub de Inicio) — mismo criterio en las 3 opciones: no forzar navegación
  // sobre un flujo lineal de una sola tarea (crear-plan) ni sobre alguien que
  // todavía no tiene cuenta.
  const showProductNav = isAuthed && hasPlan;

  const primaryLabel = hasPlan ? "Mi plan" : "Crear plan";
  const primaryIcon = FaDumbbell;

  const badgeWiggle = unreadMessages > 0 && !reduceMotion
    ? { scale: [1, 1.08, 1], rotate: [0, -4, 4, 0] }
    : {};

  const contextualTitle = route === "inicio" ? "Inicio" : route === "plan" ? primaryLabel : "Mensajes";

  // Reserva de espacio para que el banner de cookies nunca tape navegación
  // (ver DESIGN_SYSTEM.md §11.9). Distinta por opción porque el elemento fijo
  // al fondo es distinto: A tiene una barra de ancho completo, B un botón de
  // esquina, C no tiene ningún elemento fijo al fondo.
  const bottomReserveMobile = !showProductNav ? 0 : option === "A" ? TABBAR_HEIGHT : option === "B" ? FAB_RESERVE : 0;

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <Head>
        <title>Propuesta de rediseño — Navbar de cliente (3 opciones) — FitPlan</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <div className="border-b border-border bg-[color-mix(in_oklab,var(--warning)_10%,var(--surface))] px-4 py-2.5 text-center text-xs text-[var(--warning)] sm:text-sm">
        Propuesta de rediseño del navbar de cliente — 3 opciones comparables, ninguna es una pantalla real. Estado
        simulado con los controles de abajo.{" "}
        <Link href="/dashboard" className="underline underline-offset-2 hover:no-underline">
          Ver el dashboard real
        </Link>
      </div>

      {/* ============= CONTROLES DE LA DEMO (no forman parte de la propuesta) ============= */}
      <div className="border-b border-border bg-surface px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-text-subtle">Opción:</span>
            {NAV_OPTIONS.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => {
                  setOption(o.id);
                  setAccountSheetOpen(false);
                  setNavSheetOpen(false);
                }}
                className={`rounded-lg border px-2.5 py-1.5 text-left font-medium transition-colors ${
                  option === o.id
                    ? "border-accent/40 bg-accent/12 text-accent"
                    : "border-border bg-surface-2 text-text-muted hover:text-foreground"
                }`}
              >
                <span className="block">{o.label}</span>
                <span className={`block text-[10px] font-normal ${option === o.id ? "text-accent/80" : "text-text-subtle"}`}>
                  {o.sub}
                </span>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
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
                    setNavSheetOpen(false);
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
      </div>

      {/* ============================================================
          TOP BAR — varía por opción. fixed, no sticky (ver DESIGN_SYSTEM.md
          — el `overflow-x:hidden` global que rompía `position:sticky` ya se
          eliminó, pero se mantiene `fixed` por consistencia con el resto de
          la app).
         ============================================================ */}
      <nav className="fixed inset-x-0 top-0 z-40 w-full border-b border-border bg-[color-mix(in_oklab,var(--background)_88%,transparent)] backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-3 py-2.5 sm:px-6">
          {/* Logo: SIEMPRE va al home real del usuario, no a la landing pública — corrige el bug diagnosticado en las 3 opciones */}
          <Link
            href={isAdmin ? "/admin" : hasPlan ? "/dashboard" : isAuthed ? "/create-plan" : "/"}
            className="flex min-w-0 shrink-0 items-center gap-2 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-lg bg-surface ring-1 ring-border sm:h-9 sm:w-9">
              <Image src="/brand/icon-social-transparent.svg" alt="" width={36} height={36} className="object-contain p-1" />
            </span>
            <span className="hidden truncate text-sm font-semibold tracking-tight sm:inline">FitPlan</span>
          </Link>

          {/* Centro del top bar: distinto por opción */}
          {option === "A" && (
            <>
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
            </>
          )}
          {(option === "B" || option === "C") && isAuthed && (
            <span className="hidden min-w-0 flex-1 truncate text-center text-sm font-semibold text-text-muted md:block">
              {hasPlan ? contextualTitle : "Crear plan"}
            </span>
          )}

          {/* Cluster derecho — idioma en un solo lugar, ya no duplicado logged-in/logged-out, en las 3 opciones */}
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

            {/* Opción A: notificaciones/chat admin + pill de sync viven sueltas en el cluster (como hoy). Opción B/C: se pliegan en el panel de FAB / hoja de cuenta para no repetir chrome. */}
            {option === "A" && isAuthed && isAdmin && (
              <>
                <IconButton icon={FaBell} label="Notificaciones" className="hidden md:inline-flex" />
                <IconButton icon={FaCommentDots} label="Chat admin" className="hidden md:inline-flex" />
              </>
            )}
            {option === "A" && isAuthed && pendingSync > 0 && (
              <div
                className="hidden h-9 items-center gap-1.5 rounded-full border border-warning/35 bg-warning/12 px-3 text-xs font-semibold text-warning md:inline-flex"
                title="Registros pendientes de sincronización en este dispositivo"
              >
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-warning" />
                Pendiente sync · {pendingSync}
              </div>
            )}

            {/* Botón de cuenta / login — en B, cuando hay nav de producto (showProductNav), esto se reemplaza por el FAB: no se duplica el punto de entrada */}
            {isAuthed ? (
              !(option === "B" && showProductNav) && (
                <button
                  type="button"
                  onClick={() => setAccountSheetOpen(true)}
                  className={`flex h-9 w-9 shrink-0 items-center justify-center gap-2 rounded-xl border border-border bg-surface px-1 transition-colors hover:bg-surface-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent md:h-10 md:w-auto md:px-2 ${
                    option === "A" && showProductNav ? "hidden md:flex" : "flex"
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
              )
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
          CONTENIDO DE MUESTRA — compartido entre las 3 opciones (mismo
          contenido, mismo estado) para que la comparación sea pareja. La
          opción C inserta, además, el breadcrumb/hub/chips contextuales que
          reemplazan su chrome de navegación.
         ============================================================ */}
      <main
        className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 md:py-8"
        style={{ paddingBottom: option !== "C" ? `calc(${bottomReserveMobile}px + env(safe-area-inset-bottom))` : undefined }}
      >
        {/* Opción C — breadcrumb de vuelta a Inicio, reemplaza la barra global cuando no se está en Inicio */}
        {option === "C" && showProductNav && route !== "inicio" && (
          <button
            type="button"
            onClick={() => setRoute("inicio")}
            className="mb-4 inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-surface-2 px-3 text-xs font-semibold text-text-muted transition-colors hover:text-foreground"
          >
            <FaArrowLeft className="h-3 w-3" aria-hidden />
            Inicio
          </button>
        )}

        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
          {isAdmin ? "Cuenta admin, vista personal" : hasPlan ? "Tu progreso" : "Empecemos"}
        </p>
        <h1 className="font-display mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
          {route === "inicio" && (hasPlan ? "Hola, Sofía" : "Creemos tu plan")}
          {route === "plan" && "Mi plan de hoy"}
          {route === "mensajes" && "Mensajes"}
        </h1>
        <p className="mt-2 max-w-xl text-sm text-text-muted">
          Contenido de muestra — sirve para verificar que el chrome de navegación de cada opción deja lugar al
          contenido real y no tapa el último elemento al hacer scroll en mobile.
        </p>

        {/* Opción C — hub de Inicio: tarjetas grandes con preview real en vez de links genéricos */}
        {option === "C" && route === "inicio" && showProductNav && (
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <HubCard
              icon={FaDumbbell}
              title="Tu entrenamiento de hoy"
              preview="Tren superior · 6 ejercicios · ~50 min"
              cta="Empezar"
              onClick={() => setRoute("plan")}
            />
            <HubCard
              icon={FaCommentDots}
              title="Mensajes con tu coach"
              preview={unreadMessages > 0 && !isAdmin ? `${unreadMessages} sin leer · "¿Cómo te fue con las sentadillas?"` : "Sin mensajes nuevos"}
              cta="Ver mensajes"
              onClick={() => setRoute("mensajes")}
              badge={!isAdmin && unreadMessages > 0 ? unreadMessages : undefined}
            />
          </div>
        )}

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
            Último elemento de la página — en mobile, con chrome de navegación fijo (opciones A y B), este bloque
            debe quedar completamente visible por encima, nunca tapado.
          </p>
        </div>

        {/* Opción C — chip contextual hacia la otra pantalla del loop diario (plan ↔ mensajes), sin ser una barra global */}
        {option === "C" && showProductNav && route === "plan" && (
          <button
            type="button"
            onClick={() => setRoute("mensajes")}
            className="mt-4 inline-flex h-10 items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-4 text-sm font-medium text-accent"
          >
            <FaCommentDots className="h-3.5 w-3.5" aria-hidden />
            Hablar con tu coach
          </button>
        )}
        {option === "C" && showProductNav && route === "mensajes" && (
          <button
            type="button"
            onClick={() => setRoute("plan")}
            className="mt-4 inline-flex h-10 items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-4 text-sm font-medium text-accent"
          >
            <FaDumbbell className="h-3.5 w-3.5" aria-hidden />
            Ver mi plan de hoy
          </button>
        )}
      </main>

      {/* ============================================================
          OPCIÓN A — TAB BAR INFERIOR, solo mobile (< md), solo con sesión + plan.
         ============================================================ */}
      {option === "A" && showProductNav && (
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

      {/* ============================================================
          OPCIÓN B — FAB de navegación, esquina inferior IZQUIERDA, ambos
          breakpoints (mismo modelo de interacción en mobile y desktop:
          contenido siempre al frente, navegación es un botón, no una barra).
          Reserva su propio espacio en vez de bloquear contenido al fondo.

          NO va en la esquina inferior derecha — hallazgo real al capturar
          esta demo (`ContactButton.tsx`, montado globalmente en `_app.tsx`
          en toda ruta no-admin, `.contact-fab`, 56/64px) ya vive ahí en
          producción, en dashboard/plan/create-plan incluidos. Un FAB de nav
          en esa esquina choca literalmente con un botón que ya existe — ver
          nota completa y las 2 resoluciones posibles en DESIGN_SYSTEM.md
          §11.10-B. Este es exactamente el tipo de cosa que solo aparece
          mirando una captura real, no en abstracto.
         ============================================================ */}
      {option === "B" && showProductNav && (
        <button
          type="button"
          onClick={() => setNavSheetOpen(true)}
          aria-haspopup="menu"
          aria-label="Abrir navegación"
          style={{ bottom: `calc(16px + env(safe-area-inset-bottom))` }}
          className="fixed left-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-ink shadow-2xl transition-transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:left-6"
        >
          <FaBars className="h-5 w-5" aria-hidden />
          {((!isAdmin && unreadMessages > 0) || pendingSync > 0) && (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-warning px-1 text-[10px] font-bold leading-none text-[#1a1300] ring-2 ring-background">
              {!isAdmin && unreadMessages > 0 ? (unreadMessages > 9 ? "9+" : unreadMessages) : "!"}
            </span>
          )}
        </button>
      )}

      {/* ============================================================
          BANNER DE COOKIES (réplica visual, NO el CookieConsentBanner real
          ni su lógica de localStorage) — demuestra la solución de
          DESIGN_SYSTEM.md §11.9 aplicada a las 3 opciones: se apila arriba
          de cualquier elemento fijo al fondo (tab bar en A, FAB en B) en vez
          de taparlo; en C no hace falta apilar nada porque no hay ningún
          elemento de navegación fijo al fondo. En producción esto se resuelve
          con una clase en <body> + variable CSS medida en runtime, no con un
          valor estimado como acá.
         ============================================================ */}
      {cookieBannerVisible && (
        <div
          className="fixed inset-x-0 z-[11000] p-3 transition-[bottom] duration-200 sm:p-4"
          style={{ bottom: showProductNav ? `calc(${bottomReserveMobile}px + env(safe-area-inset-bottom))` : 0 }}
        >
          <style jsx>{`
            @media (min-width: 768px) {
              div {
                bottom: 0 !important;
              }
            }
          `}</style>
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
          HOJA DE CUENTA — opciones A y C (solo cuenta: idioma, sync,
          notificaciones/chat admin, ver sitio, logout). En mobile ancla
          natural es la tab bar (A) o el propio avatar (C); en desktop podría
          abrir el mismo contenido en un panel angosto en vez de hoja
          inferior — no se duplica el patrón acá, la spec lo describe en
          DESIGN_SYSTEM.md §11.4.
         ============================================================ */}
      {accountSheetOpen && (option === "A" || option === "C") && (
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

      {/* ============================================================
          PANEL DEL FAB — opción B únicamente. Combina navegación (Inicio /
          Mi plan / Mensajes) + cuenta en un solo panel, porque el FAB es el
          único punto de entrada a ambas cosas. Mismo componente en mobile
          (hoja inferior) y desktop (panel de esquina, ancla el propio FAB).
         ============================================================ */}
      {navSheetOpen && option === "B" && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={() => setNavSheetOpen(false)}>
          <motion.div
            initial={reduceMotion ? undefined : { y: 24 }}
            animate={{ y: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            className="fixed inset-x-0 bottom-0 w-full rounded-t-2xl border border-border bg-surface p-4 pb-[calc(env(safe-area-inset-bottom)+16px)] sm:inset-x-auto sm:bottom-24 sm:left-6 sm:w-80 sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold">Navegación</p>
              <button type="button" onClick={() => setNavSheetOpen(false)} aria-label="Cerrar" className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted hover:bg-surface-2">
                <FaTimes className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-1">
              <SheetRow icon={FaHome} label="Inicio" active={route === "inicio"} onClick={() => { setRoute("inicio"); setNavSheetOpen(false); }} />
              <SheetRow
                icon={FaDumbbell}
                label={primaryLabel}
                active={route === "plan"}
                onClick={() => { setRoute("plan"); setNavSheetOpen(false); }}
                trailing={!isAdmin && pendingSync > 0 ? <span className="h-2 w-2 rounded-full bg-warning" /> : undefined}
              />
              <SheetRow
                icon={FaCommentDots}
                label="Mensajes"
                active={route === "mensajes"}
                onClick={() => { setRoute("mensajes"); setNavSheetOpen(false); }}
                trailing={!isAdmin && unreadMessages > 0 ? <span className="badge badge-info">{unreadMessages}</span> : undefined}
              />
              <div className="my-2 h-px bg-border" />
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
  active,
}: {
  icon: typeof FaHome;
  label: string;
  trailing?: ReactNode;
  tone?: "warning" | "danger";
  muted?: boolean;
  href?: string;
  onClick?: () => void;
  active?: boolean;
}) {
  const toneClass = tone === "warning" ? "text-warning" : tone === "danger" ? "text-danger" : muted ? "text-text-subtle" : active ? "text-accent" : "text-foreground";
  const content = (
    <div className={`flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-sm font-medium transition-colors hover:bg-surface-2 ${active ? "bg-accent/10" : ""}`}>
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
    <button type="button" onClick={onClick} className="block w-full" aria-current={active ? "page" : undefined}>
      {content}
    </button>
  );
}

/** Opción C — tarjeta grande del hub de Inicio, con preview real en vez de solo un ícono/label. */
function HubCard({
  icon: Icon,
  title,
  preview,
  cta,
  onClick,
  badge,
}: {
  icon: typeof FaHome;
  title: string;
  preview: string;
  cta: string;
  onClick: () => void;
  badge?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="card-surface group flex min-h-[96px] w-full items-center gap-3 p-4 text-left transition-colors hover:bg-surface-2"
    >
      <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent/12 text-accent">
        <Icon className="h-5 w-5" aria-hidden />
        {badge !== undefined && (
          <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold leading-none text-accent-ink ring-2 ring-surface">
            {badge > 9 ? "9+" : badge}
          </span>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-foreground">{title}</span>
        <span className="mt-0.5 block truncate text-xs text-text-muted">{preview}</span>
        <span className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-accent">
          {cta}
          <FaChevronRight className="h-2.5 w-2.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </span>
      </span>
    </button>
  );
}
