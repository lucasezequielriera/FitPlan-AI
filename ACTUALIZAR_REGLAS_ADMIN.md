# Actualizar Reglas de Firestore para Administrador

Para que el panel de administración funcione correctamente, necesitas actualizar las reglas de Firestore para permitir que el usuario "administrador" pueda leer y escribir todos los documentos de usuarios.

## Pasos:

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Selecciona tu proyecto
3. Ve a **Firestore Database** > **Rules**
4. Copia y pega el contenido del archivo `REGLAS_ADMIN_FIRESTORE.txt`
5. Haz clic en **"Publish"**
6. Espera 10-20 segundos para que se propaguen

## Nota Importante:

Las reglas de Firestore incluyen una función helper `isAdmin()` que verifica si el usuario autenticado:
- Tiene el email `admin@fitplan-ai.com` (recomendado), O
- Tiene el nombre "administrador" (sin importar mayúsculas/minúsculas)

**Asegúrate de que el usuario que quieres usar como administrador tenga:**
- El email `admin@fitplan-ai.com` en su perfil de usuario en Firestore, O
- El nombre "administrador" en su perfil

## Cómo verificar:

1. En Firebase Console, ve a **Firestore Database** > **Data**
2. Selecciona la colección `usuarios`
3. Encuentra el documento del usuario administrador (por su `uid`)
4. Verifica que el campo `nombre` sea exactamente "administrador" (puede estar en minúsculas, mayúsculas o mixto, la función es case-insensitive)

