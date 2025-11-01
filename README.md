This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/pages/api-reference/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `pages/index.tsx`. The page auto-updates as you edit the file.

[API routes](https://nextjs.org/docs/pages/building-your-application/routing/api-routes) can be accessed on [http://localhost:3000/api/hello](http://localhost:3000/api/hello). This endpoint can be edited in `pages/api/hello.ts`.

The `pages/api` directory is mapped to `/api/*`. Files in this directory are treated as [API routes](https://nextjs.org/docs/pages/building-your-application/routing/api-routes) instead of React pages.

This project uses [`next/font`](https://nextjs.org/docs/pages/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn-pages-router) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/pages/building-your-application/deploying) for more details.

### Env (IA, Firebase Auth y Firestore)

Creá un archivo `.env.local` en la raíz con las siguientes variables:

```
# OpenAI (obligatorio). La app no genera planes sin esta variable.
OPENAI_API_KEY=

# Firebase (obligatorio para autenticación y guardado en Firestore)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# MercadoPago (obligatorio para pagos Premium)
MERCADOPAGO_ACCESS_TOKEN=
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

**Nota:** 
1. Para que funcione la autenticación, asegurate de habilitar "Email/Password" en Firebase Console > Authentication > Sign-in method.
2. **IMPORTANTE**: Configura las reglas de seguridad de Firestore. En Firebase Console > Firestore Database > Rules, copia y pega las reglas del archivo `firestore.rules` en la raíz del proyecto, o usa estas reglas básicas:

### Configuración de MercadoPago

1. **Obtener Access Token:**
   - Crea una cuenta en [MercadoPago Developers](https://www.mercadopago.com.ar/developers)
   - Ve a "Tus integraciones" > "Crear aplicación"
   - Copia tu **Access Token** (usar el de prueba para desarrollo, producción para producción)
   - Agrégalo a `.env.local` como `MERCADOPAGO_ACCESS_TOKEN`

2. **Configurar Webhook (producción):**
   - En producción, configura el webhook en MercadoPago Console
   - URL del webhook: `https://tu-dominio.com/api/payment/webhook`
   - Para desarrollo local, puedes usar [ngrok](https://ngrok.com/) para exponer tu servidor local:
     ```bash
     ngrok http 3000
     # Usa la URL de ngrok en NEXT_PUBLIC_BASE_URL
     ```

3. **URL Base:**
   - En desarrollo: `NEXT_PUBLIC_BASE_URL=http://localhost:3000` (o tu URL de ngrok)
   - En producción: `NEXT_PUBLIC_BASE_URL=https://tu-dominio.com`

## Despliegue

### 🚀 Recomendación: Vercel (Más Fácil)

**Vercel es la mejor opción** para desplegar aplicaciones Next.js:
- ✅ Despliegue automático desde Git
- ✅ SSL y CDN incluidos
- ✅ API Routes funcionan perfectamente
- ✅ Plan gratuito generoso

**Guía completa:** Consulta [VERCEL_DEPLOY.md](./VERCEL_DEPLOY.md)

### Comparación de Opciones

Para comparar todas las opciones de hosting (Vercel, Firebase Hosting, Hostinger), consulta [HOSTING_COMPARISON.md](./HOSTING_COMPARISON.md)

### Hostinger (Si prefieres hosting tradicional)

Para instrucciones detalladas sobre cómo desplegar en Hostinger, consulta el archivo [DEPLOY.md](./DEPLOY.md).

```
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

