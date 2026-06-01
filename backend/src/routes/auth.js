const bcrypt = require('bcryptjs');
const config = require('../config');
const { User, Tenant } = require('../models');
const {
  signAccessToken,
  signRefreshToken,
  signPending2FAToken,
  verifyPending2FAToken,
  verifyRefreshToken,
  requireAuth,
  setAuthCookies,
  setCsrfCookie,
  generateCsrfToken,
  clearAuthCookies
} = require('../middleware/auth');
const { loginLimiter } = require('../middleware/rateLimit');
const {
  loginSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  googleAuthSchema,
  twoFactorCodeSchema,
  twoFactorLoginSchema,
  validateBody
} = require('../validation/schemas');
const { verifyGoogleCredential } = require('../services/googleOAuth');
const { generateSecret, verifyToken, buildOtpAuthUrl } = require('../services/twoFactor');
const { requestPasswordReset, resetPasswordWithToken } = require('../services/passwordReset');

function userPayload(doc) {
  return {
    id: String(doc._id),
    email: doc.email,
    name: doc.name,
    photo: doc.photo || '',
    role: doc.role,
    tenantId: doc.tenantId,
    totpEnabled: Boolean(doc.totpEnabled)
  };
}

function resolveTenantId(req) {
  return req.resolvedTenantSlug || config.DEFAULT_TENANT_SLUG;
}

async function buildAuthResponse(res, userDoc) {
  const user = userPayload(userDoc);
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  const csrf = generateCsrfToken();
  setAuthCookies(res, accessToken, refreshToken);
  setCsrfCookie(res, csrf);
  const tenant = await Tenant.findOne({ slug: user.tenantId }).lean();
  return {
    ok: true,
    token: accessToken,
    csrfToken: csrf,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      photo: user.photo,
      role: user.role,
      totpEnabled: user.totpEnabled
    },
    tenant: {
      id: tenant?.slug || user.tenantId,
      slug: tenant?.slug || user.tenantId,
      name: tenant?.name || 'Scalify / Rekart',
      plan: tenant?.plan || 'pro',
      branding: tenant?.branding || { primaryColor: '#055ed7', logoUrl: '' }
    }
  };
}

