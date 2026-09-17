const express = require('express');
const controller = require('../controllers/reviewerController');
const { authenticateUser, authorizeRoles } = require('../middleware/authenticateUser');

const router = express.Router();
router.use(authenticateUser, authorizeRoles('REVIEWER'));
router.get('/dashboard/stats', controller.dashboardStats);
router.get('/question-papers', controller.listPapers);
router.get('/question-papers/:id', controller.getPaper);
router.post('/question-papers/:id/claim', controller.claimPaper);
router.post('/question-papers/:id/approve', controller.approvePaper);
router.post('/question-papers/:id/reject', controller.rejectPaper);
router.get('/question-papers/:id/reviews', controller.listReviews);
module.exports = router;
