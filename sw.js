const CACHE_NAME = 'logcal-v1';
const ASSETS = [
    './',
    './index.html',
    './calender.html',
    './settings.html',
    './style.css',
    './Logcal.js',
    './home.js',
    './firebasemsg.js',
    './firebase-sync.js',
    './firebase-messaging-sw.js',
    './manifest.json'
];

self.addEventListener('install', function(event) {
    event.waitUntil(
        caches.open(CACHE_NAME).then(function(cache) {
            return cache.addAll(ASSETS);
        }).catch(function() {
            /* オフラインでも最低限動作させるため、個別に追加 */
            return Promise.resolve();
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', function(event) {
    event.waitUntil(
        caches.keys().then(function(keys) {
            return Promise.all(
                keys.filter(function(key) { return key !== CACHE_NAME; }).map(function(key) { return caches.delete(key); })
            );
        })
    );
    self.clients.claim();
});

self.addEventListener('fetch', function(event) {
    event.respondWith(
        caches.match(event.request).then(function(response) {
            return response || fetch(event.request).catch(function() {
                return caches.match('./index.html');
            });
        })
    );
});
