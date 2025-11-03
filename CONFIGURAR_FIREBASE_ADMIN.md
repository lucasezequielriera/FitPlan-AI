# 🔧 Configurar Firebase Admin SDK

## ¿Por qué Firebase Admin SDK?

Firebase Admin SDK se ejecuta en el servidor y **bypass las reglas de Firestore**, permitiendo leer/escribir datos sin restricciones. Esto es perfecto para endpoints API que necesitan acceso administrativo.

## Pasos para Configurar

### 1. Obtener las Credenciales de Servicio

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Selecciona tu proyecto `fitplan-ai`
3. Ve a **⚙️ Configuración del proyecto** → **Cuentas de servicio**
4. Haz clic en **Generar nueva clave privada**
5. Se descargará un archivo JSON con las credenciales

### 2. Extraer las Variables Necesarias

Del archivo JSON descargado, necesitas:
- `private_key` → será `FIREBASE_ADMIN_PRIVATE_KEY`
- `client_email` → será `FIREBASE_ADMIN_CLIENT_EMAIL`
- `project_id` → ya deberías tenerlo como `NEXT_PUBLIC_FIREBASE_PROJECT_ID`

### 3. Agregar Variables de Entorno

Agrega estas variables a tu archivo `.env.local`:

```env
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_ADMIN_CLIENT_EMAIL="firebase-adminsdk-xxxxx@fitplan-ai.iam.gserviceaccount.com"
```

**Importante:**
- El `private_key` debe incluir los `\n` literales (se convertirán automáticamente)
- O puedes copiar todo el contenido del campo `private_key` tal cual viene del JSON

### 4. Para Vercel (Producción)

1. Ve a tu proyecto en Vercel
2. Settings → Environment Variables
3. Agrega las mismas variables:
   - `FIREBASE_ADMIN_PRIVATE_KEY`
   - `FIREBASE_ADMIN_CLIENT_EMAIL`

## ✅ Verificación

Una vez configurado, el endpoint `/api/admin/stats` debería funcionar sin problemas de permisos.

## 🔒 Seguridad

- **NUNCA** subas el archivo JSON de credenciales a Git
- **NUNCA** expongas las credenciales en el código del cliente
- Solo usa Admin SDK en endpoints API del servidor

