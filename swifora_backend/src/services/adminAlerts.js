// Dashboard alerts sent as Web Push to the admins' browsers, so a new
// support message, driver sign-up, report or deletion request is noticed
// even while the dashboard is closed. The open dashboard shows its own
// alerts (tab title, icon, sound) from the live updates.
//
// Turned on by WEB_PUSH_VAPID_PUBLIC_KEY and WEB_PUSH_VAPID_PRIVATE_KEY
// (generate once with `npx web-push generate-vapid-keys`); without them
// nothing is sent and the dashboard offers only the in-page alerts.
//
// The messages carry no personal data: only what kind of item arrived.
const webPush = require('web-push');
const Admin = require('../models/Admin');
const AdminPushSubscription = require('../models/AdminPushSubscription');

const KINDS = Object.freeze({
  support: { title: 'رسالة دعم جديدة', body: 'وصلت رسالة جديدة إلى محادثات الدعم.', page: 'support-chat' },
  'pending-driver': { title: 'سائق جديد ينتظر الموافقة', body: 'وصل طلب تسجيل سائق جديد.', page: 'pending-providers' },
  'driver-report': { title: 'بلاغ جديد عن سائق', body: 'وصل بلاغ جديد عن سائق.', page: 'driver-reports' },
  'user-report': { title: 'بلاغ جديد عن زبون', body: 'وصل بلاغ جديد عن زبون.', page: 'user-reports' },
  'deletion-request': { title: 'طلب حذف حساب جديد', body: 'وصل طلب جديد لحذف حساب.', page: 'deletion-requests' },
  // "Try the alert" in the dashboard: only to the admin who pressed it.
  test: { title: 'تجربة تنبيه سويفورا', body: 'التنبيهات تعمل على هذا الجهاز.', page: 'dashboard' },
});

// One alert of a kind at most this often: a burst of chat messages makes
// one notification, not ten.
const COOLDOWN_MS = 15 * 1000;
// A message waits at most an hour for a device that is offline.
const TTL_SECONDS = 60 * 60;

// The browsers' own push services. A subscription pointing anywhere else
// is refused, so the server never posts to an address chosen by a client.
const PUSH_SERVICE_HOSTS = [
  'fcm.googleapis.com',
  'android.googleapis.com',
  'updates.push.services.mozilla.com',
  'web.push.apple.com',
];
const PUSH_SERVICE_HOST_SUFFIXES = ['.notify.windows.com', '.push.apple.com'];

const lastSentAt = new Map();
let sender = null;
let configuredKey = null;

function vapidConfig() {
  const publicKey = String(process.env.WEB_PUSH_VAPID_PUBLIC_KEY || '').trim();
  const privateKey = String(process.env.WEB_PUSH_VAPID_PRIVATE_KEY || '').trim();
  const subject = String(process.env.WEB_PUSH_SUBJECT || '').trim() || 'https://swifora.com';
  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey, subject };
}

/** The key browsers subscribe with, or '' when alerts are not set up. */
function publicKey() {
  return vapidConfig()?.publicKey || '';
}

function isConfigured() {
  return Boolean(vapidConfig());
}

function isAllowedPushEndpoint(value) {
  if (typeof value !== 'string' || value.length > 2048) return false;
  let url;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) return false;
  const host = url.hostname.toLowerCase();
  return PUSH_SERVICE_HOSTS.includes(host)
    || PUSH_SERVICE_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix));
}

function defaultSender() {
  const config = vapidConfig();
  if (!config) return null;
  const key = `${config.publicKey}|${config.privateKey}|${config.subject}`;
  if (configuredKey !== key) {
    webPush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
    configuredKey = key;
  }
  return (subscription, payload, options) =>
    webPush.sendNotification(subscription, payload, options);
}

/**
 * Tells every active admin's subscribed devices (or only [adminId]'s) that
 * an item of [kind] arrived. Never throws; callers do not wait for it.
 */
async function notifyAdmins(kind, { now = Date.now(), adminId = null } = {}) {
  const message = KINDS[kind];
  if (!message) return { sent: 0 };
  const send = sender || defaultSender();
  if (!send) return { sent: 0 };
  const cooldownKey = `${kind}:${adminId || 'all'}`;
  if (now - (lastSentAt.get(cooldownKey) || 0) < COOLDOWN_MS) return { sent: 0, throttled: true };
  lastSentAt.set(cooldownKey, now);

  try {
    const who = { role: 'admin', status: 'active', deleted: { $ne: true } };
    if (adminId) who._id = adminId;
    const admins = await Admin.find(who)
      .select('_id sessionVersion')
      .lean();
    const versions = new Map(admins.map((admin) => [String(admin._id), Number(admin.sessionVersion) || 0]));
    const subscriptions = await AdminPushSubscription.find({ adminId: { $in: [...versions.keys()] } }).lean();
    const current = subscriptions.filter(
      (sub) => versions.get(String(sub.adminId)) === (Number(sub.sessionVersion) || 0),
    );

    const payload = JSON.stringify({ kind, tag: `swifora-admin-${kind}`, ...message });
    const options = { TTL: TTL_SECONDS, urgency: 'high', topic: kind.replace(/[^A-Za-z0-9_-]/g, '') };
    const results = await Promise.all(current.map(async (sub) => {
      try {
        await send({ endpoint: sub.endpoint, keys: sub.keys }, payload, options);
        return { id: sub._id, ok: true };
      } catch (error) {
        // 404/410: the browser dropped this subscription; forget it.
        const gone = error?.statusCode === 404 || error?.statusCode === 410;
        return { id: sub._id, ok: false, gone };
      }
    }));

    const gone = results.filter((r) => r.gone).map((r) => r.id);
    const delivered = results.filter((r) => r.ok).map((r) => r.id);
    await Promise.all([
      gone.length ? AdminPushSubscription.deleteMany({ _id: { $in: gone } }) : null,
      delivered.length
        ? AdminPushSubscription.updateMany({ _id: { $in: delivered } }, { $set: { lastSentAt: new Date(now) } })
        : null,
    ]);
    return { sent: delivered.length, removed: gone.length };
  } catch (error) {
    console.error('Admin alert push failed:', error?.message || 'unknown error');
    return { sent: 0 };
  }
}

/** Fire-and-forget form for route handlers. */
function alertAdmins(kind) {
  notifyAdmins(kind).catch(() => {});
}

function setSenderForTesting(fn) {
  sender = fn;
}

function resetForTesting() {
  sender = null;
  lastSentAt.clear();
}

module.exports = {
  KINDS,
  COOLDOWN_MS,
  alertAdmins,
  isAllowedPushEndpoint,
  isConfigured,
  notifyAdmins,
  publicKey,
  resetForTesting,
  setSenderForTesting,
};