function createAuthRouter() {
  const router = require('express').Router();

  router.post('/login', loginLimiter, validateBody(loginSchema), async (req, res, next) => {
    try {
      const email = req.body.email.trim().toLowerCase();
      const password = req.body.password;
      const tenantId = resolveTenantId(req);

      if (!email.endsWith(`@${config.ALLOWED_EMAIL_DOMAIN}`)) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      const userDoc = await User.findOne({ email, tenantId });
      if (!userDoc || !userDoc.passwordHash || !bcrypt.compareSync(password, userDoc.passwordHash)) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      if (userDoc.totpEnabled && userDoc.totpSecret) {
        const pendingToken = signPending2FAToken(String(userDoc._id), userDoc.tenantId);
        return res.json({ ok: true, requires2fa: true, pendingToken });
      }

      res.json(await buildAuthResponse(res, userDoc));
    } catch (err) {
      next(err);
    }
  });

  router.post('/2fa/verify-login', loginLimiter, validateBody(twoFactorLoginSchema), async (req, res, next) => {
    try {
      const payload = verifyPending2FAToken(req.body.pendingToken);
      if (!payload) return res.status(401).json({ error: '2FA session expired — sign in again' });

      const userDoc = await User.findById(payload.userId);
      if (!userDoc || !userDoc.totpEnabled || !verifyToken(userDoc.totpSecret, req.body.code)) {
        return res.status(401).json({ error: 'Invalid 2FA code' });
      }

      res.json(await buildAuthResponse(res, userDoc));
    } catch (err) {
      next(err);
    }
  });

  router.post('/google', loginLimiter, validateBody(googleAuthSchema), async (req, res, next) => {
    try {
      const profile = await verifyGoogleCredential(req.body.credential);
      if (!profile.email.endsWith(`@${config.ALLOWED_EMAIL_DOMAIN}`)) {
        return res.status(403).json({ error: 'Google account domain not allowed' });
      }

      const tenantId = resolveTenantId(req);
      let userDoc = await User.findOne({ email: profile.email, tenantId });
      if (!userDoc) {
        userDoc = await User.create({
          tenantId,
          email: profile.email,
          name: profile.name,
          photo: profile.photo,
          googleId: profile.googleId,
          passwordHash: '',
          role: 'sales'
        });
      } else {
        userDoc.googleId = profile.googleId;
        if (profile.photo) userDoc.photo = profile.photo;
        await userDoc.save();
      }

      if (userDoc.totpEnabled && userDoc.totpSecret) {
        const pendingToken = signPending2FAToken(String(userDoc._id), userDoc.tenantId);
        return res.json({ ok: true, requires2fa: true, pendingToken });
      }

      res.json(await buildAuthResponse(res, userDoc));
    } catch (err) {
      next(err);
    }
  });

  router.post('/forgot-password', loginLimiter, validateBody(forgotPasswordSchema), async (req, res, next) => {
    try {
      const tenantId = resolveTenantId(req);
      await requestPasswordReset(req.body.email, tenantId);
      res.json({ ok: true, message: 'If that email exists, a reset link was sent.' });
    } catch (err) {
      next(err);
    }
  });

  router.post('/reset-password', loginLimiter, validateBody(resetPasswordSchema), async (req, res, next) => {
    try {
      await resetPasswordWithToken(req.body.email, req.body.token, req.body.newPassword);
      res.json({ ok: true, message: 'Password reset. You can sign in now.' });
    } catch (err) {
      if (err.status) return res.status(err.status).json({ error: err.message });
      next(err);
    }
  });

  router.post('/2fa/setup', requireAuth, async (req, res, next) => {
    try {
      const userDoc = await User.findById(req.user.userId);
      if (!userDoc) return res.status(404).json({ error: 'User not found' });
      const secret = generateSecret();
      userDoc.totpSecret = secret;
      userDoc.totpEnabled = false;
      await userDoc.save();
      const qr = await buildOtpAuthUrl(userDoc.email, secret);
      res.json({ secret, qrDataUrl: qr.qrDataUrl });
    } catch (err) {
      next(err);
    }
  });

  router.post('/2fa/enable', requireAuth, validateBody(twoFactorCodeSchema), async (req, res, next) => {
    try {
      const userDoc = await User.findById(req.user.userId);
      if (!userDoc?.totpSecret) return res.status(400).json({ error: 'Run 2FA setup first' });
      if (!verifyToken(userDoc.totpSecret, req.body.code)) {
        return res.status(400).json({ error: 'Invalid verification code' });
      }
      userDoc.totpEnabled = true;
      await userDoc.save();
      res.json({ ok: true, totpEnabled: true });
    } catch (err) {
      next(err);
    }
  });

  router.post('/2fa/disable', requireAuth, validateBody(twoFactorCodeSchema), async (req, res, next) => {
    try {
      const userDoc = await User.findById(req.user.userId);
      if (!userDoc?.totpSecret) return res.status(400).json({ error: '2FA is not enabled' });
      if (!verifyToken(userDoc.totpSecret, req.body.code)) {
        return res.status(400).json({ error: 'Invalid verification code' });
      }
      userDoc.totpEnabled = false;
      userDoc.totpSecret = '';
      await userDoc.save();
      res.json({ ok: true, totpEnabled: false });
    } catch (err) {
      next(err);
    }
  });

  router.post('/refresh', async (req, res, next) => {
    try {
      const refreshToken = req.cookies?.[config.REFRESH_COOKIE];
      if (!refreshToken) return res.status(401).json({ error: 'Refresh token missing' });

      const payload = verifyRefreshToken(refreshToken);
      if (!payload) return res.status(401).json({ error: 'Invalid refresh token' });

      const userDoc = await User.findById(payload.userId);
      if (!userDoc) return res.status(401).json({ error: 'User not found' });

      const user = userPayload(userDoc);
      const accessToken = signAccessToken(user);
      const newRefresh = signRefreshToken(user);
      const csrf = generateCsrfToken();
      setAuthCookies(res, accessToken, newRefresh);
      setCsrfCookie(res, csrf);
      res.json({ ok: true, token: accessToken, csrfToken: csrf });
    } catch (err) {
      next(err);
    }
  });

  router.post('/logout', (req, res) => {
    clearAuthCookies(res);
    res.json({ ok: true });
  });

  router.post('/change-password', requireAuth, validateBody(changePasswordSchema), async (req, res, next) => {
    try {
      const userDoc = await User.findById(req.user.userId);
      if (!userDoc) return res.status(404).json({ error: 'User not found' });
      if (!userDoc.passwordHash || !bcrypt.compareSync(req.body.currentPassword, userDoc.passwordHash)) {
        return res.status(400).json({ error: 'Current password is incorrect' });
      }
      userDoc.passwordHash = bcrypt.hashSync(req.body.newPassword, 10);
      await userDoc.save();
      clearAuthCookies(res);
      res.json({ ok: true, message: 'Password changed. Please sign in again.' });
    } catch (err) {
      next(err);
    }
  });

  router.get('/csrf', requireAuth, (req, res) => {
    const csrf = generateCsrfToken();
    setCsrfCookie(res, csrf);
    res.json({ csrfToken: csrf });
  });

  router.get('/me', requireAuth, async (req, res, next) => {
    try {
      const tenant = await Tenant.findOne({ slug: req.tenantId }).lean();
      const userDoc = await User.findById(req.user.userId).lean();
      res.json({
        authenticated: true,
        user: {
          id: req.user.userId,
          email: req.user.email,
          name: req.user.name,
          photo: req.user.photo,
          role: req.user.role,
          totpEnabled: Boolean(userDoc?.totpEnabled)
        },
        tenant: {
          id: tenant?.slug || req.tenantId,
          slug: tenant?.slug || req.tenantId,
          name: tenant?.name || 'Scalify / Rekart',
          plan: tenant?.plan || 'pro',
          branding: tenant?.branding || { primaryColor: '#055ed7', logoUrl: '' }
        },
        domain: config.ALLOWED_EMAIL_DOMAIN
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

module.exports = { createAuthRouter };
