const AuditLog = require('../models/AuditLog');

async function audit(request, action, options = {}) {
  try {
    await AuditLog.create({
      userId: options.userId || request.user?._id || null,
      role: options.role || request.user?.role || null,
      action,
      targetType: options.targetType || null,
      targetId: options.targetId || null,
      metadata: options.metadata || {},
      ipAddress: request.ip,
      userAgent: request.get('user-agent') || null,
    });
  } catch (error) {
    console.error('Audit logging failed:', error.message);
  }
}
module.exports = { audit };
