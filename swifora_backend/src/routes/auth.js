const {
  normalizeServiceTypes,
} = require('../services/providerServiceTypes');
const { sendInternalServerError } = require('../security/errorResponse');
const express = require('express');
const { personName, PERSON_NAME_MESSAGE } = require('../security/requestInput');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const PendingProvider = require('../models/PendingProvider');
const auth = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const passwordRecoveryRouter = require('./passwordRecovery');
const { generatePublicId } = require('../utils/publicId');
const { isMobileRole } = require('../middleware/mobileRole');
const { loadSecurityConfig } = require('../config');
const { isReservedGuestEmail } = require('../services/contactRequest');
const { newAccountEmailProblem } = require('../services/emailCheck');
const {
  normalizePhoneNumber,
  isValidPhoneNumber,
  INVALID_PHONE_MESSAGE,
} = require('../services/phoneNumbers');
const {
  normalizeMobileEmail,
  isValidMobileEmail,
} = require('../security/mobileEmail');
const {
  isActiveMobileAccount,
  publicMobileUser,
  mobileSessionVersion,
  mobileSessionRotationFilter,
} = require('../services/mobileSession');
const { governorateKey, isValidAreaForGovernorate } = require('../services/registrationLocation');
const { findActiveAccountByEmail } = require('../services/accountRelease');
const {
  isGoogleSignInConfigured,
  verifyGoogleIdToken,
  GoogleTokenError,
} = require('../services/googleSignIn');
const PushToken = require('../models/PushToken');
const {
  MIN_MOBILE_PASSWORD_LENGTH,
  MAX_MOBILE_PASSWORD_LENGTH,
  isValidMobilePassword,
  PASSWORD_HASH_ROUNDS,
} = require('../security/passwordPolicy');
const {
  createMobileLoginLimiter,
  createMobileLoginAccountLimiter,
  createMobileRegistrationLimiter,
} = require('../security/mobileAuthRateLimit');

const JWT_SECRET = loadSecurityConfig().jwtSecret;
const DUMMY_PASSWORD_HASH =
  '$2a$12$sGnyg4das1q00q6NeIP1SOg243vtjXF8zU8iycDT6Nna.E1CnAr76';

const invalidCredentialsMessage = 'Invalid credentials';
const mobileLoginLimiter = createMobileLoginLimiter();
const mobileLoginAccountLimiter =
  createMobileLoginAccountLimiter();
const mobileRegistrationLimiter =
  createMobileRegistrationLimiter();

const router = express.Router();

