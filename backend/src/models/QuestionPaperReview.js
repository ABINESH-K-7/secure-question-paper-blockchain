const mongoose = require('mongoose');

const questionPaperReviewSchema = new mongoose.Schema({
  paperId: { type: mongoose.Schema.Types.ObjectId, ref: 'QuestionPaper', required: true, index: true },
  reviewerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  action: { type: String, enum: ['CLAIMED', 'APPROVED', 'REJECTED', 'RELEASED_FOR_CORRECTION'], required: true },
  comment: { type: String, trim: true, maxlength: 2000, default: null },
}, { timestamps: { createdAt: true, updatedAt: false }, versionKey: false });

questionPaperReviewSchema.index({ paperId: 1, createdAt: -1 });

module.exports = mongoose.model('QuestionPaperReview', questionPaperReviewSchema);
