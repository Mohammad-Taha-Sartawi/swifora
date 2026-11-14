const { sendInternalServerError } = require('../security/errorResponse');
const express = require('express');
const Ad = require('../models/Ad');
const auth = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const { publicAd } = require('../services/adPayload');
const { AdEventError, recordAdEvents } = require('../services/adTracking');
const { createActionLimiter } = require('../security/actionRateLimit');

const router = express.Router();

router.get('/', auth, requireRole('customer', 'provider'), async (req, res) => {
  try {
    const now = new Date();
    const audience = req.userRole === 'provider'
      ? 'providers'
      : 'customers';

    const ads = await Ad.find({
      isActive: true,
      audience: { $in: ['all', audience] },
      $and: [
        {
          $or: [
            { startsAt: null },
            { startsAt: { $lte: now } },
          ],
        },
        {
          $or: [
            { endsAt: null },
            { endsAt: { $gte: now } },
          ],
        },
      ],
    })
      .sort({ sortOrder: 1, createdAt: -1 })
      .limit(5)
      .lean();

    return res.json(ads.map(publicAd));
  } catch (err) {
    return sendInternalServerError(res);
  }
});

// Views and taps of the home banner, sent by the apps in small batches.
const adEventLimiter = createActionLimiter({
  prefix: 'ad-events',
  windowMs: 60 * 1000,
  limit: 60,
});

router.post('/events', auth, requireRole('customer', 'provider'), adEventLimiter, async (req, res) => {
  try {
    await recordAdEvents({ userId: req.userId, events: req.body?.events });
    return res.status(204).end();
  } catch (err) {
    if (err instanceof AdEventError) {
      return res.status(400).json({ error: err.message });
    }
    return sendInternalServerError(res);
  }
});

module.exports = router;