router.post('/register', mobileRegistrationLimiter, async (req, res) => {
  try {
    const {
      fullName,
      email,
      password,
      role,
      area,
      governorate,
      privacyPolicy,
    } = req.body;
    const phone = normalizePhoneNumber(req.body.phone);
    const registrationArea =
      typeof area === 'string' ? area.trim() : '';
    const registrationGovernorate =
      typeof governorate === 'string' ? governorate.trim() : '';
    const normalizedEmail =
      normalizeMobileEmail(email);

    if (!isMobileRole(role)) {
      return res.status(400).json({ error: 'Invalid registration role' });
    }

    const name = personName(fullName);
    if (!name) {
      return res.status(400).json({ error: PERSON_NAME_MESSAGE, code: 'INVALID_NAME' });
    }

    if (
      !isValidMobileEmail(normalizedEmail)
      || isReservedGuestEmail(normalizedEmail)
    ) {
      return res.status(400).json({
        error: 'Invalid email address',
      });
    }

    // A complete address on a domain that really receives mail.
    const emailProblem = await newAccountEmailProblem(normalizedEmail);
    if (emailProblem) return res.status(400).json(emailProblem);

    if (!isValidPhoneNumber(phone)) {
      return res.status(400).json({ error: INVALID_PHONE_MESSAGE, code: 'INVALID_PHONE' });
    }

    if (!isValidMobilePassword(password)) {
      return res.status(400).json({
        error:
          `Password must be between ${MIN_MOBILE_PASSWORD_LENGTH} and ${MAX_MOBILE_PASSWORD_LENGTH} characters and must not be an obvious placeholder`,
        code: 'PASSWORD_POLICY',
      });
    }

    const serviceTypes =
      role === 'provider'
        ? normalizeServiceTypes(req.body.serviceTypes)
        : [];

    // A deleted account's email is released here, so it can be reused.
    const existingUser = await findActiveAccountByEmail(normalizedEmail);
    if (existingUser) return res.status(400).json({ error: 'Email already registered' });
    const existingPending = await PendingProvider.findOne({ email: normalizedEmail });
    if (existingPending) return res.status(400).json({ error: 'Email already pending review' });

    const hashed = await bcrypt.hash(password, PASSWORD_HASH_ROUNDS);

    // Providers go through admin approval flow.
    if (role === 'provider') {
      await PendingProvider.create({
        fullName: name,
        email: normalizedEmail,
        phone,
        password: hashed,
        area: registrationArea,
        governorate: registrationGovernorate,
        serviceTypes,
      });

      return res.status(201).json({
        pending: true,
        message:
          'تم تقديم طلب التسجيل بنجاح. حسابك قيد المراجعة من قبل الإدارة.',
      });
    }

    // Customers register immediately
    const publicId = await generatePublicId();
    const user = await User.create({
      fullName: name,
      email: normalizedEmail,
      password: hashed,
      role,
      area: registrationArea,
      governorate: registrationGovernorate,
      governorateLevel: false,
      publicId,
      phoneNumbers: [{ number: phone, primary: true }],
      privacyPolicy: privacyPolicy || false,
    });

    const sessionVersion =
      mobileSessionVersion(user);

    if (sessionVersion === null) {
      throw new Error(
        'Invalid mobile session version',
      );
    }

    const token = jwt.sign(
      {
        id: user._id,
        role: user.role,
        sessionVersion,
      },
      JWT_SECRET,
      {
        expiresIn: '7d',
      },
    );

    res.status(201).json({
      token,
      user: { id: user._id, fullName: user.fullName, email: user.email, phone, role: user.role, area: user.area, governorate: user.governorate || '', governorateLevel: user.governorateLevel === true, publicId: user.publicId, mustChangePassword: user.mustChangePassword === true },
    });
  } catch (err) {
    sendInternalServerError(res);
  }
});

router.post('/login', mobileLoginLimiter, mobileLoginAccountLimiter, async (req, res) => {
  try {
    const { email, password, role } = req.body;
    const normalizedEmail =
      normalizeMobileEmail(email);

    if (!isMobileRole(role)) {
      return res.status(400).json({ error: 'Invalid login role' });
    }

    if (
      !isValidMobileEmail(normalizedEmail)
      || isReservedGuestEmail(normalizedEmail)
    ) {
      return res.status(400).json({
        error: invalidCredentialsMessage,
      });
    }

    const user = await User.findOne({ email: normalizedEmail }).select('+password');
    const suppliedPassword =
      typeof password === 'string'
        ? password
        : '';

    const match =
      await bcrypt.compare(
        suppliedPassword,
        user?.password || DUMMY_PASSWORD_HASH,
      );

    if (!user && role === 'provider') {
      // A driver whose sign-up still waits for admin approval. Answer with a
      // clear status instead of "invalid credentials", and as a 200 so these
      // retries do not count towards the failed-login lockout.
      const pending = await PendingProvider.findOne({
        email: normalizedEmail,
      }).select('+password');
      if (
        pending
        && await bcrypt.compare(suppliedPassword, pending.password || DUMMY_PASSWORD_HASH)
      ) {
        return res.json({
          pending: true,
          code: 'ACCOUNT_PENDING_APPROVAL',
          message:
            'حسابك قيد المراجعة من قبل الإدارة. ستتمكن من تسجيل الدخول بعد الموافقة عليه.',
        });
      }
    }

    if (!user || !match || user.role !== role) {
      return res.status(400).json({
        error: invalidCredentialsMessage,
        code: 'INVALID_CREDENTIALS',
      });
    }


    if (!isActiveMobileAccount(user, role)) {
      return res.status(403).json({
        error: user.deleted
          ? 'تم حذف هذا الحساب. يرجى إنشاء حساب جديد.'
          : 'هذا الحساب غير نشط حالياً.',
        code: 'ACCOUNT_INACTIVE',
      });
    }

    const sessionVersion =
      mobileSessionVersion(user);

    if (sessionVersion === null) {
      throw new Error(
        'Invalid mobile session version',
      );
    }

    const token = jwt.sign(
      {
        id: user._id,
        role: user.role,
        sessionVersion,
      },
      JWT_SECRET,
      {
        expiresIn: '7d',
      },
    );

    const primaryPhone = (user.phoneNumbers || []).find(p => p.primary)?.number || (user.phoneNumbers?.[0]?.number) || '';

    res.json({
      token,
      user: { id: user._id, fullName: user.fullName, email: user.email, phone: primaryPhone, role: user.role, area: user.area, governorate: governorateKey(user) || user.governorate || '', governorateLevel: user.governorateLevel === true, publicId: user.publicId || '', mustChangePassword: user.mustChangePassword === true },
    });
  } catch (err) {
    sendInternalServerError(res);
  }
});

