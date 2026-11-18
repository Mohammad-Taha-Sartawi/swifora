const Admin = require('../models/Admin');
const mongoose = require('mongoose');
const {
  ADMIN_SESSION_COOKIE,
} = require('./adminSession');
const {
  isActiveAdminAccount,
  adminSessionVersionMatches,
} = require('../services/adminAccounts');

// Longest an admin stays signed in, counted from sign-in.
const ADMIN_SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000;

function isAdminSession(req) {
  return req.session?.admin?.id
    && req.session.admin.role === 'admin';
}

async function loadAdminById(id) {
  return Admin.findOne({
    _id: id,
    role: 'admin',
    status: 'active',
    deleted: { $ne: true },
  })
    .select('_id email fullName role status deleted sessionVersion')
    .lean();
}

function isApiRequest(req) {
  const path = String(req.originalUrl || '');

  return path.startsWith('/api/')
    || path.startsWith('/admin/api/');
}

function rejectAdminSession(req, res) {
  const adminId = req.session?.admin?.id;
  const io = req.app?.get?.('io');

  if (io && adminId) {
    io.in(`admin:${adminId}`).disconnectSockets(true);
  }

  if (req.session && typeof req.session.destroy === 'function') {
    req.session.destroy(() => {});
  }

  if (typeof res.clearCookie === 'function') {
    res.clearCookie(ADMIN_SESSION_COOKIE);
  }

  if (typeof res.set === 'function') {
    res.set('Cache-Control', 'no-store');
  }

  if (isApiRequest(req)) {
    return res.status(401).json({
      error: 'Unauthorized',
      code: 'ADMIN_SESSION_INVALID',
    });
  }

  return res.redirect('/admin/login');
}

function createRequireAdminSession({
  loadAdmin = loadAdminById,
} = {}) {
  return async function requireAdminSession(req, res, next) {
    const sessionAdmin = req.session?.admin;

    if (!isAdminSession(req)) {
      return rejectAdminSession(req, res);
    }

    if (!mongoose.isValidObjectId(sessionAdmin.id)) {
      return rejectAdminSession(req, res);
    }

    // A session lives at most ADMIN_SESSION_MAX_AGE_MS from sign-in, however
    // often it is used: a stolen cookie cannot be kept alive forever.
    // Sessions from before this rule get their clock started now.
    const loginAt = Number(sessionAdmin.loginAt);
    if (!Number.isFinite(loginAt) || loginAt <= 0) {
      sessionAdmin.loginAt = Date.now();
    } else if (Date.now() - loginAt > ADMIN_SESSION_MAX_AGE_MS) {
      return rejectAdminSession(req, res);
    }

    try {
      const admin = await loadAdmin(sessionAdmin.id);

      if (
        !isActiveAdminAccount(admin)
        || !adminSessionVersionMatches(
          admin,
          sessionAdmin.sessionVersion,
        )
      ) {
        return rejectAdminSession(req, res);
      }

      req.adminUser = {
        id: admin._id.toString(),
        email: admin.email || '',
        fullName: admin.fullName || '',
        role: 'admin',
        sessionVersion: admin.sessionVersion,
      };

      return next();
    } catch (error) {
      return next(error);
    }
  };
}

const requireAdminSession =
  createRequireAdminSession();

requireAdminSession.isAdminSession =
  isAdminSession;
requireAdminSession.createRequireAdminSession =
  createRequireAdminSession;
requireAdminSession.loadAdminById =
  loadAdminById;

requireAdminSession.ADMIN_SESSION_MAX_AGE_MS =
  ADMIN_SESSION_MAX_AGE_MS;

module.exports = requireAdminSession;
