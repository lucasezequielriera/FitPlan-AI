# FitPlan AI — Documentación General del Proyecto

> Última actualización: 2026-07-27
> Este documento es la fuente de verdad sobre qué es FitPlan AI, cómo genera ingresos, qué hace cada parte del sistema y cómo está construido técnicamente. Compañero de [`AUDIT.md`](./AUDIT.md) (estado de calidad/seguridad) y [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md) (sistema visual).

---

## 1. Qué es FitPlan AI

FitPlan AI es una aplicación web (Next.js) que genera **planes de entrenamiento y nutrición personalizados usando IA**, con dos líneas de negocio que conviven en el mismo código:

1. **Producto B2C de autoservicio**: cualquier persona se registra, completa un wizard con sus datos y objetivos, y recibe un plan de varios meses (fases de volumen/definición, con seguimiento diario de comidas, entrenamientos y peso).
2. **Servicio B2B/1:1 de coaching humano**: un formulario de captación de leads público, gestionado desde un CRM interno (panel admin), donde el fundador genera planes asistidos por IA para clientes que pagan por atención personalizada, sin necesidad de que el cliente tenga cuenta (acceso vía link tokenizado).

Ambos productos comparten motor de generación de planes, infraestructura de pagos, y el mismo panel de administración.

---

## 2. Modelo de negocio

### 2.1 Producto B2C — Freemium por suscripción

| | Free | Premium |
|---|---|---|
| Planes simultáneos | 1 | Ilimitados |
| Contenido del plan | Plantillas estáticas predefinidas | Generado por IA (OpenAI, personalizado) |
| Vigencia | El plan deja de ser accesible a los 30 días | Sin límite |
| Seguimiento (comida/entrenamiento/peso) | Sí | Sí |

- **Trial**: 30 días gratis de Premium al suscribirse (tanto en Stripe como en MercadoPago), antes del primer cobro.
- **Precios** (ver `src/lib/stripePlanPrices.ts`, `src/pages/api/createPayment.ts`):
  - MercadoPago (LATAM, ~17 países): mensual $10.000 ARS, trimestral $24.000 ARS, anual $50.000 ARS.
  - Stripe zona euro: €5 / €12 / €25 (mensual/trimestral/anual).
  - Stripe US/CA: $5.99 / $13.99 / $26.99.
- **Enrutamiento geográfico**: el país se detecta por IP (`getCountryFromRequest.ts`) y decide automáticamente si se ofrece MercadoPago o Stripe (`paymentUtils.ts`).
- **Vencimiento de Premium**: se revisa on-demand (al abrir la app) y proactivamente por cron diario (`cron/expirePremium.ts`), que baja `premium: false` en Firestore cuando `premiumExpiresAt` ya pasó.
- **"Pedir entrenador personal"**: función dentro del dashboard que asigna una identidad ficticia (Lucas/Sandra) y notifica por email/Telegram al fundador — en la práctica es el propio fundador atendiendo, no un feature de matching real con un roster de entrenadores.

### 2.2 Servicio 1:1 — Coaching humano asistido por IA

Flujo pensado para que el fundador venda y gestione clientes de entrenamiento personalizado sin que el cliente necesite loguearse:

1. Lead llega por formulario público (`/formulario-de-inicio`, también en inglés).
2. El fundador lo ve en el CRM interno (`/admin/clientes-1-1`), genera un plan asistido por IA, lo puede exportar a Excel, y envía un link de pago.
3. El cliente accede a su plan por un **link tokenizado sin login** (`/mi-plan/[clientId]?t=...`), donde puede ver el plan, cargar su peso, responder check-ins de bienestar y preguntas del entrenador.
4. Se le piden check-ins automáticamente por cron (digest semanal los lunes, recordatorios diarios).

Este es el producto de mayor ticket (atención personalizada), y el panel admin es efectivamente el CRM de este negocio.

### 2.3 Fuentes de ingreso resumidas

- Suscripciones B2C Premium (mensual/trimestral/anual, dos pasarelas).
- Pagos por servicio de coaching 1:1 (vía link de pago generado ad hoc por el fundador).
- Todo el dinero se registra en un libro mayor interno (`admin/{YYYY-MM}` en Firestore) visible en el panel admin (ingresos mensuales/anuales).

---

## 3. Funcionalidades — inventario completo

### 3.1 Cara al usuario (B2C)

