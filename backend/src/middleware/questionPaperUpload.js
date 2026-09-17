const multer = require('multer');
const { maxQuestionPaperSizeMb } = require('../config/env');
const { audit } = require('../services/auditService');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxQuestionPaperSizeMb * 1024 * 1024, files: 1 },
  fileFilter: (_request, file, callback) => callback(null, file.mimetype === 'application/pdf'),
}).single('file');

function uploadQuestionPaper(request, response, next) {
  upload(request, response, async error => {
    if (error) { await audit(request, 'QUESTION_PAPER_UPLOAD_FAILED', { targetType: 'QuestionPaper', targetId: request.params.id, metadata: { reason: error.code || 'upload_error' } }); return next(error); }
    if (!request.file) { await audit(request, 'QUESTION_PAPER_UPLOAD_FAILED', { targetType: 'QuestionPaper', targetId: request.params.id, metadata: { reason: 'missing_or_invalid_mime_type' } }); return response.status(400).json({ success: false, message: 'A PDF file is required.' }); }
    next();
  });
}
module.exports = { uploadQuestionPaper };
