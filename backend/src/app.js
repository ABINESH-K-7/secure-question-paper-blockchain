const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const healthRoutes = require('./routes/healthRoutes');
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const questionPaperRoutes = require('./routes/questionPaperRoutes');
const reviewerRoutes = require('./routes/reviewerRoutes');
const securityOfficerRoutes = require('./routes/securityOfficerRoutes');
const examAuthorityRoutes = require('./routes/examAuthorityRoutes');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');
const { trustProxy } = require('./config/env');
const { getReady } = require('./controllers/healthController');

const app = express();

app.set('trust proxy', trustProxy);
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
app.use(express.json({ limit: '1mb' }));
app.use('/api/health', healthRoutes);
app.get('/api/ready', getReady);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/question-papers', questionPaperRoutes);
app.use('/api/reviewer', reviewerRoutes);
app.use('/api/security-officer', securityOfficerRoutes);
app.use('/api/exam-authority', examAuthorityRoutes);
app.use(notFound);
app.use(errorHandler);

module.exports = app;
