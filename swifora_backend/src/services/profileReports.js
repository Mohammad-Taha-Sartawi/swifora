// "Profile status" of a driver or a customer in the dashboard: how many
// reports were filed against them, and clearing those reports from the
// profile. Clearing does not delete the reports: they stay in the reports
// pages (and in the reporter's history in the app); they just no longer
// count against the profile.
const Report = require('../models/Report');

const OPEN_STATUSES = ['in-review', 'in-progress'];

/** Reports filed against [user] (a driver or a customer document). */
function reportsAgainstFilter(user) {
  const reportType = user.role === 'provider' ? 'driver' : 'user';
  const match = [{ reportedUserId: user._id }];
  // Older reports were linked by public ID only.
  if (user.publicId) {
    match.push({
      reportedUserId: { $in: [null] },
      reportType,
      reportedPublicId: user.publicId,
    });
  }
  return { $or: match };
}

const ACTIVE = { clearedFromProfileAt: { $in: [null] } };

/**
 * { total, open, resolved, rejected, lastReportedAt, cleared } where total
 * counts the reports still on the profile and cleared those removed from it.
 */
async function profileReportStatus(user) {
  const against = reportsAgainstFilter(user);
  const [rows, cleared] = await Promise.all([
    Report.aggregate([
      { $match: { $and: [against, ACTIVE] } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          open: { $sum: { $cond: [{ $in: ['$status', OPEN_STATUSES] }, 1, 0] } },
          resolved: { $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] } },
          rejected: { $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] } },
          lastReportedAt: { $max: '$createdAt' },
        },
      },
    ]),
    Report.countDocuments({ $and: [against, { clearedFromProfileAt: { $ne: null } }] }),
  ]);
  const row = rows[0] || {};
  return {
    total: row.total || 0,
    open: row.open || 0,
    resolved: row.resolved || 0,
    rejected: row.rejected || 0,
    lastReportedAt: row.lastReportedAt || null,
    cleared,
  };
}

/** Clears the reports still on [user]'s profile; returns how many. */
async function clearProfileReports(user, adminId) {
  const result = await Report.updateMany(
    { $and: [reportsAgainstFilter(user), ACTIVE] },
    { $set: { clearedFromProfileAt: new Date(), clearedBy: adminId || null } },
  );
  return result.modifiedCount || 0;
}

module.exports = {
  reportsAgainstFilter,
  profileReportStatus,
  clearProfileReports,
};
