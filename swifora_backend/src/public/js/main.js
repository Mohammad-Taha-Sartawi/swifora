// ================================================
// In-page dialogs
// ================================================
// Some browsers block window.confirm / alert / prompt without showing
// anything (pages opened inside WhatsApp, Telegram or other apps, or a site
// set to "block dialogs"). A blocked confirm() returns false, so a
// destructive action such as "delete driver" was silently cancelled and
// never reached the server. These dialogs are part of the page instead.
function adminDialog({ message, kind, danger = false, password = false }) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'admin-dialog-overlay';

    const box = document.createElement('div');
    box.className = `admin-dialog${danger ? ' danger' : ''}`;
    box.setAttribute('role', kind === 'alert' ? 'alertdialog' : 'dialog');
    box.setAttribute('aria-modal', 'true');

    const text = document.createElement('p');
    text.className = 'admin-dialog-message';
    text.textContent = String(message ?? '');
    text.id = `admin-dialog-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    box.setAttribute('aria-describedby', text.id);
    box.append(text);

    let input = null;
    if (kind === 'prompt') {
      input = document.createElement('input');
      input.type = password ? 'password' : 'text';
      input.className = 'admin-dialog-input';
      input.autocomplete = password ? 'new-password' : 'off';
      input.setAttribute('aria-label', String(message ?? ''));
      box.append(input);
    }

    const actions = document.createElement('div');
    actions.className = 'admin-dialog-actions';
    const ok = document.createElement('button');
    ok.type = 'button';
    ok.className = `admin-dialog-ok${danger ? ' danger' : ''}`;
    ok.textContent = kind === 'alert' ? 'حسناً' : 'تأكيد';
    actions.append(ok);

    let cancel = null;
    if (kind !== 'alert') {
      cancel = document.createElement('button');
      cancel.type = 'button';
      cancel.className = 'admin-dialog-cancel';
      cancel.textContent = 'إلغاء';
      actions.append(cancel);
    }

    box.append(actions);
    overlay.append(box);
    document.body.append(overlay);

    const previousFocus = document.activeElement;
    const okValue = () => {
      if (kind === 'prompt') return input.value;
      if (kind === 'confirm') return true;
      return undefined;
    };
    const cancelValue = kind === 'prompt' ? null : kind === 'confirm' ? false : undefined;

    function close(value) {
      document.removeEventListener('keydown', onKey, true);
      overlay.remove();
      if (previousFocus && typeof previousFocus.focus === 'function') {
        previousFocus.focus();
      }
      resolve(value);
    }

    function onKey(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        close(cancelValue);
      } else if (event.key === 'Enter' && document.activeElement !== cancel) {
        event.preventDefault();
        close(okValue());
      }
    }

    ok.addEventListener('click', () => close(okValue()));
    if (cancel) cancel.addEventListener('click', () => close(cancelValue));
    document.addEventListener('keydown', onKey, true);

    // Destructive confirmations start on "Cancel" so Enter cannot delete.
    (input || (danger && cancel) || ok).focus();
  });
}

function adminConfirm(message) {
  const danger = /حذف|رفض|إلغاء|تصفير|مسح/.test(String(message));
  return adminDialog({ message, kind: 'confirm', danger });
}

function adminAlert(message) {
  return adminDialog({ message, kind: 'alert' });
}

function adminPrompt(message, { password = false } = {}) {
  return adminDialog({ message, kind: 'prompt', password });
}

const adminCsrfToken =
  document
    .querySelector(
      'meta[name="csrf-token"]',
    )
    ?.getAttribute('content')
  || '';

const adminActionCapability =
  adminCsrfToken || null;

const nativeFetch =
  window.fetch.bind(window);

function adminFetch(input, init = {}) {
  const requestMethod =
    String(
      init.method
      || (
        input instanceof Request
          ? input.method
          : 'GET'
      ),
    )
      .toUpperCase();

  const mutating =
    ['POST', 'PUT', 'PATCH', 'DELETE']
      .includes(requestMethod);

  if (!mutating) {
    return nativeFetch(
      input,
      init,
    );
  }

  const rawUrl =
    input instanceof Request
      ? input.url
      : input;

  const requestUrl =
    new URL(
      rawUrl,
      window.location.href,
    );

  if (
    requestUrl.origin
    !== window.location.origin
  ) {
    return nativeFetch(
      input,
      init,
    );
  }

  const inheritedHeaders =
    input instanceof Request
      ? input.headers
      : undefined;

  const headers =
    new Headers(
      init.headers
      || inheritedHeaders
      || undefined,
    );

  if (adminCsrfToken) {
    headers.set(
      'X-CSRF-Token',
      adminCsrfToken,
    );
  }

  return nativeFetch(
    input,
    {
      ...init,
      headers,
    },
  );
}

// Every date and time in the dashboard is Palestine time, whatever the
// clock of the computer showing it. Times follow this admin's choice in
// Settings: 12-hour with AM/PM, or 24-hour.
const PALESTINE_TIME_ZONE = 'Asia/Hebron';
let adminTimeFormat =
  document.querySelector('meta[name="admin-time-format"]')?.content === '24h' ? '24h' : '12h';
let palestineFormatter = null;

function palestineParts(date) {
  if (!palestineFormatter) {
    try {
      palestineFormatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: PALESTINE_TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      });
    } catch (_) {
      palestineFormatter = false;
    }
  }
  if (palestineFormatter === false) {
    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
      hour: date.getHours(),
      minute: date.getMinutes(),
    };
  }
  const parts = {};
  palestineFormatter.formatToParts(date).forEach((part) => { parts[part.type] = part.value; });
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
  };
}

function isCalendarDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function formatDisplayDate(value) {
  if (value === null || value === undefined || value === '') return '';
  const date = toDisplayDateValue(value);
  if (Number.isNaN(date.getTime())) return String(value);
  // "2026-11-19" is already a calendar day; anything else is a moment.
  const { year, month, day } = isCalendarDate(value)
    ? { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() }
    : palestineParts(date);
  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
}

/** The time of a moment in Palestine, "10:17 PM" or "22:17"; '' when unknown. */
function formatDisplayTime(value) {
  if (value === null || value === undefined || value === '' || isCalendarDate(value)) return '';
  const date = toDisplayDateValue(value);
  if (Number.isNaN(date.getTime())) return '';
  const { hour, minute } = palestineParts(date);
  const minutes = String(minute).padStart(2, '0');
  if (adminTimeFormat === '24h') return `${String(hour).padStart(2, '0')}:${minutes}`;
  // The leading left-to-right mark keeps "10:17 PM" in this order inside
  // Arabic (right-to-left) text, instead of "PM 10:17".
  return `\u200E${hour % 12 || 12}:${minutes} ${hour < 12 ? 'AM' : 'PM'}`;
}

/** The "time" column of a table: the time, or a dash when unknown. */
function timeCell(value) {
  return `<td class="time-cell">${escapeHtml(formatDisplayTime(value) || '—')}</td>`;
}

function formatDisplayDateTime(value) {
  if (value === null || value === undefined || value === '') return '';
  if (isCalendarDate(value)) return formatDisplayDate(value);
  const date = toDisplayDateValue(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const time = formatDisplayTime(date);
  return time ? `${formatDisplayDate(date)} ${time}` : formatDisplayDate(value);
}

// ================================================
// 1. الساعة الحية
// ================================================
function updateClocks() {
  const el = document.getElementById('clockDisplay');
  if (!el) return;
  el.textContent = formatDisplayTime(new Date());
}
setInterval(updateClocks, 15000);
updateClocks();

// Fallback while the live connection is down: keep the dashboard counters
// current every 30 seconds. When connected, admin_update events refresh
// pages as soon as data changes (see "Live updates" below).
setInterval(() => {
  if (supportSocket && supportSocket.connected) return;
  const dashboard = document.getElementById('page-dashboard');
  if (dashboard && dashboard.classList.contains('active-page')) {
    loadDashboardStats();
  }
}, 30000);

// ================================================
// 2. التنقل بين الصفحات
// ================================================
const pages = {
  dashboard: document.getElementById('page-dashboard'),
  orders: document.getElementById('page-orders'),
  drivers: document.getElementById('page-drivers'),
  users: document.getElementById('page-users'),
  commissions: document.getElementById('page-commissions'),
  'add-driver': document.getElementById('page-add-driver'),
  'pending-providers': document.getElementById('page-pending-providers'),
  'driver-reports': document.getElementById('page-driver-reports'),
  'user-reports': document.getElementById('page-user-reports'),
  'deletion-requests': document.getElementById('page-deletion-requests'),
  'support-chat': document.getElementById('page-support-chat'),
  'broadcast-drivers': document.getElementById('page-broadcast-drivers'),
  'broadcast-users': document.getElementById('page-broadcast-users'),
  ads: document.getElementById('page-ads'),
  areas: document.getElementById('page-areas'),
  settings: document.getElementById('page-settings')
};

function switchPage(pageId) {
  document.querySelectorAll('.page-section').forEach(p => p.classList.remove('active-page'));
  if (pages[pageId]) pages[pageId].classList.add('active-page');
  else pages.dashboard.classList.add('active-page');
}

// ================================================
// Alerts: a new support message, driver sign-up, report or deletion
// request shows in the tab title and icon, on the installed app's icon,
// with a short sound and, when allowed, as a notification on this device.
// The choices are kept per device. While the dashboard is closed the
// server sends the notification (Web Push, /admin/push, admin-sw.js).
// ================================================
const ALERT_SOURCES = [
  { badge: 'chatBadge', text: 'رسالة دعم جديدة', page: 'support-chat' },
  { badge: 'pendingBadge', text: 'سائق جديد ينتظر الموافقة', page: 'pending-providers' },
  { badge: 'driverReportsBadge', text: 'بلاغ جديد عن سائق', page: 'driver-reports' },
  { badge: 'userReportsBadge', text: 'بلاغ جديد عن زبون', page: 'user-reports' },
  { badge: 'deletionRequestsBadge', text: 'طلب حذف حساب جديد', page: 'deletion-requests' },
];
const ALERT_SETTINGS_KEY = 'swifora.admin.alerts';
const ALERT_SOUND_GAP_MS = 3000;
// Counts read before the first data load finishes are the starting point,
// not news; after this long alerts start anyway.
const ALERT_ARM_FALLBACK_MS = 15000;

const adminAlertState = {
  baseTitle: document.title,
  counts: new Map(),
  total: 0,
  armed: false,
  ready: new Set(),
  flashTimer: null,
  flashOn: false,
  flashText: '',
  iconLink: null,
  iconHref: '',
  iconImage: null,
  audio: null,
  lastSoundAt: 0,
  registration: null,
  pushConfig: null,
  pushActive: false,
  scheduled: false,
};

function readAlertSettings() {
  try {
    const raw = JSON.parse(localStorage.getItem(ALERT_SETTINGS_KEY) || '{}') || {};
    return { sound: raw.sound !== false, notify: raw.notify === true };
  } catch (_) {
    return { sound: true, notify: false };
  }
}

function saveAlertSettings(settings) {
  try {
    localStorage.setItem(ALERT_SETTINGS_KEY, JSON.stringify(settings));
  } catch (_) {}
}

function alertBadgeCount(badge) {
  if (!badge || badge.classList.contains('csp-hidden')) return 0;
  if (getComputedStyle(badge).display === 'none') return 0;
  return Math.max(0, Number(badge.textContent) || 0);
}

/** The page title without the alert count (set by updatePageTitle). */
function setBaseDocumentTitle(title) {
  adminAlertState.baseTitle = title;
  renderAlertTitle();
}

function renderAlertTitle() {
  const { baseTitle, total, flashOn, flashText } = adminAlertState;
  if (flashOn && flashText) document.title = `● ${flashText}`;
  else document.title = total > 0 ? `(${total}) ${baseTitle}` : baseTitle;
}

function startTitleFlash(text) {
  adminAlertState.flashText = text;
  if (adminAlertState.flashTimer) return;
  adminAlertState.flashTimer = setInterval(() => {
    adminAlertState.flashOn = !adminAlertState.flashOn;
    renderAlertTitle();
  }, 1500);
}

function stopTitleFlash() {
  clearInterval(adminAlertState.flashTimer);
  adminAlertState.flashTimer = null;
  adminAlertState.flashOn = false;
  adminAlertState.flashText = '';
  renderAlertTitle();
}

function renderAlertIcon() {
  const state = adminAlertState;
  if (!state.iconLink) {
    state.iconLink = document.querySelector('link[rel="icon"]');
    state.iconHref = state.iconLink ? state.iconLink.href : '';
  }
  const link = state.iconLink;
  if (!link) return;
  if (state.total <= 0) {
    link.href = state.iconHref;
    return;
  }
  const draw = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(state.iconImage, 0, 0, 64, 64);
    ctx.beginPath();
    ctx.arc(44, 20, 20, 0, Math.PI * 2);
    ctx.fillStyle = '#e74c3c';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#0b0e14';
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(state.total > 9 ? '9+' : String(state.total), 44, 21);
    link.href = canvas.toDataURL('image/png');
  };
  if (state.iconImage && state.iconImage.complete) {
    draw();
    return;
  }
  if (!state.iconImage) {
    state.iconImage = new Image();
    state.iconImage.addEventListener('load', () => renderAlertIcon());
    state.iconImage.src = state.iconHref || '/icons/icon-192.png';
  }
}

function renderAppBadge() {
  try {
    if (adminAlertState.total > 0 && navigator.setAppBadge) {
      navigator.setAppBadge(adminAlertState.total).catch(() => {});
    } else if (navigator.clearAppBadge) {
      navigator.clearAppBadge().catch(() => {});
    }
  } catch (_) {}
}

function renderAlertBell() {
  const count = document.getElementById('alertsToggleCount');
  if (!count) return;
  count.textContent = adminAlertState.total > 99 ? '99+' : String(adminAlertState.total);
  count.hidden = adminAlertState.total <= 0;
}

function alertAudioContext() {
  const Context = window.AudioContext || window.webkitAudioContext;
  if (!Context) return null;
  if (!adminAlertState.audio) adminAlertState.audio = new Context();
  return adminAlertState.audio;
}

/** A short two-note chime (no sound file needed). */
function playAlertSound({ force = false } = {}) {
  const now = Date.now();
  if (!force && now - adminAlertState.lastSoundAt < ALERT_SOUND_GAP_MS) return;
  adminAlertState.lastSoundAt = now;
  try {
    const ctx = alertAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    const start = ctx.currentTime + 0.02;
    [[880, 0], [1318.5, 0.17]].forEach(([frequency, offset]) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, start + offset);
      gain.gain.exponentialRampToValueAtTime(0.3, start + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.4);
      oscillator.connect(gain).connect(ctx.destination);
      oscillator.start(start + offset);
      oscillator.stop(start + offset + 0.45);
    });
  } catch (_) {}
}

function showLocalAlertNotification(source, { body = 'اضغط لفتح الصفحة.' } = {}) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const options = {
    body,
    tag: `swifora-admin-${source.page}`,
    renotify: true,
    icon: '/icons/icon-192.png',
    lang: 'ar',
    dir: 'rtl',
    data: { page: source.page },
  };
  if (adminAlertState.registration) {
    adminAlertState.registration.showNotification(source.text, options).catch(() => {});
    return;
  }
  try {
    const notification = new Notification(source.text, options);
    notification.addEventListener('click', () => {
      window.focus();
      navigateTo(source.page);
      notification.close();
    });
  } catch (_) {}
}

function announceAlerts(fresh) {
  const settings = readAlertSettings();
  const away = document.hidden || !document.hasFocus();
  if (settings.sound) playAlertSound();
  if (away) startTitleFlash(fresh[0].text);
  // With Web Push on this device the server's notification arrives instead.
  if (settings.notify && away && !adminAlertState.pushActive) {
    fresh.forEach((source) => showLocalAlertNotification(source));
  }
}

function checkAlertBadges() {
  adminAlertState.scheduled = false;
  const fresh = [];
  let total = 0;
  ALERT_SOURCES.forEach((source) => {
    const count = alertBadgeCount(document.getElementById(source.badge));
    const before = adminAlertState.counts.get(source.badge);
    if (adminAlertState.armed && before !== undefined && count > before) fresh.push(source);
    adminAlertState.counts.set(source.badge, count);
    total += count;
  });
  adminAlertState.total = total;
  renderAlertTitle();
  renderAlertIcon();
  renderAppBadge();
  renderAlertBell();
  if (fresh.length) announceAlerts(fresh);
}

function scheduleAlertCheck() {
  if (adminAlertState.scheduled) return;
  adminAlertState.scheduled = true;
  setTimeout(checkAlertBadges, 60);
}

/** Called once the first stats ('stats') and chat ('chat') loads are done. */
function adminAlertsReady(part) {
  adminAlertState.ready.add(part);
  if (adminAlertState.ready.has('stats') && adminAlertState.ready.has('chat')) {
    setTimeout(() => {
      checkAlertBadges();
      adminAlertState.armed = true;
    }, 100);
  }
}

function base64UrlToBytes(value) {
  const padded = value + '='.repeat((4 - (value.length % 4)) % 4);
  const raw = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

function pushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

function isAppleMobile() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function isInstalledApp() {
  return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
}

async function loadPushConfig() {
  if (adminAlertState.pushConfig) return adminAlertState.pushConfig;
  try {
    const res = await adminFetch('/admin/push/config');
    const data = await res.json();
    adminAlertState.pushConfig = {
      enabled: data.enabled === true && typeof data.publicKey === 'string' && data.publicKey !== '',
      publicKey: data.publicKey || '',
    };
  } catch (_) {
    adminAlertState.pushConfig = { enabled: false, publicKey: '' };
  }
  return adminAlertState.pushConfig;
}

/** Subscribes this device to the server's alerts; false when it cannot. */
async function startPushAlerts() {
  const registration = adminAlertState.registration;
  if (!registration || !pushSupported() || Notification.permission !== 'granted') return false;
  const config = await loadPushConfig();
  if (!config.enabled) return false;
  try {
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlToBytes(config.publicKey),
      });
    }
    const res = await adminFetch('/admin/push/subscriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(subscription.toJSON()),
    });
    adminAlertState.pushActive = res.ok;
    return res.ok;
  } catch (_) {
    adminAlertState.pushActive = false;
    return false;
  }
}

async function stopPushAlerts() {
  adminAlertState.pushActive = false;
  const registration = adminAlertState.registration;
  if (!registration || !pushSupported()) return;
  try {
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return;
    await adminFetch('/admin/push/subscriptions', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    }).catch(() => {});
    await subscription.unsubscribe();
  } catch (_) {}
}

function setAlertsStatus(text) {
  const status = document.getElementById('alertsStatus');
  if (status) status.textContent = text;
}

async function describeNotifyState() {
  const hint = document.getElementById('alertsNotifyHint');
  if (!hint) return;
  const config = await loadPushConfig();
  if (!('Notification' in window)) {
    hint.textContent = isAppleMobile() && !isInstalledApp()
      ? 'على iPhone: أضف اللوحة إلى الشاشة الرئيسية أولاً (مشاركة ← إضافة إلى الشاشة الرئيسية).'
      : 'هذا المتصفح لا يدعم الإشعارات.';
    return;
  }
  if (Notification.permission === 'denied') {
    hint.textContent = 'الإشعارات محظورة لهذا الموقع في إعدادات المتصفح.';
    return;
  }
  hint.textContent = config.enabled && pushSupported()
    ? 'تصل حتى واللوحة مغلقة.'
    : 'تظهر ما دامت اللوحة مفتوحة، ولو في الخلفية.';
}

async function setNotifyEnabled(enabled) {
  const box = document.getElementById('alertsNotify');
  const settings = readAlertSettings();
  if (!enabled) {
    saveAlertSettings({ ...settings, notify: false });
    await stopPushAlerts();
    setAlertsStatus('أُوقفت الإشعارات على هذا الجهاز.');
    return;
  }
  if (!('Notification' in window)) {
    if (box) box.checked = false;
    await describeNotifyState();
    setAlertsStatus('لا يمكن تشغيل الإشعارات في هذا المتصفح.');
    return;
  }
  const permission = Notification.permission === 'granted'
    ? 'granted'
    : await Notification.requestPermission();
  if (permission !== 'granted') {
    if (box) box.checked = false;
    saveAlertSettings({ ...settings, notify: false });
    await describeNotifyState();
    setAlertsStatus('لم يُسمح بالإشعارات. يمكن السماح بها من إعدادات المتصفح لهذا الموقع.');
    return;
  }
  saveAlertSettings({ ...settings, notify: true });
  const pushed = await startPushAlerts();
  await describeNotifyState();
  setAlertsStatus(pushed
    ? 'تم. ستصلك الإشعارات على هذا الجهاز حتى واللوحة مغلقة.'
    : 'تم. ستصلك الإشعارات ما دامت اللوحة مفتوحة.');
}

async function testAlert() {
  const settings = readAlertSettings();
  playAlertSound({ force: true });
  if (!settings.notify) {
    setAlertsStatus(settings.sound ? 'هذا صوت التنبيه. شغّل «إشعارات الجهاز» لتجربة الإشعار أيضاً.' : 'الصوت والإشعارات متوقفة على هذا الجهاز.');
    return;
  }
  if (adminAlertState.pushActive) {
    try {
      const res = await adminFetch('/admin/push/test', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.sent > 0) {
        setAlertsStatus('أُرسل إشعار تجريبي إلى أجهزتك.');
        return;
      }
      if (data.throttled) {
        setAlertsStatus('انتظر قليلاً قبل التجربة مرة أخرى.');
        return;
      }
    } catch (_) {}
  }
  showLocalAlertNotification({ text: 'تجربة تنبيه سويفورا', page: 'dashboard' }, { body: 'التنبيهات تعمل على هذا الجهاز.' });
  setAlertsStatus('ظهر إشعار تجريبي على هذا الجهاز.');
}

function setUpAlertsPanel() {
  const toggle = document.getElementById('alertsToggle');
  const panel = document.getElementById('alertsPanel');
  const sound = document.getElementById('alertsSound');
  const notify = document.getElementById('alertsNotify');
  const test = document.getElementById('alertsTest');
  if (!toggle || !panel) return;

  const settings = readAlertSettings();
  if (sound) sound.checked = settings.sound;
  if (notify) {
    notify.checked = settings.notify
      && 'Notification' in window && Notification.permission === 'granted';
  }

  function setOpen(open) {
    panel.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    if (open) {
      setAlertsStatus('');
      describeNotifyState();
      (sound || panel).focus();
    }
  }
  toggle.addEventListener('click', () => setOpen(panel.hidden));
  document.addEventListener('click', (event) => {
    if (!panel.hidden && !panel.contains(event.target) && !toggle.contains(event.target)) setOpen(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !panel.hidden) {
      setOpen(false);
      toggle.focus();
    }
  });
  sound?.addEventListener('change', () => {
    saveAlertSettings({ ...readAlertSettings(), sound: sound.checked });
    if (sound.checked) playAlertSound({ force: true });
    setAlertsStatus(sound.checked ? 'سيُسمع صوت عند وصول جديد.' : 'أُوقف الصوت على هذا الجهاز.');
  });
  notify?.addEventListener('change', () => {
    notify.disabled = true;
    setNotifyEnabled(notify.checked).finally(() => { notify.disabled = false; });
  });
  test?.addEventListener('click', () => testAlert());
}

(function setUpAdminAlerts() {
  ALERT_SOURCES.forEach((source) => {
    const badge = document.getElementById(source.badge);
    if (!badge) return;
    new MutationObserver(scheduleAlertCheck).observe(badge, {
      attributes: true, childList: true, characterData: true, subtree: true,
    });
  });
  setTimeout(() => {
    adminAlertsReady('stats');
    adminAlertsReady('chat');
  }, ALERT_ARM_FALLBACK_MS);

  // Browsers allow sound only after the first click or key press.
  const unlockAudio = () => {
    const ctx = alertAudioContext();
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
  };
  document.addEventListener('pointerdown', unlockAudio, { once: true });
  document.addEventListener('keydown', unlockAudio, { once: true });

  const back = () => {
    if (!document.hidden && document.hasFocus()) stopTitleFlash();
  };
  document.addEventListener('visibilitychange', back);
  window.addEventListener('focus', back);

  setUpAlertsPanel();

  // Signing out stops this device's notifications first.
  document.querySelector('.sidebar-logout')?.addEventListener('submit', function stopAlertsThenSignOut(event) {
    if (!adminAlertState.pushActive) return;
    event.preventDefault();
    const form = this;
    const leave = () => form.submit();
    Promise.race([stopPushAlerts(), new Promise((resolve) => setTimeout(resolve, 2500))]).then(leave, leave);
  });

  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.addEventListener('message', (event) => {
    const data = event.data || {};
    if (data.type === 'swifora-open-page' && typeof data.page === 'string' && pages[data.page]) {
      navigateTo(data.page);
    }
  });
  navigator.serviceWorker.register('/admin-sw.js', { scope: '/admin' })
    .then(async (registration) => {
      adminAlertState.registration = registration;
      const settings = readAlertSettings();
      if (!settings.notify) return;
      if (!('Notification' in window) || Notification.permission !== 'granted') {
        saveAlertSettings({ ...settings, notify: false });
        const box = document.getElementById('alertsNotify');
        if (box) box.checked = false;
        return;
      }
      // Renews this device's link to the signed-in admin.
      await startPushAlerts();
    })
    .catch(() => {});
})();

/** The app bar shows the title and subtitle of the page on screen. */
function updatePageTitle(pageId) {
  const section = pages[pageId] || pages.dashboard;
  const heading = section ? section.querySelector('.top-header h1') : null;
  const titleEl = document.getElementById('pageTitle');
  const subtitleEl = document.getElementById('pageSubtitle');
  if (!heading || !titleEl || !subtitleEl) return;
  const subtitle = heading.querySelector('small');
  const title = [...heading.childNodes]
    .filter((node) => node.nodeType === Node.TEXT_NODE)
    .map((node) => node.textContent)
    .join(' ')
    .trim();
  titleEl.textContent = title;
  subtitleEl.textContent = subtitle ? subtitle.textContent.trim() : '';
  setBaseDocumentTitle(`${title} — سويفورا`);
}

function markActiveNavigation(pageId) {
  document.querySelectorAll('.sidebar ul li[data-page]').forEach((li) => {
    const active = li.dataset.page === pageId;
    li.classList.toggle('active', active);
    if (active) li.setAttribute('aria-current', 'page');
    else li.removeAttribute('aria-current');
  });
  document.querySelectorAll('.bottom-nav-item[data-nav-page]').forEach((button) => {
    const active = button.dataset.navPage === pageId;
    button.classList.toggle('active', active);
    if (active) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
}

/**
 * Opens a page: shows it, updates the title and the menus, loads its data
 * and records it in the address (#orders) so the back button and reloads
 * return to it.
 */
function navigateTo(pageId, { push = true } = {}) {
  const page = pages[pageId] ? pageId : 'dashboard';
  switchPage(page);
  markActiveNavigation(page);
  updatePageTitle(page);
  const main = document.getElementById('mainContent');
  if (main) main.scrollTop = 0;
  window.scrollTo(0, 0);
  if (push && location.hash !== `#${page}`) {
    history.pushState({ page }, '', `#${page}`);
  }
  loadPageData(page);
}

window.addEventListener('popstate', () => {
  navigateTo((location.hash || '#dashboard').slice(1), { push: false });
});

document.querySelectorAll('.sidebar ul li[data-page]').forEach(item => {
  item.addEventListener('click', function () {
    navigateTo(this.dataset.page);
  });
});

document.querySelectorAll('.bottom-nav-item[data-nav-page]').forEach((button) => {
  button.addEventListener('click', () => navigateTo(button.dataset.navPage));
});

function loadPageData(page) {
    if (page === 'dashboard') loadDashboardStats();
    if (page === 'orders') loadOrders();
    if (page === 'drivers') loadDriversList();
    if (page === 'users') loadUsersList();
    if (page === 'commissions') loadCommissions();
    if (page === 'settings') {
      renderTimeFormatSettings();
      loadCommissionSettings();
      loadDriverDisplaySettings();
      loadLegalDocuments();
    }
    if (page === 'driver-reports') loadDriverReports();
      if (page === 'user-reports') loadUserReports();
      if (page === 'deletion-requests') loadDeletionRequests();
      if (page === 'support-chat') initSupportChat();
      if (page === 'areas') loadAreas();
      if (page === 'ads') loadAds();
      if (page === 'add-driver') {
        document.getElementById('formSuccessMsg').classList.remove('show');
        document.getElementById('formErrorMsg').classList.remove('show');
      }
      if (page === 'pending-providers') loadPendingProviders();
    if (page === 'broadcast-drivers' || page === 'broadcast-users') {
      const el = document.getElementById(page === 'broadcast-drivers' ? 'driverBroadcastResult' : 'userBroadcastResult');
      el.className = 'broadcast-result';
      el.textContent = '';
      loadBroadcastArchive(page === 'broadcast-drivers' ? 'drivers' : 'users');
    }
}

