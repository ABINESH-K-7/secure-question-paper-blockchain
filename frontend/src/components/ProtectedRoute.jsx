import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { dashboardPathForRole } from '../utils/roleDashboard';
export default function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="loading">Checking secure session…</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to={dashboardPathForRole(user.role) || '/login'} replace />;
  return children;
}
