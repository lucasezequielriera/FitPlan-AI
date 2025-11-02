# ⚠️ INSTRUCCIONES FINALES: Actualizar Reglas de Firestore

## Problema Actual

El error "Missing or insufficient permissions" ocurre porque las reglas de Firestore están usando `exists()` dentro de la función `isAdmin()`, lo cual puede causar problemas cuando se evalúan las reglas para queries a colecciones completas.

## Solución: Reglas Simplificadas

He creado una versión simplificada que solo verifica por **email** (que es más confiable que el nombre).

### Pasos:

1. **Abre Firebase Console**: https://console.firebase.google.com/
2. **Selecciona tu proyecto**
3. **Ve a Firestore Database** > **Rules**
4. **BORRA TODO** el contenido actual
5. **Copia y pega EXACTAMENTE esto:**

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAdmin() {
      let adminDoc = get(/databases/$(database)/documents/usuarios/$(request.auth.uid));
      return adminDoc.data.email != null 
        && adminDoc.data.email.toLowerCase() == 'admin@fitplan-ai.com';
    }
    
    match /usuarios/{userId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if request.auth != null && request.auth.uid == userId;
      allow read: if request.auth != null && isAdmin();
      allow write: if request.auth != null && isAdmin();
      allow update: if (
        request.resource.data.diff(resource.data).affectedKeys().hasOnly(['premium', 'premiumStatus', 'premiumSince', 'premiumPayment', 'updatedAt'])
        && request.resource.data.premium == true
      );
      allow create: if request.auth != null && request.auth.uid == userId;
    }
    
    match /planes/{planId} {
      allow create: if request.auth != null && request.resource.data.userId == request.auth.uid;
      allow read: if request.auth != null && resource.data.userId == request.auth.uid;
      allow update: if request.auth != null && resource.data.userId == request.auth.uid;
      allow delete: if request.auth != null && resource.data.userId == request.auth.uid;
    }
  }
}
```

6. **Haz clic en "Publish"**
7. **Espera 30 segundos** para que se propaguen
8. **Recarga la página `/admin`**

## Verificación

Después de actualizar las reglas:

1. **Verifica en Firebase Console** que el documento del usuario administrador tenga:
   - `email: "admin@fitplan-ai.com"` ✅
   - El nombre puede ser cualquier cosa (no se usa en estas reglas)

2. **Recarga la página** `/admin`

3. **Abre la consola del navegador (F12)** y verifica:
   - `✅ Verificación de admin exitosa, cargando usuarios...`
   - `✅ Colección leída exitosamente, usuarios encontrados: X`

## Si Sigue Fallando

Si después de esto aún tienes el error:

1. Verifica que el email en el documento sea EXACTAMENTE `admin@fitplan-ai.com` (sin espacios, minúsculas)
2. Verifica que las reglas se publicaron correctamente (deberías ver "Published" en Firebase Console)
3. Prueba cerrar sesión y volver a iniciar sesión
4. Espera 1-2 minutos después de publicar las reglas antes de probar