// Open the page named in the address on first load (e.g. /admin#ads), once
// the whole script has run (the loaders use state declared further down).
document.addEventListener('DOMContentLoaded', function openInitialPage() {
  const initial = (location.hash || '').slice(1);
  if (initial && initial !== 'dashboard' && pages[initial]) {
    history.replaceState({ page: initial }, '', `#${initial}`);
    navigateTo(initial, { push: false });
  } else {
    markActiveNavigation('dashboard');
    updatePageTitle('dashboard');
  }
});

// Responsive navigation: on phones and tablets (<= 900px, see style.css)
// the sidebar is a drawer opened from the top bar.
(function setUpNavigationDrawer() {
  const sidebar = document.getElementById('adminSidebar');
  const toggle = document.getElementById('navToggle');
  const backdrop = document.getElementById('sidebarBackdrop');
  if (!sidebar || !toggle || !backdrop) return;

  const drawerQuery = window.matchMedia('(max-width: 900px)');

  function setOpen(open) {
    sidebar.classList.toggle('open', open);
    backdrop.classList.toggle('show', open);
    document.body.classList.toggle('nav-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'إغلاق القائمة' : 'فتح القائمة');
    if (open) {
      const active = sidebar.querySelector('li.active') || sidebar.querySelector('li');
      if (active) active.focus({ preventScroll: true });
    }
  }

  // Keyboard access to the menu items (they are list items, not buttons).
  sidebar.querySelectorAll('ul li[data-page]').forEach(item => {
    item.setAttribute('tabindex', '0');
    item.setAttribute('role', 'button');
    item.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        item.click();
      }
    });
    item.addEventListener('click', () => {
      if (drawerQuery.matches) setOpen(false);
    });
  });

  toggle.addEventListener('click', () => setOpen(!sidebar.classList.contains('open')));
  backdrop.addEventListener('click', () => setOpen(false));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && sidebar.classList.contains('open')) {
      setOpen(false);
      toggle.focus();
    }
  });
  // Leaving the drawer layout (rotating a tablet, resizing) resets it.
  drawerQuery.addEventListener('change', event => {
    if (!event.matches) setOpen(false);
  });
})();

// Clickable cards (stat cards, report links) work from the keyboard too.
const ACTION_WITHOUT_NATIVE_KEYS = '[data-admin-action]:not(button):not(a):not(input):not(select):not(textarea)';
document.querySelectorAll(ACTION_WITHOUT_NATIVE_KEYS).forEach((element) => {
  if (!element.hasAttribute('tabindex')) element.setAttribute('tabindex', '0');
  if (!element.hasAttribute('role')) element.setAttribute('role', 'button');
});
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  const target = event.target instanceof Element ? event.target : null;
  if (!target || !target.matches(ACTION_WITHOUT_NATIVE_KEYS)) return;
  event.preventDefault();
  target.click();
});

// Phone bottom bar: "More" opens the full menu; badges mirror the sidebar.
(function setUpBottomNav() {
  const more = document.querySelector('.bottom-nav-item[data-nav-menu]');
  const toggle = document.getElementById('navToggle');
  if (more && toggle) more.addEventListener('click', () => toggle.click());

  const chatBadge = document.getElementById('chatBadge');
  const bottomChatBadge = document.getElementById('bottomChatBadge');
  const moreDot = document.getElementById('bottomMoreDot');
  const otherBadges = ['pendingBadge', 'driverReportsBadge', 'userReportsBadge', 'deletionRequestsBadge']
    .map((id) => document.getElementById(id))
    .filter(Boolean);
  const visible = (badge) => badge && !badge.classList.contains('csp-hidden')
    && getComputedStyle(badge).display !== 'none'
    && Number(badge.textContent || 0) > 0;

  function sync() {
    if (bottomChatBadge && chatBadge) {
      bottomChatBadge.hidden = !visible(chatBadge);
      bottomChatBadge.textContent = chatBadge.textContent;
    }
    if (moreDot) moreDot.hidden = !otherBadges.some(visible);
  }
  const observer = new MutationObserver(sync);
  [chatBadge, ...otherBadges].filter(Boolean).forEach((badge) => {
    observer.observe(badge, { attributes: true, childList: true, characterData: true, subtree: true });
  });
  sync();
})();

// ================================================
// 3. بيانات فلسطين (المحافظات والمدن)
// ================================================
const citiesMap = {
  'القدس': ['القدس', 'أبو ديس', 'العيزرية', 'عناتا', 'بيت حنينا', 'شعفاط', 'صور باهر', 'سلوان', 'الطور', 'جبل المكبر'],
  'رام الله والبيرة': ['رام الله', 'البيرة', 'بيتونيا', 'دير عمار', 'سنجل', 'بروقين', 'رنتيس', 'عبوين', 'طيرة', 'بيت ريما', 'الزيتونة'],
  'الخليل': ['الخليل', 'دورا', 'يطا', 'حلحول', 'بني نعيم', 'سعير', 'إذنا', 'بيت كاحل', 'ترقوميا', 'بيت أمر', 'ساس'],
  'نابلس': ['نابلس', 'سبسطية', 'يعبد', 'عقابا', 'بيت إيبا', 'زواتا', 'جوريش', 'قصرة', 'تل'],
  'بيت لحم': ['بيت لحم', 'بيت جالا', 'بيت ساحور', 'الخضر', 'تقوع', 'جناتة', 'زعترة', 'حوسان', 'نحالين', 'بتير'],
  'أريحا': ['أريحا', 'النويعمة', 'العوجا', 'فصايل', 'مرج نعجة', 'الزبارة'],
  'سلفيت': ['سلفيت', 'الزاوية', 'كفل حارس', 'دير بلوط', 'بديا', 'قراوة بني حسن', 'رافات'],
  'جنين': ['جنين', 'يعبد', 'قباطية', 'الزبابدة', 'برطعة', 'عنزة', 'جبع', 'فقعوعة', 'سيلة الحارثية'],
  'طولكرم': ['طولكرم', 'عنبتا', 'بلعا', 'شرقية', 'كفر اللبد', 'دير الغصون', 'علار'],
  'قلقيلية': ['قلقيلية', 'حبلة', 'عزون', 'كفر ثلث', 'جيوس', 'سنيريا', 'عرب الرماضين'],
  'طوباس': ['طوباس', 'بردلة', 'طمون', 'عقابا', 'خربة فرعة'],
  'غزة': ['غزة', 'بيت لاهيا', 'بيت حانون', 'جباليا', 'الزيتون', 'الدرج', 'الرمال', 'الشجاعية', 'تفاح', 'الصبرة'],
  'خان يونس': ['خان يونس', 'بني سهيلا', 'عبسان', 'خزاعة', 'الفخاري', 'القرارة', 'أم الكلاب'],
  'رفح': ['رفح', 'الشوكة', 'النصر', 'البريج', 'المواسي', 'تل السلطان', 'خربة العدس'],
  'دير البلح': ['دير البلح', 'الزوايدة', 'المغازي', 'البريج', 'النصيرات', 'وادي غزة'],
  'شمال غزة': ['بيت لاهيا', 'بيت حانون', 'جباليا', 'أم النصر', 'المسدرة'],
  'حيفا': ['حيفا', 'أم الفحم', 'طيرة الكرمل', 'دالية الكرمل', 'جسر الزرقاء', 'أم الزينات', 'الفريديس'],
  'عكا': ['عكا', 'الناصرة', 'شفا عمرو', 'كفر ياسيف', 'جولس', 'المغار', 'دير الأسد', 'البعنة'],
  'الناصرة': ['الناصرة', 'يافة الناصرة', 'الرينة', 'عين ماهل', 'كفر كنا', 'مشهد', 'كسفا', 'مجدل شمس'],
  'يافا': ['يافا', 'اللد', 'الرملة', 'رحوفوت', 'حولون', 'بات يام', 'أور يهودا', 'رأس العين']
};

// ================================================
// 4. دوال مساعدة
// ================================================
function randomItem(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function extractNumberFromId(id) { return parseInt(id.replace(/\D/g, ''), 10); }

function getStatusBadge(status) {
  const map = { active: '<span class="status-badge-user active">نشط</span>', inactive: '<span class="status-badge-user inactive">غير نشط</span>', pending: '<span class="status-badge-user pending">قيد المراجعة</span>' };
  return map[status] || escapeHtml(status);
}

function getOrderStatusBadge(status) {
  const map = { 'completed': '<span class="order-status completed">مكتمل</span>', 'in-progress': '<span class="order-status in-progress">قيد التنفيذ</span>', 'pending': '<span class="order-status pending">قيد الانتظار</span>', 'cancelled': '<span class="order-status cancelled">ملغي</span>' };
  return map[status] || escapeHtml(status);
}

function getReportStatusBadge(status) {
  const map = { 'resolved': '<span class="report-status-badge resolved">تم الحل</span>', 'rejected': '<span class="report-status-badge rejected">مرفوض</span>', 'in-review': '<span class="report-status-badge in-review">قيد المراجعة</span>', 'in-progress': '<span class="report-status-badge in-progress">قيد المعالجة</span>' };
  return map[status] || escapeHtml(status);
}

// ================================================
// STARS-010B1 CSP compatibility
// ================================================
function setInlineDisplay(element, visible) {
  if (!element) return;

  element.classList.toggle(
    'csp-hidden',
    !visible,
  );

  element.classList.toggle(
    'csp-inline-block',
    visible,
  );
}

const adminActionHandlers = Object.freeze({
  activateDriver,
  activateUser,
  approveProvider,
  changeDriverPassword,
  changeUserPassword,
  closeChat,
  closeDocuments,
  closeDriverReport,
  closeListModal,
  closeOrderDetails,
  closeReport,
  closeReportDetail,
  closeResetPassword,
  closeUserOrders,
  deleteDriver,
  deleteReport,
  deleteUser,
  deleteAd,
  editAd,
  showAdTab,
  toggleAdCountdown,
  loadAdStats,
  showAdDaily,
  freezeDriver,
  freezeUser,
  handleResetPassword,
  manageTwoFactor,
  markPaid,
  resetAllCommissions,
  resetDriverCommission,
  openChat,
  openDriverReports,
  openEditDriver,
  openInlineDriverEdit,
  closeDriverEdit,
  clearProfileReports,
  undoCommissionAction,
  undoResetAll,
  openEditUser,
  closeUserEdit,
  openListModal,
  openOrderDetails,
  selectDriverFromList,
  selectUserFromList,
  openReplyModal,
  openResetPassword,
  rejectProvider,
  resolveReport,
  approveDeletionRequest,
  selectGovernorate,
  sendBroadcast,
  sendChatMessage,
  sendReply,
  adminCancelOrder,
  adminEndSuspension,
  adminRejectOffer,
  adminResendOrder,
  toggleAd,
  toggleDriverAvailability,
  viewDocuments,
  viewPendingProviderDocuments,
  viewDriverOrdersViaDB,
  viewReportDetail,
  viewUserOrdersViaDB,
});

function stampStaticAdminActionCapabilities() {
  if (!adminActionCapability) {
    return;
  }

  document
    .querySelectorAll(
      '[data-admin-action]',
    )
    .forEach(
      (element) => {
        element.setAttribute(
          'data-admin-capability',
          adminActionCapability,
        );
      },
    );
}

stampStaticAdminActionCapabilities();

// Cards that act as buttons (role="button") open with Enter or Space too.
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  const target = event.target;
  if (
    target instanceof Element
    && target.getAttribute('role') === 'button'
    && target.hasAttribute('data-admin-action')
  ) {
    event.preventDefault();
    target.click();
  }
});


document.addEventListener(
  'click',
  (event) => {
    if (!(event.target instanceof Element)) {
      return;
    }

    const trigger = event.target.closest(
      '[data-admin-action]',
    );

    if (!trigger) {
      return;
    }

    if (
      !adminActionCapability
      || trigger.getAttribute(
        'data-admin-capability',
      ) !== adminActionCapability
    ) {
      return;
    }

    const action = trigger.getAttribute(
      'data-admin-action',
    );

    const handler =
      adminActionHandlers[action];

    if (typeof handler !== 'function') {
      return;
    }

    const argCount = Number(
      trigger.getAttribute(
        'data-admin-arg-count',
      )
      || '0',
    );

    const args = [];

    for (
      let index = 1;
      index <= argCount;
      index += 1
    ) {
      args.push(
        trigger.getAttribute(
          `data-admin-arg-${index}`,
        )
        ?? '',
      );
    }

    handler(...args);
  },
);

// ================================================
// 5. إضافة سائق جديد
// ================================================
document.getElementById('addDriverForm').addEventListener('submit', function (e) {
  e.preventDefault();
  addNewDriver();
});

async function addNewDriver() {
  const form = document.getElementById('addDriverForm');
  const formData = new FormData(form);
  const name =
    String(
      formData.get('driverName')
      || '',
    ).trim();

  const email =
    String(
      formData.get('driverEmail')
      || '',
    ).trim();

  const phone =
    String(
      formData.get('driverPhone')
      || '',
    ).trim();

  const password =
    String(
      formData.get('driverPassword')
      || '',
    );

  const passwordConfirm =
    String(
      formData.get('driverPasswordConfirm')
      || '',
    );

  const governorate =
    String(
      formData.get('driverGovernorate')
      || '',
    ).trim();

  const area =
    String(
      formData.get('driverArea')
      || '',
    ).trim();

  const errorElement =
    document.getElementById('formErrorMsg');

  const successElement =
    document.getElementById('formSuccessMsg');

  if (
    !name
    || !email
    || !phone
    || !password
    || !passwordConfirm
  ) {
    errorElement.textContent =
      'الرجاء ملء جميع الحقول المطلوبة';

    errorElement.classList.add('show');
    successElement.classList.remove('show');
    return;
  }

  if (
    password.length < 12
    || password.length > 128
  ) {
    errorElement.textContent =
      'كلمة المرور الأولية يجب أن تكون بين 12 و128 حرفاً';

    errorElement.classList.add('show');
    successElement.classList.remove('show');
    return;
  }

  if (
    password !== passwordConfirm
  ) {
    errorElement.textContent =
      'كلمتا المرور غير متطابقتين';

    errorElement.classList.add('show');
    successElement.classList.remove('show');
    return;
  }

  if (!governorate || !area) {
    errorElement.textContent =
      'اختر المحافظة والقرية أو المدينة.';
    errorElement.classList.add('show');
    successElement.classList.remove('show');
    return;
  }

  try {
    const payload = {
      driverName: name,
      driverEmail: email,
      driverPhone: phone,
      driverCustomId: String(
        formData.get('driverCustomId') || '',
      ).trim(),
      driverServiceType: String(
        formData.get('driverServiceType') || '',
      ),
      driverLicenseType: String(
        formData.get('driverLicenseType') || '',
      ),
      driverGovernorate: governorate,
      driverArea: area,
      driverPassword: password,
      driverPasswordConfirm: passwordConfirm,
    };

    const res =
      await adminFetch(
        '/admin/drivers',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        },
      );

    const data =
      await res.json();

    if (data.success) {
      successElement.textContent =
        data.message;

      successElement.classList.add('show');
      errorElement.classList.remove('show');

      form.reset();
      const governorateSelect = document.getElementById('driverGovernorateSelect');
      const areaSelect = document.getElementById('driverAreaSelect');
      if (governorateSelect) governorateSelect.value = '';
      if (areaSelect) {
        areaSelect.innerHTML = '<option value="">اختر القرية أو المدينة...</option>';
        areaSelect.disabled = true;
      }
      loadDashboardStats();

      setTimeout(
        () => {
          successElement.classList.remove('show');
        },
        5000,
      );
    } else {
      errorElement.textContent =
        data.message;

      errorElement.classList.add('show');
      successElement.classList.remove('show');
    }
  } catch (err) {
    errorElement.textContent =
      'حدث خطأ في الاتصال';

    errorElement.classList.add('show');
  }
}

// ================================================
// البحث عن الحسابات: نفس قواعد السيرفر (services/accountSearch.js)
// ID أو البريد أو أي رقم هاتف (بأي كتابة) أو جزء من الاسم.
// ================================================
function toLatinDigits(value) {
  return String(value ?? '')
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06F0));
}

