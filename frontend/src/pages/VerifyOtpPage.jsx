import React, { useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { dashboardPathForRole } from '../utils/roleDashboard';
export default function VerifyOtpPage() {
  const challengeId = sessionStorage.getItem('otpChallengeId'); const verificationCompletedRef = useRef(false); const [otp, setOtp] = useState(''); const [error, setError] = useState(''); const navigate = useNavigate(); const { finishLogin } = useAuth();
  if (!challengeId && !verificationCompletedRef.current) return <Navigate to="/login" replace />;
  async function submit(event) { event.preventDefault(); setError(''); try { const { data } = await api.post('/auth/verify-otp', { challengeId, otp }); const dashboardPath = dashboardPathForRole(data.user.role); if (!dashboardPath) throw new Error('Your account does not have a supported dashboard.'); verificationCompletedRef.current = true; sessionStorage.removeItem('otpChallengeId'); finishLogin(data.token, data.user); navigate(dashboardPath, { replace: true }); } catch (e) { setError(e.response?.data?.message || 'Verification failed.'); } }
  async function resend() { try { await api.post('/auth/resend-otp', { challengeId }); setError('A new OTP was generated. Check the development server console.'); } catch (e) { setError(e.response?.data?.message || 'Unable to resend OTP.'); } }
  return <main className="auth-page"><form className="auth-card" onSubmit={submit}><p className="eyebrow">MULTI-FACTOR AUTHENTICATION</p><h1>Verify OTP</h1><p>Enter the six-digit one-time password.</p>{error && <p className="form-error">{error}</p>}<label>OTP<input required inputMode="numeric" pattern="[0-9]{6}" maxLength="6" value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, ''))} /></label><button>Verify and sign in</button><button type="button" className="secondary" onClick={resend}>Resend OTP</button></form></main>;
}
