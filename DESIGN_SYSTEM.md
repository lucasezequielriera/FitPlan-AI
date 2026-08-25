# FitPlan AI — Sistema de Diseño

> Fuente de verdad visual del producto. Todo color, superficie, botón o badge nuevo debería salir de acá — no de un valor de Tailwind elegido a mano en el momento.
> Implementado en [`src/styles/globals.css`](./src/styles/globals.css).

## Rediseño "FitPlan Volt" (aprobado)

Identidad vigente desde la propuesta demostrada en `/design-preview` (paleta lima/negro + tipografía Inter/Space Grotesk), aprobada por Lucas. Los valores de esta sección ya están promovidos al árbol `:root` — no quedan como propuesta aislada. Los tokens **semánticos** (éxito/advertencia/error/info) y los de **fase de plan** se mantuvieron sin cambios a propósito (no son una decisión de marca, sino de comunicación de estado, y ya funcionaban bien).

## Por qué existía un problema

Antes de esto, la app tenía una paleta *parcial* (`--landing-*`, adoptada solo en landing/formulario/algunas partes del dashboard) conviviendo con **más de 1.800 usos sueltos de clases Tailwind de color** (`bg-emerald-500`, `bg-green-500`, `bg-cyan-500`, `bg-blue-500`...) repartidos sin criterio: verde y esmeralda usados indistintamente para "éxito", cian y azul indistintamente para "info/primario", y los colores de fase de plan (bulk/cut/lean bulk/mantenimiento) redefinidos ad hoc en cada componente en vez de salir de un solo lugar. Resultado: la app se ve distinta según qué pantalla estés mirando, y cambiar "el verde de éxito" en toda la app significaba buscar y tocar decenas de archivos.

## Principio

**Un solo árbol de tokens en `:root` → todo lo demás (Tailwind, clases custom, componentes) lee de ahí.** Cambiar un color de marca es cambiar una línea en `globals.css`, no una búsqueda global.

---

## 1. Tokens

### Base

| Token | Valor | Uso |
|---|---|---|
| `--background` | `#08090c` | Fondo de toda la app (dark permanente, sin light mode). Negro neutro, no navy — máximo contraste con el acento. |
| `--foreground` | `#f5f7f2` | Texto principal (blanco cálido) |

### Marca / acento

| Token | Valor | Uso |
|---|---|---|
| `--brand-start/mid/end` | `#cbff3d` → `#ff5f45` → `#ff3d81` (lima → coral → magenta) | Gradiente ambiental de fondo (hero, body background), barras de progreso |
| `--accent` | `#cbff3d` ("volt lime") | Color de interacción principal: CTAs, links activos, foco |
| `--accent-strong` | `#a6e600` | Estado hover/active del acento |
| `--accent-ink` | `#0a0f05` | Color de texto sobre superficies de acento (contraste sobre el lima, no usar blanco) |

### Superficies (jerarquía de profundidad)

| Token | Uso |
|---|---|
| `--surface` | Nivel 1: tarjetas sobre el fondo |
| `--surface-2` | Nivel 2: tarjetas dentro de tarjetas, inputs |
| `--surface-3` | Nivel 3: hover/active de superficie 2 |
| `--border` / `--border-strong` | Bordes sutiles / bordes con más contraste |

### Texto

| Token | Uso |
|---|---|
| `--foreground` | Texto principal |
| `--text-muted` | Texto secundario (labels, descripciones) |
| `--text-subtle` | Texto terciario (timestamps, ayudas) |

### Semántico — **usar siempre estos, nunca `red-500`/`green-500`/etc. crudos**

| Token | Significado |
|---|---|
| `--success` / `--success-strong` / `--success-soft` | Confirmaciones, cifras positivas, pagos exitosos |
| `--warning` / `--warning-strong` / `--warning-soft` | Alertas no críticas, planes por vencer |
| `--danger` / `--danger-strong` / `--danger-soft` | Errores, cancelaciones, eliminar |
| `--info` / `--info-strong` / `--info-soft` | Información neutra, tips |

### Fases del plan — coherente con `MONTH_CHANGES_MODAL.md`

| Token | Fase |
|---|---|
| `--phase-bulk` (ámbar) | Volumen |
| `--phase-cut` (cian) | Definición |
| `--phase-lean-bulk` (esmeralda) | Recomposición |
| `--phase-maintenance` (violeta) | Mantenimiento |

### Fases de periodización HYROX — ver §8.2-A (aprobado por Lucas)

Tokens propios, distintos de los de arriba a propósito (misma naturaleza — "comunicación de estado, no decisión de marca" — pero dominio distinto, sin relación entre una fase de plan y una fase de bloque HYROX). Progresión frío→cálido según cercanía a la carrera.

| Token | Fase | Hex |
|---|---|---|
| `--phase-hyrox-base` (azul) | Base aeróbica, semanas 1-4 | `#3b82f6` |
| `--phase-hyrox-construccion` (teal) | Construcción, semanas 5-9 | `#14b8a6` |
| `--phase-hyrox-especifico` (naranja) | Específico de carrera, semanas 10-13 | `#f97316` |
| `--phase-hyrox-taper` (rosa/coral fuerte) | Afinado y competición, semanas 14-15 | `#f43f5e` |

### Radios y sombras

`--radius-sm/md/lg/xl`, `--shadow-sm/md/lg` — usar en vez de valores arbitrarios (`rounded-[14px]`, `shadow-[0_2px_8px_...]`). Formas más contundentes que antes del rediseño (`--radius-lg` 1.25rem, `--radius-xl` 1.75rem) — lenguaje visual más "app", tap targets más generosos.

### Tipografía

Cargada en `src/pages/_app.tsx` vía `next/font/google`, no en `globals.css`.

| Uso | Fuente | Cómo aplicarla |
|---|---|---|
| UI / cuerpo (default de toda la app) | **Inter** | No requiere nada — es la fuente por defecto del `<body>` |
| Headings y cifras grandes (kcal, kg, %, reps) | **Space Grotesk** | `className="font-display"` — numerales tabulares, pensada para que las cifras no salten al actualizarse |

