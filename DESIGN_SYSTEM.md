# FitPlan AI — Sistema de Diseño

> Fuente de verdad visual del producto. Todo color, superficie, botón o badge nuevo debería salir de acá — no de un valor de Tailwind elegido a mano en el momento.
> Implementado en [`src/styles/globals.css`](./src/styles/globals.css).

## Por qué existía un problema

Antes de esto, la app tenía una paleta *parcial* (`--landing-*`, adoptada solo en landing/formulario/algunas partes del dashboard) conviviendo con **más de 1.800 usos sueltos de clases Tailwind de color** (`bg-emerald-500`, `bg-green-500`, `bg-cyan-500`, `bg-blue-500`...) repartidos sin criterio: verde y esmeralda usados indistintamente para "éxito", cian y azul indistintamente para "info/primario", y los colores de fase de plan (bulk/cut/lean bulk/mantenimiento) redefinidos ad hoc en cada componente en vez de salir de un solo lugar. Resultado: la app se ve distinta según qué pantalla estés mirando, y cambiar "el verde de éxito" en toda la app significaba buscar y tocar decenas de archivos.

## Principio

**Un solo árbol de tokens en `:root` → todo lo demás (Tailwind, clases custom, componentes) lee de ahí.** Cambiar un color de marca es cambiar una línea en `globals.css`, no una búsqueda global.

---

## 1. Tokens

### Base

| Token | Valor | Uso |
|---|---|---|
| `--background` | `#0b1020` | Fondo de toda la app (dark permanente, sin light mode) |
| `--foreground` | `#e6f6ff` | Texto principal |

### Marca / acento

| Token | Uso |
|---|---|
| `--brand-start/mid/end` | Gradiente ambiental de fondo (hero, body background) |
| `--accent` | Color de interacción principal: CTAs, links activos, foco. Teal `#2dd4bf`. |
| `--accent-strong` | Estado hover/active del acento |

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

`--radius-sm/md/lg/xl`, `--shadow-sm/md/lg` — usar en vez de valores arbitrarios (`rounded-[14px]`, `shadow-[0_2px_8px_...]`).

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

Quedan **sin migrar, fuera del alcance de esta sesión**, con recuento aproximado de clases Tailwind de color crudas:

| Archivo | Aprox. | Nota |
|---|---:|---|
| `src/pages/transformacion-fitplan.tsx` / `src/pages/en/transformacion-fitplan.tsx` | 23 / 21 | Landing pages alternativas (variante de campaña), no tocadas |
| `src/components/UserMessagesModal.tsx` | 13 | Chat de mensajería con el fundador |
| `src/components/ExerciseDemoMedia.tsx` | 13 | Reproductor de demos de ejercicios |
| `src/pages/payment/{success,pending,failure}.tsx` | 9 / 4 / 4 | Páginas post-pago |
| `src/pages/admin/configuraciones/index.tsx` | 8 | Configuración de ejercicios del admin |
| `src/pages/legal/*.tsx` | ~20 en total | Páginas legales (mayormente texto, bajo impacto visual) |

Además, dentro de los archivos ya migrados quedaron **intencionalmente sin tokenizar** paletas categóricas decorativas que no representan estado (ej. tarjetas de resumen con distintos colores solo para diferenciarlas visualmente en `IntakeClientPlanPublicView.tsx`, pestañas de selección en el catálogo de ejercicios, gradientes de héroe/marketing) — forzarlas a los 4 tokens semánticos habría reducido la distinción visual entre secciones sin ganar nada. Si en una futura pasada aparecen más colores crudos representando estado real (éxito/error/advertencia/info), migrarlos con las clases de la sección 2; el resto de archivos de la tabla de arriba son los candidatos naturales para la próxima ronda.

## 6. Modo claro

Hoy la app es permanentemente oscura (no hay toggle ni variante clara). Si en el futuro se quiere soporte de modo claro, el punto de entrada es un solo lugar: redefinir el bloque `:root` de tokens bajo un selector `[data-theme="light"]` (mismos nombres de variable, valores distintos) — como todo el resto del sistema ya lee de variables, no haría falta tocar componentes.
