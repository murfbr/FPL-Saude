/**
 * Service Worker — FPL Saúde (v3)
 *
 * Estratégias de cache:
 * - Precache: app shell (index.html, manifest, ícones)
 * - Network First: navegação SPA + assets hasheados (garante deploy fresh)
 * - Stale While Revalidate: Firestore API (dados cacheados + revalidação)
 * - Cache First: Google Fonts, imagens estáticas
 */

const CACHE_NAME = 'fpl-saude-v3'
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/pwa-192x192.svg',
  '/pwa-512x512.svg',
  '/maskable-icon.svg',
]

// ─── Install: pré-cacheia assets estáticos ──────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS)
    }),
  )
  // Não chama skipWaiting aqui — o ReloadPrompt controla a ativação
})

// ─── Activate: limpa caches antigos ─────────────────────────────────────────
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

// ─── Mensagem do cliente: skip waiting (ReloadPrompt) ───────────────────────
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

// ─── Fetch: estratégias por tipo de requisição ──────────────────────────────
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // Ignora requisições não-GET e POST/mutations
  if (event.request.method !== 'GET') return

  // ── Navegação SPA: Network First com fallback para index.html ─────────
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match('/index.html')
      }),
    )
    return
  }

  // ── Firestore REST API: Stale While Revalidate ────────────────────────
  // Retorna cache imediatamente + atualiza em background (reduz latência)
  if (
    url.hostname === 'firestore.googleapis.com' ||
    url.hostname.includes('firestore.googleapis.com')
  ) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((cachedResponse) => {
          const fetchPromise = fetch(event.request)
            .then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                cache.put(event.request, networkResponse.clone())
              }
              return networkResponse
            })
            .catch(() => cachedResponse) // Se offline, usa cache

          // Retorna cache se existe, senão espera a rede
          return cachedResponse || fetchPromise
        })
      }),
    )
    return
  }

  // ── Google Fonts: Cache First (raramente muda) ────────────────────────
  if (
    url.origin === 'https://fonts.googleapis.com' ||
    url.origin === 'https://fonts.gstatic.com'
  ) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse
        return fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone()
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache)
            })
          }
          return networkResponse
        })
      }),
    )
    return
  }

  // ── Assets com hash (ex: index-ABC123.js): Network First ──────────────
  // Garante que após deploy os novos arquivos sejam buscados
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
        .catch(() => caches.match(event.request)),
    )
    return
  }

  // ── Demais assets (imagens, SVGs): Cache First ────────────────────────
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse
        return fetch(event.request).then((networkResponse) => {
          if (
            networkResponse &&
            networkResponse.status === 200 &&
            networkResponse.type === 'basic'
          ) {
            const responseToCache = networkResponse.clone()
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache)
            })
          }
          return networkResponse
        })
      }),
    )
  }
})
