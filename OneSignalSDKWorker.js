importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");
importScripts('https://www.gstatic.com/firebasejs/12.13.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.13.0/firebase-messaging-compat.js');

/* ============================================================
   Firebase Cloud Messaging (background)
   ============================================================ */
firebase.initializeApp({
    apiKey: 'AIzaSyAmGyOqGPZOBGMQE739HKGnyda3-udubrc',
    authDomain: 'logcal-60333.firebaseapp.com',
    projectId: 'logcal-60333',
    storageBucket: 'logcal-60333.firebasestorage.app',
    messagingSenderId: '747132286989',
    appId: '1:747132286989:web:26bc75f46009058f98fd44'
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
    const title = payload.notification?.title || 'Logcal';
    const body = payload.notification?.body || 'You have a new notification.';
    self.registration.showNotification(title, {
        body: body,
        icon: 'icon.png',
        badge: 'icon.png',
        tag: payload.data?.tag || 'logcal-fcm',
        renotify: true,
        data: payload.data || {}
    });
});

self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
            for (const client of clientList) {
                if ('focus' in client) return client.focus();
            }
            if (clients.openWindow) return clients.openWindow('index.html');
            return undefined;
        })
    );
});

/* ============================================================
   Logcal offline cache (from sw.js)
   ============================================================ */
const CACHE_NAME = 'logcal-v3';
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
    './manifest.json'
];

self.addEventListener('install', function(event) {
    event.waitUntil(
        caches.open(CACHE_NAME).then(function(cache) {
            return cache.addAll(ASSETS);
        }).catch(function() {
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
