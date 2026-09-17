const jwt = require('jsonwebtoken');
const User = require('../models/User');
const RevokedToken = require('../models/RevokedToken');
const { jwtSecret } = require('../config/env');
const { audit } = require('../services/auditService');

async function authenticateUser(request, response, next) {
  const header = request.get('authorization');
  if (!header?.startsWith('Bearer ')) {
    await audit(request, 'UNAUTHENTICATED_ACCESS');
    return response.status(401).json({ success: false, message: 'Authentication required.' });
  }
  try {
    if (!jwtSecret) throw new Error('JWT_SECRET is not configured.');
    const token = header.slice(7);
    const payload = jwt.verify(token, jwtSecret);
    if (await RevokedToken.exists({ jti: payload.jti })) { await audit(request, 'UNAUTHENTICATED_ACCESS'); return response.status(401).json({ success: false, message: 'Session has been logged out.' }); }
    const user = await User.findById(payload.userId);
    if (!user || !user.isActive) { await audit(request, 'UNAUTHENTICATED_ACCESS', { userId: user?._id, role: user?.role }); return response.status(401).json({ success: false, message: 'Account is inactive or unavailable.' }); }
    request.user = user;
    request.token = token;
    request.tokenPayload = payload;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') { await audit(request, 'UNAUTHENTICATED_ACCESS'); return response.status(401).json({ success: false, message: 'Invalid or expired authentication token.' }); }
    next(error);
  }
}
function authorizeRoles(...roles) {
  return async (request, response, next) => {
    if (!request.user || !roles.includes(request.user.role)) {
      await audit(request, 'UNAUTHORIZED_ACCESS', { metadata: { requiredRoles: roles } });
      return response.status(403).json({ success: false, message: 'You do not have permission to perform this action.' });
    }
    next();
  };
}
module.exports = { authenticateUser, authorizeRoles };
