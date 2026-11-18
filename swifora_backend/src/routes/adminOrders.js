const {
  sendInternalServerError,
  sendInternalServerFailure,
} = require('../security/errorResponse');
const express = require('express');
const { rejectInvalidObjectIdParams } = require('../middleware/objectIdParams');
const mongoose = require('mongoose');
const Order = require('../models/Order');
const Offer = require('../models/Offer');
const RejectedOrder = require('../models/RejectedOrder');
const User = require('../models/User');
const lifecycle = require('../services/orderLifecycle');
const { escapeRegex } = require('../services/accountSearch');
const { announceOrderToDrivers } = require('../services/orderAnnouncement');
const { createUserNotification } = require('../services/mobileNotifications');

const router = express.Router();
rejectInvalidObjectIdParams(router, ['id', 'offerId']);

function activeOfferFilter(orderId, now = new Date()) {
  return {
    orderId,
    status: 'pending',
    $or: [
      { expiresAt: { $gt: now } },
      { expiresAt: null },
      { expiresAt: { $exists: false } },
    ],
  };
}

router.get('/', async (req, res) => {
  try {
    // A repeated query key arrives as an array: use the first value only.
    const single = (value, max = 100) =>
      String(Array.isArray(value) ? value[0] ?? '' : value ?? '').trim().slice(0, max);
    const status = single(req.query.status, 40);
    const type = single(req.query.type, 40);
    const area = single(req.query.area);
    const q = single(req.query.q);
    const filter = {};

    if (status && status !== 'all') {
      filter.status = status;
    }

    if (type && type !== 'all') {
      filter.type = type;
    }

    if (area) {
      filter.area = area;
    }

    if (q) {
      if (mongoose.isValidObjectId(q)) {
        filter._id = q;
      } else {
        // The text is matched literally: "(a+)+$" or "(" must not become a
        // slow or broken regular expression in the database.
        filter.description = { $regex: escapeRegex(q), $options: 'i' };
      }
    }

    const orders = await Order.find(filter)
      .populate('customerId', 'fullName publicId')
      .populate('providerId', 'fullName publicId')
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    res.json(orders);
  } catch (err) {
    sendInternalServerError(res);
  }
});

router.get('/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ error: 'الطلب غير موجود' });
    }

    const order = await Order.findById(req.params.id)
      .populate('customerId', 'fullName publicId phoneNumbers area')
      .populate('providerId', 'fullName publicId phoneNumbers area')
      .lean();

    if (!order) {
      return res.status(404).json({ error: 'الطلب غير موجود' });
    }

    const [offers, rejections] = await Promise.all([
      Offer.find({ orderId: order._id })
        .populate('providerId', 'fullName publicId phoneNumbers')
        .sort({ createdAt: -1 })
        .lean(),
      RejectedOrder.find({ orderId: order._id })
        .populate('providerId', 'fullName publicId')
        .sort({ createdAt: -1 })
        .lean(),
    ]);

    res.json({ order, offers, rejections });
  } catch (err) {
    sendInternalServerError(res);
  }
});

router.post('/:id/cancel', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ success: false, message: 'الطلب غير موجود' });
    }

    const order = await Order.findById(req.params.id)
      .select('status providerId customerId description')
      .lean();

    if (!order) {
      return res.status(404).json({ success: false, message: 'الطلب غير موجود' });
    }

    if (['completed', 'cancelled'].includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: 'لا يمكن إلغاء هذا الطلب في حالته الحالية',
      });
    }

    await Order.updateOne(
      { _id: order._id },
      {
        $set: {
          status: 'cancelled',
          offerSuspendedUntil: null,
          offerWindowExpiredAt: null,
        },
      },
    );

    await Offer.updateMany(
      { orderId: order._id, status: 'pending' },
      { $set: { status: 'rejected' } },
    );

    if (order.providerId) {
      await User.updateOne(
        { _id: order.providerId },
        { $set: { blockedUntil: null } },
      );
    }

    // Tell the customer and the assigned driver (in the app and by push).
    const io = req.app.get('io');
    const what = order.description ? `«${String(order.description).slice(0, 80)}»` : '';
    const notices = [
      createUserNotification({
        io,
        userId: order.customerId,
        orderId: order._id,
        type: 'order_cancelled',
        title: 'تم إلغاء طلبك',
        body: `ألغت إدارة سويفورا طلبك ${what}. للاستفسار تواصل مع الدعم.`.replace(/s+./, '.'),
      }),
    ];
    if (order.providerId) {
      notices.push(createUserNotification({
        io,
        userId: order.providerId,
        orderId: order._id,
        type: 'order_cancelled',
        title: 'تم إلغاء طلب',
        body: `ألغت إدارة سويفورا الطلب ${what}. لا حاجة لتوصيله.`.replace(/s+./, '.'),
      }));
    }
    await Promise.allSettled(notices);

    res.json({ success: true, message: 'تم إلغاء الطلب' });
  } catch (err) {
    sendInternalServerFailure(res);
  }
});

router.post('/:id/resend', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ success: false, message: 'الطلب غير موجود' });
    }

    const order = await Order.findById(req.params.id)
      .select('customerId')
      .lean();

    if (!order) {
      return res.status(404).json({ success: false, message: 'الطلب غير موجود' });
    }

    const resent = await lifecycle.resetOrder({
      orderId: order._id,
      customerId: order.customerId,
    });

    // Same as a new order: live in open apps, push to closed ones.
    announceOrderToDrivers(req.app.get('io'), resent).catch(() => {});

    res.json({ success: true, message: 'تم إعادة إرسال الطلب للسائقين' });
  } catch (err) {
    if (err instanceof lifecycle.LifecycleConflict) {
      return res.status(409).json({
        success: false,
        message: err.message,
      });
    }

    sendInternalServerFailure(res);
  }
});

router.post('/:id/end-suspension', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ success: false, message: 'الطلب غير موجود' });
    }

    const update = await Order.updateOne(
      {
        _id: req.params.id,
        status: 'pending',
        offerSuspendedUntil: { $ne: null },
      },
      { $set: { status: 'expired' } },
    );

    if (update.modifiedCount !== 1) {
      return res.status(400).json({
        success: false,
        message: 'لا يوجد تعليق نشط لهذا الطلب',
      });
    }

    res.json({
      success: true,
      message: 'تم إنهاء التعليق ونقل الطلب إلى التقارير',
    });
  } catch (err) {
    sendInternalServerFailure(res);
  }
});

router.post('/:id/offers/:offerId/reject', async (req, res) => {
  try {
    if (
      !mongoose.isValidObjectId(req.params.id)
      || !mongoose.isValidObjectId(req.params.offerId)
    ) {
      return res.status(404).json({ success: false, message: 'العرض غير موجود' });
    }

    const offer = await Offer.findOneAndUpdate(
      {
        _id: req.params.offerId,
        orderId: req.params.id,
        status: 'pending',
      },
      { $set: { status: 'rejected' } },
      { new: true },
    );

    if (!offer) {
      return res.status(404).json({
        success: false,
        message: 'العرض غير موجود أو لم يعد قابلاً للرفض',
      });
    }

    const remainingOffer = await Offer.exists(
      activeOfferFilter(offer.orderId),
    );

    if (!remainingOffer) {
      await Order.updateOne(
        { _id: offer.orderId, status: 'offered' },
        { $set: { status: 'pending' } },
      );
    }

    res.json({ success: true, message: 'تم رفض عرض السعر' });
  } catch (err) {
    sendInternalServerFailure(res);
  }
});

module.exports = router;