// 0599123456 و +970599123456 و +972599123456 كلها تعطي 599123456.
function searchPhoneCore(value) {
  let digits = toLatinDigits(value).replace(/[\s\-().\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  digits = digits.replace(/^\+/, '');
  if (/^97[02]\d{6,}$/.test(digits)) digits = digits.slice(3);
  else if (digits.startsWith('0')) digits = digits.slice(1);
  return digits;
}

function cleanAccountQuery(raw) {
  const text = String(raw ?? '').trim();
  return text.replace(/^(?:id\b[\s:#-]*|#)/i, '').trim() || text;
}

// account: { name, publicId, email, phones: [] }
function accountMatches(account, raw) {
  const query = cleanAccountQuery(raw);
  if (!query) return true;
  const lower = toLatinDigits(query).toLowerCase();
  const publicId = String(account.publicId || '').toLowerCase();
  if (publicId && publicId.includes(lower)) return true;
  if (String(account.name || '').toLowerCase().includes(query.toLowerCase())) return true;
  if (String(account.email || '').toLowerCase().includes(lower)) return true;
  const core = searchPhoneCore(query);
  if (/^\d{4,}$/.test(core)) {
    return (account.phones || []).some((phone) => searchPhoneCore(phone).includes(core));
  }
  return false;
}

// عدة حسابات تطابق البحث: قائمة يختار منها المشرف.
function renderAccountMatches(container, matches, more, role) {
  const rows = matches.map((account) => {
    const id = escapeHtml(String(account._id));
    const place = [account.governorate, account.area].filter(Boolean).join(' / ');
    const button = role === 'provider'
      ? `<button class="order-action-btn details" data-admin-capability="${escapeHtml(adminActionCapability || '')}" data-admin-action="selectDriverFromList" data-admin-arg-count="1" data-admin-arg-1="${id}"><i class="fas fa-eye"></i> عرض</button>`
      : `<button class="order-action-btn details" data-admin-capability="${escapeHtml(adminActionCapability || '')}" data-admin-action="selectUserFromList" data-admin-arg-count="1" data-admin-arg-1="${id}"><i class="fas fa-eye"></i> عرض</button>`;
    return `<tr>
      <td><strong>${escapeHtml(account.fullName || 'غير محدد')}</strong>${account.publicId ? `<br><small>ID ${escapeHtml(account.publicId)}</small>` : ''}</td>
      <td dir="ltr">${escapeHtml(account.phone || '')}</td>
      <td dir="ltr">${escapeHtml(account.email || '')}</td>
      <td>${escapeHtml(place || 'غير محدد')}</td>
      <td>${adminAccountStatusBadge(account.status)}</td>
      <td>${button}</td>
    </tr>`;
  }).join('');
  container.innerHTML = `<div class="search-matches">
    <h4>${escapeHtml(matches.length)} ${role === 'provider' ? 'سائقين' : 'مستخدمين'} يطابقون البحث — اختر الحساب</h4>
    <table class="orders-table"><thead><tr><th>الاسم</th><th>الجوال</th><th>البريد</th><th>المحافظة / المدينة</th><th>الحالة</th><th>إجراء</th></tr></thead><tbody>${rows}</tbody></table>
    ${more ? '<p class="more-matches">توجد نتائج أخرى. اكتب الرقم أو البريد كاملاً لتضييق البحث.</p>' : ''}
  </div>`;
  container.classList.add('show');
}

// ================================================
// 6. البحث عن سائق
// ================================================
document.getElementById('driverSearchBtn').addEventListener('click', searchDriver);
document.getElementById('driverSearchInput').addEventListener('keypress', e => { if (e.key === 'Enter') searchDriver(); });

async function searchDriver() {
  const input = document.getElementById('driverSearchInput');
  const raw = input.value.trim();
  if (!raw) return adminAlert('الرجاء إدخال ID السائق أو رقم الهاتف أو البريد الإلكتروني أو الاسم');

  const resultElement = document.getElementById('driverResult');
  resultElement.removeAttribute('data-driver-id');

  try {
    const res = await adminFetch(`/admin/drivers/search?id=${encodeURIComponent(raw)}`);
    const data = await res.json();
    if (data.error) {
      document.getElementById('driverResult').innerHTML = `<div class="not-found">${escapeHtml(data.error)}</div>`;
      document.getElementById('driverResult').classList.add('show');
      return;
    }
    if (Array.isArray(data.matches)) {
      renderAccountMatches(resultElement, data.matches, data.more, 'provider');
      return;
    }
    renderDriverResultFromDB(data);
  } catch (err) {
    document.getElementById('driverResult').innerHTML = '<div class="not-found">حدث خطأ في البحث</div>';
    document.getElementById('driverResult').classList.add('show');
  }
}

async function ensureAdminAreasLoaded() {
  if (Object.keys(adminAreasByGovernorate).length > 0) return;
  await loadAreasForDropdown();
}

function fillEditGovernorateSelect(selected, selectId = 'driverEditGovernorate') {
  const select = document.getElementById(selectId);
  if (!select) return;
  select.innerHTML = '<option value="">اختر المحافظة...</option>';
  Object.keys(adminAreasByGovernorate).sort().forEach((governorate) => {
    const option = document.createElement('option');
    option.value = governorate;
    option.textContent = governorate;
    select.appendChild(option);
  });
  select.value = selected || '';
}

function fillEditAreaSelect(governorate, selected, selectId = 'driverEditArea') {
  const select = document.getElementById(selectId);
  if (!select) return;
  select.innerHTML = '<option value="">اختر القرية أو المدينة...</option>';

  if (!governorate) {
    select.disabled = true;
    return;
  }

  select.disabled = false;
  const itself = document.createElement('option');
  itself.value = governorate;
  itself.textContent = `من ${governorate} نفسها`;
  select.appendChild(itself);

  for (const city of adminAreasByGovernorate[governorate] || []) {
    const option = document.createElement('option');
    option.value = city;
    option.textContent = city;
    select.appendChild(option);
  }

  if (
    selected
    && ![...select.options].some((option) => option.value === selected)
  ) {
    const current = document.createElement('option');
    current.value = selected;
    current.textContent = selected;
    select.appendChild(current);
  }

  select.value = selected || '';
}

async function openEditDriver(driverId) {
  try {
    const res = await adminFetch(
      `/admin/drivers/search?id=${encodeURIComponent(driverId)}`,
    );
    const data = await res.json();
    if (data.error || !data.driver) {
      adminAlert(data.error || 'تعذر تحميل بيانات السائق.');
      return;
    }

    await ensureAdminAreasLoaded();
    const driver = data.driver;

    document.getElementById('driverEditId').value = driver._id;
    document.getElementById('driverEditSub').textContent =
      `${driver.name} — ${driver.driverId}`;
    document.getElementById('driverEditName').value = driver.name || '';
    document.getElementById('driverEditEmail').value = driver.email || '';
    document.getElementById('driverEditPhone').value = driver.phone || '';
    document.getElementById('driverEditPublicId').value = driver.publicId || '';
    const commissionDueInput = document.getElementById(
      'driverEditCommissionDue',
    );
    const commissionDue = Number(
      driver.commissionDue ?? data.commission ?? 0,
    );
    commissionDueInput.value = commissionDue.toFixed(2);
    commissionDueInput.dataset.original = commissionDue.toFixed(2);
    document.getElementById('driverEditLicenseType').value =
      driver.licenseType === 'غير محدد' ? '' : (driver.licenseType || '');
    document.getElementById('driverEditStatus').value =
      ['active', 'inactive', 'blocked'].includes(driver.status)
        ? driver.status
        : 'active';
    document.getElementById('driverEditLicenseNotAvailable').checked =
      driver.licenseNotAvailable === true;
    document.getElementById('driverEditAvailable').checked =
      driver.isAvailable !== false;
    document.getElementById('driverEditGovernorateLevel').checked =
      driver.governorateLevel === true;

    const serviceTypes = Array.isArray(driver.serviceTypes)
      ? driver.serviceTypes
      : [];
    document.getElementById('driverEditServiceProduct').checked =
      serviceTypes.includes('product');
    document.getElementById('driverEditServicePeople').checked =
      serviceTypes.includes('people');
    document.getElementById('driverEditServiceGoods').checked =
      serviceTypes.includes('goods');

    fillEditGovernorateSelect(driver.governorate || '');
    fillEditAreaSelect(
      driver.governorate || '',
      driver.area === 'غير محدد' ? '' : (driver.area || ''),
    );

    const msg = document.getElementById('driverEditMsg');
    msg.textContent = '';
    msg.className = 'msg';
    document.getElementById('driverEditModal').classList.add('show');
  } catch (err) {
    adminAlert('تعذر تحميل بيانات السائق.');
  }
}

function closeDriverEdit() {
  document.getElementById('driverEditModal').classList.remove('show');
}

function inlineOption(value, label, selected) {
  return `<option value="${escapeHtml(value)}"${value === selected ? ' selected' : ''}>${escapeHtml(label)}</option>`;
}

function inlineGovernorateOptions(selected) {
  return '<option value="">اختر المحافظة...</option>'
    + Object.keys(adminAreasByGovernorate)
      .sort()
      .map((governorate) => inlineOption(governorate, governorate, selected))
      .join('');
}

function inlineAreaOptions(governorate, selected) {
  let html = '<option value="">اختر القرية أو المدينة...</option>';
  if (!governorate) return html;

  html += inlineOption(
    governorate,
    `من ${governorate} نفسها`,
    selected,
  );

  for (const city of adminAreasByGovernorate[governorate] || []) {
    html += inlineOption(city, city, selected);
  }

  if (
    selected
    && selected !== governorate
    && !(adminAreasByGovernorate[governorate] || []).includes(selected)
  ) {
    html += inlineOption(selected, selected, selected);
  }

  return html;
}

async function openInlineDriverEdit(driverId) {
  try {
    const res = await adminFetch(
      `/admin/drivers/search?id=${encodeURIComponent(driverId)}`,
    );
    const data = await res.json();
    if (data.error || !data.driver) {
      adminAlert(data.error || 'تعذر تحميل بيانات السائق.');
      return;
    }

    await ensureAdminAreasLoaded();
    renderInlineDriverEditor(data.driver, data.commission);
  } catch (err) {
    adminAlert('تعذر تحميل بيانات السائق.');
  }
}

function renderInlineDriverEditor(driver, commission) {
  const container = document.getElementById('driverResult');
  const serviceTypes = Array.isArray(driver.serviceTypes)
    ? driver.serviceTypes
    : [];
  const due = Number(driver.commissionDue ?? commission ?? 0);
  const status = ['active', 'inactive', 'blocked'].includes(driver.status)
    ? driver.status
    : 'active';

  container.innerHTML = `
    <div class="driver-inline-editor">
      <h4><i class="fas fa-user-edit"></i> تعديل مباشر لبيانات السائق</h4>
      <div class="sub">${escapeHtml(driver.name)} — ${escapeHtml(driver.driverId)}</div>
      <form id="inlineDriverForm">
        <input type="hidden" id="inlineDriverId" value="${escapeHtml(driver._id)}">
        <input type="hidden" id="inlineDriverOriginalCommission" value="${escapeHtml(String(due))}">
        <div class="form-grid">
          <div class="form-group"><label>ID السائق (المعرف العام)</label><input id="inlineDriverPublicId" type="text" maxlength="50" value="${escapeHtml(driver.publicId || '')}" required></div>
          <div class="form-group"><label>الاسم الكامل</label><input id="inlineDriverName" type="text" maxlength="120" value="${escapeHtml(driver.name || '')}" required></div>
          <div class="form-group"><label>البريد الإلكتروني</label><input id="inlineDriverEmail" type="email" maxlength="160" value="${escapeHtml(driver.email || '')}" required></div>
          <div class="form-group"><label>رقم الجوال</label><input id="inlineDriverPhone" type="text" maxlength="30" value="${escapeHtml(driver.phone || '')}" required></div>
          <div class="form-group"><label>المحافظة</label><select id="inlineDriverGovernorate" required>${inlineGovernorateOptions(driver.governorate || '')}</select></div>
          <div class="form-group"><label>القرية / المدينة</label><select id="inlineDriverArea" required>${inlineAreaOptions(driver.governorate || '', driver.area === 'غير محدد' ? '' : (driver.area || ''))}</select></div>
          <div class="form-group"><label>حالة الحساب</label><select id="inlineDriverStatus">${inlineOption('active', 'نشط', status)}${inlineOption('inactive', 'موقوف', status)}${inlineOption('blocked', 'محظور', status)}</select></div>
          <div class="form-group"><label>نوع الرخصة</label><input id="inlineDriverLicenseType" type="text" maxlength="120" value="${escapeHtml(driver.licenseType === 'غير محدد' ? '' : (driver.licenseType || ''))}"></div>
          <div class="form-group"><label>عمولة المنصة المستحقة (شيكل)</label><input id="inlineDriverCommissionDue" type="number" min="0" step="0.01" value="${escapeHtml(due.toFixed(2))}" required><small>تعديلها يسجّل تسوية على حساب السائق.</small></div>
          <div class="form-group"><label>أنواع الخدمات</label>
            <div class="service-checkboxes">
              <label class="checkbox-line"><input id="inlineDriverServiceProduct" type="checkbox"${serviceTypes.includes('product') ? ' checked' : ''}> توصيل منتجات</label>
              <label class="checkbox-line"><input id="inlineDriverServicePeople" type="checkbox"${serviceTypes.includes('people') ? ' checked' : ''}> توصيل ركاب</label>
              <label class="checkbox-line"><input id="inlineDriverServiceGoods" type="checkbox"${serviceTypes.includes('goods') ? ' checked' : ''}> نقل بضائع</label>
            </div>
            <small>اترك الجميع فارغاً لاستقبال جميع الخدمات.</small>
          </div>
          <div class="form-group full-width">
            <label class="checkbox-line"><input id="inlineDriverLicenseNotAvailable" type="checkbox"${driver.licenseNotAvailable === true ? ' checked' : ''}> لا يملك رخصة قيادة</label>
            <label class="checkbox-line"><input id="inlineDriverAvailable" type="checkbox"${driver.isAvailable !== false ? ' checked' : ''}> متاح لاستقبال الطلبات الآن</label>
            <label class="checkbox-line"><input id="inlineDriverGovernorateLevel" type="checkbox"${driver.governorateLevel === true ? ' checked' : ''}> استقبال طلبات على مستوى المحافظة</label>
          </div>
        </div>
        <div id="inlineDriverMsg" class="msg"></div>
        <button type="submit" class="btn-submit-driver"><i class="fas fa-save"></i> حفظ التغييرات</button>
        <button type="button" id="inlineDriverCancel" class="modal-close-btn"><i class="fas fa-times"></i> إلغاء</button>
      </form>
    </div>
  `;

  const form = document.getElementById('inlineDriverForm');
  if (form) form.addEventListener('submit', saveInlineDriverEdits);

  const governorate = document.getElementById('inlineDriverGovernorate');
  if (governorate) {
    governorate.addEventListener('change', () => {
      const area = document.getElementById('inlineDriverArea');
      if (area) area.innerHTML = inlineAreaOptions(governorate.value, '');
    });
  }

  const cancel = document.getElementById('inlineDriverCancel');
  if (cancel) {
    cancel.addEventListener('click', () => {
      document.getElementById('driverSearchInput').value =
        driver.publicId || driver._id;
      searchDriver();
    });
  }
}

async function saveInlineDriverEdits(event) {
  event.preventDefault();
  const msg = document.getElementById('inlineDriverMsg');
  const id = document.getElementById('inlineDriverId').value;
  const serviceTypes = [];
  if (document.getElementById('inlineDriverServiceProduct').checked) {
    serviceTypes.push('product');
  }
  if (document.getElementById('inlineDriverServicePeople').checked) {
    serviceTypes.push('people');
  }
  if (document.getElementById('inlineDriverServiceGoods').checked) {
    serviceTypes.push('goods');
  }

  const payload = {
    publicId: document.getElementById('inlineDriverPublicId').value.trim(),
    fullName: document.getElementById('inlineDriverName').value.trim(),
    email: document.getElementById('inlineDriverEmail').value.trim(),
    phone: document.getElementById('inlineDriverPhone').value.trim(),
    governorate: document.getElementById('inlineDriverGovernorate').value,
    area: document.getElementById('inlineDriverArea').value,
    status: document.getElementById('inlineDriverStatus').value,
    licenseType: document.getElementById('inlineDriverLicenseType').value.trim(),
    licenseNotAvailable:
      document.getElementById('inlineDriverLicenseNotAvailable').checked,
    isAvailable: document.getElementById('inlineDriverAvailable').checked,
    governorateLevel:
      document.getElementById('inlineDriverGovernorateLevel').checked,
    serviceTypes,
  };

  const commissionInput = document.getElementById(
    'inlineDriverCommissionDue',
  );
  const originalCommission = Number(
    document.getElementById('inlineDriverOriginalCommission').value,
  );
  const commissionDue = Number(commissionInput.value);
  if (commissionDue !== originalCommission) {
    payload.commissionDue = commissionDue;
  }

  try {
    const res = await adminFetch(
      `/admin/drivers/${encodeURIComponent(id)}/profile`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
    );
    const data = await res.json();

    if (!data.success) {
      msg.textContent = data.message || 'تعذر حفظ التعديلات.';
      msg.className = 'msg error';
      return;
    }

    msg.textContent = data.message || 'تم تحديث بيانات السائق بنجاح.';
    msg.className = 'msg success';
    loadDriversList();
    loadDashboardStats();

    setTimeout(() => {
      document.getElementById('driverSearchInput').value =
        data.driver?.publicId || data.driver?._id || id;
      searchDriver();
    }, 600);
  } catch (err) {
    msg.textContent = 'تعذر حفظ التعديلات.';
    msg.className = 'msg error';
  }
}

async function saveDriverEdits(event) {
  event.preventDefault();
  const id = document.getElementById('driverEditId').value;
  const msg = document.getElementById('driverEditMsg');
  const serviceTypes = [];
  if (document.getElementById('driverEditServiceProduct').checked) {
    serviceTypes.push('product');
  }
  if (document.getElementById('driverEditServicePeople').checked) {
    serviceTypes.push('people');
  }
  if (document.getElementById('driverEditServiceGoods').checked) {
    serviceTypes.push('goods');
  }

  const payload = {
    fullName: document.getElementById('driverEditName').value.trim(),
    email: document.getElementById('driverEditEmail').value.trim(),
    phone: document.getElementById('driverEditPhone').value.trim(),
    publicId: document.getElementById('driverEditPublicId').value.trim(),
    governorate: document.getElementById('driverEditGovernorate').value,
    area: document.getElementById('driverEditArea').value,
    status: document.getElementById('driverEditStatus').value,
    licenseType: document.getElementById('driverEditLicenseType').value.trim(),
    licenseNotAvailable:
      document.getElementById('driverEditLicenseNotAvailable').checked,
    isAvailable: document.getElementById('driverEditAvailable').checked,
    governorateLevel:
      document.getElementById('driverEditGovernorateLevel').checked,
    serviceTypes,
  };

  const commissionDueInput = document.getElementById(
    'driverEditCommissionDue',
  );
  const originalCommissionDue = Number(
    commissionDueInput.dataset.original,
  );
  const commissionDue = Number(commissionDueInput.value);

  // Only send the commission when the admin actually changed it. Otherwise a
  // new order arriving while the modal is open could be overwritten by the
  // stale value loaded when the modal opened.
  if (
    !Number.isFinite(originalCommissionDue)
    || commissionDue !== originalCommissionDue
  ) {
    payload.commissionDue = commissionDue;
  }

  try {
    const res = await adminFetch(
      `/admin/drivers/${encodeURIComponent(id)}/profile`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
    );
    const data = await res.json();

    if (!data.success) {
      msg.textContent = data.message || 'تعذر حفظ التعديلات.';
      msg.className = 'msg error';
      return;
    }

    msg.textContent = data.message || 'تم تحديث بيانات السائق بنجاح.';
    msg.className = 'msg success';

    setTimeout(() => {
      closeDriverEdit();
      searchDriverById(id);
      loadDriversList();
      loadDashboardStats();
    }, 600);
  } catch (err) {
    msg.textContent = 'تعذر حفظ التعديلات.';
    msg.className = 'msg error';
  }
}

const driverEditGovernorate = document.getElementById('driverEditGovernorate');
if (driverEditGovernorate) {
  driverEditGovernorate.addEventListener('change', () => {
    fillEditAreaSelect(driverEditGovernorate.value, '');
  });
}

const driverEditForm = document.getElementById('driverEditForm');
if (driverEditForm) {
  driverEditForm.addEventListener('submit', saveDriverEdits);
}

const driverEditModal = document.getElementById('driverEditModal');
if (driverEditModal) {
  driverEditModal.addEventListener('click', function (event) {
    if (event.target === this) closeDriverEdit();
  });
}

const driverResultElement = document.getElementById('driverResult');
if (driverResultElement) {
  driverResultElement.addEventListener('click', function (event) {
    if (event.target.closest('.driver-inline-editor')) return;
    if (event.target.closest('button, a, input, select, textarea')) return;
    const driverId = driverResultElement.dataset.driverId;
    if (driverId) openInlineDriverEdit(driverId);
  });
}

// ---- Profile status: reports filed against a driver or a customer ----
// role: 'driver' | 'user'. Cleared reports stay in the reports pages; they
// only stop counting against the profile.
function profileStatusSection(status, role, id) {
  const s = status || {};
  const total = Number(s.total) || 0;
  const badge = total > 0
    ? `<span class="profile-reports-count has-reports">${escapeHtml(total)} بلاغ</span>`
    : '<span class="profile-reports-count">لا توجد بلاغات</span>';
  const breakdown = total > 0
    ? `<div class="row"><span class="label">تفاصيل البلاغات</span><span class="value">قيد المراجعة ${escapeHtml(Number(s.open) || 0)} · تم الحل ${escapeHtml(Number(s.resolved) || 0)} · مرفوضة ${escapeHtml(Number(s.rejected) || 0)}</span></div>
       <div class="row"><span class="label">آخر بلاغ</span><span class="value">${escapeHtml(formatDisplayDate(s.lastReportedAt))}</span></div>`
    : '';
  const cleared = Number(s.cleared) > 0
    ? `<div class="row"><span class="label">بلاغات مُسحت من الملف سابقاً</span><span class="value">${escapeHtml(Number(s.cleared))}</span></div>`
    : '';
  const button = total > 0
    ? `<button class="action-btn clear-reports" data-admin-capability="${escapeHtml(adminActionCapability || '')}" data-admin-action="clearProfileReports" data-admin-arg-count="2" data-admin-arg-1="${escapeHtml(role)}" data-admin-arg-2="${escapeHtml(String(id))}"><i class="fas fa-broom"></i> مسح البلاغات من الملف</button>`
    : '<button class="action-btn clear-reports" disabled><i class="fas fa-broom"></i> مسح البلاغات من الملف</button>';
  return `
    <div class="profile-status" role="group" aria-label="حالة الملف الشخصي">
      <h5>حالة الملف الشخصي</h5>
      <div class="row"><span class="label">عدد البلاغات ضده</span><span class="value">${badge}</span></div>
      ${breakdown}
      ${cleared}
      <div class="profile-status-actions">${button}</div>
    </div>`;
}

async function clearProfileReports(role, id) {
  const isDriver = role === 'driver';
  const confirmed = await adminConfirm(
    `مسح البلاغات من ملف ${isDriver ? 'السائق' : 'المستخدم'}؟ سيصبح عدد البلاغات ضده صفراً. `
    + 'البلاغات نفسها تبقى في صفحة البلاغات ولا تُحذف.',
  );
  if (!confirmed) return;
  try {
    const base = isDriver ? '/admin/drivers' : '/admin/users';
    const res = await adminFetch(`${base}/${encodeURIComponent(id)}/profile-reports/clear`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok || !data.success) {
      await adminAlert(data.message || 'تعذر مسح البلاغات.');
      return;
    }
    // Redraw the card with the fresh figures.
    const again = await adminFetch(`${base}/search?id=${encodeURIComponent(id)}`);
    const fresh = await again.json();
    if (!fresh.error) {
      if (isDriver) renderDriverResultFromDB(fresh);
      else renderUserResultFromDB(fresh.user);
    }
    await adminAlert(data.cleared > 0
      ? `تم مسح ${data.cleared} بلاغ من الملف.`
      : 'لا توجد بلاغات لمسحها.');
  } catch (err) {
    await adminAlert('تعذر مسح البلاغات. حاول مرة أخرى.');
  }
}

function renderDriverResultFromDB(data) {
  const {
    driver,
    commission,
    netProfit,
    last30Profit,
    acceptedOrdersCount,
    notAcceptedOrdersCount,
  } = data;
  const container = document.getElementById('driverResult');
  container.dataset.driverId = driver._id;
  const paymentStatus = driver.financial.paymentStatus;
  const hasDue = Number(commission) > 0;
  const paymentLabel = hasDue
    ? `<span class="unpaid-badge">غير مدفوع (${escapeHtml(commission)} )</span>`
    : paymentStatus === 'reset'
      ? '<span class="reset-badge">تم تصفير العداد</span>'
      : paymentStatus === 'paid'
        ? '<span class="paid-badge">تم دفع المستحقات</span>'
        : '<span class="paid-badge">لا توجد مستحقات</span>';
  container.innerHTML = `
    <h4 data-presentation="p017">بيانات السائق</h4>
     <div class="row"><span class="label">ID السائق</span><span class="value">${escapeHtml(driver.driverId)}</span></div>
    <div class="row"><span class="label">الاسم الكامل</span><span class="value">${escapeHtml(driver.name)}</span></div>
    <div class="row"><span class="label">البريد الإلكتروني</span><span class="value">${escapeHtml(driver.email)}</span></div>
    <div class="row"><span class="label">رقم الجوال</span><span class="value">${escapeHtml(driver.phone)}</span></div>
    <div class="row"><span class="label">نوع الخدمة</span><span class="value">${escapeHtml(driver.serviceType || 'غير محدد')}</span></div>
    <div class="row"><span class="label">نوع السائق</span><span class="value">${escapeHtml(driver.licenseType || 'غير محدد')}</span></div>
    ${driver.licenseNotAvailable ? '<div class="row"><span class="label">رخصة القيادة</span><span class="value"><span class="unpaid-badge">غير متوفرة — سُجّل بدون رخصة</span></span></div>' : ''}
    <div class="row"><span class="label">حالة التوفر</span><span class="value">${driver.isAvailable ? '<span class="order-status-badge completed">متاح الآن</span>' : '<span class="order-status-badge cancelled">غير متاح</span>'}${driver.blockedUntil && new Date(driver.blockedUntil) > new Date() ? ' <span class="order-status-badge pending">مشغول بطلب</span>' : ''}</span></div>
    <div class="row"><span class="label">المحافظة</span><span class="value">${escapeHtml(driver.governorate || 'غير محدد')}</span></div>
    <div class="row"><span class="label">المدينة / القرية</span><span class="value">${escapeHtml(driver.city || driver.area || 'غير محدد')}</span></div>
    <div class="row"><span class="label">الحالة</span><span class="value">${getStatusBadge(driver.status)}</span></div>
    <div class="row"><span class="label">إجمالي الطلبات المقبولة</span><span class="value">${escapeHtml(acceptedOrdersCount ?? 0)}</span></div>
    <div class="row"><span class="label">إجمالي الطلبات غير المقبولة</span><span class="value">${escapeHtml(notAcceptedOrdersCount ?? 0)}</span></div>
    <div class="driver-orders-note">المقبولة: الطلبات التي قبلها الزبون وأُسندت للسائق. غير المقبولة: الطلبات التي رفضها السائق، أو لم يقبل الزبون عرضه، أو انتهت مهلة قبول عرض السعر.</div>
    <div class="row"><span class="label">حالة الدفع</span><span class="value">${paymentLabel}</span></div>
    ${Array.isArray(driver.financial.payments) && driver.financial.payments.length > 0 ? `<div class="row"><span class="label">آخر دفعة مسجلة</span><span class="value">${escapeHtml(driver.financial.payments[0].amount)} شيكل — ${escapeHtml(formatDisplayDateTime(driver.financial.payments[0].paidAt))}</span></div>` : ''}
    <div class="row"><span class="label">إجمالي الأرباح (صافي)</span><span class="value" data-presentation="p002">${escapeHtml(netProfit)} </div>
    <div class="row"><span class="label">أرباح آخر 30 يوم (صافي)</span><span class="value" data-presentation="p018">${escapeHtml(last30Profit)} </div>
    <div class="row"><span class="label">عمولة المنصة المستحقة</span><span class="value" data-presentation="p019">${escapeHtml(commission)} </div>
    ${driver.lastCommissionAction ? `<div class="row commission-last-action"><span class="label">آخر عملية على العمولة</span><span class="value">${commissionActionLabel(driver.lastCommissionAction)} ${commissionUndoButton(driver.lastCommissionAction, driver._id)}</span></div>` : ''}
    ${profileStatusSection(driver.profileStatus, 'driver', driver._id)}
    <div class="action-buttons">
      <button class="action-btn change-password" data-admin-capability="${escapeHtml(adminActionCapability || '')}" data-admin-action="openInlineDriverEdit" data-admin-arg-count="1" data-admin-arg-1="${escapeHtml(String(driver._id))}">تعديل بيانات السائق</button>
      <button class="action-btn chat" data-admin-capability="${escapeHtml(adminActionCapability || '')}" data-admin-action="openChat" data-admin-arg-count="2" data-admin-arg-1="driver" data-admin-arg-2="${escapeHtml(String(driver._id))}">مراسلة</button>
      <button class="action-btn report" data-admin-capability="${escapeHtml(adminActionCapability || '')}" data-admin-action="viewDriverOrdersViaDB" data-admin-arg-count="1" data-admin-arg-1="${escapeHtml(String(driver._id))}">تقرير الطلبات</button>
      <button class="action-btn orders-report" data-admin-capability="${escapeHtml(adminActionCapability || '')}" data-admin-action="openDriverReports" data-admin-arg-count="1" data-admin-arg-1="${escapeHtml(String(driver._id))}">تقرير رفض وتسليم الطلبات</button>
      <button class="action-btn ${driver.isAvailable ? 'freeze' : 'activate'}" data-admin-capability="${escapeHtml(adminActionCapability || '')}" data-admin-action="toggleDriverAvailability" data-admin-arg-count="2" data-admin-arg-1="${escapeHtml(String(driver._id))}" data-admin-arg-2="${driver.isAvailable ? 'true' : 'false'}">${driver.isAvailable ? 'إيقاف التوفر' : 'جعله متاحاً'}</button>
      <button class="action-btn change-password" data-admin-capability="${escapeHtml(adminActionCapability || '')}" data-admin-action="changeDriverPassword" data-admin-arg-count="1" data-admin-arg-1="${escapeHtml(String(driver._id))}" data-presentation="p020">تغيير كلمة المرور</button>
      ${paymentStatus === 'paid'
        ? '<button class="action-btn paid" disabled>تم دفع المستحقات</button>'
        : hasDue
          ? `<button class="action-btn pay-now" data-admin-capability="${escapeHtml(adminActionCapability || '')}" data-admin-action="markPaid" data-admin-arg-count="1" data-admin-arg-1="${escapeHtml(String(driver._id))}">تم دفع المستحقات</button>`
          : '<button class="action-btn paid" disabled>لا توجد مستحقات</button>'}
      <button class="action-btn reset-commissions" data-admin-capability="${escapeHtml(adminActionCapability || '')}" data-admin-action="resetDriverCommission" data-admin-arg-count="1" data-admin-arg-1="${escapeHtml(String(driver._id))}">تصفير عداد العمولة</button>
      <button class="action-btn docs" data-admin-capability="${escapeHtml(adminActionCapability || '')}" data-admin-action="viewDocuments" data-admin-arg-count="2" data-admin-arg-1="${escapeHtml(String(driver._id))}" data-admin-arg-2="${escapeHtml(String(driver.name || ''))}">الوثائق</button>
      <button class="action-btn freeze" data-admin-capability="${escapeHtml(adminActionCapability || '')}" data-admin-action="freezeDriver" data-admin-arg-count="1" data-admin-arg-1="${escapeHtml(String(driver._id))}">تجميد</button>
      <button class="action-btn activate" data-admin-capability="${escapeHtml(adminActionCapability || '')}" data-admin-action="activateDriver" data-admin-arg-count="1" data-admin-arg-1="${escapeHtml(String(driver._id))}">تفعيل</button>
      <button class="action-btn delete" data-admin-capability="${escapeHtml(adminActionCapability || '')}" data-admin-action="deleteDriver" data-admin-arg-count="1" data-admin-arg-1="${escapeHtml(String(driver._id))}">حذف نهائي</button>
    </div>
  `;
  container.classList.add('show');
}

// ================================================
// 7. البحث عن مستخدم
// ================================================
document.getElementById('userSearchBtn').addEventListener('click', searchUser);
document.getElementById('userSearchInput').addEventListener('keypress', e => { if (e.key === 'Enter') searchUser(); });

async function searchUser() {
  const input = document.getElementById('userSearchInput');
  const raw = input.value.trim();
  if (!raw) return adminAlert('الرجاء إدخال ID المستخدم أو رقم الهاتف أو البريد الإلكتروني أو الاسم');

  try {
    const res = await adminFetch(`/admin/users/search?id=${encodeURIComponent(raw)}`);
    const data = await res.json();
    if (data.error) {
      document.getElementById('userResult').innerHTML = `<div class="not-found">${escapeHtml(data.error)}</div>`;
      document.getElementById('userResult').classList.add('show');
      return;
    }
    if (Array.isArray(data.matches)) {
      renderAccountMatches(document.getElementById('userResult'), data.matches, data.more, 'customer');
      return;
    }
    renderUserResultFromDB(data.user);
  } catch (err) {
    document.getElementById('userResult').innerHTML = '<div class="not-found">حدث خطأ في البحث</div>';
    document.getElementById('userResult').classList.add('show');
  }
}

function renderUserResultFromDB(user) {
  const container = document.getElementById('userResult');
  const orderCount = user.orders ? user.orders.length : 0;
  container.innerHTML = `
    <h4 data-presentation="p017">بيانات المستخدم</h4>
     <div class="row"><span class="label">ID المستخدم</span><span class="value">${escapeHtml(user.userId)}</span></div>
    <div class="row"><span class="label">الاسم الكامل</span><span class="value">${escapeHtml(user.name)}</span></div>
    <div class="row"><span class="label">البريد الإلكتروني</span><span class="value">${escapeHtml(user.email)}</span></div>
    <div class="row"><span class="label">رقم الجوال</span><span class="value">${escapeHtml(user.phone)}</span></div>
    <div class="row"><span class="label">تاريخ التسجيل</span><span class="value">${escapeHtml(formatDisplayDate(user.joinDate))}</span></div>
    <div class="row"><span class="label">المحافظة</span><span class="value">${escapeHtml(user.governorate || 'غير محدد')}</span></div>
    <div class="row"><span class="label">المدينة / القرية</span><span class="value">${escapeHtml(user.city || user.area || 'غير محدد')}</span></div>
    <div class="row"><span class="label">الحالة</span><span class="value">${getStatusBadge(user.status)}</span></div>
    <div class="row"><span class="label">عدد الطلبات</span><span class="value">${escapeHtml(orderCount)}</span></div>
    <div class="row"><span class="label">تقييم السائقين له</span><span class="value">${user.rating && user.rating.count > 0 ? `⭐ ${escapeHtml(user.rating.average)} من 5 (${escapeHtml(user.rating.count)} تقييم)` : 'لا توجد تقييمات بعد'}</span></div>
    ${profileStatusSection(user.profileStatus, 'user', user._id)}
    <div class="action-buttons">
      <button class="action-btn chat" data-admin-capability="${escapeHtml(adminActionCapability || '')}" data-admin-action="openChat" data-admin-arg-count="2" data-admin-arg-1="user" data-admin-arg-2="${escapeHtml(String(user._id))}">مراسلة</button>
      <button class="action-btn edit" data-admin-capability="${escapeHtml(adminActionCapability || '')}" data-admin-action="openEditUser" data-admin-arg-count="1" data-admin-arg-1="${escapeHtml(String(user._id))}">تعديل البيانات</button>
      <button class="action-btn orders-report" data-admin-capability="${escapeHtml(adminActionCapability || '')}" data-admin-action="viewUserOrdersViaDB" data-admin-arg-count="1" data-admin-arg-1="${escapeHtml(String(user._id))}">تقرير الطلبات</button>
      <button class="action-btn change-password" data-admin-capability="${escapeHtml(adminActionCapability || '')}" data-admin-action="changeUserPassword" data-admin-arg-count="1" data-admin-arg-1="${escapeHtml(String(user._id))}" data-presentation="p020">تغيير كلمة المرور</button>
      <button class="action-btn freeze" data-admin-capability="${escapeHtml(adminActionCapability || '')}" data-admin-action="freezeUser" data-admin-arg-count="1" data-admin-arg-1="${escapeHtml(String(user._id))}">تجميد</button>
      <button class="action-btn activate" data-admin-capability="${escapeHtml(adminActionCapability || '')}" data-admin-action="activateUser" data-admin-arg-count="1" data-admin-arg-1="${escapeHtml(String(user._id))}">تفعيل</button>
      <button class="action-btn delete" data-admin-capability="${escapeHtml(adminActionCapability || '')}" data-admin-action="deleteUser" data-admin-arg-count="1" data-admin-arg-1="${escapeHtml(String(user._id))}">حذف نهائي</button>
    </div>
  `;
  container.classList.add('show');
}

// ================================================
// 8. الشات
// ================================================
let currentChatTarget = null;
let currentChatName = '';
let legacyChatPollTimer = null;

async function openChat(type, id) {
  currentChatTarget = { type, id };
  currentChatName = '';

  if (!supportSocket || !supportSocket.connected) {
    connectSupportSocket();
  }

  try {
    const res = await adminFetch(`/admin/chat/messages/${type}/${id}`);
    const data = await res.json();
    if (data.error) { adminAlert(data.error); return; }

    currentChatName = data.name || '';
    document.getElementById('chatTitle').textContent = `محادثة مع ${data.name}`;
    document.getElementById('chatSub').textContent = `مراسلة ${data.name} (${type === 'driver' ? 'سائق' : 'مستخدم'})`;
    renderChatMessages(data.messages, data.name);
    document.getElementById('chatModal').classList.add('show');
    document.getElementById('chatInput').value = '';
    document.getElementById('chatInput').focus();
    startLegacyChatPolling();
  } catch (err) {
    adminAlert('حدث خطأ في فتح المحادثة');
  }
}

function startLegacyChatPolling() {
  if (legacyChatPollTimer) clearInterval(legacyChatPollTimer);
  legacyChatPollTimer = setInterval(refreshLegacyChat, 10000);
}

function stopLegacyChatPolling() {
  if (legacyChatPollTimer) {
    clearInterval(legacyChatPollTimer);
    legacyChatPollTimer = null;
  }
}

async function refreshLegacyChat() {
  if (
    !currentChatTarget
    || !document.getElementById('chatModal').classList.contains('show')
  ) {
    return;
  }

  try {
    const res = await adminFetch(
      `/admin/chat/messages/${currentChatTarget.type}/${currentChatTarget.id}`,
    );
    const data = await res.json();
    if (data.error) return;
    currentChatName = data.name || currentChatName;
    renderChatMessages(data.messages, currentChatName);
  } catch (err) {
    console.error('Refresh chat:', err);
  }
}

function renderChatMessages(messages, name) {
  const container = document.getElementById('chatMessages');
  container.innerHTML = '';
  if (!messages || messages.length === 0) {
    container.innerHTML = '<div class="chat-empty">لا توجد رسائل بعد. ابدأ المحادثة!</div>';
    return;
  }
  messages.forEach(msg => {
    const div = document.createElement('div');
    div.className = `chat-msg ${msg.sender === 'admin' ? 'admin' : 'other'}`;
    const senderName = msg.sender === 'admin' ? 'المدير' : (name || 'الطرف الآخر');
    div.innerHTML = `<div class="sender-name">${escapeHtml(senderName)}</div>${escapeHtml(msg.text)}<span class="time">${escapeHtml(msg.at ? formatDisplayDateTime(msg.at) : msg.time)}</span>`;
    container.appendChild(div);
  });
  container.scrollTop = container.scrollHeight;
}

async function sendChatMessage() {
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (!text) { adminAlert('الرجاء كتابة رسالة.'); return; }
  if (!currentChatTarget) { adminAlert('لا يوجد محادثة مفتوحة!'); return; }

  try {
    const res = await adminFetch(`/admin/chat/send/${currentChatTarget.type}/${currentChatTarget.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    const data = await res.json();
    if (data.success) {
      currentChatName = data.name || currentChatName;
      renderChatMessages(data.messages, currentChatName);
      input.value = '';
    } else {
      adminAlert(data.message);
    }
  } catch (err) {
    adminAlert('حدث خطأ في إرسال الرسالة');
  }
}

function closeChat() {
  document.getElementById('chatModal').classList.remove('show');
  currentChatTarget = null;
  currentChatName = '';
  stopLegacyChatPolling();
}

document.getElementById('chatInput').addEventListener('keypress', function (e) {
  if (e.key === 'Enter') sendChatMessage();
});

// ================================================
// 9. لوحة القيادة - تحميل الإحصائيات
// ================================================
async function loadDashboardStats() {
  try {
    const res = await adminFetch('/admin/api/stats');
    const data = await res.json();
    document.getElementById('totalDrivers').textContent = data.totalDrivers;
    document.getElementById('activeDrivers').textContent = data.activeDrivers;
    document.getElementById('inactiveDrivers').textContent = data.inactiveDrivers;
    document.getElementById('totalUsers').textContent = data.totalUsers;
    document.getElementById('activeUsers').textContent = data.activeUsers;
    document.getElementById('inactiveUsers').textContent = data.inactiveUsers;
    const orderCounts = data.orderTypeCounts || {};
    const productOrders = orderCounts.product || {};
    const peopleOrders = orderCounts.people || {};
    const goodsOrders = orderCounts.goods || {};
    document.getElementById('prodAccepted').textContent = productOrders.accepted || 0;
    document.getElementById('prodNotAccepted').textContent =
      productOrders.notAccepted || 0;
    document.getElementById('passAccepted').textContent = peopleOrders.accepted || 0;
    document.getElementById('passNotAccepted').textContent =
      peopleOrders.notAccepted || 0;
    document.getElementById('cargoAccepted').textContent = goodsOrders.accepted || 0;
    document.getElementById('cargoNotAccepted').textContent =
      goodsOrders.notAccepted || 0;
    const totalCommission = Number(data.totalCommission) || 0;
    document.getElementById('totalCommission').textContent =
      totalCommission.toLocaleString('en-US');
    const monthCommissionEl = document.getElementById('monthCommission');
    if (monthCommissionEl) {
      monthCommissionEl.textContent =
        (Number(data.monthCommission) || 0).toLocaleString('en-US');
    }
    const commissionDate = data.commissionDate || {};
    const todayDateEl = document.getElementById('commissionTodayDate');
    if (todayDateEl && commissionDate.year) {
      todayDateEl.textContent = commissionDayLabel(commissionDate);
    }
    const monthLabelEl = document.getElementById('commissionMonthLabel');
    if (monthLabelEl && commissionDate.year) {
      monthLabelEl.textContent = commissionMonthLabel(commissionDate);
    }
    document.getElementById('pendingDrivers').textContent = data.pendingDrivers;
    document.getElementById('pendingAmount').textContent =
      (Number(data.pendingAmount) || 0).toLocaleString('en-US');

    const driverBadge = document.getElementById('driverReportsBadge');
    if (data.driverReportsPending > 0) { driverBadge.textContent = data.driverReportsPending; setInlineDisplay(driverBadge, true); }
    else { setInlineDisplay(driverBadge, false); }

    const userBadge = document.getElementById('userReportsBadge');
    if (data.userReportsPending > 0) { userBadge.textContent = data.userReportsPending; setInlineDisplay(userBadge, true); }
    else { setInlineDisplay(userBadge, false); }

    const deletionBadge = document.getElementById('deletionRequestsBadge');
    if (deletionBadge) {
      const pendingDeletions = Number(data.deletionRequestsPending) || 0;
      deletionBadge.textContent = pendingDeletions;
      setInlineDisplay(deletionBadge, pendingDeletions > 0);
    }

    // Load pending provider count
    try {
      const pendingRes = await adminFetch('/admin/drivers/pending');
      const pendingData = await pendingRes.json();
      const pendingBadge = document.getElementById('pendingBadge');
      pendingBadge.textContent = pendingData.length;
      setInlineDisplay(pendingBadge, pendingData.length > 0);
    } catch (_) {}
    adminAlertsReady('stats');

    const topRes = await adminFetch('/admin/api/top-driver');
    const topData = await topRes.json();
    document.getElementById('topDriver').textContent = topData.name;
    document.getElementById('topDriverEarn').textContent =
      (Number(topData.earnings) || 0).toLocaleString('en-US');
  } catch (err) {
    adminAlertsReady('stats');
    console.error('Error loading stats:', err);
  }
}

// ================================================
// 10. العمولات
// ================================================
async function loadCommissionSettings() {
  try {
    const res = await adminFetch('/admin/api/commission-settings');
    if (!res.ok) return;
    const data = await res.json();
    const typeEl = document.getElementById('commissionType');
    const valueEl = document.getElementById('commissionValue');
    if (!typeEl || !valueEl) return;
    typeEl.value = data.type === 'percent' ? 'percent' : 'fixed';
    valueEl.value = data.value;
    const message = document.getElementById('commissionSettingsMessage');
    if (message) {
      message.textContent = '';
      message.className = 'settings-message';
    }
  } catch (err) {
    console.error('Error loading commission settings:', err);
  }
}

async function saveCommissionSettings(event) {
  event.preventDefault();
  const typeEl = document.getElementById('commissionType');
  const valueEl = document.getElementById('commissionValue');
  const message = document.getElementById('commissionSettingsMessage');
  if (!typeEl || !valueEl || !message) return;

  const type = typeEl.value;
  const value = Number(valueEl.value);

  if (!Number.isFinite(value) || value < 0) {
    message.textContent = 'أدخل قيمة صحيحة للعمولة.';
    message.className = 'settings-message error';
    return;
  }

  try {
    const res = await adminFetch('/admin/api/commission-settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, value }),
    });
    const data = await res.json();

    if (!res.ok || !data.success) {
      message.textContent = data.message || 'تعذر حفظ إعدادات العمولة.';
      message.className = 'settings-message error';
      return;
    }

    valueEl.value = data.config.value;
    message.textContent = 'تم حفظ إعدادات العمولة بنجاح.';
    message.className = 'settings-message success';
  } catch (err) {
    message.textContent = 'تعذر حفظ إعدادات العمولة.';
    message.className = 'settings-message error';
  }
}

const commissionSettingsForm = document.getElementById('commissionSettingsForm');
if (commissionSettingsForm) {
  commissionSettingsForm.addEventListener('submit', saveCommissionSettings);
}

// ---- Driver app: show/hide the "commission due" card ----
async function loadDriverDisplaySettings() {
  const select = document.getElementById('driverCommissionCardVisible');
  const message = document.getElementById('driverDisplaySettingsMessage');
  if (!select) return;
  try {
    const res = await adminFetch('/admin/api/driver-display-settings');
    if (!res.ok) throw new Error('load');
    const data = await res.json();
    select.value = data.showCommissionCard === false ? 'false' : 'true';
    if (message) {
      message.textContent = '';
      message.className = 'settings-message';
    }
  } catch (err) {
    if (message) {
      message.textContent = 'تعذر تحميل الإعداد.';
      message.className = 'settings-message error';
    }
  }
}

async function saveDriverDisplaySettings(event) {
  event.preventDefault();
  const select = document.getElementById('driverCommissionCardVisible');
  const message = document.getElementById('driverDisplaySettingsMessage');
  if (!select || !message) return;
  try {
    const res = await adminFetch('/admin/api/driver-display-settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ showCommissionCard: select.value === 'true' }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      message.textContent = data.message || 'تعذر حفظ الإعداد.';
      message.className = 'settings-message error';
      return;
    }
    select.value = data.showCommissionCard ? 'true' : 'false';
    message.textContent = data.showCommissionCard
      ? 'سيظهر مربع العمولة للسائقين.'
      : 'تم إخفاء مربع العمولة عن السائقين.';
    message.className = 'settings-message success';
  } catch (err) {
    message.textContent = 'تعذر حفظ الإعداد.';
    message.className = 'settings-message error';
  }
}

function renderTimeFormatSettings() {
  const select = document.getElementById('timeFormatSelect');
  const preview = document.getElementById('timeFormatPreview');
  if (select) select.value = adminTimeFormat;
  if (preview) preview.textContent = `الوقت الآن في فلسطين: ${formatDisplayTime(new Date())}`;
}

async function saveTimeFormat(event) {
  event.preventDefault();
  const select = document.getElementById('timeFormatSelect');
  const message = document.getElementById('timeFormatMessage');
  if (!select || !message) return;
  try {
    const res = await adminFetch('/admin/api/preferences', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ timeFormat: select.value }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      message.textContent = data.message || 'تعذر حفظ الإعداد.';
      message.className = 'settings-message error';
      return;
    }
    adminTimeFormat = data.timeFormat === '24h' ? '24h' : '12h';
    renderTimeFormatSettings();
    updateClocks();
    message.textContent = adminTimeFormat === '24h'
      ? 'تم. تظهر الأوقات بنظام 24 ساعة.'
      : 'تم. تظهر الأوقات بنظام 12 ساعة مع AM و PM.';
    message.className = 'settings-message success';
  } catch (err) {
    message.textContent = 'تعذر حفظ الإعداد.';
    message.className = 'settings-message error';
  }
}

document.getElementById('timeFormatForm')?.addEventListener('submit', saveTimeFormat);
renderTimeFormatSettings();

const driverDisplaySettingsForm = document.getElementById('driverDisplaySettingsForm');
if (driverDisplaySettingsForm) {
  driverDisplaySettingsForm.addEventListener('submit', saveDriverDisplaySettings);
}

// ---- Privacy policy and terms of use ----
// The editor always opens with the saved text; the admin edits it, or
// clears it and writes a new one, then saves. Unsaved edits are never
// replaced when the settings page is opened again.
const LEGAL_KEYS = ['privacy', 'terms'];

function legalElements(key) {
  return {
    editor: document.getElementById(`legal-${key}-content`),
    updated: document.getElementById(`legal-${key}-updated`),
    count: document.getElementById(`legal-${key}-count`),
    message: document.getElementById(`legal-${key}-message`),
  };
}

function legalIsDirty(editor) {
  return editor.value !== (editor.dataset.savedValue ?? '');
}

function renderLegalMeta(key) {
  const { editor, updated, count } = legalElements(key);
  if (!editor) return;
  if (count) count.textContent = `${editor.value.length} / ${editor.maxLength}`;
  if (!updated) return;
  const savedAt = editor.dataset.savedAt;
  const savedLabel = savedAt
    ? `آخر حفظ: ${formatDisplayDateTime(savedAt)}`
    : editor.dataset.isDefault === 'true'
      ? 'هذا هو النص الحالي في التطبيق (لم يُعدَّل من لوحة التحكم بعد).'
      : 'لم يُحفظ نص بعد.';
  updated.textContent = legalIsDirty(editor)
    ? `${savedLabel} — تغييرات غير محفوظة`
    : savedLabel;
  updated.classList.toggle('legal-dirty', legalIsDirty(editor));
}

function setLegalMessage(key, text, kind) {
  const { message } = legalElements(key);
  if (!message) return;
  message.textContent = text;
  message.className = `settings-message${kind ? ` ${kind}` : ''}`;
}

function applySavedLegal(key, data) {
  const { editor } = legalElements(key);
  if (!editor) return;
  editor.value = data.content || '';
  editor.dataset.savedValue = editor.value;
  editor.dataset.savedAt = data.updatedAt || '';
  editor.dataset.isDefault = data.isDefault ? 'true' : 'false';
  renderLegalMeta(key);
}

async function loadLegalDocuments() {
  for (const key of LEGAL_KEYS) {
    const { editor } = legalElements(key);
    if (!editor) continue;
    // Keep what the admin is in the middle of writing.
    if (editor.dataset.savedValue !== undefined && legalIsDirty(editor)) continue;
    try {
      const res = await adminFetch(`/admin/api/legal/${key}`);
      if (!res.ok) throw new Error('load');
      applySavedLegal(key, await res.json());
      setLegalMessage(key, '', '');
    } catch (err) {
      setLegalMessage(key, 'تعذر تحميل النص المحفوظ. أعد فتح الصفحة.', 'error');
    }
  }
}

async function saveLegalDocument(event) {
  event.preventDefault();
  const key = event.currentTarget.dataset.legalKey;
  const { editor } = legalElements(key);
  if (!editor) return;
  const submit = event.currentTarget.querySelector('button[type="submit"]');
  if (submit) submit.disabled = true;
  try {
    const res = await adminFetch(`/admin/api/legal/${key}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: editor.value }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      setLegalMessage(key, data.message || 'تعذر حفظ النص.', 'error');
      return;
    }
    applySavedLegal(key, data);
    setLegalMessage(key, data.content ? 'تم حفظ النص.' : 'تم مسح النص المحفوظ.', 'success');
  } catch (err) {
    setLegalMessage(key, 'تعذر حفظ النص. لم يتغير النص المحفوظ.', 'error');
  } finally {
    if (submit) submit.disabled = false;
  }
}

document.querySelectorAll('.legal-form[data-legal-key]').forEach((form) => {
  const key = form.dataset.legalKey;
  form.addEventListener('submit', saveLegalDocument);
  const { editor } = legalElements(key);
  if (editor) editor.addEventListener('input', () => renderLegalMeta(key));
});

document.querySelectorAll('[data-legal-clear]').forEach((button) => {
  button.addEventListener('click', () => {
    const key = button.dataset.legalClear;
    const { editor } = legalElements(key);
    if (!editor) return;
    editor.value = '';
    editor.focus();
    renderLegalMeta(key);
    setLegalMessage(key, 'تم مسح النص من المحرر. اكتب نصاً جديداً ثم اضغط حفظ (لن يتغير النص المحفوظ قبل الحفظ).', '');
  });
});

let commissionRowsForSearch = [];

async function loadCommissions() {
  try {
    const res = await adminFetch('/admin/commissions');
    const data = await res.json();
    commissionRowsForSearch = Array.isArray(data.driverRows) ? data.driverRows : [];
    let rows = '';
    data.driverRows.forEach((driver, index) => {
      const isPaid = driver.paymentStatus === 'paid';
      const isReset = driver.paymentStatus === 'reset';
      const hasDue = Number(driver.commission) > 0;
      const statusText = hasDue
        ? `<span class="status-unpaid">غير مدفوع (${escapeHtml(driver.commission)} )</span>`
        : isReset
          ? '<span class="status-reset">تم تصفير العداد</span>'
          : isPaid
            ? '<span class="status-paid">تم دفع المستحقات</span>'
            : '<span class="status-paid">لا توجد مستحقات</span>';
      const payAction = hasDue
        ? `<button class="action-btn pay-now" data-admin-capability="${escapeHtml(adminActionCapability || '')}" data-admin-action="markPaid" data-admin-arg-count="1" data-admin-arg-1="${escapeHtml(String(driver._id))}" data-presentation="p020">تحديد كمدفوع</button>`
        : '';
      const resetAction = `<button class="action-btn reset-commissions" data-admin-capability="${escapeHtml(adminActionCapability || '')}" data-admin-action="resetDriverCommission" data-admin-arg-count="1" data-admin-arg-1="${escapeHtml(String(driver._id))}">تصفير العداد</button>`;
      const undoAction = commissionUndoButton(driver.lastAction, driver._id);
      const actionHtml = `<div class="table-actions">${payAction}${resetAction}${undoAction}</div>`;
      rows += `<tr data-commission-row="${escapeHtml(index)}"><td><strong>${escapeHtml(driver.name)}</strong><br><small data-presentation="p008">${escapeHtml(driver.driverId)}</small></td><td dir="${driver.phone ? 'ltr' : 'auto'}">${escapeHtml(driver.phone || 'غير متوفر')}</td><td>${escapeHtml(driver.serviceType)}</td><td>${escapeHtml(driver.commission)}</td><td>${statusText}</td><td>${actionHtml}</td></tr>`;
    });

    const resetAll = data.lastResetAll;
    const resetAllBar = resetAll
      ? `<div class="undo-reset-all" role="status"><span>آخر «تصفير الكل»: ${escapeHtml(resetAll.drivers)} سائق، ${escapeHtml(resetAll.amount)} شيكل — ${escapeHtml(formatDisplayDateTime(resetAll.at))}</span><button class="action-btn undo-commission" data-admin-capability="${escapeHtml(adminActionCapability || '')}" data-admin-action="undoResetAll" data-admin-arg-count="3" data-admin-arg-1="${escapeHtml(resetAll.batchId)}" data-admin-arg-2="${escapeHtml(resetAll.drivers)}" data-admin-arg-3="${escapeHtml(resetAll.amount)}"><i class="fas fa-rotate-left"></i> تراجع عن تصفير الكل</button></div>`
      : '';
    document.getElementById('commissionsContent').innerHTML = `
      ${resetAllBar}
      <div class="commissions-summary">
        <div class="summary-card"><div class="label">إجمالي العمولات المستحقة</div><div class="number red">${escapeHtml(data.totalUnpaid)} </div></div>
        <div class="summary-card"><div class="label">عدد السائقين المستحقين</div><div class="number orange">${escapeHtml(data.unpaidDrivers)}</div></div>
        <div class="summary-card"><div class="label">إجمالي العمولات المدفوعة</div><div class="number green">${escapeHtml(data.totalPaid)} </div></div>
        <div class="summary-card"><div class="label">عدد السائقين المدفوعين</div><div class="number">${escapeHtml(data.paidDrivers)}</div></div>
      </div>
      <div class="commissions-table-container">
        <h3>تفاصيل عمولات السائقين</h3>
        <table class="commissions-table">
          <thead><tr><th>السائق</th><th>رقم الهاتف</th><th>نوع الخدمة</th><th>العمولة المستحقة</th><th>حالة الدفع</th><th>الإجراء</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
    applyCommissionSearch();
  } catch (err) {
    console.error('Error loading commissions:', err);
  }
}

// يُخفي من جدول العمولات السائقين الذين لا يطابقون البحث.
function applyCommissionSearch() {
  const input = document.getElementById('commissionSearchInput');
  const status = document.getElementById('commissionSearchStatus');
  const body = document.querySelector('#commissionsContent .commissions-table tbody');
  if (!input || !body) return;
  const query = input.value;
  let shown = 0;
  body.querySelectorAll('tr[data-commission-row]').forEach((row) => {
    const driver = commissionRowsForSearch[Number(row.dataset.commissionRow)] || {};
    const match = accountMatches({
      name: driver.name,
      publicId: driver.driverId,
      email: driver.email,
      phones: [driver.phone, ...(driver.phones || [])],
    }, query);
    row.hidden = !match;
    if (match) shown += 1;
  });
  body.querySelector('tr.search-empty')?.remove();
  if (!query.trim()) {
    if (status) status.textContent = '';
    return;
  }
  if (status) status.textContent = `${shown} من ${commissionRowsForSearch.length} سائق يطابقون البحث.`;
  if (shown === 0) {
    const empty = document.createElement('tr');
    empty.className = 'search-empty';
    const cell = document.createElement('td');
    cell.colSpan = 6;
    cell.textContent = 'لا يوجد سائق يطابق البحث.';
    empty.appendChild(cell);
    body.appendChild(empty);
  }
}
document.getElementById('commissionSearchInput')?.addEventListener('input', applyCommissionSearch);

// ---- Undo a commission "paid" / "reset" (newest first) ----
function commissionActionLabel(action) {
  if (!action) return '';
  const amount = `${escapeHtml(action.amount)} شيكل`;
  const when = escapeHtml(formatDisplayDateTime(action.at));
  return action.type === 'payment'
    ? `تسجيل دفع ${amount} — ${when}`
    : `تصفير العداد (${amount}) — ${when}`;
}

function commissionUndoButton(action, driverId) {
  if (!action) return '';
  const label = action.type === 'payment' ? 'تراجع عن الدفع' : 'تراجع عن التصفير';
  return `<button class="action-btn undo-commission" data-admin-capability="${escapeHtml(adminActionCapability || '')}" data-admin-action="undoCommissionAction" data-admin-arg-count="4" data-admin-arg-1="${escapeHtml(action.id)}" data-admin-arg-2="${escapeHtml(String(driverId))}" data-admin-arg-3="${escapeHtml(action.type)}" data-admin-arg-4="${escapeHtml(action.amount)}"><i class="fas fa-rotate-left"></i> ${label}</button>`;
}

function refreshAfterCommissionChange(driverId) {
  loadCommissions();
  loadDashboardStats();
  const driversPage = document.getElementById('page-drivers');
  if (driverId && driversPage && driversPage.classList.contains('active-page')) {
    searchDriverById(driverId);
  }
  refreshPayoutsModal();
}

async function undoCommissionAction(actionId, driverId, type, amount) {
  const message = type === 'payment'
    ? `التراجع عن تسجيل دفع ${amount} شيكل؟ سيعود المبلغ مستحقاً على السائق كما كان قبل الدفع.`
    : `التراجع عن تصفير العداد؟ ستعود عمولة المنصة (${amount} شيكل) مستحقة على السائق كما كانت قبل التصفير.`;
  if (!await adminConfirm(message)) return;
  try {
    const res = await adminFetch(`/admin/commissions/undo/${encodeURIComponent(actionId)}`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok || !data.success) {
      adminAlert(data.message || 'تعذر التراجع عن العملية.');
      refreshAfterCommissionChange(driverId);
      return;
    }
    adminAlert(data.type === 'payment'
      ? `تم التراجع عن الدفع. عاد ${data.amount} شيكل مستحقاً على السائق.`
      : `تم التراجع عن التصفير. عادت عمولة ${data.amount} شيكل مستحقة على السائق.`);
    refreshAfterCommissionChange(driverId);
  } catch (err) {
    adminAlert('حدث خطأ أثناء التراجع. لم يتغير شيء.');
  }
}

async function undoResetAll(batchId, drivers, amount) {
  if (!await adminConfirm(`التراجع عن «تصفير الكل»؟ ستعود عمولة ${drivers} سائق (${amount} شيكل) مستحقة كما كانت.`)) return;
  try {
    const res = await adminFetch(`/admin/commissions/undo-batch/${encodeURIComponent(batchId)}`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok || !data.success) {
      adminAlert(data.message || 'تعذر التراجع عن تصفير الكل.');
      return;
    }
    adminAlert(
      `تم التراجع عن التصفير لـ ${data.undone} سائق (${data.amount} شيكل).`
      + (data.skipped > 0 ? ` لم يُتراجع عن ${data.skipped} سائق لأن لديهم عمليات أحدث.` : ''),
    );
    refreshAfterCommissionChange(null);
  } catch (err) {
    adminAlert('حدث خطأ أثناء التراجع. لم يتغير شيء.');
  }
}

async function markPaid(driverId) {
  if (!await adminConfirm('هل أنت متأكد من تحديد السائق كمدفوع؟')) return;
  try {
    const res = await adminFetch(`/admin/commissions/pay/${driverId}`, { method: 'PUT' });
    const data = await res.json();
    if (data.success) {
      adminAlert(data.action
        ? `${data.message}. يمكنك التراجع من بطاقة السائق أو صفحة العمولات.`
        : data.message);
      loadCommissions();
      loadDashboardStats();

      const driversPage = document.getElementById('page-drivers');
      if (driversPage && driversPage.classList.contains('active-page')) {
        searchDriverById(driverId);
      }

      const listModal = document.getElementById('listModal');
      if (
        listModal &&
        listModal.classList.contains('show') &&
        document.getElementById('listModalTitle')?.textContent ===
          'السائقون المستحقون للدفع'
      ) {
        openListModal('payouts', 'unpaid', 'السائقون المستحقون للدفع');
      }
    } else {
      adminAlert(data.message);
    }
  } catch (err) {
    adminAlert('حدث خطأ في تحديث حالة الدفع');
  }
}

async function resetDriverCommission(driverId) {
  if (
    !await adminConfirm(
      'سيتم تصفير عداد عمولة السائق وإرجاع العمولة له. هل تريد المتابعة؟',
    )
  ) {
    return;
  }

  try {
    const res = await adminFetch(`/admin/commissions/reset/${driverId}`, {
      method: 'PUT',
    });
    const data = await res.json();
    if (!data.success) {
      adminAlert(data.message || 'تعذر تصفير عداد العمولة');
      return;
    }

    adminAlert(
      'تم تصفير عداد العمولة' +
        (Number(data.amount) > 0
          ? ` وإرجاع ${data.amount} شيكل للسائق.`
          : '.') +
        (data.action ? ' يمكنك التراجع من بطاقة السائق أو صفحة العمولات.' : ''),
    );
    loadCommissions();
    loadDashboardStats();

    const driversPage = document.getElementById('page-drivers');
    if (driversPage && driversPage.classList.contains('active-page')) {
      searchDriverById(driverId);
    }

    refreshPayoutsModal();
  } catch (err) {
    adminAlert('حدث خطأ في تصفير عداد العمولة');
  }
}

async function resetAllCommissions() {
  if (
    !await adminConfirm(
      'سيتم تصفير عدادات عمولات جميع السائقين وإرجاع العمولة لهم. هل تريد المتابعة؟',
    )
  ) {
    return;
  }

  try {
    const res = await adminFetch('/admin/commissions/reset-all', {
      method: 'PUT',
    });
    const data = await res.json();
    if (!data.success) {
      adminAlert(data.message || 'تعذر تصفير عدادات العمولات');
      return;
    }

    adminAlert(
      `تم تصفير ${data.drivers} سائق وإرجاع ${data.amount} شيكل لهم. يمكنك التراجع من صفحة العمولات.`,
    );
    loadCommissions();
    loadDashboardStats();
    refreshPayoutsModal();
  } catch (err) {
    adminAlert('حدث خطأ في تصفير عدادات العمولات');
  }
}

function refreshPayoutsModal() {
  const listModal = document.getElementById('listModal');
  if (
    listModal &&
    listModal.classList.contains('show') &&
    document.getElementById('listModalTitle')?.textContent ===
      'السائقون المستحقون للدفع'
  ) {
    openListModal('payouts', 'unpaid', 'السائقون المستحقون للدفع');
  }
}

// ================================================
// 11. المناطق
// ================================================
let governorateStats = {};

async function loadAreas() {
  try {
    const res = await adminFetch('/admin/areas');
    const data = await res.json();
    governorateStats = data.stats;

    let listHtml = '', firstGov = null;
    for (const gov of data.governorateOrder) {
      if (governorateStats[gov]) {
        const s = governorateStats[gov];
        listHtml += `<div class="area-item" data-gov="${escapeHtml(String(gov))}" data-admin-capability="${escapeHtml(adminActionCapability || '')}" data-admin-action="selectGovernorate" data-admin-arg-count="1" data-admin-arg-1="${escapeHtml(String(gov))}"><span class="name">${escapeHtml(gov)}</span><span class="counts" title="عدد السائقين وعدد المستخدمين"><span class="drivers"><i class="fas fa-car"></i> ${escapeHtml(s.totalDrivers)}</span><span class="users"><i class="fas fa-user"></i> ${escapeHtml(s.totalUsers)}</span></span></div>`;
        if (!firstGov) firstGov = gov;
      }
    }

    let detailHtml = firstGov && governorateStats[firstGov] ? buildGovernorateDetail(firstGov, governorateStats[firstGov]) : '<div class="no-city">لا توجد بيانات</div>';
    document.getElementById('areasContainer').innerHTML = `<div class="areas-list">${listHtml}</div><div class="areas-detail" id="areasDetail">${detailHtml}</div>`;
    const firstItem = document.getElementById('areasContainer').querySelector('.area-item');
    if (firstItem) firstItem.classList.add('active');
    applyAreaSearch();
  } catch (err) {
    console.error('Error loading areas:', err);
  }
}

// يبحث عن سائق أو مستخدم في كل المحافظات ويعرض مكانه؛ الضغط يفتح محافظته.
function applyAreaSearch() {
  const input = document.getElementById('areaSearchInput');
  const status = document.getElementById('areaSearchStatus');
  const results = document.getElementById('areaSearchResults');
  if (!input || !results) return;
  const query = input.value;
  results.innerHTML = '';
  document.querySelectorAll('#areasDetail .account-chip.search-hit')
    .forEach((chip) => chip.classList.remove('search-hit'));
  if (!query.trim()) {
    if (status) status.textContent = '';
    return;
  }

  const hits = [];
  for (const [gov, stats] of Object.entries(governorateStats || {})) {
    for (const city of stats.cities || []) {
      const add = (accounts, role) => (accounts || []).forEach((account) => {
        if (accountMatches({
          name: account.fullName,
          publicId: account.publicId,
          email: account.email,
          phones: account.phones,
        }, query)) {
          hits.push({ gov, city: city.name, role, account });
        }
      });
      add(city.driverAccounts, 'سائق');
      add(city.userAccounts, 'مستخدم');
    }
  }

  if (status) {
    status.textContent = hits.length === 0
      ? 'لا يوجد سائق أو مستخدم يطابق البحث.'
      : `${hits.length} نتيجة. اضغط على النتيجة لعرض محافظتها.`;
  }
  hits.slice(0, 50).forEach((hit) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'area-search-hit';
    const name = document.createElement('strong');
    name.textContent = hit.account.fullName || 'غير محدد';
    const role = document.createElement('span');
    role.className = 'hit-role';
    role.textContent = hit.role;
    const place = document.createElement('span');
    place.className = 'hit-place';
    place.textContent = `${hit.gov} / ${hit.city}`;
    const contact = document.createElement('span');
    contact.className = 'hit-contact';
    contact.dir = 'ltr';
    contact.textContent = [
      hit.account.publicId ? `ID ${hit.account.publicId}` : '',
      (hit.account.phones || [])[0] || '',
      hit.account.email || '',
    ].filter(Boolean).join(' · ');
    button.append(name, role, place, contact);
    button.addEventListener('click', () => showAreaAccount(hit.gov, hit.account.id));
    results.appendChild(button);
  });
}

function showAreaAccount(gov, accountId) {
  selectGovernorate(gov);
  const detail = document.getElementById('areasDetail');
  if (!detail) return;
  const chip = [...detail.querySelectorAll('.account-chip')]
    .find((element) => element.dataset.accountId === String(accountId));
  if (!chip) return;
  chip.classList.add('search-hit');
  chip.scrollIntoView({ block: 'center', behavior: 'smooth' });
}
document.getElementById('areaSearchInput')?.addEventListener('input', applyAreaSearch);

function buildGovernorateDetail(gov, stats) {
  const renderAccounts = (label, accounts, roleClass) => {
    if (!Array.isArray(accounts) || accounts.length === 0) return '';
    const chips = accounts.map((account) => {
      const publicId = account.publicId
        ? `<small>ID ${escapeHtml(String(account.publicId))}</small>`
        : '';
      return `<span class="account-chip" data-account-id="${escapeHtml(String(account.id || ''))}">${escapeHtml(account.fullName || 'غير محدد')}${publicId}</span>`;
    }).join('');
    return `<div class="account-row ${roleClass}"><span class="account-label">${escapeHtml(label)}</span>${chips}</div>`;
  };

  let citiesHtml = '', totalDrivers = 0, totalUsers = 0;
  stats.cities.forEach(city => {
    totalDrivers += city.drivers; totalUsers += city.users;
    const accountsHtml =
      renderAccounts('السائقون', city.driverAccounts, 'drivers')
      + renderAccounts('المستخدمون', city.userAccounts, 'users');
    citiesHtml += `<div class="city-item"><div class="city-head"><span class="city-name">${escapeHtml(city.name)}</span><span class="city-counts"><span class="drivers" title="السائقون"><i class="fas fa-car"></i> ${escapeHtml(city.drivers)}</span><span class="users" title="المستخدمون"><i class="fas fa-user"></i> ${escapeHtml(city.users)}</span></span></div>${accountsHtml ? `<div class="city-accounts">${accountsHtml}</div>` : ''}</div>`;
  });
  if (!citiesHtml) {
    citiesHtml = '<div class="no-city">لا توجد بيانات مسجلة في هذه المحافظة.</div>';
  }
  return `<h3>${escapeHtml(gov)}</h3>${citiesHtml}<div class="total-badge"><span class="label">إجمالي المحافظة</span><span class="total-counts"><span class="drivers" title="السائقون"><i class="fas fa-car"></i> ${escapeHtml(totalDrivers)}</span><span class="users" title="المستخدمون" data-presentation="p022"><i class="fas fa-user"></i> ${escapeHtml(totalUsers)}</span></span></div>`;
}

function selectGovernorate(gov) {
  const items = document.getElementById('areasContainer').querySelectorAll('.area-item');
  items.forEach(item => item.classList.toggle('active', item.dataset.gov === gov));
  const stats = governorateStats[gov];
  if (!stats) return;
  const detailDiv = document.getElementById('areasDetail');
  if (detailDiv) detailDiv.innerHTML = buildGovernorateDetail(gov, stats);
}

// ================================================
// 12. الإبلاغات
// ================================================
async function loadDriverReports() {
  try {
    const res = await adminFetch('/admin/reports/driver');
    const data = await res.json();
    let rows = '';
    data.reports.forEach(report => {
      const replyCount = report.replies ? report.replies.length : 0;
      const reporterName = report.reporterId?.fullName || report.reporter || 'غير معروف';
      const targetId = report.reportedPublicId || '';
      rows += `<tr><td><strong>${escapeHtml(report.reportId)}</strong></td><td>${escapeHtml(reporterName)}</td><td>ID ${escapeHtml(targetId)}</td><td>${escapeHtml(report.category)}</td><td>${escapeHtml(formatDisplayDate(report.createdAt || report.date))}</td>${timeCell(report.createdAt)}<td>${getReportStatusBadge(report.status)}</td><td>${escapeHtml(report.content.substring(0, 40))}${report.content.length > 40 ? '...' : ''}</td><td><button class="action-btn info" data-admin-capability="${escapeHtml(adminActionCapability || '')}" data-admin-action="viewReportDetail" data-admin-arg-count="2" data-admin-arg-1="driver" data-admin-arg-2="${escapeHtml(String(report.reportId))}" data-presentation="p020">عرض</button><button class="action-btn reply" data-admin-capability="${escapeHtml(adminActionCapability || '')}" data-admin-action="openReplyModal" data-admin-arg-count="2" data-admin-arg-1="driver" data-admin-arg-2="${escapeHtml(String(report.reportId))}" data-presentation="p020">رد (${replyCount})</button>${report.status !== 'resolved' ? `<button class="action-btn success" data-admin-capability="${escapeHtml(adminActionCapability || '')}" data-admin-action="resolveReport" data-admin-arg-count="2" data-admin-arg-1="driver" data-admin-arg-2="${escapeHtml(String(report.reportId))}" data-presentation="p020">حل</button>` : ''}<button class="action-btn danger" data-admin-capability="${escapeHtml(adminActionCapability || '')}" data-admin-action="deleteReport" data-admin-arg-count="2" data-admin-arg-1="driver" data-admin-arg-2="${escapeHtml(String(report.reportId))}" data-presentation="p020">حذف</button></td></tr>`;
    });
    document.getElementById('driverReportsContent').innerHTML = `<div class="commissions-table-container"><h3>قائمة إبلاغات السائقين</h3><table class="commissions-table"><thead><tr><th>رقم الإبلاغ</th><th>المبلغ</th><th>ID السائق</th><th>النوع</th><th>التاريخ</th><th>الوقت</th><th>الحالة</th><th>المحتوى</th><th>الإجراءات</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  } catch (err) { console.error('Error loading driver reports:', err); }
}

async function loadUserReports() {
  try {
    const res = await adminFetch('/admin/reports/user');
    const data = await res.json();
    let rows = '';
    data.reports.forEach(report => {
      const replyCount = report.replies ? report.replies.length : 0;
      const reporterName = report.reporterId?.fullName || report.reporter || 'غير معروف';
      const targetId = report.reportedPublicId || '';
      rows += `<tr><td><strong>${escapeHtml(report.reportId)}</strong></td><td>${escapeHtml(reporterName)}</td><td>ID ${escapeHtml(targetId)}</td><td>${escapeHtml(report.category)}</td><td>${escapeHtml(formatDisplayDate(report.createdAt || report.date))}</td>${timeCell(report.createdAt)}<td>${getReportStatusBadge(report.status)}</td><td>${escapeHtml(report.content.substring(0, 40))}${report.content.length > 40 ? '...' : ''}</td><td><button class="action-btn info" data-admin-capability="${escapeHtml(adminActionCapability || '')}" data-admin-action="viewReportDetail" data-admin-arg-count="2" data-admin-arg-1="user" data-admin-arg-2="${escapeHtml(String(report.reportId))}" data-presentation="p020">عرض</button><button class="action-btn reply" data-admin-capability="${escapeHtml(adminActionCapability || '')}" data-admin-action="openReplyModal" data-admin-arg-count="2" data-admin-arg-1="user" data-admin-arg-2="${escapeHtml(String(report.reportId))}" data-presentation="p020">رد (${replyCount})</button>${report.status !== 'resolved' ? `<button class="action-btn success" data-admin-capability="${escapeHtml(adminActionCapability || '')}" data-admin-action="resolveReport" data-admin-arg-count="2" data-admin-arg-1="user" data-admin-arg-2="${escapeHtml(String(report.reportId))}" data-presentation="p020">حل</button>` : ''}<button class="action-btn danger" data-admin-capability="${escapeHtml(adminActionCapability || '')}" data-admin-action="deleteReport" data-admin-arg-count="2" data-admin-arg-1="user" data-admin-arg-2="${escapeHtml(String(report.reportId))}" data-presentation="p020">حذف</button></td></tr>`;
    });
    document.getElementById('userReportsContent').innerHTML = `<div class="commissions-table-container"><h3>قائمة إبلاغات المستخدمين</h3><table class="commissions-table"><thead><tr><th>رقم الإبلاغ</th><th>المبلغ</th><th>ID المستخدم</th><th>النوع</th><th>التاريخ</th><th>الوقت</th><th>الحالة</th><th>المحتوى</th><th>الإجراءات</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  } catch (err) { console.error('Error loading user reports:', err); }
}

let currentReportType = null, currentReportId = null;

async function openReplyModal(type, reportId) {
  currentReportType = type; currentReportId = reportId;
  try {
    const res = await adminFetch(`/admin/reports/detail/${reportId}`);
    const data = await res.json();
    if (data.error) { adminAlert(data.error); return; }
    const report = data.report;

    document.getElementById('reportDetailTitle').textContent = `إبلاغ رقم ${report.reportId} - ${report.category}`;
    document.getElementById('reportDetailContent').innerHTML = `<div data-presentation="p023"><div class="row"><span class="label">المرسل:</span><span class="value">${escapeHtml(report.reporter)}</span></div><div class="row"><span class="label">النوع:</span><span class="value">${escapeHtml(report.category)}</span></div><div class="row"><span class="label">التاريخ:</span><span class="value">${escapeHtml(formatDisplayDate(report.date))}</span></div><div class="row"><span class="label">الحالة:</span><span class="value">${getReportStatusBadge(report.status)}</span></div><div data-presentation="p024"><span data-presentation="p025">المحتوى الكامل:</span><p data-presentation="p026">${escapeHtml(report.content)}</p></div></div>`;
    renderChatThread(report);
    document.getElementById('reportDetailModal').classList.add('show');
    document.getElementById('replyInput').value = '';
  } catch (err) { adminAlert('حدث خطأ في فتح الإبلاغ'); }
}

function viewReportDetail(type, reportId) { openReplyModal(type, reportId); }

function renderChatThread(report) {
  const threadDiv = document.getElementById('chatThread');
  threadDiv.innerHTML = '';
  if (!report.replies || report.replies.length === 0) {
    threadDiv.innerHTML = '<p data-presentation="p027">لا توجد ردود حتى الآن.</p>';
    return;
  }
  report.replies.forEach(msg => {
    const div = document.createElement('div');
    div.className = `chat-msg ${msg.sender === 'admin' ? 'admin' : 'other'}`;
    const senderName = msg.sender === 'admin' ? 'المدير' : (report.reporter || 'المرسل');
    div.innerHTML = `<div class="sender-name">${escapeHtml(senderName)}</div>${escapeHtml(msg.text)}<span class="time">${escapeHtml(msg.at ? formatDisplayDateTime(msg.at) : msg.time)}</span>`;
    threadDiv.appendChild(div);
  });
  threadDiv.scrollTop = threadDiv.scrollHeight;
}

async function sendReply() {
  if (!currentReportType || !currentReportId) { adminAlert('لا يوجد إبلاغ مفتوح!'); return; }
  const input = document.getElementById('replyInput');
  const text = input.value.trim();
  if (!text) { adminAlert('الرجاء كتابة رد.'); return; }

  try {
    const res = await adminFetch(`/admin/reports/reply/${currentReportId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    const data = await res.json();
    if (data.success) {
      renderChatThread(data.report);
      input.value = '';
      loadDashboardStats();
      adminAlert('تم إرسال الرد بنجاح.');
    } else {
      adminAlert(data.message);
    }
  } catch (err) { adminAlert('حدث خطأ في إرسال الرد'); }
}

async function resolveReport(type, reportId) {
  if (!await adminConfirm('هل أنت متأكد من تغيير الحالة إلى "تم الحل"؟')) return;
  try {
    await adminFetch(`/admin/reports/${reportId}/status`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'resolved' }) });
    if (type === 'driver') loadDriverReports(); else loadUserReports();
    loadDashboardStats();
    adminAlert('تم تغيير الحالة بنجاح.');
  } catch (err) { adminAlert('حدث خطأ'); }
}

async function deleteReport(type, reportId) {
  if (!await adminConfirm('هل أنت متأكد من حذف هذا الإبلاغ نهائياً؟')) return;
  try {
    await adminFetch(`/admin/reports/${reportId}`, { method: 'DELETE' });
    if (type === 'driver') loadDriverReports(); else loadUserReports();
    loadDashboardStats();
    adminAlert('تم حذف الإبلاغ بنجاح.');
  } catch (err) { adminAlert('حدث خطأ'); }
}

// ================================================
// طلبات حذف الحسابات
// ================================================
function deletionStatusBadge(status) {
  const map = {
    pending: '<span class="report-status-badge in-review">قيد المراجعة</span>',
    cancelled: '<span class="report-status-badge rejected">تم إلغاء الطلب</span>',
    approved: '<span class="report-status-badge resolved">تمت الموافقة وحُذف الحساب</span>',
  };
  return map[status] || escapeHtml(status);
}

/** What to check before approving: debt (driver), unfinished orders. */
function deletionCheckText(request) {
  if (request.status !== 'pending') return '—';
  if (request.accountExists === false) return 'الحساب غير موجود';
  const parts = [];
  if (request.role === 'provider') {
    const owed = Number(request.unpaidCommission) || 0;
    parts.push(owed > 0
      ? `عليه عمولة غير مدفوعة: ${owed.toLocaleString('en-US')} ₪`
      : 'لا توجد عليه عمولة غير مدفوعة');
  }
  const open = Number(request.openOrders) || 0;
  const inProgress = Number(request.inProgressOrders) || 0;
  if (open > 0) parts.push(`${open} طلب بانتظار العروض أو القبول`);
  if (inProgress > 0) parts.push(`${inProgress} طلب قيد التنفيذ (يمنع الحذف)`);
  if (open === 0 && inProgress === 0) parts.push('لا توجد طلبات جارية');
  return parts.map(escapeHtml).join('<br>');
}

let deletionRequestsById = new Map();

async function loadDeletionRequests() {
  const container = document.getElementById('deletionRequestsContent');
  if (!container) return;
  try {
    const res = await adminFetch('/admin/deletion-requests');
    const data = await res.json();
    const requests = Array.isArray(data.requests) ? data.requests : [];
    deletionRequestsById = new Map(requests.map((request) => [request.id, request]));
    if (requests.length === 0) {
      container.innerHTML = '<div class="commissions-table-container"><h3>لا توجد طلبات حذف حسابات</h3></div>';
      return;
    }
    const rows = requests.map((request) => {
      const role = request.role === 'provider' ? 'سائق' : 'زبون';
      const action = request.status === 'pending'
        ? `<button class="action-btn danger" data-admin-capability="${escapeHtml(adminActionCapability || '')}" data-admin-action="approveDeletionRequest" data-admin-arg-count="1" data-admin-arg-1="${escapeHtml(request.id)}" data-presentation="p020">موافقة وحذف الحساب</button>`
        : deletionStatusBadge(request.status);
      return `<tr><td><strong>${escapeHtml(request.fullName || '')}</strong><br><small>${escapeHtml(request.email || '')}</small></td><td>${role}</td><td>ID ${escapeHtml(request.publicId || '')}</td><td>${escapeHtml(formatDisplayDate(request.requestedAt))}</td>${timeCell(request.requestedAt)}<td>${deletionStatusBadge(request.status)}</td><td>${deletionCheckText(request)}</td><td>${action}</td></tr>`;
    }).join('');
    container.innerHTML = `<div class="commissions-table-container"><h3>قائمة طلبات حذف الحسابات</h3><table class="commissions-table"><thead><tr><th>صاحب الحساب</th><th>النوع</th><th>ID</th><th>تاريخ الطلب</th><th>وقت الطلب</th><th>الحالة</th><th>قبل الموافقة</th><th>الإجراء</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  } catch (err) { console.error('Error loading deletion requests:', err); }
}

async function approveDeletionRequest(requestId) {
  const request = deletionRequestsById.get(requestId) || {};
  const warnings = [];
  if (Number(request.unpaidCommission) > 0) {
    warnings.push(`على السائق عمولة غير مدفوعة (${Number(request.unpaidCommission).toLocaleString('en-US')} ₪).`);
  }
  if (Number(request.openOrders) > 0) {
    warnings.push(`لديه ${request.openOrders} طلب لم يكتمل بعد وسيُلغى.`);
  }
  const question = `${warnings.length ? `${warnings.join('\n')}\n\n` : ''}سيُحذف حساب ${request.fullName || ''} نهائياً ولا يمكن التراجع. هل تريد المتابعة؟`;
  if (!await adminConfirm(question)) return;
  try {
    const res = await adminFetch(`/admin/deletion-requests/${encodeURIComponent(requestId)}/approve`, { method: 'POST' });
    const data = await res.json();
    adminAlert(data.message || (data.success ? 'تم حذف الحساب' : 'تعذر حذف الحساب'));
    loadDeletionRequests();
    loadDashboardStats();
  } catch (err) { adminAlert('حدث خطأ'); }
}

// ================================================
// 13. الإرسال الجماعي
// ================================================
async function sendBroadcast(target) {
  const titleInput = document.getElementById(target === 'drivers' ? 'driverBroadcastTitle' : 'userBroadcastTitle');
  const bodyInput = document.getElementById(target === 'drivers' ? 'driverBroadcastBody' : 'userBroadcastBody');
  const resultDiv = document.getElementById(target === 'drivers' ? 'driverBroadcastResult' : 'userBroadcastResult');
  const title = titleInput.value.trim();
  const body = bodyInput.value.trim();

  if (!title || !body) {
    resultDiv.className = 'broadcast-result error';
    resultDiv.textContent = 'الرجاء إدخال عنوان ونص للرسالة.';
    return;
  }

  try {
    const res = await adminFetch(`/admin/broadcast/${target}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, body })
    });
    const data = await res.json();
    if (data.success) {
      resultDiv.className = 'broadcast-result success';
      resultDiv.innerHTML = `تم إرسال الرسالة بنجاح إلى <strong>${escapeHtml(data.count)}</strong> ${target === 'drivers' ? 'سائق' : 'مستخدم'}.<br><span data-presentation="p028">العنوان: ${escapeHtml(title)}</span><br><span data-presentation="p028">تم الإرسال في: ${escapeHtml(formatDisplayDateTime(data.sentAt))}</span>`;
      loadBroadcastArchive(target);
    } else {
      resultDiv.className = 'broadcast-result error';
      resultDiv.textContent = data.message;
    }
  } catch (err) {
    resultDiv.className = 'broadcast-result error';
    resultDiv.textContent = 'حدث خطأ في الإرسال';
  }
}

