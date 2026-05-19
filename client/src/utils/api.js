import axios from 'axios';

// In dev, baseURL is empty so requests hit the CRA proxy (proxy field in package.json
// forwards to the local Express). In production, set REACT_APP_API_URL at build time
// to point at your deployed API origin (e.g. https://api.aromadelite.com).
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || '',
  headers: { 'Content-Type': 'application/json' },
});

// Restore auth header synchronously on module load so first API calls from
// child useEffects don't race the AuthProvider's mount effect.
const bootToken = typeof window !== 'undefined' ? localStorage.getItem('aromadelite_token') : null;
if (bootToken) api.defaults.headers.common.Authorization = `Bearer ${bootToken}`;

// If the server tells us the token is invalid/revoked, clear local state
// and bounce to /login so the UI doesn't loop on 401s.
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err?.response?.status === 401 && typeof window !== 'undefined') {
      const hadToken = !!localStorage.getItem('aromadelite_token');
      localStorage.removeItem('aromadelite_token');
      localStorage.removeItem('aromadelite_user');
      delete api.defaults.headers.common.Authorization;
      if (!window.location.pathname.startsWith('/login')) {
        if (hadToken) {
          try {
            const { default: toast } = await import('react-hot-toast');
            toast.error('Session expired. Please sign in again.', { duration: 5000 });
          } catch {/* ignore — fallback to redirect */}
        }
        window.location.replace('/login');
      }
    }
    return Promise.reject(err);
  }
);

export default api;
