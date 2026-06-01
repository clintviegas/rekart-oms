require('dotenv').config({ path: require('path').join(__dirname, '.env') });
require('./src/instrument');

const dns = require('dns');
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');

dns.setDefaultResultOrder('ipv4first');

const config = require('./src/config');
const { connectDb, healthCheck } = require('./src/db');
const { errorHandler } = require('./src/middleware/errorHandler');
const { apiLimiter } = require('./src/middleware/rateLimit');
const { csrfProtection } = require('./src/middleware/csrf');
const { requestLogger } = require('./src/middleware/logger');
const { tenantResolver } = require('./src/middleware/tenantResolver');
const { createAuthRouter } = require('./src/routes/auth');
const { createOrdersRouter } = require('./src/routes/orders');
const { createProductsRouter } = require('./src/routes/products');
const { createAgentsRouter } = require('./src/routes/agents');
const { createNotificationsRouter } = require('./src/routes/notifications');
const { createSettingsRouter } = require('./src/routes/settings');
const { createCustomersRouter } = require('./src/routes/customers');
const { createBillingRouter, stripeWebhook } = require('./src/routes/billing');
const { createEventsRouter } = require('./src/routes/events');
const { createReportsRouter, createBackupRouter } = require('./src/routes/reports');
const { verifyEmailTransport } = require('./src/services/notify');
const { startBackupScheduler } = require('./src/jobs/backupScheduler');

function buildApp() {
  const app = express();

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: false
    })
  );
  app.use(cors({ origin: config.WEB_ORIGIN, credentials: true }));
  app.use(cookieParser());
  app.use(requestLogger);

  app.post('/api/billing/webhook', express.raw({ type: 'application/json' }), stripeWebhook);

  app.use(express.json({ limit: '5mb' }));
  app.use('/api', apiLimiter);
  app.use('/api', tenantResolver);
  app.use('/api', csrfProtection);
  app.use('/public', express.static(path.join(__dirname, 'public'), { maxAge: '7d' }));

  app.get('/health', async (_, res) => {
    try {
      const ok = await healthCheck();
      res.json({ ok, service: 'backend', db: ok ? 'mongodb' : 'disconnected' });
    } catch {
      res.status(503).json({ ok: false, service: 'backend', db: 'error' });
    }
  });

  app.use('/api/auth', createAuthRouter());
  app.use('/api/orders', createOrdersRouter());
  app.use('/api/products', createProductsRouter());
  app.use('/api/agents', createAgentsRouter());
  app.use('/api/notifications', createNotificationsRouter());
  app.use('/api/settings', createSettingsRouter());
  app.use('/api/customers', createCustomersRouter());
  app.use('/api/billing', createBillingRouter());
  app.use('/api/events', createEventsRouter());
  app.use('/api/reports', createReportsRouter());
  app.use('/api/backup', createBackupRouter());

  app.use(errorHandler);
  return app;
}

let appInstance;
let serverInstance;

async function getApp() {
  if (!appInstance) {
    await connectDb();
    appInstance = buildApp();
  }
  return appInstance;
}

async function shutdown() {
  if (serverInstance) {
    await new Promise(resolve => serverInstance.close(resolve));
    serverInstance = null;
  }
  const { disconnectDb } = require('./src/db');
  await disconnectDb().catch(() => undefined);
  appInstance = null;
}

async function start() {
  const app = await getApp();
  if (!config.isTest) startBackupScheduler();

  await new Promise((resolve, reject) => {
    serverInstance = app.listen(config.PORT, () => {
      console.log(`\nRekart backend  →  http://localhost:${config.PORT}`);
      console.log(`MongoDB         →  ${config.MONGODB_URI}\n`);
      verifyEmailTransport();
      resolve();
    });

    serverInstance.on('error', err => {
      if (err.code === 'EADDRINUSE') {
        console.error(`\n[startup] Port ${config.PORT} is already in use. Stop the other backend first.\n`);
        process.exit(1);
      }
      reject(err);
    });
  });
}

if (require.main === module) {
  start().catch(err => {
    console.error('[startup]', err.message);
    process.exit(1);
  });

  const onStop = () => {
    shutdown()
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  };

  process.once('SIGTERM', onStop);
  process.once('SIGINT', onStop);
}

module.exports = { getApp, start, buildApp, shutdown };
