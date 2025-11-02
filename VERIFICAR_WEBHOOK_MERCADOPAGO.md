# Verificar y Configurar Webhook de MercadoPago

## ¿Por qué no se activó premium automáticamente?

El webhook de MercadoPago puede fallar por varias razones:

1. **Webhook no configurado en MercadoPago Console** (más común)
2. **Reglas de Firestore bloqueando la actualización** (ya corregido)
3. **El webhook recibió la notificación pero falló silenciosamente**

## Cómo Verificar y Configurar el Webhook

### Paso 1: Verificar que el Webhook está configurado en MercadoPago

1. Ve a [MercadoPago Developers](https://www.mercadopago.com.ar/developers)
2. Inicia sesión con tu cuenta
3. Ve a **"Tus integraciones"**
4. Selecciona tu aplicación de **PRODUCCIÓN** (no la de prueba)
5. Busca la sección **"Webhooks"** o **"Notificaciones IPN"**
6. Verifica que esté configurada esta URL:
   ```
   https://www.fitplan-ai.com/api/payment/webhook
   ```
7. Si NO está configurada:
   - Agrega la URL: `https://www.fitplan-ai.com/api/payment/webhook`
   - Guarda los cambios

### Paso 2: Verificar Logs del Webhook

Puedes verificar si el webhook se está ejecutando en los logs de Vercel:

1. Ve a tu proyecto en [Vercel Dashboard](https://vercel.com/dashboard)
2. Selecciona tu proyecto
3. Ve a la pestaña **"Functions"** o **"Deployments"**
4. Busca logs con "🔔 Webhook recibido de MercadoPago"

Si NO ves ningún log del webhook, significa que MercadoPago no está enviando notificaciones (problema de configuración en MercadoPago).

Si VES logs pero con errores, significa que el webhook está recibiendo notificaciones pero fallando (probablemente ya corregido con las nuevas reglas).

### Paso 3: Probar el Webhook Manualmente (Opcional)

Para verificar que el endpoint funciona, puedes simular una notificación:

```bash
curl -X POST https://www.fitplan-ai.com/api/payment/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "type": "payment",
    "data": {
      "id": "123456789"
    }
  }'
```

Esto debería mostrar logs en Vercel (aunque fallará al obtener el pago, pero verás si el endpoint responde).

## ¿Qué se Arregló?

1. ✅ **Código del webhook mejorado**: Ahora usa `updateDoc` y tiene fallback con `setDoc`
2. ✅ **Reglas de Firestore actualizadas**: Permiten que el servidor actualice campos premium
3. ✅ **Mejor manejo de errores**: Los errores se loguean pero el webhook siempre responde 200

## Próximos Pagos

Para los próximos pagos, el webhook debería funcionar automáticamente porque:
- Las reglas de Firestore ahora permiten la actualización
- El código tiene mejor manejo de errores
- Solo necesitas verificar que el webhook esté configurado en MercadoPago Console

## Verificar que el Webhook Está Configurado Correctamente

**URL del webhook que debe estar en MercadoPago:**
```
https://www.fitplan-ai.com/api/payment/webhook
```

**Importante:**
- Debe ser HTTPS (no HTTP)
- Debe ser la URL de producción, no localhost
- MercadoPago puede tardar unos minutos en enviar la notificación después del pago

## Si el Problema Persiste

Si después de configurar el webhook en MercadoPago sigue sin funcionar:

1. Verifica los logs de Vercel para ver qué error específico está ocurriendo
2. Asegúrate de que `NEXT_PUBLIC_BASE_URL` en Vercel esté configurada como `https://www.fitplan-ai.com`
3. Verifica que las reglas de Firestore se hayan actualizado correctamente

