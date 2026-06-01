const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const config = require('../config');
const { User } = require('../models');
const { sendPasswordResetEmail } = require('./notify');

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function generateResetToken() {
  return crypto.randomBytes(32).toString('hex');
}

async function requestPasswordReset(email, tenantId) {
  const normalized = email.trim().toLowerCase();
  const user = await User.findOne({ email: normalized, tenantId });
  if (!user) return { ok: true };

  const token = generateResetToken();
  user.passwordResetToken = hashToken(token);
  user.passwordResetExpires = new Date(Date.now() + config.PASSWORD_RESET_TTL_MS);
  await user.save();

  const resetUrl = `${config.WEB_ORIGIN}/reset-password?token=${token}&email=${encodeURIComponent(normalized)}`;
  await sendPasswordResetEmail(normalized, resetUrl);
  return { ok: true };
}

async function resetPasswordWithToken(email, token, newPassword) {
  const normalized = email.trim().toLowerCase();
  const user = await User.findOne({
    email: normalized,
    passwordResetToken: hashToken(token),
    passwordResetExpires: { $gt: new Date() }
  });
  if (!user) {
    const err = new Error('Invalid or expired reset link');
    err.status = 400;
    throw err;
  }
  user.passwordHash = bcrypt.hashSync(newPassword, 10);
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();
  return { ok: true };
}

module.exports = { requestPasswordReset, resetPasswordWithToken };
