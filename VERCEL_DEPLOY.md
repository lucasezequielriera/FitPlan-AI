# Guía de Despliegue en Vercel

Esta es la forma más fácil y recomendada de desplegar FitPlan AI.

## Paso 1: Preparar tu código

### 1.1 Subir a Git (si no lo has hecho)

```bash
# Si no tienes Git inicializado
git init
git add .
git commit -m "Preparado para producción"

# Sube a GitHub/GitLab/Bitbucket
git remote add origin <tu-repositorio>
git push -u origin main
```

**Importante:** Asegúrate de que `.env.local` esté en `.gitignore` (ya está incluido).

## Paso 2: Crear cuenta en Vercel

1. Ve a https://vercel.com
2. Haz clic en "Sign Up"
3. Inicia sesión con GitHub/GitLab/Bitbucket (recomendado) o email

## Paso 3: Importar proyecto

1. En el dashboard de Vercel, haz clic en "Add New..." → "Project"
2. Importa tu repositorio Git (GitHub, GitLab o Bitbucket)
3. Vercel detectará automáticamente que es Next.js

## Paso 4: Configurar el proyecto

### 4.1 Configuración del build

Vercel detectará automáticamente:
- **Framework Preset**: Next.js
- **Build Command**: `npm run build` (automático)
- **Output Directory**: `.next` (automático)

**No necesitas cambiar nada aquí a menos que tengas necesidades especiales.**

### 4.2 Variables de entorno

**MUY IMPORTANTE:** Agrega todas las variables de entorno en el panel de Vercel antes de desplegar.

En la sección "Environment Variables", agrega:

```
OPENAI_API_KEY
=tu_api_key_de_openai_produccion

NEXT_PUBLIC_FIREBASE_API_KEY
=tu_api_key_de_firebase

NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
=tu_proyecto.firebaseapp.com

NEXT_PUBLIC_FIREBASE_PROJECT_ID
=tu_proyecto_id

NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
=tu_proyecto.appspot.com

NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
=tu_sender_id

NEXT_PUBLIC_FIREBASE_APP_ID
=tu_app_id

MERCADOPAGO_ACCESS_TOKEN
=tu_access_token_de_produccion_mercadopago

NEXT_PUBLIC_BASE_URL
=https://tu-proyecto.vercel.app
```

**Notas importantes:**
- Las variables que empiezan con `NEXT_PUBLIC_` son accesibles en el cliente
- `MERCADOPAGO_ACCESS_TOKEN` debe ser el token de **PRODUCCIÓN** (no el de prueba)
- `NEXT_PUBLIC_BASE_URL` inicialmente será tu URL de Vercel, luego actualiza con tu dominio personalizado

### 4.3 Deploy Settings

En "Deploy Settings", puedes dejar todo por defecto o personalizar:
- **Build Command**: `npm run build` (por defecto)
- **Output Directory**: `.next` (por defecto)
- **Install Command**: `npm install` (por defecto)

## Paso 5: Desplegar

1. Haz clic en "Deploy"
2. Vercel construirá tu aplicación (esto tomará 1-2 minutos)
3. Una vez completado, tendrás una URL tipo: `https://fitplan-ai-xyz.vercel.app`

## Paso 6: Configurar dominio personalizado (opcional)

1. En el proyecto, ve a "Settings" → "Domains"
2. Agrega tu dominio (ej: `fitplan.com.ar`)
3. Sigue las instrucciones para configurar los DNS:
   - Agrega un registro CNAME apuntando a `cname.vercel-dns.com`
   - O un registro A según las instrucciones de Vercel

4. Una vez configurado el dominio, **actualiza** la variable de entorno:
   ```
   NEXT_PUBLIC_BASE_URL=https://tu-dominio.com
   ```
5. Haz un nuevo deploy (o espera a que Vercel lo haga automáticamente)

## Paso 7: Configurar webhook de MercadoPago

1. Ve a tu cuenta de MercadoPago Developers
2. Selecciona tu aplicación de producción
3. Configura el webhook URL: `https://tu-dominio.com/api/payment/webhook`
   - O si aún no tienes dominio: `https://tu-proyecto.vercel.app/api/payment/webhook`
4. Guarda los cambios

## Paso 8: Verificar despliegue

1. Visita tu URL de Vercel o dominio personalizado
2. Prueba crear una cuenta
3. Prueba generar un plan
4. Verifica que los pagos funcionen

## Actualizaciones Futuras

Cada vez que hagas un `git push` a tu repositorio:

1. Vercel detectará automáticamente los cambios
2. Construirá una nueva versión
3. Desplegará automáticamente (con preview si es una rama distinta a `main`)

**No necesitas hacer nada manualmente** - ¡es automático!

## Configuración Avanzada (Opcional)

### Configurar vercel.json (si es necesario)

Crea un archivo `vercel.json` en la raíz si necesitas configuraciones especiales:

```json
{
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "framework": "nextjs",
  "regions": ["iad1"],
  "functions": {
    "pages/api/**/*.ts": {
      "maxDuration": 60
    }
  }
}
```

**Nota:** El `maxDuration: 60` es para el plan Pro. En el plan Hobby (gratis) el máximo es 10 segundos, pero puedes hacer upgrade a Pro si necesitas más tiempo.

## Troubleshooting

### Error: "Build failed"
- Revisa los logs en el dashboard de Vercel
- Verifica que todas las variables de entorno estén configuradas
- Asegúrate de que `npm run build` funciona localmente

### Error: "Function exceeded maximum duration"
- Esto significa que una API route tomó más de 10s (plan gratis) o 60s (plan Pro)
- Para las llamadas a OpenAI que toman ~35s, necesitarás el plan Pro ($20/mes)
- O optimiza las llamadas a OpenAI (timeout más corto, respuesta más rápida)

### Error: "Environment variable not found"
- Verifica que agregaste todas las variables en el panel de Vercel
- Las variables deben estar en "Production", "Preview" y "Development" según corresponda

### Webhook de MercadoPago no funciona
- Verifica que `NEXT_PUBLIC_BASE_URL` esté configurado correctamente
- Asegúrate de que la URL del webhook sea accesible públicamente
- Revisa los logs en Vercel para ver si hay errores

## Costos

### Plan Hobby (Gratis)
- ✅ Bandwidth: 100GB/mes
- ✅ Builds ilimitados
- ✅ SSL incluido
- ⚠️ Timeout: 10 segundos (puede ser insuficiente para OpenAI)

### Plan Pro ($20/mes)
- ✅ Todo del plan Hobby
- ✅ Timeout: 60 segundos (perfecto para OpenAI)
- ✅ Bandwidth ilimitado
- ✅ Analytics avanzado
- ✅ Soporte prioritario

**Recomendación:** Empieza con el plan Hobby (gratis) y haz upgrade a Pro si necesitas los timeouts más largos.

## Seguridad

### Variables de entorno
- Nunca subas `.env.local` a Git (ya está en `.gitignore`)
- Usa el panel de Vercel para variables de entorno
- Rotación periódica de API keys

### Firestore Rules
- Asegúrate de que las reglas de Firestore en producción sean las correctas
- Revisa el archivo `firestore.rules` en el README

## Conclusión

Vercel es la opción más fácil y rápida para desplegar tu aplicación Next.js. En minutos tendrás tu aplicación online sin necesidad de configurar servidores, SSL, o deployment pipelines.

¿Necesitas ayuda con algún paso específico? Puedo asistirte.

