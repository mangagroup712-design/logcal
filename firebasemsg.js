const PLANLY_FIREBASE_CONFIG = {
    apiKey: 'AIzaSyAmGyOqGPZOBGMQE739HKGnyda3-udubrc',
    authDomain: 'logcal.f5.si',
    projectId: 'logcal-60333',
    storageBucket: 'logcal-60333.firebasestorage.app',
    messagingSenderId: '747132286989',
    appId: '1:747132286989:web:26bc75f46009058f98fd44'
};

// Replace this with the public key from Firebase Console > Cloud Messaging > Web Push certificates.
const PLANLY_FIREBASE_VAPID_KEY = 'BHcRnKHYe-u90lAtxsoojQibRgPQtVm8Fg8dubd0Df2Z7yeL2JYYiQX4NO2KnxyXNdDt93EtaEcKjlSBeiyqDrM';

let planlyMessaging = null;

async function initPlanlyFirebaseMessaging() {
    if (!('serviceWorker' in navigator) || !('Notification' in window)) {
        return { ok: false, reason: 'This browser does not support notifications.' };
    }

    if (!window.isSecureContext) {
        return { ok: false, reason: 'Notifications require HTTPS or localhost.' };
    }

    if (!window.firebase || !firebase.apps) {
        return { ok: false, reason: 'Firebase SDK is not loaded.' };
    }

    try {
        if (!firebase.apps.length) firebase.initializeApp(PLANLY_FIREBASE_CONFIG);
        planlyMessaging = firebase.messaging();

        const registration = await navigator.serviceWorker.register('firebase-messaging-sw.js');
        await navigator.serviceWorker.ready;

        planlyMessaging.onMessage(function(payload) {
            const title = payload.notification?.title || 'Planly';
            const body = payload.notification?.body || 'You have a new notification.';
            showPlanlyNotification(title, body, payload.data || {});
        });

        const hasVapidKey = PLANLY_FIREBASE_VAPID_KEY && !PLANLY_FIREBASE_VAPID_KEY.startsWith('TODO_');
        if (Notification.permission === 'granted' && hasVapidKey) {
            const token = await planlyMessaging.getToken({
                vapidKey: PLANLY_FIREBASE_VAPID_KEY,
                serviceWorkerRegistration: registration
            });
            if (token) localStorage.setItem(PLANLY_KEYS.fcmToken, token);
        }

        return {
            ok: true,
            token: localStorage.getItem(PLANLY_KEYS.fcmToken) || '',
            vapidReady: hasVapidKey
        };
    } catch (error) {
        console.warn('Firebase Messaging initialization failed:', error);
        return { ok: false, reason: error.message || 'Firebase Messaging initialization failed.' };
    }
}

async function requestPlanlyNotificationPermission() {
    if (!('Notification' in window)) {
        return { ok: false, reason: 'This browser does not support notifications.' };
    }

    const permission = Notification.permission === 'default'
        ? await Notification.requestPermission()
        : Notification.permission;

    if (permission !== 'granted') {
        return { ok: false, permission: permission, reason: 'Notification permission is not granted.' };
    }

    const result = await initPlanlyFirebaseMessaging();
    startTaskReminderScheduler();
    return { ...result, permission: permission };
}

document.addEventListener('DOMContentLoaded', function() {
    initPlanlyFirebaseMessaging().finally(function() {
        startTaskReminderScheduler();
    });
});