// ---- Sign in with Google ----------------------------------------------
//
// POST /google { idToken, role }
//   existing account (same Google account, or same verified email): signs
//   in, linking Google to it; a driver still under review gets "pending";
//   a new person gets { needsProfile, registrationToken } so the app can
//   ask for the details every account needs (phone, governorate, city and,
//   for drivers, the service types).
// POST /google/complete { registrationToken, fullName, phone, governorate,
//   area, serviceTypes, privacyPolicy }: creates the customer account (and
//   signs in) or the driver's sign-up request (admin review, as usual).
const GOOGLE_REGISTRATION_PURPOSE = 'google-registration';
const GOOGLE_PENDING_MESSAGE =
  'حسابك قيد المراجعة من قبل الإدارة. ستتمكن من تسجيل الدخول بعد الموافقة عليه.';

function issueMobileSession(user) {
  const sessionVersion = mobileSessionVersion(user);
  if (sessionVersion === null) {
    throw new Error('Invalid mobile session version');
  }
  const token = jwt.sign(
    { id: user._id, role: user.role, sessionVersion },
    JWT_SECRET,
    { expiresIn: '7d' },
  );
  return {
    token,
    user: {
      ...publicMobileUser(user),
      mustChangePassword: user.mustChangePassword === true,
    },
  };
}

/** A password nobody knows: Google accounts sign in with Google (or set
 *  a password later through "forgot password"). */
async function unusablePasswordHash() {
  return bcrypt.hash(crypto.randomBytes(32).toString('hex'), PASSWORD_HASH_ROUNDS);
}

function roleMismatchMessage(accountRole) {
  return accountRole === 'provider'
    ? 'هذا الحساب مسجّل كسائق. اختر «سائق» ثم سجّل الدخول.'
    : 'هذا الحساب مسجّل كزبون. اختر «زبون» ثم سجّل الدخول.';
}

