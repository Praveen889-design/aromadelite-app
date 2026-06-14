import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationsContext';

const titleByPath = (path) => {
  if (path === '/')              return 'Dashboard';
  if (path === '/quotes/new')    return 'New Quote';
  if (path === '/quotes')        return 'My Quotes';
  if (path.startsWith('/quotes/')) return 'Quote Preview';
  if (path.startsWith('/products')) return 'Product Catalog';
  if (path.startsWith('/leads'))    return 'Lead Tracker';
  if (path.startsWith('/admin'))    return 'Admin Console';
  if (path.startsWith('/clients'))  return 'Clients';
  return 'Aromadelite';
};

const initials = (name = '') =>
  name.split(/\s+/).map((s) => s.replace(/[^A-Za-z]/g, ''))
    .filter(Boolean).slice(0, 2).map((s) => s[0]).join('').toUpperCase() || '?';

const formattedDate = () =>
  new Date().toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  });

const timeAgo = (iso) => {
  if (!iso) return '';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60)   return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

// Colour config per notification type
const TYPE_CFG = {
  discount_approval:        { bg: '#fef3c7', border: '#fcd34d', dot: '#f59e0b', label: 'Discount' },
  modification_review:      { bg: '#eff6ff', border: '#93c5fd', dot: '#3b82f6', label: 'Modification' },
  discount_approved:        { bg: '#f0fdf4', border: '#86efac', dot: '#22c55e', label: 'Approved' },
  discount_rejected:        { bg: '#fef2f2', border: '#fca5a5', dot: '#ef4444', label: 'Rejected' },
  modification_approved:    { bg: '#f0fdf4', border: '#86efac', dot: '#22c55e', label: 'Approved' },
  modification_rejected:    { bg: '#fef2f2', border: '#fca5a5', dot: '#ef4444', label: 'Rejected' },
  client_approved:          { bg: '#f0fdf4', border: '#6ee7b7', dot: '#059669', label: 'Client ✅' },
  client_changes_requested: { bg: '#fefce8', border: '#fde047', dot: '#ca8a04', label: 'Client ✏️' },
};

