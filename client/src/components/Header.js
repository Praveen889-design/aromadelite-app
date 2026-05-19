import React from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const titleByPath = (path) => {
  if (path === '/') return 'Dashboard';
  if (path === '/quotes/new') return 'New Quote';
  if (path === '/quotes') return 'My Quotes';
  if (path.startsWith('/quotes/')) return 'Quote Preview';
  if (path.startsWith('/products')) return 'Product Catalog';
  if (path.startsWith('/leads')) return 'Lead Tracker';
  if (path.startsWith('/admin')) return 'Admin Console';
  return 'Aromadelite';
};

const initials = (name = '') =>
  name.split(/\s+/).map(s => s.replace(/[^A-Za-z]/g, ''))
    .filter(Boolean).slice(0, 2).map(s => s[0]).join('').toUpperCase() || '?';

const formattedDate = () =>
  new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

export default function Header({ onOpenMenu }) {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const isHome = pathname === '/';

  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 20,
      background: isHome ? '#0891B2' : '#FFFFFF',
      borderBottom: isHome ? 'none' : '1px solid #E5E7EB',
      boxShadow: isHome ? 'none' : '0 1px 4px rgba(8,42,56,.05)',
      color: isHome ? '#FFFFFF' : '#164E63',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '0 16px', height: 56,
      }}>
        {/* Hamburger */}
        <button
          type="button"
          onClick={onOpenMenu}
          className="lg:hidden"
          aria-label="Open menu"
          style={{
            border: 0, borderRadius: 10, cursor: 'pointer',
            width: 36, height: 36,
            background: isHome ? 'rgba(255,255,255,.12)' : '#F1F5F9',
            color: isHome ? '#FFFFFF' : '#374151',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M4 7h16M4 12h16M4 17h10"/>
          </svg>
        </button>

        {/* Logo / title */}
        {isHome ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3s7 8 7 13a7 7 0 1 1-14 0c0-5 7-13 7-13z"/>
              <path d="M9.5 13a3 3 0 0 0 3.5 3"/>
            </svg>
            <span style={{ fontFamily: "'Nunito', sans-serif", fontWeight: 800, fontSize: 16, letterSpacing: '-.01em' }}>
              Aromadelite
            </span>
          </div>
        ) : (
          <h1 style={{
            flex: 1, margin: 0,
            fontFamily: "'Nunito', sans-serif", fontWeight: 800, fontSize: 18,
            color: '#164E63', letterSpacing: '-.01em',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{titleByPath(pathname)}</h1>
        )}

        {/* Date (desktop only) */}
        <span className="hidden sm:block" style={{
          fontFamily: "'Source Sans 3', sans-serif", fontSize: 12,
          color: isHome ? 'rgba(255,255,255,.70)' : '#6B7280',
        }}>{formattedDate()}</span>

        {/* Bell */}
        <button
          type="button"
          style={{
            border: 0, borderRadius: 10, cursor: 'pointer',
            width: 36, height: 36,
            background: isHome ? 'rgba(255,255,255,.12)' : 'transparent',
            color: isHome ? '#FFFFFF' : '#6B7280',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            position: 'relative',
          }}
          aria-label="Notifications"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
          </svg>
          <span style={{
            position: 'absolute', top: 7, right: 7,
            width: 8, height: 8, borderRadius: '50%',
            background: '#F59E0B',
            boxShadow: `0 0 0 2px ${isHome ? '#0891B2' : '#FFFFFF'}`,
          }} />
        </button>

        {/* Avatar */}
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          background: isHome ? '#22D3EE' : '#0891B2',
          color: isHome ? '#164E63' : '#FFFFFF',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: "'Nunito', sans-serif", fontWeight: 800, fontSize: 13,
          border: isHome ? '2px solid rgba(255,255,255,.5)' : 'none',
          flexShrink: 0,
          cursor: 'default',
        }} title={user?.name}>
          {initials(user?.name)}
        </div>
      </div>
    </header>
  );
}
