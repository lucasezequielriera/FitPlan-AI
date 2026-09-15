# FitPlan AI — Auditoría técnica y de producto

> Última actualización: 2026-07-27 (sesión 2)
> Ver [`PROJECT_OVERVIEW.md`](./PROJECT_OVERVIEW.md) para contexto de negocio/arquitectura y [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md) para el sistema visual.
>
> Este documento se actualiza a medida que se corrigen hallazgos. Cada ítem tiene un estado: 🔴 pendiente · 🟡 en progreso · 🟢 corregido.

---

## 0. Sesión 2 — pagos, precios, calidad de planes, founder-ease

Segunda pasada enfocada específicamente en: que las pasarelas de pago funcionen sin fallas, que los precios sean correctos, que el contenido de entrenamiento/nutrición generado sea seguro, y en reducir carga de mantenimiento para el fundador. Todo lo de abajo está commiteado y deployado (ver `git log`).

**Pagos — hallazgos y fixes:**
- 🟢 Webhook de MercadoPago y Stripe (`invoice.paid`) podían **duplicar el registro de ingresos** y reenviar Telegram/notificaciones si el proveedor reentregaba la misma notificación (comportamiento normal de "al menos una entrega" documentado por ambos proveedores). Ahora el libro de ganancias de MercadoPago es atómico e idempotente por `paymentId` (mismo patrón que ya tenía Stripe), y ambos webhooks solo disparan notificaciones una vez por pago real.
- 🟢 **Precio en ARS desactualizado**: el número fijo asumía "1 EUR = 2000 ARS"; la cotización real (julio 2026) es ~1700, es decir los usuarios argentinos estaban pagando ~15-20% de más del precio EUR pretendido. Reemplazado por un sistema de cotización en vivo (dolarapi.com, oficial/Banco Nación) cacheado en Firestore y refrescado por cron diario, derivando el ARS del precio EUR único (compartido con Stripe). El mismo fix se aplicó al dashboard de ganancias del admin, que tenía el mismo `* 2000` hardcodeado.
- 🟢 `checkPayment.ts` (consulta de pago MercadoPago) no verificaba identidad — cualquiera podía consultar monto/estado de cualquier `payment_id`. Ahora requiere token y verifica que el pago pertenezca al usuario autenticado.
- 🟢 Ni Stripe ni MercadoPago verificaban si un usuario ya había usado su trial gratuito antes — cancelar antes del primer cobro y resuscribirse daba un trial de 30 días infinito. Cerrado usando `premiumSince` (se setea una sola vez, nunca se borra).

**Calidad de entrenamiento y nutrición — hallazgos y fixes:**
- 🟢 **Sin piso mínimo de calorías**: una combinación real de inputs (mujer 50a/145cm/45kg/sedentaria + pérdida de grasa intensidad "ultra") daba ~334 kcal/día objetivo — menos de lo que cuesta la proteína prescripta sola. Agregado un piso de seguridad (nunca por debajo del BMR ni de 1200/1500 kcal mujeres/hombres) aplicado en la creación del plan y como defensa adicional server-side.
- 🟢 El módulo de seguridad de ejercicios (`trainingPlanGuards.ts`, sustituye sentadillas/ejercicios de riesgo) solo protegía el flujo de coaching 1:1 admin — **el flujo Premium real que usan los clientes que pagan no lo tenía conectado para rodilla/hombro** (solo hernia/lumbar). Conectado.
- 🟢 Las plantillas del **tier gratuito ignoraban por completo** lesiones reportadas, alergias/restricciones alimentarias y patologías — un usuario free con alergia a mariscos podía recibir salmón/atún sin ningún filtro. Agregado filtrado de ejercicios inseguros y de opciones de comida con alérgenos declarados (pescados/mariscos/gluten/lácteos/huevo/cerdo/soja/frutos secos). La adaptación por patología médica específica queda como gap pendiente, de mayor alcance.
- 🟢 La regeneración de mes siguiente (multi-fase), la regeneración por cambio de intensidad/objetivo, y la regeneración por edición de datos básicos **no enviaban valores determinísticos de calorías/macros** a la IA (solo lo hacía la creación inicial del plan) — desde el mes 2 en adelante, la IA calculaba libremente sin el piso de seguridad ni el guardrail de ±15% de desviación. Ahora los 4 flujos de (re)generación calculan y envían los mismos valores, desde funciones compartidas y testeadas (`calcularCaloriasObjetivoPorMeta`/`calcularMacrosObjetivo` en `utils/calculations.ts`).

