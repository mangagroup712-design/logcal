/* Shared data and helpers for Logcal. */
const PLANLY_KEYS = {
    tasks: 'planly_tasks',
    categories: 'planly_categories',
    categoryColors: 'planly_category_colors',
    events: 'planly_events',
    notifs: 'planly_notifs',
    notificationOffsets: 'planly_notification_offsets',
    firedNotifications: 'planly_fired_notifications',
    fcmToken: 'planly_fcm_token'
};

const DEFAULT_CATEGORIES = ['仕事', 'プライベート', '急ぎ', 'その他'];

const DEFAULT_TASKS = [
    { id: 1, text: '企画書の修正', due: todayString(), urgent: false, done: false, category: '仕事' },
    { id: 2, text: 'メール返信', due: todayString(), urgent: false, done: true, category: '仕事' },
    { id: 3, text: '日用品の買い出し', due: tomorrowString(), urgent: true, done: false, category: 'プライベート' }
];

const DEFAULT_EVENTS = [
    { id: 1, date: todayString(), time: '09:00', name: 'チームミーティング', loc: 'Zoom', tag: 'blue', tagName: '会議' },
    { id: 2, date: todayString(), time: '13:00', name: 'プロジェクトレビュー', loc: '会議室B', tag: 'teal', tagName: '作業' }
];

const DEFAULT_NOTIFS = [
    { id: 1, text: 'チームミーティングが30分後に始まります', read: false, time: '08:30' }
];

const TAG_NAMES = { blue: '会議', teal: '作業', purple: '面談' };
const DEFAULT_NOTIFICATION_OFFSETS = [60];

const DEFAULT_CATEGORY_COLORS = {
    '仕事': '#5B5EF4',
    'プライベート': '#0EA882',
    '急ぎ': '#E24B4A',
    'その他': '#A0A0B8'
};

function getCategoryColors() {
    const colors = readJson(PLANLY_KEYS.categoryColors, DEFAULT_CATEGORY_COLORS);
    return colors && typeof colors === 'object' && !Array.isArray(colors) ? colors : { ...DEFAULT_CATEGORY_COLORS };
}

function saveCategoryColors(colors) {
    writeJson(PLANLY_KEYS.categoryColors, colors);
    notifyOtherPages('categoryColors');
}

function getContrastTextColor(hexColor) {
    const hex = String(hexColor || '#FFFFFF').replace('#', '');
    if (hex.length !== 6) return '#1A1A2E';
    const r = parseInt(hex.substr(0, 2), 16) || 0;
    const g = parseInt(hex.substr(2, 2), 16) || 0;
    const b = parseInt(hex.substr(4, 2), 16) || 0;
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return yiq >= 148 ? '#1A1A2E' : '#FFFFFF';
}

function readJson(key, fallback) {
    try {
        const saved = localStorage.getItem(key);
        return saved ? JSON.parse(saved) : cloneFallback(fallback);
    } catch (error) {
        console.warn('Stored data was invalid and has been reset:', key, error);
        localStorage.removeItem(key);
        return cloneFallback(fallback);
    }
}

function cloneFallback(value) {
    return JSON.parse(JSON.stringify(value));
}

function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}

function getCategories() {
    const categories = readJson(PLANLY_KEYS.categories, DEFAULT_CATEGORIES);
    return Array.isArray(categories) && categories.length ? categories : [...DEFAULT_CATEGORIES];
}

function saveCategories(categories) {
    writeJson(PLANLY_KEYS.categories, categories);
    notifyOtherPages('categories');
}

function addCategory(name) {
    const cleanName = String(name || '').trim();
    if (!cleanName) return getCategories();
    const categories = getCategories();
    if (!categories.includes(cleanName)) {
        categories.push(cleanName);
        saveCategories(categories);
    }
    return categories;
}

function getTasks() {
    const tasks = readJson(PLANLY_KEYS.tasks, DEFAULT_TASKS);
    return Array.isArray(tasks) ? tasks.map(task => ({
        id: task.id,
        text: task.text || '',
        due: task.due || '',
        time: task.time || '',
        urgent: Boolean(task.urgent),
        done: Boolean(task.done),
        category: task.category || 'その他',
        attachments: Array.isArray(task.attachments) ? task.attachments.map(file => ({
            name: file.name || '添付ファイル',
            type: file.type || '',
            dataUrl: file.dataUrl || ''
        })).filter(file => file.dataUrl) : []
    })) : [];
}

function saveTasks(tasks) {
    writeJson(PLANLY_KEYS.tasks, tasks);
    notifyOtherPages('tasks');
    restartTaskReminderScheduler();
}

