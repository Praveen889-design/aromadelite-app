import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  GridIcon, PlusCircleIcon, DocumentIcon, PackageIcon,
  UsersIcon, ShieldIcon, LogoutIcon, XIcon, BuildingIcon,
} from './Icons';

/* ─── Brand emblem (inline SVG, 36×36 rendered) ───────────── */
const BrandEmblem = ({ size = 36 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">
    <rect width="64" height="64" rx="12" fill="#1F6BC7"/>
    <g transform="translate(32 42.24)">
      <g transform="translate(0 0) scale(0.21714285714285714)">
        <ellipse cx="-6" cy="3" rx="120" ry="4" fill="#143A6E" opacity="0.35"/>
        <g transform="translate(-88 0)">
          <rect x="-3.5" y="-8" width="7" height="12" rx="1.5" fill="#6A4527"/>
          <path d="M0 -82 C 24 -82  32 -58  32 -36 C 32 -14  18 -6   0 -6 C -18 -6 -32 -14 -32 -36 C -32 -58 -24 -82 0 -82 Z" fill="#3D9354"/>
          <path d="M-2 -74 C 12 -74  20 -56  20 -40 C 20 -28  10 -22 -2 -22 C -14 -22 -20 -32 -20 -46 C -20 -60 -16 -74 -2 -74 Z" fill="#2F7B43" opacity="0.55"/>
        </g>
        <g transform="translate(20 0)">
          <rect x="-42" y="-58" width="84" height="58" rx="2" fill="#F8F2E0"/>
          <rect x="22" y="-58" width="20" height="58" fill="#E5DBC1" opacity="0.7"/>
          <path d="M-52 -58 L 0 -98 L 52 -58 Z" fill="#D34B3F"/>
          <path d="M0 -98 L 52 -58 L 14 -58 Z" fill="#B83A2F"/>
          <rect x="20" y="-90" width="10" height="18" fill="#B83A2F"/>
          <rect x="-9" y="-28" width="18" height="28" rx="1" fill="#2E2A24"/>
          <circle cx="6" cy="-13" r="1.6" fill="#F8F2E0"/>
          <rect x="-32" y="-48" width="22" height="18" rx="1" fill="#1F6BC7"/>
          <line x1="-21" y1="-48" x2="-21" y2="-30" stroke="#F8F2E0" strokeWidth="1.8"/>
          <line x1="-32" y1="-39" x2="-10" y2="-39" stroke="#F8F2E0" strokeWidth="1.8"/>
        </g>
      </g>
    </g>
  </svg>
);

const navItems = [
  { to: '/',           label: 'Dashboard',        icon: GridIcon },
  { to: '/quotes/new', label: 'New Quote',         icon: PlusCircleIcon, primary: true },
  { to: '/quotes',     label: 'My Quotes',         icon: DocumentIcon },
  { to: '/products',   label: 'Products Catalog',  icon: PackageIcon },
  { to: '/leads',      label: 'Leads',             icon: UsersIcon },
  { to: '/clients',    label: 'Clients',           icon: BuildingIcon },
  { to: '/admin',      label: 'Admin Panel',       icon: ShieldIcon, adminOnly: true, coLabel: 'Office Panel' },
];

const initials = (name = '') =>
  name.split(/\s+/).map((s) => s.replace(/[^A-Za-z]/g, ''))
    .filter(Boolean).slice(0, 2).map((s) => s[0]).join('').toUpperCase() || '·';

export default function Sidebar({ open, onClose }) {
  const { user, logout } = useAuth();
  const isAdmin = user?.role === 'admin';
  const isCentralOffice = user?.role === 'central_office';
  const visible = navItems.filter((i) => !i.adminOnly || isAdmin || isCentralOffice);

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-slate-900/40 z-30 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={[
          'fixed lg:static z-40 top-0 left-0 h-full w-72 flex flex-col',
          'transition-transform duration-200',
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        ].join(' ')}
        style={{ backgroundColor: '#0F1620' }}
        aria-label="Primary navigation"
      >
        {/* Brand lockup */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4">
          <div className="flex items-center gap-3">
            <BrandEmblem size={38} />
            <div className="leading-tight">
              <div style={{
                fontFamily: "'Manrope', sans-serif",
                fontWeight: 800,
                fontSize: 17,
                letterSpacing: '-0.02em',
                color: '#F8F2E0',
                textTransform: 'lowercase',
              }}>
                aromadelite
              </div>
              <div style={{
                fontSize: 9,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.14em',
                color: 'rgba(248,242,224,0.45)',
                marginTop: 1,
              }}>
                Sri Vemuri Sai Ent.
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="lg:hidden p-1"
            style={{ color: 'rgba(248,242,224,0.6)' }}
            aria-label="Close menu"
          >
            <XIcon />
          </button>
        </div>

        {/* User card */}
        <div className="mx-4 mb-4 rounded-xl px-3 py-3 flex items-center gap-3"
             style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="w-10 h-10 rounded-full font-bold flex items-center justify-center text-sm flex-shrink-0"
               style={{ background: '#1F6BC7', color: '#F8F2E0' }}>
            {initials(user?.name)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold truncate" style={{ color: '#F8F2E0' }}>{user?.name}</div>
            <div className="text-[11px] truncate" style={{ color: 'rgba(248,242,224,0.5)' }}>{user?.employee_id}</div>
          </div>
          {user?.region && (
            <span className="text-[10px] px-2 py-0.5 rounded-full flex-shrink-0"
                  style={{ background: 'rgba(31,107,199,0.25)', color: '#93C0F5', border: '1px solid rgba(31,107,199,0.4)' }}>
              {user.region}
            </span>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
          {visible.map(({ to, label, coLabel, icon: Icon, primary }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={onClose}
              className={({ isActive }) =>
                [
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150',
                  isActive
                    ? 'font-semibold shadow-sm'
                    : primary
                      ? 'font-semibold'
                      : 'font-medium',
                ].join(' ')
              }
              style={({ isActive }) =>
                isActive
                  ? { background: '#1F6BC7', color: '#F8F2E0' }
                  : primary
                    ? { background: '#D34B3F', color: '#fff' }
                    : { color: 'rgba(248,242,224,0.7)' }
              }
              onMouseEnter={(e) => {
                const el = e.currentTarget;
                if (!el.dataset.active) el.style.background = 'rgba(255,255,255,0.07)';
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget;
                if (!el.dataset.active) el.style.background = '';
              }}
            >
              <Icon />
              <span>{isCentralOffice && coLabel ? coLabel : label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Logout */}
        <div className="p-3" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <button
            type="button"
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150"
            style={{ color: 'rgba(248,242,224,0.55)', fontFamily: "'Inter', sans-serif" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = '#F8F2E0'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = ''; e.currentTarget.style.color = 'rgba(248,242,224,0.55)'; }}
          >
            <LogoutIcon />
            <span>Sign out</span>
          </button>
        </div>
      </aside>
    </>
  );
}
