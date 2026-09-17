import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ExamCenterLayout() { const { user, logout } = useAuth(); const navigate = useNavigate(); async function signOut() { await logout(); navigate('/login'); } return <div className="admin-shell"><aside className="admin-sidebar"><p className="eyebrow">SECURE EXAM PLATFORM</p><h2>Exam Centre</h2><nav><NavLink to="/exam-center/dashboard">Dashboard</NavLink><NavLink to="/exam-center/papers">Question Papers</NavLink></nav><button className="secondary" onClick={signOut}>Logout</button></aside><main className="admin-main"><header className="admin-header"><div><strong>Secure Question Papers</strong><p>{user.name} · EXAM_CENTER</p></div></header><Outlet /></main></div>; }
