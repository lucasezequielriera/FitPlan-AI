# Verificar Reglas de Firestore

Si sigues recibiendo el error "Missing or insufficient permissions", verifica lo siguiente:

## Pasos de Verificación

### 1. Verificar que las Reglas estén Publicadas

1. Ve a Firebase Console > Firestore Database > Rules
2. Verifica que las reglas que ves son las mismas que están en `REGLAS_ADMIN_FIRESTORE.txt`
3. **IMPORTANTE**: Asegúrate de haber hecho clic en **"Publish"** después de pegar las reglas
4. Espera al menos 30 segundos después de publicar

### 2. Verificar que el Documento del Administrador Exista

1. Ve a Firebase Console > Firestore Database > Data
2. Selecciona la colección `usuarios`
3. Busca el documento con el `uid` de tu usuario administrador (puedes verlo en Firebase Auth > Users)
4. Verifica que el documento tenga:
   ```json
   {
     "email": "admin@fitplan-ai.com",
     "nombre": "administrador"
   }
   ```

### 3. Verificar las Reglas Manualmente

Copia y pega EXACTAMENTE esto en Firebase Console > Firestore Database > Rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAdmin() {
      return exists(/databases/$(database)/documents/usuarios/$(request.auth.uid))
        && (
          (get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.email != null
           && get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.email.toLowerCase() == 'admin@fitplan-ai.com')
          || 
          (get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.nombre != null
           && get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.nombre.toLowerCase() == 'administrador')
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

### 4. Prueba Después de Actualizar

1. Cierra sesión completamente
2. Inicia sesión nuevamente con `admin@fitplan-ai.com`
3. Abre la consola del navegador (F12)
4. Busca el mensaje: "✅ Documento de administrador creado en Firestore"
5. Busca el mensaje: "✅ Verificación de admin exitosa, cargando usuarios..."
6. Si ves estos mensajes pero aún hay error, el problema está en las reglas

### 5. Si el Problema Persiste

Si después de seguir estos pasos aún tienes el error:
1. Verifica en la consola del navegador qué error específico aparece
2. Verifica en Firebase Console > Firestore Database > Rules si hay algún error de sintaxis
3. Asegúrate de que no haya espacios extra o caracteres especiales al copiar las reglas

