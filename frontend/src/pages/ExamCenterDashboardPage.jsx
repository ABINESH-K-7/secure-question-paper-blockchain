import React from 'react';
import { useAuth } from '../context/AuthContext';
import ExamCenterPapersPage from './ExamCenterPapersPage';

export default function ExamCenterDashboardPage() {
  const { user } = useAuth();
  return <section><p className="eyebrow">EXAM CENTRE</p><h1>Hello, {user.name}</h1><p className="role-badge">EXAM_CENTER</p><ExamCenterPapersPage /></section>;
}
