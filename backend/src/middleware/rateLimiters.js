const rateLimit = require('express-rate-limit');

function authLimiter(max) {
  // Automated integration tests exercise many security cases from one IP.
  const effectiveMax = process.env.NODE_ENV === 'test' ? 100 : max;
  return rateLimit({ windowMs: 15 * 60 * 1000, max: effectiveMax, standardHeaders: true, legacyHeaders: false,
    message: { success: false, message: 'Too many attempts. Please try again later.' } });
}
module.exports = { registerLimiter: authLimiter(20), loginLimiter: authLimiter(10), otpLimiter: authLimiter(10) };
