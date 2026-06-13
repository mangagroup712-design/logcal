/* Shared data and helpers for Logcal. */
const PLANLY_KEYS = {
    tasks: 'planly_tasks',
    categories: 'planly_categories',
    categoryColors: 'planly_category_colors',
    events: 'planly_events',
    notifs: 'planly_notifs',
    notificationOffsets: 'planly_notification_offsets',
    firedNotifications: 'planly_fired_notifications',
    fcmToken: 'planly_fcm_token',
    theme: 'logcal_theme',
    confirmEnabled: 'planly_confirm_enabled'
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
        due: normalizeDateString(task.due) || '',
        time: task.time || '',
        urgent: Boolean(task.urgent),
        done: Boolean(task.done),
        category: task.category || 'その他',
        memo: task.memo || '',
        description: task.description || '',
        recurring: task.recurring || '',
        rating: Number.isFinite(task.rating) && task.rating >= 0 && task.rating <= 5 ? task.rating : 0,
        notifOffsets: Array.isArray(task.notifOffsets) ? task.notifOffsets
            .map(v => Number(v))
            .filter(v => Number.isFinite(v) && v >= 0 && v <= 10080)
            .sort((a, b) => b - a) : null,
        attachments: Array.isArray(task.attachments) ? task.attachments.map(file => ({
            name: file.name || '添付ファイル',
            type: file.type || '',
            dataUrl: file.dataUrl || ''
        })).filter(file => file.dataUrl) : [],
        subtasks: Array.isArray(task.subtasks) ? task.subtasks.map(sub => ({
            id: sub.id || Date.now() + Math.random(),
            text: String(sub.text || ''),
            done: Boolean(sub.done)
        })) : []
    })) : [];
}

function saveTasks(tasks) {
    writeJson(PLANLY_KEYS.tasks, tasks);
    notifyOtherPages('tasks');
    restartTaskReminderScheduler();
}

function addTask(text, due, urgent, category, time, attachments, memo, recurring, notifOffsets, description, subtasks) {
    if (typeof window !== 'undefined') window._logcalLastAttachmentSaveFailed = false;
    const tasks = getTasks();
    const cleanOffsets = Array.isArray(notifOffsets) ? [...new Set(notifOffsets
        .map(v => Number(v))
        .filter(v => Number.isFinite(v) && v >= 0 && v <= 10080))]
        .sort((a, b) => b - a) : null;
    const cleanSubtasks = Array.isArray(subtasks) ? subtasks.map((sub, idx) => ({
        id: sub.id || Date.now() + idx + Math.random(),
        text: String(sub.text || ''),
        done: Boolean(sub.done)
    })) : [];
    const task = {
        id: Date.now(),
        text: text,
        due: normalizeDateString(due) || '',
        time: time || '',
        urgent: Boolean(urgent),
        done: false,
        category: category || 'その他',
        memo: memo || '',
        description: description || '',
        recurring: recurring || '',
        rating: 0,
        notifOffsets: cleanOffsets && cleanOffsets.length ? cleanOffsets : null,
        attachments: Array.isArray(attachments) ? attachments : [],
        subtasks: cleanSubtasks
    };
    tasks.push(task);
    try {
        saveTasks(tasks);
    } catch (error) {
        if (!task.attachments.length) throw error;
        console.warn('Attachments were too large to store. Task was saved without attachments.', error);
        if (typeof window !== 'undefined') window._logcalLastAttachmentSaveFailed = true;
        task.attachments = [];
        saveTasks(tasks);
    }
    return tasks;
}

