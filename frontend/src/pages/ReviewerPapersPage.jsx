import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

const formatDate = value => value ? new Date(value).toLocaleString() : '—';
export default function ReviewerPapersPage() {
  const [papers, setPapers] = useState([]); const [error, setError] = useState(''); const [busy, setBusy] = useState('');
  const load = () => api.get('/reviewer/question-papers').then(({ data }) => setPapers(data.papers)).catch(() => setError('Unable to load papers for review.'));
  useEffect(() => { load(); }, []);
  async function claim(id) { setBusy(id); try { await api.post(`/reviewer/question-papers/${id}/claim`); load(); } catch (requestError) { setError(requestError.response?.data?.message || 'Unable to claim this question paper.'); } finally { setBusy(''); } }
  return <section><p className="eyebrow">REVIEW QUEUE</p><h1>Papers for Review</h1>{error && <p className="form-error">{error}</p>}{papers.length ? <div className="table-wrap"><table><thead><tr><th>Paper</th><th>Exam / Subject</th><th>Submitted by</th><th>Status</th><th>Submitted</th><th>Action</th></tr></thead><tbody>{papers.map(paper => <tr key={paper.id}><td>{paper.title}<br /><small>{paper.questionPaperType || '—'}</small></td><td>{paper.examName}<br /><small>{paper.subject}</small></td><td>{paper.submittedBy || 'Question Setter'}</td><td><span className={`badge ${paper.status.toLowerCase()}`}>{paper.status}</span></td><td>{formatDate(paper.submittedAt)}</td><td><div className="paper-actions">{paper.status === 'SUBMITTED' && <button className="small" onClick={() => claim(paper.id)} disabled={busy === paper.id}>Claim</button>}<Link className="button-link secondary-link" to={`/reviewer/papers/${paper.id}`}>Open</Link></div></td></tr>)}</tbody></table></div> : <p className="empty">No question papers are available for review.</p>}</section>;
}