- **Landing pages** en español e inglés (`/`, `/en`) con copy de marketing, tracking de atribución (UTM/gclid/fbclid/ttclid) y píxeles (GA4, Meta, TikTok) sujetos a consentimiento de cookies.
- **Wizard de creación de plan** (`create-plan.tsx`): objetivo (bajar grasa / ganar músculo / recomposición), tipo de dieta, intensidad, datos antropométricos → cálculo de BMR/TDEE y macros (`src/utils/calculations.ts`).
- **Planes multi-fase**: el sistema decide automáticamente si el usuario necesita una fase de volumen y una de definición (BULK→CUT), un "lean bulk", o solo mantenimiento, calculando la duración de cada fase según velocidad de cambio de peso saludable.
- **Dashboard** (`dashboard.tsx`): lista de planes guardados, gate de free/premium, acceso a estadísticas semanales, caché local (funciona offline / sin Firestore) y cola de sincronización de pesos pendientes.
- **Visor/tracker de plan** (`plan.tsx`, el archivo más grande del proyecto): registro diario de comidas (con análisis de fotos/texto por IA), registro de entrenamientos por ejercicio y set, calendario de gimnasio, seguimiento de peso, y el flujo de "preparar el próximo mes" con un modal que compara los cambios de calorías/macros/volumen de entrenamiento entre fases.
- **Analizador de comida por IA** (`analyzeFood.ts`): registra alimentos a partir de descripción o foto.
- **Análisis de cumplimiento de plan** (`analyzePlanCompletion.ts`): genera revisión/ajustes razonados para el mes siguiente.
- **Catálogo de ejercicios con medios** (integración con la base de datos WGER + Cloudinary) para mostrar demostraciones de cada ejercicio.
- **Exportación de plan a PDF** (jsPDF + html2canvas).
- **Mensajería in-app** con el fundador (chat de soporte/entrenador).
- **Páginas legales** completas (privacidad, términos, cookies, reembolsos, disclaimer, responsabilidad, contacto).

### 3.2 Cara al lead/cliente 1:1

- Formulario de alta (`/formulario-de-inicio`, ES/EN) con validación estructurada (`intakeFormSchema.ts`).
- Página de plan sin login vía token (`/mi-plan/[clientId]`): ver plan, cargar peso, check-ins, preguntas y respuestas con el entrenador.
- Emails transaccionales (bienvenida, digest semanal, recordatorios) vía SMTP.

### 3.3 Panel de administración (`/admin/*`)

Todo corre sobre un único componente central (`AdminApp.tsx`) con tres vistas:

- **Dashboard admin** (`/admin`): gestión de usuarios B2C (buscar/editar/eliminar), estado de pago/premium por usuario, estadísticas de ingresos (mensual/anual), libro de pagos, bandeja de notificaciones de pago, chat/mensajería con usuarios.
- **CRM 1:1** (`/admin/clientes-1-1`): gestión completa del ciclo de vida de leads/clientes de coaching — generación de planes IA, exportación a Excel, envío de links de pago, solicitud de pesos/check-ins, historial de emails, emisión de links tokenizados, borrado de clientes/planes.
- **Clientes FitPlan** (`/admin/clientes-fitplan`): vista/detalle de clientes del lado B2C.
- **Actividad** (`/admin/actividad`): log de auditoría filtrable (usuarios, pagos, fatiga, riesgo, emails).
- **Catálogo de ejercicios**: curación de medios de ejercicios (cobertura, búsqueda en WGER, parcheo de medios en planes existentes).
- **Configuraciones** (`/admin/configuraciones`): configuración de ejercicios y otros parámetros del sistema.

### 3.4 Infraestructura y automatizaciones

- **3 Cron jobs en Vercel**: expiración de Premium (diario 03:00), digest semanal 1:1 (lunes 10:00), recordatorios automáticos 1:1 (diario 10:00).
- **Webhooks de pago**: Stripe (firma verificada) y MercadoPago (sin firma, ver `AUDIT.md`).
- **Notificaciones a Telegram** en eventos clave (pagos, conversiones).
- **App móvil (Capacitor)**: proyectos iOS/Android generados pero **no conectados al build actual** — ver estado en `AUDIT.md`, no es prioridad ahora según decisión del fundador.

---

## 4. Arquitectura técnica

### 4.1 Stack