async function loadBroadcastArchive(target) {
  const container = document.getElementById(
    target === 'drivers' ? 'driverBroadcastArchive' : 'userBroadcastArchive',
  );
  if (!container) return;

  try {
    const res = await adminFetch(`/admin/broadcast/archive/${target}`);
    const messages = await res.json();

    if (!Array.isArray(messages) || messages.length === 0) {
      container.innerHTML =
        '<p>لا توجد رسائل مرسلة خلال آخر 30 يوماً.</p>';
      return;
    }

    container.innerHTML = messages
      .map((message) => {
        const sentAt = message.sentAt
          ? formatDisplayDateTime(message.sentAt)
          : '';

        return `<div class="archive-item">
          <div class="archive-title">${escapeHtml(message.title)}</div>
          <div class="archive-body">${escapeHtml(message.body)}</div>
          <div class="archive-meta">
            <span>${escapeHtml(message.recipientCount)} ${target === 'drivers' ? 'سائق' : 'مستخدم'}</span>
            <span>${escapeHtml(sentAt)}</span>
          </div>
        </div>`;
      })
      .join('');
  } catch (err) {
    container.innerHTML = '<p>تعذر تحميل أرشيف الرسائل.</p>';
  }
}

// ================================================
// 14. إجراءات السائقين والمستخدمين
// ================================================
async function freezeDriver(id) {
  try {
    await adminFetch(`/admin/drivers/${id}/status`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'inactive' }) });
    adminAlert('تم تجميد حساب السائق بنجاح.');
    searchDriverById(id);
    loadDashboardStats();
  } catch (err) { adminAlert('حدث خطأ'); }
}