export default function Header({ onOpenMenu }) {
  const { user }                                           = useAuth();
  const { notifications, unreadCount, markAllRead, refresh } = useNotifications();
  const { pathname }                                       = useLocation();
  const navigate                                           = useNavigate();
  const isHome = pathname === '/';

  const [open, setOpen] = useState(false);
  const panelRef        = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleBellClick = () => {
    if (!open) {
      refresh();           // pull latest immediately when panel opens
      markAllRead();       // reset unread badge
    }
    setOpen((p) => !p);
  };

  const handleNotifClick = (link) => {
    setOpen(false);
    navigate(link);
  };

  const badgeCount = unreadCount > 0 ? unreadCount : null;

  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 40,
      background: isHome ? 'linear-gradient(135deg, #2563EB 0%, #4F46E5 100%)' : '#FFFFFF',
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

        {/* ── Notification Bell ── */}
        <div ref={panelRef} style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={handleBellClick}
            aria-label="Notifications"
            style={{
              border: 0, borderRadius: 10, cursor: 'pointer',
              width: 36, height: 36,
              background: isHome ? 'rgba(255,255,255,.12)' : open ? '#F1F5F9' : 'transparent',
              color: isHome ? '#FFFFFF' : '#6B7280',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              position: 'relative',
              transition: 'background .15s',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>
              <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
            </svg>

            {/* Badge */}
            {badgeCount !== null ? (
              <span style={{
                position: 'absolute', top: 5, right: 4,
                minWidth: 16, height: 16, borderRadius: 8,
                background: '#EF4444',
                color: '#fff',
                fontSize: 10, fontWeight: 800,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '0 3px',
                boxShadow: `0 0 0 2px ${isHome ? '#2563EB' : '#FFFFFF'}`,
                lineHeight: 1,
              }}>
                {badgeCount > 99 ? '99+' : badgeCount}
              </span>
            ) : (
              /* Static amber dot when nothing unread but notifications exist */
              notifications.length > 0 && (
                <span style={{
                  position: 'absolute', top: 7, right: 7,
                  width: 8, height: 8, borderRadius: '50%',
                  background: '#F59E0B',
                  boxShadow: `0 0 0 2px ${isHome ? '#2563EB' : '#FFFFFF'}`,
                }} />
              )
            )}
          </button>

          {/* ── Dropdown Panel ── */}
          {open && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 8px)', right: 0,
              width: 340, maxHeight: 480,
              background: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: 16,
              boxShadow: '0 12px 40px rgba(0,0,0,.13)',
              overflow: 'hidden',
              display: 'flex', flexDirection: 'column',
              zIndex: 100,
            }}>
              {/* Header row */}
              <div style={{
                padding: '12px 16px',
                borderBottom: '1px solid #f1f5f9',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 14, color: '#0f172a' }}>
                    Notifications
                  </div>
                  {notifications.length > 0 && (
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>
                      {notifications.length} pending action{notifications.length !== 1 ? 's' : ''}
                    </div>
                  )}
                </div>
                {notifications.length > 0 && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); refresh(); }}
                    title="Refresh"
                    style={{
                      border: '1px solid #e2e8f0', borderRadius: 8, background: '#f8fafc',
                      color: '#64748b', cursor: 'pointer',
                      width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13,
                    }}
                  >↻</button>
                )}
              </div>

              {/* List */}
              <div style={{ overflowY: 'auto', flex: 1 }}>
                {notifications.length === 0 ? (
                  <div style={{
                    padding: '32px 20px', textAlign: 'center',
                    color: '#94a3b8', fontSize: 13,
                  }}>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>🎉</div>
                    <div style={{ fontWeight: 700, color: '#64748b', marginBottom: 4 }}>
                      All caught up!
                    </div>
                    <div>No pending actions right now.</div>
                  </div>
                ) : (
                  notifications.map((n) => {
                    const cfg = TYPE_CFG[n.type] || { bg: '#f8fafc', border: '#e2e8f0', dot: '#94a3b8', label: '' };
                    return (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => handleNotifClick(n.link)}
                        style={{
                          display: 'block', width: '100%', textAlign: 'left',
                          padding: '12px 16px',
                          background: cfg.bg,
                          borderBottom: `1px solid ${cfg.border}`,
                          border: 'none',
                          cursor: 'pointer',
                          transition: 'filter .1s',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.filter = 'brightness(.96)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.filter = 'none'; }}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                          {/* Icon circle */}
                          <div style={{
                            width: 34, height: 34, borderRadius: '50%',
                            background: '#fff',
                            border: `1.5px solid ${cfg.border}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 16, flexShrink: 0,
                          }}>
                            {n.icon}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                              <span style={{ fontWeight: 800, fontSize: 12, color: '#0f172a' }}>
                                {n.title}
                              </span>
                              <span style={{
                                fontSize: 9, fontWeight: 700,
                                background: cfg.dot, color: '#fff',
                                padding: '1px 6px', borderRadius: 99,
                                textTransform: 'uppercase', letterSpacing: '.04em',
                                flexShrink: 0,
                              }}>
                                {cfg.label}
                              </span>
                            </div>
                            <div style={{
                              fontSize: 12, color: '#475569',
                              lineHeight: 1.4,
                              overflow: 'hidden', textOverflow: 'ellipsis',
                              display: '-webkit-box', WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                            }}>
                              {n.message}
                            </div>
                            <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 3 }}>
                              {timeAgo(n.created_at)} · {n.quote_number}
                            </div>
                          </div>
                          {/* Chevron */}
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" style={{ flexShrink: 0, marginTop: 4 }}>
                            <polyline points="9 18 15 12 9 6"/>
                          </svg>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>

              {/* Footer — admin shortcut */}
              {user?.role === 'admin' && notifications.length > 0 && (
                <div style={{
                  padding: '10px 16px',
                  borderTop: '1px solid #f1f5f9',
                  background: '#f8fafc',
                }}>
                  <button
                    type="button"
                    onClick={() => { setOpen(false); navigate('/admin?tab=discounts'); }}
                    style={{
                      width: '100%', textAlign: 'center',
                      border: 'none', background: 'transparent',
                      color: '#2563EB', fontSize: 12, fontWeight: 700,
                      cursor: 'pointer', padding: '4px 0',
                    }}
                  >
                    Open Admin Console →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Avatar */}
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          background: isHome ? '#22D3EE' : '#2563EB',
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
