import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function RequireAuth({ adminOnly = false, children }) {
  const { user } = useAuth();
  const location = useLocation();
  const hasToken = !!localStorage.getItem('aromadelite_token');

  if (!user || !hasToken) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (adminOnly && !['admin', 'central_office'].includes(user.role)) {
    return <Navigate to="/" replace />;
  }
  return children;
}
