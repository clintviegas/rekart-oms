const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const config = require('../config');

function signAccessToken(user) {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      name: user.name,
      photo: user.photo || '',
      role: user.role || 'sales',
      tenantId: user.tenantId || config.DEFAULT_TENANT_SLUG
    },
    config.JWT_SECRET,
    { expiresIn: '1h' }
  );
}

function signRefreshToken(user) {
  return jwt.sign(
    { userId: user.id, tenantId: user.tenantId || config.DEFAULT_TENANT_SLUG, type: 'refresh' },
    config.REFRESH_SECRET,
    { expiresIn: '7d' }
  );
}

function signPending2FAToken(userId, tenantId) {
  return jwt.sign({ userId, tenantId, type: 'pending2fa' }, config.PENDING_2FA_SECRET, { expiresIn: '5m' });
}

function verifyPending2FAToken(token) {
  try {
    const payload = jwt.verify(token, config.PENDING_2FA_SECRET);
    if (payload.type !== 'pending2fa') return null;
    return payload;
  } catch {
    return null;
  }
}

function authUser(req) {
  const header = req.headers.authorization || '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7) : null;
  const cookieToken = req.cookies?.[config.COOKIE_NAME] || null;
  const token = bearer || cookieToken;
  if (!token) return null;
  try {
    return jwt.verify(token, config.JWT_SECRET);
  } catch {
    return null;
  }
}

function verifyRefreshToken(token) {
  try {
    const payload = jwt.verify(token, config.REFRESH_SECRET);
    if (payload.type !== 'refresh') return null;
    return payload;
  } catch {
    return null;
  }
}

function requireAuth(req, res, next) {
  const user = authUser(req);
  if (!user) return res.status(401).json({ error: 'Please sign in' });
  req.user = user;
  req.tenantId = user.tenantId || config.DEFAULT_TENANT_SLUG;
  next();
}

const ROLE_PERMISSIONS = {
  admin: ['*'],
  sales: ['orders:read', 'orders:write', 'products:read', 'customers:read', 'customers:write'],
  warehouse: ['orders:read', 'products:read', 'products:write']
};

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

function requirePermission(permission) {
  return (req, res, next) => {
    const role = req.user?.role || 'warehouse';
    const perms = ROLE_PERMISSIONS[role] || [];
    if (!perms.includes('*') && !perms.includes(permission)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

function setAuthCookies(res, accessToken, refreshToken) {
  res.cookie(config.COOKIE_NAME, accessToken, {
    httpOnly: true,
    secure: config.isProd,
    sameSite: config.isProd ? 'none' : 'lax',
    maxAge: config.ACCESS_MAX_AGE_MS,
    path: '/'
  });
  res.cookie(config.REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    secure: config.isProd,
    sameSite: config.isProd ? 'none' : 'lax',
    maxAge: config.REFRESH_MAX_AGE_MS,
    path: '/api/auth'
  });
}

function setCsrfCookie(res, token) {
  res.cookie(config.CSRF_COOKIE, token, {
    httpOnly: false,
    secure: config.isProd,
    sameSite: config.isProd ? 'none' : 'lax',
    maxAge: config.REFRESH_MAX_AGE_MS,
    path: '/'
  });
}

function generateCsrfToken() {
  return crypto.randomBytes(32).toString('hex');
}

function clearAuthCookies(res) {
  res.clearCookie(config.COOKIE_NAME, { path: '/', httpOnly: true });
  res.clearCookie(config.REFRESH_COOKIE, { path: '/api/auth', httpOnly: true });
  res.clearCookie(config.CSRF_COOKIE, { path: '/' });
}

module.exports = {
  signAccessToken,
  signRefreshToken,
  signPending2FAToken,
  verifyPending2FAToken,
  authUser,
  verifyRefreshToken,
  requireAuth,
  requireRole,
  requirePermission,
  setAuthCookies,
  setCsrfCookie,
  generateCsrfToken,
  clearAuthCookies,
  ROLE_PERMISSIONS
};