router.post('/google', mobileLoginLimiter, async (req, res) => {
  try {
    if (!isGoogleSignInConfigured()) {
      return res.status(503).json({
        error: 'تسجيل الدخول عبر Google غير متاح حالياً.',
        code: 'GOOGLE_NOT_CONFIGURED',
      });
    }
    const { idToken, role } = req.body || {};
    if (!isMobileRole(role)) {
      return res.status(400).json({ error: 'Invalid login role' });
    }

    let profile;
    try {
      profile = await verifyGoogleIdToken(idToken);
    } catch (error) {
      if (!(error instanceof GoogleTokenError)) throw error;
      return res.status(401).json({
        error: 'تعذّر التحقق من حساب Google. حاول مرة أخرى.',
        code: 'GOOGLE_TOKEN_INVALID',
      });
    }

    const email = normalizeMobileEmail(profile.email);
    if (!isValidMobileEmail(email) || isReservedGuestEmail(email)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }

    // Same Google account, or an account with the same verified email.
    let user = await User.findOne({ googleId: profile.sub, deleted: { $ne: true } });
    if (!user) {
      user = await findActiveAccountByEmail(email);
      if (user && user.googleId && user.googleId !== profile.sub) {
        return res.status(409).json({
          error: 'هذا البريد مرتبط بحساب Google آخر.',
          code: 'GOOGLE_ACCOUNT_MISMATCH',
        });
      }
    }

    if (user) {
      if (user.role !== role) {
        return res.status(400).json({
          error: roleMismatchMessage(user.role),
          code: 'ROLE_MISMATCH',
        });
      }
      if (!isActiveMobileAccount(user, role)) {
        return res.status(403).json({
          error: user.deleted
            ? 'تم حذف هذا الحساب. يرجى إنشاء حساب جديد.'
            : 'هذا الحساب غير نشط حالياً.',
          code: 'ACCOUNT_INACTIVE',
        });
      }
      if (!user.googleId) {
        await User.updateOne({ _id: user._id }, { $set: { googleId: profile.sub } });
      }
      return res.json(issueMobileSession(user));
    }

    const pending = await PendingProvider.findOne({
      $or: [{ googleId: profile.sub }, { email }],
    }).lean();
    if (pending) {
      if (role !== 'provider') {
        return res.status(400).json({
          error: roleMismatchMessage('provider'),
          code: 'ROLE_MISMATCH',
        });
      }
      return res.json({
        pending: true,
        code: 'ACCOUNT_PENDING_APPROVAL',
        message: GOOGLE_PENDING_MESSAGE,
      });
    }

    // New: the app asks for the remaining details, then calls /complete.
    const registrationToken = jwt.sign(
      { purpose: GOOGLE_REGISTRATION_PURPOSE, sub: profile.sub, email, name: profile.name, role },
      JWT_SECRET,
      { expiresIn: '30m' },
    );
    return res.json({
      needsProfile: true,
      registrationToken,
      profile: { fullName: profile.name, email, role },
    });
  } catch (err) {
    return sendInternalServerError(res);
  }
});

