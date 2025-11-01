# Guía de Despliegue en Hostinger

Esta guía te ayudará a desplegar FitPlan AI en tu hosting de Hostinger.

## Prerrequisitos

1. **Acceso SSH a tu hosting Hostinger**
2. **Node.js instalado** (Hostinger generalmente tiene Node.js, verifica la versión disponible)
3. **PM2 instalado** (opcional, para mantener la aplicación corriendo)
4. **Todas las variables de entorno configuradas**

## Paso 1: Preparar el código

### 1.1 Subir archivos al servidor

Puedes usar cualquiera de estos métodos:

**Opción A: FTP/SFTP (FileZilla, Cyberduck, etc.)**
- Conecta a tu servidor Hostinger vía FTP/SFTP
- Sube todos los archivos del proyecto a una carpeta (ej: `public_html/fitplan-ai` o `public_html`)

**Opción B: Git (recomendado)**
```bash
# En tu máquina local
git init
git add .
git commit -m "Initial commit"
git remote add origin <tu-repositorio-git>
git push -u origin main

# En el servidor Hostinger (vía SSH
git clone <tu-repositorio-git>
cd fitplan-ai
```

### 1.2 Estructura de carpetas recomendada

```
public_html/
├── fitplan-ai/          # Tu aplicación Next.js
│   ├── .next/          # Se genera con npm run build
│   ├── node_modules/   # Se genera con npm install
│   ├── pages/
│   ├── src/
│   └── package.json
└── ...
```

## Paso 2: Instalar dependencias y hacer build

Conecta por SSH a tu servidor Hostinger y ejecuta:

```bash
cd public_html/fitplan-ai  # o la ruta donde subiste los archivos
npm install --production
npm run build
```

**Nota:** Si hay problemas con la memoria durante el build, puedes aumentar el límite:
```bash
NODE_OPTIONS="--max-old-space-size=4096" npm run build
```

## Paso 3: Configurar variables de entorno

En el servidor, crea un archivo `.env.local` en la raíz del proyecto:

```bash
nano .env.local
```

Agrega todas las variables de entorno (las mismas que usas localmente, pero con valores de producción):

```env
# OpenAI
OPENAI_API_KEY=tu_api_key_de_openai

# Firebase (valores de producción)
NEXT_PUBLIC_FIREBASE_API_KEY=tu_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=tu_proyecto.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=tu_proyecto_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=tu_proyecto.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=tu_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=tu_app_id

# MercadoPago
MERCADOPAGO_ACCESS_TOKEN=tu_access_token_de_produccion
NEXT_PUBLIC_BASE_URL=https://tu-dominio.com
```

**IMPORTANTE:**
- Usa el **Access Token de PRODUCCIÓN** de MercadoPago (no el de prueba)
- `NEXT_PUBLIC_BASE_URL` debe ser tu dominio real (ej: `https://fitplan.com.ar`)

## Paso 4: Ejecutar la aplicación

### Opción A: Con Next.js directamente (para testing)

```bash
npm start
```

Esto iniciará la aplicación en el puerto 3000 (por defecto). Necesitarás configurar un reverse proxy con nginx/apache para que funcione en el puerto 80/443.

### Opción B: Con PM2 (recomendado para producción)

Si PM2 no está instalado:
```bash
npm install -g pm2
```

Luego, inicia la aplicación:
```bash
pm2 start npm --name "fitplan-ai" -- start
pm2 save
pm2 startup  # Esto configurará PM2 para iniciar automáticamente
```

Para ver los logs:
```bash
pm2 logs fitplan-ai
```

Para reiniciar:
```bash
pm2 restart fitplan-ai
```

### Opción C: Con el servicio de Node.js de Hostinger

Si Hostinger tiene un panel para aplicaciones Node.js:
1. Ve al panel de control de Hostinger
2. Busca la sección "Node.js" o "Aplicaciones"
3. Configura la ruta de la aplicación
4. Especifica el comando de inicio: `npm start`
5. Configura el puerto (generalmente Hostinger lo asigna automáticamente)

## Paso 5: Configurar dominio y puerto

### 5.1 Configurar Nginx (si tienes acceso)

Si Hostinger te permite configurar Nginx, crea o edita el archivo de configuración:

```nginx
server {
    listen 80;
    server_name tu-dominio.com www.tu-dominio.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 5.2 Configurar puerto personalizado

Si Hostinger asigna un puerto específico, puedes configurarlo:

```bash
PORT=3000 npm start
```

O crear un archivo `ecosystem.config.js` para PM2:

```javascript
module.exports = {
  apps: [{
    name: 'fitplan-ai',
    script: 'npm',
    args: 'start',
    env: {
      PORT: 3000,
      NODE_ENV: 'production'
    }
  }]
};
```

Luego ejecuta:
```bash
pm2 start ecosystem.config.js
```

## Paso 6: Configurar SSL/HTTPS

1. En el panel de Hostinger, busca la sección "SSL"
2. Activa Let's Encrypt SSL para tu dominio
3. Una vez activo, actualiza `NEXT_PUBLIC_BASE_URL` en `.env.local` para usar `https://`

## Paso 7: Configurar webhook de MercadoPago

1. Ve a tu cuenta de MercadoPago Developers
2. Selecciona tu aplicación
3. Configura el webhook URL: `https://tu-dominio.com/api/payment/webhook`
4. Guarda los cambios

## Paso 8: Verificar Firestore Rules

Asegúrate de que las reglas de Firestore en producción sean las mismas que en desarrollo:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /usuarios/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
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

## Troubleshooting

### Error: Puerto ya en uso
```bash
# Ver qué proceso está usando el puerto
lsof -i :3000
# O usar otro puerto
PORT=3001 npm start
```

### Error: No se encuentra el módulo
```bash
# Reinstalar dependencias
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Error: Memoria insuficiente
```bash
# Aumentar límite de memoria
NODE_OPTIONS="--max-old-space-size=4096" npm run build
```

### La aplicación no inicia automáticamente
```bash
# Configurar PM2 para inicio automático
pm2 startup
pm2 save
```

### Verificar que la aplicación está corriendo
```bash
# Con PM2
pm2 list
pm2 logs fitplan-ai

# Verificar puerto
netstat -tulpn | grep :3000
```

## Actualizar la aplicación

Cuando necesites actualizar:

```bash
cd public_html/fitplan-ai
git pull  # Si usas Git
# O sube los archivos nuevos vía FTP

npm install --production
npm run build
pm2 restart fitplan-ai  # Si usas PM2
```

## Contacto con Hostinger

Si tienes problemas específicos con la configuración de Hostinger:
- Consulta la documentación de Hostinger sobre Node.js
- Contacta al soporte de Hostinger mencionando que estás desplegando una aplicación Next.js

## Notas importantes

1. **Backup:** Siempre haz backup antes de hacer cambios importantes
2. **Variables de entorno:** Nunca subas `.env.local` a Git, está en `.gitignore`
3. **Logs:** Revisa los logs regularmente para detectar errores
4. **Monitoreo:** Considera configurar alertas de monitoreo (Hostinger puede ofrecer esto)
5. **Actualizaciones:** Mantén las dependencias actualizadas para seguridad

