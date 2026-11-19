const { sendInternalServerError } = require('../security/errorResponse');
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Order = require('../models/Order');
const Report = require('../models/Report');
const AccountDeletionRequest = require('../models/AccountDeletionRequest');
const CommissionSetting = require('../models/CommissionSetting');
const mongoose = require('mongoose');
const LegalDocument = require('../models/LegalDocument');
const { DEFAULT_LEGAL_TEXT } = require('../services/legalDefaults');

const { LEGAL_DOCUMENT_KEYS, LEGAL_DOCUMENT_MAX_LENGTH } = LegalDocument;
const {
  normalizeCommissionConfig,
  getCommissionConfig,
  getDriverDisplaySettings,
  setDriverCommissionCardVisible,
} = require('../services/commissionSettings');
const {
  orderStatBoundaries,
  normalizeOrderTypeCounts,
} = require('../services/orderStats');
const {
  reportPeriod,
  commissionTotal,
  commissionReport,
} = require('../services/commissionReport');

router.get('/stats', async (req, res) => {
  try {
    const [totalDrivers, activeDrivers, inactiveDrivers, totalUsers, activeUsers] = await Promise.all([
      User.countDocuments({ role: 'provider', deleted: { $ne: true } }),
      // Drivers who kept receiving orders enabled.
      User.countDocuments({
        role: 'provider',
        status: 'active',
        deleted: { $ne: true },
        isAvailable: { $ne: false },
      }),
      // Drivers who switched themselves unavailable for new orders.
      User.countDocuments({
        role: 'provider',
        status: 'active',
        deleted: { $ne: true },
        isAvailable: false,
      }),
      User.countDocuments({ role: 'customer', deleted: { $ne: true } }),
      User.countDocuments({
        role: 'customer',
        status: 'active',
        deleted: { $ne: true },
      }),
    ]);

    const { startOfToday, startOfMonth } = orderStatBoundaries();

    // Platform commission booked today and this month (Palestine time),
    // see services/commissionReport.js.
    const commissionToday = reportPeriod('today');
    const [todayCommission, monthCommission] = await Promise.all([
      commissionTotal(commissionToday),
      commissionTotal(reportPeriod('month')),
    ]);
    const totalCommission = todayCommission.total;

    // Drivers who still have unpaid platform commission and the amount due.
    // Commission accrued after the driver's last payment timestamp is unpaid;
    // legacy commissionPaid accounts without a timestamp are fully settled.
    const legacyPaidCutoff = new Date('9999-12-31T23:59:59.999Z');
    const noPaymentCutoff = new Date(0);
    const unpaidCommissionAgg = await Order.aggregate([
      {
        $match: {
          status: { $in: ['accepted', 'fulfilling', 'completed'] },
          providerId: { $ne: null },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'providerId',
          foreignField: '_id',
          as: 'provider',
        },
      },
      { $unwind: '$provider' },
      { $match: { 'provider.role': 'provider' } },
      {
        $addFields: {
          dueAt: { $ifNull: ['$acceptedAt', '$createdAt'] },
          cutoff: {
            $cond: [
              {
                $ne: [
                  { $ifNull: ['$provider.commissionPaidAt', null] },
                  null,
                ],
              },
              '$provider.commissionPaidAt',
              {
                $cond: [
                  { $eq: ['$provider.commissionPaid', true] },
                  legacyPaidCutoff,
                  noPaymentCutoff,
                ],
              },
            ],
          },
        },
      },
      { $match: { $expr: { $gt: ['$dueAt', '$cutoff'] } } },
      {
        $group: {
          _id: '$providerId',
          unpaid: { $sum: '$platformCommission' },
        },
      },
      { $match: { unpaid: { $gt: 0 } } },
      {
        $group: {
          _id: null,
          pendingAmount: { $sum: '$unpaid' },
          pendingDrivers: { $sum: 1 },
        },
      },
    ]);
    const adjustmentAgg = await User.aggregate([
      {
        $match: {
          role: 'provider',
          commissionAdjustment: { $ne: 0 },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$commissionAdjustment' },
        },
      },
    ]);
    const pendingAmount = Math.max(
      0,
      (unpaidCommissionAgg[0]?.pendingAmount || 0)
        + (adjustmentAgg[0]?.total || 0),
    );
    const pendingDrivers = unpaidCommissionAgg[0]?.pendingDrivers || 0;

    const inactiveUsers = totalUsers - activeUsers;

    const orderTypeRows = await Order.aggregate([
      { $match: { createdAt: { $gte: startOfMonth } } },
      {
        $group: {
          _id: '$type',
          month: { $sum: 1 },
          today: {
            $sum: {
              $cond: [{ $gte: ['$createdAt', startOfToday] }, 1, 0],
            },
          },
          accepted: {
            $sum: {
              $cond: [
                {
                  $in: [
                    '$status',
                    ['accepted', 'fulfilling', 'completed'],
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);
    const orderTypeCounts = normalizeOrderTypeCounts(orderTypeRows);

    const driverReportsPending = await Report.countDocuments({ reportType: 'driver', status: { $in: ['in-review', 'in-progress'] } });
    const userReportsPending = await Report.countDocuments({ reportType: 'user', status: { $in: ['in-review', 'in-progress'] } });
    const deletionRequestsPending = await AccountDeletionRequest.countDocuments({ status: 'pending' });

    res.json({
      totalDrivers, activeDrivers, inactiveDrivers,
      totalUsers, activeUsers, inactiveUsers,
      totalCommission, pendingAmount, pendingDrivers,
      monthCommission: monthCommission.total,
      commissionOrdersToday: todayCommission.orders,
      commissionOrdersMonth: monthCommission.orders,
      commissionDate: {
        year: commissionToday.year,
        month: commissionToday.month,
        day: commissionToday.day,
        timeZone: commissionToday.timeZone,
      },
      driverReportsPending, userReportsPending, deletionRequestsPending,
      orderTypeCounts,
    });
  } catch (err) {
    sendInternalServerError(res);
  }
});

// Which drivers today's / this month's platform commission came from.
router.get('/commission-report', async (req, res) => {
  try {
    const period = req.query.period === 'month' ? 'month' : 'today';
    res.json(await commissionReport(period));
  } catch (err) {
    sendInternalServerError(res);
  }
});

router.get('/top-driver', async (req, res) => {
  try {
    const topDriver = await Order.aggregate([
      { $match: { status: { $in: ['accepted', 'fulfilling', 'completed'] }, providerId: { $exists: true, $ne: null } } },
      { $group: { _id: '$providerId', earnings: { $sum: '$providerEarning' }, count: { $sum: 1 } } },
      { $sort: { earnings: -1 } },
      { $limit: 1 }
    ]);

    if (topDriver.length > 0) {
      const driver = await User.findById(topDriver[0]._id, 'fullName').lean();
      res.json({ name: driver ? (driver.fullName) : '---', earnings: topDriver[0].earnings || 0 });
    } else {
      res.json({ name: '---', earnings: 0 });
    }
  } catch (err) {
    sendInternalServerError(res);
  }
});

// Driver app: show or hide the "commission due" card.
router.get('/driver-display-settings', async (req, res) => {
  try {
    res.json(await getDriverDisplaySettings());
  } catch (err) {
    sendInternalServerError(res);
  }
});

router.put('/driver-display-settings', async (req, res) => {
  try {
    const visible = req.body?.showCommissionCard;
    if (typeof visible !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'اختر إظهار مربع العمولة أو إخفاءه.',
      });
    }
    const settings = await setDriverCommissionCardVisible(visible);
    return res.json({ success: true, ...settings });
  } catch (err) {
    return sendInternalServerError(res);
  }
});

router.get('/commission-settings', async (req, res) => {
  try {
    res.json(await getCommissionConfig());
  } catch (err) {
    sendInternalServerError(res);
  }
});

router.put('/commission-settings', async (req, res) => {
  try {
    const type = req.body?.type;
    const value = Number(req.body?.value);

    if (type !== 'fixed' && type !== 'percent') {
      return res.status(400).json({
        success: false,
        message: 'نوع العمولة يجب أن يكون مبلغاً ثابتاً أو نسبة مئوية.',
      });
    }

    if (!Number.isFinite(value) || value < 0) {
      return res.status(400).json({
        success: false,
        message: 'قيمة العمولة يجب أن تكون رقماً غير سالب.',
      });
    }

    if (type === 'percent' && value > 100) {
      return res.status(400).json({
        success: false,
        message: 'نسبة العمولة لا يمكن أن تتجاوز 100%.',
      });
    }

    if (type === 'fixed' && value > 100000) {
      return res.status(400).json({
        success: false,
        message: 'مبلغ العمولة الثابت كبير جداً.',
      });
    }

    const setting = await CommissionSetting.findOneAndUpdate(
      { key: 'platform' },
      {
        $set: {
          type,
          value,
          updatedAt: new Date(),
        },
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      },
    ).lean();

    res.json({
      success: true,
      config: normalizeCommissionConfig(setting),
    });
  } catch (err) {
    sendInternalServerError(res);
  }
});

// Privacy policy and terms of use, written in the settings page. The saved
// text is returned as is, so the editor opens with it every time.
// Until a text is saved, the editor opens with the one that shipped with
// the app (isDefault), ready to edit.
function legalDocumentPayload(key, doc) {
  if (!doc) {
    return { key, content: DEFAULT_LEGAL_TEXT[key], updatedAt: null, isDefault: true };
  }
  return {
    key,
    content: doc.content || '',
    updatedAt: doc.updatedAt || null,
    isDefault: false,
  };
}

router.get('/legal/:key', async (req, res) => {
  try {
    const { key } = req.params;
    if (!LEGAL_DOCUMENT_KEYS.includes(key)) {
      return res.status(404).json({ success: false, message: 'Not found' });
    }
    const doc = await LegalDocument.findOne({ key }).lean();
    return res.json(legalDocumentPayload(key, doc));
  } catch (err) {
    return sendInternalServerError(res);
  }
});

router.put('/legal/:key', async (req, res) => {
  try {
    const { key } = req.params;
    if (!LEGAL_DOCUMENT_KEYS.includes(key)) {
      return res.status(404).json({ success: false, message: 'Not found' });
    }
    const raw = req.body?.content;
    if (typeof raw !== 'string') {
      return res.status(400).json({ success: false, message: 'النص غير صالح.' });
    }
    // Kept exactly as written (only Windows line breaks are unified); an
    // empty text clears the document.
    const content = raw.replace(/\r\n/g, '\n');
    if (content.length > LEGAL_DOCUMENT_MAX_LENGTH) {
      return res.status(400).json({
        success: false,
        message: `النص طويل جداً (الحد الأقصى ${LEGAL_DOCUMENT_MAX_LENGTH} حرف).`,
      });
    }
    const adminId = req.session?.admin?.id;
    const doc = await LegalDocument.findOneAndUpdate(
      { key },
      {
        $set: {
          content,
          updatedAt: new Date(),
          updatedBy: mongoose.isValidObjectId(adminId) ? adminId : null,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean();
    return res.json({ success: true, ...legalDocumentPayload(key, doc) });
  } catch (err) {
    return sendInternalServerError(res);
  }
});

module.exports = router;
