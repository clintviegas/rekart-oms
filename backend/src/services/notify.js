const nodemailer = require('nodemailer');
const config = require('../config');
const { Notification, Order } = require('../models');

function emailTransportConfig() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) return null;
  return {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true' || Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    family: 4,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000
  };
}

const emailTransport = emailTransportConfig()
  ? nodemailer.createTransport(emailTransportConfig())
  : null;

function orderIdOf(order) {
  return order.orderId || order.id;
}

function notificationMessage(eventType, order) {
  return `Rekart OMS ${eventType}\nOrder: ${orderIdOf(order)}\nService: ${order.service}\nCustomer: ${order.customer}\nPhone: ${order.phone || ''}\nDevice: ${order.device}\nSerial: ${order.serial_number || ''}\nLocation: ${order.location || ''}\nStatus: ${order.status || ''}\nAmount: AED ${Number(order.amount || 0).toLocaleString()}`;
}

function notificationSubject(eventType, order) {
  const label = eventType === 'order.created' ? 'New warehouse order' : eventType.replace('order.', 'Order ');
  return `Rekart OMS: ${label} ${orderIdOf(order)}`;
}

function notificationHtml(eventType, order) {
  const safe = v =>
    String(v ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  return `<div style="font-family:Arial,sans-serif"><h2>${safe(notificationSubject(eventType, order))}</h2><p>${safe(notificationMessage(eventType, order)).replace(/\n/g, '<br>')}</p></div>`;
}

async function sendWarehouseEmail(eventType, order, message) {
  if (!emailTransport) return 'pending_config';
  try {
    await emailTransport.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: config.WAREHOUSE_EMAIL,
      subject: notificationSubject(eventType, order),
      text: message,
      html: notificationHtml(eventType, order)
    });
    return 'sent';
  } catch (err) {
    console.error('[email]', err.message);
    return 'failed';
  }
}

async function notifyWarehouse(order, eventType) {
  const tenantId = order.tenantId || config.DEFAULT_TENANT_SLUG;
  const message = notificationMessage(eventType, order);
  const emailStatus = await sendWarehouseEmail(eventType, order, message);
  await Notification.create({
    tenantId,
    orderId: orderIdOf(order),
    channel: 'email',
    recipient: config.WAREHOUSE_EMAIL,
    eventType,
    message,
    status: emailStatus,
    link: `mailto:${config.WAREHOUSE_EMAIL}`
  });

  const normalizedPhone = config.WAREHOUSE_WHATSAPP.replace(/\D/g, '');
  const link = `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;
  let waStatus = 'fallback_link';
  if (process.env.WHATSAPP_CLOUD_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID) {
    try {
      const response = await fetch(
        `https://graph.facebook.com/v19.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.WHATSAPP_CLOUD_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: normalizedPhone,
            type: 'text',
            text: { body: message }
          })
        }
      );
      waStatus = response.ok ? 'sent' : 'failed';
    } catch {
      waStatus = 'failed';
    }
  }
  await Notification.create({
    tenantId,
    orderId: orderIdOf(order),
    channel: 'whatsapp',
    recipient: config.WAREHOUSE_WHATSAPP,
    eventType,
    message,
    status: waStatus,
    link
  });

  return { emailStatus, waStatus };
}

async function retryNotification(notificationId) {
  const row = await Notification.findById(notificationId);
  if (!row) {
    const err = new Error('Notification not found');
    err.status = 404;
    throw err;
  }
  if (row.channel !== 'email') {
    const err = new Error('Only email notifications can be retried');
    err.status = 400;
    throw err;
  }
  if (!row.orderId) {
    const err = new Error('Notification has no linked order');
    err.status = 400;
    throw err;
  }

  const order = await Order.findOne({ orderId: row.orderId });
  if (!order) {
    const err = new Error('Linked order not found');
    err.status = 404;
    throw err;
  }

  const status = await sendWarehouseEmail(row.eventType, order, row.message);
  row.status = status;
  await row.save();
  return { id: notificationId, status };
}

function verifyEmailTransport() {
  if (!emailTransport) return Promise.resolve();
  return emailTransport
    .verify()
    .then(() => console.log(`[email] SMTP ready → ${config.WAREHOUSE_EMAIL}`))
    .catch(err => console.warn('[email] SMTP verify failed:', err.message));
}

async function sendPasswordResetEmail(to, resetUrl) {
  if (!emailTransport) {
    console.log(`[email] Password reset (SMTP not configured) → ${to}: ${resetUrl}`);
    return 'pending_config';
  }
  try {
    await emailTransport.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject: 'Rekart OMS — Reset your password',
      text: `Reset your Rekart OMS password:\n\n${resetUrl}\n\nThis link expires in 1 hour.`,
      html: `<div style="font-family:Arial,sans-serif"><h2>Reset your password</h2><p><a href="${resetUrl}">Click here to reset your password</a></p><p>This link expires in 1 hour.</p></div>`
    });
    return 'sent';
  } catch (err) {
    console.error('[email] reset failed:', err.message);
    return 'failed';
  }
}

module.exports = {
  notifyWarehouse,
  retryNotification,
  verifyEmailTransport,
  sendPasswordResetEmail,
  sendTestEmail: async () => {
    if (!emailTransport) return 'pending_config';
    await emailTransport.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: config.WAREHOUSE_EMAIL,
      subject: 'Rekart OMS: Test email',
      text: 'This is a test email from Rekart OMS integrations panel.'
    });
    return 'sent';
  }
};
