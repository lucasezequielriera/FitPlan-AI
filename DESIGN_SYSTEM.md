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
| `--brand-start/mid/end` | `#cbff3d` → `#ff5f45` → `#ff3d81` (lima → coral → magenta) | Gradiente ambiental de fondo (hero, body background) y franjas decorativas finas sin dato (≤2px). **No usar en barras de progreso ni en ningún widget cuyo valor el usuario esté leyendo como una cifra** — ver corrección de alcance en §13.10.6; el progreso real usa `--accent` u otro token semántico según lo que comunique |
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

> **Esta sección la comprueba un test.** `src/__tests__/designSystemDebt.test.ts` cuenta las clases crudas de cada archivo del repo y falla si la tabla de abajo no coincide, o si aparece deuda en un archivo que no esté listado. La cuenta la hace `src/lib/design/rawColors.ts`, que es el mismo módulo para todos: antes cada recuento usaba un patrón distinto y ninguno cuadraba con otro (issue #11).

Esta sesión aplicó los tokens/clases a fondo en: landing (`HomeLanding.tsx`, ya estaba migrado), `dashboard.tsx`, `DashboardPlanCard.tsx`, `create-plan.tsx`, `plan.tsx` y sus modales (`GymCalendarModal`, `ExerciseSetTracker`, `FoodTrackingModal`, `WeeklyStatsModal`, `PlanContinuityModal`, `TrainingCalendar`, `IMCInfoModal`, `PremiumPlanModal`, `MonthChangesModal`, `IntakeWorkoutDayLog`, `mi-plan/[clientId].tsx`), y el panel admin (`AdminApp.tsx`, `Navbar.tsx`, `AdminExerciseCatalogPanel.tsx`, `admin/actividad.tsx`) — reemplazando los patrones de color con significado real (éxito/error/advertencia/info, colores de fase) por los tokens semánticos.

`IntakeClientPlanPublicView.tsx` y `AdminExerciseCatalogModal.tsx` **estaban en esa lista sin estarlo**: entre los dos sumaban 104 clases crudas. Se han sacado. Ver la tabla de deuda.

**Rollout "FitPlan Volt" (pasada de `frontend`):** sobre la base de arriba, se migró el resto de identidad de marca hardcodeada (gradientes viejos ámbar/naranja/rosa, azul/cian, púrpura/rosa, y fondos `slate-900`/`gray-900` crudos) a `--brand-start/mid/end` y `--background`/`--surface`, y se aplicó `font-display` (Space Grotesk) a headings y cifras grandes (kcal, kg, %, sets) en: `dashboard.tsx`, `DashboardPlanCard.tsx`, `plan.tsx`, `create-plan.tsx`, `mi-plan/[clientId].tsx`, `formulario-de-inicio.tsx` (+ `en/formulario-de-inicio.tsx`, que solo re-exporta el mismo componente), `payment/{success,pending,failure}.tsx`, `CookieConsentBanner.tsx`, `LoginModal.tsx`, `MonthChangesModal.tsx`, `Navbar.tsx`, `TrainingCalendar.tsx` e `IntakeWorkoutDayLog.tsx`. Verificado visualmente con capturas de Chrome headless (landing, formulario, payment success/failure/pending) — contraste correcto: texto oscuro sobre `--accent` lima en todos los CTA `.btn-primary`/gradiente de marca.

**`src/components/admin/AdminApp.tsx` — resuelto.** `frontend` implementó el mapeo exacto de la sección 6 sobre las 156 clases crudas detectadas: 155 migradas a los tokens/clases ya existentes (`--success/--warning/--danger/--info`, `bg-surface`/`bg-surface-2`, `border-border`/`border-border-strong`, `text-foreground`/`text-muted`, `bg-accent`/`text-accent-ink` para el filtro activo, `--brand-start/mid/end` para el gradiente de héroe y el de la barra del gráfico de peso). Queda **1 clase sin tocar, fuera de alcance real**: `text-gray-600` en el visor de HTML de emails (dentro de una caja `bg-white` — texto oscuro sobre superficie clara, no sobre el chrome oscuro de la app; los tokens del sistema son todos para el tema oscuro permanente, no aplican ahí). Verificado visualmente con Chrome headless sobre una réplica estática de los patrones migrados (fila de acciones por cliente, badges de rol/estado, filtro Hombre/Mujer, tarjetas de resumen de plan generado, gradiente de héroe) — sin login real de administrador (credenciales de producción, fuera de alcance de esta verificación). `npx tsc --noEmit` sin errores; `eslint` sobre el archivo solo reporta 2 errores `prefer-const` y varios `no-unused-vars` preexistentes, no relacionados con este cambio.

### Deuda real (recuento exacto, verificado por test)

Una fila por archivo. Un archivo con deuda que no esté aquí hace fallar el test, así que la tabla es exhaustiva por construcción: no se puede acumular deuda en silencio.

| Archivo | Clases crudas | Nota |
|---|---:|---|
| `src/components/IntakeClientPlanPublicView.tsx` | 56 | **Contenido público de cliente.** El color codifica dominio (cian=datos, esmeralda=calorías, violeta=entrenamiento, fucsia=evaluación, ámbar=suplementos), no estado — ver decisión pendiente abajo |
| `src/components/AdminExerciseCatalogModal.tsx` | 46 | Catálogo de ejercicios del admin |
| `src/components/UserMessagesModal.tsx` | 27 | Chat con el fundador (el CTA ya usa el gradiente de marca) |
| `src/components/ExerciseDemoMedia.tsx` | 17 | Reproductor de demos |
| `src/pages/admin/metricas-rs.tsx` | 10 | Métricas de redes sociales |
| `src/pages/legal/disclaimer.tsx` | 8 | Página legal, mayormente texto |
| `src/pages/admin/configuraciones/contenido-social.tsx` | 4 | Panel admin posterior a la pasada original |
| `src/pages/legal/privacy.tsx` | 4 | Página legal |
| `src/pages/legal/terms.tsx` | 4 | Página legal |
| `src/pages/legal/liability.tsx` | 3 | Página legal |
| `src/pages/admin/configuraciones/carrusel-ig.tsx` | 2 | Panel admin posterior a la pasada original |
| `src/pages/legal/contact.tsx` | 2 | Página legal |
| `src/pages/legal/cookies.tsx` | 2 | Página legal |
| `src/pages/legal/refund.tsx` | 2 | Página legal |
| `src/components/admin/AdminApp.tsx` | 1 | `text-gray-600` en el visor de HTML de emails: texto oscuro sobre `bg-white`, donde los tokens del tema oscuro no aplican |
| `src/pages/admin/actividad.tsx` | 1 | Resto de la pasada original |

**Total: 189 clases en 16 archivos.**

Ya están a **0** y salen de la tabla: `transformacion-fitplan.tsx` (y su gemela `en/`), `AdminExerciseCatalogPanel.tsx`, `admin/configuraciones/index.tsx`, `ejercicios.tsx`, `servicios.tsx`, `backlog.tsx` y `admin/hyrox.tsx` (este último, ver §8.2). La tabla anterior les atribuía unas 227 clases que ya no existían: el documento estaba equivocado en las dos direcciones a la vez — daba por migrado lo que no lo estaba y por pendiente lo que ya se había hecho.

### Decisión pendiente de Lucas: el color por dominio

Hay paletas que no son ni estado ni fase, sino **dominio**: en `IntakeClientPlanPublicView.tsx` cada bloque del plan tiene su color y lo mantiene (datos, calorías, entrenamiento, evaluación, suplementación). Lo mismo en las pestañas del catálogo de ejercicios.

El documento decía que eso era "decorativo, no requiere migración". Es medio cierto y medio no: **no** hay que meterlo en los 4 tokens semánticos —forzar cinco dominios en `success/warning/danger/info` destruiría la distinción y volvería la vista pública menos legible—, pero tampoco puede quedarse como colores sueltos, porque entonces "es intencional" se vuelve la excusa que tapa cualquier deuda.

Las dos salidas son:

1. **Tokens de dominio propios** (`--domain-*`), como ya se hizo con `--phase-hyrox-*`. Fija la paleta, permite cambiarla en un sitio, y el guard deja de contarlos.
2. **Aceptarlos como excepción declarada**, con su fila en la tabla y el motivo escrito.

Requiere decisión: ampliar el vocabulario de tokens es una decisión de marca, no de implementación.

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

> **Estado del punto 5 — ✅ implementado** (nota de seguimiento, 2026-09). El texto de §7.3-D y del punto 5 quedó redactado antes de la implementación y sigue diciendo "hoy no lo tienen"; ya no es cierto y confunde a quien audite el archivo. Verificado en código, archivo por archivo: `useReducedMotion()` está en `src/components/admin/adminMotion.ts` (`useAdminFadeUp`/`useAdminStagger`, consumidas por las vistas admin reales: `backlog`, `actividad`, `contenido-social`, `ejercicios`, `carrusel-ig`, `servicios`, `metricas-rs`, `hyrox` y `AdminApp.tsx`), en `HomeLanding.tsx`, en `Navbar.tsx` y también en `transformacion-fitplan.tsx` y su versión `/en` — las tres landings derivan sus variantes `fadeUp`/`reveal` del flag, no solo lo declaran. El pedido de §14.5 sobre ese archivo también quedó cubierto.

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

## 11. Navbar de cliente — rediseño y reestructuración (decisión de `diseño`, fase de definición)

Encargo de Lucas: rediseñar y reestructurar `src/components/Navbar.tsx`. Con el admin ya migrado a `<AdminShell>` (§7-§9), `Navbar.tsx` **hoy solo sirve a las vistas de cliente** (`<Navbar />` ya no se monta en el admin) — hay libertad total para rediseñarlo sin romper nada del panel. Esta sección es la spec; **no implementada todavía**, es entrega para que `frontend` la construya. Demo funcionando en `/client-navbar-preview` (página aislada, estado simulado con toggles, no toca las vistas reales — mismo patrón que `/design-preview` y `/admin-design-preview`). Capturas verificadas con Chrome headless en 1440×900 (desktop) y 390×844 (mobile), en los 4 estados relevantes (sin sesión, cliente sin plan, cliente con plan, admin navegando su propio dashboard/plan).

### 11.1 Diagnóstico: qué hace hoy `Navbar.tsx` y dónde está la fricción

Auditado el archivo completo (2067 líneas — incluye, además del nav, dos modales exportados: `SendMessageModal` y `MessagesModal`, este último reusado por `AdminShell.tsx` para el chat admin, ver §9; ninguno de los dos se toca en esta propuesta).

Qué provee hoy, todo en una sola fila horizontal fija arriba (`fixed`, correcto — no usa `sticky`; el histórico bug de `overflow-x:hidden` en `html`/`body` que rompía `position: sticky` ya se eliminó, ver §14, pero no hay motivo para migrar este nav de `fixed` a `sticky` solo porque ahora es viable):
- Logo (ícono+wordmark) → siempre a `/`, la home **pública** de marketing, incluso con sesión iniciada.
- Selector de idioma ES/EN — visible en la fila principal solo si `!authUser`; con sesión, el mismo control se duplica dentro del menú desplegable del avatar.
- Cliente no-admin: pill con 2 íconos (mensajes de chat con el coach, calendario de días de gym), agrupados.
- Admin (incluido cuando el propio Lucas navega su plan personal, ver más abajo): campana de notificaciones (con panel de filtros/agrupado por día) + botón de chat admin, sueltos, sin agrupar.
- Badge "Pendiente sync" (cola de peso offline) — pill propia, aparece intercalada entre los íconos cuando hay registros pendientes.
- Botón de avatar → menú desplegable (portal) con: acceso a "mi dashboard/crear plan/panel admin" (shortcut redundante, duplica lo que ya hace el logo o la navegación real), selector de idioma (duplicado del de arriba), cerrar sesión.

Problemas concretos encontrados:

1. **El logo no lleva a "casa".** Para un usuario logueado, tocar el logo saca de la app a la landing de marketing — un patrón que rompe la expectativa estándar ("logo = volver a mi inicio") y es, además, inconsistente con el propio menú de avatar, que sí tiene un ítem separado ("ir a mi dashboard") para llegar ahí. Dos caminos, ninguno obvio.
2. **Idioma duplicado.** Vive en 2 lugares distintos según estado de sesión (fila principal si no hay sesión, dentro del dropdown si la hay) — nunca conviven, pero tampoco hay una sola ubicación estable.
3. **Cero navegación de producto real.** A pesar de ser "el navbar", no tiene ningún link entre pantallas (dashboard ↔ plan ↔ mensajes) — la única forma de moverse entre ellas sin usar el botón atrás del navegador es el ítem dinámico único del menú de avatar. Es, en la práctica, una barra de cuenta/utilidades, no una barra de navegación.
4. **Todo compite por el mismo espacio horizontal**, con una lógica condicional pesada (auth/admin/premium/idioma/notificaciones/sync) que en mobile se resuelve angostando cada ítem a solo ícono — target táctil real de 36×40px, por debajo de las 44px recomendadas.
5. **Reachability en mobile.** La app se usa mayormente entrenando, con el teléfono en una mano — un nav fijo **arriba** obliga a estirar el pulgar a la zona más difícil de alcanzar en el "mapa de zonas de pulgar" de uso con una mano (Hoober et al.); ninguna acción de uso frecuente (ver plan de hoy, marcar una serie, chequear progreso) está en la zona cómoda.
6. **Viola la regla nueva de motion de producción (encontrada auditando, no introducida por esta propuesta).** Varios elementos del nav actual (`motion.div`/`motion.button` del pill de mensajes+calendario, campana/chat admin, botón de avatar) usan `initial={{ opacity: 0, ... }}` de framer-motion — exactamente el patrón que Lucas pidió prohibir hoy en producción (queda serializado en el HTML del build; si la hidratación no dispara, el contenido queda invisible). Esto **ya está en código real de cliente**, no en una demo — lo marco acá porque cualquier implementación nueva tiene que evitarlo, y de paso porque es un hallazgo que vale la pena que `frontend` revise en el archivo actual independientemente de esta reestructuración.

### 11.2 Vistas de cliente auditadas y qué necesita cada una

`Navbar.tsx` se monta hoy en: `create-plan.tsx`, `dashboard.tsx`, `plan.tsx`, `payment/{success,pending,failure}.tsx`, `legal/*.tsx` (6 páginas). **No** se monta en `formulario-de-inicio.tsx` (ni su variante `/en`) — correcto tal cual está: es un formulario público de una sola tarea, sin necesidad de chrome de navegación, y esta propuesta no le agrega nada. Tampoco existe hoy una pantalla de "perfil" dedicada — la cuenta (idioma, cerrar sesión) vive solo en el menú de avatar; lo que la propuesta llama "Cuenta" más abajo es la evolución de ese mismo menú, no una pantalla nueva.

- **`create-plan.tsx`** — flujo lineal de una sola tarea (completar datos → generar plan). No tiene destinos hermanos a los que navegar mientras se está en el medio del flujo.
- **`dashboard.tsx`** — pantalla "hub": progreso, racha, accesos al plan. Es el destino natural de "Inicio".
- **`plan.tsx`** — 5857 líneas, la pantalla de mayor uso real (rutina del día, registro de series, nutrición, calendario) — es donde más importa la alcanzabilidad con el pulgar.
- **`payment/*.tsx`, `legal/*.tsx`** — pantallas de una sola tarea o de solo lectura, fuera del "loop" diario de entrenar.

### 11.3 La decisión central: top bar en desktop, top bar mínima + tab bar inferior en mobile — no un horizontal único para todo

**Se abandona el navbar horizontal único como patrón universal.** Se separa por breakpoint, con una razón distinta para cada uno — no es la misma solución "escalada", son dos patrones con justificación propia:

- **Mobile (`< md`): tab bar inferior fija + top bar mínima.** Es el patrón estándar de las apps de fitness que se usan con el teléfono en la mano durante el entrenamiento (Strava, Hevy, Strong, Nike Training Club) precisamente porque resuelve el problema de alcanzabilidad del punto 11.1.5: la franja inferior de la pantalla es la zona de pulgar más cómoda en el agarre de una mano, y ahí es donde hoy no hay nada. Mover ahí Inicio/Mi plan/Mensajes/Cuenta pone exactamente las 4 cosas que se usan seguido donde el pulgar ya está.
- **Desktop (`md:` y arriba): se mantiene top bar horizontal, pero con navegación real.** El argumento de alcanzabilidad con el pulgar **no aplica** en desktop (mouse, no una mano sosteniendo el teléfono) — replicar la tab bar abajo en desktop no resolvería ningún problema real y rompería la convención de navegación web que cualquier usuario ya conoce (nav arriba). Aplicar el mismo criterio de fondo que ya usó `AdminShell` en §7.3-A (sidebar fijo en desktop, tira de pills abajo en mobile: mismo shell, forma distinta por breakpoint) — acá, mismo principio, forma más liviana porque el cliente tiene 3 destinos, no 7: no hace falta un sidebar completo, alcanza con la fila horizontal ya existente, decluttered y con links reales.

Esto también responde el punto 4 del encargo (reusar patrones ya definidos para el admin sin copiar el sidebar tal cual): se reutiliza el **criterio** (shell persistente, tratamiento de "activo" = `bg-accent/12 text-accent`, mismo que `AdminShell.tsx`), no la forma (el cliente no necesita 7 secciones ni un sidebar vertical).

### 11.4 Estructura propuesta

**A. Mobile — top bar mínima** (`fixed inset-x-0 top-0`, ~52px, mismo tratamiento visual que hoy: `bg-[color-mix(in_oklab,var(--background)_88%,transparent)] backdrop-blur-md border-b border-border`, respeta `env(safe-area-inset-top)`):
- Logo (ícono solo, sin wordmark, como ya es hoy en mobile) → **corrige el bug del punto 11.1.1**: siempre a la home real del usuario (`/dashboard` si tiene plan, `/create-plan` si no, `/admin` si es admin, `/` solo si no hay sesión).
- Con sesión + plan (tab bar visible, ver B): nada más acá — todo lo demás vive en la tab bar y su hoja de "Cuenta". Sin esto, el header quedaría vacío la mayor parte del tiempo, que es exactamente el objetivo: dejarle el espacio de trabajo a la pantalla.
- Sin sesión: idioma ES/EN + botón "Iniciar sesión" (igual que hoy).
- Con sesión pero sin plan todavía (`create-plan`, tab bar oculta): botón de cuenta (avatar) visible acá arriba, como único acceso a idioma/logout durante el flujo — no se le agrega una tab bar a un flujo de una sola tarea (mismo criterio que ya se aplicó, sin decirlo, al no montar `Navbar` en `formulario-de-inicio.tsx`: agregar navegación a un flujo lineal invita a abandonarlo a mitad de camino, no ayuda).

**B. Mobile — tab bar inferior** (`fixed inset-x-0 bottom-0`, no `sticky` — mismo motivo que el resto de la app; `bg-[color-mix(in_oklab,var(--background)_88%,transparent)] backdrop-blur-md border-t border-border`, `padding-bottom: env(safe-area-inset-bottom)`), **solo con sesión + plan** (o admin con plan personal — ver 11.5):
1. **Inicio** → `/dashboard`.
2. **Mi plan** → `/plan` (ícono con punto de aviso en `--warning` cuando hay "Pendiente sync" — reemplaza la pill propia que existe hoy, ver 11.1: el aviso vive donde se resuelve, no flotando aparte).
3. **Mensajes** → abre `UserMessagesModal` (cliente) o `MessagesModal` (admin, chat con todos los clientes) — mismo componente que ya existe, sin reimplementar. Badge de contador reusa `userMessagesCount`/`messagesCount` ya calculados.
4. **Cuenta** → abre una hoja inferior (`bottom sheet`, ancla natural: la propia tab bar) con lo que hoy vive en el dropdown de avatar + lo que en desktop pasa a la fila principal: idioma, "Pendiente sync" (detalle textual, además del punto en el ícono), notificaciones + chat admin si es admin, "Ver sitio" (mismo tratamiento visual secundario que ya definió `AdminShell.tsx` — `text-text-subtle`, ícono de salida), cerrar sesión.

Tratamiento de estado activo/inactivo idéntico al de `AdminShell.tsx`: activo = ícono+label en `--accent`; inactivo = `--text-muted`. Tap target mínimo 44×44 (hoy 36-40px en el nav actual — se corrige acá, es mi responsabilidad directa de accesibilidad).

**C. Desktop — top bar única, decluttered** (misma altura/fondo que hoy):
- Logo (ícono+wordmark) con la misma corrección de destino del punto A.
- Links inline: Inicio / Mi plan (o "Crear plan" si `!hasPlan`) / Mensajes — mismo tratamiento `bg-accent/12 text-accent` en el activo que `AdminShell`. **Esto es lo que hoy no existe en absoluto** (punto 11.1.3): la barra pasa a ser, por primera vez, navegación real.
- Cluster derecho: idioma ES/EN (**una sola ubicación, ya no duplicada** entre logged-in/logged-out — corrige 11.1.2), notificaciones+chat admin si es admin, pill "Pendiente sync" si aplica (hay espacio de sobra en desktop, se mantiene igual que hoy), botón de avatar → mismo dropdown de hoy pero recortado: sin idioma (ya está arriba) y sin el shortcut "ir a mi dashboard/panel" (ya redundante con el logo y los links inline) — queda solo estado premium/conectado + cerrar sesión.

**D. Legal y pago** (`legal/*.tsx`, `payment/*.tsx`): mantienen la top bar mínima (logo + idioma), **sin tab bar** en mobile — no son parte del loop diario de entrenar, y forzar navegación de producto sobre una pantalla de confirmación de pago agrega riesgo (alguien a mitad de un checkout tocando "Mi plan" por error) sin ningún beneficio.

### 11.5 Caso admin-como-cliente (Lucas usando su propio plan)

`isAdmin` no desaparece de este archivo: cuando el propio admin navega `/dashboard` o `/plan` para su entrenamiento personal (HYROX), sigue siendo un cliente más a efectos de este nav — usa la misma tab bar (Inicio/Mi plan/Mensajes/Cuenta), solo que "Mensajes" abre el chat con todos los clientes en vez del propio, y "Cuenta" suma notificaciones + chat admin (que hoy son 2 íconos sueltos en la fila principal, y acá se pliegan en la hoja para no ocupar espacio en un camino secundario — su superficie principal de trabajo sigue siendo `AdminShell`, esto es solo su uso personal de la app).

### 11.6 Motion y accesibilidad (mi responsabilidad directa)

- **Sin animación de entrada por opacidad en ningún elemento del chrome** (top bar, tab bar, íconos, botones) — corrige el punto 11.1.6, que ya está en producción y no debería repetirse acá. El chrome persistente aparece de inmediato, no se anima al montar.
- El único motion admitido es el que ya existe y es correcto: el "wiggle" (`scale`/`rotate` en loop) del ícono de mensajes cuando hay no leídos — es una animación de un elemento ya visible, no una entrada; se envuelve en `useReducedMotion()` (no lo está hoy, tampoco en el resto del nav — deuda ya señalada para el admin en §7.3-D, se extiende acá).
- La hoja de "Cuenta" (bottom sheet) puede animar posición (`y` desde abajo, con `useReducedMotion()` desactivándolo) — nunca opacidad desde 0, coherente con la regla nueva.
- Tap targets ≥44×44 en toda la tab bar (ver 11.4-B).
- `aria-current="page"` en el tab activo, `aria-label`/`title` en cada ícono de la tab bar y de la hoja de cuenta.

### 11.7 Qué no requirió tocar nada del árbol de tokens

Toda la propuesta se resuelve con tokens/clases ya existentes (`--accent`, `--surface`/`--surface-2`, `--warning`, `--text-muted`/`--text-subtle`, `.btn*`, `.badge*`, `env(safe-area-inset-*)`) y el mismo criterio de "activo" que ya aprobó `AdminShell.tsx`. No hay ninguna categoría de token nueva ni ningún asset de marca nuevo — el logo no se toca. Por eso esta sección no necesitó pasar por Lucas antes de proponerse.

### 11.8 Pendiente para `frontend` (implementación, fuera de esta entrega)

1. Dividir `Navbar.tsx`: separar el nav (top bar + tab bar) de los 2 modales que hoy exporta (`SendMessageModal`, `MessagesModal` — este último seguirá siendo importado por `AdminShell.tsx`, no cambia su contrato).
2. Construir la top bar mínima + tab bar de mobile (11.4-A/B) y la top bar decluttered de desktop (11.4-C), montadas en `dashboard.tsx`/`plan.tsx`/`create-plan.tsx` según 11.4/11.5; `legal/*`/`payment/*` según 11.4-D.
3. Corregir el destino del logo (11.4-A/C) — este punto es independiente del resto y podría salir primero, es una corrección de bug de 1 línea de lógica.
4. Aplicar `useReducedMotion()` al wiggle de mensajes y quitar los `initial={{opacity:0,...}}` del nav actual (11.1.6/11.6) — válido incluso si el resto de esta reestructuración se implementa después.
5. Agregar el padding inferior (`env(safe-area-inset-bottom)` + alto de la tab bar) a `dashboard.tsx`/`plan.tsx`/`create-plan.tsx` para que el último elemento de cada pantalla no quede tapado por la tab bar fija en mobile (ver spacer de referencia en la demo).
6. Implementar el mecanismo de coexistencia entre `CookieConsentBanner` y la tab bar fija en mobile — ver 11.9 (hallazgo posterior a la propuesta original, con decisión y mecanismo ya definidos, nada pendiente de mi parte).

Demo de referencia (no implementación real, datos/estado simulados): `src/pages/client-navbar-preview.tsx` → `/client-navbar-preview` (toggle de estado arriba: sin sesión / cliente sin plan / cliente con plan / admin con plan propio, más checkboxes de mensajes sin leer / pendiente sync / premium / banner de cookies visible — este último para verificar el mecanismo de 11.9).

### 11.9 Hallazgo posterior: el banner de cookies tapa la tab bar en mobile (resuelto)

Reportado al revisar la demo a 430px: `CookieConsentBanner` (montado globalmente desde `_app.tsx`, sin excluir rutas de cliente ni admin — línea 214) y la tab bar de 11.4-B son ambos `fixed`/`bottom-0`. El banner (`z-[11000]`) queda por encima y **tapa por completo** Inicio/Mi plan/Mensajes/Cuenta. No es un artefacto de la demo: cualquier usuario nuevo en mobile va a tener la navegación tapada en su primera sesión — justo cuando más la necesita para orientarse — hasta que decida sobre las cookies.

**Restricción de partida, no negociable:** el banner no es decorativo, es de cumplimiento legal (GA4/Meta Pixel/TikTok Pixel dependen de esa decisión) — no se puede ocultar, recortar contenido, ni darle menos jerarquía visual a "Solo esenciales" que a "Aceptar todo".

**Opciones consideradas y descartadas:**
- *Ocultar la tab bar mientras el banner esté visible:* deja al usuario nuevo sin forma de navegar en el momento exacto en que más la necesita — cambia un problema visual por uno funcional, peor.
- *Banner más compacto en mobile:* no resuelve la superposición en sí (seguiría compitiendo por el mismo carril si no cambia de posición), y el banner ya es razonablemente compacto (título + 1 párrafo + 2 botones) — recortarlo más arriesga legibilidad sin resolver la causa real.

**Decisión: el banner se apila arriba de la tab bar, nunca se superpone.** En mobile, cuando hay una barra de navegación fija al fondo (la tab bar de cliente de esta propuesta, o la tira de pills de `AdminShell.tsx`, que tiene exactamente el mismo problema — ver nota abajo), el banner sube su posición para dejarla completamente visible debajo. Ambas funciones — decidir sobre cookies y navegar — quedan disponibles al mismo tiempo, sin comprometer ninguna. El costo (el banner ocupa más alto temporalmente y puede tapar parcialmente el contenido scrolleable de la página, no la navegación) es aceptable: aparece una sola vez por usuario y desaparece en cuanto se toca cualquiera de los dos botones.

**Mecanismo (para `frontend`, CSS puro, sin categoría de token nueva):**
- Cada componente que monta una barra fija al fondo en mobile (`<ClientTabBar>` de esta propuesta, y la tira de pills de `AdminShell.tsx` ~línea 351, que **hoy tiene el mismo bug** porque `CookieConsentBanner` tampoco excluye rutas `/admin/*`) agrega, mientras está montado, la clase `has-bottom-nav` a `document.body` en un `useEffect` (con cleanup al desmontar) — mismo patrón que ya usa el propio `CookieConsentBanner` para leer estado externo al montar.
- Nueva regla en `globals.css`:
  ```css
  @media (max-width: 767px) {
    body.has-bottom-nav .cookie-consent-banner {
      bottom: calc(64px + env(safe-area-inset-bottom));
    }
  }
  ```
- `CookieConsentBanner.tsx` agrega la clase `cookie-consent-banner` a su `<div>` raíz (hoy solo tiene utilities, sin ningún gancho) para que la regla de arriba lo alcance sin acoplarlo al layout que lo rodea.
- `64px` es una altura conservadora que cubre ambas barras (tab bar de cliente ~60px, tira de pills del admin ~56-60px); `frontend` puede ajustarla una vez las mida en el DOM real — no hace falta que coincida al pixel, solo que alcance para no tapar ningún ítem.
- Desktop (`md:` y superior) no cambia: ninguna de las dos barras existe ahí.
- Mobile sin barra inferior (`create-plan` sin plan, `legal/*`, `payment/*`, y cualquier vista `/admin/*` — hoy no aplica porque el admin usa `AdminShell` en todas sus rutas, pero el mecanismo ya lo cubre igual): `has-bottom-nav` nunca se agrega, el banner se queda en `bottom-0` como hoy.

## 12. El bug del `overflow-x: hidden` global — causa raíz corregida, restricción eliminada

Este bug causó **tres incidentes distintos** en producción a lo largo del tiempo. Quedaba documentado en varios comentarios sueltos del código como "bug conocido" a esquivar (`AdminShell.tsx`, `client-navbar-preview.tsx`, §11.1/§11.4 más arriba); esta sección es el post-mortem y el estado final.

**La cadena completa:**

1. `.btn` (§2) tenía `display: inline-flex` sin `max-width` ni `min-width: 0`. El texto de un botón es, dentro de ese `inline-flex`, un flex item con `min-width: auto` implícito — sin un `max-width` que fuerce al botón a encogerse, el flex item nunca tiene motivo para wrappear, y el botón crece a `max-content`. Con un label largo (ej. "Copiar enlace del formulario", en `AdminApp.tsx`) eso empuja el ancho del `<html>` entero en pantallas chicas.
2. Para tapar ese síntoma se agregó `overflow-x: hidden; max-width: 100vw` en `html` y en `body` (`globals.css`).
3. Ese `overflow-x: hidden` en `html` lo convierte en scroll container (el spec computa `overflow-y: auto` cuando un solo eje no es `visible`), y eso rompía dos cosas más: **`position: sticky`** (el sidebar del admin no quedaba fijo al viewport — se esquivó migrando a `position: fixed`, que sí funciona bien y **no se revirtió**, no había motivo) y el **`IntersectionObserver`** (los `whileInView` de framer-motion de la landing no disparaban contra el viewport real, la landing pública salió en blanco en producción).

**Fix aplicado (`globals.css`):**
- `.btn` ahora tiene `max-width: 100%; min-width: 0`. Un botón con texto largo se limita al ancho de su contenedor y el texto wrappea a más de una línea en vez de desbordar.
- Se eliminó `overflow-x: hidden` y `max-width: 100vw` de `html` y de `body`. **No reponer este parche si vuelve a aparecer un desborde horizontal** — el origen real casi siempre va a ser un elemento con ancho implícito `max-content` sin `max-width`/`min-width: 0` (como era el caso de `.btn`), no algo que se resuelva ocultando el eje X del documento entero.

**Segundo origen encontrado al verificar (mismo bug, otro disparador — `_app.tsx`):** con el parche de `html`/`body` ya sacado, `/legal/disclaimer` y `/legal/liability` seguían desbordando 3px a 320px. Causa distinta a la de `.btn`, pero de la misma familia: el wrapper raíz de `_app.tsx` es `flex flex-col`, y **cada página es, por lo tanto, un flex item de ese contenedor** (`<Component {...pageProps} />` se renderiza como hijo directo, `AppLocaleProvider` no agrega nodo propio). Cuando la página usa el patrón común `max-w-* mx-auto` en su elemento raíz (ej. `legal/*.tsx`), los márgenes cruzados en `auto` desactivan `align-items: stretch` (regla del spec de flexbox: stretch solo aplica si *ninguno* de los márgenes del eje cruzado es `auto`) — en vez de ocupar el ancho disponible y envolver texto como haría un bloque normal, el item se dimensiona a su `max-content` (como si el texto nunca pudiera envolver), y en pantallas angostas con un heading largo (ej. "Descargo de Responsabilidad Médica" en `text-4xl font-bold`) eso desborda el documento. Fix: `[&>*]:min-w-0 [&>*]:w-full` en el wrapper de `_app.tsx` — `w-full` es el que resuelve esto (da un ancho definido, así que el caso especial de flexbox no aplica y el contenido vuelve a envolver); `min-w-0` es defensa adicional contra el `min-width: auto` implícito de flex items. Ver comentario en `src/pages/_app.tsx` línea ~209.

**Verificación:** con `npm run build && npm run start` (los incidentes anteriores de esta familia no se reproducían en `npm run dev`, solo en build de producción), chequeando `document.documentElement.scrollWidth <= window.innerWidth` en landing (`/`, `/en`), `/create-plan`, `/formulario-de-inicio`, `/dashboard`, `/plan`, `/design-preview`, `/admin-design-preview`, `/client-navbar-preview`, `/payment/success` y las 7 `legal/*`, a 320px/390px/430px (51 combinaciones): sin desborde horizontal en ninguna, incluyendo las dos que fallaban antes del segundo fix.

Confirmado que se desbloqueó lo que el parche rompía: `position: sticky` vuelve a posicionarse contra el viewport (verificado en `admin-design-preview.tsx`: el sidebar pasa de su posición estática a `top: 0` al scrollear, comportamiento correcto), y los `whileInView` (`adminMotion.ts`, `admin-design-preview.tsx`) vuelven a resolver `opacity: 1` al entrar en viewport vía `IntersectionObserver`. `html`/`body` quedaron con `overflow: visible` (el default real del navegador), confirmando que ya no son scroll containers artificiales.

**Restricción aparte, no relacionada con `overflow-x` pero igual de no-negociable:** no usar `initial: { opacity: 0 }` de framer-motion en contenido que se pinta sin interacción del usuario (hero, tarjetas de landing, cualquier cosa presente en el HTML servido por SSR). En build de producción ese estado inicial se serializa en el HTML del servidor; si la hidratación no llega a disparar la animación, el contenido queda invisible para siempre — es justo lo que rompió la landing la segunda vez. Animar solo posición (`y`, `x`, `scale`) o hacerlo con CSS puro (`@keyframes` + `prefers-reduced-motion`). Este patrón sigue vivo hoy en código de cliente real fuera de esta corrección — ver §11.1 punto 6 y §11.8 punto 4 (`Navbar.tsx`, pendiente de implementación de §11) — no se tocó acá por estar fuera del alcance de este fix, que es específicamente el de `overflow-x`.

**No hace falta pedirle nada a `diseño` para este fix**: no cambia ningún token, color, ni patrón visual — es una corrección de layout puro sobre reglas ya existentes.

## 13. Dashboard de cliente — reestructuración (decisión de `diseño`, fase de definición)

Encargo de Lucas: reestructurar `src/pages/dashboard.tsx` y `src/components/dashboard/DashboardPlanCard.tsx`, **más los modales que abre** — nombrados explícitamente: "muchas cards juntas que no tenían sentido... incluidas las tablas y los modals". Partir de cero la organización de la información, no envolver la estructura vieja en el marco nuevo (antecedente del admin: primera pasada rechazada por hacer justo eso). Esta sección es la spec; **no implementada todavía**. Demo en `/dashboard-design-preview` (mismo patrón que `/design-preview`, `/admin-design-preview`, `/client-navbar-preview`), verificada con Chrome headless a 1440×900 y 390×844.

### 13.1 Diagnóstico: qué hace hoy el dashboard y dónde está el desorden

Auditados `dashboard.tsx` (1839 líneas, incluye el modal de progreso inline) y `DashboardPlanCard.tsx` (368 líneas), más `PremiumPlanModal.tsx` y `PlanContinuityModal.tsx` (los 2 modales "pesados" que abre, además de los 3 de confirmación/aviso ya inline en `dashboard.tsx`).

**A. El header compite consigo mismo antes de mostrar nada del plan.** Antes de llegar a un solo dato del plan del usuario, la pantalla apila: saludo + subtítulo → botón "Contactar entrenador" o "Pedir entrenador personal" → aviso de entrenador asignado (condicional) → botón "Hazte premium" → botón "Nuevo plan" (o su versión deshabilitada con tooltip). Son hasta 3 CTAs de temas distintos (soporte humano, upsell, gestión de planes) en la misma fila visual, todos con el mismo peso, antes de que aparezca una sola tarjeta de plan. En mobile esto empuja el contenido real varias pantallas hacia abajo.

**B. `DashboardPlanCard` es una tarjeta que intenta ser 7 cosas a la vez.** Por tarjeta: título + fecha, 2 botones de acción (progreso/eliminar), badge de fase, badge de dificultad, caja "de un vistazo" con objetivo/peso/calorías, aviso de lesiones adaptadas, bloque de progreso (simple o multi-fase con 2 barras), y footer "click para abrir". Ocho bloques de información con el mismo peso visual, repetidos sin jerarquía interna — y ese mismo tratamiento "todo incluido" se repite en una grilla para **cada** plan que tenga el usuario (hasta 20). Es exactamente "muchas cards juntas que no tenían sentido y ocupaban lugar": un usuario premium con 3-4 planes ve 3-4 tarjetas igual de densas compitiendo por atención, sin que quede claro cuál es el plan que está usando hoy.

**C. No hay jerarquía entre "mi plan activo" y "mis planes anteriores".** El grid trata todos los planes igual (mismo tamaño de tarjeta, mismo detalle), cuando en la práctica hay uno solo relevante para "qué hago hoy" y el resto es historial. Esto es la causa raíz de B, no solo sobredimensión de la tarjeta.

**D. El modal de progreso duplica su propio dato.** Muestra un anillo grande con el % de avance del plan, y al lado 2 cajas más ("Peso inicial", "% del plan") donde la segunda repite el número que ya está en el centro del anillo. Debajo, formulario de carga de peso + historial de registros, y a la derecha (en desktop) un gráfico de barras con los últimos 6 registros — funcionalmente correcto, pero con una caja de información redundante que no aporta nada nuevo.

**E. `PremiumPlanModal.tsx` tiene una tabla HTML real** (`<table>`, línea 403) para comparar planes — lo que Lucas nombró explícitamente como "las tablas" a sacar. Vive arriba de una grilla de tarjetas de planes que sí sigue un patrón correcto (`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`) — la tabla es información redundante con esas tarjetas, no complementaria.

**F. `PlanContinuityModal.tsx` es una sucesión de tarjetas-dentro-de-tarjetas.** Cada grupo de 2 campos relacionados (`grid grid-cols-1 sm:grid-cols-2`) vive en su propia caja `rounded-2xl border`, y esas cajas se apilan una tras otra durante todo el wizard — mismo síntoma que B pero en formato formulario en vez de tarjeta de resumen.

**G. El chrome de los modales no es consistente entre sí.** Los 6 modales que vive dentro de este alcance (eliminar plan, progreso, premium expirado, continuidad, entrenador personal, y los internos de confirmación) usan cada uno su propia combinación de `border`/`shadow`/`color-mix` de fondo, ligeramente distinta entre sí — ninguno reutiliza literalmente el mismo backdrop/panel que otro. No es un problema de tokens (todos usan tokens válidos), es falta de un patrón de "shell de modal" único, igual que el problema que tenían los headers del admin antes de §7.3-B.

**H. Viola la regla nueva de motion.** `dashboard.tsx` usa `initial={{ opacity: 0, ... }}` en el `motion.div` del contenido principal (línea 419) y en **todos** los backdrops/paneles de sus 5 modales inline — el mismo patrón que ya rompió la landing dos veces y que se prohibió hoy. `DashboardPlanCard.tsx` también lo usa en su propio `motion.div` (línea 85) y en el botón "Preparar continuidad" (línea 259). Esto hay que corregirlo exista o no la reestructuración completa.

### 13.2 La decisión central: qué ve primero el usuario, y por qué

El dashboard hoy se organiza como **un gestor de planes** (una grilla igual de densa para todos los planes que el usuario tenga). Pero el caso de uso real, la mayoría de las veces que alguien abre `/dashboard`, es **"¿cómo va mi plan activo y cómo entro a entrenar hoy"** — no "quiero comparar mis 4 planes". Con `Navbar.tsx` ya rediseñado en §11 como hub de navegación (dashboard = "Inicio"), el dashboard no necesita seguir cargando con toda la responsabilidad de gestión de planes con el mismo peso que la de mostrar el estado actual.

**Jerarquía elegida, de mayor a menor prioridad:**
1. **Plan activo** — el más reciente no completado (o el único, para el ~80% de usuarios que tiene uno solo). Tratamiento de "hero": nombre, fase/progreso, y **un solo** CTA primario ("Ver mi plan" → `/plan`, que es donde realmente se entrena/registra). Es la respuesta directa a "qué hago hoy".
2. **Acciones rápidas ligadas al plan activo** — registrar peso, ver progreso detallado. Ligadas visualmente al hero, no sueltas en el header.
3. **Otros planes** (si hay más de uno — típicamente solo premium) — lista compacta, no tarjetas completas. Es historial de referencia, no la tarea principal.
4. **Todo lo demás** (upsell a premium, entrenador personal) — existe y sigue siendo accesible, pero dejó de competir por el primer scroll. Baja de "3 botones en el header" a una franja/tarjeta secundaria, después del contenido real.

No agrego métricas nuevas (ej. "racha") que no existen hoy en el modelo de datos — la spec trabaja solo con lo que `dashboard.tsx` ya calcula (`calculateProgress`, `calculateDaysRemaining`, fase de `planMultiFase`, `registrosPeso`). Si en el futuro se quiere una métrica de racha/adherencia real, es una decisión de `producto` (qué se mide, con qué datos), no de esta pasada de diseño.

### 13.3 Desktop y mobile como problemas distintos

**Mobile (`< lg`): una sola columna, orden por prioridad, scroll vertical.** Es la superficie de "estoy entrenando con el teléfono en una mano" (mismo criterio que §11.3) — no hay espacio para dos ejes a la vez, así que el orden vertical *es* la jerarquía:
1. Header mínimo (saludo corto, sin CTAs compitiendo).
2. Tarjeta del plan activo (hero compacto: fase/progreso + 1 CTA ancho "Ver mi plan").
3. Fila de 2 acciones rápidas, iconos grandes (≥44×44 tap target): "Progreso" / "Registrar peso".
4. Lista compacta de otros planes (si hay) — filas, no tarjetas.
5. Franja de upsell premium (si `!isPremium`) — al final, no al principio.
6. Enlace secundario a entrenador personal (texto/link, no botón destacado) — dentro de la franja de arriba o justo debajo, no en el header.
7. **Padding inferior reservado** (`pb-24` o equivalente + `env(safe-area-inset-bottom)`) para la tab bar fija de §11 — el último elemento (franja de upsell) no debe quedar tapado.

**Desktop (`lg:` y arriba): hero + sidebar, dos ejes a la vez.** Hay espacio real, así que no hace falta apilar todo verticalmente como en mobile — mismo criterio que ya usó `AdminShell` (§7.3-A) y el navbar de cliente (§11.3): mismo principio (contenido principal + carril secundario), forma propia porque acá el carril secundario es 3 tarjetas de acción, no una lista de navegación.
- **Columna principal (`~2/3`, ej. `lg:grid-cols-[1fr_320px]`):** tarjeta hero del plan activo (más espaciosa que en mobile: progreso + fase + stats inline en una fila, no apilados) y, debajo, la lista compacta de "otros planes" como filas de `.card-surface` (título/fecha/fase/progreso/chevron) — nunca un `<table>` real (mismo criterio que ya se fijó para el admin en §7.3-C: filas en desktop, tarjetas en mobile, sin marcado de tabla en ningún caso).
- **Columna lateral (`~320px`):** 3 tarjetas cortas y del mismo tamaño entre sí — "Hazte premium" (si aplica), "Registrar peso" (input inline + botón, sin abrir modal para el caso rápido), "Entrenador personal". Aprovecha el ancho que mobile no tiene para sacar estas 3 cosas del flujo principal sin eliminarlas.

### 13.4 Modales — qué cambia en cada uno

**A. Modal de progreso (dentro de `dashboard.tsx`) — se consolida, no se reduce en función.**
- Anillo de progreso se mantiene (es el elemento más claro de toda la pantalla), pero al lado va **una sola** caja de estado: "Peso inicial → peso actual (Δ)" — se elimina la caja "% del plan" que repetía el número del centro del anillo.
- Formulario de carga + historial de registros + gráfico de barras se mantienen tal cual están funcionalmente (ya es un patrón correcto, 2 columnas en desktop / 1 en mobile) — el problema acá era solo la caja redundante, no la estructura.

**B. `PremiumPlanModal.tsx` — se elimina la tabla, no se resume la información.**
- La tabla HTML de comparación (línea 403) se reemplaza reusando el mismo patrón ya aprobado para el admin en §7.3-C: en desktop, filas compactas dentro de un único `.card-surface` (una fila por característica, con 3 columnas de check/valor por plan); en mobile, cada plan se convierte en una tarjeta apilada con su propia lista de características. Ninguna característica se pierde, cambia el marcado, no el contenido — igual que se hizo con las tablas de clientes del admin.
- La grilla de tarjetas de planes (`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`, línea 450) ya sigue un patrón correcto — no se toca.

**C. `PlanContinuityModal.tsx` — se consolidan las cajas, no se recorta el wizard.**
- Los grupos de campos que hoy viven cada uno en su propio `rounded-2xl border` (líneas 369, 394, 423 y siguientes) se agrupan bajo **un** contenedor `.card-surface` por paso del wizard, con separadores internos (`border-t border-border` entre grupos) en vez de una caja nueva por grupo. Mismo contenido, menos cajas anidadas — el ojo deja de leer "5 tarjetas" donde en realidad hay un solo formulario con 5 secciones.

**D. Shell de modal único (nuevo patrón para `frontend`, sin tokens nuevos).**
Los 6 modales de este alcance pasan a compartir **un** recipe de backdrop y panel en vez de que cada uno arme el suyo: backdrop `bg-black/75 backdrop-blur-md` fijo, panel `rounded-2xl border border-border bg-[color-mix(in_oklab,var(--background)_88%,#0a0f18)] shadow-[0_40px_100px_-36px_rgba(0,0,0,0.9)] ring-1 ring-[color-mix(in_oklab,var(--foreground)_5%,transparent)]` — son los valores que ya usa el modal de progreso hoy (el más nuevo/completo de los 6), se propone como el estándar y el resto converge a él en vez de mantener 6 variantes ligeramente distintas. No es una clase nueva de `globals.css` obligatoria (se puede resolver como constante compartida en TS), pero si `frontend` prefiere una clase (`.modal-backdrop`/`.modal-panel`) para no repetir el string, es un ajuste dentro de una categoría ya existente (composición de tokens ya aprobados), no requiere mi aprobación previa ni la de Lucas.

### 13.5 Los gradientes — diagnóstico y alternativa propuesta (pendiente de aprobación de Lucas)

Lucas marcó los gradientes del dashboard como el punto a revisar, aclarando que el coral/magenta **sí** es parte del gradiente de marca aprobado (`--brand-start/mid/end`, lima→coral→magenta) pero no le gusta cómo se ve acá, y pidió una alternativa más cercana al lima y al negro de marca.

**Dónde está el gradiente de marca hoy en el dashboard, y por qué una parte funciona y otra no:**
- **Barras de progreso** (`DashboardPlanCard.tsx`, líneas 248 y 360): franjas finas con el gradiente de 3 colores. Este es exactamente el uso documentado en §1 ("Gradiente ambiental de fondo... **barras de progreso**") — no es el problema, no se toca.
- **Botones CTA a página completa** (`dashboard.tsx`, líneas 489, 519, 545, 792, 933, 1610 — "Hazte premium", "Nuevo plan", "Ver planes premium", "Sí, quiero", "Guardar" de peso): el gradiente cubre el botón entero a opacidad alta. Acá sí se lee el tramo coral→magenta como "rojo/rosa" — es un área grande y sólida, no una franja fina de fondo.
- **Acentos decorativos sueltos con `--brand-end` (magenta) solo, sin el resto del gradiente**, a 10-15% de opacidad (líneas 443, 471-472, 848, 875, 881): botón "Contactar entrenador", aviso de entrenador asignado, badges del selector de género del modal de entrenador. Ninguno de estos representa una marca/hero real — son decoración sin significado de estado, elegida con el mismo criterio suelto que §6 ya identificó y resolvió en el admin ("si es puramente decorativo, sin marca ni estado real → sin color de marca").

**Propuesta (2 partes, distinto nivel de decisión cada una):**

1. **Los acentos decorativos sueltos de `--brand-end`: se resuelven ya, sin esperar aprobación** — es la misma regla de §6 ya aprobada, aplicada acá: decorativo sin estado real → `.card-surface-2`/`.btn-secondary`/`--accent` (lima), no un tono de marca aislado. Esto saca el "rosa/rojo suelto" que aparece en el botón de WhatsApp del entrenador y en los badges de género sin que haga falta ninguna decisión de paleta nueva.

2. **Los botones CTA a página completa: acá sí hace falta una decisión de Lucas**, porque implica dejar de usar el gradiente de marca de 3 colores como fondo de botón en esta pantalla — es tocar cómo se ve la marca, no un ajuste dentro de una categoría ya resuelta. Propongo, construido enteramente con tokens **ya existentes** (no requiere ninguna categoría nueva en el árbol, solo una combinación distinta):
   - **Opción A — recomendada:** los CTA del dashboard dejan de llevar gradiente y pasan a `.btn-primary` (lima sólido `--accent`, hover `--accent-strong`) — la misma clase que ya usa el resto de botones primarios de la app. Es la opción más simple, cero riesgo de "rojo", y es literalmente lo que ya está aprobado y en uso en todos lados menos acá.
   - **Opción B — alternativa, si se quiere mantener un CTA "premium" con más presencia que un botón estándar:** un gradiente de 2 tonos lima→negro, solo para el botón de upsell premium (no para el resto): `linear-gradient(135deg, var(--accent) 0%, color-mix(in oklab, var(--accent-strong) 45%, var(--background)) 100%)` — arranca en el lima de marca y se apaga hacia el negro de fondo, sin pasar por coral ni magenta en ningún punto. El resto de los CTA (Nuevo plan, Guardar peso, Sí quiero) usan `.btn-primary` igual que en la Opción A.

   Ambas están montadas en la demo con un selector para que Lucas las compare una al lado de la otra antes de decidir. **No se implementa ninguna de las dos en el código real hasta que elija.**

### 13.6 Coordinación con §11 (navbar de cliente)

El dashboard se diseñó asumiendo que la tab bar inferior de §11.4-B ya existe en mobile: se reserva `pb-24` (o el alto real que mida `frontend`) + `env(safe-area-inset-bottom)` al final del contenido, mismo mecanismo ya pedido en §11.8 punto 5 — este dashboard es uno de los casos concretos que necesita ese espaciador. No hace falta ajustar nada de §11 a la luz de esta spec: la tab bar (Inicio/Mi plan/Mensajes/Cuenta) y la jerarquía nueva del dashboard son compatibles tal cual — "Ver mi plan" del hero y "Mi plan" de la tab bar llevan al mismo destino (`/plan`), sin duplicar navegación.

### 13.7 Motion y accesibilidad (mi responsabilidad directa)

- Corregir los `initial={{ opacity: 0, ... }}` señalados en 13.1-H (`dashboard.tsx` línea 419 y los 5 backdrops/paneles de modales; `DashboardPlanCard.tsx` líneas 85 y 259) — animar posición (`y`) o usar CSS, nunca opacidad desde 0, misma regla que §11.6/§12. Válido incluso si el resto de la reestructuración se implementa después.
- Los CTA de acción rápida (registrar peso, ver plan) mantienen tap targets ≥44×44 en mobile.
- El anillo de progreso del modal ya comunica el % con texto (`{pct}%`) además de color — no depende solo del color para transmitir el dato, se mantiene así.

### 13.8 Qué no requirió tocar nada del árbol de tokens

Toda la reestructuración (13.2-13.4, y la Opción A de 13.5) usa tokens/clases ya existentes (`--accent`, `--accent-strong`, `--surface`/`--surface-2`, `.btn-primary`, `.card-surface`, `--brand-start/mid/end` en su uso ya aprobado de barras de progreso). La Opción B de 13.5 tampoco crea una categoría nueva (es una combinación de `--accent`/`--accent-strong`/`--background` vía `color-mix`), pero se marca igual como pendiente de Lucas porque cambia un tratamiento de marca visible, no porque falte un token.

### 13.9 Pendiente para `frontend` (implementación, fuera de esta entrega)

1. Reestructurar `dashboard.tsx` según 13.2-13.3: header corto, hero de plan activo + acciones rápidas, lista compacta de otros planes, franja de upsell al final — layout de una columna en mobile, `hero + sidebar` en desktop.
2. Simplificar `DashboardPlanCard.tsx` en 2 variantes según su rol: hero del plan activo (más completo) y fila compacta para "otros planes" (mínima) — hoy es un solo componente "todo incluido" que se usa igual en ambos casos.
3. Consolidar el modal de progreso según 13.4-A (quitar la caja redundante).
4. Reemplazar la tabla de `PremiumPlanModal.tsx` por el patrón fila-desktop/tarjeta-mobile de 13.4-B.
5. Consolidar las cajas anidadas de `PlanContinuityModal.tsx` según 13.4-C.
6. Adoptar el shell de modal único de 13.4-D en los 6 modales del alcance.
7. Aplicar la decisión de Lucas sobre 13.5 (Opción A o B) a los CTA reales, y resolver ya los acentos decorativos sueltos de `--brand-end` (13.5 punto 1) sin esperar esa decisión.
8. Corregir los `initial={{opacity:0}}` de 13.7.
9. Reservar el padding inferior de 13.6 una vez `frontend` mida la altura real de la tab bar de §11.

Demo de referencia (no implementación real, datos hardcodeados): `src/pages/dashboard-design-preview.tsx` → `/dashboard-design-preview` (controles arriba: cantidad de planes, plan simple/multi-fase, premium sí/no, abrir modal de progreso rediseñado, y el selector de Opción A/B del gradiente para que Lucas decida).

## 13.10 Dashboard de cliente — revisión post-deploy (Lucas rechaza la v1 ya implementada)

`frontend` implementó §13.1-13.9 completo (commit `4948acd`, incluida la Opción A de §13.5 — CTAs a `.btn-primary` sólido, aprobada) y quedó en producción. Lucas lo revisó ya deployado y no quedó conforme: *"hay muchos colores, no se entiende muy bien... si tienes que rediseñar y reestructurar todo hazlo... una barra de progreso se vea en verde por ejemplo y no colores que no tienen sentido... que no hayan botones por haber"*. Autorizó explícitamente rediseñar todo de nuevo si hacía falta.

### 13.10.1 Diagnóstico: auditado el código real (`dashboard.tsx`, `DashboardPlanHero.tsx`, `DashboardPlanRow.tsx`), no la demo

Antes de rediseñar de cero, se auditó lo que realmente está en producción — la reestructuración de v1 (header corto, hero + sidebar, shell de modal único, sin tabla HTML, sin cajas anidadas) está bien implementada y sigue la spec al pixel. El "se ve recargado" no viene de la estructura, viene de **dos causas puntuales y corregibles**, no de un problema de fondo que justifique tirar todo:

**A. La barra de progreso lineal del hero (`DashboardPlanHero.tsx`, bajo el título) usa el gradiente de marca de 3 colores** (`linear-gradient(90deg, var(--brand-start), var(--brand-mid), var(--brand-end))` — lima→coral→magenta), **al lado de un anillo de progreso que usa `--accent` sólido para el mismo número.** Es exactamente el ejemplo que dio Lucas: una barra de progreso debería leerse en un solo color con sentido, no un arcoíris de marca. Dos representaciones visuales distintas del mismo dato, con dos lenguajes de color distintos, en la misma tarjeta — eso es lo que más "compite" en la pantalla, no la cantidad de elementos.

**B. El botón móvil "Registrar peso" de "Acciones rápidas" no registra nada propio.** Abre exactamente el mismo modal que el botón "Progreso" de al lado (`setPlanForProgress(activePlan); setProgressModalOpen(true)`, línea por línea idéntico al handler del otro botón) — no hace scroll ni foco al formulario de peso dentro del modal, así que tampoco cumple lo que promete su label. Es, textual, "un botón por haber": dos botones, un solo comportamiento. (La sidebar de desktop, en cambio, sí tiene una carga de peso inline real, sin abrir modal — ahí no hay problema.)

Con la regla de color de §13.10.2 aplicada solo a estos dos puntos, el resto del dashboard ya cumple: header sin CTAs compitiendo, semánticos (`--success`/`--warning`/`--danger`/`--info`) usados correctamente (aviso de entrenador asignado, error, ícono de plan free vencido, badge "Soporte humano"), badges de fase con un solo tono por vez, `--accent` como único color de interacción/selección. No hay 1.800 usos sueltos que limpiar acá como en el rollout original — hay dos elementos concretos mal resueltos.

### 13.10.2 La regla de color (para toda la pantalla, no solo estos dos puntos — revisada en §13.10.9 con el techo de 3 de Lucas)

**Si un elemento comunica un estado del usuario (progreso, fase, alerta, error, éxito) usa un token semántico de un solo tono. Si es decorativo (no representa ningún dato), puede usar el gradiente de marca, pero solo en un área chica y no competitiva — nunca del tamaño de un botón o una barra que el usuario está leyendo activamente.**

Aplicado al dashboard:
- **Progreso** (ring + barra) → `--accent` sólido, un solo tono para los dos widgets que muestran el mismo %. Antes la barra usaba el gradiente de marca; ahora coincide con el anillo.
- **Fase del plan** (badge) → `--phase-bulk/cut/lean-bulk/maintenance`, ya semántico, sin cambios (ver §13.10.4 — se evaluó sacarlo y se decide mantenerlo).
- **Confirmaciones/errores/avisos** → `--success`/`--danger`/`--warning`/`--info`, ya así, sin cambios.
- **CTAs e interacción** → `--accent` (`.btn-primary`/`.btn-secondary`), ya así desde la Opción A aprobada.
- **Gradiente de marca** (`--brand-start/mid/end`) → queda en **un solo lugar de toda la pantalla**: la línea decorativa de 1.5px arriba de la tarjeta del plan activo. No lleva ningún dato, es pura marca — "esta es la tarjeta importante". Es el único punto de la vista donde sobrevive, y solo porque es una franja fina, no un área que compita por lectura. Los washes radiales de fondo muy sutiles (`opacity 0.4-0.5`) detrás del modal de progreso y del modal de plan free vencido se mantienen por el mismo motivo (ambientales, detrás del texto, no leídos como dato).

Esto no es una categoría de token nueva ni cambia dónde vive el gradiente de marca en el resto de la app (fuera del alcance de esta sección) — es aplicar, dentro del dashboard, la regla que el propio §1 ya documentaba ("barras de progreso" como uso aprobado del gradiente) de forma más estricta de lo que estaba escrito: una barra de progreso es exactamente el tipo de elemento que **sí** comunica un dato, así que no debería haber estado en esa lista para empezar. Se corrige la nota de §1 más abajo (13.10.5).

### 13.10.3 Auditoría botón por botón (`dashboard.tsx` + los 3 componentes de hero/fila/sidebar)

| Botón/acción | Veredicto | Motivo |
|---|---|---|
| Hero: "Ver mi plan" (primario) | Gana su lugar | Único CTA primario, lleva a donde se entrena de verdad |
| Hero: "Preparar continuidad" (`.btn-success`, solo si `pct≥90`) | Gana su lugar | Condicional a un estado real (plan por terminar); verde correcto, es una acción positiva de cierre |
| Hero: "Progreso" (`.btn-secondary`, solo desktop) | Gana su lugar | Acción distinta de "Ver mi plan", sin duplicar nada |
| Mobile "Acciones rápidas" → "Progreso" | Gana su lugar | Igual que arriba, versión mobile |
| Mobile "Acciones rápidas" → "Registrar peso" | **Se corrige, no se saca** | Duplicaba la acción de "Progreso" (13.10.1-B) sin cumplir su propio label — se convierte en carga inline (ver 13.10.4), no en un modal más |
| "Otros planes" → "Nuevo plan" (`.btn-secondary`, solo si premium) | Gana su lugar | Gateado por plan real (premium), bajo peso visual, sección ya secundaria |
| Fila de "otros planes" → ícono eliminar (solo si premium) | Gana su lugar | Ícono, no botón de texto; `--danger` correcto por ser destructivo; ya minimalista |
| Franja de upsell → "Ver planes premium" | Gana su lugar | Un solo CTA, al final, no compite con el contenido principal |
| Sidebar desktop → "Ver planes premium" / "Guardar" (peso) / "Solicitar/Contactar" (entrenador) | Ganan su lugar | Versión desktop de las mismas 3 acciones, con más espacio; no son duplicados simultáneos de las de mobile (son responsive, no ambas a la vez) |
| Enlace "Pedir/Contactar entrenador personal" (mobile, fuera de sidebar) | Gana su lugar | Tratamiento ya discreto (borde punteado, texto muted) acorde a su prioridad baja |
| Modal eliminar plan: "Cancelar"/"Eliminar" | Ganan su lugar | Patrón estándar de confirmación destructiva |
| Modal de progreso: "Guardar" (peso) + ícono eliminar por registro | Ganan su lugar | Acción central del modal + limpieza de historial, ambos con propósito claro |
| Modal free-expirado: "Entendido"/"Ver planes premium" | Ganan su lugar | Dos caminos reales desde un estado de bloqueo (cerrar vs. resolver) |
| Modal entrenador personal: selección hombre/mujer, "No, gracias"/"Sí, quiero" | Ganan su lugar | Necesarios para completar el único flujo que ese modal resuelve |

Resultado: de todos los botones/acciones del alcance, **solo uno no ganaba su lugar tal como estaba** ("Registrar peso" móvil) — no por sobrar, sino por prometer algo que no hacía. El resto del dashboard ya pasa el filtro de "que todo tenga sentido"; no hacía falta sacar nada más.

### 13.10.4 "Registrar peso" en mobile: de botón-modal duplicado a carga inline

Se descarta sacar el botón entero (mobile perdería una vía rápida real de cargar peso — el equivalente de lo que la sidebar de desktop ya resuelve bien) y se descarta pasarle un parámetro al modal para hacer scroll/foco automático al formulario (sigue abriendo un modal completo para una sola cifra, more fricción que la versión de desktop).

**Se adopta el mismo patrón que ya usa la sidebar de desktop, en mobile:** al tocar "Registrar peso" se despliega un campo inline (número + botón "Guardar") debajo de la fila de acciones rápidas, sin abrir ningún modal — mismo comportamiento en las dos plataformas, en vez de mobile con una versión rota de la de desktop. Implementado en la demo como disclosure (`height`/`opacity` desde 0, pero en contenido montado recién al tocar el botón — no en el HTML inicial, así que no es el patrón de motion prohibido por §12/§11.6) envuelto en `useReducedMotion()`.

### 13.10.5 Badges de fase del plan (ámbar/cian/esmeralda/violeta): revisado en §13.10.9 — ya no se mantienen tal cual en toda la pantalla

**Superado por §13.10.9.** Esta sección original evaluó sacar el color de fase de todo el dashboard y decidió mantenerlo en todos lados, razonando el costo visual en abstracto ("aparece como máximo 2 veces") en vez de contra una captura real de la pantalla completa. Auditada la captura, el costo real no es "cuántas veces aparece un badge de fase", es cuántos **hues distintos conviven a la vez** en la misma vista junto con el resto de la paleta (franja + accent) — y ahí sí hay un problema que este razonamiento original no vio. Se mantiene el argumento de fondo (la fase es un estado real, no decoración) pero se acota dónde lleva color — ver §13.10.9 para la decisión final.

### 13.10.6 Corrección a §1: alcance de "barras de progreso" como uso aprobado del gradiente de marca

§1 lista "barras de progreso" entre los usos aprobados de `--brand-start/mid/end`, junto con "gradiente ambiental de fondo (hero, body background)". Esa nota describía la intención original (franjas finas de identidad, no widgets de datos), pero en la práctica habilitó el uso que Lucas acaba de rechazar acá y que también aparece, sin ser parte de este alcance, en `plan.tsx` (línea 3681) y `MonthChangesModal.tsx` (líneas 209/246) — el mismo patrón de "barra de progreso = gradiente de marca de 3 tonos" en vez de un tono semántico único.

**Corrección de alcance (no crea categoría nueva, no requiere a Lucas — es acotar una nota ya escrita, con su encargo de esta misma revisión como base):** "barras de progreso" se saca de los usos aprobados de §1. El gradiente de marca queda documentado ahí solo para **ambiental de fondo y franjas decorativas finas sin dato** (heros, body background, líneas de acento ≤2px) — nunca para un elemento cuyo ancho/alto/color el usuario está leyendo como una cifra. Una barra de progreso real usa `--accent` (o el token semántico que corresponda al dato que muestra).

No se corrige acá `plan.tsx` ni `MonthChangesModal.tsx` — están fuera del alcance de esta revisión (dashboard de cliente) — pero quedan anotados como candidatos directos para la próxima pasada, con la misma corrección ya decidida y lista para aplicar.

### 13.10.7 Motion y accesibilidad

- La disclosure de "Registrar peso" en mobile anima `height`/`opacity` desde 0 al abrirse — válido porque es contenido que solo existe después de la interacción del usuario (no está en el HTML inicial), mismo criterio ya usado en `ExerciseSetTracker.tsx`/`plan.tsx` para paneles expandibles. Se envuelve en `useReducedMotion()` (con `duration: 0` si está activo) — esos precedentes no lo hacían, se corrige acá y queda como el patrón a copiar.
- El resto de las correcciones (13.10.1-A/B) no tocan ningún `initial`/`AnimatePresence` existente — son cambios de color y de una barra de acciones, no de motion.

### 13.10.8 Pendiente para `frontend` (implementación, fuera de esta entrega — **ver 13.10.9, agrega 2 puntos más abajo, no reemplaza estos**)

1. `DashboardPlanHero.tsx`: cambiar la barra de progreso lineal de `linear-gradient(90deg, var(--brand-start), var(--brand-mid), var(--brand-end))` a `bg-accent` sólido (ver demo, `ActivePlanHero`).
2. `dashboard.tsx`: reemplazar el botón móvil "Registrar peso" (que hoy abre el mismo modal que "Progreso") por la disclosure inline de 13.10.4 — puede reusar la misma lógica de `handleQuickSaveWeight` que ya usa la sidebar de desktop, solo cambia dónde vive el input en mobile.
3. Actualizar la nota de §1 (`--brand-start/mid/end`) para sacar "barras de progreso" de los usos aprobados, según 13.10.6 — cambio de documentación, no de código.
4. ~~No se pide nada sobre badges de fase (13.10.5)~~ — **superado, ver 13.10.9 punto 2.** El resto de los botones auditados en 13.10.3 sigue sin cambios.

### 13.10.9 Segunda revisión — techo de 3 colores conviviendo a la vez (criterio explícito de Lucas)

Lucas, tras ver la v2 ya con los 2 puntos de 13.10.1 corregidos, dio una regla numérica concreta: *"en colorimetría dicen que deberían coexistir hasta 3 colores, 4 o más ya es ruido y presta a confusiones"*. Con la precisión de que los tokens semánticos de estado (`--success`/`--warning`/`--danger`) no cuentan contra ese presupuesto **cuando son excepcionales y funcionales** (aparecen solo si hay algo puntual que comunicar — un error, una cifra positiva, una acción destructiva), no cuando son permanentes y siempre visibles.

**Auditada la v2 contra ese criterio (no en abstracto — contra la captura real a 1440px, `many` planes + multi-fase + premium, el escenario más denso y a la vez el más común para un usuario premium):** en un solo scroll conviven, todos permanentes y ninguno excepcional: fondo/neutro, lima (`--accent`, anillo+barra+CTA), la franja de gradiente de 3 tonos arriba del hero, el badge esmeralda "Fase: Recomposición" y el badge cian "Definición" de la fila de abajo. Contando la franja como 3 colores en sí misma, son 6 hues no-neutros a la vez — muy por encima del techo de 3 (neutro + acento + un tercero, como máximo).

**Dos correcciones, ambas dentro de mi autonomía (no crean categoría de token, no tocan `plan.tsx`/admin):**

1. **La franja de gradiente arriba del hero: se elimina, sin excepción.** Mi argumento anterior (13.10.2, "franja fina ≤2px no compite por lectura") no sobrevive al criterio numérico: la franja es, ella sola, un uso simultáneo de los 3 tonos de marca — satura el presupuesto completo antes de que aparezca cualquier otro color en pantalla, y no es semántica (no es excepcional, está siempre ahí). La jerarquía "esta es la tarjeta importante" que buscaba comunicar ya la da la estructura (es la primera tarjeta, la más grande, la única con anillo + CTA primario) — no hace falta un recurso de color para eso. Se saca del componente entero, no se reduce de tamaño ni se cambia de posición.

2. **Badges de fase: el color se mantiene, pero solo en el plan activo (hero) — la fila "Otros planes" pasa a texto sin color (`.badge-neutral`).** La fase de un plan sigue siendo un estado real, no decoración (eso no cambió) — pero no es un estado *excepcional* en el sentido que exime a `--success`/`--warning`/`--danger`: es un dato permanente, visible siempre que hay un plan, y por eso sí cuenta contra el techo de 3. El badge del hero **gana** el lugar del tercer color (neutro + accent + fase-del-plan-activo = 3, dentro del techo) porque es el dato que responde "en qué fase estoy hoy", la pregunta central de la pantalla (§13.2). Los badges de "otros planes" no ganan ese mismo lugar: son historial secundario (ya de menor peso visual por diseño, §13.2 punto 3), y mostrar una fase de color ahí obliga a un segundo o tercer hue de fase conviviendo con el del hero apenas el usuario tiene más de un plan — que es el caso premium típico, no una excepción rara. El nombre de la fase se sigue leyendo en texto (`plan.phaseLabel`, ej. "Definición") dentro del badge neutro — sigue siendo decodificable, solo que sin un hue que compita con el del plan activo.

**Alcance: es específico de esta pantalla, no cambia los tokens de fase de §1 ni su uso en `plan.tsx`/admin.** Ahí el color de fase cumple un rol distinto: son pantallas de comparación (grilla de planes, tabla de clientes) donde distinguir varias fases a simple vista *es* la tarea principal — no un dato secundario conviviendo con el resumen de "mi plan de hoy". Mismo dato (fase), rol visual distinto según si la pantalla compara muchos planes o resume uno solo — no es la inconsistencia que el sistema busca evitar (esa sería que "Definición" se viera cian en una pantalla y ámbar en otra sin motivo).

**Presupuesto final de la vista base del dashboard (sin modal abierto): 3 colores — neutro/fondo, `--accent` (lima), y el hue de fase del plan activo.** Todo lo demás que aparece en pantalla (`--danger` en el ícono de eliminar plan, `--success` en el delta de peso o el gráfico del modal de progreso, `--warning`/`--info` en avisos puntuales) es excepcional y funcional en el sentido de Lucas — no está siempre visible con el mismo peso, aparece solo cuando hay algo puntual que comunicar — y por eso no cuenta contra el techo.

Pendiente para `frontend` (se suma a la lista de 13.10.8, no la reemplaza):

5. `DashboardPlanHero.tsx`: eliminar por completo la franja de gradiente de marca (`linear-gradient(90deg, var(--brand-start), var(--brand-mid), var(--brand-end))`, 1.5px arriba de la tarjeta) — no queda ningún uso del gradiente de marca en el dashboard después de este cambio.
6. `DashboardPlanRow.tsx` (fila de "otros planes"): cambiar el badge de fase de `.badge-phase-*` (color según fase) a `.badge-neutral` — mismo texto (`phaseLabel`), sin variante de color. El badge del hero (`DashboardPlanHero.tsx`) no cambia, sigue en `.badge-phase-*`.

Demo actualizada: `src/pages/dashboard-design-preview.tsx` → `/dashboard-design-preview` — franja de gradiente eliminada del hero, badges de "Otros planes" en `.badge-neutral`, nota de "qué cambió" ampliada con estos 2 puntos.

## 14. Landing pública — mismo techo de 3 colores del dashboard (§13.10.9) — APROBADO POR LUCAS (2026-08-29) E IMPLEMENTADO

Encargo de Lucas: aplicar a la landing pública el mismo criterio que ya se usó en el dashboard (§13.10.9) — "hasta 3 colores permanentes, 4 o más ya es ruido". Alcance auditado: `HomeLanding.tsx` (`/` y `/en`) y, por decisión propia justificada abajo, `transformacion-fitplan.tsx` (es/en), la landing de campaña. **Estado: Lucas vio el antes/después de la landing de campaña y aprobó el cambio el 2026-08-29. Implementado en los archivos reales por `frontend`.**

### 14.1 Auditoría contra captura real, no contra el código

Levantado un build de producción (`npm run build && npm run start`, no `next dev` — evita falsos negativos de hidratación) y capturado con Chrome headless a 1440px y 390px, `/` , `/en`, `/transformacion-fitplan` y `/en/transformacion-fitplan`.

**`HomeLanding.tsx` — ya cumple, no hace falta sacar nada.** Contra la captura completa (hero, "Cómo funciona", "Hecho por expertos", "Todo lo que necesitas", CTA de cierre): solo **2 hues no-neutros en toda la pantalla** — el fondo/superficies neutros y `--landing-accent` (= `--accent`, lima), usado consistentemente en el badge del hero, las 2 palabras destacadas del `h1`, los 2 CTA primarios, los íconos de kicker/chips/checks y el link del formulario de intake. No hay gradiente de marca, no hay segundo ni tercer hue en ningún punto. Ya está por debajo del techo, en las dos resoluciones y en los dos idiomas. Único hallazgo menor, no relacionado con el conteo de colores: los dos CTA primarios (`dashboard.tsx` línea 316 y 458 de `HomeLanding.tsx`) usan `text-[#0a1628]` (hex crudo, navy) en vez de `var(--accent-ink)` (`#0a0f05`, el token ya documentado en §1 para texto sobre superficies de acento) — mismo resultado visual (texto oscuro legible sobre el lima) pero rompe la regla de "nunca un valor crudo fuera del árbol de tokens". Se anota como pendiente menor para `frontend`, no bloquea nada de esta propuesta.

**`transformacion-fitplan.tsx` (es/en) — no cumple, y por lejos.** Contra la captura completa (hero, 3 features, "lo que compras", asesoría 1:1, comparación, oferta, FAQ, cierre): **4 hues no-neutros conviviendo a la vez, todos permanentes**:
1. Cian/azul — kicker, wordmark "FitPlan" del `h1`, fondo del hero (`from-blue-500/14 via-cyan-500/10 to-emerald-500/12`), chip "Nutrición personalizada", tarjeta "FitPlan Premium" del comparativo, CTA "Quiero empezar hoy" del cierre.
2. Esmeralda/teal — checkmarks de toda la página, chip "Entrenamiento progresivo", sección completa "asesoría humana 1:1" (fondo, borde, CTA "Solicitar asesoría 1:1"), tarjeta "Asesoría humana 1:1" del comparativo.
3. Ámbar/naranja — toda la sección de oferta/pricing (fondo, ring del plan "Trimestral", CTA "Activar FitPlan Premium").
4. Lima (`--accent`) — aparece **una sola vez**, en el botón "Aceptar todo" del banner de cookies (`CookieConsentBanner.tsx`, ya tokenizado correctamente) — el único punto de toda la pantalla que en realidad usa el color de marca real de FitPlan.

Ese último punto es el hallazgo más importante, más allá del conteo: **el color que domina esta página (cian) no es el acento de marca.** No es solo "muchos colores", es que la landing de campaña no se ve como el resto de la app — llega tráfico pago a una pantalla que visualmente podría ser de otro producto. Además el mismo botón ("Activar FitPlan Premium") cambia de paleta según la sección en la que aparece (azul→cian arriba, ámbar→naranja en la oferta) — exactamente el patrón "botón por haber"/inconsistente que Lucas ya había rechazado en el dashboard (§13.10), aplicado acá a color en vez de a duplicación de acción.

Este archivo nunca pasó por el rollout "FitPlan Volt" (ya estaba anotado como deuda conocida en §5, "Landing pages alternativas (variante de campaña), no tocadas", 55/49 clases crudas) — no es un caso de "sacar 1-2 colores de más" como el dashboard, es migrar el archivo entero a tokens por primera vez.

### 14.2 Por qué `transformacion-fitplan.tsx` entra en este alcance (decisión propia, justificada)

Lucas dejó a mi criterio si esta página entraba. Entra, por 3 razones:
1. Es cara al público y recibe tráfico de campañas pagas — el punto que el propio encargo de Lucas marca como diferencial de la landing frente al dashboard ("su función es convertir visitantes") aplica acá con más fuerza todavía, no menos: es la página a la que un anuncio manda directamente.
2. Ya está, hoy, peor que el dashboard que Lucas rechazó — 4 hues permanentes contra los 5-6 que motivaron el rechazo del dashboard, y ninguno de los 4 es siquiera el acento de marca real.
3. Es el mismo criterio ("techo de 3, cara al público") aplicado al mismo tipo de pantalla (landing) — dejarla afuera hubiera significado dos landings con reglas de color distintas conviviendo en el mismo dominio.

### 14.3 Los 2 colores que se quedan, y por qué no hace falta un tercero

**Neutro (fondo/superficie/borde/texto) + `--accent` (lima) — igual que `HomeLanding.tsx`, que ya demuestra que 2 alcanza para esta pantalla.** No se propone gastar el "tercer color" disponible del techo de 3: a diferencia del dashboard (donde la fase del plan es un dato real que gana su lugar como tercer color, §13.10.9), una landing de marketing no tiene un estado de usuario que comunicar — todo lo que hoy usa un segundo/tercer hue en `transformacion-fitplan.tsx` es decorativo o de jerarquía visual, no un dato. Se resuelve con estructura (tamaño, posición, tarjeta vs. tarjeta, copy) en vez de un hue nuevo por bloque — mismo principio ya usado en el dashboard para sacar la franja de gradiente ("la jerarquía la da la estructura, no el color").

**Punto 4 del encargo (el color que hace trabajo real de conversión gana su lugar) — aplicado, no ignorado.** El lima no se apaga, se **concentra**: hoy aparece en un solo botón de todo el flujo (el de cookies, que ni siquiera es del producto) mientras 3 CTAs reales ("Activar FitPlan Premium" ×2, "Quiero empezar hoy") están coloreados de 3 formas distintas. La propuesta lleva el lima a los 4 CTA primarios de la página, siempre igual — eso es lo que de verdad ayuda a convertir: un usuario que ve el mismo color de "acción principal" repetirse en el hero, la oferta y el cierre aprende más rápido qué botón apretar que uno que ve 3 gradientes distintos para la misma acción. Volverla "gris y aburrida" no era la alternativa que se evaluó — la alternativa real era "3-4 colores gritando al mismo tiempo" vs. "1 color que siempre significa lo mismo": la segunda convierte mejor, no peor.

**El plan "recomendado" del pricing (antes ring ámbar) pasa a ring `--accent`.** Es el mismo caso: destacar la opción recomendada es trabajo real de conversión, así que gana su lugar — pero no necesita un hue nuevo, el lima ya es "esto es lo importante" en el resto de la página. Meter ámbar acá también hubiera sido el mismo error que evitó el dashboard con la fase de plan: un segundo hue permanente compitiendo con el primero.

**"Asesoría 1:1" (camino secundario) pierde su hue propio (esmeralda) y se distingue por estructura, no por color** — mismo criterio que "otros planes" en el dashboard (§13.10.9 punto 2): es una opción secundaria real, pero mostrarla con un segundo hue permanente en 4 secciones distintas (chip, sección completa, tarjeta comparativa, botón) es exactamente el "hue extra corriendo en paralelo" que hace ruido. Se sigue leyendo perfectamente por el copy y el `.btn-secondary`/`.card-surface` — no pierde información, pierde un color que no estaba comunicando nada que el texto no dijera ya.

### 14.4 Qué reemplaza a cada color que sale

| Color que sale | Dónde aparecía | Reemplazo |
|---|---|---|
| Cian/azul (fondo hero, wordmark, kicker, chip, CTA "Activar..." arriba, tarjeta "FitPlan Premium") | Hero, comparativo | `--landing-accent` (wordmark, kicker, CTA) / neutro `.card-surface`+`.card-surface-2` (fondos, tarjeta) |
| Esmeralda/teal (checks, chip, sección + CTA de asesoría 1:1, tarjeta "Asesoría 1:1") | En toda la página | Checks → `--landing-accent` (mismo criterio que `HomeLanding.tsx`, no `--success`: es copy de marketing permanente, no una confirmación real de un estado del usuario). Resto → neutro (`.card-surface`, `.card-surface-2`, `.btn-secondary`) |
| Ámbar/naranja (sección de oferta, ring del plan recomendado, CTA "Activar..." de la oferta) | Pricing | Fondo → `.card-surface` neutro. Ring del recomendado → `--landing-accent`/40. CTA → `.btn-primary` (mismo lima de siempre, no un tercer tratamiento) |
| Gradientes de botón distintos por sección (azul→cian, ámbar→naranja, esmeralda→teal) | 4 CTAs de la página | `.btn-primary` (acción principal, lima sólido) / `.btn-secondary` (acción secundaria: asesoría 1:1, WhatsApp) — mismas 2 clases ya en uso en el resto de la app, sin gradiente nuevo |

Nada de esto crea una categoría de token nueva ni toca `--brand-start/mid/end`: es aplicar tokens/clases que **ya existen** (`--landing-accent`/`--accent`, `--landing-surface`/`-2`, `--landing-border`, `--landing-muted`, `.btn-primary`, `.btn-secondary`, `.card-surface`, `.card-surface-2`) — el mismo set que ya usa `HomeLanding.tsx`. Por eso esta sección no necesitó pasar por Lucas antes de proponerse (solo el resultado final sí, por ser un cambio de cómo se ve la marca puertas afuera).

### 14.5 Motion y accesibilidad

- `transformacion-fitplan.tsx` ya anima con `initial={{ y: 12 }}` (no opacidad) en su único bloque animado — cumple la restricción de §12/§11.6, no había que corregir nada ahí.
- Hallazgo nuevo: ese mismo bloque no está envuelto en `useReducedMotion()` — a diferencia de `HomeLanding.tsx`, que sí lo tiene desde §7.2. Se agrega en la demo (`transformacion-design-preview.tsx`) y queda como pedido concreto para `frontend` junto con la migración de color, ya que se va a tocar el archivo de todas formas.
- El resto de la página no tiene animación de entrada en absoluto (a diferencia de `HomeLanding.tsx`, que anima cada sección con `fadeUp`/stagger, §7.2) — no se pide agregarla acá porque no es parte del encargo (color, no motion) y no hay que introducir cambios no pedidos en una propuesta que ya es grande; queda anotado por si se retoma en una pasada de motion.

### 14.6 Implementación (aprobada por Lucas el 2026-08-29 — YA IMPLEMENTADO, se conserva como registro de qué se hizo)

1. Migrar `transformacion-fitplan.tsx` y `en/transformacion-fitplan.tsx` según el mapeo de 14.4 — usar `transformacion-design-preview.tsx` como referencia 1:1 de estructura y clases (mismo copy real de cada archivo, la demo solo cambia color/tokens).
2. Envolver el `motion.div` del hero en `useReducedMotion()` (14.5) al tocar el archivo.
3. Corrección menor en `HomeLanding.tsx`: reemplazar `text-[#0a1628]` por `text-[var(--accent-ink)]` en los 2 CTA primarios (línea 316 y 458) — mismo resultado visual, saca el único hex crudo que quedaba en el archivo (14.1).
4. `HomeLanding.tsx` no necesita ningún cambio de estructura/color — se deja igual, ya cumple.

Demo de referencia (no implementación real, sin Firestore/auth/analytics): `src/pages/transformacion-design-preview.tsx` → `/transformacion-design-preview`. Verificado con `npx tsc --noEmit` y `eslint` sin errores sobre el archivo nuevo, y con capturas de Chrome headless sobre build de producción (`npm run build && npm run start`) a 1440px y 390px.
