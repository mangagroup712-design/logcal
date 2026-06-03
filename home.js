/* ============================================================
   モーダル背景スクロール制御
   ============================================================ */
window._modalOpenCount = 0;
window.lockBodyScroll = function() {
    window._modalOpenCount++;
    if (window._modalOpenCount === 1) document.body.classList.add('modal-open');
};
window.unlockBodyScroll = function() {
    window._modalOpenCount = Math.max(0, window._modalOpenCount - 1);
    if (window._modalOpenCount === 0) document.body.classList.remove('modal-open');
};

document.addEventListener('DOMContentLoaded', function() {
    document.body.classList.add('page-ready');
    setupTabs();
    setupNotifications();
    setupScrollShadows();
    setupFabScroll();
    setupTheme();
});

function setupTheme() {
    var saved = localStorage.getItem(PLANLY_KEYS.theme);
    if (saved === 'dark' || saved === 'warm' || saved === 'olive' || saved === 'moon' || saved === 'neon' || saved === 'sakura' || saved === 'nightsky') {
        document.documentElement.setAttribute('data-theme', saved);
    }
    if (typeof updateFaviconForTheme === 'function') updateFaviconForTheme();
}

function setupTabs() {
    const pages = {
        'home-tab': 'index.html',
        'calender-tab': 'calender.html',
        'settings-tab': 'settings.html'
    };

    Object.entries(pages).forEach(function([id, url]) {
        const button = document.getElementById(id);
        if (!button) return;
        button.addEventListener('click', function() {
            if (button.classList.contains('active')) return;
            navigateWithPageBlur(url);
        });
    });
}

function navigateWithPageBlur(url) {
    if (document.body.classList.contains('page-leaving')) return;
    document.body.classList.add('page-leaving');
    setTimeout(function() {
        window.location.href = url;
    }, 220);
}

function setupNotifications() {
    const button = document.getElementById('notif-btn');
    const panel = document.getElementById('notif-panel');
    const list = document.getElementById('notif-list');

    updateBadgeUI();
    renderNotificationList();

    if (!button || !panel) return;

    button.addEventListener('click', function(event) {
        event.stopPropagation();
        const accountPanel = document.getElementById('account-panel');
        if (accountPanel) accountPanel.classList.remove('open');
        panel.classList.toggle('open');
        if (panel.classList.contains('open')) {
            markAllRead();
            updateBadgeUI();
            renderNotificationList();
        }
    });

    document.addEventListener('click', function(event) {
        if (!panel.contains(event.target) && event.target !== button) {
            panel.classList.remove('open');
        }
    });

    function renderNotificationList() {
        if (!list) return;
        const notifications = getNotifs();
        list.innerHTML = '';
        if (notifications.length === 0) {
            list.innerHTML = '<li class="notif-empty">通知はありません</li>';
            return;
        }
        notifications.forEach(function(notif) {
            const li = document.createElement('li');
            li.className = 'notif-item' + (notif.read ? ' read' : '');
            li.innerHTML =
                '<span class="notif-dot"></span>' +
                '<div class="notif-body">' +
                    '<span class="notif-text">' + escHtml(notif.text) + '</span>' +
                    '<span class="notif-time">' + escHtml(notif.time || '') + '</span>' +
                '</div>';
            list.appendChild(li);
        });
    }
}

function setupScrollShadows() {
    function updateScrollShadows() {
        const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
        const viewportBottom = scrollTop + window.innerHeight;
        const pageHeight = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);

        document.body.classList.toggle('has-content-above', scrollTop > 1);
        document.body.classList.toggle('has-content-below', viewportBottom < pageHeight - 1);
    }

    updateScrollShadows();
    window.addEventListener('scroll', updateScrollShadows, { passive: true });
    window.addEventListener('resize', updateScrollShadows);
    window.addEventListener('load', updateScrollShadows);
}