function addTask(text, due, urgent, category, time, attachments) {
    const tasks = getTasks();
    tasks.push({
        id: Date.now(),
        text: text,
        due: due || '',
        time: time || '',
        urgent: Boolean(urgent),
        done: false,
        category: category || 'その他',
        attachments: Array.isArray(attachments) ? attachments : []
    });
    saveTasks(tasks);
    return tasks;
}

function toggleTask(id) {
    const tasks = getTasks();
    const task = tasks.find(item => item.id === id);
    if (task) {
        task.done = !task.done;
    }
    saveTasks(tasks);
    return tasks;
}

function deleteTask(id) {
    const tasks = getTasks().filter(task => task.id !== id);
    saveTasks(tasks);
    return tasks;
}

function getEvents(date) {
    const events = readJson(PLANLY_KEYS.events, DEFAULT_EVENTS);
    if (!Array.isArray(events)) return [];
    const normalized = events.map(event => ({
        id: event.id,
        date: event.date || todayString(),
        time: event.time || '09:00',
        name: event.name || '',
        loc: event.loc || '',
        tag: event.tag || 'blue',
        tagName: event.tagName || TAG_NAMES[event.tag] || '予定'
    }));
    return date ? normalized.filter(event => event.date === date) : normalized;
}

function saveAllEvents(events) {
    writeJson(PLANLY_KEYS.events, events);
    notifyOtherPages('events');
}

function addEvent(date, time, name, loc, tag) {
    const events = getEvents();
    const tagValue = tag || 'blue';
    events.push({
        id: Date.now(),
        date: date || todayString(),
        time: time || '09:00',
        name: name,
        loc: loc || '',
        tag: tagValue,
        tagName: TAG_NAMES[tagValue] || '予定'
    });
    events.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    saveAllEvents(events);
    return events;
}

function deleteEvent(id) {
    const events = getEvents().filter(event => event.id !== id);
    saveAllEvents(events);
    return events;
}

function getNotifs() {
    const notifs = readJson(PLANLY_KEYS.notifs, DEFAULT_NOTIFS);
    return Array.isArray(notifs) ? notifs : [];
}

function saveNotifs(notifs) {
    writeJson(PLANLY_KEYS.notifs, notifs);
}

function getUnreadCount() {
    return getNotifs().filter(notif => !notif.read).length;
}

function markAllRead() {
    const notifs = getNotifs().map(notif => ({ ...notif, read: true }));
    saveNotifs(notifs);
    notifyOtherPages('notifs');
    return notifs;
}

function addAppNotification(text, time) {
    const notifs = getNotifs();
    notifs.unshift({
        id: Date.now(),
        text: text,
        read: false,
        time: time || new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
    });
    saveNotifs(notifs.slice(0, 30));
    updateBadgeUI();
    notifyOtherPages('notifs');
}

function getNotificationOffsets() {
    const offsets = readJson(PLANLY_KEYS.notificationOffsets, DEFAULT_NOTIFICATION_OFFSETS);
    if (!Array.isArray(offsets)) return [...DEFAULT_NOTIFICATION_OFFSETS];
    const clean = offsets
        .map(value => Number(value))
        .filter(value => Number.isFinite(value) && value >= 0 && value <= 10080);
    return [...new Set(clean)].sort((a, b) => b - a);
}

function saveNotificationOffsets(offsets) {
    const clean = [...new Set(offsets
        .map(value => Number(value))
        .filter(value => Number.isFinite(value) && value >= 0 && value <= 10080))]
        .sort((a, b) => b - a);
    writeJson(PLANLY_KEYS.notificationOffsets, clean.length ? clean : DEFAULT_NOTIFICATION_OFFSETS);
    notifyOtherPages('notificationOffsets');
    restartTaskReminderScheduler();
}

function formatOffsetLabel(minutes) {
    if (minutes === 0) return '予定時刻';
    if (minutes % 1440 === 0) return (minutes / 1440) + '日前';
    if (minutes % 60 === 0) return (minutes / 60) + '時間前';
    return minutes + '分前';
}

function getFiredNotifications() {
    const fired = readJson(PLANLY_KEYS.firedNotifications, {});
    return fired && typeof fired === 'object' && !Array.isArray(fired) ? fired : {};
}

function saveFiredNotifications(fired) {
    writeJson(PLANLY_KEYS.firedNotifications, fired);
}

function pruneFiredNotifications() {
    const fired = getFiredNotifications();
    const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
    Object.keys(fired).forEach(key => {
        if (Number(fired[key]) < cutoff) delete fired[key];
    });
    saveFiredNotifications(fired);
}

