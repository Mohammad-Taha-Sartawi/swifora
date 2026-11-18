const Notification = require('../models/Notification');

/**
 * What the apps show in the notifications screen: the latest
 * NOTIFICATION_LIST_LIMIT notifications from the last
 * NOTIFICATION_MAX_AGE_DAYS days. Older ones and ones past the limit are
 * hidden, and the unread badge counts only what is shown.
 */
const NOTIFICATION_MAX_AGE_DAYS = 30;
const NOTIFICATION_LIST_LIMIT = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * When a notification is deleted from the database: as soon as it can no
 * longer be shown (the database's TTL index on expireAt does the deleting).
 */
function notificationExpiry(now = new Date()) {
  return new Date(now.getTime() + NOTIFICATION_MAX_AGE_DAYS * DAY_MS);
}

function notificationCutoff(now = new Date()) {
  return new Date(now.getTime() - NOTIFICATION_MAX_AGE_DAYS * DAY_MS);
}

/** The shown notifications, newest first; pinned ones on top of those. */
async function visibleNotifications(userId, { now = new Date() } = {}) {
  const latest = await Notification.find({
    userId,
    createdAt: { $gte: notificationCutoff(now) },
  })
    .sort({ createdAt: -1, _id: -1 })
    .limit(NOTIFICATION_LIST_LIMIT)
    .lean();

  // Same order as before inside the shown set: pinned messages first.
  return latest
    .map((notification, index) => ({ notification, index }))
    .sort((a, b) => (Number(b.notification.pinned === true) - Number(a.notification.pinned === true))
      || (a.index - b.index))
    .map(({ notification }) => notification);
}

/** Unread notifications among the shown ones (the badge number). */
async function visibleUnreadCount(userId, { now = new Date() } = {}) {
  const latest = await Notification.find({
    userId,
    createdAt: { $gte: notificationCutoff(now) },
  })
    .sort({ createdAt: -1, _id: -1 })
    .limit(NOTIFICATION_LIST_LIMIT)
    .select('read')
    .lean();
  return latest.filter((notification) => notification.read !== true).length;
}

module.exports = {
  NOTIFICATION_MAX_AGE_DAYS,
  NOTIFICATION_LIST_LIMIT,
  notificationCutoff,
  notificationExpiry,
  visibleNotifications,
  visibleUnreadCount,
};
