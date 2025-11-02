# Cómo Actualizar las Reglas de Firestore

## Problema
Las reglas actuales de Firestore requieren autenticación para escribir datos, lo que impide que los endpoints del servidor (como `/api/fixPremiumUser` y `/api/payment/webhook`) actualicen el estado premium de los usuarios.

## Solución: Reglas Actualizadas

He actualizado el archivo `firestore.rules` en el proyecto con reglas que permiten:

1. ✅ Los usuarios pueden leer/escribir su propio perfil (como antes)
2. ✅ El servidor puede actualizar SOLO los campos relacionados con premium cuando se está activando premium
3. ✅ Los usuarios pueden crear sus propios planes (como antes)

## Cómo Aplicar las Nuevas Reglas

### Opción 1: Desde Firebase Console (Recomendado)

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Selecciona tu proyecto
3. Ve a **Firestore Database** > **Rules**
4. Copia y pega el contenido del archivo `firestore.rules` del proyecto
5. Haz clic en **Publish**

### Opción 2: Usando Firebase CLI

Si tienes Firebase CLI instalado:

```bash
# Asegúrate de estar en el directorio del proyecto
cd /Users/lucasriera/Desktop/fitplan-ai

# Despliega las reglas
firebase deploy --only firestore:rules
```

## ¿Qué Permiten las Nuevas Reglas?

Las reglas actualizadas permiten que:

- **Usuarios autenticados**: Pueden leer y escribir su propio perfil normalmente
- **Servidor (API routes)**: Puede actualizar SOLO los campos `premium`, `premiumStatus`, `premiumSince`, `premiumPayment` y `updatedAt` cuando se está activando premium
- **Seguridad**: El servidor NO puede modificar otros campos del usuario (como nombre, email, etc.)
- **Validación**: Solo permite activar premium (establecer `premium: true`), no desactivarlo desde el servidor

## Campos que Puede Actualizar el Servidor

Cuando el servidor actualiza premium, puede modificar:
- `premium`: true/false (pero solo puede establecerlo como true)
- `premiumStatus`: "active", "expired", "cancelled"
- `premiumSince`: timestamp
- `premiumPayment`: objeto con información del pago
- `updatedAt`: timestamp

## Verificación

Después de actualizar las reglas, puedes probar el endpoint:

```bash
curl -X POST https://www.fitplan-ai.com/api/fixPremiumUser \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TU_SECRET" \
  -d '{"userId": "p8wQNkIM7CN5f25xeq7S1Z6z2Hu2"}'
```

Si todo está bien, deberías recibir:
```json
{
  "success": true,
  "message": "Usuario p8wQNkIM7CN5f25xeq7S1Z6z2Hu2 actualizado a premium",
  "userId": "p8wQNkIM7CN5f25xeq7S1Z6z2Hu2",
  "wasPremium": false,
  "paymentVerified": false
}
```

## Notas de Seguridad

- Las reglas son específicas: solo permiten actualizar campos relacionados con premium
- No permiten eliminar el documento del usuario
- No permiten modificar campos sensibles como email o nombre desde el servidor
- Solo permiten activar premium (no desactivarlo) desde el servidor

## Si Tienes Problemas

Si después de actualizar las reglas sigues teniendo errores de permisos:

1. Verifica que las reglas se publicaron correctamente en Firebase Console
2. Espera unos segundos (a veces hay un delay en la propagación)
3. Verifica que estás usando el `userId` correcto
4. Revisa los logs de Vercel para ver errores específicos

