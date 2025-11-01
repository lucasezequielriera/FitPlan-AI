# 🚀 Guía Paso a Paso: Desplegar FitPlan AI en Vercel

## ✅ Pre-requisitos Completados

- ✅ Archivo `vercel.json` creado (configura timeouts de 60s para API routes)
- ✅ Todos los archivos de configuración agregados a Git
- ✅ `.gitignore` configurado (`.env.local` no se subirá)

---

## Paso 1: Subir código a GitHub/GitLab/Bitbucket

### Si ya tienes un repositorio remoto:

```bash
cd /Users/lucasriera/Desktop/fitplan-ai
git push origin master
```

### Si NO tienes un repositorio remoto aún:

1. **Crea un nuevo repositorio en GitHub:**
   - Ve a https://github.com/new
   - Nombre sugerido: `fitplan-ai`
   - **NO** inicialices con README, .gitignore o license (ya los tienes)
   - Haz clic en "Create repository"

2. **Conecta tu repositorio local:**

```bash
cd /Users/lucasriera/Desktop/fitplan-ai
git remote add origin https://github.com/TU_USUARIO/fitplan-ai.git
git push -u origin master
```

**Nota:** Reemplaza `TU_USUARIO` con tu usuario de GitHub.

---

## Paso 2: Crear cuenta en Vercel

1. Ve a https://vercel.com
2. Haz clic en **"Sign Up"**
3. **Recomendado:** Inicia sesión con GitHub (más fácil para conectar repositorios)
4. Autoriza Vercel para acceder a tus repositorios de GitHub

---

## Paso 3: Importar proyecto en Vercel

1. En el dashboard de Vercel, haz clic en **"Add New..."** → **"Project"**
2. Verás una lista de tus repositorios de GitHub
3. **Encuentra y haz clic en `fitplan-ai`** (o el nombre que le hayas dado)
4. Haz clic en **"Import"**

---

## Paso 4: Configurar proyecto

Vercel detectará automáticamente que es Next.js, pero vamos a verificar:

### 4.1 Framework Preset
- Debería decir: **"Next.js"** ✅
- Si no, selecciónalo manualmente

### 4.2 Build Settings
- **Build Command:** `npm run build` (automático)
- **Output Directory:** `.next` (automático)
- **Install Command:** `npm install` (automático)

**No necesitas cambiar nada aquí** a menos que tengas necesidades especiales.

### 4.3 ⚠️ IMPORTANTE: Variables de Entorno

**ESTE ES EL PASO MÁS IMPORTANTE.** Antes de hacer deploy, agrega TODAS las variables:

1. Haz clic en **"Environment Variables"**
2. Agrega cada variable una por una:

#### Variables de OpenAI:
```
Nombre: OPENAI_API_KEY
Valor: [Tu API Key de OpenAI]
```

#### Variables de Firebase:
```
Nombre: NEXT_PUBLIC_FIREBASE_API_KEY
Valor: [Tu Firebase API Key]

Nombre: NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
Valor: [Tu dominio de Firebase, ej: proyecto.firebaseapp.com]

Nombre: NEXT_PUBLIC_FIREBASE_PROJECT_ID
Valor: [Tu Project ID de Firebase]

Nombre: NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
Valor: [Tu Storage Bucket, ej: proyecto.appspot.com]

Nombre: NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
Valor: [Tu Messaging Sender ID]

Nombre: NEXT_PUBLIC_FIREBASE_APP_ID
Valor: [Tu App ID de Firebase]
```

#### Variables de MercadoPago:
```
Nombre: MERCADOPAGO_ACCESS_TOKEN
Valor: [Tu Access Token de PRODUCCIÓN de MercadoPago]

Nombre: NEXT_PUBLIC_BASE_URL
Valor: https://tu-proyecto.vercel.app
```

**Notas importantes:**
- Para `NEXT_PUBLIC_BASE_URL`, inicialmente usa la URL que Vercel te dará (algo como `https://fitplan-ai-xyz.vercel.app`)
- Después del primer deploy, podrás actualizar esta variable con tu dominio personalizado
- **IMPORTANTE:** `MERCADOPAGO_ACCESS_TOKEN` debe ser el token de **PRODUCCIÓN**, no el de prueba

3. **Marca todas las casillas** (Production, Preview, Development) para cada variable
4. Haz clic en **"Save"** para cada variable

---

## Paso 5: Desplegar

1. Haz clic en **"Deploy"** (abajo a la derecha)
2. Vercel comenzará a construir tu aplicación
3. Verás un log en tiempo real del proceso de build
4. Esto tomará aproximadamente **2-3 minutos**

### Durante el build, verás:
```
✓ Installing dependencies
✓ Building project
✓ Generating static pages
✓ Finalizing build
```

---

## Paso 6: Verificar el despliegue

Una vez completado, verás:
- ✅ **"Congratulations!"** 
- Una URL tipo: `https://fitplan-ai-xyz.vercel.app`

1. **Haz clic en la URL** para ver tu aplicación en vivo
2. Prueba crear una cuenta de usuario
3. Prueba generar un plan