function toggleTask(id) {
    const tasks = getTasks();
    const task = tasks.find(item => item.id === id);
    if (!task) return tasks;
    task.done = !task.done;
    if (task.subtasks && task.subtasks.length) {
        task.subtasks.forEach(sub => { sub.done = task.done; });
    }
    if (task.done && task.recurring && task.due) {
        const nextDue = getNextRecurringDate(task.due, task.recurring);
        if (nextDue) {
            tasks.push({
                id: Date.now() + Math.random(),
                text: task.text,
                due: nextDue,
                time: task.time,
                urgent: task.urgent,
                done: false,
                category: task.category,
                memo: task.memo,
                description: task.description || '',
                recurring: task.recurring,
                rating: 0,
                attachments: [],
                subtasks: task.subtasks ? task.subtasks.map(s => ({...s, done: false})) : []
            });
        }
    }
    saveTasks(tasks);
    if (task.done && typeof window !== 'undefined' && typeof window._onTaskComplete === 'function') {
        window._onTaskComplete(task);
    }
    return tasks;
}

function getNextRecurringDate(dateString, recurring) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return null;
    const date = new Date(dateString + 'T00:00:00');
    if (recurring === 'daily') {
        date.setDate(date.getDate() + 1);
    } else if (recurring === 'weekly') {
        date.setDate(date.getDate() + 7);
    } else if (recurring === 'monthly') {
        date.setMonth(date.getMonth() + 1);
    } else {
        return null;
    }
    return formatDate(date);
}

function deleteTask(id) {
    const tasks = getTasks().filter(task => task.id !== id);
    saveTasks(tasks);
    return tasks;
}

function updateTask(id, updates) {
    const tasks = getTasks();
    const idx = tasks.findIndex(task => task.id === id);
    if (idx === -1) return tasks;
    var cleanOffsets = null;
    if (updates.notifOffsets !== undefined) {
        if (Array.isArray(updates.notifOffsets)) {
            cleanOffsets = [...new Set(updates.notifOffsets
                .map(v => Number(v))
                .filter(v => Number.isFinite(v) && v >= 0 && v <= 10080))]
                .sort((a, b) => b - a);
        }
    }
    var cleanSubtasks = tasks[idx].subtasks;
    if (updates.subtasks !== undefined) {
        cleanSubtasks = Array.isArray(updates.subtasks) ? updates.subtasks.map((sub, i) => ({
            id: sub.id || Date.now() + i + Math.random(),
            text: String(sub.text || ''),
            done: Boolean(sub.done)
        })) : [];
    }
    var newDone = updates.done !== undefined ? Boolean(updates.done) : tasks[idx].done;
    if (newDone && cleanSubtasks.length) {
        cleanSubtasks.forEach(sub => { sub.done = true; });
    }
    tasks[idx] = {
        ...tasks[idx],
        text: updates.text !== undefined ? String(updates.text || '') : tasks[idx].text,
        due: updates.due !== undefined ? normalizeDateString(updates.due) || '' : tasks[idx].due,
        time: updates.time !== undefined ? String(updates.time || '') : tasks[idx].time,
        urgent: updates.urgent !== undefined ? Boolean(updates.urgent) : tasks[idx].urgent,
        done: newDone,
        category: updates.category !== undefined ? String(updates.category || 'その他') : tasks[idx].category,
        memo: updates.memo !== undefined ? String(updates.memo || '') : tasks[idx].memo,
        description: updates.description !== undefined ? String(updates.description || '') : (tasks[idx].description || ''),
        recurring: updates.recurring !== undefined ? String(updates.recurring || '') : tasks[idx].recurring,
        rating: updates.rating !== undefined ? (Number.isFinite(updates.rating) && updates.rating >= 0 && updates.rating <= 5 ? updates.rating : 0) : tasks[idx].rating,
        notifOffsets: updates.notifOffsets !== undefined ? (cleanOffsets && cleanOffsets.length ? cleanOffsets : null) : tasks[idx].notifOffsets,
        attachments: updates.attachments !== undefined ? (Array.isArray(updates.attachments) ? updates.attachments : tasks[idx].attachments) : tasks[idx].attachments,
        subtasks: cleanSubtasks
    };
    saveTasks(tasks);
    return tasks;
}