async function activateDriver(id) {
  try {
    await adminFetch(`/admin/drivers/${id}/status`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'active' }) });
    adminAlert('تم تفعيل حساب السائق بنجاح.');
    searchDriverById(id);
    loadDashboardStats();
  } catch (err) { adminAlert('حدث خطأ'); }
}

const PERMANENT_DELETE_WARNING =
  'سيُحذف الحساب وبياناته الشخصية نهائياً من قاعدة البيانات ولا يمكن التراجع.\n'
  + 'تبقى الطلبات السابقة وسجل العمولات كسجلات مالية.\n\nهل تريد المتابعة؟';

async function deleteDriver(id) {
  if (!await adminConfirm(PERMANENT_DELETE_WARNING)) return;
  try {
    const res = await adminFetch(`/admin/drivers/${id}`, { method: 'DELETE' });
    const data = await res.json();
    adminAlert(data.message);
    if (!data.success) return;
    document.getElementById('driverResult').classList.remove('show');
    loadDriversList();
    loadDashboardStats();
  } catch (err) { adminAlert('حدث خطأ'); }
}

async function changeDriverPassword(driverId) {
  const newPassword = await adminPrompt('أدخل كلمة المرور الجديدة للسائق:', { password: true });
  if (!newPassword || newPassword.trim() === '') { adminAlert('كلمة المرور لا يمكن أن تكون فارغة.'); return; }
  const confirmPassword = await adminPrompt('أعد إدخال كلمة المرور الجديدة للتأكيد:', { password: true });
  if (!confirmPassword || newPassword !== confirmPassword) { adminAlert('كلمة المرور وتأكيدها غير متطابقين.'); return; }
  try {
    const res = await adminFetch(`/admin/drivers/${driverId}/password`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        password: newPassword,
        confirmPassword,
      }),
    });
    const data = await res.json();
    if (!data.success) {
      adminAlert(data.message || 'تعذر تغيير كلمة المرور.');
      return;
    }
    adminAlert(data.message || 'تم تغيير كلمة المرور بنجاح.');
    searchDriverById(driverId);
  } catch (err) { adminAlert('حدث خطأ'); }
}

async function freezeUser(id) {
  try {
    await adminFetch(`/admin/users/${id}/status`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'inactive' }) });
    adminAlert('تم تجميد حساب المستخدم بنجاح.');
    searchUserById(id);
    loadDashboardStats();
  } catch (err) { adminAlert('حدث خطأ'); }
}

async function activateUser(id) {
  try {
    await adminFetch(`/admin/users/${id}/status`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'active' }) });
    adminAlert('تم تفعيل حساب المستخدم بنجاح.');
    searchUserById(id);
    loadDashboardStats();
  } catch (err) { adminAlert('حدث خطأ'); }
}

async function deleteUser(id) {
  if (!await adminConfirm(PERMANENT_DELETE_WARNING)) return;
  try {
    const res = await adminFetch(`/admin/users/${id}`, { method: 'DELETE' });
    const data = await res.json();
    adminAlert(data.message);
    if (!data.success) return;
    document.getElementById('userResult').classList.remove('show');
    loadDashboardStats();
  } catch (err) { adminAlert('حدث خطأ'); }
}

// ---- Customer details editor (same fields as the driver editor) ----
async function openEditUser(userId) {
  try {
    const res = await adminFetch(`/admin/users/search?id=${encodeURIComponent(userId)}`);
    const data = await res.json();
    if (data.error || !data.user) {
      adminAlert(data.error || 'تعذر تحميل بيانات المستخدم.');
      return;
    }
    await ensureAdminAreasLoaded();
    const user = data.user;
    document.getElementById('userEditId').value = user._id;
    document.getElementById('userEditSub').textContent = `${user.name} — ${user.userId}`;
    document.getElementById('userEditName').value = user.name || '';
    document.getElementById('userEditEmail').value = user.email || '';
    document.getElementById('userEditPhone').value = user.phone || '';
    document.getElementById('userEditPublicId').value = user.publicId || user.userId || '';
    fillEditGovernorateSelect(user.governorate || '', 'userEditGovernorate');
    fillEditAreaSelect(
      user.governorate || '',
      user.area === 'غير محدد' ? '' : (user.area || ''),
      'userEditArea',
    );
    const msg = document.getElementById('userEditMsg');
    msg.textContent = '';
    msg.className = 'msg';
    document.getElementById('userEditModal').classList.add('show');
  } catch (err) {
    adminAlert('تعذر تحميل بيانات المستخدم.');
  }
}

function closeUserEdit() {
  document.getElementById('userEditModal').classList.remove('show');
}

