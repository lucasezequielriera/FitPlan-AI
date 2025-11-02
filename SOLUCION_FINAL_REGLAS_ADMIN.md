# Solución Final: Reglas de Firestore para Administrador

## El Problema

Las reglas actuales fallan porque cuando haces una query a toda la colección `usuarios`, Firestore evalúa la función `isAdmin()` para cada documento, y si hay algún problema con `get()` o `exists()`, falla la query completa.

## Solución Recomendada

### Opción 1: Reglas Simplificadas (RECOMENDADO)

Copia y pega estas reglas en Firebase Console > Firestore Database > Rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAdmin() {
      return exists(/databases/$(database)/documents/usuarios/$(request.auth.uid))
        && (
          get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.email != null
          && get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.email.toLowerCase() == 'admin@fitplan-ai.com'
          ||
          get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.nombre != null
          && get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.nombre.toLowerCase() == 'administrador'
        );
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

### Opción 2: Verificar Manualmente en Firebase Console

1. Ve a **Firestore Database > Rules**
2. En la parte inferior, haz clic en **"Rules playground"**
3. Configura:
   - **Location**: `/databases/(default)/documents/usuarios/{userId}`
   - **Authenticated**: Sí
   - **User ID**: El UID de tu usuario administrador
   - **Operation**: Read
   - **Document ID**: Cualquier ID de usuario existente
4. Haz clic en **"Run"**
5. Debería decir **"Allow"** si las reglas funcionan correctamente
6. Si dice **"Deny"**, hay un problema con la función `isAdmin()`

## Pasos de Verificación

1. **Verifica el documento del admin en Firestore:**
   - Debe existir en `/usuarios/{tu-uid}`
   - Debe tener `email: "admin@fitplan-ai.com"`
   - Debe tener `nombre: "administrador"` (o al menos uno de los dos)

2. **Verifica que las reglas estén publicadas:**
   - En Firebase Console > Rules, verifica que ves las reglas actualizadas
   - Haz clic en "Publish" si ves cambios pendientes

3. **Prueba en la consola del navegador:**
   - Abre la consola (F12)
   - Deberías ver estos logs:
     - "✅ Verificación de admin exitosa, cargando usuarios..."
     - "🔍 Intentando leer colección de usuarios..."
     - Si hay error, verás el código y mensaje específico

4. **Si sigue fallando, prueba las reglas simplificadas:**
   - Usa el archivo `REGLAS_ADMIN_FIRESTORE_SIMPLIFICADAS.txt`
   - Copia y pega esas reglas
   - Publica y espera 30 segundos