Pendiente (deuda de rollout, no bloqueante): `font-display` está disponible como utilidad de Tailwind pero todavía no se aplicó a los headings de las pantallas reales (`dashboard.tsx`, `plan.tsx`, etc.) — hoy todos siguen en Inter por defecto. Adoptarlo es trabajo de `frontend`, pantalla por pantalla.

---

## 2. Clases reutilizables

En vez de reconstruir combinaciones de Tailwind cada vez, usar estas clases (definidas en `globals.css`, funcionan en cualquier componente sin import):

**Botones**: `.btn` + variante — `.btn-primary`, `.btn-secondary`, `.btn-success`, `.btn-danger`, `.btn-ghost`.
```html
<button class="btn btn-primary">Generar plan</button>
<button class="btn btn-danger">Eliminar</button>
```

**Badges / pills de estado**: `.badge` + variante — `.badge-success`, `.badge-warning`, `.badge-danger`, `.badge-info`, `.badge-neutral`.
```html
<span class="badge badge-success">Premium activo</span>
<span class="badge badge-warning">Vence en 3 días</span>
```

**Badges de fase**: `.badge-phase-bulk`, `.badge-phase-cut`, `.badge-phase-lean-bulk`, `.badge-phase-maintenance`.

**Badges de fase HYROX**: `.badge-phase-hyrox-base`, `.badge-phase-hyrox-construccion`, `.badge-phase-hyrox-especifico`, `.badge-phase-hyrox-taper` — ver §8.2-A.

**Tarjetas**: `.card-surface` (nivel 1), `.card-surface-2` (nivel 2).

**Texto de estado sin fondo**: `.text-success`, `.text-warning`, `.text-danger`, `.text-info`, `.text-muted`, `.text-subtle`.

---

## 3. Cómo se integra con Tailwind

Tailwind v4 usa CSS-first config (no hay `tailwind.config.*`). El bloque `@theme inline` en `globals.css` expone los tokens como utilidades nativas de Tailwind, por ejemplo `--color-success` genera `bg-success`, `text-success`, `border-success`, etc. automáticamente — no hace falta memorizar `var(--success)` en cada lugar, se puede escribir `className="bg-success/10 text-success border-success/30"` como si fuera cualquier color de la paleta default de Tailwind.

## 4. Retrocompatibilidad

Las variables `--landing-*` que ya estaban en uso (206 ocurrencias en landing/formulario/dashboard) **se mantienen como alias** de los tokens canónicos (`--landing-accent: var(--accent)`, etc.) — no rompen nada existente, pero **no usar `--landing-*` en código nuevo**: son solo para no forzar una migración de golpe. El código nuevo usa los tokens de la sección 1 o las clases de la sección 2.

## 5. Qué falta migrar (deuda visual conocida, ver `AUDIT.md`)

Esta sesión aplicó los tokens/clases a fondo en: landing (`HomeLanding.tsx`, ya estaba migrado), `dashboard.tsx`, `DashboardPlanCard.tsx`, `create-plan.tsx`, `plan.tsx` y sus modales (`GymCalendarModal`, `ExerciseSetTracker`, `FoodTrackingModal`, `WeeklyStatsModal`, `PlanContinuityModal`, `TrainingCalendar`, `IMCInfoModal`, `PremiumPlanModal`, `MonthChangesModal`, `IntakeWorkoutDayLog`, `IntakeClientPlanPublicView`, `mi-plan/[clientId].tsx`), y todo el panel admin (`AdminApp.tsx`, `Navbar.tsx`, `AdminExerciseCatalogPanel.tsx`, `AdminExerciseCatalogModal.tsx`, `admin/actividad.tsx`) — reemplazando los patrones de color con significado real (éxito/error/advertencia/info, colores de fase) por los tokens semánticos.

**Rollout "FitPlan Volt" (pasada de `frontend`):** sobre la base de arriba, se migró el resto de identidad de marca hardcodeada (gradientes viejos ámbar/naranja/rosa, azul/cian, púrpura/rosa, y fondos `slate-900`/`gray-900` crudos) a `--brand-start/mid/end` y `--background`/`--surface`, y se aplicó `font-display` (Space Grotesk) a headings y cifras grandes (kcal, kg, %, sets) en: `dashboard.tsx`, `DashboardPlanCard.tsx`, `plan.tsx`, `create-plan.tsx`, `mi-plan/[clientId].tsx`, `formulario-de-inicio.tsx` (+ `en/formulario-de-inicio.tsx`, que solo re-exporta el mismo componente), `payment/{success,pending,failure}.tsx`, `CookieConsentBanner.tsx`, `LoginModal.tsx`, `MonthChangesModal.tsx`, `Navbar.tsx`, `TrainingCalendar.tsx` e `IntakeWorkoutDayLog.tsx`. Verificado visualmente con capturas de Chrome headless (landing, formulario, payment success/failure/pending) — contraste correcto: texto oscuro sobre `--accent` lima en todos los CTA `.btn-primary`/gradiente de marca.

**`src/components/admin/AdminApp.tsx` — resuelto.** `frontend` implementó el mapeo exacto de la sección 6 sobre las 156 clases crudas detectadas: 155 migradas a los tokens/clases ya existentes (`--success/--warning/--danger/--info`, `bg-surface`/`bg-surface-2`, `border-border`/`border-border-strong`, `text-foreground`/`text-muted`, `bg-accent`/`text-accent-ink` para el filtro activo, `--brand-start/mid/end` para el gradiente de héroe y el de la barra del gráfico de peso). Queda **1 clase sin tocar, fuera de alcance real**: `text-gray-600` en el visor de HTML de emails (dentro de una caja `bg-white` — texto oscuro sobre superficie clara, no sobre el chrome oscuro de la app; los tokens del sistema son todos para el tema oscuro permanente, no aplican ahí). Verificado visualmente con Chrome headless sobre una réplica estática de los patrones migrados (fila de acciones por cliente, badges de rol/estado, filtro Hombre/Mujer, tarjetas de resumen de plan generado, gradiente de héroe) — sin login real de administrador (credenciales de producción, fuera de alcance de esta verificación). `npx tsc --noEmit` sin errores; `eslint` sobre el archivo solo reporta 2 errores `prefer-const` y varios `no-unused-vars` preexistentes, no relacionados con este cambio.

