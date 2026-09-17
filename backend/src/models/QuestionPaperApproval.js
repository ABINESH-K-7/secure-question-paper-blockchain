const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  paperId: { type: mongoose.Schema.Types.ObjectId, ref: 'QuestionPaper', required: true, index: true },
  stage: { type: String, enum: ['SECURITY_OFFICER', 'EXAM_AUTHORITY'], required: true },
  action: { type: String, enum: ['CLAIMED', 'APPROVED', 'REJECTED', 'LOCKED', 'RETURNED_FOR_CORRECTION'], required: true },
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  comment: { type: String, trim: true, maxlength: 2000, default: null },
}, { timestamps: { createdAt: true, updatedAt: false }, versionKey: false });
schema.index({ paperId: 1, createdAt: 1 });
module.exports = mongoose.model('QuestionPaperApproval', schema);
