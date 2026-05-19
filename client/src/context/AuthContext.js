import React, { createContext, useContext, useEffect, useState } from 'react';
import api from '../utils/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('aromadelite_user');
    return raw ? JSON.parse(raw) : null;
  });

  useEffect(() => {
    const token = localStorage.getItem('aromadelite_token');
    if (token) api.defaults.headers.common.Authorization = `Bearer ${token}`;
  }, []);

  const login = async (employeeId, password) => {
    const { data } = await api.post('/api/auth/login', {
      employee_id: employeeId,
      password,
    });
    localStorage.setItem('aromadelite_token', data.token);
    localStorage.setItem('aromadelite_user', JSON.stringify(data.user));
    api.defaults.headers.common.Authorization = `Bearer ${data.token}`;
    setUser(data.user);
    return data.user;
  };

  const logout = async () => {
    try {
      await api.post('/api/auth/logout');
    } catch {
      // ignore — clear local state regardless
    }
    localStorage.removeItem('aromadelite_token');
    localStorage.removeItem('aromadelite_user');
    delete api.defaults.headers.common.Authorization;
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