**Founder-ease — hallazgo no buscado, encontrado en el camino:**
- 🟢 **`npm test` estaba completamente roto** (no corría ningún test) por un archivo de configuración de Jest duplicado/obsoleto (`jest.config.ts` vacío junto a `jest.config.mjs`) — Jest se negaba a elegir entre ambos. Corregido, y de paso: `npx tsc --noEmit` ahora da **0 errores en todo el repo** (antes había ~22 falsos positivos por una colisión de tipos Cypress/Jest), se arregló un test con datos de fixture desactualizados (drift real con el schema), se reescribió un test que aserteaba sobre un flujo de wizard que ya no existe en la home, y se borró un test muerto que importaba un módulo que nunca existió. La suite completa (24 tests, 5 archivos) corre y pasa.

Ver detalle de cada hallazgo pre-existente (sesión 1: seguridad admin, sistema de diseño, bugs de React) en las secciones siguientes.

---

## 1. Resumen ejecutivo

FitPlan AI es un producto con **modelo de negocio real y funcional** (dos líneas de ingreso, pagos en dos pasarelas, automatización por cron) construido a una velocidad muy alta por un fundador solo. Eso trae el patrón esperable: **la lógica de negocio es sólida y specific-al-dominio (buenas guardas de plausibilidad en planes, manejo de fases, colas offline), pero la superficie de administración tiene huecos de seguridad reales, hay 4 "god components" que concentran casi toda la complejidad, y no existía un sistema de diseño consistente.**

Nada de esto es alarmante para el tamaño del equipo (1 persona), pero sí es lo primero que un inversor, adquirente o auditor técnico externo va a señalar. Las prioridades de esta auditoría, en orden:

1. **Seguridad de los endpoints admin** (crítico — corregido en esta sesión, ver §2).
2. **Bug de hooks en `plan.tsx`** que puede crashear la pantalla más usada de la app (corregido en esta sesión, ver §3).
3. **Consistencia visual / sistema de diseño** (corregido en esta sesión como base + aplicación, ver `DESIGN_SYSTEM.md`).
4. **Deuda estructural** (god components, tests débiles, documentación de env vars) — quedan como recomendaciones priorizadas, no se tocan en esta sesión salvo lo indicado.

---

## 2. Seguridad

### 2.1 Autenticación de endpoints `/api/admin/*` — 🟢 corregido en esta sesión

**Hallazgo original**: de los ~40 endpoints bajo `src/pages/api/admin/`, ninguno verificaba un Firebase ID token real. El patrón era recibir un `adminUserId` en el body/query, buscar ese documento en Firestore y comparar su `email` con el literal `admin@fitplan-ai.com`. Esto **no prueba identidad** — cualquiera que obtenga (o adivine) el UID del admin puede llamar esos endpoints suplantándolo, porque el UID viaja sin firma alguna. `closeChat.ts` era el caso más grave: ni siquiera comprobaba el email, solo que `adminUserId` no viniera vacío.

**Corrección aplicada**: se creó `src/lib/adminAuthServer.ts`, un helper único que:
- Verifica el header `Authorization: Bearer <idToken>` con `adminAuth.verifyIdToken()` (Firebase Admin SDK) — igual que ya hacían correctamente `premium/checkExpiration.ts` y `request-personal-trainer.ts`.
- Confirma que el UID resultante corresponde a un documento `usuarios/{uid}` cuyo `email` (normalizado a minúsculas) sea el admin autorizado.
- Devuelve un resultado tipado (`{ ok: true, uid }` o `{ ok: false, status, message }`) para que cada route responda 401/403 de forma uniforme.
- Se aplicó a los endpoints admin, reemplazando la lectura de `adminUserId` del body por la verificación de token. El cliente (`AdminApp.tsx`) ahora debe enviar el ID token del admin logueado en el header `Authorization`.

