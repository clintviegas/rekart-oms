const config = require('../config');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function csrfProtection(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();
  if (req.path.startsWith('/auth/login') || req.path.startsWith('/auth/refresh')) return next();
  if (req.path.startsWith('/auth/google')) return next();
  if (req.path.startsWith('/auth/forgot-password')) return next();
  if (req.path.startsWith('/auth/reset-password')) return next();
  if (req.path.startsWith('/auth/2fa/verify-login')) return next();
  if (req.path.startsWith('/billing/webhook')) return next();

  const cookieToken = req.cookies?.[config.CSRF_COOKIE];
  const headerToken = req.headers['x-csrf-token'];
  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }
  next();
}

module.exports = { csrfProtection };
