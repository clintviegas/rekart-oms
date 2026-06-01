const config = require('./config');

if (config.SENTRY_DSN) {
  try {
    const Sentry = require('@sentry/node');
    Sentry.init({
      dsn: config.SENTRY_DSN,
      environment: config.isProd ? 'production' : 'development',
      tracesSampleRate: config.isProd ? 0.2 : 1.0
    });
    module.exports = { Sentry };
  } catch (err) {
    console.warn('[sentry] Failed to init:', err.message);
    module.exports = { Sentry: null };
  }
} else {
  module.exports = { Sentry: null };
}