async function saveUserEdits(event) {
  event.preventDefault();
  const id = document.getElementById('userEditId').value;
  const msg = document.getElementById('userEditMsg');
  const payload = {
    fullName: document.getElementById('userEditName').value.trim(),
    email: document.getElementById('userEditEmail').value.trim(),
    phone: document.getElementById('userEditPhone').value.trim(),
    publicId: document.getElementById('userEditPublicId').value.trim(),
    governorate: document.getElementById('userEditGovernorate').value,
    area: document.getElementById('userEditArea').value,
  };
  try {
    const res = await adminFetch(`/admin/users/${encodeURIComponent(id)}/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!data.success) {
      msg.textContent = data.message || 'تعذر حفظ التعديلات.';
      msg.className = 'msg error';
      return;
    }
    msg.textContent = data.message || 'تم تحديث بيانات المستخدم بنجاح.';
    msg.className = 'msg success';
    setTimeout(() => {
      closeUserEdit();
      searchUserById(id);
      loadDashboardStats();
    }, 600);
  } catch (err) {
    msg.textContent = 'تعذر حفظ التعديلات.';
    msg.className = 'msg error';
  }
}

const userEditGovernorate = document.getElementById('userEditGovernorate');
if (userEditGovernorate) {
  userEditGovernorate.addEventListener('change', () => {
    fillEditAreaSelect(userEditGovernorate.value, '', 'userEditArea');
  });
}
const userEditForm = document.getElementById('userEditForm');
if (userEditForm) {
  userEditForm.addEventListener('submit', saveUserEdits);
}
const userEditModal = document.getElementById('userEditModal');
if (userEditModal) {
  userEditModal.addEventListener('click', function (event) {
    if (event.target === this) closeUserEdit();
  });
}

async function changeUserPassword(userId) {
  const newPassword = await adminPrompt('أدخل كلمة المرور الجديدة للمستخدم:', { password: true });
  if (!newPassword || newPassword.trim() === '') { adminAlert('كلمة المرور لا يمكن أن تكون فارغة.'); return; }
  const confirmPassword = await adminPrompt('أعد إدخال كلمة المرور الجديدة للتأكيد:', { password: true });
  if (!confirmPassword || newPassword !== confirmPassword) { adminAlert('كلمة المرور وتأكيدها غير متطابقين.'); return; }
  try {
    const res = await adminFetch(`/admin/users/${userId}/password`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        password: newPassword,
        confirmPassword,
      }),
    });
    const data = await res.json();
    if (!data.success) {
      adminAlert(data.message || 'تعذر تغيير كلمة المرور.');
      return;
    }
    adminAlert(data.message || 'تم تغيير كلمة المرور بنجاح.');
    searchUserById(userId);
  } catch (err) { adminAlert('حدث خطأ'); }
}

function searchDriverById(id) {
  document.getElementById('driverSearchInput').value = id;
  searchDriver();
}

function searchUserById(id) {
  document.getElementById('userSearchInput').value = id;
  searchUser();
}

// ================================================
// 15. عرض الوثائق وطلبات السائق/المستخدم
// ================================================
const providerDocumentKinds =
  Object.freeze([
    'identity_document',
    'driver_license',
  ]);

const providerDocumentLabels =
  Object.freeze({
    identity_document:
      'وثيقة الهوية',
    driver_license:
      'رخصة القيادة',
  });

function formatProviderDocumentBytes(size) {
  const numeric =
    Number(size);

  if (
    !Number.isFinite(numeric)
    || numeric < 0
  ) {
    return 'غير معروف';
  }

  if (numeric < 1024) {
    return `${numeric} B`;
  }

  if (numeric < 1024 * 1024) {
    return `${(
      numeric / 1024
    ).toFixed(1)} KB`;
  }

  return `${(
    numeric / (1024 * 1024)
  ).toFixed(2)} MB`;
}

function formatProviderDocumentDate(value) {
  const parsed =
    new Date(value);

  if (
    Number.isNaN(
      parsed.getTime(),
    )
  ) {
    return 'غير معروف';
  }

  return formatDisplayDateTime(parsed);
}

function providerDocumentDownloadUrl(
  scope,
  providerId,
  kind,
) {
  const encodedId =
    encodeURIComponent(
      String(providerId),
    );

  const encodedKind =
    encodeURIComponent(
      String(kind),
    );

  if (scope === 'pending') {
    return (
      `/admin/drivers/pending/${encodedId}`
      + `/documents/${encodedKind}`
    );
  }

  return (
    `/admin/drivers/documents/${encodedId}`
    + `/${encodedKind}`
  );
}

function renderProviderDocumentReview(
  data,
  scope,
  providerId,
) {
  const listContainer =
    document.getElementById(
      'documentsList',
    );

  const documents =
    Array.isArray(
      data.documents,
    )
      ? data.documents
      : [];

  const complete =
    data.complete === true;

  const licenseWaived =
    data.licenseNotAvailable === true;

  const completionText =
    licenseWaived
      ? 'مسجل بدون رخصة قيادة'
      : (
          complete
            ? 'الوثيقة المطلوبة مكتملة'
            : 'الوثيقة المطلوبة غير مكتملة'
        );

  const completionClass =
    complete
      ? 'paid-badge'
      : 'unpaid-badge';

  let html =
    `<div class="doc-item">`
    + `<span class="doc-name">حالة المراجعة</span>`
    + `<span class="doc-status">`
    + `<span class="${completionClass}">`
    + `${escapeHtml(completionText)}`
    + `</span>`
    + `</span>`
    + `</div>`;

  for (
    const kind
    of providerDocumentKinds
  ) {
    const document =
      documents.find(
        (candidate) =>
          candidate
          && candidate.kind === kind,
      );

    const label =
      providerDocumentLabels[kind];

    if (!document) {
      if (kind === 'identity_document') {
        continue;
      }

      html +=
        `<div class="doc-item">`
        + `<span class="doc-name">`
        + `${escapeHtml(label)}`
        + `</span>`
        + `<span class="doc-status">`
        + `<span data-presentation="p003">`
        + `غير متوفرة`
        + `</span>`
        + `</span>`
        + `</div>`;

      continue;
    }

    const downloadUrl =
      providerDocumentDownloadUrl(
        scope,
        providerId,
        kind,
      );

    html +=
      `<div class="doc-item">`
      + `<span class="doc-name">`
      + `${escapeHtml(label)}`
      + `</span>`
      + `<span class="doc-status">`
      + `${escapeHtml(document.contentType)}`
      + ` · `
      + `${escapeHtml(formatProviderDocumentBytes(document.size))}`
      + ` · `
      + `${escapeHtml(formatProviderDocumentDate(document.uploadedAt))}`
      + ` &nbsp; `
      + `<a class="action-btn info" `
      + `href="${escapeHtml(downloadUrl)}" `
      + `download>`
      + `<i class="fas fa-download"></i> تنزيل`
      + `</a>`
      + `</span>`
      + `</div>`;
  }

  listContainer.innerHTML =
    html;
}

async function openProviderDocuments(
  scope,
  providerId,
  providerName,
) {
  const encodedId =
    encodeURIComponent(
      String(providerId),
    );

  const metadataUrl =
    scope === 'pending'
      ? (
          `/admin/drivers/pending/${encodedId}`
          + '/documents'
        )
      : (
          `/admin/drivers/documents/${encodedId}`
        );

  try {
    const res =
      await adminFetch(
        metadataUrl,
      );

    const data =
      await res.json();

    if (!res.ok) {
      adminAlert(
        data.error
        || 'تعذر تحميل وثائق المزود',
      );
      return;
    }

    document
      .getElementById(
        'docDriverName',
      )
      .textContent =
        providerName
          ? `اسم السائق: ${providerName}`
          : `معرف السائق: ${providerId}`;

    renderProviderDocumentReview(
      data,
      scope,
      providerId,
    );

    document
      .getElementById(
        'documentsModal',
      )
      .classList.add(
        'show',
      );
  } catch (_) {
    adminAlert(
      'حدث خطأ في تحميل الوثائق',
    );
  }
}

async function viewDocuments(
  driverId,
  driverName = '',
) {
  return openProviderDocuments(
    'active',
    driverId,
    driverName,
  );
}

async function viewPendingProviderDocuments(
  pendingId,
  providerName = '',
) {
  return openProviderDocuments(
    'pending',
    pendingId,
    providerName,
  );
}

async function viewDriverOrdersViaDB(driverId) {
  try {
    const res = await adminFetch(`/admin/drivers/search?id=${driverId}`);
    const data = await res.json();
    if (data.error) { adminAlert(data.error); return; }
    const { driver, netProfit, last30Profit, totalCommission } = data;
    document.getElementById('reportDriverName').textContent = `اسم السائق: ${driver.name} (${driver.driverId})`;
    const content = document.getElementById('reportContent');
    if (driver.financial && driver.financial.transactions && driver.financial.transactions.length > 0) {
      let rows = '';
      driver.financial.transactions.forEach(t => {
        rows += `<tr><td>${escapeHtml(t.id.slice(-8))}</td><td>${escapeHtml(t.desc)}</td><td>${escapeHtml(formatDisplayDate(t.at || t.date))}</td>${timeCell(t.at)}<td class="amount">${escapeHtml(t.amount)} </td><td><button class="order-action-btn details" data-admin-capability="${escapeHtml(adminActionCapability || '')}" data-admin-action="openOrderDetails" data-admin-arg-count="1" data-admin-arg-1="${escapeHtml(String(t.id))}">عرض</button></td></tr>`;
      });
      content.innerHTML = `
        <div class="invoice-box">
          <table class="invoice-table"><thead><tr><th>رقم المعاملة</th><th>الوصف</th><th>التاريخ</th><th>الوقت</th><th>المبلغ</th><th>إجراء</th></tr></thead><tbody>${rows}</tbody></table>
          <div class="invoice-total"><span class="total-label">صافي الأرباح</span><span class="total-value">${escapeHtml(netProfit)} </span></div>
          <div data-presentation="p029"><span>آخر 30 يوم: ${escapeHtml(last30Profit)} </span><span>عمولة المنصة: ${escapeHtml(totalCommission || 0)} </span></div>
        </div>`;
    } else {
      content.innerHTML = '<p data-presentation="p030">لا توجد معاملات مسجلة.</p>';
    }
    document.getElementById('reportModal').classList.add('show');
  } catch (err) { adminAlert('حدث خطأ في تحميل التقرير'); }
}

async function viewUserOrdersViaDB(userId) {
  try {
    const res = await adminFetch(`/admin/users/search?id=${userId}`);
    const data = await res.json();
    if (data.error) { adminAlert(data.error); return; }
    const user = data.user;
    document.getElementById('userOrdersName').textContent = `اسم المستخدم: ${user.name} (${user.userId})`;
    const content = document.getElementById('userOrdersContent');
    if (user.orders && user.orders.length > 0) {
      let rows = '';
      user.orders.forEach(o => {
        rows += `<tr><td>${escapeHtml(o.orderId)}</td><td>${escapeHtml(o.type)}</td><td>${escapeHtml(formatDisplayDate(o.at || o.date))}</td>${timeCell(o.at)}<td>${escapeHtml(o.status)}</td><td class="amount">${escapeHtml(o.amount)} </td><td><button class="order-action-btn details" data-admin-capability="${escapeHtml(adminActionCapability || '')}" data-admin-action="openOrderDetails" data-admin-arg-count="1" data-admin-arg-1="${escapeHtml(String(o.fullId || ''))}">عرض</button></td></tr>`;
      });
      content.innerHTML = `<div class="invoice-box"><table class="invoice-table"><thead><tr><th>رقم الطلب</th><th>النوع</th><th>التاريخ</th><th>الوقت</th><th>الحالة</th><th>المبلغ</th><th>إجراء</th></tr></thead><tbody>${rows}</tbody></table></div>`;
    } else {
      content.innerHTML = '<p data-presentation="p030">لا توجد طلبات مسجلة.</p>';
    }
    document.getElementById('userOrdersModal').classList.add('show');
  } catch (err) { adminAlert('حدث خطأ في تحميل الطلبات'); }
}

// ================================================
// 19. إدارة الطلبات وتقارير السائق
// ================================================
function adminOrderStatusLabel(status) {
  const map = {
    pending: 'قيد الانتظار',
    offered: 'عروض متوفرة',
    accepted: 'تم قبول عرض',
    fulfilling: 'جاري العمل على الطلب',
    completed: 'تم انجاز الطلب',
    cancelled: 'تم إلغاء الطلب',
    expired: 'انتهت مدة قبول السعر',
  };
  return map[status] || status || 'غير محدد';
}

function adminOrderTypeLabel(type) {
  const map = {
    product: 'طلب منتج',
    people: 'نقل أشخاص',
    goods: 'نقل بضاعة',
  };
  return map[type] || type || 'غير محدد';
}

function adminOrderStatusBadge(status) {
  return `<span class="order-status-badge ${escapeHtml(status)}">${escapeHtml(adminOrderStatusLabel(status))}</span>`;
}

function adminOrderCustomer(order) {
  const customer = order.customerId;
  if (!customer || typeof customer !== 'object') {
    return { name: 'غير محدد', publicId: '', phone: '' };
  }
  const phones = Array.isArray(customer.phoneNumbers) ? customer.phoneNumbers : [];
  const primary = phones.find((phone) => phone.primary) || phones[0] || {};
  return {
    name: customer.fullName || 'غير محدد',
    publicId: customer.publicId || '',
    phone: primary.number || '',
  };
}

function adminOrderProvider(order) {
  const provider = order.providerId;
  if (!provider || typeof provider !== 'object') {
    return { name: 'غير معين', publicId: '', phone: '' };
  }
  const phones = Array.isArray(provider.phoneNumbers) ? provider.phoneNumbers : [];
  const primary = phones.find((phone) => phone.primary) || phones[0] || {};
  return {
    name: provider.fullName || 'غير معين',
    publicId: provider.publicId || '',
    phone: primary.number || '',
  };
}

function adminOrderDate(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : formatDisplayDateTime(date);
}

async function loadOrders() {
  const search = (document.getElementById('orderSearchInput')?.value || '').trim();
  const status = document.getElementById('orderStatusFilter')?.value || 'all';
  const type = document.getElementById('orderTypeFilter')?.value || 'all';
  const area = (document.getElementById('orderAreaFilter')?.value || '').trim();
  const params = new URLSearchParams();
  if (search) params.set('q', search);
  if (status && status !== 'all') params.set('status', status);
  if (type && type !== 'all') params.set('type', type);
  if (area) params.set('area', area);

  const container = document.getElementById('ordersContent');
  if (!container) return;

  try {
    const res = await adminFetch(`/admin/orders?${params.toString()}`);
    const orders = await res.json();

    if (!Array.isArray(orders)) {
      container.innerHTML = `<p data-presentation="p030">${escapeHtml(orders.error || 'تعذر تحميل الطلبات')}</p>`;
      container.classList.add('show');
      return;
    }

    if (orders.length === 0) {
      container.innerHTML = '<p data-presentation="p030">لا توجد طلبات مطابقة.</p>';
      container.classList.add('show');
      return;
    }

    const rows = orders.map((order) => {
      const customer = adminOrderCustomer(order);
      const provider = adminOrderProvider(order);
      const id = String(order._id || '');
      const safeId = escapeHtml(id);
      const isClosed = ['completed', 'cancelled'].includes(order.status);
      let actions = `<button class="order-action-btn details" data-admin-capability="${escapeHtml(adminActionCapability || '')}" data-admin-action="openOrderDetails" data-admin-arg-count="1" data-admin-arg-1="${safeId}"><i class="fas fa-eye"></i> تفاصيل</button>`;
      if (!isClosed) {
        actions += ` <button class="order-action-btn cancel" data-admin-capability="${escapeHtml(adminActionCapability || '')}" data-admin-action="adminCancelOrder" data-admin-arg-count="1" data-admin-arg-1="${safeId}"><i class="fas fa-ban"></i> إلغاء</button>`;
      }
      if (['pending', 'offered'].includes(order.status)) {
        actions += ` <button class="order-action-btn resend" data-admin-capability="${escapeHtml(adminActionCapability || '')}" data-admin-action="adminResendOrder" data-admin-arg-count="1" data-admin-arg-1="${safeId}"><i class="fas fa-paper-plane"></i> إعادة إرسال</button>`;
      }
      if (order.status === 'pending' && order.offerSuspendedUntil) {
        actions += ` <button class="order-action-btn suspend" data-admin-capability="${escapeHtml(adminActionCapability || '')}" data-admin-action="adminEndSuspension" data-admin-arg-count="1" data-admin-arg-1="${safeId}"><i class="fas fa-hourglass-end"></i> إنهاء التعليق</button>`;
      }
      const suspended = order.offerSuspendedUntil && new Date(order.offerSuspendedUntil) > new Date();
      return `<tr>
        <td>${safeId.slice(-8)}</td>
        <td>${escapeHtml(adminOrderTypeLabel(order.type))}</td>
        <td>${escapeHtml(customer.name)}${customer.publicId ? `<br><small>ID ${escapeHtml(customer.publicId)}</small>` : ''}</td>
        <td>${escapeHtml(provider.name)}${provider.publicId ? `<br><small>ID ${escapeHtml(provider.publicId)}</small>` : ''}</td>
        <td>${escapeHtml(order.area || '')}</td>
        <td>${adminOrderStatusBadge(order.status)}${suspended ? `<br><small class="order-meta">معلق حتى ${escapeHtml(adminOrderDate(order.offerSuspendedUntil))}</small>` : ''}</td>
        <td>${escapeHtml(String(order.price || 0))}</td>
        <td>${escapeHtml(formatDisplayDate(order.createdAt))}</td>
        ${timeCell(order.createdAt)}
        <td><div class="order-actions">${actions}</div></td>
      </tr>`;
    }).join('');

    container.innerHTML = `<div data-presentation="p002"><table class="orders-table"><thead><tr><th>الطلب</th><th>النوع</th><th>الزبون</th><th>السائق</th><th>المنطقة</th><th>الحالة</th><th>السعر</th><th>التاريخ</th><th>الوقت</th><th>إجراءات</th></tr></thead><tbody>${rows}</tbody></table></div>`;
    container.classList.add('show');
  } catch (err) {
    container.innerHTML = '<p data-presentation="p030">حدث خطأ في تحميل الطلبات.</p>';
    container.classList.add('show');
  }
}

async function openOrderDetails(orderId) {
  try {
    const res = await adminFetch(`/admin/orders/${encodeURIComponent(orderId)}`);
    const data = await res.json();
    if (data.error) { adminAlert(data.error); return; }

    const { order, offers, rejections } = data;
    const customer = adminOrderCustomer(order);
    const provider = adminOrderProvider(order);

    let html = `
      <div class="row"><span class="label">رقم الطلب</span><span class="value">${escapeHtml(String(order._id))}</span></div>
      <div class="row"><span class="label">النوع</span><span class="value">${escapeHtml(adminOrderTypeLabel(order.type))}</span></div>
      <div class="row"><span class="label">الحالة</span><span class="value">${adminOrderStatusBadge(order.status)}</span></div>
      <div class="row"><span class="label">الزبون</span><span class="value">${escapeHtml(customer.name)} ${customer.publicId ? `(ID ${escapeHtml(customer.publicId)})` : ''}${customer.phone ? ` - ${escapeHtml(customer.phone)}` : ''}</span></div>
      <div class="row"><span class="label">السائق</span><span class="value">${escapeHtml(provider.name)} ${provider.publicId ? `(ID ${escapeHtml(provider.publicId)})` : ''}${provider.phone ? ` - ${escapeHtml(provider.phone)}` : ''}</span></div>
      <div class="row"><span class="label">المنطقة</span><span class="value">${escapeHtml(order.area || 'غير محدد')}</span></div>
      <div class="row"><span class="label">الوصف</span><span class="value">${escapeHtml(order.description || '')}</span></div>
      <div class="row"><span class="label">هاتف الطلب</span><span class="value">${escapeHtml(order.phone || '')}</span></div>
      <div class="row"><span class="label">السعر</span><span class="value">${escapeHtml(String(order.price || 0))}</span></div>
      <div class="row"><span class="label">تاريخ الإنشاء</span><span class="value">${escapeHtml(adminOrderDate(order.createdAt))}</span></div>
      <div class="row"><span class="label">انتهاء مهلة العرض</span><span class="value">${escapeHtml(adminOrderDate(order.offerWindowExpiredAt))}</span></div>
      <div class="row"><span class="label">نهاية التعليق</span><span class="value">${escapeHtml(adminOrderDate(order.offerSuspendedUntil))}</span></div>
      <div class="row"><span class="label">تاريخ الإنجاز</span><span class="value">${escapeHtml(adminOrderDate(order.completedAt))}</span></div>
    `;

    html += '<div class="order-section-title">عروض الأسعار</div>';
    if (!offers || offers.length === 0) {
      html += '<p data-presentation="p030">لا توجد عروض.</p>';
    } else {
      offers.forEach((offer) => {
        const offerProvider = offer.providerId && typeof offer.providerId === 'object' ? offer.providerId : {};
        const rejectButton = offer.status === 'pending'
          ? `<button class="order-action-btn reject" data-admin-capability="${escapeHtml(adminActionCapability || '')}" data-admin-action="adminRejectOffer" data-admin-arg-count="2" data-admin-arg-1="${escapeHtml(String(order._id))}" data-admin-arg-2="${escapeHtml(String(offer._id))}"><i class="fas fa-times"></i> رفض العرض</button>`
          : '';
        html += `<div class="order-offer-row">
          <div class="line"><strong>${escapeHtml(offerProvider.fullName || 'غير محدد')}</strong><span>${escapeHtml(String(offer.price || 0))} شيكل</span></div>
          <div class="line"><span class="muted">الوقت: ${escapeHtml(String(offer.estimatedTime || 0))} دقيقة</span><span class="muted">${escapeHtml(offer.status || '')}</span></div>
          <div class="line"><span class="muted">${escapeHtml(adminOrderDate(offer.createdAt))}</span>${rejectButton}</div>
        </div>`;
      });
    }

    html += '<div class="order-section-title">سجل الرفض والانتهاء</div>';
    if (!rejections || rejections.length === 0) {
      html += '<p data-presentation="p030">لا يوجد سجل رفض.</p>';
    } else {
      rejections.forEach((rejection) => {
        const rejectionProvider = rejection.providerId && typeof rejection.providerId === 'object' ? rejection.providerId : {};
        const reason = rejection.reason === 'offer_expired' ? 'انتهاء مدة عرض السعر' : 'تم رفض الطلب من جهتك';
        html += `<div class="order-offer-row">
          <div class="line"><strong>${escapeHtml(rejectionProvider.fullName || 'غير محدد')}</strong><span class="muted">${escapeHtml(adminOrderDate(rejection.createdAt))}</span></div>
          <div class="line"><span class="muted">${escapeHtml(reason)}</span></div>
        </div>`;
      });
    }

    document.getElementById('orderDetailsSub').textContent = `طلب #${String(order._id).slice(-8)} - ${customer.name}`;
    document.getElementById('orderDetailsContent').innerHTML = html;
    document.getElementById('orderDetailsModal').classList.add('show');
  } catch (err) {
    adminAlert('حدث خطأ في تحميل تفاصيل الطلب');
  }
}

async function adminCancelOrder(orderId) {
  if (!await adminConfirm('هل تريد إلغاء هذا الطلب نهائياً؟')) return;
  await runOrderAction(orderId, 'cancel');
}

async function adminResendOrder(orderId) {
  if (!await adminConfirm('هل تريد إعادة إرسال الطلب للسائقين؟')) return;
  await runOrderAction(orderId, 'resend');
}

async function adminEndSuspension(orderId) {
  if (!await adminConfirm('هل تريد إنهاء تعليق الطلب ونقله إلى التقارير؟')) return;
  await runOrderAction(orderId, 'end-suspension');
}

async function runOrderAction(orderId, action) {
  try {
    const res = await adminFetch(`/admin/orders/${encodeURIComponent(orderId)}/${action}`, { method: 'POST' });
    const data = await res.json();
    adminAlert(data.message || data.error || 'تم تنفيذ الإجراء');
    loadOrders();
    if (document.getElementById('orderDetailsModal').classList.contains('show')) {
      openOrderDetails(orderId);
    }
  } catch (err) {
    adminAlert('تعذر تنفيذ الإجراء');
  }
}

async function adminRejectOffer(orderId, offerId) {
  if (!await adminConfirm('هل تريد رفض عرض السعر هذا؟')) return;
  try {
    const res = await adminFetch(`/admin/orders/${encodeURIComponent(orderId)}/offers/${encodeURIComponent(offerId)}/reject`, { method: 'POST' });
    const data = await res.json();
    adminAlert(data.message || data.error || 'تم رفض العرض');
    loadOrders();
    openOrderDetails(orderId);
  } catch (err) {
    adminAlert('تعذر رفض العرض');
  }
}

function closeOrderDetails() {
  document.getElementById('orderDetailsModal').classList.remove('show');
}

async function openDriverReports(driverId) {
  try {
    const res = await adminFetch(`/admin/drivers/${encodeURIComponent(driverId)}/reports`);
    const data = await res.json();
    if (data.error) { adminAlert(data.error); return; }

    let html = '';
    if (!data.report || data.report.length === 0) {
      html = '<p data-presentation="p030">لا توجد سجلات في التقرير.</p>';
    } else {
      data.report.forEach((entry) => {
        const customer = entry.customerId && typeof entry.customerId === 'object' ? entry.customerId : {};
        const isDelivered = entry.recordType === 'delivered';
        const reason = isDelivered
          ? 'تم انجاز الطلب'
          : entry.reason === 'offer_expired'
            ? 'انتهاء مدة عرض السعر'
            : 'تم رفض الطلب من جهتك';
        html += `<div class="order-offer-row">
          <div class="line"><strong>${escapeHtml(adminOrderTypeLabel(entry.type))}</strong><span>${escapeHtml(reason)}</span></div>
          <div class="line"><span class="muted">الزبون: ${escapeHtml(customer.fullName || 'غير محدد')}${customer.publicId ? ` (ID ${escapeHtml(customer.publicId)})` : ''}</span><span class="muted">${escapeHtml(entry.phone || '')}</span></div>
          <div class="line"><span class="muted">${escapeHtml(entry.description || '')}</span><span class="muted">${escapeHtml(adminOrderDate(entry.reportAt))}</span></div>
        </div>`;
      });
    }

    document.getElementById('driverReportSub').textContent = `السائق: ${data.provider.name} (${data.provider.publicId || ''})`;
    document.getElementById('driverReportContent').innerHTML = html;
    document.getElementById('driverReportModal').classList.add('show');
  } catch (err) {
    adminAlert('حدث خطأ في تحميل تقرير السائق');
  }
}

function closeDriverReport() {
  document.getElementById('driverReportModal').classList.remove('show');
}

async function toggleDriverAvailability(driverId, currentAvailability) {
  const nextAvailability = String(currentAvailability) !== 'true';
  try {
    const res = await adminFetch(`/admin/drivers/${encodeURIComponent(driverId)}/availability`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ available: nextAvailability }),
    });
    const data = await res.json();
    adminAlert(data.success ? (nextAvailability ? 'تم جعل السائق متاحاً' : 'تم جعل السائق غير متاح') : (data.message || 'تعذر تحديث حالة التوفر'));
    searchDriver();
    loadDriversList();
  } catch (err) {
    adminAlert('تعذر تحديث حالة التوفر');
  }
}

document.getElementById('orderSearchBtn').addEventListener('click', loadOrders);
document.getElementById('orderSearchInput').addEventListener('keypress', e => { if (e.key === 'Enter') loadOrders(); });
document.getElementById('orderAreaFilter').addEventListener('keypress', e => { if (e.key === 'Enter') loadOrders(); });
document.getElementById('orderStatusFilter').addEventListener('change', loadOrders);
document.getElementById('orderTypeFilter').addEventListener('change', loadOrders);


// ================================================
// 20. قوائم السائقين والمستخدمين أسفل شريط البحث
// ================================================
function adminAccountStatusLabel(status) {
  const map = {
    active: 'نشط',
    inactive: 'غير نشط',
    blocked: 'مجمد',
    pending: 'قيد المراجعة',
  };
  return map[status] || status || 'غير محدد';
}

function adminAccountStatusBadge(status) {
  const normalized = status === 'blocked' ? 'cancelled' : (status === 'active' ? 'completed' : 'pending');
  return `<span class="order-status-badge ${normalized}">${escapeHtml(adminAccountStatusLabel(status))}</span>`;
}

async function loadDriversList() {
  const container = document.getElementById('driversList');
  if (!container) return;

  try {
    const res = await adminFetch('/admin/drivers');
    const drivers = await res.json();

    if (!Array.isArray(drivers)) {
      container.innerHTML = `<p data-presentation="p030">${escapeHtml(drivers.error || 'تعذر تحميل السائقين')}</p>`;
      container.classList.add('show');
      return;
    }

    if (drivers.length === 0) {
      container.innerHTML = '<p data-presentation="p030">لا يوجد سائقون مسجلون.</p>';
      container.classList.add('show');
      return;
    }

    const rows = drivers.map((driver) => {
      const id = escapeHtml(String(driver._id));
      const busy = driver.blockedUntil && new Date(driver.blockedUntil) > new Date();
      const availability = driver.isAvailable
        ? '<span class="order-status-badge completed">متاح</span>'
        : '<span class="order-status-badge cancelled">غير متاح</span>';
      return `<tr>
        <td><strong>${escapeHtml(driver.fullName || 'غير محدد')}</strong>${driver.publicId ? `<br><small>ID ${escapeHtml(driver.publicId)}</small>` : ''}</td>
        <td dir="ltr">${escapeHtml(driver.phone || '')}</td>
        <td>${escapeHtml(driver.governorate || 'غير محدد')}</td>
        <td>${escapeHtml(driver.city || driver.area || 'غير محدد')}</td>
        <td>${escapeHtml(providerServiceTypesLabel(driver.serviceTypes))}</td>
        <td>${adminAccountStatusBadge(driver.status)}</td>
        <td>${availability}${busy ? ' <span class="order-status-badge pending">مشغول</span>' : ''}</td>
        <td><button class="order-action-btn details" data-admin-capability="${escapeHtml(adminActionCapability || '')}" data-admin-action="selectDriverFromList" data-admin-arg-count="1" data-admin-arg-1="${id}"><i class="fas fa-eye"></i> عرض</button></td>
      </tr>`;
    }).join('');

    container.innerHTML = `<h4 data-presentation="p017">قائمة السائقين</h4>
      <table class="orders-table"><thead><tr><th>السائق</th><th>الجوال</th><th>المحافظة</th><th>المدينة / القرية</th><th>نوع الخدمة</th><th>الحالة</th><th>التوفر</th><th>إجراء</th></tr></thead><tbody>${rows}</tbody></table>`;
    container.classList.add('show');
  } catch (err) {
    container.innerHTML = '<p data-presentation="p030">حدث خطأ في تحميل السائقين.</p>';
    container.classList.add('show');
  }
}

