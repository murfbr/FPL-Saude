const CACHE_NAME = 'fpl-saude-v2'
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/pwa-192x192.svg',
  '/pwa-512x512.svg',
  '/maskable-icon.svg',
]

// Instala e pré-cacheia apenas os assets estáticos conhecidos
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS)
    }),
  )
  self.skipWaiting()
})

// Limpa caches antigos ao ativar
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName)
          }
        }),
      )
    }),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // Ignora requisições não-GET e chamadas a APIs externas
  if (event.request.method !== 'GET') return
  if (url.origin !== self.location.origin) return

  // Navegação: Network First com fallback para index.html (SPA)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match('/index.html')
      }),
    )
    return
  }

  // Assets com hash no nome (ex: index-ABC123.js): Network First
  // Isso garante que após um novo deploy os arquivos novos sejam buscados
  const isHashedAsset = /\/assets\/.*\.[a-z0-9]{8,}\.(js|css)$/.test(url.pathname)

  if (isHashedAsset) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone()
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache)
            })
          }
          return networkResponse
        })
        .catch(() => {
          // Se a rede falhou, tenta o cache como último recurso
          return caches.match(event.request)
        }),
    )
    return
  }

  // Demais assets: Cache First com fallback para rede
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse
      }
      return fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone()
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache)
          })
        }
        return networkResponse
      })
    }),
  )
})