Quedan **sin migrar, fuera del alcance de esta pasada**, con recuento aproximado de clases Tailwind de color crudas:

| Archivo | Aprox. | Nota |
|---|---:|---|
| `src/components/IntakeClientPlanPublicView.tsx` | 58 | Ya evaluado: paleta categórica intencional (ver nota debajo), no requiere migración |
| `src/pages/transformacion-fitplan.tsx` / `src/pages/en/transformacion-fitplan.tsx` | 55 / 49 | Landing pages alternativas (variante de campaña), no tocadas |
| `src/components/AdminExerciseCatalogPanel.tsx` / `AdminExerciseCatalogModal.tsx` | 49 / 46 | Catálogo de ejercicios del admin |
| `src/pages/admin/configuraciones/index.tsx` | 38 | Configuración de ejercicios del admin |
| `src/pages/admin/hyrox.tsx` | 0 | Panel Hyrox del admin — migrado por completo, ver §8.2 (decorativo y `PHASE_COLORS`, este último con tokens `--phase-hyrox-*` propios aprobados por Lucas) |
| `src/components/UserMessagesModal.tsx` | 27 | Chat de mensajería con el fundador (el CTA principal ya usa el gradiente de marca; quedan detalles del hilo de mensajes) |
| `src/pages/admin/metricas-rs.tsx` | 20 | Métricas de redes sociales |
| `src/components/ExerciseDemoMedia.tsx` | 17 | Reproductor de demos de ejercicios |
| `src/pages/admin/configuraciones/contenido-social.tsx`, `carrusel-ig.tsx`, `ejercicios.tsx`, `servicios.tsx`, `backlog.tsx`, `actividad.tsx` | 11 / 9 / 7 / 10 / 10 / 2 | Paneles admin construidos después de la pasada original, nunca tokenizados |
| `src/pages/legal/*.tsx` | ~25 en total | Páginas legales (mayormente texto, bajo impacto visual) |

Además, dentro de los archivos ya migrados quedaron **intencionalmente sin tokenizar** paletas categóricas decorativas que no representan estado (ej. tarjetas de resumen con distintos colores solo para diferenciarlas visualmente en `IntakeClientPlanPublicView.tsx`, pestañas de selección en el catálogo de ejercicios, gradientes de héroe/marketing) — forzarlas a los 4 tokens semánticos habría reducido la distinción visual entre secciones sin ganar nada. Si en una futura pasada aparecen más colores crudos representando estado real (éxito/error/advertencia/info), migrarlos con las clases de la sección 2; el resto de archivos de la tabla de arriba son los candidatos naturales para la próxima ronda.

## 6. Panel admin — consolidación de la paleta de `AdminApp.tsx` (decisión de `diseno`)

`frontend` frenó el rollout de Volt en este archivo (156 clases de color crudas) porque no le quedó claro si los tonos fuchsia/violet/indigo/teal/sky/purple codifican secciones del admin a propósito (wayfinding) o son deuda de la paleta vieja. Revisado el archivo entero: **no hay wayfinding por sección.** No existe una sola sección/dominio (usuarios, planes, pagos...) pintada de forma consistente en un color propio — el mismo tono aparece con significados distintos en pantallas distintas, y hasta 5-6 tonos conviven **dentro de una sola pantalla** (la fila de botones de acción de un cliente, las tarjetas de resumen de un plan generado, los filtros de un modal), sin relación con ninguna sección del admin ni con el resto de la paleta de marca (ninguno de esos tonos es lima/coral/magenta). Es la misma deuda — colores sueltos sin criterio único — que este sistema existe para resolver, solo que en el panel admin en vez de en la app de usuario.

**Decisión: se consolida, no se mantiene paleta categórica.** No se crea ninguna categoría nueva de token — todo se resuelve reutilizando lo que ya existe en las secciones 1 y 2:

- Si el color representaba un **estado real** (positivo, alerta, error, informativo) → tokens semánticos ya existentes (`--success`/`--warning`/`--danger`/`--info`, clases `.badge-*`). La mayoría de los usos de `success`/`info`/`danger`/`warning` del archivo ya están bien y no cambian.
- Si el color era **puramente decorativo**, sin estado real detrás (distinguir dos acciones o dos campos de datos dentro de la misma pantalla) → sin color de marca: `.card-surface-2`, `.btn-secondary`/`.btn-ghost`, `.badge-neutral`. La distinción ya la dan el ícono y el texto de cada botón/tarjeta — no hace falta un tono nuevo por elemento.
- Estructura (fondos `gray-900`/`slate-950`, texto `gray-400`/`gray-500`/`slate-400`) → `--surface` (o `--background` en overlays de página completa) y `--text-muted`, igual que ya se migró en el resto de la app.

### Mapeo exacto (para que `frontend` lo implemente)

