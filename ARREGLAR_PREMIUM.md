# Cómo Arreglar el Estado Premium de un Usuario

## Problema
Si un usuario pagó por Premium pero no se le activó automáticamente, puedes corregirlo manualmente usando la API `/api/fixPremiumUser`.

## Solución Rápida

### Opción 1: Usar curl (Terminal/Mac/Linux)

```bash
# Si tienes el email de Elisabeth
curl -X POST https://www.fitplan-ai.com/api/fixPremiumUser \
  -H "Content-Type: application/json" \
  -d '{"email": "email-de-elisabeth@example.com"}'

# Si también tienes el payment_id de MercadoPago
curl -X POST https://www.fitplan-ai.com/api/fixPremiumUser \
  -H "Content-Type: application/json" \
  -d '{"email": "email-de-elisabeth@example.com", "payment_id": "123456789"}'
```

### Opción 2: Usar Postman o cualquier cliente HTTP

**URL:** `https://www.fitplan-ai.com/api/fixPremiumUser`

**Método:** `POST`

**Headers:**
```
Content-Type: application/json
```

**Body (JSON):**
```json
{
  "email": "email-de-elisabeth@example.com"
}
```

O con payment_id:
```json
{
  "email": "email-de-elisabeth@example.com",
  "payment_id": "123456789"
}
```

### Opción 3: Desde el navegador (usando la consola del desarrollador)

Abre la consola del navegador (F12) y ejecuta:

```javascript
fetch('https://www.fitplan-ai.com/api/fixPremiumUser', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email: 'email-de-elisabeth@example.com'
  })
})
.then(res => res.json())
.then(data => console.log(data))
.catch(error => console.error('Error:', error));
```

## Respuesta Esperada

Si todo sale bien, recibirás:

```json
{
  "success": true,
  "message": "Usuario [userId] actualizado a premium",
  "userId": "...",
  "email": "...",
  "wasPremium": false,
  "paymentVerified": true/false
}
```

## Verificar que Funcionó

Después de ejecutar el script, pide a Elisabeth que:
1. Cierre sesión y vuelva a iniciar sesión en la app
2. Verifique que vea la estrella ⭐ junto a su nombre en el navbar
3. Verifique que pueda acceder a objetivos y dietas premium

## Información Necesaria

Para arreglar el caso de Elisabeth, necesitas:
- **Email**: El email con el que Elisabeth se registró en la app
- **Payment ID** (opcional): El ID del pago de MercadoPago (si lo tienes, puedes encontrarlo en el dashboard de MercadoPago)

## Notas

- El script actualiza el estado premium sin afectar otros datos del usuario
- Si el usuario ya era premium, el script actualizará la información pero no causará problemas
- El script verifica con MercadoPago si se proporciona un `payment_id`