Ver el detalle de qué archivos se tocaron en el historial de commits de esta sesión.

### 2.2 Webhook de MercadoPago sin verificación de firma — 🟢 mitigado en esta sesión

**Hallazgo**: `src/pages/api/payment/webhook.ts` procesaba cualquier payload entrante sin validar que viniera realmente de MercadoPago (a diferencia del webhook de Stripe, que sí verifica firma con `STRIPE_WEBHOOK_SECRET`). El impacto real está acotado porque el handler *vuelve a pedir* el pago/suscripción a la API de MercadoPago usando el ID recibido (no confía en los datos del body), pero seguía permitiendo que un tercero forzara al servidor a reprocesar IDs de pago reales sin límite de frecuencia.

**Corrección aplicada**: se agregó verificación de la firma `x-signature`/`x-request-id` que MercadoPago envía (esquema HMAC documentado por MercadoPago) contra un secreto de webhook, rechazando con 401 las solicitudes que no la incluyan o no validen. Si `MERCADOPAGO_WEBHOOK_SECRET` no está configurado, se loguea una advertencia clara y se mantiene el comportamiento anterior para no romper producción sin que el fundador lo note (requiere que configures el secreto en el panel de MercadoPago y en las env vars — ver nota al pie de la sección de env vars).

### 2.3 Reglas de Firestore — 🔴 pendiente (bajo impacto, recomendado)

`firestore.rules` está razonablemente cerrado, pero el chequeo de "es admin" es el literal `admin@fitplan-ai.com` repetido en al menos 3 lugares distintos (reglas, `adminAuthClient.ts`, y cada API route). Si alguna vez rotás el email de admin, hay que actualizar todos los lugares a mano. **Recomendación** (no aplicada aún): mover el email admin a una env var (`ADMIN_EMAIL`) leída server-side, y en las reglas de Firestore a un custom claim (`request.auth.token.admin == true`) seteado una vez vía Admin SDK — así hay una sola fuente de verdad y las reglas no dependen de un string hardcodeado.

### 2.4 Variables de entorno no documentadas — 🔴 pendiente

El `README.md` documenta solo un subconjunto de las env vars que el código realmente usa. Faltan documentar: `FIREBASE_ADMIN_CLIENT_EMAIL`, `FIREBASE_ADMIN_PRIVATE_KEY` (sin esto el Admin SDK no funciona — es decir, sin esto la mitad del panel admin y los webhooks de pago no funcionan), `STRIPE_PUBLISHABLE_KEY`, `TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_ID`, `INTAKE_SMTP_*`/`INTAKE_FROM_EMAIL`, `NEXT_PUBLIC_CLOUDINARY_*`/`CLOUDINARY_API_SECRET`, `TIKTOK_EVENTS_API_ACCESS_TOKEN`/`NEXT_PUBLIC_TIKTOK_PIXEL_ID`, y ahora `MERCADOPAGO_WEBHOOK_SECRET` (nuevo, ver §2.2). **Recomendación**: actualizar el README con la lista completa — es el primer archivo que lee cualquiera que clone el repo (un colaborador futuro, un comprador técnico, vos mismo en 6 meses).

### 2.5 Endpoints de usuario que confiaban en un `userId` sin firmar — 🟢 corregido (issues #26 y #31)

**Hallazgo**: el patrón que §2.1 cerró para `/api/admin/*` seguía abierto en endpoints de usuario, con dos consecuencias distintas:

- **Exposición de lectura**: `getUserPlans.ts` (planes completos) y `getExerciseHistory.ts` (historial de pesos) recibían el `userId` por query y solo comprobaban que no estuviera vacío. Conociendo un UID se podían leer los datos de cualquier persona.
- **Chequeo de dueño saltable**: `getWeeklyStats.ts` y `deleteTrackedFood.ts` verificaban propiedad con `if (userId && planData.userId !== userId)` — es decir, **omitir el campo saltaba el chequeo por completo**. El propio panel admin dependía de ese hueco (`userId={undefined} // Admin puede ver sin userId`), así que cualquiera podía imitarlo.

