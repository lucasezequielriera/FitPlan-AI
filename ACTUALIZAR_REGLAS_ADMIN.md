# 🔧 Instrucciones para Actualizar Reglas de Firestore

## Problema Actual
El admin panel está recibiendo `Missing or insufficient permissions` porque las reglas de Firestore no están actualizadas en Firebase Console.

## Solución: Actualizar Reglas en Firebase Console

### Paso 1: Abrir Firebase Console
1. Ve a https://console.firebase.google.com/
2. Selecciona tu proyecto `fitplan-ai`

### Paso 2: Ir a Firestore Rules
1. En el menú lateral, haz clic en **Firestore Database**
2. Haz clic en la pestaña **Rules**

### Paso 3: Copiar las Reglas
Copia TODO el contenido del archivo `firestore.rules` de tu proyecto:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Función para verificar si el usuario es administrador
    // Verifica por email o nombre de administrador
    function isAdmin() {
      return request.auth != null
        && exists(/databases/$(database)/documents/usuarios/$(request.auth.uid))
        && (
          get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.email != null
          && get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.email.toLowerCase() == 'admin@fitplan-ai.com'
          ||
          get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.nombre != null
          && get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.nombre.toLowerCase() == 'administrador'
        );
    }
    
    match /usuarios/{userId} {
      // Usuarios pueden leer/escribir su propio perfil
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if request.auth != null && request.auth.uid == userId;
      
      // Administrador puede leer/escribir TODOS los usuarios (incluyendo queries de colección)
      allow read: if request.auth != null && isAdmin();
      allow write: if request.auth != null && isAdmin();
      
      // Permitir actualización de campos premium desde el servidor
      allow update: if (
        request.resource.data.diff(resource.data).affectedKeys().hasOnly(['premium', 'premiumStatus', 'premiumSince', 'premiumPayment', 'updatedAt'])
        && request.resource.data.premium == true
      );
      
      // Permitir crear documento si es el propio usuario
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

### Paso 4: Pegar y Publicar
1. **BORRA** todo el contenido actual en el editor de reglas
2. **PEGA** las nuevas reglas copiadas
3. Haz clic en **Publish** (Publicar)

### Paso 5: Verificar
1. Después de publicar, espera unos segundos
2. Recarga la página del admin en tu aplicación
3. Revisa la consola del navegador - deberías ver logs como:
   - `🔍 Verificando documento de admin...`
   - `✅ Documento de admin ya está correcto` o `✅ Documento de admin creado`
   - `🔍 Intentando leer colección de usuarios...`
   - `✅ Colección leída exitosamente, usuarios encontrados: X`

## ⚠️ Notas Importantes

- **Las reglas pueden tardar unos segundos en propagarse** después de publicarlas
- **Asegúrate de que tu usuario admin tiene el email `admin@fitplan-ai.com`** y el nombre `administrador` en Firestore
- Si sigues teniendo problemas, espera 30 segundos después de publicar las reglas antes de intentar nuevamente

## 🐛 Debugging

Si después de actualizar las reglas sigues teniendo problemas:

1. Abre la consola del navegador (F12)
2. Revisa los logs que empiezan con emojis (🔍, 📝, ✅)
3. Verifica en Firebase Console → Firestore Database → Data que:
   - Existe un documento en `usuarios/{tu-userId}`
   - Ese documento tiene `email: "admin@fitplan-ai.com"` o `nombre: "administrador"`

