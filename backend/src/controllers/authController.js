const bcrypt = require('bcrypt');
const crypto = require('crypto');
const User = require('../models/User');
const RevokedToken = require('../models/RevokedToken');
const { audit } = require('../services/auditService');
const { issueToken, decodeToken } = require('../services/tokenService');
const { nodeEnv } = require('../config/env');

const PUBLIC_ROLES = ['QUESTION_SETTER', 'REVIEWER', 'SECURITY_OFFICER', 'EXAM_AUTHORITY'];
const safeUser = (user) => ({ id: user._id, name: user.name, email: user.email, role: user.role, mfaEnabled: user.mfaEnabled, isActive: user.isActive, createdAt: user.createdAt, lastLoginAt: user.lastLoginAt });
const validPassword = (password) => typeof password === 'string' && password.length >= 8 && password.length <= 128;
const normalizedEmail = (email) => typeof email === 'string' ? email.trim().toLowerCase() : '';
async function createOtp(user, request, action) {
  const otp = crypto.randomInt(100000, 1000000).toString();
  user.mfaCodeHash = await bcrypt.hash(otp, 12);
  user.mfaExpiresAt = new Date(Date.now() + 5 * 60 * 1000);
  await user.save();
  await audit(request, action, { userId: user._id, role: user.role });
  if (nodeEnv === 'development') console.log(`Development OTP for ${user.email}: ${otp}`);
}

async function register(request, response, next) {
  try {
    const { name, password, role } = request.body;
    const email = normalizedEmail(request.body.email);
    if (!name?.trim() || !email || !validPassword(password) || !PUBLIC_ROLES.includes(role)) return response.status(400).json({ success: false, message: 'Provide a valid name, email, password, and permitted role.' });
    const user = await User.create({ name: name.trim(), email, role, passwordHash: await bcrypt.hash(password, 12) });
    await audit(request, 'REGISTRATION', { userId: user._id, role: user.role });
    return response.status(201).json({ success: true, message: 'Account created. Please sign in to continue.', user: safeUser(user) });
  } catch (error) {
    if (error.code === 11000) return response.status(409).json({ success: false, message: 'An account with that email already exists.' });
    next(error);
  }
}
async function login(request, response, next) {
  try {
    const email = normalizedEmail(request.body.email);
    const { password } = request.body;
    await audit(request, 'LOGIN_ATTEMPT', { metadata: { email } });
    const user = await User.findOne({ email }).select('+passwordHash +mfaCodeHash +mfaExpiresAt');
    const valid = user && user.isActive && validPassword(password) && await bcrypt.compare(password, user.passwordHash);
    if (!valid) { await audit(request, 'LOGIN_FAILED', { userId: user?._id, role: user?.role, metadata: { email } }); return response.status(401).json({ success: false, message: 'Invalid email or password.' }); }
    await createOtp(user, request, 'LOGIN_OTP_ISSUED');
    return response.status(200).json({ success: true, message: 'OTP verification required.', challengeId: user._id.toString() });
  } catch (error) { next(error); }
}
async function verifyOtp(request, response, next) {
  try {
    const { challengeId, otp } = request.body;
    if (!/^[0-9]{6}$/.test(otp || '')) { await audit(request, 'OTP_VERIFICATION_FAILED'); return response.status(400).json({ success: false, message: 'OTP must contain exactly 6 digits.' }); }
    const user = await User.findById(challengeId).select('+mfaCodeHash +mfaExpiresAt');
    const matches = user?.isActive && user.mfaCodeHash && user.mfaExpiresAt > new Date() && await bcrypt.compare(otp, user.mfaCodeHash);
    if (!matches) { await audit(request, 'OTP_VERIFICATION_FAILED', { userId: user?._id, role: user?.role }); return response.status(401).json({ success: false, message: 'Invalid or expired OTP.' }); }
    user.mfaCodeHash = undefined; user.mfaExpiresAt = undefined; user.lastLoginAt = new Date(); await user.save();
    const token = issueToken(user);
    await audit(request, 'LOGIN_SUCCESS', { userId: user._id, role: user.role });
    return response.json({ success: true, message: 'Authentication successful.', token, user: safeUser(user) });
  } catch (error) { next(error); }
}
async function resendOtp(request, response, next) {
  try {
    const user = await User.findById(request.body.challengeId).select('+mfaCodeHash +mfaExpiresAt');
    if (!user || !user.isActive) return response.status(400).json({ success: false, message: 'Login challenge is unavailable.' });
    await createOtp(user, request, 'OTP_RESENT');
    return response.json({ success: true, message: 'A new OTP has been generated.' });
  } catch (error) { next(error); }
}
async function logout(request, response, next) {
  try {
    const decoded = decodeToken(request.token);
    if (decoded?.jti && decoded.exp) await RevokedToken.create({ jti: decoded.jti, expiresAt: new Date(decoded.exp * 1000) });
    await audit(request, 'LOGOUT');
    return response.json({ success: true, message: 'Logged out successfully.' });
  } catch (error) { next(error); }
}
function me(request, response) { response.json({ success: true, user: safeUser(request.user) }); }
module.exports = { register, login, verifyOtp, resendOtp, logout, me, safeUser };