router.post('/google/complete', mobileRegistrationLimiter, async (req, res) => {
  try {
    let claims;
    try {
      claims = jwt.verify(String(req.body?.registrationToken || ''), JWT_SECRET, { algorithms: ['HS256'] });
    } catch (_) {
      claims = null;
    }
    if (!claims || claims.purpose !== GOOGLE_REGISTRATION_PURPOSE || !isMobileRole(claims.role)) {
      return res.status(401).json({
        error: 'انتهت صلاحية التسجيل عبر Google. ابدأ من جديد.',
        code: 'GOOGLE_REGISTRATION_EXPIRED',
      });
    }

    const text = (value, max) => (typeof value === 'string' ? value.trim().slice(0, max) : '');
    const isDriver = claims.role === 'provider';
    // The name Google gave (or the corrected one); the email's first part
    // when Google has no usable name.
    const fullName = personName(req.body.fullName)
      || personName(claims.name)
      || personName(String(claims.email || '').split('@')[0])
      || '';
    const phone = normalizePhoneNumber(text(req.body.phone, 30));
    const governorate = text(req.body.governorate, 100);
    const area = text(req.body.area, 100);
    const serviceTypes = isDriver
      ? normalizeServiceTypes(req.body.serviceTypes)
      : [];

    // A driver's request goes to admin review with every detail. A customer
    // goes straight in: phone and place are asked with the first order
    // (orders.js) and saved then. When a customer does send them, they
    // must be right.
    const missing = [];
    if (fullName.length < 2) missing.push('fullName');
    if (isDriver || phone) {
      if (!isValidPhoneNumber(phone)) missing.push('phone');
    }
    if (isDriver || governorate || area) {
      if (!governorate) missing.push('governorate');
      if (!area) missing.push('area');
      if (governorate && area && !isValidAreaForGovernorate(governorate, area)) missing.push('area');
    }
    if (isDriver && serviceTypes.length === 0) missing.push('serviceTypes');
    if (missing.length > 0) {
      return res.status(400).json({
        error: missing.length === 1 && missing[0] === 'phone'
          ? INVALID_PHONE_MESSAGE
          : 'أكمل البيانات المطلوبة.',
        code: 'PROFILE_INCOMPLETE',
        fields: missing,
      });
    }
    if (req.body.privacyPolicy !== true) {
      return res.status(400).json({
        error: 'يجب الموافقة على شروط الاستخدام وسياسة الخصوصية.',
        code: 'TERMS_REQUIRED',
      });
    }

    const email = claims.email;
    if (
      await User.exists({ googleId: claims.sub, deleted: { $ne: true } })
      || await findActiveAccountByEmail(email)
    ) {
      return res.status(409).json({
        error: 'يوجد حساب بهذا البريد. سجّل الدخول عبر Google.',
        code: 'ACCOUNT_EXISTS',
      });
    }
    if (await PendingProvider.exists({ $or: [{ googleId: claims.sub }, { email }] })) {
      return res.status(409).json({ error: 'Email already pending review', code: 'ACCOUNT_PENDING_APPROVAL' });
    }

    const password = await unusablePasswordHash();
    const cleanPhone = phone.replace(/[\s-]/g, '');

    if (claims.role === 'provider') {
      await PendingProvider.create({
        fullName,
        email,
        phone: cleanPhone,
        password,
        googleId: claims.sub,
        area,
        governorate,
        serviceTypes,
      });
      return res.status(201).json({
        pending: true,
        message: 'تم تقديم طلب التسجيل بنجاح. حسابك قيد المراجعة من قبل الإدارة.',
      });
    }

    const user = await User.create({
      fullName,
      email,
      password,
      googleId: claims.sub,
      role: 'customer',
      area,
      governorate,
      governorateLevel: false,
      publicId: await generatePublicId(),
      phoneNumbers: cleanPhone ? [{ number: cleanPhone, primary: true }] : [],
      privacyPolicy: true,
    });
    return res.status(201).json(issueMobileSession(user));
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({
        error: 'يوجد حساب بهذا البريد. سجّل الدخول عبر Google.',
        code: 'ACCOUNT_EXISTS',
      });
    }
    return sendInternalServerError(res);
  }
});

router.use(
  '/password-recovery',
  passwordRecoveryRouter,
);

router.post(
  '/logout',
  auth,
  requireRole('customer', 'provider'),
  async (req, res) => {
    try {
      const rotationFilter =
        mobileSessionRotationFilter(
          req.authUser,
        );

      if (!rotationFilter) {
        throw new Error(
          'Invalid mobile session version',
        );
      }

      const rotation =
        await User.updateOne(
          {
            _id: req.userId,
            role: req.userRole,
            ...rotationFilter,
          },
          {
            $inc: {
              sessionVersion: 1,
            },
          },
        );

      if (rotation.matchedCount !== 1) {
        throw new Error(
          'Concurrent session revocation',
        );
      }

      // Logout ends every session of this account, so stop push delivery to
      // all of its devices too (the app's own token removal can race the
      // revocation and fail with 401).
      await PushToken.deleteMany({ userId: req.userId });

      const io = req.app.get('io');

      if (io) {
        io.in(
          `user:${req.userId}`,
        ).disconnectSockets(true);
      }

      return res.json({
        success: true,
        message: 'Logged out',
      });
    } catch (_err) {
      return sendInternalServerError(res);
    }
  },
);

router.get(
  '/me',
  auth,
  requireRole('customer', 'provider'),
  (req, res) => {
    return res.json({
      user: {
        ...publicMobileUser(
          req.authUser,
        ),
        mustChangePassword:
          req.authUser.mustChangePassword === true,
      },
    });
  },
);

module.exports = router;
