require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const config = require('../src/config');
const { User, Tenant } = require('../src/models');

async function main() {
  const email = (process.argv[2] || config.STAFF_LOGIN_EMAIL || 'sales@scalify.ae').toLowerCase();
  const password = process.argv[3] || config.STAFF_LOGIN_PASSWORD || 'Scalify@2026';
  const tenantSlug = config.DEFAULT_TENANT_SLUG;

  await mongoose.connect(config.MONGODB_URI);

  await Tenant.findOneAndUpdate(
    { slug: tenantSlug },
    { slug: tenantSlug, name: 'Scalify / Rekart', plan: 'pro', active: true },
    { upsert: true }
  );

  await User.findOneAndUpdate(
    { tenantId: tenantSlug, email },
    {
      tenantId: tenantSlug,
      email,
      passwordHash: bcrypt.hashSync(password, 10),
      name: 'Sales Team',
      role: 'admin',
      totpEnabled: false,
      totpSecret: ''
    },
    { upsert: true, setDefaultsOnInsert: true }
  );

  console.log(`\nLogin ready\n  Email:    ${email}\n  Password: ${password}\n  Role:     admin\n  Tenant:   ${tenantSlug}\n`);

  await mongoose.disconnect();
}

main().catch(err => {
  console.error('[create-admin]', err.message);
  process.exit(1);
});