---

## Paso 7: Actualizar NEXT_PUBLIC_BASE_URL

Una vez que tengas la URL de Vercel:

1. Ve a **Settings** → **Environment Variables**
2. Encuentra `NEXT_PUBLIC_BASE_URL`
3. Haz clic en **"Edit"**
4. Actualiza el valor con tu URL de Vercel: `https://tu-proyecto.vercel.app`
5. Guarda
6. Ve a **Deployments** → Haz clic en **"..."** del último deployment → **"Redeploy"**

---

## Paso 8: Configurar dominio personalizado (Opcional)

Si tienes un dominio propio (ej: `fitplan.com.ar`):

1. En el proyecto, ve a **Settings** → **Domains**
2. Ingresa tu dominio: `fitplan.com.ar`
3. Haz clic en **"Add"**
4. Vercel te dará instrucciones para configurar DNS:
   - Opción A: Agrega un registro **CNAME** apuntando a `cname.vercel-dns.com`
   - Opción B: Agrega registros **A** con las IPs que Vercel te proporcionará
5. Una vez configurado el DNS, espera unos minutos para que se propague
6. Vercel configurará SSL automáticamente

**Después de configurar el dominio:**
1. Actualiza `NEXT_PUBLIC_BASE_URL` a: `https://fitplan.com.ar`
2. Haz un redeploy

---

## Paso 9: Configurar Webhook de MercadoPago

1. Ve a tu cuenta de MercadoPago Developers
2. Selecciona tu aplicación de **PRODUCCIÓN**
3. Busca la sección de **Webhooks**
4. Configura la URL del webhook:
   ```
   https://tu-proyecto.vercel.app/api/payment/webhook
   ```
   (O tu dominio personalizado si lo configuraste)
5. Guarda los cambios

---

## Paso 10: Verificar que todo funcione

### Checklist de pruebas:

- [ ] La aplicación carga correctamente
- [ ] Puedo crear una cuenta de usuario
- [ ] Puedo iniciar sesión
- [ ] Puedo generar un plan nutricional
- [ ] Los planes se guardan correctamente
- [ ] El dashboard muestra mis planes
- [ ] El botón de Premium funciona
- [ ] Los pagos de MercadoPago se procesan (si estás en producción)
- [ ] El webhook de MercadoPago funciona (revisa logs en Vercel)

---

## Problemas Comunes y Soluciones

### ❌ Error: "Build failed"

**Solución:**
1. Revisa los logs en Vercel para ver el error específico
2. Verifica que `npm run build` funciona localmente:
   ```bash
   npm run build
   ```
3. Asegúrate de que todas las variables de entorno estén configuradas

### ❌ Error: "Function exceeded maximum duration"

**Solución:**
- Esto significa que una API route tomó más de 10 segundos (plan gratis)
- Tus llamadas a OpenAI toman ~35 segundos, así que necesitarás el **Plan Pro ($20/mes)**
- Para hacer upgrade:
  1. Ve a **Settings** → **Plan**
  2. Selecciona **Pro**
  3. Completa el pago

### ❌ Error: "Environment variable not found"

**Solución:**
- Verifica que agregaste TODAS las variables de entorno
- Asegúrate de que están marcadas para "Production"
- Revisa que no haya espacios extra en los nombres de las variables

### ❌ La aplicación funciona pero los pagos no

**Solución:**
- Verifica que `MERCADOPAGO_ACCESS_TOKEN` es de **PRODUCCIÓN**, no de prueba
- Verifica que `NEXT_PUBLIC_BASE_URL` está configurado correctamente
- Revisa los logs en Vercel para ver errores específicos

### ❌ Firebase no funciona

**Solución:**
- Verifica que todas las variables de Firebase están correctas
- Asegúrate de que las reglas de Firestore permiten lectura/escritura de usuarios autenticados
- Revisa la consola del navegador para ver errores específicos

---

## Actualizaciones Futuras

Cada vez que hagas cambios:

1. Haz commit y push a Git:
   ```bash
   git add .
   git commit -m "Descripción del cambio"
   git push
   ```

2. Vercel detectará automáticamente los cambios
3. Construirá una nueva versión
4. Desplegará automáticamente (en preview si es una rama distinta a master/main)

**No necesitas hacer nada más** - ¡es automático! 🎉

---

## Recursos Útiles

- **Dashboard de Vercel:** https://vercel.com/dashboard
- **Documentación de Vercel:** https://vercel.com/docs
- **Logs en tiempo real:** En el dashboard de Vercel, haz clic en tu proyecto → "Deployments" → Selecciona un deployment → "Logs"

---

## ¿Necesitas ayuda?

Si encuentras algún problema durante el despliegue:
1. Revisa los logs en Vercel
2. Verifica que todas las variables de entorno estén configuradas
3. Asegúrate de que el build funciona localmente
4. Consulta la documentación de Vercel

¡Listo! Tu aplicación debería estar funcionando en Vercel. 🚀

