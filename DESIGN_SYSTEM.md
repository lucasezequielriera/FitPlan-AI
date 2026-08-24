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
| `src/pages/admin/hyrox.tsx` | 29 | Panel Hyrox del admin |
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

## 7. Modo claro

Hoy la app es permanentemente oscura (no hay toggle ni variante clara). Si en el futuro se quiere soporte de modo claro, el punto de entrada es un solo lugar: redefinir el bloque `:root` de tokens bajo un selector `[data-theme="light"]` (mismos nombres de variable, valores distintos) — como todo el resto del sistema ya lee de variables, no haría falta tocar componentes.
