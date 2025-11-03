# 🔧 Reglas de Firestore Actualizadas

## Problema
Error: `Missing or insufficient permissions` al intentar leer la colección de usuarios para contar estadísticas.

## Solución
Las reglas actuales están bien estructuradas, pero necesitas **actualizarlas en Firebase Console**.

## Instrucciones

### Paso 1: Abrir Firebase Console
1. Ve a https://console.firebase.google.com/
2. Selecciona tu proyecto `fitplan-ai`

### Paso 2: Ir a Firestore Rules
1. En el menú lateral, haz clic en **Firestore Database**
2. Haz clic en la pestaña **Rules**

### Paso 3: Copiar las Reglas
Copia **TODO** el contenido del archivo `firestore.rules`:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Función para verificar si el usuario es administrador
    // Optimizada para queries de colección
    function isAdmin() {
      return request.auth != null
        && exists(/databases/$(database)/documents/usuarios/$(request.auth.uid))
        && get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.email != null
        && get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.email.toLowerCase() == 'admin@fitplan-ai.com';
    }
    
    match /usuarios/{userId} {
      // ORDEN IMPORTANTE: Primero verificar si es admin (para queries de colección)
      // Luego verificar si es el propio usuario
      
      // Administrador puede leer/escribir TODOS los usuarios (incluyendo queries de colección)
      // Esta regla debe estar PRIMERO para que funcione con queries
      allow read: if request.auth != null && isAdmin();
      allow write: if request.auth != null && isAdmin();
      
      // Usuarios pueden leer/escribir su propio perfil
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if request.auth != null && request.auth.uid == userId;
      
      // Permitir crear documento si es el propio usuario
      allow create: if request.auth != null && request.auth.uid == userId;
      
      // Permitir actualización de campos premium desde el servidor
      allow update: if (
        request.resource.data.diff(resource.data).affectedKeys().hasOnly(['premium', 'premiumStatus', 'premiumSince', 'premiumPayment', 'updatedAt'])
        && request.resource.data.premium == true
      );
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

### Paso 4: Pegar y Publicar
1. **BORRA** todo el contenido actual en el editor de reglas
2. **PEGA** las nuevas reglas copiadas arriba
3. Haz clic en **Publish** (Publicar)

### Paso 5: Verificar
1. Espera 10-30 segundos después de publicar
2. Recarga la página del admin en tu aplicación
3. Los contadores deberían cargar correctamente

## ⚠️ Importante

- **El orden de las reglas es crítico**: La regla de admin debe estar **PRIMERO** para que funcione con queries de colección
- **Asegúrate de que tu documento de usuario tenga el email correcto**: `admin@fitplan-ai.com`
- **Las reglas pueden tardar unos segundos en propagarse** después de publicarlas

## 🔍 Verificación

Para verificar que las reglas están funcionando:
1. Abre la consola del navegador (F12)
2. Deberías ver: `✅ Estadísticas cargadas: Total=X, Premium=Y, Regular=Z, Atléticos=W`
3. Los contadores en el dashboard deberían mostrar números reales

