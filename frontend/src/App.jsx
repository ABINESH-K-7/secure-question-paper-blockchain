import React from 'react';
import { Route, Routes } from 'react-router-dom';
import HomePage from './pages/HomePage';
import NotFoundPage from './pages/NotFoundPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import VerifyOtpPage from './pages/VerifyOtpPage';
import DashboardPage from './pages/DashboardPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import AdminUsersPage from './pages/AdminUsersPage';
import AdminExamCentersPage from './pages/AdminExamCentersPage';
import AdminAuditLogsPage from './pages/AdminAuditLogsPage';
import ProtectedRoute from './components/ProtectedRoute';
import AdminLayout from './components/AdminLayout';
import QuestionSetterLayout from './components/QuestionSetterLayout';
import QuestionSetterDashboardPage from './pages/QuestionSetterDashboardPage';
import QuestionSetterPapersPage from './pages/QuestionSetterPapersPage';
import QuestionSetterPaperCreatePage from './pages/QuestionSetterPaperCreatePage';
import ReviewerLayout from './components/ReviewerLayout';
import ReviewerDashboardPage from './pages/ReviewerDashboardPage';
import ReviewerPapersPage from './pages/ReviewerPapersPage';
import ReviewerPaperReviewPage from './pages/ReviewerPaperReviewPage';
import ExamCenterDashboardPage from './pages/ExamCenterDashboardPage';
import ExamCenterPapersPage from './pages/ExamCenterPapersPage';
import ExamCenterLayout from './components/ExamCenterLayout';
import ApprovalStageLayout from './components/ApprovalStageLayout';
import { StageDashboard, StagePapers, StagePaper } from './pages/ApprovalStagePages';

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/verify-otp" element={<VerifyOtpPage />} />
      <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute roles={['ADMIN']}><AdminLayout /></ProtectedRoute>}>
        <Route path="dashboard" element={<AdminDashboardPage />} />
        <Route path="users" element={<AdminUsersPage />} />
        <Route path="exam-centers" element={<AdminExamCentersPage />} />
        <Route path="audit-logs" element={<AdminAuditLogsPage />} />
      </Route>
      <Route path="/question-setter" element={<ProtectedRoute roles={['QUESTION_SETTER']}><QuestionSetterLayout /></ProtectedRoute>}>
        <Route path="dashboard" element={<QuestionSetterDashboardPage />} />
        <Route path="papers" element={<QuestionSetterPapersPage />} />
        <Route path="papers/new" element={<QuestionSetterPaperCreatePage />} />
      </Route>
      <Route path="/reviewer" element={<ProtectedRoute roles={['REVIEWER']}><ReviewerLayout /></ProtectedRoute>}>
        <Route path="dashboard" element={<ReviewerDashboardPage />} />
        <Route path="papers" element={<ReviewerPapersPage />} />
        <Route path="papers/:id" element={<ReviewerPaperReviewPage />} />
      </Route>
      <Route path="/security-officer" element={<ProtectedRoute roles={['SECURITY_OFFICER']}><ApprovalStageLayout role="SECURITY_OFFICER" title="Security Officer" base="/security-officer" /></ProtectedRoute>}>
        <Route path="dashboard" element={<StageDashboard apiBase="/security-officer" title="Security Officer" />} />
        <Route path="papers" element={<StagePapers apiBase="/security-officer" base="/security-officer" title="Security Review" available="REVIEWER_APPROVED" />} />
        <Route path="papers/:id" element={<StagePaper apiBase="/security-officer" base="/security-officer" title="Security review" reviewing="SECURITY_REVIEW" />} />
      </Route>
      <Route path="/exam-authority" element={<ProtectedRoute roles={['EXAM_AUTHORITY']}><ApprovalStageLayout role="EXAM_AUTHORITY" title="Exam Authority" base="/exam-authority" /></ProtectedRoute>}>
        <Route path="dashboard" element={<StageDashboard apiBase="/exam-authority" title="Exam Authority" />} />
        <Route path="papers" element={<StagePapers apiBase="/exam-authority" base="/exam-authority" title="Final Approval" available="SECURITY_APPROVED" />} />
        <Route path="papers/:id" element={<StagePaper apiBase="/exam-authority" base="/exam-authority" title="Final approval" reviewing="AUTHORITY_REVIEW" />} />
      </Route>
      <Route path="/exam-center" element={<ProtectedRoute roles={['EXAM_CENTER']}><ExamCenterLayout /></ProtectedRoute>}>
        <Route path="dashboard" element={<ExamCenterDashboardPage />} />
        <Route path="papers" element={<ExamCenterPapersPage />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default App;