**Corrección aplicada**:

- `getUserPlans.ts` y `getExerciseHistory.ts` **se borraron**: no tenían ni un solo llamador en todo el repo (verificado con grep global). Código muerto que solo aportaba superficie de exposición — asegurarlos habría sido mantener auth para algo que nadie usa.
- Nuevo `src/lib/userAuthServer.ts`, equivalente de `adminAuthServer.ts` para endpoints de usuario: `requireUser()` deriva el UID de un ID token verificado, y `requirePlanAccess()` resuelve en un paso "dueño del plan **o** admin" devolviendo el documento ya leído. Los errores de Firestore por cuota se propagan a propósito, para no romper el modo degradado de `getWeeklyStats`.
- La regla "este UID es el admin" quedó en una sola función (`isAdminUid` en `adminAuthServer.ts`), compartida por los dos helpers.
- Nuevo `src/lib/userAuthClient.ts` con `authedFetch()` (espejo de `adminFetch`), que adjunta el token automáticamente. `WeeklyStatsModal.tsx` lo usa y **dejó de recibir y mandar `userId`**: el prop desapareció de sus dos llamadores (`plan.tsx` y `AdminApp.tsx`), así que la identidad ya no viaja por el cliente en ningún punto de ese flujo.
- Cubierto con tests (`src/__tests__/userAuthServer.test.ts`, 8 casos), incluido el que fija el bypass: sin token no se pasa **aunque el plan exista**.

