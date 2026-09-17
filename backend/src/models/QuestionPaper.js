const mongoose = require('mongoose');

const questionPaperSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, minlength: 2, maxlength: 200 },
  description: { type: String, trim: true, maxlength: 2000, default: '' },
  examName: { type: String, required: true, trim: true, minlength: 2, maxlength: 200 },
  examCode: { type: String, trim: true, maxlength: 100, default: '' },
  subject: { type: String, required: true, trim: true, minlength: 2, maxlength: 200 },
  questionPaperType: { type: String, trim: true, maxlength: 100, default: '' },
  fileOriginalName: { type: String, trim: true, maxlength: 255, default: null },
  fileStoredName: { type: String, trim: true, maxlength: 255, default: null },
  storageKey: { type: String, trim: true, maxlength: 500, default: null },
  storageProvider: { type: String, enum: ['local', 's3', null], default: null, select: false },
  fileMimeType: { type: String, enum: ['application/pdf', null], default: null },
  fileSize: { type: Number, min: 0, default: null },
  encryptionAlgorithm: { type: String, default: null, select: false },
  encryptionKeyVersion: { type: String, default: null, select: false },
  encryptionKeySource: { type: String, enum: ['LOCAL_MASTER_KEY', 'AWS_KMS', null], default: null, select: false },
  encryptedKey: { type: String, default: null, select: false },
  keyIv: { type: String, default: null, select: false },
  keyAuthTag: { type: String, default: null, select: false },
  iv: { type: String, default: null, select: false },
  authTag: { type: String, default: null, select: false },
  hashAlgorithm: { type: String, default: null, select: false },
  encryptedFileHash: { type: String, default: null, select: false },
  blockchainStatus: { type: String, enum: ['DISABLED', 'PENDING', 'ANCHORED', 'FAILED'], default: 'DISABLED' },
  blockchainPaperIdHash: { type: String, default: null, select: false }, blockchainArtifactHash: { type: String, default: null, select: false }, blockchainTransactionHash: { type: String, default: null }, blockchainBlockNumber: { type: Number, default: null }, blockchainChainId: { type: String, default: null }, blockchainContractAddress: { type: String, default: null }, blockchainAnchoredAt: { type: Date, default: null }, blockchainAnchoredBy: { type: String, default: null }, blockchainFailureReason: { type: String, default: null },
  blockchainStatus: { type: String, enum: ['NOT_ANCHORED', 'PENDING', 'ANCHORED', 'FAILED'], default: 'NOT_ANCHORED' }, blockchainNetwork: { type: String, default: null }, blockchainContractAddress: { type: String, default: null }, blockchainTransactionHash: { type: String, default: null }, blockchainAnchoredAt: { type: Date, default: null }, blockchainContentHash: { type: String, default: null, select: false }, blockchainPaperIdHash: { type: String, default: null, select: false },
  status: { type: String, enum: ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'REVIEWER_APPROVED', 'REVIEWER_REJECTED', 'SECURITY_REVIEW', 'SECURITY_APPROVED', 'SECURITY_REJECTED', 'AUTHORITY_REVIEW', 'FINAL_APPROVED', 'LOCKED', 'AUTHORITY_REJECTED'], default: 'DRAFT', immutable: false },
  scheduledReleaseAt: { type: Date, default: null },
  releaseStatus: { type: String, enum: ['NOT_SCHEDULED', 'SCHEDULED', 'RELEASED'], default: 'NOT_SCHEDULED' },
  reviewerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, select: false },
  reviewAssignedAt: { type: Date, default: null },
  reviewedAt: { type: Date, default: null },
  reviewComment: { type: String, trim: true, maxlength: 2000, default: null },
  securityOfficerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, select: false },
  securityReviewAssignedAt: { type: Date, default: null },
  securityReviewedAt: { type: Date, default: null },
  securityReviewComment: { type: String, trim: true, maxlength: 2000, default: null },
  examAuthorityId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, select: false },
  authorityReviewAssignedAt: { type: Date, default: null },
  finalApprovedAt: { type: Date, default: null },
  authorityReviewComment: { type: String, trim: true, maxlength: 2000, default: null },
  isLocked: { type: Boolean, default: false },
  lockedAt: { type: Date, default: null },
  lockedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, select: false },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  submittedAt: { type: Date, default: null },
}, { timestamps: true, versionKey: false });

questionPaperSchema.index({ createdBy: 1, status: 1, createdAt: -1 });
questionPaperSchema.index({ createdBy: 1, createdAt: -1 });
questionPaperSchema.index({ status: 1, reviewerId: 1, submittedAt: -1 });
questionPaperSchema.index({ status: 1, securityOfficerId: 1, submittedAt: -1 });
questionPaperSchema.index({ status: 1, examAuthorityId: 1, submittedAt: -1 });

module.exports = mongoose.model('QuestionPaper', questionPaperSchema);
