const { sendInternalServerError } = require('../security/errorResponse');
const express = require('express');
const { rejectInvalidObjectIdParams } = require('../middleware/objectIdParams');
const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const auth = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');

const router = express.Router();
rejectInvalidObjectIdParams(router, ['id']);
router.use(auth, requireRole('customer', 'provider'));

router.get('/', async (req, res) => {
  try {
    const notifications = await Notification.find({
      userId: req.userId,
    })
      .sort({ pinned: -1, createdAt: -1 })
      .limit(50)
      .lean();
    res.json(notifications);
  } catch (err) {
    sendInternalServerError(res);
  }
});

router.put('/:id/read', async (req, res) => {
  try {
    const notif = await Notification.findOne({
      _id: req.params.id,
      userId: req.userId,
    });
    if (!notif) return res.status(404).json({ error: 'Not found' });
    // Pinned notifications disappear immediately when read
    if (notif.pinned) {
      await Notification.findByIdAndDelete(req.params.id);
    } else {
      notif.read = true;
      await notif.save();
    }
    res.json({ message: 'Marked as read' });
  } catch (err) {
    sendInternalServerError(res);
  }
});

// The user confirmed the pop-up of a broadcast message. The message stays
// in the notifications list (pinned) until it expires; only the pop-up stops.
router.put('/:id/ack', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ error: 'Not found' });
    }
    const notif = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId, type: 'broadcast' },
      { $set: { acknowledgedAt: new Date() } },
      { new: true },
    ).lean();
    if (!notif) return res.status(404).json({ error: 'Not found' });
    res.json({ acknowledgedAt: notif.acknowledgedAt });
  } catch (err) {
    sendInternalServerError(res);
  }
});

router.put('/read-all', async (req, res) => {
  try {
    // Pinned notifications get deleted; regular ones marked read
    await Notification.deleteMany({ userId: req.userId, pinned: true });
    await Notification.updateMany({ userId: req.userId, read: false }, { read: true });
    res.json({ message: 'All marked as read' });
  } catch (err) {
    sendInternalServerError(res);
  }
});

router.get('/unread-count', async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      userId: req.userId,
      read: false,
    });
    res.json({ count });
  } catch (err) {
    sendInternalServerError(res);
  }
});

module.exports = router;