| Uso actual (color crudo) | Dónde | Nuevo tratamiento |
|---|---|---|
| `bg-slate-500/20` botón "Datos" | fila de acciones, tabla de clientes intake | `.btn-secondary` |
| `bg-violet-500/20` botón "Ver" | ídem | `.btn-secondary` |
| `bg-teal-500/20` botón "Enlace web" | ídem | `.btn-secondary` |
| `bg-indigo-500/20` botón "Pedir peso" | ídem | `.btn-secondary` |
| `bg-fuchsia-500/20` botón "Emails" | ídem | `.btn-secondary` |
| `bg-success/20` "Generar", "Link pago" | ídem | sin cambio — ya es semántico (crear / cobrar) |
| `bg-info/20` "Actualizar", "Pedir check-in" | ídem | sin cambio — ya es semántico (acción neutra/informativa) |
| `bg-danger/20` "Eliminar" (plan y usuario) | ídem | sin cambio — ya es semántico (destructivo) |
| `bg-purple-500/20` badge "Admin" | badge de rol, tabla de usuarios | `.badge-info` |
| `bg-gray-500/20` badge "Regular" / "N/A" | ídem | `.badge-neutral` |
| `border-indigo-400/30` "Evolución de peso" | modal de detalle de cliente | `.card-surface-2`, título en `--foreground` |
| `border-warning/30` "Historial de solicitudes/completados" | ídem | reclasificar: no es una alerta → `.card-surface-2`, no `--warning` |
| `border-fuchsia-400/30` "Historial de cambios de datos" | ídem | `.card-surface-2` |
| `bg-info/30` filtro "Hombre" / `bg-fuchsia-500/30` filtro "Mujer" | modal de entrenador asignado | activo → `--accent` (mismo patrón que cualquier filtro/tab activo de la app); inactivo → `--text-muted`. No hace falta un segundo tono para el segundo valor de un filtro binario |
| `text-success` (ARS) / `text-sky-300` (EUR) | modal de ganancias anuales | ARS se queda en `--success` (cifra positiva real); EUR pasa a `--info` (cifra informativa, no es "otro tipo de éxito") |
| `border-sky-400/20` "Datos de la persona", "Cardio recomendado" | resumen de plan generado | `.card-surface-2` |
| `border-violet-400/20`/`text-violet-200` "Split entrenamiento", "Por qué este orden...", título de día de entreno | ídem | `.card-surface-2`, título en `--foreground` |
| `border-fuchsia-400/20` "Evaluación inicial" | ídem | `.card-surface-2` |
| `border-success/20` "Calorías objetivo" | ídem | sin cambio — cifra positiva real |
| `border-info/20` "Macros" | ídem | sin cambio — dato informativo real |
| `border-warning/*` "Mensaje para el cliente", "Suplementación sugerida" | ídem | sin cambio — son avisos reales (ajuste de objetivo, dosis a respetar) |
| Gradiente hero `blue-500/cyan-500/emerald-500` (tarjetas destacadas de `view==="dashboard"`) | encabezado del panel | `--brand-start/mid/end` (gradiente de marca Volt), igual que el resto de héroes/ambientales ya migrados |
| Gradiente de barra `cyan-500→blue-500` | gráfico de barras | `--accent`/`--accent-strong` |
| `bg-gray-900`/`bg-slate-950` fondos de modal | varios modales | `--surface` |
| `text-gray-400`/`text-gray-500`/`text-slate-400` | textos secundarios varios | `--text-muted` |

No queda ningún tono nuevo que documentar como categoría propia: todo lo de arriba se resuelve con clases/tokens que ya existían antes de esta pasada.

## 7. Panel admin — reestructuración de navegación e IA (decisión de `diseno`, fase de definición)

Encargo de Lucas: "reorganizar y reestructurar" el panel admin completo, no solo repintarlo (el rollout de paleta/tipografía en `AdminApp.tsx` y las 12 vistas ya está hecho — ver §6 y §5). Esta sección es la spec de la reorganización; **no implementada todavía**, es entrega para que `frontend` la construya. Demo funcionando en `/admin-design-preview` (página aislada, datos de muestra, no toca las vistas reales — mismo patrón que `/design-preview`).

### 7.1 Diagnóstico: por qué el admin se siente "app vieja repintada"

Auditadas las 12 vistas + `AdminApp.tsx` + `Navbar.tsx` (nav compartido cliente/admin). Hallazgo central: **el admin no tiene navegación propia.** No existe un sidebar, tab bar ni menú admin persistente en ningún lado. Lo único que existe:

- Un ícono de campana (notificaciones) y un ícono de chat en `Navbar.tsx`, compartidos con la vista de cliente.
- Un link "Configuraciones" enterrado dentro del menú desplegable del avatar de usuario (mismo menú que usa el cliente final para cambiar de idioma o cerrar sesión).
- Breadcrumbs "← Volver al panel" / "Volver a configuraciones" sueltos en cada página, uno por uno, sin ningún punto central desde el que se vean todas las secciones a la vez.

Consecuencia concreta: **`/admin/configuraciones` no es una pantalla de configuración — es el índice real del panel.** Ahí viven, a un clic de distancia con nombre engañoso, 6 de las 12 vistas: catálogo de ejercicios, generador de contenido con IA, servicios (salud/crédito de integraciones externas), métricas de RS, backlog del equipo y HYROX. Son herramientas de trabajo diario, no ajustes ocasionales — y están nombradas y ubicadas como si lo fueran. Esto es exactamente la "fricción" y "cosas enterradas" que pedía la auditoría.

Segundo problema, ya apuntado en §6 pero que se repite acá: cada página tiene su propio header decorativo con gradiente hexadecimal crudo (`from-[#0b1e37] via-[#0f2847] to-[#0f3d3a]`) y su propio ícono de sección con un tono Tailwind elegido sin criterio (ejercicios=cian, servicios=esmeralda, backlog=violeta, hyrox=naranja, contenido=info) — no hay wayfinding real, cada vista "grita" con su propio color en vez de vivir en una jerarquía visual común.

Tercer problema: `AdminApp.tsx` (8.060 líneas) resuelve 3 vistas (`dashboard`/`intake`/`fitplan`) con un `view` prop y su propio breadcrumb ad hoc, separado del resto de páginas de `/admin/*`, que son archivos independientes con su propio patrón de header. Dos sistemas de navegación conviviendo sin cruzarse.

### 7.2 Qué patrones de la landing (issue #16, fase de auditoría) generalizan al admin y cuáles no

Auditado `HomeLanding.tsx`. Esto responde la fase 1 pedida en el issue #16 para la porción admin (queda comentado también en el issue).