**Queda pendiente** (mismo patrón, fuera del alcance de este cambio — ver issue #27): `saveUserProfile.ts`, `savePlan.ts`, `createPayment.ts`, `createStripePayment.ts`, `analyzeFood.ts`, `saveUserLocation.ts`, `saveExerciseWeights.ts`, `sendMessage.ts`, `saveMonthlySnapshot.ts` y `updateLastLogin.ts`. `requireUser()` ya es la pieza que necesitan: aplicarlo es cambiar el origen del UID en cada uno.

---

## 3. Bugs de código

### 3.1 `react-hooks/rules-of-hooks` en `plan.tsx` — 🟢 corregido en esta sesión

**Hallazgo**: 3 errores de ESLint (`useMemo` llamado condicionalmente / después de un return temprano) en el archivo más grande y más usado de la app. Este patrón puede producir el error de React "Rendered more hooks than during the previous render" y crashear la pantalla del plan según el flujo de datos del usuario (ej. al alternar entre estados de carga).

**Corrección**: los `useMemo` se movieron al tope del componente, antes de cualquier `return` condicional, preservando el resultado memoizado con las mismas dependencias.

### 3.2 Otros errores críticos de ESLint — 🟢 corregidos los de riesgo real / 🔴 el resto documentado como deuda

De los 79 errores y 62 warnings totales, se priorizaron y corrigieron los que representan **riesgo real de comportamiento incorrecto en producción** (no solo estilo):

- `react-hooks/set-state-in-effect` en `CookieConsentBanner.tsx`, `transformacion-fitplan.tsx` (ES/EN) — `setState` síncrono dentro de `useEffect` sin guardas, puede producir renders en cascada.
- `react-hooks/static-components` en `MonthChangesModal.tsx` — el subcomponente `CambioIndicator` se recreaba en cada render (definido dentro del componente padre), lo que resetea su estado local y degrada el reconciliado de React en cada apertura del modal.

**Quedan documentados pero no corregidos** (deuda de estilo/tipos, sin riesgo de crash inmediato): `@typescript-eslint/no-explicit-any` disperso (`saveMonthlySnapshot.ts`, `authStore.ts`, `FoodTrackingModal.tsx`, `calculations.ts`), `react/no-unescaped-entities` en páginas legales, `@next/next/no-html-link-for-pages` en `LandingLangToggle.tsx`, y varios `no-unused-vars`/`exhaustive-deps` en `plan.tsx`, `GymCalendarModal.tsx`. Ninguno de estos rompe la app; son limpieza recomendada para una sesión futura dedicada a calidad de código.

### 3.3bis Verificación final de esta sesión

Al cerrar esta sesión se corrió `npx tsc --noEmit` y `npm run lint` sobre el estado final del repo:

- **TypeScript**: 0 errores en código de aplicación (`src/pages`, `src/components`, `src/lib`, `src/store`, `src/contexts`, `src/utils`). Los únicos 22 errores restantes están confinados a `src/__tests__/*` (ver §3.3, no corregido en esta sesión — es deuda de configuración de tests, no del código de producción).
- **ESLint**: bajó de 141 problemas (79 errores / 62 warnings) a 128 (67 errores / 61 warnings). La diferencia son los errores de riesgo real corregidos en §3.1/§3.2; el resto son warnings de estilo (`no-unused-vars`, `exhaustive-deps`) y `no-explicit-any`/`no-unescaped-entities` documentados como deuda no crítica.
- **`npm run build`**: no se pudo ejecutar en este entorno de trabajo por versión de Node desactualizada (18.20, Next.js 16 requiere ≥20.9) — **preexistente, no causado por los cambios de esta sesión**. Recomendado correr `npm run build` en tu máquina/CI antes de deployar para confirmar que compila en producción, ya que esta sesión no pudo verificarlo con ese paso final.

### 3.3 Test suite rota — 🟢 corregido en sesión 2

Ver §0. `npm test` no corría absolutamente nada por un `jest.config.ts` obsoleto colisionando con `jest.config.mjs` — borrado. `tsconfig.json` excluye ahora `cypress/` y `cypress.config.ts`, eliminando la colisión de tipos que causaba ~22 falsos positivos en `tsc --noEmit`. Se arregló el drift de fixture en `intakeFormSchema.test.ts`, se reescribió `index.form.test.tsx` (aserteaba sobre un wizard que ya no vive en la home) y se agregó un mock de `IntersectionObserver` en `jest.setup.ts` (framer-motion lo necesita y jsdom no lo provee), y se borró `aiPlanGenerator.test.ts` (importaba un módulo que nunca existió). Estado actual: 0 errores de `tsc --noEmit` en todo el repo, 24 tests pasando en 5 suites. Cypress (`cypress/e2e/home.cy.ts`) sigue siendo un único smoke test — no se amplió la cobertura E2E en esta sesión.

### 3.4 Endpoint admin muerto — 🔴 pendiente (bajo impacto)

`src/pages/api/admin/users.ts` devuelve siempre HTTP 501 (documentado en el propio código: el SDK cliente de Firebase no puede autenticarse en contexto de servidor). El listado de usuarios real ocurre leyendo Firestore directo desde el cliente. Es código muerto — se puede borrar con seguridad cuando haya tiempo de limpieza.

### 3.5 Capacitor (empaquetado móvil) desconectado — 🔴 documentado, no prioridad (decisión del fundador)

`next.config.ts` no tiene `output: "export"`, que es lo que Capacitor necesita para empaquetar `out/` como app nativa. Además, esta app depende fuertemente de API routes (pagos, IA, admin), que son incompatibles con export estático puro — habría que resolver esa tensión (ej. un cliente que hable con la API desplegada en Vercel en vez de rutas locales) antes de que Capacitor genere algo funcional. Sin acción en esta sesión, según lo definido.

---

## 4. Deuda estructural (no corregida en esta sesión — recomendaciones)

Estos ítems no son "bugs" pero son lo que más va a costar mantener solo como fundador a medida que el producto crece:

- **4 archivos concentran la mayoría de la lógica**: `AdminApp.tsx` (~8.000 líneas, las 3 vistas del admin + 9 modales en un solo archivo), `plan.tsx` (~5.800 líneas), `generatePlan.ts` (~3.000 líneas), `templatePlans.ts` (~1.700 líneas). Cualquier cambio pequeño en el admin obliga a navegar un archivo gigante, y el riesgo de introducir bugs al tocar una parte y romper otra es alto. **Recomendación**: la próxima vez que haya que tocar el admin, partir `AdminApp.tsx` por vista (`AdminDashboardView.tsx`, `AdminIntakeView.tsx`, `AdminFitplanView.tsx`) y sacar los modales a `src/components/admin/modals/`. No hace falta hacerlo todo de una vez — se puede migrar de forma incremental cada vez que se toque una sección.
- **Cobertura de tests muy baja** para el tamaño del código (6 archivos de test unitario, 1 test E2E). Las áreas de mayor riesgo de negocio (webhooks de pago, cálculo de macros/fases, expiración de premium) casi no tienen tests automáticos — hoy la validación es manual.
- **534 `console.log`/`console.error`/`console.warn`** en `src/`, incluyendo logs que imprimen el payload completo de webhooks de pago en producción. Filtrar esto (dejar solo lo esencial, o pasar a un logger con niveles) reduce ruido y evita loguear datos potencialmente sensibles.
- **Librerías redundantes**: `exceljs` y `xlsx` conviven para la misma funcionalidad (exportar Excel). Vale la pena unificar en una sola.
- **`MULTIPHASE_CONTINUITY.md` y `PLAN_CONTINUITY.md` están vacíos** pese a que documentan una funcionalidad real y no trivial (continuidad de plan entre meses, con su propio modal y campos en Firestore). Recomendado llenarlos cuando se retome esa área, para no perder el criterio de diseño con el tiempo.

---

## 5. Qué está bien (para que quede explícito, no solo lo que falta)

- El **enrutamiento de pagos por país** (MercadoPago LATAM / Stripe resto del mundo) está bien resuelto y es una decisión de producto inteligente para un negocio con usuarios en Argentina/LATAM y Europa/US a la vez.
- Los **guardrails de plausibilidad** sobre los planes generados por IA (`trainingPlanGuards.ts`) muestran cuidado real en evitar que la IA devuelva algo peligroso o absurdo — es un detalle que la mayoría de las apps "wrapper de IA" no tienen.
- El **manejo offline** (caché local de planes, cola de sincronización de pesos con reintento) es una decisión de UX poco común en productos de este tamaño y mejora mucho la experiencia en conexiones inestables (relevante para el público LATAM).
- El **degradado gracioso cuando falta configuración** (`getDbSafe()`/`getAuthSafe()` devuelven `null` en vez de crashear si faltan env vars de Firebase) facilita desarrollo local y evita pantallas blancas por config faltante.
- El **modelo freemium con contenido realmente distinto** (plantillas vs. IA) en vez de solo poner un muro de pago es una buena estrategia: el usuario free ya prueba valor real antes de pagar.

---

## 6. Recomendaciones priorizadas (próximos pasos sugeridos)

1. **Corto plazo** (impacto alto, esfuerzo bajo): documentar todas las env vars en el README (✅ hecho); borrar `src/pages/api/admin/users.ts`; unificar `exceljs`/`xlsx`; configurar `MERCADOPAGO_WEBHOOK_SECRET` en producción (ver §2.2, el código ya lo soporta pero necesita la variable configurada en el panel de MercadoPago + Vercel).
2. **Mediano plazo**: mover el email de admin a env var + custom claim en vez de estar hardcodeado en 3+ lugares; agregar tests automáticos a los webhooks de pago (la lógica ya es correcta tras esta sesión, pero no hay test que la proteja de una futura regresión); adaptar contenido por patología médica también en el tier free (hoy solo se filtran lesiones/alergias, no las 15 condiciones médicas que sí cubre el prompt Premium).
3. **Largo plazo**: partir `AdminApp.tsx` y `plan.tsx` en módulos más chicos, de forma incremental; definir una estrategia real para Capacitor (o descartarlo formalmente) cuando vuelva a ser prioridad.

Ver también las sugerencias de producto/UI/growth que se comparten por fuera de este documento (no todo lo que mejora la conversión o la experiencia es un "bug" a documentar aquí).
