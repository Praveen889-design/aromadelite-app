import React from 'react';
import { NavLink } from 'react-router-dom';

const HomeIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 11 12 4l9 7"/><path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9"/>
  </svg>
);
const QuoteIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
    <path d="M14 3v6h6M8 13h8M8 17h5"/>
  </svg>
);
const LeadsIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="9" r="3.5"/>
    <path d="M2.5 19c.6-3.2 3.4-5.5 6.5-5.5s5.9 2.3 6.5 5.5"/>
    <path d="M16 4a3 3 0 0 1 0 6M22 18c-.4-2.4-2.2-4-4.5-4.4"/>
  </svg>
);
const ClientsIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2"/>
    <path d="M3 9h18M9 21V9M15 21V9"/>
  </svg>
);
const MenuDotsIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="5" cy="5" r="1.5"/><circle cx="12" cy="5" r="1.5"/><circle cx="19" cy="5" r="1.5"/>
    <circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>
    <circle cx="5" cy="19" r="1.5"/><circle cx="12" cy="19" r="1.5"/><circle cx="19" cy="19" r="1.5"/>
  </svg>
);

const ITEMS = [
  { to: '/',          label: 'Home',    Icon: HomeIcon,    end: true },
  { to: '/quotes',    label: 'Quotes',  Icon: QuoteIcon },
  { to: '/leads',     label: 'Leads',   Icon: LeadsIcon },
  { to: '/clients',   label: 'Clients', Icon: ClientsIcon },
];

export default function BottomNav({ onOpenMenu }) {
  return (
    <nav
      style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        zIndex: 30,
        background: '#FFFFFF',
        borderTop: '1px solid #E5E7EB',
        boxShadow: '0 -4px 14px rgba(8,42,56,.06)',
        gridTemplateColumns: 'repeat(5, 1fr)',
        paddingBottom: 'env(safe-area-inset-bottom, 4px)',
      }}
      className="grid lg:hidden"
      aria-label="Mobile primary navigation"
    >
      {ITEMS.map(({ to, label, Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={!!end}
          style={({ isActive }) => ({
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', gap: 2,
            padding: '8px 0',
            color: isActive ? '#0E7490' : '#94A3B8',
            fontFamily: "'Source Sans 3', sans-serif",
            fontWeight: 600, fontSize: 10.5,
            textDecoration: 'none',
            position: 'relative',
          })}
        >
          {({ isActive }) => (
            <>
              {isActive && (
                <div style={{
                  position: 'absolute', top: 0, width: 24, height: 3,
                  borderRadius: 3, background: '#0E7490',
                }} />
              )}
              <Icon />
              <span>{label}</span>
            </>
          )}
        </NavLink>
      ))}
      <button
        type="button"
        onClick={onOpenMenu}
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: 2,
          padding: '8px 0',
          color: '#94A3B8',
          fontFamily: "'Source Sans 3', sans-serif",
          fontWeight: 600, fontSize: 10.5,
          border: 0, background: 'transparent', cursor: 'pointer',
        }}
        aria-label="Open menu"
      >
        <MenuDotsIcon />
        <span>Menu</span>
      </button>
    </nav>
  );
}