async function loadUsersList() {
  const container = document.getElementById('usersList');
  if (!container) return;

  try {
    const res = await adminFetch('/admin/users');
    const users = await res.json();

    if (!Array.isArray(users)) {
      container.innerHTML = `<p data-presentation="p030">${escapeHtml(users.error || 'تعذر تحميل المستخدمين')}</p>`;
      container.classList.add('show');
      return;
    }

    if (users.length === 0) {
      container.innerHTML = '<p data-presentation="p030">لا يوجد مستخدمون مسجلون.</p>';
      container.classList.add('show');
      return;
    }

    const rows = users.map((user) => {
      const id = escapeHtml(String(user._id));
      return `<tr>
        <td><strong>${escapeHtml(user.fullName || 'غير محدد')}</strong>${user.publicId ? `<br><small>ID ${escapeHtml(user.publicId)}</small>` : ''}</td>
        <td dir="ltr">${escapeHtml(user.email || '')}</td>
        <td dir="ltr">${escapeHtml(user.phone || '')}</td>
        <td>${escapeHtml(user.governorate || 'غير محدد')}</td>
        <td>${escapeHtml(user.city || user.area || 'غير محدد')}</td>
        <td>${adminAccountStatusBadge(user.status)}</td>
        <td><button class="order-action-btn details" data-admin-capability="${escapeHtml(adminActionCapability || '')}" data-admin-action="selectUserFromList" data-admin-arg-count="1" data-admin-arg-1="${id}"><i class="fas fa-eye"></i> عرض</button></td>
      </tr>`;
    }).join('');

    container.innerHTML = `<h4 data-presentation="p017">قائمة المستخدمين</h4>
      <table class="orders-table"><thead><tr><th>المستخدم</th><th>البريد</th><th>الجوال</th><th>المحافظة</th><th>المدينة / القرية</th><th>الحالة</th><th>إجراء</th></tr></thead><tbody>${rows}</tbody></table>`;
    container.classList.add('show');
  } catch (err) {
    container.innerHTML = '<p data-presentation="p030">حدث خطأ في تحميل المستخدمين.</p>';
    container.classList.add('show');
  }
}

function selectDriverFromList(id) {
  const input = document.getElementById('driverSearchInput');
  if (input) input.value = id;
  searchDriver();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function selectUserFromList(id) {
  const input = document.getElementById('userSearchInput');
  if (input) input.value = id;
  searchUser();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function closeDocuments() { document.getElementById('documentsModal').classList.remove('show'); }
document.getElementById('documentsModal').addEventListener('click', function (e) { if (e.target === this) closeDocuments(); });

function closeReport() { document.getElementById('reportModal').classList.remove('show'); }
function closeUserOrders() { document.getElementById('userOrdersModal').classList.remove('show'); }

function closeReportDetail() {
  document.getElementById('reportDetailModal').classList.remove('show');
  currentReportType = null;
  currentReportId = null;
}
document.getElementById('reportDetailModal').addEventListener('click', function (e) { if (e.target === this) closeReportDetail(); });

// ================================================
// 16. مودال القوائم الإحصائية
// ================================================
const ARABIC_MONTHS = [
  'كانون الثاني', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران',
  'تموز', 'آب', 'أيلول', 'تشرين الأول', 'تشرين الثاني', 'كانون الأول',
];
const ARABIC_WEEKDAYS = [
  'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت',
];

// "الجمعة 13/11/2026" for the day the server reported (Palestine time).
function commissionDayLabel({ year, month, day }) {
  if (!day) return commissionMonthLabel({ year, month });
  const weekday = ARABIC_WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  return `${weekday} ${day}/${month}/${year}`;
}

// "تشرين الثاني 2026"
function commissionMonthLabel({ year, month }) {
  return `${ARABIC_MONTHS[month - 1] || month} ${year}`;
}

function money(value) {
  return (Number(value) || 0).toLocaleString('en-US');
}

async function renderCommissionReport(period, subEl, content) {
  const res = await adminFetch(
    `/admin/api/commission-report?period=${period === 'month' ? 'month' : 'today'}`,
  );
  const data = await res.json();
  const when = period === 'month'
    ? commissionMonthLabel(data)
    : commissionDayLabel(data);

  subEl.textContent =
    `${when} — الإجمالي: ${money(data.total)} شيكل من ${money(data.orders)} طلب`;

  const drivers = Array.isArray(data.drivers) ? data.drivers : [];
  if (drivers.length === 0) {
    content.innerHTML = '<p>لا توجد عمولات في هذه الفترة بعد.</p>';
    return;
  }

  const rows = drivers.map((driver) => {
    const share = data.total > 0
      ? Math.round((driver.commission / data.total) * 100)
      : 0;
    const name = driver.deleted
      ? `<em>${escapeHtml(driver.name)}</em>`
      : `<strong>${escapeHtml(driver.name)}</strong>`;
    return `
      <tr>
        <td>${name}<br><small>${escapeHtml(driver.publicId ? `ID ${driver.publicId}` : '')}</small></td>
        <td>${escapeHtml(driver.phone || '—')}</td>
        <td>${escapeHtml(money(driver.orders))}</td>
        <td>${escapeHtml(money(driver.revenue))} شيكل</td>
        <td><strong>${escapeHtml(money(driver.commission))} شيكل</strong><br><small>${escapeHtml(share)}٪ من الإجمالي</small></td>
      </tr>`;
  }).join('');

  content.innerHTML = `
    <div class="commissions-table-container">
      <table class="orders-table commission-report-table">
        <thead>
          <tr>
            <th>السائق</th>
            <th>الجوال</th>
            <th>الطلبات</th>
            <th>قيمة الطلبات</th>
            <th>عمولة المنصة</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr>
            <th colspan="2">الإجمالي</th>
            <th>${escapeHtml(money(data.orders))}</th>
            <th>—</th>
            <th>${escapeHtml(money(data.total))} شيكل</th>
          </tr>
        </tfoot>
      </table>
    </div>`;
}

async function openListModal(type, filter, title) {
  const modal = document.getElementById('listModal');
  const titleEl = document.getElementById('listModalTitle');
  const subEl = document.getElementById('listModalSub');
  const content = document.getElementById('listModalContent');

  if (!modal || !titleEl || !subEl || !content) return;

  titleEl.textContent = title || 'القائمة';

  if (type === 'commissionReport') {
    modal.classList.add('show');
    subEl.textContent = '';
    content.innerHTML = '<p>جاري التحميل...</p>';
    try {
      await renderCommissionReport(filter, subEl, content);
    } catch (err) {
      content.innerHTML = '<p>حدث خطأ في تحميل تقرير العمولة.</p>';
    }
    return;
  }

  if (type === 'payouts') {
    modal.classList.add('show');
    content.innerHTML = '<p>جاري التحميل...</p>';

    try {
      const res = await adminFetch('/admin/commissions');
      const data = await res.json();
      const drivers = (data.driverRows || []).filter(
        (driver) =>
          driver.paymentStatus !== 'paid' && Number(driver.commission) > 0,
      );

      subEl.textContent =
        'إجمالي المستحقات: ' +
        (Number(data.totalUnpaid) || 0).toLocaleString('en-US') +
        ' شيكل';

      if (drivers.length === 0) {
        content.innerHTML = '<p>لا يوجد سائقون مستحقون للدفع حالياً.</p>';
        return;
      }

      const rows = drivers
        .map(
          (driver) => `
        <tr>
          <td><strong>${escapeHtml(driver.name || 'غير محدد')}</strong><br><small>${escapeHtml(driver.driverId || '')}</small></td>
          <td dir="${driver.phone ? 'ltr' : 'auto'}">${escapeHtml(driver.phone || 'غير متوفر')}</td>
          <td>${escapeHtml(String(driver.commission))} شيكل</td>
          <td><button class="action-btn pay-now" data-admin-capability="${escapeHtml(adminActionCapability || '')}" data-admin-action="markPaid" data-admin-arg-count="1" data-admin-arg-1="${escapeHtml(String(driver._id))}">تم دفع المستحقات</button></td>
        </tr>`,
        )
        .join('');

      content.innerHTML = `
        <table class="orders-table">
          <thead>
            <tr>
              <th>السائق</th>
              <th>الجوال</th>
              <th>المستحق</th>
              <th>الإجراء</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>`;
    } catch (err) {
      content.innerHTML = '<p>حدث خطأ في تحميل المستحقات.</p>';
    }
    return;
  }

  if (type !== 'drivers') {
    subEl.textContent = 'تفاصيل الأعضاء';
    content.innerHTML = '<p>تُدار قوائم المستخدمين من صفحة المستخدمين.</p>';
    modal.classList.add('show');
    return;
  }

  const isInactive = filter === 'inactive';
  const isActive = filter === 'active';

  subEl.textContent = isInactive
    ? 'السائقون الذين أوقفوا استقبال الطلبات'
    : isActive
      ? 'السائقون المتاحون لاستقبال الطلبات'
      : 'جميع السائقين';

  content.innerHTML = '<p>جاري التحميل...</p>';
  modal.classList.add('show');

  try {
    const res = await adminFetch('/admin/drivers');
    const drivers = await res.json();

    if (!Array.isArray(drivers)) {
      content.innerHTML = '<p>تعذر تحميل قائمة السائقين.</p>';
      return;
    }

    const filtered = drivers.filter((driver) => {
      if (driver.deleted === true) return false;
      if (filter === 'all') return true;
      if (String(driver.status) !== 'active') return false;
      const available = driver.isAvailable !== false;
      return filter === 'active' ? available : !available;
    });

    if (filtered.length === 0) {
      content.innerHTML = isInactive
        ? '<p>لا يوجد سائقون أوقفوا استقبال الطلبات حالياً.</p>'
        : '<p>لا يوجد سائقون في هذه القائمة.</p>';
      return;
    }

    const rows = filtered.map((driver) => {
      const available = driver.isAvailable !== false;
      const availability = available
        ? '<span class="order-status-badge completed">متاح</span>'
        : '<span class="order-status-badge cancelled">غير متاح</span>';
      return `<tr>
        <td><strong>${escapeHtml(driver.fullName || 'غير محدد')}</strong>${driver.publicId ? `<br><small>ID ${escapeHtml(driver.publicId)}</small>` : ''}</td>
        <td>${escapeHtml(driver.phone || '')}</td>
        <td>${escapeHtml(driver.area || 'غير محدد')}</td>
        <td>${availability}</td>
        <td>${adminAccountStatusBadge(driver.status)}</td>
      </tr>`;
    }).join('');

    content.innerHTML = `
      <table class="orders-table">
        <thead>
          <tr>
            <th>السائق</th>
            <th>الجوال</th>
            <th>المنطقة</th>
            <th>استقبال الطلبات</th>
            <th>حالة الحساب</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`;
  } catch (err) {
    content.innerHTML = '<p>حدث خطأ في تحميل القائمة.</p>';
  }
}

function closeListModal() { document.getElementById('listModal').classList.remove('show'); }
document.getElementById('listModal').addEventListener('click', function (e) { if (e.target === this) closeListModal(); });

// ================================================
// 17. إعدادات كلمة المرور
// ================================================
function openResetPassword() {
  document.getElementById('resetPasswordModal').classList.add('show');
  document.getElementById('currentPassword').value = '';
  document.getElementById('newPassword').value = '';
  document.getElementById('confirmPassword').value = '';
  document.getElementById('resetMsg').className = 'msg';
  document.getElementById('resetMsg').textContent = '';
}

function closeResetPassword() {
  document.getElementById('resetPasswordModal').classList.remove('show');
}
document.getElementById('resetPasswordModal').addEventListener('click', function (e) {
  if (e.target === this) closeResetPassword();
});

async function handleResetPassword() {
  const current = document.getElementById('currentPassword').value.trim();
  const newPass = document.getElementById('newPassword').value.trim();
  const confirmPass = document.getElementById('confirmPassword').value.trim();
  const msgEl = document.getElementById('resetMsg');

  if (!current || !newPass || !confirmPass) {
    msgEl.className = 'msg error';
    msgEl.textContent = 'الرجاء ملء جميع الحقول.';
    return;
  }
  if (newPass.length < 12) {
    msgEl.className = 'msg error';
    msgEl.textContent = 'كلمة المرور الجديدة يجب أن تكون 12 حرفاً على الأقل.';
    return;
  }
  if (newPass !== confirmPass) {
    msgEl.className = 'msg error';
    msgEl.textContent = 'كلمة المرور وتأكيدها غير متطابقين.';
    return;
  }

  try {
    const res = await adminFetch('/admin/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: current, newPassword: newPass, confirmPassword: confirmPass })
    });
    const data = await res.json();
    if (data.success) {
      msgEl.className = 'msg success';
      msgEl.textContent = 'تم تغيير كلمة المرور بنجاح!';
      setTimeout(() => { closeResetPassword(); }, 2000);
    } else {
      msgEl.className = 'msg error';
      msgEl.textContent = data.message;
    }
  } catch (err) {
    msgEl.className = 'msg error';
    msgEl.textContent = 'حدث خطأ في الاتصال';
  }
}

// ================================================
// 18. المصادقة الثنائية
// ================================================
async function manageTwoFactor() {
  try {
    const statusResponse = await adminFetch('/admin/2fa/status');
    const status = await statusResponse.json();

    if (!status.success) {
      adminAlert(status.message || 'تعذر قراءة حالة المصادقة الثنائية');
      return;
    }

    if (status.enabled) {
      const password = await adminPrompt('أدخل كلمة مرور المدير لتعطيل المصادقة الثنائية:', { password: true });

      if (password === null) return;

      const code = await adminPrompt('أدخل رمز المصادقة أو رمز استرداد:');

      if (code === null) return;

      const response = await adminFetch('/admin/2fa/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, code }),
      });
      const result = await response.json();

      adminAlert(result.message || (result.success ? 'تم التعطيل' : 'تعذر التعطيل'));
      return;
    }

    const setupResponse = await adminFetch('/admin/2fa/setup', {
      method: 'POST',
    });
    const setup = await setupResponse.json();

    if (!setup.success) {
      adminAlert(setup.message || 'تعذر بدء إعداد المصادقة الثنائية');
      return;
    }

    adminAlert(
      'أضف الحساب في تطبيق المصادقة باستخدام الرابط التالي:\n\n'
      + setup.otpauthUri
      + '\n\nأو أدخل السر يدوياً:\n'
      + setup.secret,
    );

    const code = await adminPrompt('أدخل الرمز المكوّن من 6 أرقام من تطبيق المصادقة:');

    if (code === null) return;

    const enableResponse = await adminFetch('/admin/2fa/enable', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    const enabled = await enableResponse.json();

    if (!enabled.success) {
      adminAlert(enabled.message || 'تعذر تفعيل المصادقة الثنائية');
      return;
    }

    adminAlert(
      'تم تفعيل المصادقة الثنائية.\n\nاحفظ رموز الاسترداد في مكان آمن:\n\n'
      + (enabled.recoveryCodes || []).join('\n'),
    );
  } catch (err) {
    adminAlert('حدث خطأ في الاتصال');
  }
}

// ================================================
// 18. الإعلانات
// ================================================
let adsCache = [];

function adAudienceLabel(audience) {
  switch (audience) {
    case 'customers':
      return 'الزبائن';
    case 'providers':
      return 'السائقون';
    default:
      return 'الجميع';
  }
}

function adStatusBadge(isActive) {
  return isActive
    ? '<span class="order-status-badge completed">نشط</span>'
    : '<span class="order-status-badge cancelled">متوقف</span>';
}

function formatAdDate(value) {
  if (!value) return 'دائم';

  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '—';

  return formatDisplayDateTime(date);
}

function toDateTimeLocal(value) {
  if (!value) return '';

  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';

  const pad = (number) => String(number).padStart(2, '0');

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function setAdFormMessage(message, type = '') {
  const element = document.getElementById('adFormMsg');
  if (!element) return;

  element.textContent = message || '';
  element.className = `settings-message ${type}`.trim();
}

function resetAdForm() {
  const form = document.getElementById('adForm');
  if (!form) return;

  form.reset();
  form.dataset.editingId = '';
  document.getElementById('adTitle').value = '';
  document.getElementById('adBody').value = '';
  document.getElementById('adStartsAt').value = '';
  document.getElementById('adEndsAt').value = '';
  document.getElementById('adSortOrder').value = '0';
  document.getElementById('adAudience').value = 'all';
  document.getElementById('adIsActive').value = 'true';
  document.getElementById('adShowCountdown').value = 'false';
  setAdLinkForm('');
  setAdFormMessage('');
}

// ---- What a tap on the ad opens: '' | 'app:<screen>' | 'https://...' ----
const AD_SCREEN_LABELS = {
  create_order: 'إنشاء طلب جديد',
  my_orders: 'طلباتي',
  support: 'التواصل مع الدعم',
  notifications: 'الإشعارات',
};

function syncAdLinkFields() {
  const type = document.getElementById('adLinkType')?.value || '';
  const screenGroup = document.getElementById('adLinkScreenGroup');
  const urlGroup = document.getElementById('adLinkUrlGroup');
  if (screenGroup) screenGroup.hidden = type !== 'app';
  if (urlGroup) urlGroup.hidden = type !== 'url';
}

function setAdLinkForm(link) {
  const value = String(link || '');
  const typeInput = document.getElementById('adLinkType');
  if (!typeInput) return;
  if (value.startsWith('app:')) {
    typeInput.value = 'app';
    document.getElementById('adLinkScreen').value = value.slice(4);
    document.getElementById('adLinkUrl').value = '';
  } else if (value) {
    typeInput.value = 'url';
    document.getElementById('adLinkUrl').value = value;
  } else {
    typeInput.value = '';
    document.getElementById('adLinkUrl').value = '';
  }
  syncAdLinkFields();
}

/** The link to save, or null (with a message shown) when it is invalid. */
function adLinkFromForm() {
  const type = document.getElementById('adLinkType').value;
  if (type === 'app') {
    return `app:${document.getElementById('adLinkScreen').value}`;
  }
  if (type === 'url') {
    const raw = document.getElementById('adLinkUrl').value.trim();
    try {
      const url = new URL(raw);
      if (url.protocol === 'https:' && url.hostname && !url.username && !url.password) {
        return url.toString();
      }
    } catch (err) {
      // reported below
    }
    setAdFormMessage('أدخل رابطاً صحيحاً يبدأ بـ https://', 'error');
    return null;
  }
  return '';
}

function adLinkLabel(link) {
  const value = String(link || '');
  if (!value) return 'لا شيء';
  if (value.startsWith('app:')) {
    return `شاشة: ${AD_SCREEN_LABELS[value.slice(4)] || value.slice(4)}`;
  }
  return value;
}

// The banner fills the phone width at 160-180 points high: images must be
// landscape with a width:height ratio between 2:1 and 2.7:1.
const AD_IMAGE_MIN_RATIO = 2.0;
const AD_IMAGE_MAX_RATIO = 2.7;

async function adImageShapeProblem(files) {
  for (const file of files) {
    let width = 0;
    let height = 0;
    try {
      const bitmap = await createImageBitmap(file);
      width = bitmap.width;
      height = bitmap.height;
      bitmap.close();
    } catch (err) {
      return `تعذر قراءة الصورة «${file.name}».`;
    }
    const ratio = width / height;
    if (!(ratio >= AD_IMAGE_MIN_RATIO && ratio <= AD_IMAGE_MAX_RATIO)) {
      return `الصورة «${file.name}» عرضها ${width} بكسل وارتفاعها ${height} بكسل. يجب أن تكون أفقية بعرض شاشة الجوال كاملاً وارتفاع بين 160 و180 نقطة: عرضها بين ضعفي ارتفاعها و2.7 ضعفه، مثل عرض 1200 بكسل وارتفاع 540 بكسل.`;
    }
  }
  return '';
}

async function loadAds() {
  const container = document.getElementById('adsList');
  if (!container) return;

  try {
    const response = await adminFetch('/admin/ads');
    const ads = await response.json();

    if (!Array.isArray(ads)) {
      container.innerHTML = '<p class="settings-message error">تعذر تحميل الإعلانات.</p>';
      return;
    }

    adsCache = ads;

    if (ads.length === 0) {
      container.innerHTML = '<p class="settings-message">لا توجد إعلانات بعد. أضف أول إعلان من النموذج أعلاه.</p>';
      return;
    }

    const rows = ads.map((ad) => {
      const firstImage =
        Array.isArray(ad.images) && ad.images.length > 0
          ? ad.images[0]
          : '';

      return `
      <tr>
        <td>${firstImage ? `<img class="ad-thumb" src="${escapeHtml(firstImage)}" alt="">` : ''}<strong>${escapeHtml(ad.title || 'بدون عنوان')}</strong><br><small>${escapeHtml(ad.body || '')}</small></td>
        <td>${escapeHtml(adAudienceLabel(ad.audience))}</td>
        <td>${adStatusBadge(ad.isActive)}</td>
        <td>${escapeHtml(formatAdDate(ad.startsAt))}<br><small>${escapeHtml(formatAdDate(ad.endsAt))}</small>${ad.endsAt ? '' : '<br><span class="ad-ends-warning">بدون تاريخ نهاية — عدّله وأضف تاريخاً</span>'}<br><small>عند الضغط: ${escapeHtml(adLinkLabel(ad.link))}</small><br><small>العدّاد: ${ad.showCountdown ? 'ظاهر' : 'مخفي'}</small></td>
        <td>${escapeHtml(String(ad.sortOrder))}</td>
        <td>
          <div class="table-actions">
            <button class="action-btn info" data-admin-capability="${escapeHtml(adminActionCapability || '')}" data-admin-action="editAd" data-admin-arg-count="1" data-admin-arg-1="${escapeHtml(String(ad._id))}">تعديل</button>
            <button class="action-btn ${ad.isActive ? 'warning' : 'success'}" data-admin-capability="${escapeHtml(adminActionCapability || '')}" data-admin-action="toggleAd" data-admin-arg-count="1" data-admin-arg-1="${escapeHtml(String(ad._id))}">${ad.isActive ? 'إيقاف' : 'تفعيل'}</button>
            <button class="action-btn info" data-admin-capability="${escapeHtml(adminActionCapability || '')}" data-admin-action="toggleAdCountdown" data-admin-arg-count="1" data-admin-arg-1="${escapeHtml(String(ad._id))}">${ad.showCountdown ? 'إخفاء العدّاد' : 'إظهار العدّاد'}</button>
            <button class="action-btn danger" data-admin-capability="${escapeHtml(adminActionCapability || '')}" data-admin-action="deleteAd" data-admin-arg-count="1" data-admin-arg-1="${escapeHtml(String(ad._id))}">حذف</button>
          </div>
        </td>
      </tr>
    `;
    }).join('');

    container.innerHTML = `
      <h3><i class="fas fa-rectangle-ad"></i> كل الإعلانات</h3>
      <table class="commissions-table">
        <thead>
          <tr>
            <th>الإعلان</th>
            <th>الجهة</th>
            <th>الحالة</th>
            <th>الفترة</th>
            <th>الترتيب</th>
            <th>إجراءات</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  } catch (err) {
    container.innerHTML = '<p class="settings-message error">تعذر تحميل الإعلانات.</p>';
  }
}

function editAd(id) {
  const ad = adsCache.find((item) => String(item._id) === String(id));
  if (!ad) return;

  document.getElementById('adForm').dataset.editingId = String(ad._id);
  document.getElementById('adTitle').value = ad.title || '';
  document.getElementById('adImages').value = '';
  document.getElementById('adBody').value = ad.body || '';
  document.getElementById('adAudience').value = ad.audience || 'all';
  document.getElementById('adStartsAt').value = toDateTimeLocal(ad.startsAt);
  document.getElementById('adEndsAt').value = toDateTimeLocal(ad.endsAt);
  document.getElementById('adSortOrder').value = String(ad.sortOrder || 0);
  document.getElementById('adIsActive').value = ad.isActive ? 'true' : 'false';
  document.getElementById('adShowCountdown').value = ad.showCountdown ? 'true' : 'false';
  setAdLinkForm(ad.link);

  setAdFormMessage(
    `أنت تعدّل إعلاناً موجوداً${Array.isArray(ad.images) && ad.images.length > 0 ? ` (${ad.images.length} صورة حالية)` : ''}. اضغط حفظ الإعلان لتحديثه.`,
    'success',
  );
  document.getElementById('page-ads').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function deleteAd(id) {
  if (!await adminConfirm('هل تريد حذف هذا الإعلان نهائياً؟')) return;

  try {
    const response = await adminFetch(`/admin/ads/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    const data = await response.json();

    if (!data.success) {
      adminAlert(data.message || 'تعذر حذف الإعلان');
      return;
    }

    resetAdForm();
    loadAds();
  } catch (err) {
    adminAlert('حدث خطأ في الاتصال');
  }
}

async function toggleAdCountdown(id) {
  const ad = adsCache.find((item) => String(item._id) === String(id));
  if (!ad) return;

  try {
    const response = await adminFetch(`/admin/ads/${encodeURIComponent(id)}/countdown`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ showCountdown: !ad.showCountdown }),
    });
    const data = await response.json();

    if (!data.success) {
      adminAlert(data.message || 'تعذر تغيير العدّاد');
      return;
    }

    loadAds();
  } catch (err) {
    adminAlert('حدث خطأ في الاتصال');
  }
}

