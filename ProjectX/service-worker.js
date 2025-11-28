/* service-worker.js — improved caching & error handling
   - Błąd 38: Użycie względnych ścieżek dla ASSETS
   - Błąd 39: Poprawne czyszczenie starych cache'ów
   - Błąd 40: Implementacja strategii Network-First i Cache-First z obsługą błędów
*/
'use strict';

const CACHE = 'mini-gram-shell-v1';
const OFFLINE = './offline.html'; // Zapewnia względną ścieżkę do strony offline
// Błąd 38: Użycie względnych ścieżek (./)
const ASSETS = [
    './',
    './index.html',
    './add.html',
    './profile.html',
    './login.html',
    './styles.css',
    './app.js',
    './db.js',
    './login.js',
    './manifest.json',
    './offline.html',
    './icons/icon-72.png',
    './icons/icon-96.png',
    './icons/icon-128.png',
    './icons/icon-144.png',
    './icons/icon-152.png',
    './icons/icon-192.png',
    './icons/icon-384.png',
    './icons/icon-512.png',
    './icons/icon-512-maskable.png'
];

self.addEventListener('install', ev => {
    // Instalacja i wstępne buforowanie zasobów (Assets)
    ev.waitUntil(
        caches.open(CACHE)
            .then(c => c.addAll(ASSETS))
            .then(() => self.skipWaiting())
            .catch(err => console.warn('SW install cache failed', err))
    );
});

self.addEventListener('activate', ev => {
    // Błąd 39: Poprawne czyszczenie starych cache'ów
    ev.waitUntil(
        caches.keys().then(keys => {
            // Filtrujemy i usuwamy tylko te klucze, które nie są aktualnym CACHE
            return Promise.all(
                keys.filter(k => k !== CACHE).map(k => {
                    console.log('Deleting old cache:', k);
                    return caches.delete(k);
                })
            );
        }).then(() => {
            console.log('Service Worker activated');
            // Przejęcie kontroli nad klientami
            return self.clients.claim();
        })
    );
});

self.addEventListener('fetch', ev => {
    const req = ev.request;

    // Błąd 40: Zaawansowana obsługa błędów i strategie buforowania

    // 1. Nawigacja: Network-First z Fallbackiem Offline
    if (req.mode === 'navigate') {
        ev.respondWith(
            fetch(req)
                .then(resp => {
                    // Pomyślne pobranie: zaktualizuj cache i zwróć odpowiedź
                    const copy = resp.clone();
                    caches.open(CACHE).then(c => c.put(req, copy));
                    return resp;
                })
                .catch(async (e) => { // W przypadku błędu sieciowego
                    console.error('Navigation fetch failed:', e);
                    // Spróbuj dopasować stronę offline lub zwróć domyślną odpowiedź
                    const offlinePage = await caches.match(OFFLINE);
                    return offlinePage || new Response('Offline Content Not Available', { status: 503 });
                })
        );
        return;
    }

    // 2. Statyczne zasoby: Cache-First z Aktualizacją w Tle (Stale-While-Revalidate)
    const dest = req.destination;
    if (dest === 'style' || dest === 'script' || dest === 'image' || req.url.endsWith('.json')) {
        ev.respondWith(
            caches.match(req).then(cached => {
                // Jeśli jest w cache, zwróć wersję z cache
                if (cached) {
                    // W tle próbuj pobrać nową wersję i zaktualizować cache
                    fetch(req).then(resp => {
                        if (resp && resp.ok) {
                            caches.open(CACHE).then(c => c.put(req, resp.clone()));
                        }
                    }).catch(()=>{}); // Ignorujemy błędy aktualizacji w tle
                    return cached;
                }

                // Jeśli nie ma w cache, idź do sieci
                return fetch(req).then(resp => {
                    if (resp && resp.ok) {
                        caches.open(CACHE).then(c => c.put(req, resp.clone()));
                    }
                    return resp;
                }).catch(() => {
                    // W przypadku błędu sieciowego (brak cache i brak sieci)
                    // Zwróć np. domyślną ikonę dla obrazków
                    if (dest === 'image') return caches.match('./icons/icon-192.png');
                    return new Response(null, { status: 404 });
                });
            })
        );
        return;
    }

    // 3. Pozostałe (Domyślne): Cache-First, potem sieć
    ev.respondWith(
        caches.match(req).then(r => r || fetch(req).catch(() => {}))
    );
});