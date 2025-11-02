# Cómo Encontrar el Usuario de Elisabeth

## Método 1: Desde Firebase Console (Recomendado)

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Selecciona tu proyecto
3. Ve a **Firestore Database**
4. Busca en la colección `usuarios`
5. Busca por el nombre "elisabeth" o "Elisabeth" en el campo `nombre`
6. Cuando lo encuentres, copia el **Document ID** (ese es el `userId`)

## Método 2: Buscar por Email en Authentication

1. En Firebase Console, ve a **Authentication**
2. Busca el email de Elisabeth
3. Cuando lo encuentres, copia el **UID** (ese es el `userId`)

## Método 3: Usar el API con nombre (si no funciona por email)

Si Elisabeth se registró con nombre "elisabeth", puedes intentar buscar por nombre directamente desde la app o crear un script temporal.

## Una vez que tengas el userId:

Usa este comando:

```bash
curl -X POST https://www.fitplan-ai.com/api/fixPremiumUser \
  -H "Content-Type: application/json" \
  -d '{"userId": "USER_ID_AQUI"}'
```

## Información Adicional

Si tienes acceso al dashboard de MercadoPago, también puedes:
1. Buscar el pago de Elisabeth
2. Obtener el `payment_id`
3. Usar ambos en el script:

```bash
curl -X POST https://www.fitplan-ai.com/api/fixPremiumUser \
  -H "Content-Type: application/json" \
  -d '{"userId": "USER_ID", "payment_id": "PAYMENT_ID"}'
```

Esto verificará que el pago fue aprobado y luego activará el premium.

