# Configuración de Notificaciones de Telegram

Este documento explica cómo configurar las notificaciones de Telegram para recibir alertas cuando:
- Se registra un nuevo usuario
- Se realiza un pago (MercadoPago o manual)

## Pasos para Configurar

### 1. Crear un Bot de Telegram

1. Abre Telegram y busca `@BotFather`
2. Envía el comando `/newbot`
3. Sigue las instrucciones para crear tu bot:
   - Elige un nombre para tu bot (ej: "FitPlan AI Notifications")
   - Elige un username único (debe terminar en `bot`, ej: `fitplan_notifications_bot`)
4. BotFather te dará un **token** (ej: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)
5. Guarda este token, lo necesitarás en el paso 3

### 2. Obtener tu Chat ID

1. Busca tu bot en Telegram (usa el username que creaste, ej: `@fitplan_notifications_bot`)
2. Inicia una conversación con tu bot
3. Envía cualquier mensaje (ej: `/start`)
4. Abre esta URL en tu navegador (reemplaza `TU_BOT_TOKEN` con el token que obtuviste):
   ```
   https://api.telegram.org/botTU_BOT_TOKEN/getUpdates
   ```
5. Busca en la respuesta el campo `"chat":{"id":123456789}` - ese número es tu **Chat ID**
6. Guarda este Chat ID

### 3. Configurar Variables de Entorno

Agrega estas variables a tu archivo `.env.local` (local) y en Vercel (producción):

```env
TELEGRAM_BOT_TOKEN=tu_token_aqui
TELEGRAM_CHAT_ID=tu_chat_id_aqui
NEXT_PUBLIC_BASE_URL=https://www.fitplan-ai.com
```

**Para Vercel:**
1. Ve a tu proyecto en Vercel
2. Settings → Environment Variables
3. Agrega ambas variables:
   - `TELEGRAM_BOT_TOKEN` = tu token del bot
   - `TELEGRAM_CHAT_ID` = tu chat ID
   - `NEXT_PUBLIC_BASE_URL` = `https://www.fitplan-ai.com`

### 4. Verificar que Funciona

Una vez configurado, las notificaciones se enviarán automáticamente cuando:
- Un usuario se registra por primera vez
- Un usuario realiza un pago (MercadoPago o manual desde el admin)

**Nota:** Si las variables no están configuradas, el sistema seguirá funcionando normalmente pero no enviará notificaciones (solo mostrará un warning en los logs).

## Formato de las Notificaciones

### Nuevo Usuario
```
🆕 Nuevo Usuario Registrado

👤 Nombre: [Nombre del usuario]
📧 Email: [Email]
📍 Ubicación: [Ciudad, País]
📅 Fecha: [Fecha y hora]
```

### Nuevo Pago
```
💰 Nuevo Pago Recibido

👤 Usuario: [Nombre del usuario]
📧 Email: [Email]
💵 Monto: $[Monto] [Moneda]
📦 Plan: [Tipo de plan]
💳 MercadoPago (o método de pago)
📅 Fecha: [Fecha y hora]
🆔 ID de Pago: [ID del pago]
```

## Solución de Problemas

### No recibo notificaciones
1. Verifica que las variables de entorno estén configuradas correctamente
2. Verifica que el bot esté iniciado (envía `/start` al bot)
3. Verifica que el Chat ID sea correcto
4. Revisa los logs del servidor para ver si hay errores

### Error: "Telegram no configurado"
- Verifica que `TELEGRAM_BOT_TOKEN` y `TELEGRAM_CHAT_ID` estén en `.env.local` (local) o en Vercel (producción)

### Error: "Unauthorized"
- Verifica que el token del bot sea correcto
- Asegúrate de que el bot no haya sido eliminado o deshabilitado

