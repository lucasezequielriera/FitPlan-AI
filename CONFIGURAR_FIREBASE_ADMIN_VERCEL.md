# Configurar Firebase Admin SDK en Vercel

El panel de administración requiere Firebase Admin SDK para funcionar correctamente. Sigue estos pasos para configurarlo:

## Paso 1: Obtener las credenciales de Firebase

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Selecciona tu proyecto
3. Ve a **Project Settings** (⚙️) > **Service Accounts**
4. Haz clic en **"Generate new private key"**
5. Se descargará un archivo JSON con las credenciales

## Paso 2: Configurar variables de entorno en Vercel

1. Ve a tu proyecto en [Vercel Dashboard](https://vercel.com/dashboard)
2. Ve a **Settings** > **Environment Variables**
3. Agrega las siguientes variables:

### Variable 1: `FIREBASE_ADMIN_PRIVATE_KEY`
- **Value**: Copia el valor del campo `private_key` del JSON descargado
- **Important**: El valor debe incluir los `\n` (saltos de línea). Si Vercel los elimina, reemplázalos manualmente con `\n`
- **Example**: `-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQ...\n-----END PRIVATE KEY-----\n`

### Variable 2: `FIREBASE_ADMIN_CLIENT_EMAIL`
- **Value**: Copia el valor del campo `client_email` del JSON descargado
- **Example**: `firebase-adminsdk-xxxxx@tu-proyecto.iam.gserviceaccount.com`

### Variable 3: `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- **Value**: Copia el valor del campo `project_id` del JSON descargado
- **Note**: Esta variable probablemente ya esté configurada, pero verifica que sea correcta

## Paso 3: Redesplegar la aplicación

Después de agregar las variables de entorno:

1. Ve a **Deployments** en Vercel
2. Haz clic en los tres puntos (⋯) del último deployment
3. Selecciona **"Redeploy"**
4. O simplemente haz un nuevo push a tu repositorio

## Verificación

Una vez configurado, el panel de administración debería:
- ✅ Cargar la lista de usuarios correctamente
- ✅ Mostrar estadísticas (total, premium, regulares, atléticos)
- ✅ Permitir editar usuarios
- ✅ Mostrar el estado de pago de cada usuario

## Troubleshooting

Si aún ves errores:

1. **Verifica que las variables estén en el ambiente correcto**: Asegúrate de que las variables estén configuradas para **Production** (y también para Preview si quieres probar)

2. **Verifica el formato de `FIREBASE_ADMIN_PRIVATE_KEY`**: 
   - Debe incluir los saltos de línea `\n`
   - No debe tener comillas adicionales
   - Debe empezar con `-----BEGIN PRIVATE KEY-----`

3. **Revisa los logs de Vercel**: 
   - Ve a **Deployments** > Selecciona el deployment > **Functions** > Revisa los logs del endpoint `/api/admin/stats`

4. **Verifica que el email del admin sea correcto**: 
   - El código busca usuarios con email `admin@fitplan-ai.com`
   - Asegúrate de que tu usuario admin tenga ese email exacto