function normalizeDateString(dateStr) {
    if (!dateStr) return '';
    var s = String(dateStr).trim();
    var m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (m) return m[1] + '-' + m[2].padStart(2, '0') + '-' + m[3].padStart(2, '0');
    return s;
}

function getEvents(date) {
    var events = readJson(PLANLY_KEYS.events, DEFAULT_EVENTS);
    if (!Array.isArray(events)) return [];
    var normalized = events.map(function(event) {
        if (!event || typeof event !== 'object') return null;
        var tag = String(event.tag || '').trim() || 'blue';
        var normalizedDate = normalizeDateString(event.date);
        return {
            id: Number(event.id) || Date.now(),
            date: normalizedDate || todayString(),
            time: String(event.time || '').trim() || '09:00',
            name: String(event.name || '').trim(),
            loc: String(event.loc || '').trim(),
            tag: tag,
            tagName: String(event.tagName || '').trim() || TAG_NAMES[tag] || tag || '予定',
            recurring: String(event.recurring || '').trim()
        };
    }).filter(function(e) { return e !== null; });
    return date ? normalized.filter(function(event) { return event.date === date; }) : normalized;
}

function saveAllEvents(events) {
    writeJson(PLANLY_KEYS.events, events);
    notifyOtherPages('events');
}

function addEvent(date, time, name, loc, tag, recurring) {
    const events = getEvents();
    const tagValue = String(tag || '').trim() || 'blue';
    const tagLabel = TAG_NAMES[tagValue] || tagValue || '予定';
    const base = {
        id: Date.now(),
        date: date || todayString(),
        time: time || '09:00',
        name: name,
        loc: loc || '',
        tag: tagValue,
        tagName: tagLabel,
        recurring: recurring || ''
    };
    events.push(base);
    if (recurring && date) {
        for (let i = 1; i < 12; i++) {
            const nextDate = getNextRecurringDate(date, recurring);
            if (!nextDate) break;
            date = nextDate;
            events.push({
                id: base.id + i,
                date: date,
                time: base.time,
                name: base.name,
                loc: base.loc,
                tag: base.tag,
                tagName: base.tagName,
                recurring: base.recurring
            });
        }
    }
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

function getConfirmEnabled() {
    var saved = localStorage.getItem(PLANLY_KEYS.confirmEnabled);
    return saved === null ? true : saved === 'true';
}

function setConfirmEnabled(enabled) {
    localStorage.setItem(PLANLY_KEYS.confirmEnabled, String(Boolean(enabled)));
    notifyOtherPages('confirmEnabled');
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
    const globalOffsets = getNotificationOffsets();
    const fired = getFiredNotifications();
    return getTasks()
        .filter(task => !task.done)
        .flatMap(task => {
            const dueAt = combineDateTime(task.due, task.time);
            if (!dueAt) return [];
            var offsets = (Array.isArray(task.notifOffsets) && task.notifOffsets.length) ? task.notifOffsets : globalOffsets;
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

function isOverdue(due, time) {
    if (!due) return false;
    const now = new Date();
    const dueAt = combineDateTime(due, time || '23:59');
    if (!dueAt) return false;
    return dueAt.getTime() < now.getTime();
}

function getDueUrgency(due) {
    if (!due) return '';
    if (due === todayString()) return 'today';
    if (due === tomorrowString()) return 'tomorrow';
    return '';
}

function exportLogcalData() {
    const data = {};
    Object.values(PLANLY_KEYS).forEach(function(key) {
        const value = localStorage.getItem(key);
        if (value !== null) data[key] = value;
    });
    return JSON.stringify(data, null, 2);
}

function importLogcalData(jsonString) {
    const data = JSON.parse(jsonString);
    Object.entries(data).forEach(function([key, value]) {
        localStorage.setItem(key, value);
    });
    notifyOtherPages('tasks');
    notifyOtherPages('events');
    notifyOtherPages('categories');
    notifyOtherPages('categoryColors');
    notifyOtherPages('notifs');
    notifyOtherPages('notificationOffsets');
}

function setTheme(themeName) {
    const theme = themeName || 'light';
    if (theme === 'light') {
        document.documentElement.removeAttribute('data-theme');
    } else {
        document.documentElement.setAttribute('data-theme', theme);
    }
    localStorage.setItem(PLANLY_KEYS.theme, theme);
    updateFaviconForTheme();
}

function updateFaviconForTheme() {
    var favicon = document.getElementById('favicon');
    if (!favicon) return;
    var theme = localStorage.getItem(PLANLY_KEYS.theme) || 'light';
    var darkThemes = { dark: 1, moon: 1, neon: 1, nightsky: 1 };
    favicon.href = darkThemes[theme] ? 'logcal-logo-dark.ico' : 'logcal-logo-white.ico';
}

function escHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function encodeTaskForUrl(item) {
    var isTask = item.text !== undefined;
    var payload = {
        type: isTask ? 'task' : 'event',
        text: isTask ? (item.text || '') : (item.name || ''),
        due: isTask ? (item.due || '') : (item.date || ''),
        time: item.time || '',
        urgent: isTask ? Boolean(item.urgent) : false,
        category: isTask ? (item.category || '') : (item.tagName || item.tag || ''),
        memo: isTask ? (item.memo || '') : '',
        recurring: item.recurring || ''
    };
    try {
        var json = JSON.stringify(payload);
        var bytes = new TextEncoder().encode(json);
        var binary = '';
        for (var i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    } catch (e) {
        console.error('Encode failed', e);
        return null;
    }
}

function decodeTaskFromUrl(encoded) {
    try {
        var binary = atob(encoded);
        var bytes = new Uint8Array(binary.length);
        for (var i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        var json = new TextDecoder().decode(bytes);
        return JSON.parse(json);
    } catch (e) {
        console.error('Decode failed', e);
        return null;
    }
}

function createTaskShareUrl(item) {
    var encoded = encodeTaskForUrl(item);
    if (!encoded) return null;
    var base = (location.origin && location.origin !== 'null' && location.origin !== 'file://')
        ? location.origin + location.pathname
        : location.href.split('#')[0];
    return base + '#import=' + encoded;
}

function shareTask(item) {
    var url = createTaskShareUrl(item);
    if (!url) { showToast('共有URLの生成に失敗しました'); return; }
    var text = '「' + (item.text || item.name || '') + '」を共有します\n' + url;
    if (navigator.share) {
        navigator.share({ title: '【Logcal】タスク共有', text: text }).catch(function() {});
    } else {
        var subject = encodeURIComponent('【Logcal】タスク: ' + (item.text || item.name || ''));
        var body = encodeURIComponent(text);
        window.location.href = 'mailto:?subject=' + subject + '&body=' + body;
    }
}

function checkImportFromHash() {
    var hash = location.hash;
    if (!hash || !hash.startsWith('#import=')) return;
    var encoded = hash.slice(8);
    var data = decodeTaskFromUrl(encoded);
    if (!data) {
        showToast('無効な共有リンクです');
        history.replaceState(null, '', location.pathname + location.search);
        return;
    }
    var name = data.text || '(名称なし)';
    if (confirm('「' + name + '」を追加しますか？')) {
        addTask(data.text || '', data.due || '', data.urgent || false, data.category || '', data.time || '', [], data.memo || '', data.recurring || '', null, '', null);
        showToast('タスクを追加しました');
        if (typeof window._planlyPageRefresh === 'function') {
            window._planlyPageRefresh();
        }
    }
    history.replaceState(null, '', location.pathname + location.search);
}

function updateBadgeUI() {
    const badge = document.querySelector('.notif-badge');
    if (!badge) return;
    const count = getUnreadCount();
    badge.textContent = count;
    badge.style.display = count > 0 ? 'flex' : 'none';
}
