const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  action: { type: String, required: true, trim: true },
  role: { type: String, default: null },
  targetType: { type: String, default: null },
  targetId: { type: String, default: null },
  ipAddress: { type: String, default: null },
  userAgent: { type: String, default: null },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  timestamp: { type: Date, default: Date.now, immutable: true },
}, { versionKey: false });

auditLogSchema.index({ timestamp: -1 });
auditLogSchema.index({ action: 1, timestamp: -1 });
auditLogSchema.index({ userId: 1, timestamp: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
