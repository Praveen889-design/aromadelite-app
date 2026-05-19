import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();

  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) navigate('/', { replace: true });
  }, [user, navigate]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!employeeId.trim() || !password) {
      setError('Please enter your Employee ID and password.');
      return;
    }
    setLoading(true);
    try {
      await login(employeeId.trim().toUpperCase(), password);
      navigate('/', { replace: true });
    } catch (err) {
      const msg =
        err?.response?.data?.error ||
        (err?.response?.status === 401 ? 'Invalid Employee ID or Password. Please try again.' : 'Login failed. Please try again.');
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100dvh',
      background: 'linear-gradient(180deg, #0891B2 0%, #0E7490 100%)',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: "'Source Sans 3', system-ui, sans-serif",
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Decorative orbs */}
      <div style={{
        position: 'absolute', top: -110, right: -60, width: 260, height: 260,
        borderRadius: '50%',
        background: 'radial-gradient(closest-side, rgba(255,255,255,0.18), rgba(255,255,255,0))',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', top: 120, left: -90, width: 220, height: 220,
        borderRadius: '50%',
        background: 'radial-gradient(closest-side, rgba(34,211,238,0.28), rgba(34,211,238,0))',
        pointerEvents: 'none',
      }} />

      {/* Branding area */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: '56px 24px 32px',
        position: 'relative',
      }}>
        <div style={{
          width: 88, height: 88,
          borderRadius: '50%',
          background: '#FFFFFF',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 10px 30px rgba(8,42,56,.25), inset 0 0 0 1px rgba(255,255,255,.6)',
        }}>
          <span style={{
            fontFamily: "'Nunito', sans-serif",
            fontWeight: 900,
            fontSize: 46,
            color: '#0E7490',
            letterSpacing: '-.04em',
            lineHeight: 1,
            marginTop: -2,
          }}>A</span>
        </div>

        <div style={{
          fontFamily: "'Nunito', sans-serif",
          fontWeight: 800,
          fontSize: 28,
          color: '#FFFFFF',
          letterSpacing: '-.01em',
          lineHeight: 1,
        }}>Aromadelite</div>

        <div style={{
          fontFamily: "'Source Sans 3', sans-serif",
          fontWeight: 500,
          fontSize: 14,
          color: 'rgba(255,255,255,.70)',
          letterSpacing: '.02em',
          marginTop: -4,
        }}>Sri Vemuri Sai Enterprises</div>

        <div style={{
          background: 'rgba(255,255,255,.15)',
          border: '1px solid rgba(255,255,255,.18)',
          color: '#FFFFFF',
          fontFamily: "'Source Sans 3', sans-serif",
          fontWeight: 600,
          fontSize: 12,
          padding: '6px 14px',
          borderRadius: 999,
          letterSpacing: '.04em',
        }}>Quote &amp; Lead Manager</div>
      </div>

      {/* Login card */}
      <div style={{
        flex: 1,
        background: '#FFFFFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: '28px 24px 32px',
        boxShadow: '0 -10px 30px rgba(8,42,56,.10)',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <h2 style={{
          fontFamily: "'Nunito', sans-serif",
          fontWeight: 800,
          fontSize: 24,
          color: '#164E63',
          margin: 0,
          letterSpacing: '-.01em',
        }}>Welcome Back</h2>
        <p style={{
          fontFamily: "'Source Sans 3', sans-serif",
          fontSize: 14,
          color: '#6B7280',
          margin: '4px 0 0',
        }}>Sign in with your Employee ID</p>

        <form onSubmit={onSubmit} noValidate style={{ marginTop: 28 }}>
          {/* Employee ID */}
          <label style={labelStyle}>Employee ID</label>
          <div style={inputWrapStyle(error)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 10, flex: '0 0 auto' }}>
              <rect x="3" y="5" width="18" height="14" rx="2"/>
              <circle cx="9" cy="12" r="2.5"/>
              <path d="M14 10h4M14 14h3"/>
            </svg>
            <input
              type="text"
              autoComplete="username"
              placeholder="e.g. ARO-001"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              disabled={loading}
              style={{
                flex: 1, border: 0, outline: 0, padding: '14px 0',
                fontFamily: "'DM Mono', monospace", fontWeight: 500, fontSize: 15,
                color: '#164E63', background: 'transparent', letterSpacing: '.02em',
                textTransform: 'uppercase',
              }}
            />
          </div>

          {/* Password */}
          <label style={{ ...labelStyle, marginTop: 16 }}>Password</label>
          <div style={inputWrapStyle(error)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 10, flex: '0 0 auto' }}>
              <rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>
            </svg>
            <input
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              style={{
                flex: 1, border: 0, outline: 0, padding: '14px 0',
                fontFamily: "'Source Sans 3', sans-serif", fontSize: 15,
                color: '#164E63', background: 'transparent',
              }}
            />
            <button type="button" onClick={() => setShowPassword(v => !v)} style={eyeBtn} aria-label="Toggle password">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {showPassword
                  ? <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></>
                  : <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></>}
              </svg>
            </button>
          </div>

          {error && (
            <div style={{ display:'flex', alignItems:'flex-start', gap:6, marginTop:8, color:'#EF4444', fontFamily:"'Source Sans 3',sans-serif", fontWeight:500, fontSize:12, lineHeight:1.4 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginTop:1, flex:'0 0 auto' }}>
                <circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/>
              </svg>
              {error}
            </div>
          )}

          <div style={{ textAlign: 'right', marginTop: 8 }}>
            <span style={{ fontFamily:"'Source Sans 3',sans-serif", fontWeight:600, fontSize:12, color:'#0E7490', cursor:'pointer' }}>
              Forgot Password? Contact Admin
            </span>
          </div>

          <button type="submit" disabled={loading} style={{
            width: '100%', height: 56, border: 0, borderRadius: 12,
            background: loading ? '#6EE7B7' : '#059669',
            color: '#FFFFFF',
            fontFamily: "'Nunito', sans-serif", fontWeight: 700, fontSize: 16,
            letterSpacing: '.01em',
            cursor: loading ? 'not-allowed' : 'pointer',
            boxShadow: loading ? 'none' : '0 6px 18px rgba(5,150,105,.30)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            marginTop: 24,
          }}>
            {loading ? 'Signing in…' : <>Sign In <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 5l7 7-7 7"/></svg></>}
          </button>

          <div style={{
            marginTop: 16, background: '#F0FAFB', border: '1px solid #A5F3FC',
            borderRadius: 10, padding: '10px 14px',
            fontFamily: "'Source Sans 3', sans-serif", fontSize: 12, color: '#374151', lineHeight: 1.6,
          }}>
            <div style={{ fontWeight: 700, color: '#164E63', marginBottom: 3 }}>Demo accounts</div>
            <div>Admin · <code style={{ fontFamily:"'DM Mono',monospace", color:'#0E7490' }}>ARO-ADMIN</code> / Admin@123</div>
            <div>Associate · <code style={{ fontFamily:"'DM Mono',monospace", color:'#0E7490' }}>ARO-001</code> / Assoc@123</div>
          </div>
        </form>

        <div style={{ marginTop: 'auto', paddingTop: 20, textAlign: 'center', fontFamily:"'Source Sans 3',sans-serif", fontSize:12, color:'#6B7280' }}>
          Having trouble? <span style={{ color:'#164E63', fontWeight:600, cursor:'pointer' }}>Call your manager</span>
        </div>
      </div>
    </div>
  );
}

const labelStyle = {
  display: 'block',
  fontFamily: "'Source Sans 3', sans-serif",
  fontWeight: 600,
  fontSize: 13,
  color: '#164E63',
  marginBottom: 6,
  letterSpacing: '.01em',
};

const inputWrapStyle = (err) => ({
  display: 'flex', alignItems: 'center',
  background: '#FFFFFF',
  border: `1.5px solid ${err ? '#EF4444' : '#E5E7EB'}`,
  borderRadius: 10,
  padding: '0 14px',
  boxShadow: err ? '0 0 0 4px rgba(239,68,68,.10)' : 'none',
});

const eyeBtn = {
  border: 0, background: 'transparent', padding: 4, cursor: 'pointer',
  color: '#6B7280', flex: '0 0 auto',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
