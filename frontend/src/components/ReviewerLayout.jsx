import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ReviewerLayout() {
  const { user, logout } = useAuth(); const navigate = useNavigate();
  async function signOut() { await logout(); navigate('/login'); }
  return <div className="admin-shell"><aside className="admin-sidebar"><p className="eyebrow">SECURE EXAM PLATFORM</p><h2>Reviewer</h2><nav><NavLink to="/reviewer/dashboard">Dashboard</NavLink><NavLink to="/reviewer/papers">Papers for Review</NavLink></nav><button className="secondary" onClick={signOut}>Logout</button></aside><main className="admin-main"><header className="admin-header"><div><strong>Secure Question Papers</strong><p>{user.name} · REVIEWER</p></div></header><Outlet /></main></div>;
}
