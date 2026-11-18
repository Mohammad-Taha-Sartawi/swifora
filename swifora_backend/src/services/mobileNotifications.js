const Notification = require('../models/Notification');
const { sendPushToUser } = require('./pushNotifications');
const { notificationExpiry, visibleUnreadCount } = require('./notificationWindow');

async function emitUnreadNotificationCount(io, userId) {
  if (!io || !userId) return;

  const unreadCount = await visibleUnreadCount(userId);
  io.to(`user:${userId}`).emit('notification_count', { unreadCount });
}

async function createUserNotification({
  io,
  userId,
  orderId = null,
  type,
  title,
  body,
  pinned = false,
  expireAt = null,
  push = true,
}) {
  if (!userId) return null;

  const notification = await Notification.create({
    userId,
    ...(orderId ? { orderId } : {}),
    type,
    title,
    body,
    pinned,
    // Deleted once it can no longer be shown (30 days), unless the caller
    // gives a shorter life (pinned messages, account notices).
    expireAt: expireAt || notificationExpiry(),
  });

  await emitUnreadNotificationCount(io, userId).catch(() => {});
  if (push) {
    sendPushToUser(userId, {
      title,
      body,
      data: {
        type,
        ...(orderId ? { orderId: orderId.toString() } : {}),
      },
    }).catch(() => {});
  }
  return notification;
}

module.exports = {
  createUserNotification,
  emitUnreadNotificationCount,
};
