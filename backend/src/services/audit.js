const { AuditLog } = require('../models');

async function logAudit({ tenantId, entityType, entityId, action, userEmail, summary, payload }) {
  await AuditLog.create({
    tenantId,
    entityType,
    entityId,
    action,
    userEmail: userEmail || '',
    summary: summary || '',
    payload: payload || {}
  });
}

async function listAudit(tenantId, { entityType, entityId, limit = 50 }) {
  const filter = { tenantId };
  if (entityType) filter.entityType = entityType;
  if (entityId) filter.entityId = entityId;
  return AuditLog.find(filter).sort({ createdAt: -1 }).limit(limit).lean();
}

module.exports = { logAudit, listAudit };
