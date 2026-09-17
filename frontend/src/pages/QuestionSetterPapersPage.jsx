import React, { useEffect, useState } from 'react';
import api from '../services/api';

const formatDate = value => value ? new Date(value).toLocaleString() : '—';

export default function QuestionSetterPapersPage() {
  const [papers, setPapers] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const load = () => api.get('/question-papers').then(({ data }) => setPapers(data.papers)).catch(() => setError('Unable to load your question papers.'));

  useEffect(() => { load(); }, []);

  async function upload(id, file) {
    if (!file) return;
    if (file.type !== 'application/pdf' || file.size > 10 * 1024 * 1024) return setError('Choose a PDF file no larger than 10 MB.');
    setBusy(id);
    try { const form = new FormData(); form.append('file', file); await api.post(`/question-papers/${id}/upload`, form); load(); } catch (requestError) { setError(requestError.response?.data?.message || 'Unable to upload PDF.'); } finally { setBusy(''); }
  }
  async function submit(id) { setBusy(id); try { await api.post(`/question-papers/${id}/submit`); load(); } catch (requestError) { setError(requestError.response?.data?.message || 'Unable to submit paper.'); } finally { setBusy(''); } }
  async function revise(id) { setBusy(id); try { await api.post(`/question-papers/${id}/revise`); load(); } catch (requestError) { setError(requestError.response?.data?.message || 'Unable to return this paper to draft.'); } finally { setBusy(''); } }
  async function remove(id) { if (!window.confirm('Delete this draft question paper?')) return; setBusy(id); try { await api.delete(`/question-papers/${id}`); load(); } catch (requestError) { setError(requestError.response?.data?.message || 'Unable to delete paper.'); } finally { setBusy(''); } }
  async function download(id) { setBusy(id); try { const response = await api.get(`/question-papers/${id}/download`, { responseType: 'blob' }); const url = URL.createObjectURL(response.data); const link = document.createElement('a'); link.href = url; link.download = 'question-paper.pdf'; link.click(); URL.revokeObjectURL(url); } catch { setError('Question paper file is unavailable.'); } finally { setBusy(''); } }

  return <section><p className="eyebrow">PRIVATE PAPERS</p><h1>My Question Papers</h1>{error && <p className="form-error">{error}</p>}{papers.length ? <div className="table-wrap"><table><thead><tr><th>Title</th><th>Exam / Subject</th><th>Status</th><th>Dates</th><th>File & actions</th></tr></thead><tbody>{papers.map(paper => <tr key={paper.id}><td>{paper.title}<br /><small>{paper.questionPaperType || '—'}</small></td><td>{paper.examName}<br /><small>{paper.subject}</small></td><td><span className={`badge ${paper.status.toLowerCase()}`}>{paper.status}</span>{paper.reviewComment && <small><br />Reviewer: {paper.reviewComment}</small>}</td><td><small>Created: {formatDate(paper.createdAt)}<br />Submitted: {formatDate(paper.submittedAt)}</small></td><td>{paper.fileOriginalName ? <small>{paper.fileOriginalName} ({Math.ceil(paper.fileSize / 1024)} KB)</small> : <small>No PDF uploaded</small>}<div className="paper-actions"><button className="small secondary" onClick={() => download(paper.id)} disabled={!paper.hasFile || busy === paper.id}>Download</button>{paper.status === 'DRAFT' && <><label className="upload-label">Upload / Replace PDF<input type="file" accept="application/pdf" onChange={event => upload(paper.id, event.target.files[0])} disabled={busy === paper.id} /></label><button className="small" onClick={() => submit(paper.id)} disabled={!paper.hasFile || busy === paper.id}>Submit</button><button className="small danger" onClick={() => remove(paper.id)} disabled={busy === paper.id}>Delete</button></>}{paper.status === 'REVIEWER_REJECTED' && <button className="small" onClick={() => revise(paper.id)} disabled={busy === paper.id}>Return to draft</button>}</div></td></tr>)}</tbody></table></div> : <p className="empty">No question papers yet. Create your first draft to begin.</p>}</section>;
}
