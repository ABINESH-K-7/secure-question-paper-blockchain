const express = require('express');
const { securityOfficer: c } = require('../controllers/approvalStageController');
const { authenticateUser, authorizeRoles } = require('../middleware/authenticateUser');
const router = express.Router(); router.use(authenticateUser, authorizeRoles('SECURITY_OFFICER'));
router.get('/dashboard/stats', c.dashboardStats); router.get('/question-papers', c.listPapers); router.get('/question-papers/:id', c.getPaper); router.post('/question-papers/:id/claim', c.claimPaper); router.post('/question-papers/:id/approve', (req, res, next) => c.decidePaper(req, res, next, 'APPROVED')); router.post('/question-papers/:id/reject', (req, res, next) => c.decidePaper(req, res, next, 'REJECTED')); router.get('/question-papers/:id/approvals', c.listApprovals); module.exports = router;
