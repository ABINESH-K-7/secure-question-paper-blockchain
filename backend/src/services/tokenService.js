const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { jwtSecret, jwtExpiresIn } = require('../config/env');

function issueToken(user) {
  if (!jwtSecret) throw new Error('JWT_SECRET is not configured.');
  return jwt.sign({ userId: user._id.toString(), role: user.role, jti: crypto.randomUUID() }, jwtSecret, { expiresIn: jwtExpiresIn });
}
function decodeToken(token) { return jwt.decode(token); }
module.exports = { issueToken, decodeToken };
