import React, { createContext, useContext, useEffect, useState } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const token = sessionStorage.getItem('authToken');
    if (!token) { setLoading(false); return; }
    api.get('/auth/me').then(({ data }) => setUser(data.user)).catch(() => sessionStorage.removeItem('authToken')).finally(() => setLoading(false));
  }, []);
  const finishLogin = (token, authenticatedUser) => { sessionStorage.setItem('authToken', token); setUser(authenticatedUser); };
  const logout = async () => { try { await api.post('/auth/logout'); } finally { sessionStorage.removeItem('authToken'); setUser(null); } };
  return <AuthContext.Provider value={{ user, loading, finishLogin, logout }}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
