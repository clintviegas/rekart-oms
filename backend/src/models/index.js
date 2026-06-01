const mongoose = require('mongoose');
const config = require('../config');

const tenantFields = {
  tenantId: { type: String, required: true, index: true, default: config.DEFAULT_TENANT_SLUG }
};

const TenantSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    plan: { type: String, enum: ['free', 'pro', 'enterprise'], default: 'pro' },
    stripeCustomerId: String,
    stripeSubscriptionId: String,
    usage: {
      ordersThisMonth: { type: Number, default: 0 },
      monthKey: String
    },
    branding: {
      logoUrl: String,
      primaryColor: { type: String, default: '#055ed7' }
    },
    active: { type: Boolean, default: true }
  },
  { timestamps: true }
);

const UserSchema = new mongoose.Schema(
  {
    ...tenantFields,
    email: { type: String, required: true, lowercase: true, trim: true },
    passwordHash: { type: String, default: '' },
    name: { type: String, required: true },
    role: { type: String, enum: ['admin', 'sales', 'warehouse'], default: 'sales' },
    photo: { type: String, default: '' },
    googleId: { type: String, default: '' },
    totpSecret: { type: String, default: '' },
    totpEnabled: { type: Boolean, default: false },
    passwordResetToken: String,
    passwordResetExpires: Date,
    refreshTokens: [{ token: String, expiresAt: Date }]
  },
  { timestamps: true }
);
UserSchema.index({ tenantId: 1, email: 1 }, { unique: true });

const AgentSchema = new mongoose.Schema(
  {
    ...tenantFields,
    name: { type: String, required: true, trim: true }
  },
  { timestamps: true }
);
AgentSchema.index({ tenantId: 1, name: 1 }, { unique: true });

const OrderItemSchema = new mongoose.Schema(
  {
    sku: String,
    name: { type: String, required: true },
    brand: String,
    qty: { type: Number, default: 1 },
    price: { type: Number, default: 0 }
  },
  { _id: false }
);

const OrderSchema = new mongoose.Schema(
  {
    ...tenantFields,
    orderId: { type: String, required: true },
    service: { type: String, required: true },
    customer: { type: String, required: true },
    phone: String,
    device: { type: String, required: true },
    serial_number: { type: String, default: '' },
    amount: { type: Number, default: 0 },
    payment: String,
    agent: String,
    location: String,
    status: { type: String, default: 'Pending' },
    date: String,
    notes: { type: String, default: '' },
    extras: { type: mongoose.Schema.Types.Mixed, default: {} },
    items: { type: [OrderItemSchema], default: [] }
  },
  { timestamps: true }
);
OrderSchema.index({ tenantId: 1, orderId: 1 }, { unique: true });
OrderSchema.index({ tenantId: 1, service: 1 });
OrderSchema.index({ tenantId: 1, status: 1 });
OrderSchema.index({ tenantId: 1, createdAt: -1 });

const ProductSchema = new mongoose.Schema(
  {
    ...tenantFields,
    sku: { type: String, required: true, uppercase: true, trim: true },
    name: { type: String, required: true },
    brand: { type: String, required: true },
    category: { type: String, default: 'Device' },
    stock: { type: Number, default: 0 },
    price: { type: Number, default: 0 },
    location: String,
    status: { type: String, default: 'Available' }
  },
  { timestamps: true }
);
ProductSchema.index({ tenantId: 1, sku: 1 }, { unique: true });

const NotificationSchema = new mongoose.Schema(
  {
    ...tenantFields,
    orderId: String,
    channel: { type: String, required: true },
    recipient: { type: String, required: true },
    eventType: { type: String, required: true },
    message: { type: String, required: true },
    status: { type: String, required: true },
    link: String
  },
  { timestamps: true }
);

const AuditLogSchema = new mongoose.Schema(
  {
    ...tenantFields,
    entityType: { type: String, required: true },
    entityId: { type: String, required: true },
    action: { type: String, required: true },
    userEmail: String,
    summary: String,
    payload: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

const AppSettingSchema = new mongoose.Schema(
  {
    ...tenantFields,
    key: { type: String, required: true },
    value: { type: String, required: true }
  },
  { timestamps: true }
);
AppSettingSchema.index({ tenantId: 1, key: 1 }, { unique: true });

const CustomerSchema = new mongoose.Schema(
  {
    ...tenantFields,
    phone: { type: String, required: true },
    name: { type: String, required: true },
    email: String,
    notes: { type: String, default: '' },
    tags: [{ type: String }],
    orderCount: { type: Number, default: 0 },
    totalSpent: { type: Number, default: 0 },
    lastOrderAt: Date
  },
  { timestamps: true }
);
CustomerSchema.index({ tenantId: 1, phone: 1 }, { unique: true });

module.exports = {
  Tenant: mongoose.models.Tenant || mongoose.model('Tenant', TenantSchema),
  User: mongoose.models.User || mongoose.model('User', UserSchema),
  Agent: mongoose.models.Agent || mongoose.model('Agent', AgentSchema),
  Order: mongoose.models.Order || mongoose.model('Order', OrderSchema),
  Product: mongoose.models.Product || mongoose.model('Product', ProductSchema),
  Notification: mongoose.models.Notification || mongoose.model('Notification', NotificationSchema),
  AuditLog: mongoose.models.AuditLog || mongoose.model('AuditLog', AuditLogSchema),
  AppSetting: mongoose.models.AppSetting || mongoose.model('AppSetting', AppSettingSchema),
  Customer: mongoose.models.Customer || mongoose.model('Customer', CustomerSchema)
};
