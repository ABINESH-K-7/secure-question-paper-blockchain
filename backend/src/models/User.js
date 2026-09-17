const mongoose = require('mongoose');

const ROLES = ['ADMIN', 'QUESTION_SETTER', 'REVIEWER', 'SECURITY_OFFICER', 'EXAM_AUTHORITY', 'EXAM_CENTER'];

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, match: /^\S+@\S+\.\S+$/ },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, required: true, enum: ROLES },
  mfaEnabled: { type: Boolean, default: true },
  mfaCodeHash: { type: String, select: false },
  mfaExpiresAt: { type: Date, select: false },
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  lastLoginAt: { type: Date, default: null },
}, { timestamps: true });

userSchema.statics.ROLES = ROLES;
userSchema.index({ role: 1, isActive: 1, createdAt: -1 });
module.exports = mongoose.model('User', userSchema);
