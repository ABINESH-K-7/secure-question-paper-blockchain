const AuditLog = require('../models/AuditLog');
const { nodeEnv } = require('../config/env');

const criticalActions = new Set([
  'QUESTION_PAPER_UPLOAD_SUCCESS', 'QUESTION_PAPER_ENCRYPTION_SUCCESS', 'QUESTION_PAPER_SUBMITTED',
  'REVIEWER_PAPER_APPROVED', 'REVIEWER_PAPER_REJECTED', 'SECURITY_OFFICER_PAPER_APPROVED',
  'SECURITY_OFFICER_PAPER_REJECTED', 'EXAM_AUTHORITY_PAPER_APPROVED', 'PAPER_LOCKED',
  'QUESTION_PAPER_RELEASE_SCHEDULED', 'RELEASE_INTEGRITY_FAILED', 'QUESTION_PAPER_INTEGRITY_CHECK_FAILED',
  'BLOCKCHAIN_VERIFICATION_FAILED', 'UNAUTHORIZED_ACCESS', 'QUESTION_PAPER_ACCESS_DENIED',
]);

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
    if (nodeEnv === 'production' && criticalActions.has(action)) {
      const auditError = new Error('Security audit persistence is unavailable.');
      auditError.code = 'AUDIT_PERSISTENCE_ERROR';
      throw auditError;
    }
  }
}
module.exports = { audit };
