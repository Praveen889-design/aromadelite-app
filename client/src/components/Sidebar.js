import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  GridIcon, PlusCircleIcon, DocumentIcon, PackageIcon,
  UsersIcon, ShieldIcon, LogoutIcon, XIcon,
} from './Icons';

const navItems = [
  { to: '/',          label: 'Dashboard',         icon: GridIcon },
  { to: '/quotes/new', label: 'New Quote',        icon: PlusCircleIcon, primary: true },
  { to: '/quotes',    label: 'My Quotes',         icon: DocumentIcon },
  { to: '/products',  label: 'Products Catalog',  icon: PackageIcon },
  { to: '/leads',     label: 'Leads',             icon: UsersIcon },
  { to: '/admin',     label: 'Admin Panel',       icon: ShieldIcon, adminOnly: true },
];

const initials = (name = '') =>
  name.split(/\s+/).map((s) => s.replace(/[^A-Za-z]/g, ''))
    .filter(Boolean).slice(0, 2).map((s) => s[0]).join('').toUpperCase() || '·';

export default function Sidebar({ open, onClose }) {
  const { user, logout } = useAuth();
  const isAdmin = user?.role === 'admin';
  const visible = navItems.filter((i) => !i.adminOnly || isAdmin);

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
          'fixed lg:static z-40 top-0 left-0 h-full w-72 text-white flex flex-col',
          'transition-transform duration-200',
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        ].join(' ')}
        style={{ backgroundColor: '#0891B2' }}
        aria-label="Primary navigation"
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-white text-cyan-700 flex items-center justify-center font-extrabold">
              A
            </div>
            <div className="leading-tight">
              <div className="text-lg font-extrabold tracking-tight">Aromadelite</div>
              <div className="text-[10px] uppercase tracking-widest text-cyan-100/80">
                Sri Vemuri Sai Ent.
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="lg:hidden text-white/80 hover:text-white p-1"
            aria-label="Close menu"
          >
            <XIcon />
          </button>
        </div>

        {/* User card */}
        <div className="mx-4 mb-4 rounded-lg bg-white/10 backdrop-blur px-3 py-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white text-cyan-700 font-bold flex items-center justify-center">
            {initials(user?.name)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold truncate">{user?.name}</div>
            <div className="text-[11px] text-cyan-100/90 truncate">{user?.employee_id}</div>
          </div>
          {user?.region && (
            <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full">{user.region}</span>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
          {visible.map(({ to, label, icon: Icon, primary }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={onClose}
              className={({ isActive }) =>
                [
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                  isActive
                    ? 'bg-white text-cyan-700 font-semibold shadow-sm'
                    : primary
                      ? 'bg-emerald-500/95 hover:bg-emerald-500 text-white font-semibold'
                      : 'text-cyan-50 hover:bg-white/10',
                ].join(' ')
              }
            >
              <Icon />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Logout */}
        <div className="p-3 border-t border-white/10">
          <button
            type="button"
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-cyan-50 hover:bg-white/10"
          >
            <LogoutIcon />
            <span>Sign out</span>
          </button>
        </div>
      </aside>
    </>
  );
}
