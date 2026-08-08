# Kit de alta en directorios — FitPlan AI

Textos listos para copiar y pegar. Casi todos los directorios piden los mismos
campos con límites de caracteres distintos, así que están preparados en varias
longitudes.

Los campos marcados **[CONFIRMAR]** los tienes que rellenar tú: son datos que
no puedo verificar desde el código.

---

## Datos básicos

| Campo | Valor |
|---|---|
| Nombre | FitPlan AI |
| URL | https://www.fitplan-ai.com |
| Categoría principal | Health & Fitness / Salud y Fitness |
| Categorías secundarias | Nutrition, Personal Training, AI Tools, SaaS |
| Fundación | 2025 |
| Sede | Madrid, España |
| Tamaño del equipo | 1 (fundador) |
| Email de contacto | hola@fitplan-ai.com *(pendiente — ver sección Email)* |
| Modelo | Freemium + suscripción de pago |
| Precio | Desde 2,08 €/mes — ver tabla de precios |
| Idiomas | Español, Inglés |

## Logotipos

- Cuadrado con fondo: `https://www.fitplan-ai.com/brand/icon-social.png` (1080×1080)
- Cuadrado transparente: `https://www.fitplan-ai.com/brand/icon-social-transparent.png`
- Vectorial: `https://www.fitplan-ai.com/brand/icon-social-transparent.svg`

---

## Textos por longitud

**Tagline (máx. 60 car.)**
> Planes de nutrición y entrenamiento personalizados con IA

**Tagline en inglés (máx. 60 car.)**
> AI-powered nutrition and training plans

**Descripción corta (máx. 100 car.)**
> Crea tu plan de alimentación y entrenamiento con IA, adaptado a tu objetivo y a tu nivel.

**Descripción media (máx. 160 car.) — la que más se usa**
> Crea tu plan de alimentación y entrenamiento con IA: menús semanales con ingredientes exactos, rutinas de gym según tu nivel, macros y seguimiento en PDF.

**Descripción media en inglés (máx. 160 car.)**
> Build your personalised meal and training plan with AI: weekly menus with exact ingredients, gym routines matched to your level, macros and PDF export.

**Descripción larga (~300 car.)**
> FitPlan AI genera planes de alimentación y entrenamiento personalizados a partir de tu objetivo, tu nivel, tus lesiones y el material del que dispones. Incluye menús semanales con ingredientes y cantidades exactas, rutinas de gimnasio, cálculo de macros, seguimiento de progreso y exportación a PDF. Para quien quiere acompañamiento humano, ofrece además coaching 1:1 con revisión y ajuste mensual del plan.

**Descripción larga en inglés (~300 car.)**
> FitPlan AI builds personalised nutrition and training plans from your goal, training level, injuries and available equipment. It includes weekly meal plans with exact ingredients and quantities, gym routines, macro tracking, progress monitoring and PDF export. For those who want human support, it also offers 1:1 coaching with monthly plan reviews and adjustments.

---

## Palabras clave

`plan nutricional personalizado`, `entrenamiento con IA`, `dieta personalizada`,
`rutina de gimnasio`, `cálculo de macros`, `seguimiento de progreso`,
`coaching fitness online`, `nutrición deportiva`, `recomposición corporal`

---

## Qué diferencia a FitPlan (para los campos de "por qué sois distintos")

1. El plan se **recalcula cada mes** con tu progreso real, no es un PDF estático.
2. Combina **IA y coach humano**: la IA genera y ajusta, el coach corrige.
3. Los menús traen **ingredientes y cantidades exactas**, no "150 g de proteína".
4. Tiene en cuenta **lesiones y material disponible**, no solo objetivo y peso.

---

## Orden de alta recomendado

1. Trustpilot
2. Google Business Profile
3. Bing Places
4. Crunchbase
5. AlternativeTo
6. Product Hunt (solo cuando tengas el lanzamiento preparado)
7. Startupxplore

Tras cada alta que genere una URL pública nueva, no hace falta hacer nada en el
sitio: los enlaces los descubren ellos. Si tocas una landing propia, avisa a
Bing con `POST /api/admin/indexNowSubmit`.

---

## Precios

Usa **siempre** los precios reales. Un precio publicado que no coincida con el
del checkout genera disputas de cobro y reseñas negativas justo en las
plataformas que estás usando para generar confianza.

| Plan | EUR | USD | Equivalente mensual |
|---|---|---|---|
| Mensual | 5 € | 5,99 $ | — |
| Trimestral | 12 € | 13,99 $ | 4 €/mes (−20 %) |
| Anual | 25 € | 26,99 $ | **2,08 €/mes (−58 %)** |

Gancho para el campo de precio: **«Desde 2,08 €/mes»**. Es el dato más
atractivo que hay y además es cierto y verificable, que es justo lo que hace
que funcione.

Fuente: `src/lib/stripePlanPrices.ts`. Si cambian los precios, actualiza las
fichas ya publicadas.

---

## Email de dominio propio (pendiente)

Estado actual: el DNS está en Hostinger y el dominio **no tiene registros MX**,
así que hoy no puede recibir correo. Varios directorios penalizan un contacto
en Gmail.

Solución con ImprovMX (gratis, sin migrar el DNS):

1. Dar de alta `fitplan-ai.com` en improvmx.com
2. En Hostinger, DNS Zone Editor, añadir dos registros MX:
   - `mx1.improvmx.com` con prioridad 10
   - `mx2.improvmx.com` con prioridad 20
3. Crear el alias `hola@fitplan-ai.com` apuntando al Gmail del proyecto
4. Para poder enviar desde esa dirección: Gmail, Configuración, Cuentas,
   "Enviar como", usando las credenciales de `INTAKE_SMTP_*`

Aviso: el SPF actual es `v=spf1 include:_spf.firebasemail.com ~all`. Si se
envía desde otro SMTP hay que incluirlo también en ese registro, o los correos
acabarán en spam.
