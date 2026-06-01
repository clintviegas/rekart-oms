function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Server error';

  if (status >= 500) {
    console.error('[error]', req.method, req.path, message);
    try {
      const { Sentry } = require('../instrument');
      if (Sentry) Sentry.captureException(err);
    } catch {
      /* ignore */
    }
  }

  res.status(status).json({
    error: status >= 500 ? 'Server error' : message,
    details: err.details || undefined
  });
}

module.exports = { errorHandler };
