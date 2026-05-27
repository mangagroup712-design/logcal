importScripts('https://www.gstatic.com/firebasejs/12.13.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.13.0/firebase-messaging-compat.js');

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
    const title = payload.notification?.title || 'Planly';
    const body = payload.notification?.body || 'You have a new notification.';

    self.registration.showNotification(title, {
        body: body,
        icon: 'icon.png',
        badge: 'icon.png',
        tag: payload.data?.tag || 'planly-fcm',
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
