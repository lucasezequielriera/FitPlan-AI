# Solución al Error: "Missing or insufficient permissions"

## Problema

El error ocurre porque:
1. El documento del usuario administrador no existe en Firestore aún
2. Las reglas de Firestore necesitan que el documento exista para verificar si es admin
3. Cuando intentas leer todos los usuarios, las reglas verifican cada documento y fallan

## Solución Completa

### Paso 1: Actualizar las Reglas de Firestore

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Selecciona tu proyecto
3. Ve a **Firestore Database** > **Rules**
4. **Copia TODO el contenido** del archivo `REGLAS_ADMIN_FIRESTORE.txt` (o `REGLAS_ADMIN_FIRESTORE_FINAL.txt`)
5. **Pega las reglas** en el editor
6. **Haz clic en "Publish"**
7. **Espera 20-30 segundos** para que se propaguen completamente

### Paso 2: Verificar que el Documento Exista

1. Ve a **Firestore Database** > **Data**
2. Selecciona la colección `usuarios`
3. Busca el documento con tu `uid` (el mismo que aparece en Firebase Auth)
4. Si NO existe:
   - El código intentará crearlo automáticamente
   - Si no se crea automáticamente, créalo manualmente con estos campos:
     ```json
     {
       "email": "admin@fitplan-ai.com",
       "nombre": "administrador",
       "createdAt": [timestamp],
       "updatedAt": [timestamp]
     }
     ```

### Paso 3: Recargar la Página

Después de actualizar las reglas:
1. Cierra sesión completamente
2. Inicia sesión nuevamente con `admin@fitplan-ai.com`
3. Ve a `/admin`
4. Deberías poder ver todos los usuarios sin errores

## Verificación

Si aún tienes problemas:

1. Abre la consola del navegador (F12)
2. Busca el mensaje: "✅ Documento de administrador creado en Firestore"
3. Si no aparece, el documento no se está creando correctamente
4. Verifica que las reglas incluyan:
   ```javascript
   allow create: if request.auth != null && isAdmin();
   ```

## Nota Importante

Las reglas de Firestore verifican que el documento del usuario exista para determinar si es administrador. Por eso es crítico que:
- El documento se cree automáticamente al acceder al panel (el código lo hace)
- Las reglas permitan crear el documento si es administrador
- Las reglas estén actualizadas en Firebase Console