**Generalizan bien** (reutilizados en la demo):
- Tarjeta base: `rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5/p-6` — mismo radio, mismo borde sutil, misma superficie. Ya es lo que da `.card-surface`.
- Patrón "kicker + título": label pequeño en mayúsculas con tracking ancho y color de acento (`text-sm font-semibold uppercase tracking-wider text-[var(--accent)]`) encima de cada `h1`/`h2` — reemplaza los headers actuales del admin, todos con el mismo texto gris `text-info/90` sin jerarquía.
- Chips/pills (`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium`) para filtros y estados — ya existen como `.badge`, solo falta aplicarlos consistentemente en vez de los tonos sueltos por botón que señala §6.
- Motion: `fadeUp` (opacity+y, 0.35s) al entrar cada sección y `whileInView` con stagger (`delay: i*0.05–0.06`) en grillas — el admin hoy no tiene motion en la mayoría de vistas (`actividad.tsx`, `servicios.tsx`, etc. renderizan instantáneo) o lo tiene inconsistente. Reusar exactamente los mismos valores que ya usa la landing, no inventar un lenguaje de motion nuevo.
- Radios contundentes / botones grandes (`.btn`, `rounded-2xl`) — igual.

**No generalizan, y no correspondía forzarlos** (herramienta de uso diario ≠ landing de marketing):
- El hero de scroll grande a pantalla completa con storytelling en varias secciones apiladas — el admin necesita todo accesible sin scroll narrativo, con shell persistente (sidebar + contenido), no una página que se recorre de arriba a abajo.
- Acordeón de FAQ y bloques de copy largo — no aplica a paneles de datos.
- Un solo CTA de conversión dominante por sección — el admin tiene múltiples acciones concurrentes por pantalla (tabla de clientes con 5 acciones por fila), no un único "siguiente paso".

### 7.3 Propuesta de reestructuración

**A. Shell de navegación persistente (`<AdminShell>`, componente nuevo para `frontend`).**
Envuelve las 12 vistas reales. Reemplaza los breadcrumbs sueltos y la falsa jerarquía de "Configuraciones".

- Desktop (`lg:` y arriba): sidebar fijo a la izquierda, 248px, `bg-surface border-r border-border`. Logo + "FitPlan · Admin" arriba (link a `/admin`). Debajo, lista de navegación con **7 destinos** (ver 7.4), ícono + label, estado activo = `bg-accent/12 text-accent` (mismo tratamiento que cualquier tab/filtro activo del resto de la app — no `--info`, que es el color que se usaba antes sin motivo semántico).
- Mobile (`< lg`): la sidebar colapsa a una tira horizontal de pills con scroll (`overflow-x-auto`, mismo patrón de pill que ya usan `hyrox.tsx`/`metricas-rs.tsx`/`actividad.tsx` para sus tabs internas — no hay que inventar el componente, ya existe, solo promoverlo a nav de primer nivel), fija abajo de la pantalla.
- El shell **no duplica** cuenta/idioma/logout/notificaciones — eso se queda en `Navbar.tsx` tal cual está, es correcto que sea compartido con la vista cliente.
- Contenedor de contenido: `max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8` como default; vistas con tablas anchas (Clientes, Actividad) pueden pedir `max-w-7xl`. Hoy los 12 archivos usan anchos sueltos e inconsistentes (`max-w-3xl`, `4xl`, `5xl`, `7xl` sin criterio) — se estandariza a estas dos opciones nada más.

**B. Header de página estándar**, igual en las 12 vistas (reemplaza los headers ad hoc con gradiente hex crudo):
- Kicker (`text-[11px] font-semibold uppercase tracking-[0.18em] text-accent`) + `h1` en `font-display` + subtítulo en `text-text-muted`.
- El **gradiente de marca** (`--brand-start/mid/end`) queda reservado *solo* para el hero de Resumen/Dashboard — es el único lugar que "brilla"; las otras 11 vistas usan headers planos sin caja de color. Esto crea jerarquía real: hoy las 12 vistas tienen exactamente el mismo tratamiento de header "hero", por lo que ninguna se siente más importante que otra.
- Acciones de la página a la derecha del header, siempre `.btn-secondary`/`.btn-primary` — nunca botones de navegación coloreados como "positivos" (ej. el actual "Ver clientes 1:1" en verde `border-success/40 bg-success/15`, que no es un estado de éxito, es solo un link).

**C. Vistas de datos densos (clientes-fitplan/clientes-1:1 como caso de referencia, ver demo).**
Reemplaza la lista vertical de tarjetas con 5-6 botones de acción de colores dispares (mapeo ya definido en §6) por:
- Tabla en desktop: header `bg-surface-2`, filas alternadas sutiles, columnas Cliente/Estado (`.badge`)/Plan (`.badge-phase-*`)/Última actividad/Acciones.
- Acciones como íconos `.btn-ghost` con `title`/`aria-label` (tooltip) en vez de 5 botones con texto y colores distintos por fila — mismo criterio de §6 (decorativo sin estado real → neutral).
- En mobile, la misma fila se convierte en tarjeta `.card-surface-2` apilada (mismo dato, layout de tarjeta en vez de tabla).
- Filtros como pills con estado activo en `--accent` (igual al selector de días de `/design-preview`), no un tono distinto por cada valor del filtro.

**D. Motion + accesibilidad (mi responsabilidad directa, no delegable).**
- Aplicar `fadeUp`/stagger consistentes (7.2) en las 12 vistas.
- **Nuevo requisito, no existía antes:** envolver las variantes de motion compartidas en `useReducedMotion()` de `framer-motion` y desactivar animación cuando el usuario tiene `prefers-reduced-motion` — ni la landing ni el admin lo hacen hoy. Implementado en la demo (`admin-design-preview.tsx`) como referencia de patrón.
- Botones de acción por ícono (punto C) llevan siempre `title` + `aria-label` explícito — hoy varias acciones del admin son solo ícono sin texto accesible.

### 7.4 Los 7 destinos de navegación (reemplazan los 12 puntos de entrada actuales + el falso hub "Configuraciones")

