export const roleDashboardPaths = {
  ADMIN: '/admin/dashboard',
  QUESTION_SETTER: '/question-setter/dashboard',
  REVIEWER: '/reviewer/dashboard',
  SECURITY_OFFICER: '/security-officer/dashboard',
  EXAM_AUTHORITY: '/exam-authority/dashboard',
  EXAM_CENTER: '/exam-center/dashboard',
};

export const dashboardPathForRole = role => roleDashboardPaths[role];
