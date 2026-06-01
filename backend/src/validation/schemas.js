const { z } = require('zod');

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8)
});

const forgotPasswordSchema = z.object({
  email: z.string().email()
});

const resetPasswordSchema = z.object({
  email: z.string().email(),
  token: z.string().min(1),
  newPassword: z.string().min(8)
});

const googleAuthSchema = z.object({
  credential: z.string().min(1)
});

const twoFactorCodeSchema = z.object({
  code: z.string().min(6).max(8)
});

const twoFactorLoginSchema = z.object({
  pendingToken: z.string().min(1),
  code: z.string().min(6).max(8)
});

const orderItemSchema = z.object({
  sku: z.string().optional(),
  name: z.string().min(1),
  brand: z.string().optional(),
  qty: z.coerce.number().int().positive().default(1),
  price: z.coerce.number().min(0).default(0)
});

const orderCreateSchema = z.object({
  id: z.string().optional(),
  service: z.string().min(1).default('Buy'),
  customer: z.string().min(1),
  phone: z.string().min(1),
  device: z.string().optional(),
  serial_number: z.string().optional(),
  serialNumber: z.string().optional(),
  amount: z.coerce.number().min(0).optional(),
  payment: z.string().min(1),
  agent: z.string().min(1),
  location: z.string().min(1),
  status: z.string().min(1).default('Pending'),
  date: z.string().optional(),
  notes: z.string().optional(),
  extras: z.record(z.string()).optional(),
  items: z.array(orderItemSchema).min(1)
});

const orderPatchSchema = z
  .object({
    customer: z.string().min(1).optional(),
    phone: z.string().min(1).optional(),
    device: z.string().min(1).optional(),
    amount: z.coerce.number().min(0).optional(),
    payment: z.string().min(1).optional(),
    agent: z.string().min(1).optional(),
    location: z.string().min(1).optional(),
    serial_number: z.string().optional(),
    notes: z.string().optional(),
    status: z.string().min(1).optional(),
    extras: z.record(z.string()).optional()
  })
  .refine(data => Object.keys(data).length > 0, { message: 'At least one field required' });

const productSchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  brand: z.string().min(1),
  category: z.string().optional(),
  stock: z.coerce.number().optional(),
  price: z.coerce.number().optional(),
  location: z.string().optional(),
  status: z.string().optional()
});

const productImportSchema = z.object({
  products: z.array(productSchema).min(1)
});

const customerUpdateSchema = z.object({
  name: z.string().optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
  email: z.string().email().optional().or(z.literal(''))
});

const agentSchema = z.object({
  name: z.string().min(1).trim()
});

const settingsPatchSchema = z.object({
  settings: z.record(z.string()).optional(),
  default_location: z.string().optional(),
  warehouse_location: z.string().optional(),
  low_stock_threshold: z.coerce.number().optional()
});

const brandingPatchSchema = z.object({
  logoUrl: z.string().optional(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional()
});

const dateRangeQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional()
});

const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
  search: z.string().optional(),
  service: z.string().optional(),
  status: z.string().optional(),
  location: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional()
});

function validateBody(schema) {
  return (req, res, next) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors
      });
    }
    req.body = parsed.data;
    next();
  };
}

function validateQuery(schema) {
  return (req, res, next) => {
    const parsed = schema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors
      });
    }
    req.query = parsed.data;
    next();
  };
}

module.exports = {
  loginSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  googleAuthSchema,
  twoFactorCodeSchema,
  twoFactorLoginSchema,
  orderCreateSchema,
  orderPatchSchema,
  productSchema,
  productImportSchema,
  customerUpdateSchema,
  agentSchema,
  settingsPatchSchema,
  brandingPatchSchema,
  dateRangeQuerySchema,
  paginationQuerySchema,
  validateBody,
  validateQuery
};
