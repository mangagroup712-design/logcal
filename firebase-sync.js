/**
 * firebase-sync.js
 * - Googleログイン / ログアウト
 * - アカウントポップアップ（ログイン前:ログインボタン / ログイン後:ユーザー情報）
 * - Firestore へのデータ同期（writeJson をフック）
 *
 * 読み込み順（各HTMLの </body> 直前）:
 *   <script src="https://www.gstatic.com/firebasejs/12.13.0/firebase-app-compat.js"></script>
 *   <script src="https://www.gstatic.com/firebasejs/12.13.0/firebase-messaging-compat.js"></script>
 *   <script src="https://www.gstatic.com/firebasejs/12.13.0/firebase-auth-compat.js"></script>
 *   <script src="https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore-compat.js"></script>
 *   <script src="Planly.js"></script>
 *   <script src="home.js"></script>
 *   <script src="firebasemsg.js"></script>
 *   <script src="firebase-sync.js"></script>
 */

(function () {
    'use strict';

    /* ── Firebase 設定 ──────────────────────────────────── */
    const FIREBASE_CONFIG = {
        apiKey: 'AIzaSyAmGyOqGPZOBGMQE739HKGnyda3-udubrc',
        authDomain: 'logcal.f5.si',
        projectId: 'logcal-60333',
        storageBucket: 'logcal-60333.firebasestorage.app',
        messagingSenderId: '747132286989',
        appId: '1:747132286989:web:26bc75f46009058f98fd44'
    };

    /* ── Firebase 初期化 ──────────────────────────────────*/
    if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
    const auth = firebase.auth();
    const db   = firebase.firestore();
    const provider = new firebase.auth.GoogleAuthProvider();

    let currentUid = null;

    /* ── Firestore へ書き込む ───────────────────────────── */
    async function syncToFirestore(key, value) {
        if (!currentUid) return;
        try {
            await db.collection('users').doc(currentUid)
                .set({ [key]: value }, { merge: true });
        } catch (e) {
            console.warn('[firebase-sync] write error', key, e);
        }
    }

    /* ── Firestore から全データ読み込み → localStorage反映 */
    async function loadFromFirestore() {
        if (!currentUid) return;
        try {
            const snap = await db.collection('users').doc(currentUid).get();
            if (!snap.exists) return;
            const data = snap.data();
            Object.entries(data).forEach(function([key, value]) {
                if (key === 'fcmToken') return;
                try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
            });
        } catch (e) {
            console.warn('[firebase-sync] read error', e);
        }
    }

    /* ── Planly.js の writeJson をフック ───────────────── */
    var _origWriteJson = window.writeJson;
    window.writeJson = function (key, value) {
        _origWriteJson(key, value);
        syncToFirestore(key, value);
    };

    /* ═══════════════════════════════════════════════════
       アカウントポップアップ
    ═══════════════════════════════════════════════════ */

    /* ポップアップHTMLをDOMに注入 */
    function injectAccountPanel() {
        if (document.getElementById('account-panel')) return; // 既にある場合はスキップ
        const actions = document.querySelector('.topbar-actions');
        if (!actions) return;

        const panel = document.createElement('div');
        panel.id = 'account-panel';
        panel.innerHTML =
            '<div id="account-panel-logged-out" class="account-panel-login">' +
                '<p>ログインしてデータを同期</p>' +
                '<button class="btn-google-login" id="btn-google-login-popup">' +
                    '<img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google">' +
                    'Googleでログイン' +
                '</button>' +
            '</div>' +
            '<div id="account-panel-logged-in" style="display:none;">' +
                '<div class="account-panel-user">' +
                    '<img id="account-panel-photo" src="" alt="プロフィール">' +
                    '<div class="account-panel-user-info">' +
                        '<span class="account-panel-name" id="account-panel-name"></span>' +
                        '<span class="account-panel-email" id="account-panel-email"></span>' +
                    '</div>' +
                '</div>' +
                '<button class="btn-logout" id="btn-logout-popup">ログアウト</button>' +
            '</div>';

        actions.appendChild(panel);

        /* ログインボタン */
        document.getElementById('btn-google-login-popup').addEventListener('click', async function () {
            try {
                await auth.signInWithPopup(provider);
            } catch (e) {
                alert('ログインに失敗しました: ' + e.message);
            }
        });

        /* ログアウトボタン */
        document.getElementById('btn-logout-popup').addEventListener('click', async function () {
            const name = auth.currentUser ? auth.currentUser.displayName : 'アカウント';
            if (!confirm(name + ' からログアウトしますか？')) return;
            await auth.signOut();
        });

        /* パネル外クリックで閉じる */
        document.addEventListener('click', function (e) {
            const panel = document.getElementById('account-panel');
            const btn   = document.getElementById('account-btn');
            if (panel && !panel.contains(e.target) && e.target !== btn) {
                panel.classList.remove('open');
            }
        });
    }

    /* ポップアップの表示内容を更新 */
    function updateAccountPanel(user) {
        const loggedOut = document.getElementById('account-panel-logged-out');
        const loggedIn  = document.getElementById('account-panel-logged-in');
        const btn       = document.getElementById('account-btn');
        if (!loggedOut || !loggedIn || !btn) return;

        if (user) {
            /* ── ログイン済み ── */
            loggedOut.style.display = 'none';
            loggedIn.style.display  = 'block';

            const photo = document.getElementById('account-panel-photo');
            const name  = document.getElementById('account-panel-name');
            const email = document.getElementById('account-panel-email');
            if (photo) photo.src = user.photoURL || '';
            if (name)  name.textContent  = user.displayName || 'ユーザー';
            if (email) email.textContent = user.email || '';

            /* ボタンをプロフィール画像に */
            if (user.photoURL) {
                btn.innerHTML = '<img src="' + user.photoURL +
                    '" style="width:28px;height:28px;border-radius:50%;object-fit:cover;" alt="アカウント">';
            } else {
                btn.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="7" r="4"/></svg>';
            }
            btn.title = user.displayName + ' でログイン中';
        } else {
            /* ── 未ログイン ── */
            loggedOut.style.display = 'flex';
            loggedIn.style.display  = 'none';
            btn.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="7" r="4"/></svg>';
            btn.title = 'Googleでログイン';
        }
    }

    /* account-btn クリックでパネル開閉 */
    function setupAccountButton() {
        injectAccountPanel();

        const btn = document.getElementById('account-btn');
        if (!btn) return;

        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            const panel = document.getElementById('account-panel');
            if (panel) panel.classList.toggle('open');
        });

        /* 認証状態の監視 */
        auth.onAuthStateChanged(async function (user) {
            updateAccountPanel(user);

            if (user) {
                currentUid = user.uid;
                await loadFromFirestore();
                if (typeof window._planlyPageRefresh === 'function') {
                    window._planlyPageRefresh();
                }
                const token = localStorage.getItem(typeof PLANLY_KEYS !== 'undefined' ? PLANLY_KEYS.fcmToken : 'planly_fcm_token');
                if (token) syncToFirestore('fcmToken', token);
            } else {
                currentUid = null;
            }
        });
    }

    /* DOMContentLoaded 後にセットアップ */
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupAccountButton);
    } else {
        setupAccountButton();
    }

    /* 外部から使えるようにエクスポート */
    window.planlyFirebase = {
        getAuth: function() { return auth; },
        getDb:   function() { return db; },
        getUid:  function() { return currentUid; },
        sync:    syncToFirestore
    };
})();
