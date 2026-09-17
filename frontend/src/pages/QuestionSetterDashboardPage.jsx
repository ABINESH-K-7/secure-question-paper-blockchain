import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function QuestionSetterDashboardPage() {
  const { user } = useAuth(); const [papers, setPapers] = useState([]); const [error, setError] = useState('');
  useEffect(() => { api.get('/question-papers').then(({ data }) => setPapers(data.papers)).catch(() => setError('Unable to load your question papers.')); }, []);
  const drafts = papers.filter(p => p.status === 'DRAFT').length; const submitted = papers.filter(p => p.status === 'SUBMITTED').length;
  return <section><p className="eyebrow">QUESTION PAPER WORKSPACE</p><h1>Welcome, {user.name}</h1>{error && <p className="form-error">{error}</p>}<div className="stats-grid"><article className="stat-card"><span>Total papers</span><strong>{papers.length}</strong></article><article className="stat-card"><span>Draft papers</span><strong>{drafts}</strong></article><article className="stat-card"><span>Submitted papers</span><strong>{submitted}</strong></article></div><p className="actions"><Link className="button-link" to="/question-setter/papers/new">Create Question Paper</Link><Link className="button-link secondary-link" to="/question-setter/papers">View My Papers</Link></p><h2>Recent question papers</h2>{papers.length ? <div className="activity-list">{papers.slice(0, 5).map(p => <p key={p.id}><span>{p.title} · {p.examName}</span><b className={`badge ${p.status.toLowerCase()}`}>{p.status}</b></p>)}</div> : <p className="empty">No question papers yet.</p>}</section>;
}
