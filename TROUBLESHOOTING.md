# Troubleshooting Guide - FitPlan AI

## El servidor está corriendo pero la app no funciona

Si el servidor está corriendo en `http://localhost:3000` pero la aplicación no funciona correctamente, sigue estos pasos:

### 1. Verifica las variables de entorno

Abre `.env.local` y verifica que todas las variables estén configuradas:

```bash
# Verifica que existan estas variables (pueden estar vacías pero deben existir):
cat .env.local | grep -E "NEXT_PUBLIC_FIREBASE|OPENAI_API_KEY|MERCADOPAGO"
```

**Variables mínimas requeridas:**
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `OPENAI_API_KEY` (para generar planes)
- `NEXT_PUBLIC_BASE_URL=http://localhost:3000`

### 2. Verifica errores en la consola del navegador

1. Abre `http://localhost:3000` en tu navegador
2. Abre las herramientas de desarrollador (F12 o Cmd+Option+I en Mac)
3. Ve a la pestaña **Console**
4. Busca errores en rojo

**Errores comunes:**
- `Firebase: Error (auth/configuration-not-found)` → Variables de Firebase faltantes o incorrectas
- `Failed to fetch` → Problema de CORS o servidor no responde
- `TypeError: Cannot read property...` → Error en el código JavaScript

### 3. Verifica errores en la terminal del servidor

Mira la terminal donde ejecutaste `npm run dev` y busca:
- Errores de compilación
- Warnings de Firebase
- Errores de TypeScript

### 4. Reinicia el servidor

```bash
# Detén el servidor (Ctrl+C)
# Luego reinicia:
npm run dev
```

### 5. Limpia la caché de Next.js

```bash
# Detén el servidor
rm -rf .next
npm run dev
```

### 6. Verifica que las dependencias estén instaladas

```bash
npm install
```

### 7. Problemas específicos

#### La página carga pero está en blanco
- Abre la consola del navegador y busca errores
- Verifica que Firebase esté configurado correctamente
- Revisa la pestaña Network en DevTools para ver si hay requests fallando

#### No puedo iniciar sesión
- Verifica que Firebase Authentication esté habilitado
- Ve a Firebase Console > Authentication > Sign-in method
- Asegúrate de que "Email/Password" esté habilitado

#### Los planes no se generan
- Verifica que `OPENAI_API_KEY` esté configurada
- Revisa los logs del servidor para ver errores de OpenAI

#### Errores de CORS
- Asegúrate de que `NEXT_PUBLIC_BASE_URL` esté configurado correctamente
- Para desarrollo local debe ser: `NEXT_PUBLIC_BASE_URL=http://localhost:3000`

### 8. Verifica el estado del servidor

```bash
# En otra terminal, verifica que el servidor responda:
curl http://localhost:3000

# Debe devolver HTML (no un error)
```

### 9. Logs detallados

Para ver más información sobre qué está pasando, puedes agregar logs temporales en el código o verificar:

```bash
# Ver todos los logs del servidor
npm run dev 2>&1 | tee server.log
```

## Comandos útiles

```bash
# Limpiar todo y reinstalar
rm -rf .next node_modules
npm install
npm run dev

# Verificar TypeScript
npx tsc --noEmit

# Verificar linting
npm run lint

# Build de producción (para verificar errores)
npm run build
```

## Contacto

Si después de seguir estos pasos el problema persiste, proporciona:
1. Los errores de la consola del navegador
2. Los errores de la terminal del servidor
3. Qué funcionalidad específica no está funcionando
4. Tu versión de Node.js: `node --version`
5. Tu versión de npm: `npm --version`
