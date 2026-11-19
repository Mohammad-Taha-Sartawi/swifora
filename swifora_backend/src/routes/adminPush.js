// Dashboard alerts on the admin's device (computer or phone): the browser
// subscribes to Web Push here, and adminAlerts.js sends to it when something
// new needs the admins. Mounted behind the admin session and CSRF checks.
const express = require('express');
const { sendInternalServerFailure } = require('../security/errorResponse');
const AdminPushSubscription = require('../models/AdminPushSubscription');
const { isAllowedPushEndpoint, isConfigured, notifyAdmins, publicKey } = require('../services/adminAlerts');

const router = express.Router();

// Each admin keeps at most this many devices; the oldest is dropped.
const MAX_DEVICES_PER_ADMIN = 10;
const BASE64URL = /^[A-Za-z0-9_-]+={0,2}$/;

function readSubscription(body) {
  const endpoint = body?.endpoint;
  const p256dh = body?.keys?.p256dh;
  const auth = body?.keys?.auth;
  if (!isAllowedPushEndpoint(endpoint)) return null;
  if (typeof p256dh !== 'string' || p256dh.length < 40 || p256dh.length > 256 || !BASE64URL.test(p256dh)) return null;
  if (typeof auth !== 'string' || auth.length < 8 || auth.length > 128 || !BASE64URL.test(auth)) return null;
  return { endpoint, keys: { p256dh, auth } };
}

/** Whether alerts outside the open dashboard are set up on this server. */
router.get('/config', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ enabled: isConfigured(), publicKey: publicKey() });
});

/** This device starts receiving alerts for the signed-in admin. */
router.post('/subscriptions', async (req, res) => {
  try {
    if (!isConfigured()) {
      return res.status(409).json({ success: false, code: 'PUSH_NOT_CONFIGURED', message: 'إشعارات الأجهزة غير مفعّلة على الخادم.' });
    }
    const subscription = readSubscription(req.body);
    if (!subscription) {
      return res.status(400).json({ success: false, code: 'INVALID_SUBSCRIPTION', message: 'بيانات الاشتراك غير صالحة.' });
    }
    const adminId = req.adminUser.id;
    const existed = await AdminPushSubscription.exists({ endpoint: subscription.endpoint });
    // The same browser may have belonged to another admin before: it now
    // alerts whoever turned alerts on in it last.
    await AdminPushSubscription.findOneAndUpdate(
      { endpoint: subscription.endpoint },
      {
        $set: { adminId, keys: subscription.keys, sessionVersion: Number(req.adminUser.sessionVersion) || 0 },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true },
    );

    const devices = await AdminPushSubscription.find({ adminId }).sort({ createdAt: -1 }).select('_id').lean();
    if (devices.length > MAX_DEVICES_PER_ADMIN) {
      await AdminPushSubscription.deleteMany({ _id: { $in: devices.slice(MAX_DEVICES_PER_ADMIN).map((d) => d._id) } });
    }
    return res.status(existed ? 200 : 201).json({ success: true });
  } catch (err) {
    return sendInternalServerFailure(res);
  }
});

/** This device stops receiving alerts (turned off, or signing out). */
router.delete('/subscriptions', async (req, res) => {
  try {
    const endpoint = req.body?.endpoint;
    if (typeof endpoint !== 'string' || endpoint.length > 2048) {
      return res.status(400).json({ success: false, code: 'INVALID_SUBSCRIPTION', message: 'بيانات الاشتراك غير صالحة.' });
    }
    await AdminPushSubscription.deleteOne({ endpoint, adminId: req.adminUser.id });
    return res.json({ success: true });
  } catch (err) {
    return sendInternalServerFailure(res);
  }
});

/** "Try the alert": a test notification to the signed-in admin's devices. */
router.post('/test', async (req, res) => {
  try {
    if (!isConfigured()) {
      return res.status(409).json({ success: false, code: 'PUSH_NOT_CONFIGURED', message: 'إشعارات الأجهزة غير مفعّلة على الخادم.' });
    }
    const result = await notifyAdmins('test', { adminId: req.adminUser.id });
    return res.json({ success: true, sent: result.sent || 0, throttled: result.throttled === true });
  } catch (err) {
    return sendInternalServerFailure(res);
  }
});

module.exports = router;
