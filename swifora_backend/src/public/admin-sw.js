// Swifora dashboard service worker: shows the alerts the server sends
// (Web Push, see services/adminAlerts.js) while the dashboard is closed or
// in the background, and opens the right page when one is clicked.
// It does not cache or intercept any request.

const PAGE_NAME = /^[a-z][a-z-]{0,40}$/;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

function readMessage(event) {
  try {
    const data = event.data ? event.data.json() : {};
    return data && typeof data === 'object' ? data : {};
  } catch (_) {
    return {};
  }
}

// Chromium browsers accept a push without a notification while the site is
// on screen; Safari and Firefox count that against the site, so they always
// get the notification.
function mayStayQuiet() {
  const ua = self.navigator.userAgent || '';
  return /Chrome\/|Chromium\/|Edg\//.test(ua) && !/iPhone|iPad|iPod/.test(ua);
}

self.addEventListener('push', (event) => {
  const data = readMessage(event);
  const title = typeof data.title === 'string' && data.title ? data.title : 'سويفورا — تنبيه جديد';
  const body = typeof data.body === 'string' ? data.body : '';
  const page = typeof data.page === 'string' && PAGE_NAME.test(data.page) ? data.page : 'dashboard';
  const tag = typeof data.tag === 'string' && data.tag ? data.tag : 'swifora-admin';

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const watching = windows.some((client) => client.focused && client.visibilityState === 'visible');
    // The open dashboard already shows it (title, icon, sound).
    if (watching && mayStayQuiet()) return;
    await self.registration.showNotification(title, {
      body,
      tag,
      renotify: true,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      lang: 'ar',
      dir: 'rtl',
      data: { page },
    });
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const wanted = event.notification.data && event.notification.data.page;
  const page = typeof wanted === 'string' && PAGE_NAME.test(wanted) ? wanted : 'dashboard';

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const dashboard = windows.find((client) => new URL(client.url).pathname === '/admin');
    if (dashboard) {
      await dashboard.focus();
      dashboard.postMessage({ type: 'swifora-open-page', page });
      return;
    }
    await self.clients.openWindow(`/admin#${page}`);
  })());
});
