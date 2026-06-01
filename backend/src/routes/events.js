const { subscribeClient } = require('../services/events');
const { requireAuth } = require('../middleware/auth');

function createEventsRouter() {
  const router = require('express').Router();

  router.get('/stream', requireAuth, (req, res) => {
    subscribeClient(req.tenantId, res);
  });

  return router;
}

module.exports = { createEventsRouter };
