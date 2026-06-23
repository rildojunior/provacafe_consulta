/* =============================================
   SERVICE WORKER — Consulta de Lotes
   Cache dos arquivos estáticos + dados offline
   ============================================= */

const CACHE_NAME = 'consulta-lotes-v11'

const STATIC_FILES = [
  './',
  './index.html',
  './styles.css',
  './script.js',
  './manifest.json',
  './icon-192.svg'
]

/* ── Install: cache estáticos ── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_FILES))
  )
  self.skipWaiting()
})

/* ── Activate: limpa caches antigos ── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys =>
        Promise.all(
          keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
        )
      )
  )
  self.clients.claim()
})

/* ── Fetch: stale-while-revalidate para Sheets API,
         cache-first para estáticos ── */
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url)

  // Google Sheets API → network first, fallback ao cache
  if (url.hostname === 'sheets.googleapis.com') {
    event.respondWith(
      fetch(event.request)
        .then(res => {
          const clone = res.clone()
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone))
          return res
        })
        .catch(() => caches.match(event.request))
    )
    return
  }

  // Fontes Google → cache first
  if (
    url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com'
  ) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached
        return fetch(event.request).then(res => {
          caches.open(CACHE_NAME).then(c => c.put(event.request, res.clone()))
          return res
        })
      })
    )
    return
  }

  // Estáticos → cache first
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  )
})