function combineDateTime(date, time) {
    if (!date || !time || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
    const result = new Date(date + 'T' + time + ':00');
    return Number.isNaN(result.getTime()) ? null : result;
}

function getTaskNotificationPlans(now = new Date()) {
    const nowMs = now.getTime();
    const offsets = getNotificationOffsets();
    const fired = getFiredNotifications();
    return getTasks()
        .filter(task => !task.done)
        .flatMap(task => {
            const dueAt = combineDateTime(task.due, task.time);
            if (!dueAt) return [];
            return offsets.map(offset => {
                const notifyAt = new Date(dueAt.getTime() - offset * 60 * 1000);
                const key = task.id + ':' + task.due + ':' + task.time + ':' + offset;
                return { task, offset, dueAt, notifyAt, key };
            });
        })
        .filter(plan => !fired[plan.key] && plan.notifyAt.getTime() >= nowMs - 60 * 1000)
        .sort((a, b) => a.notifyAt - b.notifyAt);
}

function getNextTaskNotification(now = new Date()) {
    return getTaskNotificationPlans(now).find(plan => plan.notifyAt.getTime() >= now.getTime()) || null;
}

function markNotificationFired(key) {
    const fired = getFiredNotifications();
    fired[key] = Date.now();
    saveFiredNotifications(fired);
}

async function showLogcalNotification(title, body, data) {
    addAppNotification(body, new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }));

    if (!('Notification' in window) || Notification.permission !== 'granted') return false;

    try {
        if ('serviceWorker' in navigator) {
            const registration = await navigator.serviceWorker.ready;
            await registration.showNotification(title, {
                body: body,
                icon: 'icon.png',
                badge: 'icon.png',
                tag: data && data.tag ? data.tag : 'logcal-task-reminder',
                renotify: true,
                data: data || {}
            });
            return true;
        }
        new Notification(title, { body: body, icon: 'icon.png' });
        return true;
    } catch (error) {
        console.warn('Failed to show notification:', error);
        return false;
    }
}

function startTaskReminderScheduler() {
    if (window._planlyReminderTimer) clearTimeout(window._planlyReminderTimer);
    pruneFiredNotifications();

    const tick = async function() {
        const now = new Date();
        const duePlans = getTaskNotificationPlans(now)
            .filter(plan => plan.notifyAt.getTime() <= now.getTime() + 1000);

        for (const plan of duePlans) {
            const body = plan.task.text + ' は ' + plan.task.time + ' に予定されています（' + formatOffsetLabel(plan.offset) + '）';
            markNotificationFired(plan.key);
            await showLogcalNotification('Logcal リマインダー', body, {
                type: 'task-reminder',
                taskId: plan.task.id,
                due: plan.task.due,
                time: plan.task.time,
                offset: plan.offset,
                tag: 'logcal-task-' + plan.task.id + '-' + plan.offset
            });
        }

        const next = getNextTaskNotification(new Date());
        const delay = next
            ? Math.max(15000, Math.min(next.notifyAt.getTime() - Date.now(), 30 * 60 * 1000))
            : 30 * 60 * 1000;
        window._planlyReminderTimer = setTimeout(tick, delay);
    };

    tick();
}

function restartTaskReminderScheduler() {
    if (typeof window !== 'undefined') startTaskReminderScheduler();
}

let _bc = null;
try {
    _bc = new BroadcastChannel('planly_sync');
    _bc.onmessage = function(event) {
        if (typeof window._planlyOnSync === 'function') window._planlyOnSync(event.data);
        if (typeof window._planlyPageRefresh === 'function') window._planlyPageRefresh();
        if (event.data && (event.data.type === 'tasks' || event.data.type === 'notificationOffsets')) {
            restartTaskReminderScheduler();
        }
    };
} catch (error) {
    _bc = null;
}

function notifyOtherPages(type) {
    if (_bc) _bc.postMessage({ type: type });
}

function todayString() {
    const date = new Date();
    return formatDate(date);
}

function tomorrowString() {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    return formatDate(date);
}

function formatDate(date) {
    return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
}

function formatDue(due) {
    if (!due) return '期限なし';
    if (due === todayString()) return '今日';
    if (due === tomorrowString()) return '明日';
    if (/^\d{4}-\d{2}-\d{2}$/.test(due)) return due.slice(5).replace('-', '/');
    return due;
}

function escHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function updateBadgeUI() {
    const badge = document.querySelector('.notif-badge');
    if (!badge) return;
    const count = getUnreadCount();
    badge.textContent = count;
    badge.style.display = count > 0 ? 'flex' : 'none';
}
