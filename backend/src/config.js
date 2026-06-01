const path = require('path');

const isProd = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

function requireEnv(name, fallback) {
  const value = process.env[name] || fallback;
  if (isProd && (!value || (fallback && value === fallback))) {
    console.error(`[config] Missing required env: ${name}`);
    process.exit(1);
  }
  return value;
}

module.exports = {
  isProd,
  isTest,
  PORT: process.env.BACKEND_PORT || process.env.PORT || 4000,
  MONGODB_URI:
    process.env.MONGODB_URI ||
    (isTest ? 'mongodb://127.0.0.1:27017/rekart_oms_test' : 'mongodb://127.0.0.1:27017/rekart_oms'),
  JWT_SECRET: requireEnv('JWT_SECRET', isProd ? undefined : 'dev-change-this-jwt-secret'),
  REFRESH_SECRET: requireEnv('REFRESH_SECRET', isProd ? undefined : 'dev-refresh-secret-change-me'),
  CSRF_SECRET: requireEnv('CSRF_SECRET', isProd ? undefined : 'dev-csrf-secret'),
  WEB_ORIGIN: process.env.WEB_ORIGIN || 'http://localhost:3000',
  ALLOWED_EMAIL_DOMAIN: 'scalify.ae',
  DEFAULT_TENANT_SLUG: process.env.DEFAULT_TENANT_SLUG || 'scalify',
  WAREHOUSE_WHATSAPP: process.env.WAREHOUSE_WHATSAPP || '+971545192005',
  WAREHOUSE_EMAIL: process.env.WAREHOUSE_EMAIL || 'sales@scalify.ae',
  STAFF_LOGIN_EMAIL: (process.env.STAFF_LOGIN_EMAIL || 'sales@scalify.ae').toLowerCase(),
  STAFF_LOGIN_PASSWORD: process.env.STAFF_LOGIN_PASSWORD || (isProd ? undefined : 'Scalify@2026'),
  DATA_DIR: process.env.DATA_DIR || path.join(__dirname, '..', 'data'),
  COOKIE_NAME: 'rekart_token',
  REFRESH_COOKIE: 'rekart_refresh',
  CSRF_COOKIE: 'rekart_csrf',
  ACCESS_MAX_AGE_MS: 60 * 60 * 1000,
  REFRESH_MAX_AGE_MS: 7 * 24 * 60 * 60 * 1000,
  TOKEN_MAX_AGE_MS: 60 * 60 * 1000,
  DEFAULT_PAGE_SIZE: 50,
  MAX_PAGE_SIZE: 100,
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || '',
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || '',
  STRIPE_PRICE_ID: process.env.STRIPE_PRICE_ID || '',
  PLAN_LIMITS: {
    free: { ordersPerMonth: 500, users: 5 },
    pro: { ordersPerMonth: 5000, users: 25 },
    enterprise: { ordersPerMonth: 100000, users: 500 }
  },
  SENTRY_DSN: process.env.SENTRY_DSN || '',
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || '',
  PASSWORD_RESET_TTL_MS: Number(process.env.PASSWORD_RESET_TTL_MS || 60 * 60 * 1000),
  PENDING_2FA_SECRET: requireEnv('PENDING_2FA_SECRET', isProd ? undefined : 'dev-pending-2fa-secret'),
  BACKUP_CRON_ENABLED: process.env.BACKUP_CRON_ENABLED !== 'false',
  BACKUP_CRON_SCHEDULE: process.env.BACKUP_CRON_SCHEDULE || '0 2 * * *',
  BACKUP_RETENTION_COUNT: Number(process.env.BACKUP_RETENTION_COUNT || 7),
  TENANT_BASE_DOMAIN: process.env.TENANT_BASE_DOMAIN || 'localhost'
};