| # | Sección | Contenido que agrupa | Por qué |
|---|---|---|---|
| 1 | **Resumen** | `/admin` (dashboard) | Único lugar con hero de marca; KPIs + accesos directos a las otras 6. |
| 2 | **Clientes** | `clientes-fitplan` + `clientes-1-1` + `actividad` como sub-pestañas de una misma vista | Las 3 son sobre el mismo dominio (usuarios/eventos de clientes) y hoy son 3 destinos desconectados; `actividad` hoy solo es alcanzable desde la campana de notificaciones. |
| 3 | **Contenido** | `configuraciones/contenido-social` + `configuraciones/carrusel-ig` + `metricas-rs` como sub-pestañas | Mismo pipeline: generar contenido → publicarlo → medir su rendimiento. Hoy `metricas-rs` vive separado de las otras dos bajo "Configuraciones", sin relación visible entre sí. |
| 4 | **Ejercicios** | `configuraciones/ejercicios` | Dominio de autoría de contenido de entrenamiento, no tiene relación con "Contenido" (que es marketing/redes) — se mantiene aparte a propósito. |
| 5 | **Backlog del equipo** | `backlog` | Meta: qué están haciendo los equipos de agentes y qué decisión te está esperando. Dominio propio (gestión del propio sistema de agentes), no client-facing. |
| 6 | **Servicios** | `servicios` | Salud/crédito de integraciones externas. Se queda como destino propio y visible (se usa seguido para troubleshooting) — con un punto de estado (verde/ámbar/rojo, tokens `--success`/`--warning`/`--danger` ya existentes) directamente en el ítem del sidebar, para ver de un vistazo si algo está caído sin entrar. |
| 7 | **HYROX** | `hyrox` | Herramienta personal de Lucas, permanente (Lucas confirmó: queda como plantilla reutilizable para futuros eventos, no sale del nav después de la carrera del 20 de noviembre — ver §8.1). Se mantiene con tratamiento visualmente secundario (`muted`, sin badge) en el nav. |

Esto resuelve el problema central: ningún destino queda a más de 1 clic, y "Configuraciones" deja de existir como nombre engañoso — cada cosa se llama y se agrupa por lo que realmente es.

### 7.5 Qué no requirió tocar nada del árbol de tokens

Toda la reestructuración de arriba se resuelve con tokens/clases que ya existen (`--accent`, `--surface`/`--surface-2`/`--surface-3`, `--success`/`--warning`/`--danger`, `.badge*`, `.btn*`, `.card-surface*`, `font-display`). No hay ninguna categoría de token nueva, ningún asset de marca nuevo ni cambio de paleta — por eso esta sección no necesitó pasar por Lucas antes de proponerse. Lo único pendiente de aprobación de Lucas es la nota de HYROX de la tabla de 7.4, y es una decisión de producto (alcance/vigencia de la sección), no de diseño — corresponde a `producto`, no a él directamente.

### 7.6 Pendiente para `frontend` (implementación, fuera de esta entrega)

1. Construir `<AdminShell>` (sidebar desktop + tira de pills mobile) según 7.3-A y envolver las 12 vistas reales de `/admin/*`.
2. Migrar `clientes-fitplan.tsx`/`clientes-1-1.tsx` de lista de tarjetas a tabla/tarjeta según 7.3-C.
3. Reemplazar los headers con gradiente hex crudo de las 12 vistas por el header estándar de 7.3-B (de paso, aplica `font-display` a los headings, pendiente general de rollout ya anotado en §1).
4. Deshacer `/admin/configuraciones` como hub — sus 6 hijos pasan a ser destinos de primer nivel (o sub-pestañas dentro de "Clientes"/"Contenido") según 7.4.
5. Aplicar `useReducedMotion()` a las variantes de motion compartidas (punto D), y sumarlo también a `HomeLanding.tsx`/`design-preview.tsx` ya que hoy tampoco lo tienen — deuda de accesibilidad preexistente que se detectó de paso en esta auditoría.

Demo de referencia (no implementación real, datos hardcodeados): `src/pages/admin-design-preview.tsx` → `/admin-design-preview` (vista "Resumen" por defecto, `?view=clientes` para la vista de datos densos).

## 8. HYROX — nav permanente y paleta interna (decisión de `diseno`, seguimiento de §7)

Con las 12 vistas ya migradas al `<AdminShell>` de §7 y en producción, quedaban dos puntos abiertos sobre HYROX: la vigencia en el nav (que §7.4 dejaba pendiente de `producto`) y la paleta interna de `src/pages/admin/hyrox.tsx`, que `frontend` dejó explícitamente sin tocar porque no había token equivalente para las fases de periodización y no quiso inventar uno.

### 8.1 Nav: HYROX es permanente — se revisa el trato `muted`, se mantiene

Lucas confirmó que HYROX **no** sale del nav después de la carrera del 20 de noviembre: queda como plantilla reutilizable para futuros eventos.

Eso invalida la razón original con la que se propuso el trato `muted` en §7.4 ("acotado en el tiempo") — un ítem apagado en un sidebar suele leerse como "esto está por desaparecer", y ya no es cierto. Revisado el criterio con esa razón fuera de la mesa, **se mantiene `muted`, pero por un motivo distinto**: a diferencia de Clientes/Contenido/Backlog (uso diario, de todo el equipo), HYROX es una herramienta personal de Lucas, no cara al cliente, de uso estacional (se consulta seguido mientras hay un evento en preparación, prácticamente nada el resto del año). La jerarquía por frecuencia de uso real sigue siendo válida — es el mismo criterio con el que hoy "Servicios" o "Backlog" no compiten visualmente con "Clientes" en el sidebar.

**Decisión: se mantiene el tratamiento `muted` de `AdminShell.tsx` (`NAV_ITEMS`, ítem `hyrox`) tal cual está implementado**, sin cambios de código. Lo único que cambia es la nota de §7.4 (ya actualizada arriba): deja de decir "pendiente de `producto`" y pasa a documentar que es una decisión ya resuelta y de motivo distinto al original. No queda nada pendiente de implementar en el nav.

