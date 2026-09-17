import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

export default function ReviewerDashboardPage() {
  const [data, setData] = useState({ stats: {}, recent: [] }); const [error, setError] = useState('');
  useEffect(() => { api.get('/reviewer/dashboard/stats').then(({ data: response }) => setData(response)).catch(() => setError('Unable to load reviewer dashboard.')); }, []);
  const stats = data.stats || {};
  return <section><p className="eyebrow">REVIEW WORKSPACE</p><h1>Reviewer Dashboard</h1>{error && <p className="form-error">{error}</p>}<div className="stats-grid"><article className="stat-card"><span>Pending reviews</span><strong>{stats.pending || 0}</strong></article><article className="stat-card"><span>Under review</span><strong>{stats.underReview || 0}</strong></article><article className="stat-card"><span>Approved</span><strong>{stats.approved || 0}</strong></article><article className="stat-card"><span>Rejected</span><strong>{stats.rejected || 0}</strong></article></div><p className="actions"><Link className="button-link" to="/reviewer/papers">Review question papers</Link></p><h2>Recent review activity</h2>{data.recent?.length ? <div className="activity-list">{data.recent.map((item, index) => <p key={`${item.createdAt}-${index}`}><span>{item.paperTitle} · {item.action}</span><small>{new Date(item.createdAt).toLocaleString()}</small></p>)}</div> : <p className="empty">No review activity yet.</p>}</section>;
}