async function toggleAd(id) {
  const ad = adsCache.find((item) => String(item._id) === String(id));
  if (!ad) return;

  try {
    const response = await adminFetch(`/admin/ads/${encodeURIComponent(id)}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !ad.isActive }),
    });
    const data = await response.json();

    if (!data.success) {
      adminAlert(data.message || 'تعذر تغيير حالة الإعلان');
      return;
    }

    loadAds();
  } catch (err) {
    adminAlert('حدث خطأ في الاتصال');
  }
}

async function saveAd(event) {
  event.preventDefault();

  const title = document.getElementById('adTitle').value.trim();
  const body = document.getElementById('adBody').value.trim();
  const imageFiles = Array.from(document.getElementById('adImages').files || []);
  const audience = document.getElementById('adAudience').value;
  const startsAtValue = document.getElementById('adStartsAt').value;
  const endsAtValue = document.getElementById('adEndsAt').value;
  const sortOrder = Number(document.getElementById('adSortOrder').value || 0);
  const isActive = document.getElementById('adIsActive').value === 'true';

  const editingId = document.getElementById('adForm').dataset.editingId || '';
  const existingAd = adsCache.find((item) => String(item._id) === String(editingId));
  const existingImageCount = Array.isArray(existingAd?.images)
    ? existingAd.images.length
    : 0;

  if (imageFiles.length > 5) {
    setAdFormMessage('يمكن رفع 5 صور كحد أقصى للإعلان.', 'error');
    return;
  }

  if (!title && !body && imageFiles.length === 0 && existingImageCount === 0) {
    setAdFormMessage('أضف عنواناً أو نصاً أو صورة واحدة على الأقل.', 'error');
    return;
  }

  if (!endsAtValue) {
    setAdFormMessage('حدد تاريخ نهاية الإعلان؛ يتوقف ظهوره في التطبيق عنده.', 'error');
    return;
  }

  if (startsAtValue && endsAtValue && new Date(endsAtValue) <= new Date(startsAtValue)) {
    setAdFormMessage('تاريخ النهاية يجب أن يكون بعد تاريخ البداية.', 'error');
    return;
  }

  const link = adLinkFromForm();
  if (link === null) return;

  const shapeProblem = await adImageShapeProblem(imageFiles);
  if (shapeProblem) {
    setAdFormMessage(shapeProblem, 'error');
    return;
  }

  const payload = new FormData();
  payload.append('title', title);
  payload.append('body', body);
  payload.append('audience', audience);
  payload.append('isActive', isActive ? 'true' : 'false');
  payload.append('sortOrder', String(sortOrder));
  payload.append(
    'startsAt',
    startsAtValue ? new Date(startsAtValue).toISOString() : '',
  );
  payload.append(
    'endsAt',
    endsAtValue ? new Date(endsAtValue).toISOString() : '',
  );
  payload.append('link', link);
  payload.append(
    'showCountdown',
    document.getElementById('adShowCountdown').value === 'true' ? 'true' : 'false',
  );
  imageFiles.forEach((file) => payload.append('images', file));

  try {
    const response = await adminFetch(
      editingId
        ? `/admin/ads/${encodeURIComponent(editingId)}`
        : '/admin/ads',
      {
        method: editingId ? 'PUT' : 'POST',
        body: payload,
      },
    );
    const data = await response.json();

    if (!data.success) {
      setAdFormMessage(data.message || 'تعذر حفظ الإعلان.', 'error');
      return;
    }

    resetAdForm();
    document.getElementById('adForm').dataset.editingId = '';
    loadAds();
    setAdFormMessage('تم حفظ الإعلان بنجاح.', 'success');
  } catch (err) {
    setAdFormMessage('تعذر حفظ الإعلان.', 'error');
  }
}

const adForm = document.getElementById('adForm');
if (adForm) {
  adForm.addEventListener('submit', saveAd);
}

const adLinkTypeInput = document.getElementById('adLinkType');
if (adLinkTypeInput) {
  adLinkTypeInput.addEventListener('change', syncAdLinkFields);
}

const adStatsDaysInput = document.getElementById('adStatsDays');
if (adStatsDaysInput) {
  adStatsDaysInput.addEventListener('change', () => loadAdStats());
}

// ---- Ads tracking tab ----
function showAdTab(tab) {
  const tracking = tab === 'tracking';
  const manageTab = document.getElementById('adTabManage');
  const trackingTab = document.getElementById('adTabTracking');
  document.getElementById('adManagePanel').hidden = tracking;
  document.getElementById('adTrackingPanel').hidden = !tracking;
  manageTab.classList.toggle('active', !tracking);
  trackingTab.classList.toggle('active', tracking);
  manageTab.setAttribute('aria-selected', String(!tracking));
  trackingTab.setAttribute('aria-selected', String(tracking));
  if (tracking) loadAdStats();
}

function formatAdCount(value) {
  return Number(value || 0).toLocaleString('ar-EG');
}

function adStatCard(label, value, hint = '') {
  return `<div class="ad-stat-card"><span class="label">${escapeHtml(label)}</span><span class="value ad-stats-num">${escapeHtml(value)}</span>${hint ? `<span class="hint">${escapeHtml(hint)}</span>` : ''}</div>`;
}

function adStatsDays() {
  return document.getElementById('adStatsDays')?.value || '7';
}

async function loadAdStats() {
  const totalsBox = document.getElementById('adStatsTotals');
  const list = document.getElementById('adStatsList');
  const daily = document.getElementById('adStatsDaily');
  if (!totalsBox || !list) return;
  if (daily) daily.hidden = true;

  try {
    const response = await adminFetch(`/admin/ads/stats?days=${encodeURIComponent(adStatsDays())}`);
    const data = await response.json();
    if (!data.success) throw new Error('stats');

    const totals = data.totals || {};
    totalsBox.innerHTML = [
      adStatCard('المشاهدات', formatAdCount(totals.impressions), `${formatAdCount(totals.viewers)} مستخدم`),
      adStatCard('الضغطات', formatAdCount(totals.taps), `${formatAdCount(totals.tappers)} مستخدم`),
      adStatCard('نسبة الضغط', `${Number(totals.ctr || 0).toLocaleString('ar-EG')}%`, 'من شاهدوا الإعلان ثم ضغطوا عليه'),
      adStatCard('الفترة', document.getElementById('adStatsDays')?.selectedOptions?.[0]?.textContent || '', data.fromDay === data.toDay ? data.toDay : `من ${data.fromDay} إلى ${data.toDay}`),
    ].join('');

    const ads = Array.isArray(data.ads) ? data.ads : [];
    if (ads.length === 0) {
      list.innerHTML = '<p class="settings-message">لا توجد إعلانات بعد.</p>';
      return;
    }

    const rows = ads.map((ad) => `
      <tr>
        <td>${ad.image ? `<img class="ad-thumb" src="${escapeHtml(ad.image)}" alt="">` : ''}<strong>${escapeHtml(ad.title || 'بدون عنوان')}</strong><br>${adStatusBadge(ad.isActive)} <small>ينتهي: ${escapeHtml(formatAdDate(ad.endsAt))}</small></td>
        <td class="ad-stats-num">${escapeHtml(formatAdCount(ad.impressions))}<br><small>${escapeHtml(formatAdCount(ad.viewers))} مستخدم</small></td>
        <td class="ad-stats-num">${escapeHtml(formatAdCount(ad.taps))}<br><small>${escapeHtml(formatAdCount(ad.tappers))} مستخدم</small></td>
        <td class="ad-stats-num">${escapeHtml(Number(ad.ctr || 0).toLocaleString('ar-EG'))}%</td>
        <td><button class="action-btn info" data-admin-capability="${escapeHtml(adminActionCapability || '')}" data-admin-action="showAdDaily" data-admin-arg-count="2" data-admin-arg-1="${escapeHtml(String(ad._id))}" data-admin-arg-2="${escapeHtml(ad.title || 'بدون عنوان')}">التفاصيل اليومية</button></td>
      </tr>
    `).join('');

    list.innerHTML = `
      <h3><i class="fas fa-chart-line"></i> أداء كل إعلان</h3>
      <table class="commissions-table">
        <thead>
          <tr>
            <th>الإعلان</th>
            <th>المشاهدات</th>
            <th>الضغطات</th>
            <th>نسبة الضغط</th>
            <th></th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  } catch (err) {
    totalsBox.innerHTML = '';
    list.innerHTML = '<p class="settings-message error">تعذر تحميل بيانات التتبع. حاول مرة أخرى.</p>';
  }
}

async function showAdDaily(id, title) {
  const box = document.getElementById('adStatsDaily');
  if (!box) return;
  box.hidden = false;
  box.innerHTML = '<p>جاري التحميل...</p>';

  try {
    const response = await adminFetch(`/admin/ads/stats/${encodeURIComponent(id)}?days=${encodeURIComponent(adStatsDays())}`);
    const data = await response.json();
    if (!data.success) throw new Error('daily');
    const days = Array.isArray(data.days) ? data.days : [];
    const rows = days.length === 0
      ? '<tr><td colspan="4">لا توجد مشاهدات أو ضغطات في هذه الفترة.</td></tr>'
      : days.map((day) => `
        <tr>
          <td>${escapeHtml(formatDisplayDate(day.day))}</td>
          <td class="ad-stats-num">${escapeHtml(formatAdCount(day.impressions))} <small>(${escapeHtml(formatAdCount(day.viewers))} مستخدم)</small></td>
          <td class="ad-stats-num">${escapeHtml(formatAdCount(day.taps))} <small>(${escapeHtml(formatAdCount(day.tappers))} مستخدم)</small></td>
          <td class="ad-stats-num">${escapeHtml(Number(day.ctr || 0).toLocaleString('ar-EG'))}%</td>
        </tr>`).join('');
    box.innerHTML = `
      <h3><i class="fas fa-calendar-day"></i> التفاصيل اليومية: ${escapeHtml(title || '')}</h3>
      <table class="commissions-table">
        <thead><tr><th>اليوم</th><th>المشاهدات</th><th>الضغطات</th><th>نسبة الضغط</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `;
    box.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (err) {
    box.innerHTML = '<p class="settings-message error">تعذر تحميل التفاصيل اليومية.</p>';
  }
}

const adCancelEdit = document.getElementById('adCancelEdit');
if (adCancelEdit) {
  adCancelEdit.addEventListener('click', () => {
    const form = document.getElementById('adForm');
    if (form) form.dataset.editingId = '';
    resetAdForm();
  });
}

// ================================================
// 18. محادثات الدعم (Real-time)
// ================================================
let supportSocket = null;
let activeChatUserId = null;
let conversations = [];

function initSupportChat() {
  loadConversations();
  if (!supportSocket || !supportSocket.connected) connectSupportSocket();
}

// ================================================
// Live updates: the server sends admin_update { topics } whenever data
// changes; the page on screen (and the sidebar badges) reload at once.
// ================================================
const LIVE_PAGE_LOADERS = {
  dashboard: () => loadDashboardStats(),
  orders: () => loadOrders(),
  drivers: () => loadDriversList(),
  users: () => loadUsersList(),
  commissions: () => loadCommissions(),
  'pending-providers': () => loadPendingProviders(),
  'driver-reports': () => loadDriverReports(),
  'user-reports': () => loadUserReports(),
  'deletion-requests': () => loadDeletionRequests(),
  areas: () => loadAreas(),
  'support-chat': () => loadConversations(),
  'broadcast-drivers': () => loadBroadcastArchive('drivers'),
  'broadcast-users': () => loadBroadcastArchive('users'),
  ads: () => {
    const tracking = document.getElementById('adTrackingPanel');
    if (tracking && !tracking.hidden) loadAdStats();
    else loadAds();
  },
};

// Topics whose changes move the sidebar badges or the main counters.
const LIVE_BADGE_TOPICS = ['dashboard', 'pending-providers', 'driver-reports', 'user-reports', 'deletion-requests'];

let liveTopics = new Set();
let liveConnectedBefore = false;
let liveRefreshTimer = null;

function setLiveStatus(connected) {
  const badge = document.getElementById('liveStatus');
  const text = document.getElementById('liveStatusText');
  if (!badge || !text) return;
  badge.classList.toggle('live-off', !connected);
  text.textContent = connected ? 'مباشر — يتحدث تلقائياً' : 'غير متصل — يعاد الاتصال…';
}

function activePageKey() {
  const page = document.querySelector('.page-section.active-page');
  return page ? page.id.replace(/^page-/, '') : 'dashboard';
}

function applyLiveTopics(topics) {
  if (LIVE_BADGE_TOPICS.some((topic) => topics.has(topic))) {
    loadDashboardStats();
  }
  const page = activePageKey();
  if (page !== 'dashboard' && topics.has(page)) {
    LIVE_PAGE_LOADERS[page]?.();
  }
}

function onAdminUpdate(data) {
  const topics = Array.isArray(data?.topics) ? data.topics : [];
  topics.forEach((topic) => liveTopics.add(String(topic)));
  // Coalesce several updates arriving together into one refresh.
  clearTimeout(liveRefreshTimer);
  liveRefreshTimer = setTimeout(() => {
    const due = liveTopics;
    liveTopics = new Set();
    applyLiveTopics(due);
  }, 300);
}

function connectSupportSocket() {
  if (supportSocket) {
    if (!supportSocket.connected) supportSocket.connect();
    return;
  }

  supportSocket = io({ transports: ['websocket'], withCredentials: true });
  supportSocket.on('connect', () => {
    setLiveStatus(true);
    // After a reconnect, catch up on anything that changed meanwhile (the
    // first connection follows the page's own initial load).
    if (liveConnectedBefore) applyLiveTopics(new Set(Object.keys(LIVE_PAGE_LOADERS)));
    liveConnectedBefore = true;
  });
  supportSocket.on('disconnect', () => setLiveStatus(false));
  supportSocket.on('connect_error', () => setLiveStatus(false));
  supportSocket.on('admin_update', onAdminUpdate);
  supportSocket.on('support_message', (data) => {
    const badge = document.getElementById('chatBadge');
    if (badge) {
      const current = parseInt(badge.textContent || '0');
      badge.textContent = current + 1;
      setInlineDisplay(badge, true);
    }
    if (currentChatTarget && String(currentChatTarget.id) === String(data.userId)) {
      refreshLegacyChat();
    }
    if (document.getElementById('page-support-chat').classList.contains('active-page')) {
      loadConversations();
      if (activeChatUserId === data.userId) appendChatMessage('user', data.text, data.createdAt);
    }
  });
}

document.getElementById('conversationSearchInput')?.addEventListener('input', () => renderConversations());

async function loadConversations() {
  try {
    const res = await adminFetch('/api/chat/admin/conversations');
    conversations = await res.json();
    renderConversations();
    updateSupportBadge();
    adminAlertsReady('chat');
  } catch (err) {
    adminAlertsReady('chat');
    console.error('Load conversations:', err);
  }
}

function updateSupportBadge() {
  const badge = document.getElementById('chatBadge');
  if (!badge) return;

  const total = (conversations || []).reduce(
    (sum, conversation) => sum + (conversation.unread || 0),
    0,
  );

  badge.textContent = String(total);
  setInlineDisplay(badge, total > 0);
}

function renderConversations() {
  const container = document.getElementById('chatConversations');
  const status = document.getElementById('conversationSearchStatus');
  const query = document.getElementById('conversationSearchInput')?.value || '';

  if (!conversations || conversations.length === 0) {
    container.innerHTML = '<p data-presentation="p006">لا توجد محادثات حالياً</p>';
    if (status) status.textContent = '';
    return;
  }

  const shown = conversations.filter((conversation) => accountMatches({
    name: conversation.userName,
    publicId: conversation.userPublicId,
    email: conversation.userEmail,
    phones: conversation.userPhones,
  }, query));
  if (status) {
    status.textContent = query.trim()
      ? `${shown.length} من ${conversations.length} محادثة تطابق البحث.`
      : '';
  }

  container.innerHTML = '';
  if (shown.length === 0) {
    container.innerHTML = '<p data-presentation="p006">لا توجد محادثة تطابق البحث.</p>';
    return;
  }

  shown.forEach((conversation) => {
    const userId = String(conversation.userId || '');
    const userName = conversation.userName || 'Unknown';
    const initial = (userName || 'U')[0].toUpperCase();

    let role = 'مستخدم';
    if (conversation.userRole === 'provider') role = 'سائق';
    if (conversation.userRole === 'guest') role = 'زائر';

    const item = document.createElement('div');
    item.className =
      `conv-item ${activeChatUserId === userId ? 'active' : ''}`;

    const avatar = document.createElement('div');
    avatar.className = 'conv-avatar';
    avatar.textContent = initial;

    const info = document.createElement('div');
    info.className = 'conv-info';

    const name = document.createElement('div');
    name.className = 'conv-name';
    name.textContent = userName;

    const preview = document.createElement('div');
    preview.className = 'conv-preview';
    preview.textContent = conversation.lastMessage || '';

    info.appendChild(name);
    info.appendChild(preview);

    item.appendChild(avatar);
    item.appendChild(info);

    if ((conversation.unread || 0) > 0) {
      const badge = document.createElement('div');
      badge.className = 'conv-badge';
      badge.textContent = String(conversation.unread);
      item.appendChild(badge);
    }

    item.addEventListener('click', () => {
      openSupportChat(
        userId,
        userName,
        conversation.userPublicId || '',
        role,
      );
    });

    container.appendChild(item);
  });
}

async function openSupportChat(
  userId,
  userName,
  userPublicId,
  role,
) {
  activeChatUserId = userId;
  renderConversations();

  const windowEl = document.getElementById('chatWindow');
  const isPublicContact = userId.startsWith('contact:');

  windowEl.innerHTML = isPublicContact
    ? `
      <div class="chat-header">
        <i class="fas fa-user-circle"></i>
        <span id="chatHeaderIdentity"></span>
        <button id="resolveChatButton" data-presentation="p031">
          <i class="fas fa-check"></i> حل المشكلة
        </button>
      </div>
      <div class="chat-messages" id="chatMessagesArea">
        <p data-presentation="p006">جاري التحميل...</p>
      </div>
      <p class="guest-reply-note">
        زائر غير مسجل — يصله ردك داخل التطبيق في نافذة "التواصل مع الدعم"، وعلى بريده الإلكتروني إن كان قد كتبه.
      </p>
      <div class="chat-input-area">
        <input
          type="text"
          id="adminChatInput"
          placeholder="اكتب ردك للزائر..."
        >
        <button id="adminChatSendButton">
          <i class="fas fa-paper-plane"></i> إرسال
        </button>
      </div>
    `
    : `
      <div class="chat-header">
        <i class="fas fa-user-circle"></i>
        <span id="chatHeaderIdentity"></span>
        <button id="resolveChatButton" data-presentation="p031">
          <i class="fas fa-check"></i> حل المشكلة
        </button>
      </div>
      <div class="chat-messages" id="chatMessagesArea">
        <p data-presentation="p006">جاري التحميل...</p>
      </div>
      <div class="chat-input-area">
        <input
          type="text"
          id="adminChatInput"
          placeholder="اكتب ردك..."
        >
        <button id="adminChatSendButton">
          <i class="fas fa-paper-plane"></i> إرسال
        </button>
      </div>
    `;

  const identity =
    document.getElementById('chatHeaderIdentity');

  if (identity) {
    const publicIdText =
      userPublicId ? ` ID ${userPublicId}` : '';

    identity.textContent =
      `${userName}${publicIdText} (${role})`;
  }

  const resolveButton =
    document.getElementById('resolveChatButton');

  if (resolveButton) {
    resolveButton.addEventListener(
      'click',
      () => resolveChat(userId),
    );
  }

  {
    const input =
      document.getElementById('adminChatInput');

    const sendButton =
      document.getElementById('adminChatSendButton');

    if (input) {
      input.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
          sendAdminReply();
        }
      });
    }

    if (sendButton) {
      sendButton.addEventListener(
        'click',
        () => sendAdminReply(),
      );
    }
  }

  loadChatMessages(userId);
}

async function loadChatMessages(userId) {
  try {
    const res = await adminFetch(`/api/chat/admin/messages/${userId}`);
    const messages = await res.json();
    const area = document.getElementById('chatMessagesArea');
    area.innerHTML = '';
    messages.forEach(m => appendChatMessage(m.sender, m.text, m.createdAt));
    area.scrollTop = area.scrollHeight;

    const readRes = await adminFetch(
      `/api/chat/admin/messages/${userId}/read`,
      {
        method: 'POST',
      },
    );

    if (!readRes.ok) {
      console.error(
        `Mark-read failed with HTTP ${readRes.status}`,
      );
    } else {
      loadConversations();
    }
  } catch (err) { console.error(err); }
}

function appendChatMessage(sender, text, time) {
  const area = document.getElementById('chatMessagesArea');
  if (!area) return;

  const div = document.createElement('div');
  div.className = `chat-msg ${sender}`;

  const body = document.createElement('div');
  body.className = 'chat-text';
  body.textContent = text || '';

  const timeEl = document.createElement('div');
  timeEl.className = 'chat-time';
  timeEl.textContent = time ? formatDisplayTime(time) : '';

  div.appendChild(body);
  div.appendChild(timeEl);

  area.appendChild(div);
  area.scrollTop = area.scrollHeight;
}

async function sendAdminReply() {
  const input =
    document.getElementById('adminChatInput');

  if (!input || !activeChatUserId) {
    return;
  }

  const text = input.value.trim();
  if (!text) return;

  input.value = '';

  try {
    const res = await adminFetch(
      `/api/chat/admin/reply/${activeChatUserId}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
      },
    );

    if (!res.ok) {
      throw new Error(
        `Reply failed with HTTP ${res.status}`,
      );
    }

    appendChatMessage(
      'admin',
      text,
      new Date().toISOString(),
    );
    loadConversations();
  } catch (err) {
    console.error(err);
  }
}

async function resolveChat(userId) {
  if (!await adminConfirm('هل أنت متأكد من حل هذه المشكلة؟ سيتم حذف جميع رسائل هذه المحادثة.')) return;
  try {
    await adminFetch(`/api/chat/admin/resolve/${userId}`, { method: 'DELETE' });
    activeChatUserId = null;
    document.getElementById('chatWindow').innerHTML = '<div class="chat-empty-state"><i class="fas fa-check-circle" data-presentation="p033"></i><p data-presentation="p008">تم حل المشكلة بنجاح</p></div>';
    loadConversations();
    setInlineDisplay(document.getElementById('chatBadge'), false);
    document.getElementById('chatBadge').textContent = '0';
  } catch (err) { console.error(err); }
}

// Dates are shown as numbers everywhere: DD/MM/YYYY, plus HH:mm when the
// time matters. Values that are not dates (e.g. "غير محدد") are shown as is.
function toDisplayDateValue(value) {
  if (value instanceof Date) return value;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  return new Date(value);
}

function escapeHtml(value) {
  return String(
    value ?? '',
  )
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ================================================
// 19. طلبات تسجيل السائقين
// ================================================
function providerServiceTypesLabel(types) {
  const labels = {
    product: 'توصيل منتجات',
    people: 'توصيل ركاب',
    goods: 'نقل بضائع',
  };
  const values = Array.isArray(types) ? types : [];
  if (values.length === 0 || values.length === 3) {
    return 'جميع الخدمات';
  }
  return values.map((type) => labels[type] || type).join(' + ');
}

async function loadPendingProviders() {
  try {
    const res =
      await adminFetch(
        '/admin/drivers/pending',
      );

    const pending =
      await res.json();

    const badge =
      document.getElementById(
        'pendingBadge',
      );

    badge.textContent =
      pending.length;

    setInlineDisplay(
      badge,
      pending.length > 0,
    );

    if (pending.length === 0) {
      document
        .getElementById(
          'pendingProvidersContent',
        )
        .innerHTML =
          '<p data-presentation="p006">'
          + 'لا توجد طلبات تسجيل جديدة'
          + '</p>';

      return;
    }

    const reviewedPending =
      await Promise.all(
        pending.map(
          async (provider) => {
            try {
              const documentsResponse =
                await adminFetch(
                  `/admin/drivers/pending/${
                    encodeURIComponent(
                      String(
                        provider._id,
                      ),
                    )
                  }/documents`,
                );

              if (
                !documentsResponse.ok
              ) {
                return {
                  ...provider,
                  documentReview: {
                    documents: [],
                    complete: false,
                    unavailable: true,
                  },
                };
              }

              const documentReview =
                await documentsResponse.json();

              return {
                ...provider,
                documentReview: {
                  ...documentReview,
                  unavailable: false,
                },
              };
            } catch (_) {
              return {
                ...provider,
                documentReview: {
                  documents: [],
                  complete: false,
                  unavailable: true,
                },
              };
            }
          },
        ),
      );

    let rows = '';

    reviewedPending.forEach(
      (provider) => {
        const review =
          provider.documentReview
          || {
            documents: [],
            complete: false,
            unavailable: true,
          };

        const licenseWaived =
          provider.licenseNotAvailable === true
          || review.licenseNotAvailable === true;
        const canApprove = true;

        const documentStatusText =
          licenseWaived
            ? 'لا يملك رخصة'
            : (
                review.unavailable
                  ? 'لا توجد وثائق'
                  : (
                      review.complete
                        ? 'مكتملة'
                        : 'لا توجد وثائق مرفقة'
                    )
              );

        const statusClass =
          canApprove
            ? 'paid-badge'
            : 'unpaid-badge';

        const approveButton =
          canApprove
            ? (
                `<button class="action-btn success" `
                + `data-admin-capability="${escapeHtml(adminActionCapability || '')}" data-admin-action="approveProvider" `
                + `data-admin-arg-count="1" `
                + `data-admin-arg-1="${escapeHtml(String(provider._id))}" `
                + `data-presentation="p034">`
                + `<i class="fas fa-check"></i> قبول`
                + `</button>`
              )
            : (
                `<button class="action-btn success" `
                + `type="button" disabled `
                + `title="يجب اكتمال رخصة القيادة قبل القبول أو اختيار تسجيل بدون رخصة" `
                + `data-presentation="p034">`
                + `<i class="fas fa-check"></i> قبول`
                + `</button>`
              );

        rows +=
          `<tr>`
          + `<td><strong>${escapeHtml(provider.fullName)}</strong></td>`
          + `<td>${escapeHtml(provider.email)}</td>`
          + `<td>${escapeHtml(provider.phone)}</td>`
          + `<td>${escapeHtml(providerServiceTypesLabel(provider.serviceTypes))}</td>`
          + `<td>${escapeHtml(provider.governorate || 'غير محدد')}</td>`
          + `<td>${escapeHtml(provider.city || provider.area || 'غير محدد')}</td>`
          + `<td>${escapeHtml(formatDisplayDate(provider.createdAt))}</td>`
          + timeCell(provider.createdAt)
          + `<td><span class="${statusClass}">${escapeHtml(documentStatusText)}</span></td>`
          + `<td>`
          + `<button class="action-btn info" `
          + `data-admin-capability="${escapeHtml(adminActionCapability || '')}" data-admin-action="viewPendingProviderDocuments" `
          + `data-admin-arg-count="2" `
          + `data-admin-arg-1="${escapeHtml(String(provider._id))}" `
          + `data-admin-arg-2="${escapeHtml(String(provider.fullName || ''))}" `
          + `data-presentation="p034">`
          + `<i class="fas fa-file-alt"></i> مراجعة الوثائق`
          + `</button>`
          + approveButton
          + `<button class="action-btn danger" `
          + `data-admin-capability="${escapeHtml(adminActionCapability || '')}" data-admin-action="rejectProvider" `
          + `data-admin-arg-count="1" `
          + `data-admin-arg-1="${escapeHtml(String(provider._id))}" `
          + `data-presentation="p034">`
          + `<i class="fas fa-times"></i> رفض`
          + `</button>`
          + `</td>`
          + `</tr>`;
      },
    );

    document
      .getElementById(
        'pendingProvidersContent',
      )
      .innerHTML =
        `<div class="commissions-table-container">`
        + `<h3>قائمة طلبات التسجيل</h3>`
        + `<table class="commissions-table">`
        + `<thead><tr>`
        + `<th>الاسم</th>`
        + `<th>البريد</th>`
        + `<th>الجوال</th>`
        + `<th>نوع الخدمة</th>`
        + `<th>المحافظة</th>`
        + `<th>المدينة / القرية</th>`
        + `<th>تاريخ التسجيل</th>`
        + `<th>وقت التسجيل</th>`
        + `<th>الوثائق</th>`
        + `<th>الإجراءات</th>`
        + `</tr></thead>`
        + `<tbody>${rows}</tbody>`
        + `</table>`
        + `</div>`;
  } catch (err) {
    console.error(
      'Error loading pending providers:',
      err,
    );
  }
}

async function approveProvider(id) {
  try {
    const encodedId =
      encodeURIComponent(
        String(id),
      );

    // Driver document upload was removed from the mobile app, so new
    // applicants have no documents and the review list always enables
    // "Approve". Documents of older applicants can still be opened from the
    // review button; they no longer gate approval.
    if (
      !await adminConfirm(
        'هل أنت متأكد من قبول طلب هذا السائق؟',
      )
    ) {
      return;
    }

    const res =
      await adminFetch(
        `/admin/drivers/pending/${encodedId}/approve`,
        {
          method: 'POST',
        },
      );

    const data =
      await res.json();

    if (data.success) {
      adminAlert(data.message);
      loadPendingProviders();
      loadDashboardStats();
    } else {
      adminAlert(
        data.message
        || 'تعذر قبول المزود',
      );
    }
  } catch (_) {
    adminAlert('حدث خطأ');
  }
}

async function rejectProvider(id) {
  if (!await adminConfirm('هل أنت متأكد من رفض طلب هذا السائق؟')) return;
  try {
    const res = await adminFetch(`/admin/drivers/pending/${id}/reject`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      adminAlert(data.message);
      loadPendingProviders();
    } else {
      adminAlert(data.message);
    }
  } catch (err) { adminAlert('حدث خطأ'); }
}

document.addEventListener('DOMContentLoaded', () => {
  loadDashboardStats();
  loadCommissions();
  loadAreasForDropdown();
  initSupportChat();
});

let adminAreasByGovernorate = {};

async function loadAreasForDropdown() {
  try {
    const res = await adminFetch('/data/areas.json');
    const data = await res.json();
    const states = Array.isArray(data.states) ? data.states : [];
    const governorateSelect = document.getElementById('driverGovernorateSelect');
    const areaSelect = document.getElementById('driverAreaSelect');
    if (!governorateSelect || !areaSelect) return;

    adminAreasByGovernorate = Object.fromEntries(
      states.map((state) => [
        state.name,
        Array.isArray(state.cities) ? state.cities : [],
      ]),
    );

    const groups = {
      'الضفة الغربية': ['القدس','رام الله والبيرة','الخليل','نابلس','بيت لحم','أريحا','سلفيت','جنين','طولكرم','قلقيلية','طوباس'],
      'قطاع غزة': ['غزة','خان يونس','رفح','دير البلح','شمال غزة'],
      'الداخل المحتل': ['حيفا','عكا','الناصرة','يافا'],
    };

    governorateSelect.innerHTML = '<option value="">اختر المحافظة...</option>';
    for (const [groupLabel, groupAreas] of Object.entries(groups)) {
      const optgroup = document.createElement('optgroup');
      optgroup.label = groupLabel;
      for (const name of groupAreas) {
        if (!adminAreasByGovernorate[name]) continue;
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        optgroup.appendChild(option);
      }
      governorateSelect.appendChild(optgroup);
    }

    const populateCities = () => {
      const governorate = governorateSelect.value;
      areaSelect.innerHTML = '<option value="">اختر القرية أو المدينة...</option>';

      if (!governorate) {
        areaSelect.disabled = true;
        return;
      }

      areaSelect.disabled = false;
      const itself = document.createElement('option');
      itself.value = governorate;
      itself.textContent = `من ${governorate} نفسها`;
      areaSelect.appendChild(itself);

      for (const city of adminAreasByGovernorate[governorate] || []) {
        const option = document.createElement('option');
        option.value = city;
        option.textContent = city;
        areaSelect.appendChild(option);
      }
    };

    if (governorateSelect.dataset.changeBound !== '1') {
      governorateSelect.dataset.changeBound = '1';
      governorateSelect.addEventListener('change', populateCities);
    }

    governorateSelect.value = '';
    populateCities();
  } catch (_) {}
}
