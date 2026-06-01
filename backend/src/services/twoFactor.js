const { authenticator } = require('otplib');
const QRCode = require('qrcode');

authenticator.options = { window: 1 };

function generateSecret() {
  return authenticator.generateSecret();
}

function verifyToken(secret, token) {
  if (!secret || !token) return false;
  return authenticator.verify({ token: String(token).replace(/\s/g, ''), secret });
}

async function buildOtpAuthUrl(email, secret) {
  const otpauth = authenticator.keyuri(email, 'Rekart OMS', secret);
  const qrDataUrl = await QRCode.toDataURL(otpauth);
  return { otpauth, qrDataUrl };
}

module.exports = { generateSecret, verifyToken, buildOtpAuthUrl };