| Capa | Tecnología |
|---|---|
| Framework | Next.js 16 (**Pages Router**, no App Router) |
| UI | React 19, Tailwind CSS v4 (config CSS-first, sin `tailwind.config.*`), Framer Motion |
| Estado | Zustand (auth + plan en creación); el resto es estado local por página |
| Datos/Auth | Firebase Auth (email/password) + Firestore (cliente y Admin SDK) |
| IA | OpenAI `gpt-4o-mini` vía `fetch` directo (sin SDK oficial) |
| Pagos | Stripe (Europa/US/CA) + MercadoPago (LATAM), ambos por suscripción |
| Medios | Cloudinary + catálogo WGER de ejercicios |
| Exportables | jsPDF + html2canvas (PDF), ExcelJS + xlsx (Excel) |
| Email | Nodemailer sobre SMTP propio |
| Analítica | Vercel Analytics/Speed Insights, GA4, Meta Pixel, TikTok Pixel + Conversions API |
| Empaquetado móvil | Capacitor (iOS/Android) — desconectado del build actual |
| Testing | Jest + Testing Library (6 archivos), Cypress (1 smoke test) |
| Hosting | Vercel (cron jobs y `maxDuration` configurados en `vercel.json`) |

### 4.2 Estructura de carpetas relevante

```
src/
  pages/            Rutas Next.js (páginas + API routes en pages/api)
  components/        UI: dashboard/, landing/, admin/, y componentes de plan sueltos
  lib/                Lógica de negocio, integraciones (Firebase, pagos, IA, email, i18n)
  store/              Zustand: authStore, planStore
  contexts/           AppLocaleContext (es/en)
  utils/              calculations.ts (BMR/TDEE/macros)
  types/              Tipos de dominio (plan, savedPlan, intakeWorkoutLog)
  styles/             globals.css (tokens de diseño + overrides puntuales)
```

### 4.3 i18n

Sistema propio (no usa next-i18next ni similar): diccionarios `{ key: { es, en } }` en `src/lib/i18n/`, con rutas duplicadas bajo `/en/*` para el contenido en inglés, y `AppLocaleContext` sincronizando el idioma con `localStorage`. Solo español e inglés.

### 4.4 Generación de planes — flujo real

1. Usuario completa el wizard → `planStore` guarda el input.
2. `POST /api/generatePlan` decide: si el usuario es Premium y hay `OPENAI_API_KEY`, llama a OpenAI con un prompt extenso (guardrails de plausibilidad en `trainingPlanGuards.ts`); si no, cae a plantillas estáticas (`templatePlans.ts`).
3. El plan se guarda en Firestore (`planes/{planId}`) y también se cachea localmente (`planLocalCache.ts`) para tolerar fallos de red.
4. Seguimiento diario (comida/entrenamiento/peso) se sincroniza con colas de reintento cuando hay conectividad intermitente (`weightSyncQueue.ts`).
5. Al cerrar el mes, `analyzePlanCompletion.ts` genera el análisis para decidir ajustes del próximo mes (`MonthChangesModal`).

### 4.5 Contenido social automático (marketing, en construcción)

Cron diario (`/api/cron/generateDailyContent`, `src/lib/socialContent/`) que genera y publica una pieza de contenido por día:

1. Elige un tema rotando (tip de nutrición/entrenamiento, mito vs. realidad, motivacional, feature de la app) evitando repetir los últimos 5 días.
2. Genera el copy (título de imagen, caption IG, caption TikTok, hashtags) con OpenAI.
3. Renderiza una imagen de marca 1080x1080 vía `@vercel/og` (`/api/internal/renderSocialImage`, Edge Runtime) y la sube a Cloudinary.
4. Publica en Instagram vía Graph API (`postToInstagram.ts`) — **requiere que tu app de Meta for Developers tenga aprobado el permiso `instagram_content_publish`**, si no, el contenido se genera y guarda igual pero no se publica.
5. TikTok (`postToTikTok.ts`) está armado pero **no conectado al cron todavía** — TikTok es una red mayormente de video, y el pipeline de video (Remotion u otro renderer) no está construido en esta pasada; requiere una decisión aparte sobre dónde correr el renderizado (no es viable directamente en una función serverless de Vercel por tiempo/tamaño).

Todo el historial queda en Firestore (`socialContent/{YYYY-MM-DD}`), y cada corrida notifica por Telegram si se publicó o si faltó configuración.

---

## 5. Documentos relacionados

- **[`AUDIT.md`](./AUDIT.md)** — Estado real de seguridad, bugs y calidad de código, con lo corregido en esta sesión y lo pendiente priorizado.
- **[`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md)** — Sistema de tokens visuales (colores, tipografía, spacing) y guía de uso.
- **`README.md`** — Variables de entorno documentadas (ver `AUDIT.md` para el gap real vs. lo que usa el código).
- **`DEPLOY.md`** — Guía de despliegue (nota: describe tanto Vercel como un hosting manual en Hostinger/PM2; Vercel es el que está realmente activo vía `vercel.json`).
- **`MONTH_CHANGES_MODAL.md`** — Detalle del modal de cambios entre meses/fases.