function setupFabScroll() {
    var fab = document.querySelector('.fab-add-btn');
    if (!fab) return;
    var lastScrollTop = 0;
    window.addEventListener('scroll', function() {
        var st = window.scrollY || document.documentElement.scrollTop || 0;
        if (st > lastScrollTop && st > 80) {
            fab.classList.add('fab-hidden');
        } else {
            fab.classList.remove('fab-hidden');
        }
        lastScrollTop = st;
    }, { passive: true });
}

function showToast(message) {
    var existing = document.querySelector('.toast-bar');
    if (existing) existing.remove();
    var toast = document.createElement('div');
    toast.className = 'toast-bar';
    toast.textContent = message;
    document.body.appendChild(toast);
    requestAnimationFrame(function() { toast.classList.add('show'); });
    setTimeout(function() {
        toast.classList.remove('show');
        setTimeout(function() { toast.remove(); }, 350);
    }, 2000);
}

/* ============================================================
   タスク完了お祝いクラッカー
   ============================================================ */
function launchConfetti() {
    var canvas = document.createElement('canvas');
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '9999';
    document.body.appendChild(canvas);

    var ctx = canvas.getContext('2d');
    var width = canvas.width = window.innerWidth;
    var height = canvas.height = window.innerHeight;

    var particles = [];
    var colors = ['#5B5EF4', '#E24B4A', '#0EA882', '#FFC107', '#FF6B8A', '#4ECDC4', '#B967FF', '#4DABF7'];
    for (var i = 0; i < 120; i++) {
        particles.push({
            x: width / 2,
            y: height / 2,
            vx: (Math.random() - 0.5) * 16,
            vy: (Math.random() - 1.2) * 14 - 4,
            size: Math.random() * 6 + 3,
            color: colors[Math.floor(Math.random() * colors.length)],
            rotation: Math.random() * 360,
            rotationSpeed: (Math.random() - 0.5) * 10,
            opacity: 1,
            decay: Math.random() * 0.008 + 0.006
        });
    }

    var startTime = Date.now();
    function animate() {
        ctx.clearRect(0, 0, width, height);
        var allDone = true;
        particles.forEach(function(p) {
            if (p.opacity <= 0) return;
            allDone = false;
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.25;
            p.rotation += p.rotationSpeed;
            p.opacity -= p.decay;
            if (p.opacity < 0) p.opacity = 0;
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rotation * Math.PI / 180);
            ctx.globalAlpha = p.opacity;
            ctx.fillStyle = p.color;
            ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
            ctx.restore();
        });
        if (!allDone && Date.now() - startTime < 3000) {
            requestAnimationFrame(animate);
        } else {
            canvas.remove();
        }
    }
    requestAnimationFrame(animate);
    showToast('おめでとうございます！タスク完了！');
}

window._onTaskComplete = function(task) {
    launchConfetti();
    if (typeof openRatingModal === 'function') {
        setTimeout(function() { openRatingModal(task.id); }, 400);
    }
};

/* ============================================================
   未完了タスク催促通知スケジューラ
   ============================================================ */
function startTaskNagScheduler() {
    if (window._planlyNagTimer) clearTimeout(window._planlyNagTimer);

    function tick() {
        if (!('Notification' in window) || Notification.permission !== 'granted') {
            window._planlyNagTimer = setTimeout(tick, 15 * 60 * 1000);
            return;
        }
        var now = new Date();
        var today = formatDate(now);
        var incomplete = getTasks().filter(function(task) {
            if (task.done) return false;
            if (!task.due) return false;
            return task.due === today || isOverdue(task.due, task.time);
        });
        if (incomplete.length > 0) {
            var names = incomplete.slice(0, 3).map(function(t) { return t.text; }).join('、');
            var extra = incomplete.length > 3 ? ' 他' + (incomplete.length - 3) + '件' : '';
            showLogcalNotification('Logcal タスク催促', '未完了タスク ' + incomplete.length + ' 件があります。完了させましょう！\n' + names + extra, { type: 'task-nag', tag: 'logcal-nag' });
        }
        window._planlyNagTimer = setTimeout(tick, 15 * 60 * 1000);
    }

    window._planlyNagTimer = setTimeout(tick, 5 * 60 * 1000);
}

startTaskNagScheduler();
