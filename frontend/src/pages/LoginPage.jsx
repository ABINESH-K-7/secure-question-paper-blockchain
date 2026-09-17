import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
export default function LoginPage() {
  const [form, setForm] = useState({ email: '', password: '' }); const [error, setError] = useState(''); const navigate = useNavigate();
  async function submit(event) { event.preventDefault(); setError(''); try { const { data } = await api.post('/auth/login', form); sessionStorage.setItem('otpChallengeId', data.challengeId); navigate('/verify-otp'); } catch (e) { setError(e.response?.data?.message || 'Unable to sign in.'); } }
  return <main className="auth-page"><form className="auth-card" onSubmit={submit}><p className="eyebrow">SECURE SIGN IN</p><h1>Welcome back</h1>{error && <p className="form-error">{error}</p>}<label>Email<input required type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></label><label>Password<input required type="password" minLength="8" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /></label><button>Continue to OTP</button><p>New user? <Link to="/register">Create an account</Link></p></form></main>;
}
