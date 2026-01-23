// Service Worker para FitPlan AI
// Versión simplificada que NO cachea peticiones POST ni APIs

const CACHE_NAME = 'fitplan-ai-v2';
const urlsToCache = [
  '/',
  '/favicon.ico',
  '/favicon.svg',
];

// Instalación del Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Cache abierto');
        return cache.addAll(urlsToCache);
      })
      .catch((error) => {
        console.error('Service Worker: Error al cachear recursos iniciales', error);
      })
  );
  self.skipWaiting();
});

// Activación del Service Worker
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Eliminando cache antiguo', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// Interceptar peticiones fetch
self.addEventListener('fetch', (event) => {
  const { request } = event;
  
  // CRÍTICO: NO procesar peticiones que no sean GET
  // POST, PUT, DELETE, PATCH, etc. deben pasar directamente
  if (request.method !== 'GET') {
    // No hacer nada, dejar que la petición pase normalmente
    return;
  }

  const url = new URL(request.url);

  // Solo procesar peticiones del mismo origen
  if (url.origin !== location.origin) {
    return;
  }

  // NO cachear peticiones a APIs
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // Solo cachear recursos estáticos (HTML, CSS, JS, imágenes, etc.)
  // No cachear respuestas dinámicas
  const isStaticResource = 
    url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/i) ||
    url.pathname === '/' ||
    url.pathname.startsWith('/_next/static/');

  if (!isStaticResource) {
    return;
  }

  // Estrategia: Cache First para recursos estáticos
  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        // Si no está en cache, hacer fetch
        return fetch(request)
          .then((response) => {
            // Verificar que la respuesta sea válida
            if (!response || response.status !== 200) {
              return response;
            }

            // Verificar que sea una respuesta básica (mismo origen)
            if (response.type !== 'basic') {
              return response;
            }

            // Clonar la respuesta ANTES de cualquier uso
            let responseToCache;
            try {
              responseToCache = response.clone();
            } catch (error) {
              // Si no se puede clonar, devolver sin cachear
              console.warn('Service Worker: No se pudo clonar respuesta', error);
              return response;
            }

            // Cachear de forma asíncrona (no bloquear)
            caches.open(CACHE_NAME)
              .then((cache) => {
                // Verificación adicional de seguridad
                if (request.method === 'GET') {
                  cache.put(request, responseToCache).catch((err) => {
                    console.error('Service Worker: Error al guardar en cache', err);
                  });
                }
              })
              .catch((error) => {
                console.error('Service Worker: Error al abrir cache', error);
              });

            return response;
          })
          .catch(() => {
            // Si falla el fetch, devolver error
            return new Response('Error de red', {
              status: 503,
              statusText: 'Service Unavailable',
            });
          });
      })
  );
});
