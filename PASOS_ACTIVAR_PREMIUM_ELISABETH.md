# Pasos para Activar Premium de Elisabeth

## ⚠️ PROBLEMA ACTUAL
Las reglas de Firestore están bloqueando la actualización. **NECESITAS actualizar las reglas en Firebase Console primero**.

## 📋 PASO A PASO

### 1. Actualizar Reglas en Firebase Console (OBLIGATORIO)

1. Ve a https://console.firebase.google.com/
2. Selecciona tu proyecto **FitPlan-AI**
3. Ve a **Firestore Database** (menú izquierdo)
4. Haz clic en la pestaña **Rules** (arriba)
5. **BORRA TODO** el contenido actual
6. **COPIA Y PEGA** estas reglas exactas:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /usuarios/{userId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if request.auth != null && request.auth.uid == userId;
      
      // Permitir que el servidor actualice/creé premium
      allow create, update: if request.resource.data.premium == true;
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

7. Haz clic en **Publish**
8. **ESPERA 30 SEGUNDOS** para que se propaguen

### 2. Activar Premium de Elisabeth

Después de actualizar las reglas, ejecuta:

```bash
# Obtén el secreto (últimos 10 caracteres de MERCADOPAGO_ACCESS_TOKEN)
SECRET="TU_SECRET_AQUI"

curl -X POST https://www.fitplan-ai.com/api/fixPremiumUser \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SECRET" \
  -d '{"userId": "p8wQNkIM7CN5f25xeq7S1Z6z2Hu2"}'
```

### 3. Verificar que Funcionó

Deberías recibir:
```json
{
  "success": true,
  "message": "Usuario p8wQNkIM7CN5f25xeq7S1Z6z2Hu2 actualizado a premium",
  "userId": "p8wQNkIM7CN5f25xeq7S1Z6z2Hu2",
  "wasPremium": false,
  "paymentVerified": false
}
```

## 🔄 ALTERNATIVA: Actualizar Manualmente desde Firebase Console

Si las reglas siguen sin funcionar, puedes activar premium directamente:

1. Ve a **Firestore Database** > **usuarios**
2. Busca el documento con ID: `p8wQNkIM7CN5f25xeq7S1Z6z2Hu2`
3. Haz clic en el documento para editarlo
4. Agrega/actualiza estos campos:
   - `premium`: `true` (boolean)
   - `premiumStatus`: `"active"` (string)
   - `premiumSince`: [timestamp] - Usa el botón de timestamp y selecciona "Ahora"
   - `updatedAt`: [timestamp] - Usa el botón de timestamp y selecciona "Ahora"
5. Guarda

## ✅ Verificación Final

Después de activar premium, Elisabeth debe:
1. Cerrar sesión y volver a iniciar sesión
2. Ver la estrella ⭐ junto a su nombre en el navbar
3. Acceder a objetivos y dietas premium