### 8.2 Paleta interna de `hyrox.tsx`: dos problemas distintos, dos resoluciones distintas (ambos resueltos)

Revisado el archivo completo (grep de clases Tailwind de color crudas, ver líneas 40-43, 241, 294, 409, 441, 464). Hay dos cosas de naturaleza distinta mezcladas bajo "paleta HYROX", y no se resuelven igual:

**A. `PHASE_COLORS` (líneas 39-44) — categorías con significado real, no decorativas. Resuelto: Lucas aprobó la propuesta tal cual, ver valores finales en §1 y en la tabla más abajo.**

`PHASES` (`src/lib/hyrox/plan.ts`) define 4 fases de periodización del bloque de 15 semanas — Base aeróbica (sem. 1-4), Construcción (5-9), Específico de carrera (10-13), Afinado y competición (14-15) — cada semana pertenece a exactamente una, tienen objetivo y contrapartida propios, y se muestran lado a lado en "Las 4 fases" para que Lucas identifique en qué momento del bloque está. Esto es estructuralmente **el mismo caso que las fases de plan** (`--phase-bulk/cut/lean-bulk/maintenance`, §1) que el propio rediseño decidió mantener a propósito "por ser comunicación de estado, no decisión de marca" — no color decorativo.

Tratamiento correcto entonces: no consolidar a un solo acento (perdería la distinción que el usuario necesita), sino tokens propios — mismo patrón que las fases de plan.

**Esto excede mi autonomía y queda escalado a Lucas.** Definir una categoría de token nueva en el árbol de `:root` (`--phase-hyrox-*`) es exactamente lo que la sección "Qué escalás a Lucas" me pide no tocar sin su ok — aun siguiendo un patrón ya aprobado, sigue siendo una entrada nueva en el árbol de marca, no un ajuste dentro de una categoría existente. Además, los 4 tonos crudos actuales (`blue`, `emerald`, `amber`, `violet`) pisan 3 de los 4 hues que ya significan otra cosa en `--phase-bulk` (ámbar), `--phase-lean-bulk` (esmeralda) y `--phase-maintenance` (violeta) — si se tokenizan tal cual, se recrea el problema exacto que este sistema existe para resolver (mismo tono, significado distinto según la pantalla).

Propuesta aprobada por Lucas tal cual, sin ajustes:

| Token propuesto | Fase | Hue | Por qué este hue y no otro |
|---|---|---|---|
| `--phase-hyrox-base` | Base aeróbica | Azul | No colisiona con ninguna fase de plan existente |
| `--phase-hyrox-construccion` | Construcción | Teal | Distinto de `--phase-cut` (cian) y `--phase-lean-bulk` (esmeralda), pero en la misma familia fría — coherente con que todavía no es la fase de mayor intensidad |
| `--phase-hyrox-especifico` | Específico de carrera | Naranja | Es el tono que hoy ya "es" HYROX en la página (tabs, franja activa) — conservarlo en la fase de mayor intensidad específica de carrera es la asociación más intuitiva, y no colisiona con `--phase-bulk` (ámbar, más amarillo) |
| `--phase-hyrox-taper` | Afinado y competición | Rosa/coral fuerte | Cierre de la progresión (frío→cálido, calca la lógica de "se acerca la carrera"), sin colisionar con `--phase-maintenance` (violeta) |

**Implementado por `frontend`:** 4 variables agregadas al árbol `:root` + `@theme inline` (mismo patrón que `--phase-*` existente), con las variantes `.badge-phase-hyrox-*` (bg 16% / texto sólido / border 35%, mismo mix `color-mix(in oklab, ...)` que `.badge-phase-bulk` etc.) que `PHASE_COLORS` necesitaba. `PHASE_COLORS` de `hyrox.tsx` reemplazado por esas clases. Hex finales, elegidos por contraste legible sobre `--background: #08090c` y verificados visualmente uno junto al otro (los 4 se distinguen a simple vista, ninguno se confunde con `--phase-bulk`/`--phase-cut`/`--phase-lean-bulk`/`--phase-maintenance`): ver tabla en §1.

**B. Todo lo demás (líneas 241, 294, 409, 441, 464) — decorativo, sin significado propio. Se consolida ahora, no requiere a Lucas.**

Verificado uno por uno, ninguno de estos codifica un estado real — es la misma paleta "naranja porque sí" de la página entera, elegida sin relación con `--accent` (lima) de marca, igual que el ícono de sección de HYROX ya señalado como arbitrario en §7.1. Mapeo exacto para que `frontend` lo implemente:

| Uso actual (color crudo) | Línea | Qué representa | Nuevo tratamiento |
|---|---:|---|---|
| `border-orange-400/40 bg-orange-500/15 text-orange-100` (tab activo: Plan semanal / Estrategia / Tests / Nutrición / Contenido) | 241 | Selector de sub-pestaña — mismo patrón que cualquier tab/filtro activo del resto de la app, sin estado propio | `border-accent/40 bg-accent/15 text-accent` (mismo tratamiento que el nav activo de `AdminShell`) |
| `ring-orange-400/40` (semana en curso, tarjeta destacada) | 294 | Resalta la tarjeta "activa" del acordeón de semanas — es selección/foco, no un estado semántico | `ring-accent/40` |
| `focus:border-orange-400/50` (input de test/benchmark) | 441 | Estado de foco de un `<input>` | `focus:border-accent/50` — `--accent` es literalmente el token documentado en §1 para foco |
| `text-orange-300/60` (viñeta `·` de la lista de nutrición) | 464 | Marcador decorativo de lista, sin significado | `text-text-subtle` (mismo tratamiento neutro que las viñetas `·` de `SessionCard`, ya en el archivo) |
| `text-emerald-300/90` (prefijo "Reparto:" en cada estación) | 409 | Encabezado de un dato informativo/procedimental (cómo se reparte la estación en dobles) — no es una cifra positiva ni un logro | `text-info` — es guía informativa, no éxito; evita reusar esmeralda, que en el resto de la app ya significa `--phase-lean-bulk`/`--success` |

