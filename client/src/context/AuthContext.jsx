import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('turnos_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('turnos_token');
    if (token) {
      api.get('/auth/me')
        .then((res) => {
          if (res.user) {
            setUser(res.user);
            localStorage.setItem('turnos_user', JSON.stringify(res.user));
          }
        })
        .catch(() => {
          logout();
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (identifier, password) => {
    const res = await api.post('/auth/login', { identifier, password });
    if (res.token && res.user) {
      localStorage.setItem('turnos_token', res.token);
      localStorage.setItem('turnos_user', JSON.stringify(res.user));
      setUser(res.user);
      return res.user;
    }
  };

  const register = async (formData) => {
    const res = await api.post('/auth/register', formData);
    if (res.token && res.user) {
      localStorage.setItem('turnos_token', res.token);
      localStorage.setItem('turnos_user', JSON.stringify(res.user));
      setUser(res.user);
      return res.user;
    }
  };

  const logout = () => {
    localStorage.removeItem('turnos_token');
    localStorage.removeItem('turnos_user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
