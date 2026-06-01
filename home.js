document.addEventListener('DOMContentLoaded', function() {
    document.body.classList.add('page-ready');
    setupTabs();
    setupNotifications();
    setupScrollShadows();
    setupGlobalFab();
});

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

function setupGlobalFab() {
    const fab = document.getElementById('open-task-page');
    if (!fab) return;
    fab.addEventListener('click', function() {
        if (document.body.classList.contains('page-leaving')) return;
        window.location.href = 'index.html#open-task';
    });
}