Nada de esta tabla B crea categoría nueva: todo resuelve con `--accent`, `--info` y `--text-subtle`, ya existentes.

### 8.3 Pendiente — resuelto, nada abierto

Ambos puntos de 8.2 (A y B) están implementados. Lucas aprobó la propuesta de 4 tokens `--phase-hyrox-*` de 8.2-A sin ajustes; `frontend` la aplicó junto con el mapeo decorativo de la tabla B (8.2-B) en `src/pages/admin/hyrox.tsx` en la misma pasada. No queda nada pendiente de aprobación sobre la paleta de HYROX.

## 9. Notificaciones, Chat admin y Cerrar sesión se mueven al sidebar (decisión de Lucas, invalida parte de §7.3-A)

Con las 12 vistas ya en `<AdminShell>` (§7) y el admin viéndose como la demo aprobada (§7 rollout), Lucas notó que quedaban **2 navs conviviendo** en el admin: la barra horizontal compartida (`Navbar.tsx`) arriba, y el sidebar nuevo (`AdminShell.tsx`) a la izquierda. Pidió sacar la horizontal del admin y mover, debajo de HYROX en el sidebar, las 3 funciones de admin que hoy solo viven en esa barra: **Notificaciones**, **Chat admin** y **Cerrar sesión**.

Esto **invalida, para esas 3 funciones, la nota de §7.3-A** ("el shell no duplica cuenta/idioma/logout/notificaciones — eso se queda en `Navbar.tsx` tal cual está"). Implementado reusando lo que ya existía, sin duplicar lógica:
- **Notificaciones**: ítem de sidebar que linkea a `/admin/actividad` (la vista real donde ya vivían), con badge de no leídos tomado del mismo `unreadCount` que ya calculaba el backend de `paymentNotifications`. No replica el dropdown con filtros/agrupado por día que tenía `Navbar.tsx` — eso queda simplificado a un link con contador, no una reimplementación 1:1.
- **Chat admin**: abre el mismo `MessagesModal` que ya existía dentro de `Navbar.tsx` (ahora exportado desde ahí para poder importarlo en `AdminShell.tsx`), con el mismo endpoint de no leídos.
- **Cerrar sesión**: mismo `handleLogout` que tenía el menú de avatar (actualiza `lastUsersCheck` del admin y desloguea).

Los 3 están tanto en el sidebar desktop como en la tira mobile — si solo se agregaban al sidebar, el admin los perdía en teléfono.

`Navbar.tsx` **no se tocó** para las vistas de cliente — la barra horizontal sigue existiendo tal cual para el resto de la app, solo se dejó de montar en el contexto admin. `<Navbar />` ya **no** se renderiza dentro de `AdminShell.tsx` — la duplicación temporal entre ambos navs (mientras se resolvía qué pasaba con el logo y el selector de idioma, ver más abajo) quedó cerrada.

### 9.1 Resolución de lo que quedaba pendiente: logo, idioma, "Pendiente sync" e "Ir al panel admin"

Lucas resolvió los 4 puntos que habían quedado abiertos al mover Notificaciones/Chat admin/Cerrar sesión (§9) y sacar `<Navbar />` del admin:

- **Logo → home pública (`/`): se preserva**, como ítem **"Ver sitio"** al pie del sidebar desktop (con su propio borde superior, separado de `NAV_ITEMS` y de las 3 funciones de admin) y al final de la tira mobile. Tratamiento visual deliberadamente distinto al resto (`text-text-subtle` en vez de `text-text-muted`, ícono `FaExternalLinkAlt` — mismo ícono que ya usa el resto del admin para "esto te saca de esta pantalla", ver `backlog.tsx`/`metricas-rs.tsx`): es una salida del panel, no una sección más, y por eso no compite visualmente con los 7 destinos de navegación ni con las 3 funciones de cuenta.
- **Selector de idioma ES/EN: NO se migra.** Ninguna de las 12 vistas de `/admin/*` usa `locale`/`ui()`/`dash()` — todas están en español hardcodeado (auditado: el hook `useAppLocale`/`ui()` de `Navbar.tsx` no se importa en ningún archivo de `src/pages/admin/**` ni en `AdminApp.tsx`). El selector nunca tuvo efecto real dentro del panel — cambiarlo ahí no cambiaba ni un string del admin. El usuario admin lo sigue teniendo disponible en las vistas de cliente (donde sí aplica, vía `Navbar.tsx` sin cambios), así que no se pierde la función, solo se saca de donde no hacía nada.
- **Badge "Pendiente sync": NO se migra.** Es un indicador genérico de cola de sincronización de peso pendiente en el dispositivo, aplicable a cualquier usuario logueado (cliente o admin) — no es una función específica de administración, es estado de sesión. Se queda donde vive el resto del estado de sesión: `Navbar.tsx`, para las vistas de cliente. El admin, como usuario logueado, sigue viéndolo si navega fuera del panel.
- **"Ir al panel admin" (shortcut del dropdown de avatar): se elimina, no se migra.** Quedaba redundante con el logo del sidebar de `AdminShell.tsx`, que ya lleva a `/admin` — mantenerlo hubiera sido dos caminos al mismo destino sin motivo.

Con esto no queda nada abierto de §9: las 4 funciones que antes solo vivían en `Navbar.tsx` (Notificaciones, Chat admin, Cerrar sesión, Ver sitio) están accesibles desde `AdminShell.tsx`, tanto en desktop como en mobile, y `<Navbar />` dejó de montarse en el contexto admin.

## 10. Modo claro

Hoy la app es permanentemente oscura (no hay toggle ni variante clara). Si en el futuro se quiere soporte de modo claro, el punto de entrada es un solo lugar: redefinir el bloque `:root` de tokens bajo un selector `[data-theme="light"]` (mismos nombres de variable, valores distintos) — como todo el resto del sistema ya lee de variables, no haría falta tocar componentes.
