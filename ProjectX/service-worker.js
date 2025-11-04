const CACHE = 'mini-gram-shell-v1';
const OFFLINE = 'offline.html';
const ASSETS = [
    '/',
    '/index.html',
    '/add.html',
    '/profile.html',
    '/styles.css',
    '/app.js',
    '/db.js',
    '/manifest.json',
    '/offline.html',
    '/icons/icon-192.png',
    '/icons/icon-512.png'
];

self.addEventListener('install', ev => {
    ev.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()));
});

self.addEventListener('activate', ev => {
    ev.waitUntil(
        caches.keys().then(keys => Promise.all(keys.map(k => k !== CACHE ? caches.delete(k) : null)))
            .then(()=>self.clients.claim())
    );
});

self.addEventListener('fetch', ev => {
    const req = ev.request;
    // navigation -> network-first with offline fallback
    if (req.mode === 'navigate') {
        ev.respondWith(fetch(req).then(resp => {
            const copy = resp.clone();
            caches.open(CACHE).then(c => c.put(req, copy));
            return resp;
        }).catch(() => caches.match(OFFLINE)));
        return;
    }

    // for styles/scripts/images -> cache-first with update
    if (req.destination === 'style' || req.destination === 'script' || req.destination === 'image') {
        ev.respondWith(
            caches.match(req).then(cached => {
                if (cached) {
                    // update in background
                    fetch(req).then(resp => {
                        if (resp && resp.ok) caches.open(CACHE).then(c => c.put(req, resp.clone()));
                    }).catch(()=>{});
                    return cached;
                }
                return fetch(req).then(resp => {
                    if (resp && resp.ok) caches.open(CACHE).then(c => c.put(req, resp.clone()));
                    return resp;
                }).catch(()=> caches.match('/icons/icon-192.png'));
            })
        );
        return;
    }

    // default
    ev.respondWith(caches.match(req).then(r => r || fetch(req).catch(()=>{})));
});
