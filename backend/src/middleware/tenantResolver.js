const config = require('../config');
const { Tenant } = require('../models');

function parseSubdomain(host) {
  if (!host) return null;
  const hostname = host.split(':')[0].toLowerCase();
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
    const parts = hostname.split('.');
    if (parts.length >= 2 && parts[0] !== 'localhost') return parts[0];
    return null;
  }
  const parts = hostname.split('.');
  if (parts.length >= 3) return parts[0];
  return null;
}

async function tenantResolver(req, res, next) {
  try {
    const headerSlug = req.headers['x-tenant-slug'];
    const querySlug = req.query.tenant;
    const subdomain = parseSubdomain(req.headers.host);
    const slug = String(headerSlug || querySlug || subdomain || config.DEFAULT_TENANT_SLUG).toLowerCase();

    const tenant = await Tenant.findOne({ slug, active: { $ne: false } }).lean();
    req.resolvedTenantSlug = tenant?.slug || config.DEFAULT_TENANT_SLUG;
    req.resolvedTenant = tenant;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { tenantResolver, parseSubdomain };
