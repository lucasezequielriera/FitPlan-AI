# Activar Premium para Elisabeth

## Comando para Activar Premium

**Usuario ID:** `p8wQNkIM7CN5f25xeq7S1Z6z2Hu2`

### Opción 1: Con Token de Autorización (Recomendado)

Primero, necesitas obtener un token secreto. Puedes usar los últimos 10 caracteres de tu `MERCADOPAGO_ACCESS_TOKEN` o configurar `FIX_PREMIUM_SECRET` en Vercel.

```bash
# Obtén el secreto desde Vercel > Settings > Environment Variables
# O usa los últimos 10 caracteres de MERCADOPAGO_ACCESS_TOKEN

curl -X POST https://www.fitplan-ai.com/api/fixPremiumUser \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TU_SECRET_AQUI" \
  -d '{"userId": "p8wQNkIM7CN5f25xeq7S1Z6z2Hu2"}'
```

### Opción 2: Actualizar desde Firebase Console (Más Rápido)

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Selecciona tu proyecto
3. Ve a **Firestore Database**
4. Busca el documento con ID `p8wQNkIM7CN5f25xeq7S1Z6z2Hu2` en la colección `usuarios`
5. Haz clic en "Editar documento"
6. Agrega/actualiza estos campos:
   ```json
   {
     "premium": true,
     "premiumStatus": "active",
     "premiumSince": [timestamp actual],
     "updatedAt": [timestamp actual]
   }
   ```
7. Guarda los cambios

### Opción 3: Actualizar Reglas de Firestore Temporalmente

Si prefieres que el endpoint funcione sin token, puedes actualizar temporalmente las reglas de Firestore en Firebase Console:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /usuarios/{userId} {
      // Permitir lectura a usuarios autenticados
      allow read: if request.auth != null && request.auth.uid == userId;
      
      // Permitir escritura al propio usuario O desde el servidor (sin auth para el endpoint de fix)
      allow write: if request.auth != null && request.auth.uid == userId 
                   || (request.resource.data.keys().hasOnly(['premium', 'premiumStatus', 'premiumSince', 'premiumPayment', 'updatedAt']) 
                       && request.resource.data.premium == true);
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

**⚠️ Nota:** Esta regla es más permisiva. Considera revertirla después o usar la opción con token.

## Verificar que Funcionó

Después de activar el premium, Elisabeth debe:
1. Cerrar sesión y volver a iniciar sesión
2. Ver la estrella ⭐ junto a su nombre en el navbar
3. Acceder a objetivos y dietas premium

