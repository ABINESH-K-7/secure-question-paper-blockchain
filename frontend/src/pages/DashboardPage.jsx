import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { dashboardPathForRole } from '../utils/roleDashboard';

export default function DashboardPage() { const { user } = useAuth(); return <Navigate to={dashboardPathForRole(user.role) || '/login'} replace />; }
