/* =============================================
   SERVICE WORKER — Consulta de Lotes
   Cache dos arquivos estáticos + dados offline
   ============================================= */

const CACHE_NAME = 'consulta-lotes-v20'

const STATIC_FILES = [
  './',
  './index.html',
  './styles.css',
  './script.js',
  './manifest.json',
  './assets/icons/favicon.svg',
  './assets/icons/icon-180.png',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/maskable-512.png'
]

/* ── Install: cache estáticos ── */
self.addEventListener('install', event => {
  event.waitUntil(
    // cache: 'reload' ignora o cache HTTP do navegador, garantindo
    // que a versão nova guarde os arquivos novos (e não cópias antigas)
    caches
      .open(CACHE_NAME)
      .then(cache =>
        cache.addAll(STATIC_FILES.map(u => new Request(u, { cache: 'reload' })))
      )
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

/* ── Cria uma cópia da resposta com cabeçalhos extras ── */
async function withHeaders(res, extra) {
  const headers = new Headers(res.headers)
  Object.entries(extra).forEach(([k, v]) => headers.set(k, v))
  const body = await res.blob()
  return new Response(body, {
    status: res.status,
    statusText: res.statusText,
    headers
  })
}

async function cacheWithTimestamp(request, res) {
  const stamped = await withHeaders(res, {
    'X-Cached-At': new Date().toISOString()
  })
  const cache = await caches.open(CACHE_NAME)
  await cache.put(request, stamped)
}

/* ── Fetch: network-first para Sheets API,
         cache-first para estáticos ── */
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url)

  // Google Sheets API → network first, fallback ao cache.
  // A cópia guardada leva X-Cached-At (horário da busca); quando a
  // resposta vem do cache, ganha também X-From-Cache para o app saber.
  if (url.hostname === 'sheets.googleapis.com') {
    event.respondWith(
      fetch(event.request)
        .then(res => {
          if (res.ok) {
            event.waitUntil(cacheWithTimestamp(event.request, res.clone()))
          }
          return res
        })
        .catch(() =>
          caches.match(event.request).then(cached => {
            if (!cached) return Response.error()
            return withHeaders(cached, { 'X-From-Cache': '1' })
          })
        )
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
