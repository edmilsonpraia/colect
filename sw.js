const CACHE_NAME = 'copia-colect-v20';
const TILE_CACHE = 'copia-colect-tiles-v1';

// Local assets (devem existir, falha bloqueia install)
const ASSETS = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './supabase-client.js',
    './data-store.js',
    './ICONE CGC.jpg',
    './manifest.json',
];

// CDN deps (best-effort: install nao falha se algum nao baixar)
const CDN_ASSETS = [
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
    'https://unpkg.com/@vscode/codicons@0.0.36/dist/codicon.css',
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
    'https://cdn.jsdelivr.net/npm/shpjs@4.0.4/dist/shp.min.js',
    'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js',
    'https://cdn.jsdelivr.net/npm/geotiff@2.1.3/dist-browser/geotiff.js',
    'https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js',
    'https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.4/dist/jspdf.plugin.autotable.min.js',
];

self.addEventListener('install', (event) => {
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE_NAME);
        await cache.addAll(ASSETS);
        // Pre-cache CDN deps em paralelo (sem bloquear install se falhar)
        await Promise.allSettled(CDN_ASSETS.map(async (url) => {
            try {
                const res = await fetch(url, { cache: 'no-store' });
                if (res.ok) await cache.put(url, res.clone());
            } catch (_) { /* ignorar */ }
        }));
    })());
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        const keep = new Set([CACHE_NAME, TILE_CACHE]);
        const keys = await caches.keys();
        await Promise.all(keys.filter((k) => !keep.has(k)).map((k) => caches.delete(k)));
        await self.clients.claim();
    })());
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;
    const url = new URL(req.url);

    // Nao interferir em chamadas da Supabase (auth + REST + storage) — precisam ir sempre direto
    if (url.hostname.endsWith('.supabase.co') || url.hostname.endsWith('.supabase.in')) {
        return;
    }

    // Tiles do OpenStreetMap: cache-first em cache separado (com limpeza eventual)
    if (url.hostname.endsWith('.tile.openstreetmap.org')) {
        event.respondWith(tileCacheFirst(req));
        return;
    }

    // CDN cross-origin: cache-first com revalidacao em background
    if (url.origin !== self.location.origin) {
        event.respondWith(staleWhileRevalidate(req, CACHE_NAME));
        return;
    }

    // Same-origin: cache-first com fallback de rede
    event.respondWith(cacheFirst(req, CACHE_NAME));
});

async function cacheFirst(req, cacheName) {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(req);
    if (cached) return cached;
    try {
        const res = await fetch(req);
        if (res && res.status === 200) cache.put(req, res.clone());
        return res;
    } catch (err) {
        // Sem rede, sem cache: rejeita
        return new Response('Offline', { status: 503, statusText: 'Offline' });
    }
}

async function staleWhileRevalidate(req, cacheName) {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(req);
    const networkFetch = fetch(req).then((res) => {
        if (res && res.status === 200) cache.put(req, res.clone());
        return res;
    }).catch(() => null);
    return cached || networkFetch || new Response('Offline', { status: 503, statusText: 'Offline' });
}

async function tileCacheFirst(req) {
    const cache = await caches.open(TILE_CACHE);
    const cached = await cache.match(req);
    if (cached) return cached;
    try {
        const res = await fetch(req);
        if (res && res.status === 200) cache.put(req, res.clone());
        return res;
    } catch (err) {
        // Sem tile: retorna placeholder transparente (PNG 1x1)
        return new Response(
            Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgAAIAAAUAAen63NgAAAAASUVORK5CYII='), (c) => c.charCodeAt(0)),
            { headers: { 'Content-Type': 'image/png' } }
        );
    }
}
